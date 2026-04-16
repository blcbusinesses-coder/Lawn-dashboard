import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/important — list all items ordered by type then sort_order
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('important_items')
    .select('*')
    .order('type')
    .order('sort_order')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/important — create instruction or link (documents use /upload)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json()

  const { type, title, body: itemBody, url } = body

  if (!type || !title?.trim()) {
    return NextResponse.json({ error: 'type and title are required' }, { status: 400 })
  }
  if (type === 'link' && !url?.trim()) {
    return NextResponse.json({ error: 'url is required for links' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('important_items')
    .insert({
      type,
      title: title.trim(),
      body: itemBody?.trim() || null,
      url: url?.trim() || null,
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/important — update title, body, url
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { id, title, body, url } = await request.json()

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('important_items')
    .update({
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(body !== undefined ? { body: body?.trim() || null } : {}),
      ...(url !== undefined ? { url: url?.trim() || null } : {}),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/important?id=xxx
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Fetch item first to get storage path if it's a document
  const { data: item } = await supabase.from('important_items').select('type, url').eq('id', id).single()

  // Delete from storage if it's a document
  if (item?.type === 'document' && item.url) {
    await supabase.storage.from('important-docs').remove([item.url])
  }

  const { error } = await supabase.from('important_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
