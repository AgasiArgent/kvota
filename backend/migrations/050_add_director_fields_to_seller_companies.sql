-- Migration 050: Add director fields to seller_companies
-- Created: 2025-12-18
-- Purpose:
--   1. Add director name fields (last_name, first_name, patronymic) for each seller company
--   2. Allow different seller companies to have different directors
--   3. Used in specification export for seller signatory

-- ============================================================================
-- 1. ADD DIRECTOR NAME FIELDS
-- ============================================================================

ALTER TABLE seller_companies
ADD COLUMN IF NOT EXISTS general_director_last_name TEXT,
ADD COLUMN IF NOT EXISTS general_director_first_name TEXT,
ADD COLUMN IF NOT EXISTS general_director_patronymic TEXT,
ADD COLUMN IF NOT EXISTS general_director_position TEXT DEFAULT 'Генеральный директор';

-- Comments
COMMENT ON COLUMN seller_companies.general_director_last_name IS 'Director surname (фамилия) - e.g., Ермаков';
COMMENT ON COLUMN seller_companies.general_director_first_name IS 'Director first name (имя) - e.g., Иван';
COMMENT ON COLUMN seller_companies.general_director_patronymic IS 'Director patronymic (отчество) - e.g., Иванович';
COMMENT ON COLUMN seller_companies.general_director_position IS 'Director position - default: Генеральный директор';

-- ============================================================================
-- NOTES
-- ============================================================================

-- Each seller company can have its own director for specification export
-- Format in documents: "Фамилия И. О." (e.g., "Ермаков И. И.")
--
-- Specification export now uses seller_company director instead of organization
