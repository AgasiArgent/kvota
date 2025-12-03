import { createClient } from '@/lib/supabase/client';
import { getApiEndpoint, config } from '@/lib/config';

/**
 * Team Management API Service
 * Handles organization members, invitations, and role management
 */

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface TeamMember {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  role_name: string;
  role_slug: string;
  user_full_name: string | null;
  user_email: string;
  is_owner: boolean;
  status: 'active' | 'invited' | 'left';
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system_role: boolean;
  organization_id: string | null;
  permissions: Record<string, any>;
  created_at: string;
}

export interface AddMemberRequest {
  email: string;
  full_name: string;
  role_id: string;
}

export interface AddMemberResponse {
  message: string;
  member_id: string;
  user_email: string;
  user_full_name: string;
  role: string;
  generated_password: string | null;
  is_new_user: boolean;
}

export interface ResetPasswordResponse {
  message: string;
  user_email: string;
  new_password: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Не авторизован');
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

function getApiUrl() {
  return config.apiUrl;
}

// ============================================================================
// Team Members API
// ============================================================================

/**
 * Fetch all members of an organization
 */
export async function fetchTeamMembers(organizationId: string): Promise<TeamMember[]> {
  const headers = await getAuthHeaders();
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/organizations/${organizationId}/members`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Ошибка загрузки списка участников');
  }

  return response.json();
}

/**
 * Add a new member to the organization
 * Creates user if doesn't exist (returns generated password)
 */
export async function addMember(
  organizationId: string,
  data: AddMemberRequest
): Promise<AddMemberResponse> {
  const headers = await getAuthHeaders();
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/organizations/${organizationId}/members`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.detail || 'Ошибка при добавлении участника');
  }

  return response.json();
}

/**
 * Reset a member's password (admin only)
 * Returns the new generated password
 */
export async function resetMemberPassword(
  organizationId: string,
  memberId: string
): Promise<ResetPasswordResponse> {
  const headers = await getAuthHeaders();
  const apiUrl = getApiUrl();

  const response = await fetch(
    `${apiUrl}/api/organizations/${organizationId}/members/${memberId}/reset-password`,
    {
      method: 'POST',
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Ошибка сброса пароля');
  }

  return response.json();
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  roleId: string
): Promise<TeamMember> {
  const headers = await getAuthHeaders();
  const apiUrl = getApiUrl();

  const response = await fetch(
    `${apiUrl}/api/organizations/${organizationId}/members/${userId}?role_id=${roleId}`,
    {
      method: 'PUT',
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Ошибка изменения роли');
  }

  return response.json();
}

/**
 * Remove a member from the organization
 */
export async function removeMember(organizationId: string, userId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/organizations/${organizationId}/members/${userId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Ошибка удаления участника');
  }
}

// ============================================================================
// Roles API
// ============================================================================

/**
 * Fetch available roles for the organization
 */
export async function fetchRoles(organizationId: string): Promise<Role[]> {
  const headers = await getAuthHeaders();
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/organizations/${organizationId}/roles`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Ошибка загрузки ролей');
  }

  return response.json();
}

// ============================================================================
// Role Display Helpers
// ============================================================================

/**
 * Get role badge color based on role slug
 */
export function getRoleBadgeColor(roleSlug: string): string {
  const colorMap: Record<string, string> = {
    owner: 'red',
    admin: 'orange',
    manager: 'blue',
    member: 'default',
    sales_manager: 'cyan',
  };

  return colorMap[roleSlug] || 'default';
}

/**
 * Get Russian role name
 */
export function getRoleDisplayName(roleSlug: string, roleName: string): string {
  const nameMap: Record<string, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    manager: 'Менеджер',
    member: 'Участник',
    sales_manager: 'Менеджер по продажам',
  };

  return nameMap[roleSlug] || roleName;
}

/**
 * Check if current user can modify a member
 */
export function canModifyMember(
  currentUserId: string,
  targetMember: TeamMember,
  currentUserRole: string
): boolean {
  // Cannot modify yourself
  if (currentUserId === targetMember.user_id) {
    return false;
  }

  // Cannot modify owner
  if (targetMember.is_owner) {
    return false;
  }

  // Only admin/manager/owner can modify
  const adminRoles = ['owner', 'admin', 'manager'];
  return adminRoles.includes(currentUserRole);
}
