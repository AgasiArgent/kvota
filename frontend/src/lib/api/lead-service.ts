/**
 * Lead Service for CRM System
 * Handles all lead-related API calls to FastAPI backend
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Lead Data Types
 */
export interface LeadContact {
  id: string;
  lead_id: string;
  full_name: string;
  position?: string;
  phone?: string;
  email?: string;
  is_primary: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  external_id?: string;
  company_name: string;
  inn?: string;
  email?: string;
  phones?: string[];
  primary_phone?: string;
  segment?: string;
  notes?: string;
  stage_id: string;
  assigned_to?: string;
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LeadWithDetails extends Lead {
  stage_name?: string;
  stage_color?: string;
  assigned_to_name?: string;
  contacts: LeadContact[];
}

export interface LeadCreateContact {
  full_name: string;
  position?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
}

export interface LeadCreate {
  company_name: string;
  inn?: string;
  email?: string;
  phones?: string[];
  primary_phone?: string;
  segment?: string;
  notes?: string;
  stage_id?: string;
  assigned_to?: string;
  contacts?: LeadCreateContact[];
}

export interface LeadUpdate {
  company_name?: string;
  inn?: string;
  email?: string;
  phones?: string[];
  primary_phone?: string;
  segment?: string;
  notes?: string;
  stage_id?: string;
  assigned_to?: string;
}

export interface LeadListParams {
  page?: number;
  limit?: number;
  search?: string;
  stage_id?: string;
  assigned_to?: string;
  segment?: string;
}

export interface LeadListResponse {
  data: LeadWithDetails[];
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
 * Lead Service Functions
 */

/**
 * List leads with pagination and filters
 */
export async function listLeads(params: LeadListParams = {}): Promise<LeadListResponse> {
  const token = await getAuthToken();

  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.search) queryParams.set('search', params.search);
  if (params.stage_id) queryParams.set('stage_id', params.stage_id);
  if (params.assigned_to) queryParams.set('assigned_to', params.assigned_to);
  if (params.segment) queryParams.set('segment', params.segment);

  const url = `${API_URL}/api/leads?${queryParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch leads');
  }

  return response.json();
}

/**
 * Get lead by ID with full details
 */
export async function getLead(leadId: string): Promise<LeadWithDetails> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/leads/${leadId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch lead');
  }

  return response.json();
}

/**
 * Create new lead
 */
export async function createLead(leadData: LeadCreate): Promise<Lead> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create lead');
  }

  return response.json();
}

/**
 * Update lead
 */
export async function updateLead(leadId: string, leadData: LeadUpdate): Promise<Lead> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/leads/${leadId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update lead');
  }

  return response.json();
}

/**
 * Delete lead
 */
export async function deleteLead(leadId: string): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/leads/${leadId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete lead');
  }
}

/**
 * Assign lead to user
 */
export async function assignLead(
  leadId: string,
  userId: string | null
): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/leads/${leadId}/assign`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to assign lead');
  }

  return response.json();
}

/**
 * Change lead stage (for Kanban drag-drop)
 */
export async function changeLeadStage(
  leadId: string,
  stageId: string
): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/leads/${leadId}/stage`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stage_id: stageId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to change stage');
  }

  return response.json();
}

/**
 * Qualify lead to customer
 */
export async function qualifyLead(
  leadId: string,
  customerData?: Record<string, any>
): Promise<{
  success: boolean;
  customer_id: string;
  customer_name: string;
  message: string;
}> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/leads/${leadId}/qualify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customer_data: customerData }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to qualify lead');
  }

  return response.json();
}
