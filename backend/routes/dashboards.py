"""
Dashboard Management Routes - Dashboard Constructor System

CRUD operations for dashboards and widgets.
Supports drag-and-drop dashboard building with multiple widget types.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, status
from supabase import Client
from datetime import datetime, timezone

from dependencies import get_supabase
from auth import get_current_user, User

from domain_models.dashboard import (
    Dashboard,
    DashboardCreate,
    DashboardUpdate,
    DashboardSummary,
    DashboardListResponse,
    DashboardWidget,
    DashboardWidgetCreate,
    DashboardWidgetUpdate,
)


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/dashboards",
    tags=["dashboards"],
    dependencies=[Depends(get_current_user)],
)


# ============================================================================
# DASHBOARD CRUD OPERATIONS
# ============================================================================


@router.get("/", response_model=DashboardListResponse)
async def list_dashboards(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    List all dashboards for the user's organization.

    Returns:
        DashboardListResponse with dashboard summaries and total count
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Build query
    query = supabase.table("dashboards").select("*", count="exact")
    query = query.eq("organization_id", str(user.current_organization_id))

    # Apply search filter
    if search:
        query = query.ilike("name", f"*{search}*")

    # Apply pagination
    offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    # Order by updated_at descending (most recent first)
    query = query.order("updated_at", desc=True)

    result = query.execute()

    # Convert to summaries with widget count
    dashboards = []
    for item in result.data:
        # Get widget count for each dashboard
        widget_count_result = (
            supabase.table("dashboard_widgets")
            .select("id", count="exact")
            .eq("dashboard_id", item["id"])
            .execute()
        )

        dashboards.append(
            DashboardSummary(
                id=item["id"],
                name=item["name"],
                description=item.get("description"),
                widget_count=widget_count_result.count or 0,
                created_at=item["created_at"],
                updated_at=item["updated_at"],
                created_by=item.get("created_by"),
            )
        )

    total = result.count if result.count is not None else len(result.data)

    return DashboardListResponse(dashboards=dashboards, total=total)


@router.post("/", response_model=Dashboard, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    dashboard_data: DashboardCreate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Create a new dashboard.

    Can optionally include initial widgets.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    now = datetime.now(timezone.utc).isoformat()

    # Create dashboard
    dashboard_dict = {
        "organization_id": str(user.current_organization_id),
        "name": dashboard_data.name,
        "description": dashboard_data.description,
        "layout": [],
        "created_by": str(user.id),
        "created_at": now,
        "updated_at": now,
    }

    result = supabase.table("dashboards").insert(dashboard_dict).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create dashboard",
        )

    dashboard_id = result.data[0]["id"]

    # Create initial widgets if provided
    widgets = []
    if dashboard_data.widgets:
        for widget_data in dashboard_data.widgets:
            widget_dict = {
                "dashboard_id": dashboard_id,
                "widget_type": widget_data.widget_type.value,
                "title": widget_data.title,
                "config": widget_data.config,
                "data_source": widget_data.data_source.model_dump(),
                "position": widget_data.position.model_dump()
                if widget_data.position
                else {"x": 0, "y": 0, "w": 4, "h": 3},
                "created_at": now,
                "updated_at": now,
            }
            widget_result = (
                supabase.table("dashboard_widgets").insert(widget_dict).execute()
            )
            if widget_result.data:
                widgets.append(DashboardWidget(**widget_result.data[0]))

    return Dashboard(
        id=result.data[0]["id"],
        organization_id=result.data[0]["organization_id"],
        name=result.data[0]["name"],
        description=result.data[0].get("description"),
        layout=result.data[0]["layout"],
        widgets=widgets,
        created_by=result.data[0].get("created_by"),
        created_at=result.data[0]["created_at"],
        updated_at=result.data[0]["updated_at"],
    )


@router.get("/{dashboard_id}", response_model=Dashboard)
async def get_dashboard(
    dashboard_id: UUID,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Get a specific dashboard with all its widgets.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Get dashboard
    result = (
        supabase.table("dashboards")
        .select("*")
        .eq("id", str(dashboard_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )

    dashboard_data = result.data[0]

    # Get widgets for this dashboard
    widgets_result = (
        supabase.table("dashboard_widgets")
        .select("*")
        .eq("dashboard_id", str(dashboard_id))
        .order("created_at")
        .execute()
    )

    widgets = [DashboardWidget(**w) for w in widgets_result.data]

    return Dashboard(
        id=dashboard_data["id"],
        organization_id=dashboard_data["organization_id"],
        name=dashboard_data["name"],
        description=dashboard_data.get("description"),
        layout=dashboard_data["layout"],
        widgets=widgets,
        created_by=dashboard_data.get("created_by"),
        created_at=dashboard_data["created_at"],
        updated_at=dashboard_data["updated_at"],
    )


@router.put("/{dashboard_id}", response_model=Dashboard)
async def update_dashboard(
    dashboard_id: UUID,
    dashboard_data: DashboardUpdate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Update dashboard properties (name, description, layout).

    Does not modify widgets - use widget endpoints for that.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify dashboard exists and belongs to org
    existing = (
        supabase.table("dashboards")
        .select("id")
        .eq("id", str(dashboard_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )

    # Build update dict (only non-None fields)
    update_dict = {}
    if dashboard_data.name is not None:
        update_dict["name"] = dashboard_data.name
    if dashboard_data.description is not None:
        update_dict["description"] = dashboard_data.description
    if dashboard_data.layout is not None:
        update_dict["layout"] = dashboard_data.layout

    if not update_dict:
        # No fields to update, return current dashboard
        return await get_dashboard(dashboard_id, user, supabase)

    # Update timestamp
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Perform update
    result = (
        supabase.table("dashboards")
        .update(update_dict)
        .eq("id", str(dashboard_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update dashboard",
        )

    # Return full dashboard with widgets
    return await get_dashboard(dashboard_id, user, supabase)


@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: UUID,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Delete a dashboard and all its widgets.

    Widgets are automatically deleted due to CASCADE constraint.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify dashboard exists and belongs to org
    existing = (
        supabase.table("dashboards")
        .select("id")
        .eq("id", str(dashboard_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )

    # Delete dashboard (widgets deleted via CASCADE)
    supabase.table("dashboards").delete().eq("id", str(dashboard_id)).execute()

    return None


# ============================================================================
# WIDGET CRUD OPERATIONS
# ============================================================================


@router.post(
    "/{dashboard_id}/widgets",
    response_model=DashboardWidget,
    status_code=status.HTTP_201_CREATED,
)
async def create_widget(
    dashboard_id: UUID,
    widget_data: DashboardWidgetCreate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Add a new widget to a dashboard.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify dashboard exists and belongs to org
    existing = (
        supabase.table("dashboards")
        .select("id")
        .eq("id", str(dashboard_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )

    now = datetime.now(timezone.utc).isoformat()

    widget_dict = {
        "dashboard_id": str(dashboard_id),
        "widget_type": widget_data.widget_type.value,
        "title": widget_data.title,
        "config": widget_data.config,
        "data_source": widget_data.data_source.model_dump(),
        "position": widget_data.position.model_dump()
        if widget_data.position
        else {"x": 0, "y": 0, "w": 4, "h": 3},
        "created_at": now,
        "updated_at": now,
    }

    result = supabase.table("dashboard_widgets").insert(widget_dict).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create widget",
        )

    # Update dashboard's updated_at
    supabase.table("dashboards").update({"updated_at": now}).eq(
        "id", str(dashboard_id)
    ).execute()

    return DashboardWidget(**result.data[0])


@router.put("/{dashboard_id}/widgets/{widget_id}", response_model=DashboardWidget)
async def update_widget(
    dashboard_id: UUID,
    widget_id: UUID,
    widget_data: DashboardWidgetUpdate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Update a widget's properties.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify dashboard belongs to org
    dashboard = (
        supabase.table("dashboards")
        .select("id")
        .eq("id", str(dashboard_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not dashboard.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )

    # Verify widget exists and belongs to dashboard
    existing = (
        supabase.table("dashboard_widgets")
        .select("id")
        .eq("id", str(widget_id))
        .eq("dashboard_id", str(dashboard_id))
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found",
        )

    # Build update dict
    update_dict = {}
    if widget_data.title is not None:
        update_dict["title"] = widget_data.title
    if widget_data.config is not None:
        update_dict["config"] = widget_data.config
    if widget_data.data_source is not None:
        update_dict["data_source"] = widget_data.data_source.model_dump()
    if widget_data.position is not None:
        update_dict["position"] = widget_data.position.model_dump()

    if not update_dict:
        # No fields to update, return current widget
        widget = (
            supabase.table("dashboard_widgets")
            .select("*")
            .eq("id", str(widget_id))
            .execute()
        )
        return DashboardWidget(**widget.data[0])

    now = datetime.now(timezone.utc).isoformat()
    update_dict["updated_at"] = now

    result = (
        supabase.table("dashboard_widgets")
        .update(update_dict)
        .eq("id", str(widget_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update widget",
        )

    # Update dashboard's updated_at
    supabase.table("dashboards").update({"updated_at": now}).eq(
        "id", str(dashboard_id)
    ).execute()

    return DashboardWidget(**result.data[0])


@router.delete(
    "/{dashboard_id}/widgets/{widget_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_widget(
    dashboard_id: UUID,
    widget_id: UUID,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Delete a widget from a dashboard.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify dashboard belongs to org
    dashboard = (
        supabase.table("dashboards")
        .select("id")
        .eq("id", str(dashboard_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not dashboard.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )

    # Verify widget exists
    existing = (
        supabase.table("dashboard_widgets")
        .select("id")
        .eq("id", str(widget_id))
        .eq("dashboard_id", str(dashboard_id))
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Widget not found",
        )

    # Delete widget
    supabase.table("dashboard_widgets").delete().eq("id", str(widget_id)).execute()

    # Update dashboard's updated_at
    supabase.table("dashboards").update(
        {"updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", str(dashboard_id)).execute()

    return None


# ============================================================================
# BULK WIDGET OPERATIONS
# ============================================================================


@router.put("/{dashboard_id}/widgets", response_model=List[DashboardWidget])
async def update_widget_positions(
    dashboard_id: UUID,
    widgets: List[DashboardWidgetUpdate],
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Bulk update widget positions (for drag-and-drop layout changes).

    Expects a list of widgets with their new positions.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify dashboard belongs to org
    dashboard = (
        supabase.table("dashboards")
        .select("id")
        .eq("id", str(dashboard_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not dashboard.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard not found",
        )

    # Get all current widgets
    current_widgets = (
        supabase.table("dashboard_widgets")
        .select("*")
        .eq("dashboard_id", str(dashboard_id))
        .execute()
    )

    # This endpoint is primarily for position updates
    # Implementation depends on how frontend sends widget IDs with positions
    # For now, return current widgets
    return [DashboardWidget(**w) for w in current_widgets.data]
