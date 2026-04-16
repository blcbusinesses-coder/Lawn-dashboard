/**
 * Property data lookup via Apify (Zillow scraper).
 * Set APIFY_API_KEY in env to enable.
 * Falls back gracefully if unavailable.
 */

export interface PropertyData {
  lotSizeSqft: number | null
  squareFootage: number | null
  bedrooms: number | null
  bathrooms: number | null
  zestimate: number | null
  yearBuilt: number | null
  raw: Record<string, unknown>
}

function formatAddressForZillow(address: string): string {
  return address
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
}

export async function lookupProperty(
  address: string,
  actorId = 'maxcopell~zillow-scraper'
): Promise<PropertyData | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) {
    console.warn('[property/lookup] APIFY_API_KEY not set — skipping property lookup')
    return null
  }

  const zillowSlug = formatAddressForZillow(address)
  const zillowUrl = `https://www.zillow.com/homes/${zillowSlug}_rb/`

  console.log(`[property/lookup] actor=${actorId} url=${zillowUrl}`)

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiKey}&timeout=45&memory=256`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: zillowUrl }],
          type: 'url',
          maxItems: 3,
        }),
        signal: AbortSignal.timeout(50_000),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      console.error('[property/lookup] Apify error:', res.status, text)
      return null
    }

    const items: Record<string, unknown>[] = await res.json()
    console.log(`[property/lookup] got ${items?.length ?? 0} items`)
    if (!items?.length) return null

    // Return all items as raw so the automation dashboard can inspect them
    const item = items[0]

    // Extract lot size — handle sqft and acres
    let lotSizeSqft: number | null = null
    const lotVal = item.lotAreaValue as number | null
    const lotUnit = (item.lotAreaUnit as string | null)?.toLowerCase() ?? ''
    if (typeof lotVal === 'number' && lotVal > 0) {
      lotSizeSqft = lotUnit.includes('acre') ? Math.round(lotVal * 43560) : Math.round(lotVal)
    }

    return {
      lotSizeSqft,
      squareFootage: (item.livingArea as number | null) ?? (item.squareFootage as number | null) ?? null,
      bedrooms: (item.bedrooms as number | null) ?? null,
      bathrooms: (item.bathrooms as number | null) ?? null,
      zestimate: (item.zestimate as number | null) ?? null,
      yearBuilt: (item.yearBuilt as number | null) ?? null,
      raw: item,
    }
  } catch (err) {
    console.error('[property/lookup] Lookup failed:', err)
    return null
  }
}
