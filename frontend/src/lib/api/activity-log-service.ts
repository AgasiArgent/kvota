/**
 * Activity Log Service
 * Handles activity log API calls to FastAPI backend
 */

import { ApiResponse } from '@/lib/types/platform';
import { getApiEndpoint } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';

/**
 * Activity Log Entry
 */
export interface ActivityLog {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  created_at: string;

  // Human-readable fields (joined from users table)
  user_name?: string;
  user_email?: string;
}

/**
 * Activity Log Filters
 */
export interface ActivityLogFilters {
  date_from?: string;
  date_to?: string;
  user_id?: string;
  entity_type?: string;
  action?: string;
  page?: number;
  per_page?: number;
}

/**
 * Paginated Response
 */
export interface PaginatedActivityLogs {
  items: ActivityLog[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

/**
 * Activity Log API Service
 */
export class ActivityLogService {
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
  // ACTIVITY LOG ENDPOINTS
  // ============================================================================

  /**
   * List activity logs with filters
   * GET /api/activity-logs
   */
  async list(filters: ActivityLogFilters): Promise<ApiResponse<PaginatedActivityLogs>> {
    const params = new URLSearchParams();

    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.user_id) params.append('user_id', filters.user_id);
    if (filters.entity_type) params.append('entity_type', filters.entity_type);
    if (filters.action) params.append('action', filters.action);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.per_page) params.append('per_page', filters.per_page.toString());

    const queryString = params.toString();
    const endpoint = `/api/activity-logs${queryString ? `?${queryString}` : ''}`;

    return this.apiRequest<PaginatedActivityLogs>(endpoint);
  }

  /**
   * Get unique users from activity logs (for filter dropdown)
   */
  async getUsers(): Promise<ApiResponse<Array<{ id: string; name: string; email: string }>>> {
    return this.apiRequest('/api/activity-logs/users');
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format action type for display
   */
  formatAction(action: string): string {
    const actionMap: Record<string, string> = {
      created: 'Создано',
      updated: 'Обновлено',
      deleted: 'Удалено',
      restored: 'Восстановлено',
      exported: 'Экспортировано',
    };
    return actionMap[action] || action;
  }

  /**
   * Format entity type for display
   */
  formatEntityType(type: string): string {
    const typeMap: Record<string, string> = {
      quote: 'Котировка',
      customer: 'Клиент',
      contact: 'Контакт',
    };
    return typeMap[type] || type;
  }

  /**
   * Get action badge color
   */
  getActionColor(action: string): string {
    const colorMap: Record<string, string> = {
      created: 'green',
      updated: 'blue',
      deleted: 'red',
      restored: 'cyan',
      exported: 'purple',
    };
    return colorMap[action] || 'default';
  }

  /**
   * Generate entity link
   */
  getEntityLink(log: ActivityLog): string | null {
    if (log.entity_type === 'quote' && log.entity_id) {
      return `/quotes/${log.entity_id}`;
    }
    if (log.entity_type === 'customer' && log.entity_id) {
      return `/customers/${log.entity_id}`;
    }
    return null;
  }
}

// Export singleton instance
export const activityLogService = new ActivityLogService();

// Export default for convenience
export default activityLogService;
