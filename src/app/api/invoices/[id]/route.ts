import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface EditableLineItem {
  description: string
  quantity: number
  unit_price: number
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  // Pull line_items out of the body — they live in a separate table and need
  // totals recomputed. Everything else is a direct column update on `invoices`.
  const { line_items, ...invoiceFields } = body as {
    line_items?: EditableLineItem[]
    [key: string]: unknown
  }

  const update: Record<string, unknown> = { ...invoiceFields }

  // When line items are edited, replace them wholesale and recompute totals.
  if (Array.isArray(line_items)) {
    const clean = line_items
      .filter((li) => li.description?.trim())
      .map((li) => ({
        description: li.description.trim(),
        quantity: Number(li.quantity) || 0,
        unit_price: Number(li.unit_price) || 0,
        line_total: (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
      }))

    if (clean.length === 0) {
      return NextResponse.json({ error: 'At least one line item with a description is required' }, { status: 400 })
    }

    const subtotal = clean.reduce((s, li) => s + li.line_total, 0)
    update.subtotal = subtotal
    update.tax_amount = 0
    update.total_amount = subtotal

    // Replace existing line items.
    const { error: delErr } = await supabase.from('invoice_line_items').delete().eq('invoice_id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

    const { error: insErr } = await supabase
      .from('invoice_line_items')
      .insert(clean.map((li) => ({ ...li, invoice_id: id })))
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('invoices')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(update as any)
    .eq('id', id)
    .select('*, customers(full_name, email, extra_emails), invoice_line_items(*), invoice_payments(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'void' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
