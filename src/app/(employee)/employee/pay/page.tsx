'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils/currency'
import { TrendingUp, Wallet, CheckCircle2, Clock, CreditCard, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'

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

interface FlatEntry {
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
  recent_bonuses: FlatEntry[]
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

  // Flat pay entries (what the owner called "bonuses" — employee just sees as additional pay)
  const flatPayEntries = data?.recent_bonuses.filter((e) => e.type === 'bonus') ?? []
  const paymentEntries = data?.recent_bonuses.filter((e) => e.type === 'payment') ?? []

  if (loading) {
    return (
      <div className="p-4 space-y-3 max-w-lg mx-auto pt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-zinc-200 shadow-sm animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-zinc-400 pt-20">
        <Wallet size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Could not load pay data.</p>
      </div>
    )
  }

  return (
    <div className="p-4 pb-8 max-w-lg mx-auto space-y-4">

      {/* Page header */}
      <div className="pt-1">
        <h1 className="text-2xl font-bold text-zinc-900">My Pay</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{data.name} &nbsp;·&nbsp; {formatCurrency(data.hourly_rate)}/hr</p>
      </div>

      {/* ── Balance card ─────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 border shadow-md ${
        data.totals.lifetime_owed > 0 ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-900 border-zinc-800'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Balance Owed to You
            </p>
            <p className={`text-4xl font-bold leading-none ${data.totals.lifetime_owed > 0 ? 'text-white' : 'text-green-400'}`}>
              {formatCurrency(data.totals.lifetime_owed)}
            </p>
            {data.totals.lifetime_owed === 0 && (
              <p className="text-sm text-green-500 mt-2 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Fully paid up
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-zinc-300" />
          </div>
        </div>
      </div>

      {/* ── All-time totals ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={13} className="text-zinc-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Earned</p>
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatCurrency(data.totals.lifetime_earned)}</p>
          <p className="text-xs text-zinc-400 mt-1">all time</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <CreditCard size={13} className="text-zinc-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Paid</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totals.lifetime_paid)}</p>
          <p className="text-xs text-zinc-400 mt-1">all time</p>
        </div>
      </div>

      {/* ── This month detail ─────────────────────────────────────────────── */}
      {currentMonth && currentMonth.totalEarned > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-800">{currentMonth.label}</p>
            <span className="text-xs text-zinc-400">This month</span>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            {/* Hours line */}
            {currentMonth.hoursPay > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-zinc-600">
                  <Clock size={14} className="text-zinc-400" />
                  {currentMonth.totalHours.toFixed(1)} hrs × {formatCurrency(data.hourly_rate)}
                </span>
                <span className="font-medium text-zinc-800">{formatCurrency(currentMonth.hoursPay)}</span>
              </div>
            )}

            {/* Flat pay entries this month */}
            {currentMonth.bonusOwed > 0 && flatPayEntries
              .filter(e => e.entry_date >= currentMonth.month + '-01')
              .map((e, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-600">
                    <DollarSign size={14} className="text-zinc-400" />
                    {e.description || 'Additional pay'}
                  </span>
                  <span className="font-medium text-zinc-800">{formatCurrency(e.amount)}</span>
                </div>
              ))
            }

            {/* Divider + total */}
            <div className="border-t border-zinc-100 pt-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-700">Total earned</span>
              <span className="text-base font-bold text-zinc-900">{formatCurrency(currentMonth.totalEarned)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Paid so far</span>
              <span className="font-semibold text-green-600">{formatCurrency(currentMonth.totalPaid)}</span>
            </div>

            {/* Progress */}
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, currentMonth.totalEarned > 0 ? (currentMonth.totalPaid / currentMonth.totalEarned) * 100 : 0)}%` }}
              />
            </div>

            {currentMonth.stillOwed > 0 && (
              <div className="flex items-center justify-between text-sm pt-0.5">
                <span className="text-zinc-500">Outstanding</span>
                <span className="font-bold text-orange-500">{formatCurrency(currentMonth.stillOwed)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payments received ─────────────────────────────────────────────── */}
      {paymentEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-800">Payments Received</p>
          </div>
          <div className="divide-y divide-zinc-50">
            {paymentEntries.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-zinc-800">{e.description || 'Payment'}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{e.entry_date}</p>
                </div>
                <p className="text-sm font-bold text-green-600">{formatCurrency(e.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly history ───────────────────────────────────────────────── */}
      {activeMonths.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-800">Pay History</p>
          </div>
          <div className="divide-y divide-zinc-50">
            {visibleMonths.map((row) => (
              <div key={row.month} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-sm font-semibold text-zinc-800">{row.label}</p>
                  {row.stillOwed > 0 ? (
                    <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2.5 py-0.5 rounded-full font-semibold">
                      {formatCurrency(row.stillOwed)} owed
                    </span>
                  ) : (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle2 size={10} />
                      Paid
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-2.5">
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
              onClick={() => setShowAll(s => !s)}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600 py-3 border-t border-zinc-100 transition-colors"
            >
              {showAll
                ? <><ChevronUp size={14} /> Show less</>
                : <><ChevronDown size={14} /> Show {activeMonths.length - 4} more months</>
              }
            </button>
          )}
        </div>
      )}

      {activeMonths.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <Wallet size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No pay history yet.</p>
        </div>
      )}
    </div>
  )
}
