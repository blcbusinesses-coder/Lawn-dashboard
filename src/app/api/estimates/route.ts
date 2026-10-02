import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { addDays, format } from 'date-fns'

interface IncomingLineItem {
  description: string
  quantity?: number
  unit_price: number
}

// GET /api/estimates — owner: list estimates (newest first) with line items.
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('estimates')
    .select('*, estimate_line_items(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/estimates — owner: create a draft estimate + its line items.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const {
    customer_id,
    customer_name,
    customer_email,
    address,
    job_type,
    notes,
    cac_amount,
    valid_days,
    line_items,
    property_data,
  } = body as {
    customer_id?: string | null
    customer_name?: string
    customer_email?: string | null
    address?: string | null
    job_type?: string | null
    notes?: string | null
    cac_amount?: number
    valid_days?: number
    line_items?: IncomingLineItem[]
    property_data?: unknown
  }

  if (!customer_name?.trim()) {
    return NextResponse.json({ error: 'customer_name is required' }, { status: 400 })
  }
  if (!line_items?.length) {
    return NextResponse.json({ error: 'at least one line item is required' }, { status: 400 })
  }

  // Compute totals server-side so they can't drift from the line items.
  const items = line_items.map((li) => {
    const quantity = Math.max(1, Math.round(li.quantity ?? 1))
    const unit_price = Number(li.unit_price) || 0
    return {
      description: (li.description || 'Service').trim(),
      quantity,
      unit_price,
      line_total: Math.round(quantity * unit_price * 100) / 100,
    }
  })
  const subtotal = Math.round(items.reduce((s, i) => s + i.line_total, 0) * 100) / 100
  const cac = Math.max(0, Number(cac_amount) || 0)
  const total = Math.round((subtotal + cac) * 100) / 100
  const validDays = Number.isFinite(valid_days) && (valid_days as number) > 0 ? Math.round(valid_days as number) : 30
  const validUntil = format(addDays(new Date(), validDays), 'yyyy-MM-dd')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: estimate, error } = await (supabase.from('estimates') as any)
    .insert({
      customer_id: customer_id || null,
      customer_name: customer_name.trim(),
      customer_email: customer_email?.trim() || null,
      address: address?.trim() || null,
      job_type: job_type || null,
      status: 'draft',
      subtotal,
      cac_amount: cac,
      total_amount: total,
      notes: notes?.trim() || null,
      property_data: (property_data ?? null) as never,
      valid_until: validUntil,
    })
    .select()
    .single()

  if (error || !estimate) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create estimate' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: itemsError } = await (supabase.from('estimate_line_items') as any).insert(
    items.map((i) => ({ ...i, estimate_id: estimate.id }))
  )
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ ...estimate, estimate_line_items: items }, { status: 201 })
}
