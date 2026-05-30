'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns'
import { Download, AlertTriangle, Clock, Calendar, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Expense {
  id: string
  merchant: string
  amount: number
  category: string
  expense_date: string
  notes: string | null
  receipt_url: string | null
  payment_method: 'capital' | 'credit_card' | 'loan'
  due_date: string | null
  settled_at: string | null
}

interface MonthSummary {
  month: string
  fuel: number
  equipment: number
  supplies: number
  labor: number
  other: number
  total: number
}

const CATEGORIES = ['fuel', 'equipment', 'supplies', 'labor', 'other']
const CATEGORY_COLORS: Record<string, string> = {
  fuel:      'bg-blue-100 text-blue-700',
  equipment: 'bg-purple-100 text-purple-700',
  supplies:  'bg-yellow-100 text-yellow-700',
  labor:     'bg-orange-100 text-orange-700',
  other:     'bg-zinc-100 text-zinc-600',
}
const CHART_COLORS: Record<string, string> = {
  fuel:      '#3b82f6',
  equipment: '#a855f7',
  supplies:  '#eab308',
  labor:     '#f97316',
  other:     '#71717a',
}
const PAYMENT_LABELS: Record<string, string> = {
  capital:     'Capital',
  credit_card: 'Credit Card',
  loan:        'Loan',
}
const PAYMENT_COLORS: Record<string, string> = {
  capital:     'bg-emerald-100 text-emerald-700',
  credit_card: 'bg-sky-100 text-sky-700',
  loan:        'bg-violet-100 text-violet-700',
}

const EMPTY_FORM = {
  merchant: '',
  amount: '',
  category: 'other',
  expense_date: new Date().toISOString().split('T')[0],
  notes: '',
  receipt_url: '',
  payment_method: 'capital',
  due_date: '',
}

// ── Obligations helpers ──────────────────────────────────────────────────────
function getObligationBucket(due: string): 'overdue' | 'this_month' | 'next_month' | 'future' {
  const today = startOfDay(new Date())
  const dueDate = startOfDay(parseISO(due))
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0)

  if (isBefore(dueDate, today)) return 'overdue'
  if (!isAfter(dueDate, thisMonthEnd)) return 'this_month'
  if (!isAfter(dueDate, nextMonthEnd)) return 'next_month'
  return 'future'
}

