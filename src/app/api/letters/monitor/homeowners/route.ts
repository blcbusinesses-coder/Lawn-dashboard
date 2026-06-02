import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { queueRecipient } from '@/lib/letters/monitor'
import type { LetterType } from '@/lib/letters/templates'

const SOURCE_KEY = 'homeowners_zillow'

type Item = Record<string, unknown>

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v)
}

/** Pull a normalized address out of a Zillow search-result item (schema varies). */
function parseItem(item: Item): { zpid: string | null; street: string; city: string; state: string; zip: string; soldDate: string | null; status: string } {
  const addrObj = (item.address && typeof item.address === 'object' ? item.address : {}) as Item
  const street =
    str(item.streetAddress) || str(item.addressStreet) || str(addrObj.streetAddress) ||
    (typeof item.address === 'string' ? str(item.address).split(',')[0] : '')
  const city = str(item.addressCity) || str(item.city) || str(addrObj.city)
  const state = str(item.addressState) || str(item.state) || str(addrObj.state)
  const zip = (str(item.addressZipcode) || str(item.zipcode) || str(item.zip) || str(addrObj.zipcode)).slice(0, 5)
  const zpid = str(item.zpid) || str(item.id) || null
  const soldDate =
    str(item.dateSold) || str(item.soldDate) || str(item.lastSoldDate) || str(item.dateSoldString) || null
  const status = (str(item.homeStatus) || str(item.statusType) || '').toUpperCase()
  return { zpid: zpid || null, street, city, state, zip, soldDate: soldDate || null, status }
}

// POST /api/letters/monitor/homeowners — ingest recently-sold homes from Zillow.
export async function POST() {
  const admin = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: src } = await (admin.from('letter_monitor_sources') as any)
    .select('*')
    .eq('key', SOURCE_KEY)
    .single()
  if (!src) return NextResponse.json({ error: 'Source not configured. Run migration 0015.' }, { status: 500 })

  const config = (src.config ?? {}) as {
    actor?: string
    search_urls?: string[]
    lookback_days?: number
    target_zips?: string[]
    max_per_run?: number
  }
  const actor = (config.actor ?? 'maxcopell~zillow-scraper').replace('/', '~')
  const searchUrls = config.search_urls ?? []
  const lookbackDays = config.lookback_days ?? 45
  const targetZips = (config.target_zips ?? []).map(z => z.slice(0, 5))
  const maxPerRun = config.max_per_run ?? 25
  const letterType = (src.letter_type as LetterType) ?? 'new_homeowner'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: run } = await (admin.from('letter_monitor_runs') as any)
    .insert({ source_key: SOURCE_KEY })
    .select()
    .single()
  const runId = run?.id as string | undefined

  let found = 0, queued = 0, skipped = 0
  let errorMsg: string | null = null

  try {
    const apiKey = process.env.APIFY_API_KEY
    if (!apiKey) throw new Error('APIFY_API_KEY not set')
    if (searchUrls.length === 0) throw new Error('No Zillow search URLs configured for this source')

    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${apiKey}&timeout=120&memory=512`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchUrls: searchUrls.map(url => ({ url })) }),
        signal: AbortSignal.timeout(130_000),
      }
    )
    if (!res.ok) throw new Error(`Apify returned ${res.status}: ${(await res.text()).slice(0, 200)}`)

    const items = (await res.json()) as Item[]
    found = items?.length ?? 0
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000

    for (const item of items ?? []) {
      if (queued >= maxPerRun) break
      const p = parseItem(item)
      if (!p.street || !p.zip) { skipped++; continue }
      // If a status is present, require sold-ish; otherwise trust the search URL.
      if (p.status && !p.status.includes('SOLD')) { skipped++; continue }
      if (p.soldDate) {
        const t = Date.parse(p.soldDate)
        if (!Number.isNaN(t) && t < cutoff) { skipped++; continue }
      }
      if (targetZips.length > 0 && !targetZips.includes(p.zip)) { skipped++; continue }

      const result = await queueRecipient({
        source: 'new_homeowner',
        letterType,
        externalId: p.zpid,
        name: 'New Neighbor',
        address: p.street,
        city: p.city,
        state: p.state || 'IN',
        zip: p.zip,
      })
      if (result === 'queued') queued++
      else skipped++
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[letters/monitor/homeowners]', errorMsg)
  }

  const result = { found, queued, skipped, error: errorMsg }
  if (runId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('letter_monitor_runs') as any)
      .update({ finished_at: new Date().toISOString(), found, queued, skipped, error: errorMsg })
      .eq('id', runId)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('letter_monitor_sources') as any)
    .update({ last_run_at: new Date().toISOString(), last_result: result })
    .eq('key', SOURCE_KEY)

  return NextResponse.json(result)
}
