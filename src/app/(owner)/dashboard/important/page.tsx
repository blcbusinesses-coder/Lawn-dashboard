'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportantItem {
  id: string
  type: 'document' | 'instruction' | 'link'
  title: string
  body: string | null
  url: string | null
  file_name: string | null
  file_size: number | null
  file_mime: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(mime: string | null): string {
  if (!mime) return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf') return '📕'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️'
  return '📄'
}

function ensureHttp(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DocumentCard({ item, onDelete }: { item: ImportantItem; onDelete: () => void }) {
  const [downloading, setDownloading] = useState(false)

  async function download() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/important/upload?path=${encodeURIComponent(item.url ?? '')}`)
      if (!res.ok) throw new Error('Failed to generate download link')
      const { url } = await res.json()
      window.open(url, '_blank')
    } catch {
      toast.error('Could not open file')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors group">
      <div className="text-2xl shrink-0">{fileIcon(item.file_mime)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 truncate">{item.title}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {item.file_name && item.file_name !== item.title ? `${item.file_name} · ` : ''}
          {item.file_size ? formatBytes(item.file_size) : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button size="sm" variant="outline" onClick={download} disabled={downloading}>
          {downloading ? '…' : '⬇ Download'}
        </Button>
        <button
          onClick={onDelete}
          className="p-1.5 text-zinc-300 hover:text-red-400 transition-colors rounded"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function InstructionCard({ item, onDelete, onSave }: {
  item: ImportantItem
  onDelete: () => void
  onSave: (id: string, title: string, body: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const [editBody, setEditBody] = useState(item.body ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(item.id, editTitle, editBody)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="p-3 bg-white rounded-lg border border-zinc-300">
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="mb-2 font-medium"
          placeholder="Title"
        />
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={8}
          className="w-full text-sm rounded-md border border-zinc-200 px-3 py-2 resize-y font-mono focus:outline-none focus:ring-2 focus:ring-zinc-400"
          placeholder="Write instructions here…"
        />
        <div className="flex gap-2 mt-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors group">
      <div
        className="flex items-center gap-2 px-3 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-zinc-400 text-xs">{expanded ? '▼' : '▶'}</span>
        <p className="text-sm font-medium text-zinc-900 flex-1">{item.title}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setExpanded(true); setEditing(true) }}
            className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors text-xs"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-zinc-300 hover:text-red-400 transition-colors"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>
      {expanded && item.body && (
        <div className="px-3 pb-3 border-t border-zinc-100">
          <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-sans leading-relaxed mt-2">{item.body}</pre>
        </div>
      )}
      {expanded && !item.body && (
        <div className="px-3 pb-3 border-t border-zinc-100">
          <p className="text-sm text-zinc-400 mt-2 italic">No content. Click ✏️ to edit.</p>
        </div>
      )}
    </div>
  )
}

function LinkCard({ item, onDelete }: { item: ImportantItem; onDelete: () => void }) {
  const displayUrl = item.url ? item.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''
  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors group">
      <div className="text-xl shrink-0 mt-0.5">🔗</div>
      <div className="flex-1 min-w-0">
        <a
          href={ensureHttp(item.url ?? '')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-zinc-900 hover:text-blue-600 hover:underline truncate block"
        >
          {item.title}
        </a>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">{displayUrl}</p>
        {item.body && <p className="text-xs text-zinc-500 mt-1">{item.body}</p>}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-300 hover:text-red-400 shrink-0"
        title="Delete"
      >
        ✕
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportantPage() {
  const [items, setItems] = useState<ImportantItem[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [docDialog, setDocDialog] = useState(false)
  const [instrDialog, setInstrDialog] = useState(false)
  const [linkDialog, setLinkDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docProgress, setDocProgress] = useState(false)
  const [instrTitle, setInstrTitle] = useState('')
  const [instrBody, setInstrBody] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDesc, setLinkDesc] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/important')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Data actions ────────────────────────────────────────────────────────────

  async function deleteItem(id: string) {
    await fetch(`/api/important?id=${id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast.success('Deleted')
  }

  async function saveInstruction(id: string, title: string, body: string) {
    const res = await fetch('/api/important', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title, body }),
    })
    if (res.ok) {
      const updated = await res.json()
      setItems((prev) => prev.map((i) => i.id === id ? updated : i))
      toast.success('Saved')
    } else {
      toast.error('Failed to save')
    }
  }

  // ── Add document ─────────────────────────────────────────────────────────────

  async function handleAddDocument() {
    if (!docFile) { toast.error('Please select a file'); return }
    setDocProgress(true)
    const fd = new FormData()
    fd.append('file', docFile)
    fd.append('title', docTitle || docFile.name)
    const res = await fetch('/api/important/upload', { method: 'POST', body: fd })
    setDocProgress(false)
    if (res.ok) {
      const item = await res.json()
      setItems((prev) => [...prev, item])
      setDocDialog(false)
      setDocTitle(''); setDocFile(null)
      toast.success('Document uploaded')
    } else {
      const { error } = await res.json()
      toast.error(error ?? 'Upload failed')
    }
  }

  // ── Add instruction ───────────────────────────────────────────────────────────

  async function handleAddInstruction() {
    if (!instrTitle.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const res = await fetch('/api/important', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'instruction', title: instrTitle, body: instrBody }),
    })
    setSaving(false)
    if (res.ok) {
      const item = await res.json()
      setItems((prev) => [...prev, item])
      setInstrDialog(false)
      setInstrTitle(''); setInstrBody('')
      toast.success('Instruction added')
    } else {
      toast.error('Failed to save')
    }
  }

  // ── Add link ─────────────────────────────────────────────────────────────────

  async function handleAddLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) { toast.error('Title and URL are required'); return }
    setSaving(true)
    const res = await fetch('/api/important', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'link', title: linkTitle, url: linkUrl, body: linkDesc }),
    })
    setSaving(false)
    if (res.ok) {
      const item = await res.json()
      setItems((prev) => [...prev, item])
      setLinkDialog(false)
      setLinkTitle(''); setLinkUrl(''); setLinkDesc('')
      toast.success('Link added')
    } else {
      toast.error('Failed to save')
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const documents = items.filter((i) => i.type === 'document')
  const instructions = items.filter((i) => i.type === 'instruction')
  const links = items.filter((i) => i.type === 'link')

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Important</h1>
        <p className="text-sm text-zinc-500 mt-1">Key documents, instructions, and links for your business</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
              <div className="h-4 bg-zinc-100 rounded w-1/2 animate-pulse" />
              {[0, 1, 2].map((j) => <div key={j} className="h-12 bg-zinc-100 rounded animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">

          {/* ── Documents ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📁</span>
                <h2 className="font-semibold text-zinc-800">Documents</h2>
                {documents.length > 0 && <Badge variant="secondary">{documents.length}</Badge>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setDocDialog(true)}>+ Upload</Button>
            </div>
            <div className="space-y-2">
              {documents.length === 0 ? (
                <div
                  onClick={() => setDocDialog(true)}
                  className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                >
                  <p className="text-zinc-400 text-sm">No documents yet</p>
                  <p className="text-zinc-300 text-xs mt-1">Click to upload</p>
                </div>
              ) : (
                documents.map((item) => (
                  <DocumentCard key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
                ))
              )}
            </div>
          </section>

          {/* ── Instructions ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📋</span>
                <h2 className="font-semibold text-zinc-800">Instructions</h2>
                {instructions.length > 0 && <Badge variant="secondary">{instructions.length}</Badge>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setInstrDialog(true)}>+ Add</Button>
            </div>
            <div className="space-y-2">
              {instructions.length === 0 ? (
                <div
                  onClick={() => setInstrDialog(true)}
                  className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                >
                  <p className="text-zinc-400 text-sm">No instructions yet</p>
                  <p className="text-zinc-300 text-xs mt-1">SOPs, processes, how-tos</p>
                </div>
              ) : (
                instructions.map((item) => (
                  <InstructionCard
                    key={item.id}
                    item={item}
                    onDelete={() => deleteItem(item.id)}
                    onSave={saveInstruction}
                  />
                ))
              )}
            </div>
          </section>

          {/* ── Links ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <h2 className="font-semibold text-zinc-800">Links</h2>
                {links.length > 0 && <Badge variant="secondary">{links.length}</Badge>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setLinkDialog(true)}>+ Add</Button>
            </div>
            <div className="space-y-2">
              {links.length === 0 ? (
                <div
                  onClick={() => setLinkDialog(true)}
                  className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                >
                  <p className="text-zinc-400 text-sm">No links yet</p>
                  <p className="text-zinc-300 text-xs mt-1">Useful URLs, portals, resources</p>
                </div>
              ) : (
                links.map((item) => (
                  <LinkCard key={item.id} item={item} onDelete={() => deleteItem(item.id)} />
                ))
              )}
            </div>
          </section>

        </div>
      )}

      {/* ── Upload Document Dialog ───────────────────────────────────────── */}
      <Dialog open={docDialog} onOpenChange={setDocDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                placeholder="Leave blank to use filename"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>File *</Label>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-zinc-200 rounded-lg p-6 text-center cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
              >
                {docFile ? (
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{docFile.name}</p>
                    <p className="text-xs text-zinc-400 mt-1">{formatBytes(docFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-zinc-500">Click to select a file</p>
                    <p className="text-xs text-zinc-400 mt-1">PDF, images, docs, spreadsheets…</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialog(false)}>Cancel</Button>
            <Button onClick={handleAddDocument} disabled={docProgress || !docFile}>
              {docProgress ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Instruction Dialog ───────────────────────────────────────── */}
      <Dialog open={instrDialog} onOpenChange={setInstrDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Instruction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. How to close out a property, End-of-day checklist"
                value={instrTitle}
                onChange={(e) => setInstrTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <textarea
                value={instrBody}
                onChange={(e) => setInstrBody(e.target.value)}
                rows={10}
                placeholder="Write your instructions, SOP, or notes here…"
                className="w-full text-sm rounded-md border border-zinc-200 px-3 py-2 resize-y font-mono focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstrDialog(false)}>Cancel</Button>
            <Button onClick={handleAddInstruction} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Link Dialog ──────────────────────────────────────────────── */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Link</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Supabase Dashboard, Stripe Portal"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                type="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="Optional short note"
                value={linkDesc}
                onChange={(e) => setLinkDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(false)}>Cancel</Button>
            <Button onClick={handleAddLink} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
