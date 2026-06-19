import { NextRequest, NextResponse } from 'next/server'
import { buildLetterHtml, formatQuote, type LetterType } from '@/lib/letters/templates'
import { getScheduleQrDataUri } from '@/lib/letters/qr'
import { getFounderName } from '@/lib/letters/branding'

// GET /api/letters/preview
// Returns { html: string } — rendered letter HTML, no Lob call.
// Query params (all optional, falls back to sample data):
//   name, quote_amount, phone, ai_copy, letter_type
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const name        = searchParams.get('name')        || 'Alex Johnson'
  const quoteAmount = parseInt(searchParams.get('quote_amount') || '45')
  const phone       = searchParams.get('phone')       || '(260) 599-4253'
  const ltParam     = searchParams.get('letter_type')
  const letterType: LetterType =
    ltParam === 'new_homeowner' || ltParam === 'violation' ? ltParam : 'general'

  const aiCopy = searchParams.get('ai_copy') ||
    `Four years ago, I was twelve and mowed my first yard with a mower I bought on a loan from friends and family. Now I've got a crew of four and we take care of around thirty lawns here in Kendallville, and I still get the same feeling every time we finish. There's nothing like seeing a property fresh-cut and edged, looking sharp and cared for.\n\nThat's why I wanted to reach out about your place over on East Mitchell Street. I've driven by that beautiful old home of yours a few times, and I figured your lawn would be [[QUOTE]]. A property like that deserves someone who takes real pride in the details, and that's exactly what we do.\n\nWe're at the point now where we're ready to take on more work, and I'd love to add your lawn to our route. New customers get twenty-five percent off the first month. The easiest way to lock in your price and pick your first day is to scan the QR code at the bottom of this letter — it'll just take a minute.`

  const street = searchParams.get('street') || 'Maple Street'
  const founderName = (await getFounderName()) ?? searchParams.get('founder') ?? undefined

  const html = buildLetterHtml({
    name,
    aiCopy,
    quote: formatQuote(quoteAmount),
    phone,
    letterType,
    founderName,
    qrDataUri: await getScheduleQrDataUri({ quote: quoteAmount, name, street }),
  })

  return NextResponse.json({ html })
}
