'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 9

// ── Design system ──────────────────────────────────────────────────────────────
// Flat, editorial, photography-first. Solid colors only — no gradients, no
// scale/zoom animations, no pill buttons. Square corners, thin rules, big type.
//
//   ink:    #181b15   near-black headings / footer
//   forest: #1e3d12   brand green (bars, buttons)
//   grass:  #2f6418   accent / links
//   paper:  #ffffff
//   stone:  #f4f4ee   warm section background
//   line:   #e2e2d8   hairline rules
//   muted:  #5b6354   body text

const SERVICE_AREAS: Array<{ county: string; towns: string[] }> = [
  { county: 'Noble County',    towns: ['Kendallville', 'Albion', 'Avilla', 'Rome City', 'Ligonier', 'Wolcottville'] },
  { county: 'DeKalb County',   towns: ['Auburn', 'Garrett', 'Waterloo'] },
  { county: 'LaGrange County', towns: ['LaGrange', 'Howe'] },
  { county: 'Whitley & Steuben', towns: ['Columbia City', 'Churubusco', 'Angola'] },
]

const SERVICES = [
  {
    n: '01',
    title: 'Lawn Mowing',
    desc: 'Weekly or bi-weekly cuts with clean edges every time. We show up on schedule, every time, so you never have to think about your lawn again.',
  },
  {
    n: '02',
    title: 'Trimming & Edging',
    desc: 'Crisp lines along driveways, sidewalks, and beds. Included with every mow — it is the finishing touch that separates a cut lawn from a kept one.',
  },
  {
    n: '03',
    title: 'Yard Cleanup',
    desc: 'Spring and fall cleanups, leaf removal, and debris hauling. We leave your property ready for the season ahead.',
  },
  {
    n: '04',
    title: 'Add-On Services',
    desc: 'Fertilization, mulching, and custom work by request. Tell us what your yard needs and we will give you a straight answer and a fair price.',
  },
]

// ── Top bar ────────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div style={{ background: '#1e3d12' }}>
      <div className="max-w-6xl mx-auto px-5 h-9 flex items-center justify-between text-xs text-white/85">
        <p className="font-medium tracking-wide">
          New customers: <span className="font-bold text-white">75% off your first month</span>
        </p>
        <a href="mailto:graywolfworkers@gmail.com" className="hidden sm:block hover:text-white font-medium">
          graywolfworkers@gmail.com
        </a>
      </div>
    </div>
  )
}

