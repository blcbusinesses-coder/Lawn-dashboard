import { createClient } from '@/lib/supabase/server'
import { getTwilioClient, TWILIO_FROM } from '@/lib/twilio/client'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/conversations/[id]/reply — owner manually sends a message
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { body: messageBody } = await request.json()

  if (!messageBody?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  // Get conversation for phone number
  const { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .select('phone')
    .eq('id', id)
    .single()

  if (convErr || !conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  // Send via Twilio
  let twilioSid: string | null = null
  try {
    const twilio = getTwilioClient()
    const msg = await twilio.messages.create({
      from: TWILIO_FROM,
      to: conversation.phone,
      body: messageBody.trim(),
    })
    twilioSid = msg.sid
  } catch (err) {
    console.error('[conversations/reply] Twilio error:', err)
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }

  // Save message + update conversation timestamp
  const [{ data: message, error: msgErr }] = await Promise.all([
    supabase
      .from('conversation_messages')
      .insert({
        conversation_id: id,
        direction: 'outbound',
        body: messageBody.trim(),
        twilio_sid: twilioSid,
        status: 'sent',
      })
      .select()
      .single(),
    supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', id),
  ])

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })
  return NextResponse.json(message, { status: 201 })
}
