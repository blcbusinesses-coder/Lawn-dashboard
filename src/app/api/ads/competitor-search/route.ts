import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const token = process.env.FACEBOOK_AD_LIBRARY_TOKEN

  // Deep-link URLs for multiple ad research platforms
  const searchLinks = {
    facebook: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${encodeURIComponent(name)}&search_type=keyword_unordered&media_type=all`,
    google: `https://adstransparency.google.com/?region=US&query=${encodeURIComponent(name)}`,
  }

  if (!token) {
    return NextResponse.json({ configured: false, searchLinks })
  }

  // Facebook Ad Library API — requires Ad Library API access approval
  try {
    const url = new URL('https://graph.facebook.com/v21.0/ads_archive')
    url.searchParams.set('search_terms', name)
    url.searchParams.set('ad_reached_countries', 'US')
    url.searchParams.set('ad_type', 'ALL')
    url.searchParams.set('limit', '12')
    url.searchParams.set('fields', [
      'id', 'page_name', 'ad_creative_bodies', 'ad_creative_link_titles',
      'ad_delivery_start_time', 'ad_delivery_stop_time', 'ad_snapshot_url',
      'spend', 'impressions',
    ].join(','))
    url.searchParams.set('access_token', token)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ configured: true, error: data.error?.message ?? 'API error', searchLinks })
    }

    return NextResponse.json({ configured: true, ads: data.data ?? [], searchLinks })
  } catch (err) {
    return NextResponse.json({
      configured: true,
      error: err instanceof Error ? err.message : 'Request failed',
      searchLinks,
    })
  }
}
