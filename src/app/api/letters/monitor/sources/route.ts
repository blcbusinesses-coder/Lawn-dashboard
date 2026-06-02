import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/letters/monitor/sources — list sources + their most recent run.
export async function GET() {
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sources, error } = await (admin.from('letter_monitor_sources') as any)
    .select('*')
    .order('key', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runs } = await (admin.from('letter_monitor_runs') as any)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ sources: sources ?? [], runs: runs ?? [] })
}

// PATCH /api/letters/monitor/sources — update a source's enabled flag or config.
// Body: { key: string, enabled?: boolean, config?: object }
export async function PATCH(request: NextRequest) {
  const admin = createServiceClient()
  const body = await request.json()
  const { key, enabled, config } = body as { key: string; enabled?: boolean; config?: Record<string, unknown> }
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (typeof enabled === 'boolean') update.enabled = enabled
  if (config && typeof config === 'object') update.config = config
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('letter_monitor_sources') as any)
    .update(update)
    .eq('key', key)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
