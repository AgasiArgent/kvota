-- ============================================================================
-- Migration: Auto-create user profile on registration
-- ============================================================================
-- This migration adds a trigger to automatically create a user_profiles record
-- when a new user signs up via Supabase Auth.
--
-- IMPORTANT: This must be run in Supabase SQL Editor
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user profile with metadata from auth.users
    INSERT INTO public.user_profiles (
        user_id,
        full_name,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NOW(),
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Backfill existing users without profiles
-- ============================================================================
-- This will create profiles for users who registered before this migration

INSERT INTO public.user_profiles (user_id, full_name, created_at, updated_at)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', ''),
    u.created_at,
    NOW()
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- ============================================================================
-- Verification
-- ============================================================================

-- Count auth users vs profiles (should be equal)
SELECT
    (SELECT COUNT(*) FROM auth.users) as auth_users,
    (SELECT COUNT(*) FROM public.user_profiles) as user_profiles,
    CASE
        WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.user_profiles)
        THEN '✅ All users have profiles'
        ELSE '❌ Profile count mismatch'
    END as status;
