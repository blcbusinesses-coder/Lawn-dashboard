import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

function csv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
}

export async function GET(request: NextRequest) {
  const supabase = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const months = parseInt(searchParams.get('months') ?? '12')

  const sections: string[] = []

  // ── Summary ────────────────────────────────────────────────────────────────
  const summaryRows: string[][] = [['Month', 'Revenue', 'Expenses', 'Payroll', 'Net Profit']]

  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i)
    const monthStart = startOfMonth(d)
    const monthEnd = endOfMonth(d)
    const start = format(monthStart, 'yyyy-MM-dd')
    const end = format(monthEnd, 'yyyy-MM-dd')
    const label = format(d, 'MMM yyyy')
    const monthKey = format(d, 'yyyy-MM')

    const { data: jobData } = await supabase.from('job_logs')
      .select('properties(price_per_mow)').eq('status', 'done')
      .gte('week_start', start).lte('week_start', end)
    const mowRevenue = (jobData ?? []).reduce((s, j) => s + ((j.properties as { price_per_mow: number } | null)?.price_per_mow ?? 0), 0)

    const { data: oneOffData } = await supabase.from('one_off_jobs')
      .select('amount').eq('status', 'done').gte('completed_date', start).lte('completed_date', end)
    const oneOffRevenue = (oneOffData ?? []).reduce((s, j) => s + (j.amount ?? 0), 0)
    const revenue = mowRevenue + oneOffRevenue

    const { data: expData } = await supabase.from('expenses')
      .select('amount').gte('expense_date', start).lte('expense_date', end)
    const expenses = (expData ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)

    const { data: timeData } = await supabase.from('time_logs')
      .select('duration_minutes, profiles(hourly_rate)')
      .gte('clock_in', `${start}T00:00:00`).lte('clock_in', `${end}T23:59:59`).not('clock_out', 'is', null)
    const clockPayroll = (timeData ?? []).reduce((s, t) => {
      const rate = (t.profiles as { hourly_rate: number | null } | null)?.hourly_rate ?? 0
      return s + ((t.duration_minutes ?? 0) / 60) * rate
    }, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: manualData } = await (supabase as any).from('employee_monthly_hours')
      .select('hours, profiles(hourly_rate)').eq('month', monthKey)
    const manualPayroll = ((manualData ?? []) as Array<{ hours: number | null; profiles: { hourly_rate: number | null } | null }>)
      .reduce((s, m) => s + (m.hours ?? 0) * (m.profiles?.hourly_rate ?? 0), 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bonusData } = await (supabase as any).from('employee_bonuses')
      .select('amount').eq('type', 'bonus').gte('entry_date', start).lte('entry_date', end)
    const bonusPayroll = ((bonusData ?? []) as Array<{ amount: number | null }>).reduce((s, b) => s + (b.amount ?? 0), 0)

    const payroll = clockPayroll + manualPayroll + bonusPayroll
    const profit = revenue - expenses - payroll

    summaryRows.push([label, revenue.toFixed(2), expenses.toFixed(2), payroll.toFixed(2), profit.toFixed(2)])
  }

  sections.push('MONTHLY SUMMARY')
  sections.push(csv(summaryRows))

  // ── Expenses detail ────────────────────────────────────────────────────────
  const oldest = format(subMonths(new Date(), months - 1), 'yyyy-MM-dd')
  const { data: expDetail } = await supabase.from('expenses')
    .select('expense_date, category, merchant, notes, amount').gte('expense_date', oldest).order('expense_date')

  const expRows: string[][] = [['Date', 'Category', 'Merchant', 'Notes', 'Amount']]
  for (const e of expDetail ?? []) {
    expRows.push([e.expense_date ?? '', e.category ?? '', e.merchant ?? '', e.notes ?? '', String(e.amount ?? 0)])
  }
  sections.push('\r\nEXPENSE DETAIL')
  sections.push(csv(expRows))

  // ── Payroll detail ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bonusDetail } = await (supabase as any).from('employee_bonuses')
    .select('entry_date, type, amount, description, profiles(full_name)')
    .eq('type', 'bonus').gte('entry_date', oldest).order('entry_date')

  const payRows: string[][] = [['Date', 'Employee', 'Description', 'Amount']]
  for (const b of (bonusDetail ?? []) as Array<{ entry_date: string; amount: number; description: string; profiles: { full_name: string } | null }>) {
    payRows.push([b.entry_date, b.profiles?.full_name ?? '', b.description ?? '', String(b.amount)])
  }
  sections.push('\r\nPAYROLL DETAIL (flat pay entries)')
  sections.push(csv(payRows))

  const body = sections.join('\r\n')
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="gray-wolf-financials-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
    },
  })
}
