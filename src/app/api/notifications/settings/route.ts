import { createClient } from '@/lib/supabase/server'
import { pushoverConfigured } from '@/lib/pushover/client'
import { NextRequest, NextResponse } from 'next/server'

const FLAG_KEYS = ['pushover_enabled', 'notify_new_lead'] as const

// GET /api/notifications/settings — owner: notification status + toggles.
// Never returns secret values, only whether they're configured.
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automation_settings')
    .select('key, value')
    .in('key', FLAG_KEYS as unknown as string[])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const flags: Record<string, boolean> = {}
  for (const row of data ?? []) {
    flags[row.key] = row.value === true || row.value === 'true'
  }

  return NextResponse.json({
    pushover_configured: pushoverConfigured(),
    pushover_enabled: flags.pushover_enabled ?? true,
    notify_new_lead: flags.notify_new_lead ?? true,
  })
}

// PUT /api/notifications/settings — owner: flip a boolean flag.
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { key, value } = await request.json()
  if (!FLAG_KEYS.includes(key)) {
    return NextResponse.json({ error: 'unknown setting' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('automation_settings') as any)
    .upsert({ key, value: Boolean(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, key, value: Boolean(value) })
}
