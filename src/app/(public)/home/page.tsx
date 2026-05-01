'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Colors (matches get-a-quote palette) ──────────────────────────────────────
// dark:   #1e3d12   (headings, nav, footer)
// mid:    #2d5a1b   (buttons, accents)
// light:  #4a9030   (hover states)
// sage:   #eef3e8   (section backgrounds)
// muted:  #4a6a3a   (body text)
// border: #c8dfc0

const SERVICE_AREAS = [
  'Kendallville', 'Albion', 'Angola', 'Auburn', 'Avilla',
  'Churubusco', 'Columbia City', 'Garrett', 'LaGrange',
  'Ligonier', 'Rome City', 'Waterloo', 'Wolcottville',
]

const SERVICES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: 'Lawn Mowing',
    desc: 'Weekly cuts with clean edges every time. We show up on schedule so you never have to think about it.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7l6-4 6 4 6-4v14l-6 4-6-4-6 4V7z" />
      </svg>
    ),
    title: 'Yard Cleanup',
    desc: 'Spring and fall cleanups, leaf hauling, and debris removal — we leave your yard looking sharp.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    title: 'Trimming & Edging',
    desc: 'Crisp lines along driveways, sidewalks, and beds. The finishing touch that makes your yard stand out.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    title: 'Add-On Services',
    desc: 'Need something extra? From fertilization to mulching, we offer custom add-ons to fit your yard.',
  },
]


