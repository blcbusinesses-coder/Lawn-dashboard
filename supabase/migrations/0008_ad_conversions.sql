-- Ad conversion tracking: records leads that converted to customers via SMS chat
create table if not exists ad_conversions (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid references leads(id) on delete set null,
  conversation_id   uuid references conversations(id) on delete set null,
  lead_name         text,
  converted_at      timestamptz not null default now(),
  confidence_score  numeric(4,3),           -- 0.000–1.000 from OpenAI
  ad_id             text,                   -- Facebook ad ID at time of lead
  ad_name           text,
  ad_campaign_id    text,
  ad_campaign_name  text,
  cpl_at_conversion numeric(10,2),          -- snapshot of CPL when conversion detected
  customer_status   text not null default 'auto_detected'
                    check (customer_status in ('auto_detected', 'confirmed', 'rejected')),
  created_at        timestamptz not null default now()
);

-- Index for lookups by conversation (used in detect-conversions route to prevent dupes)
create index if not exists ad_conversions_conversation_id_idx on ad_conversions(conversation_id);

-- Index for lookups by lead
create index if not exists ad_conversions_lead_id_idx on ad_conversions(lead_id);

-- RLS: owners can do everything; employees have no access
alter table ad_conversions enable row level security;

create policy "owners_full_access_ad_conversions"
  on ad_conversions
  for all
  to authenticated
  using (get_my_role() = 'owner')
  with check (get_my_role() = 'owner');
