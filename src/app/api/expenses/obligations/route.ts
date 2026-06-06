import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('expenses')
    .select('*')
    .in('payment_method', ['credit_card', 'loan'])
    .is('settled_at', null)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(request: NextRequest) {
  const supabase = await createAdminClient()
  const body = await request.json()
  const { id, settled_at, allocated_amount } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Two distinct operations share this endpoint:
  //   • Setting aside money toward the bill (Bank Account tab) — updates allocated_amount.
  //   • Marking the bill paid — stamps settled_at.
  let update: Record<string, unknown>
  if (allocated_amount !== undefined) {
    const n = Number(allocated_amount)
    update = { allocated_amount: Number.isFinite(n) && n >= 0 ? n : 0 }
  } else {
    update = { settled_at: settled_at ?? new Date().toISOString().split('T')[0] }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('expenses')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
