-- backend/migrations/034_rollback.sql
-- Rollback: Multi-Currency Support
-- Created: 2025-11-25

-- Drop version tracking from quotes
ALTER TABLE quotes
DROP COLUMN IF EXISTS current_version_id,
DROP COLUMN IF EXISTS total_usd,
DROP COLUMN IF EXISTS total_quote_currency,
DROP COLUMN IF EXISTS last_calculated_at,
DROP COLUMN IF EXISTS version_count;

-- Drop quote_versions table (policies are dropped automatically)
DROP TABLE IF EXISTS quote_versions;

-- Remove exchange rate columns from calculation_settings
ALTER TABLE calculation_settings
DROP COLUMN IF EXISTS use_manual_exchange_rates,
DROP COLUMN IF EXISTS default_input_currency;

-- Drop organization_exchange_rates table (policies are dropped automatically)
DROP TABLE IF EXISTS organization_exchange_rates;

-- Drop helper function
DROP FUNCTION IF EXISTS current_organization_id();
