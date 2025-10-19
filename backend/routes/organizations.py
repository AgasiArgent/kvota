"""
Organization Management API Routes - Supabase Client Version
Handles organization CRUD, member management, invitations, and role management
Using Supabase REST API instead of direct PostgreSQL for WSL2 compatibility
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from uuid import UUID
from supabase import create_client, Client
import os
from datetime import datetime, timezone

from models import (
    Organization, OrganizationCreate, OrganizationUpdate,
    Role, OrganizationMember, OrganizationMemberCreate, OrganizationMemberUpdate, OrganizationMemberWithDetails,
    Invitation, InvitationCreate, InvitationWithDetails, InvitationAccept,
    UserProfile, UserProfileUpdate, UserOrganization,
    MemberStatus, InvitationStatus
)
from auth import (
    User, OrganizationContext,
    get_current_user, get_organization_context,
    require_org_admin, require_org_owner, require_org_permission,
    AuthenticationService, get_permissions_from_jsonb
)

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_supabase_client() -> Client:
    """Get Supabase client for database operations"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


def get_default_role_id() -> UUID:
    """Get the default role (Sales Manager) ID"""
    supabase = get_supabase_client()

    result = supabase.table("roles").select("id").eq("is_system_role", True).eq("slug", "sales_manager").limit(1).execute()

    if result.data and len(result.data) > 0:
        return UUID(result.data[0]["id"])

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Default role not found"
    )


# ============================================================================
# ORGANIZATION CRUD
# ============================================================================

@router.post("/", response_model=Organization, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    user: User = Depends(get_current_user)
):
    """
    Create a new organization
    User becomes the owner automatically
    """
    supabase = get_supabase_client()

    try:
        # Check if slug is unique
        existing = supabase.table("organizations").select("id").eq("slug", org_data.slug).execute()

        if existing.data and len(existing.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organization slug '{org_data.slug}' is already taken"
            )

        # Create organization
        org_insert = {
            "name": org_data.name,
            "slug": org_data.slug,
            "description": org_data.description,
            "logo_url": org_data.logo_url,
            "owner_id": str(user.id),
            "settings": org_data.settings or {},
            "status": "active"
        }

        org_result = supabase.table("organizations").insert(org_insert).execute()

        if not org_result.data or len(org_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create organization"
            )

        org_id = org_result.data[0]["id"]

        # Get admin role
        admin_role = supabase.table("roles").select("id").eq("is_system_role", True).eq("slug", "admin").limit(1).execute()

        admin_role_id = admin_role.data[0]["id"] if admin_role.data else str(get_default_role_id())

        # Add user as owner with admin role
        from datetime import datetime, timezone

        member_insert = {
            "organization_id": org_id,
            "user_id": str(user.id),
            "role_id": admin_role_id,
            "is_owner": True,
            "status": "active",
            "joined_at": datetime.now(timezone.utc).isoformat()
        }

        supabase.table("organization_members").insert(member_insert).execute()

        # Create/update user profile
        profile_data = {
            "user_id": str(user.id),
            "last_active_organization_id": org_id
        }

        supabase.table("user_profiles").upsert(profile_data).execute()

        return Organization(**org_result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create organization: {str(e)}"
        )


@router.get("/", response_model=List[UserOrganization])
async def list_user_organizations(user: User = Depends(get_current_user)):
    """
    Get all organizations the current user belongs to
    """
    supabase = get_supabase_client()

    try:
        # Get user's organization memberships
        result = supabase.table("organization_members") \
            .select("*, organizations(*), roles(*)") \
            .eq("user_id", str(user.id)) \
            .eq("status", "active") \
            .order("is_owner", desc=True) \
            .execute()

        organizations = []
        for row in result.data:
            # Flatten the nested data for UserOrganization model
            org_data = {
                "organization_id": row["organization_id"],
                "organization_name": row["organizations"]["name"],
                "organization_slug": row["organizations"]["slug"],
                "role_id": row["role_id"],
                "role_name": row["roles"]["name"],
                "role_slug": row["roles"]["slug"],
                "is_owner": row["is_owner"],
                "joined_at": row["joined_at"]
            }
            organizations.append(UserOrganization(**org_data))

        return organizations

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list organizations: {str(e)}"
        )


