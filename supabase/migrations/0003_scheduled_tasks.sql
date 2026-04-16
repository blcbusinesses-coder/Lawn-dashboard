-- =========================================================
-- Scheduled Tasks
-- Run AFTER 0002_rls_policies.sql
-- =========================================================

CREATE TABLE scheduled_tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  trigger_type  TEXT NOT NULL CHECK (trigger_type IN ('once', 'monthly', 'weekly', 'reminder')),
  trigger_date  DATE,
  action_type   TEXT,
  action_params JSONB,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_tasks_status       ON scheduled_tasks(status);
CREATE INDEX idx_scheduled_tasks_trigger_date ON scheduled_tasks(trigger_date);

ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_tasks: owner full"
  ON scheduled_tasks FOR ALL
  USING (get_my_role() = 'owner')
  WITH CHECK (get_my_role() = 'owner');
