-- ============================================================================
-- Migration 037: Dual Currency Storage (USD + Quote Currency)
-- Date: 2025-12-02
--
-- Purpose: Store all monetary values in both USD (for analytics) and quote currency
--          (for client-facing documents)
--
-- CURRENCY TRUTH (verified 2025-12-13 from calculation_engine.py):
--   - Calculation engine computes in QUOTE CURRENCY (not USD!)
--   - Exchange rates fetched from CBR API, cross-rates via RUB
--   - All 13 phases output values in quote currency
--   - USD values are derived for analytics/comparison only
--
-- This migration adds:
--   1. Quote currency columns to quote_calculation_summaries
--   2. Exchange rate metadata to quote_calculation_summaries
--   3. phase_results_quote_currency JSONB to quote_calculation_results
--
-- Benefits:
--   - Historical accuracy (exchange rates change daily)
--   - Audit trail for client-facing documents
--   - Fast queries without runtime conversion
-- ============================================================================

-- ============================================================================
-- PART 1: Add quote currency fields to quote_calculation_summaries
-- ============================================================================

-- Exchange rate metadata (for audit trail)
ALTER TABLE quote_calculation_summaries
ADD COLUMN IF NOT EXISTS quote_currency TEXT DEFAULT 'RUB',
ADD COLUMN IF NOT EXISTS usd_to_quote_rate DECIMAL(12,6),
ADD COLUMN IF NOT EXISTS exchange_rate_source TEXT DEFAULT 'cbr',
ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ;

-- Key totals in quote currency (most important for client-facing docs)
ALTER TABLE quote_calculation_summaries
ADD COLUMN IF NOT EXISTS calc_s16_total_purchase_price_quote DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_v16_total_logistics_quote DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ab16_cogs_total_quote DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ak16_final_price_total_quote DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_al16_total_with_vat_quote DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_total_brokerage_quote DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_total_logistics_and_brokerage_quote DECIMAL(15,2);

-- Add comments for documentation
COMMENT ON COLUMN quote_calculation_summaries.quote_currency IS 'Quote currency code (USD, EUR, RUB, TRY, CNY)';
COMMENT ON COLUMN quote_calculation_summaries.usd_to_quote_rate IS 'Exchange rate used: 1 USD = X quote_currency';
COMMENT ON COLUMN quote_calculation_summaries.exchange_rate_source IS 'Rate source: cbr (Central Bank Russia), manual, or mixed';
COMMENT ON COLUMN quote_calculation_summaries.exchange_rate_timestamp IS 'When exchange rate was fetched/set';
COMMENT ON COLUMN quote_calculation_summaries.calc_s16_total_purchase_price_quote IS 'Total purchase price in quote currency';
COMMENT ON COLUMN quote_calculation_summaries.calc_ak16_final_price_total_quote IS 'Final sales price (no VAT) in quote currency';
COMMENT ON COLUMN quote_calculation_summaries.calc_al16_total_with_vat_quote IS 'Final sales price with VAT in quote currency';

-- ============================================================================
-- PART 2: Add quote currency JSONB to quote_calculation_results
-- ============================================================================

ALTER TABLE quote_calculation_results
ADD COLUMN IF NOT EXISTS phase_results_quote_currency JSONB;

COMMENT ON COLUMN quote_calculation_results.phase_results_quote_currency IS 'Per-product calculation results in quote currency (same structure as phase_results)';

-- ============================================================================
-- PART 3: Add exchange rate columns to quotes table
-- ============================================================================

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS usd_to_quote_rate DECIMAL(12,6),
ADD COLUMN IF NOT EXISTS exchange_rate_source TEXT DEFAULT 'cbr',
ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ;

COMMENT ON COLUMN quotes.usd_to_quote_rate IS 'Exchange rate used: 1 USD = X quote_currency';
COMMENT ON COLUMN quotes.exchange_rate_source IS 'Rate source: cbr, manual, or mixed';
COMMENT ON COLUMN quotes.exchange_rate_timestamp IS 'When exchange rate was fetched';

-- ============================================================================
-- PART 4: Add quote currency totals to quotes table
-- ============================================================================

-- These complement existing total_usd, total_profit_usd, etc.
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS total_amount_quote DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS total_with_vat_quote DECIMAL(15,2);

COMMENT ON COLUMN quotes.total_amount_quote IS 'Total amount (no VAT) in quote currency';
COMMENT ON COLUMN quotes.total_with_vat_quote IS 'Total amount with VAT in quote currency';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 037 completed: Dual currency storage (USD + Quote Currency)';
END $$;
