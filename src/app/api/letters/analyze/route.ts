import { NextRequest, NextResponse } from 'next/server'
import { generateLetterContent } from '@/lib/letters/generate'
import type { LetterType } from '@/lib/letters/templates'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { address, name, letter_type } = body as {
    address: string
    name?: string
    letter_type?: LetterType
  }

  if (!address?.trim()) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 })
  }

  const letterType: LetterType =
    letter_type === 'new_homeowner' || letter_type === 'violation' ? letter_type : 'general'

  const content = await generateLetterContent({ address: address.trim(), name, letterType })
  return NextResponse.json(content)
}
