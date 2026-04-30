'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
}

interface Payment {
  id: string
  invoice_id: string
  amount: number
  paid_at: string
  note: string | null
  created_at: string
}

interface Invoice {
  id: string
  customer_id: string
  period_start: string
  period_end: string
  status: 'draft' | 'sent' | 'paid' | 'void'
  subtotal: number
  total_amount: number
  ai_message: string | null
  sent_at: string | null
  paid_at: string | null
  customers: { full_name: string; email: string | null }
  invoice_line_items: LineItem[]
  invoice_payments: Payment[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft:   'bg-yellow-100 text-yellow-700',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  void:    'bg-zinc-100 text-zinc-500',
  partial: 'bg-orange-100 text-orange-700',
}

function amountPaid(inv: Invoice) {
  return (inv.invoice_payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
}

function balanceDue(inv: Invoice) {
  return Math.max(inv.total_amount - amountPaid(inv), 0)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [loading, setLoading]           = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('draft')
  const [sending, setSending]           = useState<string | null>(null)
  const [editingMsg, setEditingMsg]     = useState<{ id: string; message: string } | null>(null)

  // Generate dialog
  const [genOpen, setGenOpen]   = useState(false)
  const [genYear, setGenYear]   = useState(() => new Date().getFullYear())
  const [genMonth, setGenMonth] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.getMonth() + 1 })
  const [generating, setGenerating] = useState(false)

  // Test dialog
  const [testOpen, setTestOpen]       = useState(false)
  const [testEmail, setTestEmail]     = useState('')
  const [testSending, setTestSending] = useState(false)

  // Custom invoice dialog
  const [customOpen, setCustomOpen]   = useState(false)
  const [customers, setCustomers]     = useState<{ id: string; full_name: string; email: string | null }[]>([])
  const [customForm, setCustomForm]   = useState({
    customer_id: '',
    period_start: format(new Date(), 'yyyy-MM-01'),
    period_end: format(new Date(), `yyyy-MM-${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}`),
    ai_message: '',
  })
  const [customItems, setCustomItems] = useState([{ description: '', quantity: 1, unit_price: 0 }])
  const [customSaving, setCustomSaving] = useState(false)

