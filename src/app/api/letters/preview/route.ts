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
    `Four years ago, when I was just twelve, I started Gray Wolf Workers with one mower and a couple of yards — mostly because I love this work, and there's nothing like the look of a lawn that's been cut and edged right. Since then it's grown into a four-person crew taking care of around 30 lawns across the Kendallville area, and we're finally ready to take on more.\n\nThat's why I wanted to reach out about your place over on Maple Street. I had a look and figured your lawn would run about [[QUOTE]] a mow. I keep things simple — no contracts, no hassle, just a sharp lawn you can be proud of and a crew that actually shows up.\n\nNew customers get 25% off their first month, and I'd genuinely love the chance to earn your business. Scan the code below or give me a call and I'll get you on the schedule.`

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
