-- ============================================================================
-- Migration 038: Backfill total_usd from total_amount
-- Date: 2025-12-04
--
-- Purpose: Populate total_usd column for existing quotes
-- The total_usd column was added in migration 034 but never populated.
--
-- NOTE (corrected 2025-12-13): The calculation engine works in QUOTE CURRENCY,
-- not USD. However, for historical quotes before dual-currency support, total_amount
-- may have contained USD values (legacy behavior). This migration copies those values
-- as a best-effort backfill. New quotes store proper values in total_amount_quote
-- and total_usd separately.
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
