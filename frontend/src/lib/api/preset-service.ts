/**
 * List Presets API Service
 *
 * TASK-008: Quote List Constructor with Department Presets
 *
 * This service provides hooks for managing list presets (column configurations).
 */

import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { config } from '@/lib/config';

// =============================================================================
// Types
// =============================================================================

export type PresetType = 'system' | 'org' | 'personal';

export interface ListPreset {
  id: string;
  organization_id: string | null;
  name: string;
  preset_type: PresetType;
  department: string | null;
  created_by: string | null;
  columns: ColumnConfig[];
  filters: Record<string, unknown> | null;
  sort_model: Array<{ colId: string; sort: 'asc' | 'desc' }> | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ColumnConfig {
  field: string;
  hide?: boolean;
  width?: number;
  pinned?: 'left' | 'right' | null;
  sort?: 'asc' | 'desc' | null;
  sortIndex?: number;
}

export interface CreatePresetParams {
  name: string;
  preset_type: 'org' | 'personal';
  department?: string;
  columns: ColumnConfig[];
  filters?: Record<string, unknown>;
  sort_model?: Array<{ colId: string; sort: 'asc' | 'desc' }>;
  is_default?: boolean;
}

export interface UpdatePresetParams {
  name?: string;
  department?: string;
  columns?: ColumnConfig[];
  filters?: Record<string, unknown>;
  sort_model?: Array<{ colId: string; sort: 'asc' | 'desc' }>;
  is_default?: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch all available presets (system + org + personal)
 */
export async function fetchPresets(): Promise<ListPreset[]> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/api/list-presets/`, {
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
 * Get a single preset by ID
 */
export async function fetchPreset(id: string): Promise<ListPreset> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/api/list-presets/${id}`, {
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
 * Create a new preset
 */
export async function createPreset(params: CreatePresetParams): Promise<ListPreset> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/api/list-presets/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Update an existing preset
 */
export async function updatePreset(id: string, params: UpdatePresetParams): Promise<ListPreset> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/api/list-presets/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a preset
 */
export async function deletePreset(id: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${config.apiUrl}/api/list-presets/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}

// =============================================================================
// React Hooks
// =============================================================================

export interface UsePresetsResult {
  presets: ListPreset[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createPreset: (params: CreatePresetParams) => Promise<ListPreset>;
  updatePreset: (id: string, params: UpdatePresetParams) => Promise<ListPreset>;
  deletePreset: (id: string) => Promise<void>;
}

/**
 * Hook for managing list presets
 */
export function usePresets(): UsePresetsResult {
  const [presets, setPresets] = useState<ListPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchPresets();
        if (!cancelled) {
          setPresets(result);
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
  }, [refreshKey]);

  const handleCreatePreset = useCallback(async (params: CreatePresetParams) => {
    const newPreset = await createPreset(params);
    setPresets((prev) => [...prev, newPreset]);
    return newPreset;
  }, []);

  const handleUpdatePreset = useCallback(async (id: string, params: UpdatePresetParams) => {
    const updated = await updatePreset(id, params);
    setPresets((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const handleDeletePreset = useCallback(async (id: string) => {
    await deletePreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    presets,
    isLoading,
    error,
    refetch,
    createPreset: handleCreatePreset,
    updatePreset: handleUpdatePreset,
    deletePreset: handleDeletePreset,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Group presets by type
 */
export function groupPresetsByType(presets: ListPreset[]): {
  system: ListPreset[];
  org: ListPreset[];
  personal: ListPreset[];
} {
  return {
    system: presets.filter((p) => p.preset_type === 'system'),
    org: presets.filter((p) => p.preset_type === 'org'),
    personal: presets.filter((p) => p.preset_type === 'personal'),
  };
}

/**
 * Get columns from preset for ag-Grid
 *
 * Handles both old format (array of ColumnConfig) and new format
 * (object with columnDefs and columnOrder)
 */
export function getColumnsFromPreset(preset: ListPreset): string[] {
  if (!preset.columns) {
    return [];
  }

  // Handle new format: { columnDefs: [...], columnOrder: [...] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = preset.columns as any;
  if (columns.columnDefs && Array.isArray(columns.columnDefs)) {
    // Use columnOrder if available, otherwise extract from columnDefs
    if (columns.columnOrder && Array.isArray(columns.columnOrder)) {
      // Filter out hidden columns
      const hiddenFields = new Set(
        columns.columnDefs
          .filter((col: ColumnConfig) => col.hide)
          .map((col: ColumnConfig) => col.field)
      );
      return columns.columnOrder.filter((field: string) => !hiddenFields.has(field));
    }
    return columns.columnDefs
      .filter((col: ColumnConfig) => !col.hide)
      .map((col: ColumnConfig) => col.field);
  }

  // Handle old format: array of ColumnConfig
  if (Array.isArray(preset.columns)) {
    return preset.columns.filter((col) => !col.hide).map((col) => col.field);
  }

  return [];
}

/**
 * Get preset icon based on department
 */
export function getPresetIcon(department: string | null): string {
  switch (department) {
    case 'sales':
      return '💼';
    case 'logistics':
      return '🚚';
    case 'accounting':
      return '📊';
    case 'management':
      return '👔';
    default:
      return '📋';
  }
}

/**
 * Get preset label based on type
 */
export function getPresetTypeLabel(type: PresetType): string {
  switch (type) {
    case 'system':
      return 'Системный';
    case 'org':
      return 'Общий';
    case 'personal':
      return 'Личный';
  }
}

// Local storage key for last used preset
const LAST_PRESET_KEY = 'quotes_list_last_preset';

/**
 * Get last used preset ID from localStorage
 */
export function getLastPresetId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_PRESET_KEY);
}

/**
 * Save last used preset ID to localStorage
 */
export function saveLastPresetId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_PRESET_KEY, id);
}
