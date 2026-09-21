/**
 * Pushover notifications.
 *
 * Pushover (https://pushover.net) delivers a single push to ALL of a user's
 * registered devices at once — phone(s) AND the desktop app — so one call
 * reaches every screen the owner is looking at. That's exactly what we want for
 * "ping me the instant a lead comes in".
 *
 * Secrets live in env vars:
 *   PUSHOVER_APP_TOKEN  — the application/API token (one per app)
 *   PUSHOVER_USER_KEY   — the owner's user (or group) key
 *
 * The master on/off flag + which events fire live in automation_settings so the
 * owner can toggle them from the dashboard without a redeploy.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { sourceMeta } from '@/lib/leads/source'

const PUSHOVER_ENDPOINT = 'https://api.pushover.net/1/messages.json'

export function pushoverConfigured(): boolean {
  return Boolean(process.env.PUSHOVER_APP_TOKEN && process.env.PUSHOVER_USER_KEY)
}

export interface PushoverMessage {
  title: string
  message: string
  /** Optional deep link shown as a tappable button in the notification. */
  url?: string
  urlTitle?: string
  /** -2..2 — 1 = high priority (bypasses quiet hours). Default 0. */
  priority?: -2 | -1 | 0 | 1 | 2
  /** Pushover sound name, e.g. "cashregister", "magic". */
  sound?: string
}

export interface PushoverResult {
  ok: boolean
  status?: number
  error?: string
}

/** Low-level send. Never throws — returns a result object instead. */
export async function sendPushover(msg: PushoverMessage): Promise<PushoverResult> {
  const token = process.env.PUSHOVER_APP_TOKEN
  const user = process.env.PUSHOVER_USER_KEY
  if (!token || !user) {
    return { ok: false, error: 'Pushover not configured (missing PUSHOVER_APP_TOKEN or PUSHOVER_USER_KEY)' }
  }

  const form = new URLSearchParams()
  form.set('token', token)
  form.set('user', user)
  form.set('title', msg.title)
  form.set('message', msg.message)
  if (msg.url) form.set('url', msg.url)
  if (msg.urlTitle) form.set('url_title', msg.urlTitle)
  if (typeof msg.priority === 'number') form.set('priority', String(msg.priority))
  if (msg.sound) form.set('sound', msg.sound)

  try {
    const res = await fetch(PUSHOVER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const body = await res.json()
        if (body?.errors?.length) detail = body.errors.join(', ')
      } catch { /* ignore */ }
      return { ok: false, status: res.status, error: detail }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export interface NewLeadNotice {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  source?: string | null
  quoted_amount?: number | null
}

/**
 * Fire a "new lead" push. Reads the enable flags from automation_settings and
 * silently no-ops when disabled or unconfigured. Safe to call fire-and-forget
 * from any lead-creation path — it never throws.
 */
export async function notifyNewLead(lead: NewLeadNotice): Promise<PushoverResult> {
  try {
    if (!pushoverConfigured()) {
      return { ok: false, error: 'not configured' }
    }

    // Check the toggles (service client bypasses RLS, no cookies needed).
    const svc = createServiceClient()
    const { data: rows } = await svc
      .from('automation_settings')
      .select('key, value')
      .in('key', ['pushover_enabled', 'notify_new_lead'])

    const settings: Record<string, unknown> = {}
    for (const row of rows ?? []) settings[row.key] = row.value
    const truthy = (v: unknown) => v === true || v === 'true'
    const enabled = settings.pushover_enabled === undefined || truthy(settings.pushover_enabled)
    const notifyNew = settings.notify_new_lead === undefined || truthy(settings.notify_new_lead)
    if (!enabled || !notifyNew) return { ok: false, error: 'disabled' }

    const meta = sourceMeta(lead.source)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

    const lines = [
      lead.phone ? `📞 ${lead.phone}` : null,
      lead.address ? `📍 ${lead.address}` : null,
      typeof lead.quoted_amount === 'number' && lead.quoted_amount > 0 ? `💵 $${lead.quoted_amount}/mow` : null,
    ].filter(Boolean)

    return await sendPushover({
      title: `${meta.emoji} New ${meta.label} lead: ${lead.name}`,
      message: lines.length ? lines.join('\n') : 'Tap to open the dashboard and reply.',
      url: appUrl ? `${appUrl.replace(/\/$/, '')}/dashboard/leads` : undefined,
      urlTitle: 'Open Leads',
      priority: 1,
      sound: 'cashregister',
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'notifyNewLead failed' }
  }
}
