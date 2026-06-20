/**
 * POST /api/letters/campaigns/[id]/recipients
 * Adds selected Area Blast candidates to a campaign as 'review' rows (saved,
 * NOT mailed). AI copy is generated later at send time. Dedupes against the
 * unique (source, dedup_key) index so the same home can't be queued twice.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { normalizeAddress } from '@/lib/letters/monitor'
import { NextRequest, NextResponse } from 'next/server'

interface InRec {
  name?: string; address?: string; city?: string; state?: string; zip?: string
  quote?: number | null; lot_sqft?: number | null; living_sqft?: number | null
  segment?: string; lead_score?: number; mail_priority?: string; income_band?: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { recipients } = (await request.json()) as { recipients?: InRec[] }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients are required' }, { status: 400 })
  }

  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign } = await (admin.from('letter_campaigns') as any).select('id').eq('id', id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  let added = 0
  let skipped = 0
  for (const r of recipients) {
    if (!r.address?.trim() || !r.zip?.trim()) { skipped++; continue }
    const features = [
      r.lot_sqft ? `${Math.round(r.lot_sqft).toLocaleString()} sq ft lot` : '',
      r.living_sqft ? `${Math.round(r.living_sqft).toLocaleString()} sq ft home` : '',
    ].filter(Boolean).join(', ') || 'typical residential lot'
    const cohort = [
      r.segment ? `segment=${r.segment}` : '',
      r.lead_score != null ? `score=${r.lead_score}` : '',
      r.mail_priority ? `wave=${r.mail_priority}` : '',
      r.income_band && r.income_band !== 'unknown' ? `income=${r.income_band}` : '',
    ].filter(Boolean).join(' ')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from('letter_recipients') as any).insert({
      campaign_id: id,
      name: r.name || 'Neighbor',
      address: r.address.trim(),
      city: r.city ?? null,
      state: r.state || 'IN',
      zip: r.zip.trim(),
      source: 'area_blast',
      dedup_key: normalizeAddress(r.address, r.zip),
      status: 'review',
      lot_size: r.lot_sqft ? `${Math.round(r.lot_sqft).toLocaleString()} sq ft` : null,
      sq_footage: r.living_sqft ? `${Math.round(r.living_sqft).toLocaleString()} sq ft` : null,
      property_features: cohort ? `${features} | ${cohort}` : features,
      quote_amount: r.quote ?? null,
    })
    if (error) skipped++       // duplicate or insert error → skip, don't fail the batch
    else added++
  }

  return NextResponse.json({ added, skipped })
}
