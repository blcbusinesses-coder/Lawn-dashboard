import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const BUCKET = 'important-docs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null)?.trim()

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Ensure bucket exists (ignore "already exists" error)
  const { data: buckets } = await adminClient.storage.listBuckets()
  if (!buckets?.find((b: { name: string }) => b.name === BUCKET)) {
    await adminClient.storage.createBucket(BUCKET, { public: false })
  }

  // Build unique storage path
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Save DB record — url stores the storage path; signed URLs generated on demand
  const { data, error } = await supabase
    .from('important_items')
    .insert({
      type: 'document' as const,
      title: title || file.name,
      url: storagePath,
      file_name: file.name,
      file_size: file.size,
      file_mime: file.type || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    await adminClient.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// GET /api/important/upload?path=xxx  — generate a 1-hour signed download URL
export async function GET(request: NextRequest) {
  const adminClient = await createAdminClient()
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
