import { generateInvoiceMessage } from '@/lib/openai/invoice-writer'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export async function generateInvoices(
  supabase: SupabaseClient<Database>,
  year: number,
  month: number
): Promise<{ created: number; invoice_ids: string[]; error?: string }> {
  const periodDate = new Date(year, month - 1, 1)
  const periodStart = format(startOfMonth(periodDate), 'yyyy-MM-dd')
  const periodEnd = format(endOfMonth(periodDate), 'yyyy-MM-dd')
  const periodLabel = format(periodDate, 'MMMM yyyy')

  // ── Fetch mowing job logs ──────────────────────────────────────────────────
  const { data: jobLogs, error: jobError } = await supabase
    .from('job_logs')
    .select('*, properties(id, address, price_per_mow, customer_id, customers(id, full_name, email))')
    .eq('status', 'done')
    .gte('week_start', periodStart)
    .lte('week_start', periodEnd)

  if (jobError) return { created: 0, invoice_ids: [], error: jobError.message }

  // ── Fetch completed one-off jobs for this period ───────────────────────────
  const { data: oneOffJobs } = await supabase
    .from('one_off_jobs')
    .select('*, customers(id, full_name, email)')
    .eq('status', 'done')
    .gte('completed_date', periodStart)
    .lte('completed_date', periodEnd)

  // ── Build per-customer data map ────────────────────────────────────────────
  const customerMap = new Map<string, {
    customer: { id: string; full_name: string; email: string | null }
    mowJobs: Array<{ address: string; price_per_mow: number; property_id: string; count: number }>
    oneOffItems: Array<{ id: string; title: string; amount: number }>
  }>()

  // Add mowing jobs
  for (const log of jobLogs ?? []) {
    const prop = log.properties as {
      id: string; address: string; price_per_mow: number; customer_id: string
      customers: { id: string; full_name: string; email: string | null }
    } | null
    if (!prop?.customers) continue

    const customerId = prop.customers.id
    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, { customer: prop.customers, mowJobs: [], oneOffItems: [] })
    }
    const entry = customerMap.get(customerId)!
    const existing = entry.mowJobs.find((j) => j.property_id === prop.id)
    if (existing) { existing.count++ }
    else { entry.mowJobs.push({ address: prop.address, price_per_mow: prop.price_per_mow, property_id: prop.id, count: 1 }) }
  }

  // Add one-off jobs (may create new customer entries)
  for (const job of oneOffJobs ?? []) {
    const customer = job.customers as { id: string; full_name: string; email: string | null } | null
    if (!customer) continue

    if (!customerMap.has(customer.id)) {
      customerMap.set(customer.id, { customer, mowJobs: [], oneOffItems: [] })
    }
    customerMap.get(customer.id)!.oneOffItems.push({ id: job.id, title: job.title, amount: job.amount })
  }

  if (customerMap.size === 0) {
    return { created: 0, invoice_ids: [], error: 'No completed jobs found for this period' }
  }

  // ── Generate invoices ──────────────────────────────────────────────────────
  const created: string[] = []

  for (const [, { customer, mowJobs, oneOffItems }] of customerMap) {
    const lineItems: Array<{
      description: string; quantity: number; unit_price: number; line_total: number; property_id?: string | null
    }> = []

    // Mowing line items
    for (const j of mowJobs) {
      lineItems.push({
        description: `Lawn mowing — ${j.address}`,
        quantity: j.count,
        unit_price: j.price_per_mow,
        line_total: j.count * j.price_per_mow,
        property_id: j.property_id,
      })
    }

    // One-off line items
    for (const o of oneOffItems) {
      lineItems.push({
        description: o.title,
        quantity: 1,
        unit_price: o.amount,
        line_total: o.amount,
        property_id: null,
      })
    }

    const subtotal = lineItems.reduce((sum, li) => sum + li.line_total, 0)
    const totalMows = mowJobs.reduce((sum, j) => sum + j.count, 0)

    const aiMessage = await generateInvoiceMessage({
      customerName: customer.full_name,
      month: periodLabel,
      jobCount: totalMows,
      total: subtotal,
    })

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

    await supabase.from('invoice_line_items').insert(
      lineItems.map((li) => ({ ...li, invoice_id: invoice.id }))
    )

    created.push(invoice.id)
  }

  return { created: created.length, invoice_ids: created }
}
