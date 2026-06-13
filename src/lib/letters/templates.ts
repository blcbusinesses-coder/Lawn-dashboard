// ─── Shared outreach-letter HTML template ────────────────────────────────────
// Used by /api/letters/send and /api/letters/preview.
//
// Lob letters are 8.5in × 11in. With the default `address_placement:
// 'top_first_page'`, Lob prints the recipient + return address in the top area
// of page 1 (visible through a #10 double-window envelope), so the top ~2.9in
// of the first page MUST be left clear. We reserve it with `.addr-space`.
//
// No external images or web fonts — Lob's headless-Chrome renderer is
// unreliable about fetching those, and a text letter doesn't need them. We use
// system serif/sans only so the letter always renders.

import { escapeHtml, formatQuote } from '@/lib/postcards/templates'

export { escapeHtml, formatQuote }

export type LetterType = 'general' | 'new_homeowner' | 'violation'

export interface LetterParams {
  name: string
  /** AI-written body. Paragraphs separated by blank lines or single newlines. */
  aiCopy: string
  /** Pre-formatted quote string, e.g. "$45/mow". */
  quote: string
  phone: string
  letterType?: LetterType
  /** Defaults to today, long format. */
  date?: string
  /** New-customer offer headline. Defaults to the free-first-mow offer. */
  offerHeadline?: string
  /** Fine print explaining the offer terms. */
  offerDetail?: string
  /** Offer deadline, e.g. "June 30". Defaults to end of this month (or next
   *  month when fewer than 14 days remain, so the deadline is never absurd). */
  offerDeadline?: string
  /** Data-URI QR code for the action bar (links to the instant-quote page). */
  qrDataUri?: string | null
}

/** Default new-customer offer: the first mow is genuinely free — no
 * commitment. One mow on us so they can see the quality before deciding. */
export const DEFAULT_OFFER_HEADLINE = 'Your first mow is free — no commitment'
export const DEFAULT_OFFER_DETAIL =
  'We mow your lawn once, on us, so you can see the quality before you decide anything. New customers only. No strings.'

/** "June 30"-style deadline: end of this month, or end of next month when
 * fewer than 14 days remain (a 2-day deadline reads as fake urgency). */
export function defaultOfferDeadline(now = new Date()): string {
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeft = Math.ceil((endOfMonth.getTime() - now.getTime()) / 86_400_000)
  const target = daysLeft < 14 ? new Date(now.getFullYear(), now.getMonth() + 2, 0) : endOfMonth
  return target.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

const TAGLINE: Record<LetterType, string> = {
  general: 'A note about your lawn',
  new_homeowner: 'Welcome to the neighborhood',
  violation: 'Let us help your lawn shine',
}

export function buildLetterHtml(p: LetterParams): string {
  const today =
    p.date ??
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const letterType: LetterType = p.letterType ?? 'general'
  const offerHeadline = p.offerHeadline ?? DEFAULT_OFFER_HEADLINE
  const offerDetail   = p.offerDetail   ?? DEFAULT_OFFER_DETAIL
  const offerDeadline = p.offerDeadline ?? defaultOfferDeadline()

  const paragraphs = (p.aiCopy || '')
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const bodyHtml = paragraphs.length
    ? paragraphs.map((par) => `<p style="margin:0 0 13px;">${escapeHtml(par)}</p>`).join('\n')
    : `<p style="margin:0 0 13px;">We provide professional lawn care across Kendallville and the surrounding area, and we would love to take care of your lawn this season. A personalized estimate is included below.</p>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 8.5in 11in; margin: 0; }
  *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 8.5in; font-family: Georgia, 'Times New Roman', serif; color: #1b1b1b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 8.5in; min-height: 11in; padding: 0 1in 0.9in; position: relative; }
  .addr-space { height: 2.9in; }            /* reserved for Lob's address window */
  .wordmark { font-family: Arial, Helvetica, sans-serif; font-size: 23px; font-weight: 800; letter-spacing: 2px; color: #0d2e1a; line-height: 1; }
  .sub { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #5a5a5a; letter-spacing: 1px; }
  .body { font-size: 13px; line-height: 1.62; }
</style>
</head>
<body>
  <div class="page">

    <!-- Address window safe zone (Lob prints to/from here) -->
    <div class="addr-space"></div>

    <!-- Letterhead -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0d2e1a;padding-bottom:10px;margin-bottom:20px;">
      <div>
        <div class="wordmark">GRAY WOLF WORKERS</div>
        <div class="sub">Professional Lawn Care &bull; Kendallville, IN</div>
      </div>
      <div style="text-align:right;" class="sub">
        <div style="font-weight:700;color:#0d2e1a;font-size:12px;">${escapeHtml(p.phone)}</div>
        <div>graywolfworkers.com</div>
      </div>
    </div>

    <!-- Date + greeting -->
    <div style="font-size:11.5px;color:#6a6a6a;margin-bottom:18px;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(TAGLINE[letterType])} &nbsp;&bull;&nbsp; ${escapeHtml(today)}</div>
    <div class="body" style="margin-bottom:14px;">Dear ${escapeHtml(p.name)},</div>

    <!-- Body -->
    <div class="body">
      ${bodyHtml}
    </div>

    <!-- Estimate + offer + action: one three-tier box -->
    <div style="margin:16px 0;border:1px solid #d5dfd2;">

      <!-- Tier 1: price, the hero -->
      <div style="padding:12px 16px 11px;background:#f3f8f4;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:#41663f;margin-bottom:3px;">Your Custom Estimate</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:27px;font-weight:800;color:#0d2e1a;line-height:1;">${escapeHtml(p.quote)}</div>
        <div style="font-size:9.5px;color:#6a6a6a;margin-top:4px;">No contract &bull; Cancel anytime &bull; Locally owned &amp; fully insured</div>
      </div>

      <!-- Tier 2: offer, quiet cream -->
      <div style="padding:9px 16px;background:#faf6ea;border-top:1px solid #e8e0c8;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:#96761f;margin-bottom:2px;">Welcome offer</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;font-weight:700;color:#0d2e1a;line-height:1.2;">${escapeHtml(offerHeadline)}</div>
        <div style="font-size:9.5px;line-height:1.45;color:#5f5a48;margin-top:2px;">${escapeHtml(offerDetail)}</div>
      </div>

      <!-- Tier 3: action bar -->
      <div style="padding:10px 16px;background:#0d2e1a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13.5px;font-weight:800;line-height:1.2;">Text your address to ${escapeHtml(p.phone)}</div>
          <div style="font-size:9.5px;color:#c8d6c4;margin-top:3px;">or call &bull; Offer good through ${escapeHtml(offerDeadline)}</div>
        </div>
        ${p.qrDataUri
          ? `<img src="${p.qrDataUri}" alt="Scan for an instant quote" width="52" height="52" style="display:block;width:52px;height:52px;background:#ffffff;padding:3px;flex-shrink:0;" />`
          : ''}
      </div>

    </div>

    <!-- Close -->
    <div class="body">
      <p style="margin:0 0 14px;">Give us a call or text at <strong>${escapeHtml(p.phone)}</strong> and we'll get you on the schedule. We look forward to keeping your lawn looking its best.</p>
      <p style="margin:0;">Warm regards,</p>
      <p style="margin:3px 0 0;font-weight:700;">The Gray Wolf Workers Team</p>
    </div>

  </div>
</body>
</html>`
}
