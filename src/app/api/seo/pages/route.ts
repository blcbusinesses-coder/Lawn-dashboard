/**
 * /api/seo/pages — manage local-SEO landing pages.
 *   GET    — list all pages
 *   POST   — { city, county, service } → AI-writes a unique page, saved as draft
 *   PATCH  — { id, published } → publish/unpublish
 *   DELETE — { id } → remove
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic/client'

export const maxDuration = 60

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface GeneratedPage {
  title: string
  meta_description: string
  h1: string
  intro: string
  body: string
  faqs: Array<{ q: string; a: string }>
}

const WRITER_SYSTEM = `You write local-SEO landing pages for Gray Wolf Workers, a small, locally-owned lawn care company based in Kendallville, Indiana (Noble County). They mow, trim, edge, and do yard cleanups across Northeast Indiana. No contracts; quotes by text; fully insured; new customers get their first mow completely free (no commitment — one mow on us so they can see the quality).

Write a landing page for the given SERVICE in the given CITY. Return ONLY valid JSON (no markdown fences) with exactly these keys:
{
  "title": "<title tag, max 60 chars, format: '<Service> in <City>, IN | Gray Wolf Workers'>",
  "meta_description": "<150-158 chars, compelling, mentions city and the free-first-mow offer>",
  "h1": "<page headline mentioning service + city, natural not keyword-stuffed>",
  "intro": "<2 paragraphs separated by a blank line. Warm, local, specific to the city/county — mention nearby landmarks, the county, or what lawns are like in the area when natural. Why homeowners there choose a local crew.>",
  "body": "<3 sections, each starting with a line '## <heading>' followed by a blank line then 1-2 paragraphs. Cover: what's included in the service; how pricing/quotes work (text your address, price before we start, no contracts); why local matters in this specific town. Separate everything with blank lines.>",
  "faqs": [<exactly 4 objects {"q": "...", "a": "..."} — real questions a homeowner in that city would ask: price ballparks (do NOT give exact dollar amounts), scheduling, service area, the first-month offer>]
}

Rules: plain text only inside strings (no markdown except the '## ' headings in body). Never invent reviews, customer names, or statistics. Never state exact prices. Mention the city naturally 4-6 times across the page, not robotically. Keep total body+intro around 450-600 words.`

export async function GET() {
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('seo_pages') as any)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pages: data ?? [] })
}

export async function POST(request: NextRequest) {
  const { city, county, service } = await request.json() as { city?: string; county?: string; service?: string }
  if (!city?.trim() || !service?.trim()) {
    return NextResponse.json({ error: 'city and service are required' }, { status: 400 })
  }

  const admin = createServiceClient()
  const slug = `${slugify(service)}-${slugify(city)}-in`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.from('seo_pages') as any)
    .select('id').eq('slug', slug).limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: `A page for ${service} in ${city} already exists` }, { status: 409 })
  }

  let generated: GeneratedPage
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2500,
      system: WRITER_SYSTEM,
      messages: [{
        role: 'user',
        content: `SERVICE: ${service.trim()}\nCITY: ${city.trim()}, Indiana${county?.trim() ? ` (${county.trim()})` : ''}\nWrite the page JSON now.`,
      }],
    })
    const block = msg.content[0]
    if (block.type !== 'text') throw new Error('No text response')
    // Tolerate accidental fences.
    const raw = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    generated = JSON.parse(raw) as GeneratedPage
    if (!generated.title || !generated.h1 || !generated.intro) throw new Error('Incomplete page JSON')
  } catch (err) {
    console.error('[seo/pages] generation failed:', err)
    return NextResponse.json({ error: 'AI page generation failed — try again' }, { status: 502 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('seo_pages') as any)
    .insert({
      slug,
      service: service.trim(),
      city: city.trim(),
      county: county?.trim() || null,
      state: 'IN',
      title: generated.title,
      meta_description: generated.meta_description,
      h1: generated.h1,
      intro: generated.intro,
      body: generated.body ?? null,
      faqs: Array.isArray(generated.faqs) ? generated.faqs.slice(0, 6) : [],
      published: false,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ page: data })
}

export async function PATCH(request: NextRequest) {
  const { id, published } = await request.json() as { id?: string; published?: boolean }
  if (!id || typeof published !== 'boolean') {
    return NextResponse.json({ error: 'id and published are required' }, { status: 400 })
  }
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('seo_pages') as any)
    .update({ published, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ page: data })
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json() as { id?: string }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from('seo_pages') as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
