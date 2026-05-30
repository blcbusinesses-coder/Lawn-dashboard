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
}

/**
 * Fetch an image and upload it to Supabase Storage so Lob can
 * load it from a reliable public CDN URL (avoids Unsplash hotlink
 * blocks and Google API-key referrer restrictions).
 * Returns the public URL, or null if anything fails.
 */
async function uploadImageForLob(
  imageUrl: string,
  storagePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
): Promise<string | null> {
  console.log('[img] Fetching:', imageUrl.slice(0, 120))
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LawnControl/1.0)' },
    })
    console.log('[img] Fetch status:', res.status, res.headers.get('content-type'))
    if (!res.ok) {
      console.error('[img] Fetch failed:', res.status, await res.text().catch(() => ''))
      return null
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    console.log('[img] Buffer size:', buffer.byteLength, 'bytes, type:', contentType)

    // Ensure the bucket exists — ignore "already exists" errors
    const { error: bucketErr } = await adminClient.storage.createBucket('postcard-images', {
      public: true,
      fileSizeLimit: 5242880,
    })
    if (bucketErr && !bucketErr.message?.includes('already exists')) {
      console.error('[img] Bucket create error:', bucketErr.message)
    }

    const { error: uploadErr } = await adminClient.storage
      .from('postcard-images')
      .upload(storagePath, buffer, { contentType, upsert: true })

    if (uploadErr) {
      console.error('[img] Upload error:', uploadErr.message)
      return null
    }

    const { data } = adminClient.storage
      .from('postcard-images')
      .getPublicUrl(storagePath)

    console.log('[img] Public URL:', data?.publicUrl)
    return data?.publicUrl ?? null
  } catch (err) {
    console.error('[img] Unexpected error:', err)
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

  const results: Array<{ id: string; success: boolean; lob_id?: string; error?: string }> = []

  for (const recipient of recipients) {
    try {
      // Guard: Lob requires a ZIP code
      if (!recipient.zip?.trim()) {
        results.push({ id: recipient.id, success: false, error: 'Missing ZIP code — Lob requires address_zip' })
        continue
      }

      const fullAddress = `${recipient.address}, ${recipient.city}, ${recipient.state} ${recipient.zip}`

      // Build the source image URL
      const sourceImageUrl = gmapsKey
        ? `https://maps.googleapis.com/maps/api/streetview?size=1350x900&location=${encodeURIComponent(fullAddress)}&key=${gmapsKey}`
        : SAMPLE_HOUSE_PHOTO
      console.log('[send] gmapsKey present:', !!gmapsKey, '| sourceImageUrl:', sourceImageUrl.slice(0, 120))

      // Upload to Supabase Storage → reliable CDN URL Lob can fetch
      const storagePath = `campaigns/${campaign_id}/${recipient.id}.jpg`
      let bgUrl = await uploadImageForLob(sourceImageUrl, storagePath, adminClient)
      console.log('[send] bgUrl after primary fetch:', bgUrl)

      // If Street View fetch failed, fall back to the sample lawn photo
      if (!bgUrl && gmapsKey) {
        console.log('[send] Falling back to sample lawn photo')
        const fallbackPath = `samples/lawn-fallback.jpg`
        bgUrl = await uploadImageForLob(SAMPLE_HOUSE_PHOTO, fallbackPath, adminClient)
        console.log('[send] bgUrl after fallback:', bgUrl)
      }

      const frontHtml = buildFrontHtml({
        name: recipient.name || 'Neighbor',
        aiCopy:
          recipient.ai_copy ||
          'We provide professional lawn care in your area. A personalized quote is included on this card.',
        quote: formatQuote(recipient.quote_amount || 35),
        streetViewUrl: bgUrl,
        streetAddress: recipient.address,
        totalLawns: totalLawnsCount,
        nearbyCount: recipient.nearby_count || 0,
        phone: campaignPhone,
      })

      const backHtml = buildBackHtml({
        phone: campaignPhone,
        aiCopy:
          recipient.ai_copy ||
          'We provide professional lawn care in your area and would love to take care of yours. Your personalized quote is on the other side.',
        name: recipient.name || 'Neighbor',
      })

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
        front: frontHtml,
        back: backHtml,
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

        results.push({ id: recipient.id, success: false, error: errText })
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

  const sentCount = results.filter((r) => r.success).length
  const totalCost = sentCount * 0.872

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('postcard_campaigns') as any)
    .update({ pieces_sent: sentCount, total_cost: totalCost })
    .eq('id', campaign_id)

  return NextResponse.json({ results, sent: sentCount, failed: results.length - sentCount })
}
