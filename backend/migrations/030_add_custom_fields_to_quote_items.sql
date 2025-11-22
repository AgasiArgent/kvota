-- ============================================================================
-- Migration 030: Add custom_fields column for product-level variable overrides
-- Created: 2025-11-22
-- ============================================================================
--
-- Purpose:
--   Enable two-tier variable system where users can override quote-level
--   defaults on a per-product basis. Example: Quote has 15% markup default,
--   but Product 1 can have 18% markup override.
--
-- Impact:
--   - Additive change (safe, no data loss risk)
--   - All existing quote_items get empty {} as default
--   - No breaking changes to existing code
-- ============================================================================

-- Add custom_fields JSONB column
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Add GIN index for JSONB queries (important for performance)
-- GIN indexes enable fast queries like: WHERE custom_fields @> '{"markup": 18.5}'
CREATE INDEX IF NOT EXISTS idx_quote_items_custom_fields
ON quote_items USING GIN (custom_fields);

-- Add documentation for future developers
COMMENT ON COLUMN quote_items.custom_fields IS
  'Product-level variable overrides. Example: {"markup": 18.5, "supplier_discount": 5.0, "import_tariff": 12.0}.
  Empty {} means use quote-level defaults from quote_calculation_variables.
  Overridable fields: markup, supplier_discount, import_tariff, excise_tax, util_fee, customs_code,
  currency_of_base_price, exchange_rate_base_price_to_quote.';

-- Verify migration succeeded
DO $$
DECLARE
  column_exists BOOLEAN;
  index_exists BOOLEAN;
BEGIN
  -- Check column was created
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'quote_items'
      AND column_name = 'custom_fields'
      AND data_type = 'jsonb'
  ) INTO column_exists;

  -- Check index was created
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'quote_items'
      AND indexname = 'idx_quote_items_custom_fields'
  ) INTO index_exists;

  IF NOT column_exists THEN
    RAISE EXCEPTION 'Migration failed: custom_fields column not created';
  END IF;

  IF NOT index_exists THEN
    RAISE EXCEPTION 'Migration failed: GIN index not created';
  END IF;

  RAISE NOTICE 'Migration 030 successful: custom_fields column and index created';
END $$;

-- Display migration results
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'quote_items'
  AND column_name = 'custom_fields';

-- Show count of affected rows
SELECT
  COUNT(*) as total_quote_items,
  COUNT(CASE WHEN custom_fields = '{}'::jsonb THEN 1 END) as items_with_empty_custom_fields
FROM quote_items;

-- Expected output:
-- All existing items should have custom_fields = '{}'
