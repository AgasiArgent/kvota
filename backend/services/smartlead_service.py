"""
SmartLead API Service - Email Campaign Analytics Integration

This service fetches campaign metrics from SmartLead API and caches them
in the database. Data is refreshed on-demand via sync button or scheduled job.

API Documentation: https://api.smartlead.ai/api-docs
"""
import os
import httpx
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from uuid import UUID

from supabase import create_client, Client
from domain_models.dashboard import (
    CampaignMetrics,
    CampaignData,
    CampaignDataSource,
    SmartLeadCampaign,
    SmartLeadSyncResult,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SmartLead API configuration
SMARTLEAD_API_BASE = "https://server.smartlead.ai/api/v1"
REQUEST_TIMEOUT = 30.0
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2

# Cache TTL in seconds (5 minutes)
CACHE_TTL_SECONDS = 300


class SmartLeadService:
    """
    Service for fetching and caching campaign metrics from SmartLead API.

    Provides:
    - Campaign list retrieval
    - Campaign analytics (sent, opened, clicked, replied, etc.)
    - Lead statistics (interested, in_progress, completed, etc.)
    - Database caching with sync-on-demand pattern
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize SmartLead service.

        Args:
            api_key: SmartLead API key. If not provided, reads from environment.
        """
        self.api_key = api_key or os.getenv("SMARTLEAD_API_KEY")
        if not self.api_key:
            logger.warning("SmartLead API key not configured")

        # In-memory cache for rate limiting
        self._last_request_time: Optional[datetime] = None
        self._min_request_interval = 0.5  # seconds between requests

    def _get_supabase_client(self) -> Client:
        """Get Supabase client for database operations."""
        return create_client(
            os.getenv("SUPABASE_URL", ""),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        )

    async def _make_request(
        self, endpoint: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make authenticated request to SmartLead API with retry logic.

        Args:
            endpoint: API endpoint (e.g., "/campaigns")
            params: Query parameters

        Returns:
            JSON response as dict

        Raises:
            httpx.HTTPError: If request fails after retries
            ValueError: If API key not configured
        """
        if not self.api_key:
            raise ValueError("SmartLead API key not configured")

        url = f"{SMARTLEAD_API_BASE}{endpoint}"
        request_params = params or {}
        request_params["api_key"] = self.api_key

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                    response = await client.get(url, params=request_params)

                    # Check for rate limiting
                    if response.status_code == 429:
                        wait_time = int(response.headers.get("Retry-After", "60"))
                        logger.warning(f"Rate limited, waiting {wait_time}s")
                        import asyncio

                        await asyncio.sleep(wait_time)
                        continue

                    response.raise_for_status()
                    return response.json()

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    logger.error("SmartLead API authentication failed - check API key")
                    raise ValueError("Invalid SmartLead API key")
                elif e.response.status_code == 404:
                    logger.warning(f"Resource not found: {endpoint}")
                    return {}
                else:
                    wait_time = RETRY_BACKOFF_BASE**attempt
                    logger.warning(
                        f"SmartLead API error (attempt {attempt + 1}/{MAX_RETRIES}): {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    if attempt < MAX_RETRIES - 1:
                        import asyncio

                        await asyncio.sleep(wait_time)
                    else:
                        raise

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                wait_time = RETRY_BACKOFF_BASE**attempt
                logger.warning(
                    f"SmartLead API connection error (attempt {attempt + 1}/{MAX_RETRIES}): {e}. "
                    f"Retrying in {wait_time}s..."
                )
                if attempt < MAX_RETRIES - 1:
                    import asyncio

                    await asyncio.sleep(wait_time)
                else:
                    raise

        return {}

    async def get_campaigns(self) -> List[SmartLeadCampaign]:
        """
        Fetch list of all campaigns from SmartLead.

        Returns:
            List of SmartLeadCampaign objects
        """
        try:
            data = await self._make_request("/campaigns")

            if not data:
                return []

            campaigns = []
            for item in data if isinstance(data, list) else []:
                campaigns.append(
                    SmartLeadCampaign(
                        id=str(item.get("id", "")),
                        name=item.get("name", "Unknown Campaign"),
                        status=item.get("status"),
                        created_at=item.get("created_at"),
                    )
                )

            logger.info(f"Retrieved {len(campaigns)} campaigns from SmartLead")
            return campaigns

        except Exception as e:
            logger.error(f"Failed to fetch campaigns: {e}")
            return []

    async def get_campaign_analytics(self, campaign_id: str) -> Dict[str, Any]:
        """
        Fetch analytics for a specific campaign.

        Args:
            campaign_id: SmartLead campaign ID

        Returns:
            Dict with analytics data (sent_count, open_count, etc.)
        """
        try:
            data = await self._make_request(f"/campaigns/{campaign_id}/analytics")
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.error(f"Failed to fetch analytics for campaign {campaign_id}: {e}")
            return {}

    async def get_campaign_lead_statistics(self, campaign_id: str) -> Dict[str, Any]:
        """
        Fetch lead statistics for a specific campaign.

        Args:
            campaign_id: SmartLead campaign ID

        Returns:
            Dict with lead status counts (interested, in_progress, etc.)
        """
        try:
            data = await self._make_request(
                f"/campaigns/{campaign_id}/lead-statistics"
            )
            return data if isinstance(data, dict) else {}
        except Exception as e:
            logger.error(
                f"Failed to fetch lead statistics for campaign {campaign_id}: {e}"
            )
            return {}

    def _parse_metrics(
        self, analytics: Dict[str, Any], lead_stats: Dict[str, Any]
    ) -> CampaignMetrics:
        """
        Parse SmartLead API response into CampaignMetrics model.

        Args:
            analytics: Response from /campaigns/{id}/analytics
            lead_stats: Response from /campaigns/{id}/lead-statistics

        Returns:
            CampaignMetrics with parsed values
        """
        # Parse analytics metrics
        sent_count = int(analytics.get("sent_count", 0) or 0)
        open_count = int(analytics.get("open_count", 0) or 0)
        unique_open_count = int(analytics.get("unique_open_count", 0) or 0)
        click_count = int(analytics.get("click_count", 0) or 0)
        unique_click_count = int(analytics.get("unique_click_count", 0) or 0)
        reply_count = int(analytics.get("reply_count", 0) or 0)
        bounce_count = int(analytics.get("bounce_count", 0) or 0)
        unsubscribed_count = int(analytics.get("unsubscribed_count", 0) or 0)

        # Parse lead statistics
        interested_count = int(lead_stats.get("interested", 0) or 0)
        not_started_count = int(lead_stats.get("notStarted", 0) or 0)
        in_progress_count = int(lead_stats.get("inprogress", 0) or 0)
        completed_count = int(lead_stats.get("completed", 0) or 0)
        blocked_count = int(lead_stats.get("blocked", 0) or 0)
        paused_count = int(lead_stats.get("paused", 0) or 0)
        stopped_count = int(lead_stats.get("stopped", 0) or 0)
        total_leads = int(lead_stats.get("total", 0) or 0)

        # Create metrics object
        metrics = CampaignMetrics(
            sent_count=sent_count,
            open_count=open_count,
            unique_open_count=unique_open_count,
            click_count=click_count,
            unique_click_count=unique_click_count,
            reply_count=reply_count,
            bounce_count=bounce_count,
            unsubscribed_count=unsubscribed_count,
            interested_count=interested_count,
            not_started_count=not_started_count,
            in_progress_count=in_progress_count,
            completed_count=completed_count,
            blocked_count=blocked_count,
            paused_count=paused_count,
            stopped_count=stopped_count,
            total_leads=total_leads,
        )

        # Calculate rates
        metrics.calculate_rates()

        return metrics

    async def sync_campaign(
        self, campaign_id: str, organization_id: UUID
    ) -> Optional[CampaignData]:
        """
        Sync a single campaign from SmartLead to database.

        Args:
            campaign_id: SmartLead campaign ID
            organization_id: Organization to associate data with

        Returns:
            CampaignData if successful, None if failed
        """
        try:
            # Fetch campaign details
            campaigns = await self.get_campaigns()
            campaign = next((c for c in campaigns if c.id == campaign_id), None)

            if not campaign:
                logger.warning(f"Campaign {campaign_id} not found in SmartLead")
                return None

            # Fetch analytics and lead stats
            analytics = await self.get_campaign_analytics(campaign_id)
            lead_stats = await self.get_campaign_lead_statistics(campaign_id)

            # Parse into metrics
            metrics = self._parse_metrics(analytics, lead_stats)

            # Store in database (upsert based on campaign_id)
            supabase = self._get_supabase_client()

            now = datetime.now(timezone.utc).isoformat()

            # Check if campaign data exists
            existing = (
                supabase.table("campaign_data")
                .select("id")
                .eq("organization_id", str(organization_id))
                .eq("campaign_id", campaign_id)
                .eq("source", "smartlead")
                .execute()
            )

            campaign_data_dict = {
                "organization_id": str(organization_id),
                "source": "smartlead",
                "campaign_id": campaign_id,
                "campaign_name": campaign.name,
                "metrics": metrics.model_dump(mode="json"),  # Serialize Decimals to JSON-compatible format
                "synced_at": now,
                "updated_at": now,
            }

            if existing.data:
                # Update existing record
                result = (
                    supabase.table("campaign_data")
                    .update(campaign_data_dict)
                    .eq("id", existing.data[0]["id"])
                    .execute()
                )
            else:
                # Insert new record
                campaign_data_dict["created_at"] = now
                result = (
                    supabase.table("campaign_data").insert(campaign_data_dict).execute()
                )

            if result.data:
                logger.info(f"Successfully synced campaign {campaign_id}")
                return CampaignData(**result.data[0])
            return None

        except Exception as e:
            logger.error(f"Failed to sync campaign {campaign_id}: {e}")
            return None

    async def sync_all_campaigns(
        self,
        organization_id: UUID,
        campaign_ids: Optional[List[str]] = None,
        force_refresh: bool = False,
    ) -> SmartLeadSyncResult:
        """
        Sync multiple campaigns from SmartLead to database.

        Args:
            organization_id: Organization to associate data with
            campaign_ids: Specific campaigns to sync (None = all)
            force_refresh: Bypass cache TTL check

        Returns:
            SmartLeadSyncResult with sync status
        """
        synced_campaigns: List[CampaignData] = []
        errors: List[str] = []
        synced_count = 0
        failed_count = 0

        try:
            # Get campaigns to sync
            all_campaigns = await self.get_campaigns()

            if campaign_ids:
                campaigns_to_sync = [c for c in all_campaigns if c.id in campaign_ids]
            else:
                campaigns_to_sync = all_campaigns

            logger.info(f"Syncing {len(campaigns_to_sync)} campaigns for org {organization_id}")

            for campaign in campaigns_to_sync:
                try:
                    # Check cache TTL if not forcing refresh
                    if not force_refresh:
                        supabase = self._get_supabase_client()
                        existing = (
                            supabase.table("campaign_data")
                            .select("synced_at")
                            .eq("organization_id", str(organization_id))
                            .eq("campaign_id", campaign.id)
                            .eq("source", "smartlead")
                            .execute()
                        )

                        if existing.data:
                            synced_at = datetime.fromisoformat(
                                existing.data[0]["synced_at"].replace("Z", "+00:00")
                            )
                            age = (datetime.now(timezone.utc) - synced_at).total_seconds()
                            if age < CACHE_TTL_SECONDS:
                                logger.debug(
                                    f"Skipping campaign {campaign.id} - cache still valid"
                                )
                                continue

                    # Sync campaign
                    result = await self.sync_campaign(campaign.id, organization_id)
                    if result:
                        synced_campaigns.append(result)
                        synced_count += 1
                    else:
                        failed_count += 1
                        errors.append(f"Failed to sync campaign: {campaign.name}")

                except Exception as e:
                    failed_count += 1
                    errors.append(f"Error syncing {campaign.name}: {str(e)}")
                    logger.error(f"Error syncing campaign {campaign.id}: {e}")

        except Exception as e:
            logger.error(f"Failed to sync campaigns: {e}")
            errors.append(f"Failed to fetch campaigns list: {str(e)}")

        return SmartLeadSyncResult(
            synced_count=synced_count,
            failed_count=failed_count,
            campaigns=synced_campaigns,
            errors=errors,
            synced_at=datetime.now(timezone.utc),
        )

    async def get_cached_campaigns(
        self, organization_id: UUID, source: Optional[CampaignDataSource] = None
    ) -> List[CampaignData]:
        """
        Get cached campaign data from database.

        Args:
            organization_id: Organization ID to filter by
            source: Filter by source (smartlead/manual)

        Returns:
            List of CampaignData from database
        """
        supabase = self._get_supabase_client()

        query = (
            supabase.table("campaign_data")
            .select("*")
            .eq("organization_id", str(organization_id))
        )

        if source:
            query = query.eq("source", source.value)

        result = query.order("synced_at", desc=True).execute()

        return [CampaignData(**item) for item in result.data]


# Singleton instance
_smartlead_service: Optional[SmartLeadService] = None


def get_smartlead_service() -> SmartLeadService:
    """Get singleton SmartLead service instance."""
    global _smartlead_service
    if _smartlead_service is None:
        _smartlead_service = SmartLeadService()
    return _smartlead_service
