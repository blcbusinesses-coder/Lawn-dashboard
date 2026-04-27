import { createAdminClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are analyzing a conversation transcript from a lawn care business to determine if the customer converted (i.e., agreed to hire the company for lawn services).

Conversion indicators:
- Customer explicitly agrees to service, scheduling, or pricing
- Customer says yes to a quote or proposal
- Customer provides scheduling availability or confirms a start date
- Customer says things like "sounds good", "let's do it", "sign me up", "I'm in", "go ahead", "book me"
- The conversation ends with a clear agreement or next step scheduled

NOT a conversion:
- Customer is just asking questions or getting a quote
- Customer says they need to think about it
- Customer declines or goes silent
- No clear agreement reached

Respond with ONLY valid JSON in this exact shape:
{
  "converted": true | false,
  "confidence": 0.0-1.0,
  "reason": "one sentence explanation"
}`

export async function POST(request: NextRequest) {
  const { conversation_id } = await request.json()

  if (!conversation_id) {
    return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Check if we already have a conversion record for this conversation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('ad_conversions')
    .select('id')
    .eq('conversation_id', conversation_id)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ skipped: true, reason: 'already_recorded' })
  }

  // Fetch conversation + messages
  const [convRes, msgRes] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, lead_id, leads(name, address, ad_id, ad_name, ad_campaign_id, ad_campaign_name)')
      .eq('id', conversation_id)
      .single(),
    supabase
      .from('conversation_messages')
      .select('direction, body, sent_at')
      .eq('conversation_id', conversation_id)
      .order('sent_at'),
  ])

  if (convRes.error || !convRes.data) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const messages = msgRes.data ?? []
  if (messages.length < 3) {
    return NextResponse.json({ skipped: true, reason: 'too_short' })
  }

  // Build transcript
  const transcript = messages
    .map((m) => `${m.direction === 'outbound' ? 'Business' : 'Customer'}: ${m.body}`)
    .join('\n')

  // Ask OpenAI
  let result: { converted: boolean; confidence: number; reason: string }
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Transcript:\n${transcript}` },
      ],
      max_tokens: 120,
      response_format: { type: 'json_object' },
    })
    result = JSON.parse(res.choices[0].message.content ?? '{}')
  } catch {
    return NextResponse.json({ error: 'OpenAI error' }, { status: 500 })
  }

  if (!result.converted || result.confidence < 0.85) {
    return NextResponse.json({
      converted: false,
      confidence: result.confidence,
      reason: result.reason,
    })
  }

  // Fetch CPL from automation_settings for context
  const { data: settingsRows } = await supabase.from('automation_settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value as string
  const baselineCpl = parseFloat(settings.baseline_cpl ?? '0') || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conv = convRes.data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lead = conv.leads as any

  // Write conversion record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: convRecord, error: insertError } = await (supabase as any)
    .from('ad_conversions')
    .insert({
      lead_id: conv.lead_id ?? null,
      conversation_id,
      lead_name: lead?.name ?? null,
      converted_at: new Date().toISOString(),
      confidence_score: result.confidence,
      ad_id: lead?.ad_id ?? null,
      ad_name: lead?.ad_name ?? null,
      ad_campaign_id: lead?.ad_campaign_id ?? null,
      ad_campaign_name: lead?.ad_campaign_name ?? null,
      cpl_at_conversion: baselineCpl,
      customer_status: 'auto_detected',
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    converted: true,
    confidence: result.confidence,
    reason: result.reason,
    record: convRecord,
  }, { status: 201 })
}
