/**
 * Quotes Calculation Service
 * Handles all quote calculation related API calls to FastAPI backend
 */

import { ApiResponse } from '@/lib/types/platform';
import { getApiEndpoint } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';

/**
 * Product from uploaded file
 */
export interface Product {
  sku?: string; // Артикул
  brand?: string; // Бренд
  product_name: string;
  product_code?: string;
  base_price_vat: number;
  quantity: number;
  weight_in_kg?: number;
  customs_code?: string;
  supplier_country?: string;
  // Override fields (can override quote-level defaults)
  currency_of_base_price?: string;
  supplier_discount?: number;
  exchange_rate_base_price_to_quote?: number;
  import_tariff?: number;
  excise_tax?: number;
  markup?: number;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  message: string;
  products: Product[];
  total_count: number;
}

/**
 * Calculation variables (all 39 variables)
 */
export interface CalculationVariables {
  // Product Info (5 fields)
  currency_of_base_price: string;
  exchange_rate_base_price_to_quote: number;
  supplier_country?: string;
  supplier_currency: string;
  customs_code?: string;

  // Financial (10 fields)
  currency_of_quote: string;
  markup: number;
  rate_forex_risk: number;
  rate_fin_comm: number;
  rate_loan_interest_daily: number;
  rate_usd_cny: number; // USD to CNY exchange rate
  dm_fee_type: string;
  dm_fee_value: number;
  credit_days_to_client: number;
  credit_days_from_supplier: number;

  // Logistics (7 fields)
  logistics_supplier_hub: number;
  logistics_hub_customs: number;
  logistics_customs_client: number;
  offer_incoterms: string;
  supplier_incoterms: string;
  logistics_insurance: number;
  delivery_time: number;

  // Taxes & Duties (2 fields)
  import_tariff: number;
  excise_tax: number;

  // Payment Terms (12 fields)
  advance_from_client: number;
  advance_to_supplier: number;
  time_to_advance: number;
  time_to_shipment: number;
  time_shipment_to_hub: number;
  time_hub_to_customs: number;
  time_customs_clearance: number;
  time_customs_to_client: number;
  time_client_payment: number;
  exchange_rate_quote_to_rub: number;
  vat_rate: number;
  util_fee: number;

  // Customs & Clearance (5 fields)
  brokerage_hub: number;
  brokerage_customs: number;
  warehousing_at_customs: number;
  customs_documentation: number;
  brokerage_extra: number;

  // Company Settings (2 fields)
  seller_company: string;
  offer_sale_type: string;

  // Quote Dates (optional)
  quote_date?: any; // dayjs object or string
  valid_until?: any; // dayjs object or string
}

/**
 * Variable Template
 */
export interface VariableTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  variables: Partial<CalculationVariables>;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Template Create/Update
 */
export interface VariableTemplateCreate {
  name: string;
  description?: string;
  variables: Partial<CalculationVariables>;
  is_default?: boolean;
}

/**
 * Quote calculation request
 */
export interface QuoteCalculationRequest {
  customer_id: string;
  contact_id?: string; // Customer contact person
  products: Product[];
  variables: CalculationVariables;
  title?: string;
  notes?: string;
  quote_date?: string; // YYYY-MM-DD format
  valid_until?: string; // YYYY-MM-DD format
}

/**
 * Single product calculation result (all 13 phases)
 */
export interface ProductCalculationResult {
  product_name: string;
  product_code?: string;
  quantity: number;

  // Phase results
  base_price_vat: number;
  base_price_no_vat: number;
  purchase_price_rub: number;
  logistics_costs: number;
  cogs: number;
  cogs_with_vat: number;
  import_duties: number;
  customs_fees: number;
  financing_costs: number;
  dm_fee: number;
  total_cost: number;
  sale_price: number;
  margin: number;
}

/**
 * Quote calculation response
 */
export interface QuoteCalculationResponse {
  quote_id: string;
  quote_number: string;
  customer_id: string;
  title: string;
  status: string;
  total_amount: number;
  items: ProductCalculationResult[];
  created_at: string;
}

/**
 * Quotes Calculation API Service
 */
export class QuotesCalcService {
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
            errorData.message || // Backend uses 'message' field
            errorData.error ||
            errorData.detail ||
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
  // FILE UPLOAD
  // ============================================================================

