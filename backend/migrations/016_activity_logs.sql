-- Activity Logs System Migration
-- Comprehensive audit trail for compliance and tracking

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,          -- "created", "updated", "deleted", "exported", etc.
  entity_type VARCHAR(50) NOT NULL,     -- "quote", "customer", "contact", "user"
  entity_id UUID,                       -- ID of affected entity (nullable for bulk actions)
  metadata JSONB,                       -- Extra context (format, filters, etc.)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_activity_logs_org_time
  ON activity_logs(organization_id, created_at DESC);
CREATE INDEX idx_activity_logs_entity
  ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_user
  ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_action
  ON activity_logs(action, created_at DESC);

-- RLS policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their organization's activity logs
CREATE POLICY "Users can read org activity logs"
  ON activity_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Service role can insert activity logs (for backend logging)
CREATE POLICY "Service role can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- Prevent manual updates/deletes (logs are immutable)
CREATE POLICY "No manual updates"
  ON activity_logs FOR UPDATE
  USING (false);

CREATE POLICY "No manual deletes"
  ON activity_logs FOR DELETE
  USING (false);

-- Automatic cleanup function (called by cron job)
-- Deletes logs older than 6 months
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON TABLE activity_logs IS 'Audit trail for all user actions. Logs are immutable and auto-purged after 6 months.';
