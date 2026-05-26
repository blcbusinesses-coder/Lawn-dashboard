'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Download, Plus, Trash2, FileSpreadsheet, Check, PiggyBank } from 'lucide-react'
import { format, subMonths, parseISO, differenceInCalendarMonths, startOfMonth } from 'date-fns'

interface MonthData {
  month: string
  revenue: number
  expenses: number
  payroll: number
  profit: number
}

interface Obligation {
  id: string
  merchant: string
  amount: number
  payment_method: 'credit_card' | 'loan'
  due_date: string
  category: string
  notes: string | null
}

interface Customer {
  id: string
  full_name: string
}

interface Prepayment {
  id: string
  customer_id: string
  amount: number
  for_month: string
  note: string | null
  created_at: string
  customers: { full_name: string } | null
}

export default function MoneyPage() {
  const [data, setData] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(12)
  const [exporting, setExporting] = useState(false)
  const [monthExportOpen, setMonthExportOpen]       = useState(false)
  const [monthExporting, setMonthExporting]         = useState(false)
  const [selectedExportMonths, setSelectedExportMonths] = useState<Set<string>>(() => {
    const last = subMonths(new Date(), 1)
    return new Set([format(last, 'yyyy-MM')])
  })

  // Build last 12 months as options
  const exportMonthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  })

  const [obligations, setObligations]   = useState<Obligation[]>([])
  const [obLoading, setObLoading]       = useState(true)

  const [prepayments, setPrepayments] = useState<Prepayment[]>([])
  const [prepLoading, setPrepLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ customer_id: '', amount: '', for_month: '', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/money/summary?months=${range}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [range])

  const loadPrepayments = useCallback(async () => {
    setPrepLoading(true)
    const [prepRes, custRes] = await Promise.all([
      fetch('/api/money/prepayments'),
      fetch('/api/customers'),
    ])
    if (prepRes.ok) setPrepayments(await prepRes.json())
    if (custRes.ok) setCustomers(await custRes.json())
    setPrepLoading(false)
  }, [])

  useEffect(() => { loadPrepayments() }, [loadPrepayments])

  useEffect(() => {
    setObLoading(true)
    fetch('/api/expenses/obligations')
      .then(r => r.json())
      .then(d => { setObligations(Array.isArray(d) ? d : []); setObLoading(false) })
      .catch(() => setObLoading(false))
  }, [])

  function toggleExportMonth(m: string) {
    setSelectedExportMonths(prev => {
      const next = new Set(prev)
      next.has(m) ? next.delete(m) : next.add(m)
      return next
    })
  }

  async function handleMonthExport() {
    if (!selectedExportMonths.size) { toast.error('Select at least one month'); return }
    setMonthExporting(true)
    try {
      const sorted = [...selectedExportMonths].sort()
      const params = sorted.length === 1
        ? `month=${sorted[0]}`
        : `months=${sorted.join(',')}`
      const res = await fetch(`/api/money/monthly-export?${params}`)
      if (!res.ok) { toast.error('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const fileLabel = sorted.length === 1 ? sorted[0] : `${sorted[0]}_to_${sorted[sorted.length - 1]}`
      a.download = `gray-wolf-${fileLabel}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setMonthExportOpen(false)
      toast.success('Downloaded!')
    } catch {
      toast.error('Export failed')
    }
    setMonthExporting(false)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/money/export?months=${range}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gray-wolf-financials-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
    setExporting(false)
  }

  async function handleAddPrepayment() {
    if (!form.customer_id || !form.amount || !form.for_month) {
      toast.error('Customer, amount, and month are required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/money/prepayments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    if (res.ok) {
      toast.success('Prepayment recorded')
      setAddOpen(false)
      setForm({ customer_id: '', amount: '', for_month: '', note: '' })
      loadPrepayments()
    } else {
      toast.error('Failed to save')
    }
    setSaving(false)
  }

  async function handleDeletePrepayment(id: string) {
    const res = await fetch(`/api/money/prepayments?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Removed'); loadPrepayments() }
    else toast.error('Failed to remove')
  }

  // ── Reserve calculations ──────────────────────────────────────────────────
  // For each obligation spread the cost evenly across months until due (min 1).
  // e.g. $1,200 due in 2 months → $600 to set aside THIS month.
  const today = new Date()
  const reserveItems = obligations.map(ob => {
    const due = parseISO(ob.due_date)
    // months remaining: from start of this month to start of due month
    const monthsLeft = Math.max(1, differenceInCalendarMonths(startOfMonth(due), startOfMonth(today)) + 1)
    return { ...ob, monthsLeft, monthlyReserve: Math.ceil((ob.amount / monthsLeft) * 100) / 100 }
  })
  const totalReserve = reserveItems.reduce((s, r) => s + r.monthlyReserve, 0)

  // Current month's operating profit from the data array
  const currentMonthLabel = format(today, 'MMM yyyy')
  const currentMonthData  = data.find(d => d.month === currentMonthLabel)
  const currentProfit     = currentMonthData?.profit ?? null
  const availableCash     = currentProfit !== null ? currentProfit - totalReserve : null

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

  const totalPrepaid = prepayments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Money</h1>
          <p className="text-sm text-zinc-500 mt-1">Revenue, expenses, and profit overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1, 3, 6, 12].map((r) => (
            <Button key={r} size="sm" variant={range === r ? 'default' : 'outline'} onClick={() => setRange(r)}>
              {r}M
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download size={14} className="mr-1.5" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMonthExportOpen(true)}>
            <FileSpreadsheet size={14} className="mr-1.5" />
            Monthly Detail
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

      {/* ── Reserve Plan ───────────────────────────────────────────────────── */}
      {(obLoading || reserveItems.length > 0) && (
        <div className="bg-white rounded-xl border border-zinc-200 mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank size={16} className="text-violet-500" />
              <div>
                <h2 className="text-base font-semibold text-zinc-800">Monthly Reserve Plan</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  How much to set aside from <strong>{currentMonthLabel}</strong> for upcoming obligations
                </p>
              </div>
            </div>
            {!obLoading && reserveItems.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-zinc-400">Set aside this month</p>
                <p className="text-xl font-bold text-violet-600">{formatCurrency(totalReserve)}</p>
              </div>
            )}
          </div>

          {obLoading ? (
            <div className="p-5 space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : reserveItems.length === 0 ? (
            <p className="px-5 py-5 text-sm text-zinc-400 text-center">
              No upcoming credit card or loan obligations — nothing to reserve.
            </p>
          ) : (
            <>
              {/* Obligation rows */}
              <div className="divide-y divide-zinc-50">
                {reserveItems.map(ob => (
                  <div key={ob.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-zinc-900">{ob.merchant}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          ob.payment_method === 'credit_card' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                        }`}>
                          {ob.payment_method === 'credit_card' ? 'Credit Card' : 'Loan'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {formatCurrency(ob.amount)} total · due {format(parseISO(ob.due_date), 'MMM d, yyyy')} · {ob.monthsLeft} month{ob.monthsLeft !== 1 ? 's' : ''} away
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-zinc-800">{formatCurrency(ob.monthlyReserve)}<span className="text-xs font-normal text-zinc-400">/mo</span></p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Two-line profit summary */}
              <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-4">
                <div className="max-w-xs ml-auto space-y-1.5">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>Operating Profit ({currentMonthLabel})</span>
                    <span className="font-semibold text-zinc-800">
                      {currentProfit !== null ? formatCurrency(currentProfit) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>− Set Aside This Month</span>
                    <span className="font-semibold text-red-500">− {formatCurrency(totalReserve)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-zinc-200 pt-1.5">
                    <span className="text-zinc-800">Available Cash</span>
                    <span className={availableCash !== null && availableCash >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {availableCash !== null ? formatCurrency(availableCash) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Prepaid Revenue */}
      <div className="bg-white rounded-xl border border-zinc-200 mb-6">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-800">Pre-collected Revenue</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Payments collected in advance for future months</p>
          </div>
          <div className="flex items-center gap-3">
            {!prepLoading && (
              <span className="text-sm font-semibold text-green-600">{formatCurrency(totalPrepaid)} held</span>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>
        </div>
        {prepLoading ? (
          <div className="p-5 space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : prepayments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-400 text-center">No prepayments recorded</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600">For Month</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-600">Note</th>
                <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Amount</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {prepayments.map((p) => (
                <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium text-zinc-800">{p.customers?.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{p.for_month}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{p.note ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => handleDeletePrepayment(p.id)} className="text-zinc-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
            <div className="overflow-x-auto">
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
        </div>
      )}

      {/* Monthly Export Dialog */}
      <Dialog open={monthExportOpen} onOpenChange={setMonthExportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Export to Spreadsheet</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-zinc-500">
              Select one or more months. Downloads a real <strong>.xlsx</strong> file with 5 tabs: Summary, Income, Expenses, Payroll, and Bonuses — fully broken down.
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
              {exportMonthOptions.map(opt => {
                const selected = selectedExportMonths.has(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleExportMonth(opt.value)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${
                      selected ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    {opt.label}
                    {selected && <Check size={14} />}
                  </button>
                )
              })}
            </div>
            {selectedExportMonths.size > 0 && (
              <p className="text-xs text-zinc-500">
                {selectedExportMonths.size} month{selectedExportMonths.size !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthExportOpen(false)}>Cancel</Button>
            <Button onClick={handleMonthExport} disabled={monthExporting || !selectedExportMonths.size}>
              <FileSpreadsheet size={14} className="mr-1.5" />
              {monthExporting ? 'Exporting…' : `Download .xlsx`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Prepayment Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Pre-collected Revenue</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Customer</Label>
              <select
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>For Month (YYYY-MM)</Label>
              <Input type="month" value={form.for_month} onChange={(e) => setForm({ ...form, for_month: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. paid in cash" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPrepayment} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
