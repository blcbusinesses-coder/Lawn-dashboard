-- One-off jobs: ad-hoc services like mulching, stick cleanup, etc.
CREATE TABLE IF NOT EXISTS public.one_off_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  property_id     uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  amount          numeric(10,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'done', 'cancelled')),
  scheduled_date  date,
  completed_date  date,
  notes           text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_one_off_jobs_updated_at
  BEFORE UPDATE ON public.one_off_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.one_off_jobs ENABLE ROW LEVEL SECURITY;

-- Owners: full access
CREATE POLICY "owner_all_one_off_jobs" ON public.one_off_jobs
  FOR ALL USING (get_my_role() = 'owner');

-- Employees: read only (so they can see assigned jobs)
CREATE POLICY "employee_read_one_off_jobs" ON public.one_off_jobs
  FOR SELECT USING (get_my_role() = 'employee');
