/**
 * POST /api/schedule/book
 * Public. A homeowner self-schedules their first mow: creates a lead with the
 * saved quote + chosen day, and marks the mailed recipient (if any) scheduled.
 * Body: { recipient_id?, name, phone, address, quote?, chosen_day, preferred_date? }
 */

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { recipient_id, name, phone, address, quote, chosen_day, preferred_date } = body as {
    recipient_id?: string
    name?: string
    phone?: string
    address?: string
    quote?: number | null
    chosen_day?: string
    preferred_date?: string | null
  }

  if (!name?.trim() || !phone?.trim() || !address?.trim()) {
    return NextResponse.json({ error: 'name, phone, and address are required' }, { status: 400 })
  }
  if (!chosen_day?.trim()) {
    return NextResponse.json({ error: 'please choose a day' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // chosen_start_day is a DATE column in the live schema, so only an ISO date
  // is safe there. Keep the human-readable choice (incl. "Flexible") in notes.
  const isoDate = preferred_date && /^\d{4}-\d{2}-\d{2}$/.test(preferred_date) ? preferred_date : null
  const noteParts = [
    'Self-scheduled (QR/website).',
    `Preferred: ${chosen_day.trim()}.`,
    typeof quote === 'number' && quote > 0 ? `Quote $${quote}/mow.` : '',
  ].filter(Boolean)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('leads') as any)
    .insert({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      status: 'new',
      quoted_amount: typeof quote === 'number' && quote > 0 ? quote : null,
      chosen_start_day: isoDate,
      preferred_date: isoDate,
      quote_source: 'self_schedule',
      notes: noteParts.join(' '),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark the mailed recipient as scheduled so it drops out of future outreach.
  if (recipient_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('letter_recipients') as any)
      .update({ status: 'scheduled' })
      .eq('id', recipient_id)
  }

  // Auto-add to operations: create a customer + a property so the booking shows
  // up in Properties and on the Jobs route for the chosen weekday. Best-effort —
  // a failure here must never fail the booking itself.
  try {
    const weekday = isoDate
      ? new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
      : (chosen_day.trim().split(/[\s(]/)[0] || null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customer } = await (admin.from('customers') as any)
      .insert({
        full_name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: `Self-scheduled via letter on ${new Date().toISOString().split('T')[0]}. ${noteParts.join(' ')} 25% off first month.`,
      })
      .select()
      .single()

    if (customer?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('properties') as any).insert({
        customer_id: customer.id,
        address: address.trim(),
        price_per_mow: typeof quote === 'number' && quote > 0 ? quote : 0,
        scheduled_days: weekday ? [weekday] : null,
        notes: `New self-scheduled booking — first mow ${chosen_day.trim()}. 25% off first month.`,
        is_active: true,
      })
    }
  } catch (err) {
    console.error('[schedule/book] auto-create customer/property failed:', err)
  }

  return NextResponse.json({ success: true, lead_id: data.id }, { status: 201 })
}
