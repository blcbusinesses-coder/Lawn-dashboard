import { createClient } from '@/lib/supabase/server'
import { sendPushover, pushoverConfigured } from '@/lib/pushover/client'
import { NextResponse } from 'next/server'

// POST /api/notifications/test — owner: send a test push to confirm setup.
// Bypasses the enable flags on purpose so the owner can always verify keys.
export async function POST() {
  // Ensure an owner is calling (RLS on any owner-only table would fail otherwise).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  if (!pushoverConfigured()) {
    return NextResponse.json(
      { error: 'Pushover is not configured yet. Add PUSHOVER_APP_TOKEN and PUSHOVER_USER_KEY.' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const result = await sendPushover({
    title: '✅ Gray Wolf Workers — test alert',
    message: 'Pushover is connected. New leads will ping this device (phone + computer) instantly.',
    url: appUrl ? `${appUrl.replace(/\/$/, '')}/dashboard/leads` : undefined,
    urlTitle: 'Open Leads',
    priority: 0,
    sound: 'magic',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Failed to send' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
