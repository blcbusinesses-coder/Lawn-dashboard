import { createClient } from '@/lib/supabase/server'
import { getTwilioClient, TWILIO_FROM } from '@/lib/twilio/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*, customers(full_name)')
    .order('sent_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { recipients, body } = await request.json()

  if (!recipients?.length || !body?.trim()) {
    return NextResponse.json({ error: 'Recipients and body are required' }, { status: 400 })
  }

  const twilio = getTwilioClient()
  const results = []

  for (const recipient of recipients) {
    const { phone, customer_id } = recipient

    try {
      const message = await twilio.messages.create({
        from: TWILIO_FROM,
        to: phone,
        body,
      })

      await supabase.from('sms_messages').insert({
        customer_id: customer_id ?? null,
        to_phone: phone,
        body,
        twilio_sid: message.sid,
        status: message.status,
        sent_by: user?.id,
      })

      results.push({ phone, status: 'sent', sid: message.sid })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ phone, status: 'failed', error: msg })
    }
  }

  return NextResponse.json({ results })
}
