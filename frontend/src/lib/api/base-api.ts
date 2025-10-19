/**
 * Base API Service for Multi-Industry Quotation Platform
 * Handles common API operations and Supabase integration
 */

import { createClient } from '@/lib/supabase/client';
import { ApiResponse, PaginationInfo, SearchFilters } from '@/lib/types/platform';

export class BaseApiService {
  protected supabase = createClient();

  // ============================================================================
  // GENERIC CRUD OPERATIONS
  // ============================================================================

  /**
   * Generic create operation
   */
  protected async create<T, K>(
    table: string,
    data: T,
    organizationId?: string
  ): Promise<ApiResponse<K>> {
    try {
      // Add organization_id if available and not already in data
      const insertData =
        organizationId && !('organization_id' in (data as Record<string, unknown>))
          ? { ...data, organization_id: organizationId }
          : data;

      const { data: result, error } = await this.supabase
        .from(table)
        .insert(insertData as Record<string, unknown>)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data: result as K,
        message: 'Created successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generic read operation with pagination and filtering
   */
  protected async findMany<T>(
    table: string,
    options: {
      filters?: Record<string, unknown>;
      search?: string;
      searchFields?: string[];
      orderBy?: { field: string; ascending?: boolean };
      pagination?: { page: number; limit: number };
      organizationId?: string;
      select?: string;
    } = {}
  ): Promise<ApiResponse<T[]>> {
    try {
      let query = this.supabase.from(table).select(options.select || '*', { count: 'exact' });

      // Add organization filter if provided
      if (options.organizationId) {
        query = query.eq('organization_id', options.organizationId);
      }

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              query = query.in(key, value);
            } else if (typeof value === 'string' && value.includes(',')) {
              query = query.in(key, value.split(','));
            } else {
              query = query.eq(key, value);
            }
          }
        });
      }

      // Apply search
      if (options.search && options.searchFields && options.searchFields.length > 0) {
        const searchConditions = options.searchFields
          .map((field) => `${field}.ilike.%${options.search}%`)
          .join(',');
        query = query.or(searchConditions);
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.field, {
          ascending: options.orderBy.ascending ?? true,
        });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      if (options.pagination) {
        const { page, limit } = options.pagination;
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      let pagination: PaginationInfo | undefined;
      if (options.pagination && count !== null) {
        const { page, limit } = options.pagination;
        pagination = {
          current_page: page,
          total_pages: Math.ceil(count / limit),
          total_items: count,
          items_per_page: limit,
          has_next: page * limit < count,
          has_prev: page > 1,
        };
      }

      return {
        success: true,
        data: data as T[],
        pagination,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generic find by ID operation
   */
  protected async findById<T>(
    table: string,
    id: string,
    organizationId?: string,
    select?: string
  ): Promise<ApiResponse<T>> {
    try {
      let query = this.supabase
        .from(table)
        .select(select || '*')
        .eq('id', id);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Record not found',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generic update operation
   */
  protected async update<T, K>(
    table: string,
    id: string,
    data: Partial<T>,
    organizationId?: string
  ): Promise<ApiResponse<K>> {
    try {
      // Add updated_at timestamp
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      let query = this.supabase
        .from(table)
        .update(updateData as Record<string, unknown>)
        .eq('id', id);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data: result, error } = await query.select().single();

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data: result as K,
        message: 'Updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generic delete operation
   */
  protected async delete(
    table: string,
    id: string,
    organizationId?: string
  ): Promise<ApiResponse<void>> {
    try {
      let query = this.supabase.from(table).delete().eq('id', id);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { error } = await query;

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        message: 'Deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get current user and organization
   */
  protected async getCurrentUserContext(): Promise<{
    user: unknown;
    organization: unknown;
    error?: string;
  }> {
    try {
      const {
        data: { user },
        error: userError,
      } = await this.supabase.auth.getUser();

      if (userError || !user) {
        return { user: null, organization: null, error: 'Not authenticated' };
      }

      // Get user profile with organization
      const { data: profile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select(
          `
          *,
          organizations (*)
        `
        )
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        return { user, organization: null, error: profileError.message };
      }

      return {
        user: { ...user, profile },
        organization: profile.organizations,
      };
    } catch (error) {
      return {
        user: null,
        organization: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate unique identifier
   */
  protected generateId(prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Build search filters from search parameters
   */
  protected buildSearchFilters(searchParams: URLSearchParams): SearchFilters {
    const filters: SearchFilters = {};

    const industry = searchParams.get('industry');
    if (industry) filters.industry = industry as never;

    const status = searchParams.get('status');
    if (status) filters.status = status as never;

    const currency = searchParams.get('currency');
    if (currency) filters.currency = currency as never;

    const dateFrom = searchParams.get('date_from');
    if (dateFrom) filters.date_from = dateFrom;

    const dateTo = searchParams.get('date_to');
    if (dateTo) filters.date_to = dateTo;

    const customerId = searchParams.get('customer_id');
    if (customerId) filters.customer_id = customerId;

    const createdBy = searchParams.get('created_by');
    if (createdBy) filters.created_by = createdBy;

    const tags = searchParams.get('tags');
    if (tags) filters.tags = tags.split(',');

    const minAmount = searchParams.get('min_amount');
    if (minAmount) filters.min_amount = parseFloat(minAmount);

    const maxAmount = searchParams.get('max_amount');
    if (maxAmount) filters.max_amount = parseFloat(maxAmount);

    const priority = searchParams.get('priority');
    if (priority) filters.priority = priority;

    return filters;
  }

  /**
   * Handle file upload
   */
  protected async uploadFile(
    file: File,
    bucket: string,
    path: string
  ): Promise<ApiResponse<{ url: string; path: string }>> {
    try {
      const { data, error } = await this.supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      const { data: urlData } = this.supabase.storage.from(bucket).getPublicUrl(data.path);

      return {
        success: true,
        data: {
          url: urlData.publicUrl,
          path: data.path,
        },
        message: 'File uploaded successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'File upload failed',
      };
    }
  }

  /**
   * Validate required fields
   */
  protected validateRequiredFields(
    data: Record<string, unknown>,
    requiredFields: string[]
  ): { isValid: boolean; missingFields: string[] } {
    const missingFields = requiredFields.filter((field) => {
      const value = data[field];
      return (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      );
    });

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Get industry-specific configuration
   */
  protected getIndustryConfig(industry: string) {
    // This could be extended to load from database or configuration files
    const configs = {
      b2b_import: {
        required_fields: ['brand', 'part_number', 'origin_country'],
        optional_fields: ['hs_code', 'weight_kg', 'volume_m3'],
        validation_rules: {
          inn_required: true,
          kpp_required: true,
          ogrn_required: true,
        },
      },
      ecommerce: {
        required_fields: ['sku', 'category'],
        optional_fields: ['marketplace', 'shipping_class'],
        validation_rules: {
          inn_required: false,
          kpp_required: false,
          ogrn_required: false,
        },
      },
      manufacturing: {
        required_fields: ['part_code', 'material_type'],
        optional_fields: ['specification', 'quality_grade'],
        validation_rules: {
          inn_required: true,
          kpp_required: true,
          ogrn_required: true,
        },
      },
    };

    return configs[industry as keyof typeof configs] || configs.b2b_import;
  }
}
