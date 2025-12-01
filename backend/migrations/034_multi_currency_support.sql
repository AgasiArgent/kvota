-- backend/migrations/034_multi_currency_support.sql
-- Multi-Currency Input & Quote Versioning Support
-- Created: 2025-11-25

-- ============================================================
-- PART 1: Organization Exchange Rates (Admin Override)
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL DEFAULT 'USD',
    rate DECIMAL(12, 6) NOT NULL CHECK (rate > 0),
    source TEXT NOT NULL DEFAULT 'manual',
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_org_currency_pair
        UNIQUE(organization_id, from_currency, to_currency),
    CONSTRAINT valid_from_currency
        CHECK (from_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY')),
    CONSTRAINT valid_to_currency
        CHECK (to_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY'))
);

-- Index for fast lookups
CREATE INDEX idx_org_exchange_rates_org_id
    ON organization_exchange_rates(organization_id);

-- RLS
ALTER TABLE organization_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_rates" ON organization_exchange_rates
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "admins_can_manage_rates" ON organization_exchange_rates
FOR ALL USING (
    organization_id IN (
        SELECT om.organization_id FROM organization_members om
        JOIN roles r ON om.role_id = r.id
        WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND (om.is_owner = true OR r.slug IN ('admin'))
    )
);

-- ============================================================
-- PART 2: Add exchange rate toggle to calculation_settings
-- ============================================================

ALTER TABLE calculation_settings
ADD COLUMN IF NOT EXISTS use_manual_exchange_rates BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS default_input_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (default_input_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY'));

-- ============================================================
-- PART 3: Quote Versions Table
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'confirmed', 'rejected', 'archived')),

    -- Complete snapshots
    quote_variables JSONB NOT NULL,
    products_snapshot JSONB NOT NULL,

    -- Exchange rates at calculation time
    exchange_rates_used JSONB NOT NULL,
    rates_source TEXT NOT NULL CHECK (rates_source IN ('cbr', 'manual', 'mixed')),
    rates_fetched_at TIMESTAMPTZ,

    -- Calculation results
    calculation_results JSONB NOT NULL,
    total_usd DECIMAL(15, 2) NOT NULL,
    total_quote_currency DECIMAL(15, 2) NOT NULL,

    -- Audit
    change_reason TEXT,
    parent_version_id UUID REFERENCES quote_versions(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_quote_version UNIQUE(quote_id, version_number)
);

-- Indexes
CREATE INDEX idx_quote_versions_quote_id ON quote_versions(quote_id);
CREATE INDEX idx_quote_versions_status ON quote_versions(status);
CREATE INDEX idx_quote_versions_created_at ON quote_versions(created_at DESC);

-- RLS
ALTER TABLE quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_org_versions" ON quote_versions
FOR SELECT USING (
    quote_id IN (
        SELECT id FROM quotes WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
);

CREATE POLICY "users_can_insert_versions" ON quote_versions
FOR INSERT WITH CHECK (
    quote_id IN (
        SELECT id FROM quotes WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
);

-- ============================================================
-- PART 4: Add version tracking to quotes table
-- ============================================================

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES quote_versions(id),
ADD COLUMN IF NOT EXISTS total_usd DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS total_quote_currency DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS version_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- PART 5: Helper function for current organization
-- ============================================================

CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
