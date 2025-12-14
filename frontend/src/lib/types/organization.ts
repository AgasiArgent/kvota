/**
 * Multi-Tenant Organization Types
 * Type definitions for organization management system
 * Matches backend models from backend/models.py
 */

// ============================================================================
// ENUMS
// ============================================================================

export type OrganizationStatus = 'active' | 'trial' | 'suspended' | 'deleted';
export type MemberStatus = 'active' | 'invited' | 'suspended' | 'left';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  status: OrganizationStatus;
  owner_id: string;
  settings?: Record<string, any>;
  supplier_code?: string; // 3-letter code for IDN (e.g., MBR, CMT)
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreate {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  settings?: Record<string, any>;
}

export interface OrganizationUpdate {
  name?: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  status?: OrganizationStatus;
  settings?: Record<string, any>;
  supplier_code?: string; // 3-letter code for IDN (e.g., MBR, CMT)
}

export interface UserOrganization {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role_id: string;
  role_name: string;
  role_slug: string;
  is_owner: boolean;
  joined_at: string;
}

// ============================================================================
// ROLE TYPES
// ============================================================================

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  is_system_role: boolean;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RoleCreate {
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  organization_id?: string;
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  permissions?: string[];
}

// ============================================================================
// MEMBER TYPES
// ============================================================================

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  status: MemberStatus;
  joined_at: string;
  invited_by?: string;
  invited_at?: string;
  left_at?: string;
}

export interface OrganizationMemberWithDetails {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  status: MemberStatus;
  joined_at: string;
  invited_by?: string;
  invited_at?: string;
  left_at?: string;
  user_email: string;
  user_full_name?: string;
  role_name: string;
  role_slug: string;
  inviter_email?: string;
}

export interface MemberCreate {
  email: string;
  role_id: string;
}

export interface MemberUpdate {
  role_id?: string;
  status?: MemberStatus;
}

// ============================================================================
// INVITATION TYPES
// ============================================================================

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  status: InvitationStatus;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InvitationWithDetails {
  id: string;
  organization_id: string;
  email: string;
  role_id: string;
  status: InvitationStatus;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
  role_name: string;
  role_slug: string;
  inviter_email: string;
  inviter_name?: string;
}

export interface InvitationCreate {
  email: string;
  role_id: string;
  expires_in_hours?: number;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface OrganizationContext {
  organization: Organization;
  member: OrganizationMember;
  role: Role;
  permissions: string[];
  is_owner: boolean;
}

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

export interface UserProfile {
  user_id: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  last_active_organization_id?: string;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserProfileUpdate {
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  settings?: Record<string, any>;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface OrganizationListResponse {
  organizations: UserOrganization[];
  total: number;
}

export interface MemberListResponse {
  members: OrganizationMemberWithDetails[];
  total: number;
}

export interface InvitationListResponse {
  invitations: InvitationWithDetails[];
  total: number;
}

export interface RoleListResponse {
  roles: Role[];
  total: number;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface SwitchOrganizationRequest {
  organization_id: string;
}

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

/**
 * Common organization permissions
 */
export const OrganizationPermissions = {
  // Organization management
  ORG_READ: 'org:read',
  ORG_UPDATE: 'org:update',
  ORG_DELETE: 'org:delete',
  ORG_SETTINGS: 'org:settings',

  // Member management
  MEMBER_READ: 'member:read',
  MEMBER_INVITE: 'member:invite',
  MEMBER_UPDATE: 'member:update',
  MEMBER_REMOVE: 'member:remove',

  // Role management
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',

  // Quote management
  QUOTE_READ_ALL: 'quote:read_all',
  QUOTE_CREATE: 'quote:create',
  QUOTE_UPDATE: 'quote:update',
  QUOTE_DELETE: 'quote:delete',
  QUOTE_APPROVE: 'quote:approve',

  // Customer management
  CUSTOMER_READ_ALL: 'customer:read_all',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',

  // Financial
  FINANCIAL_READ: 'financial:read',
  FINANCIAL_APPROVE: 'financial:approve',

  // Wildcard
  ALL: '*',
} as const;

/**
 * Check if user has specific permission
 */
export function hasPermission(userPermissions: string[], required: string): boolean {
  // Check for wildcard permission
  if (userPermissions.includes(OrganizationPermissions.ALL)) {
    return true;
  }

  // Check for exact match
  return userPermissions.includes(required);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  // Check for wildcard permission
  if (userPermissions.includes(OrganizationPermissions.ALL)) {
    return true;
  }

  // Check if user has any of the required permissions
  return required.some((perm) => userPermissions.includes(perm));
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  // Check for wildcard permission
  if (userPermissions.includes(OrganizationPermissions.ALL)) {
    return true;
  }

  // Check if user has all required permissions
  return required.every((perm) => userPermissions.includes(perm));
}
