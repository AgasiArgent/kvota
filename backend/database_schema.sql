-- ============================================================================
-- B2B Quotation Platform Database Schema - Russian Business Context
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- CUSTOMERS TABLE - Russian Business Context
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(100),
    
    -- Russian Address Information
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100), -- Oblast/Krai/Republic
    country VARCHAR(100) DEFAULT 'Russia',
    postal_code VARCHAR(10), -- Russian postal codes are 6 digits
    
    -- Russian Business Information
    inn VARCHAR(12), -- ИНН (Individual Tax Number) - 10 digits for organizations, 12 for individuals
    kpp VARCHAR(9),  -- КПП (Tax Registration Reason Code) - 9 digits for organizations
    ogrn VARCHAR(15), -- ОГРН (Primary State Registration Number) - 13 digits for organizations, 15 for individual entrepreneurs
    company_type VARCHAR(50) DEFAULT 'organization' CHECK (company_type IN ('individual', 'individual_entrepreneur', 'organization', 'government')),
    industry VARCHAR(100),
    
    -- Financial Information
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30, -- days
    
    -- Status and Metadata
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- QUOTES TABLE - Enhanced Approval Workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Quote Identification
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Relationships
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Customer Information (cached for quote integrity)
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_address TEXT,
    
    -- Quote Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Enhanced Status Management for Multi-Manager Approval
    status VARCHAR(50) DEFAULT 'draft' CHECK (
        status IN (
            'draft',              -- Being created by sales person
            'pending_approval',   -- Submitted for manager approval
            'partially_approved', -- Some (not all) required managers approved
            'approved',           -- All required managers approved
            'revision_needed',    -- Manager(s) requested changes
            'rejected_internal',  -- Rejected by manager(s)
            'ready_to_send',     -- Approved and ready for client
            'sent',              -- Sent to client
            'viewed',            -- Client viewed the quote
            'accepted',          -- Client accepted
            'rejected',          -- Client rejected
            'expired',           -- Validity period ended
            'cancelled'          -- Cancelled by company
        )
    ),
    
    -- Approval Requirements
    requires_approval BOOLEAN DEFAULT true,
    required_approvers INTEGER DEFAULT 1, -- How many managers must approve
    approval_type VARCHAR(20) DEFAULT 'sequential' CHECK (approval_type IN ('sequential', 'parallel')),
    
    -- Financial Information - Russian/Chinese Context
    currency VARCHAR(3) DEFAULT 'RUB' CHECK (currency IN ('RUB', 'CNY', 'USD', 'EUR')),
    exchange_rate DECIMAL(10,6) DEFAULT 1.0, -- for multi-currency support
    
    -- Calculations
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Discounts
    discount_type VARCHAR(10) DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_rate DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Russian VAT (НДС)
    vat_rate DECIMAL(5,2) DEFAULT 20, -- Standard Russian VAT is 20%
    vat_amount DECIMAL(15,2) DEFAULT 0,
    vat_included BOOLEAN DEFAULT false, -- Whether VAT is included in prices
    
    -- Import duties (for Chinese imports)
    import_duty_rate DECIMAL(5,2) DEFAULT 0,
    import_duty_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Credit/financing
    credit_rate DECIMAL(5,2) DEFAULT 0, -- cost of money
    credit_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Total
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Dates
    quote_date DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    delivery_date DATE,
    
    -- Terms and Conditions
    payment_terms INTEGER DEFAULT 30, -- days
    delivery_terms TEXT,
    warranty_terms TEXT,
    notes TEXT,
    internal_notes TEXT, -- private notes for sales team
    
    -- Workflow Timestamps
    submitted_for_approval_at TIMESTAMP WITH TIME ZONE,
    final_approval_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================================
-- QUOTE APPROVALS TABLE - Multi-Manager Support
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Relationships
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    approver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Approval Details
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (
        approval_status IN ('pending', 'approved', 'rejected', 'skipped')
    ),
    
    -- Approval Order (for sequential approval)
    approval_order INTEGER DEFAULT 1,
    
    -- Decision Details
    decision_notes TEXT,
    revision_notes TEXT, -- What needs to be changed
    
    -- Timestamps
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    decided_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(quote_id, approver_id) -- Each manager can only have one approval record per quote
);

