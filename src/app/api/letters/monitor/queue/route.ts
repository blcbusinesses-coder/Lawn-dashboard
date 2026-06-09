import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendLetterToLob, type SendableRecipient } from '@/lib/letters/monitor'
import { generateLetterContent } from '@/lib/letters/generate'
import { lookupOwnerName } from '@/lib/property/owner'
import type { LetterType } from '@/lib/letters/templates'

export const maxDuration = 60

function letterTypeFor(source: unknown): LetterType {
  return source === 'new_homeowner' ? 'new_homeowner' : source === 'violation' ? 'violation' : 'general'
}

// Generic placeholders that should be upgraded to a real owner name if we can
// find one when generating the letter copy.
const PLACEHOLDER_NAMES = new Set(['new neighbor', 'current resident', 'homeowner', 'neighbor'])

// GET /api/letters/monitor/queue — list recipients awaiting review.
export async function GET() {
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('letter_recipients') as any)
    .select('*')
    .eq('status', 'review')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/letters/monitor/queue — approve (send) or skip review items.
// Body: { action: 'approve' | 'skip', ids: string[], phone?: string }
export async function POST(request: NextRequest) {
  const admin = createServiceClient()
  const body = await request.json()
  const { action, ids, phone } = body as { action: 'approve' | 'skip' | 'generate'; ids: string[]; phone?: string }

  if (!ids?.length) return NextResponse.json({ error: 'ids are required' }, { status: 400 })
  if (action !== 'approve' && action !== 'skip' && action !== 'generate') {
    return NextResponse.json({ error: 'action must be approve, skip, or generate' }, { status: 400 })
  }

  // generate → fill in quote + AI copy for address-only rows. Client should send
  // a small batch (ideally one id) per call so each request stays under the
  // serverless time limit (each row does a Zillow lookup + Haiku call).
  if (action === 'generate') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (admin.from('letter_recipients') as any)
      .select('*')
      .in('id', ids)
      .eq('status', 'review')

    const results: Array<{ id: string; success: boolean; error?: string }> = []
    for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
      const id = row.id as string
      try {
        const fullAddress = `${row.address ?? ''}, ${row.city ?? ''}, ${row.state ?? ''} ${row.zip ?? ''}`

        // Upgrade a generic placeholder to the real owner-of-record name.
        let name = (row.name as string) || undefined
        if (!name || PLACEHOLDER_NAMES.has(name.trim().toLowerCase())) {
          const owner = await lookupOwnerName(fullAddress)
          if (owner) name = owner
        }

        const content = await generateLetterContent({
          address: fullAddress,
          name,
          letterType: letterTypeFor(row.source),
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('letter_recipients') as any)
          .update({
            name: name ?? row.name,
            lot_size: content.lot_size,
            sq_footage: content.sq_footage,
            property_features: content.features,
            ai_copy: content.ai_copy,
            quote_amount: content.quote_amount,
          })
          .eq('id', id)
        results.push({ id, success: true })
      } catch (err) {
        results.push({ id, success: false, error: err instanceof Error ? err.message : String(err) })
      }
    }
    return NextResponse.json({ results, generated: results.filter(r => r.success).length })
  }

  if (action === 'skip') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from('letter_recipients') as any)
      .update({ status: 'skipped' })
      .in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ skipped: ids.length })
  }

  // approve → send each via Lob
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (admin.from('letter_recipients') as any)
    .select('*')
    .in('id', ids)
    .eq('status', 'review')

  const campaignPhone = phone ?? '(260) 000-0000'
  const results: Array<{ id: string; success: boolean; lob_id?: string; error?: string }> = []

  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    const id = row.id as string
    const letterType = letterTypeFor(row.source)
    // Never mail a row that hasn't had its quote + copy generated yet.
    if (!row.ai_copy || row.quote_amount == null) {
      results.push({ id, success: false, error: 'Not generated yet — generate the letter copy first' })
      continue
    }
    try {
      const lobId = await sendLetterToLob(row as unknown as SendableRecipient, {
        phone: campaignPhone,
        letterType,
        description: `Monitor — ${String(row.address ?? '')}`,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('letter_recipients') as any)
        .update({ status: 'sent', lob_letter_id: lobId })
        .eq('id', id)
      results.push({ id, success: true, lob_id: lobId ?? undefined })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('letter_recipients') as any)
        .update({ status: 'failed', error_message: msg.slice(0, 500) })
        .eq('id', id)
      results.push({ id, success: false, error: msg })
    }
  }

  const sent = results.filter(r => r.success).length
  return NextResponse.json({ results, sent, failed: results.length - sent })
}
