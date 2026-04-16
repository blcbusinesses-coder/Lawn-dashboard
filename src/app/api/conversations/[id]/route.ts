import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/conversations/[id] — fetch messages + mark read
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()

  const [messagesRes] = await Promise.all([
    supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('sent_at'),
    // Mark as read
    supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', id),
  ])

  if (messagesRes.error) return NextResponse.json({ error: messagesRes.error.message }, { status: 500 })
  return NextResponse.json(messagesRes.data)
}

// PATCH /api/conversations/[id] — toggle ai_enabled or update ai_state
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const updates: { ai_enabled?: boolean; ai_state?: string } = {}
  if (body.ai_enabled !== undefined) updates.ai_enabled = body.ai_enabled as boolean
  if (body.ai_state !== undefined) updates.ai_state = body.ai_state as string

  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
