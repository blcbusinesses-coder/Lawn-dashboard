/**
 * GET /api/schedule/lookup?q=...
 * Public. Lets a homeowner find the property we already quoted for them (from
 * the letter we mailed) by typing part of their name or address. Returns only
 * what's already on their letter (name, address, quote) — no phone/email — and
 * requires a few characters so it can't be casually enumerated.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export interface ScheduleMatch {
  recipient_id: string
  name: string
  address: string
  city: string | null
  state: string | null
  zip: string | null
  quote: number | null
}

export async function GET(request: NextRequest) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim()
  if (q.length < 3) return NextResponse.json({ matches: [] })

  // Sanitize for the PostgREST .or() filter (strip chars that break it).
  const safe = q.replace(/[,()*%]/g, ' ').replace(/\s+/g, ' ').trim()
  if (safe.length < 3) return NextResponse.json({ matches: [] })

  const admin = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('letter_recipients') as any)
    .select('id, name, address, city, state, zip, quote_amount')
    .or(`name.ilike.%${safe}%,address.ilike.%${safe}%`)
    .not('quote_amount', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) return NextResponse.json({ matches: [] })

  // Dedupe by normalized address (the same home can be in multiple campaigns).
  const seen = new Set<string>()
  const matches: ScheduleMatch[] = []
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const key = `${String(r.address ?? '').toLowerCase()}|${String(r.zip ?? '')}`
    if (seen.has(key)) continue
    seen.add(key)
    matches.push({
      recipient_id: r.id as string,
      name: (r.name as string) || 'Neighbor',
      address: (r.address as string) || '',
      city: (r.city as string) ?? null,
      state: (r.state as string) ?? null,
      zip: (r.zip as string) ?? null,
      quote: (r.quote_amount as number) ?? null,
    })
  }

  return NextResponse.json({ matches })
}
