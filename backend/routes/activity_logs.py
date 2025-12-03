"""
Activity Logs Routes - Audit Trail API
Query and filter activity logs for compliance and monitoring
"""
from typing import Optional
from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, status
from supabase import Client

from auth import get_current_user, User
from dependencies import get_supabase


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/activity-logs",
    tags=["activity_logs"],
    dependencies=[Depends(get_current_user)]
)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("/")
async def list_activity_logs(
    date_from: Optional[date] = Query(None, description="Filter logs from date"),
    date_to: Optional[date] = Query(None, description="Filter logs to date"),
    user_id: Optional[UUID] = Query(None, description="Filter by user"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    action: Optional[str] = Query(None, description="Filter by action"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=100, description="Items per page"),
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    List activity logs with filtering and pagination

    Filters:
    - date_from/date_to: Date range filter
    - user_id: Filter by specific user
    - entity_type: Filter by entity type (quote, customer, contact)
    - action: Filter by action (created, updated, deleted, exported, etc.)

    Returns:
    - items: List of log entries
    - total: Total count matching filters
    - page: Current page
    - per_page: Items per page
    """
    try:

        # Build query with organization filter
        query = supabase.table("activity_logs").select(
            "id, user_id, action, entity_type, entity_id, metadata, created_at",
            count="exact"
        ).eq("organization_id", str(user.current_organization_id))

        # Apply filters
        if date_from:
            query = query.gte("created_at", date_from.isoformat())
        if date_to:
            # Include the entire day by adding time
            query = query.lte("created_at", f"{date_to.isoformat()}T23:59:59")
        if user_id:
            query = query.eq("user_id", str(user_id))
        if entity_type:
            query = query.eq("entity_type", entity_type)
        if action:
            query = query.eq("action", action)

        # Apply pagination
        offset = (page - 1) * per_page
        query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)

        # Execute query
        result = query.execute()

        total = result.count if result.count is not None else 0

        return {
            "items": result.data,
            "total": total,
            "page": page,
            "per_page": per_page
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch activity logs: {str(e)}"
        )


@router.get("/stats")
async def get_activity_stats(
    date_from: Optional[date] = Query(None, description="Stats from date"),
    date_to: Optional[date] = Query(None, description="Stats to date"),
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get activity statistics summary

    Returns counts by action type and entity type
    """
    try:

        # Build base query
        query = supabase.table("activity_logs").select(
            "action, entity_type",
            count="exact"
        ).eq("organization_id", str(user.current_organization_id))

        # Apply date filters
        if date_from:
            query = query.gte("created_at", date_from.isoformat())
        if date_to:
            query = query.lte("created_at", f"{date_to.isoformat()}T23:59:59")

        # Execute query
        result = query.execute()

        # Count by action
        action_counts = {}
        entity_counts = {}

        for log in result.data:
            action = log['action']
            entity = log['entity_type']

            action_counts[action] = action_counts.get(action, 0) + 1
            entity_counts[entity] = entity_counts.get(entity, 0) + 1

        return {
            "total_logs": len(result.data),
            "by_action": action_counts,
            "by_entity": entity_counts
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch activity stats: {str(e)}"
        )


@router.get("/users")
async def list_users(
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get list of users in organization for filter dropdown

    Returns:
    - List of users with id, email, full_name
    """
    try:

        # Get all users who have activity logs in this organization
        result = supabase.table("activity_logs").select(
            "user_id"
        ).eq("organization_id", str(user.current_organization_id))\
         .execute()

        # Get unique user IDs
        unique_user_ids = list(set(log['user_id'] for log in result.data if log.get('user_id')))

        if not unique_user_ids:
            return {"users": []}

        # Fetch user profiles for these IDs
        profiles_result = supabase.table("user_profiles").select(
            "user_id, email, first_name, last_name"
        ).in_("user_id", unique_user_ids)\
         .execute()

        # Format response
        users = []
        for profile in profiles_result.data:
            full_name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
            users.append({
                "id": profile['user_id'],
                "email": profile.get('email', ''),
                "full_name": full_name or profile.get('email', 'Unknown User')
            })

        return {"users": users}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )


@router.get("/recent")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100, description="Number of recent logs"),
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get most recent activity logs

    Useful for dashboard widgets
    """
    try:

        result = supabase.table("activity_logs").select(
            "id, user_id, action, entity_type, entity_id, metadata, created_at"
        ).eq("organization_id", str(user.current_organization_id))\
         .order("created_at", desc=True)\
         .limit(limit)\
         .execute()

        return {
            "items": result.data,
            "count": len(result.data)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recent activity: {str(e)}"
        )