  /**
   * Upload Excel/CSV file with products
   * POST /api/quotes-calc/upload-products
   */
  async uploadProducts(file: File): Promise<ApiResponse<FileUploadResponse>> {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${config.apiUrl}/api/quotes-calc/upload-products`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          // Note: Don't set Content-Type for FormData, browser sets it with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return {
          success: false,
          error:
            errorData.message || // Backend uses 'message' field
            errorData.error ||
            errorData.detail ||
            `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: data as FileUploadResponse,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File upload failed',
      };
    }
  }

  // ============================================================================
  // VARIABLE TEMPLATES
  // ============================================================================

  /**
   * Get list of variable templates
   * GET /api/quotes-calc/variable-templates
   */
  async listTemplates(): Promise<ApiResponse<VariableTemplate[]>> {
    return this.apiRequest<VariableTemplate[]>('/api/quotes-calc/variable-templates');
  }

  /**
   * Get specific template by ID
   * GET /api/quotes-calc/variable-templates/{template_id}
   */
  async getTemplate(templateId: string): Promise<ApiResponse<VariableTemplate>> {
    return this.apiRequest<VariableTemplate>(`/api/quotes-calc/variable-templates/${templateId}`);
  }

  /**
   * Create new variable template
   * POST /api/quotes-calc/variable-templates
   */
  async createTemplate(data: VariableTemplateCreate): Promise<ApiResponse<VariableTemplate>> {
    return this.apiRequest<VariableTemplate>('/api/quotes-calc/variable-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update existing variable template
   * PUT /api/quotes-calc/variable-templates/{template_id}
   */
  async updateTemplate(
    templateId: string,
    data: VariableTemplateCreate
  ): Promise<ApiResponse<VariableTemplate>> {
    return this.apiRequest<VariableTemplate>(`/api/quotes-calc/variable-templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete variable template
   * DELETE /api/quotes-calc/variable-templates/{template_id}
   */
  async deleteTemplate(templateId: string): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(
      `/api/quotes-calc/variable-templates/${templateId}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ============================================================================
  // QUOTE CALCULATION
  // ============================================================================

  /**
   * Calculate quote with products and variables
   * POST /api/quotes-calc/calculate
   */
  async calculateQuote(
    data: QuoteCalculationRequest
  ): Promise<ApiResponse<QuoteCalculationResponse>> {
    return this.apiRequest<QuoteCalculationResponse>('/api/quotes-calc/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get default calculation variables
   */
  getDefaultVariables(): CalculationVariables {
    return {
      // Product Info
      currency_of_base_price: 'TRY',
      exchange_rate_base_price_to_quote: 1.0,
      supplier_country: 'Турция',
      supplier_currency: 'TRY',
      customs_code: '',

      // Financial
      currency_of_quote: 'RUB',
      markup: 15.0,
      rate_forex_risk: 3.0,
      rate_fin_comm: 2.0,
      rate_loan_interest_daily: 0.00069,
      rate_usd_cny: 7.2, // Default USD to CNY rate (will be auto-loaded)
      dm_fee_type: 'fixed',
      dm_fee_value: 1000.0,
      credit_days_to_client: 30,
      credit_days_from_supplier: 0,

      // Logistics
      logistics_supplier_hub: 1500.0,
      logistics_hub_customs: 800.0,
      logistics_customs_client: 500.0,
      offer_incoterms: 'DDP',
      supplier_incoterms: 'EXW',
      logistics_insurance: 0,
      delivery_time: 30,

      // Taxes & Duties
      import_tariff: 5.0,
      excise_tax: 0,

      // Payment Terms
      advance_from_client: 50.0,
      advance_to_supplier: 100.0,
      time_to_advance: 7,
      time_to_shipment: 14,
      time_shipment_to_hub: 10,
      time_hub_to_customs: 3,
      time_customs_clearance: 7,
      time_customs_to_client: 3,
      time_client_payment: 30,
      exchange_rate_quote_to_rub: 1.0,
      vat_rate: 20.0,
      util_fee: 0,

      // Customs & Clearance
      brokerage_hub: 500.0,
      brokerage_customs: 300.0,
      warehousing_at_customs: 200.0,
      customs_documentation: 150.0,
      brokerage_extra: 0,

      // Company Settings
      seller_company: 'МАСТЕР БЭРИНГ ООО',
      offer_sale_type: 'поставка',
    };
  }

  /**
   * Validate file type
   */
  isValidFileType(file: File): boolean {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    const validExtensions = ['.xlsx', '.xls', '.csv'];

    return (
      validTypes.includes(file.type) ||
      validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

// Export singleton instance
export const quotesCalcService = new QuotesCalcService();

// Export default for convenience
export default quotesCalcService;
