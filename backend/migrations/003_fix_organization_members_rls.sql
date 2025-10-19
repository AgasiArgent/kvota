-- Fix infinite recursion in organization_members RLS policy
-- The issue: RLS policy checks organization_members to determine access to organization_members

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can view members" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can delete members" ON organization_members;

-- Simple, non-recursive policy for SELECT
-- Users can ONLY see their own membership records
-- This prevents infinite recursion by not querying organization_members within the policy
CREATE POLICY "Users can view their own memberships"
ON organization_members FOR SELECT
USING (user_id = auth.uid());

-- Organization owners can insert members (simplified to avoid recursion)
CREATE POLICY "Owners can insert members"
ON organization_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_id
    AND o.owner_id = auth.uid()
  )
);

-- Organization owners can update members (simplified to avoid recursion)
CREATE POLICY "Owners can update members"
ON organization_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_id
    AND o.owner_id = auth.uid()
  )
);

-- Organization owners can delete members (simplified to avoid recursion)
CREATE POLICY "Owners can delete members"
ON organization_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_id
    AND o.owner_id = auth.uid()
  )
);
