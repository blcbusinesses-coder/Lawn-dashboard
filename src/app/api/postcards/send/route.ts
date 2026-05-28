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

// ─── HTML Templates ───────────────────────────────────────────────────────────
// Layout inspired by reference postcard:
//   TOP:    Dark green header — company name left, phone right
//   MIDDLE: Full-width house photo with dark overlay + personalized text
//   BOTTOM: Dark green strip — custom estimate left, call-to-action right
//
// BACK:
//   LEFT 50%:  AI copy blurb + company name + phone  (dark green)
//   RIGHT 50%: Clean white — Lob prints address here

function buildFrontHtml(params: {
  name: string
  aiCopy: string
  quote: string
  streetViewUrl: string | null
  streetAddress: string
  totalLawns: number
  nearbyCount: number
  phone: string
}): string {
  const { name, aiCopy, quote, streetViewUrl, streetAddress, totalLawns, nearbyCount, phone } = params

  const photoLayer = streetViewUrl
    ? `<img src="${streetViewUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" />`
    : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#0d2e1a 0%,#1a4a2e 50%,#0d2e1a 100%);"></div>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 9in; height: 6in; overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    display: flex; flex-direction: column;
    background: #1a4a2e;
  }
</style>
</head>
<body>

  <!-- ══ TOP HEADER ══ -->
  <div style="background:#1a4a2e;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-bottom:3px solid rgba(255,255,255,0.12);">

    <!-- Left: company name -->
    <div>
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:3px;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Professional Lawn Care &bull; Kendallville, IN</div>
      <div style="color:#ffffff;font-size:34px;font-weight:900;letter-spacing:2px;line-height:1;">GRAY WOLF WORKERS</div>
    </div>

    <!-- Right: phone -->
    <div style="text-align:right;">
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Call or Text</div>
      <div style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:1px;">${escapeHtml(phone)}</div>
    </div>

  </div>

  <!-- ══ MIDDLE: full-width house photo with overlay ══ -->
  <div style="flex:1;position:relative;overflow:hidden;">

    <!-- Photo (or dark gradient fallback) -->
    ${photoLayer}

    <!-- Dark scrim for text readability -->
    <div style="position:absolute;inset:0;background:rgba(0,0,0,0.52);"></div>

    <!-- Content overlay -->
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:28px 40px;">

      <!-- Greeting -->
      <div style="color:rgba(255,255,255,0.65);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">A personal note for you</div>
      <div style="color:#ffffff;font-size:52px;font-weight:900;line-height:1;margin-bottom:14px;">Hey, ${escapeHtml(name)}.</div>

      <!-- Address caption -->
      <div style="color:rgba(255,255,255,0.55);font-size:12px;margin-bottom:22px;">${escapeHtml(streetAddress)}</div>

      <!-- Divider -->
      <div style="width:48px;height:3px;background:rgba(255,255,255,0.4);margin-bottom:22px;"></div>

      <!-- Stats pills -->
      <div style="display:flex;gap:14px;">
        <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:5px;padding:10px 18px;">
          <div style="color:rgba(255,255,255,0.6);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Neighbors on our route</div>
          <div style="color:#ffffff;font-size:26px;font-weight:900;line-height:1;">${nearbyCount}</div>
        </div>
        <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:5px;padding:10px 18px;">
          <div style="color:rgba(255,255,255,0.6);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Lawns this season</div>
          <div style="color:#ffffff;font-size:26px;font-weight:900;line-height:1;">${totalLawns}</div>
        </div>
      </div>

    </div>

  </div>

  <!-- ══ BOTTOM STRIP: estimate + CTA ══ -->
  <div style="background:#1a4a2e;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-top:3px solid rgba(255,255,255,0.12);">

    <!-- Left: estimate -->
    <div style="display:flex;align-items:center;gap:20px;">
      <div>
        <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Your Custom Estimate</div>
        <div style="color:#ffffff;font-size:36px;font-weight:900;line-height:1;">${escapeHtml(quote)}</div>
      </div>
      <div style="width:1px;height:44px;background:rgba(255,255,255,0.2);"></div>
      <div style="color:rgba(255,255,255,0.5);font-size:11px;line-height:1.6;">Per visit &bull; No contract<br/>Cancel anytime</div>
    </div>

    <!-- Right: CTA button -->
    <div style="background:#ffffff;color:#1a4a2e;padding:12px 28px;border-radius:5px;text-align:center;">
      <div style="font-size:10px;letter-spacing:1.5px;font-weight:bold;text-transform:uppercase;opacity:0.6;margin-bottom:2px;">Call or Text Now</div>
      <div style="font-size:22px;font-weight:900;letter-spacing:0.5px;">${escapeHtml(phone)}</div>
    </div>

  </div>

</body>
</html>`
}

function buildBackHtml(params: { phone: string; aiCopy: string; name: string }): string {
  const { phone, aiCopy, name } = params
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 9in; height: 6in; overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    display: flex;
  }
</style>
</head>
<body>

  <!-- ══ LEFT: personalized blurb panel (50%) ══ -->
  <div style="width:50%;background:#1a4a2e;padding:36px 32px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">

    <!-- Top: company name -->
    <div>
      <div style="color:#ffffff;font-weight:900;font-size:20px;letter-spacing:2.5px;line-height:1.1;">GRAY WOLF WORKERS</div>
      <div style="color:rgba(255,255,255,0.45);font-size:10px;letter-spacing:1.5px;margin-top:5px;text-transform:uppercase;">Lawn Care &bull; Kendallville, IN</div>

      <div style="width:36px;height:2px;background:rgba(255,255,255,0.25);margin:20px 0;"></div>

      <!-- Personalized note -->
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Hey, ${escapeHtml(name)} &mdash;</div>
      <p style="color:#ffffff;font-size:15px;line-height:1.8;">${escapeHtml(aiCopy)}</p>
    </div>

    <!-- Bottom: phone -->
    <div>
      <div style="color:rgba(255,255,255,0.45);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">Ready? Give us a call.</div>
      <div style="color:#ffffff;font-size:26px;font-weight:900;letter-spacing:0.5px;">${escapeHtml(phone)}</div>
    </div>

  </div>

  <!-- ══ RIGHT: USPS address zone (50%) — keep clean ══ -->
  <div style="width:50%;background:#ffffff;padding:18px 22px;display:flex;flex-direction:column;">
    <div>
      <div style="font-size:9px;color:#222;font-weight:bold;line-height:1.8;">GRAY WOLF WORKERS</div>
      <div style="font-size:9px;color:#555;line-height:1.8;">703 East Mitchell Street</div>
      <div style="font-size:9px;color:#555;line-height:1.8;">Kendallville, IN 46755</div>
    </div>
  </div>

</body>
</html>`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── POST handler ─────────────────────────────────────────────────────────────

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
      const fullAddress = `${recipient.address}, ${recipient.city}, ${recipient.state} ${recipient.zip}`

      const streetViewUrl = gmapsKey
        ? `https://maps.googleapis.com/maps/api/streetview?size=900x500&location=${encodeURIComponent(fullAddress)}&key=${gmapsKey}`
        : null

      const frontHtml = buildFrontHtml({
        name: recipient.name || 'Neighbor',
        aiCopy:
          recipient.ai_copy ||
          'We provide professional lawn care in your area. A personalized quote is included on this card.',
        quote: formatQuote(recipient.quote_amount || 35),
        streetViewUrl,
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
