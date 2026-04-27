import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { format, subDays, startOfDay } from 'date-fns'

const FB_API = 'https://graph.facebook.com/v19.0'

const AD_FIELDS = 'spend,impressions,clicks,cpm,cpp,frequency,reach,actions,date_start,date_stop'

function getDateRange(preset: string): { since: string; until: string } | { date_preset: string } {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
  if (preset === 'today') return { date_preset: 'today' }
  if (preset === 'last_7d') return { date_preset: 'last_7d' }
  if (preset === 'last_30d') return { date_preset: 'last_30_days' }
  if (preset === 'season') {
    const year = new Date().getFullYear()
    return { since: `${year}-04-01`, until: today }
  }
  return { date_preset: 'last_30_days' }
}

function buildParams(
  token: string,
  dateRange: ReturnType<typeof getDateRange>,
  extras: Record<string, string> = {}
): string {
  const p = new URLSearchParams({
    fields: AD_FIELDS,
    time_increment: '1',
    access_token: token,
    ...('date_preset' in dateRange ? { date_preset: dateRange.date_preset } : { time_range: JSON.stringify({ since: dateRange.since, until: dateRange.until }) }),
    ...extras,
  })
  return p.toString()
}

function extractLeads(actions: Array<{ action_type: string; value: string }> | null): number {
  if (!actions) return 0
  const leadAction = actions.find((a) =>
    a.action_type === 'lead' ||
    a.action_type === 'onsite_conversion.lead_grouped' ||
    a.action_type === 'leadgen_grouped'
  )
  return leadAction ? parseInt(leadAction.value) || 0 : 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumInsights(data: any[]): Record<string, number> {
  return data.reduce((acc, row) => ({
    spend: (acc.spend || 0) + parseFloat(row.spend || '0'),
    impressions: (acc.impressions || 0) + parseInt(row.impressions || '0'),
    clicks: (acc.clicks || 0) + parseInt(row.clicks || '0'),
    reach: (acc.reach || 0) + parseInt(row.reach || '0'),
    leads: (acc.leads || 0) + extractLeads(row.actions),
  }), {})
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const preset = searchParams.get('preset') ?? 'last_30d'

  // Load token + account from settings
  const supabase = await createClient()
  const { data: settingsRows } = await supabase.from('automation_settings').select('key, value')
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) settings[row.key] = row.value as string

  const token = settings.facebook_access_token as string | undefined
  const accountId = settings.facebook_ad_account_id as string | undefined

  if (!token || !accountId) {
    return NextResponse.json({ error: 'not_configured' }, { status: 200 })
  }

  const dateRange = getDateRange(preset)

  // ── Fetch account-level (aggregated) ──────────────────────────────────────
  const [acctRes, acctDailyRes, campaignRes, adRes] = await Promise.all([
    fetch(`${FB_API}/act_${accountId}/insights?${buildParams(token, dateRange, { level: 'account' })}`),
    // Same range but daily breakdown for charts
    fetch(`${FB_API}/act_${accountId}/insights?${buildParams(token, dateRange, { level: 'account' })}`),
    fetch(`${FB_API}/act_${accountId}/insights?${buildParams(token, dateRange, { level: 'campaign', fields: `${AD_FIELDS},campaign_name` })}`),
    fetch(`${FB_API}/act_${accountId}/insights?${buildParams(token, dateRange, { level: 'ad', fields: `${AD_FIELDS},ad_name,campaign_name,campaign_id` })}`),
  ])

  if (!acctRes.ok) {
    const err = await acctRes.json()
    return NextResponse.json({ error: err?.error?.message ?? 'Facebook API error' }, { status: 400 })
  }

  const [acctJson, dailyJson, campaignJson, adJson] = await Promise.all([
    acctRes.json(),
    acctDailyRes.json(),
    campaignRes.json(),
    adRes.json(),
  ])

  // ── Today's spend ─────────────────────────────────────────────────────────
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayRes = await fetch(
    `${FB_API}/act_${accountId}/insights?${buildParams(token, { date_preset: 'today' }, { level: 'account' })}`
  )
  const todayJson = todayRes.ok ? await todayRes.json() : { data: [] }
  const todaySpend = parseFloat(todayJson.data?.[0]?.spend ?? '0')

  // ── Prior period for deltas ───────────────────────────────────────────────
  // Build a prior period of the same length
  const priorPreset = preset === 'today' ? 'yesterday' : preset === 'last_7d' ? 'last_7d' : 'last_30_days'
  const priorDateRange = preset === 'last_30d'
    ? { since: format(subDays(new Date(), 60), 'yyyy-MM-dd'), until: format(subDays(new Date(), 31), 'yyyy-MM-dd') }
    : preset === 'last_7d'
    ? { since: format(subDays(new Date(), 14), 'yyyy-MM-dd'), until: format(subDays(new Date(), 8), 'yyyy-MM-dd') }
    : { date_preset: priorPreset }

  const priorRes = await fetch(`${FB_API}/act_${accountId}/insights?${buildParams(token, priorDateRange, { level: 'account' })}`)
  const priorJson = priorRes.ok ? await priorRes.json() : { data: [] }

  // Process account summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acctData: any[] = acctJson.data ?? []
  const acctSummary = sumInsights(acctData)
  const avgFreq = acctData.length ? acctData.reduce((s: number, r: { frequency?: string }) => s + parseFloat(r.frequency || '0'), 0) / acctData.length : 0
  const avgCpm = acctData.length ? acctData.reduce((s: number, r: { cpm?: string }) => s + parseFloat(r.cpm || '0'), 0) / acctData.length : 0
  const cpl = acctSummary.leads > 0 ? acctSummary.spend / acctSummary.leads : 0

  // Prior period summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priorData: any[] = priorJson.data ?? []
  const priorSummary = sumInsights(priorData)
  const priorCpm = priorData.length ? priorData.reduce((s: number, r: { cpm?: string }) => s + parseFloat(r.cpm || '0'), 0) / priorData.length : 0
  const priorCpl = priorSummary.leads > 0 ? priorSummary.spend / priorSummary.leads : 0

  // Daily time-series for charts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyData: any[] = (dailyJson.data ?? []).map((row: any) => ({
    date: row.date_start,
    spend: parseFloat(row.spend || '0'),
    impressions: parseInt(row.impressions || '0'),
    clicks: parseInt(row.clicks || '0'),
    leads: extractLeads(row.actions),
    cpm: parseFloat(row.cpm || '0'),
    cpp: parseFloat(row.cpp || '0'),
    frequency: parseFloat(row.frequency || '0'),
    reach: parseInt(row.reach || '0'),
    cpl: extractLeads(row.actions) > 0 ? parseFloat(row.spend || '0') / extractLeads(row.actions) : 0,
  })).sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

  // Campaign breakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const campaigns = (campaignJson.data ?? []).map((c: any) => ({
    id: c.campaign_id ?? '',
    name: c.campaign_name ?? 'Unknown Campaign',
    spend: parseFloat(c.spend || '0'),
    impressions: parseInt(c.impressions || '0'),
    clicks: parseInt(c.clicks || '0'),
    leads: extractLeads(c.actions),
    cpm: parseFloat(c.cpm || '0'),
    frequency: parseFloat(c.frequency || '0'),
    cpl: extractLeads(c.actions) > 0 ? parseFloat(c.spend || '0') / extractLeads(c.actions) : 0,
  }))

  // Ad-level breakdown (for creative chart)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ads = (adJson.data ?? []).map((a: any) => ({
    id: a.ad_id ?? '',
    name: a.ad_name ?? 'Unknown Ad',
    campaignId: a.campaign_id ?? '',
    campaignName: a.campaign_name ?? '',
    spend: parseFloat(a.spend || '0'),
    impressions: parseInt(a.impressions || '0'),
    clicks: parseInt(a.clicks || '0'),
    leads: extractLeads(a.actions),
    cpm: parseFloat(a.cpm || '0'),
    frequency: parseFloat(a.frequency || '0'),
    cpl: extractLeads(a.actions) > 0 ? parseFloat(a.spend || '0') / extractLeads(a.actions) : 0,
  })).sort((a: { cpl: number }, b: { cpl: number }) => a.cpl - b.cpl)

  return NextResponse.json({
    account: {
      spend: acctSummary.spend,
      impressions: acctSummary.impressions,
      clicks: acctSummary.clicks,
      leads: acctSummary.leads,
      reach: acctSummary.reach,
      frequency: avgFreq,
      cpm: avgCpm,
      cpl,
      todaySpend,
    },
    prior: {
      spend: priorSummary.spend,
      leads: priorSummary.leads,
      cpm: priorCpm,
      cpl: priorCpl,
    },
    daily: dailyData,
    campaigns,
    ads,
    fetchedAt: new Date().toISOString(),
  })
}
