/**
 * Owner-name lookup via RentCast.
 * Set RENTCAST_API_KEY in env to enable.
 *
 * RentCast's /properties endpoint returns public-record data (incl. the
 * owner-of-record name) keyed by mailing address. We use it to personalize
 * outreach letters instead of mailing "New Neighbor".
 *
 * Free tier = 50 requests/month, then per-request overage on paid plans.
 * Falls back gracefully (returns null) if the key is missing, the address
 * isn't found, or the owner looks like a company/trust rather than a person.
 */

const COMPANY_HINTS = [
  'llc', 'inc', 'incorporated', 'corp', 'corporation', 'trust', 'trustee',
  'company', ' co ', 'ltd', 'l.p', 'lp', 'llp', 'foundation', 'partners',
  'properties', 'holdings', 'estate of', 'bank', 'church', 'ministries',
]

/** Title-case a SHOUTING public-record name: "SMITH, JOHN A" → "John A Smith". */
function tidyName(raw: string): string {
  let s = raw.trim()
  // Public records are often "LAST, FIRST MIDDLE" — flip to "FIRST MIDDLE LAST".
  if (s.includes(',')) {
    const [last, rest] = s.split(',', 2)
    s = `${rest.trim()} ${last.trim()}`.trim()
  }
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeCompany(name: string): boolean {
  const padded = ` ${name.toLowerCase()} `
  return COMPANY_HINTS.some((h) => padded.includes(h))
}

/**
 * Returns a friendly owner name for the given full address, or null when no
 * usable individual name is available (missing key, not found, or a company).
 */
export async function lookupOwnerName(address: string): Promise<string | null> {
  const apiKey = process.env.RENTCAST_API_KEY
  if (!apiKey) {
    console.warn('[property/owner] RENTCAST_API_KEY not set — skipping owner lookup')
    return null
  }

  try {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address.trim())}`
    const res = await fetch(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.error('[property/owner] RentCast error:', res.status, (await res.text()).slice(0, 200))
      return null
    }

    // /properties returns an array of matches (or a single object).
    const body = (await res.json()) as unknown
    const record = (Array.isArray(body) ? body[0] : body) as
      | { owner?: { names?: unknown; name?: unknown }; ownerName?: unknown }
      | undefined
    if (!record) return null

    // Owner name can arrive as owner.names[], owner.name, or top-level ownerName.
    const owner = record.owner ?? {}
    let rawName = ''
    if (Array.isArray(owner.names) && owner.names.length) {
      rawName = String(owner.names[0] ?? '')
    } else if (typeof owner.name === 'string') {
      rawName = owner.name
    } else if (typeof record.ownerName === 'string') {
      rawName = record.ownerName
    }

    rawName = rawName.trim()
    if (!rawName || looksLikeCompany(rawName)) return null

    const tidy = tidyName(rawName)
    return tidy || null
  } catch (err) {
    console.error('[property/owner] lookup failed:', err)
    return null
  }
}
