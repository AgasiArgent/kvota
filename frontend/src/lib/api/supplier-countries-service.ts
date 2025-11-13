/**
 * Supplier Countries API Service
 *
 * Provides access to supplier countries reference data including
 * VAT rates and internal markup percentages.
 *
 * Created: 2025-11-09
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface SupplierCountry {
  code: string;
  name_ru: string;
  vat_rate: number;
  internal_markup_ru: number;
  internal_markup_tr: number;
}

/**
 * Get all supplier countries
 *
 * Returns list of countries sorted alphabetically by Russian name.
 * This is a reference table - same for all organizations.
 *
 * @returns Array of supplier countries with VAT and markup rates
 */
export async function getSupplierCountries(): Promise<SupplierCountry[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/supplier-countries`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch supplier countries');
  }

  return response.json();
}

/**
 * Get specific supplier country by code
 *
 * @param code - Country code (e.g., 'turkey', 'china', 'lithuania')
 * @returns Supplier country details
 */
export async function getSupplierCountry(code: string): Promise<SupplierCountry> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/supplier-countries/${code}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch supplier country: ${code}`);
  }

  return response.json();
}

/**
 * Format supplier country options for Ant Design Select
 *
 * Converts API response to format suitable for Select component.
 *
 * @param countries - Array of supplier countries from API
 * @returns Array of {label, value} objects
 */
export function formatSupplierCountryOptions(countries: SupplierCountry[]): Array<{label: string; value: string}> {
  return countries.map(country => ({
    label: country.name_ru,
    value: country.name_ru  // Use Russian name as value to match existing data
  }));
}
