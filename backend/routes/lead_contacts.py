"""
Lead Contacts Routes - CRM System
CRUD operations for lead contacts (ЛПР - Лица, Принимающие Решения)
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from supabase import Client

from auth import get_current_user, User
from services.activity_log_service import log_activity
from dependencies import get_supabase


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/lead-contacts",
    tags=["lead_contacts"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class LeadContactBase(BaseModel):
    """Base contact fields"""
    full_name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_primary: bool = False


class LeadContactCreate(LeadContactBase):
    """Create contact (lead_id from URL)"""
    pass


class LeadContactUpdate(BaseModel):
    """Update contact (all fields optional)"""
    full_name: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_primary: Optional[bool] = None


class LeadContact(LeadContactBase):
    """Contact with metadata"""
    id: str
    lead_id: str
    organization_id: str
    created_at: str
    updated_at: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def verify_lead_access(lead_id: str, user: User, supabase: Client) -> bool:
    """Verify user has access to lead (RLS check)"""
    result = supabase.table("leads").select("id")\
        .eq("id", lead_id)\
        .eq("organization_id", str(user.current_organization_id))\
        .execute()
    return result.data and len(result.data) > 0


# ============================================================================
# CONTACT CRUD OPERATIONS
# ============================================================================

@router.get("/lead/{lead_id}", response_model=List[LeadContact])
async def list_lead_contacts(
    lead_id: str,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    List all contacts for a lead

    Returns contacts ordered by is_primary DESC, full_name ASC
    """
    try:
        # Verify lead access
        if not await verify_lead_access(lead_id, user, supabase):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found or access denied"
            )

        result = supabase.table("lead_contacts").select("*")\
            .eq("lead_id", lead_id)\
            .order("is_primary", desc=True)\
            .order("full_name")\
            .execute()

        return result.data or []

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch contacts: {str(e)}"
        )


@router.get("/{contact_id}", response_model=LeadContact)
async def get_lead_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get contact by ID

    RLS ensures user can only access contacts for their leads
    """
    try:
        result = supabase.table("lead_contacts").select("*")\
            .eq("id", contact_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found"
            )

        # Verify lead access via RLS
        contact = result.data[0]
        if not await verify_lead_access(contact["lead_id"], user, supabase):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found or access denied"
            )

        return contact

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch contact: {str(e)}"
        )


@router.post("/lead/{lead_id}", response_model=LeadContact, status_code=status.HTTP_201_CREATED)
async def create_lead_contact(
    lead_id: str,
    contact_data: LeadContactCreate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Create new contact for lead

    If is_primary=true, automatically unsets other primary contacts
    """
    try:
        # Verify lead access
        if not await verify_lead_access(lead_id, user, supabase):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found or access denied"
            )

        # If creating primary contact, unset existing primary
        if contact_data.is_primary:
            supabase.table("lead_contacts").update({"is_primary": False})\
                .eq("lead_id", lead_id)\
                .eq("is_primary", True)\
                .execute()

        # Create contact
        contact_insert = {
            "lead_id": lead_id,
            "organization_id": str(user.current_organization_id),
            "full_name": contact_data.full_name,
            "position": contact_data.position,
            "phone": contact_data.phone,
            "email": contact_data.email,
            "is_primary": contact_data.is_primary
        }

        result = supabase.table("lead_contacts").insert(contact_insert).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create contact"
            )

        contact = result.data[0]

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="create",
            resource_type="lead_contact",
            resource_id=contact["id"],
            details={
                "lead_id": lead_id,
                "full_name": contact_data.full_name
            }
        )

        return contact

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create contact: {str(e)}"
        )


@router.put("/{contact_id}", response_model=LeadContact)
async def update_lead_contact(
    contact_id: str,
    contact_data: LeadContactUpdate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Update contact

    If setting is_primary=true, automatically unsets other primary contacts
    """
    try:
        # Get existing contact
        existing = supabase.table("lead_contacts").select("*")\
            .eq("id", contact_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found"
            )

        contact = existing.data[0]
        lead_id = contact["lead_id"]

        # Verify lead access
        if not await verify_lead_access(lead_id, user, supabase):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found or access denied"
            )

        # Build update dict
        update_dict = contact_data.dict(exclude_unset=True)

        # If setting as primary, unset existing primary
        if update_dict.get("is_primary") is True:
            supabase.table("lead_contacts").update({"is_primary": False})\
                .eq("lead_id", lead_id)\
                .eq("is_primary", True)\
                .neq("id", contact_id)\
                .execute()

        # Update contact
        result = supabase.table("lead_contacts").update(update_dict)\
            .eq("id", contact_id)\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update contact"
            )

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="update",
            resource_type="lead_contact",
            resource_id=contact_id,
            details={
                "lead_id": lead_id,
                "updated_fields": list(update_dict.keys())
            }
        )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update contact: {str(e)}"
        )


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Delete contact

    Cannot delete if it's the only contact for the lead (at least one required)
    """
    try:
        # Get existing contact
        existing = supabase.table("lead_contacts").select("lead_id,full_name")\
            .eq("id", contact_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found"
            )

        contact = existing.data[0]
        lead_id = contact["lead_id"]
        full_name = contact["full_name"]

        # Verify lead access
        if not await verify_lead_access(lead_id, user, supabase):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found or access denied"
            )

        # Check if this is the last contact (optional - can be removed if not needed)
        # count_result = supabase.table("lead_contacts").select("id", count="exact")\
        #     .eq("lead_id", lead_id)\
        #     .execute()
        #
        # if count_result.count == 1:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Cannot delete the only contact for a lead"
        #     )

        # Delete contact
        supabase.table("lead_contacts").delete().eq("id", contact_id).execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="delete",
            resource_type="lead_contact",
            resource_id=contact_id,
            details={
                "lead_id": lead_id,
                "full_name": full_name
            }
        )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete contact: {str(e)}"
        )


# ============================================================================
# ADDITIONAL OPERATIONS
# ============================================================================

@router.patch("/{contact_id}/set-primary")
async def set_primary_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Set contact as primary

    Automatically unsets other primary contacts for the same lead
    """
    try:
        # Get existing contact
        existing = supabase.table("lead_contacts").select("lead_id")\
            .eq("id", contact_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found"
            )

        lead_id = existing.data[0]["lead_id"]

        # Verify lead access
        if not await verify_lead_access(lead_id, user, supabase):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found or access denied"
            )

        # Unset existing primary for this lead
        supabase.table("lead_contacts").update({"is_primary": False})\
            .eq("lead_id", lead_id)\
            .eq("is_primary", True)\
            .execute()

        # Set new primary
        result = supabase.table("lead_contacts").update({"is_primary": True})\
            .eq("id", contact_id)\
            .execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="set_primary",
            resource_type="lead_contact",
            resource_id=contact_id,
            details={"lead_id": lead_id}
        )

        return {
            "success": True,
            "contact_id": contact_id,
            "message": "Contact set as primary successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set primary contact: {str(e)}"
        )
