// ─── Census block-group median income (free, no key required) ────────────────
// Turns a property's lat/long into "is this block group above/at/below the
// county's median household income" — the S6 targeting signal. This is
// NEIGHBORHOOD income (block group), not the individual's income (that isn't
// public). Strong proxy, and it differentiates neighborhoods within one ZIP.
//
// Sources (both free): FCC Census Block API (lat/long → block-group GEOID) and
// the Census ACS5 API (median household income B19013_001E). A CENSUS_API_KEY
// is optional — ACS allows low-volume keyless use. Everything caches per
// process and degrades to "unknown" on any failure (never throws).

const ACS_YEARS = ['2023', '2022'] // try newest, fall back
const KEY = process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : ''

export type IncomeBand = 'above' | 'at' | 'below' | 'unknown'

// county 'SS|CCC' -> { median, byBG: GEOID12 -> income }
const countyCache = new Map<string, { median: number; byBG: Map<string, number> } | null>()
// rounded 'lat,lng' -> block-group GEOID12 (or null)
const bgCache = new Map<string, string | null>()

function valid(n: number | null | undefined): n is number {
  // ACS uses large negative sentinels (e.g. -666666666) for "no data".
  return typeof n === 'number' && n > 0
}

async function blockGroupForLatLng(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (bgCache.has(key)) return bgCache.get(key)!
  try {
    const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&format=json&showall=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) { bgCache.set(key, null); return null }
    const data = (await res.json()) as { Block?: { FIPS?: string } }
    const fips = data.Block?.FIPS
    const geoid12 = fips && fips.length >= 12 ? fips.slice(0, 12) : null
    bgCache.set(key, geoid12)
    return geoid12
  } catch {
    bgCache.set(key, null)
    return null
  }
}

async function loadCounty(state: string, county: string): Promise<{ median: number; byBG: Map<string, number> } | null> {
  const ck = `${state}|${county}`
  if (countyCache.has(ck)) return countyCache.get(ck)!
  for (const year of ACS_YEARS) {
    try {
      const base = `https://api.census.gov/data/${year}/acs/acs5?get=B19013_001E`
      // County median (one value).
      const cRes = await fetch(`${base}&for=county:${county}&in=state:${state}${KEY}`, { signal: AbortSignal.timeout(10000) })
      if (!cRes.ok) continue
      const cRows = (await cRes.json()) as string[][]
      const median = Number(cRows?.[1]?.[0])
      if (!valid(median)) continue
      // All block groups in the county.
      const bgRes = await fetch(`${base}&for=block%20group:*&in=state:${state}%20county:${county}%20tract:*${KEY}`, { signal: AbortSignal.timeout(15000) })
      if (!bgRes.ok) continue
      const bgRows = (await bgRes.json()) as string[][]
      const byBG = new Map<string, number>()
      // header row: [B19013_001E, state, county, tract, block group]
      for (let i = 1; i < bgRows.length; i++) {
        const [val, st, co, tr, bg] = bgRows[i]
        const inc = Number(val)
        if (valid(inc)) byBG.set(`${st}${co}${tr}${bg}`, inc)
      }
      const result = { median, byBG }
      countyCache.set(ck, result)
      return result
    } catch { /* try next year */ }
  }
  countyCache.set(ck, null)
  return null
}

/** Income band for a property's coordinates vs. its county median. */
export async function incomeBandForLatLng(lat: number | null, lng: number | null): Promise<IncomeBand> {
  // The Census ACS API requires a (free) key; without it, skip entirely so we
  // don't waste geocoding calls on income we can't resolve.
  if (!process.env.CENSUS_API_KEY) return 'unknown'
  if (lat == null || lng == null) return 'unknown'
  const geoid = await blockGroupForLatLng(lat, lng)
  if (!geoid) return 'unknown'
  const county = await loadCounty(geoid.slice(0, 2), geoid.slice(2, 5))
  if (!county) return 'unknown'
  const inc = county.byBG.get(geoid)
  if (!valid(inc)) return 'unknown'
  // "at" = within ±5% of county median.
  if (inc > county.median * 1.05) return 'above'
  if (inc < county.median * 0.95) return 'below'
  return 'at'
}

/** Run a list through incomeBandForLatLng with bounded concurrency. */
export async function incomeBandsBatch(
  coords: Array<{ lat: number | null; lng: number | null }>,
  concurrency = 6,
): Promise<IncomeBand[]> {
  const out: IncomeBand[] = new Array(coords.length).fill('unknown')
  let i = 0
  async function worker() {
    while (i < coords.length) {
      const idx = i++
      out[idx] = await incomeBandForLatLng(coords[idx].lat, coords[idx].lng)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, coords.length) }, worker))
  return out
}
