/**
 * Activity Service for CRM System
 * Handles meetings, calls, emails, tasks
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Activity Data Types
 */
export type ActivityType = 'call' | 'meeting' | 'email' | 'task';

export interface Activity {
  id: string;
  organization_id: string;
  lead_id?: string;
  customer_id?: string;
  type: ActivityType;
  title?: string;
  notes?: string;
  result?: string;
  scheduled_at?: string;
  duration_minutes: number;
  completed: boolean;
  completed_at?: string;
  google_event_id?: string;
  assigned_to?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityWithDetails extends Activity {
  lead_company_name?: string;
  customer_name?: string;
  assigned_to_name?: string;
  created_by_name?: string;
}

export interface ActivityCreate {
  lead_id?: string;
  customer_id?: string;
  type: ActivityType;
  title?: string;
  notes?: string;
  result?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  assigned_to?: string;
}

export interface ActivityUpdate {
  type?: ActivityType;
  title?: string;
  notes?: string;
  result?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  completed?: boolean;
  assigned_to?: string;
}

export interface ActivityListParams {
  page?: number;
  limit?: number;
  activity_type?: ActivityType;
  completed?: boolean;
  assigned_to?: string;
  lead_id?: string;
  customer_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface ActivityListResponse {
  data: ActivityWithDetails[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get authentication token
 */
async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return session.access_token;
}

/**
 * Activity Service Functions
 */

/**
 * List activities with filters
 */
export async function listActivities(
  params: ActivityListParams = {}
): Promise<ActivityListResponse> {
  const token = await getAuthToken();

  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.activity_type) queryParams.set('activity_type', params.activity_type);
  if (params.completed !== undefined) queryParams.set('completed', params.completed.toString());
  if (params.assigned_to) queryParams.set('assigned_to', params.assigned_to);
  if (params.lead_id) queryParams.set('lead_id', params.lead_id);
  if (params.customer_id) queryParams.set('customer_id', params.customer_id);
  if (params.from_date) queryParams.set('from_date', params.from_date);
  if (params.to_date) queryParams.set('to_date', params.to_date);

  const url = `${API_URL}/api/activities?${queryParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch activities');
  }

  return response.json();
}

/**
 * Get activity by ID
 */
export async function getActivity(activityId: string): Promise<ActivityWithDetails> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities/${activityId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch activity');
  }

  return response.json();
}

/**
 * Create new activity
 */
export async function createActivity(activityData: ActivityCreate): Promise<Activity> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activityData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create activity');
  }

  return response.json();
}

/**
 * Update activity
 */
export async function updateActivity(
  activityId: string,
  activityData: ActivityUpdate
): Promise<Activity> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities/${activityId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(activityData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update activity');
  }

  return response.json();
}

/**
 * Delete activity
 */
export async function deleteActivity(activityId: string): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities/${activityId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete activity');
  }
}

/**
 * Mark activity as completed
 */
export async function completeActivity(
  activityId: string,
  result?: string
): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities/${activityId}/complete`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ result }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to complete activity');
  }

  return response.json();
}

/**
 * Reopen completed activity
 */
export async function reopenActivity(
  activityId: string
): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities/${activityId}/reopen`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reopen activity');
  }

  return response.json();
}

/**
 * Get upcoming activities for current user
 */
export async function getUpcomingActivities(days: number = 7): Promise<ActivityWithDetails[]> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities/upcoming/my?days=${days}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch upcoming activities');
  }

  return response.json();
}

/**
 * Get overdue activities for current user
 */
export async function getOverdueActivities(): Promise<ActivityWithDetails[]> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/activities/overdue/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch overdue activities');
  }

  return response.json();
}
