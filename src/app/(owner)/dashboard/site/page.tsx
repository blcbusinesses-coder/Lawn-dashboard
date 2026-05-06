'use client'

import { useState, useEffect, useRef } from 'react'
import { Globe, ExternalLink, Copy, Check, Eye, Smartphone, Monitor, Loader2, Upload, Trash2, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const SERVICE_AREAS = [
  'Kendallville', 'Albion', 'Angola', 'Auburn', 'Avilla',
  'Churubusco', 'Columbia City', 'Garrett', 'LaGrange',
  'Ligonier', 'Rome City', 'Waterloo', 'Wolcottville',
]

// ── Supabase helpers ───────────────────────────────────────────────────────────
async function loadSettings() {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('site_settings').select('key, value')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])) as Record<string, string>
}

async function saveSetting(key: string, value: string) {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

async function saveMany(pairs: Record<string, string>) {
  const supabase = createClient()
  const rows = Object.entries(pairs).map(([key, value]) => ({
    key, value, updated_at: new Date().toISOString(),
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/60">
        <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400/40 focus:border-green-500 transition-colors"

function SaveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full mt-1 flex items-center justify-center gap-2 bg-[#2d5a1b] hover:bg-[#3a7a22] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {loading ? 'Saving…' : 'Save Changes'}
    </button>
  )
}

interface ToggleProps {
  label: string; description: string; enabled: boolean; saving: boolean
  onChange: (v: boolean) => void
}
function SectionToggle({ label, description, enabled, saving, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-zinc-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-zinc-800">{label}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors duration-200 disabled:opacity-60
          ${enabled ? 'bg-green-500 border-green-500' : 'bg-zinc-200 border-zinc-200'}`}
        role="switch"
        aria-checked={enabled}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-0.5
          ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SitePage() {
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)

  // Business info
  const [name,     setName]     = useState('Gray Wolf Workers')
  const [tagline,  setTagline]  = useState('Your Lawn, Done Right.')
  const [location, setLocation] = useState('Kendallville, IN 46755')
  const [email,    setEmail]    = useState('graywolfworkers@gmail.com')
  const [savingInfo, setSavingInfo] = useState(false)

  // About section
  const [about,      setAbout]      = useState("Gray Wolf Workers started right here in Kendallville. We're not a big franchise with a call center — we're your neighbors, and we treat your yard like it's our own.")
  const [statLawns,  setStatLawns]  = useState('30+')
  const [statYears,  setStatYears]  = useState('3+')
  const [statRating, setStatRating] = useState('5★')
  const [savingAbout, setSavingAbout] = useState(false)

  // Gallery
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Section toggles
  const [sections, setSections] = useState({
    services: true, about: true, whyUs: true,
    gallery: true, areas: true, cta: true, footer: true,
  })
  const savingToggle = useRef<string | null>(null)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  // Load on mount
  useEffect(() => {
    loadSettings()
      .then(s => {
        if (s.business_name)  setName(s.business_name)
        if (s.tagline)        setTagline(s.tagline)
        if (s.location)       setLocation(s.location)
        if (s.email)          setEmail(s.email)
        if (s.about_text)  setAbout(s.about_text)
        if (s.stat_lawns)  setStatLawns(s.stat_lawns)
        if (s.stat_years)  setStatYears(s.stat_years)
        if (s.stat_rating) setStatRating(s.stat_rating)
        setSections({
          services: s.show_services !== 'false',
          about:    s.show_about    !== 'false',
          whyUs:    s.show_why_us   !== 'false',
          gallery:  s.show_gallery  !== 'false',
          areas:    s.show_areas    !== 'false',
          cta:      s.show_cta      !== 'false',
          footer:   s.show_footer   !== 'false',
        })
      })
      .catch(() => toast.error('Could not load site settings'))
      .finally(() => setLoading(false))

    // Load gallery photos
    loadGalleryPhotos()
  }, [])

  // Save business info
  async function handleSaveInfo() {
    setSavingInfo(true)
    try {
      await saveMany({
        business_name: name,
        tagline,
        location,
        email,
      })
      toast.success('Business info saved!')
    } catch {
      toast.error('Could not save — check Supabase connection')
    } finally {
      setSavingInfo(false)
    }
  }

  // Save about section
  async function handleSaveAbout() {
    setSavingAbout(true)
    try {
      await saveMany({ about_text: about, stat_lawns: statLawns, stat_years: statYears, stat_rating: statRating })
      toast.success('About section saved!')
    } catch {
      toast.error('Could not save')
    } finally {
      setSavingAbout(false)
    }
  }

  // Gallery helpers
  async function loadGalleryPhotos() {
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('gallery').list('', { sortBy: { column: 'created_at', order: 'asc' } })
    if (error || !data) return
    const urls = data
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(f => supabase.storage.from('gallery').getPublicUrl(f.name).data.publicUrl)
    setGalleryPhotos(urls)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const filename = `photo_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('gallery').upload(filename, file, { upsert: false })
      if (error) throw error
      toast.success('Photo uploaded!')
      await loadGalleryPhotos()
    } catch {
      toast.error('Upload failed — check storage bucket permissions')
    } finally {
      setUploadingPhoto(false)
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  async function handlePhotoDelete(url: string) {
    const filename = url.split('/').pop()
    if (!filename) return
    setDeletingPhoto(url)
    try {
      const supabase = createClient()
      const { error } = await supabase.storage.from('gallery').remove([filename])
      if (error) throw error
      toast.success('Photo deleted')
      setGalleryPhotos(prev => prev.filter(p => p !== url))
    } catch {
      toast.error('Could not delete photo')
    } finally {
      setDeletingPhoto(null)
    }
  }

  // Toggle a section and persist immediately
  async function handleToggle(key: keyof typeof sections) {
    if (savingToggle.current) return
    const newVal = !sections[key]
    setSections(s => ({ ...s, [key]: newVal }))
    setTogglingKey(key)
    savingToggle.current = key
    const dbKey = {
      services: 'show_services', about: 'show_about', whyUs: 'show_why_us',
      gallery: 'show_gallery', areas: 'show_areas', cta: 'show_cta', footer: 'show_footer',
    }[key]
    try {
      await saveSetting(dbKey, String(newVal))
    } catch {
      // revert on failure
      setSections(s => ({ ...s, [key]: !newVal }))
      toast.error('Could not save toggle')
    } finally {
      savingToggle.current = null
      setTogglingKey(null)
    }
  }

  // Copy URL
  function copyUrl() {
    const url = `${window.location.protocol}//${window.location.host}/home`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast.success('URL copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading site settings…
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Globe size={22} className="text-green-700" />
            Your Website
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your public-facing Gray Wolf Workers website.</p>
        </div>
        <a href="/home" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border border-green-200 px-4 py-2 rounded-full transition-colors shrink-0">
          <Eye size={14} /> Preview Site
        </a>
      </div>

      {/* URL bar */}
      <Card title="Website URL">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0 flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5">
            <Globe size={14} className="text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-600 font-mono truncate">/home</span>
            <span className="ml-auto text-xs text-green-600 font-semibold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">Live</span>
          </div>
          <button onClick={copyUrl}
            className="flex items-center gap-1.5 text-sm font-medium bg-zinc-900 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-lg transition-colors shrink-0">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
          <a href="/home" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 px-4 py-2.5 rounded-lg transition-colors shrink-0">
            <ExternalLink size={14} /> Open
          </a>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Business info */}
        <Card title="Business Info">
          <Field label="Business Name">
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Hero Headline / Tagline">
            <input className={inputCls} value={tagline} onChange={e => setTagline(e.target.value)} />
          </Field>
          <Field label="Location">
            <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} />
          </Field>
          <Field label="Contact Email">
            <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <SaveButton loading={savingInfo} onClick={handleSaveInfo} />
        </Card>

        {/* About section */}
        <Card title="About Section">
          <Field label="About Us Text" hint="Shown in the 'Our Story' section.">
            <textarea className={`${inputCls} resize-none`} rows={5}
              value={about} onChange={e => setAbout(e.target.value)} />
          </Field>
          <Field label="Lawns Maintained (e.g. 30+)">
            <input className={inputCls} value={statLawns} onChange={e => setStatLawns(e.target.value)} />
          </Field>
          <Field label="Years in Business (e.g. 3+)">
            <input className={inputCls} value={statYears} onChange={e => setStatYears(e.target.value)} />
          </Field>
          <Field label="Rating (e.g. 5★)">
            <input className={inputCls} value={statRating} onChange={e => setStatRating(e.target.value)} />
          </Field>
          <SaveButton loading={savingAbout} onClick={handleSaveAbout} />
        </Card>
      </div>

      {/* Gallery photos */}
      <Card title="Our Work — Gallery Photos">
        <p className="text-xs text-zinc-400 mb-4">
          Upload photos that appear in the &quot;Our Work&quot; section on your website. Visitors can click any photo to view it fullscreen and load more with a button.
        </p>

        {/* Upload button */}
        <div className="mb-5">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex items-center gap-2 bg-[#2d5a1b] hover:bg-[#3a7a22] disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            {uploadingPhoto
              ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
              : <><Upload size={14} /> Upload Photo</>}
          </button>
        </div>

        {/* Photo grid */}
        {galleryPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400">
            <ImageIcon size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No photos yet — upload your first one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {galleryPhotos.map(url => (
              <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Gallery" className="w-full h-full object-cover" />
                <button
                  onClick={() => handlePhotoDelete(url)}
                  disabled={deletingPhoto === url}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {deletingPhoto === url
                    ? <Loader2 size={18} className="text-white animate-spin" />
                    : <Trash2 size={18} className="text-white" />}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-zinc-400 mt-3">
          Hover a photo and click the trash icon to delete it. Photos appear on the website in upload order.
        </p>
      </Card>

      {/* Section toggles */}
      <Card title="Show / Hide Sections">
        <p className="text-xs text-zinc-400 mb-4">Changes save instantly. Toggle any section on or off on your live site.</p>
        {([
          ['services', 'Services Section',    'The 4 service cards (Mowing, Cleanup, etc.)'],
          ['about',    'About / Our Story',   'Team photo, story paragraph, and stats'],
          ['whyUs',    'Why Choose Us',       'The 4 trust pillars grid'],
          ['gallery',  'Photo Gallery',       'Grid of your 4 lawn photos'],
          ['areas',    'Service Areas',       'Section with city name badges'],
          ['cta',      'CTA Banner',          '"Ready for a Lawn You\'re Proud Of?" section'],
          ['footer',   'Footer',              'Bottom bar with links and contact info'],
        ] as const).map(([key, label, desc]) => (
          <SectionToggle key={key}
            label={label} description={desc}
            enabled={sections[key]}
            saving={togglingKey === key}
            onChange={() => handleToggle(key)}
          />
        ))}
      </Card>

      {/* Service areas display */}
      <Card title="Service Areas">
        <p className="text-xs text-zinc-400 mb-4">
          Cities displayed on your website. To add/remove cities, go to <strong>Automation → Quote Settings</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_AREAS.map(area => (
            <span key={area}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border
                ${area === 'Kendallville'
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}>
              {area === 'Kendallville' ? '★ ' : ''}{area}
            </span>
          ))}
        </div>
      </Card>

      {/* Preview */}
      <Card title="Preview Your Site">
        <div className="flex gap-3">
          <a href="/home" target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-3 rounded-xl transition-colors">
            <Monitor size={16} /> Desktop Preview
          </a>
          <a href="/home" target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-sm py-3 rounded-xl transition-colors">
            <Smartphone size={16} /> Mobile Preview
          </a>
        </div>
        <p className="text-xs text-zinc-400 mt-3 text-center">
          Live at <span className="font-mono text-zinc-600">/home</span> — share this link with customers.
        </p>
      </Card>

      {/* Quote page */}
      <Card title="Quote Page">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-800">Get-a-Quote Wizard</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Your quote form lives at <span className="font-mono">/get-a-quote</span>. Every &quot;Get a Free Quote&quot; button on the site links here.
            </p>
          </div>
          <a href="/get-a-quote" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full transition-colors shrink-0">
            <ExternalLink size={12} /> Open Form
          </a>
        </div>
      </Card>
    </div>
  )
}
