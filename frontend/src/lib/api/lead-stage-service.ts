/**
 * Lead Stage Service for CRM System
 * Handles lead pipeline stages API calls
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Lead Stage Types
 */
export interface LeadStage {
  id: string;
  organization_id: string;
  name: string;
  order_index: number;
  color: string;
  is_qualified: boolean;
  is_failed: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadStageCreate {
  name: string;
  order_index: number;
  color?: string;
  is_qualified?: boolean;
  is_failed?: boolean;
}

export interface LeadStageUpdate {
  name?: string;
  order_index?: number;
  color?: string;
  is_qualified?: boolean;
  is_failed?: boolean;
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
 * List all stages for organization
 */
export async function listLeadStages(): Promise<LeadStage[]> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-stages`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch stages');
  }

  return response.json();
}

/**
 * Get stage by ID
 */
export async function getLeadStage(stageId: string): Promise<LeadStage> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-stages/${stageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch stage');
  }

  return response.json();
}

/**
 * Create custom stage (managers+ only)
 */
export async function createLeadStage(stageData: LeadStageCreate): Promise<LeadStage> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-stages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(stageData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create stage');
  }

  return response.json();
}

/**
 * Update stage
 */
export async function updateLeadStage(
  stageId: string,
  stageData: LeadStageUpdate
): Promise<LeadStage> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-stages/${stageId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(stageData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update stage');
  }

  return response.json();
}

/**
 * Delete stage
 */
export async function deleteLeadStage(stageId: string): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-stages/${stageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete stage');
  }
}
