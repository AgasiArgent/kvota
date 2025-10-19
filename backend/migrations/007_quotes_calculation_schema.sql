-- ============================================================================
-- Session 7: Quotes Management with Calculation Engine
-- Migration 007: Create tables for quote creation, calculation, and export
-- Date: 2025-10-18
-- ============================================================================

-- ============================================================================
-- 1. QUOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quote_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,

  -- Totals (calculated from items)
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Metadata
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'revision_needed'))
);

-- Indexes for quotes
CREATE INDEX IF NOT EXISTS idx_quotes_organization ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);

-- ============================================================================
-- 2. QUOTE ITEMS TABLE (Products from Excel/CSV)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,

  -- Product info (from Excel/CSV upload)
  product_name TEXT NOT NULL,
  product_code TEXT,
  base_price_vat DECIMAL(15,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  weight_in_kg DECIMAL(10,2) DEFAULT 0 CHECK (weight_in_kg >= 0),
  customs_code TEXT,
  supplier_country TEXT,

  -- Additional product metadata
  description TEXT,
  unit TEXT DEFAULT 'pcs',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quote_items
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_position ON quote_items(quote_id, position);

-- ============================================================================
-- 3. VARIABLE TEMPLATES TABLE (Saved calculation variable sets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS variable_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- All 39 variables as JSONB (same structure as quote_calculation_variables)
  variables JSONB NOT NULL,

  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_default BOOLEAN DEFAULT false,

  UNIQUE(organization_id, name)
);

-- Indexes for variable_templates
CREATE INDEX IF NOT EXISTS idx_templates_org ON variable_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_default ON variable_templates(organization_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON variable_templates(created_by);

-- ============================================================================
-- 4. QUOTE CALCULATION VARIABLES TABLE (39 input variables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_calculation_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  template_id UUID REFERENCES variable_templates(id) ON DELETE SET NULL,

  -- All 39 calculation variables stored as JSONB
  -- Structure: {
  --   "currency_of_quote": "USD",
  --   "markup": 15,
  --   "seller_company": "МАСТЕР БЭРИНГ ООО",
  --   ... (all 39 variables)
  -- }
  variables JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(quote_id)
);

-- Indexes for quote_calculation_variables
CREATE INDEX IF NOT EXISTS idx_calc_vars_quote ON quote_calculation_variables(quote_id);
CREATE INDEX IF NOT EXISTS idx_calc_vars_template ON quote_calculation_variables(template_id);
CREATE INDEX IF NOT EXISTS idx_calc_vars_variables ON quote_calculation_variables USING GIN (variables);

-- ============================================================================
-- 5. QUOTE CALCULATION RESULTS TABLE (All 13 phases)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_calculation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_item_id UUID NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,

  -- All 13 phases calculation results stored as JSONB
  -- Structure: {
  --   "phase1": {"N16": 1000.00, "P16": 850.00, "R16": 10.50, "S16": 10500.00},
  --   "phase2": {"BD16": 0.35, "S13": 30000.00},
  --   "phase3": {"T16": 150.00, "U16": 200.00, "V16": 350.00},
  --   ... (all 13 phases with all variables)
  --   "final": {"AJ16": 12.50, "AK16": 12500.00, "AM16": 15.00, "AL16": 15000.00}
  -- }
  phase_results JSONB NOT NULL,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(quote_item_id)
);

-- Indexes for quote_calculation_results
CREATE INDEX IF NOT EXISTS idx_calc_results_quote ON quote_calculation_results(quote_id);
CREATE INDEX IF NOT EXISTS idx_calc_results_item ON quote_calculation_results(quote_item_id);
CREATE INDEX IF NOT EXISTS idx_calc_results_phases ON quote_calculation_results USING GIN (phase_results);

-- ============================================================================
-- 6. QUOTE EXPORT SETTINGS TABLE (Column visibility preferences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_export_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  setting_type TEXT NOT NULL CHECK (setting_type IN ('user_default', 'client_specific')),

  -- Array of column identifiers to show
  -- Example: ["product_name", "quantity", "AJ16", "AK16", "AM16", "AL16"]
  visible_columns JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id, customer_id, setting_type)
);

