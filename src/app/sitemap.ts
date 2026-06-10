import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

// Re-generate on every request so pages published from the dashboard show up
// without waiting for a redeploy.
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://graywolfworkers.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/get-a-quote`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/portfolio`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
  ]

  try {
    const admin = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin.from('seo_pages') as any)
      .select('slug, updated_at')
      .eq('published', true)
    for (const row of (data ?? []) as Array<{ slug: string; updated_at: string }>) {
      entries.push({
        url: `${SITE_URL}/lawn-care/${row.slug}`,
        lastModified: new Date(row.updated_at),
        changeFrequency: 'monthly',
        priority: 0.8,
      })
    }
  } catch {
    // Table not migrated yet — base entries still ship.
  }

  return entries
}
