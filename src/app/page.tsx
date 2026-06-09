import type { Metadata } from 'next'
import HomePage from '@/components/site/HomePage'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://graywolfworkers.com'

// The homepage renders at the root URL (no redirect — Google should index `/`
// directly). /home still works as an alias and canonicalizes here.
export const metadata: Metadata = {
  title: 'Lawn Mowing & Lawn Care in Kendallville, IN | Gray Wolf Workers',
  description:
    'Professional lawn mowing, trimming, and yard cleanup in Kendallville and across Noble County, Indiana. Locally owned, fully insured, free quotes by text. New customers get 75% off their first month.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Lawn Mowing & Lawn Care in Kendallville, IN | Gray Wolf Workers',
    description:
      'Professional lawn mowing, trimming, and yard cleanup in Kendallville and across Noble County, Indiana.',
    url: SITE_URL,
    siteName: 'Gray Wolf Workers',
    images: [{ url: `${SITE_URL}/lawn2.jpg` }],
    locale: 'en_US',
    type: 'website',
  },
}

export default function Root() {
  return <HomePage />
}
