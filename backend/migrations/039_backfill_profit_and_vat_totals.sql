-- ============================================================================
-- Migration 039: Backfill total_profit_usd and total_with_vat_quote from calculation results
-- Date: 2025-12-04
--
-- Purpose: Fix quotes where profit and VAT totals weren't saved during calculation
-- The calculation results exist in quote_calculation_results, but quotes table wasn't updated
-- ============================================================================

-- Backfill total_profit_usd from sum of profit in phase_results
-- Backfill total_with_vat_quote from sum of sales_price_total_with_vat (in USD, needs conversion)
WITH calculated_totals AS (
    SELECT
        qcr.quote_id,
        SUM((qcr.phase_results->>'profit')::decimal) as sum_profit,
        SUM((qcr.phase_results->>'sales_price_total_with_vat')::decimal) as sum_sales_with_vat
    FROM quote_calculation_results qcr
    GROUP BY qcr.quote_id
)
UPDATE quotes q
SET
    total_profit_usd = ct.sum_profit,
    -- total_with_vat_quote needs exchange rate conversion (USD * rate)
    -- Use usd_to_quote_rate if available, otherwise leave as USD (rate=1)
    total_with_vat_quote = ct.sum_sales_with_vat * COALESCE(q.usd_to_quote_rate, 1)
FROM calculated_totals ct
WHERE q.id = ct.quote_id
  AND q.deleted_at IS NULL
  AND (q.total_profit_usd IS NULL OR q.total_profit_usd = 0);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Migration 039 completed: Backfilled % quotes with profit and VAT totals', updated_count;
END $$;
