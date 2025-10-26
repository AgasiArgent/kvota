-- Migration 015: Exchange Rates Table
-- Created: 2025-10-26
-- Purpose: Store exchange rates from Central Bank of Russia (CBR) API
--          with caching and daily automatic updates

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(10,6) NOT NULL,
  source VARCHAR(50) DEFAULT 'cbr',
  fetched_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE exchange_rates IS 'Exchange rates from CBR API with 24-hour caching';

-- Add comments to columns
COMMENT ON COLUMN exchange_rates.from_currency IS 'Source currency code (e.g., USD)';
COMMENT ON COLUMN exchange_rates.to_currency IS 'Target currency code (e.g., RUB)';
COMMENT ON COLUMN exchange_rates.rate IS 'Exchange rate (6 decimal precision)';
COMMENT ON COLUMN exchange_rates.source IS 'Data source (cbr = Central Bank of Russia)';
COMMENT ON COLUMN exchange_rates.fetched_at IS 'When the rate was fetched from API';

-- Index for quick lookups (most recent rates first)
CREATE INDEX idx_exchange_rates_lookup
  ON exchange_rates(from_currency, to_currency, fetched_at DESC);

-- Index for cleanup queries (old data removal)
CREATE INDEX idx_exchange_rates_cleanup
  ON exchange_rates(fetched_at);

-- Enable Row Level Security
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Public read access (exchange rates are public data)
-- No organization filtering needed - rates are global
CREATE POLICY "Anyone can read exchange rates"
  ON exchange_rates FOR SELECT
  USING (true);

-- Only service role can insert/update/delete
-- This prevents users from manually adding fake rates
CREATE POLICY "Service role can manage exchange rates"
  ON exchange_rates FOR ALL
  USING (auth.role() = 'service_role');
