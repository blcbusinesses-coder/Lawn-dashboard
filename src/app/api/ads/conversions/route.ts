import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('ad_conversions' as any)
    .select('*')
    .order('converted_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const supabase = await createAdminClient()
  const body = await request.json()

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('ad_conversions' as any)
    .insert({
      lead_id: body.lead_id ?? null,
      conversation_id: body.conversation_id ?? null,
      lead_name: body.lead_name ?? null,
      converted_at: body.converted_at ?? new Date().toISOString(),
      confidence_score: body.confidence_score ?? null,
      ad_id: body.ad_id ?? null,
      ad_name: body.ad_name ?? null,
      ad_campaign_id: body.ad_campaign_id ?? null,
      ad_campaign_name: body.ad_campaign_name ?? null,
      cpl_at_conversion: body.cpl_at_conversion ?? null,
      customer_status: body.customer_status ?? 'auto_detected',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createAdminClient()
  const { id, customer_status } = await request.json()

  if (!id || !customer_status) {
    return NextResponse.json({ error: 'id and customer_status required' }, { status: 400 })
  }

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('ad_conversions' as any)
    .update({ customer_status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
