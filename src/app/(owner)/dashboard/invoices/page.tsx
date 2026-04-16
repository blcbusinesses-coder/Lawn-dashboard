'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  line_total: number
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
  customers: { full_name: string; email: string | null }
  invoice_line_items: LineItem[]
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-zinc-100 text-zinc-500',
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [genOpen, setGenOpen] = useState(false)
  const [genYear, setGenYear] = useState(() => new Date().getFullYear())
  const [genMonth, setGenMonth] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.getMonth() + 1
  })
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [editingMsg, setEditingMsg] = useState<{ id: string; message: string } | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('draft')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices?status=${filterStatus}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setInvoices(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { setLoading(true); load() }, [load])

  async function handleGenerate() {
    setGenerating(true)
    const res = await fetch('/api/invoices/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: genYear, month: genMonth }),
    })
    const result = await res.json()
    if (!res.ok) toast.error(result.error)
    else {
      toast.success(`Created ${result.created} draft invoices`)
      setGenOpen(false)
      setFilterStatus('draft')
      load()
    }
    setGenerating(false)
  }

  async function handleSend(invoiceId: string) {
    setSending(invoiceId)
    const res = await fetch('/api/invoices/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoiceId }),
    })
    if (res.ok) {
      toast.success('Invoice sent!')
      load()
    } else {
      const { error } = await res.json()
      toast.error(error)
    }
    setSending(null)
  }

  async function handleVoid(invoiceId: string) {
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Invoice voided'); load() }
    else toast.error('Could not void invoice')
  }

  async function handleMarkPaid(invoiceId: string) {
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() }),
    })
    if (res.ok) { toast.success('Marked as paid'); load() }
    else toast.error('Could not update')
  }

  async function handleSaveMessage() {
    if (!editingMsg) return
    const res = await fetch(`/api/invoices/${editingMsg.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_message: editingMsg.message }),
    })
    if (res.ok) { toast.success('Message updated'); setEditingMsg(null); load() }
    else toast.error('Could not save')
  }

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-1">Generate, review, and send monthly invoices</p>
        </div>
        <Button onClick={() => setGenOpen(true)}>⚡ Generate Invoices</Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5">
        {['draft', 'sent', 'paid', 'void'].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filterStatus === s ? 'default' : 'outline'}
            onClick={() => setFilterStatus(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
        <Button size="sm" variant={filterStatus === '' ? 'default' : 'outline'} onClick={() => setFilterStatus('')}>All</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5">
              <Skeleton className="h-5 w-48 mb-3" />
              <Skeleton className="h-4 w-64" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center">
          <p className="text-zinc-400">No {filterStatus} invoices. Click "Generate Invoices" to create month-end invoices.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-zinc-900">{inv.customers?.full_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inv.status]}`}>{inv.status}</span>
                  </div>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    {format(new Date(inv.period_start + 'T00:00:00'), 'MMM d')} – {format(new Date(inv.period_end + 'T00:00:00'), 'MMM d, yyyy')}
                    {inv.customers?.email && <span className="ml-2">· {inv.customers.email}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-zinc-900">{formatCurrency(inv.total_amount)}</span>
                  <div className="flex gap-2">
                    {inv.status === 'draft' && (
                      <>
                        <Button size="sm" onClick={() => handleSend(inv.id)} disabled={sending === inv.id}>
                          {sending === inv.id ? 'Sending…' : '📧 Send'}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleVoid(inv.id)}>Void</Button>
                      </>
                    )}
                    {inv.status === 'sent' && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inv.id)}>Mark Paid</Button>
                    )}
                  </div>
                </div>
              </div>

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
          ))}
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Month-End Invoices</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600">This will create draft invoices for all customers based on completed jobs.</p>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Month</label>
              <select
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={genMonth}
                onChange={(e) => setGenMonth(parseInt(e.target.value))}
              >
                {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="w-28 space-y-1">
              <label className="text-sm font-medium">Year</label>
              <input
                type="number"
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={genYear}
                onChange={(e) => setGenYear(parseInt(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>{generating ? 'Generating…' : 'Generate'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={!!editingMsg} onOpenChange={() => setEditingMsg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Invoice Message</DialogTitle></DialogHeader>
          <Textarea
            value={editingMsg?.message ?? ''}
            onChange={(e) => setEditingMsg(editingMsg ? { ...editingMsg, message: e.target.value } : null)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMsg(null)}>Cancel</Button>
            <Button onClick={handleSaveMessage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
