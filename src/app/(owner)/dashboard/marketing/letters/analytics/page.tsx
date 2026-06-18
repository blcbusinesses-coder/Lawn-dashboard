'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, BarChart3, Loader2, Mail, QrCode, DollarSign, CheckCircle2, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'

interface Analytics {
  days: string
  sent: number
  scans: number
  spend: number
  conversions: number
  first_month_revenue: number
  roi_multiple: number | null
  scan_rate: number | null
  conversion_rate: number | null
  assumptions: { price_per_letter: number; mows_per_month: number; first_month_discount: number }
}

const RANGES: Array<{ key: string; label: string }> = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: '365', label: 'Last year' },
  { key: 'all', label: 'All time' },
]

function pct(n: number | null): string {
  return n == null ? '—' : `${Math.round(n * 100)}%`
}

export default function LetterAnalyticsPage() {
  const [days, setDays] = useState('30')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/letters/analytics?days=${d}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  const cards = [
    { Icon: Mail, label: 'Letters sent', value: data ? data.sent.toLocaleString() : '—', sub: 'mailed in this period' },
    { Icon: QrCode, label: 'QR scans', value: data ? data.scans.toLocaleString() : '—', sub: data?.scan_rate != null ? `${pct(data.scan_rate)} of letters scanned` : 'scan rate —' },
    { Icon: DollarSign, label: 'Spend on letters', value: data ? formatCurrency(data.spend) : '—', sub: data ? `${formatCurrency(data.assumptions.price_per_letter)} per letter` : '' },
    { Icon: CheckCircle2, label: 'Conversions', value: data ? data.conversions.toLocaleString() : '—', sub: data?.conversion_rate != null ? `${pct(data.conversion_rate)} of letters booked` : 'bookings from the funnel' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/marketing/letters" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-3">
          <ArrowLeft size={14} /> Letters
        </Link>
        <div className="flex items-center gap-3">
          <BarChart3 className="text-green-600" size={26} />
          <div>
            <h1 className="text-2xl font-bold">Letter Analytics</h1>
            <p className="text-sm text-zinc-500">How your direct-mail letters are performing — and what they&apos;re earning.</p>
          </div>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setDays(r.key)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              days === r.key ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            {r.label}
          </button>
        ))}
        {loading && <span className="inline-flex items-center text-sm text-zinc-400 ml-1"><Loader2 size={14} className="animate-spin mr-1.5" />Loading…</span>}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="border rounded-xl bg-white p-5">
            <div className="flex items-center gap-2 mb-3 text-zinc-400">
              <c.Icon size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{c.label}</span>
            </div>
            <p className="text-3xl font-extrabold text-zinc-900 leading-none">{c.value}</p>
            <p className="text-xs text-zinc-500 mt-2">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Return on spend */}
      <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#1e3d12' }}>
        <div className="px-6 py-4 flex items-center gap-2" style={{ background: '#1e3d12' }}>
          <TrendingUp size={18} className="text-white" />
          <h2 className="font-bold text-white">Return on Spend</h2>
        </div>
        <div className="p-6 bg-white">
          {data && data.conversions > 0 ? (
            <div className="grid md:grid-cols-[auto_1fr] gap-6 items-center">
              <div>
                <p className="text-5xl font-extrabold leading-none" style={{ color: '#1e3d12' }}>
                  {data.roi_multiple != null ? `${data.roi_multiple}×` : '—'}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mt-2">Return on spend</p>
              </div>
              <div className="text-sm text-zinc-600 leading-relaxed">
                <p>
                  <strong>{data.conversions}</strong> {data.conversions === 1 ? 'booking' : 'bookings'} →{' '}
                  <strong>{formatCurrency(data.first_month_revenue)}</strong> in first-month revenue
                  {' '}against <strong>{formatCurrency(data.spend)}</strong> in letter spend.
                </p>
                <p className="text-xs text-zinc-400 mt-2">
                  First-month revenue assumes weekly service ({data.assumptions.mows_per_month} mows/mo) with the{' '}
                  {Math.round(data.assumptions.first_month_discount * 100)}% first-month discount applied — i.e. quote × {data.assumptions.mows_per_month} × {1 - data.assumptions.first_month_discount} per booking.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No bookings in this period yet. Once homeowners scan a letter QR and book, your return on spend shows here.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        Tracking note: QR scans are counted when someone opens the scheduling page from a letter. Conversions are self-scheduled
        bookings (QR or address lookup). Spend is letters mailed × cost per letter.
      </p>
    </div>
  )
}
