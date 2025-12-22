/**
 * Dashboard Constructor API Service
 * CRUD operations for custom dashboards and widgets (TASK-009)
 */
import { getAuthHeaders } from '@/lib/auth/auth-helper';
import { config } from '@/lib/config';
import type {
  Dashboard,
  DashboardCreate,
  DashboardUpdate,
  DashboardListResponse,
  DashboardWidget,
  DashboardWidgetCreate,
  DashboardWidgetUpdate,
} from '@/types/dashboard';

const API_BASE_URL = config.apiUrl;

// ============================================================================
// Dashboard CRUD
// ============================================================================

export async function fetchDashboards(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<DashboardListResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (search) {
    params.append('search', search);
  }

  const response = await fetch(`${API_BASE_URL}/api/dashboards?${params.toString()}`, { headers });

  if (!response.ok) {
    throw new Error('Failed to fetch dashboards');
  }

  return response.json();
}

export async function fetchDashboard(dashboardId: string): Promise<Dashboard> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}`, {
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Dashboard not found');
    }
    throw new Error('Failed to fetch dashboard');
  }

  return response.json();
}

export async function createDashboard(data: DashboardCreate): Promise<Dashboard> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/dashboards`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create dashboard');
  }

  return response.json();
}

export async function updateDashboard(
  dashboardId: string,
  data: DashboardUpdate
): Promise<Dashboard> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update dashboard');
  }

  return response.json();
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete dashboard');
  }
}

// ============================================================================
// Widget CRUD
// ============================================================================

export async function createWidget(
  dashboardId: string,
  data: DashboardWidgetCreate
): Promise<DashboardWidget> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}/widgets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create widget');
  }

  return response.json();
}

export async function updateWidget(
  dashboardId: string,
  widgetId: string,
  data: DashboardWidgetUpdate
): Promise<DashboardWidget> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/dashboards/${dashboardId}/widgets/${widgetId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update widget');
  }

  return response.json();
}

export async function deleteWidget(dashboardId: string, widgetId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_BASE_URL}/api/dashboards/${dashboardId}/widgets/${widgetId}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok) {
    throw new Error('Failed to delete widget');
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

export async function updateWidgetPositions(
  dashboardId: string,
  positions: Array<{ id: string; x: number; y: number; w: number; h: number }>
): Promise<void> {
  const headers = await getAuthHeaders();

  // Update layout in dashboard
  await fetch(`${API_BASE_URL}/api/dashboards/${dashboardId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ layout: positions }),
  });

  // Update individual widget positions
  await Promise.all(
    positions.map((pos) =>
      updateWidget(dashboardId, pos.id, {
        position: { x: pos.x, y: pos.y, w: pos.w, h: pos.h },
      })
    )
  );
}
