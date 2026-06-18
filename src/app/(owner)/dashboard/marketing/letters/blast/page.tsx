'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Crosshair, Loader2, Search, Send,
  CheckCircle2, XCircle,
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

  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [rows, setRows] = useState<CandidateRow[]>([])
  const [stats, setStats] = useState<{ scanned: number; in_band: number; already_contacted: number } | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

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
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Preview failed')
        return
      }
      const candidates: Candidate[] = data.candidates ?? []
      setRows(candidates.map(c => ({ ...c, selected: true, sendState: 'idle' as SendState })))
      setStats({ scanned: data.scanned ?? 0, in_band: data.in_band ?? 0, already_contacted: data.already_contacted ?? 0 })
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

          {/* Send bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-t">
            <div className="text-sm text-zinc-600">
              <strong>{selectedRows.length}</strong> selected · est. cost{' '}
              <strong>{formatCurrency(estCost)}</strong>
              {progress && (
                <span className="ml-3 text-amber-600">
                  Sending {progress.done}/{progress.total}…
                </span>
              )}
            </div>
            <Button onClick={sendAll} disabled={sending || selectedRows.length === 0}>
              {sending
                ? <Loader2 size={15} className="animate-spin mr-1.5" />
                : <Send size={15} className="mr-1.5" />}
              {sending ? 'Sending…' : `Draft & send ${selectedRows.length} letters`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
