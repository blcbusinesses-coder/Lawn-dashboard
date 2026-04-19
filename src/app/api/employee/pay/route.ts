import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employeeId = user.id

  // ── Profile (hourly rate) ──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, hourly_rate')
    .eq('id', employeeId)
    .single()

  const hourlyRate = (profile?.hourly_rate ?? 0) as number

  // ── Build last 12 months ───────────────────────────────────────────────────
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, i)
    return {
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM yyyy'),
      start: format(startOfMonth(d), 'yyyy-MM-dd'),
      end: format(endOfMonth(d), 'yyyy-MM-dd'),
    }
  })

  // ── Clock-in/out time logs ─────────────────────────────────────────────────
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select('clock_in, duration_minutes')
    .eq('employee_id', employeeId)
    .not('clock_out', 'is', null)

  // ── Manual monthly hours ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: manualHours } = await (supabase as any)
    .from('employee_monthly_hours')
    .select('month, hours, amount_paid')
    .eq('employee_id', employeeId)

  // ── Bonuses (type='bonus' = owed, type='payment' = already paid) ──────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bonuses } = await (supabase as any)
    .from('employee_bonuses')
    .select('entry_date, amount, type, description')
    .eq('employee_id', employeeId)
    .order('entry_date', { ascending: false })

  const tl = (timeLogs ?? []) as Array<{ clock_in: string; duration_minutes: number | null }>
  const mh = (manualHours ?? []) as Array<{ month: string; hours: number; amount_paid: number }>
  const bn = (bonuses ?? []) as Array<{ entry_date: string; amount: number; type: string; description: string | null }>

  // ── Per-month breakdown ────────────────────────────────────────────────────
  const history = months.map(({ key, label, start, end }) => {
    // Clock hours for this month
    const clockMins = tl
      .filter((t) => t.clock_in >= `${start}T00:00:00` && t.clock_in <= `${end}T23:59:59`)
      .reduce((s, t) => s + (t.duration_minutes ?? 0), 0)
    const clockHours = clockMins / 60

    // Manual hours entry
    const manual = mh.find((m) => m.month === key)
    const manualHrs = manual?.hours ?? 0
    const amountPaid = manual?.amount_paid ?? 0

    const totalHours = clockHours + manualHrs
    const hoursPay = totalHours * hourlyRate

    // Bonuses/payments for this month
    const monthBonuses = bn.filter((b) => b.entry_date >= start && b.entry_date <= end)
    const bonusOwed = monthBonuses.filter((b) => b.type === 'bonus').reduce((s, b) => s + b.amount, 0)
    const bonusPayments = monthBonuses.filter((b) => b.type === 'payment').reduce((s, b) => s + b.amount, 0)

    const totalEarned = hoursPay + bonusOwed
    const totalPaid = amountPaid + bonusPayments
    const stillOwed = Math.max(0, totalEarned - totalPaid)

    return { month: key, label, clockHours, manualHours: manualHrs, totalHours, hoursPay, bonusOwed, bonusPayments, totalEarned, totalPaid, stillOwed }
  })

  // ── Lifetime totals ────────────────────────────────────────────────────────
  // All clock time (not just last 12 months)
  const allClockMins = tl.reduce((s, t) => s + (t.duration_minutes ?? 0), 0)
  const allClockPay = (allClockMins / 60) * hourlyRate

  const allManualPay = mh.reduce((s, m) => s + (m.hours ?? 0) * hourlyRate, 0)
  const allBonusOwed = bn.filter((b) => b.type === 'bonus').reduce((s, b) => s + b.amount, 0)
  const allBonusPayments = bn.filter((b) => b.type === 'payment').reduce((s, b) => s + b.amount, 0)
  const allManualPaid = mh.reduce((s, m) => s + (m.amount_paid ?? 0), 0)

  const lifetimeEarned = allClockPay + allManualPay + allBonusOwed
  const lifetimePaid = allManualPaid + allBonusPayments
  const lifetimeOwed = Math.max(0, lifetimeEarned - lifetimePaid)

  // ── Recent bonuses for display ─────────────────────────────────────────────
  const recentBonuses = bn.slice(0, 10)

  return NextResponse.json({
    name: profile?.full_name ?? '',
    hourly_rate: hourlyRate,
    history,
    totals: {
      lifetime_earned: Math.round(lifetimeEarned * 100) / 100,
      lifetime_paid: Math.round(lifetimePaid * 100) / 100,
      lifetime_owed: Math.round(lifetimeOwed * 100) / 100,
    },
    recent_bonuses: recentBonuses,
  })
}
