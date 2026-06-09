/**
 * /api/seo/checklist — persistence for the Fast-Rank checklist on the Local
 * SEO page. Stored as one jsonb object ({ itemKey: true }) in
 * automation_settings under 'seo_checklist'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from('automation_settings') as any)
    .select('value')
    .eq('key', 'seo_checklist')
    .single()
  return NextResponse.json({ checked: data?.value ?? {} })
}

export async function PUT(request: NextRequest) {
  const { checked } = await request.json() as { checked?: Record<string, boolean> }
  if (!checked || typeof checked !== 'object') {
    return NextResponse.json({ error: 'checked object is required' }, { status: 400 })
  }
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from('automation_settings') as any)
    .upsert({ key: 'seo_checklist', value: checked, label: 'Local SEO Checklist' }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
