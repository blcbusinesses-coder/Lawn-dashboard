import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { buildLetterHtml, formatQuote, type LetterType } from '@/lib/letters/templates'

interface RecipientPayload {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  ai_copy: string
  quote_amount: number
  lot_size?: string
  sq_footage?: string
  source?: string
}

// Lob first-class letter, single page, color. Adjust if you change page count.
const PRICE_PER_LETTER = 0.93

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { campaign_id, recipients, phone, letter_type } = body as {
    campaign_id: string
    recipients: RecipientPayload[]
    phone?: string
    letter_type?: LetterType
  }

  if (!campaign_id || !recipients?.length) {
    return NextResponse.json({ error: 'campaign_id and recipients are required' }, { status: 400 })
  }

  const adminClient = createServiceClient()
  const lobKey = process.env.LOB_API_KEY
  const campaignPhone = phone ?? '(260) 000-0000'
  const letterType: LetterType =
    letter_type === 'new_homeowner' || letter_type === 'violation' ? letter_type : 'general'

  if (!lobKey) return NextResponse.json({ error: 'LOB_API_KEY not configured' }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign } = await (adminClient.from('letter_campaigns') as any)
    .select('name')
    .eq('id', campaign_id)
    .single()
  const campaignName = (campaign as Record<string, unknown> | null)?.name ?? 'Campaign'

  const results: Array<{ id: string; success: boolean; lob_id?: string; error?: string; debug?: Record<string, unknown> }> = []

  for (const recipient of recipients) {
    const debug: Record<string, unknown> = {}
    try {
      if (!recipient.zip?.trim()) {
        results.push({ id: recipient.id, success: false, error: 'Missing ZIP code — Lob requires address_zip' })
        continue
      }

      // ── Build inline letter HTML (no external assets) ───────────────────────
      const fileHtml = buildLetterHtml({
        name: recipient.name || 'Neighbor',
        aiCopy: recipient.ai_copy || '',
        quote: formatQuote(recipient.quote_amount || 35),
        phone: campaignPhone,
        letterType,
      })
      debug.htmlChars = fileHtml.length

      const lobPayload = {
        description: `${campaignName} — ${recipient.name}`,
        to: {
          name: recipient.name || 'Homeowner',
          address_line1: recipient.address,
          address_city: recipient.city,
          address_state: recipient.state,
          address_zip: recipient.zip,
          address_country: 'US',
        },
        from: {
          name: 'Gray Wolf Workers',
          address_line1: '703 East Mitchell Street',
          address_city: 'Kendallville',
          address_state: 'IN',
          address_zip: '46755',
          address_country: 'US',
        },
        file: fileHtml,
        color: true,
        double_sided: false,
        address_placement: 'top_first_page',
        mail_type: 'usps_first_class',
        use_type: 'marketing',
      }

      const lobRes = await fetch('https://api.lob.com/v1/letters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${lobKey}:`).toString('base64')}`,
        },
        body: JSON.stringify(lobPayload),
      })

      if (!lobRes.ok) {
        const errText = await lobRes.text()
        console.error('[letters/send] Lob error:', errText)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient.from('letter_recipients') as any).upsert({
          campaign_id, name: recipient.name, address: recipient.address,
          city: recipient.city, state: recipient.state, zip: recipient.zip,
          ai_copy: recipient.ai_copy, quote_amount: recipient.quote_amount,
          lot_size: recipient.lot_size, sq_footage: recipient.sq_footage,
          source: recipient.source ?? 'manual', status: 'failed',
          error_message: errText.slice(0, 500),
        })

        results.push({ id: recipient.id, success: false, error: errText, debug })
        continue
      }

      const lobData = (await lobRes.json()) as { id?: string }
      const lobLetterId = lobData.id ?? null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.from('letter_recipients') as any).upsert({
        campaign_id, name: recipient.name, address: recipient.address,
        city: recipient.city, state: recipient.state, zip: recipient.zip,
        ai_copy: recipient.ai_copy, quote_amount: recipient.quote_amount,
        lot_size: recipient.lot_size, sq_footage: recipient.sq_footage,
        source: recipient.source ?? 'manual', lob_letter_id: lobLetterId,
        status: 'sent',
      })

      results.push({ id: recipient.id, success: true, lob_id: lobLetterId ?? undefined, debug })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ id: recipient.id, success: false, error: msg, debug })
    }
  }

  const sentCount = results.filter((r) => r.success).length
  const totalCost = sentCount * PRICE_PER_LETTER

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('letter_campaigns') as any)
    .update({ pieces_sent: sentCount, total_cost: totalCost })
    .eq('id', campaign_id)

  return NextResponse.json({ results, sent: sentCount, failed: results.length - sentCount })
}
