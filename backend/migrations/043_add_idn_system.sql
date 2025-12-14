-- ============================================================================
-- Migration 043: Add IDN System for Quotes and Products
-- Date: 2025-12-14
-- Description: Implements organization-specific identification numbers (IDN)
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATIONS TABLE - Add supplier_code and idn_counters
-- ============================================================================

-- Add supplier_code column (3-letter uppercase code)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(3);

-- Add idn_counters for year-based sequence tracking
-- Format: {"2024": 3200, "2025": 4525}
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS idn_counters JSONB DEFAULT '{}';

-- Add unique constraint on supplier_code (each org has unique code)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_supplier_code
ON organizations(supplier_code)
WHERE supplier_code IS NOT NULL;

-- Comment on columns
COMMENT ON COLUMN organizations.supplier_code IS '3-letter uppercase identifier for IDN (e.g., MBR, CMT, RAR)';
COMMENT ON COLUMN organizations.idn_counters IS 'Year-based sequence counters for IDN generation: {"2025": 4525}';

-- ============================================================================
-- 2. QUOTES TABLE - Rename quote_number to idn_quote
-- ============================================================================

-- First, drop the unique constraint on quote_number
ALTER TABLE quotes
DROP CONSTRAINT IF EXISTS quotes_quote_number_key;

-- Drop the composite unique constraint from migration 018
ALTER TABLE quotes
DROP CONSTRAINT IF EXISTS quotes_unique_number_per_org;

-- Drop the index on quote_number
DROP INDEX IF EXISTS idx_quotes_number;

-- Rename the column
ALTER TABLE quotes
RENAME COLUMN quote_number TO idn_quote;

-- Create new unique index for idn_quote per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_idn_quote
ON quotes(organization_id, idn_quote)
WHERE idn_quote IS NOT NULL;

-- Add index for idn_quote lookups
CREATE INDEX IF NOT EXISTS idx_quotes_idn_quote_lookup
ON quotes(idn_quote);

-- Comment on column
COMMENT ON COLUMN quotes.idn_quote IS 'Quote IDN: SUPPLIER-INN-YEAR-SEQ (e.g., CMT-1234567890-2025-1)';

-- ============================================================================
-- 3. QUOTE ITEMS TABLE - Add idn_sku
-- ============================================================================

-- Add idn_sku column for product-level identification
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS idn_sku TEXT;

-- Create unique index for idn_sku per quote
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_items_idn_sku
ON quote_items(quote_id, idn_sku)
WHERE idn_sku IS NOT NULL;

-- Add index for idn_sku lookups
CREATE INDEX IF NOT EXISTS idx_quote_items_idn_sku_lookup
ON quote_items(idn_sku);

-- Comment on column
COMMENT ON COLUMN quote_items.idn_sku IS 'Product IDN-SKU: QUOTE_IDN-POSITION (e.g., CMT-1234567890-2025-1-1)';

-- ============================================================================
-- 4. POPULATE SUPPLIER CODES FOR KNOWN ORGANIZATIONS
-- ============================================================================

-- Update known organizations with their supplier codes
-- Note: These are the known mappings, additional orgs to be updated by admin

UPDATE organizations
SET supplier_code = 'MBR'
WHERE name ILIKE '%МАСТЕР БЭРИНГ%' OR name ILIKE '%MASTER BEARING%';

UPDATE organizations
SET supplier_code = 'CMT'
WHERE name ILIKE '%ЦМТО%' OR name ILIKE '%CMTO%';

UPDATE organizations
SET supplier_code = 'RAR'
WHERE name ILIKE '%РАД РЕСУР%' OR name ILIKE '%RAD RESUR%';

UPDATE organizations
SET supplier_code = 'GES'
WHERE name ILIKE '%GESTUS%';

UPDATE organizations
SET supplier_code = 'TEX'
WHERE name ILIKE '%TEXCEL%';

-- ============================================================================
-- 5. MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
    org_count INTEGER;
    quotes_count INTEGER;
BEGIN
    -- Check organizations columns
    SELECT COUNT(*) INTO org_count
    FROM information_schema.columns
    WHERE table_name = 'organizations'
    AND column_name IN ('supplier_code', 'idn_counters');

    IF org_count != 2 THEN
        RAISE EXCEPTION 'Organizations table missing IDN columns';
    END IF;

    -- Check quotes column renamed
    SELECT COUNT(*) INTO quotes_count
    FROM information_schema.columns
    WHERE table_name = 'quotes'
    AND column_name = 'idn_quote';

    IF quotes_count != 1 THEN
        RAISE EXCEPTION 'Quotes table missing idn_quote column';
    END IF;

    RAISE NOTICE 'Migration 043 completed successfully: IDN system added';
END $$;
