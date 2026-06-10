'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 9

// ─── Design system ─────────────────────────────────────────────────────────────
// Modeled on the conversion structure of the big national lawn brands
// (Lawn Doctor, Weed Man, Lawn Love): address capture in the hero, trust
// signals above the fold, stats bar, how-it-works, guarantee, repeated CTAs,
// FAQ, and a deep footer. Flat solid colors, real photography, no gradients.
//
//   pine:   #122b0a   darkest green (hero scrim, footer)
//   forest: #1e3d12   primary brand green
//   grass:  #2f6418   buttons hover / accents
//   lime:   #8fd16f   bright accent on dark
//   gold:   #e9b949   stars / offer
//   paper:  #ffffff
//   stone:  #f4f4ee   warm section background
//   ink:    #181b15   headings on light
//   muted:  #5b6354   body text on light

const TOWNS_BY_COUNTY: Array<{ county: string; towns: string[] }> = [
  { county: 'Noble County',      towns: ['Kendallville', 'Albion', 'Avilla', 'Rome City', 'Ligonier', 'Wolcottville'] },
  { county: 'DeKalb County',     towns: ['Auburn', 'Garrett', 'Waterloo'] },
  { county: 'LaGrange County',   towns: ['LaGrange', 'Howe'] },
  { county: 'Whitley & Steuben', towns: ['Columbia City', 'Churubusco', 'Angola'] },
]

const SERVICES = [
  {
    img: '/lawn1.jpg',
    title: 'Lawn Mowing',
    desc: 'Weekly or bi-weekly cuts on a schedule you can set your watch to.',
    points: ['Sharp blades, even cut', 'Clippings handled', 'Same crew every visit'],
  },
  {
    img: '/lawn4.jpg',
    title: 'Trimming & Edging',
    desc: 'Crisp lines along every driveway, sidewalk, and flower bed — included with every mow.',
    points: ['Driveways & walkways', 'Beds & tree rings', 'Blown clean after'],
  },
  {
    img: '/lawn3.jpg',
    title: 'Yard Cleanup',
    desc: 'Spring and fall cleanups, leaf removal, and debris hauling.',
    points: ['Leaf removal', 'Storm debris', 'Haul-away included'],
  },
  {
    img: '/lawn2.jpg',
    title: 'Add-On Services',
    desc: 'Fertilization, mulching, and custom work — tell us what your yard needs.',
    points: ['Fertilization', 'Mulch & beds', 'By-request work'],
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Tell us your address',
    desc: 'That is genuinely all we need. No forms with twelve fields, no waiting for a callback.',
  },
  {
    n: '2',
    title: 'Get your exact price',
    desc: 'We measure your lawn using satellite and property data and text you a real price — usually in under a minute.',
  },
  {
    n: '3',
    title: 'We handle the rest',
    desc: 'Your crew shows up on schedule and keeps your lawn sharp all season. You never think about it again.',
  },
]

const FAQS = [
  {
    q: 'How does pricing work?',
    a: 'Your price is based on the actual size of your lawn — we measure it with satellite and property data, so you get a real number up front, not an estimate that changes later. The price we text you is the price you pay.',
  },
  {
    q: 'Do I have to sign a contract?',
    a: 'No. There are no contracts and no cancellation fees. We keep customers by doing good work, not by locking people in.',
  },
  {
    q: 'What is the 75% off first month deal?',
    a: 'New customers get 75% off their entire first month of service. It is not a free trial with a catch — you simply commit to your first month, and we take 75% off it. It is how we earn your business.',
  },
  {
    q: 'What areas do you serve?',
    a: 'We are based in Kendallville and serve Noble County and the surrounding area — Albion, Avilla, Rome City, Ligonier, Auburn, Garrett, LaGrange, and more. If you are nearby, send your address and we will tell you straight.',
  },
  {
    q: 'When will you mow my lawn?',
    a: 'You will be on a consistent weekly or bi-weekly schedule with the same crew, and we let you know when we are coming. If weather pushes us, we make it up — your lawn never gets skipped.',
  },
  {
    q: 'Are you insured?',
    a: 'Yes — fully insured, and locally owned right here in Kendallville. When you text us, you are talking to the people who will actually be on your lawn.',
  },
]

