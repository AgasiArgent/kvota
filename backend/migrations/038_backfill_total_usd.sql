-- ============================================================================
-- Migration 038: Backfill total_usd from total_amount
-- Date: 2025-12-04
--
-- Purpose: Populate total_usd column for existing quotes
-- The total_usd column was added in migration 034 but never populated.
-- The calculation engine stores USD totals in total_amount, so we copy that value.
-- ============================================================================

-- Backfill total_usd from total_amount for existing quotes
UPDATE quotes
SET total_usd = total_amount
WHERE total_usd IS NULL AND total_amount IS NOT NULL AND total_amount > 0;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 038 completed: Backfilled total_usd from total_amount';
END $$;
