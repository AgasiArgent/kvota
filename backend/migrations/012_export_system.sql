-- Migration 012: Export System Foundation
-- Created: 2025-10-24
-- Purpose: Add customer contacts, export fields to quotes, and CEO info to organizations

-- ============================================================================
-- NEW TABLE: customer_contacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    position TEXT,
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Multi-tenancy
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_org ON customer_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_is_primary ON customer_contacts(is_primary) WHERE is_primary = true;

-- RLS Policy
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view contacts in their organization
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON customer_contacts;
CREATE POLICY "Users can view contacts in their organization"
    ON customer_contacts
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Users can create contacts in their organization
DROP POLICY IF EXISTS "Users can create contacts in their organization" ON customer_contacts;
CREATE POLICY "Users can create contacts in their organization"
    ON customer_contacts
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Users can update contacts in their organization
DROP POLICY IF EXISTS "Users can update contacts in their organization" ON customer_contacts;
CREATE POLICY "Users can update contacts in their organization"
    ON customer_contacts
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Policy: Users can delete contacts in their organization
DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON customer_contacts;
CREATE POLICY "Users can delete contacts in their organization"
    ON customer_contacts
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM organization_members
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_customer_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_contacts_updated_at ON customer_contacts;
CREATE TRIGGER trigger_update_customer_contacts_updated_at
    BEFORE UPDATE ON customer_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_contacts_updated_at();


-- ============================================================================
-- MODIFY TABLE: quotes (Add export-related fields)
-- ============================================================================

-- Add export fields if they don't already exist
DO $$
BEGIN
    -- Delivery address
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'delivery_address'
    ) THEN
        ALTER TABLE quotes ADD COLUMN delivery_address TEXT;
    END IF;

    -- Contact reference
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'contact_id'
    ) THEN
        ALTER TABLE quotes ADD COLUMN contact_id UUID REFERENCES customer_contacts(id);
    END IF;

    -- Created by user (for manager info)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'created_by_user_id'
    ) THEN
        ALTER TABLE quotes ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);
    END IF;

    -- Manager info (can override user profile)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'manager_name'
    ) THEN
        ALTER TABLE quotes ADD COLUMN manager_name TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'manager_phone'
    ) THEN
        ALTER TABLE quotes ADD COLUMN manager_phone TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'manager_email'
    ) THEN
        ALTER TABLE quotes ADD COLUMN manager_email TEXT;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by_user ON quotes(created_by_user_id);


-- ============================================================================
-- MODIFY TABLE: organizations (Add CEO info for letters)
-- ============================================================================

-- Add CEO fields if they don't already exist
DO $$
BEGIN
    -- CEO name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'ceo_name'
    ) THEN
        ALTER TABLE organizations ADD COLUMN ceo_name TEXT;
    END IF;

    -- CEO title (with Russian default)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'ceo_title'
    ) THEN
        ALTER TABLE organizations ADD COLUMN ceo_title TEXT DEFAULT 'Генеральный директор';
    END IF;

    -- CEO signature URL (for future use)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'ceo_signature_url'
    ) THEN
        ALTER TABLE organizations ADD COLUMN ceo_signature_url TEXT;
    END IF;

    -- Letter template (for customization)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'letter_template'
    ) THEN
        ALTER TABLE organizations ADD COLUMN letter_template TEXT;
    END IF;
END $$;


-- ============================================================================
-- VALIDATION & COMMENTS
-- ============================================================================

COMMENT ON TABLE customer_contacts IS 'Customer contact persons for quotes and exports';
COMMENT ON COLUMN customer_contacts.is_primary IS 'Primary contact for this customer (used as default in exports)';

COMMENT ON COLUMN quotes.delivery_address IS 'Delivery address for this quote (used in exports)';
COMMENT ON COLUMN quotes.contact_id IS 'Customer contact person for this quote';
COMMENT ON COLUMN quotes.created_by_user_id IS 'User who created the quote (used for manager info in exports)';
COMMENT ON COLUMN quotes.manager_name IS 'Manager name (overrides user profile if set)';
COMMENT ON COLUMN quotes.manager_phone IS 'Manager phone (overrides user profile if set)';
COMMENT ON COLUMN quotes.manager_email IS 'Manager email (overrides user profile if set)';

COMMENT ON COLUMN organizations.ceo_name IS 'CEO name for formal letters';
COMMENT ON COLUMN organizations.ceo_title IS 'CEO title (default: Генеральный директор)';
COMMENT ON COLUMN organizations.ceo_signature_url IS 'URL to CEO signature image for letters (future use)';
COMMENT ON COLUMN organizations.letter_template IS 'Custom letter template text (future use)';
