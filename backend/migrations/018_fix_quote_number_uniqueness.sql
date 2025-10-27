-- Migration 018: Fix Quote Number Uniqueness for Multi-Tenant System
-- Date: 2025-10-27
-- Purpose: Change quote_number from globally unique to unique per organization
--
-- Problem: Current UNIQUE constraint on quote_number alone prevents different
-- organizations from having the same quote number (e.g., КП25-0001)
--
-- Solution: Use composite unique constraint (organization_id, quote_number)
-- allowing each organization to have independent sequential numbering
--
-- Impact: Non-destructive - no data loss, just constraint modification

-- 1. Drop the old global uniqueness constraint
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_quote_number_key;

-- 2. Add new composite unique constraint for per-organization uniqueness
ALTER TABLE quotes
ADD CONSTRAINT quotes_unique_number_per_org
UNIQUE (organization_id, quote_number);

-- 3. Add helpful comment
COMMENT ON CONSTRAINT quotes_unique_number_per_org ON quotes IS
'Ensures quote numbers are unique within each organization, allowing different organizations to use the same quote numbers independently (e.g., both Org A and Org B can have КП25-0001)';

-- Verification query (run after migration):
-- SELECT organization_id, quote_number, COUNT(*)
-- FROM quotes
-- GROUP BY organization_id, quote_number
-- HAVING COUNT(*) > 1;
-- (Should return 0 rows - no duplicates within same organization)
