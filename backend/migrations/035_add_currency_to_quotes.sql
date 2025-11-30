-- backend/migrations/035_add_currency_to_quotes.sql
-- Add currency column to quotes table for multi-currency support
-- 2025-11-25

-- Add currency column with default USD
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY'));

-- Add comment
COMMENT ON COLUMN quotes.currency IS 'Quote currency code (USD, EUR, RUB, TRY, CNY)';

-- Note: Existing quotes will default to USD. Currency is also stored in
-- quote_versions.quote_variables->>'currency_of_quote' for versioned quotes.
