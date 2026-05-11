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
import { format } from 'date-fns'
import { Download } from 'lucide-react'
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

const EMPTY_FORM = {
  merchant: '',
  amount: '',
  category: 'other',
  expense_date: new Date().toISOString().split('T')[0],
  notes: '',
  receipt_url: '',
}

export default function ExpensesPage() {
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [loading, setLoading]           = useState(true)
  const [loadError, setLoadError]       = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  const [chartData, setChartData]       = useState<MonthSummary[]>([])
  const [chartLoading, setChartLoading] = useState(true)

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

  useEffect(() => { setLoading(true); load() }, [load])

  useEffect(() => {
    setChartLoading(true)
    fetch('/api/expenses/monthly-summary?months=6')
      .then(r => r.json())
      .then(d => { setChartData(d); setChartLoading(false) })
      .catch(() => setChartLoading(false))
  }, [expenses]) // refresh chart when expenses change

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
      merchant:     parsed.merchant ?? '',
      amount:       String(parsed.amount ?? ''),
      category:     parsed.category ?? 'other',
      expense_date: parsed.date ?? new Date().toISOString().split('T')[0],
      notes:        parsed.notes ?? '',
      receipt_url:  parsed.receipt_url ?? '',
    })
    toast.success('Receipt parsed! Review and confirm.')
    setParsing(false)
    setFormOpen(true)
  }

  function openAdd() {
    setEditing(null); setForm(EMPTY_FORM); setReceiptPreview(null); setFormOpen(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setForm({
      merchant:     e.merchant,
      amount:       String(e.amount),
      category:     e.category,
      expense_date: e.expense_date,
      notes:        e.notes ?? '',
      receipt_url:  e.receipt_url ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.merchant.trim() || !form.amount) return toast.error('Merchant and amount are required')
    setSaving(true)
    try {
      const url    = editing ? `/api/expenses/${editing.id}` : '/api/expenses'
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? `Save failed (${res.status})`)
      } else {
        toast.success(editing ? 'Expense updated' : 'Expense saved')
        setFormOpen(false)
        const expenseMonth = form.expense_date.slice(0, 7)
        setSelectedMonth(expenseMonth)
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
    if (res.ok) { toast.success('Expense deleted'); setDeleteId(null); load() }
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (value: any) => value != null ? formatCurrency(Number(value)) : ''

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
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-zinc-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    ))}
                    <td />
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
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
                  <td colSpan={3} className="px-4 py-3 font-medium text-zinc-600">Total</td>
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
