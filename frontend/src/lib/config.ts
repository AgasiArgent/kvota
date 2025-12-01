/**
 * Application configuration
 * Centralized configuration for API endpoints and environment settings
 */

// Ensure API URL uses HTTPS in production (prevents Mixed Content errors)
function getApiUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // In production, ensure HTTPS is used
  // This handles cases where env var is incorrectly set with http://
  if (
    process.env.NODE_ENV === 'production' &&
    rawUrl.startsWith('http://') &&
    !rawUrl.includes('localhost')
  ) {
    return rawUrl.replace('http://', 'https://');
  }

  return rawUrl;
}

export const config = {
  // API Base URL - uses environment variable or fallback for local development
  // Automatically converts http:// to https:// in production to prevent Mixed Content errors
  apiUrl: getApiUrl(),

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
