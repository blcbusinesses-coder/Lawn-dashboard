'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Users, DollarSign, Zap, Eye, Settings,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AccountMetrics {
  spend: number
  impressions: number
  clicks: number
  leads: number
  reach: number
  frequency: number
  cpm: number
  cpl: number
  todaySpend: number
}

interface PriorMetrics {
  spend: number
  leads: number
  cpm: number
  cpl: number
}

interface DailyPoint {
  date: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpm: number
  frequency: number
  reach: number
  cpl: number
}

interface AdRow {
  id: string
  name: string
  campaignId: string
  campaignName: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpm: number
  frequency: number
  cpl: number
}

interface MetricsData {
  account: AccountMetrics
  prior: PriorMetrics
  daily: DailyPoint[]
  ads: AdRow[]
  fetchedAt: string
}

interface Conversion {
  id: string
  lead_id: string | null
  conversation_id: string | null
  lead_name: string | null
  converted_at: string
  confidence_score: number | null
  ad_id: string | null
  ad_name: string | null
  ad_campaign_name: string | null
  cpl_at_conversion: number | null
  customer_status: 'auto_detected' | 'confirmed' | 'rejected'
}

interface AdsSettings {
  baselineCpl: number
  baselineCpm: number
  creativeStartDate: string
}

type Preset = 'today' | 'last_7d' | 'last_30d' | 'season'
type Urgency = 'green' | 'yellow' | 'red'

// ── Helpers ────────────────────────────────────────────────────────────────────

function delta(current: number, prior: number) {
  if (!prior) return null
  return (current - prior) / prior
}

function fmtDelta(d: number | null) {
  if (d === null) return '—'
  const sign = d >= 0 ? '+' : ''
  return `${sign}${(d * 100).toFixed(1)}%`
}

function fmtCurrency(v: number) {
  return `$${v.toFixed(2)}`
}

