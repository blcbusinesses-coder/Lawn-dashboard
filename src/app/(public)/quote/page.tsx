'use client'

import { useState, useEffect } from 'react'

type Step = 'form' | 'loading' | 'success' | 'error'

/* ─── Grass SVG decoration ─────────────────────────────────────────────────── */
function GrassRow() {
  return (
    <svg
      viewBox="0 0 1440 90"
      className="w-full block"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Base ground strip */}
      <rect x="0" y="70" width="1440" height="20" fill="#2d5a1b" />
      {/* Grass blades — hand-crafted irregular pattern */}
      {[
        [20,70,30,30], [50,70,58,15], [80,70,88,38], [110,70,118,22],
        [140,70,148,45], [170,70,178,20], [200,70,208,35], [230,70,238,18],
        [260,70,265,42], [290,70,298,28], [320,70,328,15], [350,70,358,50],
        [380,70,390,25], [410,70,418,38], [440,70,445,20], [470,70,478,44],
        [500,70,505,18], [530,70,538,36], [560,70,568,22], [590,70,598,48],
        [620,70,628,16], [650,70,655,40], [680,70,688,28], [710,70,718,18],
        [740,70,748,52], [770,70,778,24], [800,70,808,38], [830,70,835,20],
        [860,70,868,44], [890,70,898,16], [920,70,928,36], [950,70,955,28],
        [980,70,988,20], [1010,70,1018,46], [1040,70,1048,18],[1070,70,1078,34],
        [1100,70,1105,22],[1130,70,1138,50],[1160,70,1168,26],[1190,70,1198,18],
        [1220,70,1228,42],[1250,70,1255,20],[1280,70,1288,36],[1310,70,1318,24],
        [1340,70,1348,48],[1370,70,1375,18],[1400,70,1408,38],[1430,70,1435,22],
      ].map(([x1,y1,x2,y2], i) => (
        <path
          key={i}
          d={`M${x1} ${y1} Q${(x1+x2)/2} ${y2} ${x2} ${y1}`}
          stroke={i % 3 === 0 ? '#3a7a22' : i % 3 === 1 ? '#2d5a1b' : '#4a9030'}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

/* ─── Animated SVG checkmark ───────────────────────────────────────────────── */
function AnimatedCheck() {
  return (
    <>
      <style>{`
        @keyframes drawCircle {
          from { stroke-dashoffset: 226; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 60; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mowerSlide {
          0%   { transform: translateX(-10%); }
          100% { transform: translateX(110%); }
        }
        @keyframes stripeGrow {
          from { width: 0; }
          to   { width: 100%; }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
      <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none">
        <circle
          cx="50" cy="50" r="36"
          stroke="#e8f5e0"
          strokeWidth="6"
        />
        <circle
          cx="50" cy="50" r="36"
          stroke="#2d5a1b"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="226"
          style={{ animation: 'drawCircle 0.6s ease-out forwards' }}
        />
        <path
          d="M30 50 L43 63 L70 35"
          stroke="#2d5a1b"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="60"
          style={{ animation: 'drawCheck 0.4s ease-out forwards 0.55s', strokeDashoffset: 60 }}
        />
      </svg>
    </>
  )
}

/* ─── Loading mower animation ──────────────────────────────────────────────── */
function MowerLoader() {
  const [statusIdx, setStatusIdx] = useState(0)
  const statuses = [
    'Locating your property…',
    'Measuring your lawn…',
    'Calculating your quote…',
    'Almost ready…',
  ]

  useEffect(() => {
    const t = setInterval(() => setStatusIdx((i) => Math.min(i + 1, statuses.length - 1)), 9000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes mowerSlide {
          0%   { left: -8%; }
          100% { left: 108%; }
        }
        @keyframes stripeGrow {
          0%   { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%           { transform: translateY(-6px); }
        }
      `}</style>

      {/* Mower track */}
      <div className="relative w-full h-14 mb-8 overflow-hidden rounded-xl bg-[#c8dfc0]">
        {/* Mowed stripe that grows */}
        <div
          className="absolute left-0 top-0 h-full bg-[#a8c898] rounded-xl"
          style={{ animation: 'stripeGrow 32s linear forwards' }}
        />
        {/* Mower icon sliding across */}
        <div
          className="absolute top-1/2 -translate-y-1/2 text-3xl"
          style={{ animation: 'mowerSlide 32s linear forwards' }}
        >
          🌿
        </div>
        {/* Row stripe texture */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0px, transparent 18px, rgba(0,0,0,0.15) 18px, rgba(0,0,0,0.15) 20px)'
        }} />
      </div>

      {/* Status */}
      <p
        key={statusIdx}
        className="text-lg font-semibold text-[#1e3d12] mb-2"
        style={{ animation: 'fadeUp 0.4s ease-out' }}
      >
        {statuses[statusIdx]}
      </p>
      <p className="text-sm text-[#5a7a4a] mb-6">
        We look up your property and build a real custom quote — takes about 30 seconds.
      </p>

      {/* Dots */}
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[#2d5a1b]"
            style={{ animation: `dotBounce 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function QuotePage() {
  const [step, setStep] = useState<Step>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    preferred_date: '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return
    setStep('loading')
    try {
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!leadRes.ok) throw new Error((await leadRes.json()).error ?? 'Failed to submit')
      const lead = await leadRes.json()
      await fetch(`/api/leads/${lead.id}/quote`, { method: 'POST' })
      setStep('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  /* ── Loading ──────────────────────────────────────────────────────────────── */
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#eef3e8] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#2d5a1b] rounded-xl mb-6">
            <span className="text-white font-bold text-sm tracking-wide">GW</span>
          </div>
          <MowerLoader />
        </div>
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
          <GrassRow />
        </div>
      </div>
    )
  }

  /* ── Success ──────────────────────────────────────────────────────────────── */
  if (step === 'success') {
    return (
      <>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div className="min-h-screen bg-[#eef3e8] flex flex-col items-center justify-center p-6">
          <div
            className="w-full max-w-sm text-center"
            style={{ animation: 'fadeUp 0.5s ease-out' }}
          >
            <AnimatedCheck />
            <h2
              className="text-2xl font-bold text-[#1e3d12] mt-6 mb-2"
              style={{ animation: 'fadeUp 0.5s ease-out 0.8s both' }}
            >
              Quote on its way!
            </h2>
            <p
              className="text-[#4a6a3a] mb-1"
              style={{ animation: 'fadeUp 0.5s ease-out 1s both' }}
            >
              We texted your custom quote to <strong className="text-[#1e3d12]">{form.phone}</strong>.
            </p>
            <p
              className="text-sm text-[#6a8a5a] mb-8"
              style={{ animation: 'fadeUp 0.5s ease-out 1.1s both' }}
            >
              Reply to that text to lock in your first mow. No contracts, cancel anytime.
            </p>
            <div
              className="inline-block bg-white border border-[#c8dfc0] rounded-xl px-5 py-3 text-sm text-[#4a6a3a]"
              style={{ animation: 'fadeUp 0.5s ease-out 1.2s both' }}
            >
              Didn&apos;t get it? Double-check your number and try again, or call us directly.
            </div>
          </div>
          <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
            <GrassRow />
          </div>
        </div>
      </>
    )
  }

  /* ── Error ────────────────────────────────────────────────────────────────── */
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#eef3e8] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
          <p className="text-zinc-500 text-sm mb-6">{errorMsg || 'Please try again or call us directly.'}</p>
          <button
            onClick={() => setStep('form')}
            className="px-6 py-2.5 bg-[#2d5a1b] text-white rounded-lg text-sm font-semibold hover:bg-[#1e3d12] transition-colors"
          >
            Try Again
          </button>
        </div>
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
          <GrassRow />
        </div>
      </div>
    )
  }

  /* ── Form ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#eef3e8] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-5 py-10">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#2d5a1b] rounded-xl mb-4">
              <span className="text-white font-bold text-sm tracking-wide">GW</span>
            </div>
            <h1 className="text-3xl font-bold text-[#1e3d12] tracking-tight">Gray Wolf Workers</h1>
            <p className="text-[#5a7a4a] mt-2 text-sm leading-relaxed">
              Get a free lawn mowing quote — we&apos;ll text it straight to your phone in under a minute.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Green top bar */}
            <div className="h-1.5 bg-[#2d5a1b]" />

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Field label="Your Name" required>
                <input
                  type="text"
                  required
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2d5a1b] focus:border-transparent transition-shadow"
                />
              </Field>

              <Field label="Phone Number" note="we'll text your quote here" required>
                <input
                  type="tel"
                  required
                  placeholder="(260) 555-0100"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2d5a1b] focus:border-transparent transition-shadow"
                />
              </Field>

              <Field label="Email" note="optional">
                <input
                  type="email"
                  placeholder="jane@email.com"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2d5a1b] focus:border-transparent transition-shadow"
                />
              </Field>

              <Field label="Property Address" note="where we'll mow" required>
                <input
                  type="text"
                  required
                  placeholder="1234 Oak St, Kendallville, IN 46755"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2d5a1b] focus:border-transparent transition-shadow"
                />
              </Field>

              <Field label="Preferred Start Date" note="optional">
                <input
                  type="date"
                  value={form.preferred_date}
                  onChange={(e) => set('preferred_date', e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#2d5a1b] focus:border-transparent transition-shadow"
                />
              </Field>

              <button
                type="submit"
                className="w-full bg-[#2d5a1b] text-white rounded-lg py-3 text-sm font-semibold hover:bg-[#1e3d12] active:scale-[0.98] transition-all mt-1"
              >
                Get My Free Quote →
              </button>

              <p className="text-xs text-zinc-400 text-center pt-1">
                We&apos;ll text you within 1 minute &nbsp;·&nbsp; No contracts &nbsp;·&nbsp; No spam, ever
              </p>
            </form>
          </div>

          {/* Trust footer */}
          <p className="text-center text-xs text-[#7a9a6a] mt-5">
            Locally owned &amp; operated &nbsp;·&nbsp; Serving Kendallville &amp; surrounding areas
          </p>
        </div>
      </div>

      {/* Grass bottom decoration */}
      <div className="pointer-events-none">
        <GrassRow />
      </div>
    </div>
  )
}

/* ─── Field wrapper ────────────────────────────────────────────────────────── */
function Field({
  label,
  note,
  required,
  children,
}: {
  label: string
  note?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">
        {label}
        {required && <span className="text-[#2d5a1b] ml-0.5">*</span>}
        {note && <span className="text-zinc-400 font-normal ml-1">({note})</span>}
      </label>
      {children}
    </div>
  )
}
