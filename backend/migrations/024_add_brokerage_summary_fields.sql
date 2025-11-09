-- Migration: Add brokerage fields to quote_calculation_summaries
-- Date: 2025-11-08
-- Purpose: Add separate brokerage total and combined logistics+brokerage fields

ALTER TABLE quote_calculation_summaries
  ADD COLUMN calc_total_brokerage DECIMAL(15,2),
  ADD COLUMN calc_total_logistics_and_brokerage DECIMAL(15,2);

COMMENT ON COLUMN quote_calculation_summaries.calc_total_brokerage IS 'Total brokerage/customs fees (brokerage_hub + brokerage_customs + warehousing + docs + extra)';
COMMENT ON COLUMN quote_calculation_summaries.calc_total_logistics_and_brokerage IS 'Combined logistics (V16) + brokerage for user convenience';
