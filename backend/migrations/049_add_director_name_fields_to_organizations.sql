-- Migration 049: Add director name fields to organizations
-- Created: 2025-12-18
-- Purpose:
--   1. Add separate name fields for general director (like customer_contacts)
--   2. Allow formatting as "Фамилия И. О." for Russian business documents
--   3. Keep existing general_director_name for backward compatibility

-- ============================================================================
-- 1. ADD DIRECTOR NAME FIELDS
-- ============================================================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS general_director_last_name TEXT,
ADD COLUMN IF NOT EXISTS general_director_first_name TEXT,
ADD COLUMN IF NOT EXISTS general_director_patronymic TEXT;

-- Comments
COMMENT ON COLUMN organizations.general_director_last_name IS 'Director surname (фамилия) - e.g., Ермаков';
COMMENT ON COLUMN organizations.general_director_first_name IS 'Director first name (имя) - e.g., Иван';
COMMENT ON COLUMN organizations.general_director_patronymic IS 'Director patronymic (отчество) - e.g., Иванович';

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
--   general_director_last_name = Фамилия (Ермаков)
--   general_director_first_name = Имя (Иван)
--   general_director_patronymic = Отчество (Иванович)
--
-- Backward compatibility:
--   general_director_name field is kept for existing data
--   New fields take priority when formatting for export
