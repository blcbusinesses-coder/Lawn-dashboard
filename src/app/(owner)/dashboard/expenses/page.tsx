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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { format } from 'date-fns'

interface Expense {
  id: string
  merchant: string
  amount: number
  category: string
  expense_date: string
  notes: string | null
  receipt_url: string | null
}

const CATEGORIES = ['fuel', 'equipment', 'supplies', 'labor', 'other']
const CATEGORY_COLORS: Record<string, string> = {
  fuel: 'bg-blue-100 text-blue-700',
  equipment: 'bg-purple-100 text-purple-700',
  supplies: 'bg-yellow-100 text-yellow-700',
  labor: 'bg-orange-100 text-orange-700',
  other: 'bg-zinc-100 text-zinc-600',
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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/expenses?month=${selectedMonth}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setExpenses(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => { setLoading(true); load() }, [load])

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setReceiptPreview(URL.createObjectURL(file))
    setParsing(true)
    toast.info('Reading receipt with AI…')

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/expenses/parse-receipt', { method: 'POST', body: fd })
    if (!res.ok) {
      toast.error('Could not parse receipt')
      setParsing(false)
      return
    }

    const parsed = await res.json()
    setForm({
      merchant: parsed.merchant ?? '',
      amount: String(parsed.amount ?? ''),
      category: parsed.category ?? 'other',
      expense_date: parsed.date ?? new Date().toISOString().split('T')[0],
      notes: parsed.notes ?? '',
      receipt_url: parsed.receipt_url ?? '',
    })
    toast.success('Receipt parsed! Review and confirm.')
    setParsing(false)
    setFormOpen(true)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setReceiptPreview(null)
    setFormOpen(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setForm({
      merchant: e.merchant,
      amount: String(e.amount),
      category: e.category,
      expense_date: e.expense_date,
      notes: e.notes ?? '',
      receipt_url: e.receipt_url ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.merchant.trim() || !form.amount) return toast.error('Merchant and amount are required')
    setSaving(true)

    const url = editing ? `/api/expenses/${editing.id}` : '/api/expenses'
    const method = editing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })

    if (!res.ok) toast.error((await res.json()).error)
    else {
      toast.success(editing ? 'Expense updated' : 'Expense saved')
      setFormOpen(false)
      load()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/expenses/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Expense deleted'); setDeleteId(null); load() }
    else toast.error('Could not delete')
  }

  // Group by month for display (since we already filter by month, group by category)
  const totalByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
    return acc
  }, {} as Record<string, number>)

  const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Expenses</h1>
          <p className="text-sm text-zinc-500 mt-1">Track and categorize business expenses</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-40" />
          <label className="cursor-pointer">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? 'Reading…' : '📷 Scan Receipt'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleReceiptUpload} />
          </label>
          <Button onClick={openAdd}>+ Add Manually</Button>
        </div>
      </div>

      {/* Category totals */}
      {!loading && expenses.length > 0 && (
        <div className="grid grid-cols-6 gap-3 mb-6">
          {CATEGORIES.map((cat) => (
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

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">No expenses for {selectedMonth}. Scan a receipt or add manually.</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-600">{format(new Date(e.expense_date + 'T00:00:00'), 'MMM d, yyyy')}</td>
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

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          {receiptPreview && (
            <img src={receiptPreview} alt="Receipt" className="w-full max-h-40 object-contain rounded border border-zinc-200 mb-2" />
          )}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Merchant *</Label>
              <Input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount ($) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
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
