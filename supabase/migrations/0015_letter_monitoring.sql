-- ─── Letter List Monitoring ──────────────────────────────────────────────────
-- Adds support for monitored address sources (grass-violation 311 feed and
-- new-homeowner Zillow recently-sold) feeding a human review queue.
--
-- Flow: a monitor route ingests new addresses → generates quote + AI copy →
-- inserts a letter_recipients row with status 'review'. Nothing mails until a
-- human approves it in the Letter Lists UI, which sends via Lob and flips the
-- row to 'sent'.

-- 1. Columns on letter_recipients to support dedup + the review pipeline.
alter table public.letter_recipients
  add column if not exists external_id text,   -- source-native id (311 evo_id, Zillow zpid)
  add column if not exists dedup_key   text;   -- normalized address, never mail twice

-- status now also uses: 'review' (queued for approval) and 'skipped' (rejected),
-- in addition to existing 'pending' | 'sent' | 'failed'.

-- Never queue the same source+address twice. Partial unique so manual rows
-- (no external_id) are unaffected.
create unique index if not exists uq_letter_recipients_source_extid
  on public.letter_recipients(source, external_id)
  where external_id is not null;

create unique index if not exists uq_letter_recipients_source_dedup
  on public.letter_recipients(source, dedup_key)
  where dedup_key is not null;

create index if not exists idx_letter_recipients_status
  on public.letter_recipients(status);

-- 2. Monitored source configuration + run state. Seeded with the two sources.
create table if not exists public.letter_monitor_sources (
  key          text primary key,                 -- 'violations_311' | 'homeowners_zillow'
  label        text not null,
  letter_type  text not null default 'general',  -- maps to LetterType
  enabled      boolean not null default false,
  config       jsonb not null default '{}',       -- zips, search_urls, actor, lookback_days, etc.
  last_run_at  timestamptz,
  last_result  jsonb,
  created_at   timestamptz not null default now()
);

-- 3. Per-run log for the UI (found / queued / skipped / errors).
create table if not exists public.letter_monitor_runs (
  id          uuid primary key default gen_random_uuid(),
  source_key  text not null references public.letter_monitor_sources(key) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  found       integer default 0,
  queued      integer default 0,
  skipped     integer default 0,
  error       text
);

create index if not exists idx_letter_monitor_runs_source
  on public.letter_monitor_runs(source_key, started_at desc);

-- Seed the two sources (idempotent).
insert into public.letter_monitor_sources (key, label, letter_type, enabled, config)
values
  ('violations_311', 'Grass Violations (Kendallville 311)', 'violation', false,
   '{"feed_url":"https://www.kendallvillein.gov/311/map/","service_name":"Tall Grass / Weeds","target_zips":["46755"]}'::jsonb),
  ('homeowners_zillow', 'New Homeowners (Zillow Recently Sold)', 'new_homeowner', false,
   '{"actor":"maxcopell~zillow-scraper","search_urls":[],"lookback_days":45,"target_zips":["46755"]}'::jsonb)
on conflict (key) do nothing;

-- RLS: access only via service-role key in /api/letters/* routes.
alter table public.letter_monitor_sources enable row level security;
alter table public.letter_monitor_runs    enable row level security;
