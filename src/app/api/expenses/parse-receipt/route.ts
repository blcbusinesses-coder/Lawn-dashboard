import { createClient } from '@/lib/supabase/server'
import { parseReceipt } from '@/lib/openai/receipt-parser'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload to Supabase Storage for record-keeping
  const fileName = `receipts/${Date.now()}-${file.name}`
  const { data: uploadData } = await supabase.storage
    .from('receipts')
    .upload(fileName, buffer, { contentType: file.type, upsert: false })

  // Pass image as base64 directly to OpenAI — avoids signed URL access issues
  const base64 = buffer.toString('base64')
  const dataUrl = `data:${file.type};base64,${base64}`

  const parsed = await parseReceipt(dataUrl)

  return NextResponse.json({
    ...parsed,
    receipt_url: uploadData?.path ?? null,
  })
}
