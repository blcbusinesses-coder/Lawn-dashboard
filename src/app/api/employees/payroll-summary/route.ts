import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createAdminClient()

  // All employees with hourly rate
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, hourly_rate')
    .eq('role', 'employee')

  // All completed clock logs
  const { data: timeLogs } = await supabase
    .from('time_logs')
    .select('employee_id, duration_minutes, profiles(hourly_rate)')
    .not('clock_out', 'is', null)

  // All manual hours entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: manualHours } = await (supabase as any)
    .from('employee_monthly_hours')
    .select('employee_id, hours, amount_paid, profiles(hourly_rate)')

  // All bonus/payment entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bonuses } = await (supabase as any)
    .from('employee_bonuses')
    .select('employee_id, amount, type, profiles(full_name)')

  type TL = { employee_id: string; duration_minutes: number | null; profiles: { hourly_rate: number | null } | null }
  type MH = { employee_id: string; hours: number | null; amount_paid: number | null; profiles: { hourly_rate: number | null } | null }
  type BN = { employee_id: string; amount: number | null; type: string; profiles: { full_name: string } | null }

  const tl = (timeLogs ?? []) as TL[]
  const mh = (manualHours ?? []) as MH[]
  const bn = (bonuses ?? []) as BN[]

  // Build per-employee summaries
  const empMap: Record<string, { name: string; earned: number; paid: number }> = {}

  for (const p of (profiles ?? [])) {
    empMap[p.id] = { name: p.full_name, earned: 0, paid: 0 }
  }

  // Clock pay earned
  for (const t of tl) {
    if (!empMap[t.employee_id]) continue
    const rate = (t.profiles?.hourly_rate ?? 0)
    const hours = (t.duration_minutes ?? 0) / 60
    empMap[t.employee_id].earned += hours * rate
  }

  // Manual hours earned + amount_paid recorded there
  for (const m of mh) {
    if (!empMap[m.employee_id]) continue
    const rate = (m.profiles?.hourly_rate ?? 0)
    const hours = m.hours ?? 0
    empMap[m.employee_id].earned += hours * rate
    empMap[m.employee_id].paid   += m.amount_paid ?? 0
  }

  // Bonuses (owed) and payments (paid)
  for (const b of bn) {
    if (!empMap[b.employee_id]) continue
    if (b.type === 'bonus')   empMap[b.employee_id].earned += b.amount ?? 0
    if (b.type === 'payment') empMap[b.employee_id].paid   += b.amount ?? 0
  }

  // Build per-employee rows and totals
  const employees = Object.entries(empMap).map(([id, e]) => ({
    id,
    name: e.name,
    earned: Math.round(e.earned * 100) / 100,
    paid:   Math.round(e.paid   * 100) / 100,
    owed:   Math.round(Math.max(0, e.earned - e.paid) * 100) / 100,
  }))

  const totalEarned = employees.reduce((s, e) => s + e.earned, 0)
  const totalPaid   = employees.reduce((s, e) => s + e.paid,   0)
  const totalOwed   = employees.reduce((s, e) => s + e.owed,   0)

  return NextResponse.json({
    employees,
    total_earned: Math.round(totalEarned * 100) / 100,
    total_paid:   Math.round(totalPaid   * 100) / 100,
    total_owed:   Math.round(totalOwed   * 100) / 100,
  })
}
