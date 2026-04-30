'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Service areas ──────────────────────────────────────────────────────────────
const SERVICE_AREAS = [
  'Kendallville', 'Albion', 'Angola', 'Auburn', 'Avilla',
  'Churubusco', 'Columbia City', 'Garrett', 'LaGrange',
  'Ligonier', 'Rome City', 'Waterloo', 'Wolcottville',
]

const SERVICES = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9zm0 0v9m0 0l-3-3m3 3l3-3" />
      </svg>
    ),
    title: 'Lawn Mowing',
    desc: 'Weekly cuts with clean edges every time. We show up on schedule so you never have to think about it.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z" />
      </svg>
    ),
    title: 'Yard Cleanup',
    desc: 'Spring and fall cleanups, leaf hauling, and debris removal — we leave your yard looking sharp.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
      </svg>
    ),
    title: 'Trimming & Edging',
    desc: 'Crisp lines along driveways, sidewalks, and beds. The finishing touch that makes your yard stand out.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: 'Add-On Services',
    desc: 'Need something extra? From fertilization to mulching, we offer custom add-ons to fit your yard.',
  },
]

const PILLARS = [
  {
    icon: '⏰',
    title: 'Always On Time',
    desc: 'We show up when we say we will — every week, no excuses.',
  },
  {
    icon: '🛡️',
    title: 'Professional & Insured',
    desc: 'Fully insured operation so your property is always protected.',
  },
  {
    icon: '📍',
    title: 'Locally Owned',
    desc: "Born and raised in Kendallville. We're your neighbors, not a franchise.",
  },
  {
    icon: '💵',
    title: 'Fair, Flat Pricing',
    desc: 'Get an instant quote online. No surprise fees, no upsells.',
  },
]

// ── Nav ────────────────────────────────────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{ background: scrolled ? 'rgba(15,15,15,0.97)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
    >
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gray Wolf Workers" className="w-9 h-9 object-contain" />
          <span className="font-bold text-white text-base tracking-tight leading-none">
            Gray Wolf<br />
            <span className="font-normal text-amber-400 text-xs tracking-widest uppercase">Workers</span>
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-300">
          <a href="#services" className="hover:text-white transition-colors">Services</a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
          <a href="#work" className="hover:text-white transition-colors">Our Work</a>
          <a href="#areas" className="hover:text-white transition-colors">Service Areas</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/get-a-quote"
            className="bg-amber-400 hover:bg-amber-300 text-zinc-900 font-bold px-5 py-2 rounded-full text-sm transition-colors">
            Get a Free Quote →
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(o => !o)} className="md:hidden text-white p-2" aria-label="Menu">
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-zinc-950 border-t border-zinc-800 px-5 pb-5 pt-3 space-y-1">
          {[['#services','Services'],['#about','About'],['#work','Our Work'],['#areas','Service Areas']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block py-2.5 text-zinc-300 hover:text-white text-sm font-medium border-b border-zinc-800/60">
              {label}
            </a>
          ))}
          <Link href="/get-a-quote" onClick={() => setOpen(false)}
            className="mt-3 w-full flex items-center justify-center bg-amber-400 text-zinc-900 font-bold py-3 rounded-xl text-sm">
            Get a Free Quote →
          </Link>
        </div>
      )}
    </header>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="top" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background photo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn2.jpg" alt="" className="absolute inset-0 w-full h-full object-cover scale-105"
        style={{ animation: 'heroZoom 20s ease-in-out infinite alternate' }} />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70" />

      <style>{`
        @keyframes heroZoom { from { transform: scale(1.05) } to { transform: scale(1.12) } }
        @keyframes fadeUp   { from { opacity:0; transform: translateY(24px) } to { opacity:1; transform: translateY(0) } }
      `}</style>

      <div className="relative z-10 text-center px-5 max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full mb-8"
          style={{ animation: 'fadeUp 0.6s ease-out both' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Serving Northeast Indiana
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6"
          style={{ animation: 'fadeUp 0.6s ease-out 0.15s both' }}>
          Your Lawn,<br />
          <span className="text-amber-400">Done Right.</span>
        </h1>

        <p className="text-lg md:text-xl text-zinc-300 max-w-xl mx-auto mb-10 leading-relaxed"
          style={{ animation: 'fadeUp 0.6s ease-out 0.3s both' }}>
          Professional lawn care for Kendallville and surrounding communities.
          Reliable, affordable, and backed by real work — not promises.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center"
          style={{ animation: 'fadeUp 0.6s ease-out 0.45s both' }}>
          <Link href="/get-a-quote"
            className="bg-amber-400 hover:bg-amber-300 text-zinc-900 font-bold px-8 py-4 rounded-full text-base transition-all hover:scale-105 active:scale-95 shadow-lg">
            Get My Free Quote →
          </Link>
          <a href="#work"
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-full text-base transition-colors backdrop-blur-sm">
            See Our Work ↓
          </a>
        </div>
      </div>

      {/* Scroll arrow */}
      <a href="#services" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 hover:text-white transition-colors"
        aria-label="Scroll down">
        <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </a>
    </section>
  )
}

