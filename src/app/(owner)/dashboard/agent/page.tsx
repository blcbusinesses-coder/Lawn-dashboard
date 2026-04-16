'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

// A message can have text content or a mixed content array (text + image)
type MessageContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

interface Message {
  role: 'user' | 'assistant'
  content: MessageContent
}

interface Task {
  id: string
  title: string
  description: string | null
  trigger_type: string
  trigger_date: string | null
  status: 'pending' | 'done' | 'cancelled'
}

function messageText(content: MessageContent): string {
  if (typeof content === 'string') return content
  return content.filter((c) => c.type === 'text').map((c) => (c as { type: 'text'; text: string }).text).join(' ')
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null) // base64 data URL
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const loadTasks = useCallback(async () => {
    setTasksLoading(true)
    const res = await fetch('/api/tasks')
    if (res.ok) {
      const data = await res.json()
      setTasks(data.filter((t: Task) => t.status === 'pending'))
    }
    setTasksLoading(false)
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPendingImage(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  async function handleSend() {
    const text = input.trim()
    if ((!text && !pendingImage) || loading) return

    // Build user message content
    let userContent: MessageContent
    if (pendingImage) {
      const parts: MessageContent = []
      if (text) (parts as Array<unknown>).push({ type: 'text', text })
      ;(parts as Array<unknown>).push({ type: 'image_url', image_url: { url: pendingImage } })
      userContent = parts as MessageContent
    } else {
      userContent = text
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: userContent }]
    setMessages(newMessages)
    setInput('')
    setPendingImage(null)
    setLoading(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let reply = ''

      if (reader) {
        setMessages([...newMessages, { role: 'assistant', content: '' }])
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          reply += decoder.decode(value, { stream: true })
          setMessages([...newMessages, { role: 'assistant', content: reply }])
        }
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error: could not connect to agent.' }])
    }

    setLoading(false)
    // Refresh tasks after every message (agent may have created/updated tasks)
    loadTasks()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function completeTask(id: string) {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done' }),
    })
    loadTasks()
  }

  const SUGGESTIONS = [
    'How many lawns were mowed last month?',
    'What were my total expenses this month?',
    'Generate invoices for last month',
    'List all pending scheduled tasks',
  ]

  return (
    <div className="flex h-full gap-0">
      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-8 py-5 border-b border-zinc-200 bg-white">
          <h1 className="text-xl font-bold text-zinc-900">AI Agent</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Ask questions or give commands — I can read and write your business data</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center mt-12">
              <div className="text-4xl mb-3">🤖</div>
              <h2 className="text-lg font-semibold text-zinc-700 mb-2">Gray Wolf Agent</h2>
              <p className="text-sm text-zinc-500 mb-6">
                Ask questions, create customers and properties, send texts, generate invoices, or upload a photo of an address list.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-sm bg-white border border-zinc-200 rounded-lg px-3 py-2.5 hover:bg-zinc-50 hover:border-zinc-300 transition-colors text-zinc-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-zinc-900 text-white rounded-br-sm'
                    : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm'
                }`}
              >
                {/* Show embedded image previews */}
                {Array.isArray(msg.content) && msg.content.map((part, pi) =>
                  part.type === 'image_url' ? (
                    <img
                      key={pi}
                      src={(part as { type: 'image_url'; image_url: { url: string } }).image_url.url}
                      alt="uploaded"
                      className="max-w-xs rounded mb-1"
                    />
                  ) : (
                    <span key={pi}>{(part as { type: 'text'; text: string }).text}</span>
                  )
                )}
                {typeof msg.content === 'string' && (
                  msg.content || (msg.role === 'assistant' && loading && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : msg.content)
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-8 py-4 border-t border-zinc-200 bg-white">
          {/* Image preview */}
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2">
              <img src={pendingImage} alt="preview" className="h-16 w-16 object-cover rounded border border-zinc-200" />
              <button
                onClick={() => setPendingImage(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-none h-[60px] w-10 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-400 hover:text-zinc-600 transition-colors text-lg"
              title="Attach image"
            >
              📎
            </button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask or command… (Enter to send, Shift+Enter for new line)"
              rows={2}
              className="resize-none flex-1"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={loading || (!input.trim() && !pendingImage)}
              className="h-[60px] px-5"
            >
              Send
            </Button>
          </div>
          <p className="text-xs text-zinc-400 mt-1.5">GPT-4o with Vision · live Supabase data · full write access</p>
        </div>
      </div>

      {/* ── Tasks sidebar ──────────────────────────────────────────────── */}
      <div className="w-72 border-l border-zinc-200 flex flex-col bg-zinc-50 shrink-0">
        <div className="px-4 py-4 border-b border-zinc-200 bg-white flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800">Scheduled Tasks</h2>
          {tasks.length > 0 && (
            <Badge variant="secondary">{tasks.length}</Badge>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tasksLoading ? (
            <p className="text-xs text-zinc-400 text-center mt-4">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center mt-4">No pending tasks</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg border border-zinc-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                    {task.trigger_date && (
                      <p className="text-xs text-zinc-400 mt-1">{task.trigger_date}</p>
                    )}
                    <Badge variant="outline" className="text-xs mt-1">{task.trigger_type}</Badge>
                  </div>
                  <button
                    onClick={() => completeTask(task.id)}
                    className="flex-none text-xs text-zinc-400 hover:text-green-600 transition-colors mt-0.5"
                    title="Mark done"
                  >
                    ✓
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-zinc-200">
          <button
            onClick={() => setInput('Create a reminder: ')}
            className="w-full text-xs text-zinc-500 hover:text-zinc-700 text-left px-2 py-1.5 rounded hover:bg-zinc-100 transition-colors"
          >
            + Ask agent to create a task…
          </button>
        </div>
      </div>
    </div>
  )
}
