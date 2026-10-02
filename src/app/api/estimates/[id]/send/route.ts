import { createClient } from '@/lib/supabase/server'
import { getMailer, MAIL_FROM } from '@/lib/nodemailer/client'
import { EstimateEmail } from '@/lib/resend/estimate-email'
import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { render } from '@react-email/render'

// POST /api/estimates/[id]/send — render the estimate email + send it, then
// mark the estimate sent.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: estimate, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !estimate) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
  }

  if (!estimate.customer_email) {
    return NextResponse.json({ error: 'This estimate has no customer email' }, { status: 400 })
  }

  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', id)
    .order('created_at')

  // CAC is folded into the emailed total as a line so the math reads cleanly.
  const emailLineItems: Array<{ description: string; quantity: number; unit_price: number; line_total: number }> =
    (lineItems ?? []).map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
    }))
  if (estimate.cac_amount && estimate.cac_amount > 0) {
    emailLineItems.push({
      description: 'Customer acquisition',
      quantity: 1,
      unit_price: estimate.cac_amount,
      line_total: estimate.cac_amount,
    })
  }

  const validUntilLabel = estimate.valid_until
    ? format(new Date(estimate.valid_until + 'T12:00:00'), 'MMM d, yyyy')
    : null

  const introMessage = estimate.notes?.trim()
    || `Thanks for the opportunity! Here's your estimate for the work at your property. There's no obligation — reply any time and we'll get you on the schedule.`

  const emailHtml = await render(
    EstimateEmail({
      customerName: estimate.customer_name,
      estimateId: estimate.id,
      address: estimate.address,
      lineItems: emailLineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        line_total: li.line_total,
      })),
      subtotal: estimate.subtotal,
      total: estimate.total_amount,
      introMessage,
      validUntilLabel,
    })
  )

  try {
    await getMailer().sendMail({
      from: MAIL_FROM,
      to: estimate.customer_email,
      subject: `Your estimate from Gray Wolf Workers`,
      html: emailHtml,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('estimates') as any)
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
