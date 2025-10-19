/**
 * Role Input Service for B2B Import Quotation Platform
 * Handles data input and processing for different workflow roles
 */

import { createClient } from '@/lib/supabase/client';
import {
  QuoteItem,
  RoleInput,
  UserRole,
  FileAttachment,
  B2BImportData,
  ApiResponse,
} from '@/lib/types/platform';
import { workflowEngine } from './workflow-engine';

export interface RoleInputData {
  // Sales Manager inputs
  product_list?: ProductListItem[];
  markup_percentage?: number;
  payment_terms?: string;
  client_prepayment_percentage?: number;

  // Procurement Manager inputs
  supplier_price?: number;
  pickup_city?: string;
  pickup_address?: string;
  total_weight_kg?: number;
  total_volume_m3?: number;
  supplier_name?: string;
  supplier_country?: string;

  // Customs Manager inputs
  hs_code?: string;
  customs_duty_rate?: number;
  import_vat_rate?: number;
  customs_broker_fee?: number;

  // Logistics Manager inputs
  route?: string[];
  logistics_cost?: number;
  estimated_delivery_days?: number;
  shipping_insurance?: number;
}

export interface ProductListItem {
  brand: string;
  part_number: string;
  name: string;
  quantity: number;
  article?: string;
}

export interface FileProcessingResult {
  success: boolean;
  data?: ProductListItem[] | RoleInputData[];
  errors?: string[];
  warnings?: string[];
}

export class RoleInputService {
  private supabase = createClient();

  // ============================================================================
  // ROLE INPUT SUBMISSION
  // ============================================================================

