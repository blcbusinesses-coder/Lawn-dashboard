import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign, error: campaignError } = await (adminClient.from('letter_campaigns') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recipients, error: recipientsError } = await (adminClient.from('letter_recipients') as any)
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  if (recipientsError) return NextResponse.json({ error: recipientsError.message }, { status: 500 })

  return NextResponse.json({ ...(campaign as Record<string, unknown>), recipients: recipients ?? [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const adminClient = createServiceClient()
  const body = await request.json()

  const allowed = ['response_rate', 'pieces_sent', 'total_cost', 'lob_campaign_id', 'name', 'description']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient.from('letter_campaigns') as any)
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
