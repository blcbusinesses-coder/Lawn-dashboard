import { getResend } from '@/lib/resend/client'
import { InvoiceEmail } from '@/lib/resend/invoice-email'
import { NextRequest, NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'
import { render } from '@react-email/render'

const SAMPLE_ADDRESSES = [
  '412 Maple St, Kendallville, IN',
  '87 Ridgewood Dr, Kendallville, IN',
  '1204 Oak Hollow Rd, Rome City, IN',
  '33 Lakeview Blvd, Kendallville, IN',
]

const MOWS_PER_MONTH = [2, 3, 4, 4, 3, 4]
const PRICES = [30, 35, 40, 45, 50, 55]

export async function POST(request: NextRequest) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  // Build a realistic-looking fake invoice
  const address = SAMPLE_ADDRESSES[Math.floor(Math.random() * SAMPLE_ADDRESSES.length)]
  const visits   = MOWS_PER_MONTH[Math.floor(Math.random() * MOWS_PER_MONTH.length)]
  const price    = PRICES[Math.floor(Math.random() * PRICES.length)]
  const subtotal = visits * price
  const total    = subtotal

  const now        = new Date()
  const periodEnd  = subDays(now, 1)
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
  const periodLabel = format(periodStart, 'MMMM yyyy')
  const fakeId      = Math.random().toString(36).slice(2, 10).toUpperCase()

  const lineItems = [
    {
      description: `Lawn mowing — ${address}`,
      quantity: visits,
      unit_price: price,
      line_total: subtotal,
    },
  ]

  const aiMessage = `Here's your invoice for lawn care services in ${periodLabel}. We completed ${visits} visit${visits > 1 ? 's' : ''} this month — it was a pleasure keeping things looking sharp. Let us know if you have any questions!`

  const emailHtml = await render(
    InvoiceEmail({
      customerName: 'Jane Smith',
      invoiceId: fakeId,
      periodStart: format(periodStart, 'yyyy-MM-dd'),
      periodEnd:   format(periodEnd,   'yyyy-MM-dd'),
      periodLabel,
      lineItems,
      subtotal,
      total,
      aiMessage,
    })
  )

  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail) {
    return NextResponse.json({ error: 'RESEND_FROM_EMAIL environment variable is not set' }, { status: 500 })
  }

  const { error } = await getResend().emails.send({
    from: `Gray Wolf Workers <${fromEmail}>`,
    to: email,
    subject: `[TEST] Invoice from Gray Wolf Workers — ${periodLabel}`,
    html: emailHtml,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, visits, price, total, address, periodLabel })
}
