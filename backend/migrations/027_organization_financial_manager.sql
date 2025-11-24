-- Migration: 027_organization_financial_manager
-- Date: 2025-11-21
-- Purpose: Add financial_manager_id to organizations and submission_comment to quotes

-- 1. Add financial_manager_id to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS financial_manager_id UUID REFERENCES auth.users(id);

-- 2. Add submission_comment to quotes table for storing comment when submitting for approval
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS submission_comment TEXT;

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_financial_manager
ON organizations(financial_manager_id);

-- 4. Set a default financial manager for the test organization (Master Bearing LLC)
-- This is for testing purposes - in production, this would be set via UI
UPDATE organizations
SET financial_manager_id = (
    SELECT om.user_id
    FROM organization_members om
    JOIN roles r ON om.role_id = r.id
    WHERE om.organization_id = organizations.id
    AND r.slug IN ('admin', 'owner')
    AND om.status = 'active'
    LIMIT 1
)
WHERE name = 'МАСТЕР БЭРИНГ ООО'
AND financial_manager_id IS NULL;