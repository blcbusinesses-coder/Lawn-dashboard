-- ── Leads: add source, facebook_lead_id, drafted_text ─────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source           text NOT NULL DEFAULT 'website'
                                              CHECK (source IN ('facebook', 'website')),
  ADD COLUMN IF NOT EXISTS facebook_lead_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS drafted_text     text,
  ADD COLUMN IF NOT EXISTS quote_low        numeric,
  ADD COLUMN IF NOT EXISTS quote_high       numeric;

-- Extend status to include followed_up and closed
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'quoted', 'followed_up', 'closed', 'converted', 'lost'));

-- ── automation_settings: seed twilio_enabled if not present ───────────────────
INSERT INTO public.automation_settings (key, value)
VALUES ('twilio_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
