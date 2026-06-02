import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { mercatorToLatLng, reverseGeocode, queueRecipient } from '@/lib/letters/monitor'
import type { LetterType } from '@/lib/letters/templates'

export const maxDuration = 60

const SOURCE_KEY = 'violations_311'

interface Feature {
  type?: string
  geometry?: { type?: string; coordinates?: number[] }
  properties?: { name?: string; evo_id?: string; coordinates?: number[] } & Record<string, unknown>
}

/** Recursively collect any GeoJSON Features from an arbitrarily-nested response. */
function collectFeatures(node: unknown, out: Feature[] = []): Feature[] {
  if (!node) return out
  if (Array.isArray(node)) {
    for (const n of node) collectFeatures(n, out)
    return out
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>
    if (obj.type === 'Feature' && obj.properties) {
      out.push(obj as Feature)
      return out
    }
    for (const v of Object.values(obj)) collectFeatures(v, out)
  }
  return out
}

// POST /api/letters/monitor/violations — ingest new Tall Grass / Weeds requests.
export async function POST() {
  const admin = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: src } = await (admin.from('letter_monitor_sources') as any)
    .select('*')
    .eq('key', SOURCE_KEY)
    .single()

  if (!src) return NextResponse.json({ error: 'Source not configured. Run migration 0015.' }, { status: 500 })

  const config = (src.config ?? {}) as {
    feed_url?: string
    service_name?: string
    target_zips?: string[]
    max_per_run?: number
  }
  const feedUrl = config.feed_url ?? 'https://www.kendallvillein.gov/311/map/'
  const serviceName = (config.service_name ?? 'Tall Grass / Weeds').toLowerCase()
  const targetZips = (config.target_zips ?? []).map(z => z.slice(0, 5))
  // Pull the entire list by default. Address-only ingest is fast (reverse
  // geocode only), so there is no per-address Apify/AI cost here — quote + copy
  // are generated later, per-row, from the review queue.
  const maxPerRun = config.max_per_run ?? Number.POSITIVE_INFINITY
  const letterType = (src.letter_type as LetterType) ?? 'violation'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: run } = await (admin.from('letter_monitor_runs') as any)
    .insert({ source_key: SOURCE_KEY })
    .select()
    .single()
  const runId = run?.id as string | undefined

  let found = 0
  let queued = 0
  let skipped = 0
  let errorMsg: string | null = null
  // Why things got skipped — surfaced in the response for diagnosis.
  const reasons: Record<string, number> = {}
  const samples: Array<Record<string, unknown>> = []
  const bump = (r: string) => { reasons[r] = (reasons[r] ?? 0) + 1; skipped++ }

  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`Feed returned ${res.status}`)
    const json = await res.json()

    const features = collectFeatures(json).filter(
      f => (f.properties?.name ?? '').toLowerCase() === serviceName
    )
    found = features.length

    for (const f of features) {
      if (queued >= maxPerRun) break
      const coords = f.geometry?.coordinates ?? f.properties?.coordinates
      const evoId = f.properties?.evo_id ? String(f.properties.evo_id) : null
      if (!coords || coords.length < 2) { bump('no_coords'); continue }

      const { lat, lng } = mercatorToLatLng(coords[0], coords[1])
      const parsed = await reverseGeocode(lat, lng)
      if (samples.length < 10) {
        samples.push({ evo_id: evoId, lat: +lat.toFixed(6), lng: +lng.toFixed(6), geocoded: parsed
          ? `${parsed.address}, ${parsed.city}, ${parsed.state} ${parsed.zip}` : null })
      }
      // Nominatim asks for <=1 req/sec; be polite between lookups.
      await new Promise(r => setTimeout(r, 1100))

      if (!parsed) { bump('geocode_failed'); continue }
      if (targetZips.length > 0 && !targetZips.includes(parsed.zip.slice(0, 5))) { bump(`out_of_zip:${parsed.zip}`); continue }

      const result = await queueRecipient({
        source: 'violation',
        letterType,
        externalId: evoId,
        name: 'Current Resident',
        address: parsed.address,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        skipContent: true,
      })
      if (result === 'queued') queued++
      else if (result === 'duplicate') bump('duplicate')
      else bump('insert_error')
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[letters/monitor/violations]', errorMsg)
  }

  const result = { found, queued, skipped, error: errorMsg, reasons, samples }
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
