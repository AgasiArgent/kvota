-- Migration 047: Signatories and Delivery Addresses
-- Created: 2025-12-15
-- Purpose:
--   1. Add is_signatory flag to customer_contacts (mark contacts as authorized signatories)
--   2. Create customer_delivery_addresses table (proper table instead of JSONB)
--   3. Migrate existing warehouse_addresses JSONB data to new table

-- ============================================================================
-- 1. ADD SIGNATORY FIELDS TO CUSTOMER_CONTACTS
-- ============================================================================

-- Add is_signatory flag
ALTER TABLE customer_contacts
ADD COLUMN IF NOT EXISTS is_signatory BOOLEAN DEFAULT false;

-- Add signatory_position (can differ from regular position field)
ALTER TABLE customer_contacts
ADD COLUMN IF NOT EXISTS signatory_position TEXT;

-- Create partial index for efficient signatory lookups
CREATE INDEX IF NOT EXISTS idx_customer_contacts_signatory
ON customer_contacts(customer_id, is_signatory)
WHERE is_signatory = true;

-- Comments
COMMENT ON COLUMN customer_contacts.is_signatory IS 'True if this contact is an authorized signatory for contracts/documents';
COMMENT ON COLUMN customer_contacts.signatory_position IS 'Position/title used when signing documents (may differ from regular position)';

-- ============================================================================
-- 2. CREATE CUSTOMER_DELIVERY_ADDRESSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_delivery_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Address info
    address TEXT NOT NULL,
    name TEXT,  -- Optional label like "Основной склад", "Московский офис"
    is_default BOOLEAN DEFAULT false,
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_customer
ON customer_delivery_addresses(customer_id);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_org
ON customer_delivery_addresses(organization_id);

CREATE INDEX IF NOT EXISTS idx_delivery_addresses_default
ON customer_delivery_addresses(customer_id, is_default)
WHERE is_default = true;

-- Comments
COMMENT ON TABLE customer_delivery_addresses IS 'Delivery/warehouse addresses for customers';
COMMENT ON COLUMN customer_delivery_addresses.name IS 'Optional label for the address (e.g., Основной склад)';
COMMENT ON COLUMN customer_delivery_addresses.is_default IS 'Default address for this customer';

-- ============================================================================
-- 3. RLS POLICIES FOR DELIVERY ADDRESSES
-- ============================================================================

ALTER TABLE customer_delivery_addresses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view addresses in their organization
DROP POLICY IF EXISTS "Users can view delivery addresses in their organization" ON customer_delivery_addresses;
CREATE POLICY "Users can view delivery addresses in their organization"
    ON customer_delivery_addresses
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Users can create addresses in their organization
DROP POLICY IF EXISTS "Users can create delivery addresses in their organization" ON customer_delivery_addresses;
CREATE POLICY "Users can create delivery addresses in their organization"
    ON customer_delivery_addresses
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Users can update addresses in their organization
DROP POLICY IF EXISTS "Users can update delivery addresses in their organization" ON customer_delivery_addresses;
CREATE POLICY "Users can update delivery addresses in their organization"
    ON customer_delivery_addresses
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Users can delete addresses in their organization
DROP POLICY IF EXISTS "Users can delete delivery addresses in their organization" ON customer_delivery_addresses;
CREATE POLICY "Users can delete delivery addresses in their organization"
    ON customer_delivery_addresses
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- ============================================================================
-- 4. UPDATED_AT TRIGGER FOR DELIVERY ADDRESSES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_delivery_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_delivery_addresses_updated_at ON customer_delivery_addresses;
CREATE TRIGGER trigger_update_delivery_addresses_updated_at
    BEFORE UPDATE ON customer_delivery_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_addresses_updated_at();

-- ============================================================================
-- 5. MIGRATE EXISTING WAREHOUSE_ADDRESSES JSONB DATA
-- ============================================================================

-- Migrate warehouse_addresses from customers table to new delivery_addresses table
-- This is safe to run multiple times (uses INSERT with conflict handling)
INSERT INTO customer_delivery_addresses (customer_id, organization_id, address, name, is_default)
SELECT
    c.id AS customer_id,
    c.organization_id,
    COALESCE((wa->>'address')::TEXT, wa::TEXT) AS address,  -- Handle both {address: x} and plain string formats
    (wa->>'name')::TEXT AS name,
    (ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY (wa->>'name') NULLS LAST) = 1) AS is_default  -- First one is default
FROM customers c,
LATERAL jsonb_array_elements(c.warehouse_addresses) AS wa
WHERE c.warehouse_addresses IS NOT NULL
  AND c.warehouse_addresses != '[]'::jsonb
  AND jsonb_array_length(c.warehouse_addresses) > 0
  AND NOT EXISTS (
      -- Skip if already migrated
      SELECT 1 FROM customer_delivery_addresses cda
      WHERE cda.customer_id = c.id
      AND cda.address = COALESCE((wa->>'address')::TEXT, wa::TEXT)
  );

-- ============================================================================
-- 6. CREATE SIGNATORY CONTACTS FROM GENERAL DIRECTORS (BACKFILL)
-- ============================================================================

-- For existing customers with general_director_name, create signatory contact if none exists
-- This ensures all customers have at least one signatory
INSERT INTO customer_contacts (
    customer_id,
    organization_id,
    name,
    position,
    is_signatory,
    signatory_position,
    is_primary
)
SELECT
    c.id AS customer_id,
    c.organization_id,
    c.general_director_name AS name,
    COALESCE(c.general_director_position, 'Генеральный директор') AS position,
    true AS is_signatory,
    COALESCE(c.general_director_position, 'Генеральный директор') AS signatory_position,
    NOT EXISTS (
        -- Set as primary only if no other primary contact exists
        SELECT 1 FROM customer_contacts cc
        WHERE cc.customer_id = c.id AND cc.is_primary = true
    ) AS is_primary
FROM customers c
WHERE c.general_director_name IS NOT NULL
  AND c.general_director_name != ''
  AND NOT EXISTS (
      -- Skip if signatory contact already exists with same name
      SELECT 1 FROM customer_contacts cc
      WHERE cc.customer_id = c.id
      AND cc.name = c.general_director_name
      AND cc.is_signatory = true
  );

-- ============================================================================
-- 7. VALIDATION NOTES
-- ============================================================================

-- After migration:
-- 1. customer_contacts has is_signatory and signatory_position columns
-- 2. customer_delivery_addresses table exists with migrated data
-- 3. Existing warehouse_addresses JSONB data is preserved (not deleted)
-- 4. General directors are backfilled as signatory contacts
-- 5. Future deprecation: customers.warehouse_addresses can be removed in later migration

-- To verify migration:
-- SELECT COUNT(*) FROM customer_delivery_addresses;  -- Should have entries if warehouse_addresses had data
-- SELECT COUNT(*) FROM customer_contacts WHERE is_signatory = true;  -- Should include general directors