function fmtDate(dateStr: string) {
  try { return format(parseISO(dateStr), 'MMM d') } catch { return dateStr }
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, delta: d, icon: Icon, highlight,
}: {
  label: string
  value: string
  delta?: number | null
  icon: React.ElementType
  highlight?: 'red' | 'yellow' | 'green'
}) {
  const highlightClasses = {
    red: 'border-red-500/40 bg-red-950/20',
    yellow: 'border-yellow-500/40 bg-yellow-950/20',
    green: 'border-green-500/40 bg-green-950/20',
  }

  return (
    <Card className={`border-zinc-800 bg-zinc-900 ${highlight ? highlightClasses[highlight] : ''}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {d !== null && d !== undefined && (
              <p className={`text-xs mt-1 ${d >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {d >= 0 ? <TrendingUp className="inline w-3 h-3 mr-0.5" /> : <TrendingDown className="inline w-3 h-3 mr-0.5" />}
                {fmtDelta(d)} vs prior period
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${highlight === 'red' ? 'bg-red-900/40' : highlight === 'yellow' ? 'bg-yellow-900/40' : 'bg-zinc-800'}`}>
            <Icon size={18} className={highlight === 'red' ? 'text-red-400' : highlight === 'yellow' ? 'text-yellow-400' : 'text-zinc-400'} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Urgency Badge ──────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency === 'red') return <Badge className="bg-red-600 text-white border-0">Action Required</Badge>
  if (urgency === 'yellow') return <Badge className="bg-yellow-500 text-black border-0">Monitor Closely</Badge>
  return <Badge className="bg-green-600 text-white border-0">Performing Well</Badge>
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdsPage() {
  const [preset, setPreset] = useState<Preset>('last_30d')
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [insight, setInsight] = useState<string | null>(null)
  const [urgency, setUrgency] = useState<Urgency>('green')
  const [insightLoading, setInsightLoading] = useState(false)

  const [conversions, setConversions] = useState<Conversion[]>([])
  const [convsLoading, setConvsLoading] = useState(true)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<AdsSettings>({
    baselineCpl: 0,
    baselineCpm: 0,
    creativeStartDate: '',
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // ── Load settings ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/automation/settings')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setSettings({
          baselineCpl: parseFloat(data.baseline_cpl ?? '0') || 0,
          baselineCpm: parseFloat(data.baseline_cpm ?? '0') || 0,
          creativeStartDate: data.creative_start_date ?? '',
        })
      })
      .catch(() => {})
  }, [])

  // ── Fetch metrics ────────────────────────────────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ads/metrics?preset=${preset}`)
      const data = await res.json()
      if (data.error === 'not_configured') {
        setError('not_configured')
        setLoading(false)
        return
      }
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }
      setMetrics(data)
    } catch {
      setError('Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [preset])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  // ── Fetch AI insight ─────────────────────────────────────────────────────────
  const fetchInsight = useCallback(async (m: MetricsData) => {
    if (!m) return
    setInsightLoading(true)
    try {
      const res = await fetch('/api/ads/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: m.account,
          prior: m.prior,
          daily: m.daily,
          ads: m.ads,
          settings: {
            baselineCpl: settings.baselineCpl || 40,
            baselineCpm: settings.baselineCpm || 15,
            creativeStartDate: settings.creativeStartDate || undefined,
          },
        }),
      })
      const data = await res.json()
      setInsight(data.insight)
      setUrgency(data.urgency)
    } catch {
      setInsight(null)
    } finally {
      setInsightLoading(false)
    }
  }, [settings])

  useEffect(() => {
    if (metrics) fetchInsight(metrics)
  }, [metrics, fetchInsight])

  // ── Fetch conversions ────────────────────────────────────────────────────────
  useEffect(() => {
    setConvsLoading(true)
    fetch('/api/ads/conversions')
      .then((r) => r.json())
      .then((data) => setConversions(Array.isArray(data) ? data : []))
      .catch(() => setConversions([]))
      .finally(() => setConvsLoading(false))
  }, [])

  // ── Save settings ────────────────────────────────────────────────────────────
  async function saveSettings() {
    setSavingSettings(true)
    try {
      const pairs = [
        { key: 'baseline_cpl', value: String(settings.baselineCpl) },
        { key: 'baseline_cpm', value: String(settings.baselineCpm) },
        { key: 'creative_start_date', value: settings.creativeStartDate },
      ]
      await Promise.all(
        pairs.map((p) =>
          fetch('/api/automation/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          })
        )
      )
      toast.success('Settings saved')
      setSettingsOpen(false)
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  // ── Update conversion status ─────────────────────────────────────────────────
  async function updateStatus(id: string, status: 'confirmed' | 'rejected') {
    try {
      await fetch('/api/ads/conversions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, customer_status: status }),
      })
      setConversions((prev) => prev.map((c) => c.id === id ? { ...c, customer_status: status } : c))
      toast.success(status === 'confirmed' ? 'Marked as confirmed customer' : 'Marked as rejected')
    } catch {
      toast.error('Failed to update')
    }
  }

  // ── Not configured state ─────────────────────────────────────────────────────
  if (!loading && error === 'not_configured') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-16 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
          <Zap size={20} className="text-zinc-400" />
        </div>
        <h2 className="text-white font-semibold text-lg mb-2">Facebook Ads Not Connected</h2>
        <p className="text-zinc-400 text-sm mb-4">
          Add your Facebook Access Token and Ad Account ID in the Automation settings to start tracking ad performance.
        </p>
        <Button variant="outline" className="border-zinc-700" onClick={() => window.location.href = '/dashboard/automation'}>
          Go to Automation Settings
        </Button>
      </div>
    )
  }

  const acct = metrics?.account
  const prior = metrics?.prior
  const daily = metrics?.daily ?? []
  const ads = metrics?.ads ?? []

  const cplDelta = acct && prior ? delta(acct.cpl, prior.cpl) : null
  const cpmDelta = acct && prior ? delta(acct.cpm, prior.cpm) : null
  const leadsDelta = acct && prior ? delta(acct.leads, prior.leads) : null

  const freqHighlight: 'red' | 'yellow' | undefined =
    acct?.frequency && acct.frequency > 3.5 ? 'red' :
    acct?.frequency && acct.frequency > 2.5 ? 'yellow' :
    undefined

  const cplHighlight: 'red' | 'yellow' | undefined =
    (acct?.cpl && settings.baselineCpl > 0 && acct.cpl > settings.baselineCpl * 2) ? 'red' :
    (acct?.cpl && settings.baselineCpl > 0 && acct.cpl > settings.baselineCpl * 1.5) ? 'yellow' :
    undefined

  // ── Chart data ───────────────────────────────────────────────────────────────
  const chartData = daily.map((d) => ({
    ...d,
    dateLabel: fmtDate(d.date),
  }))

  const topAds = [...ads].filter((a) => a.leads > 0).slice(0, 6)

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white font-semibold text-xl">Ad Intelligence</h1>
          {metrics?.fetchedAt && (
            <p className="text-zinc-500 text-xs mt-0.5">
              Updated {format(new Date(metrics.fetchedAt), 'MMM d, h:mm a')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset tabs */}
          <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
            {(['today', 'last_7d', 'last_30d', 'season'] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === p ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p === 'today' ? 'Today' : p === 'last_7d' ? '7d' : p === 'last_30d' ? '30d' : 'Season'}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 gap-1.5"
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 gap-1.5"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Settings size={13} />
            Settings
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <Card className="border-zinc-700 bg-zinc-900">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm text-white">Ad Baseline Settings</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">Baseline CPL ($)</Label>
                <Input
                  type="number"
                  className="bg-zinc-800 border-zinc-700 text-white h-9"
                  value={settings.baselineCpl || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, baselineCpl: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g. 40"
                />
                <p className="text-zinc-600 text-xs">Your normal cost-per-lead target</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">Baseline CPM ($)</Label>
                <Input
                  type="number"
                  className="bg-zinc-800 border-zinc-700 text-white h-9"
                  value={settings.baselineCpm || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, baselineCpm: parseFloat(e.target.value) || 0 }))}
                  placeholder="e.g. 15"
                />
                <p className="text-zinc-600 text-xs">Your normal cost per 1,000 impressions</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">Creative Start Date</Label>
                <Input
                  type="date"
                  className="bg-zinc-800 border-zinc-700 text-white h-9"
                  value={settings.creativeStartDate}
                  onChange={(e) => setSettings((s) => ({ ...s, creativeStartDate: e.target.value }))}
                />
                <p className="text-zinc-600 text-xs">When current ad creative started running</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insight Banner */}
      {(insightLoading || insight) && (
        <Card className={`border ${
          urgency === 'red' ? 'border-red-500/50 bg-red-950/20' :
          urgency === 'yellow' ? 'border-yellow-500/50 bg-yellow-950/20' :
          'border-green-500/50 bg-green-950/20'
        }`}>
          <CardContent className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 ${
                urgency === 'red' ? 'text-red-400' :
                urgency === 'yellow' ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {urgency === 'red' ? <AlertTriangle size={18} /> :
                 urgency === 'yellow' ? <AlertTriangle size={18} /> :
                 <CheckCircle2 size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">AI Insight</span>
                  <UrgencyBadge urgency={urgency} />
                </div>
                {insightLoading ? (
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-full bg-zinc-700" />
                    <Skeleton className="h-4 w-3/4 bg-zinc-700" />
                  </div>
                ) : (
                  <p className="text-sm text-white leading-relaxed">{insight}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-zinc-800 bg-zinc-900">
              <CardContent className="pt-5 pb-4 px-5">
                <Skeleton className="h-4 w-20 bg-zinc-700 mb-2" />
                <Skeleton className="h-8 w-24 bg-zinc-700" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              label="Cost Per Lead"
              value={acct ? fmtCurrency(acct.cpl) : '—'}
              delta={cplDelta}
              icon={DollarSign}
              highlight={cplHighlight}
            />
            <StatCard
              label="Total Leads"
              value={acct ? String(acct.leads) : '—'}
              delta={leadsDelta}
              icon={Users}
            />
            <StatCard
              label="Frequency"
              value={acct ? acct.frequency.toFixed(2) : '—'}
              icon={Eye}
              highlight={freqHighlight}
            />
            <StatCard
              label="CPM"
              value={acct ? fmtCurrency(acct.cpm) : '—'}
              delta={cpmDelta}
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today's Spend", value: acct ? fmtCurrency(acct.todaySpend) : '—' },
          { label: 'Total Spend', value: acct ? fmtCurrency(acct.spend) : '—' },
          { label: 'Impressions', value: acct ? acct.impressions.toLocaleString() : '—' },
          { label: 'Reach', value: acct ? acct.reach.toLocaleString() : '—' },
        ].map(({ label, value }) => (
          <Card key={label} className="border-zinc-800 bg-zinc-900">
            <CardContent className="px-4 pt-4 pb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1">{label}</p>
              {loading ? <Skeleton className="h-6 w-16 bg-zinc-700" /> : <p className="text-lg font-bold text-white">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* CPL trend */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm text-white">CPL & Frequency Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loading ? (
              <Skeleton className="h-48 w-full bg-zinc-800 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#71717a' }} domain={[0, 6]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: 12 }}
                    labelStyle={{ color: '#e4e4e7' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
                  <Line yAxisId="left" type="monotone" dataKey="cpl" name="CPL ($)" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="frequency" name="Frequency" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily leads & spend */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm text-white">Daily Leads & Spend</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {loading ? (
              <Skeleton className="h-48 w-full bg-zinc-800 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#71717a' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: 12 }}
                    labelStyle={{ color: '#e4e4e7' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
                  <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#4ade80" radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="right" dataKey="spend" name="Spend ($)" fill="#818cf8" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CPM area chart */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm text-white">CPM Over Time (Audience Fatigue Indicator)</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {loading ? (
            <Skeleton className="h-40 w-full bg-zinc-800 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: 12 }}
                  labelStyle={{ color: '#e4e4e7' }}
                />
                <Area type="monotone" dataKey="cpm" name="CPM ($)" stroke="#f97316" strokeWidth={2} fill="url(#cpmGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ad Creative Breakdown */}
      {topAds.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm text-white">Ad Creative Performance</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left pb-2 pr-4">Ad Name</th>
                    <th className="text-right pb-2 px-3">Leads</th>
                    <th className="text-right pb-2 px-3">CPL</th>
                    <th className="text-right pb-2 px-3">Spend</th>
                    <th className="text-right pb-2 px-3">CPM</th>
                    <th className="text-right pb-2 pl-3">Frequency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {topAds.map((ad, i) => (
                    <tr key={ad.id} className="text-zinc-300 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span className="text-xs bg-green-900/60 text-green-400 px-1.5 py-0.5 rounded font-medium">Best</span>}
                          <span className="truncate max-w-[200px] text-xs">{ad.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-3">{ad.leads}</td>
                      <td className={`text-right py-2.5 px-3 font-medium ${
                        settings.baselineCpl > 0 && ad.cpl > settings.baselineCpl * 1.5 ? 'text-red-400' : 'text-white'
                      }`}>{fmtCurrency(ad.cpl)}</td>
                      <td className="text-right py-2.5 px-3">{fmtCurrency(ad.spend)}</td>
                      <td className="text-right py-2.5 px-3">{fmtCurrency(ad.cpm)}</td>
                      <td className={`text-right py-2.5 pl-3 ${ad.frequency > 3.5 ? 'text-red-400' : ad.frequency > 2.5 ? 'text-yellow-400' : ''}`}>
                        {ad.frequency.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversion Logger */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-white">Lead-to-Customer Conversions</CardTitle>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
              {conversions.filter((c) => c.customer_status !== 'rejected').length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {convsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-zinc-800" />)}
            </div>
          ) : conversions.length === 0 ? (
            <div className="text-center py-8">
              <Users size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No conversions recorded yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Conversions are auto-detected when leads agree to service via SMS chat.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left pb-2 pr-4">Lead</th>
                    <th className="text-left pb-2 pr-4">Ad</th>
                    <th className="text-right pb-2 px-3">Confidence</th>
                    <th className="text-right pb-2 px-3">Date</th>
                    <th className="text-right pb-2 pl-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {conversions.map((conv) => (
                    <tr key={conv.id} className="text-zinc-300 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-white text-xs">{conv.lead_name ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-xs text-zinc-400 truncate max-w-[160px]">{conv.ad_name ?? '—'}</td>
                      <td className="py-2.5 px-3 text-right text-xs">
                        {conv.confidence_score !== null
                          ? <span className={conv.confidence_score >= 0.9 ? 'text-green-400' : 'text-yellow-400'}>
                              {(conv.confidence_score * 100).toFixed(0)}%
                            </span>
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-zinc-400">
                        {conv.converted_at ? format(new Date(conv.converted_at), 'MMM d') : '—'}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {conv.customer_status === 'confirmed' ? (
                          <Badge className="bg-green-900/60 text-green-400 border-0 text-xs">Confirmed</Badge>
                        ) : conv.customer_status === 'rejected' ? (
                          <Badge className="bg-zinc-800 text-zinc-500 border-0 text-xs">Rejected</Badge>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => updateStatus(conv.id, 'confirmed')}
                              className="p-1 rounded hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-colors"
                              title="Confirm"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button
                              onClick={() => updateStatus(conv.id, 'rejected')}
                              className="p-1 rounded hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Reject"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error state */}
      {error && error !== 'not_configured' && (
        <Card className="border-red-900/50 bg-red-950/20">
          <CardContent className="px-5 py-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={16} />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
