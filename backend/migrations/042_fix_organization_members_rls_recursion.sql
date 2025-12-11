-- Migration: Fix organization_members RLS infinite recursion
-- Purpose: Replace recursive RLS policy with SECURITY DEFINER function
-- Date: 2025-12-11
--
-- Problem: The SELECT policy on organization_members was querying organization_members itself,
-- causing PostgreSQL error 42P17 "infinite recursion detected in policy for relation"
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to get user's organization IDs,
-- then use that function in the RLS policy instead of a direct subquery.

-- Step 1: Create helper function with SECURITY DEFINER (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_organization_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = p_user_id AND status = 'active';
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_organization_ids(uuid) TO authenticated;

-- Add comment explaining usage
COMMENT ON FUNCTION get_user_organization_ids IS
'Returns organization IDs for a user. Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion when used in organization_members RLS policies.';

-- Step 2: Drop old problematic policy
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
DROP POLICY IF EXISTS "Members can view org members" ON organization_members;

-- Step 3: Create new policy using the helper function
CREATE POLICY "Users can view org members" ON organization_members
FOR SELECT USING (
  organization_id IN (SELECT get_user_organization_ids(auth.uid()))
);

-- Verify: This policy no longer causes recursion because:
-- 1. get_user_organization_ids() is SECURITY DEFINER -> bypasses RLS
-- 2. The function directly queries organization_members without RLS check
-- 3. The RLS policy just uses the function result (a set of UUIDs)
