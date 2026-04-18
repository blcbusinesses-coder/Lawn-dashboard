import { createAdminClient } from '@/lib/supabase/server'
import { lookupProperty } from '@/lib/property/lookup'
import { openai } from '@/lib/openai/client'
import { getTwilioClient, TWILIO_FROM } from '@/lib/twilio/client'
import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import type { Json } from '@/types/database'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PricingTier        { max_sqft: number; price: number; label: string }
interface GrassRatioTier     { max_sqft: number; ratio: number; label: string }
interface FootprintEstTier   { max_sqft: number; pct: number;   label: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculate the mowable area of a property.
 *
 * Full formula (living area known):
 *   mowable = (lot − living_sqft) × grass_ratio
 *
 * Fallback formula (living area not on Zillow):
 *   estimated_footprint = lot × footprint_pct  (scales down as lot grows)
 *   mowable = (lot − estimated_footprint) × grass_ratio
 *
 * grass_ratio accounts for driveway, patio, sidewalk, garden beds, etc.
 * footprint_pct accounts for the house itself when Zillow has no living area.
 */
function calculateMowableArea(
  lotSqft: number,
  livingSqft: number | null,
  ratioTiers: GrassRatioTier[],
  footprintTiers: FootprintEstTier[]
): { mowableSqft: number; grassRatio: number; ratioLabel: string; footprintMethod: 'actual' | 'estimated'; estimatedFootprint: number | null } {
  const sortedRatio = [...ratioTiers].sort((a, b) => a.max_sqft - b.max_sqft)
  const ratioTier   = sortedRatio.find((t) => lotSqft <= t.max_sqft) ?? sortedRatio[sortedRatio.length - 1]
  const grassRatio  = ratioTier?.ratio ?? 0.70
  const ratioLabel  = ratioTier?.label ?? 'unknown'

  let footprint: number
  let footprintMethod: 'actual' | 'estimated'
  let estimatedFootprint: number | null = null

  if (livingSqft && livingSqft > 0) {
    // Zillow returned living area — use it directly
    footprint = livingSqft
    footprintMethod = 'actual'
  } else {
    // Zillow has no living area — estimate from lot size
    const sortedFp = [...footprintTiers].sort((a, b) => a.max_sqft - b.max_sqft)
    const fpTier   = sortedFp.find((t) => lotSqft <= t.max_sqft) ?? sortedFp[sortedFp.length - 1]
    const fpPct    = fpTier?.pct ?? 0.20
    footprint      = Math.round(lotSqft * fpPct)
    footprintMethod = 'estimated'
    estimatedFootprint = footprint
  }

  const outdoorArea = Math.max(lotSqft - footprint, 0)
  const mowableSqft = Math.round(outdoorArea * grassRatio)

  return { mowableSqft, grassRatio, ratioLabel, footprintMethod, estimatedFootprint }
}

function calculateQuoteFromTiers(
  mowableSqft: number | null,
  tiers: PricingTier[],
  fallback: number,
  overOneAcre: number
): { amount: number; confidence: 'measured' | 'estimate'; tier: string } {
  if (!mowableSqft || mowableSqft <= 0) {
    return { amount: fallback, confidence: 'estimate', tier: 'unknown lot — default estimate' }
  }
  const sorted = [...tiers].sort((a, b) => a.max_sqft - b.max_sqft)
  for (const tier of sorted) {
    if (mowableSqft <= tier.max_sqft) {
      return { amount: tier.price, confidence: 'measured', tier: tier.label }
    }
  }
  return { amount: overOneAcre, confidence: 'measured', tier: 'over 1 acre' }
}

async function writeLog(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  leadId: string,
  eventType: string,
  status: 'success' | 'failed' | 'skipped',
  details: Record<string, unknown>,
  durationMs?: number
) {
  await adminClient.from('automation_logs').insert({
    lead_id: leadId,
    event_type: eventType,
    status,
    details: details as Json,
    duration_ms: durationMs ?? null,
  })
}

// ── POST /api/leads/[id]/quote ─────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = await createAdminClient()

  // Fetch lead
  const { data: lead, error: leadError } = await adminClient
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // ── Load settings from DB ──────────────────────────────────────────────────
  const { data: settingsRows } = await adminClient
    .from('automation_settings')
    .select('key, value')

  const settings: Record<string, unknown> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  const tiers: PricingTier[]              = (settings.pricing_tiers as PricingTier[]) ?? []
  const ratioTiers: GrassRatioTier[]      = (settings.grass_ratio_tiers as GrassRatioTier[]) ?? []
  const footprintTiers: FootprintEstTier[]= (settings.footprint_estimate_tiers as FootprintEstTier[]) ?? []
  const fallbackPrice: number             = (settings.fallback_price as number) ?? 25
  const overOneAcrePrice: number          = (settings.over_one_acre_price as number) ?? 130
  const smsSignature: string              = (settings.sms_signature as string) ?? '– Gray Wolf Workers'
  const apifyActor: string                = (settings.apify_actor as string) ?? 'maxcopell~zillow-detail-scraper'

  // ── 1. Property lookup via Apify ───────────────────────────────────────────
  const lookupStart = Date.now()
  const propertyData = await lookupProperty(lead.address, apifyActor)
  const lookupMs = Date.now() - lookupStart

  const lotSqft     = propertyData?.lotSizeSqft ?? null
  const livingSqft  = propertyData?.squareFootage ?? null

  // ── 2. Calculate mowable area then quote ───────────────────────────────────
  let mowableSqft: number | null = null
  let grassRatio: number | null = null
  let ratioLabel: string | null = null

