import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automation_settings')
    .select('*')
    .order('key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Return as key→value map for convenience
  const map: Record<string, unknown> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return NextResponse.json({ map, rows: data })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { key, value } = await request.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  const { data, error } = await supabase
    .from('automation_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
