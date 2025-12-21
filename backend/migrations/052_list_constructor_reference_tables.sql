-- Migration: 052_list_constructor_reference_tables
-- Description: Create purchasing_companies, suppliers, and quote_approval_history tables
-- Date: 2025-12-21
-- Task: TASK-008 - Quote List Constructor with Department Presets

-- ============================================================
-- Table 1: purchasing_companies (Закупочные компании)
-- Organization-specific list of purchasing companies per product
-- ============================================================

CREATE TABLE IF NOT EXISTS purchasing_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Name must be unique within organization
    CONSTRAINT unique_purchasing_company_name_per_org UNIQUE (organization_id, name)
);

-- Indexes
CREATE INDEX idx_purchasing_companies_org_id ON purchasing_companies(organization_id);
CREATE INDEX idx_purchasing_companies_active ON purchasing_companies(organization_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE purchasing_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own org purchasing companies"
    ON purchasing_companies FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Admins can insert purchasing companies"
    ON purchasing_companies FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can update purchasing companies"
    ON purchasing_companies FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can delete purchasing companies"
    ON purchasing_companies FOR DELETE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_purchasing_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchasing_companies_updated_at
    BEFORE UPDATE ON purchasing_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_purchasing_companies_updated_at();


-- ============================================================
-- Table 2: suppliers (Поставщики)
-- Organization-specific list of suppliers per product
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Name must be unique within organization
    CONSTRAINT unique_supplier_name_per_org UNIQUE (organization_id, name)
);

-- Indexes
CREATE INDEX idx_suppliers_org_id ON suppliers(organization_id);
CREATE INDEX idx_suppliers_active ON suppliers(organization_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own org suppliers"
    ON suppliers FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Admins can insert suppliers"
    ON suppliers FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can update suppliers"
    ON suppliers FOR UPDATE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admins can delete suppliers"
    ON suppliers FOR DELETE
    USING (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('admin', 'owner')
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_suppliers_updated_at();


-- ============================================================
-- Table 3: quote_approval_history (История согласований)
-- Tracks who approved at each workflow stage
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    approver_user_id UUID NOT NULL REFERENCES auth.users(id),
    workflow_state TEXT NOT NULL,  -- The state that was approved (e.g., 'draft', 'in_review', 'approved')
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quote_approval_history_quote_id ON quote_approval_history(quote_id);
CREATE INDEX idx_quote_approval_history_org_id ON quote_approval_history(organization_id);
CREATE INDEX idx_quote_approval_history_approver ON quote_approval_history(approver_user_id);
CREATE INDEX idx_quote_approval_history_state ON quote_approval_history(workflow_state);

-- Enable RLS
ALTER TABLE quote_approval_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - all org members can view, managers+ can insert
CREATE POLICY "Users can view own org approval history"
    ON quote_approval_history FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Managers can insert approval history"
    ON quote_approval_history FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT om.organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND r.name IN ('manager', 'admin', 'owner')
        )
    );

-- No UPDATE policy - approval history is immutable
-- No DELETE policy - approval history should not be deleted (audit trail)


-- ============================================================
-- Seed initial data for Мастер Бэринг organization (optional)
-- ============================================================

DO $$
DECLARE
    mb_org_id UUID;
BEGIN
    -- Get Мастер Бэринг organization ID
    SELECT id INTO mb_org_id FROM organizations WHERE name LIKE '%Мастер Бэринг%' LIMIT 1;

    IF mb_org_id IS NOT NULL THEN
        -- Insert sample purchasing companies
        INSERT INTO purchasing_companies (organization_id, name, country) VALUES
            (mb_org_id, 'GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ', 'Турция'),
            (mb_org_id, 'TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ', 'Турция'),
            (mb_org_id, 'UPDOOR Limited', 'Китай')
        ON CONFLICT DO NOTHING;

        -- Insert sample suppliers
        INSERT INTO suppliers (organization_id, name, country) VALUES
            (mb_org_id, 'SKF', 'Швеция'),
            (mb_org_id, 'FAG', 'Германия'),
            (mb_org_id, 'NSK', 'Япония'),
            (mb_org_id, 'NTN', 'Япония'),
            (mb_org_id, 'TIMKEN', 'США')
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Seeded purchasing companies and suppliers for organization %', mb_org_id;
    ELSE
        RAISE NOTICE 'Мастер Бэринг organization not found, skipping seed data';
    END IF;
END $$;
