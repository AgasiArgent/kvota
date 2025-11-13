-- Migration: Quote Workflow System
-- Date: 2025-11-08
-- Purpose: Multi-role collaborative quote creation workflow
-- See: docs/plans/2025-11-08-quote-workflow-system-design.md

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Helper function for RLS (if not exists)
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
  SELECT (current_setting('app.current_organization_id', true))::uuid;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- TASK 1.1: Create quote_workflow_transitions table (audit log)
-- ============================================================================

-- Create workflow transitions table
CREATE TABLE quote_workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Transition details
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'submit_procurement', 'approve', 'reject', 'send_back'

  -- Who and when
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  role_at_transition TEXT NOT NULL,

  -- Optional context
  comments TEXT,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflow_transitions_quote ON quote_workflow_transitions(quote_id);
CREATE INDEX idx_workflow_transitions_org ON quote_workflow_transitions(organization_id);
CREATE INDEX idx_workflow_transitions_state ON quote_workflow_transitions(to_state, organization_id);
CREATE INDEX idx_workflow_transitions_performed_at ON quote_workflow_transitions(performed_at DESC);

-- Enable RLS
ALTER TABLE quote_workflow_transitions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY workflow_transitions_select ON quote_workflow_transitions
  FOR SELECT USING (
    quote_id IN (
      SELECT id FROM quotes WHERE organization_id = current_organization_id()
    )
  );

CREATE POLICY workflow_transitions_insert ON quote_workflow_transitions
  FOR INSERT WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE organization_id = current_organization_id()
    )
  );

-- Comments
COMMENT ON TABLE quote_workflow_transitions IS 'Audit log of all quote workflow state transitions';
COMMENT ON COLUMN quote_workflow_transitions.role_at_transition IS 'Role snapshot at time of action for audit trail';

-- ============================================================================
-- TASK 1.2: Create organization_workflow_settings table
-- ============================================================================

-- Create organization workflow settings table
CREATE TABLE organization_workflow_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Workflow mode
  workflow_mode TEXT NOT NULL DEFAULT 'simple',
  CHECK (workflow_mode IN ('simple', 'multi_role')),

  -- Approval thresholds (USD)
  financial_approval_threshold_usd DECIMAL(15,2) DEFAULT 0.00,
  senior_approval_threshold_usd DECIMAL(15,2) DEFAULT 100000.00,
  multi_senior_threshold_usd DECIMAL(15,2) DEFAULT 500000.00,
  board_approval_threshold_usd DECIMAL(15,2) DEFAULT 1000000.00,

  -- Required approval counts
  senior_approvals_required INT DEFAULT 1 CHECK (senior_approvals_required BETWEEN 1 AND 5),
  multi_senior_approvals_required INT DEFAULT 2 CHECK (multi_senior_approvals_required BETWEEN 1 AND 5),
  board_approvals_required INT DEFAULT 3 CHECK (board_approvals_required BETWEEN 1 AND 5),

  -- Feature toggles
  enable_parallel_logistics_customs BOOLEAN DEFAULT true,
  allow_send_back BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_workflow_settings_org ON organization_workflow_settings(organization_id);

-- RLS
ALTER TABLE organization_workflow_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_settings_select ON organization_workflow_settings
  FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY workflow_settings_update ON organization_workflow_settings
  FOR UPDATE USING (organization_id = current_organization_id());

CREATE POLICY workflow_settings_insert ON organization_workflow_settings
  FOR INSERT WITH CHECK (organization_id = current_organization_id());

-- Initialize settings for existing organizations
INSERT INTO organization_workflow_settings (organization_id)
SELECT id FROM organizations
ON CONFLICT DO NOTHING;

-- Trigger for auto-update updated_at
CREATE TRIGGER update_workflow_settings_updated_at
  BEFORE UPDATE ON organization_workflow_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TASK 1.3: Add workflow columns to quotes table
-- ============================================================================

-- Add workflow columns to quotes table
ALTER TABLE quotes
  ADD COLUMN workflow_state TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN logistics_complete BOOLEAN DEFAULT false,
  ADD COLUMN customs_complete BOOLEAN DEFAULT false,
  ADD COLUMN current_assignee_role TEXT,
  ADD COLUMN assigned_at TIMESTAMPTZ,
  ADD COLUMN senior_approvals_required INT DEFAULT 0,
  ADD COLUMN senior_approvals_received INT DEFAULT 0;

