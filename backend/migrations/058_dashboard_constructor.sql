-- Migration: 058_dashboard_constructor
-- Description: Create tables for dashboard constructor with SmartLead integration
-- Created: 2025-12-22
-- Task: TASK-009

-- ============================================================================
-- 1. DASHBOARDS TABLE - Dashboard configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE dashboards IS 'Dashboard configurations for the dashboard constructor';
COMMENT ON COLUMN dashboards.layout IS 'Widget positions as JSON array: [{x, y, w, h, widgetId}]';

-- Indexes for dashboards
CREATE INDEX IF NOT EXISTS idx_dashboards_organization_id ON dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON dashboards(created_at DESC);

-- ============================================================================
-- 2. DASHBOARD_WIDGETS TABLE - Widget configurations within dashboards
-- ============================================================================

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    widget_type TEXT NOT NULL CHECK (widget_type IN ('kpi', 'chart', 'table', 'filter')),
    title TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_source JSONB NOT NULL DEFAULT '{}'::jsonb,
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 4, "h": 3}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE dashboard_widgets IS 'Widget configurations for dashboards';
COMMENT ON COLUMN dashboard_widgets.widget_type IS 'Type: kpi, chart, table, filter';
COMMENT ON COLUMN dashboard_widgets.config IS 'Widget-specific config: chart type, colors, etc.';
COMMENT ON COLUMN dashboard_widgets.data_source IS 'Data source config: {type, campaign_ids, metric, aggregation}';
COMMENT ON COLUMN dashboard_widgets.position IS 'Grid position: {x, y, w, h}';

-- Indexes for dashboard_widgets
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_widget_type ON dashboard_widgets(widget_type);

-- ============================================================================
-- 3. CAMPAIGN_DATA TABLE - Cached campaign metrics from SmartLead + manual entries
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('smartlead', 'manual')),
    campaign_id TEXT,  -- SmartLead campaign ID (null for manual entries)
    campaign_name TEXT NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    period_start DATE,
    period_end DATE,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE campaign_data IS 'Cached campaign metrics from SmartLead and manual entries';
COMMENT ON COLUMN campaign_data.source IS 'Data source: smartlead (API sync) or manual (user entered)';
COMMENT ON COLUMN campaign_data.campaign_id IS 'SmartLead campaign ID (null for manual entries)';
COMMENT ON COLUMN campaign_data.metrics IS 'Campaign metrics: {sent, opened, clicked, replied, bounced, etc.}';
COMMENT ON COLUMN campaign_data.synced_at IS 'Last sync time from SmartLead API';

