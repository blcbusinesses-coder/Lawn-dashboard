import { createAdminClient as createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'

// Months between two startOfMonth dates (b - a), e.g. May→Jul = 2
function monthDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const months = parseInt(searchParams.get('months') ?? '12')
  // Optional single-month focus: ?month=YYYY-MM returns just that month.
  const monthParam = searchParams.get('month')
  const singleMonth = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null

  // Build the list of months to report on (newest last).
  const targetDates: Date[] = singleMonth
    ? [parseISO(`${singleMonth}-01`)]
    : Array.from({ length: months }, (_, idx) => subMonths(new Date(), months - 1 - idx))

  // ── Fetch all CC/loan obligations once (outside the month loop) ─────────────
  // These are spread across months rather than counted in full on purchase date.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: obligationRows } = await (supabase as any)
    .from('expenses')
    .select('amount, payment_method, expense_date, due_date, settled_at')
    .in('payment_method', ['credit_card', 'loan'])
    .not('due_date', 'is', null)

  type ObRow = { amount: number; payment_method: string; expense_date: string; due_date: string; settled_at: string | null }
  const obligations: ObRow[] = (obligationRows ?? []) as ObRow[]

  const result = []

  for (const d of targetDates) {
    const monthStart = startOfMonth(d)
    const monthEnd   = endOfMonth(d)
    const start = format(monthStart, 'yyyy-MM-dd')
    const end   = format(monthEnd,   'yyyy-MM-dd')
    const label = format(d, 'MMM yyyy')

    // ── Revenue from job_logs × price_per_mow ──────────────────────────────────
    // Attribute each mow by the DAY it was checked off (completed_at). Whatever
    // day the lawn was marked done is the month its revenue counts toward. Older
    // rows that predate the completed_at column fall back to week_start.
    const { data: jobData } = await supabase
      .from('job_logs')
      .select('properties(price_per_mow)')
      .eq('status', 'done')
      .or(`and(completed_at.gte.${start}T00:00:00,completed_at.lte.${end}T23:59:59),and(completed_at.is.null,week_start.gte.${start},week_start.lte.${end})`)

    const mowRevenue = (jobData ?? []).reduce((sum, j) => {
      const prop = j.properties as { price_per_mow: number } | null
      return sum + (prop?.price_per_mow ?? 0)
    }, 0)

    // ── One-off jobs ────────────────────────────────────────────────────────────
    const { data: oneOffData } = await supabase
      .from('one_off_jobs')
      .select('amount')
      .eq('status', 'done')
      .gte('completed_date', start)
      .lte('completed_date', end)

    const oneOffRevenue = (oneOffData ?? []).reduce((sum, j) => sum + (j.amount ?? 0), 0)
    const revenue = mowRevenue + oneOffRevenue

    // ── Expenses ────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: expData } = await (supabase as any)
      .from('expenses')
      .select('amount, payment_method')
      .gte('expense_date', start)
      .lte('expense_date', end)

    type ExpRow = { amount: number | null; payment_method: string | null }
    const expRows: ExpRow[] = (expData ?? []) as ExpRow[]

    // Display total — every dollar spent this month, regardless of type
    const expenses = expRows.reduce((sum, e) => sum + (e.amount ?? 0), 0)

    // ── Operating expenses for profit calculation ────────────────────────────────
    // Rule 1: Old/regular expenses (no payment_method tag) → count in full by purchase date
    // Rule 2: Capital expenses                             → never reduce profit (tax-only)
    // Rule 3: CC/Loan expenses                            → spread evenly from purchase month
    //          through due_date month (or settled_at month if paid early)

    // Rule 1: null payment_method rows from this month
    const regularExpenses = expRows
      .filter(e => !e.payment_method)
      .reduce((sum, e) => sum + (e.amount ?? 0), 0)

    // Rule 3: prorated share of every CC/loan obligation that covers this month
    let proratedObligations = 0
    for (const ob of obligations) {
      const obStart = startOfMonth(parseISO(ob.expense_date))
      // Spread through settled_at month if paid early, otherwise through due_date month
      const obEnd = ob.settled_at
        ? startOfMonth(parseISO(ob.settled_at))
        : startOfMonth(parseISO(ob.due_date))

      const totalMonths = Math.max(1, monthDiff(obStart, obEnd) + 1)
      const monthlyShare = ob.amount / totalMonths

      if (monthStart >= obStart && monthStart <= obEnd) {
        proratedObligations += monthlyShare
      }
    }

    const operatingExpenses = regularExpenses + proratedObligations

    // ── Payroll: clock-in/out logs ──────────────────────────────────────────────
    const { data: timeData } = await supabase
      .from('time_logs')
      .select('duration_minutes, profiles(hourly_rate)')
      .gte('clock_in', `${start}T00:00:00`)
      .lte('clock_in', `${end}T23:59:59`)
      .not('clock_out', 'is', null)

    const clockPayroll = (timeData ?? []).reduce((sum, t) => {
      const profile = t.profiles as { hourly_rate: number | null } | null
      const rate = profile?.hourly_rate ?? 0
      const hours = (t.duration_minutes ?? 0) / 60
      return sum + hours * rate
    }, 0)

    // ── Payroll: manual monthly hours ───────────────────────────────────────────
    const monthKey = format(d, 'yyyy-MM')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: manualData } = await (supabase as any)
      .from('employee_monthly_hours')
      .select('hours, profiles(hourly_rate)')
      .eq('month', monthKey)

    const manualPayroll = ((manualData ?? []) as Array<{ hours: number | null; profiles: { hourly_rate: number | null } | null }>).reduce((sum, m) => {
      const profile = m.profiles
      const rate = profile?.hourly_rate ?? 0
      return sum + (m.hours ?? 0) * rate
    }, 0)

    // ── Payroll: bonuses ────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bonusData } = await (supabase as any)
      .from('employee_bonuses')
      .select('amount')
      .eq('type', 'bonus')
      .gte('entry_date', start)
      .lte('entry_date', end)

    const bonusPayroll = ((bonusData ?? []) as Array<{ amount: number | null }>)
      .reduce((sum, b) => sum + (b.amount ?? 0), 0)

    const payroll = clockPayroll + manualPayroll + bonusPayroll

    // Capital expenses purchased this month (tax-tracked, never hit operating profit)
    const capitalExpenses = expRows
      .filter(e => e.payment_method === 'capital')
      .reduce((sum, e) => sum + (e.amount ?? 0), 0)

    // raw_expenses = everything by purchase date (for display cards + tax view)
    const rawExpenses = expRows.reduce((sum, e) => sum + (e.amount ?? 0), 0)

    result.push({
      month:            label,
      revenue:          Math.round(revenue * 100) / 100,
      mow_revenue:      Math.round(mowRevenue * 100) / 100,
      one_off_revenue:  Math.round(oneOffRevenue * 100) / 100,
      raw_expenses:     Math.round(rawExpenses * 100) / 100,        // all expenses by purchase date
      expenses:         Math.round(operatingExpenses * 100) / 100,  // prorated CC/loan + regular (for profit)
      capital_expenses: Math.round(capitalExpenses * 100) / 100,
      payroll:          Math.round(payroll * 100) / 100,
      profit:           Math.round((revenue - operatingExpenses - payroll) * 100) / 100,
      tax_profit:       Math.round((revenue - rawExpenses - payroll) * 100) / 100, // simple cash basis
    })
  }

  return NextResponse.json(result)
}
