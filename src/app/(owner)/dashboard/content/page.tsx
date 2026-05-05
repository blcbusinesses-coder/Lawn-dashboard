'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Sparkles, Link2, Video, Copy, Download, Upload, X, Star, Clock, Smartphone, Lightbulb } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Idea {
  hook: string
  message: string
  cta: string
  rating: number
  platform: string
  best_time: string
  format: string
  color: 'yellow' | 'green' | 'blue' | 'pink'
  tip: string
}

interface TranscribeResult {
  facebook: string
  instagram: string
  hook: string
  summary: string
  topic: string
  sourceType: string
}

// ── Post-it colors ─────────────────────────────────────────────────────────────

const POSTIT_STYLES: Record<string, { bg: string; border: string; pin: string }> = {
  yellow: { bg: '#fef9c3', border: '#fde047', pin: '#ca8a04' },
  green:  { bg: '#dcfce7', border: '#86efac', pin: '#16a34a' },
  blue:   { bg: '#dbeafe', border: '#93c5fd', pin: '#2563eb' },
  pink:   { bg: '#fce7f3', border: '#f9a8d4', pin: '#db2777' },
}

const ROTATIONS = ['-1.5deg', '1.2deg', '-0.6deg', '2deg', '-1deg', '0.8deg']

// ── Post-it Card ───────────────────────────────────────────────────────────────

function PostIt({ idea, index }: { idea: Idea; index: number }) {
  const style = POSTIT_STYLES[idea.color] ?? POSTIT_STYLES.yellow
  const rotation = ROTATIONS[index % ROTATIONS.length]

  function copyAll() {
    const text = `${idea.hook}\n\n${idea.message}\n\n${idea.cta}`
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div
      style={{
        transform: `rotate(${rotation})`,
        backgroundColor: style.bg,
        borderColor: style.border,
        boxShadow: '3px 4px 12px rgba(0,0,0,0.15)',
      }}
      className="relative border rounded-sm p-4 flex flex-col gap-2 group hover:scale-[1.02] hover:rotate-0 hover:shadow-xl transition-all duration-200"
    >
      {/* Pin dot */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full opacity-60 shadow-sm"
        style={{ backgroundColor: style.pin }}
      />

      {/* Copy button */}
      <button
        onClick={copyAll}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10"
      >
        <Copy size={12} className="text-zinc-600" />
      </button>

      {/* Hook */}
      <p className="text-sm font-bold text-zinc-900 leading-snug mt-3 pr-6">{idea.hook}</p>

      {/* Message */}
      <p className="text-xs text-zinc-700 leading-relaxed">{idea.message}</p>

      {/* CTA */}
      <p className="text-xs font-semibold text-zinc-800 italic">→ {idea.cta}</p>

      {/* Tip */}
      {idea.tip && (
        <div className="flex items-start gap-1 bg-black/5 rounded px-2 py-1">
          <Lightbulb size={10} className="text-zinc-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-zinc-600 leading-snug">{idea.tip}</p>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-black/10 mt-auto">
        <span className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={10} fill={i < idea.rating ? '#ca8a04' : 'none'} className={i < idea.rating ? 'text-yellow-600' : 'text-zinc-300'} />
          ))}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Smartphone size={10} />
          {idea.platform}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <Clock size={10} />
          {idea.best_time}
        </span>
        <span className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded-full text-zinc-600">{idea.format}</span>
      </div>
    </div>
  )
}

// ── Image Drop Zone ────────────────────────────────────────────────────────────

