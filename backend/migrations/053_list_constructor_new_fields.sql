-- Migration: 053_list_constructor_new_fields
-- Description: Add new fields to quotes, quote_items, quote_calculation_summaries, and calculation_settings
-- Date: 2025-12-21
-- Task: TASK-008 - Quote List Constructor with Department Presets

-- ============================================================
-- Part 1: New fields in `quotes` table
-- ============================================================

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS document_folder_link TEXT,
ADD COLUMN IF NOT EXISTS executor_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS spec_sign_date DATE,
ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_weight_kg DECIMAL(15,3) DEFAULT 0;

-- Index for executor lookups
CREATE INDEX IF NOT EXISTS idx_quotes_executor_user_id ON quotes(executor_user_id) WHERE executor_user_id IS NOT NULL;

COMMENT ON COLUMN quotes.document_folder_link IS 'Link to Google Drive folder with deal documents';
COMMENT ON COLUMN quotes.executor_user_id IS 'Deprecated: Historical executor if different from sales manager';
COMMENT ON COLUMN quotes.spec_sign_date IS 'Date when specification was signed by customer';
COMMENT ON COLUMN quotes.total_quantity IS 'SUM of all product quantities in quote';
COMMENT ON COLUMN quotes.total_weight_kg IS 'SUM of (weight_in_kg * quantity) for all products';


-- ============================================================
-- Part 2: New fields in `quote_items` table
-- ============================================================

ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS production_time_days INTEGER,
ADD COLUMN IF NOT EXISTS product_category TEXT,
ADD COLUMN IF NOT EXISTS proforma_number TEXT,
ADD COLUMN IF NOT EXISTS proforma_date DATE,
ADD COLUMN IF NOT EXISTS proforma_currency TEXT,
ADD COLUMN IF NOT EXISTS proforma_amount_excl_vat DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS proforma_amount_incl_vat DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS proforma_amount_excl_vat_usd DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS proforma_amount_incl_vat_usd DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS purchasing_company_id UUID REFERENCES purchasing_companies(id),
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS purchasing_manager_id UUID REFERENCES auth.users(id);

