// ─── Census block-group median income ────────────────────────────────────────
// Turns a property's lat/long into "is this block group above/at/below the
// county's median household income" — the S6 targeting signal. This is
// NEIGHBORHOOD income (block group), not the individual's income (not public).
//
// Sources (both free): FCC Census Block API (lat/long → block-group GEOID) and
// the Census ACS5 API (median household income B19013_001E). The ACS API
// requires a free CENSUS_API_KEY. Everything caches per process and degrades to
// "unknown" on any failure (never throws). The last Census error is captured
// (getCensusDebug) so the UI can surface exactly what went wrong.

const ACS_YEARS = ['2023', '2022', '2021'] // newest first, fall back

export type IncomeBand = 'above' | 'at' | 'below' | 'unknown'
export interface IncomeDetail { income: number | null; countyMedian: number | null; band: IncomeBand }

function key(): string {
  // Read at CALL time (not module load) so the deployed env is always seen.
  // Trim whitespace and stray surrounding quotes (common paste mistakes).
  const k = process.env.CENSUS_API_KEY?.trim().replace(/^["']|["']$/g, '')
  return k ? `&key=${k}` : ''
}

let lastError: string | null = null
export function getCensusDebug(): string | null { return lastError }

const bgCache = new Map<string, string | null>()        // 'lat,lng' → GEOID12
const bgIncomeCache = new Map<string, number | null>()  // GEOID12  → income
const countyMedianCache = new Map<string, number | null>() // 'st|co' → median

function valid(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 // ACS uses -666666666 for "no data"
}

async function blockGroupForLatLng(lat: number, lng: number): Promise<string | null> {
  const ck = `${lat.toFixed(5)},${lng.toFixed(5)}`
  if (bgCache.has(ck)) return bgCache.get(ck)!
  try {
    const url = `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&format=json&showall=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) { lastError = `FCC HTTP ${res.status}`; bgCache.set(ck, null); return null }
    const data = (await res.json()) as { Block?: { FIPS?: string } }
    const fips = data.Block?.FIPS
    const geoid12 = fips && fips.length >= 12 ? fips.slice(0, 12) : null
    if (!geoid12) lastError = 'FCC: no block FIPS for coords'
    bgCache.set(ck, geoid12)
    return geoid12
  } catch (e) {
    lastError = `FCC: ${e instanceof Error ? e.message : String(e)}`
    bgCache.set(ck, null)
    return null
  }
}

/** Fetch ACS rows, detecting HTML error pages (e.g. missing/invalid key). */
async function acsRows(url: string): Promise<string[][] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const text = await res.text()
    if (!res.ok) { lastError = `ACS HTTP ${res.status}: ${text.slice(0, 120)}`; return null }
    if (text.trimStart().startsWith('<')) { lastError = `ACS returned HTML (key/format issue): ${text.replace(/\s+/g, ' ').slice(0, 140)}`; return null }
    return JSON.parse(text) as string[][]
  } catch (e) {
    lastError = `ACS: ${e instanceof Error ? e.message : String(e)}`
    return null
  }
}

async function countyMedian(state: string, county: string): Promise<number | null> {
  const ck = `${state}|${county}`
  if (countyMedianCache.has(ck)) return countyMedianCache.get(ck)!
  for (const year of ACS_YEARS) {
    const rows = await acsRows(`https://api.census.gov/data/${year}/acs/acs5?get=B19013_001E&for=county:${county}&in=state:${state}${key()}`)
    const m = Number(rows?.[1]?.[0])
    if (valid(m)) { countyMedianCache.set(ck, m); return m }
  }
  countyMedianCache.set(ck, null)
  return null
}

async function blockGroupIncome(geoid12: string): Promise<number | null> {
  if (bgIncomeCache.has(geoid12)) return bgIncomeCache.get(geoid12)!
  const state = geoid12.slice(0, 2), county = geoid12.slice(2, 5)
  const tract = geoid12.slice(5, 11), bg = geoid12.slice(11, 12)
  for (const year of ACS_YEARS) {
    // Canonical single-block-group query (specifying the tract — the wildcard
    // "tract:*" form is rejected by the API).
    const rows = await acsRows(`https://api.census.gov/data/${year}/acs/acs5?get=B19013_001E&for=block%20group:${bg}&in=state:${state}%20county:${county}%20tract:${tract}${key()}`)
    const inc = Number(rows?.[1]?.[0])
    if (valid(inc)) { bgIncomeCache.set(geoid12, inc); return inc }
  }
  bgIncomeCache.set(geoid12, null)
  return null
}

/** Full income detail (raw value + band) for a property's coordinates. */
export async function incomeDetailForLatLng(lat: number | null, lng: number | null): Promise<IncomeDetail> {
  if (!process.env.CENSUS_API_KEY) { lastError = 'CENSUS_API_KEY not set'; return { income: null, countyMedian: null, band: 'unknown' } }
  if (lat == null || lng == null) return { income: null, countyMedian: null, band: 'unknown' }
  const geoid = await blockGroupForLatLng(lat, lng)
  if (!geoid) return { income: null, countyMedian: null, band: 'unknown' }
  const [median, inc] = await Promise.all([
    countyMedian(geoid.slice(0, 2), geoid.slice(2, 5)),
    blockGroupIncome(geoid),
  ])
  if (!valid(inc) || !valid(median)) return { income: inc ?? null, countyMedian: median ?? null, band: 'unknown' }
  const band: IncomeBand = inc > median * 1.05 ? 'above' : inc < median * 0.95 ? 'below' : 'at'
  return { income: inc, countyMedian: median, band }
}

export async function incomeBandForLatLng(lat: number | null, lng: number | null): Promise<IncomeBand> {
  return (await incomeDetailForLatLng(lat, lng)).band
}

async function runBatch<R>(
  coords: Array<{ lat: number | null; lng: number | null }>,
  fn: (lat: number | null, lng: number | null) => Promise<R>,
  fallback: R,
  concurrency: number,
): Promise<R[]> {
  const out: R[] = new Array(coords.length).fill(fallback)
  let i = 0
  async function worker() {
    while (i < coords.length) {
      const idx = i++
      out[idx] = await fn(coords[idx].lat, coords[idx].lng)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(coords.length, 1)) }, worker))
  return out
}

export function incomeBandsBatch(coords: Array<{ lat: number | null; lng: number | null }>, concurrency = 6): Promise<IncomeBand[]> {
  return runBatch(coords, incomeBandForLatLng, 'unknown', concurrency)
}

export function incomeDetailsBatch(coords: Array<{ lat: number | null; lng: number | null }>, concurrency = 8): Promise<IncomeDetail[]> {
  return runBatch(coords, incomeDetailForLatLng, { income: null, countyMedian: null, band: 'unknown' }, concurrency)
}
