/**
 * POST /api/schedule/track-scan
 * Public, best-effort. Logs a QR-code scan when someone lands on /schedule from
 * a letter. Body: { rid?: string }. Never throws — analytics tracking must not
 * break the page, and it no-ops gracefully if the table isn't migrated yet.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const { rid } = (await request.json().catch(() => ({}))) as { rid?: string }
    const recipientId = typeof rid === 'string' && UUID_RE.test(rid) ? rid : null

    const admin = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('letter_qr_scans') as any).insert({ recipient_id: recipientId })
  } catch {
    // swallow — tracking is best-effort
  }
  return NextResponse.json({ ok: true })
}
