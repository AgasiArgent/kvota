-- Migration 025: Calculation Engine Updates (2025-11-09)
--
-- Changes:
-- 1. New supplier_countries reference table with VAT rates and internal markup
-- 2. New admin variables: rate_loan_interest_annual, customs_logistics_pmt_due
-- 3. Updated calculation logic for Y16, AO16, BH4, BI7, BI10
--
-- Related: Calculation engine logic overhaul (simplified financing, updated VAT)

-- ============================================================================
-- 1. CREATE SUPPLIER_COUNTRIES REFERENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_countries (
    code VARCHAR(50) PRIMARY KEY,
    name_ru VARCHAR(100) NOT NULL UNIQUE,
    vat_rate DECIMAL(5,4) NOT NULL CHECK (vat_rate >= 0 AND vat_rate <= 1),
    internal_markup_ru DECIMAL(5,4) NOT NULL CHECK (internal_markup_ru >= 0 AND internal_markup_ru <= 1),
    internal_markup_tr DECIMAL(5,4) NOT NULL CHECK (internal_markup_tr >= 0 AND internal_markup_tr <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE supplier_countries IS 'Reference table for supplier countries with VAT rates and internal markup percentages';
COMMENT ON COLUMN supplier_countries.vat_rate IS 'VAT rate in supplier country (0.20 = 20%)';
COMMENT ON COLUMN supplier_countries.internal_markup_ru IS 'Internal markup when selling from Russian entity (0.02 = 2%)';
COMMENT ON COLUMN supplier_countries.internal_markup_tr IS 'Internal markup when selling from Turkish entity (0.00 = 0%)';

-- ============================================================================
-- 2. INSERT SUPPLIER COUNTRIES DATA
-- ============================================================================

INSERT INTO supplier_countries (code, name_ru, vat_rate, internal_markup_ru, internal_markup_tr) VALUES
('turkey', 'Турция', 0.2000, 0.0200, 0.0000),
('turkey_transit', 'Турция (отгрузка на транзитной зоне)', 0.0000, 0.0200, 0.0000),
('eu_cross_border', 'ЕС (закупка между странами ЕС)', 0.0000, 0.0400, 0.0200),
('russia', 'Россия', 0.2000, 0.0000, 0.0000),
('china', 'Китай', 0.1300, 0.0200, 0.0000),
('lithuania', 'Литва', 0.2100, 0.0400, 0.0200),
('latvia', 'Латвия', 0.2100, 0.0400, 0.0200),
('bulgaria', 'Болгария', 0.2000, 0.0400, 0.0200),
('poland', 'Польша', 0.2300, 0.0400, 0.0200),
('uae', 'ОАЭ', 0.0500, 0.0300, 0.0100),
('other', 'Прочие', 0.0000, 0.0200, 0.0000)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. ADD NEW ADMIN VARIABLES TO CALCULATION_SETTINGS
-- ============================================================================

-- Add rate_loan_interest_annual (replaces daily calculation)
ALTER TABLE calculation_settings
ADD COLUMN IF NOT EXISTS rate_loan_interest_annual DECIMAL(5,4) DEFAULT 0.2500
CHECK (rate_loan_interest_annual >= 0 AND rate_loan_interest_annual <= 1);

-- Add customs_logistics_pmt_due (payment term in days)
ALTER TABLE calculation_settings
ADD COLUMN IF NOT EXISTS customs_logistics_pmt_due INTEGER DEFAULT 10
CHECK (customs_logistics_pmt_due >= 0 AND customs_logistics_pmt_due <= 365);

-- Add comments
COMMENT ON COLUMN calculation_settings.rate_loan_interest_annual IS 'Annual loan interest rate (0.25 = 25% per year). Daily rate calculated as annual/365';
COMMENT ON COLUMN calculation_settings.customs_logistics_pmt_due IS 'Payment term for customs and logistics costs (days). Used in BI10 formula';

-- Update existing rows with default values
UPDATE calculation_settings
SET rate_loan_interest_annual = 0.2500,
    customs_logistics_pmt_due = 10
WHERE rate_loan_interest_annual IS NULL
   OR customs_logistics_pmt_due IS NULL;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_countries_name_ru
ON supplier_countries(name_ru);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS on supplier_countries
ALTER TABLE supplier_countries ENABLE ROW LEVEL SECURITY;

-- Public read access (reference table, no organization filtering needed)
CREATE POLICY "Public can view supplier countries"
ON supplier_countries FOR SELECT
TO authenticated
USING (true);

-- Only superadmin can modify (via backend service role)
CREATE POLICY "Only service role can modify supplier countries"
ON supplier_countries FOR ALL
USING (false);

-- ============================================================================
-- 6. UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_supplier_countries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_supplier_countries_updated_at
BEFORE UPDATE ON supplier_countries
FOR EACH ROW
EXECUTE FUNCTION update_supplier_countries_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check supplier_countries data
-- SELECT * FROM supplier_countries ORDER BY name_ru;

-- Check calculation_settings updated
-- SELECT organization_id, rate_loan_interest_annual, customs_logistics_pmt_due
-- FROM calculation_settings LIMIT 5;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- DROP TABLE IF EXISTS supplier_countries CASCADE;
-- ALTER TABLE calculation_settings DROP COLUMN IF EXISTS rate_loan_interest_annual;
-- ALTER TABLE calculation_settings DROP COLUMN IF EXISTS customs_logistics_pmt_due;
