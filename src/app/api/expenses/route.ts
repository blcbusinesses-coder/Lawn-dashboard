import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // format: YYYY-MM

  let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false })

  if (month) {
    const start = `${month}-01`
    const [year, m] = month.split('-').map(Number)
    const end = new Date(year, m, 0).toISOString().split('T')[0]
    query = query.gte('expense_date', start).lte('expense_date', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json()

  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...body, created_by: user?.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
