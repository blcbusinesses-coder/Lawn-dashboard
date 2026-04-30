-- Payment log for invoices (supports partial payments)
create table if not exists invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  amount       numeric(10,2) not null check (amount > 0),
  paid_at      date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);

alter table invoice_payments enable row level security;

create policy "owner full access on invoice_payments"
  on invoice_payments for all
  using (auth.jwt() ->> 'role' = 'owner');
