import { anthropic } from '@/lib/anthropic/client'
import { lookupProperty } from '@/lib/property/lookup'
import { createServiceClient } from '@/lib/supabase/server'
import type { LetterType } from '@/lib/letters/templates'

// Letter copywriter prompts. The body is 2-3 short paragraphs — the template
// adds the "Dear {name}," greeting, the quote callout, and the signature, so
// the AI must NOT include those.
const BASE_RULES = `Write the BODY of a short outreach letter for Gray Wolf Workers, a lawn care company in Kendallville, IN.
Rules:
- 2 to 3 short paragraphs, conversational and warm, local feel, no fluff, no emojis.
- Reference their specific property details naturally (lot size, home size, notable features) when available.
- Mention that a personalized lawn-care estimate is included.
- Warmly invite them to take advantage of our new-customer welcome offer (the details — first mow free when they stay their first month — appear in the highlighted box below, so do NOT restate the exact terms; just refer to it as a limited-time welcome offer for new customers).
- Do NOT write a greeting line (no "Dear ...") — that is added separately.
- Do NOT write a closing or signature — that is added separately.
- Do NOT state any dollar amount — the price shows separately.
- Do NOT use the homeowner's name in the body.
- Separate paragraphs with a blank line. Keep the whole thing under 110 words.`

export const SYSTEM_BY_TYPE: Record<LetterType, string> = {
  general: `${BASE_RULES}\nTone: friendly neighborhood lawn pro reaching out to offer service.`,
  new_homeowner: `${BASE_RULES}\nContext: this person recently bought this home. Open by warmly congratulating them on their new home and welcoming them to the area, then offer to take lawn care off their plate while they settle in.`,
  violation: `${BASE_RULES}\nContext: this property may have received a city notice about tall grass / weeds. Be tactful and helpful (never judgmental). Frame it as: we can get the lawn back in great shape quickly and keep it compliant and looking sharp going forward.`,
}

interface PricingTier      { max_sqft: number; price: number; label: string }
interface GrassRatioTier   { max_sqft: number; ratio: number; label: string }
interface FootprintEstTier { max_sqft: number; pct: number;   label: string }

export type SettingsMap = Record<string, unknown>

const CITY_SURCHARGE: Record<string, number> = {
  'kendallville': 0, 'albion': 0, 'avilla': 0,
  'rome city': 5, 'ligonier': 5, 'wolcottville': 5, 'garrett': 5,
  'howe': 10, 'lagrange': 10, 'auburn': 10,
  'angola': 15, 'columbia city': 15,
}

export interface LetterContent {
  lot_size: string | null
  sq_footage: string | null
  features: string
  ai_copy: string
  quote_amount: number
  letter_type: LetterType
}

const FALLBACK_COPY = `We provide professional lawn care across Kendallville and the surrounding area, and we'd love to take care of your lawn this season.\n\nWe keep things simple — no contracts, no hassle, just a sharp, well-kept lawn you can be proud of. A personalized estimate for your property is included below, along with a limited-time welcome offer for new customers.`

/**
 * Pure quote computation from lot/living sqft + automation_settings.
 * Same math as the /api/quote routes: mowable = (lot − footprint) × grass
 * ratio → pricing tier → + city surcharge from the address string.
 */
