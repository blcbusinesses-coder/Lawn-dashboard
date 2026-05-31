-- ─── Outreach Letters ────────────────────────────────────────────────────────
-- Mirrors postcard_campaigns / postcard_recipients but for full-page letters
-- sent via Lob's /v1/letters API. Adds:
--   letter_campaigns.letter_type   — campaign purpose / AI tone
--   letter_recipients.source       — where the address came from
-- These support the planned modes: new-homeowner public-records outreach and
-- grass-violation list outreach.

create table if not exists public.letter_campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  tags            text[] default '{}',
  letter_type     text not null default 'general',  -- general | new_homeowner | violation
  send_date       text default 'ASAP',
  budget_cap      numeric default 100,
  phone           text default '(260) 000-0000',
  pieces_sent     integer default 0,
  total_cost      numeric default 0,
  lob_campaign_id text,
  response_rate   numeric,
  created_at      timestamptz not null default now()
);

create table if not exists public.letter_recipients (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid references public.letter_campaigns(id) on delete cascade,
  name              text,
  address           text,
  city              text,
  state             text,
  zip               text,
  lot_size          text,
  sq_footage        text,
  property_features text,
  ai_copy           text,
  quote_amount      numeric,
  source            text default 'manual',            -- manual | new_homeowner | violation
  lob_letter_id     text,
  status            text default 'pending',
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_letter_recipients_campaign on public.letter_recipients(campaign_id);

-- RLS: all access is through the service-role key in /api/letters/* routes,
-- which bypasses RLS. Enable RLS with no public policies so the tables are not
-- exposed to the anon/auth client directly.
alter table public.letter_campaigns  enable row level security;
alter table public.letter_recipients enable row level security;
