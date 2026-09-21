-- ── Lead source auto-detection + Pushover lead notifications ──────────────────

-- 1. Widen the leads.source column so we can track every channel a lead can
--    come from, not just facebook/website. Auto-detection (see
--    src/lib/leads/source.ts) normalizes raw signals into one of these.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN (
    'facebook',    -- Meta lead ads (Facebook / Instagram lead forms)
    'instagram',   -- Meta lead ads that originated on Instagram
    'nextdoor',    -- Nextdoor post / ad → website form
    'google',      -- Google search / Google Business / Google Ads
    'website',     -- Direct website quote form
    'referral',    -- Word-of-mouth referral
    'sms',         -- Inbound text message
    'qr',          -- Mailed letter / postcard QR scan
    'manual',      -- Manually entered by the owner
    'self_service',-- Public self-service quote tool
    'self_schedule',-- Public self-scheduling flow
    'other'
  ));

-- Keep a human-readable trace of HOW the source was detected
-- (e.g. "utm_source=nextdoor", "referrer: nextdoor.com", "Meta lead form").
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_detail text;

-- 2. Notification settings live in the existing key/value automation_settings
--    store. Secrets (Pushover token + user key) stay in env vars; these flags
--    just control behavior and are safe to edit from the dashboard.
INSERT INTO public.automation_settings (key, value, label) VALUES
  ('pushover_enabled',    'true'::jsonb,  'Pushover Lead Notifications'),
  ('notify_new_lead',     'true'::jsonb,  'Notify On New Lead')
ON CONFLICT (key) DO NOTHING;
