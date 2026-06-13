import { createServiceClient } from '@/lib/supabase/server'
import { generateLetterContent } from '@/lib/letters/generate'
import { buildLetterHtml, formatQuote, type LetterType } from '@/lib/letters/templates'
import { getQuoteQrDataUri } from '@/lib/letters/qr'

// ── Geo helpers ───────────────────────────────────────────────────────────────

/** Convert EPSG:3857 (Web Mercator) meters → WGS84 lat/lng decimal degrees. */
export function mercatorToLatLng(x: number, y: number): { lat: number; lng: number } {
  const R = 20037508.34
  const lng = (x / R) * 180
  let lat = (y / R) * 180
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
  return { lat, lng }
}

export interface ParsedAddress {
  address: string  // street line, e.g. "703 E Mitchell St"
  city: string
  state: string
  zip: string
}

/**
 * Reverse-geocode lat/lng → mailing address. Uses Nominatim (OpenStreetMap,
 * free, no key) to match the rest of the app, with Google as a fallback when
 * GOOGLE_MAPS_API_KEY is set AND the Geocoding API is enabled for it.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ParsedAddress | null> {
  const nom = await reverseGeocodeNominatim(lat, lng)
  if (nom) return nom
  return reverseGeocodeGoogle(lat, lng)
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<ParsedAddress | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`,
      { headers: { 'User-Agent': 'GrayWolfWorkers/1.0', 'Accept-Language': 'en-US' }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      address?: Record<string, string>
    }
    const a = data.address
    if (!a) return null
    const street = [a.house_number, a.road].filter(Boolean).join(' ').trim()
    const city = a.city || a.town || a.village || a.hamlet || a.municipality || ''
    // Nominatim gives "US-IN"; fall back to full state name if missing.
    const iso = a['ISO3166-2-lvl4'] || ''
    const state = iso.includes('-') ? iso.split('-')[1] : (a.state || '')
    const zip = (a.postcode || '').slice(0, 5)
    if (!street || !zip) return null
    return { address: street, city, state, zip }
  } catch (err) {
    console.error('[letters/monitor] Nominatim reverse failed:', err)
    return null
  }
}

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<ParsedAddress | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`,
      { signal: AbortSignal.timeout(15_000) }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      status: string
      results: Array<{ address_components: Array<{ long_name: string; short_name: string; types: string[] }> }>
    }
    if (data.status !== 'OK' || !data.results?.length) return null
    const result =
      data.results.find(r => r.address_components.some(c => c.types.includes('street_number'))) ??
      data.results[0]
    const comp = (type: string, short = false) => {
      const c = result.address_components.find(c => c.types.includes(type))
      return c ? (short ? c.short_name : c.long_name) : ''
    }
    const street = [comp('street_number'), comp('route')].filter(Boolean).join(' ').trim()
    const city = comp('locality') || comp('sublocality') || comp('administrative_area_level_3')
    const state = comp('administrative_area_level_1', true)
    const zip = comp('postal_code')
    if (!street || !zip) return null
    return { address: street, city, state, zip }
  } catch (err) {
    console.error('[letters/monitor] Google reverse failed:', err)
    return null
  }
}

/** Normalized dedup key from a street line — lowercased, punctuation stripped. */
export function normalizeAddress(street: string, zip?: string): string {
  const base = street
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|circle|cir|place|pl|way|terrace|ter|trail|trl)\b/g, m => ({
      street: 'st', st: 'st', avenue: 'ave', ave: 'ave', road: 'rd', rd: 'rd',
      drive: 'dr', dr: 'dr', lane: 'ln', ln: 'ln', court: 'ct', ct: 'ct',
      boulevard: 'blvd', blvd: 'blvd', circle: 'cir', cir: 'cir', place: 'pl',
      pl: 'pl', way: 'way', terrace: 'ter', ter: 'ter', trail: 'trl', trl: 'trl',
    }[m] ?? m))
    .replace(/\b(north|n|south|s|east|e|west|w)\b/g, m => ({
      north: 'n', n: 'n', south: 's', s: 's', east: 'e', e: 'e', west: 'w', w: 'w',
    }[m] ?? m))
    .replace(/\s+/g, ' ')
    .trim()
  return zip ? `${base} ${zip.slice(0, 5)}` : base
}

// ── Queue helper ────────────────────────────────────────────────────────────

