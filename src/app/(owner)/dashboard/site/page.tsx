'use client'

import { useState } from 'react'
import { Globe, ExternalLink, Copy, Check, Eye, Smartphone, Monitor } from 'lucide-react'
import { toast } from 'sonner'

const SERVICE_AREAS = [
  'Kendallville', 'Albion', 'Angola', 'Auburn', 'Avilla',
  'Churubusco', 'Columbia City', 'Garrett', 'LaGrange',
  'Ligonier', 'Rome City', 'Waterloo', 'Wolcottville',
]

const SITE_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.host}/home`
  : '/home'

// ── Section toggle ─────────────────────────────────────────────────────────────
interface SectionToggleProps {
  label: string
  description: string
  enabled: boolean
  onChange: (v: boolean) => void
}
function SectionToggle({ label, description, enabled, onChange }: SectionToggleProps) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-zinc-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-zinc-800">{label}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors duration-200
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

// ── Settings card ──────────────────────────────────────────────────────────────
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

const inputClass = "w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors"
const textareaClass = `${inputClass} resize-none`

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SitePage() {
  const [copied, setCopied] = useState(false)
  const [sections, setSections] = useState({
    services: true,
    about: true,
    gallery: true,
    whyUs: true,
    areas: true,
    cta: true,
    footer: true,
  })

  // Business info (display only for now — used to show what's on the site)
  const [info] = useState({
    name: 'Gray Wolf Workers',
    tagline: 'Your Lawn, Done Right.',
    location: 'Kendallville, IN 46755',
    email: 'graywolfworkers@gmail.com',
    about: "Gray Wolf Workers started right here in Kendallville. We're not a big franchise with a call center — we're your neighbors, and we treat your yard like it's our own.",
  })

  function copyUrl() {
    const url = `${window.location.protocol}//${window.location.host}/home`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast.success('Website URL copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function toggleSection(key: keyof typeof sections) {
    setSections(s => ({ ...s, [key]: !s[key] }))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Globe size={22} className="text-amber-500" />
            Your Website
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage your public-facing Gray Wolf Workers website.
          </p>
        </div>
        <a
          href="/home"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-4 py-2 rounded-full transition-colors shrink-0"
        >
          <Eye size={14} />
          Preview Site
        </a>
      </div>

      {/* URL bar */}
      <Card title="Website URL">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5">
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
            <ExternalLink size={14} />
            Open
          </a>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Business info */}
        <Card title="Business Info">
          <Field label="Business Name">
            <input className={inputClass} defaultValue={info.name} />
          </Field>
          <Field label="Tagline / Hero Headline">
            <input className={inputClass} defaultValue={info.tagline} />
          </Field>
          <Field label="Location">
            <input className={inputClass} defaultValue={info.location} />
          </Field>
          <Field label="Contact Email">
            <input className={inputClass} type="email" defaultValue={info.email} />
          </Field>
          <button className="w-full mt-1 bg-amber-400 hover:bg-amber-300 text-zinc-900 font-semibold text-sm py-2.5 rounded-xl transition-colors">
            Save Changes
          </button>
        </Card>

        {/* About text */}
        <Card title="About Section Text">
          <Field label="About Us Paragraph" hint="Shown in the 'Our Story' section of your website.">
            <textarea className={textareaClass} rows={5} defaultValue={info.about} />
          </Field>
          <Field label="Stat 1 — Number">
            <input className={inputClass} defaultValue="50+" />
          </Field>
          <Field label="Stat 2 — Number">
            <input className={inputClass} defaultValue="3+" />
          </Field>
          <button className="w-full mt-1 bg-amber-400 hover:bg-amber-300 text-zinc-900 font-semibold text-sm py-2.5 rounded-xl transition-colors">
            Save Changes
          </button>
        </Card>
      </div>

      {/* Section visibility */}
      <Card title="Show / Hide Sections">
        <p className="text-xs text-zinc-400 mb-4">Toggle which sections appear on your public website.</p>
        <SectionToggle label="Services Section" description="The 4 service cards (Mowing, Cleanup, etc.)" enabled={sections.services} onChange={() => toggleSection('services')} />
        <SectionToggle label="About / Our Story" description="Team photo, story, and stats" enabled={sections.about} onChange={() => toggleSection('about')} />
        <SectionToggle label="Why Choose Us" description="The 4 trust pillars" enabled={sections.whyUs} onChange={() => toggleSection('whyUs')} />
        <SectionToggle label="Photo Gallery" description="Grid of your lawn photos" enabled={sections.gallery} onChange={() => toggleSection('gallery')} />
        <SectionToggle label="Service Areas" description="Yellow section with city badges" enabled={sections.areas} onChange={() => toggleSection('areas')} />
        <SectionToggle label="CTA Banner" description="'Ready for a Lawn You're Proud Of?' section" enabled={sections.cta} onChange={() => toggleSection('cta')} />
        <SectionToggle label="Footer" description="Bottom bar with links and contact info" enabled={sections.footer} onChange={() => toggleSection('footer')} />
      </Card>

      {/* Service areas */}
      <Card title="Service Areas">
        <p className="text-xs text-zinc-400 mb-4">Cities shown on your website. Manage available cities in <strong>Automation → Quote Settings</strong>.</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_AREAS.map(area => (
            <span key={area}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border
                ${area === 'Kendallville'
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}>
              {area === 'Kendallville' ? '★ ' : ''}{area}
            </span>
          ))}
        </div>
      </Card>

      {/* Preview device links */}
      <Card title="Preview Your Site">
        <div className="flex gap-3">
          <a href="/home" target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm py-3 rounded-xl transition-colors">
            <Monitor size={16} />
            Desktop Preview
          </a>
          <a href="/home" target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-sm py-3 rounded-xl transition-colors">
            <Smartphone size={16} />
            Mobile Preview
          </a>
        </div>
        <p className="text-xs text-zinc-400 mt-3 text-center">
          Your site is live at <span className="font-mono text-zinc-600">/home</span> — share this link with customers.
        </p>
      </Card>

      {/* Get-a-quote link */}
      <Card title="Quote Page">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-800">Get-a-Quote Wizard</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Your quote form lives at <span className="font-mono">/get-a-quote</span> — all website buttons link here.
            </p>
          </div>
          <a href="/get-a-quote" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full transition-colors shrink-0">
            <ExternalLink size={12} />
            Open Form
          </a>
        </div>
      </Card>
    </div>
  )
}
