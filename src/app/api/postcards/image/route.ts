import { NextRequest, NextResponse } from 'next/server'
import { SAMPLE_HOUSE_PHOTO } from '@/lib/postcards/templates'

/**
 * GET /api/postcards/image?address=ENCODED_ADDRESS
 *
 * Image proxy for Lob's renderer. Lob cannot directly fetch:
 *  - Google Street View (API key has HTTP-referrer restrictions)
 *  - Unsplash (blocks server-side hotlinking)
 *
 * Instead, Lob fetches this Vercel endpoint, which fetches the real
 * image server-side (no referrer issues) and streams it back.
 * Lob sees a simple public image URL — no Supabase Storage needed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  const gmapsKey = process.env.GOOGLE_MAPS_API_KEY

  if (address && gmapsKey) {
    const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=1350x900&location=${encodeURIComponent(address)}&key=${gmapsKey}`
    try {
      const res = await fetch(svUrl)
      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg'
        // Only forward actual images — Street View returns a JPEG placeholder
        // even for unknown addresses, so this check is always true
        if (contentType.startsWith('image/')) {
          const buffer = await res.arrayBuffer()
          return new Response(buffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=604800', // 7 days
            },
          })
        }
      }
    } catch {
      // fall through to sample photo
    }
  }

  // Fallback: fetch and proxy the sample lawn photo
  try {
    const res = await fetch(SAMPLE_HOUSE_PHOTO)
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      return new Response(buffer, {
        headers: {
          'Content-Type': res.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=604800',
        },
      })
    }
  } catch {
    // last resort
  }

  // If everything fails return a 1x1 transparent PNG
  return new Response(
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    { headers: { 'Content-Type': 'image/png' } },
  )
}
