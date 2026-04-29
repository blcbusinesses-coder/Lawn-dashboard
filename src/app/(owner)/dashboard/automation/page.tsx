'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingTier {
  max_sqft: number
  price: number
  label: string
}

interface GrassRatioTier {
  max_sqft: number
  ratio: number
  label: string
}

interface SettingsMap {
  pricing_tiers: PricingTier[]
  grass_ratio_tiers: GrassRatioTier[]
  fallback_price: number
  over_one_acre_price: number
  sms_signature: string
  apify_actor: string
  drive_surcharge_miles: number
  drive_surcharge_amount: number
}

interface LogEntry {
  id: string
  lead_id: string | null
  event_type: string
  status: 'success' | 'failed' | 'skipped'
  details: Record<string, unknown> | null
  duration_ms: number | null
  created_at: string
  leads: { name: string; phone: string; address: string } | null
}

interface Lead {
  id: string
  name: string
  phone: string
  address: string
  status: string
  lot_size_sqft: number | null
  quoted_amount: number | null
  created_at: string
  quote_sent_at: string | null
  quote_source?: string
  addons?: AddonOption[] | null
  chosen_start_day?: string | null
}

interface AddonOption {
  key: string
  label: string
  price: number
  description: string
}

interface AvailabilityDate {
  id: string
  available_date: string
  notes: string | null
  is_full: boolean
  created_at?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === 'success') return 'bg-green-100 text-green-700 border-green-200'
  if (status === 'failed') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-zinc-100 text-zinc-600 border-zinc-200'
}

