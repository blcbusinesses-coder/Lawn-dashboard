'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Megaphone, Loader2, Send, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/currency'

const PRICE_PER_PIECE = 0.93

interface Campaign {
  id: string
  name: string
  description: string | null
  phone: string | null
  pieces_sent: number
  total_cost: number
  recipient_count: number
  created_at: string
}

interface Recipient {
  id: string
  name: string | null
  address: string | null
  city: string | null
  zip: string | null
  quote_amount: number | null
  status: string
  property_features: string | null
  error_message: string | null
}

interface Detail extends Campaign { recipients: Recipient[] }

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [phone, setPhone] = useState('(260) 599-4253')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/letters/campaigns')
      setCampaigns(await res.json())
    } catch { toast.error('Failed to load campaigns') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  async function openCampaign(id: string) {
    setLoadingDetail(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/letters/campaigns/${id}`)
      const d = await res.json()
      setDetail(d)
      if (d.phone) setPhone(d.phone)
    } catch { toast.error('Failed to load campaign') }
    finally { setLoadingDetail(false) }
  }

  const review = detail?.recipients.filter(r => r.status === 'review') ?? []
  const sent = detail?.recipients.filter(r => r.status === 'sent') ?? []
  const failed = detail?.recipients.filter(r => r.status === 'failed') ?? []

  async function sendCampaign() {
    if (!detail) return
    if (review.length === 0) { toast.info('Nothing to send — no review recipients.'); return }
    const ok = window.confirm(
      `Send ${review.length} letters for about ${formatCurrency(review.length * PRICE_PER_PIECE)}? ` +
      `Each is drafted individually and mailed via Lob — this cannot be undone.`
    )
    if (!ok) return

    setSending(true)
    setProgress({ done: 0, total: review.length })
    let totalSent = 0, totalFailed = 0, remaining = review.length
    try {
      // Loop the batched endpoint until no review recipients remain.
      for (let guard = 0; guard < 200 && remaining > 0; guard++) {
        const res = await fetch(`/api/letters/campaigns/${detail.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error ?? 'Send failed'); break }
        totalSent += data.sent ?? 0
        totalFailed += data.failed ?? 0
        remaining = data.remaining ?? 0
        setProgress({ done: review.length - remaining, total: review.length })
        if ((data.results?.length ?? 0) === 0) break // safety: nothing processed
      }
      if (totalFailed === 0) toast.success(`Sent ${totalSent} letters 🎉`)
      else toast.warning(`${totalSent} sent, ${totalFailed} failed`)
    } finally {
      setSending(false)
      setProgress(null)
      await openCampaign(detail.id)
      loadCampaigns()
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/marketing/letters" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-3">
          <ArrowLeft size={14} /> Letters
        </Link>
        <div className="flex items-center gap-3">
          <Megaphone className="text-green-600" size={26} />
          <div>
            <h1 className="text-2xl font-bold">Campaigns</h1>
            <p className="text-sm text-zinc-500">Build a list in Area Blast, then review and send it here in one click.</p>
          </div>
        </div>
      </div>

      {/* List */}
      {!detail && (
        loading ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : campaigns.length === 0 ? (
          <div className="border rounded-xl bg-white p-8 text-center text-sm text-zinc-500">
            No campaigns yet. Go to <Link href="/dashboard/marketing/letters/blast" className="font-semibold text-green-700 underline">Area Blast</Link>, pick your homes, and &ldquo;Add to campaign.&rdquo;
          </div>
        ) : (
          <div className="border rounded-xl bg-white divide-y">
            {campaigns.map(c => (
              <button key={c.id} onClick={() => openCampaign(c.id)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-zinc-50">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-zinc-500">
                    {c.recipient_count} recipient{c.recipient_count === 1 ? '' : 's'}
                    {c.pieces_sent > 0 && ` · ${c.pieces_sent} sent · ${formatCurrency(c.total_cost)}`}
                  </p>
                </div>
                <ChevronRight size={16} className="text-zinc-400 shrink-0" />
              </button>
            ))}
          </div>
        )
      )}

      {/* Detail */}
      {detail && (
        <div className="space-y-5">
          <button onClick={() => setDetail(null)} className="text-sm text-zinc-500 hover:text-zinc-800 inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> All campaigns
          </button>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{detail.name}</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                <span className="text-amber-600 font-medium">{review.length} to send</span>
                {sent.length > 0 && <> · <span className="text-emerald-600">{sent.length} sent</span></>}
                {failed.length > 0 && <> · <span className="text-red-600">{failed.length} failed</span></>}
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1">Phone on letters</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="w-44" />
              </div>
              <Button onClick={sendCampaign} disabled={sending || review.length === 0}>
                {sending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />}
                {sending && progress ? `Sending ${progress.done}/${progress.total}…` : `Send ${review.length} (${formatCurrency(review.length * PRICE_PER_PIECE)})`}
              </Button>
            </div>
          </div>

          {loadingDetail ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : (
            <div className="border rounded-xl bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b">
                  <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5">Homeowner</th>
                    <th className="px-4 py-2.5">Address</th>
                    <th className="px-4 py-2.5">Quote</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recipients.map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{r.name}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{[r.address, r.city].filter(Boolean).join(', ')}</td>
                      <td className="px-4 py-2.5 font-semibold text-green-700">{r.quote_amount != null ? formatCurrency(r.quote_amount) : '—'}</td>
                      <td className="px-4 py-2.5">
                        {r.status === 'review' && <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><Clock size={11} /> Ready</span>}
                        {r.status === 'sent' && <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 size={11} /> Sent</span>}
                        {r.status === 'failed' && <span className="inline-flex items-center gap-1 text-red-600 text-xs" title={r.error_message ?? ''}><XCircle size={11} /> Failed</span>}
                        {!['review', 'sent', 'failed'].includes(r.status) && <span className="text-zinc-400 text-xs">{r.status}</span>}
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
