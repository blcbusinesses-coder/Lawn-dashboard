import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('employee_monthly_hours')
    .select('*, profiles(full_name, hourly_rate)')
    .order('month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { employee_id, month, hours, notes } = body

  if (!employee_id || !month || hours == null) {
    return NextResponse.json({ error: 'employee_id, month, and hours are required' }, { status: 400 })
  }

  const { amount_paid } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('employee_monthly_hours')
    .upsert(
      {
        employee_id,
        month,
        hours: parseFloat(hours),
        notes: notes ?? null,
        amount_paid: amount_paid != null ? parseFloat(amount_paid) : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id,month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('employee_monthly_hours').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
