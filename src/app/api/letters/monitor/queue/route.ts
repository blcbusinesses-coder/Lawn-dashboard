import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendLetterToLob, type SendableRecipient } from '@/lib/letters/monitor'
import type { LetterType } from '@/lib/letters/templates'

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
  const { action, ids, phone } = body as { action: 'approve' | 'skip'; ids: string[]; phone?: string }

  if (!ids?.length) return NextResponse.json({ error: 'ids are required' }, { status: 400 })
  if (action !== 'approve' && action !== 'skip') {
    return NextResponse.json({ error: 'action must be approve or skip' }, { status: 400 })
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
    const letterType: LetterType =
      row.source === 'new_homeowner' ? 'new_homeowner' : row.source === 'violation' ? 'violation' : 'general'
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
