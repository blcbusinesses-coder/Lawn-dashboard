import { anthropic } from '@/lib/anthropic/client'
import { lookupProperty } from '@/lib/property/lookup'
import { createServiceClient } from '@/lib/supabase/server'
import type { LetterType } from '@/lib/letters/templates'

// Letter copywriter prompts. This is a PERSONAL letter from the founder —
// first person, warm, human. The template adds the "Dear {name}," greeting and
// the signature, so the AI must NOT include those.
const BASE_RULES = `You are the founder of Gray Wolf Workers, a small, locally-owned lawn-care company in Kendallville, Indiana. Write the BODY of a short, personal letter to ONE homeowner, in FIRST PERSON ("I", "me", "my"), as if you sat down and wrote it yourself.
Rules:
- Warm, genuine, human — like a handwritten note from a neighbor, NOT an ad or a flyer. No corporate or salesy language, no buzzwords, no emojis, no exclamation-point spam.
- Exactly 3 short paragraphs:
  1. A warm, personal opening: why I started Gray Wolf Workers, that I genuinely love taking care of lawns, and a local/neighborly note. Make it feel real, not templated.
  2. A natural mention of THEIR place: reference their street by name and any property details (lot/home size) when given, and weave in their price as something I noticed. Put the token ${'`[[QUOTE]]`'} EXACTLY where the price belongs — do NOT write a dollar figure yourself. Shape it like: "I had a look at your lawn over on Maple Street and figured it would run about [[QUOTE]]."
  3. Mention once, lightly, that new customers get 25% off their first month, and warmly invite them to get started.
- Use the token [[QUOTE]] EXACTLY ONCE. Never write a "$" amount yourself.
- Do NOT use the homeowner's NAME in the body (the greeting already has it). DO use their street name.
- Plain, natural spoken English — read every sentence back so nothing is awkward or mixed up.
- Do NOT write a greeting ("Dear ...") or any sign-off/signature — those are added separately.
- Separate paragraphs with a blank line. Keep the whole thing under 140 words.`

export const SYSTEM_BY_TYPE: Record<LetterType, string> = {
  general: `${BASE_RULES}\nTone: a real local lawn-care owner writing to a neighbor he'd like to work for.`,
  new_homeowner: `${BASE_RULES}\nContext: this person recently bought this home. Open by warmly congratulating them on the new home and welcoming them to the area, then offer to take lawn care off their plate while they get settled.`,
  violation: `${BASE_RULES}\nContext: this property may have gotten a city notice about tall grass or weeds. Be tactful and kind, never judgmental — frame it as: I'd be glad to get the lawn back in great shape fast and keep it looking sharp and compliant going forward.`,
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

const FALLBACK_COPY = `I started Gray Wolf Workers right here in Kendallville because I genuinely love taking care of lawns and looking out for my neighbors. There's nothing like the look of a yard that's been mowed and edged right.\n\nI had a look at your property and figured your lawn would run about [[QUOTE]] a mow. I keep things simple — no contracts, no hassle, just a sharp lawn you can be proud of.\n\nNew customers get 25% off their first month, and I'd love the chance to earn your business. Scan the code below or give me a call and I'll get you on the schedule.`

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