// ── Nav ────────────────────────────────────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(30,61,18,0.97)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}
    >
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gray Wolf Workers" className="w-9 h-9 object-contain" />
          <span className="font-bold text-white text-sm leading-tight">
            Gray Wolf Workers
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/80">
          <a href="#services" className="hover:text-white transition-colors">Services</a>
          <a href="#about"    className="hover:text-white transition-colors">About</a>
          <a href="#work"     className="hover:text-white transition-colors">Our Work</a>
          <a href="#areas"    className="hover:text-white transition-colors">Service Areas</a>
        </nav>

        <Link href="/get-a-quote"
          className="hidden md:inline-flex items-center gap-1.5 bg-white text-[#1e3d12] font-bold px-5 py-2 rounded-full text-sm hover:bg-[#eef3e8] transition-colors shadow-sm">
          Get a Free Quote →
        </Link>

        {/* Hamburger */}
        <button onClick={() => setOpen(o => !o)} className="md:hidden text-white p-2" aria-label="Menu">
          <div className="space-y-1.5">
            <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#1e3d12] border-t border-white/10 px-5 pb-5 pt-3 space-y-1">
          {[['#services','Services'],['#about','About'],['#work','Our Work'],['#areas','Service Areas']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              className="block py-2.5 text-white/80 hover:text-white text-sm font-medium border-b border-white/10">
              {label}
            </a>
          ))}
          <Link href="/get-a-quote" onClick={() => setOpen(false)}
            className="mt-3 w-full flex items-center justify-center bg-white text-[#1e3d12] font-bold py-3 rounded-xl text-sm">
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn2.jpg" alt="" className="absolute inset-0 w-full h-full object-cover scale-105"
        style={{ animation: 'heroZoom 22s ease-in-out infinite alternate' }} />
      {/* Deep green overlay — matches quote page feel */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(20,45,12,0.72) 0%, rgba(20,45,12,0.55) 50%, rgba(20,45,12,0.72) 100%)' }} />

      <style>{`
        @keyframes heroZoom { from { transform:scale(1.05) } to { transform:scale(1.12) } }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(22px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div className="relative z-10 text-center px-5 max-w-4xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase mb-8 text-white/50"
          style={{ animation: 'fadeUp 0.6s ease-out both', letterSpacing: '0.2em' }}>
          Serving Northeast Indiana
        </p>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6"
          style={{ animation: 'fadeUp 0.6s ease-out 0.15s both' }}>
          Your Lawn,<br />
          <span style={{ color: '#a8dba8' }}>Done Right.</span>
        </h1>

        <p className="text-lg md:text-xl text-white/75 max-w-xl mx-auto mb-10 leading-relaxed"
          style={{ animation: 'fadeUp 0.6s ease-out 0.3s both' }}>
          Professional lawn care for Kendallville and surrounding communities.
          Reliable, affordable, and backed by real work — not promises.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center"
          style={{ animation: 'fadeUp 0.6s ease-out 0.45s both' }}>
          <Link href="/get-a-quote"
            className="font-bold px-8 py-4 rounded-full text-base transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ background: '#2d5a1b', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#3a7a22')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2d5a1b')}>
            Get My Free Quote →
          </Link>
          <a href="#work"
            className="bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold px-8 py-4 rounded-full text-base transition-colors backdrop-blur-sm">
            See Our Work ↓
          </a>
        </div>
      </div>

      <a href="#services" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/70 transition-colors" aria-label="Scroll">
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
    <section id="services" className="py-24" style={{ background: '#fff' }}>
      <div className="max-w-6xl mx-auto px-5">

        <div className="mb-14">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ color: '#1e3d12' }}>What We Do</h2>
          <p className="text-lg" style={{ color: '#4a6a3a', maxWidth: '38ch' }}>
            Every service we offer comes with the same standard — done right, on time, no corners cut.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-px" style={{ background: '#d4e4cc', border: '1px solid #d4e4cc', borderRadius: '16px', overflow: 'hidden' }}>
          {SERVICES.map((s, i) => (
            <div key={i} className="group relative px-8 py-9 transition-colors duration-200"
              style={{ background: '#fff' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f7fbf4')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              {/* Accent bar */}
              <div className="w-8 h-0.5 mb-6 transition-all duration-300 group-hover:w-14"
                style={{ background: '#2d5a1b' }} />
              <h3 className="text-xl font-bold mb-3" style={{ color: '#1e3d12' }}>{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4a6a3a' }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/get-a-quote"
            className="inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-full text-sm transition-all hover:scale-105"
            style={{ background: '#1e3d12', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2d5a1b')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
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
    <section id="about" className="py-24 overflow-hidden" style={{ background: '#1e3d12' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Photo */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lawn3.jpg" alt="Gray Wolf Workers crew at work" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Text */}
          <div>
            <p className="font-bold text-sm tracking-widest uppercase mb-4" style={{ color: '#7ecb5f' }}>Our Story</p>
            <h2 className="text-4xl font-extrabold leading-tight mb-6 text-white">
              A Local Crew That<br />
              <span style={{ color: '#a8dba8' }}>Takes Pride in the Work</span>
            </h2>
            <p className="leading-relaxed mb-5" style={{ color: '#8ab88a' }}>
              Gray Wolf Workers started right here in Kendallville. We&apos;re not a big franchise with a
              call center — we&apos;re your neighbors, and we treat your yard like it&apos;s our own.
            </p>
            <p className="leading-relaxed mb-8" style={{ color: '#8ab88a' }}>
              From the first cut of spring to the last cleanup in fall, we show up on time, do the job
              right, and leave your property looking its best. Every time.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-10">
              {[['3+','Years in Business'],['50+','Lawns Maintained'],['5★','Average Rating']].map(([n, l]) => (
                <div key={l} className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-2xl font-extrabold text-white">{n}</p>
                  <p className="text-xs mt-1 leading-tight" style={{ color: '#8ab88a' }}>{l}</p>
                </div>
              ))}
            </div>

            <Link href="/get-a-quote"
              className="inline-flex items-center gap-2 font-bold px-7 py-3.5 rounded-full text-sm transition-all hover:scale-105"
              style={{ background: '#fff', color: '#1e3d12' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#eef3e8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              Start with a Free Quote →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}


// ── Gallery ───────────────────────────────────────────────────────────────────
function Gallery() {
  return (
    <section id="work" className="py-24" style={{ background: '#fff' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-14">
          <p className="font-bold text-sm tracking-widest uppercase mb-3" style={{ color: '#4a9030' }}>Our Work</p>
          <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#1e3d12' }}>Results You Can See</h2>
          <p className="max-w-md mx-auto" style={{ color: '#4a6a3a' }}>
            Real yards, real results. Every property we touch gets the same care and attention.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="col-span-2 md:col-span-2 aspect-[16/9] md:aspect-[4/3] rounded-2xl overflow-hidden">
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
    <section id="areas" className="py-20" style={{ background: '#eef3e8' }}>
      <div className="max-w-6xl mx-auto px-5 text-center">
        <p className="font-bold text-sm tracking-widest uppercase mb-3" style={{ color: '#4a9030' }}>Where We Work</p>
        <h2 className="text-4xl font-extrabold mb-4" style={{ color: '#1e3d12' }}>We Come to You</h2>
        <p className="max-w-md mx-auto mb-10" style={{ color: '#4a6a3a' }}>
          Based in Kendallville — proudly serving communities across Noble, DeKalb, LaGrange, and Whitley counties.
        </p>

        <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto mb-12">
          {SERVICE_AREAS.map(area => (
            <span key={area}
              className="px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors"
              style={area === 'Kendallville'
                ? { background: '#1e3d12', color: '#fff', borderColor: '#1e3d12' }
                : { background: '#fff', color: '#2d5a1b', borderColor: '#c8dfc0' }}>
              {area === 'Kendallville' ? '★ ' : ''}{area}
            </span>
          ))}
        </div>

        <p className="text-sm mb-5" style={{ color: '#7a9a6a' }}>Don&apos;t see your city? We may still be able to help.</p>
        <Link href="/get-a-quote"
          className="inline-flex items-center gap-2 font-bold px-7 py-3.5 rounded-full text-sm transition-all hover:scale-105"
          style={{ background: '#1e3d12', color: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2d5a1b')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
          Check Your Address →
        </Link>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="relative py-28 overflow-hidden" style={{ background: '#142d0a' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/lawn4.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #142d0a, rgba(20,45,10,0.88), #142d0a)' }} />

      <div className="relative z-10 max-w-3xl mx-auto px-5 text-center">
        <p className="font-bold text-sm tracking-widest uppercase mb-5" style={{ color: '#7ecb5f' }}>Get Started Today</p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
          Ready for a Lawn<br />You&apos;re Proud Of?
        </h2>
        <p className="text-lg mb-10 max-w-lg mx-auto" style={{ color: '#8ab88a' }}>
          Enter your address and get a custom quote in under a minute. No calls, no salespeople.
          Just an honest price for honest work.
        </p>
        <Link href="/get-a-quote"
          className="inline-flex items-center gap-2 font-extrabold px-10 py-4 rounded-full text-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: '#2d5a1b', color: '#fff', boxShadow: '0 8px 30px rgba(45,90,27,0.4)' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3a7a22')}
          onMouseLeave={e => (e.currentTarget.style.background = '#2d5a1b')}>
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
    <footer className="pt-14 pb-8" style={{ background: '#0d1f07', color: '#7a9a6a' }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-9 h-9 object-contain" />
              <span className="font-bold text-white text-sm leading-tight">Gray Wolf Workers</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#5a7a4a' }}>
              Professional lawn care serving Kendallville and Northeast Indiana. Local, reliable, and proud of it.
            </p>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Quick Links</p>
            <ul className="space-y-2.5 text-sm">
              {[['#services','Services'],['#about','About Us'],['#work','Our Work'],['#areas','Service Areas']].map(([h,l]) => (
                <li key={l}><a href={h} className="hover:text-white transition-colors">{l}</a></li>
              ))}
              <li>
                <Link href="/get-a-quote" className="font-semibold transition-colors hover:text-white" style={{ color: '#7ecb5f' }}>
                  Get a Free Quote →
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Areas We Serve</p>
            <ul className="space-y-1.5 text-sm">
              {SERVICE_AREAS.slice(0, 7).map(a => (
                <li key={a} style={a === 'Kendallville' ? { color: '#a8dba8', fontWeight: 500 } : {}}>{a}</li>
              ))}
              <li className="text-xs mt-1" style={{ color: '#3a5a2a' }}>+ more</li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Contact</p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#7ecb5f' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Kendallville, IN 46755
              </li>
              <li className="flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#7ecb5f' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:graywolfworkers@gmail.com" className="hover:text-white transition-colors break-all">
                  graywolfworkers@gmail.com
                </a>
              </li>
              <li className="pt-2">
                <Link href="/get-a-quote"
                  className="inline-block font-bold px-5 py-2.5 rounded-full text-xs transition-colors"
                  style={{ background: '#2d5a1b', color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#3a7a22')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#2d5a1b')}>
                  Book Online →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-7 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs" style={{ borderTop: '1px solid #1e3d12', color: '#3a5a2a' }}>
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
      <Gallery />
      <Areas />
      <CTABanner />
      <Footer />
    </div>
  )
}
