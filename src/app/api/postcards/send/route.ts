import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RecipientPayload {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  ai_copy: string
  quote_amount: number
  nearby_count: number
  lot_size?: string
  sq_footage?: string
}

function buildFrontHtml(params: {
  name: string
  aiCopy: string
  quote: string
  streetViewUrl: string
  totalLawns: number
  nearbyCount: number
  phone: string
}): string {
  const { name, aiCopy, quote, streetViewUrl, totalLawns, nearbyCount, phone } = params
  return `<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;width:6in;height:4.25in;overflow:hidden;">
<div style="background:#1a4a2e;color:white;padding:8px 16px;display:flex;align-items:center;gap:8px;">
  <span>&#9988;</span>
  <span style="font-weight:bold;font-size:13px;">GRAY WOLF WORKERS &mdash; Lawn Care, Kendallville IN</span>
</div>
<div style="display:flex;height:calc(100% - 80px);">
  <div style="width:55%;padding:20px;display:flex;flex-direction:column;justify-content:center;">
    <h1 style="font-size:28px;margin:0 0 12px;color:#1a4a2e;">Hey, ${escapeHtml(name)}.</h1>
    <p style="font-size:13px;line-height:1.5;color:#333;margin:0 0 16px;">${escapeHtml(aiCopy)}</p>
    <div style="background:#1a4a2e;color:white;padding:8px 16px;border-radius:20px;display:inline-block;font-weight:bold;font-size:16px;">
      Your Quote: ${escapeHtml(quote)}
    </div>
  </div>
  <div style="width:45%;overflow:hidden;">
    <img src="${streetViewUrl}" style="width:100%;height:100%;object-fit:cover;" />
  </div>
</div>
<div style="background:#f5f5f5;padding:8px 16px;display:flex;justify-content:space-around;font-size:11px;color:#555;">
  <span>&#127807; ${totalLawns} lawns this season</span>
  <span>&#128205; ${nearbyCount} lawns near your house</span>
  <span>&#128222; ${escapeHtml(phone)}</span>
</div>
<div style="background:#1a4a2e;color:white;padding:10px 16px;text-align:center;font-size:14px;font-weight:bold;">
  Ready for a clean lawn? Call or text ${escapeHtml(phone)}
</div>
</body></html>`
}

function buildBackHtml(phone: string): string {
  return `<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;width:6in;height:4.25in;background:#fff;">
<div style="padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;">
  <div style="font-size:32px;font-weight:bold;color:#1a4a2e;">&#128058; GRAY WOLF WORKERS</div>
  <div style="color:#555;margin-top:8px;">Professional Lawn Care &mdash; Kendallville, IN</div>
  <div style="margin-top:24px;color:#1a4a2e;font-weight:bold;font-size:18px;">${escapeHtml(phone)}</div>
</div>
</body></html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatQuote(amount: number): string {
  return (
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount) + '/mow'
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { campaign_id, recipients, phone } = body as {
    campaign_id: string
    recipients: RecipientPayload[]
    phone?: string
  }

  if (!campaign_id || !recipients?.length) {
    return NextResponse.json({ error: 'campaign_id and recipients are required' }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const lobKey = process.env.LOB_API_KEY
  const gmapsKey = process.env.GOOGLE_MAPS_API_KEY
  const campaignPhone = phone ?? '(260) 000-0000'

  if (!lobKey) return NextResponse.json({ error: 'LOB_API_KEY not configured' }, { status: 500 })

  // Get total customer count for footer
  const { count: totalLawns } = await adminClient
    .from('customers')
    .select('*', { count: 'exact', head: true })

  const totalLawnsCount = totalLawns ?? 0

  // Get campaign name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign } = await (adminClient.from('postcard_campaigns') as any)
    .select('name')
    .eq('id', campaign_id)
    .single()

  const campaignName = (campaign as Record<string, unknown> | null)?.name ?? 'Campaign'

  const results: Array<{ id: string; success: boolean; lob_id?: string; error?: string }> = []

  for (const recipient of recipients) {
    try {
      const fullAddress = `${recipient.address}, ${recipient.city}, ${recipient.state} ${recipient.zip}`
      const streetViewUrl = gmapsKey
        ? `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodeURIComponent(fullAddress)}&key=${gmapsKey}`
        : `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodeURIComponent(fullAddress)}`

      const frontHtml = buildFrontHtml({
        name: recipient.name || 'Neighbor',
        aiCopy:
          recipient.ai_copy ||
          'We provide professional lawn care in your area. A personalized quote is included on this card.',
        quote: formatQuote(recipient.quote_amount || 35),
        streetViewUrl,
        totalLawns: totalLawnsCount,
        nearbyCount: recipient.nearby_count || 0,
        phone: campaignPhone,
      })

      const backHtml = buildBackHtml(campaignPhone)

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
          address_line1: 'Kendallville',
          address_city: 'Kendallville',
          address_state: 'IN',
          address_zip: '46755',
          address_country: 'US',
        },
        size: '6x9',
        front: frontHtml,
        back: backHtml,
        mail_type: 'usps_standard',
        merge_variables: {},
      }

      const lobRes = await fetch('https://api.lob.com/v1/postcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${lobKey}:`).toString('base64')}`,
        },
        body: JSON.stringify(lobPayload),
      })

      if (!lobRes.ok) {
        const errText = await lobRes.text()
        console.error('[postcards/send] Lob error:', errText)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient.from('postcard_recipients') as any).upsert({
          campaign_id,
          name: recipient.name,
          address: recipient.address,
          city: recipient.city,
          state: recipient.state,
          zip: recipient.zip,
          ai_copy: recipient.ai_copy,
          quote_amount: recipient.quote_amount,
          nearby_count: recipient.nearby_count,
          lot_size: recipient.lot_size,
          sq_footage: recipient.sq_footage,
          status: 'failed',
          error_message: errText.slice(0, 500),
        })

        results.push({ id: recipient.id, success: false, error: errText.slice(0, 200) })
        continue
      }

      const lobData = (await lobRes.json()) as { id?: string }
      const lobPostcardId = lobData.id ?? null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.from('postcard_recipients') as any).upsert({
        campaign_id,
        name: recipient.name,
        address: recipient.address,
        city: recipient.city,
        state: recipient.state,
        zip: recipient.zip,
        ai_copy: recipient.ai_copy,
        quote_amount: recipient.quote_amount,
        nearby_count: recipient.nearby_count,
        lot_size: recipient.lot_size,
        sq_footage: recipient.sq_footage,
        lob_postcard_id: lobPostcardId,
        status: 'sent',
      })

      results.push({ id: recipient.id, success: true, lob_id: lobPostcardId ?? undefined })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ id: recipient.id, success: false, error: msg })
    }
  }

  // Update campaign totals
  const sentCount = results.filter((r) => r.success).length
  const totalCost = sentCount * 0.872

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('postcard_campaigns') as any)
    .update({ pieces_sent: sentCount, total_cost: totalCost })
    .eq('id', campaign_id)

  return NextResponse.json({ results, sent: sentCount, failed: results.length - sentCount })
}
