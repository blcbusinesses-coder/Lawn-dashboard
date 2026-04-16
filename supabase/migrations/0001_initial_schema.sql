-- =========================================================
-- Gray Wolf Workers — Initial Schema
-- Run this in Supabase SQL Editor
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- -------------------------------------------------------
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'employee')),
  hourly_rate   NUMERIC(8,2),
  phone         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- CUSTOMERS
-- -------------------------------------------------------
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- PROPERTIES
-- -------------------------------------------------------
CREATE TABLE properties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  address         TEXT NOT NULL,
  price_per_mow   NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- JOB_LOGS (one row per property per week)
-- -------------------------------------------------------
CREATE TABLE job_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
  completed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, week_start)
);

-- -------------------------------------------------------
-- EXPENSES
-- -------------------------------------------------------
CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant        TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  expense_date    DATE NOT NULL,
  notes           TEXT,
  receipt_url     TEXT,
  raw_ocr_json    JSONB,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- INVOICES
-- -------------------------------------------------------
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('draft','sent','paid','void')) DEFAULT 'draft',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ai_message      TEXT,
  sent_at         TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- INVOICE_LINE_ITEMS
-- -------------------------------------------------------
CREATE TABLE invoice_line_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(8,2) NOT NULL,
  line_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- TIME_LOGS (employee clock in/out)
-- -------------------------------------------------------
CREATE TABLE time_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clock_in        TIMESTAMPTZ NOT NULL,
  clock_out       TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- SMS_MESSAGES
-- -------------------------------------------------------
CREATE TABLE sms_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  to_phone        TEXT NOT NULL,
  body            TEXT NOT NULL,
  twilio_sid      TEXT,
  status          TEXT DEFAULT 'queued',
  sent_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
CREATE INDEX idx_properties_customer     ON properties(customer_id);
CREATE INDEX idx_job_logs_property       ON job_logs(property_id);
CREATE INDEX idx_job_logs_week_start     ON job_logs(week_start);
CREATE INDEX idx_expenses_date           ON expenses(expense_date);
CREATE INDEX idx_invoices_customer       ON invoices(customer_id);
CREATE INDEX idx_invoices_status         ON invoices(status);
CREATE INDEX idx_invoice_items_invoice   ON invoice_line_items(invoice_id);
CREATE INDEX idx_time_logs_employee      ON time_logs(employee_id);
CREATE INDEX idx_sms_customer            ON sms_messages(customer_id);

-- -------------------------------------------------------
-- updated_at trigger
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