-- Indexes for quote_export_settings
CREATE INDEX IF NOT EXISTS idx_export_settings_org ON quote_export_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_settings_user ON quote_export_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_export_settings_customer ON quote_export_settings(customer_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_calculation_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_calculation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_export_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: QUOTES
-- ============================================================================

-- Users can view quotes in their organization
CREATE POLICY "Users can view quotes in their organization"
  ON quotes FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

-- Users can create quotes in their organization
CREATE POLICY "Users can create quotes in their organization"
  ON quotes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Users can update quotes they created in draft or revision_needed status
CREATE POLICY "Users can update their own quotes"
  ON quotes FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR status NOT IN ('draft', 'revision_needed')
    )
  );

-- Users can delete their own draft quotes
CREATE POLICY "Users can delete their own draft quotes"
  ON quotes FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
    AND status = 'draft'
  );

-- ============================================================================
-- RLS POLICIES: QUOTE ITEMS
-- ============================================================================

-- Users can view quote items through quotes
CREATE POLICY "Users can view quote items through quotes"
  ON quote_items FOR SELECT
  USING (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

-- Users can insert quote items for quotes in their organization
CREATE POLICY "Users can create quote items"
  ON quote_items FOR INSERT
  WITH CHECK (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

-- Users can update quote items for quotes they can edit
CREATE POLICY "Users can update quote items"
  ON quote_items FOR UPDATE
  USING (quote_id IN (
    SELECT id FROM quotes
    WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND (status IN ('draft', 'revision_needed') OR created_by = auth.uid())
  ));

-- Users can delete quote items for their draft quotes
CREATE POLICY "Users can delete quote items"
  ON quote_items FOR DELETE
  USING (quote_id IN (
    SELECT id FROM quotes
    WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
    AND status = 'draft'
  ));

-- ============================================================================
-- RLS POLICIES: QUOTE CALCULATION VARIABLES
-- ============================================================================

CREATE POLICY "Users can view calculation variables"
  ON quote_calculation_variables FOR SELECT
  USING (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert calculation variables"
  ON quote_calculation_variables FOR INSERT
  WITH CHECK (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update calculation variables"
  ON quote_calculation_variables FOR UPDATE
  USING (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

-- ============================================================================
-- RLS POLICIES: QUOTE CALCULATION RESULTS
-- ============================================================================

CREATE POLICY "Users can view calculation results"
  ON quote_calculation_results FOR SELECT
  USING (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert calculation results"
  ON quote_calculation_results FOR INSERT
  WITH CHECK (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can update calculation results"
  ON quote_calculation_results FOR UPDATE
  USING (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

-- ============================================================================
-- RLS POLICIES: VARIABLE TEMPLATES
-- ============================================================================

CREATE POLICY "Users can view templates in their organization"
  ON variable_templates FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create templates"
  ON variable_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own templates"
  ON variable_templates FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete their own templates"
  ON variable_templates FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- ============================================================================
-- RLS POLICIES: QUOTE EXPORT SETTINGS
-- ============================================================================

CREATE POLICY "Users can view their own export settings"
  ON quote_export_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "Users can create export settings"
  ON quote_export_settings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own export settings"
  ON quote_export_settings FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own export settings"
  ON quote_export_settings FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for all tables
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_items_updated_at BEFORE UPDATE ON quote_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calc_vars_updated_at BEFORE UPDATE ON quote_calculation_variables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON variable_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_settings_updated_at BEFORE UPDATE ON quote_export_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration success
DO $$
BEGIN
  RAISE NOTICE 'Migration 007 completed successfully: Quotes calculation schema created';
END $$;
