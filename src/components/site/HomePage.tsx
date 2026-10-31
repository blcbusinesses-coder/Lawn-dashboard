'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Design system: see /DESIGN.md. Colors are --color-gw-* tokens in globals.css.
// Mowing-first: the page pushes weekly lawn mowing; cleanup and mulching are
// add-ons. Social proof (rating, years, lawn count) only renders when the
// owner has set real values in site_settings — never hard-coded defaults.
// TODO: add a reviews section once real customer quotes are available.

const NOBLE_TOWNS = ['Kendallville', 'Albion', 'Avilla', 'Rome City', 'Ligonier', 'Wolcottville', 'Cromwell', 'Wawaka']

const WHY = [
  { title: 'Never more than a third', desc: 'Cutting off too much at once stresses grass. A steady weekly schedule keeps every cut small and the lawn thick.' },
  { title: 'Sharp blades, clean cut', desc: 'Dull blades tear grass and leave brown, frayed tips. We keep blades sharp so your lawn heals fast and looks even.' },
  { title: 'Consistency beats catch-up', desc: 'Skipping a week in May means a scalped, stressed lawn. A fixed schedule means you never have to think about it.' },
]

const ADDONS = [
  { img: '/lawn3.jpg', title: 'Yard cleanup', desc: 'Spring and fall cleanups, leaf removal and debris hauling.' },
  { img: '/lawn2.jpg', title: 'Mulching', desc: 'Fresh mulch, edged and laid clean, so your beds match your lawn.' },
]

const FAQS = [
  { q: 'How does mowing pricing work?', a: 'Your price is based on the actual size of your lawn. We measure it with satellite and property data, so you get a real number up front. The price we text you is the price you pay.' },
  { q: 'Weekly or bi-weekly?', a: 'Weekly keeps grass shortest-cut and healthiest, and is what we recommend through the growing season. Bi-weekly works for slower-growing lawns or tighter budgets. You can change it any time.' },
  { q: 'Do I have to sign a contract?', a: 'No. There are no contracts and no cancellation fees. We keep customers by doing good work, not by locking people in.' },
  { q: 'How does the 25% off first month deal work?', a: 'New customers get 25% off their entire first month of mowing. On a typical weekly schedule, that works out to a free mow. No coupon codes; the discount is applied automatically when you start.' },
  { q: 'What areas do you serve?', a: 'We are based in Kendallville and serve Noble County: Albion, Avilla, Rome City, Ligonier, Wolcottville, Cromwell and the surrounding area. Just outside the county? Send your address and we will tell you straight.' },
  { q: 'Are you insured?', a: 'Yes. We are fully insured and locally owned right here in Kendallville.' },
]

const BTN_FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gw-lime'

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.16em] mb-4 ${light ? 'text-gw-lime' : 'text-gw-grass'}`}>
      {children}
    </p>
  )
}

function CtaLink({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <Link
      href="/get-a-quote"
      className={`inline-flex items-center justify-center min-h-12 px-8 py-4 text-[15px] font-bold text-white transition-colors ${BTN_FOCUS} ${
        light ? 'bg-gw-grass hover:bg-[#3c7d22]' : 'bg-gw-forest hover:bg-gw-grass'
      }`}
    >
      {children}
    </Link>
  )
}

// ─── Address capture (the conversion engine) ───────────────────────────────────
function AddressForm({ id, label = 'See My Price' }: { id?: string; label?: string }) {
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
        autoComplete="street-address"
        className="flex-1 min-h-12 px-5 py-4 text-[15px] bg-white text-gw-ink border border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gw-lime"
      />
      <button type="submit" className={`shrink-0 min-h-12 font-bold px-8 py-4 text-[15px] text-white bg-gw-grass hover:bg-[#3c7d22] transition-colors ${BTN_FOCUS}`}>
        {label}
      </button>
    </form>
  )
}

