'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Crosshair, Loader2, Search, Send,
  CheckCircle2, XCircle, Megaphone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils/currency'

const PRICE_PER_PIECE = 0.93
const SEND_BATCH_SIZE = 3

interface Candidate {
  name: string
  address: string
  city: string
  state: string
  zip: string
  lot_sqft: number | null
  living_sqft: number | null
  quote: number
  lead_score?: number
  segment?: string
  mail_priority?: 'first' | 'second' | 'skip'
  is_absentee?: boolean
  last_sold?: string | null
  home_value?: number | null
  income_band?: 'above' | 'at' | 'below' | 'unknown'
  factors?: Record<string, number>
}

const SEGMENT_LABEL: Record<string, string> = {
  absentee_new_owner: 'New / absentee owner',
  aging_homeowner: 'Aging homeowner',
  time_poor_family: 'Busy family',
  general: 'General',
}

const GATE_LABEL: Record<string, string> = {
  lot_size: 'lot size out of range (0.15–1.5 ac)',
  value_band: 'home value outside the ZIP band',
}

const FACTOR_LABEL: Record<string, string> = {
  lot_mid: 'ideal lot size (0.2–0.6 ac)',
  owner_occupied: 'owner-occupied',
  absentee: 'absentee owner',
  new_mover: 'recently sold (new mover)',
  income_above: 'higher-income block',
}

function whyText(factors?: Record<string, number>): string {
  if (!factors || Object.keys(factors).length === 0) return 'No scoring factors matched (score 0).'
  return Object.entries(factors)
    .map(([k, v]) => `+${v} ${FACTOR_LABEL[k] ?? k}`)
    .join('  ·  ')
}

type SendState = 'idle' | 'sending' | 'sent' | 'failed'

interface CandidateRow extends Candidate {
  selected: boolean
  sendState: SendState
  error?: string
}

