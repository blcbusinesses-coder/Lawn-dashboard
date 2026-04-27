import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('todos')
    .select(`
      *,
      customer:assigned_customer_id ( id, full_name ),
      employee:assigned_employee_id ( id, full_name ),
      equipment:assigned_equipment_id ( id, name )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('todos')
    .insert(body)
    .select(`
      *,
      customer:assigned_customer_id ( id, full_name ),
      employee:assigned_employee_id ( id, full_name ),
      equipment:assigned_equipment_id ( id, name )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
