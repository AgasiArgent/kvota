/**
 * Quotes List API Service
 *
 * TASK-008: Quote List Constructor with Department Presets
 *
 * This service provides hooks for fetching quotes with dynamic columns.
 * Uses the /api/quotes-list backend API with preset support.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { config } from '@/lib/config';

// =============================================================================
// Types
// =============================================================================

export interface ListQueryParams {
  /** Column fields to fetch */
  columns: string[];
  /** Filter conditions */
  filters?: Record<string, unknown>;
  /** Sort model */
  sortModel?: Array<{ colId: string; sort: 'asc' | 'desc' }>;
  /** Page number (1-indexed) */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Preset ID to use */
  presetId?: string;
}

export interface ListResponse {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ColumnsResponse {
  columns: Record<string, { type: string; source: string }>;
}

export interface UseQuotesListResult {
  data: ListResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch quotes list with dynamic columns
 */
export async function fetchQuotesList(params: ListQueryParams): Promise<ListResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  // Use preset endpoint if presetId is provided
  if (params.presetId) {
    const queryParams = new URLSearchParams({
      page: String(params.page || 1),
      page_size: String(params.pageSize || 50),
    });

    if (params.filters && Object.keys(params.filters).length > 0) {
      queryParams.set('filters', JSON.stringify(params.filters));
    }

    if (params.sortModel && params.sortModel.length > 0) {
      queryParams.set('sort', JSON.stringify(params.sortModel));
    }

    const response = await fetch(
      `${config.apiUrl}/api/quotes-list/preset/${params.presetId}?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Use POST endpoint for custom column selection
  const response = await fetch(`${config.apiUrl}/api/quotes-list/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      columns: params.columns,
      filters: params.filters || null,
      sort_model: params.sortModel || null,
      page: params.page || 1,
      page_size: params.pageSize || 50,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get available columns for list constructor
 */
export async function fetchAvailableColumns(): Promise<ColumnsResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/api/quotes-list/columns`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Export quotes list to CSV
 */
export async function exportQuotesList(
  params: ListQueryParams,
  format: 'csv' | 'xlsx' = 'csv'
): Promise<Blob> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/api/quotes-list/export?format=${format}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      columns: params.columns,
      filters: params.filters || null,
      sort_model: params.sortModel || null,
      page: 1,
      page_size: 10000, // Export up to 10k rows
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.blob();
}

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook for fetching quotes list with dynamic columns
 *
 * Uses fetch ID pattern instead of cancelled flag to handle React 18 Strict Mode
 * and multiple re-renders without losing data from successful fetches.
 */
export function useQuotesList(params: ListQueryParams): UseQuotesListResult {
  const [data, setData] = useState<ListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Track component mount state
  const isMountedRef = useRef(true);
  // Track current fetch to avoid stale results from older fetches
  const fetchIdRef = useRef(0);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Track mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Skip fetching if no columns specified (wait for preset to load)
    if (!params.columns || params.columns.length === 0) {
      setIsLoading(false);
      return;
    }

    // Increment fetch ID to identify this specific fetch
    const currentFetchId = ++fetchIdRef.current;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchQuotesList(params);
        // Only update state if this is still the current fetch and component is mounted
        if (isMountedRef.current && fetchIdRef.current === currentFetchId) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMountedRef.current && fetchIdRef.current === currentFetchId) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    }

    load();

    // No cleanup needed - we use fetchIdRef to ignore stale results
  }, [
    // Deep dependency check for params
    JSON.stringify(params.columns),
    JSON.stringify(params.filters),
    JSON.stringify(params.sortModel),
    params.page,
    params.pageSize,
    params.presetId,
    refreshKey,
  ]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook for fetching available columns
 */
export function useAvailableColumns() {
  const [columns, setColumns] = useState<ColumnsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchAvailableColumns();
        if (!cancelled) {
          setColumns(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { columns, isLoading, error };
}
