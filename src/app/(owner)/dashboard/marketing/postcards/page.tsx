'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

import {
  Mail, RefreshCw, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Clock, Loader2, Send, Eye, History, Settings2,
  ArrowLeft, ArrowRight, Plus, Trash2, Zap, Database, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/currency'

// ─── Types ────────────────────────────────────────────────────────────────────

type RecipientStatus = 'pending' | 'analyzing' | 'ready' | 'sending' | 'sent' | 'failed'

interface RecipientRow {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  status: RecipientStatus
  ai_copy?: string
  quote_amount?: number
  nearby_count?: number
  lot_size?: string
  sq_footage?: string
  street_view_url?: string
  error?: string
}

interface CampaignConfig {
  name: string
  description: string
  tags: string
  send_date: string
  budget_cap: number
  phone: string
}

interface Campaign {
  id: string
  name: string
  description: string | null
  send_date: string
  budget_cap: number
  pieces_sent: number
  total_cost: number
  response_rate: number | null
  created_at: string
  recipient_count: number
}

type ActiveView = 'setup' | 'preview' | 'history'

const PRICE_PER_PIECE = 0.872

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Splits "IN 46755" or "IN, 46755" into [state, zip].
 * Returns ['IN', ''] if no zip found.
 */
function splitStateZip(s: string): [string, string] {
  const t = s.trim()
  // Already split by space: "IN 46755"
  const spaceIdx = t.indexOf(' ')
  if (spaceIdx !== -1) return [t.slice(0, spaceIdx).trim(), t.slice(spaceIdx + 1).trim()]
  // Just a state abbreviation, no zip
  return [t, '']
}

function parseAddressLines(raw: string): RecipientRow[] {
  const rows: RecipientRow[] = []
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim())

    if (parts.length >= 5) {
      // Name, Address, City, State, ZIP
      const [name, address, city, state, zip] = parts
      rows.push({ id: crypto.randomUUID(), name: name || 'Homeowner', address, city, state: state || 'IN', zip, status: 'pending' })

    } else if (parts.length === 4) {
      // Name, Address, City, "State ZIP"  — state+zip smashed together
      const [name, address, city, stateZip] = parts
      const [state, zip] = splitStateZip(stateZip)
      rows.push({ id: crypto.randomUUID(), name: name || 'Homeowner', address, city, state: state || 'IN', zip, status: 'pending' })

    } else if (parts.length === 3) {
      // Name, Address, "City State ZIP"
      const [name, address, cityStateZip] = parts
      const citySpaceIdx = cityStateZip.lastIndexOf(' ')
      const cityState = citySpaceIdx !== -1 ? cityStateZip.slice(0, citySpaceIdx) : cityStateZip
      const zipPart  = citySpaceIdx !== -1 ? cityStateZip.slice(citySpaceIdx + 1) : ''
      const [city, state] = splitStateZip(cityState)
      rows.push({ id: crypto.randomUUID(), name: name || 'Homeowner', address, city, state: state || 'IN', zip: zipPart, status: 'pending' })

    } else if (parts.length === 2) {
      // Name, Address  (no location info)
      const [name, address] = parts
      rows.push({ id: crypto.randomUUID(), name: name || 'Homeowner', address, city: '', state: 'IN', zip: '', status: 'pending' })

    } else if (parts.length === 1 && parts[0].length > 5) {
      rows.push({ id: crypto.randomUUID(), name: 'Homeowner', address: parts[0], city: '', state: 'IN', zip: '', status: 'pending' })
    }
  }
  return rows
}

