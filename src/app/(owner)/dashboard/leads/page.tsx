'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Copy, Check, RefreshCw, MessageSquare, ExternalLink, Zap, MapPin, Phone, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

type Status = 'new' | 'quoted' | 'followed_up' | 'closed' | 'converted' | 'lost'

interface Lead {
  id: string
  name: string
  phone: string
  address: string
  source: 'facebook' | 'website'
  status: Status
  quoted_amount: number | null
  drafted_text: string | null
  notes: string | null
  lot_size_sqft: number | null
  quote_sent_at: string | null
  created_at: string
}

const STATUS_CLASSES: Record<Status, string> = {
  new:          'bg-blue-50 text-blue-700 border-blue-200',
  quoted:       'bg-amber-50 text-amber-700 border-amber-200',
  followed_up:  'bg-purple-50 text-purple-700 border-purple-200',
  closed:       'bg-green-50 text-green-700 border-green-200',
  converted:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost:         'bg-zinc-100 text-zinc-500 border-zinc-200',
}

const STATUS_OPTIONS: Status[] = ['new', 'quoted', 'followed_up', 'closed', 'converted', 'lost']

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button size="sm" variant="outline" onClick={copy} className="h-7 px-2 text-xs gap-1">
      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({})
  const [twilioEnabled, setTwilioEnabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [leadsRes, settingsRes] = await Promise.all([
      fetch('/api/leads'),
      fetch('/api/automation/settings'),
    ])
    if (leadsRes.ok) setLeads(await leadsRes.json())
    if (settingsRes.ok) {
      const s = await settingsRes.json()
      setTwilioEnabled(s.twilio_enabled === true || s.twilio_enabled === 'true')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: Status) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { toast.error('Failed to update status'); load() }
  }

  async function saveNotes(id: string) {
    const notes = noteEdits[id] ?? ''
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l))
      toast.success('Notes saved')
    } else {
      toast.error('Failed to save notes')
    }
  }

  async function markSent(id: string) {
    const now = new Date().toISOString()
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote_sent_at: now, status: 'quoted' }),
    })
    if (res.ok) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, quote_sent_at: now, status: 'quoted' } : l))
      toast.success('Marked as sent')
    }
  }

  async function generateQuote(id: string) {
    setGeneratingId(id)
    try {
      const res = await fetch(`/api/leads/${id}/quote`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Quote: $${data.quote_amount}/mow`)
        load()
      } else {
        toast.error(data.error ?? 'Quote generation failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setGeneratingId(null)
    }
  }

  const stats = {
    total:   leads.length,
    new:     leads.filter(l => l.status === 'new').length,
    quoted:  leads.filter(l => l.status === 'quoted').length,
    closed:  leads.filter(l => ['closed', 'converted'].includes(l.status)).length,
  }

  return (
    <div className="p-4 md:p-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Lead Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-1">Facebook ads + website form submissions</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Leads', value: stats.total,  valueClass: 'text-zinc-900' },
          { label: 'New',         value: stats.new,    valueClass: 'text-blue-600' },
          { label: 'Quoted',      value: stats.quoted, valueClass: 'text-amber-600' },
          { label: 'Closed',      value: stats.closed, valueClass: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-zinc-200 p-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.valueClass}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Twilio banner */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm mb-6 ${
        twilioEnabled
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}>
        <MessageSquare size={15} />
        {twilioEnabled
          ? 'Auto-send ON — quotes are texted automatically via Twilio when a lead arrives.'
          : 'Auto-send OFF — copy the drafted message and send manually via Google Voice. Enable in Automation when ready.'}
      </div>

      {/* Leads */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 py-16 text-center">
          <p className="font-medium text-zinc-700">No leads yet</p>
          <p className="text-sm text-zinc-400 mt-1">
            Leads appear here when someone fills out the Facebook ad form or website quote form.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => {
            const expanded = expandedId === lead.id
            return (
              <div key={lead.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">

                {/* Main row */}
                <div className="p-4">
                  <div className="flex flex-wrap items-start gap-3">

                    {/* Identity */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900">{lead.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          lead.source === 'facebook'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        }`}>
                          {lead.source === 'facebook' ? 'Facebook' : 'Website'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${STATUS_CLASSES[lead.status]}`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-zinc-500">
                        <span className="flex items-center gap-1.5"><Phone size={12} className="text-zinc-400" />{lead.phone}</span>
                        <span className="flex items-center gap-1.5 truncate"><MapPin size={12} className="text-zinc-400" />{lead.address}</span>
                      </div>
                      {lead.lot_size_sqft && (
                        <p className="text-xs text-zinc-400">{lead.lot_size_sqft.toLocaleString()} sq ft lot</p>
                      )}
                    </div>

                    {/* Price + time */}
                    <div className="text-right shrink-0">
                      {lead.quoted_amount ? (
                        <p className="text-xl font-bold text-green-600">
                          ${lead.quoted_amount}<span className="text-sm font-normal text-zinc-400">/mow</span>
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-400">No quote yet</p>
                      )}
                      <p className="text-xs text-zinc-400 flex items-center justify-end gap-1 mt-0.5">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-100">
                    <select
                      value={lead.status}
                      onChange={e => updateStatus(lead.id, e.target.value as Status)}
                      className="h-8 px-2 rounded-md border border-zinc-200 bg-white text-zinc-700 text-xs focus:outline-none focus:border-zinc-400"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>

                    {!lead.quoted_amount && (
                      <Button size="sm" className="h-8 px-3 text-xs gap-1.5"
                        onClick={() => generateQuote(lead.id)}
                        disabled={generatingId === lead.id}
                      >
                        {generatingId === lead.id
                          ? <><RefreshCw size={11} className="animate-spin" /> Calculating…</>
                          : <><Zap size={11} /> Generate Quote</>}
                      </Button>
                    )}

                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
                    >
                      <ExternalLink size={11} /> Map
                    </a>

                    <Button size="sm" variant="ghost"
                      onClick={() => setExpandedId(expanded ? null : lead.id)}
                      className="h-8 px-3 text-xs ml-auto text-zinc-500 hover:text-zinc-700 gap-1"
                    >
                      {expanded ? <><ChevronUp size={13} /> Less</> : <><ChevronDown size={13} /> Details</>}
                    </Button>
                  </div>
                </div>

                {/* Expanded panel */}
                {expanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50 p-4 space-y-4">

                    {/* Drafted text */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Drafted Text Message</p>
                        <div className="flex items-center gap-2">
                          {lead.drafted_text && <CopyButton text={lead.drafted_text} />}
                          {lead.drafted_text && !lead.quote_sent_at && (
                            <Button size="sm" onClick={() => markSent(lead.id)}
                              className="h-7 px-2 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white">
                              <Check size={11} /> Mark as Sent
                            </Button>
                          )}
                          {lead.quote_sent_at && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <Check size={11} /> Sent {formatDistanceToNow(new Date(lead.quote_sent_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      {lead.drafted_text ? (
                        <div className="bg-white border border-zinc-200 rounded-lg p-3 text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                          {lead.drafted_text}
                        </div>
                      ) : (
                        <div className="bg-white border border-zinc-200 rounded-lg p-3 text-sm text-zinc-400 italic">
                          {lead.quoted_amount ? 'No draft generated.' : 'Generate a quote first to get the drafted message.'}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Notes</p>
                      <textarea
                        rows={2}
                        placeholder="Add notes about this lead…"
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 placeholder-zinc-400 resize-none focus:outline-none focus:border-zinc-400 transition-colors"
                        value={noteEdits[lead.id] ?? lead.notes ?? ''}
                        onChange={e => setNoteEdits(prev => ({ ...prev, [lead.id]: e.target.value }))}
                        onBlur={() => {
                          if ((noteEdits[lead.id] ?? lead.notes ?? '') !== (lead.notes ?? '')) {
                            saveNotes(lead.id)
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
