/**
 * POST /api/letters/blast — "Area Blast" outreach.
 *
 * action: 'preview' — pull homes in a ZIP from RentCast (one bulk request
 *   returns address + owner name + lot/living sqft for up to 500 properties),
 *   price each with the shared quoting engine, keep only homes whose quote
 *   lands in the requested band, drop addresses we've ever queued before, and
 *   return up to `count` candidates. Nothing is written or mailed.
 *
 * action: 'send' — for a SMALL batch of candidates (client loops batches to
 *   stay inside serverless limits): write the AI letter body via Haiku, insert
 *   a letter_recipients row (source 'area_blast'), and mail it via Lob.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeQuote, generateAiCopy, type SettingsMap } from '@/lib/letters/generate'
import { normalizeAddress, sendLetterToLob } from '@/lib/letters/monitor'
import { tidyName, looksLikeCompany } from '@/lib/property/owner'
import { qualifyBatch, priorityForScore, INCOME_ABOVE_POINTS, type QualInput } from '@/lib/letters/qualify'
import { incomeBandsBatch } from '@/lib/letters/census'

export const maxDuration = 60

interface RentCastRecord {
  addressLine1?: string
  city?: string
  state?: string
  zipCode?: string
  propertyType?: string
  lotSize?: number
  squareFootage?: number
  owner?: { names?: string[]; mailingAddress?: { addressLine1?: string } }
  ownerOccupied?: boolean
  lastSaleDate?: string
  lastSalePrice?: number
  taxAssessments?: Record<string, { value?: number }>
  latitude?: number
  longitude?: number
}

export interface BlastCandidate {
  name: string
  address: string
  city: string
  state: string
  zip: string
  lot_sqft: number | null
  living_sqft: number | null
  quote: number
  // Targeting (added by the qualification engine; optional so older callers
  // and the send path keep working unchanged).
  lead_score?: number
  segment?: string
  mail_priority?: string
  is_absentee?: boolean
  last_sold?: string | null
  home_value?: number | null
  income_band?: string
}

/** Latest assessed value from RentCast tax assessments, else last sale price. */
function recordValue(r: RentCastRecord): number | null {
  const ta = r.taxAssessments
  if (ta && typeof ta === 'object') {
    const years = Object.keys(ta).sort().reverse()
    for (const y of years) {
      const v = ta[y]?.value
      if (typeof v === 'number' && v > 0) return v
    }
  }
  return typeof r.lastSalePrice === 'number' && r.lastSalePrice > 0 ? r.lastSalePrice : null
}

async function loadSettings(): Promise<SettingsMap> {
  const admin = createServiceClient()
  const { data } = await admin.from('automation_settings').select('key, value')
  const settings: SettingsMap = {}
  for (const row of data ?? []) settings[row.key] = row.value
  return settings
}

/** Geocode a center point (address, street, or landmark) via Nominatim. Biased
 *  to the Kendallville area so a bare street name resolves locally. */
