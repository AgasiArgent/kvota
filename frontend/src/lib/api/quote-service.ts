/**
 * Quote Service for B2B Import Quotation Platform
 * Main service for quote management and workflow orchestration
 */

import { BaseApiService } from './base-api';
import { workflowEngine, WorkflowContext } from '@/lib/workflow/workflow-engine';
import {
  roleInputService,
  RoleInputData,
  ProductListItem,
} from '@/lib/workflow/role-input-service';
import { formulaEngine, FormulaContext } from '@/lib/formulas/formula-engine';
import { Database } from '@/lib/supabase/client';
import {
  Quote,
  QuoteItem,
  UserRole,
  Currency,
  QuoteStatus,
  FormulaTemplate,
  ApiResponse,
  SearchFilters,
  PaginationInfo,
  RoleInput,
} from '@/lib/types/platform';

type Customer = Database['public']['Tables']['customers']['Row'];

export interface CreateQuoteRequest {
  customer_id: string;
  industry: string;
  currency: Currency;
  valid_until: string;
  notes?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  workflow_template_id: string;
  formula_template_id: string;
}

export interface QuoteListResponse {
  quotes: Quote[];
  pagination?: PaginationInfo;
}

export interface QuoteDetailsResponse {
  quote: Quote;
  items: QuoteItem[];
  customer: Customer;
  workflow: WorkflowContext;
}

export class QuoteService extends BaseApiService {
  // ============================================================================
  // QUOTE CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new quote
   */
  async createQuote(
    request: CreateQuoteRequest,
    organizationId: string,
    userId: string
  ): Promise<ApiResponse<Quote>> {
    try {
      // Generate quote number
      const quoteNumber = await this.generateQuoteNumber(organizationId);

      const quoteData = {
        quote_number: quoteNumber,
        organization_id: organizationId,
        customer_id: request.customer_id,
        created_by: userId,
        status: 'draft' as QuoteStatus,
        industry: request.industry,
        currency: request.currency,
        subtotal: 0,
        vat_rate: 20, // Default VAT rate, should come from organization settings
        vat_amount: 0,
        total: 0,
        current_step: '',
        workflow_template_id: request.workflow_template_id,
        formula_template_id: request.formula_template_id,
        calculation_variables: {},
        price_breakdown: {},
        valid_until: request.valid_until,
        notes: request.notes,
        tags: request.tags,
        priority: request.priority || 'medium',
      };

      const result = await this.create<typeof quoteData, Quote>(
        'quotes',
        quoteData,
        organizationId
      );

      if (!result.success || !result.data) {
        return result;
      }

      // Initialize workflow
      const workflowResult = await workflowEngine.initializeWorkflow(
        result.data.id,
        request.workflow_template_id,
        organizationId
      );

      if (!workflowResult.success) {
        console.warn('Failed to initialize workflow:', workflowResult.error);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create quote',
      };
    }
  }

  /**
   * Get quote list with filtering and pagination
   */
  async getQuotes(
    organizationId: string,
    filters?: SearchFilters,
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<QuoteListResponse>> {
    try {
      const options = {
        filters: filters as Record<string, unknown>,
        pagination,
        organizationId,
        orderBy: { field: 'created_at', ascending: false },
      };

      const result = await this.findMany<Quote>('quotes', options);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        data: {
          quotes: result.data || [],
          pagination: result.pagination,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get quotes',
      };
    }
  }

  /**
   * Get quote details with all related data
   */
  async getQuoteDetails(
    quoteId: string,
    organizationId: string
  ): Promise<ApiResponse<QuoteDetailsResponse>> {
    try {
      // Get quote
      const quoteResult = await this.findById<Quote>('quotes', quoteId, organizationId);
      if (!quoteResult.success || !quoteResult.data) {
        return {
          success: false,
          error: quoteResult.error || 'Quote not found',
        };
      }

      // Get quote items
      const { data: items } = await this.supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at');

      // Get customer
      const customerResult = await this.findById<Customer>(
        'customers',
        quoteResult.data.customer_id,
        organizationId
      );

      // Get workflow state
      const workflowResult = await workflowEngine.getWorkflowState(quoteId);

      return {
        success: true,
        data: {
          quote: quoteResult.data,
          items: (items as QuoteItem[]) || [],
          customer: customerResult.data as Customer,
          workflow: workflowResult.data as WorkflowContext,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get quote details',
      };
    }
  }

  /**
   * Update quote
   */
  async updateQuote(
    quoteId: string,
    updateData: Partial<Quote>,
    organizationId: string
  ): Promise<ApiResponse<Quote>> {
    return this.update<Quote, Quote>('quotes', quoteId, updateData, organizationId);
  }

  /**
   * Delete quote
   */
  async deleteQuote(quoteId: string, organizationId: string): Promise<ApiResponse<void>> {
    // TODO: Also delete related quote_items and role_assignments
    return this.delete('quotes', quoteId, organizationId);
  }

  // ============================================================================
  // WORKFLOW OPERATIONS
  // ============================================================================

  /**
   * Submit sales manager product list
   */
  async submitProductList(
    quoteId: string,
    productList: ProductListItem[],
    userId: string
  ): Promise<ApiResponse<QuoteItem[]>> {
    try {
      // Process product list
      const result = await roleInputService.processSalesManagerInput(quoteId, productList, userId);

      if (!result.success) {
        return result;
      }

      // Submit role input to workflow
      await roleInputService.submitRoleInput(quoteId, 'sales_manager', userId, {
        product_list: productList,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit product list',
      };
    }
  }

  /**
   * Submit procurement manager input
   */
  async submitProcurementInput(
    quoteId: string,
    inputData: RoleInputData,
    userId: string,
    brandFilter?: string[]
  ): Promise<ApiResponse<{ requiresChoice: boolean; options?: unknown[] }>> {
    try {
      const result = await roleInputService.processProcurementManagerInput(
        quoteId,
        userId,
        inputData,
        brandFilter
      );

      if (!result.success) {
        return result;
      }

      // Submit role input to workflow
      await roleInputService.submitRoleInput(quoteId, 'procurement_manager', userId, inputData);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit procurement input',
      };
    }
  }

  /**
   * Submit customs manager input
   */
  async submitCustomsInput(
    quoteId: string,
    inputData: RoleInputData,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      const result = await roleInputService.submitRoleInput(
        quoteId,
        'customs_manager',
        userId,
        inputData
      );

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit customs input',
      };
    }
  }

