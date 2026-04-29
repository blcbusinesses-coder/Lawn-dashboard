-- Self-service quote fields on leads
alter table leads
  add column if not exists addons          jsonb,
  add column if not exists chosen_start_day date,
  add column if not exists quote_source    text not null default 'automation';

-- Mark availability days as full
alter table availability_dates
  add column if not exists is_full boolean not null default false;

-- Default add-ons for the public quote page (owner can edit these from the dashboard)
insert into automation_settings (key, value, label) values
  ('quote_addons', '[
    {"key":"edging",         "label":"Edging",          "price":10, "description":"Clean lines along driveways & sidewalks"},
    {"key":"leaf_cleanup",   "label":"Leaf Cleanup",     "price":15, "description":"Blowing & bagging leaves each visit"},
    {"key":"weed_treatment", "label":"Weed Treatment",   "price":20, "description":"Spot-spray visible weeds in turf"}
  ]'::jsonb, 'Quote page add-on options')
on conflict (key) do nothing;
