import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, parseISO } from 'date-fns'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Accept one or more months: ?month=2026-04 OR ?months=2026-03,2026-04,2026-05
  const singleMonth  = searchParams.get('month')
  const multiMonths  = searchParams.get('months')

  const monthList: string[] = multiMonths
    ? multiMonths.split(',').map(m => m.trim()).filter(m => /^\d{4}-\d{2}$/.test(m))
    : singleMonth && /^\d{4}-\d{2}$/.test(singleMonth)
      ? [singleMonth]
      : []

  if (!monthList.length) {
    return NextResponse.json({ error: 'month or months param required (YYYY-MM)' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // ── Collect data for each month ───────────────────────────────────────────
  type MowRow      = { week_start: string; properties: { address: string; price_per_mow: number; customers: { full_name: string } | null } | null }
  type OneOffRow   = { completed_date: string; description: string | null; amount: number | null; customers: { full_name: string } | null }
  type TimeLog     = { duration_minutes: number | null; profiles: { id: string; full_name: string; hourly_rate: number | null } | null }
  type ManualRow   = { hours: number | null; profiles: { id: string; full_name: string; hourly_rate: number | null } | null }
  type BonusRow    = { amount: number | null; description: string | null; entry_date: string; profiles: { id: string; full_name: string } | null }

  // Rows for each sheet
  const incomeRows:   (string | number)[][] = [['Month', 'Date', 'Type', 'Customer', 'Description / Address', 'Amount']]
  const expenseRows:  (string | number)[][] = [['Month', 'Date', 'Merchant', 'Category', 'Payment Method', 'Notes', 'Amount', 'Counts Toward Profit']]
  const payrollRows:  (string | number)[][] = [['Month', 'Employee', 'Clock Hours', 'Manual Hours', 'Total Hours', 'Hourly Rate', 'Base Pay', 'Bonuses', 'Total Pay']]
  const bonusRows:    (string | number)[][] = [['Month', 'Date', 'Employee', 'Description', 'Amount']]
  const summaryRows:  (string | number)[][] = [['Month', 'Mow Revenue', 'One-Off Revenue', 'Total Revenue', 'Expenses', 'Payroll', 'Net Profit']]

  for (const monthParam of monthList) {
    const monthDate  = parseISO(`${monthParam}-01`)
    const monthStart = startOfMonth(monthDate)
    const monthEnd   = endOfMonth(monthDate)
    const start      = format(monthStart, 'yyyy-MM-dd')
    const end        = format(monthEnd,   'yyyy-MM-dd')
    const label      = format(monthDate,  'MMM yyyy')

    const weeksInMonth = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 }
    ).map(w => format(w, 'yyyy-MM-dd'))

    // Income: mowing
    const { data: jobData } = await supabase
      .from('job_logs')
      .select('week_start, properties(address, price_per_mow, customers(full_name))')
      .eq('status', 'done')
      .in('week_start', weeksInMonth)
      .order('week_start')

    let mowRevenue = 0
    for (const j of (jobData ?? []) as MowRow[]) {
      const price = j.properties?.price_per_mow ?? 0
      mowRevenue += price
      incomeRows.push([
        label,
        j.week_start,
        'Mowing',
        j.properties?.customers?.full_name ?? '',
        j.properties?.address ?? '',
        price,
      ])
    }

    // Income: one-off
    const { data: oneOffData } = await supabase
      .from('one_off_jobs')
      .select('completed_date, description, amount, customers(full_name)')
      .eq('status', 'done')
      .gte('completed_date', start)
      .lte('completed_date', end)
      .order('completed_date')

    let oneOffRevenue = 0
    for (const j of (oneOffData ?? []) as OneOffRow[]) {
      const amt = j.amount ?? 0
      oneOffRevenue += amt
      incomeRows.push([
        label,
        j.completed_date,
        'One-Off Job',
        (j.customers as { full_name: string } | null)?.full_name ?? '',
        j.description ?? '',
        amt,
      ])
    }

    // Expenses — all shown in sheet for tax records; only non-capital count toward profit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: expData } = await (supabase as any)
      .from('expenses')
      .select('expense_date, merchant, category, payment_method, notes, amount')
      .gte('expense_date', start)
      .lte('expense_date', end)
      .order('expense_date')

    let totalExpenses = 0
    for (const e of expData ?? []) {
      const amt = Number(e.amount ?? 0)
      const isCapital = e.payment_method === 'capital'
      // Capital expenses don't count against operating profit (tracked for taxes only)
      if (!isCapital) totalExpenses += amt
      const pmLabel = e.payment_method === 'credit_card' ? 'Credit Card'
                    : e.payment_method === 'loan'        ? 'Loan'
                    :                                      'Capital'
      expenseRows.push([label, e.expense_date, e.merchant, e.category, pmLabel, e.notes ?? '', amt, isCapital ? 'No (Capital)' : 'Yes'])
    }

    // Payroll: clock hours
    const { data: timeLogs } = await supabase
      .from('time_logs')
      .select('duration_minutes, profiles(id, full_name, hourly_rate)')
      .gte('clock_in', `${start}T00:00:00`)
      .lte('clock_in', `${end}T23:59:59`)
      .not('clock_out', 'is', null)

    const clockByEmp: Record<string, { name: string; rate: number; minutes: number }> = {}
    for (const t of (timeLogs ?? []) as TimeLog[]) {
      const p = t.profiles; if (!p) continue
      if (!clockByEmp[p.id]) clockByEmp[p.id] = { name: p.full_name, rate: p.hourly_rate ?? 0, minutes: 0 }
      clockByEmp[p.id].minutes += t.duration_minutes ?? 0
    }

    // Payroll: manual hours
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: manualHours } = await (supabase as any)
      .from('employee_monthly_hours')
      .select('hours, profiles(id, full_name, hourly_rate)')
      .eq('month', monthParam)

    const manualByEmp: Record<string, { name: string; rate: number; hours: number }> = {}
    for (const m of ((manualHours ?? []) as ManualRow[])) {
      const p = m.profiles; if (!p) continue
      manualByEmp[p.id] = { name: p.full_name, rate: p.hourly_rate ?? 0, hours: m.hours ?? 0 }
    }

    // Payroll: bonuses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bonuses } = await (supabase as any)
      .from('employee_bonuses')
      .select('amount, description, entry_date, profiles(id, full_name)')
      .eq('type', 'bonus')
      .gte('entry_date', start)
      .lte('entry_date', end)

    const bonusByEmp: Record<string, { name: string; total: number; entries: { date: string; desc: string; amt: number }[] }> = {}
    for (const b of ((bonuses ?? []) as BonusRow[])) {
      const p = b.profiles; if (!p) continue
      if (!bonusByEmp[p.id]) bonusByEmp[p.id] = { name: p.full_name, total: 0, entries: [] }
      bonusByEmp[p.id].total += b.amount ?? 0
      bonusByEmp[p.id].entries.push({ date: b.entry_date, desc: b.description ?? '', amt: b.amount ?? 0 })
    }

    // Bonus detail rows
    for (const info of Object.values(bonusByEmp)) {
      for (const e of info.entries) {
        bonusRows.push([label, e.date, info.name, e.desc, e.amt])
      }
    }

    // Payroll summary rows
    const allEmpIds = new Set([...Object.keys(clockByEmp), ...Object.keys(manualByEmp), ...Object.keys(bonusByEmp)])
    let totalPayroll = 0
    for (const id of allEmpIds) {
      const clock     = clockByEmp[id]
      const manual    = manualByEmp[id]
      const bonusInfo = bonusByEmp[id]
      const name      = clock?.name ?? manual?.name ?? bonusInfo?.name ?? 'Unknown'
      const rate      = clock?.rate ?? manual?.rate ?? 0
      const clockHrs  = (clock?.minutes ?? 0) / 60
      const manualHrs = manual?.hours ?? 0
      const totalHrs  = clockHrs + manualHrs
      const basePay   = totalHrs * rate
      const bonusPay  = bonusInfo?.total ?? 0
      const totalPay  = basePay + bonusPay
      totalPayroll   += totalPay
      payrollRows.push([label, name, Number(clockHrs.toFixed(2)), Number(manualHrs.toFixed(2)), Number(totalHrs.toFixed(2)), rate, Number(basePay.toFixed(2)), Number(bonusPay.toFixed(2)), Number(totalPay.toFixed(2))])
    }

    const totalRevenue = mowRevenue + oneOffRevenue
    const profit = totalRevenue - totalExpenses - totalPayroll
    summaryRows.push([label, mowRevenue, oneOffRevenue, totalRevenue, totalExpenses, totalPayroll, profit])
  }

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  const mkSheet = (data: (string | number)[][], cols: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = cols.map(w => ({ wch: w }))
    return ws
  }

  XLSX.utils.book_append_sheet(wb, mkSheet(summaryRows,  [12, 16, 16, 16, 14, 12, 14]), 'Summary')
  XLSX.utils.book_append_sheet(wb, mkSheet(incomeRows,   [12, 12, 14, 22, 35, 12]),     'Income')
  XLSX.utils.book_append_sheet(wb, mkSheet(expenseRows,  [12, 12, 22, 14, 14, 30, 12, 20]), 'Expenses')
  XLSX.utils.book_append_sheet(wb, mkSheet(payrollRows,  [12, 20, 13, 14, 13, 13, 12, 12, 12]), 'Payroll')
  XLSX.utils.book_append_sheet(wb, mkSheet(bonusRows,    [12, 12, 20, 30, 12]),         'Bonuses')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const fileLabel = monthList.length === 1 ? monthList[0] : `${monthList[0]}_to_${monthList[monthList.length - 1]}`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="gray-wolf-${fileLabel}.xlsx"`,
    },
  })
}
