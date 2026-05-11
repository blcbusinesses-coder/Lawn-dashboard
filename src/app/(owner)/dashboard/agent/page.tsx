'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Send, Paperclip, X, Loader2, ChevronDown, ChevronUp,
  Zap, RefreshCw, Volume2, VolumeX, Search, ArrowUpDown, Calendar,
} from 'lucide-react'
import type { MapLocation } from '@/components/agent/AgentMapView'

// Leaflet requires no-SSR
const AgentMapView = dynamic(() => import('@/components/agent/AgentMapView'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────
interface ToolCall   { tool: string; input: Record<string, unknown> }
interface ChartData  { type: 'chart'; title: string; chartType: 'bar' | 'line' | 'area'; xKey: string; yKeys: string[]; colors?: string[]; data: Record<string, unknown>[] }
interface TableData  { type: 'table'; title: string; columns: string[]; rows: string[][] }
interface MapData    { type: 'map';   title: string; locations: MapLocation[] }
type Visual = ChartData | TableData | MapData

interface Message {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  toolCalls?: ToolCall[]
  visuals?:  Visual[]
  imageUrl?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  query_customers: 'Looking up customers…', query_jobs: 'Fetching job data…',
  query_expenses: 'Checking expenses…', query_revenue: 'Pulling revenue…',
  query_properties: 'Loading properties…', query_employee_hours: 'Checking hours…',
  create_customer: 'Creating customer…', update_customer: 'Updating customer…',
  create_property: 'Adding property…', bulk_create_properties: 'Creating properties…',
  update_property: 'Updating property…', create_job_log: 'Logging job…',
  create_expense: 'Recording expense…', send_sms: 'Sending SMS…',
  generate_monthly_invoices: 'Generating invoices…', create_scheduled_task: 'Creating task…',
  list_scheduled_tasks: 'Loading tasks…', update_scheduled_task: 'Updating task…',
  list_one_off_jobs: 'Loading jobs…', create_one_off_job: 'Creating job…',
  complete_one_off_job: 'Completing job…',
  render_chart: 'Building chart…', render_table: 'Building table…', render_map: 'Building map…',
  web_search: 'Searching the web…',
}

const DEFAULT_COLORS = ['#06b6d4', '#3b82f6', '#a855f7', '#f97316', '#22c55e', '#ef4444']

const QUICK_PROMPTS = [
  'Morning briefing — what needs my attention today?',
  'Show revenue vs expenses as a chart for the last 3 months',
  'Show all active properties on a map',
  'Which customers haven\'t been mowed in 2+ weeks?',
  'Search: average lawn mowing prices in my area',
  'Generate invoices for last month',
]

// ── Voice (browser TTS) ───────────────────────────────────────────────────────
function speak(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const clean = text
    .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
    .replace(/\|/g, ',').replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  const utt = new SpeechSynthesisUtterance(clean)
  utt.rate = 1.0; utt.pitch = 1.0
  window.speechSynthesis.speak(utt)
}
function stopSpeak() { window.speechSynthesis?.cancel() }

// ── Visual renderers ──────────────────────────────────────────────────────────
function AgentChart({ v }: { v: ChartData }) {
  const colors = v.colors?.length ? v.colors : DEFAULT_COLORS
  return (
    <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">{v.title}</p>
      <ResponsiveContainer width="100%" height={200}>
        {v.chartType === 'line' ? (
          <LineChart data={v.data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey={v.xKey} tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} width={48} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {v.yKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />)}
          </LineChart>
        ) : v.chartType === 'area' ? (
          <AreaChart data={v.data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey={v.xKey} tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} width={48} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {v.yKeys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} fill={colors[i % colors.length] + '30'} strokeWidth={2} />)}
          </AreaChart>
        ) : (
          <BarChart data={v.data as Record<string, unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey={v.xKey} tick={{ fontSize: 11, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} width={48} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {v.yKeys.map((k, i) => <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function AgentTable({ v }: { v: TableData }) {
  const [sortCol, setSortCol]       = useState<number | null>(null)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter]         = useState('')
  const [page, setPage]             = useState(0)
  const PAGE_SIZE = 10

  const filtered = v.rows.filter(row =>
    !filter || row.some(cell => cell.toLowerCase().includes(filter.toLowerCase()))
  )
  const sorted = sortCol !== null
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol] ?? ''; const bv = b[sortCol] ?? ''
        const n = parseFloat(av) - parseFloat(bv)
        const cmp = isNaN(n) ? av.localeCompare(bv) : n
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  const pages = Math.ceil(sorted.length / PAGE_SIZE)
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(col: number) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(0)
  }

  return (
    <div className="mt-3 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{v.title}</p>
        <div className="flex items-center gap-2">
          <Search size={12} className="text-zinc-600" />
          <input
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(0) }}
            placeholder="Filter…"
            className="bg-transparent text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none w-32"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              {v.columns.map((col, i) => (
                <th key={i}
                  onClick={() => toggleSort(i)}
                  className="text-left px-3 py-2 text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col} <ArrowUpDown size={10} className={sortCol === i ? 'text-cyan-400' : 'opacity-30'} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, ri) => (
              <tr key={ri} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-zinc-300 whitespace-nowrap">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-zinc-500">
          <span>{filtered.length} rows</span>
          <div className="flex gap-1">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`w-5 h-5 rounded text-xs ${page === i ? 'bg-cyan-500 text-white' : 'hover:bg-white/10'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VisualRenderer({ visual }: { visual: Visual }) {
  if (visual.type === 'chart') return <AgentChart v={visual} />
  if (visual.type === 'table') return <AgentTable v={visual} />
  if (visual.type === 'map')   return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{visual.title}</p>
      <AgentMapView locations={visual.locations} />
    </div>
  )
  return null
}

// ── Tool call badge ───────────────────────────────────────────────────────────
function ToolCallBadge({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-2">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors">
        <Zap size={10} className="text-cyan-400" />
        {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''} used
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {toolCalls.map((t, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs font-mono">
              <span className="text-cyan-400 shrink-0">{t.tool}</span>
              <span className="text-zinc-600 truncate">{JSON.stringify(t.input)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Message components ────────────────────────────────────────────────────────
function AssistantMessage({ msg }: { msg: Message }) {
  const [speaking, setSpeaking] = useState(false)
  function toggleSpeak() {
    if (speaking) { stopSpeak(); setSpeaking(false) }
    else { speak(msg.content); setSpeaking(true) }
  }

  return (
    <div className="flex gap-3 max-w-4xl group">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-cyan-500/20">
        <Zap size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {msg.toolCalls && msg.toolCalls.length > 0 && <ToolCallBadge toolCalls={msg.toolCalls} />}

        <div className="prose prose-invert prose-sm max-w-none
          prose-p:text-zinc-200 prose-p:leading-relaxed prose-p:my-1
          prose-strong:text-white prose-headings:text-white
          prose-code:text-cyan-300 prose-code:bg-white/10 prose-code:px-1 prose-code:rounded prose-code:text-xs
          prose-table:text-xs prose-th:text-zinc-300 prose-th:border-b prose-th:border-white/20 prose-td:border-b prose-td:border-white/10
          prose-ul:text-zinc-300 prose-li:text-zinc-300 prose-li:my-0.5
          [&_table]:border-collapse [&_table]:w-full [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:px-3 [&_td]:py-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>

        {msg.visuals?.map((v, i) => <VisualRenderer key={i} visual={v} />)}

        <button onClick={toggleSpeak}
          className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-zinc-600 hover:text-cyan-400">
          {speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
          {speaking ? 'Stop' : 'Read aloud'}
        </button>
      </div>
    </div>
  )
}

function UserMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex gap-3 justify-end max-w-4xl ml-auto">
      <div className="max-w-lg">
        {msg.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={msg.imageUrl} alt="Attached" className="rounded-xl mb-1.5 max-h-48 object-cover border border-white/10" />
        )}
        <div className="bg-white/10 border border-white/10 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white">
          {msg.content}
        </div>
      </div>
    </div>
  )
}

function ThinkingIndicator({ activeTool }: { activeTool: string | null }) {
  return (
    <div className="flex gap-3 max-w-4xl">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
        <Zap size={13} className="text-white animate-pulse" />
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-400 pt-1.5">
        {activeTool ? (
          <><Loader2 size={12} className="animate-spin text-cyan-400" />
            <span className="text-xs text-cyan-400/80">{TOOL_LABELS[activeTool] ?? `${activeTool}…`}</span></>
        ) : (
          <div className="flex gap-1">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stream parser ─────────────────────────────────────────────────────────────
function parseStream(chunk: string, onTool: (t: ToolCall) => void, onVisual: (v: Visual) => void): string {
  let text = ''
  let remaining = chunk
  while (true) {
    const start = remaining.indexOf('\x00')
    if (start === -1) { text += remaining; break }
    text += remaining.slice(0, start)
    const end = remaining.indexOf('\x00', start + 1)
    if (end === -1) { text += remaining.slice(start); break }
    const event = remaining.slice(start + 1, end)
    if (event.startsWith('TOOL:')) {
      try { onTool(JSON.parse(event.slice(5))) } catch { /* ignore */ }
    } else if (event.startsWith('VISUAL:')) {
      try { onVisual(JSON.parse(event.slice(7))) } catch { /* ignore */ }
    }
    remaining = remaining.slice(end + 1)
  }
  return text
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [activeTool, setActiveTool]     = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [briefing, setBriefing]         = useState<{ text: string; date: string } | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [runningBriefing, setRunningBriefing] = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Load last proactive briefing
  useEffect(() => {
    fetch('/api/site-settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.wolf_last_briefing) {
          setBriefing({ text: data.wolf_last_briefing, date: data.wolf_briefing_date ?? '' })
        }
      })
      .catch(() => { /* ok */ })
  }, [])

  async function runManualBriefing() {
    setRunningBriefing(true)
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isProactive: true,
          messages: [{ role: 'user', content: 'Run the daily business health check and give me the morning briefing.' }],
        }),
      })
      if (!res.body) return
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true }).replace(/\x00[^\x00]*\x00/g, '')
      }
      setBriefing({ text: text.trim(), date: new Date().toISOString() })
      setBriefingOpen(true)
    } finally {
      setRunningBriefing(false)
    }
  }

  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText && !pendingImage) return
    if (loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: userText, imageUrl: pendingImage ?? undefined }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPendingImage(null)
    setLoading(true)
    setActiveTool(null)

    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
    const toolCalls: ToolCall[] = []
    const visuals:   Visual[]   = []

    try {
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      if (!res.body) throw new Error('No response body')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let finalText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const text = parseStream(
          buffer,
          (t) => {
            toolCalls.push({ tool: t.tool, input: t.input })
            setActiveTool(t.tool)
          },
          (v) => { visuals.push(v) }
        )
        buffer    = ''
        finalText += text
      }

      setActiveTool(null)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content:   finalText,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        visuals:   visuals.length   ? visuals   : undefined,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: `**Error:** ${err instanceof Error ? err.message : 'Something went wrong'}`,
      }])
    } finally {
      setLoading(false); setActiveTool(null)
    }
  }, [input, messages, loading, pendingImage])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900/50 to-zinc-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Zap size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Wolf</h1>
            <p className="text-xs text-zinc-600">AI Agent · Claude Sonnet · Real data</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {briefing && (
            <button onClick={() => setBriefingOpen(!briefingOpen)}
              className="flex items-center gap-1.5 text-xs bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 px-3 py-1.5 rounded-full transition-colors">
              <Calendar size={11} /> Morning Briefing
            </button>
          )}
          <button onClick={runManualBriefing} disabled={runningBriefing}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50">
            {runningBriefing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {runningBriefing ? 'Running…' : 'Run Briefing'}
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-zinc-700 hover:text-zinc-400 transition-colors">
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Briefing panel */}
      {briefingOpen && briefing && (
        <div className="relative z-10 mx-6 mt-3 bg-white/5 border border-cyan-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-cyan-400">Morning Briefing</p>
            <button onClick={() => setBriefingOpen(false)} className="text-zinc-600 hover:text-zinc-400"><X size={13} /></button>
          </div>
          <div className="prose prose-invert prose-xs max-w-none prose-p:text-zinc-300 prose-p:text-xs prose-strong:text-white prose-ul:text-zinc-300 prose-li:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing.text}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 shadow-2xl shadow-cyan-500/30">
              <Zap size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1.5">Wolf is ready</h2>
            <p className="text-zinc-600 text-sm max-w-xs mb-7 leading-relaxed">
              Ask anything, take action, or get a visual. Wolf sees all your data.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => sendMessage(p)}
                  className="text-left px-4 py-3 rounded-xl border border-white/8 hover:border-white/20 hover:bg-white/5 text-xs text-zinc-500 hover:text-zinc-200 transition-all leading-snug">
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg =>
            msg.role === 'user'
              ? <UserMessage key={msg.id} msg={msg} />
              : <AssistantMessage key={msg.id} msg={msg} />
          )
        )}
        {loading && <ThinkingIndicator activeTool={activeTool} />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="relative z-10 px-6 py-4 border-t border-white/5">
        {pendingImage && (
          <div className="mb-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage} alt="Pending" className="h-16 rounded-lg border border-white/10 object-cover" />
            <button onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700">
              <X size={10} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-cyan-500/30 transition-colors">
          <button onClick={() => fileRef.current?.click()} title="Attach image"
            className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mb-1.5">
            <Paperclip size={15} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const file = e.target.files?.[0]; if (!file) return
            const reader = new FileReader()
            reader.onload = ev => setPendingImage(ev.target?.result as string)
            reader.readAsDataURL(file)
          }} />
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Wolf anything — or tell it to take action…"
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-white placeholder-zinc-700 focus:outline-none min-h-[24px] max-h-36 overflow-y-auto py-1.5 leading-relaxed"
            onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 144) + 'px' }}
          />
          <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && !pendingImage)}
            className="shrink-0 mb-1 w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center disabled:opacity-30 hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
            {loading ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} className="text-white" />}
          </button>
        </div>
        <p className="text-center text-xs text-zinc-800 mt-1.5">Claude Sonnet · Charts · Maps · Tables · Voice · Web search</p>
      </div>
    </div>
  )
}
