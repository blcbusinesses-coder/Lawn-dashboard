/**
 * GET /api/quote/availability
 * Public endpoint — returns upcoming available start days (not full, not past).
 */

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const admin = await createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await admin
    .from('availability_dates')
    .select('id, available_date, notes, is_full')
    .gte('available_date', today)
    .eq('is_full', false)
    .order('available_date')
    .limit(8)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
