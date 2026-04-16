import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const month = searchParams.get('month')

  let query = supabase
    .from('invoices')
    .select('*, customers(full_name, email), invoice_line_items(*)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'draft' | 'sent' | 'paid' | 'void')
  if (month) {
    query = query.gte('period_start', `${month}-01`)
    const [year, m] = month.split('-').map(Number)
    const end = new Date(year, m, 0).toISOString().split('T')[0]
    query = query.lte('period_end', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
