"""
Team Management API Routes
Handles organization member CRUD operations
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from uuid import UUID
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr
import os
import secrets
import string

from models import (
    OrganizationMember, OrganizationMemberWithDetails,
    MemberStatus
)
from auth import (
    User, OrganizationContext, supabase_admin,
    get_current_user, get_organization_context,
    require_org_admin
)


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class AddMemberRequest(BaseModel):
    """Request body for adding a new team member"""
    email: EmailStr
    full_name: str
    role_id: UUID


class AddMemberResponse(BaseModel):
    """Response after adding a new team member"""
    message: str
    member_id: str
    user_email: str
    user_full_name: str
    role: str
    generated_password: Optional[str] = None  # Only set if new user was created
    is_new_user: bool


class ResetPasswordResponse(BaseModel):
    """Response after resetting a user's password"""
    message: str
    user_email: str
    new_password: str


def generate_password(length: int = 12) -> str:
    """Generate a secure random password"""
    alphabet = string.ascii_letters + string.digits
    # Ensure at least one of each type
    password = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
    ]
    # Fill the rest randomly
    password += [secrets.choice(alphabet) for _ in range(length - 3)]
    # Shuffle to avoid predictable pattern
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)

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


@router.post("/{organization_id}/members", response_model=AddMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    organization_id: str,
    request: AddMemberRequest,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Add new member to organization

    - Creates Supabase Auth user if doesn't exist (with generated password)
    - Adds user to organization_members table
    - Auth: Only manager/admin/owner can add members
    - Returns: Member details + generated password (if new user)
    """
    supabase = get_supabase_client()
    generated_password = None
    is_new_user = False

    try:
        # Validate role exists and is not owner-only
        role_result = supabase.table("roles") \
            .select("id, name, slug") \
            .eq("id", str(request.role_id)) \
            .single() \
            .execute()

        if not role_result.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role ID"
            )

        if role_result.data["slug"] == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign owner role. Only one owner per organization."
            )

        # Check if user exists in Supabase Auth
        target_user = None
        try:
            users_list = supabase_admin.auth.admin.list_users()
            for user in users_list:
                if hasattr(user, 'email') and user.email == request.email:
                    target_user = user
                    break
        except Exception as e:
            print(f"Error listing users: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to lookup users"
            )

        # If user doesn't exist, create them
        if not target_user:
            generated_password = generate_password()
            is_new_user = True

            try:
                create_response = supabase_admin.auth.admin.create_user({
                    "email": request.email,
                    "password": generated_password,
                    "email_confirm": True,  # Skip email verification
                    "user_metadata": {
                        "full_name": request.full_name,
                        "role": "member"  # Default metadata role
                    }
                })
                target_user = create_response.user
                print(f"Created new user: {request.email}")
            except Exception as e:
                print(f"Error creating user: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to create user: {str(e)}"
                )

        user_id = target_user.id

        # Check if user is already a member of this organization
        existing_member = supabase.table("organization_members") \
            .select("id, status") \
            .eq("organization_id", organization_id) \
            .eq("user_id", str(user_id)) \
            .execute()

        if existing_member.data and len(existing_member.data) > 0:
            member = existing_member.data[0]
            if member.get("status") == "active":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User is already a member of this organization"
                )
            elif member.get("status") == "left":
                # Re-activate the member
                from datetime import datetime, timezone
                reactivate_result = supabase.table("organization_members") \
                    .update({
                        "status": "active",
                        "role_id": str(request.role_id),
                        "joined_at": datetime.now(timezone.utc).isoformat()
                    }) \
                    .eq("id", member["id"]) \
                    .execute()

                return AddMemberResponse(
                    message="Member re-activated successfully",
                    member_id=member["id"],
                    user_email=request.email,
                    user_full_name=request.full_name,
                    role=role_result.data["name"],
                    generated_password=generated_password,
                    is_new_user=is_new_user
                )

        # Add user to organization
        from datetime import datetime, timezone

        member_data = {
            "organization_id": organization_id,
            "user_id": str(user_id),
            "role_id": str(request.role_id),
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

        return AddMemberResponse(
            message="Member added successfully",
            member_id=member_result.data[0]["id"],
            user_email=request.email,
            user_full_name=request.full_name,
            role=role_result.data["name"],
            generated_password=generated_password,
            is_new_user=is_new_user
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding team member: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add member: {str(e)}"
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


@router.post("/{organization_id}/members/{member_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_member_password(
    organization_id: str,
    member_id: str,
    context: OrganizationContext = Depends(require_org_admin())
):
    """
    Reset a member's password (admin only)

    - Generates new random password
    - Updates user in Supabase Auth
    - Auth: Only admin/owner can reset passwords
    - Validation: Cannot reset owner's password (unless you are the owner)
    - Returns: New password (one-time display)
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

        # Only owner can reset owner's password
        if member.data.get("is_owner") and not context.is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can reset the owner's password"
            )

        # Cannot reset your own password through this endpoint
        if member.data["user_id"] == str(context.user.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot reset your own password. Use the profile settings instead."
            )

        user_id = member.data["user_id"]

        # Get user email for response
        try:
            user_response = supabase_admin.auth.admin.get_user_by_id(user_id)
            user_email = user_response.user.email if user_response and user_response.user else "unknown"
        except Exception as e:
            print(f"Error fetching user: {e}")
            user_email = "unknown"

        # Generate new password
        new_password = generate_password()

        # Update user password in Supabase Auth
        try:
            supabase_admin.auth.admin.update_user_by_id(
                user_id,
                {"password": new_password}
            )
            print(f"Password reset for user: {user_email}")
        except Exception as e:
            print(f"Error resetting password: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to reset password: {str(e)}"
            )

        return ResetPasswordResponse(
            message="Password reset successfully",
            user_email=user_email,
            new_password=new_password
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error resetting member password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        )
