'use client'

import { useState } from 'react'

type Step = 'form' | 'loading' | 'success' | 'error'

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
      // Step 1: save the lead
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!leadRes.ok) throw new Error((await leadRes.json()).error ?? 'Failed to submit')
      const lead = await leadRes.json()

      // Step 2: kick off property lookup + quote + SMS (this may take up to 45s)
      await fetch(`/api/leads/${lead.id}/quote`, { method: 'POST' })

      setStep('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4 animate-bounce">🐺</div>
          <h2 className="text-xl font-bold text-zinc-800 mb-2">Looking up your property…</h2>
          <p className="text-zinc-500 text-sm">We&apos;re fetching your property details and calculating a custom quote. This takes about 30 seconds.</p>
          <div className="mt-6 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Quote on its way!</h2>
          <p className="text-zinc-500">
            We sent your personalized lawn mowing quote to <strong>{form.phone}</strong>. Reply to that text to confirm your service.
          </p>
          <p className="text-zinc-400 text-sm mt-4">Didn&apos;t get it? Check that your number is correct or email us.</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
          <p className="text-zinc-500 text-sm mb-4">{errorMsg}</p>
          <button
            onClick={() => setStep('form')}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm hover:bg-zinc-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-2xl mb-4">
            <span className="text-2xl">🐺</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-900">Gray Wolf Workers</h1>
          <p className="text-zinc-500 mt-2">Get a free lawn mowing quote in minutes — we&apos;ll text it straight to your phone.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Your Name *</label>
            <input
              type="text"
              required
              placeholder="Jane Smith"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Phone Number * <span className="text-zinc-400 font-normal">(we&apos;ll text your quote here)</span></label>
            <input
              type="tel"
              required
              placeholder="(555) 123-4567"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email <span className="text-zinc-400 font-normal">(optional)</span></label>
            <input
              type="email"
              placeholder="jane@email.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Property Address * <span className="text-zinc-400 font-normal">(where we&apos;ll mow)</span></label>
            <input
              type="text"
              required
              placeholder="1234 Oak St, Dallas, TX 75201"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Preferred Mow Day <span className="text-zinc-400 font-normal">(optional)</span></label>
            <input
              type="date"
              value={form.preferred_date}
              onChange={(e) => set('preferred_date', e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-zinc-900 text-white rounded-lg py-3 text-sm font-semibold hover:bg-zinc-700 transition-colors mt-2"
          >
            Get My Free Quote →
          </button>

          <p className="text-xs text-zinc-400 text-center">
            We&apos;ll text you within 1 minute. No spam, ever.
          </p>
        </form>
      </div>
    </div>
  )
}
