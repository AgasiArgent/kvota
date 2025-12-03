/**
 * Exchange Rate Service
 * Handles fetching exchange rates from backend (cached in memory on backend)
 *
 * Rates are updated once daily at 12:05 MSK by backend cron job.
 * All rate lookups are instant (no DB queries - served from backend memory cache).
 */

import { createClient } from '@/lib/supabase/client';
import { config } from '@/lib/config';

export interface ExchangeRate {
  rate: number;
  from_currency: string;
  to_currency: string;
}

export interface AllRatesResponse {
  rates: Record<string, number>; // Currency -> rate to RUB
  last_updated: string | null; // ISO timestamp when rates were fetched from CBR
  cbr_date: string | null; // Date from CBR response
  currencies_count: number;
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
   * Get all exchange rates in a single request
   *
   * Rates are cached in backend memory and served instantly.
   * Updated daily at 12:05 MSK (after CBR publishes ~11:30-12:00).
   *
   * @returns All rates with cache metadata
   */
  async getAllRates(): Promise<AllRatesResponse> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${config.apiUrl}/api/exchange-rates/all`, { headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Failed to fetch exchange rates');
    }

    return response.json();
  }

  /**
   * Get exchange rate between two currencies
   *
   * @param from - Source currency code (e.g., "USD")
   * @param to - Target currency code (e.g., "RUB")
   * @returns Exchange rate
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
}

// Export singleton instance
export const exchangeRateService = new ExchangeRateService();
