'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Calculator, MapPin, Plus, Trash2, Send, FileText, RefreshCw,
  Home, Wrench, Check, X, Save, DollarSign, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ───────────────────────────────────────────────────────────────────

interface JobType {
  key: string
  label: string
  hourly: number
  default_hours: number
  materials: number
}

interface Config {
  job_types: JobType[]
  drive_rate: number
  valid_days: number
}

interface LineItem {
  description: string
  quantity: number
  unit_price: number
}

interface Customer {
  id: string
  full_name: string
  email: string | null
}

interface EstimateRow {
  id: string
  customer_name: string
  customer_email: string | null
  address: string | null
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  subtotal: number
  cac_amount: number
  total_amount: number
  valid_until: string | null
  sent_at: string | null
  created_at: string
  estimate_line_items: { description: string; quantity: number; unit_price: number; line_total: number }[]
}

interface LawnResult {
  address: string
  lot_size_sqft: number | null
  mowable_sqft: number | null
  base_price: number
  drive_surcharge: number
  detected_city: string | null
  distance_miles: number | null
  total_price: number
  confidence: 'measured' | 'estimate'
}

const STATUS_BADGE: Record<string, string> = {
  draft:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  sent:     'bg-blue-100 text-blue-700 border-blue-200',
  accepted: 'bg-green-100 text-green-700 border-green-200',
  declined: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

function money(n: number) {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EstimatesPage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [estimates, setEstimates] = useState<EstimateRow[]>([])
  const [loading, setLoading] = useState(true)

  // Calculator mode
  const [mode, setMode] = useState<'lawn' | 'custom'>('lawn')

  // Lawn calculator
  const [lawnAddress, setLawnAddress] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [lawnResult, setLawnResult] = useState<LawnResult | null>(null)

  // Custom job calculator
  const [jobKey, setJobKey] = useState('')
  const [hours, setHours] = useState('2')
  const [workers, setWorkers] = useState('1')
  const [hourly, setHourly] = useState('60')
  const [materials, setMaterials] = useState('0')
  const [driveMinutes, setDriveMinutes] = useState('0')

  // CAC
  const [cacEnabled, setCacEnabled] = useState(false)
  const [cacAmount, setCacAmount] = useState('0')

  // Estimate builder
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [estAddress, setEstAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, custRes, estRes] = await Promise.all([
        fetch('/api/estimates/config'),
        fetch('/api/customers'),
        fetch('/api/estimates'),
      ])
      if (cfgRes.ok) {
        const cfg: Config = await cfgRes.json()
        setConfig(cfg)
        if (cfg.job_types.length && !jobKey) {
          const first = cfg.job_types[0]
          setJobKey(first.key)
          setHours(String(first.default_hours))
          setHourly(String(first.hourly))
          setMaterials(String(first.materials))
        }
      }
      if (custRes.ok) setCustomers(await custRes.json())
      if (estRes.ok) setEstimates(await estRes.json())
    } finally {
      setLoading(false)
    }
  }, [jobKey])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep job-type defaults in sync when the user switches job type.
  function selectJobType(key: string) {
    setJobKey(key)
    const jt = config?.job_types.find(j => j.key === key)
    if (jt) {
      setHours(String(jt.default_hours))
      setHourly(String(jt.hourly))
      setMaterials(String(jt.materials))
    }
  }

  // ── Calculator math ─────────────────────────────────────────────────────────
  const driveRate = config?.drive_rate ?? 45
  const customLabor = (Number(hours) || 0) * (Number(workers) || 1) * (Number(hourly) || 0)
  const customDrive = ((Number(driveMinutes) || 0) / 60) * driveRate
  const customMaterials = Number(materials) || 0
  const customTotal = Math.round((customLabor + customDrive + customMaterials) * 100) / 100

  async function lookupLawn() {
    if (!lawnAddress.trim()) { toast.error('Enter an address first'); return }
    setLookingUp(true)
    setLawnResult(null)
    try {
      const res = await fetch('/api/quote/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: lawnAddress.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setLawnResult(data)
        if (!estAddress) setEstAddress(data.address)
      } else {
        toast.error(data.error ?? 'Lookup failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLookingUp(false)
    }
  }

  function addLawnLine() {
    if (!lawnResult) return
    const desc = `Lawn mowing — ${lawnResult.address}${lawnResult.mowable_sqft ? ` (~${lawnResult.mowable_sqft.toLocaleString()} sq ft mowable)` : ''}`
    setLineItems(prev => [...prev, { description: desc, quantity: 1, unit_price: lawnResult.total_price }])
    if (!estAddress) setEstAddress(lawnResult.address)
    toast.success('Added to estimate')
  }

  function addCustomLine() {
    const jt = config?.job_types.find(j => j.key === jobKey)
    const label = jt?.label ?? 'Custom job'
    const parts: string[] = [`${hours} hr${Number(hours) === 1 ? '' : 's'}`]
    if ((Number(workers) || 1) > 1) parts.push(`${workers} crew`)
    if (customMaterials > 0) parts.push(`${money(customMaterials)} materials`)
    if (customDrive > 0) parts.push(`${driveMinutes} min drive`)
    const desc = `${label} (${parts.join(', ')})`
    setLineItems(prev => [...prev, { description: desc, quantity: 1, unit_price: customTotal }])
    toast.success('Added to estimate')
  }

  function addBlankLine() {
    setLineItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }])
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLineItems(prev => prev.map((li, idx) => idx === i ? { ...li, ...patch } : li))
  }

  function removeLine(i: number) {
    setLineItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function pickCustomer(id: string) {
    setCustomerId(id || null)
    const c = customers.find(c => c.id === id)
    if (c) {
      setCustomerName(c.full_name)
      if (c.email) setCustomerEmail(c.email)
    }
  }

  const subtotal = lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0)
  const cac = cacEnabled ? Math.max(0, Number(cacAmount) || 0) : 0
  const grandTotal = Math.round((subtotal + cac) * 100) / 100

  function resetBuilder() {
    setCustomerName(''); setCustomerEmail(''); setCustomerId(null); setEstAddress('')
    setNotes(''); setLineItems([]); setCacEnabled(false); setCacAmount('0'); setLawnResult(null)
  }

  async function createEstimate(send: boolean): Promise<void> {
    if (!customerName.trim()) { toast.error('Add a customer name'); return }
    if (send && !customerEmail.trim()) { toast.error('A customer email is required to send'); return }
    if (!lineItems.length) { toast.error('Add at least one line item'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          customer_name: customerName.trim(),
          customer_email: customerEmail.trim() || null,
          address: estAddress.trim() || null,
          job_type: mode === 'lawn' ? 'lawn_mowing' : (config?.job_types.find(j => j.key === jobKey)?.label ?? 'custom'),
          notes: notes.trim() || null,
          cac_amount: cac,
          valid_days: config?.valid_days ?? 30,
          line_items: lineItems.map(li => ({
            description: li.description || 'Service',
            quantity: Number(li.quantity) || 1,
            unit_price: Number(li.unit_price) || 0,
          })),
          property_data: lawnResult ?? null,
        }),
      })
      const created = await res.json()
      if (!res.ok) { toast.error(created.error ?? 'Failed to save'); return }

      if (send) {
        const sendRes = await fetch(`/api/estimates/${created.id}/send`, { method: 'POST' })
        const sendData = await sendRes.json()
        if (!sendRes.ok) {
          toast.error(sendData.error ?? 'Saved as draft, but sending failed')
        } else {
          toast.success(`Estimate sent to ${customerEmail}`)
        }
      } else {
        toast.success('Estimate saved as draft')
      }
      resetBuilder()
      load()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function sendExisting(id: string, email: string | null) {
    if (!email) { toast.error('This estimate has no email'); return }
    const res = await fetch(`/api/estimates/${id}/send`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) { toast.success('Estimate sent'); load() }
    else toast.error(data.error ?? 'Failed to send')
  }

  async function setStatus(id: string, status: string) {
    setEstimates(prev => prev.map(e => e.id === id ? { ...e, status: status as EstimateRow['status'] } : e))
    await fetch(`/api/estimates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  async function deleteEstimate(id: string) {
    if (!confirm('Delete this estimate?')) return
    setEstimates(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/estimates/${id}`, { method: 'DELETE' })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <FileText size={22} className="text-green-600" /> Estimates
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Price a lawn or custom job, then send a professional estimate.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Calculator ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} className="text-zinc-700" />
            <h2 className="font-semibold text-zinc-900">Price Calculator</h2>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              onClick={() => setMode('lawn')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                mode === 'lawn' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Home size={15} /> Lawn (auto)
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border transition-colors ${
                mode === 'custom' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Wrench size={15} /> Custom job
            </button>
          </div>

          {/* Lawn mode */}
          {mode === 'lawn' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Property address</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={lawnAddress}
                    onChange={e => setLawnAddress(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') lookupLawn() }}
                    placeholder="123 Main St, Kendallville, IN"
                  />
                  <Button onClick={lookupLawn} disabled={lookingUp} className="gap-1.5 shrink-0">
                    {lookingUp ? <RefreshCw size={14} className="animate-spin" /> : <MapPin size={14} />}
                    Look up
                  </Button>
                </div>
                <p className="text-xs text-zinc-400 mt-1">Pulls lot size from Zillow and auto-prices the mow.</p>
              </div>

              {lawnResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-900">{lawnResult.address}</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${
                      lawnResult.confidence === 'measured'
                        ? 'bg-white text-green-700 border-green-300'
                        : 'bg-white text-amber-700 border-amber-300'
                    }`}>
                      {lawnResult.confidence === 'measured' ? 'Measured' : 'Estimate'}
                    </span>
                  </div>
                  <div className="text-xs text-green-800 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {lawnResult.lot_size_sqft != null && <span>Lot: {lawnResult.lot_size_sqft.toLocaleString()} sq ft</span>}
                    {lawnResult.mowable_sqft != null && <span>Mowable: ~{lawnResult.mowable_sqft.toLocaleString()} sq ft</span>}
                    <span>Base: {money(lawnResult.base_price)}</span>
                    {lawnResult.drive_surcharge > 0 && <span>Drive: +{money(lawnResult.drive_surcharge)}{lawnResult.detected_city ? ` (${lawnResult.detected_city})` : ''}</span>}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-green-200">
                    <span className="text-lg font-bold text-green-700">{money(lawnResult.total_price)}<span className="text-xs font-normal text-green-600">/mow</span></span>
                    <Button size="sm" onClick={addLawnLine} className="h-8 gap-1.5"><Plus size={13} /> Add to estimate</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom mode */}
          {mode === 'custom' && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Job type</Label>
                <select
                  value={jobKey}
                  onChange={e => selectJobType(e.target.value)}
                  className="mt-1 w-full h-9 px-2 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:border-zinc-400"
                >
                  {config?.job_types.map(jt => <option key={jt.key} value={jt.key}>{jt.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Labor hours</Label>
                  <Input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Crew size</Label>
                  <Input type="number" min="1" step="1" value={workers} onChange={e => setWorkers(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Rate ($/worker-hr)</Label>
                  <Input type="number" min="0" step="5" value={hourly} onChange={e => setHourly(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Materials ($)</Label>
                  <Input type="number" min="0" step="5" value={materials} onChange={e => setMaterials(e.target.value)} className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Drive time (min, round trip)</Label>
                  <Input type="number" min="0" step="5" value={driveMinutes} onChange={e => setDriveMinutes(e.target.value)} className="mt-1" />
                  <p className="text-[11px] text-zinc-400 mt-1">Drive cost = {money(driveRate)}/hr → {money(customDrive)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500 grid grid-cols-2 gap-x-4 gap-y-0.5 mb-1.5">
                  <span>Labor: {money(customLabor)}</span>
                  <span>Materials: {money(customMaterials)}</span>
                  <span>Drive: {money(customDrive)}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-zinc-200">
                  <span className="text-lg font-bold text-zinc-900">{money(customTotal)}</span>
                  <Button size="sm" onClick={addCustomLine} className="h-8 gap-1.5"><Plus size={13} /> Add to estimate</Button>
                </div>
              </div>
            </div>
          )}

          {/* CAC option */}
          <div className="mt-5 pt-4 border-t border-zinc-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cacEnabled} onChange={e => setCacEnabled(e.target.checked)} className="rounded border-zinc-300" />
              <span className="text-sm font-medium text-zinc-700 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-500" /> Add customer acquisition cost (CAC)
              </span>
            </label>
            {cacEnabled && (
              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1 max-w-[160px]">
                  <DollarSign size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input type="number" min="0" step="5" value={cacAmount} onChange={e => setCacAmount(e.target.value)} className="pl-7" />
                </div>
                <span className="text-xs text-zinc-400">Added to the estimate total.</span>
              </div>
            )}
          </div>
        </section>

        {/* ── Builder ────────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-zinc-700" />
            <h2 className="font-semibold text-zinc-900">Build & Send Estimate</h2>
          </div>

          {/* Customer */}
          <div className="space-y-3 mb-4">
            {customers.length > 0 && (
              <div>
                <Label className="text-xs">Existing customer (optional)</Label>
                <select
                  value={customerId ?? ''}
                  onChange={e => pickCustomer(e.target.value)}
                  className="mt-1 w-full h-9 px-2 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:border-zinc-400"
                >
                  <option value="">— New / prospect —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jane Doe" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jane@email.com" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Property address (shown on estimate)</Label>
              <Input value={estAddress} onChange={e => setEstAddress(e.target.value)} placeholder="123 Main St" className="mt-1" />
            </div>
          </div>

          {/* Line items */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Line items</Label>
              <Button size="sm" variant="outline" onClick={addBlankLine} className="h-7 px-2 text-xs gap-1"><Plus size={12} /> Add line</Button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center border border-dashed border-zinc-200 rounded-lg">
                Use the calculator to add priced lines, or add one manually.
              </p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Input
                      value={li.description}
                      onChange={e => updateLine(i, { description: e.target.value })}
                      placeholder="Description"
                      className="flex-1 h-8 text-sm"
                    />
                    <Input
                      type="number" min="1" value={li.quantity}
                      onChange={e => updateLine(i, { quantity: Number(e.target.value) })}
                      className="w-14 h-8 text-sm text-center" title="Qty"
                    />
                    <div className="relative w-24">
                      <DollarSign size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <Input
                        type="number" min="0" step="1" value={li.unit_price}
                        onChange={e => updateLine(i, { unit_price: Number(e.target.value) })}
                        className="pl-6 h-8 text-sm" title="Unit price"
                      />
                    </div>
                    <button onClick={() => removeLine(i)} className="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-red-500 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="mb-4">
            <Label className="text-xs">Intro message (optional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Leave blank for a friendly default greeting…"
              className="mt-1 text-sm"
            />
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 mb-4 text-sm">
            <div className="flex justify-between text-zinc-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {cac > 0 && <div className="flex justify-between text-zinc-600 mt-1"><span>Customer acquisition</span><span>{money(cac)}</span></div>}
            <div className="flex justify-between font-bold text-zinc-900 text-base mt-2 pt-2 border-t border-zinc-200">
              <span>Total</span><span className="text-green-700">{money(grandTotal)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => createEstimate(false)} disabled={saving} className="flex-1 gap-1.5">
              <Save size={14} /> Save draft
            </Button>
            <Button onClick={() => createEstimate(true)} disabled={saving} className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Create & send
            </Button>
          </div>
        </section>
      </div>

      {/* ── Recent estimates ───────────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="font-semibold text-zinc-900 mb-3">Recent estimates</h2>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : estimates.length === 0 ? (
          <div className="bg-white rounded-xl border border-zinc-200 py-12 text-center text-sm text-zinc-400">
            No estimates yet. Build one above.
          </div>
        ) : (
          <div className="space-y-2">
            {estimates.map(est => (
              <div key={est.id} className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-900">{est.customer_name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_BADGE[est.status]}`}>{est.status}</span>
                    {est.sent_at && <span className="text-xs text-zinc-400">sent {format(new Date(est.sent_at), 'MMM d')}</span>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {est.customer_email ?? 'no email'}{est.address ? ` · ${est.address}` : ''} · {est.estimate_line_items?.length ?? 0} item(s)
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-green-700">{money(est.total_amount)}</p>
                  {est.valid_until && <p className="text-[11px] text-zinc-400">valid to {format(new Date(est.valid_until + 'T12:00:00'), 'MMM d')}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {est.status !== 'accepted' && (
                    <button onClick={() => setStatus(est.id, 'accepted')} title="Mark accepted" className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-green-600 hover:bg-green-50"><Check size={14} /></button>
                  )}
                  {est.status !== 'declined' && (
                    <button onClick={() => setStatus(est.id, 'declined')} title="Mark declined" className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50"><X size={14} /></button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => sendExisting(est.id, est.customer_email)} className="h-8 px-2 text-xs gap-1" disabled={!est.customer_email}>
                    <Send size={12} /> {est.sent_at ? 'Resend' : 'Send'}
                  </Button>
                  <button onClick={() => deleteEstimate(est.id)} title="Delete" className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