const BUCKET_META = {
  overdue:    { label: 'Overdue', color: 'border-red-200 bg-red-50', badgeColor: 'bg-red-100 text-red-700', icon: AlertTriangle },
  this_month: { label: 'Due This Month', color: 'border-amber-200 bg-amber-50', badgeColor: 'bg-amber-100 text-amber-700', icon: Clock },
  next_month: { label: 'Due Next Month', color: 'border-yellow-200 bg-yellow-50', badgeColor: 'bg-yellow-100 text-yellow-700', icon: Calendar },
  future:     { label: 'Future', color: 'border-zinc-200 bg-zinc-50', badgeColor: 'bg-zinc-100 text-zinc-600', icon: ChevronRight },
}
// ────────────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [loading, setLoading]           = useState(true)
  const [loadError, setLoadError]       = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  const [chartData, setChartData]       = useState<MonthSummary[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  const [obligations, setObligations]   = useState<Expense[]>([])
  const [obLoading, setObLoading]       = useState(true)
  const [settlingId, setSettlingId]     = useState<string | null>(null)

  const [formOpen, setFormOpen]         = useState(false)
  const [editing, setEditing]           = useState<Expense | null>(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [saving, setSaving]             = useState(false)
  const [deleteId, setDeleteId]         = useState<string | null>(null)
  const [parsing, setParsing]           = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [exporting, setExporting]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res  = await fetch(`/api/expenses?month=${selectedMonth}`)
      const data = await res.json()
      if (!res.ok) { setLoadError(data?.error ?? `Error ${res.status}`); setLoading(false); return }
      setExpenses(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch (err) {
      setLoadError(String(err))
      setLoading(false)
    }
  }, [selectedMonth])

  const loadObligations = useCallback(async () => {
    setObLoading(true)
    try {
      const res  = await fetch('/api/expenses/obligations')
      const data = await res.json()
      setObligations(Array.isArray(data) ? data : [])
    } catch {
      // silently ignore
    } finally {
      setObLoading(false)
    }
  }, [])

  useEffect(() => { setLoading(true); load() }, [load])
  useEffect(() => { loadObligations() }, [loadObligations])

  useEffect(() => {
    setChartLoading(true)
    fetch('/api/expenses/monthly-summary?months=6')
      .then(r => r.json())
      .then(d => { setChartData(d); setChartLoading(false) })
      .catch(() => setChartLoading(false))
  }, [expenses])

  async function handleMarkPaid(ob: Expense) {
    setSettlingId(ob.id)
    try {
      const res = await fetch('/api/expenses/obligations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ob.id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? 'Could not settle obligation')
      } else {
        toast.success(`${ob.merchant} marked as paid`)
        loadObligations()
        load()
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSettlingId(null)
    }
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptPreview(URL.createObjectURL(file))
    setParsing(true)
    toast.info('Reading receipt with AI…')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/expenses/parse-receipt', { method: 'POST', body: fd })
    if (!res.ok) { toast.error('Could not parse receipt'); setParsing(false); return }
    const parsed = await res.json()
    setForm({
      merchant:       parsed.merchant ?? '',
      amount:         String(parsed.amount ?? ''),
      category:       parsed.category ?? 'other',
      expense_date:   parsed.date ?? new Date().toISOString().split('T')[0],
      notes:          parsed.notes ?? '',
      receipt_url:    parsed.receipt_url ?? '',
      payment_method: 'capital',
      due_date:       '',
    })
    if (parsed.receipt_storage_error) {
      toast.warning(`⚠️ Receipt image could NOT be saved: ${parsed.receipt_storage_error}. The expense data was parsed but the image will not be stored. Check Supabase Storage bucket "receipts" exists.`)
    } else if (parsed.receipt_url) {
      toast.success('Receipt parsed and image saved! Review and confirm.')
    } else {
      toast.success('Receipt parsed! Review and confirm.')
    }
    setParsing(false)
    setFormOpen(true)
  }

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setReceiptPreview(null); setFormOpen(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setForm({
      merchant:       e.merchant,
      amount:         String(e.amount),
      category:       e.category,
      expense_date:   e.expense_date,
      notes:          e.notes ?? '',
      receipt_url:    e.receipt_url ?? '',
      payment_method: e.payment_method ?? 'capital',
      due_date:       e.due_date ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.merchant.trim() || !form.amount) return toast.error('Merchant and amount are required')
    if ((form.payment_method === 'credit_card' || form.payment_method === 'loan') && !form.due_date) {
      return toast.error('Due date is required for Credit Card and Loan expenses')
    }
    setSaving(true)
    try {
      const url    = editing ? `/api/expenses/${editing.id}` : '/api/expenses'
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          due_date: form.due_date || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? `Save failed (${res.status})`)
      } else {
        toast.success(editing ? 'Expense updated' : 'Expense saved')
        setFormOpen(false)
        const expenseMonth = form.expense_date.slice(0, 7)
        setSelectedMonth(expenseMonth)
        loadObligations()
      }
    } catch (err) {
      toast.error('Network error — could not save expense')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/expenses/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Expense deleted'); setDeleteId(null); load(); loadObligations() }
    else toast.error('Could not delete')
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/expenses/export?month=${selectedMonth}`)
      if (!res.ok) { toast.error('Export failed'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `gray-wolf-expenses-${selectedMonth}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported!')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const totalByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
    return acc
  }, {} as Record<string, number>)

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0)

  // Group obligations by bucket
  const bucketedObs = (['overdue', 'this_month', 'next_month', 'future'] as const).reduce((acc, key) => {
    acc[key] = obligations.filter(o => o.due_date && getObligationBucket(o.due_date) === key)
    return acc
  }, {} as Record<string, Expense[]>)

  const totalObligations = obligations.reduce((s, o) => s + o.amount, 0)
  const hasObligations   = obligations.length > 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any) => value != null ? formatCurrency(Number(value)) : ''

  const needsDueDate = form.payment_method === 'credit_card' || form.payment_method === 'loan'

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Expenses</h1>
          <p className="text-sm text-zinc-500 mt-1">Track and categorize business expenses</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-40"
          />
          <label className="cursor-pointer">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? 'Reading…' : '📷 Scan Receipt'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />
          </label>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download size={14} className="mr-1.5" />
            {exporting ? 'Exporting…' : 'Export Spreadsheet'}
          </Button>
          <Button onClick={openAdd}>+ Add Manually</Button>
        </div>
      </div>

      {/* ── Obligations Panel ─────────────────────────────────────────────── */}
      {(obLoading || hasObligations) && (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" />
                Upcoming Payment Obligations
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Credit card and loan expenses that still need to come out of your revenue
              </p>
            </div>
            {!obLoading && hasObligations && (
              <div className="text-right">
                <p className="text-xs text-zinc-400">Total outstanding</p>
                <p className="text-base font-bold text-zinc-900">{formatCurrency(totalObligations)}</p>
              </div>
            )}
          </div>

          {obLoading ? (
            <div className="p-5 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {(['overdue', 'this_month', 'next_month', 'future'] as const).map(bucket => {
                const items = bucketedObs[bucket]
                if (!items || items.length === 0) return null
                const meta = BUCKET_META[bucket]
                const BucketIcon = meta.icon
                const bucketTotal = items.reduce((s, o) => s + o.amount, 0)
                return (
                  <div key={bucket} className={`${meta.color} border-l-4`} style={{ borderLeftColor: bucket === 'overdue' ? '#ef4444' : bucket === 'this_month' ? '#f59e0b' : bucket === 'next_month' ? '#eab308' : '#a1a1aa' }}>
                    <div className="px-5 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                        <BucketIcon size={12} />
                        {meta.label}
                      </span>
                      <span className="text-xs font-bold text-zinc-700">{formatCurrency(bucketTotal)}</span>
                    </div>
                    {items.map(ob => (
                      <div key={ob.id} className="px-5 py-3 flex items-center gap-3 bg-white/60">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-zinc-900">{ob.merchant}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[ob.payment_method]}`}>
                              {PAYMENT_LABELS[ob.payment_method]}
                            </span>
                            {ob.category && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ob.category] ?? CATEGORY_COLORS.other}`}>
                                {ob.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-zinc-500">
                              Due {ob.due_date ? format(parseISO(ob.due_date), 'MMM d, yyyy') : '—'}
                            </span>
                            {ob.notes && <span className="text-xs text-zinc-400 truncate max-w-xs">{ob.notes}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-zinc-900">{formatCurrency(ob.amount)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-xs"
                          disabled={settlingId === ob.id}
                          onClick={() => handleMarkPaid(ob)}
                        >
                          {settlingId === ob.id ? 'Saving…' : '✓ Mark Paid'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 6-month chart */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Last 6 Months — Expenses by Category</h2>
        {chartLoading ? (
          <div className="h-56 flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11, fill: '#71717a' }} width={55} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {CATEGORIES.map(cat => (
                <Bar key={cat} dataKey={cat} name={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  stackId="a" fill={CHART_COLORS[cat]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category totals for selected month */}
      {!loading && expenses.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CATEGORIES.map(cat => (
            <div key={cat} className="bg-white rounded-xl border border-zinc-200 p-3">
              <p className="text-xs text-zinc-500 capitalize">{cat}</p>
              <p className="text-lg font-bold text-zinc-900 mt-1">{formatCurrency(totalByCategory[cat])}</p>
            </div>
          ))}
          <div className="bg-zinc-900 rounded-xl p-3">
            <p className="text-xs text-zinc-400">Total</p>
            <p className="text-lg font-bold text-white mt-1">{formatCurrency(grandTotal)}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <strong>Error loading expenses:</strong> {loadError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">
            {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')} — {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </h2>
          {!loading && grandTotal > 0 && (
            <span className="text-sm font-bold text-zinc-900">{formatCurrency(grandTotal)}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Merchant</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Payment</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    ))}
                    <td />
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                    No expenses for {selectedMonth}. Scan a receipt or add manually.
                  </td>
                </tr>
              ) : (
                expenses.map(e => (
                  <tr key={e.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-zinc-600">
                      {format(new Date(e.expense_date + 'T00:00:00'), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{e.merchant}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.other}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[e.payment_method ?? 'capital']}`}>
                        {PAYMENT_LABELS[e.payment_method ?? 'capital']}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {e.due_date
                        ? e.settled_at
                          ? <span className="text-emerald-600 font-medium">✓ Paid {format(parseISO(e.settled_at), 'MMM d')}</span>
                          : format(parseISO(e.due_date), 'MMM d, yyyy')
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{e.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteId(e.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && expenses.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 bg-zinc-50">
                  <td colSpan={5} className="px-4 py-3 font-medium text-zinc-600">Total</td>
                  <td className="px-4 py-3 font-bold text-zinc-900">{formatCurrency(grandTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          {receiptPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receiptPreview} alt="Receipt" className="w-full max-h-40 object-contain rounded border border-zinc-200 mb-2" />
          )}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Merchant *</Label>
              <Input value={form.merchant} onChange={e => setForm({ ...form, merchant: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount ($) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <Label>How was this paid?</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['capital', 'credit_card', 'loan'] as const).map(pm => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setForm({ ...form, payment_method: pm, due_date: pm === 'capital' ? '' : form.due_date })}
                    className={`px-3 py-2 rounded-md text-xs font-medium border transition-all ${
                      form.payment_method === pm
                        ? pm === 'capital'    ? 'bg-emerald-600 text-white border-emerald-600'
                        : pm === 'credit_card'? 'bg-sky-600 text-white border-sky-600'
                        :                      'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {PAYMENT_LABELS[pm]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {form.payment_method === 'capital'
                  ? 'Money already in the bank — no future obligation.'
                  : form.payment_method === 'credit_card'
                  ? 'Charged to card — you\'ll need to move money to cover this by the due date.'
                  : 'Financed — track when the payment hits so it lines up against that month\'s revenue.'}
              </p>
            </div>

            {/* Due Date — only shown for CC / Loan */}
            {needsDueDate && (
              <div className="space-y-1">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                />
                <p className="text-xs text-zinc-400">
                  {form.payment_method === 'credit_card'
                    ? 'When does your card statement close / payment post?'
                    : 'When is the loan payment due?'}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Expense?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
