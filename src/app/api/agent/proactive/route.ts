import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Called by Vercel Cron daily at 8am. Runs Wolf's morning briefing and stores it.
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized triggers
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isProactive: true,
        messages: [{
          role:    'user',
          content: 'Run the daily business health check and give me the morning briefing.',
        }],
      }),
    })

    let briefing = ''
    if (res.body) {
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        // Strip tool/visual events, keep text
        briefing += chunk.replace(/\x00(TOOL|VISUAL):[^\x00]*\x00/g, '')
      }
    }

    // Store in site_settings so the agent page can show it
    const supabase = await createAdminClient()
    await (supabase as any).from('site_settings').upsert([
      { key: 'wolf_last_briefing',    value: briefing.trim(),              updated_at: new Date().toISOString() },
      { key: 'wolf_briefing_date',    value: new Date().toISOString(),     updated_at: new Date().toISOString() },
    ], { onConflict: 'key' })

    return NextResponse.json({ ok: true, length: briefing.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Also allow manual trigger from the dashboard
export async function POST(request: Request) {
  return GET(request)
}
