/**
 * Application configuration
 * Centralized configuration for API endpoints and environment settings
 */

export const config = {
  // API Base URL - uses environment variable or fallback for local development
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',

  // Environment
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',

  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
} as const;

// Helper function to get full API endpoint
export function getApiEndpoint(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiUrl}${normalizedPath}`;
}
