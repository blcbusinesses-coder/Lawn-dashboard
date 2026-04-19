'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/currency'

interface MonthRow {
  month: string
  label: string
  clockHours: number
  manualHours: number
  totalHours: number
  hoursPay: number
  bonusOwed: number
  totalEarned: number
  totalPaid: number
  stillOwed: number
}

interface Bonus {
  entry_date: string
  amount: number
  type: 'bonus' | 'payment'
  description: string | null
}

interface PayData {
  name: string
  hourly_rate: number
  history: MonthRow[]
  totals: {
    lifetime_earned: number
    lifetime_paid: number
    lifetime_owed: number
  }
  recent_bonuses: Bonus[]
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 animate-pulse space-y-3">
      <div className="h-3 bg-zinc-100 rounded w-24" />
      <div className="h-8 bg-zinc-100 rounded w-36" />
    </div>
  )
}

export default function PayPage() {
  const [data, setData] = useState<PayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/employee/pay')
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeMonths = data?.history.filter((r) => r.totalHours > 0 || r.stillOwed > 0 || r.bonusOwed > 0) ?? []
  const visibleMonths = showAll ? activeMonths : activeMonths.slice(0, 4)

  return (
    <div className="p-4 pb-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-5 pt-1">
        <h1 className="text-2xl font-bold text-zinc-900">My Pay</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {data ? `${formatCurrency(data.hourly_rate)}/hr` : ''}
        </p>
      </div>

      {/* ── Top summary cards ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Still owed — most prominent */}
          <div className="col-span-2 bg-zinc-900 rounded-2xl p-5">
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Currently Owed to You</p>
            <p className={`text-4xl font-bold ${data.totals.lifetime_owed > 0 ? 'text-white' : 'text-green-400'}`}>
              {formatCurrency(data.totals.lifetime_owed)}
            </p>
            {data.totals.lifetime_owed === 0 && (
              <p className="text-xs text-zinc-400 mt-1">You&apos;re all paid up ✓</p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-4 border border-zinc-100">
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-zinc-900">{formatCurrency(data.totals.lifetime_earned)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">all time</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-zinc-100">
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totals.lifetime_paid)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">all time</p>
          </div>

          {/* This month highlight */}
          {data.history[0] && data.history[0].totalHours > 0 && (
            <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs text-blue-500 uppercase tracking-wider mb-2">This Month — {data.history[0].label}</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(data.history[0].totalEarned)}</p>
                  <p className="text-xs text-blue-400 mt-0.5">{data.history[0].totalHours.toFixed(1)} hrs worked</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-blue-700">{formatCurrency(data.history[0].totalPaid)} paid</p>
                  {data.history[0].stillOwed > 0 && (
                    <p className="text-sm font-bold text-orange-500">{formatCurrency(data.history[0].stillOwed)} still owed</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Recent bonuses / payments ─────────────────────────────────────── */}
      {data && data.recent_bonuses.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bonuses & Payments</h2>
          <div className="space-y-2">
            {data.recent_bonuses.map((b, i) => (
              <div key={i} className="bg-white rounded-xl border border-zinc-100 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-800">
                    {b.type === 'bonus' ? '🎁 Bonus' : '💵 Payment received'}
                  </p>
                  {b.description && <p className="text-xs text-zinc-400 mt-0.5">{b.description}</p>}
                  <p className="text-xs text-zinc-400">{b.entry_date}</p>
                </div>
                <p className={`text-sm font-bold ${b.type === 'bonus' ? 'text-purple-600' : 'text-green-600'}`}>
                  {b.type === 'bonus' ? '+' : ''}{formatCurrency(b.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly breakdown ─────────────────────────────────────────────── */}
      {activeMonths.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Monthly History</h2>
          <div className="space-y-2">
            {visibleMonths.map((row) => (
              <div key={row.month} className="bg-white rounded-xl border border-zinc-100 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-zinc-800">{row.label}</p>
                  {row.stillOwed > 0 ? (
                    <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full font-medium">
                      {formatCurrency(row.stillOwed)} owed
                    </span>
                  ) : row.totalEarned > 0 ? (
                    <span className="text-xs bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                      Paid ✓
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500">
                  <div>
                    <p className="text-zinc-400">Hours</p>
                    <p className="font-semibold text-zinc-700">{row.totalHours.toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-zinc-400">Earned</p>
                    <p className="font-semibold text-zinc-700">{formatCurrency(row.totalEarned)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400">Paid</p>
                    <p className="font-semibold text-green-600">{formatCurrency(row.totalPaid)}</p>
                  </div>
                </div>
                {/* Progress bar — paid vs earned */}
                {row.totalEarned > 0 && (
                  <div className="mt-2.5 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (row.totalPaid / row.totalEarned) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}

            {activeMonths.length > 4 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="w-full text-sm text-zinc-400 hover:text-zinc-600 py-2 transition-colors"
              >
                {showAll ? 'Show less ↑' : `Show ${activeMonths.length - 4} more months ↓`}
              </button>
            )}

            {activeMonths.length === 0 && (
              <p className="text-sm text-zinc-400 text-center py-6">No pay history yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
