/**
 * Dashboard API Service
 * Handles dashboard statistics and business intelligence data
 */

import { getAuthHeaders } from '@/lib/auth/auth-helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RecentQuote {
  id: string;
  quote_number: string;
  customer_name: string;
  total_amount: string;
  status: string;
  created_at: string;
}

export interface DashboardStats {
  total_quotes: number;
  draft_quotes: number;
  sent_quotes: number;
  accepted_quotes: number;
  revenue_this_month: string;
  revenue_last_month: string;
  revenue_trend: number;
  recent_quotes: RecentQuote[];
}

// ============================================================================
// API SERVICE
// ============================================================================

export const DashboardService = {
  /**
   * Get dashboard statistics
   * Includes quote counts, revenue, and recent quotes
   */
  async getStats(): Promise<DashboardStats> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch dashboard stats');
    }

    return response.json();
  },
};
