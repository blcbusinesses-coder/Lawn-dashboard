'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Send, Loader2, History, Plus, X, Search, ArrowUpDown, Volume2, VolumeX } from 'lucide-react'
import type { MapLocation } from '@/components/agent/AgentMapView'

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
}

interface StoredChat {
  id:        string
  title:     string
  createdAt: string
  messages:  Message[]
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const genId  = () => Math.random().toString(36).slice(2, 10)
const delay  = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const COLORS = ['#06b6d4', '#3b82f6', '#a855f7', '#f97316', '#22c55e', '#ef4444']

const TOOL_LABELS: Record<string, string> = {
  query_customers: 'Checking customers…', query_jobs: 'Fetching jobs…',
  query_expenses: 'Reviewing expenses…', query_revenue: 'Pulling revenue…',
  query_properties: 'Loading properties…', query_employee_hours: 'Checking hours…',
  create_customer: 'Creating customer…', update_customer: 'Updating customer…',
  create_property: 'Adding property…', bulk_create_properties: 'Creating properties…',
  update_property: 'Updating property…', create_job_log: 'Logging job…',
  create_expense: 'Recording expense…', send_sms: 'Sending SMS…',
  generate_monthly_invoices: 'Generating invoices…', create_scheduled_task: 'Creating task…',
  list_scheduled_tasks: 'Loading tasks…', update_scheduled_task: 'Updating task…',
  list_one_off_jobs: 'Loading jobs…', create_one_off_job: 'Creating job…',
  complete_one_off_job: 'Completing job…',
  render_chart: 'Building chart…', render_table: 'Building table…',
  render_map: 'Mapping locations…', web_search: 'Searching web…',
}

// ── localStorage ──────────────────────────────────────────────────────────────
function getStoredChats(): StoredChat[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem('wolfChats') || '[]') } catch { return [] }
}
function saveStoredChat(chat: StoredChat) {
  if (typeof window === 'undefined') return
  const all = getStoredChats()
  const idx = all.findIndex(c => c.id === chat.id)
  if (idx >= 0) all[idx] = chat; else all.unshift(chat)
  localStorage.setItem('wolfChats', JSON.stringify(all.slice(0, 50)))
}

// ── Stream parser ─────────────────────────────────────────────────────────────
function parseStream(raw: string) {
  const tools: ToolCall[] = []; const visuals: Visual[] = []
  const re = /\x00(TOOL|VISUAL):([^\x00]*)\x00/g; let m
  while ((m = re.exec(raw)) !== null) {
    try { const d = JSON.parse(m[2]); m[1] === 'TOOL' ? tools.push(d) : visuals.push(d) } catch { /**/ }
  }
  return { text: raw.replace(/\x00(TOOL|VISUAL):[^\x00]*\x00/g, ''), tools, visuals }
}

// ── Strip markdown for ambient display ───────────────────────────────────────
function stripMarkdown(line: string): string {
  return line
    .replace(/#{1,6}\s*/g, '')           // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
    .replace(/\*([^*]+)\*/g, '$1')       // italic markers
    .replace(/`([^`]+)`/g, '$1')         // inline code
    .replace(/^[-*+]\s+/, '')            // bullet points
    .replace(/^\d+\.\s+/, '')            // numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text only
    .trim()
}

// ── Voice ─────────────────────────────────────────────────────────────────────
function speak(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const clean = text.replace(/\*\*/g,'').replace(/\*/g,'').replace(/#{1,6}\s/g,'').replace(/`/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
  const utt = new SpeechSynthesisUtterance(clean)
  window.speechSynthesis.speak(utt)
}
function stopSpeak() { window.speechSynthesis?.cancel() }

