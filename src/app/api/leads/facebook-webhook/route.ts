import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN ?? ''
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? ''

// ── GET — Facebook webhook verification ───────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// ── POST — Receive lead notification ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = body as {
    object?: string
    entry?: Array<{
      changes?: Array<{
        field?: string
        value?: { leadgen_id?: string }
      }>
    }>
  }

  if (payload.object !== 'page') {
    return NextResponse.json({ status: 'ignored' })
  }

  const adminClient = await createAdminClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue
      const leadgenId = change.value?.leadgen_id
      if (!leadgenId) continue

      // Fetch lead details from Facebook Graph API
      let leadData: {
        id: string
        field_data: Array<{ name: string; values: string[] }>
      }
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`,
          { signal: AbortSignal.timeout(10000) }
        )
        if (!res.ok) continue
        leadData = await res.json()
      } catch {
        continue
      }

      // Parse fields — Facebook form field names vary, handle common variants
      const fields: Record<string, string> = {}
      for (const f of leadData.field_data ?? []) {
        fields[f.name.toLowerCase()] = f.values?.[0] ?? ''
      }

      const name    = fields['full_name'] || `${fields['first_name'] ?? ''} ${fields['last_name'] ?? ''}`.trim()
      const phone   = fields['phone_number'] || fields['phone'] || ''
      const address = fields['street_address'] || fields['address'] || fields['city'] || ''

      if (!name || !phone || !address) continue

      // Upsert lead (skip duplicates from Facebook retries)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lead, error } = await (adminClient.from('leads') as any)
        .upsert(
          {
            name,
            phone,
            address,
            source: 'facebook',
            facebook_lead_id: leadgenId,
            status: 'new',
          },
          { onConflict: 'facebook_lead_id', ignoreDuplicates: true }
        )
        .select()
        .single()

      if (error || !lead) continue

      // Kick off quote pipeline in the background (fire-and-forget)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/${lead.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    }
  }

  // Facebook requires a 200 response quickly
  return NextResponse.json({ status: 'ok' })
}
