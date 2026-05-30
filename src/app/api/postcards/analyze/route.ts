import { anthropic } from '@/lib/anthropic/client'
import { lookupProperty } from '@/lib/property/lookup'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const SYSTEM_PROMPT = `You are a direct mail copywriter for Gray Wolf Workers, a lawn care company in Kendallville, IN.
Write 2-3 short, conversational sentences for a postcard addressed to a homeowner.
Reference their specific property details naturally (lot size, home size, any notable features).
Mention that the lawn service quote is included. Friendly, local, no fluff, no emojis.
Do NOT include the dollar amount — that shows separately. Do NOT use their name — we address them separately.
Keep it under 60 words total.`

interface PricingTier      { max_sqft: number; price: number; label: string }
interface GrassRatioTier   { max_sqft: number; ratio: number; label: string }
interface FootprintEstTier { max_sqft: number; pct: number;   label: string }

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
  'kendallville': 0, 'albion': 0, 'avilla': 0,
  'rome city': 5, 'ligonier': 5, 'wolcottville': 5, 'garrett': 5,
  'howe': 10, 'lagrange': 10, 'auburn': 10,
  'angola': 15, 'columbia city': 15,
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { address, name } = body as { address: string; name?: string }

  if (!address?.trim()) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const { data: settingsRows } = await adminClient.from('automation_settings').select('key, value')
  const settings: Record<string, unknown> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  const tiers: PricingTier[]               = (settings.pricing_tiers as PricingTier[]) ?? []
  const ratioTiers: GrassRatioTier[]       = (settings.grass_ratio_tiers as GrassRatioTier[]) ?? []
  const footprintTiers: FootprintEstTier[] = (settings.footprint_estimate_tiers as FootprintEstTier[]) ?? []
  const fallbackPrice: number              = (settings.fallback_price as number) ?? 25
  const overOneAcrePrice: number           = (settings.over_one_acre_price as number) ?? 130
  const apifyActor: string                 = (settings.apify_actor as string) ?? 'maxcopell~zillow-detail-scraper'

  // Property lookup
  const propertyData = await lookupProperty(address.trim(), apifyActor)
  const lotSqft    = propertyData?.lotSizeSqft ?? null
  const livingSqft = propertyData?.squareFootage ?? null
  const bedrooms   = propertyData?.bedrooms ?? null
  const yearBuilt  = propertyData?.yearBuilt ?? null

  // Mowable area
  let mowableSqft: number | null = null

  if (lotSqft && lotSqft > 0) {
    const sorted = [...ratioTiers].sort((a, b) => a.max_sqft - b.max_sqft)
    const t = sorted.find(t => lotSqft <= t.max_sqft) ?? sorted[sorted.length - 1]
    const grassRatio = t?.ratio ?? 0.70
    const footprint = (() => {
      if (livingSqft && livingSqft > 0) return livingSqft
      const sortedFp = [...footprintTiers].sort((a, b) => a.max_sqft - b.max_sqft)
      const fp = sortedFp.find(f => lotSqft <= f.max_sqft) ?? sortedFp[sortedFp.length - 1]
      return Math.round(lotSqft * (fp?.pct ?? 0.20))
    })()
    mowableSqft = Math.round(Math.max(lotSqft - footprint, 0) * grassRatio)
  }

  // Base quote
  let basePrice = fallbackPrice
  if (mowableSqft && mowableSqft > 0) {
    const sorted = [...tiers].sort((a, b) => a.max_sqft - b.max_sqft)
    const t = sorted.find(t => mowableSqft! <= t.max_sqft)
    basePrice = t ? t.price : overOneAcrePrice
  }

  const addrLower = address.toLowerCase()
  const matchedCity = Object.keys(CITY_SURCHARGE).find(c => addrLower.includes(c))
  const driveSurcharge = matchedCity != null ? CITY_SURCHARGE[matchedCity] : 0
  const quoteAmount = basePrice + driveSurcharge

  // Geocode for nearby calc
  const coords = await geocodeAddress(address.trim())

  // Build feature description for AI
  const featureParts: string[] = []
  if (lotSqft)    featureParts.push(`${Math.round(lotSqft).toLocaleString()} sq ft lot`)
  if (livingSqft) featureParts.push(`${Math.round(livingSqft).toLocaleString()} sq ft home`)
  if (bedrooms)   featureParts.push(`${bedrooms} bedrooms`)
  if (yearBuilt)  featureParts.push(`built in ${yearBuilt}`)
  const featuresText = featureParts.join(', ') || 'typical residential lot'

  // AI copy via Claude Haiku
  let aiCopy = ''
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Property details: ${featuresText}. Address: ${address.trim()}.${name ? ` Homeowner: ${name}.` : ''} Write the postcard copy now.`,
      }],
    })
    const block = msg.content[0]
    if (block.type === 'text') aiCopy = block.text.trim()
  } catch (err) {
    console.error('[postcards/analyze] AI copy failed:', err)
    aiCopy = `Your property at ${address.trim()} looks like a great fit for our lawn service. We mow lawns all across Kendallville and would love to take care of yours. Your personalized quote is included on this card.`
  }

  // Fetch Street View image now and store in Supabase so Lob has a stable URL at send time
  let streetViewUrl: string | null = null
  const gmapsKey = process.env.GOOGLE_MAPS_API_KEY
  if (gmapsKey) {
    try {
      const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=1350x900&location=${encodeURIComponent(address.trim())}&key=${gmapsKey}`
      const svRes = await fetch(svUrl)
      if (svRes.ok) {
        const contentType = svRes.headers.get('content-type') || 'image/jpeg'
        if (contentType.startsWith('image/')) {
          const arrayBuffer = await svRes.arrayBuffer()
          const safeName = address.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 60)
          const filePath = `sv/${Date.now()}-${safeName}.jpg`
          const { data: uploadData, error: uploadErr } = await adminClient.storage
            .from('postcard-images')
            .upload(filePath, arrayBuffer, { contentType, upsert: true })
          if (uploadErr) {
            console.error('[analyze] Street View storage upload failed:', uploadErr.message)
          } else if (uploadData) {
            const { data: urlData } = adminClient.storage
              .from('postcard-images')
              .getPublicUrl(uploadData.path)
            streetViewUrl = urlData?.publicUrl ?? null
          }
        }
      }
    } catch (err) {
      console.error('[analyze] Street View fetch/upload error:', err)
    }
  }

  return NextResponse.json({
    lot_size: lotSqft ? `${Math.round(lotSqft).toLocaleString()} sq ft` : null,
    sq_footage: livingSqft ? `${Math.round(livingSqft).toLocaleString()} sq ft` : null,
    features: featuresText,
    ai_copy: aiCopy,
    quote_amount: quoteAmount,
    coords,
    street_view_url: streetViewUrl,
  })
}
