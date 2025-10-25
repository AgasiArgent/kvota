-- Migration: Add last_name to customer_contacts
-- Date: 2025-10-25
-- Description: Split contact name into first_name and last_name

-- Add last_name column
ALTER TABLE customer_contacts
ADD COLUMN last_name TEXT;

-- Add comment
COMMENT ON COLUMN customer_contacts.last_name IS 'Contact last name/surname';
