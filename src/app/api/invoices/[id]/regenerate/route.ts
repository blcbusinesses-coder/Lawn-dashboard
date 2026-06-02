import { createClient } from '@/lib/supabase/server'
import { generateInvoiceMessage } from '@/lib/openai/invoice-writer'
import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'

// POST /api/invoices/[id]/regenerate — rebuild one invoice's line items and AI
// message from the completed jobs in its billing period. Draft only: sent/paid
// invoices are locked so we never silently change a customer's bill after the
// fact.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, customer_id, period_start, period_end, status, customers(full_name)')
    .eq('id', id)
    .single()

  if (invErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be regenerated' }, { status: 400 })
  }

  // Pull completed jobs for this customer within the invoice period.
  const { data: jobLogs, error: jobErr } = await supabase
    .from('job_logs')
    .select('*, properties(id, address, price_per_mow, customer_id)')
    .eq('status', 'done')
    .gte('week_start', invoice.period_start)
    .lte('week_start', invoice.period_end)

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 })

  // Aggregate mows per property for this customer only.
  const byProperty = new Map<string, { address: string; price_per_mow: number; count: number }>()
  for (const log of jobLogs ?? []) {
    const prop = log.properties as {
      id: string
      address: string
      price_per_mow: number
      customer_id: string
    } | null
    if (!prop || prop.customer_id !== invoice.customer_id) continue

    const existing = byProperty.get(prop.id)
    if (existing) existing.count++
    else byProperty.set(prop.id, { address: prop.address, price_per_mow: prop.price_per_mow, count: 1 })
  }

  if (byProperty.size === 0) {
    return NextResponse.json({ error: 'No completed jobs found for this customer in the billing period' }, { status: 400 })
  }

  const lineItems = Array.from(byProperty.entries()).map(([property_id, j]) => ({
    invoice_id: id,
    property_id,
    description: `Lawn mowing — ${j.address}`,
    quantity: j.count,
    unit_price: j.price_per_mow,
    line_total: j.count * j.price_per_mow,
  }))

  const subtotal = lineItems.reduce((s, li) => s + li.line_total, 0)
  const totalMows = lineItems.reduce((s, li) => s + li.quantity, 0)

  const customer = invoice.customers as unknown as { full_name: string } | null
  const aiMessage = await generateInvoiceMessage({
    customerName: customer?.full_name ?? 'there',
    month: format(new Date(invoice.period_start + 'T00:00:00'), 'MMMM yyyy'),
    jobCount: totalMows,
    total: subtotal,
  })

  // Replace line items and refresh the invoice totals + message.
  const { error: delErr } = await supabase.from('invoice_line_items').delete().eq('invoice_id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

  const { error: insErr } = await supabase.from('invoice_line_items').insert(lineItems)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

  const { data: updated, error: updErr } = await supabase
    .from('invoices')
    .update({ subtotal, tax_amount: 0, total_amount: subtotal, ai_message: aiMessage })
    .eq('id', id)
    .select('*, customers(full_name, email, extra_emails), invoice_line_items(*), invoice_payments(*)')
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })
  return NextResponse.json(updated)
}
