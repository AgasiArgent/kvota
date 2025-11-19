/**
 * Organization Cache Utility
 * Caches organization list and current org selection in localStorage
 * TTL: 5 minutes
 */

import { UserOrganization } from '@/lib/types/organization';

const CACHE_KEY = 'kvota_organization_cache';
const TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export interface OrganizationCache {
  organizations: UserOrganization[];
  currentOrgId: string | null;
  lastFetch: number;
}

/**
 * Get cached organization data
 * Returns null if cache is expired or doesn't exist
 */
export function getOrganizationCache(): OrganizationCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: OrganizationCache = JSON.parse(cached);

    // Check if cache is expired
    const now = Date.now();
    if (now - data.lastFetch > TTL) {
      // Cache expired - remove it
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading organization cache:', error);
    return null;
  }
}

/**
 * Set organization cache
 */
export function setOrganizationCache(
  organizations: UserOrganization[],
  currentOrgId: string | null
): void {
  try {
    const data: OrganizationCache = {
      organizations,
      currentOrgId,
      lastFetch: Date.now(),
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error setting organization cache:', error);
  }
}

/**
 * Update only the current organization ID in cache
 * (Used when switching organizations)
 */
export function updateCurrentOrgId(orgId: string): void {
  try {
    const cached = getOrganizationCache();
    if (cached) {
      cached.currentOrgId = orgId;
      cached.lastFetch = Date.now(); // Reset TTL on switch
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    }
  } catch (error) {
    console.error('Error updating current org ID:', error);
  }
}

/**
 * Clear organization cache
 * (Used on logout or when forcing refresh)
 */
export function clearOrganizationCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Error clearing organization cache:', error);
  }
}

/**
 * Check if cache is valid (exists and not expired)
 */
export function isCacheValid(): boolean {
  const cached = getOrganizationCache();
  return cached !== null;
}