-- Indexes for campaign_data
CREATE INDEX IF NOT EXISTS idx_campaign_data_organization_id ON campaign_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_data_source ON campaign_data(source);
CREATE INDEX IF NOT EXISTS idx_campaign_data_campaign_id ON campaign_data(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_data_synced_at ON campaign_data(synced_at DESC);

-- Unique constraint: one entry per SmartLead campaign per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_data_unique_smartlead
    ON campaign_data(organization_id, campaign_id)
    WHERE source = 'smartlead' AND campaign_id IS NOT NULL;

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4.1 DASHBOARDS RLS POLICIES
-- ============================================================================

-- Helper function to get user's organization ID from JWT
-- (Reusing existing function if available, otherwise this is for reference)

-- SELECT policy: Users can see dashboards in their organization
DROP POLICY IF EXISTS "dashboards_select_org" ON dashboards;
CREATE POLICY "dashboards_select_org" ON dashboards
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- INSERT policy: Users can create dashboards in their organization
DROP POLICY IF EXISTS "dashboards_insert_org" ON dashboards;
CREATE POLICY "dashboards_insert_org" ON dashboards
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- UPDATE policy: Users can update dashboards in their organization
DROP POLICY IF EXISTS "dashboards_update_org" ON dashboards;
CREATE POLICY "dashboards_update_org" ON dashboards
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- DELETE policy: Users can delete dashboards in their organization
DROP POLICY IF EXISTS "dashboards_delete_org" ON dashboards;
CREATE POLICY "dashboards_delete_org" ON dashboards
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- ============================================================================
-- 4.2 DASHBOARD_WIDGETS RLS POLICIES
-- ============================================================================

-- SELECT policy: Users can see widgets in dashboards they can access
DROP POLICY IF EXISTS "dashboard_widgets_select_org" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_select_org" ON dashboard_widgets
    FOR SELECT
    USING (
        dashboard_id IN (
            SELECT d.id FROM dashboards d
            JOIN organization_members om ON d.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.status = 'active'
        )
    );

-- INSERT policy: Users can add widgets to dashboards they can access
DROP POLICY IF EXISTS "dashboard_widgets_insert_org" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_insert_org" ON dashboard_widgets
    FOR INSERT
    WITH CHECK (
        dashboard_id IN (
            SELECT d.id FROM dashboards d
            JOIN organization_members om ON d.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.status = 'active'
        )
    );

-- UPDATE policy: Users can update widgets in dashboards they can access
DROP POLICY IF EXISTS "dashboard_widgets_update_org" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_update_org" ON dashboard_widgets
    FOR UPDATE
    USING (
        dashboard_id IN (
            SELECT d.id FROM dashboards d
            JOIN organization_members om ON d.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.status = 'active'
        )
    )
    WITH CHECK (
        dashboard_id IN (
            SELECT d.id FROM dashboards d
            JOIN organization_members om ON d.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.status = 'active'
        )
    );

-- DELETE policy: Users can delete widgets from dashboards they can access
DROP POLICY IF EXISTS "dashboard_widgets_delete_org" ON dashboard_widgets;
CREATE POLICY "dashboard_widgets_delete_org" ON dashboard_widgets
    FOR DELETE
    USING (
        dashboard_id IN (
            SELECT d.id FROM dashboards d
            JOIN organization_members om ON d.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND om.status = 'active'
        )
    );

-- ============================================================================
-- 4.3 CAMPAIGN_DATA RLS POLICIES
-- ============================================================================

-- SELECT policy: Users can see campaign data in their organization
DROP POLICY IF EXISTS "campaign_data_select_org" ON campaign_data;
CREATE POLICY "campaign_data_select_org" ON campaign_data
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- INSERT policy: Users can add campaign data in their organization
DROP POLICY IF EXISTS "campaign_data_insert_org" ON campaign_data;
CREATE POLICY "campaign_data_insert_org" ON campaign_data
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- UPDATE policy: Users can update campaign data in their organization
DROP POLICY IF EXISTS "campaign_data_update_org" ON campaign_data;
CREATE POLICY "campaign_data_update_org" ON campaign_data
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- DELETE policy: Users can delete campaign data in their organization
DROP POLICY IF EXISTS "campaign_data_delete_org" ON campaign_data;
CREATE POLICY "campaign_data_delete_org" ON campaign_data
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- ============================================================================
-- 5. TRIGGERS FOR updated_at
-- ============================================================================

-- Trigger function for updating updated_at (reuse existing if available)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for each table
DROP TRIGGER IF EXISTS update_dashboards_updated_at ON dashboards;
CREATE TRIGGER update_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_widgets_updated_at ON dashboard_widgets;
CREATE TRIGGER update_dashboard_widgets_updated_at
    BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_data_updated_at ON campaign_data;
CREATE TRIGGER update_campaign_data_updated_at
    BEFORE UPDATE ON campaign_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. GRANT PERMISSIONS (for service role access)
-- ============================================================================

-- Grant all permissions to authenticated users (RLS handles the filtering)
GRANT ALL ON dashboards TO authenticated;
GRANT ALL ON dashboard_widgets TO authenticated;
GRANT ALL ON campaign_data TO authenticated;

-- Grant permissions to service_role (bypasses RLS)
GRANT ALL ON dashboards TO service_role;
GRANT ALL ON dashboard_widgets TO service_role;
GRANT ALL ON campaign_data TO service_role;