// ── Visual sub-components ─────────────────────────────────────────────────────
function AgentChart({ v }: { v: ChartData }) {
  const cols = v.colors?.length ? v.colors : COLORS
  return (
    <div className="bg-white/5 border border-white/[0.07] rounded-2xl p-4">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">{v.title}</p>
      <ResponsiveContainer width="100%" height={170}>
        {v.chartType === 'line' ? (
          <LineChart data={v.data as Record<string,unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
            <XAxis dataKey={v.xKey} tick={{ fontSize:10, fill:'#52525b' }} />
            <YAxis tick={{ fontSize:10, fill:'#52525b' }} width={38} />
            <Tooltip contentStyle={{ background:'#09090b', border:'1px solid #ffffff15', borderRadius:8, fontSize:11 }} />
            <Legend wrapperStyle={{ fontSize:10 }} />
            {v.yKeys.map((k,i) => <Line key={k} type="monotone" dataKey={k} stroke={cols[i%cols.length]} strokeWidth={2} dot={{ r:2 }} />)}
          </LineChart>
        ) : v.chartType === 'area' ? (
          <AreaChart data={v.data as Record<string,unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
            <XAxis dataKey={v.xKey} tick={{ fontSize:10, fill:'#52525b' }} />
            <YAxis tick={{ fontSize:10, fill:'#52525b' }} width={38} />
            <Tooltip contentStyle={{ background:'#09090b', border:'1px solid #ffffff15', borderRadius:8, fontSize:11 }} />
            <Legend wrapperStyle={{ fontSize:10 }} />
            {v.yKeys.map((k,i) => <Area key={k} type="monotone" dataKey={k} stroke={cols[i%cols.length]} fill={cols[i%cols.length]+'20'} strokeWidth={2} />)}
          </AreaChart>
        ) : (
          <BarChart data={v.data as Record<string,unknown>[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
            <XAxis dataKey={v.xKey} tick={{ fontSize:10, fill:'#52525b' }} />
            <YAxis tick={{ fontSize:10, fill:'#52525b' }} width={38} />
            <Tooltip contentStyle={{ background:'#09090b', border:'1px solid #ffffff15', borderRadius:8, fontSize:11 }} />
            <Legend wrapperStyle={{ fontSize:10 }} />
            {v.yKeys.map((k,i) => <Bar key={k} dataKey={k} fill={cols[i%cols.length]} radius={[3,3,0,0]} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function AgentTable({ v }: { v: TableData }) {
  const [sortCol, setSortCol] = useState<number|null>(null)
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [filter, setFilter]   = useState('')
  const [page, setPage]       = useState(0)
  const PG = 8

  const filtered = v.rows.filter(r => !filter || r.some(c => c.toLowerCase().includes(filter.toLowerCase())))
  const sorted   = sortCol !== null
    ? [...filtered].sort((a,b) => {
        const av=a[sortCol]??''; const bv=b[sortCol]??''
        const n=parseFloat(av)-parseFloat(bv)
        return (sortDir==='asc'?1:-1)*(isNaN(n)?av.localeCompare(bv):n)
      })
    : filtered
  const pages   = Math.ceil(sorted.length/PG)
  const visible = sorted.slice(page*PG,(page+1)*PG)

  function toggleSort(i:number){ if(sortCol===i)setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortCol(i);setSortDir('asc')} ; setPage(0) }

  return (
    <div className="bg-white/5 border border-white/[0.07] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07]">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{v.title}</p>
        <div className="flex items-center gap-1">
          <Search size={10} className="text-white/20" />
          <input value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}} placeholder="filter…"
            className="bg-transparent text-xs text-white/60 placeholder-white/20 focus:outline-none w-28" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {v.columns.map((col,i) => (
                <th key={i} onClick={()=>toggleSort(i)}
                  className="text-left px-3 py-2 text-white/25 font-medium cursor-pointer hover:text-white/60 select-none whitespace-nowrap">
                  <span className="flex items-center gap-1">{col}<ArrowUpDown size={9} className={sortCol===i?'text-cyan-400':'opacity-20'}/></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row,ri) => (
              <tr key={ri} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                {row.map((cell,ci) => <td key={ci} className="px-3 py-2 text-white/75 whitespace-nowrap">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages>1 && (
        <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/[0.07] text-[10px] text-white/25">
          <span>{filtered.length} rows</span>
          <div className="flex gap-1">
            {Array.from({length:pages},(_,i)=>(
              <button key={i} onClick={()=>setPage(i)} className={`w-5 h-5 rounded ${page===i?'bg-white/15 text-white':'hover:bg-white/[0.07]'}`}>{i+1}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Visuals({ visuals }: { visuals: Visual[] }) {
  if (!visuals.length) return null
  return (
    <div className="mt-8 w-full max-w-2xl mx-auto flex flex-col gap-4">
      {visuals.map((v,i) => (
        <div key={i}>
          {v.type==='chart' && <AgentChart v={v} />}
          {v.type==='table' && <AgentTable v={v} />}
          {v.type==='map'   && (
            <div className="bg-white/5 border border-white/[0.07] rounded-2xl overflow-hidden">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-4 pt-3 pb-2">{v.title}</p>
              <AgentMapView locations={v.locations} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Wolf SVG (geometric pencil-style) ─────────────────────────────────────────
function WolfSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} fill="none" stroke="currentColor"
      strokeLinecap="round" strokeLinejoin="round">
      {/* Head */}
      <path d="M55 188 L28 122 L36 68 L62 44 L100 32 L138 44 L164 68 L172 122 L145 188Z" strokeWidth="1.4"/>
      {/* Left ear */}
      <path d="M36 68 L18 5 L72 50Z" strokeWidth="1.4"/>
      {/* Right ear */}
      <path d="M164 68 L182 5 L128 50Z" strokeWidth="1.4"/>
      {/* Left inner ear */}
      <path d="M40 65 L26 18 L66 52Z" strokeWidth="0.7" opacity="0.35"/>
      {/* Right inner ear */}
      <path d="M160 65 L174 18 L134 52Z" strokeWidth="0.7" opacity="0.35"/>
      {/* Left eye — diamond */}
      <path d="M59 85 L74 71 L89 85 L74 97Z" strokeWidth="1.2"/>
      <circle cx="74" cy="85" r="3.5" fill="currentColor"/>
      {/* Right eye — diamond */}
      <path d="M111 85 L126 71 L141 85 L126 97Z" strokeWidth="1.2"/>
      <circle cx="126" cy="85" r="3.5" fill="currentColor"/>
      {/* Nose */}
      <path d="M92 132 L100 121 L108 132 L100 138Z" strokeWidth="1.2"/>
      {/* Muzzle centre line */}
      <line x1="100" y1="138" x2="100" y2="150" strokeWidth="1" opacity="0.65"/>
      {/* Mouth */}
      <path d="M80 150 Q100 163 120 150" strokeWidth="1.2"/>
      {/* Brows */}
      <path d="M51 77 L69 65" strokeWidth="0.9" opacity="0.45"/>
      <path d="M131 65 L149 77" strokeWidth="0.9" opacity="0.45"/>
      {/* Forehead V */}
      <path d="M87 52 L100 44 L113 52" strokeWidth="0.7" opacity="0.28"/>
      {/* Cheek fur – left */}
      <path d="M36 112 L52 106" strokeWidth="0.5" opacity="0.22"/>
      <path d="M34 123 L50 118" strokeWidth="0.5" opacity="0.22"/>
      {/* Cheek fur – right */}
      <path d="M148 106 L164 112" strokeWidth="0.5" opacity="0.22"/>
      <path d="M150 118 L166 123" strokeWidth="0.5" opacity="0.22"/>
      {/* Snout outline */}
      <path d="M78 118 L82 156 L100 163 L118 156 L122 118" strokeWidth="0.65" opacity="0.25"/>
    </svg>
  )
}

// ── Star field ────────────────────────────────────────────────────────────────
function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: 65 }, (_, i) => ({
      id: i,
      left: `${Math.random()*100}%`,
      top:  `${Math.random()*100}%`,
      size: `${Math.random()*1.8+0.4}px`,
      op:   Math.random()*0.45+0.05,
      dur:  `${Math.random()*5+3}s`,
      del:  `${Math.random()*5}s`,
    })), []
  )
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map(s => (
        <div key={s.id} style={{
          position:'absolute', left:s.left, top:s.top,
          width:s.size, height:s.size, borderRadius:'50%',
          background:'white', opacity:s.op,
          animation:`wolf-twinkle ${s.dur} ${s.del} infinite alternate ease-in-out`,
        }}/>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [phase, setPhase]               = useState<'idle'|'active'>('idle')
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)

  // Cinematic text display
  const [displayText, setDisplayText]   = useState('')
  const [displayType, setDisplayType]   = useState<'question'|'answer'>('question')
  const [displayVisible, setDisplayVisible] = useState(false)
  const [toolStatus, setToolStatus]     = useState('')

  // Visuals
  const [currentVisuals, setCurrentVisuals] = useState<Visual[]>([])

  // Line-by-line reveal
  const [revealLines, setRevealLines]   = useState<string[]>([])
  const [isRevealing, setIsRevealing]   = useState(false)

  // Voice
  const [speaking, setSpeaking]         = useState(false)

  // History
  const [showHistory, setShowHistory]   = useState(false)
  const [storedChats, setStoredChats]   = useState<StoredChat[]>([])

  // Briefing
  const [briefing, setBriefing]         = useState<{ text: string; date: string } | null>(null)

  const sessionIdRef = useRef<string>(genId())
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)

  // Load morning briefing
  useEffect(() => {
    fetch('/api/site-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.wolf_last_briefing) setBriefing({ text: d.wolf_last_briefing, date: d.wolf_briefing_date||'' }) })
      .catch(() => {})
  }, [])

  // Escape key → new chat
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && phase === 'active') handleNewChat() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function activate() {
    setPhase('active')
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  function handleNewChat() {
    stopSpeak(); setSpeaking(false)
    sessionIdRef.current = genId()
    setMessages([]); setDisplayText(''); setDisplayVisible(false)
    setCurrentVisuals([]); setToolStatus('')
    setRevealLines([]); setIsRevealing(false)
    setPhase('idle')
  }

  function openHistory() {
    setStoredChats(getStoredChats()); setShowHistory(true)
  }

  function loadChat(chat: StoredChat) {
    sessionIdRef.current = chat.id
    setMessages(chat.messages)
    setPhase('active')
    setShowHistory(false)
    const last = [...chat.messages].reverse().find(m => m.role === 'assistant')
    if (last) {
      setDisplayType('answer')
      setDisplayText(last.content)
      setCurrentVisuals(last.visuals || [])
      // Populate all lines at once — no stagger when loading history
      const lines = last.content.split('\n').map(l => l.trim()).filter(Boolean)
      setRevealLines(lines)
      setIsRevealing(false)
      setDisplayVisible(true)
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    if (phase === 'idle') { setPhase('active') }
    setTimeout(() => inputRef.current?.focus(), 80)

    const userMessage: Message = { id: genId(), role: 'user', content: userMsg }
    const allMessages = [...messages, userMessage]
    setMessages(allMessages)

    // Clear previous answer and show question
    setRevealLines([])
    setIsRevealing(false)
    setDisplayType('question')
    setDisplayText(userMsg)
    setDisplayVisible(true)
    setLoading(true)
    setCurrentVisuals([])
    setToolStatus('')

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      })
      if (!res.body) throw new Error('No stream')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText       = ''
      let pendingVisuals: Visual[]   = []
      let pendingTools:   ToolCall[] = []
      let questionFaded  = false

      // Collect the full response silently — we'll reveal it line-by-line at the end
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const { text, tools, visuals } = parseStream(decoder.decode(value, { stream: true }))

        if (tools.length)   { pendingTools   = [...pendingTools,   ...tools];   setToolStatus(TOOL_LABELS[tools[0].tool] || 'Working…') }
        if (visuals.length) { pendingVisuals = [...pendingVisuals, ...visuals]; setCurrentVisuals([...pendingVisuals]) }

        if (text) {
          fullText += text
          // On first text: fade out the question and switch to answer/dots mode
          if (!questionFaded) {
            questionFaded = true
            setDisplayVisible(false)
            await delay(380)
            setDisplayType('answer')
            setToolStatus('')
            if (scrollRef.current) scrollRef.current.scrollTop = 0
          }
        }
      }

      // Streaming done — store full text and reveal line by line
      setDisplayText(fullText)
      setLoading(false)
      setToolStatus('')

      const assistantMsg: Message = {
        id: genId(), role: 'assistant', content: fullText,
        toolCalls: pendingTools.length   ? pendingTools   : undefined,
        visuals:   pendingVisuals.length ? pendingVisuals : undefined,
      }
      const finalMessages = [...allMessages, assistantMsg]
      setMessages(finalMessages)
      saveStoredChat({
        id: sessionIdRef.current,
        title: userMsg.slice(0, 65),
        createdAt: new Date().toISOString(),
        messages: finalMessages,
      })

      // Line-by-line reveal
      if (fullText) {
        const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
        // Stagger: faster for longer responses so it doesn't drag on
        const stagger = lines.length <= 6 ? 210 : lines.length <= 14 ? 155 : 100
        setIsRevealing(true)
        for (let i = 0; i < lines.length; i++) {
          await delay(i === 0 ? 80 : stagger)
          setRevealLines(prev => [...prev, lines[i]])
        }
        setIsRevealing(false)
      }

    } catch (err) {
      setLoading(false); setToolStatus('')
      // Show error as a single fading line
      const errText = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      setDisplayVisible(false)
      await delay(200)
      setDisplayType('answer')
      setDisplayText(errText)
      setRevealLines([errText])
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe for star twinkle — injected once */}
      <style>{`
        @keyframes wolf-twinkle {
          from { opacity: var(--op-from, 0.05); }
          to   { opacity: var(--op-to,   0.55); }
        }
        @keyframes wolf-line-in {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wolf-line-enter { animation: wolf-line-in 0.9s ease both; }
        .wolf-scrollbar-none::-webkit-scrollbar { display: none; }
        .wolf-scrollbar-none { scrollbar-width: none; }
      `}</style>

      {/* Full-panel takeover — sits inside the <main> and expands to fill it */}
      <div className="relative flex flex-col bg-black overflow-hidden" style={{ height: '100%', minHeight: '100vh' }}>

        <StarField />

        {/* ── IDLE: Wolf symbol ─────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 z-10 px-6">
            <button
              onClick={activate}
              className="group flex flex-col items-center gap-7 cursor-pointer"
              aria-label="Start talking to Wolf"
            >
              <div className="relative">
                {/* Soft glow */}
                <div className="absolute inset-0 scale-150 blur-3xl rounded-full bg-white/[0.04] animate-pulse" />
                <WolfSVG className="w-44 h-44 text-white/85 relative z-10 transition-all duration-700 group-hover:scale-[1.04] group-hover:text-white" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-white/35 text-[11px] tracking-[0.45em] uppercase">Wolf</p>
                <p className="text-white/18 text-xs tracking-wide">tap to begin</p>
              </div>
            </button>

            {briefing && (
              <button
                onClick={activate}
                className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
              >
                <span>☀️</span>
                <span className="text-white/35 text-xs">Morning briefing ready</span>
              </button>
            )}
          </div>
        )}

        {/* ── ACTIVE: cinematic chat ────────────────────────────────────── */}
        {phase === 'active' && (
          <>
            {/* Top-right controls */}
            <div className="absolute top-4 right-5 z-20 flex items-center gap-2">
              {/* Voice */}
              <button
                onClick={() => {
                  if (speaking) { stopSpeak(); setSpeaking(false) }
                  else if (displayText && displayType === 'answer') { speak(displayText); setSpeaking(true) }
                }}
                title={speaking ? 'Stop' : 'Read aloud'}
                className="w-8 h-8 rounded-full border border-white/[0.09] flex items-center justify-center hover:bg-white/[0.06] transition-colors"
              >
                {speaking
                  ? <VolumeX size={12} className="text-white/50" />
                  : <Volume2  size={12} className="text-white/25" />}
              </button>

              {/* History */}
              <button
                onClick={openHistory}
                title="Chat history"
                className="w-8 h-8 rounded-full border border-white/[0.09] flex items-center justify-center hover:bg-white/[0.06] transition-colors"
              >
                <History size={12} className="text-white/25" />
              </button>

              {/* New chat */}
              <button
                onClick={handleNewChat}
                title="New chat (Esc)"
                className="w-8 h-8 rounded-full border border-white/[0.09] flex items-center justify-center hover:bg-white/[0.06] transition-colors"
              >
                <Plus size={12} className="text-white/25" />
              </button>
            </div>

            {/* Scrollable content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto wolf-scrollbar-none z-10">
              <div className="min-h-full flex flex-col items-center justify-center px-6 pt-16 pb-36">

                {/* Question — fades in, then fades out */}
                {displayType === 'question' && displayText && (
                  <div
                    className="w-full max-w-2xl"
                    style={{ opacity: displayVisible ? 1 : 0, transition: 'opacity 420ms ease' }}
                  >
                    <p className="text-white/40 text-lg italic text-center leading-relaxed tracking-wide">
                      &ldquo;{displayText}&rdquo;
                    </p>
                  </div>
                )}

                {/* Loading dots — shown while streaming (answer mode, no lines yet) */}
                {displayType === 'answer' && (loading || isRevealing) && revealLines.length === 0 && (
                  <div className="flex gap-2 justify-center">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                )}

                {/* Answer — lines fade in one by one, styled like the question */}
                {displayType === 'answer' && revealLines.length > 0 && (
                  <div className="w-full max-w-2xl text-center space-y-1">
                    {revealLines.map((line, i) => (
                      <div key={i} className="wolf-line-enter">
                        <p className="text-white/62 text-lg italic font-serif leading-loose tracking-wide">
                          {stripMarkdown(line)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visuals — appear after text */}
                {displayType === 'answer' && currentVisuals.length > 0 && revealLines.length > 0 && (
                  <Visuals visuals={currentVisuals} />
                )}
              </div>
            </div>

            {/* Input bar — pinned to bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-20">
              {/* Gradient fade */}
              <div className="h-12 bg-gradient-to-t from-black/95 to-transparent pointer-events-none" />
              <div className="bg-black/95 px-4 pb-5 pt-1">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3">
                    {/* Read aloud — always visible on mobile */}
                    <button
                      onClick={() => {
                        if (speaking) { stopSpeak(); setSpeaking(false) }
                        else if (displayText && displayType === 'answer') { speak(displayText); setSpeaking(true) }
                      }}
                      disabled={displayType !== 'answer' || !displayText || loading}
                      title={speaking ? 'Stop reading' : 'Read aloud'}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-20"
                    >
                      {speaking
                        ? <VolumeX size={14} className="text-white/70" />
                        : <Volume2  size={14} className="text-white/40" />}
                    </button>

                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); autoResize(e.target) }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder="Ask Wolf anything…"
                      rows={1}
                      className="flex-1 bg-transparent text-white text-sm placeholder-white/20 resize-none focus:outline-none leading-relaxed"
                      style={{ maxHeight: 120, overflowY: 'auto' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={loading || !input.trim()}
                      className="w-8 h-8 rounded-xl bg-white/[0.08] hover:bg-white/15 flex items-center justify-center transition-colors disabled:opacity-25 shrink-0"
                    >
                      {loading
                        ? <Loader2 size={13} className="text-white animate-spin" />
                        : <Send    size={13} className="text-white" />}
                    </button>
                  </div>

                  {/* Tool status */}
                  {toolStatus && (
                    <p className="text-center text-white/22 text-[11px] mt-2 tracking-wide">{toolStatus}</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── History overlay ─────────────────────────────────────────────── */}
        {showHistory && (
          <div
            className="absolute inset-0 z-50 flex items-start justify-center pt-12 px-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowHistory(false) }}
          >
            <div className="w-full max-w-sm bg-black/90 border border-white/[0.09] rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
                <p className="text-white/70 text-sm font-medium tracking-wide">History</p>
                <button onClick={() => setShowHistory(false)}>
                  <X size={14} className="text-white/30 hover:text-white/70 transition-colors" />
                </button>
              </div>

              <div className="overflow-y-auto wolf-scrollbar-none max-h-[60vh]">
                {storedChats.length === 0 ? (
                  <p className="text-white/25 text-sm text-center py-10">No saved chats yet</p>
                ) : (
                  storedChats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => loadChat(chat)}
                      className="w-full text-left px-5 py-3 border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors"
                    >
                      <p className="text-white/75 text-sm truncate">{chat.title}</p>
                      <p className="text-white/25 text-xs mt-0.5">
                        {new Date(chat.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                        {' · '}{chat.messages.length} messages
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="px-5 py-3 border-t border-white/[0.07]">
                <button
                  onClick={() => { setShowHistory(false); handleNewChat() }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.09] hover:bg-white/[0.04] transition-colors"
                >
                  <Plus size={13} className="text-white/30" />
                  <span className="text-white/40 text-sm">New chat</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
