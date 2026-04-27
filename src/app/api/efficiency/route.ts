import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const [metricsRes, settingsRes] = await Promise.all([
    supabase
      .from('efficiency_metrics')
      .select('*, employee:employee_id ( id, full_name ), equipment:equipment_id ( id, name )')
      .order('created_at'),
    supabase.from('efficiency_settings').select('*').order('key'),
  ])

  if (metricsRes.error) return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })
  if (settingsRes.error) return NextResponse.json({ error: settingsRes.error.message }, { status: 500 })

  return NextResponse.json({ metrics: metricsRes.data, settings: settingsRes.data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  if (body.type === 'setting') {
    const { key, value } = body
    const { error } = await supabase
      .from('efficiency_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  // metric
  const { data, error } = await supabase
    .from('efficiency_metrics')
    .insert(body)
    .select('*, employee:employee_id ( id, full_name ), equipment:equipment_id ( id, name )')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