-- Add trigger for quote_approvals
DROP TRIGGER IF EXISTS update_quote_approvals_updated_at ON quote_approvals;
CREATE TRIGGER update_quote_approvals_updated_at
    BEFORE UPDATE ON quote_approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- APPROVAL WORKFLOW FUNCTIONS
-- ============================================================================

-- Function to check if quote has all required approvals
CREATE OR REPLACE FUNCTION check_quote_approval_status(quote_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    quote_record RECORD;
    approved_count INTEGER;
    rejected_count INTEGER;
    pending_count INTEGER;
    new_status VARCHAR(50);
BEGIN
    -- Get quote details
    SELECT required_approvers, approval_type INTO quote_record
    FROM quotes WHERE id = quote_uuid;
    
    -- Count approval statuses
    SELECT 
        COUNT(CASE WHEN approval_status = 'approved' THEN 1 END),
        COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END),
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END)
    INTO approved_count, rejected_count, pending_count
    FROM quote_approvals 
    WHERE quote_id = quote_uuid;
    
    -- Determine new status
    IF rejected_count > 0 THEN
        new_status := 'rejected_internal';
    ELSIF approved_count >= quote_record.required_approvers THEN
        new_status := 'approved';
    ELSIF approved_count > 0 AND approved_count < quote_record.required_approvers THEN
        new_status := 'partially_approved';
    ELSE
        new_status := 'pending_approval';
    END IF;
    
    -- Update quote status
    UPDATE quotes 
    SET 
        status = new_status,
        final_approval_at = CASE 
            WHEN new_status = 'approved' THEN TIMEZONE('utc', NOW())
            ELSE final_approval_at
        END
    WHERE id = quote_uuid;
    
    RETURN new_status;
END;
$$ language 'plpgsql';

-- Trigger to update quote status when approvals change
CREATE OR REPLACE FUNCTION update_quote_status_on_approval()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM check_quote_approval_status(COALESCE(NEW.quote_id, OLD.quote_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_quote_status_on_approval_change ON quote_approvals;
CREATE TRIGGER update_quote_status_on_approval_change
    AFTER INSERT OR UPDATE OR DELETE ON quote_approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_quote_status_on_approval();

-- ============================================================================
-- QUOTE NUMBER GENERATION
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
    new_number VARCHAR(50);
    year_suffix VARCHAR(4);
    counter INTEGER;
BEGIN
    -- Get current year as 2-digit suffix
    year_suffix := TO_CHAR(NOW(), 'YY');
    
    -- Get next counter for this year
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(quote_number, '-', 2) AS INTEGER)
    ), 0) + 1
    INTO counter
    FROM quotes 
    WHERE quote_number LIKE 'КП' || year_suffix || '-%'; -- КП = Коммерческое предложение (Commercial Proposal)
    
    -- Format: КП24-0001
    new_number := 'КП' || year_suffix || '-' || LPAD(counter::TEXT, 4, '0');
    
    NEW.quote_number := new_number;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-generating quote numbers
