-- Migration 031: Add Approval Comment Field
-- Date: 2025-11-23
-- Purpose: Store financial manager approval comments in quotes table

-- Add approval comment field to quotes table
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS last_approval_comment TEXT;

-- Comment
COMMENT ON COLUMN quotes.last_approval_comment IS 'Comment from financial manager when quote was approved';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback this migration:
/*
ALTER TABLE quotes
  DROP COLUMN IF EXISTS last_approval_comment;
*/
