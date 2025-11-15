/**
 * Exchange Rate Service
 * Handles fetching and refreshing exchange rates from backend
 */

import { createClient } from '@/lib/supabase/client';
import { getApiEndpoint } from '@/lib/config';

export interface ExchangeRate {
  rate: number;
  fetched_at: string;
  source: string;
  from_currency: string;
  to_currency: string;
}

export interface RefreshResponse {
  success: boolean;
  rates_updated: number;
  message: string;
}

export class ExchangeRateService {
  /**
   * Get authorization headers with JWT token from Supabase session
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  /**
   * Get exchange rate between two currencies
   *
   * @param from - Source currency code (e.g., "USD")
   * @param to - Target currency code (e.g., "CNY")
   * @returns Exchange rate with metadata
   */
  async getRate(from: string, to: string): Promise<ExchangeRate> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${config.apiUrl}/api/exchange-rates/${from.toUpperCase()}/${to.toUpperCase()}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Failed to fetch exchange rate`);
    }

    return response.json();
  }

  /**
   * Manually refresh all exchange rates from CBR API
   * Admin only endpoint
   *
   * @returns Success status and number of rates updated
   */
  async refreshRates(): Promise<RefreshResponse> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${config.apiUrl}/api/exchange-rates/refresh`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Failed to refresh exchange rates');
    }

    return response.json();
  }
}

// Export singleton instance
export const exchangeRateService = new ExchangeRateService();
