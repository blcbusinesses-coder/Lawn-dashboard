import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { customer_id, period_start, period_end, line_items, ai_message } = await request.json()

  if (!customer_id || !period_start || !period_end || !line_items?.length) {
    return NextResponse.json({ error: 'customer_id, period_start, period_end, and line_items are required' }, { status: 400 })
  }

  const subtotal = (line_items as Array<{ quantity: number; unit_price: number }>)
    .reduce((sum, li) => sum + li.quantity * li.unit_price, 0)

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      customer_id,
      period_start,
      period_end,
      status: 'draft',
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: subtotal,
      ai_message: ai_message || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const lineItemRows = (line_items as Array<{ description: string; quantity: number; unit_price: number }>).map((li) => ({
    invoice_id: invoice.id,
    description: li.description,
    quantity: li.quantity,
    unit_price: li.unit_price,
    line_total: li.quantity * li.unit_price,
  }))

  const { error: liError } = await supabase.from('invoice_line_items').insert(lineItemRows)
  if (liError) return NextResponse.json({ error: liError.message }, { status: 500 })

  return NextResponse.json(invoice, { status: 201 })
}

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
