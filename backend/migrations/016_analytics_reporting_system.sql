-- ============================================================================
-- Financial Analytics & Reporting System
-- Migration 016: Create analytics tables with RLS
-- Date: 2025-11-02
-- ============================================================================

-- 0. Helper function (if not exists)
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
  SELECT (current_setting('app.current_organization_id', true))::uuid;
$$ LANGUAGE SQL STABLE;

-- 1. SAVED REPORTS TABLE
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Report metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Query definition (JSON)
  filters JSONB NOT NULL DEFAULT '{}',
  selected_fields TEXT[] NOT NULL,
  aggregations JSONB DEFAULT '{}',

  -- Sharing settings
  visibility TEXT NOT NULL DEFAULT 'personal'
    CONSTRAINT chk_visibility CHECK (visibility IN ('personal', 'shared')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  CONSTRAINT unique_report_name_per_org_user
    UNIQUE(organization_id, created_by, name)
    DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for saved_reports
CREATE INDEX idx_saved_reports_org ON saved_reports(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_creator ON saved_reports(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_visibility ON saved_reports(organization_id, visibility) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_filters_gin ON saved_reports USING gin(filters jsonb_path_ops);

-- RLS for saved_reports
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_reports_select" ON saved_reports
FOR SELECT USING (
  organization_id = current_organization_id()
  AND deleted_at IS NULL
  AND (created_by = auth.uid() OR visibility = 'shared')
);

CREATE POLICY "saved_reports_insert" ON saved_reports
FOR INSERT WITH CHECK (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "saved_reports_update" ON saved_reports
FOR UPDATE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "saved_reports_delete" ON saved_reports
FOR DELETE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

-- 2. REPORT EXECUTIONS TABLE (IMMUTABLE AUDIT LOG)
CREATE TABLE report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Report reference
  saved_report_id UUID REFERENCES saved_reports(id) ON DELETE SET NULL,
  report_name TEXT,

  -- Execution context
  executed_by UUID NOT NULL REFERENCES auth.users(id),
  execution_type TEXT NOT NULL
    CONSTRAINT chk_execution_type CHECK (execution_type IN ('manual', 'scheduled', 'api')),

  -- Query snapshot (immutable record)
  filters JSONB NOT NULL DEFAULT '{}',
  selected_fields TEXT[] NOT NULL,
  aggregations JSONB DEFAULT '{}',

  -- Results snapshot
  result_summary JSONB NOT NULL DEFAULT '{}',
  quote_count INT NOT NULL DEFAULT 0 CHECK (quote_count >= 0),
  date_range JSONB DEFAULT '{}',

  -- Generated file
  export_file_url TEXT,
  export_format TEXT
    CONSTRAINT chk_export_format CHECK (export_format IN ('xlsx', 'csv', 'pdf', 'json')),
  file_size_bytes INT CHECK (file_size_bytes > 0),
  file_expires_at TIMESTAMPTZ,

  -- Audit fields
  ip_address INET,
  user_agent TEXT,

  -- Performance tracking
  execution_time_ms INT CHECK (execution_time_ms >= 0),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for report_executions
CREATE INDEX idx_report_executions_org_date ON report_executions(organization_id, executed_at DESC);
CREATE INDEX idx_report_executions_user ON report_executions(executed_by, executed_at DESC);
CREATE INDEX idx_report_executions_saved_report ON report_executions(saved_report_id) WHERE saved_report_id IS NOT NULL;
CREATE INDEX idx_report_executions_org_type_date ON report_executions(organization_id, execution_type, executed_at DESC);
CREATE INDEX idx_report_executions_file_expiry ON report_executions(file_expires_at) WHERE file_expires_at IS NOT NULL;
CREATE INDEX idx_report_executions_filters_gin ON report_executions USING gin(filters jsonb_path_ops);
CREATE INDEX idx_report_executions_date_range ON report_executions((date_range->>'start'), (date_range->>'end'));

-- RLS for report_executions (IMMUTABLE)
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_executions_select" ON report_executions
FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY "report_executions_insert" ON report_executions
FOR INSERT WITH CHECK (
  organization_id = current_organization_id()
  AND executed_by = auth.uid()
);

-- NO UPDATE/DELETE - Audit logs are immutable
CREATE POLICY "report_executions_no_update" ON report_executions
FOR UPDATE USING (false);

CREATE POLICY "report_executions_no_delete" ON report_executions
FOR DELETE USING (false);

-- 3. SCHEDULED REPORTS TABLE
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  saved_report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,

  -- Schedule configuration
  name TEXT NOT NULL,
  schedule_cron TEXT NOT NULL
    CONSTRAINT chk_valid_cron CHECK (
      schedule_cron ~ '^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$'
    ),
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',

  -- Notification settings
  email_recipients TEXT[] NOT NULL CHECK (array_length(email_recipients, 1) > 0),
  include_file BOOLEAN NOT NULL DEFAULT true,
  email_subject TEXT,
  email_body TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_status TEXT
    CONSTRAINT chk_run_status CHECK (last_run_status IN ('success', 'failure', 'partial')),
  last_error TEXT,
  consecutive_failures INT DEFAULT 0,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scheduled_reports
CREATE INDEX idx_scheduled_reports_org ON scheduled_reports(organization_id);
CREATE INDEX idx_scheduled_reports_saved_report ON scheduled_reports(saved_report_id);
CREATE INDEX idx_scheduled_reports_active_next_run ON scheduled_reports(organization_id, next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_created_by ON scheduled_reports(created_by);

-- Global index for scheduler queries (non-org-scoped background job)
CREATE INDEX idx_scheduled_reports_next_run_global
  ON scheduled_reports(next_run_at)
  WHERE is_active = true;

-- RLS for scheduled_reports
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_reports_select" ON scheduled_reports
FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY "scheduled_reports_insert" ON scheduled_reports
FOR INSERT WITH CHECK (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "scheduled_reports_update" ON scheduled_reports
FOR UPDATE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "scheduled_reports_delete" ON scheduled_reports
FOR DELETE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

-- 4. REPORT VERSIONS TABLE (IMMUTABLE)
CREATE TABLE report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE RESTRICT,
  version_number INT NOT NULL CHECK (version_number > 0),

  -- Snapshot of report at this version
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  selected_fields TEXT[] NOT NULL,
  aggregations JSONB DEFAULT '{}',
  visibility TEXT NOT NULL,

  -- Change tracking
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  change_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_report_version UNIQUE(saved_report_id, version_number)
);

-- Indexes for report_versions
CREATE INDEX idx_report_versions_saved_report ON report_versions(saved_report_id, version_number DESC);
CREATE INDEX idx_report_versions_changed_by ON report_versions(changed_by);

-- RLS for report_versions (IMMUTABLE)
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_versions_select" ON report_versions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM saved_reports sr
    WHERE sr.id = report_versions.saved_report_id
    AND sr.organization_id = current_organization_id()
    AND sr.deleted_at IS NULL
    AND (sr.created_by = auth.uid() OR sr.visibility = 'shared')
  )
);

-- System creates versions automatically
CREATE POLICY "report_versions_insert_system" ON report_versions
FOR INSERT WITH CHECK (true);

-- Versions are immutable
CREATE POLICY "report_versions_no_update" ON report_versions
FOR UPDATE USING (false);

CREATE POLICY "report_versions_no_delete" ON report_versions
FOR DELETE USING (false);

-- 5. AUTO-UPDATE TRIGGERS
CREATE TRIGGER update_saved_reports_updated_at
  BEFORE UPDATE ON saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. VERSION TRACKING TRIGGER
CREATE OR REPLACE FUNCTION track_report_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INT;
BEGIN
  -- Only track if report actually changed
  IF OLD.filters IS DISTINCT FROM NEW.filters
    OR OLD.selected_fields IS DISTINCT FROM NEW.selected_fields
    OR OLD.aggregations IS DISTINCT FROM NEW.aggregations
    OR OLD.visibility IS DISTINCT FROM NEW.visibility THEN

    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM report_versions
    WHERE saved_report_id = NEW.id;

    -- Clean old versions (keep last 100 OR last 90 days, whichever is more)
    DELETE FROM report_versions
    WHERE saved_report_id = NEW.id
      AND version_number NOT IN (
        -- Keep last 99 versions (we're adding 1 = 100 total)
        SELECT version_number FROM report_versions
        WHERE saved_report_id = NEW.id
        ORDER BY version_number DESC
        LIMIT 99
      )
      AND created_at < NOW() - INTERVAL '90 days';

    -- Create version record
    INSERT INTO report_versions (
      saved_report_id, version_number, name, description,
      filters, selected_fields, aggregations, visibility,
      changed_by, change_description
    ) VALUES (
      NEW.id, next_version, OLD.name, OLD.description,
      OLD.filters, OLD.selected_fields, OLD.aggregations, OLD.visibility,
      NEW.created_by, 'Auto-versioned on update'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_saved_report_versions
  AFTER UPDATE ON saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION track_report_version();

-- 7. FILE CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION cleanup_expired_report_files()
RETURNS void AS $$
BEGIN
  -- Respects RLS - only cleans current org's files
  UPDATE report_executions
  SET export_file_url = NULL,
      file_size_bytes = NULL
  WHERE file_expires_at < NOW()
    AND export_file_url IS NOT NULL
    AND organization_id = current_organization_id();
END;
$$ LANGUAGE plpgsql;  -- Removed SECURITY DEFINER for RLS compliance

-- 8. COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE saved_reports IS 'User-saved report templates for financial analytics';
COMMENT ON TABLE report_executions IS 'Immutable audit log of all report executions';
COMMENT ON TABLE scheduled_reports IS 'Automated report scheduling configuration (admin-only)';
COMMENT ON TABLE report_versions IS 'Version history for saved reports (immutable)';
