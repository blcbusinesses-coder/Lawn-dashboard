'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, RefreshCw, Play, Loader2, CheckCircle2, XCircle,
  ListChecks, AlertTriangle, Home,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/currency'

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
  lot_size: string | null
  created_at: string
}

const SOURCE_META: Record<string, { Icon: typeof Home; endpoint: string }> = {
  violations_311:    { Icon: AlertTriangle, endpoint: '/api/letters/monitor/violations' },
  homeowners_zillow: { Icon: Home,          endpoint: '/api/letters/monitor/homeowners' },
}

export default function LetterMonitorPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [phone, setPhone] = useState('(260) 000-0000')
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
      setSources(sData.sources ?? [])
      setQueue(qData.items ?? [])
    } catch {
      toast.error('Failed to load monitoring data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function runSource(src: Source) {
    const meta = SOURCE_META[src.key]
    if (!meta) return
    setRunning(src.key)
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
          `${src.label}: found ${data.found ?? 0}, queued ${data.queued ?? 0}, skipped ${data.skipped ?? 0}${reasons}`,
          { duration: 8000 }
        )
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setRunning(null)
    }
  }

  async function patchSource(key: string, patch: { enabled?: boolean; config?: Record<string, unknown> }) {
    try {
      const res = await fetch('/api/letters/monitor/sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...patch }),
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

  // Generate quote + AI copy for address-only rows, one at a time so each
  // request (a Zillow lookup + Haiku call) stays within the serverless limit.
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

  const selectedCost = [...selected].length * 0.93
  const missingCopy = queue.filter(q => !q.ai_copy).length

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/marketing/letters" className="text-zinc-400 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <ListChecks className="text-purple-400" size={20} />
          <h1 className="text-xl font-semibold text-white">Letter Lists & Monitoring</h1>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* ── Sources ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading && sources.length === 0
          ? [0, 1].map(i => <Skeleton key={i} className="h-48 w-full" />)
          : sources.map(src => {
              const meta = SOURCE_META[src.key]
              const Icon = meta?.Icon ?? Home
              const cfg = src.config ?? {}
              const zips = Array.isArray(cfg.target_zips) ? (cfg.target_zips as string[]).join(', ') : ''
              const urls = Array.isArray(cfg.search_urls) ? (cfg.search_urls as string[]).join('\n') : ''
              const isZillow = src.key === 'homeowners_zillow'
              const lr = src.last_result
              return (
                <div key={src.key} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={18} className="text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{src.label}</p>
                        <p className="text-xs text-zinc-500">{src.letter_type}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={src.enabled}
                        onChange={e => patchSource(src.key, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-zinc-500">Target ZIPs (comma-separated)</Label>
                      <Input
                        defaultValue={zips}
                        className="h-8 text-sm"
                        onBlur={e =>
                          patchSource(src.key, {
                            config: { ...cfg, target_zips: e.target.value.split(',').map(z => z.trim()).filter(Boolean) },
                          })
                        }
                      />
                    </div>
                    {isZillow && (
                      <div>
                        <Label className="text-xs text-zinc-500">Zillow “Recently Sold” search URLs (one per line)</Label>
                        <textarea
                          defaultValue={urls}
                          rows={3}
                          className="w-full rounded-md bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 p-2"
                          placeholder="https://www.zillow.com/kendallville-in/sold/..."
                          onBlur={e =>
                            patchSource(src.key, {
                              config: { ...cfg, search_urls: e.target.value.split('\n').map(u => u.trim()).filter(Boolean) },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">
                      {src.last_run_at
                        ? `Last run: ${new Date(src.last_run_at).toLocaleString()}`
                        : 'Never run'}
                      {lr && ` · found ${lr.found ?? 0}, queued ${lr.queued ?? 0}`}
                      {lr?.error && <span className="text-red-400"> · {lr.error}</span>}
                    </p>
                    <Button size="sm" onClick={() => runSource(src)} disabled={running === src.key}>
                      {running === src.key ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {src.key === 'violations_311' ? 'Pull all addresses' : 'Run now'}
                    </Button>
                  </div>
                </div>
              )
            })}
      </div>

      {/* ── Review queue ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">Review Queue ({queue.length})</h2>
          {missingCopy > 0 && (
            <Button size="sm" variant="outline" onClick={generateMissing} disabled={genProgress !== null}>
              {genProgress ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {genProgress ? `Generating ${genProgress.done}/${genProgress.total}` : `Generate copy (${missingCopy})`}
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs text-zinc-500">Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8 w-36 text-sm" />
            <Button size="sm" variant="outline" onClick={() => act('skip')} disabled={sending || selected.size === 0}>
              <XCircle size={14} /> Skip
            </Button>
            <Button size="sm" onClick={() => act('approve')} disabled={sending || selected.size === 0}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Approve &amp; send {selected.size > 0 && `(${formatCurrency(selectedCost)})`}
            </Button>
          </div>
        </div>

        {loading && queue.length === 0 ? (
          <div className="p-4 space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : queue.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            Nothing waiting for review. Enable a source and click “Run now” to pull in new addresses.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                <th className="p-3 w-8">
                  <input type="checkbox" checked={selected.size === queue.length} onChange={toggleAll} />
                </th>
                <th className="p-3">Address</th>
                <th className="p-3">Source</th>
                <th className="p-3">Quote</th>
                <th className="p-3">Letter preview</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(item => (
                <tr key={item.id} className="border-b border-zinc-800/50 align-top">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td className="p-3 text-zinc-200">
                    <div>{item.address}</div>
                    <div className="text-xs text-zinc-500">{item.city}, {item.state} {item.zip}</div>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.source === 'violation' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {item.source === 'violation' ? 'Violation' : 'New homeowner'}
                    </span>
                  </td>
                  <td className="p-3 text-zinc-200">
                    {item.quote_amount != null
                      ? formatCurrency(item.quote_amount)
                      : <span className="text-xs text-amber-400">Needs copy</span>}
                  </td>
                  <td className="p-3 text-xs text-zinc-400 max-w-md">
                    {item.ai_copy
                      ? <span className="line-clamp-3">{item.ai_copy}</span>
                      : <span className="text-zinc-600 italic">Not generated yet — click “Generate copy”.</span>}
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