-- Indexes for FK lookups
CREATE INDEX IF NOT EXISTS idx_quote_items_purchasing_company ON quote_items(purchasing_company_id) WHERE purchasing_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_items_supplier ON quote_items(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_items_purchasing_manager ON quote_items(purchasing_manager_id) WHERE purchasing_manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_items_product_category ON quote_items(product_category) WHERE product_category IS NOT NULL;

COMMENT ON COLUMN quote_items.production_time_days IS 'Production lead time at supplier (days)';
COMMENT ON COLUMN quote_items.product_category IS 'Product category for analytics';
COMMENT ON COLUMN quote_items.proforma_number IS 'Supplier proforma invoice number';
COMMENT ON COLUMN quote_items.proforma_date IS 'Supplier proforma invoice date';
COMMENT ON COLUMN quote_items.proforma_currency IS 'Currency of proforma invoice';
COMMENT ON COLUMN quote_items.proforma_amount_excl_vat IS 'Proforma amount excluding VAT (proforma currency)';
COMMENT ON COLUMN quote_items.proforma_amount_incl_vat IS 'Proforma amount including VAT (proforma currency)';
COMMENT ON COLUMN quote_items.proforma_amount_excl_vat_usd IS 'Proforma amount excluding VAT converted to USD';
COMMENT ON COLUMN quote_items.proforma_amount_incl_vat_usd IS 'Proforma amount including VAT converted to USD';
COMMENT ON COLUMN quote_items.purchasing_company_id IS 'Company used for purchasing from supplier';
COMMENT ON COLUMN quote_items.supplier_id IS 'Supplier for this product';
COMMENT ON COLUMN quote_items.purchasing_manager_id IS 'User who filled in purchasing details';


-- ============================================================
-- Part 3: New aggregated fields in `quote_calculation_summaries`
-- ============================================================

ALTER TABLE quote_calculation_summaries
ADD COLUMN IF NOT EXISTS calc_supplier_advance_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_purchase_with_vat_usd_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ah13_forex_risk_reserve_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ai13_financial_agent_fee_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ab13_cogs_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_y13_customs_duty_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_z13_excise_tax_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_an13_sales_vat_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ao13_import_vat_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ap13_net_vat_payable_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_aq13_transit_commission_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_ag13_dm_fee_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_internal_margin_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_tax_turkey_total DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS calc_tax_russia_total DECIMAL(15,2);

COMMENT ON COLUMN quote_calculation_summaries.calc_supplier_advance_total IS 'SUM(S16 × supplier_advance_percent) - Total supplier advance in USD';
COMMENT ON COLUMN quote_calculation_summaries.calc_purchase_with_vat_usd_total IS 'Total purchase amount with VAT in USD (before VAT clearing)';
COMMENT ON COLUMN quote_calculation_summaries.calc_ah13_forex_risk_reserve_total IS 'SUM(AH16) - Total forex risk reserve';
COMMENT ON COLUMN quote_calculation_summaries.calc_ai13_financial_agent_fee_total IS 'SUM(AI16) - Total financial agent commission';
COMMENT ON COLUMN quote_calculation_summaries.calc_ab13_cogs_total IS 'SUM(AB16) - Total COGS';
COMMENT ON COLUMN quote_calculation_summaries.calc_y13_customs_duty_total IS 'SUM(Y16) - Total customs duty';
COMMENT ON COLUMN quote_calculation_summaries.calc_z13_excise_tax_total IS 'SUM(Z16) - Total excise tax';
COMMENT ON COLUMN quote_calculation_summaries.calc_an13_sales_vat_total IS 'SUM(AN16) - Total sales VAT';
COMMENT ON COLUMN quote_calculation_summaries.calc_ao13_import_vat_total IS 'SUM(AO16) - Total import VAT (deductible)';
COMMENT ON COLUMN quote_calculation_summaries.calc_ap13_net_vat_payable_total IS 'SUM(AP16) - Total net VAT payable';
COMMENT ON COLUMN quote_calculation_summaries.calc_aq13_transit_commission_total IS 'SUM(AQ16) - Total transit commission';
COMMENT ON COLUMN quote_calculation_summaries.calc_ag13_dm_fee_total IS 'SUM(AG16) - Total DM (kickback) fee';
COMMENT ON COLUMN quote_calculation_summaries.calc_internal_margin_total IS 'SUM(AY16 - S16) - Total internal margin';
COMMENT ON COLUMN quote_calculation_summaries.calc_tax_turkey_total IS 'SUM(internal_margin × tax_rate_turkey) - Total Turkey income tax';
COMMENT ON COLUMN quote_calculation_summaries.calc_tax_russia_total IS 'SUM((profit - internal_margin) × tax_rate_russia) - Total Russia income tax';


-- ============================================================
-- Part 4: New admin variables in `calculation_settings`
-- ============================================================

ALTER TABLE calculation_settings
ADD COLUMN IF NOT EXISTS tax_rate_turkey DECIMAL(5,4) DEFAULT 0.25,
ADD COLUMN IF NOT EXISTS tax_rate_russia DECIMAL(5,4) DEFAULT 0.25;

COMMENT ON COLUMN calculation_settings.tax_rate_turkey IS 'Income tax rate in Turkey (default 25%)';
COMMENT ON COLUMN calculation_settings.tax_rate_russia IS 'Income tax rate in Russia (default 25%)';


-- ============================================================
-- Part 5: Update existing organization calculation settings
-- ============================================================

-- Set default tax rates for existing organizations that don't have them
UPDATE calculation_settings
SET
    tax_rate_turkey = COALESCE(tax_rate_turkey, 0.25),
    tax_rate_russia = COALESCE(tax_rate_russia, 0.25)
WHERE tax_rate_turkey IS NULL OR tax_rate_russia IS NULL;

