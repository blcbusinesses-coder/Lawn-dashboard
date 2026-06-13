import type { Metadata } from 'next'
import HomePage from '@/components/site/HomePage'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://graywolfworkers.com'

// The homepage renders at the root URL (no redirect — Google should index `/`
// directly). /home still works as an alias and canonicalizes here.
export const metadata: Metadata = {
  title: 'Lawn Mowing & Lawn Care in Kendallville, IN | Gray Wolf Workers',
  description:
    'Professional lawn mowing, trimming, and yard cleanup in Kendallville and across Noble County, Indiana. Enter your address and get your exact price in under a minute. New customers get their first mow free.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Lawn Mowing & Lawn Care in Kendallville, IN | Gray Wolf Workers',
    description:
      'Enter your address and get your exact lawn mowing price in under a minute. Serving Kendallville and Noble County, Indiana.',
    url: SITE_URL,
    siteName: 'Gray Wolf Workers',
    images: [{ url: `${SITE_URL}/lawn2.jpg` }],
    locale: 'en_US',
    type: 'website',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#business`,
  name: 'Gray Wolf Workers',
  description:
    'Professional lawn mowing, trimming, and yard cleanup serving Kendallville and Noble County, Indiana.',
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
  areaServed: [
    'Kendallville IN', 'Albion IN', 'Avilla IN', 'Rome City IN', 'Ligonier IN',
    'Wolcottville IN', 'Auburn IN', 'Garrett IN', 'Waterloo IN', 'LaGrange IN',
    'Howe IN', 'Columbia City IN', 'Churubusco IN', 'Angola IN',
  ].map(name => ({ '@type': 'Place', name })),
  priceRange: '$$',
  knowsAbout: ['Lawn mowing', 'Lawn care', 'Yard cleanup', 'Trimming and edging'],
}

export default function Root() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePage />
    </>
  )
}
