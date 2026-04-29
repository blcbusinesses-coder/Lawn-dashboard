/**
 * POST /api/quote/lookup
 * Public endpoint — uses admin client.
 * Runs Apify scraper + same pricing engine as /api/leads/[id]/quote.
 * Returns quote data without creating a lead or sending SMS.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { lookupProperty } from '@/lib/property/lookup'
import { NextRequest, NextResponse } from 'next/server'

// ── Types ──────────────────────────────────────────────────────────────────────
interface PricingTier      { max_sqft: number; price: number; label: string }
interface GrassRatioTier   { max_sqft: number; ratio: number; label: string }
interface FootprintEstTier { max_sqft: number; pct: number;   label: string }
interface AddonOption      { key: string; label: string; price: number; description: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const KENDALLVILLE_LAT = 41.4456
const KENDALLVILLE_LNG = -85.2650

// ── Helpers (identical to /api/leads/[id]/quote) ───────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GrayWolfWorkers/1.0', 'Accept-Language': 'en-US,en' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch { return null }
}

function calculateMowableArea(
  lotSqft: number,
  livingSqft: number | null,
  ratioTiers: GrassRatioTier[],
  footprintTiers: FootprintEstTier[]
): { mowableSqft: number; grassRatio: number } {
  const sortedRatio = [...ratioTiers].sort((a, b) => a.max_sqft - b.max_sqft)
  const ratioTier  = sortedRatio.find((t) => lotSqft <= t.max_sqft) ?? sortedRatio[sortedRatio.length - 1]
  const grassRatio = ratioTier?.ratio ?? 0.70

  let footprint: number
  if (livingSqft && livingSqft > 0) {
    footprint = livingSqft
  } else {
    const sortedFp = [...footprintTiers].sort((a, b) => a.max_sqft - b.max_sqft)
    const fpTier   = sortedFp.find((t) => lotSqft <= t.max_sqft) ?? sortedFp[sortedFp.length - 1]
    footprint      = Math.round(lotSqft * (fpTier?.pct ?? 0.20))
  }

  const mowableSqft = Math.round(Math.max(lotSqft - footprint, 0) * grassRatio)
  return { mowableSqft, grassRatio }
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

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { address } = await request.json()
  if (!address?.trim()) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Load settings from DB (same source as automation)
  const { data: settingsRows } = await admin.from('automation_settings').select('key, value')
  const settings: Record<string, unknown> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  const tiers: PricingTier[]               = (settings.pricing_tiers as PricingTier[]) ?? []
  const ratioTiers: GrassRatioTier[]       = (settings.grass_ratio_tiers as GrassRatioTier[]) ?? []
  const footprintTiers: FootprintEstTier[] = (settings.footprint_estimate_tiers as FootprintEstTier[]) ?? []
  const fallbackPrice: number              = (settings.fallback_price as number) ?? 55
  const overOneAcrePrice: number           = (settings.over_one_acre_price as number) ?? 165
  const apifyActor: string                 = (settings.apify_actor as string) ?? 'maxcopell~zillow-detail-scraper'
  const surchargeThreshold: number         = (settings.drive_surcharge_miles as number) ?? 12
  const surchargeAmount: number            = (settings.drive_surcharge_amount as number) ?? 5
  const addons: AddonOption[]              = (settings.quote_addons as AddonOption[]) ?? []

  // 1. Property lookup via Apify (same scraper as automation)
  const propertyData = await lookupProperty(address.trim(), apifyActor)
  const lotSqft      = propertyData?.lotSizeSqft ?? null
  const livingSqft   = propertyData?.squareFootage ?? null

  // 2. Calculate mowable area
  let mowableSqft: number | null = null
  if (lotSqft && lotSqft > 0) {
    const result = calculateMowableArea(lotSqft, livingSqft, ratioTiers, footprintTiers)
    mowableSqft  = result.mowableSqft
  }

  // 3. Base price from same tier logic
  const baseQuote = calculateQuoteFromTiers(mowableSqft, tiers, fallbackPrice, overOneAcrePrice)

  // 4. Distance surcharge
  let driveSurcharge = 0
  try {
    const coords = await geocodeAddress(address.trim())
    if (coords) {
      const miles = haversineDistance(KENDALLVILLE_LAT, KENDALLVILLE_LNG, coords.lat, coords.lon)
      if (miles > surchargeThreshold) driveSurcharge = surchargeAmount
    }
  } catch { /* no surcharge */ }

  return NextResponse.json({
    lot_size_sqft:  lotSqft,
    mowable_sqft:   mowableSqft,
    base_price:     baseQuote.amount + driveSurcharge,
    confidence:     baseQuote.confidence,
    tier:           baseQuote.tier,
    drive_surcharge: driveSurcharge,
    addons,          // pass addons from settings to the client
  })
}
