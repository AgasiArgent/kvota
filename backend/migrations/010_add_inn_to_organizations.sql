-- ============================================================================
-- Session 8: Fix calculation_settings endpoint crash
-- Migration 010: Add INN column to organizations table
-- Date: 2025-10-19
-- ============================================================================

-- Purpose: Add INN (Individual Taxpayer Number) column to organizations table
-- This is needed for Russian business compliance and referenced by calculation_settings

-- ============================================================================
-- 1. ADD INN COLUMN TO ORGANIZATIONS TABLE
-- ============================================================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS inn TEXT;

-- ============================================================================
-- 2. ADD COMMENT FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN organizations.inn IS 'ИНН (Individual Taxpayer Number) for Russian business compliance';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration success
DO $$
BEGIN
  RAISE NOTICE 'Migration 010 completed successfully: Added INN column to organizations';
END $$;
