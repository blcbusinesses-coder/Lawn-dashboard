/**
 * Lead source auto-detection.
 *
 * A lead can arrive from many channels. We normalize whatever raw signals we
 * have (an explicit source set by the entry point, a UTM tag, the browser
 * referrer, or a Facebook lead id) into ONE canonical source string plus a
 * short human-readable detail explaining how we decided.
 *
 * Keep the canonical list in sync with the CHECK constraint in
 * supabase/migrations/0022_lead_notifications_and_source.sql.
 */

export type LeadSource =
  | 'facebook'
  | 'instagram'
  | 'nextdoor'
  | 'google'
  | 'website'
  | 'referral'
  | 'sms'
  | 'qr'
  | 'manual'
  | 'self_service'
  | 'self_schedule'
  | 'other'

export interface SourceMeta {
  label: string
  /** Tailwind classes for a badge (light + dark friendly) */
  badge: string
  /** Emoji shown in notifications */
  emoji: string
}

/** Display metadata for every source. Used by the UI and by notifications. */
export const SOURCE_META: Record<LeadSource, SourceMeta> = {
  facebook:      { label: 'Facebook Ads',   badge: 'bg-blue-50 text-blue-700 border-blue-200',       emoji: '📘' },
  instagram:     { label: 'Instagram',      badge: 'bg-pink-50 text-pink-700 border-pink-200',       emoji: '📷' },
  nextdoor:      { label: 'Nextdoor',       badge: 'bg-green-50 text-green-700 border-green-200',     emoji: '🏘️' },
  google:        { label: 'Google',         badge: 'bg-amber-50 text-amber-700 border-amber-200',     emoji: '🔍' },
  website:       { label: 'Website',        badge: 'bg-zinc-100 text-zinc-600 border-zinc-200',       emoji: '🌐' },
  referral:      { label: 'Referral',       badge: 'bg-purple-50 text-purple-700 border-purple-200',  emoji: '🤝' },
  sms:           { label: 'Text / SMS',     badge: 'bg-teal-50 text-teal-700 border-teal-200',        emoji: '💬' },
  qr:            { label: 'Mailer QR',      badge: 'bg-orange-50 text-orange-700 border-orange-200',  emoji: '📬' },
  manual:        { label: 'Manual Entry',   badge: 'bg-zinc-100 text-zinc-600 border-zinc-200',       emoji: '✍️' },
  self_service:  { label: 'Self-Service',   badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',  emoji: '🧮' },
  self_schedule: { label: 'Self-Scheduled', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',        emoji: '📅' },
  other:         { label: 'Other',          badge: 'bg-zinc-100 text-zinc-500 border-zinc-200',       emoji: '❓' },
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return SOURCE_META.website.label
  return (SOURCE_META as Record<string, SourceMeta>)[source]?.label ?? source
}

export function sourceMeta(source: string | null | undefined): SourceMeta {
  if (!source) return SOURCE_META.website
  return (SOURCE_META as Record<string, SourceMeta>)[source] ?? SOURCE_META.other
}

const ALL_SOURCES = new Set<string>(Object.keys(SOURCE_META))

/**
 * Map a free-form string (utm_source, referrer host, campaign name…) onto a
 * canonical LeadSource. Returns null when nothing matches.
 */
function matchToken(raw: string): LeadSource | null {
  const s = raw.toLowerCase()
  if (ALL_SOURCES.has(s)) return s as LeadSource
  if (s.includes('facebook') || s === 'fb' || s.includes('meta') || s.includes('lead_ads') || s.includes('leadgen')) return 'facebook'
  if (s.includes('instagram') || s === 'ig') return 'instagram'
  if (s.includes('nextdoor') || s === 'nd') return 'nextdoor'
  if (s.includes('google') || s.includes('gmb') || s.includes('gbp') || s.includes('adwords')) return 'google'
  if (s.includes('referr') || s.includes('word') || s.includes('friend')) return 'referral'
  return null
}

export interface DetectSourceInput {
  /** Explicit source the entry point already knows (highest priority). */
  explicit?: string | null
  /** utm_source query param captured on the public form. */
  utmSource?: string | null
  /** Full referrer URL captured on the public form. */
  referrer?: string | null
  /** Present ⇒ came through the Meta lead-ads webhook. */
  facebookLeadId?: string | null
}

export interface DetectedSource {
  source: LeadSource
  detail: string | null
}

/**
 * Decide a lead's source from whatever signals we have.
 * Priority: Meta webhook > explicit (non-generic) > utm_source > referrer host.
 */
export function detectSource(input: DetectSourceInput): DetectedSource {
  const { explicit, utmSource, referrer, facebookLeadId } = input

  if (facebookLeadId) {
    return { source: 'facebook', detail: 'Meta lead form' }
  }

  // Explicit wins — unless it's the generic "website" default, in which case we
  // still try to sharpen it with utm/referrer below.
  if (explicit) {
    const m = matchToken(explicit)
    if (m && m !== 'website') return { source: m, detail: `set: ${explicit}` }
    if (ALL_SOURCES.has(explicit.toLowerCase()) && explicit.toLowerCase() !== 'website') {
      return { source: explicit.toLowerCase() as LeadSource, detail: `set: ${explicit}` }
    }
  }

  if (utmSource) {
    const m = matchToken(utmSource)
    if (m) return { source: m, detail: `utm_source=${utmSource}` }
  }

  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '')
      const m = matchToken(host)
      if (m) return { source: m, detail: `referrer: ${host}` }
      if (host) return { source: 'website', detail: `referrer: ${host}` }
    } catch {
      const m = matchToken(referrer)
      if (m) return { source: m, detail: `referrer: ${referrer}` }
    }
  }

  // Fall back to explicit-as-website, then plain website.
  if (explicit && ALL_SOURCES.has(explicit.toLowerCase())) {
    return { source: explicit.toLowerCase() as LeadSource, detail: null }
  }
  return { source: 'website', detail: null }
}
