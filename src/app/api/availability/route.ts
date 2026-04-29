/**
 * GET  /api/availability  → string[]  (available days of week, e.g. ["Monday","Friday"])
 * PUT  /api/availability  → { days: string[] }  (replace the full array)
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('automation_settings')
    .select('value')
    .eq('key', 'available_days')
    .single()

  if (error || !data) return NextResponse.json([])
  return NextResponse.json(data.value as string[])
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { days } = await request.json() as { days: string[] }

  if (!Array.isArray(days)) {
    return NextResponse.json({ error: 'days must be an array' }, { status: 400 })
  }

  const { error } = await supabase
    .from('automation_settings')
    .upsert({ key: 'available_days', value: days, label: 'Days of the week available for new customers' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ days })
}
