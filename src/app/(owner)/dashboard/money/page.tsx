'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Download, Plus, Trash2, FileSpreadsheet, Check, PiggyBank, ChevronDown, ChevronRight, Receipt } from 'lucide-react'
import { format, subMonths, parseISO, differenceInCalendarMonths, startOfMonth } from 'date-fns'

interface MonthData {
  month: string
  revenue: number
  raw_expenses: number
  expenses: number          // prorated operating expenses (for normal profit)
  capital_expenses: number
  payroll: number
  profit: number            // normal (prorated) profit
  tax_profit: number        // simple cash-basis profit
}

interface Customer { id: string; full_name: string }

interface Prepayment {
  id: string; customer_id: string; amount: number; for_month: string
  note: string | null; created_at: string; customers: { full_name: string } | null
}

interface Obligation {
  id: string; merchant: string; amount: number
  payment_method: 'credit_card' | 'loan'; due_date: string
  category: string; notes: string | null
}

interface PayrollSummary {
  employees: { id: string; name: string; earned: number; paid: number; owed: number }[]
  total_earned: number; total_paid: number; total_owed: number
}

export default function MoneyPage() {
  const [data, setData]       = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]     = useState(12)
  const [taxMode, setTaxMode] = useState(false)

  // Collapsed state for the three panels
  const [collapsed, setCollapsed] = useState({ payroll: false, reserve: false, prepaid: false })
  const toggle = (k: keyof typeof collapsed) => setCollapsed(p => ({ ...p, [k]: !p[k] }))

  const [exporting, setExporting]                   = useState(false)
  const [monthExportOpen, setMonthExportOpen]       = useState(false)
  const [monthExporting, setMonthExporting]         = useState(false)
  const [selectedExportMonths, setSelectedExportMonths] = useState<Set<string>>(() => {
    const last = subMonths(new Date(), 1)
    return new Set([format(last, 'yyyy-MM')])
  })

  const exportMonthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  })

  const [obligations, setObligations]     = useState<Obligation[]>([])
  const [obLoading, setObLoading]         = useState(true)
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null)
  const [payrollLoading, setPayrollLoading] = useState(true)

  const [prepayments, setPrepayments]     = useState<Prepayment[]>([])
  const [prepLoading, setPrepLoading]     = useState(true)
  const [customers, setCustomers]         = useState<Customer[]>([])
  const [addOpen, setAddOpen]             = useState(false)
  const [form, setForm] = useState({ customer_id: '', amount: '', for_month: '', note: '' })
  const [saving, setSaving]               = useState(false)
  const [settlingId, setSettlingId]       = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/money/summary?months=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
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

  useEffect(() => {
    setPayrollLoading(true)
    fetch('/api/employees/payroll-summary')
      .then(r => r.json())
      .then(d => { setPayrollSummary(d); setPayrollLoading(false) })
      .catch(() => setPayrollLoading(false))
  }, [])

  // ── Reserve calculations ────────────────────────────────────────────────────
  const today = new Date()
  const reserveItems = obligations.map(ob => {
    const due = parseISO(ob.due_date)
    const monthsLeft = Math.max(1, differenceInCalendarMonths(startOfMonth(due), startOfMonth(today)) + 1)
    return { ...ob, monthsLeft, monthlyReserve: Math.ceil((ob.amount / monthsLeft) * 100) / 100 }
  })
  const totalReserve = reserveItems.reduce((s, r) => s + r.monthlyReserve, 0)
  const currentMonthLabel = format(today, 'MMM yyyy')
  const currentMonthData  = data.find(d => d.month === currentMonthLabel)
  const currentProfit     = currentMonthData?.profit ?? null
  const availableCash     = currentProfit !== null ? currentProfit - totalReserve : null

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = data.reduce((acc, m) => ({
    revenue:          acc.revenue          + m.revenue,
    raw_expenses:     acc.raw_expenses     + (m.raw_expenses ?? 0),
    expenses:         acc.expenses         + m.expenses,
    capital_expenses: acc.capital_expenses + (m.capital_expenses ?? 0),
    payroll:          acc.payroll          + m.payroll,
    profit:           acc.profit           + m.profit,
    tax_profit:       acc.tax_profit       + (m.tax_profit ?? 0),
  }), { revenue: 0, raw_expenses: 0, expenses: 0, capital_expenses: 0, payroll: 0, profit: 0, tax_profit: 0 })

  // ── Export helpers ──────────────────────────────────────────────────────────
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
      const params = sorted.length === 1 ? `month=${sorted[0]}` : `months=${sorted.join(',')}`
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
    } catch { toast.error('Export failed') }
    setMonthExporting(false)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/money/export?months=${range}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `gray-wolf-financials-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Export failed') }
    setExporting(false)
  }

  async function handleAddPrepayment() {
    if (!form.customer_id || !form.amount || !form.for_month) {
      toast.error('Customer, amount, and month are required'); return
    }
    setSaving(true)
    const res = await fetch('/api/money/prepayments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    if (res.ok) {
      toast.success('Prepayment recorded')
      setAddOpen(false)
      setForm({ customer_id: '', amount: '', for_month: '', note: '' })
      loadPrepayments()
    } else { toast.error('Failed to save') }
    setSaving(false)
  }

  async function handleDeletePrepayment(id: string) {
    const res = await fetch(`/api/money/prepayments?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Removed'); loadPrepayments() }
    else toast.error('Failed to remove')
  }

  async function handleMarkObligationPaid(ob: Obligation) {
    setSettlingId(ob.id)
    try {
      const res = await fetch('/api/expenses/obligations', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ob.id }),
      })
      if (!res.ok) toast.error('Could not settle')
      else { toast.success(`${ob.merchant} marked paid`); setObligations(prev => prev.filter(o => o.id !== ob.id)) }
    } catch { toast.error('Network error') }
    finally { setSettlingId(null) }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fmtTip = (v: any) => v != null ? formatCurrency(Number(v)) : ''
  const totalPrepaid = prepayments.reduce((s, p) => s + p.amount, 0)

  // ── Panel header component ──────────────────────────────────────────────────
  function PanelHeader({ icon, title, subtitle, right, panelKey }: {
    icon: React.ReactNode; title: string; subtitle?: string
    right?: React.ReactNode; panelKey: keyof typeof collapsed
  }) {
    return (
      <button
        onClick={() => toggle(panelKey)}
        className="w-full px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-zinc-400 shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-800">{title}</p>
            {subtitle && <p className="text-xs text-zinc-400 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {right}
          {collapsed[panelKey]
            ? <ChevronRight size={14} className="text-zinc-400" />
            : <ChevronDown size={14} className="text-zinc-400" />}
        </div>
      </button>
    )
  }

  return (
    <div className="p-4 md:p-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Money</h1>
          <p className="text-sm text-zinc-500 mt-1">Revenue, expenses, and profit overview</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Range */}
          {[1, 3, 6, 12].map(r => (
            <Button key={r} size="sm" variant={range === r ? 'default' : 'outline'} onClick={() => setRange(r)}>
              {r}M
            </Button>
          ))}

          {/* Tax / Normal toggle */}
          <div className="flex rounded-md border border-zinc-200 overflow-hidden">
            <button
              onClick={() => setTaxMode(false)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${!taxMode ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
            >
              Normal
            </button>
            <button
              onClick={() => setTaxMode(true)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1 ${taxMode ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
            >
              <Receipt size={11} /> Tax
            </button>
          </div>

          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download size={14} className="mr-1.5" />
            {exporting ? 'Exporting…' : 'CSV'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMonthExportOpen(true)}>
            <FileSpreadsheet size={14} className="mr-1.5" />
            Detail
          </Button>
        </div>
      </div>

      {/* ── Tax mode banner ─────────────────────────────────────────────────── */}
      {taxMode && (
        <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
          <Receipt size={13} />
          <span><strong>Tax View:</strong> Expenses counted when entered (no spreading). All expense types included. Simple Revenue − Expenses − Payroll = Profit.</span>
        </div>
      )}

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Revenue */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Total Revenue</p>
          {loading ? <Skeleton className="h-7 w-32 mt-2" /> : (
            <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(totals.revenue)}</p>
          )}
        </div>

        {/* Expenses — always raw totals in the card */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">{taxMode ? 'Total Expenses' : 'Op. Expenses'}</p>
          {loading ? <Skeleton className="h-7 w-32 mt-2" /> : (
            <>
              <p className="text-2xl font-bold mt-1 text-red-500">
                {formatCurrency(taxMode ? totals.raw_expenses : totals.raw_expenses)}
              </p>
              {!taxMode && totals.capital_expenses > 0 && (
                <p className="text-xs text-zinc-400 mt-1">+ {formatCurrency(totals.capital_expenses)} capital (taxes only)</p>
              )}
            </>
          )}
        </div>

        {/* Payroll — 1M shows owed/earned, multi-M shows total */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Payroll</p>
          {loading || payrollLoading ? <Skeleton className="h-7 w-32 mt-2" /> : (
            range === 1 && payrollSummary ? (
              <>
                <p className="text-2xl font-bold mt-1 text-orange-500">{formatCurrency(totals.payroll)}</p>
                <p className="text-xs mt-1">
                  <span className="text-red-500 font-medium">{formatCurrency(payrollSummary.total_owed)} owed</span>
                  <span className="text-zinc-400"> globally</span>
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold mt-1 text-orange-500">{formatCurrency(totals.payroll)}</p>
            )
          )}
        </div>

        {/* Profit */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Net Profit</p>
          {loading ? <Skeleton className="h-7 w-32 mt-2" /> : (() => {
            const val = taxMode ? totals.tax_profit : totals.profit
            return <p className={`text-2xl font-bold mt-1 ${val >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(val)}</p>
          })()}
        </div>
      </div>

      {/* ══════════════════════════ NORMAL VIEW PANELS ════════════════════════ */}
      {!taxMode && (
        <>
          {/* ── Employee Payroll Panel ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-zinc-200 mb-4 overflow-hidden">
            <PanelHeader
              panelKey="payroll"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>}
              title="Employee Payroll"
              subtitle="Lifetime earned vs paid — who you still owe"
              right={payrollSummary && (
                <div className="flex gap-4 text-right">
                  <span className="text-xs"><span className="text-zinc-400">Earned </span><span className="font-semibold text-zinc-700">{formatCurrency(payrollSummary.total_earned)}</span></span>
                  <span className="text-xs"><span className="text-zinc-400">Paid </span><span className="font-semibold text-green-600">{formatCurrency(payrollSummary.total_paid)}</span></span>
                  <span className="text-xs"><span className="text-zinc-400">Owed </span><span className={`font-semibold ${payrollSummary.total_owed > 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(payrollSummary.total_owed)}</span></span>
                </div>
              )}
            />
            {!collapsed.payroll && (
              payrollLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-7 w-full" />)}</div>
              ) : !payrollSummary || payrollSummary.employees.length === 0 ? (
                <p className="px-5 py-5 text-sm text-zinc-400 text-center">No payroll data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-2 font-medium text-zinc-600 text-xs">Employee</th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-600 text-xs">Earned</th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-600 text-xs">Paid</th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-600 text-xs">Still Owed</th>
                  </tr></thead>
                  <tbody>
                    {payrollSummary.employees.map(emp => (
                      <tr key={emp.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                        <td className="px-4 py-2 font-medium text-zinc-800 text-sm">{emp.name}</td>
                        <td className="px-4 py-2 text-right text-zinc-600 text-sm">{formatCurrency(emp.earned)}</td>
                        <td className="px-4 py-2 text-right text-green-600 text-sm">{formatCurrency(emp.paid)}</td>
                        <td className={`px-4 py-2 text-right font-semibold text-sm ${emp.owed > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                          {emp.owed > 0 ? formatCurrency(emp.owed) : '✓ Paid'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t border-zinc-200 bg-zinc-50">
                    <td className="px-4 py-2 font-bold text-zinc-800 text-sm">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-zinc-700 text-sm">{formatCurrency(payrollSummary.total_earned)}</td>
                    <td className="px-4 py-2 text-right font-bold text-green-600 text-sm">{formatCurrency(payrollSummary.total_paid)}</td>
                    <td className={`px-4 py-2 text-right font-bold text-sm ${payrollSummary.total_owed > 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(payrollSummary.total_owed)}</td>
                  </tr></tfoot>
                </table>
              )
            )}
          </div>

          {/* ── Reserve Plan Panel ────────────────────────────────────────────── */}
          {(obLoading || reserveItems.length > 0) && (
            <div className="bg-white rounded-xl border border-zinc-200 mb-4 overflow-hidden">
              <PanelHeader
                panelKey="reserve"
                icon={<PiggyBank size={14} />}
                title="Monthly Reserve Plan"
                subtitle={`Set aside from ${currentMonthLabel} for upcoming obligations`}
                right={!obLoading && reserveItems.length > 0 && (
                  <span className="text-xs font-semibold text-violet-600">{formatCurrency(totalReserve)}/mo</span>
                )}
              />
              {!collapsed.reserve && (
                obLoading ? (
                  <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : reserveItems.length === 0 ? (
                  <p className="px-5 py-5 text-sm text-zinc-400 text-center">No upcoming obligations</p>
                ) : (
                  <>
                    <div className="divide-y divide-zinc-50">
                      {reserveItems.map(ob => (
                        <div key={ob.id} className="px-5 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-zinc-900">{ob.merchant}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ob.payment_method === 'credit_card' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>
                                {ob.payment_method === 'credit_card' ? 'Credit Card' : 'Loan'}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {formatCurrency(ob.amount)} total · due {format(parseISO(ob.due_date), 'MMM d, yyyy')} · {ob.monthsLeft} month{ob.monthsLeft !== 1 ? 's' : ''} away
                            </p>
                          </div>
                          <p className="text-sm font-bold text-zinc-800 shrink-0">
                            {formatCurrency(ob.monthlyReserve)}<span className="text-xs font-normal text-zinc-400">/mo</span>
                          </p>
                          <Button size="sm" variant="outline" className="shrink-0 text-xs"
                            disabled={settlingId === ob.id} onClick={() => handleMarkObligationPaid(ob)}>
                            {settlingId === ob.id ? '…' : '✓ Paid'}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-3">
                      <div className="max-w-xs ml-auto space-y-1">
                        <div className="flex justify-between text-xs text-zinc-600">
                          <span>Operating Profit ({currentMonthLabel})</span>
                          <span className="font-semibold">{currentProfit !== null ? formatCurrency(currentProfit) : '—'}</span>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>− Reserve This Month</span>
                          <span className="font-semibold text-red-500">− {formatCurrency(totalReserve)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold border-t border-zinc-200 pt-1">
                          <span>Available Cash</span>
                          <span className={availableCash !== null && availableCash >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {availableCash !== null ? formatCurrency(availableCash) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          {/* ── Pre-collected Revenue Panel ─────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-zinc-200 mb-6 overflow-hidden">
            <PanelHeader
              panelKey="prepaid"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              title="Pre-collected Revenue"
              subtitle="Payments received in advance for future months"
              right={
                <div className="flex items-center gap-2">
                  {!prepLoading && <span className="text-xs font-semibold text-green-600">{formatCurrency(totalPrepaid)} held</span>}
                  <button
                    onClick={e => { e.stopPropagation(); setAddOpen(true) }}
                    className="text-xs px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors"
                  >+ Add</button>
                </div>
              }
            />
            {!collapsed.prepaid && (
              prepLoading ? (
                <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-7 w-full" />)}</div>
              ) : prepayments.length === 0 ? (
                <p className="px-5 py-5 text-sm text-zinc-400 text-center">No prepayments recorded</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-2 font-medium text-zinc-600 text-xs">Customer</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600 text-xs">For Month</th>
                    <th className="text-left px-4 py-2 font-medium text-zinc-600 text-xs">Note</th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-600 text-xs">Amount</th>
                    <th className="px-4 py-2" />
                  </tr></thead>
                  <tbody>
                    {prepayments.map(p => (
                      <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                        <td className="px-4 py-2 font-medium text-zinc-800">{p.customers?.full_name ?? '—'}</td>
                        <td className="px-4 py-2 text-zinc-600">{p.for_month}</td>
                        <td className="px-4 py-2 text-zinc-500">{p.note ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => handleDeletePrepayment(p.id)} className="text-zinc-400 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════ CHARTS + TABLE ════════════════════════════ */}
      {loading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-6 h-72"><Skeleton className="h-full w-full" /></div>
          <div className="bg-white rounded-xl border border-zinc-200 p-6 h-56"><Skeleton className="h-full w-full" /></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Revenue vs Expenses chart */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-800 mb-4">Revenue vs Expenses</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip formatter={fmtTip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[3,3,0,0]} />
                <Bar dataKey={taxMode ? 'raw_expenses' : 'expenses'} name="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
                <Bar dataKey="payroll" name="Payroll" fill="#f97316" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Profit trend chart */}
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-800 mb-4">
              {taxMode ? 'Net Profit Trend (Tax Basis)' : 'Net Profit Trend'}
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip formatter={fmtTip} />
                <Line type="monotone" dataKey={taxMode ? 'tax_profit' : 'profit'} name="Profit"
                  stroke="#18181b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly breakdown table */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-800">Monthly Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-3 font-medium text-zinc-600">Month</th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-600">Revenue</th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-600">
                      {taxMode ? 'Expenses' : 'Op. Expenses'}
                    </th>
                    {!taxMode && <th className="text-right px-4 py-3 font-medium text-zinc-600">Capital</th>}
                    <th className="text-right px-4 py-3 font-medium text-zinc-600">Payroll</th>
                    <th className="text-right px-4 py-3 font-medium text-zinc-600">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map(row => {
                    const expVal    = taxMode ? row.raw_expenses : row.expenses
                    const profitVal = taxMode ? row.tax_profit   : row.profit
                    return (
                      <tr key={row.month} className="border-b border-zinc-50 hover:bg-zinc-50">
                        <td className="px-4 py-2.5 font-medium text-zinc-700">{row.month}</td>
                        <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(row.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-red-500">{formatCurrency(expVal)}</td>
                        {!taxMode && <td className="px-4 py-2.5 text-right text-zinc-400 text-xs">{row.capital_expenses > 0 ? formatCurrency(row.capital_expenses) : '—'}</td>}
                        <td className="px-4 py-2.5 text-right text-orange-500">{formatCurrency(row.payroll)}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${profitVal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {formatCurrency(profitVal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50">
                    <td className="px-4 py-3 font-bold text-zinc-800">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totals.revenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">
                      {formatCurrency(taxMode ? totals.raw_expenses : totals.expenses)}
                    </td>
                    {!taxMode && <td className="px-4 py-3 text-right font-bold text-zinc-400">{formatCurrency(totals.capital_expenses)}</td>}
                    <td className="px-4 py-3 text-right font-bold text-orange-500">{formatCurrency(totals.payroll)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${(taxMode ? totals.tax_profit : totals.profit) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatCurrency(taxMode ? totals.tax_profit : totals.profit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly Export Dialog ──────────────────────────────────────────── */}
      <Dialog open={monthExportOpen} onOpenChange={setMonthExportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Export to Spreadsheet</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-zinc-500">Select one or more months for a detailed <strong>.xlsx</strong> export.</p>
            <div className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
              {exportMonthOptions.map(opt => {
                const selected = selectedExportMonths.has(opt.value)
                return (
                  <button key={opt.value} onClick={() => toggleExportMonth(opt.value)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left ${selected ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50 text-zinc-700'}`}>
                    {opt.label}
                    {selected && <Check size={13} />}
                  </button>
                )
              })}
            </div>
            {selectedExportMonths.size > 0 && <p className="text-xs text-zinc-500">{selectedExportMonths.size} month{selectedExportMonths.size !== 1 ? 's' : ''} selected</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthExportOpen(false)}>Cancel</Button>
            <Button onClick={handleMonthExport} disabled={monthExporting || !selectedExportMonths.size}>
              <FileSpreadsheet size={14} className="mr-1.5" />
              {monthExporting ? 'Exporting…' : 'Download .xlsx'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Prepayment Dialog ──────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Pre-collected Revenue</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Customer</Label>
              <select className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select a customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>For Month</Label>
              <Input type="month" value={form.for_month} onChange={e => setForm({ ...form, for_month: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. paid in cash" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
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
