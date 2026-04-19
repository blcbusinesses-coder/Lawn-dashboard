import { createAdminClient } from '@/lib/supabase/server'
import { getTwilioClient, TWILIO_FROM } from '@/lib/twilio/client'
import { openai } from '@/lib/openai/client'
import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'

// Twilio POSTs application/x-www-form-urlencoded
export async function POST(request: NextRequest) {
  const text = await request.text()
  const params = new URLSearchParams(text)

  const fromPhone = params.get('From') ?? ''
  const messageBody = params.get('Body')?.trim() ?? ''
  const sid = params.get('MessageSid') ?? ''

  if (!fromPhone || !messageBody) {
    return new NextResponse('', { status: 200 })
  }

  const adminClient = await createAdminClient()

  // ── Find or create conversation ────────────────────────────────────────────
  let { data: conversation } = await adminClient
    .from('conversations')
    .select('*')
    .eq('phone', fromPhone)
    .single()

  if (!conversation) {
    // Unknown sender — create a bare conversation
    const { data: newConv } = await adminClient
      .from('conversations')
      .insert({
        phone: fromPhone,
        display_name: fromPhone,
        ai_enabled: false,  // don't auto-respond to unknown senders
        ai_state: 'general',
        last_message_at: new Date().toISOString(),
        unread_count: 1,
      })
      .select()
      .single()
    conversation = newConv
  }

  if (!conversation) return new NextResponse('', { status: 200 })

  // ── Save inbound message ───────────────────────────────────────────────────
  await adminClient.from('conversation_messages').insert({
    conversation_id: conversation.id,
    direction: 'inbound',
    body: messageBody,
    twilio_sid: sid,
    status: 'received',
  })

  // Increment unread + update timestamp
  await adminClient
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count ?? 0) + 1,
    })
    .eq('id', conversation.id)

  // ── AI auto-reply (if enabled) ─────────────────────────────────────────────
  if (conversation.ai_enabled) {
    const aiReply = await generateAiReply(adminClient, conversation, messageBody)
    if (aiReply) {
      try {
        const twilio = getTwilioClient()
        const msg = await twilio.messages.create({
          from: TWILIO_FROM,
          to: fromPhone,
          body: aiReply,
        })

        await adminClient.from('conversation_messages').insert({
          conversation_id: conversation.id,
          direction: 'outbound',
          body: aiReply,
          twilio_sid: msg.sid,
          status: 'sent',
        })

        await adminClient
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversation.id)

        // If this looks like confirmation, update ai_state
        const lower = messageBody.toLowerCase()
        if (
          conversation.ai_state === 'quote_sent' &&
          (lower.includes('yes') || lower.includes('sounds good') || lower.includes('sure') || lower.includes('ok') || lower.includes('let') || lower.includes('go'))
        ) {
          await adminClient
            .from('conversations')
            .update({ ai_state: 'confirmed' })
            .eq('id', conversation.id)
          if (conversation.lead_id) {
            await adminClient
              .from('leads')
              .update({ status: 'converted' })
              .eq('id', conversation.lead_id)
          }
        }
      } catch (err) {
        console.error('[sms/webhook] AI reply send failed:', err)
      }
    }
  }

  // Return empty 200 — we send reply via API, not TwiML
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

async function generateAiReply(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  conversation: { id: string; lead_id: string | null; display_name: string | null; ai_state: string },
  latestMessage: string
): Promise<string | null> {
  // Fetch lead info
  let leadInfo = ''
  if (conversation.lead_id) {
    const { data: lead } = await adminClient
      .from('leads')
      .select('name, address, quoted_amount, preferred_date, lot_size_sqft')
      .eq('id', conversation.lead_id)
      .single()

    if (lead) {
      leadInfo = `
Customer: ${lead.name}
Address: ${lead.address}
Quoted price: $${lead.quoted_amount}/mow${lead.lot_size_sqft ? ` (lot: ${Math.round(lead.lot_size_sqft).toLocaleString()} sqft)` : ''}
Preferred mow day: ${lead.preferred_date ? format(new Date(lead.preferred_date + 'T12:00:00'), 'EEEE, MMM d') : 'not specified'}`
    }
  }

  // Fetch available dates
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: availDates } = await adminClient
    .from('availability_dates')
    .select('available_date')
    .gte('available_date', today)
    .order('available_date')
    .limit(3)

  const availText = availDates?.length
    ? availDates.map((d) => format(new Date(d.available_date + 'T12:00:00'), 'EEEE, MMM d')).join(', ')
    : 'flexible — we can work around your schedule'

  // Fetch recent message history
  const { data: history } = await adminClient
    .from('conversation_messages')
    .select('direction, body, sent_at')
    .eq('conversation_id', conversation.id)
    .order('sent_at', { ascending: false })
    .limit(12)

  const historyMessages = (history ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === 'outbound' ? 'assistant' as const : 'user' as const,
      content: m.body,
    }))

  const stageInstructions = {
    quote_sent: `You sent a quote and are waiting on their response. Handle these situations:

- They say YES / sounds good / sure / ok / let's do it → Confirm enthusiastically. Tell them we'll get started ${availText}. Mention invoices go out on the last day of the month. Ask if they have any questions.
- They say NO / too expensive / can you do better → Don't just drop the price. Acknowledge it, ask what price works for them, or mention we can look at adjusting the schedule to help with cost.
- They ask a question (what do you include? do you do trimming? etc.) → Answer it naturally. We mow and trim edges every visit. Invoices monthly. We're local and reliable.
- They ask to schedule a specific day → Check our available dates (${availText}) and confirm or suggest the closest match.`,

    confirmed: `The customer already agreed to service. They may have follow-up questions. Be helpful and friendly.
- Questions about what's included: mowing + trimming every visit
- Questions about billing: invoices sent on the last day of every month
- Questions about scheduling: our next available dates are ${availText}
- If they want to cancel or pause: be understanding, tell them to just let us know`,

    general: `This person texted us directly. Have a natural conversation about our lawn mowing services.
- Pricing: $25–$130/mow depending on property size
- We mow and trim every visit
- Invoices go out monthly
- Next available: ${availText}
- If they want a quote: ask for their address and we'll look it up`,
  }[conversation.ai_state] ?? `Answer helpfully about Gray Wolf Workers lawn mowing. Available dates: ${availText}.`

  const systemPrompt = `You are texting on behalf of Gray Wolf Workers, a local lawn care company. You are NOT a robot — write like a real, friendly person who works there.
${leadInfo}

${stageInstructions}

RULES:
- Keep every reply under 280 characters
- Casual and warm — like a real person texting, not a customer service bot
- No bullet points, no formal language, no "I'd be happy to help!"
- Use their first name naturally (not every message)
- Never make up prices or dates you don't know`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: latestMessage },
      ],
      max_tokens: 120,
      temperature: 0.7,
    })
    return response.choices[0].message.content?.trim() ?? null
  } catch (err) {
    console.error('[sms/webhook] OpenAI error:', err)
    return null
  }
}
