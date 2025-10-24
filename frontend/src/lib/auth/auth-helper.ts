/**
 * Authentication Helper Functions
 * Utilities for working with Supabase auth sessions
 */

import { createClient } from '@/lib/supabase/client';

/**
 * Get auth token from current Supabase session
 * @returns JWT access token
 * @throws Error if not authenticated
 */
export async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return session.access_token;
}
