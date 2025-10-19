-- Migration: Create Customers Table (Simplified)
-- Description: Creates customers table with Russian business fields (INN, KPP, OGRN) and multi-tenant support
-- Date: 2025-10-17

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(100),

    -- Address Information
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Russia',
    postal_code VARCHAR(10),

    -- Russian Business Information
    inn VARCHAR(12), -- ИНН: 10 digits for organizations, 12 for individuals
    kpp VARCHAR(9),  -- КПП: 9 digits for organizations
    ogrn VARCHAR(15), -- ОГРН: 13 digits for organizations, 15 for entrepreneurs
    company_type VARCHAR(50) DEFAULT 'organization', -- organization, individual_entrepreneur, individual, government
    industry VARCHAR(100),

    -- Financial Information
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30, -- Payment terms in days

    -- Status and Metadata
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_inn ON customers(inn) WHERE inn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Create unique constraint on INN per organization (allow null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_inn ON customers(organization_id, inn) WHERE inn IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers (simplified - all active organization members have access)

-- Policy: Users can view customers in their organization
DROP POLICY IF EXISTS "Users can view customers in their organization" ON customers;
CREATE POLICY "Users can view customers in their organization"
    ON customers
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Active organization members can create customers
DROP POLICY IF EXISTS "Users can create customers in their organization" ON customers;
CREATE POLICY "Users can create customers in their organization"
    ON customers
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Active organization members can update customers
DROP POLICY IF EXISTS "Users can update customers in their organization" ON customers;
CREATE POLICY "Users can update customers in their organization"
    ON customers
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Active organization members can delete customers
DROP POLICY IF EXISTS "Users can delete customers in their organization" ON customers;
CREATE POLICY "Users can delete customers in their organization"
    ON customers
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customers_updated_at ON customers;
CREATE TRIGGER trigger_update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO authenticated;

-- Comment on table
COMMENT ON TABLE customers IS 'Customer records with Russian business validation and multi-tenant support';
COMMENT ON COLUMN customers.inn IS 'ИНН - Tax identification number (10 or 12 digits)';
COMMENT ON COLUMN customers.kpp IS 'КПП - Tax registration reason code (9 digits)';
COMMENT ON COLUMN customers.ogrn IS 'ОГРН/ОГРНИП - Primary state registration number (13 or 15 digits)';
