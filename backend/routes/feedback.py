"""
Feedback Routes - In-app bug reporting system
Allows users to submit feedback and admins to manage it
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID
from supabase import create_client, Client
import os

from auth import get_current_user, User, require_role, UserRole

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class FeedbackCreate(BaseModel):
    """Model for creating feedback"""
    page_url: str = Field(..., min_length=1)
    description: str = Field(..., min_length=10)
    browser_info: Optional[Dict[str, Any]] = None

class FeedbackResponse(BaseModel):
    """Model for feedback response"""
    id: UUID
    organization_id: UUID
    user_id: UUID
    page_url: str
    description: str
    browser_info: Optional[Dict[str, Any]]
    status: str
    created_at: datetime
    updated_at: datetime

    # Joined user info
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None

    class Config:
        from_attributes = True

class FeedbackListResponse(BaseModel):
    """Model for paginated feedback list"""
    feedback: List[FeedbackResponse]
    total: int
    page: int
    per_page: int

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    feedback_data: FeedbackCreate,
    user: User = Depends(get_current_user)
):
    """
    Submit new feedback/bug report

    - Auto-captures user_id and organization_id from JWT
    - Requires description with at least 10 characters
    - Optionally captures browser info
    """
    try:
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Insert feedback
        result = supabase.table("feedback").insert({
            "organization_id": str(user.current_organization_id),
            "user_id": str(user.id),
            "page_url": feedback_data.page_url,
            "description": feedback_data.description,
            "browser_info": feedback_data.browser_info,
            "status": "open"
        }).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create feedback"
            )

        feedback = result.data[0]

        # Add user info
        feedback["user_email"] = user.email
        feedback["user_full_name"] = user.full_name

        return FeedbackResponse(**feedback)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.get("/", response_model=FeedbackListResponse)
async def list_feedback(
    status_filter: Optional[str] = Query(None, regex="^(open|resolved)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """
    List feedback for current organization

    - Filter by status (open/resolved) - optional
    - Pagination supported
    - Returns feedback with user info
    """
    try:
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Build query
        query = supabase.table("feedback").select(
            "*",
            count="exact"
        ).eq("organization_id", str(user.current_organization_id))

        # Apply status filter
        if status_filter:
            query = query.eq("status", status_filter)

        # Apply ordering and pagination
        start = (page - 1) * per_page
        end = start + per_page - 1

        result = query.order("created_at", desc=True).range(start, end).execute()

        feedback_list = result.data if result.data else []
        total = result.count if result.count is not None else 0

        # Fetch user information for each feedback
        user_ids = [f["user_id"] for f in feedback_list]
        if user_ids:
            users_result = supabase.table("user_profiles").select(
                "id, email, full_name"
            ).in_("id", user_ids).execute()

            users_map = {u["id"]: u for u in (users_result.data or [])}

            # Enrich feedback with user info
            for feedback in feedback_list:
                user_info = users_map.get(feedback["user_id"], {})
                feedback["user_email"] = user_info.get("email")
                feedback["user_full_name"] = user_info.get("full_name")

        return FeedbackListResponse(
            feedback=[FeedbackResponse(**f) for f in feedback_list],
            total=total,
            page=page,
            per_page=per_page
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.put("/{feedback_id}/resolve", response_model=FeedbackResponse)
async def resolve_feedback(
    feedback_id: UUID,
    user: User = Depends(require_role(UserRole.ADMIN))
):
    """
    Mark feedback as resolved (Admin only)

    - Validates admin permissions
    - Updates status to 'resolved'
    """

    try:
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Update feedback status
        result = supabase.table("feedback").update({
            "status": "resolved"
        }).eq("id", str(feedback_id))\
          .eq("organization_id", str(user.current_organization_id))\
          .execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Feedback not found or access denied"
            )

        feedback = result.data[0]

        # Get user info
        user_result = supabase.table("user_profiles").select(
            "email, full_name"
        ).eq("id", feedback["user_id"]).execute()

        if user_result.data and len(user_result.data) > 0:
            feedback["user_email"] = user_result.data[0].get("email")
            feedback["user_full_name"] = user_result.data[0].get("full_name")

        return FeedbackResponse(**feedback)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@router.get("/stats")
async def get_feedback_stats(user: User = Depends(get_current_user)):
    """
    Get feedback statistics for current organization

    - Total count
    - Open count
    - Resolved count
    """
    try:
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Get total count
        total_result = supabase.table("feedback").select(
            "*", count="exact"
        ).eq("organization_id", str(user.current_organization_id)).execute()

        # Get open count
        open_result = supabase.table("feedback").select(
            "*", count="exact"
        ).eq("organization_id", str(user.current_organization_id))\
         .eq("status", "open").execute()

        # Get resolved count
        resolved_result = supabase.table("feedback").select(
            "*", count="exact"
        ).eq("organization_id", str(user.current_organization_id))\
         .eq("status", "resolved").execute()

        return {
            "total": total_result.count or 0,
            "open": open_result.count or 0,
            "resolved": resolved_result.count or 0
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
