-- Migration 011: Add soft delete support and ensure quote date fields exist
-- Created: 2025-10-23
-- Description: Adds deleted_at column for soft deletes, adds quote_date column,
--              ensures valid_until has proper defaults, and updates RLS policies

-- ===========================================================================
-- 1. Add quote_date column
-- ===========================================================================

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS quote_date DATE NOT NULL DEFAULT CURRENT_DATE;

COMMENT ON COLUMN quotes.quote_date IS 'The date when the quote was created/issued';

-- ===========================================================================
-- 2. Update valid_until to have NOT NULL constraint with default
-- ===========================================================================

-- First, update existing NULL values
UPDATE quotes
SET valid_until = (created_at + INTERVAL '7 days')::date
WHERE valid_until IS NULL;

-- Now add NOT NULL constraint (if not already present)
DO $$
BEGIN
    -- Check if column is already NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes'
        AND column_name = 'valid_until'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE quotes ALTER COLUMN valid_until SET NOT NULL;
        ALTER TABLE quotes ALTER COLUMN valid_until SET DEFAULT (CURRENT_DATE + INTERVAL '7 days')::date;
    END IF;
END $$;

COMMENT ON COLUMN quotes.valid_until IS 'Quote expiration date (default: 7 days from creation)';

-- ===========================================================================
-- 3. Add deleted_at column for soft deletes
-- ===========================================================================

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN quotes.deleted_at IS 'Timestamp when quote was soft-deleted. NULL = active, NOT NULL = deleted. Quotes are auto-purged 7 days after deletion.';

-- Create index for performance (queries will filter by deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at);

-- Create index for cleanup cron job (find quotes to purge)
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at_not_null ON quotes(deleted_at) WHERE deleted_at IS NOT NULL;

-- ===========================================================================
-- 4. Update existing quotes with quote_date based on created_at
-- ===========================================================================

-- Set quote_date = created_at::date for all existing quotes
UPDATE quotes
SET quote_date = created_at::date
WHERE quote_date = CURRENT_DATE; -- Only update newly added rows with default value

-- ===========================================================================
-- 5. Update RLS policies to filter out soft-deleted quotes
-- ===========================================================================

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view quotes from their organization" ON quotes;
DROP POLICY IF EXISTS "Users can insert quotes in their organization" ON quotes;
DROP POLICY IF EXISTS "Users can update quotes in their organization" ON quotes;
DROP POLICY IF EXISTS "Users can delete quotes in their organization" ON quotes;

-- Recreate policies with soft delete filter
CREATE POLICY "Users can view quotes from their organization"
ON quotes FOR SELECT
USING (
    organization_id = current_organization_id()
    AND deleted_at IS NULL  -- Hide soft-deleted quotes
);

CREATE POLICY "Users can insert quotes in their organization"
ON quotes FOR INSERT
WITH CHECK (
    organization_id = current_organization_id()
);

CREATE POLICY "Users can update quotes in their organization"
ON quotes FOR UPDATE
USING (
    organization_id = current_organization_id()
    AND deleted_at IS NULL  -- Can't update deleted quotes
)
WITH CHECK (
    organization_id = current_organization_id()
);

CREATE POLICY "Users can delete quotes in their organization"
ON quotes FOR DELETE
USING (
    organization_id = current_organization_id()
    -- Note: Actual deletion only happens via cron job after 7 days
    -- Application should set deleted_at via UPDATE, not DELETE
);

-- ===========================================================================
-- 6. Add helper function to soft delete quotes
-- ===========================================================================

CREATE OR REPLACE FUNCTION soft_delete_quote(quote_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE quotes
    SET deleted_at = NOW()
    WHERE id = quote_id
    AND organization_id = current_organization_id()
    AND deleted_at IS NULL;

    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION soft_delete_quote IS 'Soft delete a quote by setting deleted_at timestamp';

-- ===========================================================================
-- 7. Add helper function to restore soft-deleted quotes
-- ===========================================================================

CREATE OR REPLACE FUNCTION restore_quote(quote_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE quotes
    SET deleted_at = NULL
    WHERE id = quote_id
    AND organization_id = current_organization_id()
    AND deleted_at IS NOT NULL;

    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION restore_quote IS 'Restore a soft-deleted quote by clearing deleted_at timestamp';

-- ===========================================================================
-- 8. Documentation for scheduled cleanup
-- ===========================================================================

-- NOTE: A cron job should be scheduled to permanently delete quotes
-- that have been soft-deleted for more than 7 days:
--
-- DELETE FROM quotes
-- WHERE deleted_at IS NOT NULL
-- AND deleted_at < NOW() - INTERVAL '7 days';
--
-- This should run daily via Supabase Edge Functions or pg_cron
--
-- Example pg_cron schedule (if available):
-- SELECT cron.schedule(
--     'delete-old-quotes',
--     '0 2 * * *',  -- Run at 2 AM daily
--     $$DELETE FROM quotes WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'$$
-- );

-- ===========================================================================
-- Rollback Instructions (commented)
-- ===========================================================================

-- To rollback this migration:
--
-- DROP FUNCTION IF EXISTS soft_delete_quote(UUID);
-- DROP FUNCTION IF EXISTS restore_quote(UUID);
-- DROP INDEX IF EXISTS idx_quotes_deleted_at;
-- DROP INDEX IF EXISTS idx_quotes_deleted_at_not_null;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS quote_date;
-- ALTER TABLE quotes ALTER COLUMN valid_until DROP NOT NULL;
-- ALTER TABLE quotes ALTER COLUMN valid_until DROP DEFAULT;
--
-- -- Recreate original RLS policies without deleted_at filter
-- -- (see migration 007_quotes_calculation_schema.sql for original policies)
