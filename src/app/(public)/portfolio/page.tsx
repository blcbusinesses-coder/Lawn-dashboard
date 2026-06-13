'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 12
const FALLBACK_PHOTOS = ['/lawn1.jpg', '/lawn4.jpg', '/lawn2.jpg', '/lawn3.jpg']

// Photos are managed from the dashboard Website tab (/dashboard/site), which
// uploads to the public 'gallery' storage bucket. This page renders whatever
// is in the bucket, newest first.

export default function PortfolioPage() {
  const [photos, setPhotos] = useState<string[]>([])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.storage.from('gallery')
      .list('', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } })
      .then(({ data }) => {
        if (cancelled) return
        if (data && data.length > 0) {
          const urls = data
            .filter(f => f.name !== '.emptyFolderPlaceholder')
            .map(f => supabase.storage.from('gallery').getPublicUrl(f.name).data.publicUrl)
          setPhotos(urls.length > 0 ? urls : FALLBACK_PHOTOS)
        } else {
          setPhotos(FALLBACK_PHOTOS)
        }
      })
      .catch(() => { if (!cancelled) setPhotos(FALLBACK_PHOTOS) })
    return () => { cancelled = true }
  }, [])

  const shown = photos.slice(0, visible)
  const hasMore = visible < photos.length

  return (
    <div className="antialiased bg-white min-h-screen flex flex-col">
      {/* Top bar */}
      <div style={{ background: '#122b0a' }}>
        <div className="max-w-6xl mx-auto px-5 h-10 flex items-center justify-between text-xs text-white/90">
          <p className="font-semibold tracking-wide">
            <span style={{ color: '#e9b949' }}>Limited time:</span> new customers get <span className="font-bold text-white">25% off their first month</span>
          </p>
          <a href="mailto:graywolfworkers@gmail.com" className="hidden sm:block hover:text-white font-medium text-white/70">
            graywolfworkers@gmail.com
          </a>
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #e2e2d8' }}>
        <div className="max-w-6xl mx-auto px-5 h-[72px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Gray Wolf Workers" className="w-11 h-11 object-contain" />
            <span className="leading-tight">
              <span className="block font-extrabold text-[16px] tracking-tight" style={{ color: '#181b15' }}>Gray Wolf Workers</span>
              <span className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: '#2f6418' }}>Lawn Care · Kendallville, IN</span>
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="hidden sm:block text-[14px] font-semibold hover:text-[#1e3d12] transition-colors" style={{ color: '#41483b' }}>
              ← Back to Home
            </Link>
            <Link href="/get-a-quote"
              className="inline-flex items-center font-bold px-6 py-3 text-sm text-white transition-colors"
              style={{ background: '#1e3d12' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2f6418')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1e3d12')}>
              Get My Price
            </Link>
          </div>
        </div>
      </header>

      {/* Header */}
      <section className="py-16 md:py-20" style={{ background: '#f4f4ee' }}>
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-xs font-bold uppercase mb-4" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>Portfolio</p>
          <h1 className="text-4xl md:text-[52px] font-extrabold tracking-tight leading-[1.05] mb-5" style={{ color: '#181b15' }}>
            Our work speaks for itself.
          </h1>
          <p className="text-[16px] leading-relaxed max-w-xl" style={{ color: '#5b6354' }}>
            Every photo here is a real property we maintain in Noble County — no stock images, no staging.
            This is what your lawn could look like.
          </p>
        </div>
      </section>

      {/* Grid */}
      <main className="flex-1 py-12 md:py-16 bg-white">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {shown.map((url, i) => (
              <div
                key={url}
                onClick={() => setLightbox(url)}
                className={`cursor-pointer overflow-hidden ${
                  i % 7 === 0 ? 'col-span-2 aspect-[16/9]' : 'aspect-square'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`A lawn maintained by Gray Wolf Workers — photo ${i + 1}`}
                  loading={i > 5 ? 'lazy' : undefined}
                  className="w-full h-full object-cover transition-opacity hover:opacity-85"
                />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={() => setVisible(v => v + PAGE_SIZE)}
                className="font-bold px-8 py-3.5 text-sm transition-colors"
                style={{ border: '2px solid #1e3d12', color: '#1e3d12' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1e3d12'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1e3d12' }}
              >
                Load More Photos
              </button>
            </div>
          )}
        </div>
      </main>

      {/* CTA */}
      <section className="py-16 md:py-20" style={{ background: '#122b0a' }}>
        <div className="max-w-6xl mx-auto px-5 md:flex items-center justify-between gap-10">
          <div className="mb-7 md:mb-0 max-w-lg">
            <h2 className="text-3xl md:text-[36px] font-extrabold text-white tracking-tight leading-tight mb-3">
              Want your lawn in this gallery?
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Get your exact price in under a minute — and 25% off your first month.
            </p>
          </div>
          <Link href="/get-a-quote"
            className="shrink-0 inline-flex items-center justify-center font-bold px-9 py-4 text-[15px] transition-colors"
            style={{ background: '#fff', color: '#1e3d12' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e9f0e4')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            Get My Price
          </Link>
        </div>
      </section>

      {/* Footer strip */}
      <footer className="py-8" style={{ background: '#0d1d07', color: '#9aa192' }}>
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC · Kendallville, IN 46755</p>
          <Link href="/" className="hover:text-white font-medium">graywolfworkers.com</Link>
        </div>
      </footer>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(12,14,10,0.94)' }}
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: '90vh', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white text-3xl font-light leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
