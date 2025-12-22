/**
 * Customer Contracts Service
 * API client for customer contract management and specification export
 */

import { createClient } from '@/lib/supabase/client';
import { config } from '@/lib/config';
import { ApiResponse } from '@/lib/types/platform';
import {
  Contract,
  ContractCreate,
  ContractUpdate,
  ContractListResponse,
  SpecificationExportRequest,
  SpecificationExportResponse,
} from '@/types/contracts';

/**
 * Contracts API Service
 */
export class ContractsService {
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
  // CONTRACT CRUD OPERATIONS
  // ============================================================================

  /**
   * Get list of contracts for a customer
   * GET /api/customers/{customer_id}/contracts
   */
  async listContracts(customerId: string): Promise<ApiResponse<ContractListResponse>> {
    return this.apiRequest<ContractListResponse>(`/api/customers/${customerId}/contracts`);
  }

  /**
   * Create a new contract for customer
   * POST /api/customers/{customer_id}/contracts
   */
  async createContract(customerId: string, data: ContractCreate): Promise<ApiResponse<Contract>> {
    return this.apiRequest<Contract>(`/api/customers/${customerId}/contracts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update contract
   * PUT /api/customers/contracts/{contract_id}
   */
  async updateContract(
    contractId: string,
    updates: ContractUpdate
  ): Promise<ApiResponse<Contract>> {
    return this.apiRequest<Contract>(`/api/customers/contracts/${contractId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete contract
   * DELETE /api/customers/contracts/{contract_id}
   */
  async deleteContract(contractId: string): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(`/api/customers/contracts/${contractId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // SPECIFICATION EXPORT
  // ============================================================================

  /**
   * Export specification as DOCX
   * POST /api/quotes/{quote_id}/export/specification
   * Returns blob for file download
   */
  async exportSpecification(
    quoteId: string,
    data: SpecificationExportRequest
  ): Promise<{ success: boolean; error?: string; blob?: Blob; filename?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${config.apiUrl}/api/quotes/${quoteId}/export/specification`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        // Handle different error formats: string, object with message, or other
        let errorMessage = 'Failed to export specification';
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (typeof errorData.detail === 'object' && errorData.detail?.message) {
          errorMessage = errorData.detail.message;
        } else if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Get filename from Content-Disposition header
      // Supports both standard and RFC 5987 (filename*=UTF-8'') formats
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'specification.docx';
      if (contentDisposition) {
        // Try RFC 5987 format first (filename*=UTF-8''encoded-name)
        const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
        if (rfc5987Match) {
          filename = decodeURIComponent(rfc5987Match[1]);
        } else {
          // Fallback to standard format
          const filenameMatch = contentDisposition.match(/filename="?([^";\s]+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
      }

      const blob = await response.blob();

      return {
        success: true,
        blob,
        filename,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }

  /**
   * Download specification file
   */
  downloadSpecification(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

// Export singleton instance
export const contractsService = new ContractsService();

// Export default for convenience
export default contractsService;