DROP TRIGGER IF EXISTS auto_quote_number ON quotes;
CREATE TRIGGER auto_quote_number
    BEFORE INSERT ON quotes
    FOR EACH ROW
    WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
    EXECUTE FUNCTION generate_quote_number();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- QUOTE ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS quote_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Relationships
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    
    -- Product Information
    description TEXT NOT NULL,
    product_code VARCHAR(100),
    category VARCHAR(100),
    brand VARCHAR(100),
    model VARCHAR(100),
    
    -- Technical Specifications
    specifications JSONB, -- flexible storage for technical details
    
    -- Origin Information (important for Russian-Chinese trade)
    country_of_origin VARCHAR(100),
    manufacturer VARCHAR(255),
    
    -- Quantities and Pricing
    quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'шт', -- шт = штук (pieces in Russian)
    
    -- Base pricing
    unit_cost DECIMAL(15,2), -- internal cost (for margin calculation)
    unit_price DECIMAL(15,2) NOT NULL,
    
    -- Item-level discounts
    discount_type VARCHAR(10) DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_rate DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Russian VAT handling
    vat_rate DECIMAL(5,2) DEFAULT 20,
    vat_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Import duties (item-specific)
    import_duty_rate DECIMAL(5,2) DEFAULT 0,
    import_duty_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Calculated totals
    line_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0, -- quantity * unit_price
    line_discount DECIMAL(15,2) DEFAULT 0,
    line_total DECIMAL(15,2) NOT NULL DEFAULT 0, -- final line total
    
    -- Delivery Information
    lead_time_days INTEGER,
    delivery_notes TEXT,
    
    -- Organization
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================================
-- QUOTE ITEM CALCULATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_quote_item_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate line subtotal
    NEW.line_subtotal := NEW.quantity * NEW.unit_price;
    
    -- Calculate discount
    IF NEW.discount_type = 'percentage' THEN
        NEW.line_discount := NEW.line_subtotal * (NEW.discount_rate / 100);
    ELSE
        NEW.line_discount := NEW.discount_amount;
    END IF;
    
    -- Calculate VAT amount based on discounted subtotal
    NEW.vat_amount := (NEW.line_subtotal - NEW.line_discount) * (NEW.vat_rate / 100);
    
    -- Calculate import duty amount
    NEW.import_duty_amount := (NEW.line_subtotal - NEW.line_discount) * (NEW.import_duty_rate / 100);
    
    -- Calculate final line total
    NEW.line_total := NEW.line_subtotal - NEW.line_discount + NEW.vat_amount + NEW.import_duty_amount;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for quote item calculations
DROP TRIGGER IF EXISTS calculate_quote_item_totals_trigger ON quote_items;
CREATE TRIGGER calculate_quote_item_totals_trigger
    BEFORE INSERT OR UPDATE ON quote_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_quote_item_totals();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_quote_items_updated_at ON quote_items;
CREATE TRIGGER update_quote_items_updated_at
    BEFORE UPDATE ON quote_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- QUOTE TOTALS RECALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
    quote_record RECORD;
    items_subtotal DECIMAL(15,2);
    quote_discount DECIMAL(15,2);
    quote_vat DECIMAL(15,2);
    quote_duties DECIMAL(15,2);
    quote_credit DECIMAL(15,2);
    final_total DECIMAL(15,2);
BEGIN
    -- Get the quote ID (handle both INSERT/UPDATE and DELETE)
    IF TG_OP = 'DELETE' THEN
        SELECT id INTO quote_record FROM quotes WHERE id = OLD.quote_id;
    ELSE
        SELECT id INTO quote_record FROM quotes WHERE id = NEW.quote_id;
    END IF;
    
    -- Calculate subtotal from all quote items
    SELECT COALESCE(SUM(line_total), 0)
    INTO items_subtotal
    FROM quote_items 
    WHERE quote_id = quote_record.id;
    
    -- Get quote-level information for additional calculations
    SELECT 
        discount_type, discount_rate, discount_amount,
        vat_rate, import_duty_rate, credit_rate
    INTO quote_record
    FROM quotes 
    WHERE id = quote_record.id;
    
    -- Calculate quote-level discount
    IF quote_record.discount_type = 'percentage' THEN
        quote_discount := items_subtotal * (quote_record.discount_rate / 100);
    ELSE
        quote_discount := quote_record.discount_amount;
    END IF;
    
    -- Calculate quote-level VAT
    quote_vat := (items_subtotal - quote_discount) * (quote_record.vat_rate / 100);
    
    -- Calculate quote-level import duties
    quote_duties := (items_subtotal - quote_discount) * (quote_record.import_duty_rate / 100);
    
    -- Calculate credit cost (cost of money)
    quote_credit := (items_subtotal - quote_discount + quote_vat + quote_duties) * (quote_record.credit_rate / 100);
    
    -- Final total
    final_total := items_subtotal - quote_discount + quote_vat + quote_duties + quote_credit;
    
    -- Update the quote totals
    UPDATE quotes 
    SET 
        subtotal = items_subtotal,
        discount_amount = quote_discount,
        vat_amount = quote_vat,
        import_duty_amount = quote_duties,
        credit_amount = quote_credit,
        total_amount = final_total,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = quote_record.id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- Triggers to recalculate quote totals when items change
