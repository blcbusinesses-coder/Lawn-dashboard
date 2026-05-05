import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, parseISO } from 'date-fns'

function q(val: string | number | null | undefined): string {
  return `"${String(val ?? '').replace(/"/g, '""')}"`
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(q).join(',')
}

function section(title: string, rows: string[]): string {
  return [title, ...rows, ''].join('\r\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month') // 'YYYY-MM'
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
  }

  const supabase = await createClient()
  const monthDate = parseISO(`${monthParam}-01`)
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const start = format(monthStart, 'yyyy-MM-dd')
  const end = format(monthEnd, 'yyyy-MM-dd')
  const label = format(monthDate, 'MMMM yyyy')

  const weeksInMonth = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 }
  ).map((w) => format(w, 'yyyy-MM-dd'))

  // ── 1. Mowing income ───────────────────────────────────────────────────────
  const { data: jobData } = await supabase
    .from('job_logs')
    .select('week_start, properties(address, price_per_mow, customers(full_name))')
    .eq('status', 'done')
    .in('week_start', weeksInMonth)
    .order('week_start')

  type JobRow = {
    week_start: string
    properties: { address: string; price_per_mow: number; customers: { full_name: string } | null } | null
  }

  const mowRows: string[] = [row(['Date', 'Type', 'Customer', 'Address', 'Amount'])]
  let mowRevenue = 0
  for (const j of (jobData ?? []) as JobRow[]) {
    const price = j.properties?.price_per_mow ?? 0
    mowRevenue += price
    mowRows.push(row([
      j.week_start,
      'Mowing',
      j.properties?.customers?.full_name ?? '',
      j.properties?.address ?? '',
      price.toFixed(2),
    ]))
  }

  // ── 2. One-off income ─────────────────────────────────────────────────────
  const { data: oneOffData } = await supabase
    .from('one_off_jobs')
    .select('completed_date, description, amount, customers(full_name)')
    .eq('status', 'done')
    .gte('completed_date', start)
    .lte('completed_date', end)
    .order('completed_date')

  type OneOffRow = {
    completed_date: string
    description: string | null
    amount: number | null
    customers: { full_name: string } | null
  }

  let oneOffRevenue = 0
  const oneOffRows: string[] = []
  for (const j of (oneOffData ?? []) as OneOffRow[]) {
    const amt = j.amount ?? 0
    oneOffRevenue += amt
    oneOffRows.push(row([
      j.completed_date,
      'One-Off Job',
      (j.customers as { full_name: string } | null)?.full_name ?? '',
      j.description ?? '',
      amt.toFixed(2),
    ]))
  }

  const allIncomeRows = [...mowRows, ...oneOffRows]
  const totalRevenue = mowRevenue + oneOffRevenue

  // ── 3. Expenses ────────────────────────────────────────────────────────────
  const { data: expData } = await supabase
    .from('expenses')
    .select('expense_date, merchant, category, notes, amount')
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date')

  const expRows: string[] = [row(['Date', 'Merchant', 'Category', 'Notes', 'Amount'])]
  let totalExpenses = 0

  // Group by category for subtotals
  const byCat: Record<string, number> = {}
  for (const e of expData ?? []) {
    const amt = e.amount ?? 0
    totalExpenses += amt
    byCat[e.category ?? 'other'] = (byCat[e.category ?? 'other'] ?? 0) + amt
    expRows.push(row([e.expense_date, e.merchant, e.category, e.notes, amt.toFixed(2)]))
  }
  expRows.push(row(['', '', '', 'TOTAL', totalExpenses.toFixed(2)]))
  expRows.push(row(['', '', '', '', '']))
  expRows.push(row(['Category Subtotals', '', '', '', '']))
  expRows.push(row(['Category', 'Total', '', '', '']))
  for (const [cat, amt] of Object.entries(byCat).sort()) {
    expRows.push(row([cat, amt.toFixed(2), '', '', '']))
  }

  // ── 4. Employee payroll ────────────────────────────────────────────────────
  // Clock-in time logs
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select('duration_minutes, profiles(id, full_name, hourly_rate)')
    .gte('clock_in', `${start}T00:00:00`)
    .lte('clock_in', `${end}T23:59:59`)
    .not('clock_out', 'is', null)

  type TimeLog = { duration_minutes: number | null; profiles: { id: string; full_name: string; hourly_rate: number | null } | null }

  const clockByEmployee: Record<string, { name: string; rate: number; minutes: number }> = {}
  for (const t of (timeLogs ?? []) as TimeLog[]) {
    const p = t.profiles
    if (!p) continue
    if (!clockByEmployee[p.id]) clockByEmployee[p.id] = { name: p.full_name, rate: p.hourly_rate ?? 0, minutes: 0 }
    clockByEmployee[p.id].minutes += t.duration_minutes ?? 0
  }

  // Manual monthly hours
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: manualHours } = await (supabase as any)
    .from('employee_monthly_hours')
    .select('hours, profiles(id, full_name, hourly_rate)')
    .eq('month', monthParam)

  type ManualRow = { hours: number | null; profiles: { id: string; full_name: string; hourly_rate: number | null } | null }
  const manualByEmployee: Record<string, { name: string; rate: number; hours: number }> = {}
  for (const m of ((manualHours ?? []) as ManualRow[])) {
    const p = m.profiles
    if (!p) continue
    manualByEmployee[p.id] = { name: p.full_name, rate: p.hourly_rate ?? 0, hours: m.hours ?? 0 }
  }

  // Bonuses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bonuses } = await (supabase as any)
    .from('employee_bonuses')
    .select('amount, description, entry_date, profiles(id, full_name)')
    .eq('type', 'bonus')
    .gte('entry_date', start)
    .lte('entry_date', end)

  type BonusRow = { amount: number | null; description: string | null; entry_date: string; profiles: { id: string; full_name: string } | null }
  const bonusByEmployee: Record<string, { name: string; total: number; entries: Array<{ date: string; desc: string; amt: number }> }> = {}
  for (const b of ((bonuses ?? []) as BonusRow[])) {
    const p = b.profiles
    if (!p) continue
    if (!bonusByEmployee[p.id]) bonusByEmployee[p.id] = { name: p.full_name, total: 0, entries: [] }
    bonusByEmployee[p.id].total += b.amount ?? 0
    bonusByEmployee[p.id].entries.push({ date: b.entry_date, desc: b.description ?? '', amt: b.amount ?? 0 })
  }

  const allEmployeeIds = new Set([
    ...Object.keys(clockByEmployee),
    ...Object.keys(manualByEmployee),
    ...Object.keys(bonusByEmployee),
  ])

  const payRows: string[] = [row(['Employee', 'Clock Hours', 'Manual Hours', 'Total Hours', 'Hourly Rate', 'Clock Pay', 'Manual Pay', 'Bonuses', 'Total Pay'])]
  let totalPayroll = 0

  for (const id of allEmployeeIds) {
    const clock = clockByEmployee[id]
    const manual = manualByEmployee[id]
    const bonusInfo = bonusByEmployee[id]
    const name = clock?.name ?? manual?.name ?? bonusInfo?.name ?? 'Unknown'
    const rate = clock?.rate ?? manual?.rate ?? 0
    const clockHrs = (clock?.minutes ?? 0) / 60
    const manualHrs = manual?.hours ?? 0
    const totalHrs = clockHrs + manualHrs
    const clockPay = clockHrs * rate
    const manualPay = manualHrs * rate
    const bonusPay = bonusInfo?.total ?? 0
    const totalPay = clockPay + manualPay + bonusPay
    totalPayroll += totalPay

    payRows.push(row([
      name,
      clockHrs.toFixed(2),
      manualHrs.toFixed(2),
      totalHrs.toFixed(2),
      rate.toFixed(2),
      clockPay.toFixed(2),
      manualPay.toFixed(2),
      bonusPay.toFixed(2),
      totalPay.toFixed(2),
    ]))
  }

  if (allEmployeeIds.size === 0) {
    payRows.push(row(['No payroll data for this month', '', '', '', '', '', '', '', '']))
  }
  payRows.push(row(['', '', '', '', '', '', '', 'TOTAL', totalPayroll.toFixed(2)]))

  // Bonus detail rows
  const bonusDetailRows: string[] = [row(['Date', 'Employee', 'Description', 'Amount'])]
  for (const info of Object.values(bonusByEmployee)) {
    for (const e of info.entries) {
      bonusDetailRows.push(row([e.date, info.name, e.desc, e.amt.toFixed(2)]))
    }
  }

  // ── 5. Summary ─────────────────────────────────────────────────────────────
  const profit = totalRevenue - totalExpenses - totalPayroll
  const summaryRows: string[] = [
    row(['GRAY WOLF WORKERS —', label, '', '']),
    row(['', '', '', '']),
    row(['Category', 'Amount', '', '']),
    row(['Total Revenue', totalRevenue.toFixed(2), '', '']),
    row(['  Mowing Income', mowRevenue.toFixed(2), '', '']),
    row(['  One-Off Jobs', oneOffRevenue.toFixed(2), '', '']),
    row(['Total Expenses', totalExpenses.toFixed(2), '', '']),
    row(['Total Payroll', totalPayroll.toFixed(2), '', '']),
    row(['Net Profit', profit.toFixed(2), '', '']),
  ]

  // ── Assemble ───────────────────────────────────────────────────────────────
  const body = [
    section('SUMMARY', summaryRows),
    section('INCOME DETAIL', allIncomeRows),
    section('EXPENSES', expRows),
    section('EMPLOYEE PAYROLL', payRows),
    section('BONUS DETAIL', bonusDetailRows),
  ].join('\r\n')

  const filename = `gray-wolf-${monthParam}.csv`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