  /**
   * Submit role input data for a quote
   */
  async submitRoleInput(
    quoteId: string,
    role: UserRole,
    userId: string,
    inputData: RoleInputData,
    attachments?: FileAttachment[]
  ): Promise<ApiResponse<RoleInput>> {
    try {
      // Get user information
      const { data: user, error: userError } = await this.supabase
        .from('user_profiles')
        .select('full_name')
        .eq('user_id', userId)
        .single();

      if (userError || !user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const roleInput: RoleInput = {
        user_id: userId,
        user_name: user.full_name,
        data: inputData as Record<string, unknown>,
        status: 'completed',
        submitted_at: new Date().toISOString(),
        version: 1,
        attachments: attachments || [],
      };

      // Update quote items with role input
      await this.updateQuoteItemsWithRoleInput(quoteId, role, roleInput);

      // Progress workflow if role is completed
      const progressResult = await workflowEngine.progressWorkflow(quoteId, role, userId);

      if (!progressResult.success) {
        console.warn('Failed to progress workflow:', progressResult.error);
      }

      return {
        success: true,
        data: roleInput,
        message: 'Role input submitted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit role input',
      };
    }
  }

  /**
   * Process file upload for role input
   */
  async processFileUpload(
    file: File,
    role: UserRole,
    userId: string
  ): Promise<ApiResponse<FileProcessingResult>> {
    try {
      // Upload file to storage
      const uploadResult = await this.uploadFile(file, userId);
      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error,
        };
      }

      // Process file content based on role
      const processingResult = await this.processFileContent(file, role);

      // Store file record
      await this.supabase.from('file_uploads').insert({
        filename: file.name,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: userId,
        role: role,
        processing_status: processingResult.success ? 'completed' : 'failed',
        processing_result: processingResult,
        url: uploadResult.data?.url || '',
      });

      return {
        success: true,
        data: processingResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process file upload',
      };
    }
  }

  // ============================================================================
  // ROLE-SPECIFIC INPUT HANDLERS
  // ============================================================================

  /**
   * Handle sales manager product list upload
   */
  async processSalesManagerInput(
    quoteId: string,
    productList: ProductListItem[],
    userId: string
  ): Promise<ApiResponse<QuoteItem[]>> {
    try {
      // Validate product list
      const validation = this.validateProductList(productList);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid product list: ${validation.errors?.join(', ')}`,
        };
      }

      // Create quote items
      const quoteItems = productList.map((product) => ({
        quote_id: quoteId,
        name: product.name,
        description: `${product.brand} - ${product.part_number}`,
        quantity: product.quantity,
        custom_fields: {
          brand: product.brand,
          part_number: product.part_number,
          article: product.article,
        } as B2BImportData,
        role_inputs: {},
        calculation_inputs: {},
        price_calculation: {
          formula_used: '',
          variables: {},
          steps: [],
          final_price: 0,
          breakdown: {},
          calculated_at: new Date().toISOString(),
          calculated_by: userId,
        },
      }));

      const { data: createdItems, error } = await this.supabase
        .from('quote_items')
        .insert(quoteItems)
        .select();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data: createdItems as QuoteItem[],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process sales manager input',
      };
    }
  }

  /**
   * Handle procurement manager input with brand filtering
   */
  async processProcurementManagerInput(
    quoteId: string,
    userId: string,
    inputData: RoleInputData,
    brandFilter?: string[]
  ): Promise<ApiResponse<{ requiresChoice: boolean; options?: RoleInput[] }>> {
    try {
      // Get user's brand specialization
      const { data: user } = await this.supabase
        .from('user_profiles')
        .select('specialization_brands, full_name')
        .eq('user_id', userId)
        .single();

      const userBrands = user?.specialization_brands || [];

      // Get quote items that match user's brands
      let query = this.supabase.from('quote_items').select('*').eq('quote_id', quoteId);

      if (brandFilter && brandFilter.length > 0) {
        // Filter by specific brands
        query = query.in('custom_fields->brand', brandFilter);
      } else if (userBrands.length > 0) {
        // Filter by user's specialization brands
        query = query.in('custom_fields->brand', userBrands);
      }

      const { data: items, error } = await query;

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      // Submit role input for matching items
      const roleInput: RoleInput = {
        user_id: userId,
        user_name: user?.full_name || '',
        data: inputData as Record<string, unknown>,
        status: 'completed',
        submitted_at: new Date().toISOString(),
        version: 1,
      };

      // Update items with procurement data
      for (const item of items || []) {
        const existingRoleInputs = (item.role_inputs as Record<string, RoleInput>) || {};
        existingRoleInputs[`procurement_${userId}`] = roleInput;

        await this.supabase
          .from('quote_items')
          .update({
            role_inputs: existingRoleInputs,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);
      }

      // Check for concurrent procurement inputs
      const concurrentResult = await workflowEngine.handleConcurrentProcurement(
        quoteId,
        userId,
        inputData as Record<string, unknown>
      );

      return concurrentResult;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to process procurement manager input',
      };
    }
  }

  // ============================================================================
  // FILE PROCESSING
  // ============================================================================

  /**
   * Process file content based on role
   */
  private async processFileContent(file: File, role: UserRole): Promise<FileProcessingResult> {
    try {
      const text = await file.text();

      if (file.type.includes('csv')) {
        return this.processCSVFile(text, role);
      } else if (file.type.includes('excel') || file.name.endsWith('.xlsx')) {
        return this.processExcelFile(file, role);
      } else {
        return {
          success: false,
          errors: ['Unsupported file type. Please upload CSV or Excel files.'],
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Failed to process file'],
      };
    }
  }

  /**
   * Process CSV file content
   */
  private processCSVFile(csvText: string, role: UserRole): FileProcessingResult {
    try {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

      if (role === 'sales_manager') {
        return this.parseProductListCSV(lines, headers);
      } else if (role === 'procurement_manager') {
        return this.parseProcurementDataCSV(lines, headers);
      }

      return {
        success: false,
        errors: ['Unsupported role for CSV processing'],
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Failed to parse CSV'],
      };
    }
  }

  /**
   * Parse product list from CSV
   */
  private parseProductListCSV(lines: string[], headers: string[]): FileProcessingResult {
    const products: ProductListItem[] = [];
    const errors: string[] = [];

    // Check required headers
    const requiredHeaders = ['brand', 'part_number', 'name', 'quantity'];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return {
        success: false,
        errors: [`Missing required columns: ${missingHeaders.join(', ')}`],
      };
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());

      if (values.length !== headers.length) {
        errors.push(`Row ${i + 1}: Column count mismatch`);
        continue;
      }

      const product: ProductListItem = {
        brand: values[headers.indexOf('brand')] || '',
        part_number: values[headers.indexOf('part_number')] || '',
        name: values[headers.indexOf('name')] || '',
        quantity: parseInt(values[headers.indexOf('quantity')]) || 0,
      };

      const articleIndex = headers.indexOf('article');
      if (articleIndex >= 0) {
        product.article = values[articleIndex];
      }

      // Validate product
      if (!product.brand || !product.part_number || !product.name || product.quantity <= 0) {
        errors.push(`Row ${i + 1}: Missing required fields or invalid quantity`);
        continue;
      }

      products.push(product);
    }

    return {
      success: errors.length === 0,
      data: products,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Parse procurement data from CSV
   */
  private parseProcurementDataCSV(lines: string[], headers: string[]): FileProcessingResult {
    // Implementation for procurement data parsing
    // Similar structure to product list but with different fields
    return {
      success: true,
      data: [],
    };
  }

  /**
   * Process Excel file (placeholder)
   */
  private async processExcelFile(file: File, role: UserRole): Promise<FileProcessingResult> {
    // TODO: Implement Excel file processing using a library like xlsx
    return {
      success: false,
      errors: ['Excel file processing not yet implemented'],
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Update quote items with role input data
   */
  private async updateQuoteItemsWithRoleInput(
    quoteId: string,
    role: UserRole,
    roleInput: RoleInput
  ): Promise<void> {
    const { data: items } = await this.supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId);

    for (const item of items || []) {
      const existingRoleInputs = (item.role_inputs as Record<string, RoleInput>) || {};
      existingRoleInputs[role] = roleInput;

      await this.supabase
        .from('quote_items')
        .update({
          role_inputs: existingRoleInputs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    }
  }

  /**
   * Upload file to storage
   */
  private async uploadFile(
    file: File,
    userId: string
  ): Promise<ApiResponse<{ url: string; path: string }>> {
    try {
      const fileName = `${userId}/${Date.now()}_${file.name}`;

      const { data, error } = await this.supabase.storage
        .from('quote-files')
        .upload(fileName, file);

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      const { data: urlData } = this.supabase.storage.from('quote-files').getPublicUrl(data.path);

      return {
        success: true,
        data: {
          url: urlData.publicUrl,
          path: data.path,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File upload failed',
      };
    }
  }

  /**
   * Validate product list
   */
  private validateProductList(products: ProductListItem[]): {
    isValid: boolean;
    errors?: string[];
  } {
    const errors: string[] = [];

    if (!products || products.length === 0) {
      errors.push('Product list cannot be empty');
    }

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      if (!product.brand?.trim()) {
        errors.push(`Product ${i + 1}: Brand is required`);
      }

      if (!product.part_number?.trim()) {
        errors.push(`Product ${i + 1}: Part number is required`);
      }

      if (!product.name?.trim()) {
        errors.push(`Product ${i + 1}: Name is required`);
      }

      if (!product.quantity || product.quantity <= 0) {
        errors.push(`Product ${i + 1}: Quantity must be greater than 0`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Export singleton instance
export const roleInputService = new RoleInputService();
