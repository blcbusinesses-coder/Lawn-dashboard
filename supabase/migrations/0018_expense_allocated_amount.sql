-- Running "set aside so far" toward each unpaid expense obligation (credit card
-- / loan). The Bank Account tab treats every unpaid obligation as a funding
-- bucket: target = amount, set-aside = allocated_amount, still-needed =
-- max(0, amount − allocated_amount). This is one running total per bill, so once
-- a bill is fully saved it stays funded across every future month.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS allocated_amount numeric(12, 2) NOT NULL DEFAULT 0
  CHECK (allocated_amount >= 0);
