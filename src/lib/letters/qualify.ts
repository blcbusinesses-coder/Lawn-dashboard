// ─── Area Blast targeting: hard gates + lead scoring + segment ───────────────
// Pure logic over the RentCast records we already fetch — NO extra API calls.
// Implements the targeting spec using the fields RentCast returns today
// (lot size, owner-occupied, owner mailing address → absentee, last sale date,
// assessed value). Signals that need external sources we haven't wired
// (owner age, Street View lawn condition, Census block-group income) are left
// as null/0 extension points; scoring degrades gracefully without them and can
// be raised later by filling them in.

import { normalizeAddress } from '@/lib/letters/monitor'
import type { IncomeBand } from '@/lib/letters/census'

export type Segment = 'aging_homeowner' | 'time_poor_family' | 'absentee_new_owner' | 'general'
export type MailPriority = 'first' | 'second' | 'skip'

/** What qualify needs per property (all from the existing RentCast record). */
export interface QualInput {
  lotSqft: number | null
  zip: string
  quote: number
  ownerOccupied: boolean | null
  /** owner's mailing street line, if RentCast returns it (absentee detection) */
  ownerMailingLine: string | null
  /** the property's own street line (situs) */
  propertyLine: string | null
  /** assessed value or last sale price, for the ZIP value-band gate */
  homeValue: number | null
  /** ISO date of last sale, for the new-mover signal */
  lastSaleDate: string | null
  /** coordinates — carried for later Census income enrichment (S6) */
  lat?: number | null
  lng?: number | null
}

/** The scoring/segment output merged onto a candidate. */
export interface QualResult {
  lead_score: number
  segment: Segment
  mail_priority: MailPriority
  is_absentee: boolean
  last_sold: string | null
  home_value: number | null
  lot_acres: number | null
  /** neighborhood income vs county median (S6 — filled in by enrichment) */
  block_group_income_vs_county: IncomeBand
  /** per-factor breakdown, for tuning + display */
  factors: Record<string, number>
  /** gate failures (empty = passed all gates) */
  gate_fails: string[]
}

const FIRST_WAVE_MIN = 8
const SECOND_WAVE_MIN = 4

/** Points granted for an above-median income block group (S6). */
export const INCOME_ABOVE_POINTS = 2

/** Map a final lead score to a mail-priority wave. */
export function priorityForScore(score: number): MailPriority {
  return score >= FIRST_WAVE_MIN ? 'first' : score >= SECOND_WAVE_MIN ? 'second' : 'skip'
}

// Gate G3 / auto-exclude: lot size window (acres).
const LOT_MIN_ACRES = 0.15
const LOT_MAX_ACRES = 1.5

function acres(lotSqft: number | null): number | null {
  return lotSqft && lotSqft > 0 ? lotSqft / 43560 : null
}

function withinMonths(iso: string | null, months: number): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return Date.now() - t <= months * 30.4 * 86_400_000
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

export interface QualifyOutput<T> {
  mailable: Array<T & QualResult>
  dropped: Array<T & QualResult>
  /** how many were dropped by each gate (a record can fail more than one) */
  gate_breakdown: Record<string, number>
}

/**
 * Gate + score a batch. Returns gate-passers (sorted best-first), the dropped
 * records (with their gate reasons), and a per-gate drop breakdown so the UI
 * can show exactly why things were filtered. Value-band gate (G5) is computed
 * per-ZIP across the batch — deliberately gentle (10th–95th percentile) so it
 * only trims the very cheapest and estate-tier, not half the list.
 */
export function qualifyBatch<T extends { qual: QualInput }>(
  items: T[],
): QualifyOutput<T> {
  // ── Value-band thresholds per ZIP (G5) ─────────────────────────────────────
  const valuesByZip = new Map<string, number[]>()
  for (const it of items) {
    const v = it.qual.homeValue
    if (v && v > 0) {
      const arr = valuesByZip.get(it.qual.zip) ?? []
      arr.push(v)
      valuesByZip.set(it.qual.zip, arr)
    }
  }
  const bandByZip = new Map<string, { lo: number; hi: number }>()
  for (const [zip, arr] of valuesByZip) {
    if (arr.length < 12) continue // too few to trust percentiles — skip the gate
    const sorted = [...arr].sort((a, b) => a - b)
    bandByZip.set(zip, { lo: percentile(sorted, 10), hi: percentile(sorted, 95) })
  }

  const out: Array<T & QualResult> = []

  for (const it of items) {
    const q = it.qual
    const lot = acres(q.lotSqft)
    const gateFails: string[] = []

    // G3 / auto-exclude — lot size window.
    if (lot != null && (lot < LOT_MIN_ACRES || lot > LOT_MAX_ACRES)) {
      gateFails.push('lot_size')
    }

    // G5 — value band (only when we have a value and a trustworthy ZIP band).
    const band = bandByZip.get(q.zip)
    if (band && q.homeValue && q.homeValue > 0) {
      if (q.homeValue < band.lo || q.homeValue > band.hi) gateFails.push('value_band')
    }

    if (gateFails.length > 0) {
      // Dropped — still surface it so the UI can report gate counts.
      out.push({ ...it, lead_score: 0, segment: 'general', mail_priority: 'skip',
        is_absentee: false, last_sold: q.lastSaleDate, home_value: q.homeValue,
        lot_acres: lot, block_group_income_vs_county: 'unknown', factors: {}, gate_fails: gateFails })
      continue
    }

    // ── Absentee + new-mover signals ─────────────────────────────────────────
    const isAbsentee =
      !!q.ownerMailingLine && !!q.propertyLine &&
      normalizeAddress(q.ownerMailingLine) !== normalizeAddress(q.propertyLine)
    const newMover = withinMonths(q.lastSaleDate, 12)

    // ── Score (only the factors we can source today; others are future +0) ────
    const factors: Record<string, number> = {}
    if (lot != null && lot >= 0.2 && lot <= 0.6) factors.lot_mid = 3      // S1
    if (q.ownerOccupied === true) factors.owner_occupied = 2             // S2
    if (isAbsentee) factors.absentee = 3                                 // S4
    if (newMover) factors.new_mover = 3                                  // S5
    // S3 age, S3b tenure, S6 income, S7/S8 Street View — future enrichments.

    const lead_score = Object.values(factors).reduce((a, b) => a + b, 0)

    // ── Segment (drives letter copy downstream) ──────────────────────────────
    let segment: Segment = 'general'
    if (isAbsentee || newMover) segment = 'absentee_new_owner'
    // aging_homeowner / time_poor_family require age + Street View cues (future).

    const mail_priority = priorityForScore(lead_score)

    out.push({ ...it, lead_score, segment, mail_priority, is_absentee: isAbsentee,
      last_sold: q.lastSaleDate, home_value: q.homeValue, lot_acres: lot,
      block_group_income_vs_county: 'unknown', factors, gate_fails: [] })
  }

  const mailable = out
    .filter(r => r.gate_fails.length === 0)
    .sort((a, b) => b.lead_score - a.lead_score)
  const dropped = out.filter(r => r.gate_fails.length > 0)

  const gate_breakdown: Record<string, number> = {}
  for (const r of dropped) {
    for (const reason of r.gate_fails) gate_breakdown[reason] = (gate_breakdown[reason] ?? 0) + 1
  }

  return { mailable, dropped, gate_breakdown }
}
