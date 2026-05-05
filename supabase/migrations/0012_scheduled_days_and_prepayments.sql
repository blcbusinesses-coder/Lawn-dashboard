-- Add scheduled_days to properties
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS scheduled_days text[] DEFAULT NULL;

-- customer_prepayments table
CREATE TABLE IF NOT EXISTS customer_prepayments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount       numeric(10, 2) NOT NULL CHECK (amount > 0),
  for_month    text NOT NULL,          -- 'YYYY-MM' format
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE customer_prepayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_full_access_prepayments"
  ON customer_prepayments
  FOR ALL
  TO authenticated
  USING (get_my_role() = 'owner')
  WITH CHECK (get_my_role() = 'owner');
