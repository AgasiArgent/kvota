-- Migration 031: CRM System (Leads, Contacts, Activities)
-- Created: 2025-11-13
-- Purpose: Add CRM functionality for lead management, pipeline, and activities

-- ============================================================================
-- 1. LEAD STAGES TABLE (Pipeline stages)
-- ============================================================================

CREATE TABLE lead_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Stage details
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    color TEXT DEFAULT '#1890ff', -- Hex color for UI

    -- Stage type flags
    is_qualified BOOLEAN DEFAULT false, -- True for "Qualified" stage
    is_failed BOOLEAN DEFAULT false, -- True for "Lost/Failed" stage

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(organization_id, name),
    UNIQUE(organization_id, order_index)
);

-- Indexes
CREATE INDEX idx_lead_stages_org ON lead_stages(organization_id, order_index);

-- Trigger for updated_at
CREATE TRIGGER update_lead_stages_updated_at
    BEFORE UPDATE ON lead_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. LEADS TABLE (Companies in pipeline)
-- ============================================================================

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- External data (from call tracking system)
    external_id TEXT, -- ID from Make.com/call system

    -- Company information
    company_name TEXT NOT NULL,
    inn TEXT,
    email TEXT,
    phones TEXT[], -- Array of phone numbers
    primary_phone TEXT, -- Main contact phone
    segment TEXT, -- Industry/segment

    -- Pipeline management
    stage_id UUID NOT NULL REFERENCES lead_stages(id),
    assigned_to UUID REFERENCES auth.users(id),

    -- Notes and custom data
    notes TEXT,
    custom_fields JSONB DEFAULT '{}', -- Flexible custom fields

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(organization_id, email)
);

-- Indexes
CREATE INDEX idx_leads_org_id ON leads(organization_id);
CREATE INDEX idx_leads_stage ON leads(stage_id);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_external_id ON leads(external_id);
CREATE INDEX idx_leads_email ON leads(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_leads_inn ON leads(organization_id, inn) WHERE inn IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. LEAD CONTACTS TABLE (Decision makers / ЛПР)
-- ============================================================================

CREATE TABLE lead_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Contact details
    full_name TEXT NOT NULL,
    position TEXT, -- Job title / Должность
    phone TEXT,
    email TEXT,
    is_primary BOOLEAN DEFAULT false, -- Primary contact flag

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lead_contacts_lead ON lead_contacts(lead_id);
CREATE INDEX idx_lead_contacts_org ON lead_contacts(organization_id);

-- Trigger for updated_at
CREATE TRIGGER update_lead_contacts_updated_at
    BEFORE UPDATE ON lead_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. ACTIVITIES TABLE (Meetings, Calls, Tasks for Leads & Customers)
-- ============================================================================

CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Relations (either lead OR customer)
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

    -- Activity details
    type TEXT NOT NULL, -- 'call', 'meeting', 'email', 'task'
    title TEXT,
    notes TEXT,
    result TEXT, -- Result of activity (e.g., "Scheduled meeting", "No answer")

    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 15,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Google Calendar integration
    google_event_id TEXT,

    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint: activity must belong to either lead or customer
    CONSTRAINT activity_belongs_to_lead_or_customer CHECK (
        (lead_id IS NOT NULL AND customer_id IS NULL) OR
        (lead_id IS NULL AND customer_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_lead ON activities(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_activities_customer ON activities(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_activities_assigned ON activities(assigned_to);
CREATE INDEX idx_activities_created_by ON activities(created_by);
CREATE INDEX idx_activities_scheduled ON activities(scheduled_at) WHERE completed = false;
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_google_event ON activities(google_event_id) WHERE google_event_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. UPDATE CUSTOMERS TABLE (Track lead source)
-- ============================================================================

-- Add column to track which lead was qualified into this customer
ALTER TABLE customers
ADD COLUMN qualified_from_lead_id UUID REFERENCES leads(id);

-- Index for lead tracking
CREATE INDEX idx_customers_qualified_from ON customers(qualified_from_lead_id)
    WHERE qualified_from_lead_id IS NOT NULL;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Lead Stages RLS Policies
-- ============================================================================

-- Users can view stages in their organization
CREATE POLICY "Users can view org lead stages" ON lead_stages
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Managers+ can create stages
CREATE POLICY "Managers can create lead stages" ON lead_stages
FOR INSERT WITH CHECK (
    organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        JOIN roles r ON om.role_id = r.id
        WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND r.slug IN ('manager', 'admin', 'owner')
    )
);

-- Managers+ can update stages
CREATE POLICY "Managers can update lead stages" ON lead_stages
FOR UPDATE USING (
    organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        JOIN roles r ON om.role_id = r.id
        WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND r.slug IN ('manager', 'admin', 'owner')
    )
);

-- Managers+ can delete stages
CREATE POLICY "Managers can delete lead stages" ON lead_stages
FOR DELETE USING (
    organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        JOIN roles r ON om.role_id = r.id
        WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND r.slug IN ('manager', 'admin', 'owner')
    )
);

-- ============================================================================
-- Leads RLS Policies
-- ============================================================================

-- Users can view their assigned leads + unassigned leads
CREATE POLICY "Users can view assigned and unassigned leads" ON leads
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

-- Users can create leads in their organization
CREATE POLICY "Users can create leads" ON leads
FOR INSERT WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Users can update their assigned leads or unassigned leads
CREATE POLICY "Users can update their leads" ON leads
FOR UPDATE USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

-- Managers+ can delete leads
CREATE POLICY "Managers can delete leads" ON leads
FOR DELETE USING (
    organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        JOIN roles r ON om.role_id = r.id
        WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND r.slug IN ('manager', 'admin', 'owner')
    )
);

-- ============================================================================
-- Lead Contacts RLS Policies
-- ============================================================================

-- Users can view contacts for leads they can see
CREATE POLICY "Users can view lead contacts" ON lead_contacts
FOR SELECT USING (
    lead_id IN (
        SELECT id FROM leads
        WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
);

-- Users can create contacts for leads they can see
CREATE POLICY "Users can create lead contacts" ON lead_contacts
FOR INSERT WITH CHECK (
    lead_id IN (
        SELECT id FROM leads
        WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
);

-- Users can update contacts for their leads
CREATE POLICY "Users can update lead contacts" ON lead_contacts
FOR UPDATE USING (
    lead_id IN (
        SELECT id FROM leads
        WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
);

-- Users can delete contacts for their leads
CREATE POLICY "Users can delete lead contacts" ON lead_contacts
FOR DELETE USING (
    lead_id IN (
        SELECT id FROM leads
        WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
        AND (assigned_to = auth.uid() OR assigned_to IS NULL)
    )
);

-- ============================================================================
-- Activities RLS Policies
-- ============================================================================

-- Users can view activities for their leads/customers
CREATE POLICY "Users can view activities" ON activities
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
        -- Activities assigned to them
        assigned_to = auth.uid()
        OR
        -- Activities created by them
        created_by = auth.uid()
        OR
        -- Activities for leads they can see
        lead_id IN (
            SELECT id FROM leads
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
            AND (assigned_to = auth.uid() OR assigned_to IS NULL)
        )
        OR
        -- Activities for customers in their org
        customer_id IN (
            SELECT id FROM customers
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    )
);

-- Users can create activities
CREATE POLICY "Users can create activities" ON activities
FOR INSERT WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Users can update their activities
CREATE POLICY "Users can update activities" ON activities
FOR UPDATE USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
);

-- Users can delete their activities
CREATE POLICY "Users can delete activities" ON activities
FOR DELETE USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (assigned_to = auth.uid() OR created_by = auth.uid())
);

-- ============================================================================
-- 7. SEED DEFAULT LEAD STAGES
-- ============================================================================

-- Insert default stages for existing organizations
-- (Will be executed after migration, stages can be customized later)

INSERT INTO lead_stages (organization_id, name, order_index, color, is_qualified, is_failed)
SELECT
    id AS organization_id,
    'Новый',
    1,
    '#1890ff',
    false,
    false
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM lead_stages
    WHERE organization_id = organizations.id AND name = 'Новый'
);