export default function AreaBlastPage() {
  const [mode, setMode] = useState<'zip' | 'area'>('zip')
  const [zip, setZip] = useState('46755')
  const [center, setCenter] = useState('')
  const [radius, setRadius] = useState('0.5')
  const [count, setCount] = useState('25')
  const [targetQuote, setTargetQuote] = useState('50')
  const [band, setBand] = useState('10')
  const [phone, setPhone] = useState('(260) 599-4253')
  const [smart, setSmart] = useState(true)
  const [exactStreet, setExactStreet] = useState(false)
  const [anyQuote, setAnyQuote] = useState(false)

  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [stats, setStats] = useState<{ scanned: number; in_band: number; already_contacted: number; gate_dropped?: number; gate_breakdown?: Record<string, number>; priority?: { first: number; second: number; skip: number } } | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Campaigns
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const [campaignChoice, setCampaignChoice] = useState('')   // '' = none, '__new__' = new, else id
  const [newCampaignName, setNewCampaignName] = useState('')
  const [addingToCampaign, setAddingToCampaign] = useState(false)

  useEffect(() => {
    fetch('/api/letters/campaigns').then(r => r.json()).then((d) => {
      if (Array.isArray(d)) setCampaigns(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
  }, [])

  const selectedRows = rows.filter(r => r.selected && r.sendState !== 'sent')
  const estCost = selectedRows.length * PRICE_PER_PIECE

  async function runPreview() {
    setPreviewing(true)
    setRows([])
    setStats(null)
    try {
      const res = await fetch('/api/letters/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          mode,
          zip: zip.trim(),
          center: center.trim(),
          radius: Number(radius) || 0.5,
          count: Number(count) || 25,
          target_quote: Number(targetQuote) || 50,
          min_quote: (Number(targetQuote) || 50) - (Number(band) || 10),
          max_quote: (Number(targetQuote) || 50) + (Number(band) || 10),
          smart,
          exact_street: exactStreet,
          any_quote: anyQuote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Preview failed')
        return
      }
      const candidates: Candidate[] = data.candidates ?? []
      setRows(candidates.map(c => ({ ...c, selected: true, sendState: 'idle' as SendState })))
      setStats({ scanned: data.scanned ?? 0, in_band: data.in_band ?? 0, already_contacted: data.already_contacted ?? 0, gate_dropped: data.gate_dropped, gate_breakdown: data.gate_breakdown, priority: data.priority })
      if (candidates.length === 0) {
        toast.info('No new homes in that quote range — try widening the band, radius, or area.')
      } else {
        toast.success(`Found ${candidates.length} homes in your range`)
      }
    } catch {
      toast.error('Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  async function addToCampaign() {
    const chosen = rows.filter(r => r.selected && r.sendState !== 'sent')
    if (chosen.length === 0) { toast.info('Select some homes first.'); return }
    if (!campaignChoice) { toast.error('Pick a campaign (or create one).'); return }
    setAddingToCampaign(true)
    try {
      let campaignId = campaignChoice
      if (campaignChoice === '__new__') {
        if (!newCampaignName.trim()) { toast.error('Name your new campaign.'); return }
        const cRes = await fetch('/api/letters/campaigns', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCampaignName.trim(), phone }),
        })
        const c = await cRes.json()
        if (!cRes.ok) { toast.error(c.error ?? 'Could not create campaign'); return }
        campaignId = c.id
        setCampaigns(prev => [{ id: c.id, name: c.name }, ...prev])
      }
      const res = await fetch(`/api/letters/campaigns/${campaignId}/recipients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: chosen.map(r => ({
            name: r.name, address: r.address, city: r.city, state: r.state, zip: r.zip,
            quote: r.quote, lot_sqft: r.lot_sqft, living_sqft: r.living_sqft,
            segment: r.segment, lead_score: r.lead_score, mail_priority: r.mail_priority, income_band: r.income_band,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not add to campaign'); return }
      toast.success(`Added ${data.added} to campaign${data.skipped ? ` (${data.skipped} skipped — already queued)` : ''}`)
      // Remove the added rows from the list so they aren't double-added.
      const addedKeys = new Set(chosen.map(r => `${r.address}-${r.zip}`))
      setRows(prev => prev.filter(r => !addedKeys.has(`${r.address}-${r.zip}`)))
      setNewCampaignName('')
    } catch {
      toast.error('Could not add to campaign')
    } finally {
      setAddingToCampaign(false)
    }
  }

  function toggleRow(idx: number) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)))
  }

  function toggleAll() {
    const allOn = rows.every(r => r.selected)
    setRows(prev => prev.map(r => ({ ...r, selected: !allOn })))
  }

  async function sendAll() {
    const toSend = rows
      .map((r, idx) => ({ row: r, idx }))
      .filter(({ row }) => row.selected && row.sendState !== 'sent')
    if (toSend.length === 0) return

    const ok = window.confirm(
      `Send ${toSend.length} letters for about ${formatCurrency(toSend.length * PRICE_PER_PIECE)}? ` +
      `Each letter is drafted individually and mailed via Lob — this cannot be undone.`
    )
    if (!ok) return

    setSending(true)
    setProgress({ done: 0, total: toSend.length })
    let sent = 0
    let failed = 0

    for (let i = 0; i < toSend.length; i += SEND_BATCH_SIZE) {
      const batch = toSend.slice(i, i + SEND_BATCH_SIZE)
      setRows(prev => prev.map((r, idx) =>
        batch.some(b => b.idx === idx) ? { ...r, sendState: 'sending' as SendState } : r
      ))
      try {
        const res = await fetch('/api/letters/blast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            phone,
            recipients: batch.map(({ row }) => ({
              name: row.name,
              address: row.address,
              city: row.city,
              state: row.state,
              zip: row.zip,
              lot_sqft: row.lot_sqft,
              living_sqft: row.living_sqft,
              quote: row.quote,
              segment: row.segment,
              lead_score: row.lead_score,
              mail_priority: row.mail_priority,
              income_band: row.income_band,
            })),
          }),
        })
        const data = await res.json()
        const results: Array<{ address: string; success: boolean; error?: string }> = data.results ?? []
        setRows(prev => prev.map((r, idx) => {
          const b = batch.find(b => b.idx === idx)
          if (!b) return r
          const result = results.find(x => x.address === r.address)
          if (result?.success) return { ...r, sendState: 'sent' as SendState }
          return { ...r, sendState: 'failed' as SendState, error: result?.error ?? data.error ?? 'Send failed' }
        }))
        sent += results.filter(r => r.success).length
        failed += results.filter(r => !r.success).length
      } catch {
        setRows(prev => prev.map((r, idx) =>
          batch.some(b => b.idx === idx) ? { ...r, sendState: 'failed' as SendState, error: 'Request failed' } : r
        ))
        failed += batch.length
      }
      setProgress({ done: Math.min(i + SEND_BATCH_SIZE, toSend.length), total: toSend.length })
    }

    setSending(false)
    setProgress(null)
    if (failed === 0) toast.success(`All ${sent} letters sent 🎉`)
    else toast.warning(`${sent} sent, ${failed} failed — check the list for details`)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/marketing/letters" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-3">
          <ArrowLeft size={14} /> Letters
        </Link>
        <div className="flex items-center gap-3">
          <Crosshair className="text-green-600" size={26} />
          <div>
            <h1 className="text-2xl font-bold">Area Blast</h1>
            <p className="text-sm text-zinc-500">
              Pick a ZIP, how many homes, and your target quote — we pull homes that price in that range,
              draft each letter individually, and mail them all.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border rounded-xl p-5 bg-white space-y-4">
        {/* Mode toggle */}
        <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 bg-zinc-50">
          {([['zip', 'By ZIP code'], ['area', 'By neighborhood']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === m ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {mode === 'zip' ? (
            <div>
              <Label htmlFor="zip">ZIP code</Label>
              <Input id="zip" value={zip} onChange={e => setZip(e.target.value)} placeholder="46755" maxLength={5} />
            </div>
          ) : (
            <>
              <div className="col-span-2">
                <Label htmlFor="center">Center on (street or address)</Label>
                <Input id="center" value={center} onChange={e => setCenter(e.target.value)} placeholder="e.g. Riverview Dr, Kendallville" />
              </div>
              <div>
                <Label htmlFor="radius">Radius (miles)</Label>
                <Input id="radius" type="number" min={0.1} max={3} step={0.1} value={radius} onChange={e => setRadius(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="count"># of homes</Label>
            <Input id="count" type="number" min={1} max={200} value={count} onChange={e => setCount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="target">Target quote ($)</Label>
            <Input id="target" type="number" value={targetQuote} onChange={e => setTargetQuote(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="band">Range (±$)</Label>
            <Input id="band" type="number" min={0} value={band} onChange={e => setBand(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Phone on letter</Label>
            <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5">
          <input type="checkbox" checked={smart} onChange={e => setSmart(e.target.checked)} className="mt-0.5" />
          <span className="text-sm">
            <span className="font-semibold text-zinc-800">Smart targeting</span>
            <span className="text-zinc-500"> — qualify &amp; score each home (lot size, owner-occupied, absentee, new mover, value band, income) and list the best prospects first. Turn off for a plain quote-band list.</span>
          </span>
        </label>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {mode === 'area' && (
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <input type="checkbox" checked={exactStreet} onChange={e => setExactStreet(e.target.checked)} />
              <span><span className="font-medium text-zinc-800">Exact street only</span> <span className="text-zinc-500">— just homes on the street you centered on</span></span>
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <input type="checkbox" checked={anyQuote} onChange={e => setAnyQuote(e.target.checked)} />
            <span><span className="font-medium text-zinc-800">Any quote</span> <span className="text-zinc-500">— ignore the price band, just grab the homes</span></span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={runPreview} disabled={previewing || sending}>
            {previewing ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Search size={15} className="mr-1.5" />}
            {previewing ? 'Scanning…' : 'Find homes'}
          </Button>
          <span className="text-xs text-zinc-500">
            {mode === 'area' && 'Pulls homes within the radius of that spot · '}
            Quotes {formatCurrency((Number(targetQuote) || 50) - (Number(band) || 10))}–{formatCurrency((Number(targetQuote) || 50) + (Number(band) || 10))}
            {' '}· already-contacted homes excluded
          </span>
        </div>
      </div>

      {/* Results */}
      {stats && (
        <div className="text-sm text-zinc-600">
          Scanned <strong>{stats.scanned}</strong> homes {mode === 'area' ? `near ${center.trim()}` : `in ${zip}`} · <strong>{stats.in_band}</strong> priced in range
          {stats.already_contacted > 0 && <> · <strong>{stats.already_contacted}</strong> already contacted (skipped)</>} ·
          showing <strong>{rows.length}</strong> new
          {smart && stats.priority && (
            <span className="block mt-1 text-xs text-zinc-500">
              Best-first by lead score
              {' '}· <strong className="text-green-700">{stats.priority.first}</strong> first-wave
              {' '}· <strong>{stats.priority.second}</strong> second-wave
              {stats.priority.skip ? ` · ${stats.priority.skip} low-priority` : ''}
            </span>
          )}
          {smart && stats.gate_dropped ? (
            <span className="block mt-1 text-xs text-zinc-500">
              <strong>{stats.gate_dropped}</strong> dropped by gates
              {stats.gate_breakdown && Object.keys(stats.gate_breakdown).length > 0 && (
                <>: {Object.entries(stats.gate_breakdown).map(([k, v]) => `${v} — ${GATE_LABEL[k] ?? k}`).join(' · ')}</>
              )}
            </span>
          ) : null}
        </div>
      )}

      {rows.length > 0 && (
        <div className="border rounded-xl bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">
                  <input type="checkbox" checked={rows.every(r => r.selected)} onChange={toggleAll} disabled={sending} />
                </th>
                <th className="px-4 py-2.5">Homeowner</th>
                <th className="px-4 py-2.5">Address</th>
                {smart && <th className="px-4 py-2.5">Target</th>}
                <th className="px-4 py-2.5">Lot</th>
                <th className="px-4 py-2.5">Quote</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.address}-${r.zip}`} className="border-b last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggleRow(idx)}
                      disabled={sending || r.sendState === 'sent'}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{r.address}, {r.city}</td>
                  {smart && (
                    <td className="px-4 py-2.5" title={whyText(r.factors)}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          (r.lead_score ?? 0) >= 8 ? 'bg-green-100 text-green-800'
                            : (r.lead_score ?? 0) >= 4 ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}>{r.lead_score ?? 0}</span>
                        <span className="text-[11px] leading-tight text-zinc-500">
                          {r.mail_priority === 'first' ? '1st wave' : r.mail_priority === 'second' ? '2nd wave' : 'low'}
                          {r.segment && r.segment !== 'general' && <><br />{SEGMENT_LABEL[r.segment] ?? r.segment}</>}
                          {r.income_band === 'above' && <><br /><span className="text-green-700 font-semibold">↑ higher-income block</span></>}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-zinc-500">{r.lot_sqft ? `${r.lot_sqft.toLocaleString()} sqft` : '—'}</td>
                  <td className="px-4 py-2.5 font-semibold text-green-700">{formatCurrency(r.quote)}</td>
                  <td className="px-4 py-2.5">
                    {r.sendState === 'idle' && <span className="text-zinc-400 text-xs">Ready</span>}
                    {r.sendState === 'sending' && (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                        <Loader2 size={11} className="animate-spin" /> Drafting &amp; sending…
                      </span>
                    )}
                    {r.sendState === 'sent' && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                        <CheckCircle2 size={11} /> Sent
                      </span>
                    )}
                    {r.sendState === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-red-600 text-xs" title={r.error}>
                        <XCircle size={11} /> {r.error?.slice(0, 60) ?? 'Failed'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Send / campaign bar */}
          <div className="px-4 py-3 bg-zinc-50 border-t space-y-3">
            <div className="text-sm text-zinc-600">
              <strong>{selectedRows.length}</strong> selected · est. cost{' '}
              <strong>{formatCurrency(estCost)}</strong>
              {progress && (
                <span className="ml-3 text-amber-600">Sending {progress.done}/{progress.total}…</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Add to campaign */}
              <select
                value={campaignChoice}
                onChange={e => setCampaignChoice(e.target.value)}
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="">Add to campaign…</option>
                <option value="__new__">+ New campaign</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {campaignChoice === '__new__' && (
                <Input value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} placeholder="Campaign name" className="w-48 h-9" />
              )}
              <Button variant="outline" onClick={addToCampaign} disabled={addingToCampaign || !campaignChoice || selectedRows.length === 0}>
                {addingToCampaign ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Megaphone size={15} className="mr-1.5" />}
                Add {selectedRows.length} to campaign
              </Button>

              <span className="text-zinc-300 mx-1">|</span>

              <Button onClick={sendAll} disabled={sending || selectedRows.length === 0}>
                {sending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />}
                {sending ? 'Sending…' : `Send ${selectedRows.length} now`}
              </Button>
            </div>
            <p className="text-xs text-zinc-400">
              Add to a campaign to review &amp; send later from the Campaigns tab, or send now.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
