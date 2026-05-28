import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`,
      {
        headers: { 'User-Agent': 'GrayWolfWorkers/1.0', 'Accept-Language': 'en-US' },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  let { lat, lng, address } = body as { lat?: number; lng?: number; address?: string }

  // Geocode if coords not provided
  if ((lat == null || lng == null) && address) {
    const coords = await geocodeAddress(address)
    if (coords) {
      lat = coords.lat
      lng = coords.lon
    }
  }

  if (lat == null || lng == null) {
    return NextResponse.json({ count: 0, error: 'Could not resolve coordinates' })
  }

  const adminClient = await createAdminClient()
  const { data: customers } = await adminClient
    .from('customers')
    .select('address')

  if (!customers?.length) return NextResponse.json({ count: 0 })

  let nearbyCount = 0
  for (const customer of customers) {
    if (!customer.address) continue
    const coords = await geocodeAddress(customer.address)
    if (!coords) continue
    const dist = haversineDistance(lat, lng, coords.lat, coords.lon)
    if (dist <= 0.25) nearbyCount++
  }

  return NextResponse.json({ count: nearbyCount })
}
