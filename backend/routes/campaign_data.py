"""
Campaign Data Routes - Email Campaign Metrics Management

Supports both SmartLead API sync and manual data entry.
Provides cached campaign metrics for dashboard widgets.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, status
from supabase import Client
from datetime import datetime, timezone

from dependencies import get_supabase
from auth import get_current_user, User

from domain_models.dashboard import (
    CampaignData,
    CampaignDataCreate,
    CampaignDataUpdate,
    CampaignDataListResponse,
    CampaignDataSource,
    CampaignMetrics,
    SmartLeadCampaign,
    SmartLeadSyncRequest,
    SmartLeadSyncResult,
)
from services.smartlead_service import get_smartlead_service


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/campaign-data",
    tags=["campaign-data"],
    dependencies=[Depends(get_current_user)],
)


# ============================================================================
# CAMPAIGN DATA CRUD OPERATIONS
# ============================================================================


@router.get("/", response_model=CampaignDataListResponse)
async def list_campaign_data(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    source: Optional[str] = Query(None, description="Filter by source (smartlead/manual)"),
    search: Optional[str] = Query(None, description="Search by campaign name"),
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    List all campaign data for the organization.

    Returns cached metrics from SmartLead and manually entered data.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Build query
    query = supabase.table("campaign_data").select("*", count="exact")
    query = query.eq("organization_id", str(user.current_organization_id))

    # Apply filters
    if source:
        query = query.eq("source", source)

    if search:
        query = query.ilike("campaign_name", f"*{search}*")

    # Apply pagination
    offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    # Order by synced_at descending (most recent first)
    query = query.order("synced_at", desc=True)

    result = query.execute()

    campaigns = [CampaignData(**item) for item in result.data]
    total = result.count if result.count is not None else len(result.data)

    return CampaignDataListResponse(campaigns=campaigns, total=total)


@router.post("/", response_model=CampaignData, status_code=status.HTTP_201_CREATED)
async def create_campaign_data(
    campaign_data: CampaignDataCreate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Create a manual campaign data entry.

    Use this for campaigns without SmartLead integration.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    now = datetime.now(timezone.utc).isoformat()

    # Prepare metrics (use defaults if not provided)
    metrics = campaign_data.metrics or CampaignMetrics()

    campaign_dict = {
        "organization_id": str(user.current_organization_id),
        "source": campaign_data.source.value if campaign_data.source else "manual",
        "campaign_id": campaign_data.campaign_id,
        "campaign_name": campaign_data.campaign_name,
        "metrics": metrics.model_dump(),
        "period_start": campaign_data.period_start.isoformat() if campaign_data.period_start else None,
        "period_end": campaign_data.period_end.isoformat() if campaign_data.period_end else None,
        "synced_at": now,
        "created_at": now,
        "updated_at": now,
    }

    result = supabase.table("campaign_data").insert(campaign_dict).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create campaign data",
        )

    return CampaignData(**result.data[0])


@router.get("/{campaign_data_id}", response_model=CampaignData)
async def get_campaign_data(
    campaign_data_id: UUID,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Get a specific campaign data entry.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    result = (
        supabase.table("campaign_data")
        .select("*")
        .eq("id", str(campaign_data_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign data not found",
        )

    return CampaignData(**result.data[0])


@router.put("/{campaign_data_id}", response_model=CampaignData)
async def update_campaign_data(
    campaign_data_id: UUID,
    campaign_data: CampaignDataUpdate,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Update a campaign data entry.

    Only manual entries can be fully edited.
    SmartLead entries will be overwritten on next sync.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify entry exists and belongs to org
    existing = (
        supabase.table("campaign_data")
        .select("id, source")
        .eq("id", str(campaign_data_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign data not found",
        )

    # Build update dict
    update_dict = {}
    if campaign_data.campaign_name is not None:
        update_dict["campaign_name"] = campaign_data.campaign_name
    if campaign_data.metrics is not None:
        update_dict["metrics"] = campaign_data.metrics.model_dump()
    if campaign_data.period_start is not None:
        update_dict["period_start"] = campaign_data.period_start.isoformat()
    if campaign_data.period_end is not None:
        update_dict["period_end"] = campaign_data.period_end.isoformat()

    if not update_dict:
        return await get_campaign_data(campaign_data_id, user, supabase)

    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("campaign_data")
        .update(update_dict)
        .eq("id", str(campaign_data_id))
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update campaign data",
        )

    return CampaignData(**result.data[0])


@router.delete("/{campaign_data_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign_data(
    campaign_data_id: UUID,
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Delete a campaign data entry.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Verify entry exists and belongs to org
    existing = (
        supabase.table("campaign_data")
        .select("id")
        .eq("id", str(campaign_data_id))
        .eq("organization_id", str(user.current_organization_id))
        .execute()
    )

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign data not found",
        )

    supabase.table("campaign_data").delete().eq("id", str(campaign_data_id)).execute()

    return None


# ============================================================================
# SMARTLEAD SYNC OPERATIONS
# ============================================================================


@router.get("/smartlead/campaigns", response_model=List[SmartLeadCampaign])
async def list_smartlead_campaigns(
    user: User = Depends(get_current_user),
):
    """
    List all campaigns available in SmartLead.

    Use this to see which campaigns can be synced.
    """
    service = get_smartlead_service()
    campaigns = await service.get_campaigns()
    return campaigns


@router.post("/sync", response_model=SmartLeadSyncResult)
async def sync_campaigns(
    sync_request: SmartLeadSyncRequest,
    user: User = Depends(get_current_user),
):
    """
    Sync campaigns from SmartLead API.

    Args:
        campaign_ids: Specific campaigns to sync (None = all)
        force_refresh: Bypass cache TTL and force fresh data

    Returns:
        Sync result with counts and any errors
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    service = get_smartlead_service()

    try:
        result = await service.sync_all_campaigns(
            organization_id=user.current_organization_id,
            campaign_ids=sync_request.campaign_ids,
            force_refresh=sync_request.force_refresh or False,
        )
        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}",
        )


