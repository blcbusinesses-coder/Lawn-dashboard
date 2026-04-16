/**
 * Lawn mowing quote calculator.
 * Adjust TIERS to change pricing for Gray Wolf Workers.
 */

const TIERS = [
  { maxSqft: 2_500,  price: 35 },
  { maxSqft: 4_000,  price: 45 },
  { maxSqft: 6_000,  price: 55 },
  { maxSqft: 9_000,  price: 65 },
  { maxSqft: 12_000, price: 80 },
  { maxSqft: 20_000, price: 100 },
  { maxSqft: 43_560, price: 130 },  // up to 1 acre
]
const OVER_ONE_ACRE_PRICE = 165
const FALLBACK_PRICE = 55  // used when lot size is unknown

export interface QuoteResult {
  amount: number
  confidence: 'measured' | 'estimate'
  lotSizeSqft: number | null
  tier: string
}

export function calculateQuote(lotSizeSqft: number | null): QuoteResult {
  if (lotSizeSqft === null || lotSizeSqft <= 0) {
    return {
      amount: FALLBACK_PRICE,
      confidence: 'estimate',
      lotSizeSqft: null,
      tier: 'unknown lot — default estimate',
    }
  }

  for (const tier of TIERS) {
    if (lotSizeSqft <= tier.maxSqft) {
      return {
        amount: tier.price,
        confidence: 'measured',
        lotSizeSqft,
        tier: `up to ${tier.maxSqft.toLocaleString()} sqft`,
      }
    }
  }

  return {
    amount: OVER_ONE_ACRE_PRICE,
    confidence: 'measured',
    lotSizeSqft,
    tier: 'over 1 acre',
  }
}
