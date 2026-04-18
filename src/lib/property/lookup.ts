/**
 * Property data lookup via Apify.
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

export async function lookupProperty(
  address: string,
  actorId = 'maxcopell~zillow-detail-scraper'
): Promise<PropertyData | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) {
    console.warn('[property/lookup] APIFY_API_KEY not set — skipping property lookup')
    return null
  }

  // Apify API URLs require ~ as separator (not /)
  const actorSlug = actorId.replace('/', '~')
  console.log(`[property/lookup] actor=${actorSlug} address=${address}`)

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorSlug}/run-sync-get-dataset-items?token=${apiKey}&timeout=45&memory=256`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: [address],
          extractBuildingUnits: 'all',
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
    console.log('[property/lookup] raw item[0]:', JSON.stringify(items?.[0] ?? {}, null, 2))
    if (!items?.length) return null

    const item = items[0]

    // lotSize = sqft integer (e.g. 45302)
    // lotAreaValue = acres float (e.g. 1.04) — fallback if lotSize missing
    let lotSizeSqft: number | null = null
    const lotSizeDirect = item.lotSize as number | null
    const lotAreaAcres = item.lotAreaValue as number | null
    if (typeof lotSizeDirect === 'number' && lotSizeDirect > 0) {
      lotSizeSqft = Math.round(lotSizeDirect)
    } else if (typeof lotAreaAcres === 'number' && lotAreaAcres > 0) {
      lotSizeSqft = Math.round(lotAreaAcres * 43560)
    }

    return {
      lotSizeSqft,
      squareFootage: (item.livingArea ?? item.squareFootage) as number | null,
      bedrooms: (item.bedrooms ?? item.beds) as number | null,
      bathrooms: (item.bathrooms ?? item.baths) as number | null,
      zestimate: (item.zestimate ?? item.estimatedValue ?? item.estimated_value) as number | null,
      yearBuilt: (item.yearBuilt ?? item.year_built) as number | null,
      raw: item,
    }
  } catch (err) {
    console.error('[property/lookup] Lookup failed:', err)
    return null
  }
}
