import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildFrontHtml,
  buildBackHtml,
  formatQuote,
  SAMPLE_HOUSE_PHOTO,
} from '@/lib/postcards/templates'

// GET /api/postcards/preview
// Returns { front: string, back: string } — rendered HTML, no Lob call
// Query params (all optional, falls back to sample data):
//   name, address, quote_amount, nearby_count, phone, ai_copy
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const name         = searchParams.get('name')         || 'Alex Johnson'
  const address      = searchParams.get('address')      || '456 Oak Street'
  const quoteAmount  = parseInt(searchParams.get('quote_amount')  || '45')
  const nearbyCount  = parseInt(searchParams.get('nearby_count')  || '4')
  const phone        = searchParams.get('phone')        || '(260) 000-0000'
  const aiCopy       = searchParams.get('ai_copy')      ||
    'Your property looks like a great fit for our lawn service. We mow lawns all across Kendallville and would love to keep yours looking sharp all season.'

  // Real customer count for the social proof stat
  const adminClient = await createAdminClient()
  const { count: totalLawns } = await adminClient
    .from('customers')
    .select('*', { count: 'exact', head: true })

  const front = buildFrontHtml({
    name,
    aiCopy,
    quote: formatQuote(quoteAmount),
    streetViewUrl: SAMPLE_HOUSE_PHOTO,
    streetAddress: address,
    totalLawns: totalLawns ?? 21,
    nearbyCount,
    phone,
  })

  const back = buildBackHtml({ phone, aiCopy, name })

  return NextResponse.json({ front, back })
}
