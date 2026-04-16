'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type MessageContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

interface Message {
  role: 'user' | 'assistant'
  content: MessageContent
}

export default function EmployeeAgentPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPendingImage(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSend() {
    const text = input.trim()
    if ((!text && !pendingImage) || loading) return

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
      setMessages([...newMessages, { role: 'assistant', content: 'Error connecting to agent.' }])
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-zinc-200 bg-white">
        <h1 className="text-lg font-bold text-zinc-900">Agent</h1>
        <p className="text-sm text-zinc-500">Ask questions about your jobs</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <div className="text-3xl mb-2">🤖</div>
            <p className="text-sm text-zinc-500">Ask me about jobs, schedules, or anything else.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-lg rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white rounded-br-sm'
                  : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm'
              }`}
            >
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
                msg.content || (loading && i === messages.length - 1 ? '…' : msg.content)
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-6 py-4 border-t border-zinc-200 bg-white">
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2">
            <img src={pendingImage} alt="preview" className="h-14 w-14 object-cover rounded border border-zinc-200" />
            <button onClick={() => setPendingImage(null)} className="text-xs text-zinc-400 hover:text-zinc-600">Remove</button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-none h-[52px] w-9 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-400 hover:text-zinc-600 transition-colors"
            title="Attach image"
          >
            📎
          </button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask something…"
            rows={2}
            className="resize-none flex-1"
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || (!input.trim() && !pendingImage)}>Send</Button>
        </div>
      </div>
    </div>
  )
}
