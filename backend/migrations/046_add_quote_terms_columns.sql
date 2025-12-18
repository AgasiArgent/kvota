-- Migration 046: Add payment_terms and delivery_days columns to quotes
-- Date: 2025-12-14
-- Description: Add columns required for specification (спецификация) export
--   - payment_terms: Payment terms description (e.g., "30 дней с момента поставки")
--   - delivery_days: Delivery time in days
--   - delivery_terms: Delivery terms description (e.g., "DAP Москва")

-- ============================================================================
-- 1. ADD COLUMNS TO QUOTES TABLE
-- ============================================================================

-- Payment terms (text description)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms TEXT;
COMMENT ON COLUMN quotes.payment_terms IS 'Payment terms text (e.g., "30% предоплата, 70% по факту поставки")';

-- Delivery days (integer)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_days INTEGER;
COMMENT ON COLUMN quotes.delivery_days IS 'Delivery time in days';

-- Delivery terms (Incoterms)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_terms TEXT;
COMMENT ON COLUMN quotes.delivery_terms IS 'Delivery terms (Incoterms) e.g., "DAP Москва"';

-- ============================================================================
-- 2. SET DEFAULT VALUES FOR EXISTING QUOTES
-- ============================================================================

-- Update existing quotes with default values where NULL
UPDATE quotes
SET
    payment_terms = '30% предоплата, 70% по факту поставки',
    delivery_days = 45,
    delivery_terms = 'DAP Москва'
WHERE payment_terms IS NULL
   OR delivery_days IS NULL
   OR delivery_terms IS NULL;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- To rollback this migration:
-- ALTER TABLE quotes DROP COLUMN IF EXISTS payment_terms;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS delivery_days;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS delivery_terms;
