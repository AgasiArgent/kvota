-- Migration: Fix exchange rates constraints
-- Date: 2025-11-15
-- Issue: AUD and other currencies are being rejected by check constraint
-- Solution: Remove restrictive check constraint and handle duplicates with UPSERT

-- Drop the restrictive check constraint if it exists
-- Note: This constraint was likely added in Supabase directly, not in our migrations
ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_from_currency_check;
ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_to_currency_check;

-- Drop the existing unique constraint that's causing issues
DROP INDEX IF EXISTS idx_exchange_rates_unique_rate;

-- Add a more flexible unique constraint that allows updates
-- This ensures only one rate per currency pair per exact timestamp
CREATE UNIQUE INDEX idx_exchange_rates_unique
ON exchange_rates(from_currency, to_currency, fetched_at);

-- Add comment explaining the constraint
COMMENT ON INDEX idx_exchange_rates_unique IS
'Ensures one rate per currency pair per timestamp, allowing updates via ON CONFLICT';

-- Verify the changes
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'exchange_rates'::regclass;