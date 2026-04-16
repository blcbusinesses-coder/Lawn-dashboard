'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Customer {
  id: string
  full_name: string
  phone: string | null
}

interface SmsMessage {
  id: string
  to_phone: string
  body: string
  status: string | null
  sent_at: string
  customers: { full_name: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  delivered: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  queued: 'bg-yellow-100 text-yellow-700',
}

export default function SmsPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<SmsMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const [custRes, histRes] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/sms'),
    ])
    const custs = await custRes.json()
    setCustomers(custs.filter((c: Customer) => c.phone))
    if (histRes.ok) setHistory(await histRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function toggleCustomer(id: string) {
    setSelected((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function selectAll() {
    const withPhone = customers.filter((c) => c.phone)
    setSelected(new Set(withPhone.map((c) => c.id)))
  }

  async function handleSend() {
    if (selected.size === 0) return toast.error('Select at least one recipient')
    if (!message.trim()) return toast.error('Message is required')

    setSending(true)
    const recipients = customers
      .filter((c) => selected.has(c.id) && c.phone)
      .map((c) => ({ phone: c.phone!, customer_id: c.id }))

    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients, body: message }),
    })

    const result = await res.json()
    const sent = result.results?.filter((r: { status: string }) => r.status === 'sent').length ?? 0
    const failed = result.results?.filter((r: { status: string }) => r.status === 'failed').length ?? 0

    if (sent > 0) toast.success(`Sent to ${sent} recipient${sent > 1 ? 's' : ''}`)
    if (failed > 0) toast.error(`Failed to send to ${failed} recipient${failed > 1 ? 's' : ''}`)

    setSelected(new Set())
    setMessage('')
    load()
    setSending(false)
  }

  const filtered = customers.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  const charCount = message.length
  const segments = Math.ceil(charCount / 160) || 0

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">SMS</h1>
        <p className="text-sm text-zinc-500 mt-1">Send text messages to your customers via Twilio</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recipient selection */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">Recipients</h2>
              <button onClick={selectAll} className="text-xs text-zinc-500 hover:text-zinc-700">Select all</button>
            </div>
            <div className="p-3">
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-zinc-200 rounded-md px-3 py-1.5 text-sm mb-2"
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-2.5"><Skeleton className="h-4 w-32" /></div>
                ))
              ) : filtered.length === 0 ? (
                <p className="px-4 py-4 text-sm text-zinc-400">No customers with phone numbers</p>
              ) : (
                filtered.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleCustomer(c.id)}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{c.full_name}</p>
                      <p className="text-xs text-zinc-500">{c.phone}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            {selected.size > 0 && (
              <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50">
                <p className="text-xs text-zinc-600">{selected.size} selected</p>
              </div>
            )}
          </div>
        </div>

        {/* Message composer */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-800 mb-3">Message</h2>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message…"
              rows={5}
              className="resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-zinc-400">
                {charCount} chars · {segments} SMS segment{segments !== 1 ? 's' : ''}
              </p>
              <Button
                onClick={handleSend}
                disabled={sending || selected.size === 0 || !message.trim()}
              >
                {sending ? 'Sending…' : `📤 Send to ${selected.size} recipient${selected.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>

          {/* History */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-800">Message History</h2>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {history.length === 0 ? (
                <p className="px-5 py-6 text-sm text-zinc-400">No messages sent yet</p>
              ) : (
                history.map((msg) => (
                  <div key={msg.id} className="px-5 py-3 border-b border-zinc-50 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-zinc-800">
                            {msg.customers?.full_name ?? msg.to_phone}
                          </span>
                          <span className="text-xs text-zinc-400">{msg.to_phone}</span>
                        </div>
                        <p className="text-sm text-zinc-600 truncate">{msg.body}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[msg.status ?? ''] ?? 'bg-zinc-100 text-zinc-500'}`}>
                          {msg.status ?? 'unknown'}
                        </span>
                        <p className="text-xs text-zinc-400 mt-1">{format(new Date(msg.sent_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
