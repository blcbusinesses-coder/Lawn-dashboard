// Server-only QR helper for outreach letters. Generates a data-URI PNG so the
// letter HTML stays self-contained — Lob's renderer is unreliable fetching
// external images, but data URIs always render.
//
// The QR encodes a per-recipient link to the scheduling page, pre-loaded with
// their quote (and name/address) so scanning drops them straight onto the
// calendar already knowing their price.

import QRCode from 'qrcode'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://graywolfworkers.com'

export interface ScheduleQrParams {
  quote?: number | null
  name?: string | null
  street?: string | null
  city?: string | null
  zip?: string | null
  /** letter_recipients row id, so a QR booking ties back to this exact record. */
  recipientId?: string | null
}

// Cache by encoded URL so identical recipients don't re-render.
const cache = new Map<string, string>()

function buildScheduleUrl(p: ScheduleQrParams): string {
  const qs = new URLSearchParams()
  if (p.recipientId?.trim()) qs.set('rid', p.recipientId.trim())
  if (p.quote != null && p.quote > 0) qs.set('quote', String(Math.round(p.quote)))
  if (p.name?.trim())   qs.set('name', p.name.trim())
  if (p.street?.trim()) qs.set('street', p.street.trim())
  if (p.city?.trim())   qs.set('city', p.city.trim())
  if (p.zip?.trim())    qs.set('zip', p.zip.trim())
  const q = qs.toString()
  return q ? `${SITE}/schedule?${q}` : `${SITE}/schedule`
}

/** Data-URI QR code to the scheduling page, pre-loaded with this recipient's
 *  quote. Returns null on failure (the letter still renders without it). */
export async function getScheduleQrDataUri(params: ScheduleQrParams = {}): Promise<string | null> {
  const url = buildScheduleUrl(params)
  const hit = cache.get(url)
  if (hit) return hit
  try {
    const dataUri = await QRCode.toDataURL(url, { margin: 0, width: 220, errorCorrectionLevel: 'M' })
    cache.set(url, dataUri)
    return dataUri
  } catch (err) {
    console.error('[letters/qr] QR generation failed:', err)
    return null
  }
}
