-- Equipment table
create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'other', -- mower_rider, mower_push, trimmer, blower, trailer, truck, other
  brand text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_price numeric(10,2),
  status text not null default 'active', -- active, maintenance, retired
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Todo list table
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'pending', -- pending, done
  priority text not null default 'normal', -- low, normal, high
  due_date date,
  assign_type text, -- customer, employee, equipment, null
  assigned_customer_id uuid references customers(id) on delete set null,
  assigned_employee_id uuid references profiles(id) on delete set null,
  assigned_equipment_id uuid references equipment(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Efficiency metrics — one row per employee for mow speed
create table if not exists efficiency_metrics (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references profiles(id) on delete cascade,
  label text not null, -- e.g. "John - Push Mower", "Rider (ZTR)"
  minutes_per_1000sqft numeric(8,2), -- how many minutes to mow 1000 sq ft
  equipment_id uuid references equipment(id) on delete set null, -- optional: which equipment
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Global efficiency settings (rider speed multiplier, etc.)
create table if not exists efficiency_settings (
  key text primary key,
  value numeric(10,4) not null,
  label text,
  unit text,
  updated_at timestamptz not null default now()
);

-- Seed default efficiency settings
insert into efficiency_settings (key, value, label, unit) values
  ('rider_speed_multiplier', 2.5, 'Rider mower speed vs push mower', 'x faster'),
  ('avg_drive_minutes_between_jobs', 10, 'Average drive time between jobs', 'minutes'),
  ('avg_setup_minutes_per_job', 5, 'Setup/teardown time per job', 'minutes'),
  ('target_jobs_per_crew_day', 8, 'Target jobs per crew per day', 'jobs')
on conflict (key) do nothing;

-- RLS: allow authenticated users full access
alter table equipment enable row level security;
alter table todos enable row level security;
alter table efficiency_metrics enable row level security;
alter table efficiency_settings enable row level security;

create policy "auth_all_equipment" on equipment for all to authenticated using (true) with check (true);
create policy "auth_all_todos" on todos for all to authenticated using (true) with check (true);
create policy "auth_all_efficiency_metrics" on efficiency_metrics for all to authenticated using (true) with check (true);
create policy "auth_all_efficiency_settings" on efficiency_settings for all to authenticated using (true) with check (true);
