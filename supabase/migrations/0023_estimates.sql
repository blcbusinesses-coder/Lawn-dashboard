-- ── Estimates ─────────────────────────────────────────────────────────────────
-- Price out a lawn (via Zillow/Apify lookup) or a custom job, then send a
-- professional estimate email (same styling as invoices). Estimates can be sent
-- to prospects who aren't customers yet, so name/email are stored inline and the
-- customer_id link is optional.

CREATE TABLE IF NOT EXISTS public.estimates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text NOT NULL,
  customer_email  text,
  address         text,
  job_type        text,                      -- 'lawn_mowing' or a custom label
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  subtotal        numeric(10,2) NOT NULL DEFAULT 0,
  cac_amount      numeric(10,2) NOT NULL DEFAULT 0,   -- optional customer-acquisition add-on
  total_amount    numeric(10,2) NOT NULL DEFAULT 0,
  notes           text,                       -- intro message shown in the email
  property_data   jsonb,                      -- raw Apify/lookup payload for the lawn
  valid_until     date,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.estimate_line_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id   uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  description   text NOT NULL,
  quantity      integer NOT NULL DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL DEFAULT 0,
  line_total    numeric(10,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_status        ON public.estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created       ON public.estimates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON public.estimate_line_items(estimate_id);

ALTER TABLE public.estimates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimates: owner full"      ON public.estimates
  FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "estimate_items: owner full" ON public.estimate_line_items
  FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');

-- Reuse the shared updated_at trigger from 0001_initial_schema.sql.
CREATE TRIGGER trg_estimates_updated_at
  BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default custom-job types + rates for the estimate calculator. Editable later.
INSERT INTO public.automation_settings (key, value, label) VALUES
  ('estimate_job_types', '[
    {"key": "leaf_cleanup",    "label": "Leaf Cleanup",        "hourly": 60, "default_hours": 3,   "materials": 0},
    {"key": "mulch",           "label": "Mulch Install",       "hourly": 60, "default_hours": 4,   "materials": 0},
    {"key": "hedge_trim",      "label": "Hedge / Bush Trim",   "hourly": 60, "default_hours": 2,   "materials": 0},
    {"key": "aeration",        "label": "Aeration",            "hourly": 65, "default_hours": 1.5, "materials": 0},
    {"key": "overseed",        "label": "Overseeding",         "hourly": 60, "default_hours": 2,   "materials": 40},
    {"key": "yard_cleanup",    "label": "Yard Cleanup",        "hourly": 55, "default_hours": 3,   "materials": 0},
    {"key": "gutter",          "label": "Gutter Cleaning",     "hourly": 60, "default_hours": 2,   "materials": 0},
    {"key": "power_wash",      "label": "Power Washing",       "hourly": 70, "default_hours": 3,   "materials": 20},
    {"key": "snow_removal",    "label": "Snow Removal",        "hourly": 75, "default_hours": 1.5, "materials": 0},
    {"key": "other",           "label": "Other / Custom",      "hourly": 60, "default_hours": 2,   "materials": 0}
  ]'::jsonb, 'Estimate Job Types'),
  ('estimate_drive_rate',  '45'::jsonb, 'Estimate Drive Cost ($/hr of round-trip drive time)'),
  ('estimate_valid_days',  '30'::jsonb, 'Estimate Valid For (days)')
ON CONFLICT (key) DO NOTHING;
