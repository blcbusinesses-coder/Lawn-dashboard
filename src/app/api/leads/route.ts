import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/leads — owner: list all leads
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/leads — public: submit a new lead from the quote form
export async function POST(request: NextRequest) {
  // Use admin client so RLS doesn't block the public insert
  const adminClient = await createAdminClient()
  const body = await request.json()
  const { name, phone, email, address, preferred_date } = body

  if (!name?.trim() || !phone?.trim() || !address?.trim()) {
    return NextResponse.json({ error: 'name, phone, and address are required' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('leads')
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address.trim(),
      preferred_date: preferred_date || null,
      status: 'new',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
