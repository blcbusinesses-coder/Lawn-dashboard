import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get open clock-in (no clock_out)
  const { data } = await supabase
    .from('time_logs')
    .select('*')
    .eq('employee_id', user.id)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ open_entry: data ?? null })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, entry_id } = await request.json()

  if (action === 'clock_in') {
    const { data, error } = await supabase
      .from('time_logs')
      .insert({ employee_id: user.id, clock_in: new Date().toISOString() })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  if (action === 'clock_out' && entry_id) {
    const clockOut = new Date()
    const { data: entry } = await supabase
      .from('time_logs')
      .select('clock_in')
      .eq('id', entry_id)
      .single()

    const durationMinutes = entry
      ? Math.round((clockOut.getTime() - new Date(entry.clock_in).getTime()) / 60000)
      : null

    const { data, error } = await supabase
      .from('time_logs')
      .update({ clock_out: clockOut.toISOString(), duration_minutes: durationMinutes })
      .eq('id', entry_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
