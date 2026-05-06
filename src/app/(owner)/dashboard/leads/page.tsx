'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Copy, Check, RefreshCw, MessageSquare, ExternalLink } from 'lucide-react'

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

const STATUS_COLORS: Record<Status, string> = {
  new:          'bg-blue-500/15 text-blue-400 border-blue-500/30',
  quoted:       'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  followed_up:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  closed:       'bg-green-500/15 text-green-400 border-green-500/30',
  converted:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  lost:         'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const STATUS_OPTIONS: Status[] = ['new', 'quoted', 'followed_up', 'closed', 'converted', 'lost']

function SourceBadge({ source }: { source: 'facebook' | 'website' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
      source === 'facebook'
        ? 'bg-blue-600/15 text-blue-400 border-blue-600/30'
        : 'bg-zinc-600/15 text-zinc-400 border-zinc-600/30'
    }`}>
      {source === 'facebook' ? '📘 Facebook' : '🌐 Website'}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors">
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
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
        toast.success(`Quote generated: $${data.quote_amount}`)
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
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    quoted: leads.filter(l => l.status === 'quoted').length,
    closed: leads.filter(l => ['closed', 'converted'].includes(l.status)).length,
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Facebook ads + website form submissions</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Leads', value: stats.total, color: 'text-white' },
          { label: 'New', value: stats.new, color: 'text-blue-400' },
          { label: 'Quoted', value: stats.quoted, color: 'text-yellow-400' },
          { label: 'Closed', value: stats.closed, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Twilio status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
        twilioEnabled
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      }`}>
        <MessageSquare size={16} />
        {twilioEnabled
          ? 'Auto-send is ON — quotes are sent automatically via Twilio when a lead comes in.'
          : 'Auto-send is OFF — copy the drafted text below and send manually from Google Voice. Enable in Automation settings when Twilio is ready.'}
      </div>

      {/* Leads table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg font-medium">No leads yet</p>
          <p className="text-sm mt-1">Leads will appear here when someone fills out the Facebook ad form or website form.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => {
            const expanded = expandedId === lead.id
            return (
              <div key={lead.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {/* Main row */}
                <div className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{lead.name}</span>
                        <SourceBadge source={lead.source ?? 'website'} />
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[lead.status]}`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm">{lead.phone}</p>
                      <p className="text-zinc-500 text-sm truncate">{lead.address}</p>
                      {lead.lot_size_sqft && (
                        <p className="text-zinc-600 text-xs mt-0.5">{lead.lot_size_sqft.toLocaleString()} sq ft lot</p>
                      )}
                    </div>

                    {/* Quote */}
                    <div className="text-right shrink-0">
                      {lead.quoted_amount ? (
                        <p className="text-lg font-bold text-green-400">${lead.quoted_amount}/mow</p>
                      ) : (
                        <p className="text-zinc-600 text-sm">No quote yet</p>
                      )}
                      <p className="text-zinc-600 text-xs mt-0.5">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {/* Status dropdown */}
                    <select
                      value={lead.status}
                      onChange={e => updateStatus(lead.id, e.target.value as Status)}
                      className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>

                    {/* Generate quote */}
                    {!lead.quoted_amount && (
                      <button
                        onClick={() => generateQuote(lead.id)}
                        disabled={generatingId === lead.id}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                      >
                        {generatingId === lead.id ? (
                          <><RefreshCw size={12} className="animate-spin" /> Calculating…</>
                        ) : '⚡ Generate Quote'}
                      </button>
                    )}

                    {/* Open in Google Maps */}
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                    >
                      <ExternalLink size={12} /> Map
                    </a>

                    {/* Expand/collapse */}
                    <button
                      onClick={() => setExpandedId(expanded ? null : lead.id)}
                      className="ml-auto px-2 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                    >
                      {expanded ? '▲ Less' : '▼ More'}
                    </button>
                  </div>
                </div>

                {/* Expanded: drafted text + notes */}
                {expanded && (
                  <div className="border-t border-zinc-800 p-4 space-y-4">
                    {/* Drafted text */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Drafted Text Message</p>
                        <div className="flex items-center gap-2">
                          {lead.drafted_text && <CopyButton text={lead.drafted_text} />}
                          {lead.drafted_text && !lead.quote_sent_at && (
                            <button
                              onClick={() => markSent(lead.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-700 hover:bg-green-600 text-white transition-colors"
                            >
                              <Check size={12} /> Mark as Sent
                            </button>
                          )}
                          {lead.quote_sent_at && (
                            <span className="text-xs text-green-400">
                              ✓ Sent {formatDistanceToNow(new Date(lead.quote_sent_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      {lead.drafted_text ? (
                        <div className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {lead.drafted_text}
                        </div>
                      ) : (
                        <div className="bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-600 italic">
                          {lead.quoted_amount
                            ? 'No draft generated yet.'
                            : 'Generate a quote first to get a drafted message.'}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Notes</p>
                      <textarea
                        rows={2}
                        placeholder="Add notes about this lead…"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-500"
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