-- Add constraint for workflow_state
ALTER TABLE quotes
  ADD CONSTRAINT check_workflow_state CHECK (
    workflow_state IN (
      'draft', 'awaiting_procurement', 'awaiting_logistics_customs',
      'awaiting_sales_review', 'awaiting_financial_approval',
      'awaiting_senior_approval', 'approved', 'rejected'
    )
  );

-- Indexes for filtering
CREATE INDEX idx_quotes_workflow_state ON quotes(workflow_state, organization_id);
CREATE INDEX idx_quotes_assignee_role ON quotes(current_assignee_role, organization_id)
  WHERE current_assignee_role IS NOT NULL;

-- Grandfather existing quotes as approved
UPDATE quotes
SET workflow_state = 'approved',
    assigned_at = created_at
WHERE workflow_state = 'draft' AND created_at < NOW() - INTERVAL '1 day';

-- Comments
COMMENT ON COLUMN quotes.workflow_state IS 'Current workflow state for multi-role collaboration';
COMMENT ON COLUMN quotes.logistics_complete IS 'Flag for parallel logistics completion';
COMMENT ON COLUMN quotes.customs_complete IS 'Flag for parallel customs completion';

-- ============================================================================
-- TASK 1.4: Add new roles to roles table
-- ============================================================================

-- Ensure composite unique constraint on (organization_id, slug)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'roles_org_slug_key'
    ) THEN
        ALTER TABLE roles ADD CONSTRAINT roles_org_slug_key UNIQUE (organization_id, slug);
    END IF;
END $$;

-- Add workflow-specific roles (system-wide, not org-specific)
-- Note: Insert for each organization if roles are org-specific
DO $$
DECLARE
    org_record RECORD;
BEGIN
    FOR org_record IN SELECT id FROM organizations LOOP
        INSERT INTO roles (organization_id, name, slug, description, permissions, is_system_role) VALUES
        (org_record.id, 'Sales Manager', 'sales_manager', 'Creates quotes and sets client terms',
         '["quotes:create", "quotes:read", "quotes:update", "quotes:submit_procurement", "quotes:submit_approval"]', false),

        (org_record.id, 'Procurement Manager', 'procurement_manager', 'Negotiates supplier prices and terms',
         '["quotes:read", "quotes:update_procurement"]', false),

        (org_record.id, 'Logistics Manager', 'logistics_manager', 'Calculates shipping and logistics costs',
         '["quotes:read", "quotes:update_logistics", "quotes:complete_logistics"]', false),

        (org_record.id, 'Customs Manager', 'customs_manager', 'Determines tariffs and clearance fees',
         '["quotes:read", "quotes:update_customs", "quotes:complete_customs"]', false),

        (org_record.id, 'Financial Manager', 'financial_manager', 'Approves quotes financially',
         '["quotes:read", "quotes:approve_financial"]', false),

        (org_record.id, 'Top Sales Manager', 'top_sales_manager', 'Senior approval for high-value quotes',
         '["quotes:read", "quotes:approve_senior", "quotes:update"]', false),

        (org_record.id, 'CFO', 'cfo', 'Chief Financial Officer - senior approvals',
         '["quotes:read", "quotes:approve_senior", "quotes:approve_all", "settings:update"]', false),

        (org_record.id, 'CEO', 'ceo', 'Chief Executive Officer - final approvals',
         '["quotes:read", "quotes:approve_senior", "quotes:approve_all", "settings:update"]', false)

        ON CONFLICT (organization_id, slug) DO UPDATE SET
          permissions = EXCLUDED.permissions,
          description = EXCLUDED.description;
    END LOOP;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verification queries (for manual testing):
--
-- 1. Check tables created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('quote_workflow_transitions', 'organization_workflow_settings');
--
-- 2. Check quotes columns added:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'quotes' AND column_name LIKE '%workflow%';
--
-- 3. Check roles added:
-- SELECT slug, name FROM roles WHERE slug LIKE '%manager%' OR slug IN ('cfo', 'ceo');
--
-- 4. Check workflow settings initialized:
-- SELECT organization_id, workflow_mode FROM organization_workflow_settings;
