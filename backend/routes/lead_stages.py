"""
Lead Stages Routes - CRM System
Manage pipeline stages for leads
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from supabase import Client

from auth import get_current_user, User, require_permission
from services.activity_log_service import log_activity
from dependencies import get_supabase


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/lead-stages",
    tags=["lead_stages"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class LeadStageBase(BaseModel):
    """Base stage fields"""
    name: str
    order_index: int
    color: str = "#1890ff"
    is_qualified: bool = False
    is_failed: bool = False


class LeadStageCreate(LeadStageBase):
    """Create stage"""
    pass


class LeadStageUpdate(BaseModel):
    """Update stage (all fields optional)"""
    name: Optional[str] = None
    order_index: Optional[int] = None
    color: Optional[str] = None
    is_qualified: Optional[bool] = None
    is_failed: Optional[bool] = None


class LeadStage(LeadStageBase):
    """Stage with metadata"""
    id: str
    organization_id: str
    created_at: str
    updated_at: str


# ============================================================================
# LEAD STAGES CRUD OPERATIONS
# ============================================================================

@router.get("/", response_model=List[LeadStage])
async def list_lead_stages(
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    List all stages for organization

    Returns stages ordered by order_index
    """
    try:
        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not associated with organization"
            )

        result = supabase.table("lead_stages").select("*")\
            .eq("organization_id", str(user.current_organization_id))\
            .order("order_index")\
            .execute()

        return result.data or []

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stages: {str(e)}"
        )


@router.get("/{stage_id}", response_model=LeadStage)
async def get_lead_stage(
    stage_id: str,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """Get stage by ID"""
    try:

        result = supabase.table("lead_stages").select("*")\
            .eq("id", stage_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stage not found"
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stage: {str(e)}"
        )


@router.post("/", response_model=LeadStage, status_code=status.HTTP_201_CREATED)
async def create_lead_stage(
    stage_data: LeadStageCreate,
    user: User = Depends(require_permission("settings:manage")),  # Managers+ only
    supabase: Client = Depends(get_supabase)
):
    """
    Create custom stage

    Managers can add custom stages to pipeline
    """
    try:

        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not associated with organization"
            )

        # Check for duplicate name
        existing = supabase.table("lead_stages").select("id")\
            .eq("organization_id", str(user.current_organization_id))\
            .eq("name", stage_data.name)\
            .execute()

        if existing.data and len(existing.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stage with name '{stage_data.name}' already exists"
            )

        # Create stage
        stage_insert = {
            "organization_id": str(user.current_organization_id),
            "name": stage_data.name,
            "order_index": stage_data.order_index,
            "color": stage_data.color,
            "is_qualified": stage_data.is_qualified,
            "is_failed": stage_data.is_failed
        }

        result = supabase.table("lead_stages").insert(stage_insert).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create stage"
            )

        stage = result.data[0]

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="create",
            resource_type="lead_stage",
            resource_id=stage["id"],
            details={"stage_name": stage_data.name}
        )

        return stage

    except HTTPException:
        raise
    except Exception as e:
        # Check for unique constraint violation
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Stage with this name or order already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stage: {str(e)}"
        )


@router.put("/{stage_id}", response_model=LeadStage)
async def update_lead_stage(
    stage_id: str,
    stage_data: LeadStageUpdate,
    user: User = Depends(require_permission("settings:manage")),
    supabase: Client = Depends(get_supabase)
):
    """
    Update stage

    Managers can modify stages
    """
    try:

        # Verify stage exists
        existing = supabase.table("lead_stages").select("*")\
            .eq("id", stage_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stage not found"
            )

        # Build update dict
        update_dict = stage_data.dict(exclude_unset=True)

        # Update stage
        result = supabase.table("lead_stages").update(update_dict)\
            .eq("id", stage_id)\
            .execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="update",
            resource_type="lead_stage",
            resource_id=stage_id,
            details={"updated_fields": list(update_dict.keys())}
        )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update stage: {str(e)}"
        )


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead_stage(
    stage_id: str,
    user: User = Depends(require_permission("settings:manage")),
    supabase: Client = Depends(get_supabase)
):
    """
    Delete stage

    Cannot delete if leads are using this stage
    """
    try:

        # Check if stage is in use
        leads_using_stage = supabase.table("leads").select("id", count="exact")\
            .eq("stage_id", stage_id)\
            .execute()

        if leads_using_stage.count and leads_using_stage.count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete stage: {leads_using_stage.count} leads are using it"
            )

        # Get stage name for logging
        existing = supabase.table("lead_stages").select("name")\
            .eq("id", stage_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stage not found"
            )

        stage_name = existing.data[0]["name"]

        # Delete stage
        supabase.table("lead_stages").delete().eq("id", stage_id).execute()

        # Log activity
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="delete",
            resource_type="lead_stage",
            resource_id=stage_id,
            details={"stage_name": stage_name}
        )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete stage: {str(e)}"
        )
