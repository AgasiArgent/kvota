-- Migration 048: Add patronymic to customer_contacts
-- Created: 2025-12-18
-- Purpose:
--   1. Add patronymic (отчество) column to customer_contacts
--   2. Allow formatting as "Фамилия И. О." for Russian business documents

-- ============================================================================
-- 1. ADD PATRONYMIC COLUMN
-- ============================================================================

ALTER TABLE customer_contacts
ADD COLUMN IF NOT EXISTS patronymic TEXT;

-- Comment
COMMENT ON COLUMN customer_contacts.patronymic IS 'Contact patronymic (отчество) - middle name derived from father''s first name';

-- ============================================================================
-- 2. UPDATE COMMENT ON NAME FIELDS FOR CLARITY
-- ============================================================================

COMMENT ON COLUMN customer_contacts.name IS 'Contact first name (имя) - e.g., Иван';
COMMENT ON COLUMN customer_contacts.last_name IS 'Contact last name/surname (фамилия) - e.g., Ермаков';

-- ============================================================================
-- NOTES
-- ============================================================================

-- Russian name format for business documents:
--
-- Full format: "Фамилия Имя Отчество"
--   e.g., "Ермаков Иван Иванович"
--
-- Short format (for signatures): "Фамилия И. О."
--   e.g., "Ермаков И. И."
--
-- Fields mapping:
--   last_name = Фамилия (Ермаков)
--   name = Имя (Иван)
--   patronymic = Отчество (Иванович)
--
-- Usage in specification export:
--   customer_signatory_name should be formatted as "Ермаков И. И."
--   using: format_signatory_name_short(last_name, name, patronymic)
