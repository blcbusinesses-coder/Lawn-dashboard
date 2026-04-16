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

  // Upload to Supabase Storage
  const fileName = `receipts/${Date.now()}-${file.name}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(fileName, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get signed URL for OpenAI
  const { data: signedData } = await supabase.storage
    .from('receipts')
    .createSignedUrl(uploadData.path, 3600)

  if (!signedData?.signedUrl) {
    return NextResponse.json({ error: 'Could not create signed URL' }, { status: 500 })
  }

  // Parse with OpenAI Vision
  const parsed = await parseReceipt(signedData.signedUrl)

  return NextResponse.json({
    ...parsed,
    receipt_url: uploadData.path,
  })
}