export interface QueueInput {
  source: 'violation' | 'new_homeowner'
  letterType: LetterType
  externalId: string | null
  name: string
  address: string
  city: string
  state: string
  zip: string
  /** When true, insert the address only (no Zillow/AI). Quote + copy are
   *  generated later, per-row, to stay within serverless time limits. */
  skipContent?: boolean
  /** Optional sweet-spot filter. When set (and content is generated), a
   *  recipient whose computed quote falls outside [min, max] is rejected
   *  ('out_of_band') instead of queued — so only ~target-price lawns get mail.
   *  Ignored when skipContent is true (no quote available yet). */
  quoteBand?: { min: number; max: number }
}

export type QueueResult = 'queued' | 'duplicate' | 'out_of_band' | 'error'

/**
 * Dedupes against existing letter_recipients rows (by source+external_id and
 * source+dedup_key) and inserts a 'review' row. With skipContent=false it also
 * generates the quote + AI copy. Never inserts a duplicate; never mails —
 * approval happens in the queue UI.
 */
export async function queueRecipient(input: QueueInput): Promise<QueueResult> {
  const admin = createServiceClient()
  const dedupKey = normalizeAddress(input.address, input.zip)

  // Dedup: external id OR normalized address already present for this source.
  const orClauses: string[] = [`dedup_key.eq.${dedupKey}`]
  if (input.externalId) orClauses.push(`external_id.eq.${input.externalId}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.from('letter_recipients') as any)
    .select('id')
    .eq('source', input.source)
    .or(orClauses.join(','))
    .limit(1)
  if (existing && existing.length > 0) return 'duplicate'

  try {
    const row: Record<string, unknown> = {
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      source: input.source,
      external_id: input.externalId,
      dedup_key: dedupKey,
      status: 'review',
    }

    if (!input.skipContent) {
      const content = await generateLetterContent({
        address: `${input.address}, ${input.city}, ${input.state} ${input.zip}`,
        name: input.name,
        letterType: input.letterType,
      })
      // Sweet-spot filter: only mail lawns whose quote lands in the target band.
      if (input.quoteBand) {
        const q = content.quote_amount
        if (q < input.quoteBand.min || q > input.quoteBand.max) return 'out_of_band'
      }
      row.lot_size = content.lot_size
      row.sq_footage = content.sq_footage
      row.property_features = content.features
      row.ai_copy = content.ai_copy
      row.quote_amount = content.quote_amount
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin.from('letter_recipients') as any).insert(row)
    if (error) {
      // Unique-index race → treat as duplicate, not error.
      if (error.code === '23505') return 'duplicate'
      console.error('[letters/monitor] queue insert failed:', error)
      return 'error'
    }
    return 'queued'
  } catch (err) {
    console.error('[letters/monitor] queueRecipient failed:', err)
    return 'error'
  }
}

// ── Lob send (used by the approval step) ──────────────────────────────────────

const FROM_ADDRESS = {
  name: 'Gray Wolf Workers',
  address_line1: '703 East Mitchell Street',
  address_city: 'Kendallville',
  address_state: 'IN',
  address_zip: '46755',
  address_country: 'US',
}

export interface SendableRecipient {
  name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  ai_copy: string | null
  quote_amount: number | null
}

/** Sends one letter via Lob. Returns the Lob letter id, or throws on failure. */
export async function sendLetterToLob(
  recipient: SendableRecipient,
  opts: { phone: string; letterType: LetterType; description: string }
): Promise<string | null> {
  const lobKey = process.env.LOB_API_KEY
  if (!lobKey) throw new Error('LOB_API_KEY not configured')
  if (!recipient.zip?.trim()) throw new Error('Missing ZIP code — Lob requires address_zip')

  const fileHtml = buildLetterHtml({
    name: recipient.name || 'Neighbor',
    aiCopy: recipient.ai_copy || '',
    quote: formatQuote(recipient.quote_amount || 35),
    phone: opts.phone,
    letterType: opts.letterType,
    qrDataUri: await getQuoteQrDataUri(),
  })

  const res = await fetch('https://api.lob.com/v1/letters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${lobKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      description: opts.description,
      to: {
        name: recipient.name || 'Homeowner',
        address_line1: recipient.address,
        address_city: recipient.city,
        address_state: recipient.state,
        address_zip: recipient.zip,
        address_country: 'US',
      },
      from: FROM_ADDRESS,
      file: fileHtml,
      color: true,
      double_sided: false,
      address_placement: 'top_first_page',
      mail_type: 'usps_first_class',
      use_type: 'marketing',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText.slice(0, 500))
  }
  const data = (await res.json()) as { id?: string }
  return data.id ?? null
}
