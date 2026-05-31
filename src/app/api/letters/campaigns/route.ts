import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const adminClient = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaigns, error } = await (adminClient.from('letter_campaigns') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (campaigns ?? []) as Array<Record<string, unknown>>
  const campaignIds = rows.map((c) => c.id as string)
  const counts: Record<string, number> = {}

  if (campaignIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipientCounts } = await (adminClient.from('letter_recipients') as any)
      .select('campaign_id')
      .in('campaign_id', campaignIds)

    for (const r of (recipientCounts ?? []) as Array<Record<string, unknown>>) {
      const cid = r.campaign_id as string
      counts[cid] = (counts[cid] ?? 0) + 1
    }
  }

  const result = rows.map((c) => ({
    ...c,
    recipient_count: counts[c.id as string] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const adminClient = createServiceClient()
  const body = await request.json()

  const { name, description, tags, letter_type, send_date, budget_cap, phone } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminClient.from('letter_campaigns') as any)
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      tags: tags ?? [],
      letter_type: letter_type ?? 'general',
      send_date: send_date ?? 'ASAP',
      budget_cap: budget_cap ?? 100,
      phone: phone ?? '(260) 000-0000',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