// ─── Shared: address capture form (the conversion engine) ──────────────────────
function AddressForm({ dark = false, id }: { dark?: boolean; id?: string }) {
  const router = useRouter()
  const [street, setStreet] = useState('')

  function go(e: React.FormEvent) {
    e.preventDefault()
    const q = street.trim() ? `?street=${encodeURIComponent(street.trim())}` : ''
    router.push(`/get-a-quote${q}`)
  }

  return (
    <form onSubmit={go} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xl">
      <input
        id={id}
        type="text"
        value={street}
        onChange={e => setStreet(e.target.value)}
        placeholder="Enter your street address"
        aria-label="Street address"
        className="flex-1 px-5 py-4 text-[15px] outline-none"
        style={dark
          ? { background: '#fff', color: '#181b15', border: '1px solid #fff' }
          : { background: '#fff', color: '#181b15', border: '1px solid #d4d4c8' }}
      />
      <button
        type="submit"
        className="shrink-0 font-bold px-8 py-4 text-[15px] text-white transition-colors"
        style={{ background: dark ? '#2f6418' : '#1e3d12' }}
        onMouseEnter={e => (e.currentTarget.style.background = dark ? '#3c7d22' : '#2f6418')}
        onMouseLeave={e => (e.currentTarget.style.background = dark ? '#2f6418' : '#1e3d12')}
      >
        See My Price
      </button>
    </form>
  )
}

function Stars() {
  return (
    <span aria-hidden style={{ color: '#e9b949', letterSpacing: '2px' }}>★★★★★</span>
  )
}

// ─── Top bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div style={{ background: '#122b0a' }}>
      <div className="max-w-6xl mx-auto px-5 h-10 flex items-center justify-between text-xs text-white/90">
        <p className="font-semibold tracking-wide">
          <span style={{ color: '#e9b949' }}>Limited time:</span> new customers get <span className="font-bold text-white">75% off their first month</span>
        </p>
        <a href="mailto:graywolfworkers@gmail.com" className="hidden sm:block hover:text-white font-medium text-white/70">
          graywolfworkers@gmail.com
        </a>
      </div>
    </div>
  )
}

// ─── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false)

  const links = [
    ['#services', 'Services'],
    ['#how', 'How It Works'],
    ['#work', 'Our Work'],
    ['#areas', 'Service Areas'],
    ['#faq', 'FAQ'],
  ]

  return (
    <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #e2e2d8' }}>
      <div className="max-w-6xl mx-auto px-5 h-[72px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gray Wolf Workers" className="w-11 h-11 object-contain" />
          <span className="leading-tight">
            <span className="block font-extrabold text-[16px] tracking-tight" style={{ color: '#181b15' }}>Gray Wolf Workers</span>
            <span className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: '#2f6418' }}>Lawn Care · Kendallville, IN</span>
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-7 text-[14px] font-semibold" style={{ color: '#41483b' }}>
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-[#1e3d12] transition-colors">{label}</a>
          ))}
        </nav>

        <Link href="/get-a-quote"
          className="hidden lg:inline-flex items-center font-bold px-6 py-3 text-sm text-white transition-colors"
          style={{ background: '#1e3d12' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
          Get My Price
        </Link>

        <button onClick={() => setOpen(o => !o)} className="lg:hidden p-2" aria-label="Menu" style={{ color: '#181b15' }}>
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-white px-5 pb-5 pt-2" style={{ borderTop: '1px solid #e2e2d8' }}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block py-3 text-sm font-semibold" style={{ color: '#41483b', borderBottom: '1px solid #efefe8' }}>
              {label}
            </a>
          ))}
          <Link href="/get-a-quote" onClick={() => setOpen(false)}
            className="mt-4 w-full flex items-center justify-center font-bold py-4 text-sm text-white"
            style={{ background: '#1e3d12' }}>
            Get My Price
          </Link>
        </div>
      )}
    </header>
  )
}

