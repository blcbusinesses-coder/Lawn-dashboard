import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/site-settings — returns all site_settings as a flat key→value map
export async function GET() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const map: Record<string, unknown> = {}
  for (const row of (data ?? []) as { key: string; value: string }[]) map[row.key] = row.value
  return NextResponse.json(map)
}

// PUT /api/site-settings — upsert a single key/value pair
export async function PUT(request: NextRequest) {
  const supabase = await createAdminClient()
  const body = await request.json()
  const entries = Object.entries(body)

  if (!entries.length) return NextResponse.json({ error: 'No fields provided' }, { status: 400 })

  const rows = entries.map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await (supabase as any)
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