@router.get("/{organization_id}", response_model=Organization)
async def get_organization(
    organization_id: str,
    context: OrganizationContext = Depends(get_organization_context)
):
    """
    Get organization details
    User must be a member of the organization
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table("organizations").select("*").eq("id", organization_id).single().execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        return Organization(**result.data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get organization: {str(e)}"
        )


@router.put("/{organization_id}", response_model=Organization)
async def update_organization(
    organization_id: str,
    updates: OrganizationUpdate,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Update organization details
    Requires admin or owner role
    """
    supabase = get_supabase_client()

    try:
        # Build update data
        update_data = updates.dict(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # Update organization
        result = supabase.table("organizations") \
            .update(update_data) \
            .eq("id", organization_id) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )

        return Organization(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update organization: {str(e)}"
        )


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    organization_id: str,
    context: OrganizationContext = Depends(require_org_owner())
):
    """
    Delete organization (soft delete - set status to 'deleted')
    Only owner can delete
    """
    supabase = get_supabase_client()

    try:
        # Check if there are other active members
        members = supabase.table("organization_members") \
            .select("id", count="exact") \
            .eq("organization_id", organization_id) \
            .eq("status", "active") \
            .execute()

        if members.count and members.count > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete organization with active members. Remove members first."
            )

        # Soft delete
        supabase.table("organizations") \
            .update({"status": "deleted"}) \
            .eq("id", organization_id) \
            .execute()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete organization: {str(e)}"
        )


# ============================================================================
# ORGANIZATION MEMBERS
# ============================================================================

@router.get("/{organization_id}/members", response_model=List[OrganizationMemberWithDetails])
async def list_members(
    organization_id: str,
    context: OrganizationContext = Depends(get_organization_context)
):
    """
    List all members of the organization
    """
    supabase = get_supabase_client()

    try:
        # Get members with role details (no user_profiles join - fetch separately if needed)
        result = supabase.table("organization_members") \
            .select("*, roles(*)") \
            .eq("organization_id", organization_id) \
            .in_("status", ["active", "invited"]) \
            .order("is_owner", desc=True) \
            .execute()

        members = []
        for row in result.data:
            # Fetch user email from Supabase Auth
            try:
                user_response = supabase_admin.auth.admin.get_user_by_id(row["user_id"])
                user_email = user_response.user.email if user_response and user_response.user else f"user-{row['user_id'][:8]}"
                user_full_name = user_response.user.user_metadata.get('full_name') if user_response and user_response.user else None
            except:
                user_email = f"user-{row['user_id'][:8]}"
                user_full_name = None

            member_data = {k: v for k, v in row.items() if k not in ["roles"]}
            member_data["role_name"] = row["roles"]["name"] if row.get("roles") else "Unknown"
            member_data["role_slug"] = row["roles"]["slug"] if row.get("roles") else "unknown"
            member_data["user_full_name"] = user_full_name
            member_data["user_email"] = user_email
            members.append(OrganizationMemberWithDetails(**member_data))

        return members

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list members: {str(e)}"
        )