// ── Nav ────────────────────────────────────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false)

  const links = [
    ['#services', 'Services'],
    ['#about', 'About'],
    ['#work', 'Our Work'],
    ['#areas', 'Service Areas'],
  ]

  return (
    <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #e2e2d8' }}>
      <div className="max-w-6xl mx-auto px-5 h-[68px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gray Wolf Workers" className="w-10 h-10 object-contain" />
          <span className="leading-tight">
            <span className="block font-bold text-[15px]" style={{ color: '#181b15' }}>Gray Wolf Workers</span>
            <span className="block text-[11px] font-medium tracking-wide" style={{ color: '#5b6354' }}>Lawn Care · Kendallville, IN</span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-[13.5px] font-medium" style={{ color: '#5b6354' }}>
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-[#181b15] transition-colors">{label}</a>
          ))}
        </nav>

        <Link href="/get-a-quote"
          className="hidden md:inline-flex items-center font-semibold px-5 py-2.5 text-sm text-white transition-colors"
          style={{ background: '#1e3d12' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
          Get a Free Quote
        </Link>

        <button onClick={() => setOpen(o => !o)} className="md:hidden p-2" aria-label="Menu" style={{ color: '#181b15' }}>
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white px-5 pb-5 pt-2" style={{ borderTop: '1px solid #e2e2d8' }}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block py-3 text-sm font-medium" style={{ color: '#5b6354', borderBottom: '1px solid #efefe8' }}>
              {label}
            </a>
          ))}
          <Link href="/get-a-quote" onClick={() => setOpen(false)}
            className="mt-4 w-full flex items-center justify-center font-semibold py-3.5 text-sm text-white"
            style={{ background: '#1e3d12' }}>
            Get a Free Quote
          </Link>
        </div>
      )}
    </header>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="top" className="bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-2 items-center">
          {/* Copy */}
          <div className="py-16 md:py-24 md:pr-14">
            <p className="text-xs font-bold uppercase mb-6" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>
              Lawn care in Noble County, Indiana
            </p>
            <h1 className="text-[42px] sm:text-[52px] md:text-[58px] font-extrabold leading-[1.04] tracking-tight mb-6"
              style={{ color: '#181b15' }}>
              A well-kept lawn, without the work.
            </h1>
            <p className="text-[17px] leading-relaxed mb-9 max-w-md" style={{ color: '#5b6354' }}>
              Gray Wolf Workers is a local crew based in Kendallville. We mow, trim, and edge on a
              schedule you can count on — at a price you will know before we ever start.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link href="/get-a-quote"
                className="inline-flex items-center justify-center font-semibold px-7 py-4 text-[15px] text-white transition-colors"
                style={{ background: '#1e3d12' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
                Get a Free Quote
              </Link>
              <a href="#work"
                className="inline-flex items-center justify-center font-semibold px-7 py-4 text-[15px] transition-colors"
                style={{ color: '#181b15', border: '1px solid #d4d4c8' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#181b15')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#d4d4c8')}>
                See Our Work
              </a>
            </div>

            <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] font-medium" style={{ color: '#5b6354' }}>
              {['Locally owned', 'Fully insured', 'No contracts'].map(t => (
                <li key={t} className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5" style={{ background: '#2f6418' }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Photo — clean, no overlay */}
          <div className="relative h-[320px] md:h-[640px] -mx-5 md:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lawn2.jpg" alt="A freshly mowed lawn by Gray Wolf Workers in Kendallville, Indiana"
              className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Services ──────────────────────────────────────────────────────────────────
function Services() {
  return (
    <section id="services" className="py-20 md:py-28" style={{ background: '#f4f4ee' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="md:flex items-end justify-between mb-14">
          <div>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>What we do</p>
            <h2 className="text-4xl md:text-[44px] font-extrabold tracking-tight" style={{ color: '#181b15' }}>
              Four services.<br />One standard.
            </h2>
          </div>
          <p className="mt-5 md:mt-0 max-w-sm text-[15px] leading-relaxed" style={{ color: '#5b6354' }}>
            Everything we offer comes with the same promise — done right, on time, no corners cut.
          </p>
        </div>

        <div style={{ borderTop: '1px solid #d8d8cc' }}>
          {SERVICES.map(s => (
            <div key={s.n}
              className="grid md:grid-cols-12 gap-3 md:gap-6 py-8 md:py-10 transition-colors"
              style={{ borderBottom: '1px solid #d8d8cc' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eeeee5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div className="md:col-span-1 text-sm font-bold pt-1" style={{ color: '#2f6418' }}>{s.n}</div>
              <h3 className="md:col-span-4 text-2xl font-bold tracking-tight" style={{ color: '#181b15' }}>{s.title}</h3>
              <p className="md:col-span-7 text-[15px] leading-relaxed max-w-xl" style={{ color: '#5b6354' }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <Link href="/get-a-quote"
            className="inline-flex items-center font-semibold px-7 py-4 text-[15px] text-white transition-colors"
            style={{ background: '#1e3d12' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
            Get Your Price
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── About ──────────────────────────────────────────────────────────────────────
function About() {
  const [stats, setStats] = useState({ years: '3+', lawns: '30+', rating: '5★' })

  useEffect(() => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).from('site_settings').select('key, value').in('key', ['stat_years', 'stat_lawns', 'stat_rating'])
      .then(({ data }: { data: Array<{ key: string; value: string }> | null }) => {
        if (!data) return
        const map = Object.fromEntries(data.map(r => [r.key, r.value]))
        setStats({
          years:  map.stat_years  ?? '3+',
          lawns:  map.stat_lawns  ?? '30+',
          rating: map.stat_rating ?? '5★',
        })
      })
  }, [])

  const statItems = [
    [stats.years,  'Years in business'],
    [stats.lawns,  'Lawns maintained'],
    [stats.rating, 'Average rating'],
  ]

  return (
    <section id="about" className="py-20 md:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Photo */}
          <div className="h-[340px] md:h-[560px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lawn3.jpg" alt="A residential lawn maintained by Gray Wolf Workers"
              className="w-full h-full object-cover" />
          </div>

          {/* Text */}
          <div>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Who we are</p>
            <h2 className="text-4xl md:text-[44px] font-extrabold tracking-tight leading-[1.08] mb-7" style={{ color: '#181b15' }}>
              Your neighbors, not a franchise.
            </h2>
            <p className="text-[15.5px] leading-relaxed mb-5" style={{ color: '#5b6354' }}>
              Gray Wolf Workers started right here in Kendallville. There is no call center and no
              corporate office — when you text us, you are talking to the people who will be standing
              on your lawn.
            </p>
            <p className="text-[15.5px] leading-relaxed mb-10" style={{ color: '#5b6354' }}>
              From the first cut of spring to the last cleanup of fall, we show up on time, do the job
              right, and leave your property looking like someone cares about it. Because we do.
            </p>

            <div className="grid grid-cols-3 gap-6 mb-10">
              {statItems.map(([n, l]) => (
                <div key={l} className="pt-4" style={{ borderTop: '2px solid #181b15' }}>
                  <p className="text-[28px] font-extrabold leading-none mb-1.5" style={{ color: '#181b15' }}>{n}</p>
                  <p className="text-xs font-medium leading-snug" style={{ color: '#5b6354' }}>{l}</p>
                </div>
              ))}
            </div>

            <Link href="/get-a-quote"
              className="inline-flex items-center font-semibold px-7 py-4 text-[15px] text-white transition-colors"
              style={{ background: '#1e3d12' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
              Text Us for a Free Quote
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Gallery ───────────────────────────────────────────────────────────────────
const FALLBACK_PHOTOS = ['/lawn1.jpg', '/lawn4.jpg', '/lawn2.jpg', '/lawn3.jpg']

function Gallery() {
  const [photos, setPhotos] = useState<string[]>([])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.storage.from('gallery')
      .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
      .then(({ data }) => {
        if (cancelled) return
        if (data && data.length > 0) {
          const urls = data
            .filter(f => f.name !== '.emptyFolderPlaceholder')
            .map(f => supabase.storage.from('gallery').getPublicUrl(f.name).data.publicUrl)
          setPhotos(urls)
        } else {
          setPhotos(FALLBACK_PHOTOS)
        }
      })
      .catch(() => { if (!cancelled) setPhotos(FALLBACK_PHOTOS) })
    return () => { cancelled = true }
  }, [])

  const shown = photos.slice(0, visible)
  const hasMore = visible < photos.length

  return (
    <>
      <section id="work" className="py-20 md:py-28" style={{ background: '#181b15' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="md:flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-bold uppercase mb-4" style={{ color: '#8fc472', letterSpacing: '0.16em' }}>Our work</p>
              <h2 className="text-4xl md:text-[44px] font-extrabold tracking-tight text-white">
                Real yards. Real results.
              </h2>
            </div>
            <p className="mt-5 md:mt-0 max-w-sm text-[15px] leading-relaxed" style={{ color: '#9aa192' }}>
              Every photo here is a property we maintain — no stock images, no staging.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {shown.map((url, i) => (
              <div
                key={url}
                onClick={() => setLightbox(url)}
                className={`cursor-pointer overflow-hidden ${
                  i === 0 ? 'col-span-2 aspect-[16/9] md:aspect-[4/3]' : 'aspect-square'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`A lawn maintained by Gray Wolf Workers — photo ${i + 1}`}
                  className="w-full h-full object-cover transition-opacity hover:opacity-85"
                />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="font-semibold px-8 py-3.5 text-sm text-white transition-colors"
                style={{ border: '1px solid #3a4033' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#8fc472')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#3a4033')}
              >
                Load More Photos
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(12,14,10,0.94)' }}
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: '90vh', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white text-3xl font-light leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

// ── Service Areas ─────────────────────────────────────────────────────────────
function Areas() {
  return (
    <section id="areas" className="py-20 md:py-28" style={{ background: '#f4f4ee' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="md:flex items-end justify-between mb-14">
          <div>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Where we work</p>
            <h2 className="text-4xl md:text-[44px] font-extrabold tracking-tight" style={{ color: '#181b15' }}>
              Based in Kendallville.<br />Serving Northeast Indiana.
            </h2>
          </div>
          <p className="mt-5 md:mt-0 max-w-sm text-[15px] leading-relaxed" style={{ color: '#5b6354' }}>
            Don&apos;t see your town? Text us your address — if we can get to you, we will.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
          {SERVICE_AREAS.map(({ county, towns }) => (
            <div key={county} className="pt-4" style={{ borderTop: '2px solid #181b15' }}>
              <p className="font-bold text-sm mb-3.5" style={{ color: '#181b15' }}>{county}</p>
              <ul className="space-y-2 text-[14px]" style={{ color: '#5b6354' }}>
                {towns.map(t => (
                  <li key={t} style={t === 'Kendallville' ? { color: '#2f6418', fontWeight: 600 } : {}}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="py-20 md:py-24" style={{ background: '#1e3d12' }}>
      <div className="max-w-6xl mx-auto px-5 md:flex items-center justify-between gap-10">
        <div className="mb-8 md:mb-0">
          <h2 className="text-3xl md:text-[40px] font-extrabold text-white tracking-tight leading-tight mb-3">
            Get your price in under a minute.
          </h2>
          <p className="text-[15.5px] max-w-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
            Text us your address and we&apos;ll send back an honest quote — no calls, no salespeople,
            no obligation. New customers get 75% off their first month.
          </p>
        </div>
        <Link href="/get-a-quote"
          className="shrink-0 inline-flex items-center justify-center font-bold px-9 py-4 text-[15px] transition-colors"
          style={{ background: '#fff', color: '#1e3d12' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e9f0e4')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          Get a Free Quote
        </Link>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="pt-16 pb-8" style={{ background: '#181b15', color: '#9aa192' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
              <span className="font-bold text-white text-sm leading-tight">Gray Wolf Workers</span>
            </div>
            <p className="text-sm leading-relaxed">
              Professional lawn care serving Kendallville and Northeast Indiana. Local, reliable, and proud of it.
            </p>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Company</p>
            <ul className="space-y-2.5 text-sm">
              {[['#services', 'Services'], ['#about', 'About Us'], ['#work', 'Our Work'], ['#areas', 'Service Areas']].map(([h, l]) => (
                <li key={l}><a href={h} className="hover:text-white transition-colors">{l}</a></li>
              ))}
              <li>
                <Link href="/get-a-quote" className="font-semibold hover:text-white transition-colors" style={{ color: '#8fc472' }}>
                  Get a Free Quote
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Areas We Serve</p>
            <ul className="space-y-2 text-sm">
              {['Kendallville', 'Albion', 'Avilla', 'Rome City', 'Auburn', 'Garrett', 'LaGrange'].map(a => (
                <li key={a} style={a === 'Kendallville' ? { color: '#8fc472', fontWeight: 500 } : {}}>{a}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Contact</p>
            <ul className="space-y-3 text-sm">
              <li>Kendallville, IN 46755</li>
              <li>
                <a href="mailto:graywolfworkers@gmail.com" className="hover:text-white transition-colors break-all">
                  graywolfworkers@gmail.com
                </a>
              </li>
              <li className="pt-2">
                <Link href="/get-a-quote"
                  className="inline-block font-semibold px-5 py-2.5 text-xs text-white transition-colors"
                  style={{ background: '#1e3d12' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
                  Text Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs"
          style={{ borderTop: '1px solid #2a2e25', color: '#6b7263' }}>
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC. All rights reserved.</p>
          <p>Kendallville, Indiana · Northeast Indiana&apos;s lawn care crew</p>
        </div>
      </div>
    </footer>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="antialiased bg-white">
      <TopBar />
      <Nav />
      <Hero />
      <Services />
      <About />
      <Gallery />
      <Areas />
      <CTABanner />
      <Footer />
    </div>
  )
}
