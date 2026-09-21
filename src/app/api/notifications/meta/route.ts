import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/notifications/meta — owner: Meta (Facebook/Instagram) lead-ads
// connection status + the exact callback URL to paste into Meta.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

  return NextResponse.json({
    callback_url: appUrl ? `${appUrl}/api/leads/facebook-webhook` : '/api/leads/facebook-webhook',
    app_url_set: Boolean(appUrl),
    verify_token_set: Boolean(process.env.FACEBOOK_VERIFY_TOKEN),
    page_access_token_set: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
    // Fully connected once the webhook can verify AND fetch lead details.
    connected: Boolean(process.env.FACEBOOK_VERIFY_TOKEN && process.env.FACEBOOK_PAGE_ACCESS_TOKEN && appUrl),
  })
}
