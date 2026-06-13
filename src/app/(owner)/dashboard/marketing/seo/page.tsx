'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Search, Loader2, Plus, Trash2, ExternalLink, Globe,
  CheckCircle2, Sparkles, Eye, EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SITE_URL = 'https://graywolfworkers.com'

const SERVICES = ['Lawn Mowing', 'Lawn Care', 'Yard Cleanup', 'Trimming and Edging']

const COUNTY_BY_TOWN: Record<string, string> = {
  'Kendallville': 'Noble County', 'Albion': 'Noble County', 'Avilla': 'Noble County',
  'Rome City': 'Noble County', 'Ligonier': 'Noble County', 'Wolcottville': 'Noble County',
  'Auburn': 'DeKalb County', 'Garrett': 'DeKalb County', 'Waterloo': 'DeKalb County',
  'LaGrange': 'LaGrange County', 'Howe': 'LaGrange County',
  'Columbia City': 'Whitley County', 'Churubusco': 'Whitley County', 'Angola': 'Steuben County',
}

interface SeoPageRow {
  id: string
  slug: string
  service: string
  city: string
  county: string | null
  title: string
  published: boolean
  created_at: string
}

// Ordered by impact — these are the offsite moves that actually rank a
// low-competition rural service area fast.
const CHECKLIST: Array<{ key: string; label: string; why: string; link?: string; linkLabel?: string }> = [
  {
    key: 'gbp_claim',
    label: 'Create your Google Business Profile',
    why: 'The single biggest local ranking factor. The map pack (top 3 with the map) comes almost entirely from GBP — without one you are invisible for "lawn mowing near me".',
    link: 'https://business.google.com', linkLabel: 'business.google.com',
  },
  {
    key: 'gbp_complete',
    label: 'Fill the profile to 100%',
    why: 'Primary category "Lawn care service"; add every town you serve as service area (Kendallville, Albion, Avilla, Rome City…); hours; services list; 10+ real job photos. Complete profiles rank dramatically better.',
  },
  {
    key: 'reviews_10',
    label: 'Sprint to 10 Google reviews',
    why: 'Ten reviews is the trust threshold where rankings visibly jump. Text every past customer a direct review link from your GBP dashboard. This is the fastest needle-mover after the profile itself.',
  },
  {
    key: 'search_console',
    label: 'Verify Google Search Console + submit the sitemap',
    why: `Gets your city pages indexed in days instead of weeks. Add the property, then submit ${SITE_URL}/sitemap.xml (already live).`,
    link: 'https://search.google.com/search-console', linkLabel: 'Search Console',
  },
  {
    key: 'publish_pages',
    label: 'Publish a city page for every town you serve',
    why: 'Dedicated city pages are the most underused tactic in lawn-care SEO — each one targets "lawn mowing <town>" directly. Generate them below; in Noble County competition, these can rank within weeks.',
  },
  {
    key: 'gbp_weekly',
    label: 'Post on GBP weekly',
    why: 'Weekly posts (before/after photos, the free-first-mow offer, seasonal tips) signal an active business. Set a phone reminder — 5 minutes a week.',
  },
  {
    key: 'citations',
    label: 'Build core citations with identical info',
    why: 'Facebook page, Yelp, Angi, Nextdoor, Bing Places — exact same business name, Kendallville address, and email everywhere. Consistency is what Google checks.',
    link: 'https://www.bingplaces.com', linkLabel: 'Bing Places',
  },
  {
    key: 'photos_monthly',
    label: 'Upload fresh job photos monthly',
    why: 'Take photos on your phone with location on while on jobs in different towns, and add them to GBP. Geo-tagged, recent photos in the towns you target reinforce your service area.',
  },
  {
    key: 'reviews_reply',
    label: 'Reply to every review',
    why: 'Owner responses (mention the town when natural: "Glad we could help in Albion!") are an engagement signal and reassure the next person reading.',
  },
]

