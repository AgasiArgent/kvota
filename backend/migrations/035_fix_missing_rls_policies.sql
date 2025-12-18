-- Migration 035: Fix Missing RLS Policies
-- Date: 2025-12-11
-- Purpose: Add RLS to user_profiles, supplier_countries, and fix organization_members SELECT
--
-- Issues fixed:
-- 1. user_profiles - no RLS (users could see all profiles)
-- 2. supplier_countries - no RLS (reference data unprotected)
-- 3. organization_members - SELECT only shows own membership, not team members

-- ============================================================================
-- 1. user_profiles - Users can only manage their own profile
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (clean slate)
DROP POLICY IF EXISTS "Users manage own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create comprehensive policy for all operations
CREATE POLICY "Users manage own profile" ON user_profiles
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 2. supplier_countries - Public reference data (read-only for all)
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE supplier_countries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can read supplier countries" ON supplier_countries;

-- Create read-only policy for authenticated users
CREATE POLICY "Anyone can read supplier countries" ON supplier_countries
FOR SELECT
USING (true);

-- ============================================================================
-- 3. organization_members - Fix SELECT to show all members of user's orgs
-- ============================================================================

-- Current policy only shows user's own membership record
-- Need to show ALL members of organizations the user belongs to

-- Drop restrictive policy
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;

-- Create new policy that shows all members of user's organizations
CREATE POLICY "Users can view org members" ON organization_members
FOR SELECT
USING (
    organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.status = 'active'
    )
);

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- ============================================================================
--
-- -- Test user_profiles RLS
-- SET request.jwt.claims = '{"sub": "test-user-id"}';
-- SELECT * FROM user_profiles; -- Should only see own profile
--
-- -- Test supplier_countries RLS
-- SELECT * FROM supplier_countries; -- Should see all countries
--
-- -- Test organization_members RLS
-- SELECT * FROM organization_members; -- Should see all members of own orgs
--
-- ============================================================================

-- ============================================================================
-- ROLLBACK SCRIPT
-- ============================================================================
--
-- -- Rollback user_profiles
-- DROP POLICY IF EXISTS "Users manage own profile" ON user_profiles;
-- ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
--
-- -- Rollback supplier_countries
-- DROP POLICY IF EXISTS "Anyone can read supplier countries" ON supplier_countries;
-- ALTER TABLE supplier_countries DISABLE ROW LEVEL SECURITY;
--
-- -- Rollback organization_members (restore original policy)
-- DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
-- CREATE POLICY "Users can view their own memberships" ON organization_members
-- FOR SELECT USING (user_id = auth.uid());
--
-- ============================================================================
