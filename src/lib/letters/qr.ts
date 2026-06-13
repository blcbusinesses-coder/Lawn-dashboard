// Server-only QR helper for outreach letters. Generates a data-URI PNG so the
// letter HTML stays self-contained — Lob's renderer is unreliable fetching
// external images, but data URIs always render.

import QRCode from 'qrcode'

const QUOTE_URL = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://graywolfworkers.com'}/get-a-quote`

let cached: string | null = null

/** Data-URI QR code pointing at the instant-quote page. Cached per process. */
export async function getQuoteQrDataUri(): Promise<string | null> {
  if (cached) return cached
  try {
    cached = await QRCode.toDataURL(QUOTE_URL, { margin: 0, width: 200, errorCorrectionLevel: 'M' })
    return cached
  } catch (err) {
    console.error('[letters/qr] QR generation failed:', err)
    return null
  }
}
