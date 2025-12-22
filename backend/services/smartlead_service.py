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

    async def get_campaign_leads(self, campaign_id: str) -> Dict[str, Any]:
        """
        Fetch all leads for a specific campaign to count CRM categories.

        Args:
            campaign_id: SmartLead campaign ID

        Returns:
            Dict with 'total_leads' (from API) and 'leads' (list of lead dicts)
        """
        try:
            # SmartLead API returns paginated leads in format:
            # {"total_leads": "613", "data": [{...}, {...}]}
            all_leads = []
            offset = 0
            api_total_leads = 0

            while True:
                response = await self._make_request(
                    f"/campaigns/{campaign_id}/leads",
                    params={"limit": 100, "offset": offset}
                )

                # Handle response structure: {"total_leads": N, "data": [...]}
                if not response or not isinstance(response, dict):
                    break

                # Get total from API (first request)
                if offset == 0:
                    api_total_leads = int(response.get("total_leads", 0) or 0)

                leads_data = response.get("data", [])
                if not leads_data:
                    break

                all_leads.extend(leads_data)

                # Check if we got less than requested (no more pages)
                if len(leads_data) < 100:
                    break

                offset += len(leads_data)

            logger.info(f"Retrieved {len(all_leads)} leads (API reports {api_total_leads}) for campaign {campaign_id}")
            return {
                "total_leads": api_total_leads,
                "leads": all_leads
            }

        except Exception as e:
            logger.error(f"Failed to fetch leads for campaign {campaign_id}: {e}")
            return {"total_leads": 0, "leads": []}

    def _count_lead_categories(self, leads: List[Dict[str, Any]], api_total_leads: int) -> Dict[str, int]:
        """
        Count leads by CRM category.

        SmartLead category IDs:
        - 1: Interested (positive)
        - 2: Meeting Request (positive)
        - 3: Not Interested (negative)
        - 4: Do Not Contact (negative)
        - 5: Information Request (positive)
        - 6: Out Of Office (neutral)
        - 7: Wrong Person (neutral)
        - 8: Uncategorizable by AI (neutral)
        - 9: Sender Originated Bounce (neutral)

        Args:
            leads: List of lead dicts with lead_category_id
            api_total_leads: Total count from SmartLead API (authoritative)

        Returns:
            Dict with total_leads, positive_count, meeting_request_count
        """
        # Positive category IDs
        POSITIVE_CATEGORY_IDS = {1, 2, 5}  # Interested, Meeting Request, Information Request
        MEETING_REQUEST_ID = 2

        positive_count = 0
        meeting_request_count = 0

        for lead in leads:
            category_id = lead.get("lead_category_id")
            if category_id:
                if category_id in POSITIVE_CATEGORY_IDS:
                    positive_count += 1
                if category_id == MEETING_REQUEST_ID:
                    meeting_request_count += 1

        logger.info(f"Category counts: total={api_total_leads} (fetched {len(leads)}), positive={positive_count}, meetings={meeting_request_count}")

        return {
            "total_leads": api_total_leads,  # Use API total, not len(leads)
            "positive_count": positive_count,
            "meeting_request_count": meeting_request_count
        }

    def _parse_metrics(
        self,
        analytics: Dict[str, Any],
        lead_stats: Dict[str, Any],
        category_counts: Optional[Dict[str, int]] = None
    ) -> CampaignMetrics:
        """
        Parse SmartLead API response into CampaignMetrics model.

        Args:
            analytics: Response from /campaigns/{id}/analytics
            lead_stats: Response from /campaigns/{id}/lead-statistics
            category_counts: Dict with positive_count and meeting_request_count from leads

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

        # Parse category counts (includes actual total_leads from fetched data)
        total_leads = 0
        positive_count = 0
        meeting_request_count = 0
        if category_counts:
            total_leads = category_counts.get("total_leads", 0)
            positive_count = category_counts.get("positive_count", 0)
            meeting_request_count = category_counts.get("meeting_request_count", 0)

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
            positive_count=positive_count,
            meeting_request_count=meeting_request_count,
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

            # Fetch leads to count CRM categories
            leads_result = await self.get_campaign_leads(campaign_id)
            category_counts = self._count_lead_categories(
                leads_result["leads"],
                leads_result["total_leads"]
            )

            # Parse into metrics (include category counts)
            metrics = self._parse_metrics(analytics, lead_stats, category_counts)

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