function leadStatusColor(status: string) {
  const map: Record<string, string> = {
    new: 'bg-zinc-100 text-zinc-600',
    quoted: 'bg-blue-100 text-blue-700',
    converted: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-600',
  }
  return map[status] ?? 'bg-zinc-100 text-zinc-600'
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [settings, setSettings] = useState<SettingsMap | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [availDates, setAvailDates] = useState<AvailabilityDate[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Availability date management
  const [newDate, setNewDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [addingDate, setAddingDate] = useState(false)

  // Editable copies of settings
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [ratioTiers, setRatioTiers] = useState<GrassRatioTier[]>([])
  const [fallback, setFallback] = useState('')
  const [overAcre, setOverAcre] = useState('')
  const [signature, setSignature] = useState('')
  const [actor, setActor] = useState('')
  const [surchargeThreshold, setSurchargeThreshold] = useState('')
  const [surchargeAmount, setSurchargeAmount] = useState('')

  // Active tab
  const [tab, setTab] = useState<'pricing' | 'leads' | 'quote_leads' | 'logs' | 'config'>('pricing')

  const load = useCallback(async () => {
    const [settRes, logRes, leadRes, availRes] = await Promise.all([
      fetch('/api/automation/settings'),
      fetch('/api/automation/logs?limit=200'),
      fetch('/api/leads'),
      fetch('/api/availability'),
    ])
    if (settRes.ok) {
      const { map } = await settRes.json() as { map: SettingsMap }
      setSettings(map)
      setTiers(map.pricing_tiers ?? [])
      setRatioTiers(map.grass_ratio_tiers ?? [])
      setFallback(String(map.fallback_price ?? 55))
      setOverAcre(String(map.over_one_acre_price ?? 165))
      setSignature(String(map.sms_signature ?? ''))
      setActor(String(map.apify_actor ?? ''))
      setSurchargeThreshold(String(map.drive_surcharge_miles ?? 12))
      setSurchargeAmount(String(map.drive_surcharge_amount ?? 5))
    }
    if (logRes.ok) setLogs(await logRes.json())
    if (leadRes.ok) setLeads(await leadRes.json())
    if (availRes.ok) setAvailDates(await availRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveSetting(key: string, value: unknown) {
    setSavingKey(key)
    const res = await fetch('/api/automation/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    setSavingKey(null)
    if (res.ok) { toast.success('Saved'); load() }
    else toast.error('Failed to save')
  }

  function updateTier(idx: number, field: keyof PricingTier, raw: string) {
    setTiers((prev) => {
      const next = [...prev]
      if (field === 'label') next[idx] = { ...next[idx], label: raw }
      else next[idx] = { ...next[idx], [field]: parseFloat(raw) || 0 }
      return next
    })
  }

  function addTier() {
    setTiers((prev) => [...prev, { max_sqft: 0, price: 0, label: 'New tier' }])
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateRatioTier(idx: number, field: keyof GrassRatioTier, raw: string) {
    setRatioTiers((prev) => {
      const next = [...prev]
      if (field === 'label') next[idx] = { ...next[idx], label: raw }
      else next[idx] = { ...next[idx], [field]: parseFloat(raw) || 0 }
      return next
    })
  }

  function addRatioTier() {
    setRatioTiers((prev) => [...prev, { max_sqft: 0, ratio: 0.70, label: 'New tier' }])
  }

  function removeRatioTier(idx: number) {
    setRatioTiers((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Availability helpers ───────────────────────────────────────────────────
  async function addAvailDate() {
    if (!newDate) return
    setAddingDate(true)
    const res = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available_date: newDate, notes: newNotes.trim() || null }),
    })
    setAddingDate(false)
    if (res.ok) {
      toast.success('Date added')
      setNewDate('')
      setNewNotes('')
      const fresh = await fetch('/api/availability')
      if (fresh.ok) setAvailDates(await fresh.json())
    } else {
      toast.error('Failed to add date')
    }
  }

  async function toggleFull(id: string, current: boolean) {
    const res = await fetch('/api/availability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_full: !current }),
    })
    if (res.ok) {
      setAvailDates((prev) => prev.map((d) => d.id === id ? { ...d, is_full: !current } : d))
    } else {
      toast.error('Failed to update')
    }
  }

  async function removeAvailDate(id: string) {
    const res = await fetch(`/api/availability?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAvailDates((prev) => prev.filter((d) => d.id !== id))
      toast.success('Date removed')
    } else {
      toast.error('Failed to remove date')
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalLeads = leads.length
  const quoteLeads = leads.filter((l) => l.quote_source === 'self_service')
  const quotedLeads = leads.filter((l) => l.status === 'quoted' || l.status === 'converted').length
  const convertedLeads = leads.filter((l) => l.status === 'converted').length
  const conversionRate = quotedLeads ? Math.round((convertedLeads / quotedLeads) * 100) : 0

  const successLogs = logs.filter((l) => l.status === 'success').length
  const failedLogs = logs.filter((l) => l.status === 'failed').length
  const avgDuration = logs.filter((l) => l.duration_ms).length
    ? Math.round(logs.filter((l) => l.duration_ms).reduce((s, l) => s + (l.duration_ms ?? 0), 0) / logs.filter((l) => l.duration_ms).length)
    : 0

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 bg-zinc-100 rounded w-48 animate-pulse mb-2" />
        <div className="h-4 bg-zinc-100 rounded w-72 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Automation</h1>
          <p className="text-sm text-zinc-500 mt-1">Quote funnel settings, pricing, and run logs</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>↻ Refresh</Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: totalLeads, sub: 'from quote form' },
          { label: 'Quoted', value: quotedLeads, sub: 'SMS sent' },
          { label: 'Converted', value: convertedLeads, sub: `${conversionRate}% rate` },
          { label: 'Avg Lookup Time', value: avgDuration ? `${(avgDuration / 1000).toFixed(1)}s` : '—', sub: `${successLogs} ok · ${failedLogs} failed` },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">{card.label}</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{card.value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 flex-wrap">
        {(['pricing', 'leads', 'quote_leads', 'logs', 'config'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {t === 'pricing'      ? '💰 Pricing'
             : t === 'leads'      ? '📋 Leads'
             : t === 'quote_leads'? `🌿 Quote Leads${quoteLeads.length ? ` (${quoteLeads.length})` : ''}`
             : t === 'logs'       ? '📊 Run Logs'
             :                      '⚙️ Config'}
          </button>
        ))}
      </div>

      {/* ── PRICING TAB ─────────────────────────────────────────────────────── */}
      {tab === 'pricing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-zinc-900">Price Tiers by Lot Size</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Apify returns the lot size in sqft — we pick the matching tier.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addTier}>+ Add Tier</Button>
                <Button
                  size="sm"
                  onClick={() => saveSetting('pricing_tiers', tiers)}
                  disabled={savingKey === 'pricing_tiers'}
                >
                  {savingKey === 'pricing_tiers' ? 'Saving…' : 'Save Tiers'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-1 text-xs text-zinc-400 font-medium uppercase tracking-wide">
                <div className="col-span-4">Label</div>
                <div className="col-span-3">Max Lot Size (sqft)</div>
                <div className="col-span-3">Price / Mow ($)</div>
                <div className="col-span-2" />
              </div>

              {tiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Input
                      value={tier.label}
                      onChange={(e) => updateTier(idx, 'label', e.target.value)}
                      placeholder="e.g. Small yard"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={tier.max_sqft}
                      onChange={(e) => updateTier(idx, 'max_sqft', e.target.value)}
                      placeholder="6000"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={tier.price}
                      onChange={(e) => updateTier(idx, 'price', e.target.value)}
                      placeholder="55"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => removeTier(idx)}
                      className="text-zinc-300 hover:text-red-400 transition-colors px-2"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grass ratio tiers */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="font-semibold text-zinc-900">Grass Area Ratio by Lot Size</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Formula: <code className="bg-zinc-100 px-1 rounded">(lot − house footprint) × ratio = mowable sqft</code>
                  &nbsp;— bigger lots get a higher ratio since driveways &amp; patios are a smaller share of total area.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addRatioTier}>+ Add</Button>
                <Button
                  size="sm"
                  onClick={() => saveSetting('grass_ratio_tiers', ratioTiers)}
                  disabled={savingKey === 'grass_ratio_tiers'}
                >
                  {savingKey === 'grass_ratio_tiers' ? 'Saving…' : 'Save Ratios'}
                </Button>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <div className="grid grid-cols-12 gap-2 px-1 text-xs text-zinc-400 font-medium uppercase tracking-wide">
                <div className="col-span-4">Label</div>
                <div className="col-span-3">Max Lot Size (sqft)</div>
                <div className="col-span-3">Grass Ratio (0–1)</div>
                <div className="col-span-2" />
              </div>

              {ratioTiers.map((tier, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Input
                      value={tier.label}
                      onChange={(e) => updateRatioTier(idx, 'label', e.target.value)}
                      placeholder="e.g. Medium yard"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      value={tier.max_sqft}
                      onChange={(e) => updateRatioTier(idx, 'max_sqft', e.target.value)}
                      placeholder="10000"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={tier.ratio}
                      onChange={(e) => updateRatioTier(idx, 'ratio', e.target.value)}
                      placeholder="0.70"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      onClick={() => removeRatioTier(idx)}
                      className="text-zinc-300 hover:text-red-400 transition-colors px-2"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}

              {ratioTiers.length === 0 && (
                <p className="text-xs text-zinc-400 px-1 py-2">No ratio tiers — add one or run the SQL seed below.</p>
              )}
            </div>
          </div>

          {/* Fallback + over 1 acre */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <Label className="text-sm font-semibold">Fallback Price (unknown lot size)</Label>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">Used when Apify can&apos;t find the property</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={fallback}
                  onChange={(e) => setFallback(e.target.value)}
                  placeholder="55"
                  className="w-32"
                />
                <Button
                  size="sm"
                  onClick={() => saveSetting('fallback_price', parseFloat(fallback))}
                  disabled={savingKey === 'fallback_price'}
                >
                  {savingKey === 'fallback_price' ? '…' : 'Save'}
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-5">
              <Label className="text-sm font-semibold">Over 1 Acre Price</Label>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">Lots larger than 43,560 sqft</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={overAcre}
                  onChange={(e) => setOverAcre(e.target.value)}
                  placeholder="165"
                  className="w-32"
                />
                <Button
                  size="sm"
                  onClick={() => saveSetting('over_one_acre_price', parseFloat(overAcre))}
                  disabled={savingKey === 'over_one_acre_price'}
                >
                  {savingKey === 'over_one_acre_price' ? '…' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LEADS TAB ───────────────────────────────────────────────────────── */}
      {tab === 'leads' && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Address</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Lot Size</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Quote</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">No leads yet — share your /quote page!</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{lead.name}</td>
                    <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">{lead.address}</td>
                    <td className="px-4 py-3 text-zinc-600">{lead.phone}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {lead.lot_size_sqft ? `${lead.lot_size_sqft.toLocaleString()} sqft` : <span className="text-zinc-300">unknown</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {lead.quoted_amount ? `$${lead.quoted_amount}` : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${leadStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {format(new Date(lead.created_at), 'MMM d, h:mm a')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── QUOTE LEADS TAB ─────────────────────────────────────────────────── */}
      {tab === 'quote_leads' && (
        <div className="space-y-6">
          {/* Self-service lead submissions */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-zinc-900">Self-Service Quote Submissions</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Customers who completed the quote flow at <span className="font-mono">/get-a-quote</span></p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                {quoteLeads.length} {quoteLeads.length === 1 ? 'lead' : 'leads'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Address</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Yard Size</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Total Quote</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Add-ons</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Start Day</th>
                    <th className="text-left px-4 py-3 font-medium text-zinc-600 whitespace-nowrap">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-zinc-400">
                        <p className="text-2xl mb-2">🌿</p>
                        <p className="font-medium">No quote submissions yet</p>
                        <p className="text-xs mt-1">Share <span className="font-mono">/get-a-quote</span> with potential customers</p>
                      </td>
                    </tr>
                  ) : (
                    quoteLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">{lead.name}</td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{lead.phone}</td>
                        <td className="px-4 py-3 text-zinc-600 max-w-[200px] truncate">{lead.address}</td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                          {lead.lot_size_sqft
                            ? `${lead.lot_size_sqft.toLocaleString()} sqft`
                            : <span className="text-zinc-300">unknown</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900 whitespace-nowrap">
                          {lead.quoted_amount != null ? `$${lead.quoted_amount}` : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {lead.addons && lead.addons.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {lead.addons.map((a) => (
                                <span key={a.key} className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">
                                  {a.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-300 text-xs">none</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                          {lead.chosen_start_day
                            ? format(new Date(lead.chosen_start_day + 'T12:00:00'), 'EEE, MMM d')
                            : <span className="text-zinc-300">not chosen</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                          {format(new Date(lead.created_at), 'MMM d, h:mm a')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Available Start Days Management */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-zinc-900">Available Start Days</h2>
                <p className="text-xs text-zinc-400 mt-0.5">These dates appear on the public quote page — customers pick their first mow day.</p>
              </div>
              <a
                href="/get-a-quote"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-zinc-700 underline underline-offset-2 transition-colors"
              >
                Preview quote page ↗
              </a>
            </div>

            {/* Add new date */}
            <div className="flex gap-2 mb-5 pb-5 border-b border-zinc-100">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={addAvailDate}
                disabled={!newDate || addingDate}
              >
                {addingDate ? 'Adding…' : '+ Add Date'}
              </Button>
            </div>

            {/* Dates list */}
            {availDates.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">
                No available dates set — add one above so customers can book a start day.
              </p>
            ) : (
              <div className="space-y-2">
                {availDates
                  .sort((a, b) => a.available_date.localeCompare(b.available_date))
                  .map((d) => {
                    const isPast = d.available_date < new Date().toISOString().split('T')[0]
                    return (
                      <div
                        key={d.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                          d.is_full
                            ? 'bg-zinc-50 border-zinc-200 opacity-60'
                            : isPast
                            ? 'bg-zinc-50 border-zinc-100 opacity-50'
                            : 'bg-green-50 border-green-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${d.is_full || isPast ? 'text-zinc-500' : 'text-zinc-900'}`}>
                            {format(new Date(d.available_date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                            {isPast && <span className="ml-2 text-xs text-zinc-400">(past)</span>}
                          </p>
                          {d.notes && <p className="text-xs text-zinc-400 mt-0.5 truncate">{d.notes}</p>}
                        </div>

                        <button
                          onClick={() => toggleFull(d.id, d.is_full)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                            d.is_full
                              ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                              : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          {d.is_full ? '🔴 Full' : '🟢 Open'}
                        </button>

                        <button
                          onClick={() => removeAvailDate(d.id)}
                          className="text-zinc-300 hover:text-red-400 transition-colors px-1 text-lg leading-none"
                          title="Remove date"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LOGS TAB ────────────────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Time</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Event</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Lead</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">No runs yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, h:mm:ss a')}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700">{log.event_type}</code>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {log.leads ? (
                        <div>
                          <p className="font-medium">{log.leads.name}</p>
                          <p className="text-zinc-400 truncate max-w-[140px]">{log.leads.address}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColor(log.status)}>{log.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {log.duration_ms != null ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400 max-w-[240px]">
                      {log.details && (
                        <details>
                          <summary className="cursor-pointer hover:text-zinc-600 truncate">
                            {log.status === 'success'
                              ? (log.details.mowable_sqft ?? log.details.lot_size_sqft)
                                ? `${Number(log.details.mowable_sqft ?? log.details.lot_size_sqft).toLocaleString()} mowable sqft → $${log.details.quote_amount ?? ''}`
                                : 'view'
                              : String(log.details.error ?? 'view')}
                          </summary>
                          <pre className="mt-1 bg-zinc-50 rounded p-2 text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CONFIG TAB ──────────────────────────────────────────────────────── */}
      {tab === 'config' && (
        <div className="space-y-4 max-w-lg">
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
            <h2 className="font-semibold text-zinc-900">SMS & Apify Configuration</h2>

            <div className="space-y-1.5">
              <Label>SMS Signature</Label>
              <p className="text-xs text-zinc-400">Appended to every outgoing quote message</p>
              <div className="flex gap-2">
                <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="– Gray Wolf Workers 🐺" className="flex-1" />
                <Button size="sm" onClick={() => saveSetting('sms_signature', signature)} disabled={savingKey === 'sms_signature'}>
                  {savingKey === 'sms_signature' ? '…' : 'Save'}
                </Button>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-700">Drive Surcharge</h3>
              <p className="text-xs text-zinc-400 -mt-2">Adds a flat fee when the property is beyond X miles from Kendallville.</p>

              <div className="space-y-1.5">
                <Label>Distance Threshold (miles)</Label>
                <p className="text-xs text-zinc-400">Properties farther than this from Kendallville, IN get the surcharge.</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={surchargeThreshold}
                    onChange={(e) => setSurchargeThreshold(e.target.value)}
                    placeholder="12"
                    className="w-32"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveSetting('drive_surcharge_miles', parseFloat(surchargeThreshold))}
                    disabled={savingKey === 'drive_surcharge_miles'}
                  >
                    {savingKey === 'drive_surcharge_miles' ? '…' : 'Save'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Surcharge Amount ($)</Label>
                <p className="text-xs text-zinc-400">Added to the quote if over the threshold.</p>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={surchargeAmount}
                    onChange={(e) => setSurchargeAmount(e.target.value)}
                    placeholder="5"
                    className="w-32"
                  />
                  <Button
                    size="sm"
                    onClick={() => saveSetting('drive_surcharge_amount', parseFloat(surchargeAmount))}
                    disabled={savingKey === 'drive_surcharge_amount'}
                  >
                    {savingKey === 'drive_surcharge_amount' ? '…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Apify Actor ID</Label>
              <p className="text-xs text-zinc-400">The Apify actor used to scrape Zillow property data. Paste the actor JSON input below to test.</p>
              <div className="flex gap-2">
                <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="maxcopell~zillow-scraper" className="flex-1 font-mono text-xs" />
                <Button size="sm" onClick={() => saveSetting('apify_actor', actor)} disabled={savingKey === 'apify_actor'}>
                  {savingKey === 'apify_actor' ? '…' : 'Save'}
                </Button>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4">
              <h3 className="text-sm font-medium text-zinc-700 mb-2">Test Property Lookup</h3>
              <TestLookup />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800 mb-1">📋 Share Your Quote Form</p>
            <p className="text-xs text-amber-700 mb-2">Send this link to potential customers:</p>
            <code className="block text-xs bg-white border border-amber-200 rounded px-3 py-2 text-zinc-700 break-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/get-a-quote
            </code>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inline test component ─────────────────────────────────────────────────────

function TestLookup() {
  const [addr, setAddr] = useState('')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!addr.trim()) return
    setRunning(true); setResult(null); setError('')
    try {
      // Create a throwaway lead to test the pipeline
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Lead', phone: '+15550000000', address: addr }),
      })
      if (!leadRes.ok) throw new Error('Failed to create test lead')
      const lead = await leadRes.json()

      const quoteRes = await fetch(`/api/leads/${lead.id}/quote`, { method: 'POST' })
      if (!quoteRes.ok) throw new Error('Quote failed')
      setResult(await quoteRes.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="1234 Oak St, Dallas TX 75201"
          className="flex-1 text-sm"
        />
        <Button size="sm" onClick={run} disabled={running || !addr.trim()}>
          {running ? 'Running…' : 'Test'}
        </Button>
      </div>
      <p className="text-xs text-zinc-400">⚠️ This sends a real SMS to +15550000000 (test number) — no charge but logs a run.</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {result && (
        <pre className="text-xs bg-zinc-50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
