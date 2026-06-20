/**
 * POST /api/letters/campaigns/[id]/send  { phone? }
 * Sends one small batch of a campaign's 'review' recipients: generates the AI
 * letter body, mails via Lob, and flips the row to 'sent'. Returns how many
 * remain so the client can loop until the campaign is fully sent.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { generateAiCopy } from '@/lib/letters/generate'
import { sendLetterToLob } from '@/lib/letters/monitor'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
const BATCH = 4
const PRICE_PER_LETTER = 0.93

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { phone } = (await request.json().catch(() => ({}))) as { phone?: string }

  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign } = await (admin.from('letter_campaigns') as any)
    .select('name, phone, pieces_sent, total_cost').eq('id', id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  const campaignPhone = phone?.trim() || campaign.phone || '(260) 599-4253'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (admin.from('letter_recipients') as any)
    .select('*').eq('campaign_id', id).eq('status', 'review').limit(BATCH)

  const results: Array<{ id: string; success: boolean; error?: string }> = []
  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    const rid = row.id as string
    try {
      if (!String(row.zip ?? '').trim()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('letter_recipients') as any).update({ status: 'failed', error_message: 'Missing ZIP' }).eq('id', rid)
        results.push({ id: rid, success: false, error: 'Missing ZIP' })
        continue
      }
      // Strip the logged cohort ("| segment=…") before feeding features to AI.
      const features = String(row.property_features ?? 'typical residential lot').split('|')[0].trim()
      const name = (row.name as string) || 'Neighbor'
      const aiCopy = (row.ai_copy as string) || await generateAiCopy({
        featuresText: features,
        address: `${row.address ?? ''}, ${row.city ?? ''}, ${row.state ?? ''} ${row.zip ?? ''}`,
        name: name !== 'Neighbor' ? name : undefined,
        letterType: 'general',
      })
      const lobId = await sendLetterToLob(
        { id: rid, name, address: row.address as string, city: row.city as string,
          state: row.state as string, zip: row.zip as string, ai_copy: aiCopy,
          quote_amount: (row.quote_amount as number) ?? null },
        { phone: campaignPhone, letterType: 'general', description: `${campaign.name} — ${row.address}` },
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('letter_recipients') as any)
        .update({ status: 'sent', lob_letter_id: lobId, ai_copy: aiCopy }).eq('id', rid)
      results.push({ id: rid, success: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('letter_recipients') as any).update({ status: 'failed', error_message: msg.slice(0, 500) }).eq('id', rid)
      results.push({ id: rid, success: false, error: msg })
    }
  }

  const sent = results.filter(r => r.success).length
  // Roll up campaign totals.
  if (sent > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('letter_campaigns') as any).update({
      pieces_sent: (Number(campaign.pieces_sent) || 0) + sent,
      total_cost: +(((Number(campaign.total_cost) || 0) + sent * PRICE_PER_LETTER).toFixed(2)),
    }).eq('id', id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: remaining } = await (admin.from('letter_recipients') as any)
    .select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'review')

  return NextResponse.json({ results, sent, failed: results.length - sent, remaining: remaining ?? 0 })
}
