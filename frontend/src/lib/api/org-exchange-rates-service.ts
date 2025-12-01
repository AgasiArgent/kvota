/**
 * Organization Exchange Rates API Service
 *
 * Handles CRUD operations for organization-specific exchange rates.
 */

import { createClient } from '@/lib/supabase/client';

// Types
export interface OrgExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  updated_at: string;
  updated_by_email?: string | null;
}

export interface OrgExchangeRateSettings {
  use_manual_exchange_rates: boolean;
  default_input_currency: string;
  rates: OrgExchangeRate[];
}

export interface UpdateRateRequest {
  rate: number;
}

export interface UpdateSettingsRequest {
  use_manual_exchange_rates: boolean;
}

export interface SyncResponse {
  success: boolean;
  rates_synced: number;
  message: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authenticated headers
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get organization's exchange rate settings and current rates
 */
export async function getOrgExchangeRates(): Promise<OrgExchangeRateSettings> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/exchange-rates/org`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to fetch exchange rate settings');
  }

  return response.json();
}

/**
 * Toggle manual exchange rates on/off
 * Admin only
 */
export async function updateExchangeRateSettings(
  settings: UpdateSettingsRequest
): Promise<{ success: boolean; use_manual_exchange_rates: boolean }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/exchange-rates/org/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update settings');
  }

  return response.json();
}

/**
 * Update a specific exchange rate
 * Admin only
 *
 * @param currency - Currency code (EUR, RUB, TRY, CNY)
 * @param rate - Exchange rate to USD
 */
export async function updateOrgRate(
  currency: string,
  rate: number
): Promise<{ success: boolean; currency: string; rate: number; source: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/exchange-rates/org/${currency}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ rate }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to update ${currency} rate`);
  }

  return response.json();
}

/**
 * Sync all rates from CBR to organization's rate table
 * Admin only
 */
export async function syncRatesFromCBR(): Promise<SyncResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/api/exchange-rates/org/sync`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to sync rates from CBR');
  }

  return response.json();
}