INSERT INTO lead_stages (organization_id, name, order_index, color, is_qualified, is_failed)
SELECT
    id AS organization_id,
    'Звонок назначен',
    2,
    '#52c41a',
    false,
    false
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM lead_stages
    WHERE organization_id = organizations.id AND name = 'Звонок назначен'
);

INSERT INTO lead_stages (organization_id, name, order_index, color, is_qualified, is_failed)
SELECT
    id AS organization_id,
    'Онлайн-встреча',
    3,
    '#faad14',
    false,
    false
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM lead_stages
    WHERE organization_id = organizations.id AND name = 'Онлайн-встреча'
);

INSERT INTO lead_stages (organization_id, name, order_index, color, is_qualified, is_failed)
SELECT
    id AS organization_id,
    'Переговоры',
    4,
    '#722ed1',
    false,
    false
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM lead_stages
    WHERE organization_id = organizations.id AND name = 'Переговоры'
);

INSERT INTO lead_stages (organization_id, name, order_index, color, is_qualified, is_failed)
SELECT
    id AS organization_id,
    'Квалифицирован',
    5,
    '#389e0d',
    true,
    false
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM lead_stages
    WHERE organization_id = organizations.id AND name = 'Квалифицирован'
);

INSERT INTO lead_stages (organization_id, name, order_index, color, is_qualified, is_failed)
SELECT
    id AS organization_id,
    'Отказ',
    6,
    '#d32029',
    false,
    true
FROM organizations
WHERE NOT EXISTS (
    SELECT 1 FROM lead_stages
    WHERE organization_id = organizations.id AND name = 'Отказ'
);

-- ============================================================================
-- ROLLBACK (commented - use if needed)
-- ============================================================================

-- DROP TABLE IF EXISTS activities CASCADE;
-- DROP TABLE IF EXISTS lead_contacts CASCADE;
-- DROP TABLE IF EXISTS leads CASCADE;
-- DROP TABLE IF EXISTS lead_stages CASCADE;
-- ALTER TABLE customers DROP COLUMN IF EXISTS qualified_from_lead_id;
