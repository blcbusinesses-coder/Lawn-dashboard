-- Singleton table holding business-wide settings (currently just the current
-- bank balance, used by the Money tab's Cash Position panel). The boolean
-- primary key + CHECK(id) constraint enforces exactly one row.
CREATE TABLE IF NOT EXISTS business_settings (
  id           boolean PRIMARY KEY DEFAULT true,
  bank_balance numeric(12, 2) NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_settings_singleton CHECK (id)
);

-- Seed the single row so reads always have something to return.
INSERT INTO business_settings (id, bank_balance)
  VALUES (true, 0)
  ON CONFLICT (id) DO NOTHING;

-- RLS: owner-only, matching the rest of the schema.
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_full_access_business_settings"
  ON business_settings
  FOR ALL
  TO authenticated
  USING (get_my_role() = 'owner')
  WITH CHECK (get_my_role() = 'owner');
