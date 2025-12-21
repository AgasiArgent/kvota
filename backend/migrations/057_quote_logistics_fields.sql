-- Migration 057: Quote Logistics & Purchasing Fields
-- Date: 2025-12-21
-- Purpose: Add delivery city, cargo type, pickup country (per-product), supplier payment country (per-product)
--
-- New fields based on user requirements mapping:
-- 1. delivery_city - Quote-level, entered by sales manager
-- 2. cargo_type - Quote-level, FCL/LCL/AIR/RAIL
-- 3. pickup_country - Per-product, where cargo is picked up (can differ between products)
-- 4. supplier_payment_country - Per-product, where we pay supplier (defaults to pickup_country)
-- 5. purchasing_companies table - Reference table for our purchasing legal entities

-- =============================================================================
-- 1. Create purchasing_companies reference table (if not exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS purchasing_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_name TEXT,
    country TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- Enable RLS (only if table was just created)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'purchasing_companies'
    ) THEN
        ALTER TABLE purchasing_companies ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "purchasing_companies_select_policy" ON purchasing_companies
        FOR SELECT USING (organization_id = current_organization_id());

        CREATE POLICY "purchasing_companies_insert_policy" ON purchasing_companies
        FOR INSERT WITH CHECK (organization_id = current_organization_id());

        CREATE POLICY "purchasing_companies_update_policy" ON purchasing_companies
        FOR UPDATE USING (organization_id = current_organization_id());

        CREATE POLICY "purchasing_companies_delete_policy" ON purchasing_companies
        FOR DELETE USING (organization_id = current_organization_id());
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchasing_companies_org ON purchasing_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_companies_country ON purchasing_companies(country);

-- Trigger for updated_at (if not exists)
DROP TRIGGER IF EXISTS update_purchasing_companies_updated_at ON purchasing_companies;
CREATE TRIGGER update_purchasing_companies_updated_at
    BEFORE UPDATE ON purchasing_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE purchasing_companies IS 'Reference table for our purchasing companies (like seller_companies). Limited list of legal entities used for supplier payments.';
COMMENT ON COLUMN purchasing_companies.country IS 'Country where this company is registered and makes payments from';

-- =============================================================================
-- 2. Add quote-level fields
-- =============================================================================

-- Delivery city in Russia (entered by sales manager at quote creation)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_city TEXT;
COMMENT ON COLUMN quotes.delivery_city IS 'Delivery destination city in Russia, entered by sales manager at quote creation';

-- Cargo type (FCL = full container, LCL = partial/consolidated, AIR = air freight, RAIL = railway)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'cargo_type'
    ) THEN
        ALTER TABLE quotes ADD COLUMN cargo_type TEXT;
        ALTER TABLE quotes ADD CONSTRAINT quotes_cargo_type_check
            CHECK (cargo_type IS NULL OR cargo_type IN ('FCL', 'LCL', 'AIR', 'RAIL'));
    END IF;
END $$;
COMMENT ON COLUMN quotes.cargo_type IS 'Cargo type: FCL (full container), LCL (consolidated), AIR (air freight), RAIL (railway)';

-- =============================================================================
-- 3. Add product-level fields
-- =============================================================================

-- Pickup country (where cargo is physically picked up from supplier)
-- This can differ between products in the same quote
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS pickup_country TEXT;
COMMENT ON COLUMN quote_items.pickup_country IS 'Country where cargo is picked up from supplier. Per-product field. Aggregated as comma-separated list at quote level (e.g., "Romania, Turkey, Latvia").';

-- Supplier payment country (country where we pay the supplier)
-- Defaults to pickup_country but can differ (e.g., supplier in Romania but payment to Turkey account)
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS supplier_payment_country TEXT;
COMMENT ON COLUMN quote_items.supplier_payment_country IS 'Country where we pay the supplier. Defaults to pickup_country but can differ if supplier has payment account in another country.';

-- Purchasing company (our legal entity that pays the supplier for this product)
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS purchasing_company_id UUID REFERENCES purchasing_companies(id);
COMMENT ON COLUMN quote_items.purchasing_company_id IS 'Our purchasing legal entity used to pay supplier for this product. References purchasing_companies table.';

