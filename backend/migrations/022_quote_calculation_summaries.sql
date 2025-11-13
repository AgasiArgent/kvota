-- Migration: Create quote_calculation_summaries table
-- Date: 2025-11-08
-- Purpose: Store pre-aggregated quote-level totals to fix mixed aggregation duplication
-- See: docs/plans/2025-11-08-quote-calculation-summaries-design.md

-- Helper function for RLS (if not exists)
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
  SELECT (current_setting('app.current_organization_id', true))::uuid;
$$ LANGUAGE SQL STABLE;

-- Create quote calculation summaries table
CREATE TABLE quote_calculation_summaries (
  quote_id UUID PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,

  -- Phase 1: Purchase Price Calculations (per quote totals)
  calc_n16_price_without_vat DECIMAL(15,2),
  calc_p16_after_supplier_discount DECIMAL(15,2),
  calc_r16_per_unit_quote_currency DECIMAL(15,2),
  calc_s16_total_purchase_price DECIMAL(15,2),

  -- Phase 2: Distribution Base (quote-level only)
  calc_s13_sum_purchase_prices DECIMAL(15,2),
  -- BD16 (distribution key) is internal calculation, not stored

  -- Phase 3: Logistics Distribution (per quote totals)
  calc_t16_first_leg_logistics DECIMAL(15,2),
  calc_u16_last_leg_logistics DECIMAL(15,2),
  calc_v16_total_logistics DECIMAL(15,2),

  -- Phase 4: Internal Pricing & Duties (per quote totals)
  calc_ax16_internal_price_unit DECIMAL(15,2),
  calc_ay16_internal_price_total DECIMAL(15,2),
  calc_y16_customs_duty DECIMAL(15,2),
  calc_z16_excise_tax DECIMAL(15,2),
  calc_az16_with_vat_restored DECIMAL(15,2),

  -- Phase 5: Supplier Payment (quote-level)
  calc_bh6_supplier_payment DECIMAL(15,2),
  calc_bh4_before_forwarding DECIMAL(15,2),

  -- Phase 6: Revenue Estimation (quote-level)
  calc_bh2_revenue_estimated DECIMAL(15,2),

  -- Phase 7: Financing Costs (quote-level)
  calc_bh3_client_advance DECIMAL(15,2),
  calc_bh7_supplier_financing_need DECIMAL(15,2),
  calc_bj7_supplier_financing_cost DECIMAL(15,2),
  calc_bh10_operational_financing DECIMAL(15,2),
  calc_bj10_operational_cost DECIMAL(15,2),
  calc_bj11_total_financing_cost DECIMAL(15,2),

  -- Phase 8: Credit Sales Interest (quote-level)
  calc_bl3_credit_sales_amount DECIMAL(15,2),
  calc_bl4_credit_sales_with_interest DECIMAL(15,2),
  calc_bl5_credit_sales_interest DECIMAL(15,2),

  -- Phase 9: Distribute Financing (per quote totals)
  calc_ba16_financing_per_product DECIMAL(15,2),
  calc_bb16_credit_interest_per_product DECIMAL(15,2),

  -- Phase 10: Final COGS (per quote totals)
  calc_aa16_cogs_per_unit DECIMAL(15,2),
  calc_ab16_cogs_total DECIMAL(15,2),

  -- Phase 11: Sales Price Calculation (per quote totals)
  calc_af16_profit_margin DECIMAL(10,4),  -- Stored as decimal (0.15 = 15%)
  calc_ag16_dm_fee DECIMAL(15,2),
  calc_ah16_forex_risk_reserve DECIMAL(15,2),
  calc_ai16_agent_fee DECIMAL(15,2),
  calc_ad16_sale_price_unit DECIMAL(15,2),
  calc_ae16_sale_price_total DECIMAL(15,2),
  calc_aj16_final_price_unit DECIMAL(15,2),
  calc_ak16_final_price_total DECIMAL(15,2),

  -- Phase 12: VAT Calculations (per quote totals)
  calc_am16_price_with_vat DECIMAL(15,2),
  calc_al16_total_with_vat DECIMAL(15,2),
  calc_an16_sales_vat DECIMAL(15,2),
  calc_ao16_deductible_vat DECIMAL(15,2),
  calc_ap16_net_vat_payable DECIMAL(15,2),

  -- Phase 13: Transit Commission (quote-level)
  calc_aq16_transit_commission DECIMAL(15,2),

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on quote_id (PRIMARY KEY automatically creates unique index)
CREATE INDEX idx_quote_calc_summaries_quote_id ON quote_calculation_summaries(quote_id);

-- Enable RLS
ALTER TABLE quote_calculation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - Users can see summaries for quotes in their organization
CREATE POLICY quote_calc_summaries_select ON quote_calculation_summaries
  FOR SELECT USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id = current_organization_id()
    )
  );

-- RLS Policy: INSERT - Users can create summaries for their organization's quotes
CREATE POLICY quote_calc_summaries_insert ON quote_calculation_summaries
  FOR INSERT WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id = current_organization_id()
    )
  );

-- RLS Policy: UPDATE - Users can update summaries for their organization's quotes
CREATE POLICY quote_calc_summaries_update ON quote_calculation_summaries
  FOR UPDATE USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id = current_organization_id()
    )
  );

-- RLS Policy: DELETE - Users can delete summaries for their organization's quotes
CREATE POLICY quote_calc_summaries_delete ON quote_calculation_summaries
  FOR DELETE USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id = current_organization_id()
    )
  );

-- Trigger: Auto-update updated_at
CREATE TRIGGER update_quote_calc_summaries_updated_at
  BEFORE UPDATE ON quote_calculation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE quote_calculation_summaries IS 'Pre-aggregated quote-level totals for analytics - eliminates JOIN duplication';
COMMENT ON COLUMN quote_calculation_summaries.quote_id IS 'Foreign key to quotes table (1:1 relationship)';
COMMENT ON COLUMN quote_calculation_summaries.calc_af16_profit_margin IS 'Profit margin calculated as (revenue - cogs) / revenue';
