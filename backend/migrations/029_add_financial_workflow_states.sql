-- Migration 029: Add Financial Workflow States
-- Date: 2025-11-21
-- Purpose: Add missing workflow states for financial approval flow
-- Issue: sent_back_for_revision, rejected_by_finance, financially_approved states were missing

-- Drop the existing constraint
ALTER TABLE quotes
DROP CONSTRAINT IF EXISTS check_workflow_state;

-- Add the updated constraint with all workflow states
ALTER TABLE quotes
ADD CONSTRAINT check_workflow_state CHECK (
  workflow_state IN (
    -- Original states
    'draft',
    'awaiting_procurement',
    'awaiting_logistics_customs',
    'awaiting_sales_review',
    'awaiting_financial_approval',
    'awaiting_senior_approval',
    'approved',
    'rejected',
    -- New financial workflow states
    'sent_back_for_revision',
    'rejected_by_finance',
    'financially_approved'
  )
);

-- Comments
COMMENT ON CONSTRAINT check_workflow_state ON quotes IS
'Valid workflow states including financial approval flow states';

-- Verify the constraint was updated successfully
-- This query should return the new constraint definition
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'check_workflow_state'
AND conrelid = 'quotes'::regclass;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- To rollback to original constraint:
/*
ALTER TABLE quotes
DROP CONSTRAINT IF EXISTS check_workflow_state;

ALTER TABLE quotes
ADD CONSTRAINT check_workflow_state CHECK (
  workflow_state IN (
    'draft', 'awaiting_procurement', 'awaiting_logistics_customs',
    'awaiting_sales_review', 'awaiting_financial_approval',
    'awaiting_senior_approval', 'approved', 'rejected'
  )
);
*/