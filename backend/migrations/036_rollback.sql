-- ============================================================================
-- Rollback Migration 036: Restore quotes table to previous state
-- ============================================================================

-- Remove new columns
ALTER TABLE quotes
DROP COLUMN IF EXISTS total_profit_usd,
DROP COLUMN IF EXISTS total_vat_on_import_usd,
DROP COLUMN IF EXISTS total_vat_payable_usd;

-- Restore removed columns
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) DEFAULT 0;

DO $$
BEGIN
  RAISE NOTICE 'Rollback 036 completed: Restored quotes table';
END $$;
