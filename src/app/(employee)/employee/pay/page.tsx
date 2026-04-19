'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { TrendingUp, Wallet, CheckCircle2, Clock, Gift, CreditCard, ChevronDown, ChevronUp } from 'lucide-react'

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

function StatCard({
  label, value, sub, accent = false, highlight = false,
}: {
  label: string; value: string; sub?: string; accent?: boolean; highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl p-5 border ${
      accent
        ? 'bg-zinc-900 border-zinc-800 shadow-md'
        : highlight
        ? 'bg-white border-zinc-200 shadow-sm'
        : 'bg-white border-zinc-200 shadow-sm'
    }`}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${accent ? 'text-zinc-400' : 'text-zinc-400'}`}>
        {label}
      </p>
      <p className={`text-3xl font-bold leading-none ${accent ? 'text-white' : 'text-zinc-900'}`}>
        {value}
      </p>
      {sub && <p className={`text-xs mt-1.5 ${accent ? 'text-zinc-500' : 'text-zinc-400'}`}>{sub}</p>}
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

  const activeMonths = data?.history.filter(
    (r) => r.totalHours > 0 || r.stillOwed > 0 || r.bonusOwed > 0
  ) ?? []
  const visibleMonths = showAll ? activeMonths : activeMonths.slice(0, 4)
  const currentMonth = data?.history[0]

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-zinc-200 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-zinc-400 pt-16">
        <Wallet size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Could not load pay data.</p>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8 max-w-lg mx-auto space-y-5">

      {/* Page header */}
      <div className="pt-1">
        <h1 className="text-2xl font-bold text-zinc-900">My Pay</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{formatCurrency(data.hourly_rate)}/hr · {data.name}</p>
      </div>

      {/* ── Outstanding balance — primary card ──────────────────────────── */}
      <div className={`rounded-2xl p-5 border shadow-md ${
        data.totals.lifetime_owed > 0
          ? 'bg-zinc-900 border-zinc-800'
          : 'bg-green-950 border-green-900'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Currently Owed to You
            </p>
            <p className={`text-4xl font-bold ${data.totals.lifetime_owed > 0 ? 'text-white' : 'text-green-400'}`}>
              {formatCurrency(data.totals.lifetime_owed)}
            </p>
            {data.totals.lifetime_owed === 0 && (
              <p className="text-sm text-green-500 mt-1.5 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                All caught up
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Wallet size={18} className="text-zinc-300" />
          </div>
        </div>
      </div>

      {/* ── Lifetime stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-zinc-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Earned</p>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatCurrency(data.totals.lifetime_earned)}</p>
          <p className="text-xs text-zinc-400 mt-1">all time</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={14} className="text-zinc-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Paid</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totals.lifetime_paid)}</p>
          <p className="text-xs text-zinc-400 mt-1">all time</p>
        </div>
      </div>

      {/* ── This month ───────────────────────────────────────────────────── */}
      {currentMonth && currentMonth.totalHours > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-800">{currentMonth.label}</p>
            <span className="text-xs text-zinc-400 font-medium">This month</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-500">
                <Clock size={14} />
                {currentMonth.totalHours.toFixed(1)} hrs
              </span>
              <span className="font-semibold text-zinc-900">{formatCurrency(currentMonth.hoursPay)}</span>
            </div>

            {currentMonth.bonusOwed > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-purple-600">
                  <Gift size={14} />
                  Bonus
                </span>
                <span className="font-semibold text-purple-700">+{formatCurrency(currentMonth.bonusOwed)}</span>
              </div>
            )}

            <div className="border-t border-zinc-100 pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-700">Total earned</span>
              <span className="text-base font-bold text-zinc-900">{formatCurrency(currentMonth.totalEarned)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Paid so far</span>
              <span className="font-semibold text-green-600">{formatCurrency(currentMonth.totalPaid)}</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, currentMonth.totalEarned > 0 ? (currentMonth.totalPaid / currentMonth.totalEarned) * 100 : 0)}%` }}
              />
            </div>

            {currentMonth.stillOwed > 0 && (
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-zinc-500">Still owed</span>
                <span className="font-bold text-orange-500">{formatCurrency(currentMonth.stillOwed)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bonuses & payments ───────────────────────────────────────────── */}
      {data.recent_bonuses.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-800">Bonuses & Payments</p>
          </div>
          <div className="divide-y divide-zinc-50">
            {data.recent_bonuses.map((b, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    b.type === 'bonus' ? 'bg-purple-50' : 'bg-green-50'
                  }`}>
                    {b.type === 'bonus'
                      ? <Gift size={15} className="text-purple-500" />
                      : <CreditCard size={15} className="text-green-500" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-800">
                      {b.type === 'bonus' ? 'Bonus' : 'Payment received'}
                    </p>
                    {b.description && <p className="text-xs text-zinc-400">{b.description}</p>}
                    <p className="text-xs text-zinc-400">{b.entry_date}</p>
                  </div>
                </div>
                <p className={`text-sm font-bold ${b.type === 'bonus' ? 'text-purple-600' : 'text-green-600'}`}>
                  {b.type === 'bonus' ? '+' : ''}{formatCurrency(b.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly history ───────────────────────────────────────────────── */}
      {activeMonths.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-800">Monthly History</p>
          </div>
          <div className="divide-y divide-zinc-50">
            {visibleMonths.map((row) => (
              <div key={row.month} className="px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-semibold text-zinc-800">{row.label}</p>
                  {row.stillOwed > 0 ? (
                    <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2.5 py-0.5 rounded-full font-semibold">
                      {formatCurrency(row.stillOwed)} owed
                    </span>
                  ) : (
                    <span className="text-xs bg-green-50 text-green-600 border border-green-100 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      Paid
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-zinc-400 mb-0.5">Hours</p>
                    <p className="font-semibold text-zinc-700">{row.totalHours.toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 mb-0.5">Earned</p>
                    <p className="font-semibold text-zinc-700">{formatCurrency(row.totalEarned)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 mb-0.5">Paid</p>
                    <p className="font-semibold text-green-600">{formatCurrency(row.totalPaid)}</p>
                  </div>
                </div>

                {row.bonusOwed > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-purple-500 mb-2">
                    <Gift size={11} />
                    <span>Includes {formatCurrency(row.bonusOwed)} bonus</span>
                  </div>
                )}

                {row.totalEarned > 0 && (
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.min(100, (row.totalPaid / row.totalEarned) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {activeMonths.length > 4 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600 py-3 border-t border-zinc-100 transition-colors"
            >
              {showAll ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show {activeMonths.length - 4} more months</>}
            </button>
          )}
        </div>
      )}

      {activeMonths.length === 0 && !loading && (
        <div className="text-center py-12 text-zinc-400">
          <Wallet size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No pay history yet.</p>
        </div>
      )}
    </div>
  )
}
