/**
 * Public local-SEO landing page: /lawn-care/[slug]
 * e.g. /lawn-care/lawn-mowing-kendallville-in
 *
 * Server-rendered from the seo_pages table with unique title/meta, H1, local
 * copy, FAQs, and LocalBusiness + Service + FAQPage JSON-LD. Pages are created
 * and published from /dashboard/marketing/seo.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://graywolfworkers.com'

interface SeoPage {
  slug: string
  service: string
  city: string
  county: string | null
  state: string
  title: string
  meta_description: string
  h1: string
  intro: string
  body: string | null
  faqs: Array<{ q: string; a: string }>
  published: boolean
  updated_at: string
}

async function getPage(slug: string): Promise<SeoPage | null> {
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from('seo_pages') as any)
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()
  return (data as SeoPage) ?? null
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) return { title: 'Gray Wolf Workers' }
  return {
    title: page.title,
    description: page.meta_description,
    alternates: { canonical: `${SITE_URL}/lawn-care/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.meta_description,
      url: `${SITE_URL}/lawn-care/${page.slug}`,
      siteName: 'Gray Wolf Workers',
      images: [{ url: `${SITE_URL}/lawn2.jpg` }],
      locale: 'en_US',
      type: 'website',
    },
  }
}

/** Render stored copy: blank-line-separated paragraphs; '## ' lines become h2. */
function renderCopy(text: string) {
  return text
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      if (block.startsWith('## ')) {
        return (
          <h2 key={i} className="text-2xl md:text-[28px] font-extrabold tracking-tight mt-12 mb-4" style={{ color: '#181b15' }}>
            {block.slice(3)}
          </h2>
        )
      }
      return (
        <p key={i} className="text-[15.5px] leading-relaxed mb-5" style={{ color: '#5b6354' }}>
          {block}
        </p>
      )
    })
}

export default async function LocalSeoPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  const pageUrl = `${SITE_URL}/lawn-care/${page.slug}`
  const areaServed = page.county ? `${page.city}, ${page.county}, Indiana` : `${page.city}, Indiana`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': `${SITE_URL}/#business`,
        name: 'Gray Wolf Workers',
        description: 'Professional lawn care serving Kendallville and Northeast Indiana.',
        url: SITE_URL,
        email: 'graywolfworkers@gmail.com',
        image: `${SITE_URL}/lawn2.jpg`,
        logo: `${SITE_URL}/logo.png`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Kendallville',
          addressRegion: 'IN',
          postalCode: '46755',
          addressCountry: 'US',
        },
        areaServed: { '@type': 'Place', name: areaServed },
        priceRange: '$$',
      },
      {
        '@type': 'Service',
        serviceType: page.service,
        provider: { '@id': `${SITE_URL}/#business` },
        areaServed: { '@type': 'Place', name: areaServed },
        url: pageUrl,
      },
      ...(page.faqs.length > 0
        ? [{
            '@type': 'FAQPage',
            mainEntity: page.faqs.map(f => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }]
        : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: page.h1, item: pageUrl },
        ],
      },
    ],
  }

  return (
    <div className="antialiased bg-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top bar */}
      <div style={{ background: '#1e3d12' }}>
        <div className="max-w-4xl mx-auto px-5 h-9 flex items-center justify-between text-xs text-white/85">
          <p className="font-medium tracking-wide">
            New customers: <span className="font-bold text-white">75% off your first month</span>
          </p>
          <a href="mailto:graywolfworkers@gmail.com" className="hidden sm:block hover:text-white font-medium">
            graywolfworkers@gmail.com
          </a>
        </div>
      </div>

      {/* Nav */}
      <header className="bg-white" style={{ borderBottom: '1px solid #e2e2d8' }}>
        <div className="max-w-4xl mx-auto px-5 h-[68px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Gray Wolf Workers" className="w-10 h-10 object-contain" />
            <span className="leading-tight">
              <span className="block font-bold text-[15px]" style={{ color: '#181b15' }}>Gray Wolf Workers</span>
              <span className="block text-[11px] font-medium tracking-wide" style={{ color: '#5b6354' }}>Lawn Care · Kendallville, IN</span>
            </span>
          </Link>
          <Link href="/get-a-quote"
            className="inline-flex items-center font-semibold px-5 py-2.5 text-sm text-white"
            style={{ background: '#1e3d12' }}>
            Get a Free Quote
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-5 py-14 md:py-20">
        <p className="text-xs font-bold uppercase mb-5" style={{ color: '#2f6418', letterSpacing: '0.16em' }}>
          {page.service} · {areaServed}
        </p>
        <h1 className="text-4xl md:text-[46px] font-extrabold tracking-tight leading-[1.06] mb-8" style={{ color: '#181b15' }}>
          {page.h1}
        </h1>

        <div className="max-w-2xl">
          {renderCopy(page.intro)}
          {page.body ? renderCopy(page.body) : null}
        </div>

        {/* Inline CTA */}
        <div className="my-12 p-7 md:p-9" style={{ background: '#f4f4ee', borderLeft: '4px solid #1e3d12' }}>
          <h2 className="text-xl font-extrabold tracking-tight mb-2" style={{ color: '#181b15' }}>
            Get your {page.city} lawn quote in under a minute
          </h2>
          <p className="text-[14.5px] leading-relaxed mb-5 max-w-lg" style={{ color: '#5b6354' }}>
            Text us your address and we&apos;ll send back an honest price — no calls, no salespeople.
            New customers get 75% off their first month.
          </p>
          <Link href="/get-a-quote"
            className="inline-flex items-center font-semibold px-7 py-3.5 text-[15px] text-white"
            style={{ background: '#1e3d12' }}>
            Get a Free Quote
          </Link>
        </div>

        {/* FAQs */}
        {page.faqs.length > 0 && (
          <section className="max-w-2xl">
            <h2 className="text-2xl md:text-[28px] font-extrabold tracking-tight mb-7" style={{ color: '#181b15' }}>
              Common questions about {page.service.toLowerCase()} in {page.city}
            </h2>
            <div style={{ borderTop: '1px solid #e2e2d8' }}>
              {page.faqs.map((f, i) => (
                <div key={i} className="py-6" style={{ borderBottom: '1px solid #e2e2d8' }}>
                  <h3 className="font-bold text-[16px] mb-2.5" style={{ color: '#181b15' }}>{f.q}</h3>
                  <p className="text-[14.5px] leading-relaxed" style={{ color: '#5b6354' }}>{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-10" style={{ background: '#181b15', color: '#9aa192' }}>
        <div className="max-w-4xl mx-auto px-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <p>© {new Date().getFullYear()} Gray Wolf Workers LLC · Kendallville, IN 46755</p>
          <Link href="/" className="hover:text-white font-medium">graywolfworkers.com</Link>
        </div>
      </footer>
    </div>
  )
}
