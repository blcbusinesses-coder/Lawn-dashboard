/**
 * GET /api/letters/analytics?days=30   (days = 7 | 30 | 90 | 365 | all)
 * Owner-only. Letter-program metrics over a time frame:
 *  - sent        letters mailed (status sent/scheduled)
 *  - scans       QR-code scans logged on /schedule
 *  - spend       sent × $0.93
 *  - conversions self-scheduled bookings from the funnel
 *  - ROI         first-month revenue (incl. 25% off) ÷ spend
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const PRICE_PER_LETTER = 0.93
const MOWS_PER_MONTH = 4          // assume weekly service
const FIRST_MONTH_DISCOUNT = 0.25 // 25% off first month

function sinceDate(days: string): string | null {
  if (days === 'all') return null
  const n = parseInt(days)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

export async function GET(request: NextRequest) {
  // Auth: letter_recipients has no public RLS read policy, so this runs on the
  // service client — gate it behind a logged-in user.
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = new URL(request.url).searchParams.get('days') || '30'
  const from = sinceDate(days)
  const svc = createServiceClient()

  // ── Letters sent ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sentQ = (svc.from('letter_recipients') as any)
    .select('id', { count: 'exact', head: true })
    .in('status', ['sent', 'scheduled'])
  if (from) sentQ = sentQ.gte('created_at', from)
  const { count: sentCount } = await sentQ
  const sent = sentCount ?? 0

  // ── QR scans (best-effort; 0 if table not migrated) ─────────────────────────
  let scans = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scanQ = (svc.from('letter_qr_scans') as any).select('id', { count: 'exact', head: true })
  if (from) scanQ = scanQ.gte('created_at', from)
  const scanRes = await scanQ
  if (!scanRes.error) scans = scanRes.count ?? 0

  // ── Conversions (self-scheduled bookings) ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let convQ = (svc.from('leads') as any)
    .select('quoted_amount')
    .eq('quote_source', 'self_schedule')
  if (from) convQ = convQ.gte('created_at', from)
  const { data: convRows } = await convQ
  const conversions = (convRows ?? []).length

  // ── Money ───────────────────────────────────────────────────────────────────
  const spend = +(sent * PRICE_PER_LETTER).toFixed(2)
  const firstMonthRevenue = (convRows ?? []).reduce((sum: number, r: { quoted_amount: number | null }) => {
    const q = Number(r.quoted_amount) || 0
    return sum + q * MOWS_PER_MONTH * (1 - FIRST_MONTH_DISCOUNT)
  }, 0)
  const roiMultiple = spend > 0 ? +(firstMonthRevenue / spend).toFixed(2) : null

  return NextResponse.json({
    days,
    sent,
    scans,
    spend,
    conversions,
    first_month_revenue: +firstMonthRevenue.toFixed(2),
    roi_multiple: roiMultiple,
    scan_rate: sent > 0 ? +(scans / sent).toFixed(3) : null,
    conversion_rate: sent > 0 ? +(conversions / sent).toFixed(3) : null,
    assumptions: { price_per_letter: PRICE_PER_LETTER, mows_per_month: MOWS_PER_MONTH, first_month_discount: FIRST_MONTH_DISCOUNT },
  })
}
