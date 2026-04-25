import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('profiles')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminSupabase = await createAdminClient()

  // Delete the auth user (this also removes the profile via DB cascade if configured,
  // but we explicitly delete the profile row too to be safe)
  const { error: authError } = await adminSupabase.auth.admin.deleteUser(id)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await adminSupabase.from('profiles').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
