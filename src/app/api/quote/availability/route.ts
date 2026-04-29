/**
 * GET /api/quote/availability
 * Public endpoint — returns the available days of the week from automation_settings.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const admin = await createAdminClient()

  const { data, error } = await admin
    .from('automation_settings')
    .select('value')
    .eq('key', 'available_days')
    .single()

  if (error || !data) return NextResponse.json([])
  return NextResponse.json(data.value as string[])
}
