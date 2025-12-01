-- Rollback: Make delivery_date optional again
-- Date: 2025-11-24

-- Remove constraint
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS check_delivery_after_quote_date;

-- Make column nullable
ALTER TABLE quotes ALTER COLUMN delivery_date DROP NOT NULL;

-- Restore original comment
COMMENT ON COLUMN quotes.delivery_date IS 'Expected delivery date';

-- Note: We intentionally DO NOT delete the delivery_date values
-- The data is valuable even if the column becomes optional again
