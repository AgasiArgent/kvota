-- ============================================================================
-- Migration 040: Backfill usd_to_quote_rate for existing quotes
-- Date: 2025-12-04
--
-- Purpose: Fix quotes where usd_to_quote_rate was NULL due to currency_of_quote
-- being explicitly set to NULL in the request (dict.get returns None, not default)
--
-- CURRENCY TRUTH (corrected 2025-12-13):
-- The calculation engine works in QUOTE CURRENCY (not USD!). Values stored in
-- total_amount_quote are in quote currency. USD values (total_usd) are derived
-- for analytics. The usd_to_quote_rate records the exchange rate at calculation
-- time for audit trail purposes.
--
-- For historical quotes, we'll use current CBR rates as a reasonable approximation.
-- This is acceptable because:
-- 1. Most quotes are recent (within days/weeks)
-- 2. The rate is primarily used for display purposes
-- 3. Recalculating would change stored values
-- ============================================================================

-- Get the latest exchange rates for common currencies
-- Rate interpretation: 1 USD = X currency (e.g., 1 USD = 0.92 EUR)
WITH latest_rates AS (
    SELECT DISTINCT ON (from_currency)
        from_currency,
        -- For USD->currency rate, we need inverse of currency->RUB rates
        -- e.g., if EUR->RUB = 109.5 and USD->RUB = 103.7, then USD->EUR = 103.7/109.5 = 0.947
        CASE
            WHEN from_currency = 'USD' THEN 1.0
            ELSE (
                SELECT r2.rate / er.rate
                FROM exchange_rates r2
                WHERE r2.from_currency = 'USD'
                  AND r2.to_currency = 'RUB'
                ORDER BY r2.fetched_at DESC
                LIMIT 1
            )
        END as usd_to_currency_rate
    FROM exchange_rates er
    WHERE to_currency = 'RUB'
    ORDER BY from_currency, fetched_at DESC
)
UPDATE quotes q
SET usd_to_quote_rate = COALESCE(lr.usd_to_currency_rate, 1.0)
FROM latest_rates lr
WHERE q.currency = lr.from_currency
  AND q.usd_to_quote_rate IS NULL
  AND q.deleted_at IS NULL;

-- Set rate to 1.0 for any remaining quotes (USD or unknown currency)
UPDATE quotes
SET usd_to_quote_rate = 1.0
WHERE usd_to_quote_rate IS NULL
  AND deleted_at IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM quotes
    WHERE usd_to_quote_rate IS NOT NULL
      AND deleted_at IS NULL;
    RAISE NOTICE 'Migration 040 completed: % quotes now have usd_to_quote_rate set', updated_count;
END $$;
