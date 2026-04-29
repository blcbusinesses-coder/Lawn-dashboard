'use client'

import { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AddonOption { key: string; label: string; price: number; description: string }
interface AvailDay    { id: string; available_date: string; notes: string | null }

interface QuoteData {
  lot_size_sqft:  number | null
  mowable_sqft:   number | null
  base_price:     number
  confidence:     'measured' | 'estimate'
  addons:         AddonOption[]
}

type Step = 'address' | 'loading' | 'quote' | 'contact' | 'confirming' | 'confirmed' | 'error'

// ── Grass decoration ──────────────────────────────────────────────────────────
function GrassRow() {
  return (
    <svg viewBox="0 0 1440 90" className="w-full block" preserveAspectRatio="none" aria-hidden>
      <rect x="0" y="70" width="1440" height="20" fill="#2d5a1b" />
      {[
        [20,70,30,30],[50,70,58,15],[80,70,88,38],[110,70,118,22],[140,70,148,45],[170,70,178,20],
        [200,70,208,35],[230,70,238,18],[260,70,265,42],[290,70,298,28],[320,70,328,15],[350,70,358,50],
        [380,70,390,25],[410,70,418,38],[440,70,445,20],[470,70,478,44],[500,70,505,18],[530,70,538,36],
        [560,70,568,22],[590,70,598,48],[620,70,628,16],[650,70,655,40],[680,70,688,28],[710,70,718,18],
        [740,70,748,52],[770,70,778,24],[800,70,808,38],[830,70,835,20],[860,70,868,44],[890,70,898,16],
        [920,70,928,36],[950,70,955,28],[980,70,988,20],[1010,70,1018,46],[1040,70,1048,18],[1070,70,1078,34],
        [1100,70,1105,22],[1130,70,1138,50],[1160,70,1168,26],[1190,70,1198,18],[1220,70,1228,42],
        [1250,70,1255,20],[1280,70,1288,36],[1310,70,1318,24],[1340,70,1348,48],[1370,70,1375,18],
        [1400,70,1408,38],[1430,70,1435,22],
      ].map(([x1,y1,x2,y2], i) => (
        <path key={i}
          d={`M${x1} ${y1} Q${(x1+x2)/2} ${y2} ${x2} ${y1}`}
          stroke={i%3===0?'#3a7a22':i%3===1?'#2d5a1b':'#4a9030'}
          strokeWidth="3" fill="none" strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

// ── Premium loading screen ─────────────────────────────────────────────────────
const LOADING_MESSAGES = [
  { icon: '🛰️', text: 'Scanning your property…' },
  { icon: '📐', text: 'Calculating your yard size…' },
  { icon: '💰', text: 'Building your custom quote…' },
  { icon: '✨', text: 'Almost ready…' },
]

function LoadingScreen() {
  const [msgIdx, setMsgIdx] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Progress bar: fill over ~35 seconds
    const progInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / 350, 97))
    }, 100)
    // Cycle messages every 8 seconds
    const msgInterval = setInterval(() => {
      setMsgIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1))
    }, 8000)
    return () => { clearInterval(progInterval); clearInterval(msgInterval) }
  }, [])

  const msg = LOADING_MESSAGES[msgIdx]

  return (
    <div className="w-full max-w-sm text-center">
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity:0.6; }
          100% { transform: scale(1.5); opacity:0; }
        }
      `}</style>

      {/* Pulsing icon */}
      <div className="relative inline-flex items-center justify-center mb-8">
        <div className="absolute w-20 h-20 rounded-full bg-[#2d5a1b]/20"
          style={{ animation: 'pulse-ring 1.5s ease-out infinite' }} />
        <div className="relative w-16 h-16 bg-[#2d5a1b] rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-2xl" key={msgIdx} style={{ animation: 'fadeUp 0.4s ease-out' }}>
            {msg.icon}
          </span>
        </div>
      </div>

      {/* Message */}
      <p className="text-xl font-bold text-[#1e3d12] mb-2" key={msgIdx}
        style={{ animation: 'fadeUp 0.4s ease-out' }}>
        {msg.text}
      </p>
      <p className="text-sm text-[#5a7a4a] mb-8">
        We look up your property and build a real custom quote — takes about 30 seconds.
      </p>

      {/* Progress bar */}
      <div className="relative h-2 bg-[#c8dfc0] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #2d5a1b, #4a9030, #2d5a1b)',
            backgroundSize: '200% auto',
            animation: 'shimmer 2s linear infinite',
          }}
        />
      </div>
      <p className="text-xs text-[#7a9a6a]">{Math.round(progress)}% complete</p>
    </div>
  )
}

// ── Animated check ────────────────────────────────────────────────────────────
function AnimatedCheck() {
  return (
    <svg className="w-20 h-20 mx-auto" viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="36" stroke="#e8f5e0" strokeWidth="6" />
      <circle cx="50" cy="50" r="36" stroke="#2d5a1b" strokeWidth="6" strokeLinecap="round"
        strokeDasharray="226"
        style={{ animation: 'drawCircle 0.6s ease-out forwards', strokeDashoffset: 226 }} />
      <path d="M30 50 L43 63 L70 35" stroke="#2d5a1b" strokeWidth="6"
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60"
        style={{ animation: 'drawCheck 0.4s ease-out forwards 0.55s', strokeDashoffset: 60 }} />
    </svg>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex flex-col items-center mb-6">
      <div className="w-12 h-12 bg-[#2d5a1b] rounded-xl flex items-center justify-center shadow-md mb-3">
        <span className="text-white font-bold text-sm tracking-wide">GW</span>
      </div>
      <p className="text-[#1e3d12] font-semibold text-sm">Gray Wolf Workers</p>
    </div>
  )
}

// ── Helper: format day label ──────────────────────────────────────────────────
function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GetAQuotePage() {
  const [step, setStep]           = useState<Step>('address')
  const [address, setAddress]     = useState('')
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null)
  const [availDays, setAvailDays] = useState<AvailDay[]>([])
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [chosenDay, setChosenDay] = useState<string | null>(null)
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [error, setError]         = useState('')
  const addrRef = useRef<HTMLInputElement>(null)

  useEffect(() => { addrRef.current?.focus() }, [])

  // ── Step 1: Submit address → kick off lookup ──────────────────────────────
  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    setStep('loading')
    setSelectedAddons([])
    setChosenDay(null)

    try {
      const [quoteRes, availRes] = await Promise.all([
        fetch('/api/quote/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: address.trim() }),
        }),
        fetch('/api/quote/availability'),
      ])

      if (!quoteRes.ok) throw new Error('Could not calculate quote')
      const qData = await quoteRes.json()
      const aData = availRes.ok ? await availRes.json() : []

      setQuoteData(qData)
      setAvailDays(aData)
      setStep('quote')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  // ── Step 4: Submit contact info ───────────────────────────────────────────
  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setStep('confirming')

    try {
      const res = await fetch('/api/quote/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:               name.trim(),
          phone:              phone.trim(),
          address:            address.trim(),
          lot_size_sqft:      quoteData?.lot_size_sqft ?? null,
          mowable_sqft:       quoteData?.mowable_sqft ?? null,
          base_price:         quoteData?.base_price ?? 0,
          addons:             quoteData?.addons ?? [],
          selected_addon_keys: selectedAddons,
          chosen_start_day:   chosenDay,
        }),
      })
      if (!res.ok) throw new Error('Could not save your request')
      setStep('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  // ── Computed total ────────────────────────────────────────────────────────
  const addonTotal = (quoteData?.addons ?? [])
    .filter((a) => selectedAddons.includes(a.key))
    .reduce((sum, a) => sum + a.price, 0)
  const total = (quoteData?.base_price ?? 0) + addonTotal

  function toggleAddon(key: string) {
    setSelectedAddons((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const shell = (children: React.ReactNode, centered = true) => (
    <div className="min-h-screen bg-[#eef3e8] flex flex-col overflow-x-hidden">
      <style>{`
        @keyframes drawCircle { from{stroke-dashoffset:226} to{stroke-dashoffset:0} }
        @keyframes drawCheck  { from{stroke-dashoffset:60}  to{stroke-dashoffset:0} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div className={`flex-1 flex ${centered ? 'items-center justify-center' : ''} px-4 py-10`}>
        {children}
      </div>
      <div className="pointer-events-none overflow-hidden">
        <GrassRow />
      </div>
    </div>
  )

  // ── Loading ───────────────────────────────────────────────────────────────
  if (step === 'loading') return shell(
    <div className="w-full max-w-sm text-center">
      <Logo />
      <LoadingScreen />
    </div>
  )

  // ── Confirmed ─────────────────────────────────────────────────────────────
  if (step === 'confirmed') return shell(
    <div className="w-full max-w-sm text-center" style={{ animation: 'fadeUp 0.5s ease-out' }}>
      <AnimatedCheck />
      <h2 className="text-2xl font-bold text-[#1e3d12] mt-5 mb-2" style={{ animation: 'fadeUp 0.5s ease-out 0.7s both' }}>
        You&apos;re all set!
      </h2>
      <p className="text-[#4a6a3a] mb-1" style={{ animation: 'fadeUp 0.5s ease-out 0.9s both' }}>
        We received your request, <strong>{name}</strong>.
      </p>
      {chosenDay && (
        <p className="text-[#4a6a3a] mb-4" style={{ animation: 'fadeUp 0.5s ease-out 1s both' }}>
          We&apos;ll be there on <strong>{formatDay(chosenDay).weekday}, {formatDay(chosenDay).date}</strong>.
        </p>
      )}
      <div className="bg-white border border-[#c8dfc0] rounded-xl px-5 py-4 text-sm text-[#4a6a3a] mt-4"
        style={{ animation: 'fadeUp 0.5s ease-out 1.1s both' }}>
        <p className="font-semibold text-[#1e3d12] mb-1">Your quote summary</p>
        <p>Base mowing: <strong>${quoteData?.base_price}/mow</strong></p>
        {selectedAddons.length > 0 && (quoteData?.addons ?? [])
          .filter((a) => selectedAddons.includes(a.key))
          .map((a) => <p key={a.key}>{a.label}: <strong>+${a.price}</strong></p>)
        }
        <p className="border-t border-[#c8dfc0] mt-2 pt-2 font-bold text-[#1e3d12]">Total: ${total}/mow</p>
      </div>
      <p className="text-xs text-[#7a9a6a] mt-5">No contracts · Cancel anytime</p>
    </div>
  )

  // ── Error ─────────────────────────────────────────────────────────────────
  if (step === 'error') return shell(
    <div className="w-full max-w-sm text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
      <p className="text-zinc-500 text-sm mb-6">{error || 'Please try again or call us directly.'}</p>
      <button onClick={() => { setStep('address'); setError('') }}
        className="px-6 py-3 bg-[#2d5a1b] text-white rounded-lg font-semibold hover:bg-[#1e3d12] transition-colors">
        Try Again
      </button>
    </div>
  )

  // ── Address form ──────────────────────────────────────────────────────────
  if (step === 'address') return shell(
    <div className="w-full max-w-md" style={{ animation: 'slideIn 0.4s ease-out' }}>
      <Logo />
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#1e3d12] tracking-tight leading-tight">
          Get your instant<br />lawn mowing quote
        </h1>
        <p className="text-[#5a7a4a] mt-3 text-base">
          Enter your address — we&apos;ll measure your yard and build a real price in seconds.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#2d5a1b]" />
        <form onSubmit={handleAddressSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-2">Property address</label>
            <input
              ref={addrRef}
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="1234 Oak St, Kendallville, IN 46755"
              className="w-full rounded-xl border-2 border-zinc-200 px-4 py-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#2d5a1b] transition-colors"
            />
          </div>
          <button type="submit"
            className="w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold hover:bg-[#1e3d12] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            Get My Free Quote
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="text-xs text-zinc-400 text-center">Takes about 30 seconds · No spam · No commitment</p>
        </form>
      </div>

      <div className="flex justify-center gap-6 mt-6 text-xs text-[#7a9a6a]">
        <span>✓ Locally owned</span>
        <span>✓ No contracts</span>
        <span>✓ Instant quote</span>
      </div>
    </div>
  )

  // ── Quote reveal ──────────────────────────────────────────────────────────
  if (step === 'quote') return shell(
    <div className="w-full max-w-md" style={{ animation: 'slideIn 0.5s ease-out' }}>
      <Logo />

      {/* Price hero */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="bg-[#2d5a1b] px-6 py-5 text-center">
          <p className="text-[#a8dfc0] text-sm font-medium mb-1">Your estimated weekly price</p>
          <p className="text-5xl font-black text-white">${total}</p>
          <p className="text-[#a8dfc0] text-sm mt-1">/mow</p>
          {quoteData?.mowable_sqft && (
            <p className="text-[#c8efc0] text-xs mt-2">
              ~{quoteData.mowable_sqft.toLocaleString()} sqft of mowable lawn
              {quoteData.confidence === 'estimate' && ' (estimated)'}
            </p>
          )}
        </div>

        {/* Add-ons */}
        {(quoteData?.addons ?? []).length > 0 && (
          <div className="px-5 py-4 border-b border-zinc-100">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Optional add-ons</p>
            <div className="space-y-2">
              {(quoteData?.addons ?? []).map((addon) => {
                const on = selectedAddons.includes(addon.key)
                return (
                  <button key={addon.key} onClick={() => toggleAddon(addon.key)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                      on ? 'border-[#2d5a1b] bg-[#f0f8ec]' : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        on ? 'border-[#2d5a1b] bg-[#2d5a1b]' : 'border-zinc-300'
                      }`}>
                        {on && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">{addon.label}</p>
                        <p className="text-xs text-zinc-400">{addon.description}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ml-3 shrink-0 ${on ? 'text-[#2d5a1b]' : 'text-zinc-500'}`}>
                      +${addon.price}
                    </span>
                  </button>
                )
              })}
            </div>
            {selectedAddons.length > 0 && (
              <div className="mt-3 px-1 flex items-center justify-between text-sm">
                <span className="text-zinc-500">Total with add-ons:</span>
                <span className="font-bold text-[#1e3d12] text-base">${total}/mow</span>
              </div>
            )}
          </div>
        )}

        {/* Start day picker */}
        <div className="px-5 py-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">
            {availDays.length > 0 ? 'Choose a start day' : 'Start day'}
          </p>
          {availDays.length === 0 ? (
            <p className="text-sm text-zinc-400 italic">We&apos;ll reach out to schedule your first mow.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availDays.map((day) => {
                const { weekday, date } = formatDay(day.available_date)
                const chosen = chosenDay === day.available_date
                return (
                  <button key={day.id} onClick={() => setChosenDay(chosen ? null : day.available_date)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      chosen ? 'border-[#2d5a1b] bg-[#f0f8ec]' : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}>
                    <p className={`text-sm font-bold ${chosen ? 'text-[#1e3d12]' : 'text-zinc-800'}`}>{weekday}</p>
                    <p className="text-xs text-zinc-400">{date}</p>
                    {day.notes && <p className="text-xs text-zinc-300 mt-0.5 truncate">{day.notes}</p>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <button onClick={() => setStep('contact')}
        className="w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold hover:bg-[#1e3d12] active:scale-[0.98] transition-all">
        Looks good — book it →
      </button>
      <p className="text-xs text-zinc-400 text-center mt-3">No payment now · We confirm before your first mow</p>
    </div>
  , false)

  // ── Contact form ──────────────────────────────────────────────────────────
  if (step === 'contact' || step === 'confirming') return shell(
    <div className="w-full max-w-md" style={{ animation: 'slideIn 0.4s ease-out' }}>
      <Logo />

      {/* Summary pill */}
      <div className="bg-[#2d5a1b] text-white rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#a8dfc0]">Your quote</p>
          <p className="font-bold text-xl">${total}<span className="text-sm font-normal text-[#a8dfc0]">/mow</span></p>
        </div>
        {chosenDay && (
          <div className="text-right">
            <p className="text-xs text-[#a8dfc0]">Start day</p>
            <p className="font-semibold text-sm">{formatDay(chosenDay).weekday}</p>
            <p className="text-xs text-[#a8dfc0]">{formatDay(chosenDay).date}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#2d5a1b]" />
        <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1e3d12] mb-0.5">Almost there!</h2>
            <p className="text-sm text-zinc-500">Just need your name and number to confirm.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Your name</label>
            <input
              type="text" required
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith" autoFocus
              className="w-full rounded-xl border-2 border-zinc-200 px-4 py-3.5 text-base placeholder:text-zinc-400 focus:outline-none focus:border-[#2d5a1b] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Phone number</label>
            <input
              type="tel" required
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="(260) 555-0100"
              className="w-full rounded-xl border-2 border-zinc-200 px-4 py-3.5 text-base placeholder:text-zinc-400 focus:outline-none focus:border-[#2d5a1b] transition-colors"
            />
            <p className="text-xs text-zinc-400 mt-1.5">We&apos;ll call or text to confirm your first mow. No spam.</p>
          </div>

          <button type="submit" disabled={step === 'confirming'}
            className="w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold hover:bg-[#1e3d12] active:scale-[0.98] transition-all disabled:opacity-60">
            {step === 'confirming' ? 'Confirming…' : 'Confirm my quote →'}
          </button>
        </form>
      </div>

      <button onClick={() => setStep('quote')} className="w-full text-center text-sm text-[#7a9a6a] mt-4 hover:text-[#4a6a3a] transition-colors">
        ← Back to quote
      </button>
    </div>
  )

  return null
}
