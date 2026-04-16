-- Automation settings (key-value store)
CREATE TABLE IF NOT EXISTS public.automation_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  label       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_automation_settings" ON public.automation_settings
  FOR ALL USING (get_my_role() = 'owner');

-- Seed default pricing tiers
INSERT INTO public.automation_settings (key, value, label) VALUES
  ('pricing_tiers', '[
    {"max_sqft": 2500,  "price": 35,  "label": "Small (up to 2,500 sqft)"},
    {"max_sqft": 4000,  "price": 45,  "label": "Medium-Small (up to 4,000 sqft)"},
    {"max_sqft": 6000,  "price": 55,  "label": "Medium (up to 6,000 sqft)"},
    {"max_sqft": 9000,  "price": 65,  "label": "Medium-Large (up to 9,000 sqft)"},
    {"max_sqft": 12000, "price": 80,  "label": "Large (up to 12,000 sqft)"},
    {"max_sqft": 20000, "price": 100, "label": "X-Large (up to 20,000 sqft)"},
    {"max_sqft": 43560, "price": 130, "label": "Up to 1 Acre"}
  ]'::jsonb, 'Pricing Tiers'),
  ('fallback_price',       '55'::jsonb,    'Fallback Price (unknown lot size)'),
  ('over_one_acre_price',  '165'::jsonb,   'Price for Lots Over 1 Acre'),
  ('sms_signature',        '"– Gray Wolf Workers 🐺"'::jsonb, 'SMS Signature'),
  ('apify_actor',          '"maxcopell~zillow-detail-scraper"'::jsonb, 'Apify Actor ID')
ON CONFLICT (key) DO NOTHING;

-- Automation run logs
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  event_type   text NOT NULL,   -- 'property_lookup', 'quote_sent', 'sms_failed', etc.
  status       text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  details      jsonb,           -- event-specific payload
  duration_ms  int,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_logs_lead_id   ON public.automation_logs(lead_id);
CREATE INDEX idx_automation_logs_created   ON public.automation_logs(created_at DESC);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_automation_logs" ON public.automation_logs
  FOR ALL USING (get_my_role() = 'owner');
