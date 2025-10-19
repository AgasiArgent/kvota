-- Drop the OLD recursive policies (using correct names)
DROP POLICY IF EXISTS "Admins can add members" ON organization_members;
DROP POLICY IF EXISTS "Admins can remove members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;

-- Keep the good policies we created:
-- "Users can view their own memberships" ✓
-- "Owners can insert members" ✓
-- "Owners can update members" ✓
-- "Owners can delete members" ✓