// ─── Top bar ───────────────────────────────────────────────────────────────────
function TopBar() {
  return (
    <div className="bg-gw-pine">
      <div className="max-w-6xl mx-auto px-5 min-h-10 py-2 flex items-center justify-between text-xs text-white/90">
        <p className="font-semibold tracking-wide">
          <span className="text-gw-gold">New mowing customers:</span> <span className="font-bold text-white">25% off your first month</span>
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
    ['#mowing', 'Lawn Mowing'],
    ['#how', 'How It Works'],
    ['#addons', 'Add-ons'],
    ['/portfolio', 'Portfolio'],
    ['#areas', 'Service Areas'],
    ['#faq', 'FAQ'],
  ]

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gw-line">
      <div className="max-w-6xl mx-auto px-5 h-[72px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-11 h-11 object-contain" />
          <span className="leading-tight">
            <span className="block font-extrabold text-[16px] tracking-tight text-gw-ink">Gray Wolf Workers</span>
            <span className="block text-[11px] font-semibold tracking-wide uppercase text-gw-grass">Lawn Mowing · Kendallville, IN</span>
          </span>
        </a>

        <nav aria-label="Main" className="hidden xl:flex items-center gap-7 text-[14px] whitespace-nowrap font-semibold text-gw-muted">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-gw-forest transition-colors">{label}</a>
          ))}
        </nav>

        <Link href="/get-a-quote" className={`hidden xl:inline-flex items-center whitespace-nowrap font-bold px-6 py-3 text-sm text-white bg-gw-forest hover:bg-gw-grass transition-colors ${BTN_FOCUS}`}>
          Get My Mowing Price
        </Link>

        <button
          onClick={() => setOpen(o => !o)}
          className="xl:hidden p-3 text-gw-ink"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          <span className="block space-y-1.5" aria-hidden>
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-current transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </span>
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="xl:hidden bg-white px-5 pb-5 pt-2 border-t border-gw-line">
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block py-3.5 text-sm font-semibold text-gw-muted border-b border-gw-line">
              {label}
            </a>
          ))}
          <Link href="/get-a-quote" onClick={() => setOpen(false)} className="mt-4 w-full flex items-center justify-center font-bold py-4 text-sm text-white bg-gw-forest">
            Get My Mowing Price
          </Link>
        </div>
      )}
    </header>
  )
}

