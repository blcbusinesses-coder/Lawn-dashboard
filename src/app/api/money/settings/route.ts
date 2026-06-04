import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Returns the singleton business_settings row. If the table hasn't been created
// yet (migration 0016 not applied), fall back to a default so the UI still renders.
export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('business_settings')
    .select('bank_balance, updated_at')
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ bank_balance: 0, updated_at: null, missing: true })
  return NextResponse.json(data ?? { bank_balance: 0, updated_at: null })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { bank_balance } = await request.json()
  const value = Number(bank_balance)
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: 'bank_balance must be a non-negative number' }, { status: 400 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('business_settings')
    .upsert({ id: true, bank_balance: value, updated_at: new Date().toISOString() })
    .select('bank_balance, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
