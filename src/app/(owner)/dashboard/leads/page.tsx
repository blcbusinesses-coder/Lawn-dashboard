'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Copy, Check, RefreshCw, MessageSquare, ExternalLink, Zap, MapPin, Phone, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

const STATUS_BADGE: Record<Status, string> = {
  new:          'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
  quoted:       'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
  followed_up:  'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/20',
  closed:       'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20',
  converted:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
  lost:         'bg-zinc-500/15 text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/20',
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
    <Button size="sm" variant="outline" onClick={copy} className="h-7 px-2 text-xs gap-1 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
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
        toast.success(`Quote generated: $${data.quote_amount}/mow`)
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Facebook ads + website form submissions</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}
          className="gap-2 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Leads', value: stats.total,  color: 'text-white' },
          { label: 'New',         value: stats.new,    color: 'text-blue-400' },
          { label: 'Quoted',      value: stats.quoted, color: 'text-amber-400' },
          { label: 'Closed',      value: stats.closed, color: 'text-green-400' },
        ].map(s => (
          <Card key={s.label} className="border-zinc-800 bg-zinc-900">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Twilio status banner */}
      <Card className={`border ${twilioEnabled ? 'border-green-500/30 bg-green-950/20' : 'border-amber-500/30 bg-amber-950/20'}`}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare size={15} className={twilioEnabled ? 'text-green-400' : 'text-amber-400'} />
            <span className={twilioEnabled ? 'text-green-300' : 'text-amber-300'}>
              {twilioEnabled
                ? 'Auto-send ON — quotes are texted automatically via Twilio when a lead comes in.'
                : 'Auto-send OFF — copy the drafted message below and send manually from Google Voice. Enable in Automation settings when ready.'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lead list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : leads.length === 0 ? (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="py-16 text-center">
            <p className="text-lg font-medium text-zinc-300">No leads yet</p>
            <p className="text-sm text-zinc-500 mt-1">
              Leads appear here when someone fills out the Facebook ad form or website quote form.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => {
            const expanded = expandedId === lead.id
            return (
              <Card key={lead.id} className="border-zinc-800 bg-zinc-900 overflow-hidden">
                <CardContent className="p-0">
                  {/* Main row */}
                  <div className="p-4">
                    <div className="flex flex-wrap items-start gap-3">

                      {/* Identity */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{lead.name}</span>
                          <Badge variant="outline" className={`text-xs ${
                            lead.source === 'facebook'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40'
                          }`}>
                            {lead.source === 'facebook' ? 'Facebook' : 'Website'}
                          </Badge>
                          <Badge variant="outline" className={`text-xs capitalize ${STATUS_BADGE[lead.status]}`}>
                            {lead.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-zinc-400">
                          <span className="flex items-center gap-1"><Phone size={11} className="text-zinc-600" />{lead.phone}</span>
                          <span className="flex items-center gap-1 truncate"><MapPin size={11} className="text-zinc-600" />{lead.address}</span>
                        </div>
                        {lead.lot_size_sqft && (
                          <p className="text-xs text-zinc-600">{lead.lot_size_sqft.toLocaleString()} sq ft lot</p>
                        )}
                      </div>

                      {/* Quote + time */}
                      <div className="text-right shrink-0">
                        {lead.quoted_amount ? (
                          <p className="text-xl font-bold text-green-400">${lead.quoted_amount}<span className="text-sm font-normal text-zinc-500">/mow</span></p>
                        ) : (
                          <p className="text-sm text-zinc-600">No quote yet</p>
                        )}
                        <p className="text-xs text-zinc-600 flex items-center justify-end gap-1 mt-0.5">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
                      <select
                        value={lead.status}
                        onChange={e => updateStatus(lead.id, e.target.value as Status)}
                        className="h-8 px-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs focus:outline-none focus:border-zinc-500"
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>

                      {!lead.quoted_amount && (
                        <Button size="sm" className="h-8 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
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
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      >
                        <ExternalLink size={11} /> Map
                      </a>

                      <Button size="sm" variant="ghost"
                        onClick={() => setExpandedId(expanded ? null : lead.id)}
                        className="h-8 px-3 text-xs ml-auto text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800">
                        {expanded ? '▲ Less' : '▼ Details'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {expanded && (
                    <div className="border-t border-zinc-800 bg-zinc-950/50 p-4 space-y-4">

                      {/* Drafted text */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Drafted Text Message</p>
                          <div className="flex items-center gap-2">
                            {lead.drafted_text && <CopyButton text={lead.drafted_text} />}
                            {lead.drafted_text && !lead.quote_sent_at && (
                              <Button size="sm" onClick={() => markSent(lead.id)}
                                className="h-7 px-2 text-xs gap-1 bg-green-700 hover:bg-green-600 text-white">
                                <Check size={11} /> Mark as Sent
                              </Button>
                            )}
                            {lead.quote_sent_at && (
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <Check size={11} /> Sent {formatDistanceToNow(new Date(lead.quote_sent_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        {lead.drafted_text ? (
                          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {lead.drafted_text}
                          </div>
                        ) : (
                          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 text-sm text-zinc-600 italic">
                            {lead.quoted_amount
                              ? 'No draft generated yet.'
                              : 'Generate a quote first to get the drafted message.'}
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Notes</p>
                        <textarea
                          rows={2}
                          placeholder="Add notes about this lead…"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600 transition-colors"
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
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
