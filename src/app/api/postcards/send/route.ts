import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildFrontHtml,
  buildBackHtml,
  formatQuote,
  SAMPLE_HOUSE_PHOTO,
} from '@/lib/postcards/templates'

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
  street_view_url?: string
}

/**
 * Fetch an image URL and return a base64 data URI.
 * We embed the image directly in the HTML so Lob never needs to make
 * any external image requests (avoids API key referrer restrictions).
 */
async function imageToDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LawnControl/1.0)' },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < 1000) return null // reject tiny placeholder images
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Upload an HTML string to Supabase Storage and return its public URL.
 * Lob accepts a remote URL for front/back — no 10K character limit applies.
 * The HTML contains the image as a base64 data URI so Lob needs zero
 * external image requests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadHtmlForLob(html: string, path: string, adminClient: any): Promise<string | null> {
  try {
    const buf = Buffer.from(html, 'utf-8')
    const { data, error } = await adminClient.storage
      .from('postcard-images')
      .upload(path, buf, { contentType: 'text/html; charset=utf-8', upsert: true })
    if (error) {
      console.error('[send] HTML upload error:', error.message)
      return null
    }
    const { data: urlData } = adminClient.storage
      .from('postcard-images')
      .getPublicUrl(data.path)
    return urlData?.publicUrl ?? null
  } catch (err) {
    console.error('[send] HTML upload exception:', err)
    return null
  }
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

  const { count: totalLawns } = await adminClient
    .from('customers')
    .select('*', { count: 'exact', head: true })
  const totalLawnsCount = totalLawns ?? 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign } = await (adminClient.from('postcard_campaigns') as any)
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

      const fullAddress = `${recipient.address}, ${recipient.city}, ${recipient.state} ${recipient.zip}`

      // ── Fetch the background image server-side ────────────────────────────
      // First try the Supabase URL stored at analyze time, then fall back to
      // fetching Street View directly. Either way we embed as base64 so Lob
      // doesn't need to make any external image requests.
      const imageSourceUrl = recipient.street_view_url
        ?? (gmapsKey
          ? `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${encodeURIComponent(fullAddress)}&key=${gmapsKey}`
          : SAMPLE_HOUSE_PHOTO)

      const bgDataUri = await imageToDataUri(imageSourceUrl)
        ?? await imageToDataUri(SAMPLE_HOUSE_PHOTO)  // fallback lawn photo

      debug.imageSourceUrl = imageSourceUrl.replace(gmapsKey ?? '', '[KEY]')
      debug.imageEmbedded = !!bgDataUri
      debug.imageSizeKb = bgDataUri ? Math.round(bgDataUri.length / 1024) : 0

      // ── Build HTML with base64 image baked in ─────────────────────────────
      const frontHtml = buildFrontHtml({
        name: recipient.name || 'Neighbor',
        aiCopy: recipient.ai_copy || 'We provide professional lawn care in your area. A personalized quote is included on this card.',
        quote: formatQuote(recipient.quote_amount || 35),
        streetViewUrl: bgDataUri,  // data URI — no external request needed
        streetAddress: recipient.address,
        totalLawns: totalLawnsCount,
        nearbyCount: recipient.nearby_count || 0,
        phone: campaignPhone,
      })

      const backHtml = buildBackHtml({
        phone: campaignPhone,
        aiCopy: recipient.ai_copy || 'We provide professional lawn care in your area and would love to take care of yours. Your personalized quote is on the other side.',
        name: recipient.name || 'Neighbor',
      })

      // ── Upload HTML files to Supabase so Lob can fetch via URL ────────────
      // Remote URL = no 10K inline limit, and image is already embedded.
      const ts = Date.now()
      const [frontUrl, backUrl] = await Promise.all([
        uploadHtmlForLob(frontHtml, `html/${campaign_id}/${recipient.id}-${ts}-front.html`, adminClient),
        uploadHtmlForLob(backHtml,  `html/${campaign_id}/${recipient.id}-${ts}-back.html`,  adminClient),
      ])

      debug.frontUrl = frontUrl
      debug.backUrl  = backUrl

      // If Supabase upload fails, fall back to inline HTML (image will be
      // missing but at least the postcard sends)
      const front = frontUrl ?? frontHtml
      const back  = backUrl  ?? backHtml

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
        size: '6x9',
        front,
        back,
        mail_type: 'usps_first_class',
        use_type: 'marketing',
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
          campaign_id, name: recipient.name, address: recipient.address,
          city: recipient.city, state: recipient.state, zip: recipient.zip,
          ai_copy: recipient.ai_copy, quote_amount: recipient.quote_amount,
          nearby_count: recipient.nearby_count, lot_size: recipient.lot_size,
          sq_footage: recipient.sq_footage, status: 'failed',
          error_message: errText.slice(0, 500),
        })

        results.push({ id: recipient.id, success: false, error: errText, debug })
        continue
      }

      const lobData = (await lobRes.json()) as { id?: string }
      const lobPostcardId = lobData.id ?? null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.from('postcard_recipients') as any).upsert({
        campaign_id, name: recipient.name, address: recipient.address,
        city: recipient.city, state: recipient.state, zip: recipient.zip,
        ai_copy: recipient.ai_copy, quote_amount: recipient.quote_amount,
        nearby_count: recipient.nearby_count, lot_size: recipient.lot_size,
        sq_footage: recipient.sq_footage, lob_postcard_id: lobPostcardId,
        status: 'sent',
      })

      results.push({ id: recipient.id, success: true, lob_id: lobPostcardId ?? undefined, debug })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ id: recipient.id, success: false, error: msg, debug })
    }
  }

  const sentCount = results.filter((r) => r.success).length
  const totalCost = sentCount * 0.872

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('postcard_campaigns') as any)
    .update({ pieces_sent: sentCount, total_cost: totalCost })
    .eq('id', campaign_id)

  return NextResponse.json({ results, sent: sentCount, failed: results.length - sentCount })
}
