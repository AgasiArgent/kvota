-- ============================================================================
-- Migration 036: Update quotes table totals
-- Date: 2025-11-30
--
-- Changes:
-- - Remove unused columns: discount_percentage, discount_amount
-- - Add: total_profit_usd (sum of AF16 markup_amount across products)
-- - Add: total_vat_on_import_usd (sum of AO16 across products)
-- - Add: total_vat_payable_usd (sum of AP16 across products)
-- ============================================================================

-- Remove unused columns
ALTER TABLE quotes
DROP COLUMN IF EXISTS discount_percentage,
DROP COLUMN IF EXISTS discount_amount;

-- Add new USD totals columns
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS total_profit_usd DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_vat_on_import_usd DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_vat_payable_usd DECIMAL(15,2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN quotes.total_profit_usd IS 'Sum of markup_amount (AF16) across all products in USD';
COMMENT ON COLUMN quotes.total_vat_on_import_usd IS 'Sum of vat_on_import (AO16) across all products in USD';
COMMENT ON COLUMN quotes.total_vat_payable_usd IS 'Sum of vat_payable (AP16) across all products in USD';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 036 completed: Updated quotes table totals';
END $$;
