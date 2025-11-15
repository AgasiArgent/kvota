/**
 * Analytics API Service
 *
 * Handles all analytics-related API calls with authentication.
 */

import { createClient } from '@/lib/supabase/client';
import { getApiEndpoint } from '@/lib/config';

import { config } from '@/lib/config';

const API_BASE_URL = config.apiUrl;

/**
 * Get authorization headers with JWT token
 */
async function getAuthHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// =============================================================================
// TYPESCRIPT INTERFACES
// =============================================================================

export interface AnalyticsFilter {
  date_range?: {
    from?: string;
    to?: string;
  };
  status?: string[];
  offer_sale_type?: string;
  seller_company?: string;
  [key: string]: any;
}

export interface Aggregation {
  function: 'sum' | 'avg' | 'count' | 'min' | 'max';
  field?: string;
  label: string;
}

export interface AnalyticsQueryRequest {
  filters: AnalyticsFilter;
  selected_fields: string[];
  aggregations?: Record<string, Aggregation>;
  limit?: number;
  offset?: number;
}

export interface AnalyticsQueryResponse {
  rows: Record<string, any>[];
  count: number;
  total_count?: number;
  has_more?: boolean;
  task_id?: string;
  status?: string;
  message?: string;
}

export interface AnalyticsAggregateResponse {
  aggregations: Record<string, any>;
  execution_time_ms: number;
}

export interface SavedReport {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description?: string;
  filters: AnalyticsFilter;
  selected_fields: string[];
  aggregations?: Record<string, Aggregation>;
  visibility: 'personal' | 'shared';
  created_at: string;
  updated_at: string;
}

export interface SavedReportCreate {
  name: string;
  description?: string;
  filters: AnalyticsFilter;
  selected_fields: string[];
  aggregations?: Record<string, Aggregation>;
  visibility?: 'personal' | 'shared';
}

export interface ReportExecution {
  id: string;
  organization_id: string;
  saved_report_id?: string;
  report_name?: string;
  executed_by: string;
  execution_type: 'manual' | 'scheduled' | 'api';
  filters: AnalyticsFilter;
  selected_fields: string[];
  aggregations?: Record<string, Aggregation>;
  result_summary: Record<string, any>;
  quote_count: number;
  date_range?: {
    start?: string;
    end?: string;
  };
  export_file_url?: string;
  export_format?: 'xlsx' | 'csv' | 'pdf' | 'json';
  file_size_bytes?: number;
  file_expires_at?: string;
  execution_time_ms?: number;
  executed_at: string;
}

export interface ScheduledReport {
  id: string;
  organization_id: string;
  saved_report_id: string;
  name: string;
  schedule_cron: string;
  timezone: string;
  email_recipients: string[];
  include_file: boolean;
  email_subject?: string;
  email_body?: string;
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_run_status?: 'success' | 'failure' | 'partial';
  last_error?: string;
  consecutive_failures: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReportCreate {
  saved_report_id: string;
  name: string;
  schedule_cron: string;
  timezone?: string;
  email_recipients: string[];
  include_file?: boolean;
  email_subject?: string;
  email_body?: string;
  is_active?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Execute analytics query (standard mode)
 */
export async function executeQuery(
  request: AnalyticsQueryRequest
): Promise<AnalyticsQueryResponse> {
  try {
    const headers = await getAuthHeaders();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(`${API_BASE_URL}/api/analytics/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Query failed' }));
      throw new Error(
        error.message || error.detail || `Request failed with status ${response.status}`
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Запрос превысил время ожидания (30 секунд)');
      }
      throw error;
    }
    throw new Error('Неизвестная ошибка при выполнении запроса');
  }
}

/**
 * Execute aggregation query (lightweight mode)
 */
export async function executeAggregate(
  filters: AnalyticsFilter,
  aggregations: Record<string, Aggregation>
): Promise<AnalyticsAggregateResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/aggregate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filters, aggregations }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to execute aggregation');
  }

  return response.json();
}

/**
 * Export data to Excel/CSV
 */
export async function exportData(
  request: AnalyticsQueryRequest,
  format: 'xlsx' | 'csv'
): Promise<{ file_url: string; file_name: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/export?format=${format}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to export data');
  }

  // Backend returns FileResponse (binary file), not JSON
  const blob = await response.blob();
  const file_url = URL.createObjectURL(blob);

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get('content-disposition');
  let file_name = `analytics_export.${format}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?(.+?)"?$/);
    if (match) file_name = match[1];
  }

  return { file_url, file_name };
}

/**
 * Get list of saved reports
 */
export async function getSavedReports(): Promise<SavedReport[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/saved-reports`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch saved reports');
  }

  return response.json();
}

/**
 * Get single saved report by ID
 */
export async function getSavedReport(id: string): Promise<SavedReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/saved-reports/${id}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch saved report');
  }

  return response.json();
}

/**
 * Create new saved report
 */
export async function createSavedReport(data: SavedReportCreate): Promise<SavedReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/saved-reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create saved report');
  }

  return response.json();
}

/**
 * Update saved report
 */
export async function updateSavedReport(
  id: string,
  data: Partial<SavedReportCreate>
): Promise<SavedReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/saved-reports/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update saved report');
  }

  return response.json();
}

/**
 * Delete saved report
 */
export async function deleteSavedReport(id: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/saved-reports/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete saved report');
  }
}

/**
 * Get execution history with pagination
 */
export async function getExecutionHistory(
  page: number = 1,
  page_size: number = 50
): Promise<PaginatedResponse<ReportExecution>> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/analytics/executions?page=${page}&page_size=${page_size}`,
    {
      method: 'GET',
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch execution history');
  }

  return response.json();
}

/**
 * Download execution file
 */
export async function downloadExecutionFile(id: string): Promise<Blob> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/executions/${id}/download`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to download file');
  }

  return response.blob();
}

/**
 * Get list of scheduled reports
 */
export async function getScheduledReports(): Promise<ScheduledReport[]> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/scheduled`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch scheduled reports');
  }

  return response.json();
}

/**
 * Create scheduled report
 */
export async function createScheduledReport(data: ScheduledReportCreate): Promise<ScheduledReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/scheduled`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create scheduled report');
  }

  return response.json();
}

/**
 * Update scheduled report
 */
export async function updateScheduledReport(
  id: string,
  data: Partial<ScheduledReportCreate>
): Promise<ScheduledReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/scheduled/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update scheduled report');
  }

  return response.json();
}

/**
 * Delete scheduled report
 */
export async function deleteScheduledReport(id: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/scheduled/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete scheduled report');
  }
}

/**
 * Manually trigger scheduled report
 */
export async function runScheduledReport(
  id: string
): Promise<{ execution_id: string; status: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/analytics/scheduled/${id}/run`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to run scheduled report');
  }

  return response.json();
}