DROP TRIGGER IF EXISTS recalc_quote_totals_on_item_change ON quote_items;
CREATE TRIGGER recalc_quote_totals_on_item_change
    AFTER INSERT OR UPDATE OR DELETE ON quote_items
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_quote_totals();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CUSTOMERS RLS POLICIES
-- ============================================================================

-- All authenticated users can view customers (shared resource)
DROP POLICY IF EXISTS "authenticated_users_view_customers" ON customers;
CREATE POLICY "authenticated_users_view_customers" ON customers
    FOR SELECT TO authenticated USING (true);

-- All authenticated users can create customers
DROP POLICY IF EXISTS "authenticated_users_create_customers" ON customers;
CREATE POLICY "authenticated_users_create_customers" ON customers
    FOR INSERT TO authenticated WITH CHECK (true);

-- All authenticated users can update customers
DROP POLICY IF EXISTS "authenticated_users_update_customers" ON customers;
CREATE POLICY "authenticated_users_update_customers" ON customers
    FOR UPDATE TO authenticated USING (true);

-- Only allow deletion by authenticated users (could be restricted further)
DROP POLICY IF EXISTS "authenticated_users_delete_customers" ON customers;
CREATE POLICY "authenticated_users_delete_customers" ON customers
    FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- QUOTES RLS POLICIES
-- ============================================================================

-- Users can view quotes they created OR quotes they need to approve
DROP POLICY IF EXISTS "users_view_relevant_quotes" ON quotes;
CREATE POLICY "users_view_relevant_quotes" ON quotes
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id OR 
        auth.uid() IN (
            SELECT approver_id FROM quote_approvals WHERE quote_id = quotes.id
        )
    );

-- Users can only create quotes assigned to themselves
DROP POLICY IF EXISTS "users_create_own_quotes" ON quotes;
CREATE POLICY "users_create_own_quotes" ON quotes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own quotes OR managers can update quotes they're approving
DROP POLICY IF EXISTS "users_update_relevant_quotes" ON quotes;
CREATE POLICY "users_update_relevant_quotes" ON quotes
    FOR UPDATE TO authenticated USING (
        auth.uid() = user_id OR 
        auth.uid() IN (
            SELECT approver_id FROM quote_approvals WHERE quote_id = quotes.id
        )
    );

-- Users can only delete their own quotes
DROP POLICY IF EXISTS "users_delete_own_quotes" ON quotes;
CREATE POLICY "users_delete_own_quotes" ON quotes
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- QUOTE ITEMS RLS POLICIES
-- ============================================================================

-- Users can view quote items for quotes they can access
DROP POLICY IF EXISTS "users_view_accessible_quote_items" ON quote_items;
CREATE POLICY "users_view_accessible_quote_items" ON quote_items
    FOR SELECT TO authenticated 
    USING (
        quote_id IN (
            SELECT id FROM quotes WHERE 
                user_id = auth.uid() OR
                auth.uid() IN (
                    SELECT approver_id FROM quote_approvals WHERE quote_id = quotes.id
                )
        )
    );

-- Users can create quote items for quotes they own
DROP POLICY IF EXISTS "users_create_own_quote_items" ON quote_items;
CREATE POLICY "users_create_own_quote_items" ON quote_items
    FOR INSERT TO authenticated 
    WITH CHECK (
        quote_id IN (
            SELECT id FROM quotes WHERE user_id = auth.uid()
        )
    );

-- Users can update quote items for quotes they own
DROP POLICY IF EXISTS "users_update_own_quote_items" ON quote_items;
CREATE POLICY "users_update_own_quote_items" ON quote_items
    FOR UPDATE TO authenticated 
    USING (
        quote_id IN (
            SELECT id FROM quotes WHERE user_id = auth.uid()
        )
    );

