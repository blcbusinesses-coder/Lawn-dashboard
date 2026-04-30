'use client'

import { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AddonOption { key: string; label: string; price: number; description: string }

interface QuoteData {
  lot_size_sqft:  number | null
  mowable_sqft:   number | null
  base_price:     number
  confidence:     'measured' | 'estimate'
  addons:         AddonOption[]
}

type Step = 'address' | 'loading' | 'quote' | 'contact' | 'confirming' | 'confirmed' | 'error'

// ── Service areas ─────────────────────────────────────────────────────────────
const SERVICE_AREAS = [
  'Kendallville',
  'Albion',
  'Angola',
  'Auburn',
  'Avilla',
  'Churubusco',
  'Columbia City',
  'Garrett',
  'LaGrange',
  'Ligonier',
  'Rome City',
  'Waterloo',
  'Wolcottville',
]

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

// ── Loading screen ────────────────────────────────────────────────────────────
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
    const prog = setInterval(() => setProgress((p) => Math.min(p + 100 / 350, 97)), 100)
    const msg  = setInterval(() => setMsgIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)), 8000)
    return () => { clearInterval(prog); clearInterval(msg) }
  }, [])

  const m = LOADING_MESSAGES[msgIdx]

  return (
    <div className="w-full max-w-sm text-center px-4">
      <style>{`
        @keyframes fadeUp      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer     { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes pulse-ring  { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.5);opacity:0} }
      `}</style>
      <div className="relative inline-flex items-center justify-center mb-8">
        <div className="absolute w-20 h-20 rounded-full bg-[#2d5a1b]/20"
          style={{ animation: 'pulse-ring 1.5s ease-out infinite' }} />
        <div className="relative w-16 h-16 bg-[#2d5a1b] rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-2xl" key={msgIdx} style={{ animation: 'fadeUp 0.4s ease-out' }}>{m.icon}</span>
        </div>
      </div>
      <p className="text-xl font-bold text-[#1e3d12] mb-2" key={msgIdx} style={{ animation: 'fadeUp 0.4s ease-out' }}>
        {m.text}
      </p>
      <p className="text-sm text-[#5a7a4a] mb-8">
        We look up your property and build a real custom quote — takes about 30 seconds.
      </p>
      <div className="relative h-2 bg-[#c8dfc0] rounded-full overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg,#2d5a1b,#4a9030,#2d5a1b)',
            backgroundSize: '200% auto',
            animation: 'shimmer 2s linear infinite',
          }} />
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
        strokeDasharray="226" style={{ animation: 'drawCircle 0.6s ease-out forwards', strokeDashoffset: 226 }} />
      <path d="M30 50 L43 63 L70 35" stroke="#2d5a1b" strokeWidth="6"
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60"
        style={{ animation: 'drawCheck 0.4s ease-out forwards 0.55s', strokeDashoffset: 60 }} />
    </svg>
  )
}

// ── Logo — shows wolf image, falls back to "GW" badge if image missing ────────
function Logo() {
  const [imgError, setImgError] = useState(false)
  return (
    <div className="flex flex-col items-center mb-5">
      {imgError ? (
        <div className="w-14 h-14 bg-[#2d5a1b] rounded-2xl flex items-center justify-center mb-2 shadow-md">
          <span className="text-white font-bold text-base">GW</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.png" alt="Gray Wolf Workers"
          className="w-14 h-14 object-contain mb-2"
          onError={() => setImgError(true)} />
      )}
      <p className="text-[#1e3d12] font-semibold text-sm">Gray Wolf Workers</p>
    </div>
  )
}

// ── Day abbreviations ─────────────────────────────────────────────────────────
const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

// ── Background collage ────────────────────────────────────────────────────────
const GALLERY = ['/lawn1.jpg', '/lawn2.jpg', '/lawn3.jpg', '/lawn4.jpg']

function BackgroundCollage() {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      // fade out
      setVisible(false)
      setTimeout(() => {
        setCurrent(c => (c + 1) % GALLERY.length)
        setVisible(true)
      }, 800)
    }, 5800) // 5 s visible + 0.8 s fade = 5.8 s per photo → ~23 s full cycle
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      {/* single full-screen photo that rotates every 5 s */}
      <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={GALLERY[current]}
          alt=""
          className="w-full h-full object-cover"
          style={{
            animation: 'slowZoomIn 6s ease-in-out forwards',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease-in-out',
          }}
        />
      </div>
      {/* soft green overlay so the form stays readable */}
      <div className="fixed inset-0 z-0 bg-[#eef3e8]/[0.82]" />
    </>
  )
}