// ── Services ──────────────────────────────────────────────────────────────────
function Services() {
  return (
    <section id="services" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-16">
          <p className="text-amber-500 font-bold text-sm tracking-widest uppercase mb-3">What We Offer</p>
          <h2 className="text-4xl font-extrabold text-zinc-900 mb-4">Services Built for Your Yard</h2>
          <p className="text-zinc-500 text-lg max-w-xl mx-auto">
            We keep it simple — great work, fair prices, and a yard you&apos;re proud of.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((s, i) => (
            <div key={i} className="group p-7 rounded-2xl border border-zinc-100 hover:border-amber-200 bg-white hover:bg-amber-50/40 transition-all duration-200 hover:shadow-md">
              <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-5 group-hover:bg-amber-100 transition-colors">
                {s.icon}
              </div>
              <h3 className="font-bold text-zinc-900 text-lg mb-2">{s.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/get-a-quote"
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold px-7 py-3.5 rounded-full text-sm transition-colors">
            Get an Instant Quote
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── About ──────────────────────────────────────────────────────────────────────
function About() {
  return (
    <section id="about" className="py-24 bg-zinc-950 text-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Photo side */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lawn3.jpg" alt="Gray Wolf Workers crew at work" className="w-full h-full object-cover" />
            </div>
            {/* Floating stat card */}
            <div className="absolute -bottom-5 -right-4 md:-right-8 bg-amber-400 text-zinc-900 rounded-2xl px-6 py-4 shadow-xl">
              <p className="text-3xl font-extrabold leading-none">50+</p>
              <p className="text-xs font-bold tracking-wide mt-0.5">Happy Customers</p>
            </div>
            {/* Wolf logo watermark */}
            <div className="absolute -top-4 -left-4 md:-left-6 bg-zinc-900 border border-zinc-700 rounded-2xl p-3 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-12 h-12 object-contain" />
            </div>
          </div>

          {/* Text side */}
          <div>
            <p className="text-amber-400 font-bold text-sm tracking-widest uppercase mb-4">Our Story</p>
            <h2 className="text-4xl font-extrabold leading-tight mb-6">
              A Local Crew That<br />
              <span className="text-amber-400">Takes Pride in the Work</span>
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-5">
              Gray Wolf Workers started right here in Kendallville. We&apos;re not a big franchise with a
              call center — we&apos;re your neighbors, and we treat your yard like it&apos;s our own.
            </p>
            <p className="text-zinc-400 leading-relaxed mb-8">
              From the first cut of spring to the last cleanup in fall, we show up on time, do the job
              right, and leave your property looking its best. Every time.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {[['3+', 'Years in Business'], ['50+', 'Lawns Maintained'], ['5★', 'Average Rating']].map(([n, l]) => (
                <div key={l} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-2xl font-extrabold text-amber-400">{n}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-tight">{l}</p>
                </div>
              ))}
            </div>

            <Link href="/get-a-quote"
              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-900 font-bold px-7 py-3.5 rounded-full text-sm transition-all hover:scale-105 active:scale-95">
              Start with a Free Quote →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Why Us ────────────────────────────────────────────────────────────────────
function WhyUs() {
  return (
    <section className="py-20 bg-zinc-50 border-y border-zinc-100">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-14">
          <p className="text-amber-500 font-bold text-sm tracking-widest uppercase mb-3">Why Gray Wolf</p>
          <h2 className="text-4xl font-extrabold text-zinc-900">The Difference You&apos;ll Notice</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PILLARS.map((p, i) => (
            <div key={i} className="text-center p-7 rounded-2xl bg-white border border-zinc-100 shadow-sm">
              <div className="text-4xl mb-4">{p.icon}</div>
              <h3 className="font-bold text-zinc-900 text-base mb-2">{p.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Gallery / Our Work ────────────────────────────────────────────────────────
function Gallery() {
  return (
    <section id="work" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-14">
          <p className="text-amber-500 font-bold text-sm tracking-widest uppercase mb-3">Our Work</p>
          <h2 className="text-4xl font-extrabold text-zinc-900 mb-4">Results You Can See</h2>
          <p className="text-zinc-500 max-w-md mx-auto">
            Real yards, real results. Every property we touch gets the same attention to detail.
          </p>
        </div>

        {/* Asymmetric grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="col-span-2 md:col-span-2 row-span-1 aspect-[16/9] md:aspect-[4/3] rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lawn1.jpg" alt="Freshly mowed lawn" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="aspect-square rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lawn4.jpg" alt="Yard cleanup" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="aspect-square rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lawn2.jpg" alt="Lawn edging" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="col-span-1 md:col-span-2 aspect-square md:aspect-[16/7] rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lawn3.jpg" alt="Finished yard" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Service Areas ─────────────────────────────────────────────────────────────
function Areas() {
  return (
    <section id="areas" className="py-20 bg-amber-400">
      <div className="max-w-6xl mx-auto px-5 text-center">
        <p className="text-amber-900/70 font-bold text-sm tracking-widest uppercase mb-3">Where We Work</p>
        <h2 className="text-4xl font-extrabold text-zinc-900 mb-4">We Come to You</h2>
        <p className="text-zinc-800/70 max-w-md mx-auto mb-10">
          Based in Kendallville, Indiana — proudly serving communities across Noble, DeKalb, LaGrange, and Whitley counties.
        </p>

        <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto mb-12">
          {SERVICE_AREAS.map((area) => (
            <span key={area}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors
                ${area === 'Kendallville'
                  ? 'bg-zinc-900 text-amber-400 border-zinc-900'
                  : 'bg-white/40 text-zinc-900 border-zinc-900/20 hover:bg-white/70'}`}>
              {area === 'Kendallville' ? '★ ' : ''}{area}
            </span>
          ))}
        </div>

        <p className="text-zinc-800/60 text-sm mb-5">Don&apos;t see your city? We may still be able to help.</p>
        <Link href="/get-a-quote"
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-7 py-3.5 rounded-full text-sm transition-colors">
          Check Your Address →
        </Link>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="relative py-28 overflow-hidden bg-zinc-950">
      {/* Background photo with heavy overlay */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn4.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-zinc-950" />

      <div className="relative z-10 max-w-3xl mx-auto px-5 text-center">
        <p className="text-amber-400 font-bold text-sm tracking-widest uppercase mb-5">Get Started Today</p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
          Ready for a Lawn<br />You&apos;re Proud Of?
        </h2>
        <p className="text-zinc-400 text-lg mb-10 max-w-lg mx-auto">
          Enter your address and get a custom quote in under a minute. No calls, no salespeople.
          Just an honest price for honest work.
        </p>
        <Link href="/get-a-quote"
          className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-900 font-extrabold px-10 py-4 rounded-full text-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-400/20">
          Get My Free Quote
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-black text-zinc-400 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
              <span className="font-bold text-white text-sm leading-tight">
                Gray Wolf<br />
                <span className="text-amber-400 font-normal text-xs tracking-widest uppercase">Workers</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-500">
              Professional lawn care serving Kendallville and Northeast Indiana. Local, reliable, and proud of it.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Quick Links</p>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#services" className="hover:text-white transition-colors">Services</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#work" className="hover:text-white transition-colors">Our Work</a></li>
              <li><a href="#areas" className="hover:text-white transition-colors">Service Areas</a></li>
              <li>
                <Link href="/get-a-quote" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
                  Get a Free Quote →
                </Link>
              </li>
            </ul>
          </div>

          {/* Service areas */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Areas We Serve</p>
            <ul className="space-y-1.5 text-sm">
              {SERVICE_AREAS.slice(0, 7).map(a => (
                <li key={a} className={a === 'Kendallville' ? 'text-amber-400 font-medium' : ''}>{a}</li>
              ))}
              <li className="text-zinc-600 text-xs mt-1">+ more</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-white font-semibold text-sm mb-4">Contact</p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Kendallville, IN 46755
              </li>
              <li className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:graywolfworkers@gmail.com" className="hover:text-white transition-colors break-all">
                  graywolfworkers@gmail.com
                </a>
              </li>
              <li className="pt-2">
                <Link href="/get-a-quote"
                  className="inline-block bg-amber-400 hover:bg-amber-300 text-zinc-900 font-bold px-5 py-2.5 rounded-full text-xs transition-colors">
                  Book Online →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-zinc-800 pt-7 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-zinc-600">
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC. All rights reserved.</p>
          <p>Kendallville, Indiana · Northeast Indiana&apos;s Lawn Care Crew</p>
        </div>
      </div>
    </footer>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="antialiased">
      <Nav />
      <Hero />
      <Services />
      <About />
      <WhyUs />
      <Gallery />
      <Areas />
      <CTABanner />
      <Footer />
    </div>
  )
}
