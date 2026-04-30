/**
 * POST /api/invoices/[id]/payments  — record a payment (full or partial)
 * GET  /api/invoices/[id]/payments  — list all payments for an invoice
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { amount, paid_at, note } = await request.json()

  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 })
  }

  // Insert the payment
  const { data: payment, error: payErr } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id: id,
      amount: Number(amount),
      paid_at: paid_at ?? new Date().toISOString().split('T')[0],
      note: note?.trim() || null,
    })
    .select()
    .single()

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })

  // Check if invoice is now fully paid
  const { data: invoice } = await supabase
    .from('invoices')
    .select('total_amount, status')
    .eq('id', id)
    .single()

  const { data: allPayments } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', id)

  const totalPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const isFullyPaid = invoice && totalPaid >= Number(invoice.total_amount)

  if (isFullyPaid && invoice?.status !== 'paid') {
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: paid_at ?? new Date().toISOString().split('T')[0] })
      .eq('id', id)
  }

  return NextResponse.json({ payment, fully_paid: isFullyPaid }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const paymentId = searchParams.get('payment_id')

  if (!paymentId) return NextResponse.json({ error: 'payment_id required' }, { status: 400 })

  const { error } = await supabase
    .from('invoice_payments')
    .delete()
    .eq('id', paymentId)
    .eq('invoice_id', id) // safety: must belong to this invoice

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If we deleted a payment, check if invoice should revert from 'paid'
  const { data: invoice } = await supabase
    .from('invoices')
    .select('total_amount, status')
    .eq('id', id)
    .single()

  const { data: remaining } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', id)

  const totalPaid = (remaining ?? []).reduce((s, p) => s + Number(p.amount), 0)

  if (invoice?.status === 'paid' && totalPaid < Number(invoice.total_amount)) {
    await supabase
      .from('invoices')
      .update({ status: 'sent', paid_at: null })
      .eq('id', id)
  }

  return NextResponse.json({ success: true, total_paid: totalPaid })
}
