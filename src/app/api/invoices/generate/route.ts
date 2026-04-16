import { createClient } from '@/lib/supabase/server'
import { generateInvoiceMessage } from '@/lib/openai/invoice-writer'
import { NextRequest, NextResponse } from 'next/server'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { year, month } = await request.json()

  const periodDate = new Date(year, month - 1, 1)
  const periodStart = format(startOfMonth(periodDate), 'yyyy-MM-dd')
  const periodEnd = format(endOfMonth(periodDate), 'yyyy-MM-dd')
  const periodLabel = format(periodDate, 'MMMM yyyy')

  // Get all completed jobs in the period
  const { data: jobLogs, error: jobError } = await supabase
    .from('job_logs')
    .select('*, properties(id, address, price_per_mow, customer_id, customers(id, full_name, email))')
    .eq('status', 'done')
    .gte('week_start', periodStart)
    .lte('week_start', periodEnd)

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 })
  if (!jobLogs?.length) {
    return NextResponse.json({ error: 'No completed jobs found for this period' }, { status: 400 })
  }

  // Group by customer
  const customerMap = new Map<string, {
    customer: { id: string; full_name: string; email: string | null }
    jobs: Array<{ address: string; price_per_mow: number; property_id: string; count: number }>
  }>()

  for (const log of jobLogs) {
    const prop = log.properties as {
      id: string
      address: string
      price_per_mow: number
      customer_id: string
      customers: { id: string; full_name: string; email: string | null }
    } | null

    if (!prop?.customers) continue
    const customerId = prop.customers.id

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, { customer: prop.customers, jobs: [] })
    }

    const entry = customerMap.get(customerId)!
    const existing = entry.jobs.find((j) => j.property_id === prop.id)
    if (existing) {
      existing.count++
    } else {
      entry.jobs.push({
        address: prop.address,
        price_per_mow: prop.price_per_mow,
        property_id: prop.id,
        count: 1,
      })
    }
  }

  const created = []

  for (const [, { customer, jobs }] of customerMap) {
    const lineItems = jobs.map((j) => ({
      description: `Lawn mowing — ${j.address}`,
      quantity: j.count,
      unit_price: j.price_per_mow,
      line_total: j.count * j.price_per_mow,
      property_id: j.property_id,
    }))

    const subtotal = lineItems.reduce((sum, li) => sum + li.line_total, 0)
    const totalMows = jobs.reduce((sum, j) => sum + j.count, 0)

    // Generate AI message
    const aiMessage = await generateInvoiceMessage({
      customerName: customer.full_name,
      month: periodLabel,
      jobCount: totalMows,
      total: subtotal,
    })

    // Insert invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        customer_id: customer.id,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'draft',
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: subtotal,
        ai_message: aiMessage,
      })
      .select()
      .single()

    if (invError) continue

    // Insert line items
    await supabase.from('invoice_line_items').insert(
      lineItems.map((li) => ({ ...li, invoice_id: invoice.id }))
    )

    created.push(invoice.id)
  }

  return NextResponse.json({ created: created.length, invoice_ids: created })
}
