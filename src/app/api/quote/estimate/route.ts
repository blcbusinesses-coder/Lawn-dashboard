import { createAdminClient } from '@/lib/supabase/server'
import { lookupProperty } from '@/lib/property/lookup'
import { NextRequest, NextResponse } from 'next/server'

interface PricingTier      { max_sqft: number; price: number; label: string }
interface GrassRatioTier   { max_sqft: number; ratio: number; label: string }
interface FootprintEstTier { max_sqft: number; pct: number;   label: string }

const KENDALLVILLE_LAT = 41.4456
const KENDALLVILLE_LNG = -85.2650

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

async function geocodeAddress(address: string) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': 'GrayWolfWorkers/1.0', 'Accept-Language': 'en-US' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch { return null }
}

const CITY_SURCHARGE: Record<string, number> = {
  'kendallville':  0, 'albion': 0, 'avilla': 0,
  'rome city':     5, 'ligonier': 5, 'wolcottville': 5, 'garrett': 5,
  'howe':         10, 'lagrange': 10, 'auburn': 10,
  'angola':       15, 'columbia city': 15,
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { address } = body as { address: string }
  if (!address?.trim()) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const { data: settingsRows } = await adminClient.from('automation_settings').select('key, value')
  const settings: Record<string, unknown> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  const tiers: PricingTier[]              = (settings.pricing_tiers as PricingTier[]) ?? []
  const ratioTiers: GrassRatioTier[]      = (settings.grass_ratio_tiers as GrassRatioTier[]) ?? []
  const footprintTiers: FootprintEstTier[]= (settings.footprint_estimate_tiers as FootprintEstTier[]) ?? []
  const fallbackPrice: number             = (settings.fallback_price as number) ?? 25
  const overOneAcrePrice: number          = (settings.over_one_acre_price as number) ?? 130
  const apifyActor: string                = (settings.apify_actor as string) ?? 'maxcopell~zillow-detail-scraper'

  // Property lookup
  const propertyData = await lookupProperty(address.trim(), apifyActor)
  const lotSqft    = propertyData?.lotSizeSqft ?? null
  const livingSqft = propertyData?.squareFootage ?? null

  // Mowable area
  let mowableSqft: number | null = null
  let grassRatio: number | null = null
  let ratioLabel: string | null = null

  if (lotSqft && lotSqft > 0) {
    const sorted = [...ratioTiers].sort((a, b) => a.max_sqft - b.max_sqft)
    const t = sorted.find(t => lotSqft <= t.max_sqft) ?? sorted[sorted.length - 1]
    grassRatio = t?.ratio ?? 0.70
    ratioLabel = t?.label ?? 'estimate'
    const footprint = (() => {
      if (livingSqft && livingSqft > 0) return livingSqft
      const sortedFp = [...footprintTiers].sort((a, b) => a.max_sqft - b.max_sqft)
      const fp = sortedFp.find(f => lotSqft <= f.max_sqft) ?? sortedFp[sortedFp.length - 1]
      return Math.round(lotSqft * (fp?.pct ?? 0.20))
    })()
    mowableSqft = Math.round(Math.max(lotSqft - footprint, 0) * grassRatio)
  }

  // Base quote from tiers
  let basePrice = fallbackPrice
  let tierLabel = 'default estimate'
  if (mowableSqft && mowableSqft > 0) {
    const sorted = [...tiers].sort((a, b) => a.max_sqft - b.max_sqft)
    const t = sorted.find(t => mowableSqft! <= t.max_sqft)
    if (t) { basePrice = t.price; tierLabel = t.label }
    else    { basePrice = overOneAcrePrice; tierLabel = 'over 1 acre' }
  }

  // City surcharge
  const addrLower = address.toLowerCase()
  const matchedCity = Object.keys(CITY_SURCHARGE).find(c => addrLower.includes(c))
  const driveSurcharge = matchedCity != null ? CITY_SURCHARGE[matchedCity] : 0
  const totalPrice = basePrice + driveSurcharge

  // Distance (informational)
  let distanceMiles: number | null = null
  try {
    const coords = await geocodeAddress(address.trim())
    if (coords) {
      distanceMiles = Math.round(haversineDistance(
        KENDALLVILLE_LAT, KENDALLVILLE_LNG, coords.lat, coords.lon
      ) * 10) / 10
    }
  } catch { /* informational only */ }

  return NextResponse.json({
    address:        address.trim(),
    lot_size_sqft:  lotSqft,
    living_sqft:    livingSqft,
    mowable_sqft:   mowableSqft,
    grass_ratio:    grassRatio,
    ratio_label:    ratioLabel,
    base_price:     basePrice,
    tier_label:     tierLabel,
    drive_surcharge: driveSurcharge,
    detected_city:  matchedCity ?? null,
    distance_miles: distanceMiles,
    total_price:    totalPrice,
    confidence:     lotSqft ? 'measured' : 'estimate',
  })
}
