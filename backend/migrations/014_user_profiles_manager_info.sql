-- ============================================================================
-- Migration: Add manager info to user_profiles
-- ============================================================================
-- This migration adds manager contact fields to user_profiles table
-- for automatic population in quote exports.
--
-- IMPORTANT: Run in Supabase SQL Editor
-- ============================================================================

-- Add manager info fields to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255);

-- Add index for quick lookups by user_id (already exists as PRIMARY KEY, but explicit for clarity)
-- CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
-- Note: This index is not needed as user_id is already the PRIMARY KEY

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that columns were added successfully
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
  AND column_name IN ('manager_name', 'manager_phone', 'manager_email')
ORDER BY column_name;

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
-- ALTER TABLE user_profiles
-- DROP COLUMN IF EXISTS manager_name,
-- DROP COLUMN IF EXISTS manager_phone,
-- DROP COLUMN IF EXISTS manager_email;
