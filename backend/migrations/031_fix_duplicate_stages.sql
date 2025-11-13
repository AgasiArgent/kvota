-- Migration 031 FIX: Remove duplicate lead stages
-- Created: 2025-11-13
-- Purpose: Fix duplicate stages created by migration 031

-- ============================================================================
-- STEP 1: Check current state
-- ============================================================================

-- Count total stages
SELECT COUNT(*) as total_stages FROM lead_stages;

-- Count unique stages (should be 6 per organization)
SELECT
    organization_id,
    COUNT(DISTINCT name) as unique_stages,
    COUNT(*) as total_stages
FROM lead_stages
GROUP BY organization_id
ORDER BY organization_id;

-- ============================================================================
-- STEP 2: Remove duplicates (keep only oldest record)
-- ============================================================================

-- Delete duplicate stages, keeping only the first one created
DELETE FROM lead_stages
WHERE id NOT IN (
    SELECT DISTINCT ON (organization_id, name) id
    FROM lead_stages
    ORDER BY organization_id, name, created_at ASC
);

-- ============================================================================
-- STEP 3: Verify fix
-- ============================================================================

-- Check that duplicates are gone
SELECT
    organization_id,
    name,
    COUNT(*) as count
FROM lead_stages
GROUP BY organization_id, name
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check total stages per organization
SELECT
    organization_id,
    COUNT(*) as stage_count
FROM lead_stages
GROUP BY organization_id
ORDER BY organization_id;
-- Should show 6 stages per organization

-- ============================================================================
-- STEP 4: Verify constraints are working
-- ============================================================================

-- Try to insert duplicate (should fail)
-- DO $$
-- DECLARE
--     test_org_id UUID;
-- BEGIN
--     SELECT id INTO test_org_id FROM organizations LIMIT 1;
--
--     INSERT INTO lead_stages (organization_id, name, order_index)
--     VALUES (test_org_id, 'Новый', 999);
--
--     RAISE EXCEPTION 'CONSTRAINT FAILED: Duplicate insert succeeded when it should have failed!';
-- EXCEPTION
--     WHEN unique_violation THEN
--         RAISE NOTICE 'CONSTRAINT OK: Duplicate insert blocked as expected';
-- END $$;

-- ============================================================================
-- DONE
-- ============================================================================

SELECT 'Migration 031 FIX completed successfully' as status;