function ImageZone({
  label,
  file,
  preview,
  onFile,
  onClear,
}: {
  label: string
  file: File | null
  preview: string | null
  onFile: (f: File, preview: string) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    const reader = new FileReader()
    reader.onload = (e) => onFile(f, e.target?.result as string)
    reader.readAsDataURL(f)
  }

  return (
    <div
      className="relative border-2 border-dashed border-zinc-300 rounded-xl overflow-hidden cursor-pointer hover:border-zinc-400 transition-colors"
      style={{ minHeight: 180 }}
      onClick={() => !file && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f?.type.startsWith('image/')) handleFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full h-full object-cover absolute inset-0" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="bg-white/90 text-zinc-900 rounded-full p-1.5 hover:bg-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 px-2">
            <p className="text-white text-xs font-medium">{label}</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-44 gap-2 text-zinc-400">
          <Upload size={24} />
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="text-xs text-zinc-400">Click or drop image</p>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'ideas' | 'repurpose' | 'video'

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>('ideas')

  // ── Ideas ─────────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)

  async function generateIdeas() {
    if (!notes.trim()) return toast.error('Add some notes first')
    setIdeasLoading(true)
    setIdeas([])
    try {
      const res = await fetch('/api/content/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setIdeas(data.ideas ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate ideas')
    }
    setIdeasLoading(false)
  }

  // ── Repurpose ─────────────────────────────────────────────────────────────────
  const [url, setUrl] = useState('')
  const [transcribeResult, setTranscribeResult] = useState<TranscribeResult | null>(null)
  const [transcribeLoading, setTranscribeLoading] = useState(false)
  const [transcribeStatus, setTranscribeStatus] = useState('')
  const [activeVariant, setActiveVariant] = useState<'facebook' | 'instagram'>('facebook')

  async function handleTranscribe() {
    if (!url.trim()) return toast.error('Paste a URL first')
    setTranscribeLoading(true)
    setTranscribeResult(null)
    setTranscribeStatus('Fetching content…')

    const timer = setTimeout(() => setTranscribeStatus('Rewriting for lawn care…'), 3000)

    try {
      const res = await fetch('/api/content/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTranscribeResult(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to process that URL')
    }
    clearTimeout(timer)
    setTranscribeStatus('')
    setTranscribeLoading(false)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  // ── Video ─────────────────────────────────────────────────────────────────────
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [beforePreview, setBeforePreview] = useState<string | null>(null)
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [afterPreview, setAfterPreview] = useState<string | null>(null)
  const [videoPrompt, setVideoPrompt] = useState('')
  const [videoDuration, setVideoDuration] = useState<'5' | '10'>('5')
  const [videoAspect, setVideoAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16')
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function fileToBase64(dataUrl: string): string {
    return dataUrl.split(',')[1]
  }

  const startPolling = useCallback((taskId: string) => {
    let elapsed = 0
    pollRef.current = setInterval(async () => {
      elapsed += 5
      // Fake progress: 0→80% over ~90s, then hold until done
      setVideoProgress(Math.min(80, Math.round((elapsed / 90) * 80)))

      try {
        const res = await fetch(`/api/content/video/status?taskId=${taskId}`)
        const data = await res.json()

        if (data.status === 'succeed' && data.videoUrl) {
          clearInterval(pollRef.current!)
          setVideoProgress(100)
          setVideoUrl(data.videoUrl)
          setVideoLoading(false)
          toast.success('Video ready!')
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!)
          setVideoLoading(false)
          setVideoError(data.failReason ?? 'Video generation failed')
        }
      } catch {
        // Keep polling on network hiccups
      }
    }, 5000)
  }, [])

  async function generateVideo() {
    if (!beforeFile || !beforePreview) return toast.error('Upload a before image')
    setVideoLoading(true)
    setVideoUrl(null)
    setVideoError('')
    setVideoProgress(2)

    try {
      const body: Record<string, string> = {
        image: fileToBase64(beforePreview),
        prompt: videoPrompt,
        duration: videoDuration,
        aspectRatio: videoAspect,
      }
      if (afterFile && afterPreview) {
        body.imageTail = fileToBase64(afterPreview)
      }

      const res = await fetch('/api/content/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      startPolling(data.taskId)
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : 'Failed to start video generation')
      setVideoLoading(false)
    }
  }

  const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'ideas', label: 'Content Ideas', Icon: Sparkles },
    { id: 'repurpose', label: 'Repurpose', Icon: Link2 },
    { id: 'video', label: 'AI Video', Icon: Video },
  ]

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Content</h1>
        <p className="text-sm text-zinc-500 mt-1">Turn notes into posts, links into lawn content, photos into videos</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-7 gap-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── IDEAS TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'ideas' && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-zinc-800 mb-1">Raw notes</p>
              <p className="text-xs text-zinc-400 mb-2">Just dump it in — what happened, what you saw, what you did. Don&apos;t overthink it.</p>
              <Textarea
                placeholder="Did a gnarly cleanup today — 10 bags of leaves, a full edge around the driveway, took 4 hours. Customer was stoked. Yard looks completely different from the street..."
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm resize-none"
              />
            </div>
            <Button onClick={generateIdeas} disabled={ideasLoading || !notes.trim()} className="w-full sm:w-auto">
              <Sparkles size={14} className="mr-1.5" />
              {ideasLoading ? 'Generating ideas…' : 'Generate Post Ideas'}
            </Button>
          </div>

          {ideasLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-sm border border-zinc-200 p-4 h-56 animate-pulse bg-zinc-50" style={{ transform: `rotate(${ROTATIONS[i]})`}} />
              ))}
            </div>
          )}

          {ideas.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{ideas.length} ideas generated</p>
                <button onClick={() => setIdeas([])} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Clear</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {ideas.map((idea, i) => (
                  <PostIt key={i} idea={idea} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REPURPOSE TAB ─────────────────────────────────────────────────────── */}
      {tab === 'repurpose' && (
        <div className="space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-zinc-800 mb-1">Paste any link</p>
              <p className="text-xs text-zinc-400 mb-2">YouTube video, TikTok, blog post, news article — anything public</p>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTranscribe()}
                  className="flex-1"
                />
                <Button onClick={handleTranscribe} disabled={transcribeLoading || !url.trim()}>
                  {transcribeLoading ? transcribeStatus : 'Import & Rewrite'}
                </Button>
              </div>
            </div>
          </div>

          {transcribeLoading && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-8 text-center">
              <div className="inline-flex items-center gap-2 text-zinc-500 text-sm">
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                {transcribeStatus}
              </div>
            </div>
          )}

          {transcribeResult && (
            <div className="space-y-4">
              {/* Original summary */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Original: {transcribeResult.topic}
                  {transcribeResult.sourceType === 'youtube' && <span className="ml-2 text-red-500">YouTube</span>}
                </p>
                <p className="text-sm text-zinc-600">{transcribeResult.summary}</p>
              </div>

              {/* Hook */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5">Hook</p>
                <p className="text-sm font-semibold text-zinc-800">&quot;{transcribeResult.hook}&quot;</p>
                <button onClick={() => copy(transcribeResult.hook)} className="text-xs text-amber-600 hover:text-amber-800 mt-1.5 flex items-center gap-1 transition-colors">
                  <Copy size={11} /> Copy hook
                </button>
              </div>

              {/* Platform toggle */}
              <div className="flex border-b border-zinc-200 gap-1">
                {(['facebook', 'instagram'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setActiveVariant(p)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                      activeVariant === p ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider capitalize">{activeVariant} version</p>
                  <button
                    onClick={() => copy(transcribeResult[activeVariant])}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{transcribeResult[activeVariant]}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIDEO TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'video' && (
        <div className="space-y-5">
          {/* Image upload row */}
          <div className="grid grid-cols-2 gap-4">
            <ImageZone
              label="Before (required)"
              file={beforeFile}
              preview={beforePreview}
              onFile={(f, p) => { setBeforeFile(f); setBeforePreview(p) }}
              onClear={() => { setBeforeFile(null); setBeforePreview(null) }}
            />
            <ImageZone
              label="After (optional — for transition)"
              file={afterFile}
              preview={afterPreview}
              onFile={(f, p) => { setAfterFile(f); setAfterPreview(p) }}
              onClear={() => { setAfterFile(null); setAfterPreview(null) }}
            />
          </div>

          {/* Prompt */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-800">Describe the video</p>
              <p className="text-xs text-zinc-400">Tell Kling what you want — motion, reveal, transition style</p>
              <Textarea
                placeholder="Smooth before and after reveal of the lawn — slow zoom out from the curb, dramatic transformation, crisp finished edges visible..."
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                className="text-sm resize-none"
              />
            </div>

            <div className="flex gap-6 flex-wrap">
              {/* Duration */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-600">Duration</p>
                <div className="flex gap-2">
                  {(['5', '10'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setVideoDuration(d)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        videoDuration === d ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect ratio */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-600">Aspect ratio</p>
                <div className="flex gap-2">
                  {([['9:16', 'Portrait'], ['16:9', 'Landscape'], ['1:1', 'Square']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setVideoAspect(val)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        videoAspect === val ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={generateVideo}
              disabled={videoLoading || !beforeFile}
              className="w-full"
            >
              <Video size={14} className="mr-1.5" />
              {videoLoading ? 'Generating…' : afterFile ? 'Generate Before → After Video' : 'Generate Video'}
            </Button>

            <p className="text-xs text-zinc-400 text-center">Powered by Kling AI · Takes 1–3 minutes</p>
          </div>

          {/* Progress */}
          {videoLoading && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 font-medium">Generating your video…</span>
                <span className="text-zinc-500">{videoProgress}%</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2">
                <div
                  className="bg-zinc-900 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400">Kling is rendering your video. This can take 1–3 minutes — you can keep the tab open.</p>
            </div>
          )}

          {/* Error */}
          {videoError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{videoError}</div>
          )}

          {/* Result */}
          {videoUrl && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full"
                style={{ maxHeight: 520 }}
              />
              <div className="p-4 flex justify-between items-center border-t border-zinc-100">
                <p className="text-sm text-zinc-600 font-medium">Video ready</p>
                <a
                  href={videoUrl}
                  download="gray-wolf-video.mp4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-zinc-700 hover:text-zinc-900 transition-colors"
                >
                  <Download size={14} /> Download
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
