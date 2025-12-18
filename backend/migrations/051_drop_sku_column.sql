-- Migration 051: Drop sku column from quote_items
-- Created: 2025-12-18
-- Purpose: Remove duplicate sku column, use product_code instead
--
-- Background:
--   - Both sku and product_code columns exist for the same purpose (article/part number)
--   - product_code has 779 values, sku had only 2
--   - sku values have been migrated to product_code
--   - All code updated to use product_code

-- ============================================================================
-- 1. DROP SKU COLUMN
-- ============================================================================

ALTER TABLE quote_items DROP COLUMN IF EXISTS sku;

-- ============================================================================
-- NOTES
-- ============================================================================

-- Before running this migration, ensure:
-- 1. All sku values migrated to product_code (done via UPDATE query)
-- 2. All code references updated to use product_code
-- 3. Frontend types updated to use product_code
