'use client'

import { useState, useEffect } from 'react'

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

// Cities we service, ordered roughly by distance from Kendallville
const SERVICE_CITIES = [
  'Kendallville',
  'Albion',
  'Avilla',
  'Rome City',
  'Ligonier',
  'Wolcottville',
  'Garrett',
  'Howe',
  'LaGrange',
  'Auburn',
  'Angola',
  'Columbia City',
]

type Step = 'form' | 'submitting' | 'done'

const inputClass = "w-full px-4 py-3 rounded-xl border border-[#c8dfc0] bg-[#f7fbf4] text-[#1e3d12] placeholder-[#9ab890] text-sm focus:outline-none focus:border-[#2d5a1b] transition-colors"
const labelClass = "block text-xs font-semibold text-[#2d5a1b] uppercase tracking-wide mb-1.5"

export default function GetAQuotePage() {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')

  // Prefill the street if the homepage hero passed one (?street=...).
  useEffect(() => {
    const fromHero = new URLSearchParams(window.location.search).get('street')
    if (fromHero?.trim()) {
      Promise.resolve().then(() => setStreet(fromHero.trim()))
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim() || !street.trim() || !city) {
      setError('Please fill in all fields.')
      return
    }
    setStep('submitting')
    const fullAddress = `${street.trim()}, ${city}, IN`
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), address: fullAddress, source: 'website' }),
      })
      if (!res.ok) throw new Error()
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('form')
    }
  }

  return (
    <div className="min-h-screen bg-[#eef3e8] flex flex-col overflow-x-hidden">
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">

          <div className="text-center mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Gray Wolf Workers" className="w-16 h-16 object-contain mx-auto mb-3" />
            <h1 className="text-3xl font-bold text-[#1e3d12] tracking-tight">Get a Free Quote</h1>
            <p className="text-[#5a7a4a] mt-2 text-sm leading-relaxed max-w-xs mx-auto">
              Fill in your info and we&apos;ll text you a custom price in under a minute.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="h-1.5 bg-[#2d5a1b]" />
            <div className="p-6">

              {step === 'done' ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-[#eef3e8] flex items-center justify-center mx-auto">
                    <svg className="w-7 h-7 text-[#2d5a1b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-xl font-bold text-[#1e3d12]">You&apos;re all set!</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">
                    We got your info and we&apos;re working on your quote right now.
                    Expect a text from us shortly!
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className={labelClass}>Full Name</label>
                    <input
                      type="text"
                      placeholder="John Smith"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="(260) 555-0100"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Street Address</label>
                    <input
                      type="text"
                      placeholder="123 Main St"
                      value={street}
                      onChange={e => setStreet(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>City</label>
                    <select
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      required
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="">Select your city…</option>
                      {SERVICE_CITIES.map(c => (
                        <option key={c} value={c}>{c}, IN</option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <p className="text-xs text-red-500 text-center">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={step === 'submitting'}
                    className="w-full bg-[#2d5a1b] text-white rounded-xl py-4 text-base font-bold hover:bg-[#1e3d12] active:scale-[0.98] transition-all shadow-sm disabled:opacity-60"
                  >
                    {step === 'submitting' ? 'Sending…' : 'Get My Free Quote →'}
                  </button>

                  <p className="text-xs text-zinc-400 text-center">
                    We&apos;ll text your quote to the number above. No spam, ever.
                  </p>
                </form>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-[#7a9a6a]">
            Locally owned &amp; operated &nbsp;·&nbsp; Kendallville &amp; surrounding areas &nbsp;·&nbsp; No contracts
          </p>
        </div>
      </div>

      <div className="pointer-events-none overflow-hidden">
        <GrassRow />
      </div>
    </div>
  )
}