  // Record payment dialog
  const [payInv, setPayInv]           = useState<Invoice | null>(null)
  const [payAmount, setPayAmount]     = useState('')
  const [payDate, setPayDate]         = useState(new Date().toISOString().split('T')[0])
  const [payNote, setPayNote]         = useState('')
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Expand payment history per invoice
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices?status=${filterStatus}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setInvoices(Array.isArray(data) ? data : [])
    } catch { /* handled below */ }
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { setLoading(true); load() }, [load])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleSend(invoiceId: string) {
    setSending(invoiceId)
    const res = await fetch('/api/invoices/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoiceId }),
    })
    setSending(null)
    if (res.ok) { toast.success('Invoice sent!'); load() }
    else { const { error } = await res.json(); toast.error(error) }
  }

  async function handleVoid(invoiceId: string) {
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Invoice voided'); load() }
    else toast.error('Could not void invoice')
  }

  async function handleSaveMessage() {
    if (!editingMsg) return
    const res = await fetch(`/api/invoices/${editingMsg.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_message: editingMsg.message }),
    })
    if (res.ok) { toast.success('Message updated'); setEditingMsg(null); load() }
    else toast.error('Could not save')
  }

  function openRecordPayment(inv: Invoice) {
    setPayInv(inv)
    setPayAmount(String(balanceDue(inv)))
    setPayDate(new Date().toISOString().split('T')[0])
    setPayNote('')
  }

  async function handleRecordPayment() {
    if (!payInv) return
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) return toast.error('Enter a valid amount')
    setPaySubmitting(true)
    const res = await fetch(`/api/invoices/${payInv.id}/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, paid_at: payDate, note: payNote.trim() || null }),
    })
    setPaySubmitting(false)
    if (res.ok) {
      const { fully_paid } = await res.json()
      toast.success(fully_paid ? 'Paid in full!' : `Payment of ${formatCurrency(amt)} recorded`)
      setPayInv(null)
      load()
    } else {
      const { error } = await res.json()
      toast.error(error ?? 'Failed to record payment')
    }
  }

  async function handleDeletePayment(invoiceId: string, paymentId: string) {
    const res = await fetch(`/api/invoices/${invoiceId}/payments?payment_id=${paymentId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Payment removed'); load() }
    else toast.error('Could not remove payment')
  }

  async function openCustom() {
    if (!customers.length) {
      const res = await fetch('/api/customers')
      if (res.ok) setCustomers(await res.json())
    }
    setCustomOpen(true)
  }

  async function handleCustomInvoice() {
    if (!customForm.customer_id) return toast.error('Select a customer')
    if (customItems.some((li) => !li.description.trim())) return toast.error('All line items need a description')
    setCustomSaving(true)
    const res = await fetch('/api/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customForm.customer_id,
        period_start: customForm.period_start,
        period_end: customForm.period_end,
        ai_message: customForm.ai_message || null,
        line_items: customItems,
      }),
    })
    setCustomSaving(false)
    if (res.ok) {
      toast.success('Custom invoice created as draft')
      setCustomOpen(false)
      setCustomItems([{ description: '', quantity: 1, unit_price: 0 }])
      setFilterStatus('draft')
      load()
    } else {
      toast.error((await res.json()).error ?? 'Failed to create invoice')
    }
  }

  async function handleSendTest() {
    if (!testEmail.trim()) return
    setTestSending(true)
    const res = await fetch('/api/invoices/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    })
    const result = await res.json()
    setTestSending(false)
    if (res.ok) { toast.success(`Test sent to ${testEmail}`); setTestOpen(false); setTestEmail('') }
    else toast.error(result.error ?? 'Failed to send test')
  }

  async function handleGenerate() {
    setGenerating(true)
    const res = await fetch('/api/invoices/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: genYear, month: genMonth }),
    })
    const result = await res.json()
    if (!res.ok) toast.error(result.error)
    else { toast.success(`Created ${result.created} draft invoices`); setGenOpen(false); setFilterStatus('draft'); load() }
    setGenerating(false)
  }

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-1">Generate, send, and track payments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setTestOpen(true)}>Send Test Email</Button>
          <Button variant="outline" onClick={openCustom}>Custom Invoice</Button>
          <Button onClick={() => setGenOpen(true)}>Generate Invoices</Button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['draft', 'sent', 'paid', 'void'].map((s) => (
          <Button key={s} size="sm" variant={filterStatus === s ? 'default' : 'outline'}
            onClick={() => setFilterStatus(s)} className="capitalize">{s}</Button>
        ))}
        <Button size="sm" variant={filterStatus === '' ? 'default' : 'outline'} onClick={() => setFilterStatus('')}>All</Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5">
              <Skeleton className="h-5 w-48 mb-3" /><Skeleton className="h-4 w-64" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
          <p className="text-zinc-400">No {filterStatus} invoices.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => {
            const paid    = amountPaid(inv)
            const balance = balanceDue(inv)
            const partial = paid > 0 && balance > 0
            const pct     = inv.total_amount > 0 ? Math.min((paid / inv.total_amount) * 100, 100) : 0
            const showPayments = expandedPayments.has(inv.id)
            const canPay  = inv.status !== 'void' && balance > 0

            // Display badge: show "partial" override when applicable
            const badgeKey   = partial ? 'partial' : inv.status
            const badgeLabel = partial ? 'partial' : inv.status

            return (
              <div key={inv.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                {/* Header row */}
                <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-zinc-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-zinc-900">{inv.customers?.full_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[badgeKey]}`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 mt-0.5">
                      {format(new Date(inv.period_start + 'T00:00:00'), 'MMM d')}
                      {' – '}
                      {format(new Date(inv.period_end + 'T00:00:00'), 'MMM d, yyyy')}
                      {inv.customers?.email && <span className="ml-2">· {inv.customers.email}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    {/* Amount summary */}
                    <div className="text-right">
                      <p className="text-xl font-bold text-zinc-900">{formatCurrency(inv.total_amount)}</p>
                      {partial && (
                        <p className="text-xs text-orange-600 font-medium">
                          {formatCurrency(balance)} still owed
                        </p>
                      )}
                      {inv.status === 'paid' && (
                        <p className="text-xs text-green-600 font-medium">Paid in full</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {inv.status === 'draft' && (
                        <>
                          {inv.customers?.email ? (
                            <Button size="sm" onClick={() => handleSend(inv.id)} disabled={sending === inv.id}>
                              {sending === inv.id ? 'Sending…' : 'Send Email'}
                            </Button>
                          ) : (
                            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md font-medium">
                              No email on file
                            </span>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleVoid(inv.id)}>Void</Button>
                        </>
                      )}
                      {canPay && (
                        <Button size="sm" variant="outline" onClick={() => openRecordPayment(inv)}>
                          Record Payment
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment progress bar (when partial or fully paid with payments logged) */}
                {(partial || (inv.status === 'paid' && inv.invoice_payments.length > 0)) && (
                  <div className="px-5 pt-3 pb-1">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>{formatCurrency(paid)} paid</span>
                      {balance > 0 && <span>{formatCurrency(balance)} remaining</span>}
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-orange-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Line items */}
                <div className="px-5 py-3">
                  <table className="w-full text-sm">
                    <tbody>
                      {inv.invoice_line_items.map((li) => (
                        <tr key={li.id}>
                          <td className="py-1 text-zinc-600">{li.description}</td>
                          <td className="py-1 text-zinc-500 text-center w-16">×{li.quantity}</td>
                          <td className="py-1 text-zinc-600 text-right w-24">{formatCurrency(li.unit_price)}/ea</td>
                          <td className="py-1 font-medium text-zinc-900 text-right w-24">{formatCurrency(li.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payment history toggle */}
                {inv.invoice_payments.length > 0 && (
                  <div className="px-5 pb-3 border-t border-zinc-50">
                    <button
                      onClick={() => setExpandedPayments((prev) => {
                        const next = new Set(prev)
                        next.has(inv.id) ? next.delete(inv.id) : next.add(inv.id)
                        return next
                      })}
                      className="text-xs text-zinc-400 hover:text-zinc-700 mt-2 transition-colors"
                    >
                      {showPayments ? '▲ Hide' : '▼ Show'} {inv.invoice_payments.length} payment{inv.invoice_payments.length > 1 ? 's' : ''}
                    </button>

                    {showPayments && (
                      <div className="mt-2 space-y-1.5">
                        {[...inv.invoice_payments]
                          .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
                          .map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-sm bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-3">
                                <span className="text-green-700 font-semibold">{formatCurrency(p.amount)}</span>
                                <span className="text-zinc-500 text-xs">
                                  {format(new Date(p.paid_at + 'T12:00:00'), 'MMM d, yyyy')}
                                </span>
                                {p.note && <span className="text-zinc-400 text-xs italic">"{p.note}"</span>}
                              </div>
                              {inv.status !== 'void' && (
                                <button
                                  onClick={() => handleDeletePayment(inv.id, p.id)}
                                  className="text-zinc-300 hover:text-red-400 transition-colors text-xs px-1"
                                  title="Remove this payment"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Message */}
                {inv.ai_message && (
                  <div className="px-5 py-3 border-t border-zinc-50 bg-zinc-50 rounded-b-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Email message</p>
                        <p className="text-sm text-zinc-600 italic">{inv.ai_message}</p>
                      </div>
                      {inv.status === 'draft' && (
                        <Button size="sm" variant="ghost" onClick={() => setEditingMsg({ id: inv.id, message: inv.ai_message! })}>Edit</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Record Payment Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!payInv} onOpenChange={(o) => { if (!o) setPayInv(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {payInv && (
            <div className="space-y-4">
              <div className="bg-zinc-50 rounded-lg px-4 py-3 text-sm">
                <p className="font-medium text-zinc-800">{payInv.customers?.full_name}</p>
                <div className="flex gap-4 mt-1 text-zinc-500">
                  <span>Invoice total: <strong className="text-zinc-800">{formatCurrency(payInv.total_amount)}</strong></span>
                  <span>Balance due: <strong className="text-orange-600">{formatCurrency(balanceDue(payInv))}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Amount paid *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">$</span>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full border border-zinc-200 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700">Date *</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Note <span className="font-normal text-zinc-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder='e.g. "Cash" or "Venmo"'
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </div>

              {/* Quick-fill buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPayAmount(String(balanceDue(payInv)))}
                  className="text-xs border border-zinc-200 rounded px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  Full balance ({formatCurrency(balanceDue(payInv))})
                </button>
                {balanceDue(payInv) >= 2 && (
                  <button
                    onClick={() => setPayAmount(String(Math.round(balanceDue(payInv) / 2 * 100) / 100))}
                    className="text-xs border border-zinc-200 rounded px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Half ({formatCurrency(balanceDue(payInv) / 2)})
                  </button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayInv(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={paySubmitting || !payAmount || parseFloat(payAmount) <= 0}>
              {paySubmitting ? 'Saving…' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Custom Invoice Dialog ────────────────────────────────────────────── */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Custom Invoice</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-500">For one-off jobs like mulching, cleanups, or any custom service.</p>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">Customer *</label>
              <select
                value={customForm.customer_id}
                onChange={(e) => setCustomForm({ ...customForm, customer_id: e.target.value })}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}{c.email ? ` — ${c.email}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Invoice Date (start)</label>
                <input type="date" value={customForm.period_start}
                  onChange={(e) => setCustomForm({ ...customForm, period_start: e.target.value })}
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-700">Invoice Date (end)</label>
                <input type="date" value={customForm.period_end}
                  onChange={(e) => setCustomForm({ ...customForm, period_end: e.target.value })}
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">Line Items *</label>
                <button type="button"
                  onClick={() => setCustomItems([...customItems, { description: '', quantity: 1, unit_price: 0 }])}
                  className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1 hover:bg-zinc-50">
                  + Add item
                </button>
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-zinc-500 px-1">
                <span className="col-span-6">Description</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-3 text-right">Unit Price</span>
                <span className="col-span-1" />
              </div>
              {customItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input className="col-span-6 border border-zinc-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    placeholder="e.g. Mulching — 412 Oak St" value={item.description}
                    onChange={(e) => { const n=[...customItems]; n[i]={...n[i],description:e.target.value}; setCustomItems(n) }} />
                  <input type="number" min="1" className="col-span-2 border border-zinc-200 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    value={item.quantity}
                    onChange={(e) => { const n=[...customItems]; n[i]={...n[i],quantity:parseInt(e.target.value)||1}; setCustomItems(n) }} />
                  <input type="number" min="0" step="0.01" className="col-span-3 border border-zinc-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    placeholder="0.00" value={item.unit_price||''}
                    onChange={(e) => { const n=[...customItems]; n[i]={...n[i],unit_price:parseFloat(e.target.value)||0}; setCustomItems(n) }} />
                  <button type="button" disabled={customItems.length===1}
                    onClick={() => setCustomItems(customItems.filter((_,idx)=>idx!==i))}
                    className="col-span-1 text-zinc-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-lg leading-none flex items-center justify-center">×</button>
                </div>
              ))}
              <div className="flex justify-end pt-1 border-t border-zinc-100">
                <p className="text-sm font-semibold text-zinc-900">
                  Total: {formatCurrency(customItems.reduce((s,li)=>s+li.quantity*li.unit_price,0))}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">Email message <span className="font-normal text-zinc-400">(optional)</span></label>
              <Textarea placeholder="e.g. Thanks for the mulching job — the yard is looking great!"
                value={customForm.ai_message}
                onChange={(e) => setCustomForm({ ...customForm, ai_message: e.target.value })}
                rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>Cancel</Button>
            <Button onClick={handleCustomInvoice} disabled={customSaving}>{customSaving ? 'Creating…' : 'Create Draft'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Test Invoice Dialog ──────────────────────────────────────────────── */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Test Invoice</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-500">Sends a sample invoice so you can preview how it looks in an inbox.</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Send to email</label>
            <input type="email" placeholder="you@example.com" value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key==='Enter') handleSendTest() }}
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button onClick={handleSendTest} disabled={testSending||!testEmail.trim()}>{testSending?'Sending…':'Send Test'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Month-End Invoices</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600">Creates draft invoices for all customers based on completed jobs.</p>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Month</label>
              <select className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={genMonth} onChange={(e) => setGenMonth(parseInt(e.target.value))}>
                {months.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="w-28 space-y-1">
              <label className="text-sm font-medium">Year</label>
              <input type="number" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={genYear} onChange={(e) => setGenYear(parseInt(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>{generating?'Generating…':'Generate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Message Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!editingMsg} onOpenChange={() => setEditingMsg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Invoice Message</DialogTitle></DialogHeader>
          <Textarea value={editingMsg?.message??''}
            onChange={(e) => setEditingMsg(editingMsg?{...editingMsg,message:e.target.value}:null)}
            rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMsg(null)}>Cancel</Button>
            <Button onClick={handleSaveMessage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
