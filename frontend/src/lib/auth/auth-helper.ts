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

/**
 * Get authentication headers for API requests
 * @returns Headers object with Authorization and Content-Type
 * @throws Error if not authenticated
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
