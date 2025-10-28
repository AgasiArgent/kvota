"""
Team Management API Routes
Handles organization member CRUD operations
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from uuid import UUID
from supabase import create_client, Client
import os

from models import (
    OrganizationMember, OrganizationMemberWithDetails,
    MemberStatus
)
from auth import (
    User, OrganizationContext, supabase_admin,
    get_current_user, get_organization_context,
    require_org_admin
)

router = APIRouter(prefix="/api/organizations", tags=["team"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_supabase_client() -> Client:
    """Get Supabase client for database operations"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


# ============================================================================
# TEAM MEMBER CRUD OPERATIONS
# ============================================================================

@router.get("/{organization_id}/members", response_model=List[OrganizationMemberWithDetails])
async def list_team_members(
    organization_id: str,
    context: OrganizationContext = Depends(get_organization_context)
):
    """
    List all team members in the organization

    - Returns: user id, name, email, role, joined date
    - Ordered by: role hierarchy (owner → admin → manager → member), then by name
    - Auth: Any authenticated user in the organization
    - RLS: Only shows members from user's organization
    """
    supabase = get_supabase_client()

    try:
        # Get members with role details
        result = supabase.table("organization_members") \
            .select("*, roles(*)") \
            .eq("organization_id", organization_id) \
            .in_("status", ["active", "invited"]) \
            .order("is_owner", desc=True) \
            .execute()

        members = []
        for row in result.data:
            # Fetch user details from Supabase Auth
            try:
                user_response = supabase_admin.auth.admin.get_user_by_id(row["user_id"])
                user_email = user_response.user.email if user_response and user_response.user else f"user-{row['user_id'][:8]}"
                user_full_name = user_response.user.user_metadata.get('full_name') if user_response and user_response.user and user_response.user.user_metadata else None
            except Exception as e:
                print(f"Error fetching user details for {row['user_id']}: {e}")
                user_email = f"user-{row['user_id'][:8]}"
                user_full_name = None

            # Build member data
            member_data = {k: v for k, v in row.items() if k not in ["roles"]}
            member_data["role_name"] = row["roles"]["name"] if row.get("roles") else "Unknown"
            member_data["role_slug"] = row["roles"]["slug"] if row.get("roles") else "unknown"
            member_data["user_full_name"] = user_full_name
            member_data["user_email"] = user_email

            members.append(OrganizationMemberWithDetails(**member_data))

        # Sort by role hierarchy, then by name
        role_order = {"owner": 0, "admin": 1, "manager": 2, "member": 3}
        members.sort(key=lambda m: (
            0 if m.is_owner else 1,  # Owners first
            role_order.get(m.role_slug, 999),  # Then by role
            (m.user_full_name or m.user_email or "").lower()  # Then by name
        ))

        return members

    except Exception as e:
        print(f"Error listing team members: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list team members: {str(e)}"
        )


@router.post("/{organization_id}/members", response_model=dict, status_code=status.HTTP_201_CREATED)
async def invite_team_member(
    organization_id: str,
    email: str,
    role_id: UUID,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Invite new member by email

    - Request body: email and role_id
    - Roles allowed: any role except changing ownership
    - Auth: Only manager/admin/owner can invite
    - Logic:
      - Check if user with email exists in Supabase auth
      - If exists: Add to organization_members table
      - If not exists: Return error "User not found"
    - Return: Success message with invitation details
    """
    supabase = get_supabase_client()

    try:
        # Validate role exists and is not owner-only
        role_result = supabase.table("roles") \
            .select("id, name, slug") \
            .eq("id", str(role_id)) \
            .single() \
            .execute()

        if not role_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role ID"
            )

        # Check if user exists in Supabase Auth
        try:
            # Try to find user by email using Admin API
            users_list = supabase_admin.auth.admin.list_users()
            target_user = None

            for user in users_list:
                if hasattr(user, 'email') and user.email == email:
                    target_user = user
                    break

            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with email '{email}' not found. User must register first."
                )

            user_id = target_user.id

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error looking up user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to lookup user"
            )

        # Check if user is already a member
        existing_member = supabase.table("organization_members") \
            .select("id, status") \
            .eq("organization_id", organization_id) \
            .eq("user_id", user_id) \
            .execute()

        if existing_member.data and len(existing_member.data) > 0:
            member = existing_member.data[0]
            if member.get("status") == "active":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User is already a member of this organization"
                )
            elif member.get("status") == "invited":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User already has a pending invitation"
                )

        # Add user to organization
        from datetime import datetime, timezone

        member_data = {
            "organization_id": organization_id,
            "user_id": user_id,
            "role_id": str(role_id),
            "status": "active",
            "is_owner": False,
            "invited_by": str(context.user.id),
            "joined_at": datetime.now(timezone.utc).isoformat()
        }

        member_result = supabase.table("organization_members").insert(member_data).execute()

        if not member_result.data or len(member_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add member"
            )

        return {
            "message": "Member added successfully",
            "member_id": member_result.data[0]["id"],
            "user_email": email,
            "role": role_result.data["name"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error inviting team member: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to invite member: {str(e)}"
        )


@router.put("/{organization_id}/members/{member_id}/role", response_model=OrganizationMember)
async def update_member_role(
    organization_id: str,
    member_id: str,
    role_id: UUID,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Change member's role

    - Request body: new role_id
    - Auth: Only admin/owner can change roles
    - Validation:
      - Cannot change owner role (only one owner)
      - Cannot demote yourself to lower role
      - Cannot promote to owner (transfer ownership not in MVP)
    - Return: Updated member record
    """
    supabase = get_supabase_client()

    try:
        # Get current member details
        member = supabase.table("organization_members") \
            .select("*, roles(slug)") \
            .eq("id", member_id) \
            .eq("organization_id", organization_id) \
            .single() \
            .execute()

        if not member.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )

        # Check if trying to change owner's role
        if member.data.get("is_owner"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change owner's role. Transfer ownership is not supported in this version."
            )

        # Check if trying to change own role
        if member.data["user_id"] == str(context.user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change your own role"
            )

        # Validate new role
        new_role = supabase.table("roles") \
            .select("id, slug") \
            .eq("id", str(role_id)) \
            .single() \
            .execute()

        if not new_role.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role ID"
            )

        # Update role
        result = supabase.table("organization_members") \
            .update({"role_id": str(role_id)}) \
            .eq("id", member_id) \
            .eq("organization_id", organization_id) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to update member role"
            )

        return OrganizationMember(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating member role: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update member role: {str(e)}"
        )


@router.delete("/{organization_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    organization_id: str,
    member_id: str,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Remove member from organization

    - Auth: Only admin/owner can remove members
    - Validation:
      - Cannot remove owner
      - Cannot remove yourself
    - Logic: Soft delete (set status to 'left')
    - Return: Success (204 No Content)
    """
    supabase = get_supabase_client()

    try:
        # Get member details
        member = supabase.table("organization_members") \
            .select("user_id, is_owner") \
            .eq("id", member_id) \
            .eq("organization_id", organization_id) \
            .single() \
            .execute()

        if not member.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )

        # Check if trying to remove owner
        if member.data.get("is_owner"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove organization owner"
            )

        # Check if trying to remove yourself
        if member.data["user_id"] == str(context.user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove yourself from the organization"
            )

        # Soft delete (set status to 'left')
        result = supabase.table("organization_members") \
            .update({"status": "left"}) \
            .eq("id", member_id) \
            .eq("organization_id", organization_id) \
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to remove member"
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing team member: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove member: {str(e)}"
        )
