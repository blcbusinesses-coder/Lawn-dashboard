// ─── Shared outreach-letter HTML template ────────────────────────────────────
// Used by /api/letters/send and /api/letters/preview.
//
// This is a PERSONAL letter from the founder — first person, warm, no coupon
// boxes. The pre-calculated quote is woven into the body (inline + bold) via a
// [[QUOTE]] token the AI leaves in place; the only design element at the bottom
// is a QR code (scan to self-schedule, quote pre-loaded) with plain offer text.
//
// Lob letters are 8.5in × 11in. With `address_placement: 'top_first_page'`, Lob
// prints the recipient + return address in the top ~2.9in of page 1, so that
// area MUST stay clear (.addr-space). No external images or web fonts — Lob's
// renderer is unreliable fetching those; data-URI images are fine.

import { escapeHtml, formatQuote } from '@/lib/postcards/templates'

export { escapeHtml, formatQuote }

export type LetterType = 'general' | 'new_homeowner' | 'violation'

/** Token the AI leaves in the body where the price belongs; replaced at render
 *  time with the bolded quote so the number is always correct and emphasized. */
export const QUOTE_TOKEN = '[[QUOTE]]'

export interface LetterParams {
  name: string
  /** AI-written body (first person). May contain the [[QUOTE]] token. */
  aiCopy: string
  /** Pre-formatted quote string, e.g. "$45/mow". */
  quote: string
  phone: string
  letterType?: LetterType
  /** Defaults to today, long format. */
  date?: string
  /** Founder's name for the signature. Falls back to a team signature. */
  founderName?: string | null
  /** Offer line shown by the QR. Defaults to "25% off your first month". */
  offerHeadline?: string
  /** Offer deadline, e.g. "June 30". Defaults to end of this month (or next
   *  month when fewer than 14 days remain, so the deadline is never absurd). */
  offerDeadline?: string
  /** Data-URI QR code linking to the scheduling page (quote pre-loaded). */
  qrDataUri?: string | null
}

/** Default new-customer offer label. */
export const DEFAULT_OFFER_HEADLINE = '25% off your first month'

/** "June 30"-style deadline: end of this month, or end of next month when
 * fewer than 14 days remain (a 2-day deadline reads as fake urgency). */
export function defaultOfferDeadline(now = new Date()): string {
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeft = Math.ceil((endOfMonth.getTime() - now.getTime()) / 86_400_000)
  const target = daysLeft < 14 ? new Date(now.getFullYear(), now.getMonth() + 2, 0) : endOfMonth
  return target.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export function buildLetterHtml(p: LetterParams): string {
  const today =
    p.date ??
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const offerHeadline = p.offerHeadline ?? DEFAULT_OFFER_HEADLINE
  const offerDeadline = p.offerDeadline ?? defaultOfferDeadline()
  const quoteBold = `<strong>${escapeHtml(p.quote)}</strong>`

  // Render body paragraphs, swapping the [[QUOTE]] token for the bold price.
  // (escapeHtml leaves the token untouched — it has no HTML-special chars.)
  const rawParas = (p.aiCopy || '')
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  let bodyHtml: string
  let quoteShown = false
  if (rawParas.length) {
    bodyHtml = rawParas
      .map((par) => {
        const esc = escapeHtml(par)
        if (esc.includes(QUOTE_TOKEN)) quoteShown = true
        return `<p style="margin:0 0 13px;">${esc.split(QUOTE_TOKEN).join(quoteBold)}</p>`
      })
      .join('\n')
  } else {
    bodyHtml = `<p style="margin:0 0 13px;">I started Gray Wolf Workers right here in Kendallville because I love taking care of lawns and looking out for my neighbors. I had a look at your property and figured your lawn would run about ${quoteBold} a mow — I'd be glad to keep it sharp for you this season.</p>`
    quoteShown = true
  }

  // Safety net for older copy with no token: state the price before the close.
  const quoteFallback = quoteShown
    ? ''
    : `<p style="margin:0 0 13px;">Based on your lawn, I'd put your price at about ${quoteBold} a mow.</p>`

  const signature = p.founderName?.trim()
    ? `<p style="margin:0 0 2px;">Warmly,</p>
       <p style="margin:0;font-weight:700;font-size:16px;color:#0d2e1a;">${escapeHtml(p.founderName.trim())}</p>
       <p style="margin:3px 0 0;font-size:11.5px;color:#5a5a5a;">Founder, Gray Wolf Workers &bull; Kendallville, IN</p>`
    : `<p style="margin:0 0 2px;">Warmly,</p>
       <p style="margin:0;font-weight:700;font-size:15px;color:#0d2e1a;">The Gray Wolf Workers Team</p>
       <p style="margin:3px 0 0;font-size:11.5px;color:#5a5a5a;">Kendallville, IN</p>`

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
  .wordmark { font-family: Arial, Helvetica, sans-serif; font-size: 21px; font-weight: 800; letter-spacing: 2px; color: #0d2e1a; line-height: 1; }
  .sub { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #5a5a5a; letter-spacing: 1px; }
  .body { font-size: 13px; line-height: 1.62; }
</style>
</head>
<body>
  <div class="page">

    <!-- Address window safe zone (Lob prints to/from here) -->
    <div class="addr-space"></div>

    <!-- Letterhead -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #0d2e1a;padding-bottom:9px;margin-bottom:22px;">
      <div>
        <div class="wordmark">GRAY WOLF WORKERS</div>
        <div class="sub">Lawn Care &bull; Kendallville, Indiana</div>
      </div>
      <div style="text-align:right;" class="sub">
        <div style="font-weight:700;color:#0d2e1a;font-size:12px;">${escapeHtml(p.phone)}</div>
        <div>graywolfworkers.com</div>
      </div>
    </div>

    <!-- Date + greeting -->
    <div style="font-size:11.5px;color:#7a7a7a;margin-bottom:16px;">${escapeHtml(today)}</div>
    <div class="body" style="margin-bottom:14px;">Dear ${escapeHtml(p.name)},</div>

    <!-- Body (first person, inline bold quote) -->
    <div class="body">
      ${bodyHtml}
      ${quoteFallback}
    </div>

    <!-- Signature -->
    <div class="body" style="margin-top:18px;">
      ${signature}
    </div>

    <!-- QR + offer (no box) -->
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #dcdcd2;display:flex;align-items:center;gap:26px;">
      ${p.qrDataUri
        ? `<img src="${p.qrDataUri}" alt="Scan to schedule your first mow" width="84" height="84" style="display:block;width:84px;height:84px;flex-shrink:0;" />`
        : ''}
      <div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;color:#0d2e1a;line-height:1.3;">Scan to schedule &mdash; ${escapeHtml(offerHeadline)}</div>
        <div style="font-size:11.5px;color:#5a5a5a;margin-top:7px;line-height:1.65;">
          Your price is already loaded in &mdash; just pick a day that works.<br>
          Prefer to talk? Call or text me at <strong style="color:#0d2e1a;">${escapeHtml(p.phone)}</strong>. Offer good through ${escapeHtml(offerDeadline)}.
        </div>
      </div>
    </div>

  </div>
</body>
</html>`
}
