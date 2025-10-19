-- ============================================================================
-- Session 8: ag-Grid Integration for Quote Creation Page
-- Migration 009: Add SKU and Brand columns to quote_items table
-- Date: 2025-10-19
-- ============================================================================

-- Purpose: Add Артикул (SKU) and Бренд (Brand) columns to quote_items
-- for product identification and analytics

-- ============================================================================
-- 1. ADD COLUMNS TO QUOTE_ITEMS TABLE
-- ============================================================================

-- Add SKU (Артикул) column
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS sku TEXT;

-- Add Brand (Бренд) column
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS brand TEXT;

-- ============================================================================
-- 2. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN quote_items.sku IS 'Product SKU/Article number (Артикул) for identification and analytics';
COMMENT ON COLUMN quote_items.brand IS 'Product brand name (Бренд) for categorization and analytics';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration success
DO $$
BEGIN
  RAISE NOTICE 'Migration 009 completed successfully: Added SKU and Brand columns to quote_items';
END $$;
