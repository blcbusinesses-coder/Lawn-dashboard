-- ─── QR scan tracking for letter analytics ───────────────────────────────────
-- Each time someone lands on /schedule from a letter QR code, we log a row here
-- so the Letters → Analytics tab can report scans over a time frame.

create table if not exists public.letter_qr_scans (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid references public.letter_recipients(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_letter_qr_scans_created on public.letter_qr_scans(created_at desc);
create index if not exists idx_letter_qr_scans_recipient on public.letter_qr_scans(recipient_id);

-- RLS: written/read only via the service-role key in /api routes.
alter table public.letter_qr_scans enable row level security;
