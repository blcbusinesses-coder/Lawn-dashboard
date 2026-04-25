import { createClient } from '@/lib/supabase/server'
import { getMailer, MAIL_FROM } from '@/lib/nodemailer/client'
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

  try {
    await getMailer().sendMail({
      from: MAIL_FROM,
      to: customer.email,
      subject: `Invoice from Gray Wolf Workers — ${periodLabel}`,
      html: emailHtml,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Update invoice status
  await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoice_id)

  return NextResponse.json({ success: true })
}
