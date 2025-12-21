-- Migration: 054_list_presets
-- Description: Create list_presets table for department column configurations
-- Date: 2025-12-21
-- Task: TASK-008 - Quote List Constructor with Department Presets

-- ============================================================
-- Table: list_presets
-- Stores column configurations for quote list views
-- ============================================================

CREATE TABLE IF NOT EXISTS list_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    preset_type TEXT NOT NULL CHECK (preset_type IN ('system', 'org', 'personal')),
    department TEXT,  -- 'sales', 'logistics', 'accounting', 'management', or NULL for custom
    created_by UUID REFERENCES auth.users(id),
    columns JSONB NOT NULL,  -- ag-Grid column state (visibility, order, width)
    filters JSONB,  -- Saved filter model
    sort_model JSONB,  -- Saved sort model
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_department CHECK (
        department IS NULL OR department IN ('sales', 'logistics', 'accounting', 'management')
    ),
    CONSTRAINT system_presets_no_org CHECK (
        NOT (preset_type = 'system' AND organization_id IS NOT NULL)
    ),
    CONSTRAINT org_personal_require_org CHECK (
        NOT (preset_type IN ('org', 'personal') AND organization_id IS NULL)
    ),
    CONSTRAINT personal_requires_creator CHECK (
        NOT (preset_type = 'personal' AND created_by IS NULL)
    )
);

-- Indexes
CREATE INDEX idx_list_presets_org ON list_presets(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_list_presets_type ON list_presets(preset_type);
CREATE INDEX idx_list_presets_department ON list_presets(department) WHERE department IS NOT NULL;
CREATE INDEX idx_list_presets_creator ON list_presets(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX idx_list_presets_default ON list_presets(organization_id, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE list_presets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- SELECT: Users can view:
-- 1. System presets (organization_id IS NULL)
-- 2. Org presets for their organization
-- 3. Their own personal presets
CREATE POLICY "Users can view applicable presets"
    ON list_presets FOR SELECT
    USING (
        -- System presets visible to all authenticated users
        organization_id IS NULL
        OR
        -- Org presets visible to org members
        (preset_type = 'org' AND organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        ))
        OR
        -- Personal presets visible only to creator
        (preset_type = 'personal' AND created_by = auth.uid())
    );

-- INSERT: Users can create personal presets, admins can create org presets
CREATE POLICY "Users can create presets"
    ON list_presets FOR INSERT
    WITH CHECK (
        -- Personal presets: any org member
        (preset_type = 'personal' AND created_by = auth.uid() AND organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        ))
        OR
        -- Org presets: admins/owners only
        (preset_type = 'org' AND organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        ))
        -- System presets can only be created via migrations (service role)
    );

-- UPDATE: Users can update their own personal presets, admins can update org presets
CREATE POLICY "Users can update own presets"
    ON list_presets FOR UPDATE
    USING (
        -- Personal presets: only creator
        (preset_type = 'personal' AND created_by = auth.uid())
        OR
        -- Org presets: admins/owners only
        (preset_type = 'org' AND organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        ))
        -- System presets cannot be updated via API
    );

-- DELETE: Users can delete their own personal presets, admins can delete org presets
CREATE POLICY "Users can delete own presets"
    ON list_presets FOR DELETE
    USING (
        -- Personal presets: only creator
        (preset_type = 'personal' AND created_by = auth.uid())
        OR
        -- Org presets: admins/owners only
        (preset_type = 'org' AND organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        ))
        -- System presets cannot be deleted via API
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_list_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER list_presets_updated_at
    BEFORE UPDATE ON list_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_list_presets_updated_at();

