-- Migration 045: Specification Export Support
-- Date: 2025-12-14
-- Description: Add tables and columns for specification (спецификация) export
--   - New customer_contracts table for tracking supply contracts
--   - New columns on customers for signatory and warehouse info
--   - New columns on organizations for business info and signatory

-- ============================================================================
-- 1. CREATE CUSTOMER_CONTRACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Contract identification
    contract_number TEXT NOT NULL,
    contract_date DATE NOT NULL,

    -- Status management
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),

    -- Specification counter (increments with each spec export)
    next_specification_number INTEGER NOT NULL DEFAULT 1,

    -- Additional info
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_contracts_organization_id ON customer_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_customer_id ON customer_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contracts_status ON customer_contracts(status);

-- Unique constraint: no duplicate contract numbers within same org
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_contracts_org_number
ON customer_contracts(organization_id, contract_number);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_customer_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_contracts_updated_at ON customer_contracts;
CREATE TRIGGER update_customer_contracts_updated_at
    BEFORE UPDATE ON customer_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_contracts_updated_at();

-- ============================================================================
-- 2. RLS POLICIES FOR CUSTOMER_CONTRACTS
-- ============================================================================

ALTER TABLE customer_contracts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view contracts in their organization
DROP POLICY IF EXISTS "Users can view contracts in their organization" ON customer_contracts;
CREATE POLICY "Users can view contracts in their organization"
ON customer_contracts FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Policy: Users can create contracts in their organization
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON customer_contracts;
CREATE POLICY "Users can create contracts in their organization"
ON customer_contracts FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Policy: Users can update contracts in their organization
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON customer_contracts;
CREATE POLICY "Users can update contracts in their organization"
ON customer_contracts FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Policy: Users can delete contracts in their organization
DROP POLICY IF EXISTS "Users can delete contracts in their organization" ON customer_contracts;
CREATE POLICY "Users can delete contracts in their organization"
ON customer_contracts FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- ============================================================================
-- 3. ALTER CUSTOMERS TABLE - ADD SIGNATORY AND WAREHOUSE COLUMNS
-- ============================================================================

-- Signatory information (default: General Director)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS general_director_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS general_director_position TEXT DEFAULT 'Генеральный директор';

-- Warehouse addresses (JSONB array of {name, address} objects)
-- Example: [{"name": "Основной склад", "address": "г. Москва, ул. Ленина, д. 1"}]
ALTER TABLE customers ADD COLUMN IF NOT EXISTS warehouse_addresses JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN customers.general_director_name IS 'Name of the general director (default signatory)';
COMMENT ON COLUMN customers.general_director_position IS 'Position of the signatory (default: Генеральный директор)';
COMMENT ON COLUMN customers.warehouse_addresses IS 'JSON array of warehouse addresses: [{name, address}]';

-- ============================================================================
-- 4. ALTER ORGANIZATIONS TABLE - ADD BUSINESS INFO AND SIGNATORY
-- ============================================================================

-- Russian business registration info
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS inn VARCHAR(12);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS kpp VARCHAR(9);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ogrn VARCHAR(15);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_address TEXT;

-- Signatory information
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS general_director_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS general_director_position TEXT DEFAULT 'Генеральный директор';

COMMENT ON COLUMN organizations.inn IS 'ИНН - Tax Identification Number';
COMMENT ON COLUMN organizations.kpp IS 'КПП - Tax Registration Reason Code';
COMMENT ON COLUMN organizations.ogrn IS 'ОГРН - Primary State Registration Number';
COMMENT ON COLUMN organizations.registration_address IS 'Legal registration address';
COMMENT ON COLUMN organizations.general_director_name IS 'Name of the general director (signatory)';
COMMENT ON COLUMN organizations.general_director_position IS 'Position of the signatory';

-- ============================================================================
-- 5. CREATE SPECIFICATION_EXPORTS TABLE (for tracking exported specs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS specification_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES customer_contracts(id) ON DELETE CASCADE,

    -- Specification details
    specification_number INTEGER NOT NULL,
    specification_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Snapshot of data at export time (for audit)
    export_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_specification_exports_organization_id ON specification_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_specification_exports_quote_id ON specification_exports(quote_id);
CREATE INDEX IF NOT EXISTS idx_specification_exports_contract_id ON specification_exports(contract_id);

-- RLS for specification_exports
ALTER TABLE specification_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view specification exports in their organization" ON specification_exports;
CREATE POLICY "Users can view specification exports in their organization"
ON specification_exports FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

DROP POLICY IF EXISTS "Users can create specification exports in their organization" ON specification_exports;
CREATE POLICY "Users can create specification exports in their organization"
ON specification_exports FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE customer_contracts IS 'Supply contracts with customers for specification exports';
COMMENT ON TABLE specification_exports IS 'Audit log of exported specifications';
