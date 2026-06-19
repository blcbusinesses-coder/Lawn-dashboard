'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// Self-scheduling page — the QR code / letters land here.
// Flow: find your property (by name or address) -> it shows the quote we
// already saved -> tap it -> pick an available day -> we start mowing.

interface Match {
  recipient_id: string
  name: string
  address: string
  city: string | null
  state: string | null
  zip: string | null
  quote: number | null
}

interface DayOption { label: string; iso: string; weekday: string }

type Step = 'find' | 'book' | 'done'

const inputClass = 'w-full px-4 py-3.5 text-[15px] outline-none bg-white'
const inputStyle = { border: '1px solid #d4d4c8', color: '#181b15' }
const labelClass = 'block text-xs font-bold uppercase mb-1.5'
const labelStyle = { color: '#2f6418', letterSpacing: '0.1em' }

// Next ~6 upcoming dates whose weekday is in `days` (e.g. ["Monday","Friday"]).
function upcomingDays(days: string[], count = 6): DayOption[] {
  if (!days.length) return []
  const wanted = new Set(days.map(d => d.toLowerCase()))
  const out: DayOption[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1) // start tomorrow
  for (let i = 0; i < 28 && out.length < count; i++) {
    const wd = d.toLocaleDateString('en-US', { weekday: 'long' })
    if (wanted.has(wd.toLowerCase())) {
      out.push({
        weekday: wd,
        iso: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      })
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

export default function SchedulePage() {
  const [step, setStep] = useState<Step>('find')

  // find
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  // booking
  const [selected, setSelected] = useState<Match | null>(null)
  const [phone, setPhone] = useState('')
  const [day, setDay] = useState<DayOption | null>(null)
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load available days, and pre-load a property if the QR passed one.
  useEffect(() => {
    let cancelled = false
    fetch('/api/quote/availability')
      .then(r => r.json())
      .then((days: string[]) => { if (!cancelled && Array.isArray(days)) setAvailableDays(days) })
      .catch(() => {})

    const p = new URLSearchParams(window.location.search)
    const apply = () => {
      const quote = parseInt(p.get('quote') || '')
      const name = p.get('name')?.trim()
      const street = p.get('street')?.trim()
      const city = p.get('city')?.trim()
      const zip = p.get('zip')?.trim()
      const rid = p.get('rid')?.trim()

      // NOTE: the QR scan is logged server-side by /api/qr/[rid] before this
      // page even loads, so there's no client-side tracking to do here.
      if (name && street) {
        setSelected({
          recipient_id: rid || '',
          name,
          address: street,
          city: city ?? null,
          state: 'IN',
          zip: zip ?? null,
          quote: !Number.isNaN(quote) && quote > 0 ? quote : null,
        })
        setStep('book')
      } else if (name) {
        setQuery(name)
      }
    }
    Promise.resolve().then(apply)
    return () => { cancelled = true }
  }, [])

  const dayOptions = upcomingDays(availableDays)

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim().length < 3) { setError('Type at least 3 letters of your name or address.'); return }
    setError('')
    setSearching(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/schedule/lookup?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      setMatches(data.matches ?? [])
    } catch {
      setMatches([])
    } finally {
      setSearching(false)
    }
  }

  function pick(m: Match) {
    setSelected(m)
    setError('')
    setStep('book')
  }

  async function book() {
    setError('')
    if (!selected) return
    if (!phone.trim()) { setError('Please enter your phone number so we can confirm.'); return }
    // A day is required only when we actually offer day options.
    if (dayOptions.length > 0 && !day) { setError('Please pick a day.'); return }
    setSubmitting(true)
    try {
      const full = [selected.address, selected.city, selected.state, selected.zip].filter(Boolean).join(', ')
      const res = await fetch('/api/schedule/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: selected.recipient_id || undefined,
          name: selected.name,
          phone: phone.trim(),
          address: full,
          quote: selected.quote,
          chosen_day: day ? `${day.weekday} (${day.label})` : 'Flexible — please text me',
          preferred_date: day?.iso ?? null,
        }),
      })
      if (!res.ok) throw new Error()
      setStep('done')
    } catch {
      setError('Something went wrong — please try again, or call us.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="antialiased min-h-screen flex flex-col" style={{ background: '#f4f4ee' }}>
      {/* Top bar */}
      <div style={{ background: '#122b0a' }}>
        <div className="max-w-6xl mx-auto px-5 h-10 flex items-center justify-between text-xs text-white/90">
          <p className="font-semibold tracking-wide">
            <span style={{ color: '#e9b949' }}>Welcome offer:</span> new customers get <span className="font-bold text-white">25% off their first month</span>
          </p>
          <a href="mailto:graywolfworkers@gmail.com" className="hidden sm:block hover:text-white font-medium text-white/70">graywolfworkers@gmail.com</a>
        </div>
      </div>

      {/* Nav */}
      <header className="bg-white" style={{ borderBottom: '1px solid #e2e2d8' }}>
        <div className="max-w-6xl mx-auto px-5 h-[68px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Gray Wolf Workers" className="w-10 h-10 object-contain" />
            <span className="leading-tight">
              <span className="block font-extrabold text-[15px] tracking-tight" style={{ color: '#181b15' }}>Gray Wolf Workers</span>
              <span className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: '#2f6418' }}>Lawn Care · Kendallville, IN</span>
            </span>
          </Link>
          <Link href="/" className="text-[13.5px] font-semibold hover:text-[#1e3d12] transition-colors" style={{ color: '#41483b' }}>graywolfworkers.com</Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-5 py-12 md:py-16">
        <div className="w-full max-w-md">

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="bg-white p-8 md:p-10 text-center" style={{ border: '1px solid #e2e2d8' }}>
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center" style={{ background: '#1e3d12' }}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight mb-3" style={{ color: '#181b15' }}>You&apos;re on the schedule!</h1>
              <p className="text-[14.5px] leading-relaxed mb-2" style={{ color: '#5b6354' }}>
                {selected?.name?.split(' ')[0] ? `Thanks, ${selected.name.split(' ')[0]}! ` : ''}
                We&apos;ll text you shortly to confirm your first mow{day ? ` on ${day.label}` : ''}. Your 25% first-month discount is locked in.
              </p>
              <p className="text-[13px]" style={{ color: '#8a917f' }}>Keep an eye on your phone — it usually takes just a few minutes.</p>
            </div>
          )}

          {/* ── FIND ── */}
          {step === 'find' && (
            <>
              <div className="mb-7">
                <p className="text-xs font-bold uppercase mb-3" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Schedule your first mow</p>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.08] mb-3" style={{ color: '#181b15' }}>
                  Find your home.<br />Pick a day. Done.
                </h1>
                <p className="text-[14.5px] leading-relaxed" style={{ color: '#5b6354' }}>
                  Type your name or address below — we&apos;ll pull up the price we already put together for you.
                </p>
              </div>

              <form onSubmit={runSearch} className="flex gap-2 mb-5">
                <input
                  autoFocus
                  className={inputClass}
                  style={inputStyle}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Your name or street address"
                  aria-label="Your name or address"
                />
                <button type="submit" disabled={searching}
                  className="shrink-0 font-bold px-6 text-[15px] text-white transition-colors disabled:opacity-60"
                  style={{ background: '#1e3d12' }}>
                  {searching ? '…' : 'Find'}
                </button>
              </form>

              {error && <p className="text-sm font-medium mb-4" style={{ color: '#b3261e' }}>{error}</p>}

              {searched && !searching && matches.length === 0 && (
                <div className="bg-white p-5 text-[14px]" style={{ border: '1px solid #e2e2d8', color: '#5b6354' }}>
                  We couldn&apos;t find that one. Try your street name or last name — or{' '}
                  <Link href="/get-a-quote" className="font-semibold underline" style={{ color: '#1e3d12' }}>get a fresh quote here</Link>.
                </div>
              )}

              {matches.length > 0 && (
                <div className="space-y-2.5">
                  {matches.map(m => (
                    <button key={m.recipient_id} onClick={() => pick(m)}
                      className="w-full text-left bg-white p-4 flex items-center justify-between gap-3 transition-colors hover:bg-[#f0f5ec]"
                      style={{ border: '1px solid #e2e2d8' }}>
                      <div className="min-w-0">
                        <p className="font-bold text-[15px] truncate" style={{ color: '#181b15' }}>{m.name}</p>
                        <p className="text-[13px] truncate" style={{ color: '#5b6354' }}>{[m.address, m.city].filter(Boolean).join(', ')}</p>
                      </div>
                      {m.quote != null && (
                        <div className="shrink-0 text-right">
                          <p className="text-[20px] font-extrabold leading-none" style={{ color: '#1e3d12' }}>${m.quote}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8a917f' }}>per mow</p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── BOOK ── */}
          {step === 'book' && selected && (
            <>
              <div className="mb-6">
                <button onClick={() => { setStep('find'); setDay(null); setError('') }} className="text-[13px] font-semibold mb-4" style={{ color: '#2f6418' }}>← Not your home?</button>
                <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: '#e7f0e1', color: '#2f6418' }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  We found your home
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight leading-[1.08]" style={{ color: '#181b15' }}>Pick your first day.</h1>
              </div>

              {/* Property + quote */}
              <div className="px-5 py-4 mb-5 flex items-center justify-between" style={{ background: '#1e3d12' }}>
                <div className="min-w-0">
                  <p className="font-bold text-white text-[15px] truncate">{selected.name}</p>
                  <p className="text-[12.5px] truncate" style={{ color: '#cfe0c6' }}>{[selected.address, selected.city].filter(Boolean).join(', ')}</p>
                </div>
                {selected.quote != null && (
                  <div className="shrink-0 text-right">
                    <p className="text-[24px] font-extrabold text-white leading-none">${selected.quote}<span className="text-[13px] font-bold">/mow</span></p>
                    <p className="text-[10px] font-semibold" style={{ color: '#9fc18d' }}>25% off 1st month</p>
                  </div>
                )}
              </div>

              <div className="bg-white p-6 space-y-5" style={{ border: '1px solid #e2e2d8', borderTop: '4px solid #1e3d12' }}>
                <div>
                  <label htmlFor="phone" className={labelClass} style={labelStyle}>Your phone number</label>
                  <input id="phone" type="tel" className={inputClass} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(260) 555-0100" />
                </div>

                <div>
                  <label className={labelClass} style={labelStyle}>Choose your day</label>
                  {dayOptions.length === 0 ? (
                    <p className="text-[13px]" style={{ color: '#8a917f' }}>We&apos;ll text you with the next openings — just submit your number below.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {dayOptions.map(o => {
                        const active = day?.iso === o.iso
                        return (
                          <button key={o.iso} type="button" onClick={() => setDay(o)}
                            className="py-2.5 px-1 text-[13px] font-bold transition-colors"
                            style={active
                              ? { background: '#1e3d12', color: '#fff', border: '1px solid #1e3d12' }
                              : { background: '#fff', color: '#1e3d12', border: '1px solid #c8d6c0' }}>
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {error && <p className="text-sm font-medium" style={{ color: '#b3261e' }}>{error}</p>}

                <button onClick={book} disabled={submitting}
                  className="w-full font-bold py-4 text-[15px] text-white transition-colors disabled:opacity-60"
                  style={{ background: '#1e3d12' }}>
                  {submitting ? 'Booking…' : 'Start My Service'}
                </button>
                <p className="text-center text-[12px]" style={{ color: '#8a917f' }}>
                  No contract &bull; Cancel anytime &bull; We&apos;ll text to confirm before we come out
                </p>
                <p className="text-center text-[12px] font-medium" style={{ color: '#5b6354' }}>
                  Billing is simple: we bill once a month, at the end of the month — for the mows we did.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="py-6" style={{ background: '#0d1d07', color: '#9aa192' }}>
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC · Kendallville, IN 46755</p>
          <Link href="/" className="hover:text-white font-medium">graywolfworkers.com</Link>
        </div>
      </footer>
    </div>
  )
}