// ─── Hero (unchanged design) ───────────────────────────────────────────────────
function Hero({ rating }: { rating: string | null }) {
  return (
    <section id="top" className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn2.jpg" alt="A lawn mowed by Gray Wolf Workers in Kendallville, Indiana" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gw-pine opacity-[0.78]" />

      <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-32">
        <div className="max-w-2xl">
          {rating && (
            <div className="flex items-center gap-2.5 mb-7 text-[13px] font-semibold text-white/85">
              <span aria-hidden className="text-gw-gold tracking-[2px]">★★★★★</span>
              <span>Rated {rating} by homeowners across Noble County</span>
            </div>
          )}

          <h1 className="text-[44px] sm:text-[56px] md:text-[64px] font-extrabold text-white leading-[1.02] tracking-tight mb-6">
            A perfect lawn.<br />Zero effort.
          </h1>

          <p className="text-[17px] md:text-[19px] leading-relaxed mb-9 max-w-lg text-white/85">
            Weekly lawn mowing, priced to your exact lawn. Enter your address and get your
            mowing price in under a minute. No contracts. No surprises.
          </p>

          <AddressForm id="hero-address" />

          <ul className="flex flex-wrap gap-x-7 gap-y-2.5 mt-8 text-[13px] font-semibold text-white/85">
            {['Price in under a minute', 'Locally owned & insured', 'No contracts, cancel anytime'].map(t => (
              <li key={t} className="flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 bg-gw-lime" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ─── Core services (glassy white, directly under the hero) ─────────────────────
// Photos are temporary stand-ins; swap the `img` paths when the real ones arrive.
const CORE_SERVICES = [
  { img: '/lawn1.jpg', title: 'Mowing', desc: 'Weekly or bi-weekly cuts with sharp blades, on a schedule you can count on.' },
  { img: '/lawn2.jpg', title: 'Mulching', desc: 'Fresh mulch laid clean so your beds look as good as your lawn.' },
  { img: '/lawn3.jpg', title: 'Bush Trimming', desc: 'Shrubs and hedges shaped neatly and the clippings cleaned up.' },
  { img: '/lawn4.jpg', title: 'Edging', desc: 'Crisp lines along driveways, walks and beds, at every visit.' },
]

function CoreServices() {
  return (
    <section id="mowing" className="relative overflow-hidden scroll-mt-20">
      {/* Soft lawn wash behind the glass so the blur has something to frost */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn1.jpg" alt="" aria-hidden loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-white/80 backdrop-blur-2xl" />
      {/* Faded cutout of the crew trimming, behind the glass cards (edges feathered in the file) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/trimming-cutout.webp"
        alt=""
        aria-hidden
        loading="lazy"
        className="pointer-events-none select-none absolute -right-16 top-0 h-[80%] md:right-[3%] md:h-[108%] w-auto max-w-none opacity-55"
      />

      <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-24">
        <div className="max-w-2xl mb-12">
          <Eyebrow>What we do</Eyebrow>
          <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight leading-[1.06] text-gw-ink mb-4">
            Four things, done right.
          </h2>
          <p className="text-[16px] leading-relaxed text-gw-muted">
            Mowing is the heart of what we do, and everything else keeps your property looking sharp all season.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CORE_SERVICES.map(s => (
            <div key={s.title} className="bg-white/70 backdrop-blur-md border border-white shadow-[0_8px_30px_rgba(18,43,10,0.08)] flex flex-col">
              <div className="aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={`${s.title} by Gray Wolf Workers`} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold tracking-tight mb-2 text-gw-ink">{s.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-gw-muted">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4">
          <CtaLink>See My Mowing Price</CtaLink>
          <p className="text-[13px] font-semibold text-gw-muted">New customers get 25% off their first month.</p>
        </div>
      </div>
    </section>
  )
}

// ─── Guarantees (thin band, uploaded photo behind frosted glass) ───────────────
const GUARANTEES = [
  { title: 'Accurate Quotes', desc: 'Measured from satellite and property data. The price we text you is the price you pay.' },
  { title: 'Full-Service Mowing', desc: 'Every mow includes trimming and edging, with driveways and walks blown clean.' },
  { title: 'No Contracts', desc: 'Cancel anytime with a text. No cancellation fees.' },
  { title: 'We Make It Right', desc: 'Not happy with a cut? Tell us within 24 hours and we will come back and fix it.' },
]

function Guarantees() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="guarantees-heading">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn-guarantee.jpg" alt="" aria-hidden loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gw-pine/55" />

      <div className="relative max-w-6xl mx-auto px-5 py-14 md:py-16">
        <div className="bg-white/[0.12] backdrop-blur-xl border border-white/25 px-6 py-8 md:px-10 md:py-10">
          <h2 id="guarantees-heading" className="text-2xl md:text-[30px] font-extrabold tracking-tight text-white mb-8">
            The Gray Wolf Guarantee
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-7">
            {GUARANTEES.map(g => (
              <div key={g.title} className="flex gap-3">
                <svg aria-hidden className="w-5 h-5 shrink-0 text-gw-lime mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h3 className="font-bold text-[16px] text-white mb-1">{g.title}</h3>
                  <p className="text-[13.5px] leading-relaxed text-white/90">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Online quotes (replaces the three-step section) ──────────────────────────
function OnlineQuote() {
  return (
    <section id="how" className="py-20 md:py-28 bg-gw-stone scroll-mt-20">
      <div className="max-w-4xl mx-auto px-5 text-center">
        <Eyebrow>Online quotes</Eyebrow>
        <h2 className="text-4xl md:text-[56px] font-extrabold tracking-tight leading-[1.04] text-gw-ink mb-6">
          Your exact mowing price in under 1 minute.
        </h2>
        <p className="text-[18px] md:text-[20px] leading-relaxed text-gw-muted max-w-2xl mx-auto mb-4">
          Completely online. No phone calls, no waiting for a callback, no salespeople at your door.
          Just type your address and we measure your lawn from satellite and property data.
        </p>
        <p className="text-[18px] md:text-[20px] leading-relaxed font-semibold text-gw-ink max-w-2xl mx-auto mb-12">
          The price we show you is the price you pay.
        </p>

        <Link
          href="/get-a-quote"
          className={`quote-wiggle flex w-full items-center justify-center min-h-24 md:min-h-28 px-6 text-2xl md:text-4xl font-extrabold tracking-tight text-white bg-gw-grass hover:bg-gw-forest transition-colors ${BTN_FOCUS}`}
        >
          Get My Quote in Under 1 Minute
        </Link>
        <p className="mt-4 text-[13px] font-medium text-gw-subtle">No contracts. New customers get 25% off their first month.</p>
      </div>
    </section>
  )
}

// ─── Why mowing right matters ──────────────────────────────────────────────────
function WhyMowing() {
  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
        <div className="order-2 md:order-1 aspect-[4/3] md:aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lawn4.jpg" alt="Crisp trimmed edge along a driveway" loading="lazy" className="w-full h-full object-cover" />
        </div>
        <div className="order-1 md:order-2">
          <Eyebrow>Why it matters</Eyebrow>
          <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight leading-[1.06] text-gw-ink mb-10">
            A great lawn is a mowing schedule.
          </h2>
          <div className="space-y-8">
            {WHY.map(w => (
              <div key={w.title} className="border-l-4 border-gw-forest pl-5">
                <h3 className="font-bold text-[17px] mb-1.5 text-gw-ink">{w.title}</h3>
                <p className="text-[15px] leading-relaxed text-gw-muted">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Add-ons (clearly secondary) ───────────────────────────────────────────────
function AddOns() {
  return (
    <section id="addons" className="py-20 md:py-24 bg-gw-stone scroll-mt-20">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl mb-10">
          <Eyebrow>Add to your mowing</Eyebrow>
          <h2 className="text-3xl md:text-[38px] font-extrabold tracking-tight leading-[1.08] text-gw-ink">
            Need more than a mow? We have you covered.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl">
          {ADDONS.map(a => (
            <div key={a.title} className="bg-white border border-gw-line">
              <div className="aspect-[16/9] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.img} alt={`${a.title} by Gray Wolf Workers`} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold tracking-tight mb-2 text-gw-ink">{a.title}</h3>
                <p className="text-[14.5px] leading-relaxed text-gw-muted">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Mid CTA ───────────────────────────────────────────────────────────────────
function MidCTA() {
  return (
    <section className="py-16 md:py-20 bg-gw-pine">
      <div className="max-w-6xl mx-auto px-5 lg:flex items-center justify-between gap-10">
        <div className="mb-7 lg:mb-0 max-w-lg">
          <h2 className="text-3xl md:text-[38px] font-extrabold text-white tracking-tight leading-tight mb-3">
            Stop spending your weekends mowing.
          </h2>
          <p className="text-[15px] leading-relaxed text-white/75">
            Your exact mowing price is one address away, and your first month is 25% off.
          </p>
        </div>
        <div className="w-full lg:max-w-xl">
          <AddressForm id="mid-address" />
        </div>
      </div>
    </section>
  )
}

// ─── Areas ─────────────────────────────────────────────────────────────────────
function Areas() {
  return (
    <section id="areas" className="py-20 md:py-24 bg-white scroll-mt-20">
      <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-12 md:gap-20 items-center">
        <div>
          <Eyebrow>Where we mow</Eyebrow>
          <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight leading-[1.06] text-gw-ink mb-6">
            Proudly serving Noble County.
          </h2>
          <p className="text-[15.5px] leading-relaxed text-gw-muted mb-4">
            We are based in Kendallville and mow for homeowners across Noble County. Staying local keeps schedules tight and prices honest.
          </p>
          <p className="text-[15.5px] leading-relaxed text-gw-muted mb-8">
            Just outside the county line? Enter your address anyway. If we can get to you, we will.
          </p>
          <CtaLink>Check My Address</CtaLink>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {NOBLE_TOWNS.map(t => (
            <li key={t} className={`flex items-center gap-3 px-5 py-4 ${t === 'Kendallville' ? 'bg-gw-forest' : 'bg-gw-stone border border-gw-line'}`}>
              <span className={`inline-block w-2 h-2 shrink-0 ${t === 'Kendallville' ? 'bg-gw-lime' : 'bg-gw-grass'}`} />
              <span className={`font-bold text-[14.5px] ${t === 'Kendallville' ? 'text-white' : 'text-gw-ink'}`}>
                {t}{t === 'Kendallville' ? ' (home base)' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── FAQ (native details: works without JS) ────────────────────────────────────
function Faq() {
  return (
    <section id="faq" className="py-20 md:py-24 bg-gw-stone scroll-mt-20">
      <div className="max-w-3xl mx-auto px-5">
        <div className="mb-10">
          <Eyebrow>Questions</Eyebrow>
          <h2 className="text-4xl md:text-[46px] font-extrabold tracking-tight text-gw-ink">Straight answers.</h2>
        </div>
        <div className="border-t border-[#d8d8cc]">
          {FAQS.map((f, i) => (
            <details key={f.q} open={i === 0} className="group border-b border-[#d8d8cc]">
              <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gw-grass">
                <span className="font-bold text-[16px] text-gw-ink">{f.q}</span>
                <span aria-hidden className="shrink-0 text-2xl font-light leading-none text-gw-grass group-open:hidden">+</span>
                <span aria-hidden className="shrink-0 text-2xl font-light leading-none text-gw-grass hidden group-open:inline">−</span>
              </summary>
              <p className="pb-6 text-[14.5px] leading-relaxed max-w-2xl text-gw-muted">{f.a}</p>
            </details>
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
      <img src="/lawn1.jpg" alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gw-pine opacity-[0.84]" />
      <div className="relative max-w-6xl mx-auto px-5 py-20 md:py-28 text-center">
        <h2 className="text-4xl md:text-[52px] font-extrabold text-white tracking-tight leading-[1.05] mb-5">
          Your lawn could be next.
        </h2>
        <p className="text-[16px] md:text-[17px] mb-9 max-w-xl mx-auto leading-relaxed text-white/85">
          Get your exact mowing price in under a minute, and take 25% off your first month.
        </p>
        <div className="flex justify-center">
          <AddressForm id="final-address" />
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="pt-16 pb-8 bg-[#0d1d07] text-[#9aa192]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-10 h-10 object-contain" />
              <span className="font-bold text-white text-sm leading-tight">Gray Wolf Workers</span>
            </div>
            <p className="text-sm leading-relaxed">
              Lawn mowing for Kendallville and Northeast Indiana. Locally owned, fully insured.
            </p>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-4">Services</p>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#mowing" className="font-semibold text-gw-lime hover:text-white transition-colors">Lawn Mowing</a></li>
              <li><a href="#addons" className="hover:text-white transition-colors">Yard Cleanup</a></li>
              <li><a href="#addons" className="hover:text-white transition-colors">Mulching</a></li>
              <li><Link href="/portfolio" className="hover:text-white transition-colors">Portfolio</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-4">Serving Noble County</p>
            <ul className="space-y-2 text-sm">
              {NOBLE_TOWNS.slice(0, 7).map(a => (
                <li key={a} className={a === 'Kendallville' ? 'text-gw-lime font-semibold' : ''}>{a}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white font-bold text-sm mb-4">Get Started</p>
            <ul className="space-y-3 text-sm">
              <li>Kendallville, IN 46755</li>
              <li>
                <a href="mailto:graywolfworkers@gmail.com" className="hover:text-white transition-colors break-all">graywolfworkers@gmail.com</a>
              </li>
              <li className="pt-2">
                <Link href="/get-a-quote" className={`inline-block font-bold px-6 py-3 text-xs text-white bg-gw-grass hover:bg-[#3c7d22] transition-colors ${BTN_FOCUS}`}>
                  Get My Mowing Price
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#8a917f] border-t border-[#1f3315]">
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC. All rights reserved.</p>
          <p>Kendallville, Indiana · Northeast Indiana&apos;s lawn mowing crew</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [stats, setStats] = useState<{ years: string | null; lawns: string | null; rating: string | null }>({
    years: null, lawns: null, rating: null,
  })

  useEffect(() => {
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase as any).from('site_settings').select('key, value').in('key', ['stat_years', 'stat_lawns', 'stat_rating'])
        .then(({ data }: { data: Array<{ key: string; value: string }> | null }) => {
          if (!data) return
          const map = Object.fromEntries(data.map(r => [r.key, r.value]))
          setStats({ years: map.stat_years ?? null, lawns: map.stat_lawns ?? null, rating: map.stat_rating ?? null })
        })
        .catch(() => {})
    } catch {
      // Stats are optional; the page renders without them.
    }
  }, [])

  return (
    <div className="antialiased bg-white">
      <TopBar />
      <Nav />
      <main>
        <Hero rating={stats.rating} />
        <CoreServices />
        <Guarantees />
        <OnlineQuote />
        <WhyMowing />
        <AddOns />
        <MidCTA />
        <Areas />
        <Faq />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
