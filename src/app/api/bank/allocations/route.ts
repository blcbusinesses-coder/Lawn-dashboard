import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// List all allocation buckets (oldest first so the order is stable).
export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bank_allocations')
    .select('*')
    .order('created_at', { ascending: true })
  // If the table doesn't exist yet (migration 0017 not applied), return empty.
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const target = Number(body.target_amount ?? 0)
  const allocated = Number(body.allocated_amount ?? 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bank_allocations')
    .insert({
      name,
      target_amount: Number.isFinite(target) && target >= 0 ? target : 0,
      allocated_amount: Number.isFinite(allocated) && allocated >= 0 ? allocated : 0,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const id = body.id
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (typeof body.name === 'string') update.name = body.name.trim()
  if (body.target_amount !== undefined) {
    const t = Number(body.target_amount)
    if (Number.isFinite(t) && t >= 0) update.target_amount = t
  }
  if (body.allocated_amount !== undefined) {
    const a = Number(body.allocated_amount)
    if (Number.isFinite(a) && a >= 0) update.allocated_amount = a
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bank_allocations')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('bank_allocations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