@router.post("/{organization_id}/members", response_model=OrganizationMember, status_code=status.HTTP_201_CREATED)
async def add_member_directly(
    organization_id: str,
    email: str,
    role_id: UUID,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Add a user to the organization directly (if user exists)
    Requires admin role
    """
    supabase = get_supabase_client()

    try:
        # Note: Cannot query auth.users directly via REST API
        # This endpoint should use Supabase Auth Admin API instead
        # For now, return error asking to use invitation system
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Please use the invitation system to add members"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add member: {str(e)}"
        )


@router.put("/{organization_id}/members/{user_id}", response_model=OrganizationMember)
async def update_member_role(
    organization_id: str,
    user_id: str,
    role_id: UUID,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Update a member's role
    Requires admin role
    """
    supabase = get_supabase_client()

    try:
        # Check if trying to change owner's role
        member = supabase.table("organization_members") \
            .select("is_owner") \
            .eq("organization_id", organization_id) \
            .eq("user_id", user_id) \
            .single() \
            .execute()

        if member.data and member.data.get("is_owner"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change owner's role. Transfer ownership first."
            )

        # Update role
        result = supabase.table("organization_members") \
            .update({"role_id": str(role_id)}) \
            .eq("organization_id", organization_id) \
            .eq("user_id", user_id) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )

        return OrganizationMember(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update member role: {str(e)}"
        )


@router.delete("/{organization_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    organization_id: str,
    user_id: str,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Remove a member from the organization
    Requires admin role
    Cannot remove owner
    """
    supabase = get_supabase_client()

    try:
        # Check if trying to remove owner
        member = supabase.table("organization_members") \
            .select("is_owner") \
            .eq("organization_id", organization_id) \
            .eq("user_id", user_id) \
            .single() \
            .execute()

        if member.data and member.data.get("is_owner"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove organization owner"
            )

        # Update status to 'left'
        result = supabase.table("organization_members") \
            .update({"status": "left"}) \
            .eq("organization_id", organization_id) \
            .eq("user_id", user_id) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove member: {str(e)}"
        )


# ============================================================================
# INVITATIONS
# ============================================================================

@router.post("/{organization_id}/invitations", response_model=Invitation, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    organization_id: str,
    invitation: InvitationCreate,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Create an invitation to join the organization
    Requires admin role
    """
    supabase = get_supabase_client()

    try:
        # Check for pending invitation
        pending = supabase.table("organization_invitations") \
            .select("id") \
            .eq("organization_id", organization_id) \
            .eq("email", invitation.email) \
            .eq("status", "pending") \
            .execute()

        if pending.data and len(pending.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pending invitation already exists for this email"
            )

        # Create invitation (token is auto-generated by trigger)
        invitation_data = {
            "organization_id": organization_id,
            "email": invitation.email,
            "role_id": str(invitation.role_id),
            "invited_by": str(context.user.id),
            "message": invitation.message if hasattr(invitation, 'message') else None,
            "status": "pending"
        }

        result = supabase.table("organization_invitations").insert(invitation_data).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create invitation"
            )

        return Invitation(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invitation: {str(e)}"
        )


@router.get("/{organization_id}/invitations", response_model=List[InvitationWithDetails])
async def list_invitations(
    organization_id: str,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    List all invitations for the organization
    Requires admin role
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table("organization_invitations") \
            .select("*, organizations(name), roles(name,slug)") \
            .eq("organization_id", organization_id) \
            .order("created_at", desc=True) \
            .execute()

        invitations = []
        for row in result.data:
            # Fetch inviter details from Supabase Auth if needed
            inviter_email = None
            inviter_name = None
            if row.get("invited_by"):
                try:
                    inviter_response = supabase_admin.auth.admin.get_user_by_id(row["invited_by"])
                    if inviter_response and inviter_response.user:
                        inviter_email = inviter_response.user.email
                        inviter_name = inviter_response.user.user_metadata.get('full_name')
                except:
                    pass

            invite_data = {k: v for k, v in row.items() if k not in ["organizations", "roles"]}
            invite_data["organization_name"] = row["organizations"]["name"] if row.get("organizations") else "Unknown"
            invite_data["role_name"] = row["roles"]["name"] if row.get("roles") else "Unknown"
            invite_data["role_slug"] = row["roles"]["slug"] if row.get("roles") else "unknown"
            invite_data["inviter_name"] = inviter_name
            invite_data["inviter_email"] = inviter_email or f"inviter-{row.get('invited_by', 'unknown')[:8]}"
            invitations.append(InvitationWithDetails(**invite_data))

        return invitations

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list invitations: {str(e)}"
        )


