import { NextRequest, NextResponse } from 'next/server'
import { buildLetterHtml, formatQuote, type LetterType } from '@/lib/letters/templates'

// GET /api/letters/preview
// Returns { html: string } — rendered letter HTML, no Lob call.
// Query params (all optional, falls back to sample data):
//   name, quote_amount, phone, ai_copy, letter_type
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const name        = searchParams.get('name')        || 'Alex Johnson'
  const quoteAmount = parseInt(searchParams.get('quote_amount') || '45')
  const phone       = searchParams.get('phone')       || '(260) 000-0000'
  const ltParam     = searchParams.get('letter_type')
  const letterType: LetterType =
    ltParam === 'new_homeowner' || ltParam === 'violation' ? ltParam : 'general'

  const aiCopy = searchParams.get('ai_copy') ||
    `Your property looks like a great fit for our lawn service. We mow lawns all across Kendallville and would love to keep yours looking sharp all season long.\n\nWe keep things simple — no contracts and no hassle. Just a reliable, well-kept lawn you can be proud of. A personalized estimate for your home is included below.`

  const html = buildLetterHtml({
    name,
    aiCopy,
    quote: formatQuote(quoteAmount),
    phone,
    letterType,
  })

  return NextResponse.json({ html })
}
