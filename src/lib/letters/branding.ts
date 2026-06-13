// Founder name for the personal letter signature. Stored in automation_settings
// under 'founder_name'. When unset, the letter falls back to a team signature.

import { createServiceClient } from '@/lib/supabase/server'

let cached: string | null | undefined

export async function getFounderName(): Promise<string | null> {
  if (cached !== undefined) return cached
  try {
    const admin = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin.from('automation_settings') as any)
      .select('value')
      .eq('key', 'founder_name')
      .single()
    const raw = data?.value
    const name = typeof raw === 'string' ? raw.trim() : ''
    cached = name || null
    return cached
  } catch {
    cached = null
    return null
  }
}