@router.post("/invitations/{token}/accept", status_code=status.HTTP_200_OK)
async def accept_invitation(
    token: str,
    user: User = Depends(get_current_user)
):
    """
    Accept an invitation to join an organization
    """
    supabase = get_supabase_client()

    try:
        # Get invitation
        result = supabase.table("organization_invitations") \
            .select("*") \
            .eq("token", token) \
            .eq("status", "pending") \
            .single() \
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found or already used"
            )

        invitation = result.data

        # Check if expired
        expires_at = datetime.fromisoformat(invitation['expires_at'].replace('Z', '+00:00'))
        if expires_at < datetime.now(timezone.utc):
            supabase.table("organization_invitations") \
                .update({"status": "expired"}) \
                .eq("id", invitation['id']) \
                .execute()

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invitation has expired"
            )

        # Check if email matches
        if invitation['email'] != user.email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invitation is for a different email address"
            )

        # Check if already a member
        existing = supabase.table("organization_members") \
            .select("id") \
            .eq("organization_id", invitation['organization_id']) \
            .eq("user_id", str(user.id)) \
            .execute()

        if existing.data and len(existing.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already a member of this organization"
            )

        # Add user to organization
        member_data = {
            "organization_id": invitation['organization_id'],
            "user_id": str(user.id),
            "role_id": invitation['role_id'],
            "status": "active",
            "invited_by": invitation['invited_by']
        }

        supabase.table("organization_members").insert(member_data).execute()

        # Mark invitation as accepted
        supabase.table("organization_invitations") \
            .update({"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("id", invitation['id']) \
            .execute()

        return {"message": "Invitation accepted successfully", "organization_id": invitation['organization_id']}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to accept invitation: {str(e)}"
        )


@router.delete("/{organization_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invitation(
    organization_id: str,
    invitation_id: str,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Cancel a pending invitation
    Requires admin role
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table("organization_invitations") \
            .update({"status": "cancelled"}) \
            .eq("id", invitation_id) \
            .eq("organization_id", organization_id) \
            .eq("status", "pending") \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found or already processed"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel invitation: {str(e)}"
        )


# ============================================================================
# ROLES
# ============================================================================

@router.get("/{organization_id}/roles", response_model=List[Role])
async def list_roles(
    organization_id: str,
    context: OrganizationContext = Depends(get_organization_context)
):
    """
    List all available roles (system + custom org roles)
    """
    supabase = get_supabase_client()

    try:
        # Get system roles and org-specific roles
        result = supabase.table("roles") \
            .select("*") \
            .or_(f"is_system_role.eq.true,organization_id.eq.{organization_id}") \
            .order("is_system_role", desc=True) \
            .order("name") \
            .execute()

        return [Role(**row) for row in result.data]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list roles: {str(e)}"
        )


# ============================================================================
# ORGANIZATION SWITCHING
# ============================================================================

@router.post("/{organization_id}/switch", status_code=status.HTTP_200_OK)
async def switch_organization(
    organization_id: str,
    user: User = Depends(get_current_user)
):
    """
    Switch user's active organization
    Updates user_profiles.last_active_organization_id
    """
    supabase = get_supabase_client()

    try:
        # Verify user is member
        member = supabase.table("organization_members") \
            .select("id") \
            .eq("organization_id", organization_id) \
            .eq("user_id", str(user.id)) \
            .eq("status", "active") \
            .execute()

        if not member.data or len(member.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this organization"
            )

        # Update last active organization
        supabase.table("user_profiles") \
            .update({"last_active_organization_id": organization_id}) \
            .eq("user_id", str(user.id)) \
            .execute()

        return {"message": "Organization switched successfully", "organization_id": organization_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to switch organization: {str(e)}"
        )