export default function LocalSeoPage() {
  const [pages, setPages] = useState<SeoPageRow[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const [city, setCity] = useState('')
  const [service, setService] = useState(SERVICES[0])
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/seo/pages'),
        fetch('/api/seo/checklist'),
      ])
      const pData = await pRes.json()
      const cData = await cRes.json()
      setPages(pData.pages ?? [])
      setChecked(cData.checked ?? {})
    } catch {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleCheck(key: string) {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    await fetch('/api/seo/checklist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: next }),
    })
  }

  async function generatePage() {
    if (!city.trim()) { toast.error('Enter a city'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/seo/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: city.trim(),
          county: COUNTY_BY_TOWN[city.trim()] ?? '',
          service,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Generation failed'); return }
      setPages(prev => [data.page, ...prev])
      setCity('')
      toast.success(`Page drafted for ${data.page.city} — review it, then publish`)
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function togglePublish(row: SeoPageRow) {
    setBusyId(row.id)
    try {
      const res = await fetch('/api/seo/pages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, published: !row.published }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Update failed'); return }
      setPages(prev => prev.map(p => (p.id === row.id ? data.page : p)))
      toast.success(data.page.published ? 'Published — it is in the sitemap now' : 'Unpublished')
    } finally {
      setBusyId(null)
    }
  }

  async function deletePage(row: SeoPageRow) {
    if (!window.confirm(`Delete the ${row.service} page for ${row.city}? This removes the live URL.`)) return
    setBusyId(row.id)
    try {
      const res = await fetch('/api/seo/pages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      if (!res.ok) { toast.error('Delete failed'); return }
      setPages(prev => prev.filter(p => p.id !== row.id))
      toast.success('Deleted')
    } finally {
      setBusyId(null)
    }
  }

  const doneCount = CHECKLIST.filter(i => checked[i.key]).length
  const publishedCount = pages.filter(p => p.published).length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Search className="text-green-600" size={26} />
        <div>
          <h1 className="text-2xl font-bold">Local SEO</h1>
          <p className="text-sm text-zinc-500">
            Rank for &ldquo;lawn mowing in Noble County&rdquo; fast: nail the checklist, then publish a page for every town you serve.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          [String(doneCount) + '/' + CHECKLIST.length, 'Checklist done'],
          [String(publishedCount), 'City pages live'],
          [String(pages.length - publishedCount), 'Drafts waiting'],
        ].map(([n, l]) => (
          <div key={l} className="border rounded-xl bg-white px-5 py-4">
            <p className="text-2xl font-bold">{n}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Fast-rank checklist */}
      <div className="border rounded-xl bg-white">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" /> Fast-Rank Checklist
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            In order of impact. In a low-competition area like Noble County, the top four alone usually crack the map pack within 30–60 days.
          </p>
        </div>
        <ul>
          {CHECKLIST.map((item, idx) => (
            <li key={item.key} className="flex gap-3.5 px-5 py-4 border-b last:border-0">
              <input
                type="checkbox"
                checked={!!checked[item.key]}
                onChange={() => toggleCheck(item.key)}
                className="mt-1 shrink-0"
              />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${checked[item.key] ? 'line-through text-zinc-400' : ''}`}>
                  {idx + 1}. {item.label}
                </p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{item.why}</p>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-700 font-medium mt-1.5 hover:underline">
                    {item.linkLabel} <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* City page generator */}
      <div className="border rounded-xl bg-white">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles size={16} className="text-green-600" /> City Pages
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Each page targets &ldquo;&lt;service&gt; &lt;town&gt;&rdquo; with unique AI-written local copy, FAQs, and LocalBusiness schema.
            Drafts are not visible until you publish. Published pages join the sitemap automatically.
          </p>
        </div>

        <div className="px-5 py-4 border-b grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <Label htmlFor="svc">Service</Label>
            <select
              id="svc"
              value={service}
              onChange={e => setService(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm"
            >
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="city">Town</Label>
            <Input id="city" list="towns" value={city} onChange={e => setCity(e.target.value)} placeholder="Kendallville" />
            <datalist id="towns">
              {Object.keys(COUNTY_BY_TOWN).map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <Button onClick={generatePage} disabled={generating}>
            {generating ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Plus size={15} className="mr-1.5" />}
            {generating ? 'Writing…' : 'Generate page'}
          </Button>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-sm text-zinc-400">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-400">
            No pages yet. Start with &ldquo;Lawn Mowing&rdquo; in Kendallville, then work outward — Albion, Avilla, Rome City…
          </p>
        ) : (
          <ul>
            {pages.map(p => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3.5 border-b last:border-0">
                <Globe size={15} className={p.published ? 'text-green-600' : 'text-zinc-300'} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.service} — {p.city}{p.county ? `, ${p.county}` : ''}</p>
                  <a
                    href={`${SITE_URL}/lawn-care/${p.slug}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-zinc-500 hover:text-green-700 hover:underline truncate inline-block max-w-full"
                  >
                    /lawn-care/{p.slug}
                  </a>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  p.published
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                }`}>
                  {p.published ? 'Live' : 'Draft'}
                </span>
                <Button size="sm" variant="outline" onClick={() => togglePublish(p)} disabled={busyId === p.id}>
                  {busyId === p.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : p.published ? <><EyeOff size={13} className="mr-1" /> Unpublish</> : <><Eye size={13} className="mr-1" /> Publish</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deletePage(p)} disabled={busyId === p.id}>
                  <Trash2 size={13} className="text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
