'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, RefreshCw, Play, Loader2, CheckCircle2, XCircle,
  AlertTriangle, Home,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/currency'

const PRICE_PER_PIECE = 0.93

type SourceKey = 'violations_311' | 'homeowners_zillow'

interface RunResult {
  found?: number; queued?: number; skipped?: number; error?: string | null
  reasons?: Record<string, number>
}
interface Source {
  key: string
  label: string
  letter_type: string
  enabled: boolean
  config: Record<string, unknown>
  last_run_at: string | null
  last_result: RunResult | null
}
interface QueueItem {
  id: string
  name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  source: string
  quote_amount: number | null
  ai_copy: string | null
  created_at: string
}

interface SourceMeta {
  Icon: typeof Home
  endpoint: string
  queueSource: string
  title: string
  blurb: string
  runLabel: string
  isZillow: boolean
  accent: string       // text color for icon/heading
  badge: string        // pill classes for the source tag
}

const META: Record<SourceKey, SourceMeta> = {
  violations_311: {
    Icon: AlertTriangle,
    endpoint: '/api/letters/monitor/violations',
    queueSource: 'violation',
    title: 'Grass Violations',
    blurb: 'Pulls the city’s public “Tall Grass / Weeds” 311 list and turns each into a tactful, helpful outreach letter.',
    runLabel: 'Pull all addresses',
    isZillow: false,
    accent: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  homeowners_zillow: {
    Icon: Home,
    endpoint: '/api/letters/monitor/homeowners',
    queueSource: 'new_homeowner',
    title: 'New Homeowners',
    blurb: 'Pulls recently-sold homes from Zillow and welcomes the new neighbors with a friendly lawn-care intro.',
    runLabel: 'Pull recently sold',
    isZillow: true,
    accent: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
}

export default function LetterMonitor({ sourceKey }: { sourceKey: SourceKey }) {
  const meta = META[sourceKey]
  const Icon = meta.Icon

  const [source, setSource] = useState<Source | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phone, setPhone] = useState('(260) 599-4253')
  const [sending, setSending] = useState(false)
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)

  const load = useCallback(async () => {
    try {
      const [sRes, qRes] = await Promise.all([
        fetch('/api/letters/monitor/sources'),
        fetch('/api/letters/monitor/queue'),
      ])
      const sData = await sRes.json()
      const qData = await qRes.json()
      const src = (sData.sources ?? []).find((s: Source) => s.key === sourceKey) ?? null
      setSource(src)
      setQueue((qData.items ?? []).filter((q: QueueItem) => q.source === meta.queueSource))
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [sourceKey, meta.queueSource])

  useEffect(() => { load() }, [load])

  async function runSource() {
    setRunning(true)
    try {
      const res = await fetch(meta.endpoint, { method: 'POST' })
      const data: RunResult = await res.json()
      if (!res.ok || data.error) {
        toast.error(`Run failed: ${data.error ?? res.statusText}`)
      } else {
        const reasons = data.reasons && Object.keys(data.reasons).length
          ? ` — ${Object.entries(data.reasons).map(([k, v]) => `${k}: ${v}`).join(', ')}`
          : ''
        toast.success(
          `Found ${data.found ?? 0}, queued ${data.queued ?? 0}, skipped ${data.skipped ?? 0}${reasons}`,
          { duration: 8000 }
        )
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  async function patchSource(patch: { enabled?: boolean; config?: Record<string, unknown> }) {
    try {
      const res = await fetch('/api/letters/monitor/sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: sourceKey, ...patch }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev => (prev.size === queue.length ? new Set() : new Set(queue.map(q => q.id))))
  }

  async function generateMissing() {
    const pending = queue.filter(q => !q.ai_copy).map(q => q.id)
    if (pending.length === 0) { toast.info('All entries already have letter copy'); return }
    setGenProgress({ done: 0, total: pending.length })
    let ok = 0
    for (let i = 0; i < pending.length; i++) {
      try {
        const res = await fetch('/api/letters/monitor/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate', ids: [pending[i]] }),
        })
        const data = await res.json()
        if (res.ok && data.generated > 0) ok++
      } catch { /* keep going */ }
      setGenProgress({ done: i + 1, total: pending.length })
    }
    setGenProgress(null)
    toast.success(`Generated copy for ${ok} of ${pending.length}`)
    await load()
  }

  async function act(action: 'approve' | 'skip') {
    const ids = [...selected]
    if (ids.length === 0) { toast.error('Select at least one entry'); return }
    if (action === 'approve' && !confirm(`Send ${ids.length} letter(s) via Lob now? This mails real letters.`)) return
    setSending(true)
    try {
      const res = await fetch('/api/letters/monitor/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids, phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (action === 'approve') toast.success(`Sent ${data.sent}, failed ${data.failed}`)
      else toast.success(`Skipped ${data.skipped}`)
      setSelected(new Set())
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSending(false)
    }
  }

  const selectedCost = selected.size * PRICE_PER_PIECE
  const missingCopy = queue.filter(q => !q.ai_copy).length
  const cfg = source?.config ?? {}
  const zips = Array.isArray(cfg.target_zips) ? (cfg.target_zips as string[]).join(', ') : ''
  const urls = Array.isArray(cfg.search_urls) ? (cfg.search_urls as string[]).join('\n') : ''
  const lr = source?.last_result

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Icon size={22} className={meta.accent} />
            {meta.title}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{meta.blurb}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/marketing/letters">
            <Button variant="outline" size="sm" className="gap-1.5"><ArrowLeft size={14} /> Letters</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>
      </div>

      {/* Source config */}
      {loading && !source ? (
        <Skeleton className="h-44 w-full mb-4" />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={source?.enabled ?? false}
                onChange={e => patchSource({ enabled: e.target.checked })}
              />
              Source enabled
            </label>
            <Button size="sm" onClick={runSource} disabled={running} className="gap-1.5">
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {meta.runLabel}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-zinc-500 mb-1 block">Target ZIPs (comma-separated)</Label>
              <Input
                defaultValue={zips}
                onBlur={e =>
                  patchSource({ config: { ...cfg, target_zips: e.target.value.split(',').map(z => z.trim()).filter(Boolean) } })
                }
              />
            </div>
            {meta.isZillow && (
              <div>
                <Label className="text-xs text-zinc-500 mb-1 block">Zillow “Recently Sold” search URLs (one per line)</Label>
                <textarea
                  defaultValue={urls}
                  rows={3}
                  className="w-full rounded-md border border-zinc-200 text-sm text-zinc-800 p-2"
                  placeholder="https://www.zillow.com/kendallville-in/sold/..."
                  onBlur={e =>
                    patchSource({ config: { ...cfg, search_urls: e.target.value.split('\n').map(u => u.trim()).filter(Boolean) } })
                  }
                />
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-400">
            {source?.last_run_at ? `Last run: ${new Date(source.last_run_at).toLocaleString()}` : 'Never run'}
            {lr && ` · found ${lr.found ?? 0}, queued ${lr.queued ?? 0}`}
            {lr?.error && <span className="text-red-500"> · {lr.error}</span>}
          </p>
        </div>
      )}

      {/* Review queue */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-zinc-200">
          <h2 className="text-sm font-semibold text-zinc-800">Review Queue ({queue.length})</h2>
          {missingCopy > 0 && (
            <Button size="sm" variant="outline" onClick={generateMissing} disabled={genProgress !== null} className="gap-1.5">
              {genProgress ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {genProgress ? `Generating ${genProgress.done}/${genProgress.total}` : `Generate copy (${missingCopy})`}
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs text-zinc-500">Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 w-36 text-sm" />
            <Button size="sm" variant="outline" onClick={() => act('skip')} disabled={sending || selected.size === 0} className="gap-1.5">
              <XCircle size={14} /> Skip
            </Button>
            <Button size="sm" onClick={() => act('approve')} disabled={sending || selected.size === 0} className="gap-1.5">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Approve &amp; send {selected.size > 0 && `(${formatCurrency(selectedCost)})`}
            </Button>
          </div>
        </div>

        {loading && queue.length === 0 ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : queue.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            Nothing waiting for review. Enable the source above and click “{meta.runLabel}”.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                <th className="p-3 w-8">
                  <input type="checkbox" checked={selected.size === queue.length} onChange={toggleAll} />
                </th>
                <th className="p-3">Address</th>
                <th className="p-3">Quote</th>
                <th className="p-3">Letter preview</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(item => (
                <tr key={item.id} className="border-b border-zinc-100 align-top hover:bg-zinc-50">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td className="p-3 text-zinc-800">
                    <div className="font-medium">{item.address}</div>
                    <div className="text-xs text-zinc-500">{item.city}, {item.state} {item.zip}</div>
                  </td>
                  <td className="p-3 text-zinc-800">
                    {item.quote_amount != null
                      ? formatCurrency(item.quote_amount)
                      : <span className="text-xs text-amber-600">Needs copy</span>}
                  </td>
                  <td className="p-3 text-xs text-zinc-500 max-w-md">
                    {item.ai_copy
                      ? <span className="line-clamp-3">{item.ai_copy}</span>
                      : <span className="text-zinc-400 italic">Not generated yet — click “Generate copy”.</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
