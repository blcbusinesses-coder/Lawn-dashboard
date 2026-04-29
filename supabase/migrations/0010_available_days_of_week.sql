-- Switch chosen_start_day from date → text so we can store day names like "Monday"
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'chosen_start_day'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE leads ALTER COLUMN chosen_start_day TYPE text;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'chosen_start_day'
  ) THEN
    ALTER TABLE leads ADD COLUMN chosen_start_day text;
  END IF;
END $$;

-- Default available days of the week shown on the public quote page
INSERT INTO automation_settings (key, value, label) VALUES
  ('available_days', '["Monday","Wednesday","Friday"]'::jsonb,
   'Days of the week available for new customers (shown on /get-a-quote)')
ON CONFLICT (key) DO NOTHING;