// ── Shell wrapper — always horizontally centered ───────────────────────────────
// scrollable=true → vertically top-aligned (for taller steps that need scroll)
// scrollable=false → vertically centered (for short steps)
function Shell({ children, scrollable = false }: { children: React.ReactNode; scrollable?: boolean }) {
  return (
    <div className="min-h-screen bg-[#eef3e8] flex flex-col overflow-x-hidden relative">
      <style>{`
        @keyframes drawCircle   { from{stroke-dashoffset:226} to{stroke-dashoffset:0} }
        @keyframes drawCheck    { from{stroke-dashoffset:60}  to{stroke-dashoffset:0} }
        @keyframes fadeUp       { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn      { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slowZoomIn   { from{transform:scale(1.05)} to{transform:scale(1.12)} }
        @keyframes slowZoomOut  { from{transform:scale(1.12)} to{transform:scale(1.05)} }
      `}</style>

      <BackgroundCollage />

      <div className={`relative z-10 flex-1 flex justify-center px-4 ${scrollable ? 'items-start py-8' : 'items-center py-10'}`}>
        {children}
      </div>
      <div className="relative z-10 pointer-events-none overflow-hidden">
        <GrassRow />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GetAQuotePage() {
  const [step, setStep]           = useState<Step>('address')
  const [street, setStreet]       = useState('')
  const [city, setCity]           = useState('Kendallville')
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null)
  const [availDays, setAvailDays] = useState<string[]>([])
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [chosenDay, setChosenDay] = useState<string | null>(null)
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [error, setError]         = useState('')
  const addrRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Slight delay to avoid immediately triggering iOS keyboard on page load
    const t = setTimeout(() => addrRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  // Full address string used for lookup and storage
  const fullAddress = `${street.trim()}, ${city}, IN`

  // Filter out add-ons we don't offer (weed treatment removed)
  const displayAddons = (quoteData?.addons ?? []).filter((a) => a.key !== 'weed_treatment')

  // ── Step 1: Submit address ────────────────────────────────────────────────
  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!street.trim() || !city) return
    setStep('loading')
    setSelectedAddons([])
    setChosenDay(null)

    try {
      const [quoteRes, availRes] = await Promise.all([
        fetch('/api/quote/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: fullAddress }),
        }),
        fetch('/api/quote/availability'),
      ])

      if (!quoteRes.ok) throw new Error('Could not calculate quote')
      setQuoteData(await quoteRes.json())
      setAvailDays(availRes.ok ? await availRes.json() : [])
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
      const selectedAddonObjects = displayAddons.filter((a) => selectedAddons.includes(a.key))
      const res = await fetch('/api/quote/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                name.trim(),
          phone:               phone.trim(),
          address:             fullAddress,
          lot_size_sqft:       quoteData?.lot_size_sqft ?? null,
          mowable_sqft:        quoteData?.mowable_sqft ?? null,
          base_price:          quoteData?.base_price ?? 0,
          addons:              selectedAddonObjects,
          selected_addon_keys: selectedAddons,
          chosen_start_day:    chosenDay,
        }),
      })
      if (!res.ok) throw new Error('Could not save your request')
      setStep('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const addonTotal = displayAddons
    .filter((a) => selectedAddons.includes(a.key))
    .reduce((sum, a) => sum + a.price, 0)
  const total = (quoteData?.base_price ?? 0) + addonTotal

  function toggleAddon(key: string) {
    setSelectedAddons((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <Shell>
      <div className="text-center">
        <Logo />
        <LoadingScreen />
      </div>
    </Shell>
  )

  // ── CONFIRMED ─────────────────────────────────────────────────────────────
  if (step === 'confirmed') return (
    <Shell>
      <div className="w-full max-w-sm text-center px-2" style={{ animation: 'fadeUp 0.5s ease-out' }}>
        <AnimatedCheck />
        <h2 className="text-2xl font-bold text-[#1e3d12] mt-5 mb-2"
          style={{ animation: 'fadeUp 0.5s ease-out 0.7s both' }}>
          You&apos;re all set!
        </h2>
        <p className="text-[#4a6a3a] mb-1" style={{ animation: 'fadeUp 0.5s ease-out 0.9s both' }}>
          We received your request, <strong>{name}</strong>.
        </p>
        {chosenDay && (
          <p className="text-[#4a6a3a] mb-4" style={{ animation: 'fadeUp 0.5s ease-out 1s both' }}>
            We&apos;ll aim to mow on <strong>{chosenDay}s</strong>.
          </p>
        )}
        <div className="bg-white border border-[#c8dfc0] rounded-xl px-5 py-4 text-sm text-[#4a6a3a] mt-4 text-left"
          style={{ animation: 'fadeUp 0.5s ease-out 1.1s both' }}>
          <p className="font-semibold text-[#1e3d12] mb-2">Your quote summary</p>
          <p>Base mowing: <strong>${quoteData?.base_price}/mow</strong></p>
          {selectedAddons.length > 0 && displayAddons
            .filter((a) => selectedAddons.includes(a.key))
            .map((a) => <p key={a.key}>{a.label}: <strong>+${a.price}</strong></p>)
          }
          <p className="border-t border-[#c8dfc0] mt-2 pt-2 font-bold text-[#1e3d12]">
            Total: ${total}/mow
          </p>
        </div>
        <p className="text-xs text-[#7a9a6a] mt-5">No contracts · Cancel anytime</p>
      </div>
    </Shell>
  )

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (step === 'error') return (
    <Shell>
      <div className="w-full max-w-sm text-center px-2">
        <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
        <p className="text-zinc-500 text-sm mb-6">{error || 'Please try again or call us directly.'}</p>
        <button onClick={() => { setStep('address'); setError('') }}
          className="px-8 py-4 bg-[#2d5a1b] text-white rounded-xl font-semibold text-base
            hover:bg-[#1e3d12] active:scale-[0.98] transition-all w-full">
          Try Again
        </button>
      </div>
    </Shell>
  )

  // ── ADDRESS FORM ──────────────────────────────────────────────────────────
  if (step === 'address') return (
    <Shell>
      <div className="w-full max-w-md" style={{ animation: 'slideIn 0.4s ease-out' }}>
        <Logo />

        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1e3d12] tracking-tight leading-tight">
            Get your instant<br />lawn mowing quote
          </h1>
          <p className="text-[#5a7a4a] mt-2 text-sm sm:text-base">
            Enter your address — we&apos;ll measure your yard and build a real price in seconds.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#2d5a1b]" />
          <form onSubmit={handleAddressSubmit} className="p-5 sm:p-6 space-y-4">

            {/* Street address */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">
                Street address
              </label>
              <input
                ref={addrRef}
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="1234 Oak St"
                autoComplete="street-address"
                style={{ fontSize: '16px' }}
                className="w-full rounded-xl border-2 border-zinc-200 px-4 py-3.5 text-zinc-900
                  placeholder:text-zinc-400 focus:outline-none focus:border-[#2d5a1b] transition-colors"
              />
            </div>

            {/* City / service area */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">
                City / area
              </label>
              <div className="relative">
                <select
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  style={{ fontSize: '16px' }}
                  className="w-full rounded-xl border-2 border-zinc-200 px-4 py-3.5 text-zinc-900
                    bg-white appearance-none focus:outline-none focus:border-[#2d5a1b] transition-colors
                    pr-10"
                >
                  {SERVICE_AREAS.map((area) => (
                    <option key={area} value={area}>{area}, IN</option>
                  ))}
                </select>
                {/* Dropdown chevron */}
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">Don&apos;t see your city? We may still service you — give us a call.</p>
            </div>

            <button type="submit"
              className="w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold
                hover:bg-[#1e3d12] active:scale-[0.98] transition-all flex items-center justify-center gap-2
                min-h-[52px]">
              Get My Free Quote
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>

            <p className="text-xs text-zinc-400 text-center">Takes ~30 seconds · No spam · No commitment</p>
          </form>
        </div>

        <div className="flex justify-center gap-5 mt-5 text-xs text-[#7a9a6a]">
          <span>✓ Locally owned</span>
          <span>✓ No contracts</span>
          <span>✓ Instant quote</span>
        </div>
      </div>
    </Shell>
  )

  // ── QUOTE REVEAL ──────────────────────────────────────────────────────────
  if (step === 'quote') return (
    <Shell scrollable>
      <div className="w-full max-w-md" style={{ animation: 'slideIn 0.5s ease-out' }}>
        <Logo />

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          {/* Price hero */}
          <div className="bg-[#2d5a1b] px-5 py-5 text-center">
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
          {displayAddons.length > 0 && (
            <div className="px-4 py-4 border-b border-zinc-100">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Optional add-ons</p>
              <div className="space-y-2">
                {displayAddons.map((addon) => {
                  const on = selectedAddons.includes(addon.key)
                  return (
                    <button key={addon.key} onClick={() => toggleAddon(addon.key)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2
                        transition-all text-left min-h-[56px] ${
                        on ? 'border-[#2d5a1b] bg-[#f0f8ec]' : 'border-zinc-200 bg-white'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                          shrink-0 transition-all ${on ? 'border-[#2d5a1b] bg-[#2d5a1b]' : 'border-zinc-300'}`}>
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
          <div className="px-4 py-4">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Preferred mow day</p>
            <p className="text-xs text-zinc-400 mb-3">We&apos;ll mow your lawn on this day every week.</p>
            {availDays.length === 0 ? (
              <p className="text-sm text-zinc-400 italic">We&apos;ll reach out to schedule your first mow.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availDays.map((day) => {
                  const chosen = chosenDay === day
                  return (
                    <button key={day} onClick={() => setChosenDay(chosen ? null : day)}
                      className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all
                        min-h-[44px] min-w-[60px] ${
                        chosen
                          ? 'border-[#2d5a1b] bg-[#2d5a1b] text-white'
                          : 'border-zinc-200 bg-white text-zinc-700'
                      }`}>
                      {DAY_ABBR[day] ?? day}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => setStep('contact')}
          className="w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold
            hover:bg-[#1e3d12] active:scale-[0.98] transition-all min-h-[52px]">
          Looks good — book it →
        </button>
        <p className="text-xs text-zinc-400 text-center mt-3 mb-2">
          No payment now · We confirm before your first mow
        </p>
      </div>
    </Shell>
  )

  // ── CONTACT FORM ──────────────────────────────────────────────────────────
  if (step === 'contact' || step === 'confirming') return (
    <Shell scrollable>
      <div className="w-full max-w-md" style={{ animation: 'slideIn 0.4s ease-out' }}>
        <Logo />

        {/* Summary pill */}
        <div className="bg-[#2d5a1b] text-white rounded-xl px-5 py-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#a8dfc0]">Your quote</p>
            <p className="font-bold text-xl">${total}<span className="text-sm font-normal text-[#a8dfc0]">/mow</span></p>
          </div>
          {chosenDay && (
            <div className="text-right">
              <p className="text-xs text-[#a8dfc0]">Mow day</p>
              <p className="font-semibold text-sm">{chosenDay}s</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#2d5a1b]" />
          <form onSubmit={handleContactSubmit} className="p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#1e3d12] mb-0.5">Almost there!</h2>
              <p className="text-sm text-zinc-500">Just need your name and number to confirm.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Your name</label>
              <input
                type="text" required
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                autoComplete="name"
                style={{ fontSize: '16px' }}
                className="w-full rounded-xl border-2 border-zinc-200 px-4 py-3.5 text-zinc-900
                  placeholder:text-zinc-400 focus:outline-none focus:border-[#2d5a1b] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Phone number</label>
              <input
                type="tel" required
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="(260) 555-0100"
                autoComplete="tel"
                inputMode="tel"
                style={{ fontSize: '16px' }}
                className="w-full rounded-xl border-2 border-zinc-200 px-4 py-3.5 text-zinc-900
                  placeholder:text-zinc-400 focus:outline-none focus:border-[#2d5a1b] transition-colors"
              />
              <p className="text-xs text-zinc-400 mt-1.5">We&apos;ll call or text to confirm. No spam.</p>
            </div>

            <button type="submit" disabled={step === 'confirming'}
              className="w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold
                hover:bg-[#1e3d12] active:scale-[0.98] transition-all disabled:opacity-60 min-h-[52px]">
              {step === 'confirming' ? 'Confirming…' : 'Confirm my quote →'}
            </button>
          </form>
        </div>

        <button onClick={() => setStep('quote')}
          className="w-full text-center text-sm text-[#7a9a6a] mt-4 py-3 hover:text-[#4a6a3a] transition-colors">
          ← Back to quote
        </button>
      </div>
    </Shell>
  )

  return null
}
