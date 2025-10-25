/**
 * Customer Service for Multi-Tenant System
 * Handles all customer-related API calls to FastAPI backend
 */

import { ApiResponse } from '@/lib/types/platform';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Customer Data Types
 */
export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  company_type: string;
  industry?: string;
  credit_limit?: number;
  payment_terms?: number;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CustomerCreate {
  organization_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  company_type: string;
  industry?: string;
  credit_limit?: number;
  payment_terms?: number;
  status: string;
  notes?: string;
}

export interface CustomerUpdate {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  company_type?: string;
  industry?: string;
  credit_limit?: number;
  payment_terms?: number;
  status?: string;
  notes?: string;
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  organization_id: string;
  name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  position?: string;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactCreate {
  name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  position?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface ContactUpdate {
  name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  position?: string;
  is_primary?: boolean;
  notes?: string;
}

/**
 * Customer API Service
 * All methods call the FastAPI backend endpoints
 */
export class CustomerService {
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

      const response = await fetch(`${API_URL}${endpoint}`, {
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
  // CUSTOMER CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new customer
   * POST /api/customers/
   */
  async createCustomer(data: CustomerCreate): Promise<ApiResponse<Customer>> {
    return this.apiRequest<Customer>('/api/customers/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get list of customers for current organization
   * GET /api/customers/
   */
  async listCustomers(): Promise<ApiResponse<CustomerListResponse>> {
    return this.apiRequest<CustomerListResponse>('/api/customers/');
  }

  /**
   * Get customer by ID
   * GET /api/customers/{customer_id}
   */
  async getCustomer(customerId: string): Promise<ApiResponse<Customer>> {
    return this.apiRequest<Customer>(`/api/customers/${customerId}`);
  }

  /**
   * Update customer
   * PUT /api/customers/{customer_id}
   */
  async updateCustomer(
    customerId: string,
    updates: CustomerUpdate
  ): Promise<ApiResponse<Customer>> {
    return this.apiRequest<Customer>(`/api/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete customer (soft delete)
   * DELETE /api/customers/{customer_id}
   */
  async deleteCustomer(customerId: string): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(`/api/customers/${customerId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // CUSTOMER CONTACTS CRUD
  // ============================================================================

  /**
   * Get all contacts for a customer
   * GET /api/customers/{customer_id}/contacts
   */
  async listContacts(customerId: string): Promise<ApiResponse<{ contacts: CustomerContact[] }>> {
    return this.apiRequest<{ contacts: CustomerContact[] }>(
      `/api/customers/${customerId}/contacts`
    );
  }

  /**
   * Create a new contact for customer
   * POST /api/customers/{customer_id}/contacts
   */
  async createContact(
    customerId: string,
    data: ContactCreate
  ): Promise<ApiResponse<CustomerContact>> {
    return this.apiRequest<CustomerContact>(`/api/customers/${customerId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update contact
   * PUT /api/customers/{customer_id}/contacts/{contact_id}
   */
  async updateContact(
    customerId: string,
    contactId: string,
    updates: ContactUpdate
  ): Promise<ApiResponse<CustomerContact>> {
    return this.apiRequest<CustomerContact>(`/api/customers/${customerId}/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete contact
   * DELETE /api/customers/{customer_id}/contacts/{contact_id}
   */
  async deleteContact(
    customerId: string,
    contactId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.apiRequest<{ success: boolean }>(
      `/api/customers/${customerId}/contacts/${contactId}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Get customer quotes
   * GET /api/customers/{customer_id}/quotes
   */
  async getCustomerQuotes(
    customerId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<
    ApiResponse<{
      customer_id: string;
      quotes: any[];
      total: number;
      page: number;
      limit: number;
      has_more: boolean;
    }>
  > {
    return this.apiRequest(`/api/customers/${customerId}/quotes?page=${page}&limit=${limit}`);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format customer status for display
   */
  formatCustomerStatus(status: string): { label: string; color: string } {
    const statusMap: Record<string, { label: string; color: string }> = {
      active: { label: 'Активный', color: 'green' },
      inactive: { label: 'Неактивный', color: 'gray' },
      suspended: { label: 'Приостановлен', color: 'red' },
    };

    return statusMap[status] || { label: status, color: 'gray' };
  }

  /**
   * Format company type for display
   */
  formatCompanyType(type: string): string {
    const typeMap: Record<string, string> = {
      ooo: 'ООО',
      ao: 'АО',
      pao: 'ПАО',
      zao: 'ЗАО',
      ip: 'ИП',
      individual: 'Физическое лицо',
      // Legacy values (for backward compatibility)
      organization: 'ООО',
      individual_entrepreneur: 'ИП',
      government: 'Государственный орган',
    };

    return typeMap[type] || type;
  }

  /**
   * Format industry for display
   */
  formatIndustry(industry: string): string {
    const industryMap: Record<string, string> = {
      manufacturing: 'Промышленность',
      trade: 'Торговля',
      it_tech: 'IT и технологии',
      construction: 'Строительство',
      transport: 'Транспорт',
      finance: 'Финансы',
      other: 'Другое',
    };

    return industryMap[industry] || industry;
  }
}

// Export singleton instance
export const customerService = new CustomerService();

// Export default for convenience
export default customerService;
