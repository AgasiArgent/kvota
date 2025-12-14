-- Migration: 044_seller_companies
-- Description: Create seller_companies table for managing quote seller options
-- Date: 2025-12-14

-- Create seller_companies table
CREATE TABLE IF NOT EXISTS seller_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    supplier_code VARCHAR(3) NOT NULL,
    country VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Supplier code must be unique within organization
    CONSTRAINT unique_supplier_code_per_org UNIQUE (organization_id, supplier_code),
    -- Name must be unique within organization
    CONSTRAINT unique_name_per_org UNIQUE (organization_id, name),
    -- Supplier code must be 3 uppercase letters
    CONSTRAINT supplier_code_format CHECK (supplier_code ~ '^[A-Z]{3}$')
);

-- Create index for faster lookups
CREATE INDEX idx_seller_companies_org_id ON seller_companies(organization_id);
CREATE INDEX idx_seller_companies_active ON seller_companies(organization_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE seller_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view seller companies in their organization
CREATE POLICY "Users can view own org seller companies"
    ON seller_companies FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- Only admins/owners can insert
CREATE POLICY "Admins can insert seller companies"
    ON seller_companies FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

-- Only admins/owners can update
CREATE POLICY "Admins can update seller companies"
    ON seller_companies FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

-- Only admins/owners can delete
CREATE POLICY "Admins can delete seller companies"
    ON seller_companies FOR DELETE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

-- Seed initial data for Мастер Бэринг organization
-- Note: Run this after migration, replacing the UUID with actual org ID
DO $$
DECLARE
    mb_org_id UUID;
BEGIN
    -- Get Мастер Бэринг organization ID
    SELECT id INTO mb_org_id FROM organizations WHERE name LIKE '%Мастер Бэринг%' LIMIT 1;

    IF mb_org_id IS NOT NULL THEN
        -- Insert seller companies
        INSERT INTO seller_companies (organization_id, name, supplier_code, country) VALUES
            (mb_org_id, 'МАСТЕР БЭРИНГ ООО', 'MBR', 'Россия'),
            (mb_org_id, 'РадРесур ООО', 'RAR', 'Россия'),
            (mb_org_id, 'ЦМТО1 ООО', 'CMT', 'Россия'),
            (mb_org_id, 'GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ', 'GES', 'Турция'),
            (mb_org_id, 'TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ', 'TEX', 'Турция')
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Inserted seller companies for organization %', mb_org_id;
    ELSE
        RAISE NOTICE 'Мастер Бэринг organization not found, skipping seed data';
    END IF;
END $$;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_seller_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seller_companies_updated_at
    BEFORE UPDATE ON seller_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_seller_companies_updated_at();
