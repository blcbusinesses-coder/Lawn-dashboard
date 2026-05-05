import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const key = process.env.GOOGLE_MAPS_STATIC_KEY

  if (!key) {
    // Fallback: redirect to Google Maps satellite view (user opens in browser)
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    return NextResponse.redirect(mapsUrl)
  }

  // Proxy the Google Static Maps satellite image (keeps API key server-side)
  const params = new URLSearchParams({
    center: address,
    zoom: '19',
    size: '600x350',
    maptype: 'satellite',
    markers: `color:red|${address}`,
    key,
  })
  const googleUrl = `https://maps.googleapis.com/maps/api/staticmap?${params}`

  const res = await fetch(googleUrl)
  if (!res.ok) {
    return NextResponse.json({ error: 'satellite image unavailable' }, { status: 502 })
  }

  const body = await res.arrayBuffer()
  return new NextResponse(body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