function StatusBadge({ status }: { status: RecipientStatus }) {
  const map: Record<RecipientStatus, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
    analyzing: { label: 'Analyzing', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    ready:     { label: 'Ready',     cls: 'bg-green-50 text-green-700 border-green-200' },
    sending:   { label: 'Sending',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    sent:      { label: 'Sent',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    failed:    { label: 'Failed',    cls: 'bg-red-50 text-red-700 border-red-200' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status === 'analyzing' && <Loader2 size={10} className="animate-spin mr-1" />}
      {status === 'sent'      && <CheckCircle2 size={10} className="mr-1" />}
      {status === 'failed'    && <XCircle size={10} className="mr-1" />}
      {status === 'sending'   && <Loader2 size={10} className="animate-spin mr-1" />}
      {label}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PostcardsPage() {
  const [addresses, setAddresses]     = useState<RecipientRow[]>([])
  const [campaign, setCampaign]       = useState<CampaignConfig>({
    name: '',
    description: '',
    tags: '',
    send_date: 'ASAP',
    budget_cap: 100,
    phone: '(260) 000-0000',
  })
  const [activeView, setActiveView]   = useState<ActiveView>('setup')
  const [analyzing, setAnalyzing]     = useState(false)
  const [launching, setLaunching]     = useState(false)
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])
  const [histLoading, setHistLoading] = useState(false)

  // Input panel sub-tab
  const [inputTab, setInputTab]       = useState<'paste' | 'db'>('paste')
  const [pasteText, setPasteText]     = useState('')
  const [dbLoading, setDbLoading]     = useState(false)
  const [dbLeads, setDbLeads]         = useState<Array<{ id: string; name: string; address: string }>>([])
  const [dbCustomers, setDbCustomers] = useState<Array<{ id: string; full_name: string; address: string | null }>>([])
  const [dbSelected, setDbSelected]   = useState<Set<string>>(new Set())

  // Preview state
  const [previewIdx, setPreviewIdx]   = useState(0)

  // Config panel collapsed
  const [configOpen, setConfigOpen]   = useState(true)

  // Editable response rate for history
  const [rateEdits, setRateEdits]     = useState<Record<string, string>>({})
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [resending, setResending]     = useState<Record<string, boolean>>({})

  // Postcard mockup preview
  const [mockupFront, setMockupFront]   = useState<string | null>(null)
  const [mockupBack, setMockupBack]     = useState<string | null>(null)
  const [mockupLoading, setMockupLoading] = useState(false)
  const [mockupFlipped, setMockupFlipped] = useState(false)

  const totalCost = addresses.length * PRICE_PER_PIECE
  const overBudget = totalCost > campaign.budget_cap && campaign.budget_cap > 0
  const readyCount = addresses.filter(r => r.status === 'ready').length
  const pendingCount = addresses.filter(r => r.status === 'pending').length
  const missingZipCount = addresses.filter(r => !r.zip?.trim()).length
  const canLaunch = !analyzing && !launching && !overBudget && addresses.length > 0 && pendingCount === 0 && readyCount > 0 && missingZipCount === 0

  // ── Load history ──────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await fetch('/api/postcards/campaigns')
      if (res.ok) setCampaigns(await res.json())
    } catch { /* ignore */ }
    setHistLoading(false)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ── Load DB sources ───────────────────────────────────────────────────────
  async function loadDb() {
    setDbLoading(true)
    try {
      const [leadsRes, customersRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/customers'),
      ])
      if (leadsRes.ok) setDbLeads(await leadsRes.json())
      if (customersRes.ok) setDbCustomers(await customersRes.json())
    } catch {
      toast.error('Failed to load database records')
    }
    setDbLoading(false)
  }

  useEffect(() => {
    if (inputTab === 'db' && !dbLeads.length && !dbCustomers.length) loadDb()
  }, [inputTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Parse pasted addresses ─────────────────────────────────────────────────
  function parsePaste() {
    if (!pasteText.trim()) { toast.error('Paste some addresses first'); return }
    const parsed = parseAddressLines(pasteText)
    if (!parsed.length) { toast.error('Could not parse any addresses. Use: Name, Address, City, State, ZIP'); return }
    setAddresses(prev => [...prev, ...parsed])
    setPasteText('')
    toast.success(`Added ${parsed.length} address${parsed.length === 1 ? '' : 'es'}`)
  }

  // ── Add from DB selection ──────────────────────────────────────────────────
  function addFromDb() {
    const toAdd: RecipientRow[] = []
    for (const id of dbSelected) {
      const lead = dbLeads.find(l => l.id === id)
      const cust = dbCustomers.find(c => c.id === id)
      if (lead && lead.address) {
        const parts = lead.address.split(',').map(s => s.trim())
        toAdd.push({
          id: crypto.randomUUID(),
          name: lead.name,
          address: parts[0] ?? lead.address,
          city: parts[1] ?? '',
          state: parts[2]?.split(' ')[0] ?? 'IN',
          zip: parts[2]?.split(' ')[1] ?? '',
          status: 'pending',
        })
      } else if (cust && cust.address) {
        const parts = cust.address.split(',').map(s => s.trim())
        toAdd.push({
          id: crypto.randomUUID(),
          name: cust.full_name,
          address: parts[0] ?? cust.address,
          city: parts[1] ?? '',
          state: parts[2]?.split(' ')[0] ?? 'IN',
          zip: parts[2]?.split(' ')[1] ?? '',
          status: 'pending',
        })
      }
    }
    if (!toAdd.length) { toast.error('No valid addresses in selection'); return }
    setAddresses(prev => [...prev, ...toAdd])
    setDbSelected(new Set())
    toast.success(`Added ${toAdd.length} record${toAdd.length === 1 ? '' : 's'}`)
  }

  // ── Analyze single row ────────────────────────────────────────────────────
  async function analyzeRow(id: string) {
    const row = addresses.find(r => r.id === id)
    if (!row) return

    setAddresses(prev => prev.map(r => r.id === id ? { ...r, status: 'analyzing' } : r))

    try {
      const fullAddress = [row.address, row.city, row.state, row.zip].filter(Boolean).join(', ')
      const res = await fetch('/api/postcards/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: fullAddress, name: row.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')

      setAddresses(prev => prev.map(r =>
        r.id === id
          ? {
              ...r,
              status: 'ready',
              ai_copy: data.ai_copy,
              quote_amount: data.quote_amount,
              lot_size: data.lot_size,
              sq_footage: data.sq_footage,
              street_view_url: data.street_view_url ?? undefined,
            }
          : r
      ))

      // Nearby count in background
      if (data.coords) {
        fetch('/api/postcards/nearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: data.coords.lat, lng: data.coords.lon, address: fullAddress }),
        })
          .then(r => r.json())
          .then(({ count }) => {
            setAddresses(prev => prev.map(r2 => r2.id === id ? { ...r2, nearby_count: count ?? 0 } : r2))
          })
          .catch(() => {})
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setAddresses(prev => prev.map(r => r.id === id ? { ...r, status: 'failed', error: msg } : r))
      toast.error(`Failed to analyze ${row.name}: ${msg}`)
    }
  }

  // ── Analyze all ───────────────────────────────────────────────────────────
  async function analyzeAll() {
    const toAnalyze = addresses.filter(r => r.status === 'pending' || r.status === 'failed')
    if (!toAnalyze.length) { toast.info('All addresses already analyzed'); return }
    setAnalyzing(true)
    for (const row of toAnalyze) {
      await analyzeRow(row.id)
      // Small delay to avoid rate-limiting
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    setAnalyzing(false)
    toast.success('Analysis complete')
  }

  // ── Remove row ────────────────────────────────────────────────────────────
  function removeRow(id: string) {
    setAddresses(prev => prev.filter(r => r.id !== id))
  }

  // ── Launch campaign ───────────────────────────────────────────────────────
  async function launchCampaign() {
    if (!campaign.name.trim()) { toast.error('Enter a campaign name first'); return }

    setLaunchError(null)
    setLaunching(true)
    try {
      // Create campaign record
      const campaignRes = await fetch('/api/postcards/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaign.name,
          description: campaign.description,
          tags: campaign.tags.split(',').map(t => t.trim()).filter(Boolean),
          send_date: campaign.send_date,
          budget_cap: campaign.budget_cap,
          phone: campaign.phone,
        }),
      })
      if (!campaignRes.ok) {
        const d = await campaignRes.json()
        throw new Error(d.error ?? 'Failed to create campaign')
      }
      const newCampaign = await campaignRes.json()

      // Mark all as sending
      setAddresses(prev => prev.map(r => r.status === 'ready' ? { ...r, status: 'sending' } : r))

      const readyRows = addresses.filter(r => r.status === 'sending' || r.status === 'ready')

      const sendRes = await fetch('/api/postcards/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: newCampaign.id,
          phone: campaign.phone,
          recipients: readyRows.map(r => ({
            id: r.id,
            name: r.name,
            address: r.address,
            city: r.city,
            state: r.state,
            zip: r.zip,
            ai_copy: r.ai_copy ?? '',
            quote_amount: r.quote_amount ?? 35,
            nearby_count: r.nearby_count ?? 0,
            lot_size: r.lot_size,
            sq_footage: r.sq_footage,
            street_view_url: r.street_view_url,
          })),
        }),
      })

      if (!sendRes.ok) {
        const d = await sendRes.json()
        throw new Error(d.error ?? 'Failed to send postcards')
      }

      const sendData = await sendRes.json()

      // Update row statuses based on results
      const resultMap: Record<string, { success: boolean; error?: string; debug?: Record<string, unknown> }> = {}
      for (const r of sendData.results ?? []) resultMap[r.id] = r
      setAddresses(prev => prev.map(r => {
        const result = resultMap[r.id]
        if (!result) return r
        const debugStr = result.debug ? '\n\nDEBUG: ' + JSON.stringify(result.debug, null, 2) : ''
        return { ...r, status: result.success ? 'sent' : 'failed', error: result.error ? result.error + debugStr : (result.debug ? 'DEBUG: ' + JSON.stringify(result.debug, null, 2) : undefined) }
      }))

      toast.success(`Campaign launched! ${sendData.sent} sent, ${sendData.failed} failed.`)
      loadHistory()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Launch failed'
      setLaunchError(msg)
      toast.error('Launch failed — see error below')
    }
    setLaunching(false)
  }

  // ── Save response rate ────────────────────────────────────────────────────
  async function saveResponseRate(campaignId: string) {
    const rate = parseFloat(rateEdits[campaignId] ?? '')
    if (isNaN(rate)) { toast.error('Enter a valid number'); return }
    const res = await fetch(`/api/postcards/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_rate: rate }),
    })
    if (res.ok) {
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, response_rate: rate } : c))
      toast.success('Response rate saved')
    } else {
      toast.error('Failed to save')
    }
  }

  // ── Resend a past campaign ────────────────────────────────────────────────
  async function resendCampaign(c: Campaign) {
    setResending(prev => ({ ...prev, [c.id]: true }))
    try {
      // Fetch original recipients
      const res = await fetch(`/api/postcards/campaigns/${c.id}`)
      if (!res.ok) throw new Error('Failed to load campaign recipients')
      const data = await res.json()
      const recipients = (data.recipients ?? []) as Array<Record<string, unknown>>

      if (!recipients.length) {
        toast.error('No recipients found for this campaign')
        return
      }

      // Create a new campaign record (copy of original)
      const newCampaignRes = await fetch('/api/postcards/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${c.name} (Resend)`,
          description: c.description,
          send_date: 'ASAP',
          budget_cap: c.budget_cap,
          phone: data.phone ?? '(260) 000-0000',
        }),
      })
      if (!newCampaignRes.ok) throw new Error('Failed to create resend campaign')
      const newCampaign = await newCampaignRes.json()

      // Send to all original recipients
      const sendRes = await fetch('/api/postcards/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: newCampaign.id,
          phone: data.phone ?? '(260) 000-0000',
          recipients: recipients.map((r) => ({
            id: (r.id as string) ?? crypto.randomUUID(),
            name: r.name ?? 'Homeowner',
            address: r.address ?? '',
            city: r.city ?? '',
            state: r.state ?? 'IN',
            zip: r.zip ?? '',
            ai_copy: r.ai_copy ?? '',
            quote_amount: r.quote_amount ?? 35,
            nearby_count: r.nearby_count ?? 0,
            lot_size: r.lot_size,
            sq_footage: r.sq_footage,
          })),
        }),
      })

      if (!sendRes.ok) {
        const d = await sendRes.json()
        throw new Error(d.error ?? 'Send failed')
      }

      const sendData = await sendRes.json()
      toast.success(`Resent! ${sendData.sent} sent, ${sendData.failed} failed.`)
      loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Resend failed')
    }
    setResending(prev => ({ ...prev, [c.id]: false }))
  }

  // ── Load postcard mockup ──────────────────────────────────────────────────
  async function loadMockup() {
    setMockupLoading(true)
    setMockupFlipped(false)

    // Use first ready recipient's data if available, otherwise sample data
    const sample = addresses.find(r => r.status === 'ready') ?? null
    const params = new URLSearchParams({
      name:          sample?.name          ?? 'Alex Johnson',
      address:       sample?.address       ?? '456 Oak Street',
      quote_amount:  String(sample?.quote_amount  ?? 45),
      nearby_count:  String(sample?.nearby_count  ?? 4),
      phone:         campaign.phone        ?? '(260) 000-0000',
      ai_copy:       sample?.ai_copy       ?? '',
    })

    try {
      const res = await fetch(`/api/postcards/preview?${params}`)
      if (!res.ok) throw new Error('Preview failed')
      const data = await res.json()
      setMockupFront(data.front)
      setMockupBack(data.back)
    } catch {
      // ignore
    }
    setMockupLoading(false)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Mail size={22} className="text-purple-600" />
            Postcard Campaigns
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Send personalized direct mail postcards to targeted addresses via Lob
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeView === 'setup' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('setup')}
            className="gap-1.5"
          >
            <Settings2 size={14} /> Setup
          </Button>
          <Button
            variant={activeView === 'preview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveView('preview'); loadMockup() }}
            className="gap-1.5"
          >
            <Eye size={14} /> Preview Card
          </Button>
          <Button
            variant={activeView === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveView('history'); loadHistory() }}
            className="gap-1.5"
          >
            <History size={14} /> History
          </Button>
        </div>
      </div>

      {/* ── Budget bar (always visible) ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="text-sm font-medium text-zinc-700">
            Budget: {addresses.length} addresses × {formatCurrency(PRICE_PER_PIECE)} ={' '}
            <span className={overBudget ? 'text-red-600 font-bold' : 'text-zinc-900 font-semibold'}>
              {formatCurrency(totalCost)}
            </span>
            {campaign.budget_cap > 0 && (
              <span className="text-zinc-400 ml-1">/ {formatCurrency(campaign.budget_cap)} cap</span>
            )}
          </div>
          {overBudget && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              Over budget — remove addresses or raise cap
            </span>
          )}
        </div>
        {campaign.budget_cap > 0 && (
          <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${overBudget ? 'bg-red-500' : 'bg-purple-500'}`}
              style={{ width: `${Math.min((totalCost / campaign.budget_cap) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* ── SETUP VIEW ─────────────────────────────────────────────────────── */}
      {activeView === 'setup' && (
        <div className="space-y-4">

          {/* Input panel */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            {/* Sub-tabs */}
            <div className="flex border-b border-zinc-200">
              {(['paste', 'db'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setInputTab(tab)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    inputTab === tab
                      ? 'bg-white text-zinc-900 border-b-2 border-purple-500'
                      : 'text-zinc-500 hover:text-zinc-700 bg-zinc-50'
                  }`}
                >
                  {tab === 'paste' ? (
                    <span className="flex items-center justify-center gap-1.5"><Plus size={14} /> Paste Addresses</span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5"><Database size={14} /> Load from Database</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4">
              {inputTab === 'paste' ? (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    One address per line. Format: <code className="bg-zinc-100 px-1 rounded">Name, Address, City, State, ZIP</code>
                  </p>
                  <textarea
                    rows={5}
                    placeholder={`John Smith, 123 Main St, Kendallville, IN, 46755\nJane Doe, 456 Oak Ave, Albion, IN, 46701`}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 placeholder-zinc-400 resize-none focus:outline-none focus:border-zinc-400 font-mono"
                  />
                  <Button size="sm" onClick={parsePaste} className="gap-1.5">
                    <Plus size={14} /> Parse &amp; Add
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dbLoading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-zinc-500">
                        Select leads and customers to add to your campaign.
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-1 border border-zinc-200 rounded-lg p-2">
                        {dbLeads.length === 0 && dbCustomers.length === 0 && (
                          <p className="text-sm text-zinc-400 text-center py-4">No records found</p>
                        )}
                        {dbLeads.map(lead => (
                          <label key={lead.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-zinc-50 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={dbSelected.has(lead.id)}
                              onChange={e => {
                                const next = new Set(dbSelected)
                                e.target.checked ? next.add(lead.id) : next.delete(lead.id)
                                setDbSelected(next)
                              }}
                              className="rounded"
                            />
                            <span className="font-medium text-zinc-700">{lead.name}</span>
                            <span className="text-zinc-400 truncate">{lead.address}</span>
                            <span className="ml-auto text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">lead</span>
                          </label>
                        ))}
                        {dbCustomers.map(cust => (
                          <label key={cust.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-zinc-50 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={dbSelected.has(cust.id)}
                              onChange={e => {
                                const next = new Set(dbSelected)
                                e.target.checked ? next.add(cust.id) : next.delete(cust.id)
                                setDbSelected(next)
                              }}
                              className="rounded"
                            />
                            <span className="font-medium text-zinc-700">{cust.full_name}</span>
                            <span className="text-zinc-400 truncate">{cust.address ?? '—'}</span>
                            <span className="ml-auto text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">customer</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addFromDb} disabled={dbSelected.size === 0} className="gap-1.5">
                          <Plus size={14} /> Add {dbSelected.size > 0 ? dbSelected.size : ''} Selected
                        </Button>
                        <Button size="sm" variant="outline" onClick={loadDb} className="gap-1.5">
                          <RefreshCw size={14} /> Refresh
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Address table */}
          {addresses.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-100">
                <p className="font-semibold text-zinc-800 text-sm">
                  {addresses.length} Address{addresses.length !== 1 ? 'es' : ''}
                  {readyCount > 0 && <span className="ml-2 text-green-600">· {readyCount} ready</span>}
                  {pendingCount > 0 && <span className="ml-1 text-zinc-400">· {pendingCount} pending</span>}
                </p>
                <Button
                  size="sm"
                  onClick={analyzeAll}
                  disabled={analyzing || pendingCount === 0}
                  className="gap-1.5"
                >
                  {analyzing
                    ? <><Loader2 size={13} className="animate-spin" /> Analyzing…</>
                    : <><Zap size={13} /> Analyze All</>}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 text-left">
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Name</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Address</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Copy Preview</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Quote</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Nearby</th>
                      <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {addresses.map(row => (
                      <RecipientTableRow
                        key={row.id}
                        row={row}
                        onAnalyze={() => analyzeRow(row.id)}
                        onRemove={() => removeRow(row.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Campaign config */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              onClick={() => setConfigOpen(p => !p)}
            >
              <span className="flex items-center gap-2"><Settings2 size={15} /> Campaign Settings</span>
              {configOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {configOpen && (
              <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100">
                <div className="space-y-1.5">
                  <Label>Campaign Name *</Label>
                  <Input
                    placeholder="Spring 2026 Mailer"
                    value={campaign.name}
                    onChange={e => setCampaign(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="(260) 000-0000"
                    value={campaign.phone}
                    onChange={e => setCampaign(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional description"
                    value={campaign.description}
                    onChange={e => setCampaign(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    placeholder="spring, kendallville, test"
                    value={campaign.tags}
                    onChange={e => setCampaign(p => ({ ...p, tags: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Send Date</Label>
                  <Input
                    placeholder="ASAP"
                    value={campaign.send_date}
                    onChange={e => setCampaign(p => ({ ...p, send_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Budget Cap ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={campaign.budget_cap}
                    onChange={e => setCampaign(p => ({ ...p, budget_cap: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Launch button */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={launchCampaign}
                disabled={!canLaunch}
                className="gap-2"
              >
                {launching
                  ? <><Loader2 size={16} className="animate-spin" /> Launching…</>
                  : <><Send size={16} /> Launch Campaign</>}
              </Button>
              {!campaign.name.trim() && (
                <p className="text-xs text-amber-600">Enter a campaign name to launch</p>
              )}
              {pendingCount > 0 && !analyzing && (
                <p className="text-xs text-amber-600">{pendingCount} address{pendingCount !== 1 ? 'es' : ''} still need analysis</p>
              )}
              {missingZipCount > 0 && (
                <p className="text-xs text-red-600">{missingZipCount} address{missingZipCount !== 1 ? 'es are' : ' is'} missing a ZIP code — Lob requires it</p>
              )}
              {overBudget && (
                <p className="text-xs text-red-600">Over budget — cannot launch</p>
              )}
            </div>

            {/* Full error display */}
            {launchError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-700 mb-1">Launch Error</p>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap break-all font-mono bg-red-100 rounded p-3 select-all">
                        {launchError}
                      </pre>
                    </div>
                  </div>
                  <button
                    onClick={() => setLaunchError(null)}
                    className="text-red-400 hover:text-red-600 flex-shrink-0 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PREVIEW VIEW ───────────────────────────────────────────────────── */}
      {activeView === 'preview' && (
        <div className="space-y-4">

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setActiveView('setup')} className="gap-1.5">
              <ArrowLeft size={14} /> Back to Setup
            </Button>
            <Button variant="outline" size="sm" onClick={loadMockup} disabled={mockupLoading} className="gap-1.5">
              <RefreshCw size={13} className={mockupLoading ? 'animate-spin' : ''} /> Regenerate
            </Button>
            {(mockupFront || mockupBack) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMockupFlipped(f => !f)}
                className="gap-1.5"
              >
                <RotateCcw size={13} /> {mockupFlipped ? 'Show Front' : 'Show Back'}
              </Button>
            )}
            <p className="text-xs text-zinc-400 ml-auto">
              {addresses.find(r => r.status === 'ready')
                ? 'Using your first analyzed recipient\'s data'
                : 'Using sample data — analyze an address for personalized preview'}
            </p>
          </div>

          {/* Iframe mockup */}
          <div className="bg-zinc-100 rounded-xl p-6 flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
              {mockupFlipped ? 'Back' : 'Front'} — 6×9 Postcard
            </p>

            {mockupLoading ? (
              <div className="flex items-center justify-center" style={{ width: '810px', height: '540px' }}>
                <Loader2 size={32} className="animate-spin text-zinc-400" />
              </div>
            ) : (mockupFront || mockupBack) ? (
              /* Card scaled to fit: 9in×6in at 96dpi = 864×576px, scaled to 810px wide */
              <div
                style={{
                  width: '810px',
                  height: '540px',
                  overflow: 'hidden',
                  borderRadius: '6px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                  flexShrink: 0,
                }}
              >
                <iframe
                  key={mockupFlipped ? 'back' : 'front'}
                  srcDoc={mockupFlipped ? (mockupBack ?? '') : (mockupFront ?? '')}
                  style={{
                    width: '864px',
                    height: '576px',
                    border: 'none',
                    transformOrigin: 'top left',
                    transform: 'scale(0.9375)',   /* 810/864 */
                  }}
                  sandbox="allow-same-origin"
                  scrolling="no"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center text-zinc-400 text-sm" style={{ width: '810px', height: '540px' }}>
                Click &quot;Regenerate&quot; to load the preview
              </div>
            )}

            <p className="text-xs text-zinc-400 mt-1">
              Photo is a sample — real postcards use Google Street View of the recipient&apos;s house
            </p>
          </div>

        </div>
      )}

      {/* ── HISTORY VIEW ───────────────────────────────────────────────────── */}
      {activeView === 'history' && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="font-semibold text-zinc-800 text-sm">Past Campaigns</p>
            <Button variant="outline" size="sm" onClick={loadHistory} className="gap-1.5">
              <RefreshCw size={13} className={histLoading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>

          {histLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 text-sm">No campaigns yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-left">
                    <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Date</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Name</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Pieces</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Cost</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide">Response Rate %</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-xs">
                          <Clock size={11} />
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-800">{c.name}</p>
                        {c.description && <p className="text-xs text-zinc-400">{c.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 font-medium">{c.pieces_sent}</td>
                      <td className="px-4 py-3 text-zinc-700">{formatCurrency(c.total_cost)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="h-7 w-20 text-xs"
                            placeholder={c.response_rate != null ? String(c.response_rate) : '—'}
                            value={rateEdits[c.id] ?? (c.response_rate != null ? String(c.response_rate) : '')}
                            onChange={e => setRateEdits(p => ({ ...p, [c.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => saveResponseRate(c.id)}
                          >
                            Save
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 whitespace-nowrap"
                          disabled={!!resending[c.id]}
                          onClick={() => resendCampaign(c)}
                        >
                          {resending[c.id]
                            ? <><Loader2 size={13} className="animate-spin" /> Sending…</>
                            : <><RotateCcw size={13} /> Resend</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Recipient Table Row ──────────────────────────────────────────────────────

function RecipientTableRow({
  row,
  onAnalyze,
  onRemove,
}: {
  row: RecipientRow
  onAnalyze: () => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr className="hover:bg-zinc-50">
        <td className="px-4 py-3 font-medium text-zinc-800 whitespace-nowrap">{row.name}</td>
        <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px]">
          <span className="truncate block">{[row.address, row.city, row.state, row.zip].filter(Boolean).join(', ')}</span>
          {!row.zip?.trim() && (
            <span className="text-red-500 font-medium">⚠ Missing ZIP</span>
          )}
        </td>
        <td className="px-4 py-3 max-w-xs">
          <StatusBadge status={row.status} />
          {row.error && (
            <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-all font-mono bg-red-50 border border-red-200 rounded p-2 select-all max-h-40 overflow-y-auto">
              {row.error}
            </pre>
          )}
        </td>
        <td className="px-4 py-3 max-w-[200px]">
          {row.ai_copy ? (
            <div>
              <p className={`text-xs text-zinc-600 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                {row.ai_copy}
              </p>
              <button
                onClick={() => setExpanded(p => !p)}
                className="text-xs text-purple-500 hover:text-purple-700 mt-0.5"
              >
                {expanded ? 'Less' : 'More'}
              </button>
            </div>
          ) : (
            <span className="text-xs text-zinc-300 italic">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-zinc-700 font-medium whitespace-nowrap">
          {row.quote_amount != null ? formatCurrency(row.quote_amount) + '/mow' : '—'}
        </td>
        <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
          {row.nearby_count != null ? row.nearby_count : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {(row.status === 'pending' || row.status === 'failed') && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={onAnalyze}
              >
                <Zap size={11} /> Analyze
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-zinc-400 hover:text-red-500"
              onClick={onRemove}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </td>
      </tr>
    </>
  )
}
