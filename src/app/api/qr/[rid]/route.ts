/**
 * GET /api/qr/[rid]  — the URL every letter QR code points to.
 *
 * Logs the scan SERVER-SIDE the instant the link is opened (no JavaScript, no
 * page render required — bulletproof), then 307-redirects to the booking page
 * pre-loaded with the homeowner's saved quote. When we have a real recipient id
 * we pull their details from the DB (authoritative + keeps the QR short);
 * otherwise we pass through any query params (used for previews).
 */

import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params
  const qp = new URL(request.url).searchParams
  const recipientId = UUID_RE.test(rid) ? rid : null

  const svc = createServiceClient()

  // Start from any passed-through params (preview / fallback).
  let name = qp.get('name') ?? ''
  let street = qp.get('street') ?? ''
  let city = qp.get('city') ?? ''
  let zip = qp.get('zip') ?? ''
  let quote = qp.get('quote') ?? ''

  // Authoritative data from the recipient record when we have a real id.
  if (recipientId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (svc.from('letter_recipients') as any)
        .select('name, address, city, zip, quote_amount')
        .eq('id', recipientId)
        .single()
      if (data) {
        name = data.name ?? name
        street = data.address ?? street
        city = data.city ?? city
        zip = data.zip ?? zip
        quote = data.quote_amount != null ? String(Math.round(data.quote_amount)) : quote
      }
    } catch { /* fall back to query params */ }
  }

  // Log the scan — best-effort, must never block the redirect.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('letter_qr_scans') as any).insert({ recipient_id: recipientId })
  } catch { /* ignore */ }

  // Redirect to the booking page with the property pre-loaded. Build it on the
  // SAME origin the QR was opened from, so it works on any domain.
  const dest = new URL('/schedule', request.nextUrl.origin)
  dest.searchParams.set('qr', '1')
  if (recipientId) dest.searchParams.set('rid', recipientId)
  if (quote)  dest.searchParams.set('quote', quote)
  if (name)   dest.searchParams.set('name', name)
  if (street) dest.searchParams.set('street', street)
  if (city)   dest.searchParams.set('city', city)
  if (zip)    dest.searchParams.set('zip', zip)

  return NextResponse.redirect(dest, 307)
}
