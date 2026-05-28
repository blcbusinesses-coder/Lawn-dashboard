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
// Lob renders at 150 DPI. 6x9 landscape = 9in wide × 6in tall.
// Colors: #1a4a2e (dark green) + white only. Clean, readable.
// Back: left 50% branded content, right 50% clean white for USPS address block.

// Swap this URL to a real crew/truck/yard photo when ready
const COMPANY_PHOTO_URL =
  'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=700&h=280&fit=crop&q=80'

function buildFrontHtml(params: {
  name: string
  aiCopy: string
  quote: string
  streetViewUrl: string
  streetAddress: string
  totalLawns: number
  nearbyCount: number
  phone: string
}): string {
  const { name, aiCopy, quote, streetViewUrl, streetAddress, totalLawns, nearbyCount, phone } = params
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 9in; height: 6in; overflow: hidden;
    font-family: Arial, Helvetica, sans-serif;
    background: #ffffff;
    display: flex; flex-direction: column;
  }
</style>
</head>
<body>

  <!-- Header -->
  <div style="background:#1a4a2e;padding:13px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div>
      <div style="color:#ffffff;font-weight:900;font-size:16px;letter-spacing:3px;">GRAY WOLF WORKERS</div>
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:1.5px;margin-top:2px;">PROFESSIONAL LAWN CARE &bull; KENDALLVILLE, IN</div>
    </div>
    <div style="color:#ffffff;font-size:15px;font-weight:bold;">${escapeHtml(phone)}</div>
  </div>

  <!-- Body -->
  <div style="display:flex;flex:1;overflow:hidden;">

    <!-- Left: white copy panel -->
    <div style="width:55%;padding:28px 32px;display:flex;flex-direction:column;justify-content:center;background:#ffffff;">

      <div style="font-size:10px;font-weight:bold;letter-spacing:2px;color:#1a4a2e;text-transform:uppercase;margin-bottom:10px;">A personal note for you</div>

      <div style="font-size:40px;font-weight:900;color:#111111;line-height:1;margin-bottom:10px;">Hey, ${escapeHtml(name)}.</div>

      <div style="width:36px;height:3px;background:#1a4a2e;margin-bottom:14px;"></div>

      <p style="font-size:13px;line-height:1.75;color:#444444;margin-bottom:20px;">${escapeHtml(aiCopy)}</p>

      <!-- Quote -->
      <div style="display:inline-block;background:#1a4a2e;color:#ffffff;padding:12px 22px;border-radius:5px;margin-bottom:18px;align-self:flex-start;">
        <div style="font-size:9px;letter-spacing:1.5px;opacity:0.65;text-transform:uppercase;margin-bottom:4px;">Your Personalized Quote</div>
        <div style="font-size:28px;font-weight:900;line-height:1;">${escapeHtml(quote)}</div>
        <div style="font-size:10px;opacity:0.6;margin-top:3px;">Per visit &bull; No contract required</div>
      </div>

      <!-- Stats -->
      <div style="display:flex;border-top:1px solid #e5e7eb;padding-top:14px;">
        <div style="text-align:center;flex:1;">
          <div style="font-size:20px;font-weight:900;color:#1a4a2e;">${totalLawns}</div>
          <div style="font-size:9px;color:#888;letter-spacing:0.5px;margin-top:2px;text-transform:uppercase;">Lawns This Season</div>
        </div>
        <div style="width:1px;background:#e5e7eb;"></div>
        <div style="text-align:center;flex:1;">
          <div style="font-size:20px;font-weight:900;color:#1a4a2e;">${nearbyCount}</div>
          <div style="font-size:9px;color:#888;letter-spacing:0.5px;margin-top:2px;text-transform:uppercase;">Near Your Home</div>
        </div>
      </div>

    </div>

    <!-- Right: street view photo -->
    <div style="width:45%;position:relative;overflow:hidden;background:#1a4a2e;flex-shrink:0;">
      <img src="${streetViewUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
      <div style="position:absolute;bottom:0;left:0;right:0;padding:28px 16px 12px;background:linear-gradient(transparent,rgba(0,0,0,0.78));">
        <div style="color:rgba(255,255,255,0.6);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px;">Your Property</div>
        <div style="color:#ffffff;font-size:12px;font-weight:bold;">${escapeHtml(streetAddress)}</div>
      </div>
    </div>

  </div>

  <!-- Footer CTA -->
  <div style="background:#1a4a2e;padding:11px 28px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div style="color:rgba(255,255,255,0.55);font-size:11px;">No contracts &bull; Cancel anytime &bull; Locally owned &amp; insured</div>
    <div style="background:#ffffff;color:#1a4a2e;padding:9px 26px;border-radius:4px;font-weight:900;font-size:13px;letter-spacing:0.5px;white-space:nowrap;">
      CALL OR TEXT ${escapeHtml(phone)}
    </div>
  </div>

</body>
</html>`
}

function buildBackHtml(phone: string): string {
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

  <!-- Left: branded panel (50%) -->
  <div style="width:50%;background:#1a4a2e;display:flex;flex-direction:column;overflow:hidden;">

    <!-- Company name -->
    <div style="padding:20px 26px 14px;">
      <div style="color:#ffffff;font-weight:900;font-size:22px;letter-spacing:3px;line-height:1.15;">GRAY WOLF</div>
      <div style="color:#ffffff;font-weight:900;font-size:22px;letter-spacing:3px;line-height:1.15;">WORKERS</div>
      <div style="color:rgba(255,255,255,0.45);font-size:10px;letter-spacing:1px;margin-top:5px;">LAWN CARE &bull; KENDALLVILLE, IN</div>
    </div>

    <!-- Company photo -->
    <div style="flex:1;overflow:hidden;position:relative;">
      <img src="${COMPANY_PHOTO_URL}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
      <div style="position:absolute;inset:0;background:rgba(26,74,46,0.2);"></div>
    </div>

    <!-- Phone + CTA -->
    <div style="padding:16px 26px;border-top:2px solid rgba(255,255,255,0.12);">
      <div style="color:rgba(255,255,255,0.5);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Call or text anytime</div>
      <div style="color:#ffffff;font-size:26px;font-weight:900;letter-spacing:0.5px;margin-bottom:10px;">${escapeHtml(phone)}</div>
      <div style="background:#ffffff;color:#1a4a2e;padding:9px 18px;border-radius:4px;font-size:12px;font-weight:900;display:inline-block;letter-spacing:0.5px;">
        GET YOUR FREE QUOTE TODAY
      </div>
    </div>

  </div>

  <!-- Right: USPS address zone (50%) — keep clean for Lob -->
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

  // Total customer count for social proof
  const { count: totalLawns } = await adminClient
    .from('customers')
    .select('*', { count: 'exact', head: true })
  const totalLawnsCount = totalLawns ?? 0

  // Campaign name for description
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
        ? `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(fullAddress)}&key=${gmapsKey}`
        : `https://via.placeholder.com/800x600/1a4a2e/ffffff?text=Your+Home`

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

  // Update campaign totals
  const sentCount = results.filter((r) => r.success).length
  const totalCost = sentCount * 0.872

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('postcard_campaigns') as any)
    .update({ pieces_sent: sentCount, total_cost: totalCost })
    .eq('id', campaign_id)

  return NextResponse.json({ results, sent: sentCount, failed: results.length - sentCount })
}
