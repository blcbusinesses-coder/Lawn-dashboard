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

export const maxDuration = 60

interface RentCastRecord {
  addressLine1?: string
  city?: string
  state?: string
  zipCode?: string
  propertyType?: string
  lotSize?: number
  squareFootage?: number
  owner?: { names?: string[] }
  ownerOccupied?: boolean
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
}

async function loadSettings(): Promise<SettingsMap> {
  const admin = createServiceClient()
  const { data } = await admin.from('automation_settings').select('key, value')
  const settings: SettingsMap = {}
  for (const row of data ?? []) settings[row.key] = row.value
  return settings
}

// ── Preview ───────────────────────────────────────────────────────────────────

async function preview(body: Record<string, unknown>) {
  const zip = String(body.zip ?? '').trim().slice(0, 5)
  const count = Math.min(Math.max(Number(body.count) || 25, 1), 200)
  const targetQuote = Number(body.target_quote) || 50
  const minQuote = Number(body.min_quote) || targetQuote - 10
  const maxQuote = Number(body.max_quote) || targetQuote + 10

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'A 5-digit ZIP code is required' }, { status: 400 })
  }

  const apiKey = process.env.RENTCAST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RENTCAST_API_KEY is not configured' }, { status: 500 })
  }

  const settings = await loadSettings()
  const admin = createServiceClient()

  // One bulk pull per ZIP (max 500/request). Single-family only — we don't
  // want to mail apartment buildings or empty parcels.
  const url =
    `https://api.rentcast.io/v1/properties?zipCode=${zip}` +
    `&propertyType=${encodeURIComponent('Single Family')}&limit=500`
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
    return NextResponse.json({ candidates: [], scanned: 0, in_band: 0 })
  }

  // Price every record locally and keep the in-band ones.
  const inBand: BlastCandidate[] = []
  for (const r of records) {
    const street = (r.addressLine1 ?? '').trim()
    const city = (r.city ?? '').trim()
    if (!street) continue

    const lotSqft = typeof r.lotSize === 'number' && r.lotSize > 0 ? r.lotSize : null
    const livingSqft = typeof r.squareFootage === 'number' && r.squareFootage > 0 ? r.squareFootage : null
    // No lot size on record → can't price it honestly; skip rather than guess.
    if (!lotSqft) continue

    const fullAddress = `${street}, ${city}, ${r.state ?? 'IN'} ${zip}`
    const { quoteAmount } = computeQuote(lotSqft, livingSqft, fullAddress, settings)
    if (quoteAmount < minQuote || quoteAmount > maxQuote) continue

    const rawName = (r.owner?.names?.[0] ?? '').trim()
    const name = rawName && !looksLikeCompany(rawName) ? tidyName(rawName) : 'Neighbor'

    inBand.push({
      name,
      address: street,
      city,
      state: (r.state ?? 'IN').trim() || 'IN',
      zip,
      lot_sqft: lotSqft,
      living_sqft: livingSqft,
      quote: quoteAmount,
    })
  }

  // Drop anything we've ever queued/mailed before (any source).
  const dedupKeys = inBand.map(c => normalizeAddress(c.address, c.zip))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.from('letter_recipients') as any)
    .select('dedup_key')
    .in('dedup_key', dedupKeys)
  const seen = new Set((existing ?? []).map((r: { dedup_key: string }) => r.dedup_key))

  const candidates = inBand
    .filter(c => !seen.has(normalizeAddress(c.address, c.zip)))
    .slice(0, count)

  return NextResponse.json({
    candidates,
    scanned: records.length,
    in_band: inBand.length,
    already_contacted: inBand.length - candidates.length > 0
      ? inBand.filter(c => seen.has(normalizeAddress(c.address, c.zip))).length
      : 0,
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
    try {
      const featureParts: string[] = []
      if (r.lot_sqft)    featureParts.push(`${Math.round(r.lot_sqft).toLocaleString()} sq ft lot`)
      if (r.living_sqft) featureParts.push(`${Math.round(r.living_sqft).toLocaleString()} sq ft home`)
      const featuresText = featureParts.join(', ') || 'typical residential lot'

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
          dedup_key: normalizeAddress(r.address, r.zip),
          status: 'pending',
          lot_size: r.lot_sqft ? `${Math.round(r.lot_sqft).toLocaleString()} sq ft` : null,
          sq_footage: r.living_sqft ? `${Math.round(r.living_sqft).toLocaleString()} sq ft` : null,
          property_features: featuresText,
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
        { name: r.name, address: r.address, city: r.city, state: r.state, zip: r.zip, ai_copy: aiCopy, quote_amount: r.quote },
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