-- Users can delete quote items for quotes they own
DROP POLICY IF EXISTS "users_delete_own_quote_items" ON quote_items;
CREATE POLICY "users_delete_own_quote_items" ON quote_items
    FOR DELETE TO authenticated 
    USING (
        quote_id IN (
            SELECT id FROM quotes WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- QUOTE APPROVALS RLS POLICIES
-- ============================================================================

-- Users can view approvals for quotes they created or approvals assigned to them
DROP POLICY IF EXISTS "users_view_relevant_approvals" ON quote_approvals;
CREATE POLICY "users_view_relevant_approvals" ON quote_approvals
    FOR SELECT TO authenticated USING (
        auth.uid() = approver_id OR
        quote_id IN (SELECT id FROM quotes WHERE user_id = auth.uid())
    );

-- Only quote creators can create approval records
DROP POLICY IF EXISTS "quote_creators_create_approvals" ON quote_approvals;
CREATE POLICY "quote_creators_create_approvals" ON quote_approvals
    FOR INSERT TO authenticated WITH CHECK (
        quote_id IN (SELECT id FROM quotes WHERE user_id = auth.uid())
    );

-- Users can update approval records assigned to them
DROP POLICY IF EXISTS "approvers_update_own_approvals" ON quote_approvals;
CREATE POLICY "approvers_update_own_approvals" ON quote_approvals
    FOR UPDATE TO authenticated USING (auth.uid() = approver_id);

-- Quote creators can delete approval records
DROP POLICY IF EXISTS "quote_creators_delete_approvals" ON quote_approvals;
CREATE POLICY "quote_creators_delete_approvals" ON quote_approvals
    FOR DELETE TO authenticated USING (
        quote_id IN (SELECT id FROM quotes WHERE user_id = auth.uid())
    );

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_inn ON customers(inn);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes(quote_date);
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until);

-- Quote items indexes
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_sort_order ON quote_items(quote_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_quote_items_product_code ON quote_items(product_code);
CREATE INDEX IF NOT EXISTS idx_quote_items_category ON quote_items(category);

-- Quote approvals indexes
CREATE INDEX IF NOT EXISTS idx_quote_approvals_quote_id ON quote_approvals(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_approvals_approver_id ON quote_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_quote_approvals_status ON quote_approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_quote_approvals_assigned_at ON quote_approvals(assigned_at);

-- ============================================================================
-- SAMPLE DATA FOR TESTING - Russian Context
-- ============================================================================

-- Insert a sample customer (only if table is empty)
INSERT INTO customers (name, email, phone, address, city, region, country, company_type, inn, kpp)
SELECT 
    'ООО "Тестовая Компания"', 
    'info@testcompany.ru', 
    '+7 495 123-45-67',
    'ул. Тверская, д. 1',
    'Москва',
    'Москва',
    'Russia',
    'organization',
    '7701234567', -- Sample INN
    '770101001'   -- Sample KPP
WHERE NOT EXISTS (SELECT 1 FROM customers);

-- ============================================================================
-- HELPER FUNCTIONS FOR APPROVAL WORKFLOW
-- ============================================================================

-- Function to add required approvers to a quote
CREATE OR REPLACE FUNCTION add_quote_approvers(
    quote_uuid UUID,
    approver_ids UUID[],
    approval_type_param VARCHAR(20) DEFAULT 'parallel'
)
RETURNS INTEGER AS $$
DECLARE
    approver_id UUID;
    order_number INTEGER := 1;
BEGIN
    -- Update quote approval settings
    UPDATE quotes 
    SET 
        requires_approval = true,
        required_approvers = array_length(approver_ids, 1),
        approval_type = approval_type_param
    WHERE id = quote_uuid;
    
    -- Add approval records
    FOREACH approver_id IN ARRAY approver_ids
    LOOP
        INSERT INTO quote_approvals (quote_id, approver_id, approval_order)
        VALUES (quote_uuid, approver_id, order_number);
        
        order_number := order_number + 1;
    END LOOP;
    
    RETURN array_length(approver_ids, 1);
END;
$$ language 'plpgsql';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- Create a function to confirm schema creation
CREATE OR REPLACE FUNCTION confirm_schema_creation() 
RETURNS TEXT AS $$
BEGIN
    RETURN 'Russian B2B Quotation Platform database schema created successfully! ' ||
           'Tables: customers (Russian fields), quotes (multi-manager approval), quote_items, quote_approvals. ' ||
           'Features: Multi-manager approval workflow, RLS policies, automatic calculations, Russian business context, CNY support.';
END;
$$ LANGUAGE plpgsql;

SELECT confirm_schema_creation();