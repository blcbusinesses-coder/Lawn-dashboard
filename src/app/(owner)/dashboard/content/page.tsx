'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Sparkles, RefreshCw, Copy } from 'lucide-react'

interface ContentIdea {
  title: string
  description: string
  best_time: string
  type: string
}

interface RepurposeResult {
  repurposed: string
  caption?: string
  hashtags?: string[]
}

const PLATFORMS = ['Facebook', 'Instagram', 'Instagram Reel', 'Google Business', 'Nextdoor']

export default function ContentPage() {
  const [tab, setTab] = useState<'ideas' | 'repurpose'>('ideas')

  // Ideas state
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('Facebook')
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)

  // Repurpose state
  const [original, setOriginal] = useState('')
  const [targetPlatform, setTargetPlatform] = useState('Instagram')
  const [result, setResult] = useState<RepurposeResult | null>(null)
  const [loadingRepurpose, setLoadingRepurpose] = useState(false)

  async function generateIdeas() {
    setLoadingIdeas(true)
    setIdeas([])
    try {
      const res = await fetch('/api/content/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platform }),
      })
      const data = await res.json()
      setIdeas(data.ideas ?? [])
    } catch {
      toast.error('Failed to generate ideas')
    }
    setLoadingIdeas(false)
  }

  async function repurpose() {
    if (!original.trim()) return toast.error('Paste some content first')
    setLoadingRepurpose(true)
    setResult(null)
    try {
      const res = await fetch('/api/content/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: original, targetPlatform }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      toast.error('Failed to repurpose content')
    }
    setLoadingRepurpose(false)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Content</h1>
        <p className="text-sm text-zinc-500 mt-1">Generate social media ideas and repurpose existing content</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-6">
        {(['ideas', 'repurpose'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              tab === t
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t === 'ideas' ? 'Content Ideas' : 'Repurpose Content'}
          </button>
        ))}
      </div>

      {tab === 'ideas' && (
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Topic (optional)</Label>
                <Input
                  placeholder="e.g. spring cleanup, lawn tips…"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Platform</Label>
                <select
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={generateIdeas} disabled={loadingIdeas} className="w-full sm:w-auto">
              <Sparkles size={14} className="mr-1.5" />
              {loadingIdeas ? 'Generating…' : 'Generate 5 Ideas'}
            </Button>
          </div>

          {loadingIdeas && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-zinc-200 rounded-xl p-5 animate-pulse">
                  <div className="h-4 bg-zinc-100 rounded w-48 mb-2" />
                  <div className="h-3 bg-zinc-100 rounded w-full mb-1" />
                  <div className="h-3 bg-zinc-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          )}

          {ideas.length > 0 && (
            <div className="space-y-3">
              {ideas.map((idea, i) => (
                <div key={i} className="bg-white border border-zinc-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-zinc-900 text-sm leading-snug">{idea.title}</h3>
                    <span className="shrink-0 text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{idea.type}</span>
                  </div>
                  <p className="text-sm text-zinc-600 mb-3">{idea.description}</p>
                  <p className="text-xs text-zinc-400">Best time: {idea.best_time}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'repurpose' && (
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <Label>Original content</Label>
              <Textarea
                placeholder="Paste a Facebook post, email, flyer text, or any content you want to adapt…"
                rows={5}
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Repurpose for</Label>
              <select
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm"
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <Button onClick={repurpose} disabled={loadingRepurpose} className="w-full sm:w-auto">
              <RefreshCw size={14} className={`mr-1.5 ${loadingRepurpose ? 'animate-spin' : ''}`} />
              {loadingRepurpose ? 'Rewriting…' : 'Repurpose'}
            </Button>
          </div>

          {result && (
            <div className="space-y-3">
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-800">Repurposed for {targetPlatform}</h3>
                  <button onClick={() => copy(result.repurposed)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                    <Copy size={14} />
                  </button>
                </div>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{result.repurposed}</p>
              </div>

              {result.caption && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-800">Short caption variant</h3>
                    <button onClick={() => copy(result.caption!)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-zinc-700">{result.caption}</p>
                </div>
              )}

              {result.hashtags && result.hashtags.length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-800">Suggested hashtags</h3>
                    <button onClick={() => copy(result.hashtags!.map((h) => `#${h}`).join(' '))} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                      <Copy size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.hashtags.map((tag) => (
                      <span key={tag} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