export function computeQuote(
  lotSqft: number | null,
  livingSqft: number | null,
  address: string,
  settings: SettingsMap
): { quoteAmount: number; mowableSqft: number | null } {
  const tiers: PricingTier[]               = (settings.pricing_tiers as PricingTier[]) ?? []
  const ratioTiers: GrassRatioTier[]       = (settings.grass_ratio_tiers as GrassRatioTier[]) ?? []
  const footprintTiers: FootprintEstTier[] = (settings.footprint_estimate_tiers as FootprintEstTier[]) ?? []
  const fallbackPrice: number              = (settings.fallback_price as number) ?? 50
  const overOneAcrePrice: number           = (settings.over_one_acre_price as number) ?? 160

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

  let basePrice = fallbackPrice
  if (mowableSqft && mowableSqft > 0) {
    const sorted = [...tiers].sort((a, b) => a.max_sqft - b.max_sqft)
    const t = sorted.find(t => mowableSqft! <= t.max_sqft)
    basePrice = t ? t.price : overOneAcrePrice
  }

  const addrLower = address.toLowerCase()
  const matchedCity = Object.keys(CITY_SURCHARGE).find(c => addrLower.includes(c))
  const driveSurcharge = matchedCity != null ? CITY_SURCHARGE[matchedCity] : 0
  return { quoteAmount: basePrice + driveSurcharge, mowableSqft }
}

/** Writes the AI letter body via Haiku. Falls back to canned copy on error. */
export async function generateAiCopy(opts: {
  featuresText: string
  address: string
  name?: string
  letterType: LetterType
}): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 320,
      system: SYSTEM_BY_TYPE[opts.letterType],
      messages: [{
        role: 'user',
        content: `Property details: ${opts.featuresText}. Address: ${opts.address.trim()}.${opts.name ? ` Homeowner: ${opts.name}.` : ''} Write the letter body now.`,
      }],
    })
    const block = msg.content[0]
    if (block.type === 'text' && block.text.trim()) return block.text.trim()
    return FALLBACK_COPY
  } catch (err) {
    console.error('[letters/generate] AI copy failed:', err)
    return FALLBACK_COPY
  }
}

/**
 * Scrapes the property (Zillow via Apify), computes a mowable-area quote from
 * automation_settings pricing tiers, and writes the AI letter body via Haiku.
 * Shared by the /api/letters/analyze route and the list monitors.
 */
export async function generateLetterContent(opts: {
  address: string
  name?: string
  letterType: LetterType
}): Promise<LetterContent> {
  const { address, name } = opts
  const letterType = opts.letterType

  const adminClient = createServiceClient()
  const { data: settingsRows } = await adminClient.from('automation_settings').select('key, value')
  const settings: Record<string, unknown> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value

  const apifyActor: string = (settings.apify_actor as string) ?? 'maxcopell~zillow-detail-scraper'

  // ── Property lookup (Zillow via Apify) ──────────────────────────────────────
  const propertyData = await lookupProperty(address.trim(), apifyActor)
  const lotSqft    = propertyData?.lotSizeSqft ?? null
  const livingSqft = propertyData?.squareFootage ?? null
  const bedrooms   = propertyData?.bedrooms ?? null
  const yearBuilt  = propertyData?.yearBuilt ?? null

  // ── Quote (shared engine) ───────────────────────────────────────────────────
  const { quoteAmount } = computeQuote(lotSqft, livingSqft, address, settings)

  // ── Feature description for the AI ──────────────────────────────────────────
  const featureParts: string[] = []
  if (lotSqft)    featureParts.push(`${Math.round(lotSqft).toLocaleString()} sq ft lot`)
  if (livingSqft) featureParts.push(`${Math.round(livingSqft).toLocaleString()} sq ft home`)
  if (bedrooms)   featureParts.push(`${bedrooms} bedrooms`)
  if (yearBuilt)  featureParts.push(`built in ${yearBuilt}`)
  const featuresText = featureParts.join(', ') || 'typical residential lot'

  // ── AI letter body via Claude Haiku ─────────────────────────────────────────
  const aiCopy = await generateAiCopy({ featuresText, address, name, letterType })

  return {
    lot_size: lotSqft ? `${Math.round(lotSqft).toLocaleString()} sq ft` : null,
    sq_footage: livingSqft ? `${Math.round(livingSqft).toLocaleString()} sq ft` : null,
    features: featuresText,
    ai_copy: aiCopy,
    quote_amount: quoteAmount,
    letter_type: letterType,
  }
}
