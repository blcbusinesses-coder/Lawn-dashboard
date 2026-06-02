import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('week_start')
  // Range form: pull every job_log whose week_start falls in [from, to]. Used by
  // the jobs page so a month-boundary week (split into two week_start values)
  // loads both slices in one request.
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('job_logs')
    .select('*, properties(id, address, price_per_mow, customers(full_name))')

  if (weekStart) {
    query = query.eq('week_start', weekStart)
  } else if (from && to) {
    query = query.gte('week_start', from).lte('week_start', to)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json()

  const { property_id, week_start, status, notes } = body

  const { data, error } = await supabase
    .from('job_logs')
    .upsert(
      {
        property_id,
        week_start,
        status,
        notes: notes ?? null,
        completed_by: status === 'done' ? user?.id : null,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      },
      { onConflict: 'property_id,week_start' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')
  const weekStart = searchParams.get('week_start')

  if (!propertyId || !weekStart) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const { error } = await supabase
    .from('job_logs')
    .delete()
    .eq('property_id', propertyId)
    .eq('week_start', weekStart)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
