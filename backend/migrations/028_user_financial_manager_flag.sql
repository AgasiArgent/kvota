-- Migration: 028_user_financial_manager_flag
-- Date: 2025-11-21
-- Purpose: Add is_financial_manager flag to user_profiles for frontend authorization
-- Note: This complements 027 which added org-level financial_manager_id

-- 1. Add is_financial_manager flag to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_financial_manager BOOLEAN DEFAULT FALSE;

-- 2. Set Andy as financial manager for testing
-- Andy is user_id: 97ccad9e-ae96-4be5-ba07-321e07e8ee1e
UPDATE user_profiles
SET is_financial_manager = TRUE
WHERE user_id = '97ccad9e-ae96-4be5-ba07-321e07e8ee1e';

-- 3. Optional: Auto-sync with organization's financial_manager_id
-- This ensures consistency between the two approaches
UPDATE user_profiles up
SET is_financial_manager = TRUE
WHERE EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.financial_manager_id = up.user_id
);

-- 4. Verify the update
SELECT
    up.user_id,
    up.full_name,
    up.is_financial_manager,
    o.name as organization_name
FROM user_profiles up
LEFT JOIN organization_members om ON om.user_id = up.user_id
LEFT JOIN organizations o ON o.id = om.organization_id
WHERE up.user_id = '97ccad9e-ae96-4be5-ba07-321e07e8ee1e';

-- Expected result: Andy should have is_financial_manager = TRUE