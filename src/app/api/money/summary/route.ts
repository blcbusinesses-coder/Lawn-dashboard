import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, subMonths, startOfMonth, endOfMonth, eachWeekOfInterval, nextSunday } from 'date-fns'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const months = parseInt(searchParams.get('months') ?? '12')

  const result = []

  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i)
    const monthStart = startOfMonth(d)
    const monthEnd   = endOfMonth(d)
    const start = format(monthStart, 'yyyy-MM-dd')
    const end   = format(monthEnd,   'yyyy-MM-dd')
    const label = format(d, 'MMM yyyy')

    // ── Revenue from job_logs × price_per_mow ─────────────────────────────────
    // Get all week_starts that fall within this month
    const weeksInMonth = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 } // Monday
    ).map((w) => format(w, 'yyyy-MM-dd'))

    const { data: jobData } = await supabase
      .from('job_logs')
      .select('properties(price_per_mow)')
      .eq('status', 'done')
      .in('week_start', weeksInMonth)

    const mowRevenue = (jobData ?? []).reduce((sum, j) => {
      const prop = j.properties as { price_per_mow: number } | null
      return sum + (prop?.price_per_mow ?? 0)
    }, 0)

    // ── One-off jobs completed this month ──────────────────────────────────────
    const { data: oneOffData } = await supabase
      .from('one_off_jobs')
      .select('amount')
      .eq('status', 'done')
      .gte('completed_date', start)
      .lte('completed_date', end)

    const oneOffRevenue = (oneOffData ?? []).reduce((sum, j) => sum + (j.amount ?? 0), 0)

    const revenue = mowRevenue + oneOffRevenue

    // ── Expenses ───────────────────────────────────────────────────────────────
    const { data: expData } = await supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', start)
      .lte('expense_date', end)

    const expenses = (expData ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0)

    // ── Payroll ────────────────────────────────────────────────────────────────
    const { data: timeData } = await supabase
      .from('time_logs')
      .select('duration_minutes, profiles(hourly_rate)')
      .gte('clock_in', `${start}T00:00:00`)
      .lte('clock_in', `${end}T23:59:59`)
      .not('clock_out', 'is', null)

    const payroll = (timeData ?? []).reduce((sum, t) => {
      const profile = t.profiles as { hourly_rate: number | null } | null
      const rate = profile?.hourly_rate ?? 0
      const hours = (t.duration_minutes ?? 0) / 60
      return sum + hours * rate
    }, 0)

    result.push({
      month:           label,
      revenue:         Math.round(revenue * 100) / 100,
      mow_revenue:     Math.round(mowRevenue * 100) / 100,
      one_off_revenue: Math.round(oneOffRevenue * 100) / 100,
      expenses:        Math.round(expenses * 100) / 100,
      payroll:         Math.round(payroll * 100) / 100,
      profit:          Math.round((revenue - expenses - payroll) * 100) / 100,
    })
  }

  return NextResponse.json(result)
}
