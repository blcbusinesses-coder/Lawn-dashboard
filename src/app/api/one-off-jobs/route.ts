import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { NextRequest, NextResponse } from 'next/server'

type OneOffUpdate = Database['public']['Tables']['one_off_jobs']['Update']

// GET /api/one-off-jobs?status=pending&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let q = supabase
    .from('one_off_jobs')
    .select('*, customers(id, full_name), properties(id, address)')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status as 'pending' | 'done' | 'cancelled')
  if (from) q = q.gte('scheduled_date', from)
  if (to) q = q.lte('scheduled_date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/one-off-jobs — create
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json()

  const { title, description, customer_id, property_id, amount, scheduled_date, notes } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('one_off_jobs')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      customer_id: customer_id || null,
      property_id: property_id || null,
      amount: parseFloat(amount) || 0,
      scheduled_date: scheduled_date || null,
      notes: notes?.trim() || null,
      created_by: user?.id,
    })
    .select('*, customers(id, full_name), properties(id, address)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/one-off-jobs — update status or fields
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { id, status, completed_date, amount, notes, title, scheduled_date, customer_id, description } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updates: OneOffUpdate = {}
  if (status !== undefined) updates.status = status as OneOffUpdate['status']
  if (completed_date !== undefined) updates.completed_date = completed_date || null
  if (amount !== undefined) updates.amount = parseFloat(amount)
  if (notes !== undefined) updates.notes = notes || null
  if (title !== undefined) updates.title = title
  if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date || null
  if (customer_id !== undefined) updates.customer_id = customer_id || null
  if (description !== undefined) updates.description = description || null

  // Auto-set completed_date when marking done
  if (status === 'done' && !updates.completed_date) {
    updates.completed_date = new Date().toISOString().slice(0, 10)
  }

  const { data, error } = await supabase
    .from('one_off_jobs')
    .update(updates)
    .eq('id', id)
    .select('*, customers(id, full_name), properties(id, address)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/one-off-jobs?id=xxx
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('one_off_jobs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