  let footprintMethod: 'actual' | 'estimated' | null = null
  let estimatedFootprint: number | null = null

  if (lotSqft && lotSqft > 0) {
    const result    = calculateMowableArea(lotSqft, livingSqft, ratioTiers, footprintTiers)
    mowableSqft     = result.mowableSqft
    grassRatio      = result.grassRatio
    ratioLabel      = result.ratioLabel
    footprintMethod = result.footprintMethod
    estimatedFootprint = result.estimatedFootprint
  }

  await writeLog(adminClient, id, 'property_lookup',
    propertyData ? 'success' : 'skipped',
    {
      address:            lead.address,
      actor:              apifyActor,
      lot_size_sqft:      lotSqft,
      living_sqft:        livingSqft,
      footprint_method:   footprintMethod,
      estimated_footprint:estimatedFootprint,
      mowable_sqft:       mowableSqft,
      grass_ratio:        grassRatio,
      ratio_label:        ratioLabel,
    },
    lookupMs
  )

  const quote = calculateQuoteFromTiers(mowableSqft, tiers, fallbackPrice, overOneAcrePrice)

  // ── 3. Get nearest available dates ─────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: availDates } = await adminClient
    .from('availability_dates')
    .select('available_date')
    .gte('available_date', today)
    .order('available_date')
    .limit(3)

  const availText = availDates?.length
    ? availDates.map((d) => format(new Date(d.available_date + 'T12:00:00'), 'EEEE, MMM d')).join(', ')
    : 'flexible'

  const preferredText = lead.preferred_date
    ? format(new Date((lead.preferred_date as string) + 'T12:00:00'), 'EEEE, MMM d')
    : null

  // ── 4. Generate AI SMS ─────────────────────────────────────────────────────
  let smsBody: string
  const firstName = (lead.name as string).split(' ')[0]

  try {
    const prompt = `Write a friendly, natural SMS quote message for a lawn mowing service. Keep the TOTAL message under 320 characters.

Customer first name: ${firstName}
Property address: ${lead.address}
Quote: $${quote.amount}/mow${quote.confidence === 'estimate' ? ' (estimated, exact lot size unavailable)' : ''}
${preferredText ? `Their preferred day: ${preferredText}` : ''}
Our next available dates: ${availText}
Signature to append: ${smsSignature}

Include: friendly greeting, the price, ask if it sounds good, mention we can get started soon. No emojis in the body unless very subtle. Append the signature at the end.`

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    })
    smsBody = res.choices[0].message.content?.trim() ?? ''
  } catch {
    smsBody = `Hi ${firstName}! Gray Wolf Workers here 🐺 We'd love to mow your lawn at ${lead.address} for $${quote.amount}/visit. Sound good? We can get started ${availDates?.length ? `as soon as ${format(new Date(availDates[0].available_date + 'T12:00:00'), 'MMM d')}` : 'soon'}! Reply YES to confirm. ${smsSignature}`
  }

  // ── 5. Send SMS ────────────────────────────────────────────────────────────
  let twilioSid: string | null = null
  let smsSent = false
  const smsStart = Date.now()

  try {
    const twilio = getTwilioClient()
    const message = await twilio.messages.create({
      from: TWILIO_FROM,
      to: lead.phone as string,
      body: smsBody,
    })
    twilioSid = message.sid
    smsSent = true

    await writeLog(adminClient, id, 'quote_sms_sent', 'success', {
      phone:         lead.phone,
      body:          smsBody,
      twilio_sid:    twilioSid,
      quote_amount:  quote.amount,
      lot_size_sqft:       lotSqft,
      living_sqft:         livingSqft,
      footprint_method:    footprintMethod,
      estimated_footprint: estimatedFootprint,
      mowable_sqft:        mowableSqft,
      grass_ratio:         grassRatio,
      tier:                quote.tier,
    }, Date.now() - smsStart)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    await writeLog(adminClient, id, 'quote_sms_sent', 'failed', {
      phone: lead.phone,
      error: errMsg,
    }, Date.now() - smsStart)
  }

  // ── 6. Persist results ─────────────────────────────────────────────────────
  await adminClient
    .from('leads')
    .update({
      status:          'quoted',
      property_data:   (propertyData?.raw ?? null) as Json | null,
      lot_size_sqft:   lotSqft,
      quoted_amount:   quote.amount,
      quote_sent_at:   new Date().toISOString(),
    })
    .eq('id', id)

  // Upsert conversation
  const { data: conversation } = await adminClient
    .from('conversations')
    .upsert(
      {
        phone:            lead.phone as string,
        lead_id:          lead.id,
        display_name:     lead.name as string,
        ai_enabled:       true,
        ai_state:         'quote_sent',
        last_message_at:  new Date().toISOString(),
      },
      { onConflict: 'phone' }
    )
    .select()
    .single()

  if (conversation && smsBody) {
    await adminClient.from('conversation_messages').insert({
      conversation_id: conversation.id,
      direction:       'outbound',
      body:            smsBody,
      twilio_sid:      twilioSid,
      status:          smsSent ? 'sent' : 'failed',
    })
  }

  return NextResponse.json({
    success:       true,
    quote_amount:  quote.amount,
    confidence:    quote.confidence,
    tier:          quote.tier,
    lot_size_sqft:       lotSqft,
    living_sqft:         livingSqft,
    footprint_method:    footprintMethod,
    estimated_footprint: estimatedFootprint,
    mowable_sqft:        mowableSqft,
    grass_ratio:         grassRatio,
    sms_sent:            smsSent,
    sms_body:            smsBody,
  })
}
