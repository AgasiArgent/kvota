-- Migration 024: Add Financial Approval Comment Fields
-- Date: 2025-11-20
-- Purpose: Store financial manager comments and review timestamps in quotes table

-- Add comment fields to quotes table for financial approval workflow
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS last_financial_comment TEXT,
  ADD COLUMN IF NOT EXISTS last_sendback_reason TEXT,
  ADD COLUMN IF NOT EXISTS financial_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS financial_reviewed_by UUID REFERENCES auth.users(id);

-- Create index for filtering quotes by financial review status
CREATE INDEX IF NOT EXISTS idx_quotes_financial_reviewed
  ON quotes(financial_reviewed_at, organization_id)
  WHERE financial_reviewed_at IS NOT NULL;

-- Create index for finding quotes reviewed by specific user
CREATE INDEX IF NOT EXISTS idx_quotes_financial_reviewer
  ON quotes(financial_reviewed_by, organization_id)
  WHERE financial_reviewed_by IS NOT NULL;

-- Comments
COMMENT ON COLUMN quotes.last_financial_comment IS 'Latest comment from financial manager (approval or general feedback)';
COMMENT ON COLUMN quotes.last_sendback_reason IS 'Reason provided when quote was sent back for corrections';
COMMENT ON COLUMN quotes.financial_reviewed_at IS 'Timestamp of last financial review';
COMMENT ON COLUMN quotes.financial_reviewed_by IS 'User ID of financial manager who performed last review';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback this migration:
/*
DROP INDEX IF EXISTS idx_quotes_financial_reviewed;
DROP INDEX IF EXISTS idx_quotes_financial_reviewer;

ALTER TABLE quotes
  DROP COLUMN IF EXISTS last_financial_comment,
  DROP COLUMN IF EXISTS last_sendback_reason,
  DROP COLUMN IF EXISTS financial_reviewed_at,
  DROP COLUMN IF EXISTS financial_reviewed_by;
*/
