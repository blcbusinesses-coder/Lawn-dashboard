-- Envelope-style allocations for the Bank Account tab. Each row is a "thing"
-- the money in the bank is going toward (payroll, a credit card, a loan, taxes,
-- savings, etc.) with a target (how much it needs) and an allocated amount (how
-- much has been set aside so far). "Still needed" is derived as target − allocated.
CREATE TABLE IF NOT EXISTS bank_allocations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  target_amount    numeric(12, 2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  allocated_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_full_access_bank_allocations"
  ON bank_allocations
  FOR ALL
  TO authenticated
  USING (get_my_role() = 'owner')
  WITH CHECK (get_my_role() = 'owner');
