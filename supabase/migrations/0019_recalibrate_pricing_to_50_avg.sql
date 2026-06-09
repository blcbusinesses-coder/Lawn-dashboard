-- Recalibrate the quoting engine so a typical NE-Indiana residential lawn
-- lands around $50/mow (it was biasing high — a quarter-acre lot priced at
-- $55–$65). Run this in the Supabase SQL editor to apply to the live DB.
--
-- The original seed in 0007 used ON CONFLICT DO NOTHING, so it will NOT update
-- an already-seeded row — hence this explicit UPDATE.
--
-- These rows feed /api/quote/* , /api/letters/generate, and the automation
-- pricing engine. The grass_ratio_tiers / footprint_estimate_tiers rows (if
-- present) are left as-is — adjust those from the Automation settings page.

UPDATE public.automation_settings
SET value = '[
    {"max_sqft": 3000,  "price": 40,  "label": "Small (up to 3,000 sqft)"},
    {"max_sqft": 5000,  "price": 45,  "label": "Medium-Small (up to 5,000 sqft)"},
    {"max_sqft": 8000,  "price": 50,  "label": "Medium (up to 8,000 sqft)"},
    {"max_sqft": 12000, "price": 60,  "label": "Medium-Large (up to 12,000 sqft)"},
    {"max_sqft": 18000, "price": 75,  "label": "Large (up to 18,000 sqft)"},
    {"max_sqft": 25000, "price": 95,  "label": "X-Large (up to 25,000 sqft)"},
    {"max_sqft": 43560, "price": 130, "label": "Up to 1 Acre"}
  ]'::jsonb
WHERE key = 'pricing_tiers';

UPDATE public.automation_settings
SET value = '50'::jsonb
WHERE key = 'fallback_price';

UPDATE public.automation_settings
SET value = '160'::jsonb
WHERE key = 'over_one_acre_price';

-- If these rows don't exist yet, create them with the recalibrated values so
-- a fresh DB matches the updated 0007 seed.
INSERT INTO public.automation_settings (key, value, label) VALUES
  ('pricing_tiers', '[
    {"max_sqft": 3000,  "price": 40,  "label": "Small (up to 3,000 sqft)"},
    {"max_sqft": 5000,  "price": 45,  "label": "Medium-Small (up to 5,000 sqft)"},
    {"max_sqft": 8000,  "price": 50,  "label": "Medium (up to 8,000 sqft)"},
    {"max_sqft": 12000, "price": 60,  "label": "Medium-Large (up to 12,000 sqft)"},
    {"max_sqft": 18000, "price": 75,  "label": "Large (up to 18,000 sqft)"},
    {"max_sqft": 25000, "price": 95,  "label": "X-Large (up to 25,000 sqft)"},
    {"max_sqft": 43560, "price": 130, "label": "Up to 1 Acre"}
  ]'::jsonb, 'Pricing Tiers'),
  ('fallback_price',      '50'::jsonb,  'Fallback Price (unknown lot size)'),
  ('over_one_acre_price', '160'::jsonb, 'Price for Lots Over 1 Acre')
ON CONFLICT (key) DO NOTHING;