-- Index for purchasing company lookups
CREATE INDEX IF NOT EXISTS idx_quote_items_purchasing_company ON quote_items(purchasing_company_id);

-- =============================================================================
-- 4. Seed default purchasing companies (same structure as seller_companies)
-- =============================================================================

-- These will be seeded per-organization when needed, similar to how seller_companies work
-- For now, just document the expected companies:
--
-- Example companies (to be seeded per org):
-- 1. МАСТЕР БЭРИНГ ООО (Russia) - RUB payments
-- 2. TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ (Turkey) - USD/EUR payments
-- 3. UPDOOR Limited (China/HK) - USD/CNY payments

-- =============================================================================
-- 5. Add helper function for production time range
-- =============================================================================

CREATE OR REPLACE FUNCTION get_quote_production_time_range(p_quote_id UUID)
RETURNS TEXT AS $$
DECLARE
    min_days INTEGER;
    max_days INTEGER;
BEGIN
    SELECT
        MIN(production_time_days),
        MAX(production_time_days)
    INTO min_days, max_days
    FROM quote_items
    WHERE quote_id = p_quote_id
      AND production_time_days IS NOT NULL;

    IF min_days IS NULL THEN
        RETURN NULL;
    ELSIF min_days = max_days THEN
        RETURN min_days::TEXT || ' дн.';
    ELSE
        RETURN min_days::TEXT || '-' || max_days::TEXT || ' дн.';
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_quote_production_time_range IS 'Returns production time as range string (e.g., "15-150 дн.") for display in quote lists';

-- Function: Get unique pickup countries as comma-separated list
CREATE OR REPLACE FUNCTION get_quote_pickup_countries(p_quote_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT STRING_AGG(DISTINCT pickup_country, ', ' ORDER BY pickup_country)
        FROM quote_items
        WHERE quote_id = p_quote_id
          AND pickup_country IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_quote_pickup_countries IS 'Returns unique pickup countries as comma-separated string (e.g., "Latvia, Romania, Turkey")';

-- Function: Get unique supplier payment countries as comma-separated list
CREATE OR REPLACE FUNCTION get_quote_supplier_payment_countries(p_quote_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT STRING_AGG(DISTINCT supplier_payment_country, ', ' ORDER BY supplier_payment_country)
        FROM quote_items
        WHERE quote_id = p_quote_id
          AND supplier_payment_country IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_quote_supplier_payment_countries IS 'Returns unique supplier payment countries as comma-separated string';

-- Function: Get unique purchasing companies as comma-separated list
CREATE OR REPLACE FUNCTION get_quote_purchasing_companies(p_quote_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT STRING_AGG(DISTINCT pc.short_name, ', ' ORDER BY pc.short_name)
        FROM quote_items qi
        JOIN purchasing_companies pc ON qi.purchasing_company_id = pc.id
        WHERE qi.quote_id = p_quote_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_quote_purchasing_companies IS 'Returns unique purchasing company names as comma-separated string';

-- Index for pickup country searches
CREATE INDEX IF NOT EXISTS idx_quote_items_pickup_country ON quote_items(pickup_country) WHERE pickup_country IS NOT NULL;

-- =============================================================================
-- 6. Derived columns for list_query_builder.py (backend implementation notes)
-- =============================================================================

-- The backend list_query_builder.py will need to add these derived columns:
--
-- | field                        | SQL                                              | Description                          |
-- |------------------------------|--------------------------------------------------|--------------------------------------|
-- | production_time_range        | get_quote_production_time_range(q.id)            | "15-150 дн." range display           |
-- | pickup_countries             | get_quote_pickup_countries(q.id)                 | "Latvia, Romania, Turkey"            |
-- | supplier_payment_countries   | get_quote_supplier_payment_countries(q.id)       | "Romania, Turkey"                    |
-- | purchasing_companies_list    | get_quote_purchasing_companies(q.id)             | "MB, TEXCEL, UPDOOR"                 |
-- | delivery_city                | q.delivery_city                                  | Direct column                        |
-- | cargo_type                   | q.cargo_type                                     | Direct column (FCL/LCL/AIR/RAIL)     |

-- Done!
