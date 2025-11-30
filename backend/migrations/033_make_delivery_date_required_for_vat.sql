-- Migration: Make delivery_date required for 2026 VAT calculation
-- Date: 2025-11-24
-- Author: Claude (VAT rate change: 20% → 22% from 2026)
-- Reason: Russian government mandate - VAT increases to 22% starting January 1, 2026

-- ============================================================================
-- STEP 1: Update existing NULL delivery_dates
-- ============================================================================

-- Set default: quote_date + 30 days (standard Russian B2B delivery timeframe)
UPDATE quotes
SET delivery_date = quote_date + INTERVAL '30 days'
WHERE delivery_date IS NULL;

-- Verify: Check how many rows were updated
-- SELECT COUNT(*) FROM quotes WHERE delivery_date IS NULL;
-- Should return 0

-- ============================================================================
-- STEP 2: Make column NOT NULL
-- ============================================================================

ALTER TABLE quotes
ALTER COLUMN delivery_date SET NOT NULL;

-- ============================================================================
-- STEP 3: Add business rule constraints
-- ============================================================================

-- Constraint: Delivery date must be >= quote date (logical business rule)
ALTER TABLE quotes
ADD CONSTRAINT check_delivery_after_quote_date
CHECK (delivery_date >= quote_date);

-- ============================================================================
-- STEP 4: Update column documentation
-- ============================================================================

COMMENT ON COLUMN quotes.delivery_date IS
'Expected delivery date (REQUIRED for VAT calculation). VAT rate logic: 20% before 2026, 22% from Jan 1 2026 onwards. Cannot be before quote_date.';

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- 1. Check no NULL values remain
-- SELECT COUNT(*) FROM quotes WHERE delivery_date IS NULL;
-- Expected: 0

-- 2. Check constraint works (should fail)
-- INSERT INTO quotes (delivery_date, quote_date, ...) VALUES ('2025-01-01', '2025-12-31', ...);
-- Expected: ERROR - violates check constraint

-- 3. Sample delivery dates for 2026+ VAT rate testing
-- SELECT id, quote_date, delivery_date,
--        CASE WHEN EXTRACT(YEAR FROM delivery_date) >= 2026 THEN '22%' ELSE '20%' END as vat_rate
-- FROM quotes
-- ORDER BY delivery_date DESC
-- LIMIT 10;
