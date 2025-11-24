/**
 * Lead Contact Service for CRM System
 * Handles lead contacts (ЛПР - Decision Makers) API calls
 */

import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Lead Contact Types
 */
export interface LeadContact {
  id: string;
  lead_id: string;
  organization_id: string;
  full_name: string;
  position?: string;
  phone?: string;
  email?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadContactCreate {
  full_name: string;
  position?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
}

export interface LeadContactUpdate {
  full_name?: string;
  position?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
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
 * List contacts for a lead
 */
export async function listLeadContacts(leadId: string): Promise<LeadContact[]> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-contacts/lead/${leadId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch contacts');
  }

  return response.json();
}

/**
 * Get contact by ID
 */
export async function getLeadContact(contactId: string): Promise<LeadContact> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-contacts/${contactId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch contact');
  }

  return response.json();
}

/**
 * Create contact for lead
 */
export async function createLeadContact(
  leadId: string,
  contactData: LeadContactCreate
): Promise<LeadContact> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-contacts/lead/${leadId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create contact');
  }

  return response.json();
}

/**
 * Update contact
 */
export async function updateLeadContact(
  contactId: string,
  contactData: LeadContactUpdate
): Promise<LeadContact> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update contact');
  }

  return response.json();
}

/**
 * Delete contact
 */
export async function deleteLeadContact(contactId: string): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-contacts/${contactId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete contact');
  }
}

/**
 * Set contact as primary
 */
export async function setPrimaryContact(
  contactId: string
): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}/api/lead-contacts/${contactId}/set-primary`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to set primary contact');
  }

  return response.json();
}
