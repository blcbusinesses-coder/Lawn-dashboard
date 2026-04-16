'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/currency'

interface MonthData {
  month: string
  revenue: number
  expenses: number
  payroll: number
  profit: number
}

export default function MoneyPage() {
  const [data, setData] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(12)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/money/summary?months=${range}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [range])

  const totals = data.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      expenses: acc.expenses + m.expenses,
      payroll: acc.payroll + m.payroll,
      profit: acc.profit + m.profit,
    }),
    { revenue: 0, expenses: 0, payroll: 0, profit: 0 }
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltip = (value: any) =>
    value != null ? formatCurrency(Number(value)) : ''

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Money</h1>
          <p className="text-sm text-zinc-500 mt-1">Revenue, expenses, and profit overview</p>
        </div>
        <div className="flex gap-2">
          {[3, 6, 12].map((r) => (
            <Button key={r} size="sm" variant={range === r ? 'default' : 'outline'} onClick={() => setRange(r)}>
              {r}M
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Revenue', value: totals.revenue, color: 'text-green-600' },
          { label: 'Total Expenses', value: totals.expenses, color: 'text-red-500' },
          { label: 'Payroll', value: totals.payroll, color: 'text-orange-500' },
          { label: 'Net Profit', value: totals.profit, color: totals.profit >= 0 ? 'text-green-600' : 'text-red-500' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">{card.label}</p>
            {loading ? (
              <Skeleton className="h-7 w-32 mt-2" />
            ) : (
              <p className={`text-2xl font-bold mt-1 ${card.color}`}>{formatCurrency(card.value)}</p>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-zinc-200 p-6 h-72">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 p-6 h-64">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Revenue vs Expenses Bar Chart */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-base font-semibold text-zinc-800 mb-4">Revenue vs Expenses</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#71717a' }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip formatter={formatTooltip} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payroll" name="Payroll" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profit Line Chart */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6">
            <h2 className="text-base font-semibold text-zinc-800 mb-4">Net Profit Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#71717a' }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip formatter={formatTooltip} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#18181b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly breakdown table */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-base font-semibold text-zinc-800">Monthly Breakdown</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">Month</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">Revenue</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">Expenses</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">Payroll</th>
                  <th className="text-right px-4 py-3 font-medium text-zinc-600">Profit</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().map((row) => (
                  <tr key={row.month} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium text-zinc-700">{row.month}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{formatCurrency(row.expenses)}</td>
                    <td className="px-4 py-2.5 text-right text-orange-500">{formatCurrency(row.payroll)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${row.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td className="px-4 py-3 font-bold text-zinc-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">{formatCurrency(totals.expenses)}</td>
                  <td className="px-4 py-3 text-right font-bold text-orange-500">{formatCurrency(totals.payroll)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(totals.profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
