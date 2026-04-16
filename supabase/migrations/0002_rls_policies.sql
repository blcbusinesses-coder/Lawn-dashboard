-- =========================================================
-- Row Level Security Policies
-- Run AFTER 0001_initial_schema.sql
-- =========================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages       ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "profiles: read own"        ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: owner read all"  ON profiles FOR SELECT USING (get_my_role() = 'owner');
CREATE POLICY "profiles: owner insert"    ON profiles FOR INSERT WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "profiles: owner update"    ON profiles FOR UPDATE USING (get_my_role() = 'owner');
CREATE POLICY "profiles: self update"     ON profiles FOR UPDATE USING (id = auth.uid());

-- CUSTOMERS
CREATE POLICY "customers: owner full"     ON customers FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "customers: employee read"  ON customers FOR SELECT USING (get_my_role() = 'employee');

-- PROPERTIES
CREATE POLICY "properties: owner full"    ON properties FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "properties: employee read" ON properties FOR SELECT USING (get_my_role() = 'employee');

-- JOB_LOGS
CREATE POLICY "job_logs: owner full"      ON job_logs FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "job_logs: employee read"   ON job_logs FOR SELECT USING (get_my_role() = 'employee');
CREATE POLICY "job_logs: employee insert" ON job_logs FOR INSERT WITH CHECK (get_my_role() = 'employee');
CREATE POLICY "job_logs: employee update" ON job_logs FOR UPDATE USING (get_my_role() = 'employee' AND completed_by = auth.uid());

-- EXPENSES (owner only)
CREATE POLICY "expenses: owner full"      ON expenses FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');

-- INVOICES (owner only)
CREATE POLICY "invoices: owner full"      ON invoices FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "invoice_items: owner full" ON invoice_line_items FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');

-- TIME_LOGS
CREATE POLICY "time_logs: owner full"     ON time_logs FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
CREATE POLICY "time_logs: emp read own"   ON time_logs FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "time_logs: emp insert own" ON time_logs FOR INSERT WITH CHECK (employee_id = auth.uid());
CREATE POLICY "time_logs: emp update own" ON time_logs FOR UPDATE USING (employee_id = auth.uid());

-- SMS (owner only)
CREATE POLICY "sms: owner full"           ON sms_messages FOR ALL USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');
