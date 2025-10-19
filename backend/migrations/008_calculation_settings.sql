-- Migration 008: Calculation Settings (Admin-Only Variables)
-- Created: 2025-10-18
-- Purpose: Store organization-wide admin-controlled calculation defaults

-- ============================================================================
-- Table: calculation_settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS calculation_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Admin-only variables (3 variables)
    rate_forex_risk DECIMAL(5,2) NOT NULL DEFAULT 3.0,  -- % (e.g., 3.0 for 3%)
    rate_fin_comm DECIMAL(5,2) NOT NULL DEFAULT 2.0,     -- % (e.g., 2.0 for 2%)
    rate_loan_interest_daily DECIMAL(10,8) NOT NULL DEFAULT 0.00069,  -- Daily rate (e.g., 0.00069)

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),

    -- One settings record per organization
    UNIQUE(organization_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_calculation_settings_org ON calculation_settings(organization_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE calculation_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view settings in their organization
CREATE POLICY "Users can view calculation settings in their organization"
    ON calculation_settings FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
    ));

-- Policy: Only admins/owners can create settings
CREATE POLICY "Only admins can create calculation settings"
    ON calculation_settings FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.user_id = auth.uid()
            AND (om.is_owner = true OR r.slug IN ('admin', 'financial_admin'))
        )
    );

-- Policy: Only admins/owners can update settings
CREATE POLICY "Only admins can update calculation settings"
    ON calculation_settings FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.user_id = auth.uid()
            AND (om.is_owner = true OR r.slug IN ('admin', 'financial_admin'))
        )
    );

-- ============================================================================
-- Trigger: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_calculation_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calculation_settings_timestamp
    BEFORE UPDATE ON calculation_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_calculation_settings_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE calculation_settings IS 'Organization-wide admin-controlled calculation defaults';
COMMENT ON COLUMN calculation_settings.rate_forex_risk IS 'Currency exchange risk reserve percentage (default: 3%)';
COMMENT ON COLUMN calculation_settings.rate_fin_comm IS 'Financial agent commission percentage (default: 2%)';
COMMENT ON COLUMN calculation_settings.rate_loan_interest_daily IS 'Daily loan interest rate (default: 0.00069 or ~25% annual)';
