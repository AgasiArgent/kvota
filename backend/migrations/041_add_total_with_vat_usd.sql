-- ============================================================================
-- Migration 041: Add total_with_vat_usd column to quotes table
-- Date: 2025-12-04
--
-- Purpose: Store total with VAT in USD for frontend display
-- Currently we have:
--   - total_usd = sales_price_total_no_vat (AK16) - WITHOUT VAT
--   - total_with_vat_quote = AL16 * rate - WITH VAT in quote currency
--
-- Adding:
--   - total_with_vat_usd = sum of AL16 (sales_price_total_with_vat) in USD
-- ============================================================================

-- Add total_with_vat_usd column
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS total_with_vat_usd DECIMAL(15, 2);

COMMENT ON COLUMN quotes.total_with_vat_usd IS 'Total amount with VAT in USD (sum of AL16 across products)';

-- Backfill from calculation results
WITH calculated_totals AS (
    SELECT
        qcr.quote_id,
        SUM((qcr.phase_results->>'sales_price_total_with_vat')::decimal) as sum_with_vat
    FROM quote_calculation_results qcr
    GROUP BY qcr.quote_id
)
UPDATE quotes q
SET total_with_vat_usd = ct.sum_with_vat
FROM calculated_totals ct
WHERE q.id = ct.quote_id
  AND q.deleted_at IS NULL
  AND q.total_with_vat_usd IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM quotes
    WHERE total_with_vat_usd IS NOT NULL
      AND deleted_at IS NULL;
    RAISE NOTICE 'Migration 041 completed: % quotes now have total_with_vat_usd set', updated_count;
END $$;
