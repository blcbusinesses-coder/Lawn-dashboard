'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Paperclip, X, Loader2, ChevronDown, ChevronUp, Zap, RefreshCw } from 'lucide-react'

interface ToolCall {
  tool: string
  input: Record<string, unknown>
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  imageUrl?: string
}

const TOOL_LABELS: Record<string, string> = {
  query_customers:          'Looking up customers…',
  query_jobs:               'Fetching job data…',
  query_expenses:           'Checking expenses…',
  query_revenue:            'Pulling revenue…',
  query_properties:         'Loading properties…',
  query_employee_hours:     'Checking employee hours…',
  create_customer:          'Creating customer…',
  update_customer:          'Updating customer…',
  create_property:          'Adding property…',
  bulk_create_properties:   'Creating properties…',
  update_property:          'Updating property…',
  create_job_log:           'Logging job…',
  create_expense:           'Recording expense…',
  send_sms:                 'Sending SMS…',
  generate_monthly_invoices:'Generating invoices…',
  create_scheduled_task:    'Creating task…',
  list_scheduled_tasks:     'Loading tasks…',
  update_scheduled_task:    'Updating task…',
  list_one_off_jobs:        'Loading one-off jobs…',
  create_one_off_job:       'Creating one-off job…',
  complete_one_off_job:     'Completing job…',
}

const QUICK_PROMPTS = [
  'How much revenue did we make this month?',
  'Show me all active properties',
  'Which customers haven\'t been mowed in 2 weeks?',
  'What are our expenses this month by category?',
  'Who are our top 5 customers by revenue?',
  'Generate invoices for last month',
]

function ToolCallBadge({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
      >
        <Zap size={11} className="text-cyan-400" />
        Used {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''}
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {toolCalls.map((t, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg px-2.5 py-1.5 text-xs font-mono">
              <span className="text-cyan-400 shrink-0">{t.tool}</span>
              <span className="text-zinc-500 truncate">{JSON.stringify(t.input)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssistantMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex gap-3 max-w-4xl">
      {/* Wolf avatar */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-cyan-500/20">
        <Zap size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <ToolCallBadge toolCalls={msg.toolCalls} />
        )}
        <div className="prose prose-invert prose-sm max-w-none
          prose-p:text-zinc-200 prose-p:leading-relaxed
          prose-strong:text-white prose-strong:font-semibold
          prose-headings:text-white prose-headings:font-semibold
          prose-code:text-cyan-300 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
          prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
          prose-table:text-sm prose-th:text-zinc-300 prose-th:font-semibold prose-th:border-b prose-th:border-white/20 prose-td:border-b prose-td:border-white/10 prose-td:text-zinc-300
          prose-ul:text-zinc-300 prose-li:text-zinc-300
          prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
          [&_table]:border-collapse [&_table]:w-full [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:px-3 [&_td]:py-2
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
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
        <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white">
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
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        {activeTool ? (
          <>
            <Loader2 size={13} className="animate-spin text-cyan-400" />
            <span className="text-cyan-400/80">{TOOL_LABELS[activeTool] ?? `Running ${activeTool}…`}</span>
          </>
        ) : (
          <div className="flex gap-1 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentPage() {
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleImageAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPendingImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText && !pendingImage) return
    if (loading) return

    const userMsg: Message = {
      id:       crypto.randomUUID(),
      role:     'user',
      content:  userText,
      imageUrl: pendingImage ?? undefined,
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPendingImage(null)
    setLoading(true)
    setActiveTool(null)

    // Build payload for API
    const apiMessages = newMessages.map(m => ({
      role:    m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiMessages }),
      })

      if (!res.body) throw new Error('No response body')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      const toolCalls: ToolCall[] = []
      let finalText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse out tool call events (delimited by \x00TOOL:...\x00)
        let processed = ''
        let i = 0
        while (i < buffer.length) {
          const toolStart = buffer.indexOf('\x00TOOL:', i)
          if (toolStart === -1) {
            processed += buffer.slice(i)
            i = buffer.length
          } else {
            processed += buffer.slice(i, toolStart)
            const toolEnd = buffer.indexOf('\x00', toolStart + 1)
            if (toolEnd === -1) {
              // Incomplete tool event — keep in buffer
              buffer = buffer.slice(toolStart)
              i = buffer.length
              break
            }
            const toolJson = buffer.slice(toolStart + 6, toolEnd)
            try {
              const parsed = JSON.parse(toolJson)
              toolCalls.push({ tool: parsed.tool, input: parsed.input })
              setActiveTool(parsed.tool)
            } catch { /* ignore parse errors */ }
            i = toolEnd + 1
          }
        }
        if (i === buffer.length) buffer = ''

        finalText += processed
      }

      setActiveTool(null)
      const assistantMsg: Message = {
        id:       crypto.randomUUID(),
        role:     'assistant',
        content:  finalText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setMessages(prev => [...prev, {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: `**Error:** ${err instanceof Error ? err.message : 'Something went wrong'}`,
      }])
    } finally {
      setLoading(false)
      setActiveTool(null)
    }
  }, [input, messages, loading, pendingImage])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Zap size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Wolf</h1>
            <p className="text-xs text-zinc-500">AI Business Agent · Claude Sonnet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-zinc-500">Active</span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="ml-2 text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Clear conversation"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-5 shadow-2xl shadow-cyan-500/30">
              <Zap size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Wolf is ready</h2>
            <p className="text-zinc-500 text-sm max-w-sm mb-8 leading-relaxed">
              Your AI business agent. Ask anything about your customers, jobs, money, or tell Wolf to take action.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-sm text-zinc-400 hover:text-zinc-200 transition-all"
                >
                  {prompt}
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

      {/* Input area */}
      <div className="relative z-10 px-6 py-4 border-t border-white/5">
        {pendingImage && (
          <div className="mb-2 relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage} alt="Pending" className="h-16 rounded-lg border border-white/10 object-cover" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-zinc-700 rounded-full flex items-center justify-center hover:bg-zinc-600"
            >
              <X size={10} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-cyan-500/40 transition-colors">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 mb-1.5"
            title="Attach image"
          >
            <Paperclip size={16} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageAttach} />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Wolf anything about your business…"
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-white placeholder-zinc-600 focus:outline-none min-h-[24px] max-h-36 overflow-y-auto py-1.5 leading-relaxed"
            style={{ height: 'auto' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 144) + 'px'
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || (!input.trim() && !pendingImage)}
            className="shrink-0 mb-1 w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center disabled:opacity-30 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            {loading
              ? <Loader2 size={13} className="animate-spin text-white" />
              : <Send size={13} className="text-white" />
            }
          </button>
        </div>
        <p className="text-center text-xs text-zinc-700 mt-2">Claude Sonnet · Real business data · Can take actions</p>
      </div>
    </div>
  )
}