  /**
   * Submit logistics manager input
   */
  async submitLogisticsInput(
    quoteId: string,
    inputData: RoleInputData,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      const result = await roleInputService.submitRoleInput(
        quoteId,
        'logistics_manager',
        userId,
        inputData
      );

      return {
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit logistics input',
      };
    }
  }

  // ============================================================================
  // PRICE CALCULATION
  // ============================================================================

  /**
   * Calculate quote prices using formula engine
   */
  async calculateQuotePrices(
    quoteId: string,
    formulaTemplateId: string,
    userId: string
  ): Promise<ApiResponse<{ subtotal: number; total: number }>> {
    try {
      // Get quote and items
      const { data: quote } = await this.supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      const { data: items } = await this.supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId);

      const { data: formulaTemplate } = await this.supabase
        .from('formula_templates')
        .select('*')
        .eq('id', formulaTemplateId)
        .single();

      if (!quote || !items || !formulaTemplate) {
        return {
          success: false,
          error: 'Missing required data for calculation',
        };
      }

      let subtotal = 0;

      // Calculate price for each item
      for (const item of items) {
        const context = this.buildFormulaContext(quote as Quote, item as QuoteItem);

        const calculationResult = await formulaEngine.calculatePrice(
          formulaTemplate as FormulaTemplate,
          context
        );

        if (calculationResult.success && calculationResult.result) {
          const finalPrice = calculationResult.result;
          subtotal += finalPrice * item.quantity;

          // Update item with calculation results
          await this.supabase
            .from('quote_items')
            .update({
              final_price: finalPrice,
              price_calculation: {
                formula_used: formulaTemplate.formula,
                variables: calculationResult.variables_used,
                steps: calculationResult.breakdown,
                final_price: finalPrice,
                breakdown: calculationResult.variables_used,
                calculated_at: new Date().toISOString(),
                calculated_by: userId,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        }
      }

      const vatAmount = subtotal * (quote.vat_rate / 100);
      const total = subtotal + vatAmount;

      // Update quote totals
      await this.supabase
        .from('quotes')
        .update({
          subtotal,
          vat_amount: vatAmount,
          total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      return {
        success: true,
        data: { subtotal, total },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate quote prices',
      };
    }
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Process file upload for role input
   */
  async processFileUpload(
    file: File,
    role: UserRole,
    userId: string
  ): Promise<ApiResponse<unknown>> {
    return roleInputService.processFileUpload(file, role, userId);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate unique quote number
   */
  private async generateQuoteNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // Get count of quotes for this organization this month
    const { count } = await this.supabase
      .from('quotes')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId)
      .gte('created_at', `${year}-${month}-01`)
      .lt(
        'created_at',
        `${year}-${month === '12' ? year + 1 : year}-${month === '12' ? '01' : String(parseInt(month) + 1).padStart(2, '0')}-01`
      );

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `Q${year}${month}${sequence}`;
  }

  /**
   * Build formula context from quote and item data
   */
  private buildFormulaContext(quote: Quote, item: QuoteItem): FormulaContext {
    const roleInputs = (item.role_inputs as Record<string, RoleInput>) || {};

    return {
      variables: {},
      roleInputs,
      systemConfig: {
        vat_rate: quote.vat_rate,
      },
      userInputs: {},
      itemData: {
        quantity: item.quantity,
        custom_fields: item.custom_fields,
      },
    };
  }
}

// Export singleton instance
export const quoteService = new QuoteService();
