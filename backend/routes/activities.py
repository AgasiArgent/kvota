"""
Activities Routes - CRM System
CRUD operations for activities (meetings, calls, emails, tasks)
Supports both leads and customers
"""
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel
from supabase import create_client, Client

from auth import get_current_user, User
from services.activity_log_service import log_activity
import os


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/activities",
    tags=["activities"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ActivityBase(BaseModel):
    """Base activity fields"""
    type: str  # 'call', 'meeting', 'email', 'task'
    title: Optional[str] = None
    notes: Optional[str] = None
    result: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 15
    assigned_to: Optional[str] = None


class ActivityCreate(ActivityBase):
    """Create activity (requires either lead_id or customer_id)"""
    lead_id: Optional[str] = None
    customer_id: Optional[str] = None


class ActivityUpdate(BaseModel):
    """Update activity (all fields optional)"""
    type: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    result: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    completed: Optional[bool] = None
    assigned_to: Optional[str] = None


class Activity(ActivityBase):
    """Activity with metadata"""
    id: str
    organization_id: str
    lead_id: Optional[str] = None
    customer_id: Optional[str] = None
    completed: bool
    completed_at: Optional[str] = None
    google_event_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str
    updated_at: str


class ActivityWithDetails(Activity):
    """Activity with related entity names"""
    lead_company_name: Optional[str] = None
    customer_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
    created_by_name: Optional[str] = None


class ActivityListResponse(BaseModel):
    """Paginated activity list"""
    data: List[ActivityWithDetails]
    total: int
    page: int
    limit: int


class MarkCompleteRequest(BaseModel):
    """Mark activity as completed"""
    result: Optional[str] = None  # Optional result/outcome


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_supabase_client() -> Client:
    """Create Supabase client with service role key"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )


async def verify_lead_or_customer_access(
    lead_id: Optional[str],
    customer_id: Optional[str],
    user: User
) -> bool:
    """Verify user has access to lead or customer"""
    supabase = get_supabase_client()

    if lead_id:
        result = supabase.table("leads").select("id")\
            .eq("id", lead_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()
        return result.data and len(result.data) > 0

    if customer_id:
        result = supabase.table("customers").select("id")\
            .eq("id", customer_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()
        return result.data and len(result.data) > 0

    return False


# ============================================================================
# ACTIVITIES CRUD OPERATIONS
# ============================================================================

@router.get("/", response_model=ActivityListResponse)
async def list_activities(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    activity_type: Optional[str] = Query(None, description="Filter by type"),
    completed: Optional[bool] = Query(None, description="Filter by completion status"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user"),
    lead_id: Optional[str] = Query(None, description="Filter by lead"),
    customer_id: Optional[str] = Query(None, description="Filter by customer"),
    from_date: Optional[datetime] = Query(None, description="Scheduled from date"),
    to_date: Optional[datetime] = Query(None, description="Scheduled to date"),
    user: User = Depends(get_current_user)
):
    """
    List activities with pagination and filtering

    Returns activities for leads and customers user has access to
    """
    try:
        supabase = get_supabase_client()

        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not associated with organization"
            )

        # Build query with joins
        query = supabase.table("activities").select(
            "*,"
            "leads(company_name),"
            "customers(name),"
            "assigned_user:assigned_to(email),"
            "creator:created_by(email)",
            count="exact"
        )
        query = query.eq("organization_id", str(user.current_organization_id))

        # Apply filters
        if activity_type:
            query = query.eq("type", activity_type)

        if completed is not None:
            query = query.eq("completed", completed)

        if assigned_to:
            if assigned_to == "unassigned":
                query = query.is_("assigned_to", "null")
            elif assigned_to == "me":
                query = query.eq("assigned_to", str(user.id))
            else:
                query = query.eq("assigned_to", assigned_to)

        if lead_id:
            query = query.eq("lead_id", lead_id)

        if customer_id:
            query = query.eq("customer_id", customer_id)

        if from_date:
            query = query.gte("scheduled_at", from_date.isoformat())

        if to_date:
            query = query.lte("scheduled_at", to_date.isoformat())

        # Pagination and ordering
        offset = (page - 1) * limit
        query = query.order("scheduled_at", desc=True)\
            .range(offset, offset + limit - 1)

        result = query.execute()

        # Format response with related names
        activities_with_details = []
        for activity in result.data or []:
            activity_dict = dict(activity)
            activity_dict["lead_company_name"] = activity.get("leads", {}).get("company_name") if activity.get("leads") else None
            activity_dict["customer_name"] = activity.get("customers", {}).get("name") if activity.get("customers") else None
            activity_dict["assigned_to_name"] = activity.get("assigned_user", {}).get("email") if activity.get("assigned_user") else None
            activity_dict["created_by_name"] = activity.get("creator", {}).get("email") if activity.get("creator") else None
            activities_with_details.append(activity_dict)

        return ActivityListResponse(
            data=activities_with_details,
            total=result.count or 0,
            page=page,
            limit=limit
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch activities: {str(e)}"
        )


@router.get("/{activity_id}", response_model=ActivityWithDetails)
async def get_activity(
    activity_id: str,
    user: User = Depends(get_current_user)
):
    """Get activity by ID with details"""
    try:
        supabase = get_supabase_client()

        result = supabase.table("activities").select(
            "*,"
            "leads(company_name),"
            "customers(name),"
            "assigned_user:assigned_to(email),"
            "creator:created_by(email)"
        )\
            .eq("id", activity_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Activity not found"
            )

        activity = result.data[0]
        activity_dict = dict(activity)
        activity_dict["lead_company_name"] = activity.get("leads", {}).get("company_name") if activity.get("leads") else None
        activity_dict["customer_name"] = activity.get("customers", {}).get("name") if activity.get("customers") else None
        activity_dict["assigned_to_name"] = activity.get("assigned_user", {}).get("email") if activity.get("assigned_user") else None
        activity_dict["created_by_name"] = activity.get("creator", {}).get("email") if activity.get("creator") else None

        return activity_dict

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch activity: {str(e)}"
        )


@router.post("/", response_model=Activity, status_code=status.HTTP_201_CREATED)
async def create_activity(
    activity_data: ActivityCreate,
    user: User = Depends(get_current_user)
):
    """
    Create new activity

    Must provide either lead_id OR customer_id (not both)
    """
    try:
        supabase = get_supabase_client()

        if not user.current_organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not associated with organization"
            )

        # Validate: exactly one of lead_id or customer_id
        if not activity_data.lead_id and not activity_data.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either lead_id or customer_id is required"
            )

        if activity_data.lead_id and activity_data.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Activity cannot belong to both lead and customer"
            )

        # Verify access to lead or customer
        if not await verify_lead_or_customer_access(
            activity_data.lead_id,
            activity_data.customer_id,
            user
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead or customer not found or access denied"
            )

        # Validate activity type
        valid_types = ['call', 'meeting', 'email', 'task']
        if activity_data.type not in valid_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid activity type. Must be one of: {valid_types}"
            )

        # Create activity
        activity_insert = {
            "organization_id": str(user.current_organization_id),
            "lead_id": activity_data.lead_id,
            "customer_id": activity_data.customer_id,
            "type": activity_data.type,
            "title": activity_data.title,
            "notes": activity_data.notes,
            "result": activity_data.result,
            "scheduled_at": activity_data.scheduled_at.isoformat() if activity_data.scheduled_at else None,
            "duration_minutes": activity_data.duration_minutes,
            "completed": False,
            "assigned_to": activity_data.assigned_to or str(user.id),
            "created_by": str(user.id)
        }

        result = supabase.table("activities").insert(activity_insert).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create activity"
            )

        activity = result.data[0]

        # Log activity creation
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="create",
            resource_type="activity",
            resource_id=activity["id"],
            details={
                "activity_type": activity_data.type,
                "lead_id": activity_data.lead_id,
                "customer_id": activity_data.customer_id
            }
        )

        return activity

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create activity: {str(e)}"
        )


@router.put("/{activity_id}", response_model=Activity)
async def update_activity(
    activity_id: str,
    activity_data: ActivityUpdate,
    user: User = Depends(get_current_user)
):
    """
    Update activity

    Only assigned user or creator can update
    """
    try:
        supabase = get_supabase_client()

        # Verify activity exists and user has access
        existing = supabase.table("activities").select("*")\
            .eq("id", activity_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Activity not found"
            )

        # Build update dict
        update_dict = activity_data.dict(exclude_unset=True)

        # Convert datetime to ISO string if present
        if "scheduled_at" in update_dict and update_dict["scheduled_at"]:
            update_dict["scheduled_at"] = update_dict["scheduled_at"].isoformat()

        # Update activity
        result = supabase.table("activities").update(update_dict)\
            .eq("id", activity_id)\
            .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update activity"
            )

        # Log update
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="update",
            resource_type="activity",
            resource_id=activity_id,
            details={"updated_fields": list(update_dict.keys())}
        )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update activity: {str(e)}"
        )


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: str,
    user: User = Depends(get_current_user)
):
    """
    Delete activity

    Only assigned user or creator can delete
    """
    try:
        supabase = get_supabase_client()

        # Get activity for logging
        existing = supabase.table("activities").select("type,title")\
            .eq("id", activity_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Activity not found"
            )

        activity_type = existing.data[0].get("type")
        activity_title = existing.data[0].get("title")

        # Delete activity
        supabase.table("activities").delete().eq("id", activity_id).execute()

        # Log deletion
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="delete",
            resource_type="activity",
            resource_id=activity_id,
            details={
                "activity_type": activity_type,
                "title": activity_title
            }
        )

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete activity: {str(e)}"
        )


# ============================================================================
# ACTIVITY OPERATIONS
# ============================================================================

@router.patch("/{activity_id}/complete")
async def mark_activity_complete(
    activity_id: str,
    complete_data: MarkCompleteRequest,
    user: User = Depends(get_current_user)
):
    """
    Mark activity as completed

    Sets completed=true, completed_at=now, optionally updates result
    """
    try:
        supabase = get_supabase_client()

        # Verify activity exists
        existing = supabase.table("activities").select("id,completed")\
            .eq("id", activity_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Activity not found"
            )

        if existing.data[0].get("completed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Activity already completed"
            )

        # Update to completed
        update_data = {
            "completed": True,
            "completed_at": datetime.utcnow().isoformat()
        }

        if complete_data.result:
            update_data["result"] = complete_data.result

        result = supabase.table("activities").update(update_data)\
            .eq("id", activity_id)\
            .execute()

        # Log completion
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="complete",
            resource_type="activity",
            resource_id=activity_id,
            details={"result": complete_data.result}
        )

        return {
            "success": True,
            "activity_id": activity_id,
            "message": "Activity marked as completed"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark activity complete: {str(e)}"
        )


@router.patch("/{activity_id}/reopen")
async def reopen_activity(
    activity_id: str,
    user: User = Depends(get_current_user)
):
    """
    Reopen completed activity

    Sets completed=false, completed_at=null
    """
    try:
        supabase = get_supabase_client()

        # Verify activity exists
        existing = supabase.table("activities").select("id,completed")\
            .eq("id", activity_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Activity not found"
            )

        if not existing.data[0].get("completed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Activity is not completed"
            )

        # Reopen activity
        result = supabase.table("activities").update({
            "completed": False,
            "completed_at": None
        }).eq("id", activity_id).execute()

        # Log reopening
        await log_activity(
            user_id=str(user.id),
            organization_id=str(user.current_organization_id),
            action="reopen",
            resource_type="activity",
            resource_id=activity_id,
            details={}
        )

        return {
            "success": True,
            "activity_id": activity_id,
            "message": "Activity reopened successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reopen activity: {str(e)}"
        )


# ============================================================================
# SPECIALIZED QUERIES
# ============================================================================

@router.get("/upcoming/my", response_model=List[ActivityWithDetails])
async def get_my_upcoming_activities(
    days: int = Query(7, ge=1, le=30, description="Number of days to look ahead"),
    user: User = Depends(get_current_user)
):
    """
    Get upcoming activities assigned to current user

    Returns incomplete activities scheduled in next N days
    """
    try:
        supabase = get_supabase_client()

        now = datetime.utcnow()
        future = now + timedelta(days=days)

        result = supabase.table("activities").select(
            "*,"
            "leads(company_name),"
            "customers(name),"
            "assigned_user:assigned_to(email),"
            "creator:created_by(email)"
        )\
            .eq("organization_id", str(user.current_organization_id))\
            .eq("assigned_to", str(user.id))\
            .eq("completed", False)\
            .gte("scheduled_at", now.isoformat())\
            .lte("scheduled_at", future.isoformat())\
            .order("scheduled_at")\
            .execute()

        # Format response
        activities_with_details = []
        for activity in result.data or []:
            activity_dict = dict(activity)
            activity_dict["lead_company_name"] = activity.get("leads", {}).get("company_name") if activity.get("leads") else None
            activity_dict["customer_name"] = activity.get("customers", {}).get("name") if activity.get("customers") else None
            activity_dict["assigned_to_name"] = activity.get("assigned_user", {}).get("email") if activity.get("assigned_user") else None
            activity_dict["created_by_name"] = activity.get("creator", {}).get("email") if activity.get("creator") else None
            activities_with_details.append(activity_dict)

        return activities_with_details

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch upcoming activities: {str(e)}"
        )


@router.get("/overdue/my", response_model=List[ActivityWithDetails])
async def get_my_overdue_activities(
    user: User = Depends(get_current_user)
):
    """
    Get overdue activities assigned to current user

    Returns incomplete activities scheduled in the past
    """
    try:
        supabase = get_supabase_client()

        now = datetime.utcnow()

        result = supabase.table("activities").select(
            "*,"
            "leads(company_name),"
            "customers(name),"
            "assigned_user:assigned_to(email),"
            "creator:created_by(email)"
        )\
            .eq("organization_id", str(user.current_organization_id))\
            .eq("assigned_to", str(user.id))\
            .eq("completed", False)\
            .lt("scheduled_at", now.isoformat())\
            .order("scheduled_at")\
            .execute()

        # Format response
        activities_with_details = []
        for activity in result.data or []:
            activity_dict = dict(activity)
            activity_dict["lead_company_name"] = activity.get("leads", {}).get("company_name") if activity.get("leads") else None
            activity_dict["customer_name"] = activity.get("customers", {}).get("name") if activity.get("customers") else None
            activity_dict["assigned_to_name"] = activity.get("assigned_user", {}).get("email") if activity.get("assigned_user") else None
            activity_dict["created_by_name"] = activity.get("creator", {}).get("email") if activity.get("creator") else None
            activities_with_details.append(activity_dict)

        return activities_with_details

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch overdue activities: {str(e)}"
        )
