-- ─── Local SEO Engine ────────────────────────────────────────────────────────
-- Programmatic city/service landing pages (the fastest organic-rank lever for
-- a low-competition rural service area). Managed from /dashboard/marketing/seo;
-- rendered publicly at /lawn-care/[slug] with LocalBusiness + FAQ JSON-LD and
-- included in sitemap.xml.

create table if not exists public.seo_pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,        -- 'lawn-mowing-kendallville-in'
  service          text not null,               -- 'Lawn Mowing'
  city             text not null,               -- 'Kendallville'
  county           text,                        -- 'Noble County'
  state            text not null default 'IN',
  title            text not null,               -- <title> tag
  meta_description text not null,
  h1               text not null,
  intro            text not null,               -- paragraphs separated by blank lines
  body             text,                        -- paragraphs; lines starting '## ' become h2s
  faqs             jsonb not null default '[]', -- [{ "q": "...", "a": "..." }]
  published        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_seo_pages_published on public.seo_pages(published);

-- RLS: managed via service-role key in /api/seo/* and rendered server-side.
-- No public policies — the anon client never touches this table directly.
alter table public.seo_pages enable row level security;
