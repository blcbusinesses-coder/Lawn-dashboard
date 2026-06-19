import { anthropic } from '@/lib/anthropic/client'
import { lookupProperty } from '@/lib/property/lookup'
import { createServiceClient } from '@/lib/supabase/server'
import type { LetterType } from '@/lib/letters/templates'

// Letter copywriter prompts. This is a PERSONAL letter from the founder —
// first person, warm, human. The template adds the "Dear {name}," greeting and
// the signature, so the AI must NOT include those.
const BASE_RULES = `You are Beckitt Lowe, founder of Gray Wolf Workers, a small lawn-care company in Kendallville, Indiana. Write the BODY of a personal, first-person letter to ONE homeowner that follows the PROVEN TEMPLATE below very closely. Keep the same warmth, rhythm, and structure — only personalize the bracketed parts in paragraph 2. Do NOT add extra paragraphs, lists, or examples.

These facts are true; use them as written (do not change the numbers):
- Four years ago, when I was twelve, I mowed my first yard with a mower I bought on a loan from friends and family.
- Now I've got a crew of four and we take care of around thirty lawns here in Kendallville.

TEMPLATE — produce exactly 3 short paragraphs in this shape:

Paragraph 1 (keep this essentially verbatim, only tiny natural wording changes allowed):
"Four years ago, I was twelve and mowed my first yard with a mower I bought on a loan from friends and family. Now I've got a crew of four and we take care of around thirty lawns here in Kendallville, and I still get the same feeling every time we finish. There's nothing like seeing a property fresh-cut and edged, looking sharp and cared for."

Paragraph 2 (PERSONALIZE — this is the only paragraph that changes):
"That's why I wanted to reach out about your place over on [THEIR STREET]. [One warm, genuine sentence about their home or yard, grounded in the details provided — e.g. a classic older home, a big yard, a corner lot — never invent specifics you weren't given], and I figured your lawn would be [[QUOTE]]. A property like that deserves someone who takes real pride in the details, and that's exactly what we do."

Paragraph 3 (keep this essentially verbatim):
"We're at the point now where we're ready to take on more work, and I'd love to add your lawn to our route. New customers get twenty-five percent off the first month. The easiest way to lock in your price and pick your first day is to scan the QR code at the bottom of this letter — it'll just take a minute."

Hard rules:
- Keep paragraphs 1 and 3 nearly word-for-word as above. Personalize ONLY paragraph 2 (their street + one believable observation grounded in the property details).
- Put the price ONLY as the literal token [[QUOTE]] (it renders as e.g. "$110/mow"). Never write a dollar amount yourself, and use it exactly once.
- Use their STREET, never their name (the greeting already has the name).
- Warm, plain, natural English. No emojis, no buzzwords, no extra paragraphs, no sign-off or greeting.`

export const SYSTEM_BY_TYPE: Record<LetterType, string> = {
  general: `${BASE_RULES}`,
  new_homeowner: `${BASE_RULES}\nThey recently bought this home — in paragraph 2 only, you may warmly add a brief welcome/congratulations on the new place. Keep everything else to the template.`,
  violation: `${BASE_RULES}\nThis home may have gotten a city tall-grass notice — in paragraph 2 only, keep the observation gentle and never judgmental (frame it as getting the lawn back in great shape). Keep everything else to the template.`,
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

const FALLBACK_COPY = `Four years ago, I was twelve and mowed my first yard with a mower I bought on a loan from friends and family. Now I've got a crew of four and we take care of around thirty lawns here in Kendallville, and I still get the same feeling every time we finish. There's nothing like seeing a property fresh-cut and edged, looking sharp and cared for.\n\nThat's why I wanted to reach out about your place. I figured your lawn would be [[QUOTE]], and a property like yours deserves someone who takes real pride in the details, and that's exactly what we do.\n\nWe're at the point now where we're ready to take on more work, and I'd love to add your lawn to our route. New customers get twenty-five percent off the first month. The easiest way to lock in your price and pick your first day is to scan the QR code at the bottom of this letter — it'll just take a minute.`

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
  // Street name (first address segment) for the personal property reference.
  const street = opts.address.split(',')[0]?.replace(/^\s*\d+\s*/, '').trim() || ''

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 360,
      system: SYSTEM_BY_TYPE[opts.letterType],
      messages: [{
        role: 'user',
        content: `Their street: ${street || 'unknown'}. Property details: ${opts.featuresText}. Full address: ${opts.address.trim()}. Remember: weave in their street name, put [[QUOTE]] where the price goes, and write it as a personal note from me. Write the letter body now.`,
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