@router.post("/sync/{campaign_id}", response_model=CampaignData)
async def sync_single_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
):
    """
    Sync a single campaign from SmartLead.

    Args:
        campaign_id: SmartLead campaign ID

    Returns:
        Synced campaign data
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    service = get_smartlead_service()

    try:
        result = await service.sync_campaign(
            campaign_id=campaign_id,
            organization_id=user.current_organization_id,
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign {campaign_id} not found in SmartLead",
            )

        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}",
        )


# ============================================================================
# AGGREGATED METRICS
# ============================================================================


@router.get("/aggregate")
async def get_aggregated_metrics(
    campaign_ids: Optional[str] = Query(None, description="Comma-separated campaign IDs"),
    source: Optional[str] = Query(None, description="Filter by source"),
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Get aggregated metrics across multiple campaigns.

    Useful for dashboard KPI cards showing totals.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization",
        )

    # Build query
    query = supabase.table("campaign_data").select("metrics")
    query = query.eq("organization_id", str(user.current_organization_id))

    if source:
        query = query.eq("source", source)

    if campaign_ids:
        ids = [id.strip() for id in campaign_ids.split(",")]
        query = query.in_("campaign_id", ids)

    result = query.execute()

    # Aggregate metrics
    totals = {
        "sent_count": 0,
        "open_count": 0,
        "unique_open_count": 0,
        "click_count": 0,
        "unique_click_count": 0,
        "reply_count": 0,
        "bounce_count": 0,
        "unsubscribed_count": 0,
        "interested_count": 0,
        "total_leads": 0,
        "campaign_count": len(result.data),
    }

    for item in result.data:
        metrics = item.get("metrics", {})
        totals["sent_count"] += metrics.get("sent_count", 0) or 0
        totals["open_count"] += metrics.get("open_count", 0) or 0
        totals["unique_open_count"] += metrics.get("unique_open_count", 0) or 0
        totals["click_count"] += metrics.get("click_count", 0) or 0
        totals["unique_click_count"] += metrics.get("unique_click_count", 0) or 0
        totals["reply_count"] += metrics.get("reply_count", 0) or 0
        totals["bounce_count"] += metrics.get("bounce_count", 0) or 0
        totals["unsubscribed_count"] += metrics.get("unsubscribed_count", 0) or 0
        totals["interested_count"] += metrics.get("interested_count", 0) or 0
        totals["total_leads"] += metrics.get("total_leads", 0) or 0

    # Calculate rates
    if totals["sent_count"] > 0:
        totals["open_rate"] = round(
            (totals["unique_open_count"] / totals["sent_count"]) * 100, 2
        )
        totals["click_rate"] = round(
            (totals["unique_click_count"] / totals["sent_count"]) * 100, 2
        )
        totals["reply_rate"] = round(
            (totals["reply_count"] / totals["sent_count"]) * 100, 2
        )
        totals["bounce_rate"] = round(
            (totals["bounce_count"] / totals["sent_count"]) * 100, 2
        )
    else:
        totals["open_rate"] = 0
        totals["click_rate"] = 0
        totals["reply_rate"] = 0
        totals["bounce_rate"] = 0

    return totals
