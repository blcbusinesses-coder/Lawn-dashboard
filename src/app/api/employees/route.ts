import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { full_name, email, password, hourly_rate, phone } = await request.json()

  if (!full_name || !email || !password) {
    return NextResponse.json({ error: 'full_name, email, and password are required' }, { status: 400 })
  }

  // Use admin client to create auth user
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'employee' },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Insert profile
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    full_name,
    role: 'employee',
    hourly_rate: hourly_rate ?? null,
    phone: phone ?? null,
  })

  if (profileError) {
    // Rollback auth user
    await adminSupabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ id: authData.user.id, full_name, email }, { status: 201 })
}
