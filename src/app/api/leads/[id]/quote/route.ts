import { createAdminClient } from '@/lib/supabase/server'
import { lookupProperty } from '@/lib/property/lookup'
import { calculateQuote } from '@/lib/quote/calculate'
import { openai } from '@/lib/openai/client'
import { getTwilioClient, TWILIO_FROM } from '@/lib/twilio/client'
import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'

// POST /api/leads/[id]/quote — property lookup + quote calculation + SMS
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = await createAdminClient()

  // Fetch lead
  const { data: lead, error: leadError } = await adminClient
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  // ── 1. Property lookup ─────────────────────────────────────────────────────
  const propertyData = await lookupProperty(lead.address)
  const quote = calculateQuote(propertyData?.lotSizeSqft ?? null)

  // ── 2. Get nearest available dates ─────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: availDates } = await adminClient
    .from('availability_dates')
    .select('available_date, notes')
    .gte('available_date', today)
    .order('available_date')
    .limit(3)

  const availText = availDates?.length
    ? availDates.map((d) => format(new Date(d.available_date + 'T12:00:00'), 'EEEE, MMM d')).join(', ')
    : 'flexible'

  const preferredText = lead.preferred_date
    ? format(new Date(lead.preferred_date + 'T12:00:00'), 'EEEE, MMM d')
    : null

  // ── 3. Generate AI SMS text ────────────────────────────────────────────────
  let smsBody: string
  try {
    const prompt = `Write a friendly, natural SMS quote for a lawn mowing service. Keep it under 320 characters total.

Customer name: ${lead.name}
Property address: ${lead.address}
Quote price: $${quote.amount}/mow${quote.confidence === 'estimate' ? ' (estimated)' : ''}
${preferredText ? `Preferred mow day: ${preferredText}` : ''}
Our available dates: ${availText}

The message should: greet them by first name, mention the price, ask if it sounds good, mention we can get started soon. Be warm and conversational. Sign off as "Gray Wolf Workers".`

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    })
    smsBody = res.choices[0].message.content?.trim() ?? ''
  } catch {
    // Fallback SMS if OpenAI fails
    const firstName = lead.name.split(' ')[0]
    smsBody = `Hi ${firstName}! This is Gray Wolf Workers 🐺 We'd love to mow your lawn at ${lead.address} for $${quote.amount}/visit. Does that sound good? We can get started ${availText !== 'flexible' ? `as soon as ${availDates![0].available_date}` : 'soon'}! Reply YES to confirm.`
  }

  // ── 4. Send SMS via Twilio ─────────────────────────────────────────────────
  let twilioSid: string | null = null
  try {
    const twilio = getTwilioClient()
    const message = await twilio.messages.create({
      from: TWILIO_FROM,
      to: lead.phone,
      body: smsBody,
    })
    twilioSid = message.sid
  } catch (err) {
    console.error('[leads/quote] Twilio send failed:', err)
  }

  // ── 5. Update lead + create conversation + log message ────────────────────
  await adminClient
    .from('leads')
    .update({
      status: 'quoted',
      property_data: (propertyData?.raw ?? null) as import('@/types/database').Json | null,
      lot_size_sqft: propertyData?.lotSizeSqft ?? null,
      quoted_amount: quote.amount,
      quote_sent_at: new Date().toISOString(),
    })
    .eq('id', id)

  // Upsert conversation for this phone number
  const { data: conversation } = await adminClient
    .from('conversations')
    .upsert(
      {
        phone: lead.phone,
        lead_id: lead.id,
        display_name: lead.name,
        ai_enabled: true,
        ai_state: 'quote_sent',
        last_message_at: new Date().toISOString(),
      },
      { onConflict: 'phone' }
    )
    .select()
    .single()

  if (conversation && smsBody) {
    await adminClient.from('conversation_messages').insert({
      conversation_id: conversation.id,
      direction: 'outbound',
      body: smsBody,
      twilio_sid: twilioSid,
      status: twilioSid ? 'sent' : 'failed',
    })
  }

  return NextResponse.json({
    success: true,
    quote: quote.amount,
    confidence: quote.confidence,
    sms_sent: !!twilioSid,
    lot_size_sqft: propertyData?.lotSizeSqft ?? null,
  })
}
