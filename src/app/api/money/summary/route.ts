import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const months = parseInt(searchParams.get('months') ?? '12')

  const result = []

  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i)
    const start = format(startOfMonth(d), 'yyyy-MM-dd')
    const end = format(endOfMonth(d), 'yyyy-MM-dd')
    const label = format(d, 'MMM yyyy')

    // Revenue: sum of non-void invoices
    const { data: revData } = await supabase
      .from('invoices')
      .select('total_amount')
      .gte('period_start', start)
      .lte('period_end', end)
      .neq('status', 'void')

    const invoiceRevenue = (revData ?? []).reduce((sum, r) => sum + r.total_amount, 0)

    // One-off jobs completed this month (not yet invoiced or standalone)
    // We include them only when NOT already in invoices to avoid double-counting.
    // Since invoice generation pulls them in, we count standalone ones (no customer)
    // or use a simpler approach: show total one-off revenue for the month separately.
    // For chart purposes, we add completed one-off revenue directly to keep it simple.
    const { data: oneOffData } = await supabase
      .from('one_off_jobs')
      .select('amount')
      .eq('status', 'done')
      .gte('completed_date', start)
      .lte('completed_date', end)

    const oneOffRevenue = (oneOffData ?? []).reduce((sum, j) => sum + j.amount, 0)

    // Use invoice revenue if it exists (already includes one-off items),
    // otherwise fall back to direct one-off amounts for uninvoiced jobs.
    const revenue = invoiceRevenue > 0 ? invoiceRevenue : oneOffRevenue

    // Expenses
    const { data: expData } = await supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', start)
      .lte('expense_date', end)

    const expenses = (expData ?? []).reduce((sum, e) => sum + e.amount, 0)

    // Payroll: sum duration_minutes * hourly_rate / 60
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
      month: label,
      revenue: Math.round(revenue * 100) / 100,
      one_off_revenue: Math.round(oneOffRevenue * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      payroll: Math.round(payroll * 100) / 100,
      profit: Math.round((revenue - expenses - payroll) * 100) / 100,
    })
  }

  return NextResponse.json(result)
}
