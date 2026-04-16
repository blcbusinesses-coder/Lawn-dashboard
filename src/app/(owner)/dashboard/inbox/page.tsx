'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string
  phone: string
  display_name: string | null
  ai_enabled: boolean
  ai_state: string
  last_message_at: string | null
  unread_count: number
}

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  body: string
  sent_at: string
}

interface AvailDate {
  id: string
  available_date: string
  notes: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: string | null): string {
  if (!ts) return ''
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) }
  catch { return '' }
}

function initials(name: string | null, phone: string): string {
  if (name) return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return phone.slice(-2)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [togglingAi, setTogglingAi] = useState(false)

  // Availability
  const [availDates, setAvailDates] = useState<AvailDate[]>([])
  const [showAvail, setShowAvail] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newDateNotes, setNewDateNotes] = useState('')
  const [addingDate, setAddingDate] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/conversations')
    if (res.ok) {
      const data: Conversation[] = await res.json()
      setConversations(data)
      // Keep selected in sync
      setSelected((prev) => prev ? data.find((c) => c.id === prev.id) ?? prev : prev)
    }
  }, [])

  const loadMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}`)
    if (res.ok) setMessages(await res.json())
  }, [])

  const loadAvailability = useCallback(async () => {
    const res = await fetch('/api/availability')
    if (res.ok) setAvailDates(await res.json())
  }, [])

  // Initial load + poll conversations every 5s
  useEffect(() => {
    loadConversations()
    const interval = setInterval(loadConversations, 5000)
    return () => clearInterval(interval)
  }, [loadConversations])

  // Poll messages for selected conversation every 3s
  useEffect(() => {
    if (!selected) return
    loadMessages(selected.id)
    const interval = setInterval(() => loadMessages(selected.id), 3000)
    return () => clearInterval(interval)
  }, [selected, loadMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Actions ──────────────────────────────────────────────────────────────────

  function selectConversation(conv: Conversation) {
    setSelected(conv)
    setMessages([])
    setReply('')
  }

  async function sendReply() {
    if (!reply.trim() || !selected || sending) return
    setSending(true)
    const res = await fetch(`/api/conversations/${selected.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply.trim() }),
    })
    setSending(false)
    if (res.ok) {
      const msg = await res.json()
      setMessages((prev) => [...prev, msg])
      setReply('')
    } else {
      toast.error('Failed to send message')
    }
  }

  async function toggleAi() {
    if (!selected) return
    setTogglingAi(true)
    const newVal = !selected.ai_enabled
    const res = await fetch(`/api/conversations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_enabled: newVal }),
    })
    setTogglingAi(false)
    if (res.ok) {
      const updated = await res.json()
      setSelected(updated)
      setConversations((prev) => prev.map((c) => c.id === updated.id ? updated : c))
      toast.success(`AI ${newVal ? 'enabled' : 'disabled'}`)
    }
  }

  async function addDate() {
    if (!newDate) return
    setAddingDate(true)
    const res = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available_date: newDate, notes: newDateNotes || null }),
    })
    setAddingDate(false)
    if (res.ok) {
      await loadAvailability()
      setNewDate('')
      setNewDateNotes('')
      toast.success('Date added')
    } else {
      toast.error('Failed to add date')
    }
  }

  async function removeDate(id: string) {
    await fetch(`/api/availability?id=${id}`, { method: 'DELETE' })
    setAvailDates((prev) => prev.filter((d) => d.id !== id))
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">

      {/* ── Conversation list ───────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-zinc-200 flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-zinc-900">Inbox</h1>
            <p className="text-xs text-zinc-400">SMS conversations</p>
          </div>
          <button
            onClick={() => { loadAvailability(); setShowAvail(true) }}
            className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-2 py-1 transition-colors"
          >
            📅 Availability
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-zinc-400">No conversations yet</p>
              <p className="text-xs text-zinc-300 mt-1">Leads will appear here after they text back</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full text-left px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50 transition-colors flex items-start gap-3 ${
                  selected?.id === conv.id ? 'bg-zinc-100' : ''
                }`}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 text-xs font-bold text-zinc-600">
                  {initials(conv.display_name, conv.phone)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {conv.display_name ?? conv.phone}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 bg-zinc-900 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{conv.phone}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${conv.ai_enabled ? 'bg-green-400' : 'bg-zinc-300'}`} />
                    <span className="text-xs text-zinc-400">{timeAgo(conv.last_message_at)}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Message thread ──────────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread header */}
          <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-900">{selected.display_name ?? selected.phone}</h2>
              <p className="text-xs text-zinc-400">{selected.phone} · {selected.ai_state.replace('_', ' ')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">AI</span>
                <button
                  onClick={toggleAi}
                  disabled={togglingAi}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    selected.ai_enabled ? 'bg-green-500' : 'bg-zinc-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      selected.ai_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className={`text-xs font-medium ${selected.ai_enabled ? 'text-green-600' : 'text-zinc-400'}`}>
                  {selected.ai_enabled ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-zinc-50">
            {messages.length === 0 && (
              <p className="text-center text-xs text-zinc-400 mt-8">No messages yet</p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                    msg.direction === 'outbound'
                      ? 'bg-zinc-900 text-white rounded-br-sm'
                      : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-zinc-400' : 'text-zinc-400'}`}>
                    {format(new Date(msg.sent_at), 'h:mm a')}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box */}
          <div className="px-6 py-4 border-t border-zinc-200 bg-white">
            {!selected.ai_enabled && (
              <p className="text-xs text-zinc-400 mb-2">AI is off — you&apos;re replying manually</p>
            )}
            {selected.ai_enabled && (
              <p className="text-xs text-green-600 mb-2">AI is handling replies — or type below to override</p>
            )}
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                disabled={sending}
              />
              <Button onClick={sendReply} disabled={sending || !reply.trim()} className="shrink-0">
                {sending ? '…' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-zinc-50">
          <div className="text-center">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-zinc-500 text-sm">Select a conversation</p>
          </div>
        </div>
      )}

      {/* ── Availability Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAvail} onOpenChange={setShowAvail}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Available Mow Dates</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-zinc-500 -mt-2">These dates are shared with the AI when sending quotes and replying to customers.</p>

          {/* Add date */}
          <div className="flex gap-2 items-end mt-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input placeholder="e.g. morning only" value={newDateNotes} onChange={(e) => setNewDateNotes(e.target.value)} />
            </div>
            <Button size="sm" onClick={addDate} disabled={addingDate || !newDate}>
              {addingDate ? '…' : 'Add'}
            </Button>
          </div>

          {/* Existing dates */}
          <div className="space-y-2 max-h-64 overflow-y-auto mt-2">
            {availDates.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">No dates added yet</p>
            ) : (
              availDates.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">
                      {format(new Date(d.available_date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                    </p>
                    {d.notes && <p className="text-xs text-zinc-400">{d.notes}</p>}
                  </div>
                  <button
                    onClick={() => removeDate(d.id)}
                    className="text-zinc-300 hover:text-red-400 transition-colors ml-3"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
