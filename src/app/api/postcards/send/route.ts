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
// Back: left 50% is branded content, right 50% is left clean for USPS address block.

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
    background: #1a4a2e;
    display: flex; flex-direction: column;
  }
</style>
</head>
<body>

  <!-- ── Header ── -->
  <div style="background:#0d2e1a;padding:11px 26px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:12px;">
      <span style="font-size:26px;">&#128058;</span>
      <div>
        <div style="color:#ffffff;font-weight:900;font-size:15px;letter-spacing:2.5px;">GRAY WOLF WORKERS</div>
        <div style="color:#7ec87e;font-size:10px;letter-spacing:1.5px;">PROFESSIONAL LAWN CARE &bull; KENDALLVILLE, IN</div>
      </div>
    </div>
    <div style="color:#ffffff;font-weight:bold;font-size:14px;">${escapeHtml(phone)}</div>
  </div>

  <!-- ── Main body ── -->
  <div style="display:flex;flex:1;overflow:hidden;">

    <!-- Left: copy & quote (58%) -->
    <div style="width:58%;padding:26px 30px;display:flex;flex-direction:column;justify-content:center;background:#1a4a2e;">
      <div style="color:#7ec87e;font-size:10px;letter-spacing:2px;font-weight:bold;text-transform:uppercase;margin-bottom:8px;">A Note Just For You</div>
      <h1 style="color:#ffffff;font-size:36px;font-weight:900;line-height:1.05;margin-bottom:12px;">Hey,&nbsp;${escapeHtml(name)}.</h1>
      <p style="color:#c8e6c8;font-size:13px;line-height:1.7;margin-bottom:22px;">${escapeHtml(aiCopy)}</p>

      <!-- Quote pill -->
      <div style="display:inline-block;background:#7ec87e;padding:11px 20px;border-radius:5px;margin-bottom:20px;align-self:flex-start;">
        <div style="color:#0d2e1a;font-size:9px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px;">Your Personalized Quote</div>
        <div style="color:#0d2e1a;font-size:28px;font-weight:900;line-height:1;">${escapeHtml(quote)}</div>
      </div>

      <!-- Social proof -->
      <div style="display:flex;gap:20px;">
        <div style="color:#7ec87e;font-size:11px;">&#127807;&nbsp;${totalLawns} lawns this season</div>
        <div style="color:#7ec87e;font-size:11px;">&#128205;&nbsp;${nearbyCount} neighbors already on board</div>
      </div>
    </div>

    <!-- Right: street view photo (42%) -->
    <div style="width:42%;position:relative;overflow:hidden;flex-shrink:0;">
      <img src="${streetViewUrl}" alt="Your property" style="width:100%;height:100%;object-fit:cover;display:block;" />
      <!-- Dark overlay label at bottom -->
      <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(13,46,26,0.92));padding:20px 14px 10px;">
        <div style="color:#7ec87e;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;">Your Property</div>
        <div style="color:#ffffff;font-size:11px;margin-top:3px;">${escapeHtml(streetAddress)}</div>
      </div>
    </div>

  </div>

  <!-- ── Footer CTA ── -->
  <div style="background:#0d2e1a;padding:10px 26px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
    <div style="color:#c8e6c8;font-size:11px;">No contracts &bull; Cancel anytime &bull; Locally owned &amp; operated</div>
    <div style="background:#7ec87e;color:#0d2e1a;padding:8px 22px;border-radius:22px;font-weight:900;font-size:13px;letter-spacing:0.5px;white-space:nowrap;">
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

  <!-- ── Left: branded content (50%) ── -->
  <div style="width:50%;background:#1a4a2e;padding:34px 32px;display:flex;flex-direction:column;justify-content:space-between;">

    <!-- Logo block -->
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:26px;">
        <span style="font-size:32px;">&#128058;</span>
        <div>
          <div style="color:#ffffff;font-weight:900;font-size:18px;letter-spacing:2.5px;line-height:1.1;">GRAY WOLF</div>
          <div style="color:#7ec87e;font-weight:900;font-size:18px;letter-spacing:2.5px;line-height:1.1;">WORKERS</div>
        </div>
      </div>

      <!-- Tagline -->
      <div style="color:#7ec87e;font-size:12px;font-style:italic;margin-bottom:22px;">Your neighborhood lawn care experts.</div>

      <!-- Services -->
      <div style="color:#7ec87e;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">What We Do</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#7ec87e;flex-shrink:0;"></div>
          <div style="color:#ffffff;font-size:13px;">Lawn Mowing &amp; Cutting</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#7ec87e;flex-shrink:0;"></div>
          <div style="color:#ffffff;font-size:13px;">Edging &amp; String Trimming</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#7ec87e;flex-shrink:0;"></div>
          <div style="color:#ffffff;font-size:13px;">Seasonal Lawn Cleanup</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#7ec87e;flex-shrink:0;"></div>
          <div style="color:#ffffff;font-size:13px;">Weekly &amp; Biweekly Plans</div>
        </div>
      </div>
    </div>

    <!-- Call to action -->
    <div>
      <div style="color:#7ec87e;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Call or text today</div>
      <div style="color:#ffffff;font-size:26px;font-weight:900;margin-bottom:6px;">${escapeHtml(phone)}</div>
      <div style="background:#7ec87e;color:#0d2e1a;padding:8px 16px;border-radius:4px;font-size:12px;font-weight:bold;display:inline-block;">Free quote included on the other side</div>
    </div>

  </div>

  <!-- ── Right: white zone for USPS address block (50%) ── -->
  <!-- Lob overlays the recipient address and indicia in this area. Keep clean. -->
  <div style="width:50%;background:#ffffff;padding:18px 20px;display:flex;flex-direction:column;">

    <!-- Return address (top-left of address zone) -->
    <div style="margin-bottom:auto;">
      <div style="font-size:9px;color:#333;font-weight:bold;letter-spacing:0.5px;line-height:1.6;">GRAY WOLF WORKERS</div>
      <div style="font-size:9px;color:#555;line-height:1.6;">703 East Mitchell Street</div>
      <div style="font-size:9px;color:#555;line-height:1.6;">Kendallville, IN 46755</div>
    </div>

    <!-- Subtle branding at bottom -->
    <div style="text-align:center;padding-top:12px;">
      <div style="color:#1a4a2e;font-size:10px;letter-spacing:1px;font-style:italic;">graywolfworkers.com</div>
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

  // Total customer count for social proof footer
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

      // Street view: 800×600 for high-res rendering on 6x9
      const streetViewUrl = gmapsKey
        ? `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(fullAddress)}&key=${gmapsKey}`
        : `https://via.placeholder.com/800x600/1a4a2e/7ec87e?text=Your+Home`

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
