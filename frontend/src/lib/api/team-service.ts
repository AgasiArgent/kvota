import { createClient } from '@/lib/supabase/client';

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

export interface InviteMemberRequest {
  email: string;
  role_id: string;
  message?: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  message: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
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
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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
 * Invite a new member to the organization
 */
export async function inviteMember(
  organizationId: string,
  data: InviteMemberRequest
): Promise<Invitation> {
  const headers = await getAuthHeaders();
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/organizations/${organizationId}/invitations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Ошибка при приглашении участника');
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
