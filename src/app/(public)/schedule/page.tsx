'use client'

import { useState } from 'react'
import Link from 'next/link'

// Self-scheduling page — the QR code on outreach letters lands here.
// Prospect picks their day, we create a lead with preferred_date and fire the
// instant quote, then the office confirms by text. New customers get 25% off
// their first month.

const NOBLE_TOWNS = ['Kendallville', 'Albion', 'Avilla', 'Rome City', 'Ligonier', 'Wolcottville', 'Cromwell', 'Wawaka', 'Other']

type Step = 'form' | 'submitting' | 'done'

const inputClass = 'w-full px-4 py-3.5 text-[15px] outline-none bg-white'
const inputStyle = { border: '1px solid #d4d4c8', color: '#181b15' }
const labelClass = 'block text-xs font-bold uppercase mb-1.5'
const labelStyle = { color: '#2f6418', letterSpacing: '0.1em' }

function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function SchedulePage() {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('Kendallville')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim() || !street.trim()) {
      setError('Please fill in your name, phone, and address.')
      return
    }
    setStep('submitting')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: `${street.trim()}, ${city === 'Other' ? '' : city + ', '}IN`,
          preferred_date: date || null,
          source: 'website',
        }),
      })
      if (!res.ok) throw new Error()
      const lead = await res.json()
      // Fire the instant quote (texts them their price) — best-effort.
      fetch(`/api/leads/${lead.id}/quote`, { method: 'POST' }).catch(() => {})
      setStep('done')
    } catch {
      setError('Something went wrong — please try again.')
      setStep('form')
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
          <a href="mailto:graywolfworkers@gmail.com" className="hidden sm:block hover:text-white font-medium text-white/70">
            graywolfworkers@gmail.com
          </a>
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
          <Link href="/" className="text-[13.5px] font-semibold hover:text-[#1e3d12] transition-colors" style={{ color: '#41483b' }}>
            graywolfworkers.com
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-5 py-12 md:py-16">
        <div className="w-full max-w-md">
          {step === 'done' ? (
            <div className="bg-white p-8 md:p-10 text-center" style={{ border: '1px solid #e2e2d8' }}>
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center" style={{ background: '#1e3d12' }}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight mb-3" style={{ color: '#181b15' }}>
                You&apos;re on the list!
              </h1>
              <p className="text-[14.5px] leading-relaxed mb-2" style={{ color: '#5b6354' }}>
                We&apos;ll text you shortly with your exact price{date ? ' and to confirm your day' : ' and to set up your day'}.
                Your 25% first-month discount is locked in.
              </p>
              <p className="text-[13px]" style={{ color: '#8a917f' }}>
                Keep an eye on your phone — it usually takes just a few minutes.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <p className="text-xs font-bold uppercase mb-3" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Schedule your mow</p>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.08] mb-3" style={{ color: '#181b15' }}>
                  Pick your day.<br />We handle the rest.
                </h1>
                <p className="text-[14.5px] leading-relaxed" style={{ color: '#5b6354' }}>
                  Tell us where and when — we&apos;ll text you your exact price and confirm your spot.
                  New customers get <strong style={{ color: '#1e3d12' }}>25% off their first month</strong>.
                </p>
              </div>

              <form onSubmit={submit} className="bg-white p-6 md:p-8 space-y-5" style={{ border: '1px solid #e2e2d8', borderTop: '4px solid #1e3d12' }}>
                <div>
                  <label htmlFor="name" className={labelClass} style={labelStyle}>Full name</label>
                  <input id="name" className={inputClass} style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <label htmlFor="phone" className={labelClass} style={labelStyle}>Phone number</label>
                  <input id="phone" type="tel" className={inputClass} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(260) 555-0100" />
                </div>
                <div>
                  <label htmlFor="street" className={labelClass} style={labelStyle}>Street address</label>
                  <input id="street" className={inputClass} style={inputStyle} value={street} onChange={e => setStreet(e.target.value)} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className={labelClass} style={labelStyle}>Town</label>
                    <select id="city" className={inputClass} style={inputStyle} value={city} onChange={e => setCity(e.target.value)}>
                      {NOBLE_TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="date" className={labelClass} style={labelStyle}>Preferred day</label>
                    <input id="date" type="date" min={tomorrowISO()} className={inputClass} style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                </div>

                {error && <p className="text-sm font-medium" style={{ color: '#b3261e' }}>{error}</p>}

                <button
                  type="submit"
                  disabled={step === 'submitting'}
                  className="w-full font-bold py-4 text-[15px] text-white transition-colors disabled:opacity-60"
                  style={{ background: '#1e3d12' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}
                >
                  {step === 'submitting' ? 'Scheduling…' : 'Schedule My Mow'}
                </button>
                <p className="text-center text-[12px]" style={{ color: '#8a917f' }}>
                  No contract &bull; Cancel anytime &bull; We text your exact price before anything happens
                </p>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Footer strip */}
      <footer className="py-6" style={{ background: '#0d1d07', color: '#9aa192' }}>
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC · Kendallville, IN 46755</p>
          <Link href="/" className="hover:text-white font-medium">graywolfworkers.com</Link>
        </div>
      </footer>
    </div>
  )
}