async function geocodeCenter(q: string): Promise<{ lat: number; lng: number } | null> {
  const query = /kendallville|indiana|\bin\b|\d{5}/i.test(q) ? q : `${q}, Kendallville, IN`
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GrayWolfWorkers/1.0', 'Accept-Language': 'en-US' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// ── Preview ───────────────────────────────────────────────────────────────────

async function preview(body: Record<string, unknown>) {
  const mode = body.mode === 'area' ? 'area' : 'zip'
  const zip = String(body.zip ?? '').trim().slice(0, 5)
  const count = Math.min(Math.max(Number(body.count) || 25, 1), 200)
  const targetQuote = Number(body.target_quote) || 50
  const minQuote = Number(body.min_quote) || targetQuote - 10
  const maxQuote = Number(body.max_quote) || targetQuote + 10

  const apiKey = process.env.RENTCAST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RENTCAST_API_KEY is not configured' }, { status: 500 })
  }

  // Build the RentCast query: a ZIP pull, or a radius pull around a point the
  // owner anchors on (a street/address in the neighborhood they want).
  // Single-family only — we don't want apartments or empty parcels.
  let url: string
  let centerLabel = ''
  if (mode === 'area') {
    const center = String(body.center ?? '').trim()
    const radius = Math.min(Math.max(Number(body.radius) || 0.5, 0.1), 3)
    if (center.length < 3) {
      return NextResponse.json({ error: 'Enter a street or address to center the area on' }, { status: 400 })
    }
    const geo = await geocodeCenter(center)
    if (!geo) {
      return NextResponse.json({ error: `Couldn't find "${center}". Try a full street address.` }, { status: 400 })
    }
    centerLabel = center
    url =
      `https://api.rentcast.io/v1/properties?latitude=${geo.lat}&longitude=${geo.lng}&radius=${radius}` +
      `&propertyType=${encodeURIComponent('Single Family')}&limit=500`
  } else {
    if (!/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: 'A 5-digit ZIP code is required' }, { status: 400 })
    }
    url =
      `https://api.rentcast.io/v1/properties?zipCode=${zip}` +
      `&propertyType=${encodeURIComponent('Single Family')}&limit=500`
  }

  const settings = await loadSettings()
  const admin = createServiceClient()

  const res = await fetch(url, {
    headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200)
    return NextResponse.json({ error: `RentCast error ${res.status}: ${text}` }, { status: 502 })
  }
  const records = (await res.json()) as RentCastRecord[]
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ candidates: [], scanned: 0, in_band: 0, center: centerLabel })
  }

  // Smart targeting (gates + lead scoring + best-first) is on by default; the
  // client can send smart:false for the original quote-band-only behavior.
  const smart = body.smart !== false

  // Price every record locally and keep the in-band ones (carrying the data the
  // qualification engine needs — all from this same RentCast response).
  const inBand: Array<{ cand: BlastCandidate; qual: QualInput }> = []
  for (const r of records) {
    const street = (r.addressLine1 ?? '').trim()
    const city = (r.city ?? '').trim()
    if (!street) continue

    const recZip = (r.zipCode ?? zip ?? '').trim().slice(0, 5)

    const lotSqft = typeof r.lotSize === 'number' && r.lotSize > 0 ? r.lotSize : null
    const livingSqft = typeof r.squareFootage === 'number' && r.squareFootage > 0 ? r.squareFootage : null
    // No lot size on record → can't price it honestly; skip rather than guess.
    if (!lotSqft) continue

    const fullAddress = `${street}, ${city}, ${r.state ?? 'IN'} ${recZip}`
    const { quoteAmount } = computeQuote(lotSqft, livingSqft, fullAddress, settings)
    if (quoteAmount < minQuote || quoteAmount > maxQuote) continue

    const rawName = (r.owner?.names?.[0] ?? '').trim()
    const name = rawName && !looksLikeCompany(rawName) ? tidyName(rawName) : 'Neighbor'

    inBand.push({
      cand: {
        name,
        address: street,
        city,
        state: (r.state ?? 'IN').trim() || 'IN',
        zip: recZip,
        lot_sqft: lotSqft,
        living_sqft: livingSqft,
        quote: quoteAmount,
      },
      qual: {
        lotSqft,
        zip: recZip,
        quote: quoteAmount,
        ownerOccupied: typeof r.ownerOccupied === 'boolean' ? r.ownerOccupied : null,
        ownerMailingLine: r.owner?.mailingAddress?.addressLine1 ?? null,
        propertyLine: street,
        homeValue: recordValue(r),
        lastSaleDate: r.lastSaleDate ?? null,
        lat: typeof r.latitude === 'number' ? r.latitude : null,
        lng: typeof r.longitude === 'number' ? r.longitude : null,
      },
    })
  }

  // Apply gates + base scoring (best-first). Keep the {cand, qual, score…}
  // bundle so we can enrich after deduping. Without smart targeting, no scores.
  type Item = { cand: BlastCandidate; qual: QualInput; lead_score?: number }
  let items: Item[]
  let gateDropped = 0
  if (smart) {
    const scored = qualifyBatch(inBand)        // gate-passers, sorted best-first
    gateDropped = inBand.length - scored.length
    for (const s of scored) {
      s.cand.lead_score = s.lead_score
      s.cand.segment = s.segment
      s.cand.mail_priority = s.mail_priority
      s.cand.is_absentee = s.is_absentee
      s.cand.last_sold = s.last_sold
      s.cand.home_value = s.home_value
    }
    items = scored
  } else {
    items = inBand
  }

  // Drop anything we've ever queued/mailed before (any source).
  const dedupKeys = items.map(it => normalizeAddress(it.cand.address, it.cand.zip))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.from('letter_recipients') as any)
    .select('dedup_key')
    .in('dedup_key', dedupKeys)
  const seen = new Set((existing ?? []).map((r: { dedup_key: string }) => r.dedup_key))

  let notContacted = items.filter(it => !seen.has(normalizeAddress(it.cand.address, it.cand.zip)))
  const alreadyContacted = items.length - notContacted.length

  // ── S6: enrich the top prospects with Census block-group income, add points
  // for above-median blocks, then re-sort. Bounded so we don't blow the time
  // limit — we only need it on the homes we'd actually consider mailing.
  if (smart) {
    const ENRICH_CAP = 60
    const head = notContacted.slice(0, ENRICH_CAP)
    try {
      const bands = await incomeBandsBatch(head.map(it => ({ lat: it.qual.lat ?? null, lng: it.qual.lng ?? null })))
      head.forEach((it, i) => {
        const band = bands[i]
        it.cand.income_band = band
        if (band === 'above') {
          it.cand.lead_score = (it.cand.lead_score ?? 0) + INCOME_ABOVE_POINTS
          it.cand.mail_priority = priorityForScore(it.cand.lead_score)
        }
      })
      // Re-sort by the updated score so above-median blocks rise.
      notContacted = [...notContacted].sort((a, b) => (b.cand.lead_score ?? 0) - (a.cand.lead_score ?? 0))
    } catch { /* income optional — leave base scores */ }
  }

  const candidates = notContacted.slice(0, count).map(it => it.cand)

  const priority = { first: 0, second: 0, skip: 0 }
  for (const it of notContacted) {
    const p = it.cand.mail_priority as 'first' | 'second' | 'skip' | undefined
    if (p) priority[p]++
  }

  return NextResponse.json({
    candidates,
    scanned: records.length,
    in_band: inBand.length,
    center: centerLabel,
    smart,
    gate_dropped: gateDropped,
    priority,
    already_contacted: alreadyContacted,
  })
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function send(body: Record<string, unknown>) {
  const phone = String(body.phone ?? '').trim() || '(260) 599-4253'
  const recipients = (body.recipients ?? []) as BlastCandidate[]
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients are required' }, { status: 400 })
  }
  // Keep each request small — every letter costs a Haiku call + a Lob call.
  if (recipients.length > 5) {
    return NextResponse.json({ error: 'Send at most 5 recipients per request' }, { status: 400 })
  }

  const admin = createServiceClient()
  const results: Array<{ address: string; success: boolean; error?: string }> = []

  for (const r of recipients) {
    const fullAddress = `${r.address}, ${r.city}, ${r.state} ${r.zip}`
    const dedupKey = normalizeAddress(r.address, r.zip)
    try {
      // Safeguard: never mail someone who has already been mailed or is already
      // queued — ANY source (letters, monitors, a prior blast), not just this
      // one. This closes the cross-source / stale-preview gap. 'failed' rows are
      // not counted (they were never actually mailed). A future multi-letter
      // sequence is a separate, deliberate flow, so these records still persist
      // and can be re-targeted there.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prior } = await (admin.from('letter_recipients') as any)
        .select('id')
        .eq('dedup_key', dedupKey)
        .in('status', ['sent', 'scheduled', 'pending', 'review'])
        .limit(1)
      if (prior && prior.length > 0) {
        results.push({ address: r.address, success: false, error: 'Already contacted — skipped' })
        continue
      }

      const featureParts: string[] = []
      if (r.lot_sqft)    featureParts.push(`${Math.round(r.lot_sqft).toLocaleString()} sq ft lot`)
      if (r.living_sqft) featureParts.push(`${Math.round(r.living_sqft).toLocaleString()} sq ft home`)
      const featuresText = featureParts.join(', ') || 'typical residential lot'

      // Log the targeting cohort on the record so response rate is measurable
      // per segment/score band (no schema change needed — kept in features).
      const cohort = [
        r.segment ? `segment=${r.segment}` : '',
        r.lead_score != null ? `score=${r.lead_score}` : '',
        r.mail_priority ? `wave=${r.mail_priority}` : '',
        r.income_band && r.income_band !== 'unknown' ? `income=${r.income_band}` : '',
      ].filter(Boolean).join(' ')
      const propertyFeatures = cohort ? `${featuresText} | ${cohort}` : featuresText

      const aiCopy = await generateAiCopy({
        featuresText,
        address: fullAddress,
        name: r.name !== 'Neighbor' ? r.name : undefined,
        letterType: 'general',
      })

      // Insert first (status 'pending') so the unique dedup index blocks
      // double-sends even across concurrent requests.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error: insertErr } = await (admin.from('letter_recipients') as any)
        .insert({
          name: r.name,
          address: r.address,
          city: r.city,
          state: r.state,
          zip: r.zip,
          source: 'area_blast',
          dedup_key: dedupKey,
          status: 'pending',
          lot_size: r.lot_sqft ? `${Math.round(r.lot_sqft).toLocaleString()} sq ft` : null,
          sq_footage: r.living_sqft ? `${Math.round(r.living_sqft).toLocaleString()} sq ft` : null,
          property_features: propertyFeatures,
          ai_copy: aiCopy,
          quote_amount: r.quote,
        })
        .select()
        .single()
      if (insertErr) {
        if (insertErr.code === '23505') {
          results.push({ address: r.address, success: false, error: 'Already contacted (duplicate)' })
          continue
        }
        throw new Error(insertErr.message)
      }

      const lobId = await sendLetterToLob(
        { id: row.id, name: r.name, address: r.address, city: r.city, state: r.state, zip: r.zip, ai_copy: aiCopy, quote_amount: r.quote },
        { phone, letterType: 'general', description: `Area blast ${r.zip} — ${r.address}` }
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('letter_recipients') as any)
        .update({ status: 'sent', lob_letter_id: lobId })
        .eq('id', row.id)
      results.push({ address: r.address, success: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Mark the row failed if it got inserted; harmless no-op otherwise.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('letter_recipients') as any)
        .update({ status: 'failed', error_message: msg.slice(0, 500) })
        .eq('dedup_key', normalizeAddress(r.address, r.zip))
        .eq('source', 'area_blast')
        .eq('status', 'pending')
      results.push({ address: r.address, success: false, error: msg })
    }
  }

  const sent = results.filter(r => r.success).length
  return NextResponse.json({ results, sent, failed: results.length - sent })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>
  const action = body.action
  if (action === 'preview') return preview(body)
  if (action === 'send') return send(body)
  return NextResponse.json({ error: 'action must be preview or send' }, { status: 400 })
}
