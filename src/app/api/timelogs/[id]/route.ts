import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { clock_in, clock_out } = body

  // Recalculate duration if both timestamps provided
  let duration_minutes: number | null = null
  if (clock_in && clock_out) {
    const diffMs = new Date(clock_out).getTime() - new Date(clock_in).getTime()
    duration_minutes = Math.round(diffMs / 60000)
  }

  const { data, error } = await supabase
    .from('time_logs')
    .update({ clock_in, clock_out: clock_out || null, duration_minutes })
    .eq('id', id)
    .select('*, profiles(full_name, hourly_rate)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  const { error } = await supabase.from('time_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