// ─── Hero — photo + address capture, the national-brand pattern ────────────────
function Hero({ rating }: { rating: string }) {
  return (
    <section id="top" className="relative">
      {/* Real photo, solid scrim for legibility (no gradients) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn2.jpg" alt="A lawn maintained by Gray Wolf Workers in Kendallville, Indiana"
        className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: '#122b0a', opacity: 0.78 }} />

      <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-32">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5 mb-7 text-[13px] font-semibold text-white/85">
            <Stars />
            <span>Rated {rating} by homeowners across Noble County</span>
          </div>

          <h1 className="text-[44px] sm:text-[56px] md:text-[64px] font-extrabold text-white leading-[1.02] tracking-tight mb-6">
            A perfect lawn.<br />Zero effort.
          </h1>

          <p className="text-[17px] md:text-[19px] leading-relaxed mb-9 max-w-lg" style={{ color: 'rgba(255,255,255,0.82)' }}>
            Enter your address and get your exact mowing price in under a minute —
            measured by satellite, honored all season. No contracts. No surprises.
          </p>

          <AddressForm dark id="hero-address" />

          <ul className="flex flex-wrap gap-x-7 gap-y-2.5 mt-8 text-[13px] font-semibold text-white/80">
            {['Price in under a minute', 'Locally owned & insured', 'No contracts, cancel anytime'].map(t => (
              <li key={t} className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5" style={{ background: '#8fd16f' }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: { years: string; lawns: string; rating: string } }) {
  const items = [
    [stats.years, 'Years serving Northeast Indiana'],
    [stats.lawns, 'Lawns maintained'],
    [stats.rating, 'Average customer rating'],
    ['75%', 'Off your first month'],
  ]
  return (
    <section style={{ background: '#1e3d12' }}>
      <div className="max-w-6xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
        {items.map(([n, l]) => (
          <div key={l}>
            <p className="text-[32px] md:text-[38px] font-extrabold text-white leading-none mb-2">{n}</p>
            <p className="text-[12.5px] font-medium leading-snug" style={{ color: '#9fc18d' }}>{l}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how" className="py-20 md:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>How it works</p>
          <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight leading-[1.06]" style={{ color: '#181b15' }}>
            From address to perfect lawn in three steps.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10 md:gap-8">
          {STEPS.map(s => (
            <div key={s.n} className="relative pt-6" style={{ borderTop: '3px solid #1e3d12' }}>
              <span className="absolute -top-7 left-0 text-[64px] font-extrabold leading-none select-none" style={{ color: '#eef2e9' }}>
                {s.n}
              </span>
              <h3 className="relative text-xl font-bold tracking-tight mb-3" style={{ color: '#181b15' }}>{s.title}</h3>
              <p className="relative text-[15px] leading-relaxed" style={{ color: '#5b6354' }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col sm:flex-row sm:items-center gap-5">
          <Link href="/get-a-quote"
            className="inline-flex items-center justify-center font-bold px-8 py-4 text-[15px] text-white transition-colors"
            style={{ background: '#1e3d12' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
            Get My Price Now
          </Link>
          <p className="text-[13px] font-medium" style={{ color: '#5b6354' }}>
            Takes under a minute. No phone calls, no salespeople.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Services — photo cards like the national brands ──────────────────────────
function Services() {
  return (
    <section id="services" className="py-20 md:py-28" style={{ background: '#f4f4ee' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="md:flex items-end justify-between mb-14">
          <div>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Services</p>
            <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight" style={{ color: '#181b15' }}>
              Everything your lawn needs.
            </h2>
          </div>
          <p className="mt-5 md:mt-0 max-w-sm text-[15px] leading-relaxed" style={{ color: '#5b6354' }}>
            One crew, one standard, one simple price. Every photo below is our actual work.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SERVICES.map(s => (
            <div key={s.title} className="bg-white flex flex-col" style={{ border: '1px solid #e2e2d8' }}>
              <div className="aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={`${s.title} by Gray Wolf Workers`} className="w-full h-full object-cover" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-lg font-bold tracking-tight mb-2" style={{ color: '#181b15' }}>{s.title}</h3>
                <p className="text-[13.5px] leading-relaxed mb-4" style={{ color: '#5b6354' }}>{s.desc}</p>
                <ul className="mt-auto space-y-1.5">
                  {s.points.map(p => (
                    <li key={p} className="flex items-center gap-2 text-[13px] font-medium" style={{ color: '#41483b' }}>
                      <span className="inline-block w-1.5 h-1.5 shrink-0" style={{ background: '#2f6418' }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Guarantee ─────────────────────────────────────────────────────────────────
function Guarantee() {
  const points = [
    {
      title: 'We make it right',
      desc: 'Not happy with a cut? Tell us within 24 hours and we will come back and fix it. No arguing, no hassle.',
    },
    {
      title: 'Your price is your price',
      desc: 'The quote we text you is what you pay. No fuel surcharges appearing later, no "actually it took longer".',
    },
    {
      title: 'No contracts, ever',
      desc: 'Cancel any time with a text. We keep customers by doing good work, not with cancellation fees.',
    },
  ]
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>The Gray Wolf promise</p>
            <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight leading-[1.06] mb-10" style={{ color: '#181b15' }}>
              Big-company polish. Hometown accountability.
            </h2>
            <div className="space-y-8">
              {points.map(p => (
                <div key={p.title} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center" style={{ background: '#1e3d12' }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-[16.5px] mb-1.5" style={{ color: '#181b15' }}>{p.title}</h3>
                    <p className="text-[14.5px] leading-relaxed" style={{ color: '#5b6354' }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[360px] md:h-[560px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lawn3.jpg" alt="A freshly maintained residential lawn in Northeast Indiana"
              className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Mid-page CTA (Weed Man's "stop working on your lawn" pattern) ─────────────
function MidCTA() {
  return (
    <section className="py-16 md:py-20" style={{ background: '#122b0a' }}>
      <div className="max-w-6xl mx-auto px-5 md:flex items-center justify-between gap-10">
        <div className="mb-7 md:mb-0 max-w-lg">
          <h2 className="text-3xl md:text-[38px] font-extrabold text-white tracking-tight leading-tight mb-3">
            Stop spending your weekends mowing.
          </h2>
          <p className="text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
            Your exact price is one address away — and your first month is 75% off.
          </p>
        </div>
        <div className="w-full md:max-w-xl">
          <AddressForm dark id="mid-address" />
        </div>
      </div>
    </section>
  )
}

// ─── Gallery ───────────────────────────────────────────────────────────────────
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
      <section id="work" className="py-20 md:py-28" style={{ background: '#f4f4ee' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="md:flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Our work</p>
              <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight" style={{ color: '#181b15' }}>
                Real yards. Real results.
              </h2>
            </div>
            <p className="mt-5 md:mt-0 max-w-sm text-[15px] leading-relaxed" style={{ color: '#5b6354' }}>
              Every photo is a property we maintain — no stock images, no staging.
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
                className="font-bold px-8 py-3.5 text-sm transition-colors"
                style={{ border: '2px solid #1e3d12', color: '#1e3d12' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1e3d12'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1e3d12' }}
              >
                Load More Photos
              </button>
            </div>
          )}
        </div>
      </section>

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

// ─── Service areas ─────────────────────────────────────────────────────────────
function Areas() {
  return (
    <section id="areas" className="py-20 md:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="md:flex items-end justify-between mb-14">
          <div>
            <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Where we work</p>
            <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight leading-[1.06]" style={{ color: '#181b15' }}>
              Based in Kendallville.<br />Serving Northeast Indiana.
            </h2>
          </div>
          <p className="mt-5 md:mt-0 max-w-sm text-[15px] leading-relaxed" style={{ color: '#5b6354' }}>
            Don&apos;t see your town? Enter your address anyway — if we can get to you, we will.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
          {TOWNS_BY_COUNTY.map(({ county, towns }) => (
            <div key={county} className="pt-4" style={{ borderTop: '3px solid #1e3d12' }}>
              <p className="font-bold text-sm mb-3.5" style={{ color: '#181b15' }}>{county}</p>
              <ul className="space-y-2 text-[14px]" style={{ color: '#5b6354' }}>
                {towns.map(t => (
                  <li key={t} style={t === 'Kendallville' ? { color: '#2f6418', fontWeight: 700 } : {}}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ───────────────────────────────────────────────────────────────────────
function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <section id="faq" className="py-20 md:py-28" style={{ background: '#f4f4ee' }}>
      <div className="max-w-3xl mx-auto px-5">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Questions</p>
          <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight" style={{ color: '#181b15' }}>
            Straight answers.
          </h2>
        </div>

        <div style={{ borderTop: '1px solid #d8d8cc' }}>
          {FAQS.map((f, i) => (
            <div key={i} style={{ borderBottom: '1px solid #d8d8cc' }}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-bold text-[16px]" style={{ color: '#181b15' }}>{f.q}</span>
                <span className="shrink-0 text-2xl font-light leading-none" style={{ color: '#2f6418' }}>
                  {openIdx === i ? '−' : '+'}
                </span>
              </button>
              {openIdx === i && (
                <p className="pb-6 text-[14.5px] leading-relaxed max-w-2xl" style={{ color: '#5b6354' }}>{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn1.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: '#122b0a', opacity: 0.84 }} />
      <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 text-center">
        <h2 className="text-4xl md:text-[52px] font-extrabold text-white tracking-tight leading-[1.05] mb-5">
          Your lawn could be next.
        </h2>
        <p className="text-[16px] md:text-[17px] mb-9 max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Get your exact price in under a minute — and take 75% off your first month while the offer lasts.
        </p>
        <div className="flex justify-center">
          <AddressForm dark id="final-address" />
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="pt-16 pb-8" style={{ background: '#0d1d07', color: '#9aa192' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-10 h-10 object-contain" />
              <span className="font-bold text-white text-sm leading-tight">Gray Wolf Workers</span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              Professional lawn care for Kendallville and Northeast Indiana. Locally owned, fully insured.
            </p>
            <p className="text-[13px] font-semibold" style={{ color: '#e9b949' }}>
              ★★★★★ Rated by local homeowners
            </p>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-4">Services</p>
            <ul className="space-y-2.5 text-sm">
              {SERVICES.map(s => (
                <li key={s.title}><a href="#services" className="hover:text-white transition-colors">{s.title}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-4">Areas We Serve</p>
            <ul className="space-y-2 text-sm">
              {['Kendallville', 'Albion', 'Avilla', 'Rome City', 'Auburn', 'Garrett', 'LaGrange'].map(a => (
                <li key={a} style={a === 'Kendallville' ? { color: '#8fd16f', fontWeight: 600 } : {}}>{a}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-4">Get Started</p>
            <ul className="space-y-3 text-sm">
              <li>Kendallville, IN 46755</li>
              <li>
                <a href="mailto:graywolfworkers@gmail.com" className="hover:text-white transition-colors break-all">
                  graywolfworkers@gmail.com
                </a>
              </li>
              <li className="pt-2">
                <Link href="/get-a-quote"
                  className="inline-block font-bold px-6 py-3 text-xs text-white transition-colors"
                  style={{ background: '#2f6418' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#3c7d22')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#2f6418')}>
                  Get My Price
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs"
          style={{ borderTop: '1px solid #1f3315', color: '#6b7263' }}>
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC. All rights reserved.</p>
          <p>Kendallville, Indiana · Northeast Indiana&apos;s lawn care crew</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
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

  return (
    <div className="antialiased bg-white">
      <TopBar />
      <Nav />
      <Hero rating={stats.rating} />
      <StatsBar stats={stats} />
      <HowItWorks />
      <Services />
      <Guarantee />
      <MidCTA />
      <Gallery />
      <Areas />
      <Faq />
      <FinalCTA />
      <Footer />
    </div>
  )
}
