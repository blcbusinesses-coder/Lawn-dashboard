import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { InvoiceEmail } from '@/lib/resend/invoice-email'
import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { render } from '@react-email/render'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { invoice_id } = await request.json()

  // Fetch invoice with all relations
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, customers(full_name, email), invoice_line_items(*)')
    .eq('id', invoice_id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const customer = invoice.customers as { full_name: string; email: string | null }
  const lineItems = invoice.invoice_line_items as Array<{
    description: string
    quantity: number
    unit_price: number
    line_total: number
  }>

  if (!customer.email) {
    return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 })
  }

  const periodLabel = format(new Date(invoice.period_start), 'MMMM yyyy')

  const emailHtml = await render(
    InvoiceEmail({
      customerName: customer.full_name,
      invoiceId: invoice.id,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      periodLabel,
      lineItems: lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
      })),
      subtotal: invoice.subtotal,
      total: invoice.total_amount,
      aiMessage: invoice.ai_message ?? '',
    })
  )

  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail) {
    return NextResponse.json({ error: 'RESEND_FROM_EMAIL environment variable is not set' }, { status: 500 })
  }

  const { error: sendError } = await getResend().emails.send({
    from: `Gray Wolf Workers <${fromEmail}>`,
    to: customer.email,
    subject: `Invoice from Gray Wolf Workers — ${periodLabel}`,
    html: emailHtml,
  })

  if (sendError) {
    return NextResponse.json({ error: sendError.message }, { status: 500 })
  }

  // Update invoice status
  await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoice_id)

  return NextResponse.json({ success: true })
}
