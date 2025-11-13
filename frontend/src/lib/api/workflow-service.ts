/**
 * Workflow API Service
 */

import { createClient } from '@/lib/supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

// Types (matching backend models)
export type WorkflowState =
  | 'draft'
  | 'awaiting_procurement'
  | 'awaiting_logistics_customs'
  | 'awaiting_sales_review'
  | 'awaiting_financial_approval'
  | 'awaiting_senior_approval'
  | 'approved'
  | 'rejected';

export type WorkflowAction =
  | 'submit_procurement'
  | 'complete_logistics'
  | 'complete_customs'
  | 'submit_approval'
  | 'approve'
  | 'reject'
  | 'send_back';

export interface WorkflowTransition {
  id: string;
  quote_id: string;
  from_state: WorkflowState;
  to_state: WorkflowState;
  action: WorkflowAction;
  performed_by: string;
  performed_by_name?: string;
  role_at_transition: string;
  performed_at: string;
  comments?: string;
  reason?: string;
}

export interface WorkflowStatus {
  current_state: WorkflowState;
  current_assignee_role?: string;
  assigned_at?: string;
  can_user_act: boolean;
  available_actions: WorkflowAction[];
  logistics_complete: boolean;
  customs_complete: boolean;
  senior_approvals_required: number;
  senior_approvals_received: number;
  transitions: WorkflowTransition[];
}

export interface WorkflowTransitionRequest {
  action: WorkflowAction;
  comments?: string;
  reason?: string;
}

export interface WorkflowTransitionResponse {
  quote_id: string;
  old_state: WorkflowState;
  new_state: WorkflowState;
  transition_id: string;
  next_assignee_role?: string;
  message: string;
}

export interface MyTask {
  quote_id: string;
  quote_number: string;
  customer_name: string;
  total_amount: number;
  workflow_state: WorkflowState;
  assigned_at: string;
  age_hours: number;
}

// API Functions

export async function transitionWorkflow(
  quoteId: string,
  request: WorkflowTransitionRequest
): Promise<WorkflowTransitionResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}/transition`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to transition workflow');
  }

  return response.json();
}

export async function getWorkflowStatus(quoteId: string): Promise<WorkflowStatus> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/quotes/${quoteId}/workflow`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get workflow status');
  }

  return response.json();
}

export async function getMyTasks(): Promise<{ tasks: MyTask[]; count: number }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/api/quotes/my-tasks`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get tasks');
  }

  return response.json();
}
