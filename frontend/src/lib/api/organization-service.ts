/**
 * Organization Service for Multi-Tenant System
 * Handles all organization-related API calls to FastAPI backend
 */

import { ApiResponse } from '@/lib/types/platform';
import { getApiEndpoint } from '@/lib/config';
import {
  Organization,
  OrganizationCreate,
  OrganizationUpdate,
  UserOrganization,
  OrganizationMember,
  OrganizationMemberWithDetails,
  Invitation,
  InvitationWithDetails,
  InvitationCreate,
  Role,
} from '@/lib/types/organization';
import { createClient } from '@/lib/supabase/client';

/**
 * Organization API Service
 * All methods call the FastAPI backend endpoints
 */
export class OrganizationService {
  // ============================================================================
  // AUTHENTICATION HELPERS
  // ============================================================================

  /**
   * Get authorization header with JWT token from Supabase session
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${config.apiUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return {
          success: false,
          error:
            errorData.error ||
            errorData.detail ||
            `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }

  // ============================================================================
  // ORGANIZATION CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new organization
   * POST /api/organizations/
   */
  async createOrganization(data: OrganizationCreate): Promise<ApiResponse<Organization>> {
    return this.apiRequest<Organization>('/api/organizations/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get list of organizations for current user
   * GET /api/organizations/
   */
  async listOrganizations(): Promise<ApiResponse<UserOrganization[]>> {
    return this.apiRequest<UserOrganization[]>('/api/organizations/');
  }

  /**
   * Get organization by ID
   * GET /api/organizations/{organization_id}
   */
  async getOrganization(organizationId: string): Promise<ApiResponse<Organization>> {
    return this.apiRequest<Organization>(`/api/organizations/${organizationId}`);
  }

  /**
   * Update organization
   * PUT /api/organizations/{organization_id}
   */
  async updateOrganization(
    organizationId: string,
    updates: OrganizationUpdate
  ): Promise<ApiResponse<Organization>> {
    return this.apiRequest<Organization>(`/api/organizations/${organizationId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete organization (soft delete)
   * DELETE /api/organizations/{organization_id}
   */
  async deleteOrganization(organizationId: string): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(`/api/organizations/${organizationId}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // MEMBER MANAGEMENT
  // ============================================================================

  /**
   * List all members of an organization
   * GET /api/organizations/{organization_id}/members
   */
  async listMembers(organizationId: string): Promise<ApiResponse<OrganizationMemberWithDetails[]>> {
    return this.apiRequest<OrganizationMemberWithDetails[]>(
      `/api/organizations/${organizationId}/members`
    );
  }

  /**
   * Add a member directly (if they already have an account)
   * POST /api/organizations/{organization_id}/members
   */
  async addMember(
    organizationId: string,
    email: string,
    roleId: string
  ): Promise<ApiResponse<OrganizationMember>> {
    return this.apiRequest<OrganizationMember>(`/api/organizations/${organizationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role_id: roleId }),
    });
  }

  /**
   * Update member's role
   * PUT /api/organizations/{organization_id}/members/{user_id}
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    roleId: string
  ): Promise<ApiResponse<OrganizationMember>> {
    return this.apiRequest<OrganizationMember>(
      `/api/organizations/${organizationId}/members/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role_id: roleId }),
      }
    );
  }

  /**
   * Remove member from organization
   * DELETE /api/organizations/{organization_id}/members/{user_id}
   */
  async removeMember(
    organizationId: string,
    userId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(
      `/api/organizations/${organizationId}/members/${userId}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ============================================================================
  // INVITATION MANAGEMENT
  // ============================================================================

  /**
   * Create email invitation
   * POST /api/organizations/{organization_id}/invitations
   */
  async createInvitation(
    organizationId: string,
    data: InvitationCreate
  ): Promise<ApiResponse<Invitation>> {
    return this.apiRequest<Invitation>(`/api/organizations/${organizationId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * List all invitations for an organization
   * GET /api/organizations/{organization_id}/invitations
   */
  async listInvitations(organizationId: string): Promise<ApiResponse<InvitationWithDetails[]>> {
    return this.apiRequest<InvitationWithDetails[]>(
      `/api/organizations/${organizationId}/invitations`
    );
  }

  /**
   * Accept an invitation
   * POST /api/organizations/invitations/{token}/accept
   */
  async acceptInvitation(token: string): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(`/api/organizations/invitations/${token}/accept`, {
      method: 'POST',
    });
  }

  /**
   * Cancel a pending invitation
   * DELETE /api/organizations/{organization_id}/invitations/{invitation_id}
   */
  async cancelInvitation(
    organizationId: string,
    invitationId: string
  ): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(
      `/api/organizations/${organizationId}/invitations/${invitationId}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================

  /**
   * List all roles (system and custom) for an organization
   * GET /api/organizations/{organization_id}/roles
   */
  async listRoles(organizationId: string): Promise<ApiResponse<Role[]>> {
    return this.apiRequest<Role[]>(`/api/organizations/${organizationId}/roles`);
  }

  // ============================================================================
  // ORGANIZATION SWITCHING
  // ============================================================================

  /**
   * Switch active organization for current user
   * POST /api/organizations/{organization_id}/switch
   */
  async switchOrganization(organizationId: string): Promise<ApiResponse<{ message: string }>> {
    return this.apiRequest<{ message: string }>(`/api/organizations/${organizationId}/switch`, {
      method: 'POST',
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate organization slug from name with Russian transliteration
   */
  generateSlug(name: string): string {
    // Russian to Latin transliteration map
    const cyrillicMap: Record<string, string> = {
      а: 'a',
      б: 'b',
      в: 'v',
      г: 'g',
      д: 'd',
      е: 'e',
      ё: 'yo',
      ж: 'zh',
      з: 'z',
      и: 'i',
      й: 'y',
      к: 'k',
      л: 'l',
      м: 'm',
      н: 'n',
      о: 'o',
      п: 'p',
      р: 'r',
      с: 's',
      т: 't',
      у: 'u',
      ф: 'f',
      х: 'h',
      ц: 'ts',
      ч: 'ch',
      ш: 'sh',
      щ: 'sch',
      ъ: '',
      ы: 'y',
      ь: '',
      э: 'e',
      ю: 'yu',
      я: 'ya',
    };

    // Transliterate Russian characters
    let slug = name.toLowerCase().trim();

    // Replace each Russian character with its Latin equivalent
    slug = slug
      .split('')
      .map((char) => cyrillicMap[char] || char)
      .join('');

    // Clean up the slug
    return slug
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Validate invitation token format
   */
  isValidInvitationToken(token: string): boolean {
    // UUID v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  }

  /**
   * Check if invitation is expired
   */
  isInvitationExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(slug: string): string {
    const roleNames: Record<string, string> = {
      admin: 'Administrator',
      'financial-admin': 'Financial Administrator',
      'sales-manager': 'Sales Manager',
      'procurement-manager': 'Procurement Manager',
      'logistics-manager': 'Logistics Manager',
    };

    return roleNames[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Format member status for display
   */
  formatMemberStatus(status: string): { label: string; color: string } {
    const statusMap: Record<string, { label: string; color: string }> = {
      active: { label: 'Active', color: 'green' },
      invited: { label: 'Pending Invitation', color: 'yellow' },
      suspended: { label: 'Suspended', color: 'red' },
      left: { label: 'Left Organization', color: 'gray' },
    };

    return statusMap[status] || { label: status, color: 'gray' };
  }

  /**
   * Format organization status for display
   */
  formatOrganizationStatus(status: string): { label: string; color: string } {
    const statusMap: Record<string, { label: string; color: string }> = {
      active: { label: 'Active', color: 'green' },
      trial: { label: 'Trial', color: 'blue' },
      suspended: { label: 'Suspended', color: 'red' },
      deleted: { label: 'Deleted', color: 'gray' },
    };

    return statusMap[status] || { label: status, color: 'gray' };
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();

// Export default for convenience
export default organizationService;
