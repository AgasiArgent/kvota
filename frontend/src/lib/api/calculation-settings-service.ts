/**
 * Calculation Settings Service
 * Handles admin-only calculation settings API calls to FastAPI backend
 */

import { ApiResponse } from '@/lib/types/platform';
import { getApiEndpoint } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';

/**
 * Calculation Settings (Admin-Only Variables)
 */
export interface CalculationSettings {
  id: string;
  organization_id: string;
  rate_forex_risk: number; // Резерв на потери на курсовой разнице (%)
  rate_fin_comm: number; // Комиссия ФинАгента (%)
  rate_loan_interest_daily: number; // Дневная стоимость денег (deprecated, calculated from annual)
  rate_loan_interest_annual?: number; // Годовая ставка займа (%)
  customs_logistics_pmt_due?: number; // Срок оплаты таможни/логистики (дни)
  created_at: string;
  updated_at: string;
  updated_by?: string;

  // Human-readable fields
  updated_by_name?: string;
  updated_by_role?: string;
  organization_name?: string;
  organization_inn?: string;
}

/**
 * Create/Update Calculation Settings Request
 */
export interface CalculationSettingsUpdate {
  rate_forex_risk: number;
  rate_fin_comm: number;
  rate_loan_interest_annual: number; // Годовая ставка займа (%)
  customs_logistics_pmt_due: number; // Срок оплаты таможни/логистики (дни)
}

/**
 * Calculation Settings API Service
 */
export class CalculationSettingsService {
  // ============================================================================
  // AUTHENTICATION HELPERS
  // ============================================================================

  /**
   * Get authorization header with JWT token from Supabase session
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${config.apiUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return {
          success: false,
          error:
            errorData.error ||
            errorData.detail ||
            errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }

  // ============================================================================
  // CALCULATION SETTINGS ENDPOINTS
  // ============================================================================

  /**
   * Get calculation settings for user's organization
   * GET /api/calculation-settings
   *
   * Returns admin-controlled defaults for:
   * - rate_forex_risk: Currency exchange risk reserve %
   * - rate_fin_comm: Financial agent commission %
   * - rate_loan_interest_daily: Daily loan interest rate
   */
  async getSettings(): Promise<ApiResponse<CalculationSettings>> {
    return this.apiRequest<CalculationSettings>('/api/calculation-settings');
  }

  /**
   * Create or update calculation settings
   * POST /api/calculation-settings
   *
   * **Admin only**. Requires owner or admin/financial_admin role.
   * Creates new settings if none exist, otherwise updates existing settings.
   */
  async saveSettings(data: CalculationSettingsUpdate): Promise<ApiResponse<CalculationSettings>> {
    return this.apiRequest<CalculationSettings>('/api/calculation-settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get default calculation settings
   */
  getDefaultSettings(): CalculationSettingsUpdate {
    return {
      rate_forex_risk: 3.0, // 3% currency exchange risk reserve
      rate_fin_comm: 2.0, // 2% financial agent commission
      rate_loan_interest_annual: 25.0, // 25% annual interest rate
      customs_logistics_pmt_due: 10, // 10 days payment due
    };
  }

  /**
   * Validate settings values
   */
  validateSettings(settings: CalculationSettingsUpdate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.rate_forex_risk < 0 || settings.rate_forex_risk > 100) {
      errors.push('Резерв на потери на курсовой разнице должен быть от 0% до 100%');
    }

    if (settings.rate_fin_comm < 0 || settings.rate_fin_comm > 100) {
      errors.push('Комиссия ФинАгента должна быть от 0% до 100%');
    }

    if (settings.rate_loan_interest_annual <= 0) {
      errors.push('Годовая ставка займа должна быть больше 0');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate annual interest rate from daily rate
   */
  dailyToAnnualRate(dailyRate: number): number {
    return dailyRate * 365;
  }

  /**
   * Calculate daily interest rate from annual rate
   */
  annualToDailyRate(annualRate: number): number {
    return annualRate / 365;
  }
}

// Export singleton instance
export const calculationSettingsService = new CalculationSettingsService();

// Export default for convenience
export default calculationSettingsService;
