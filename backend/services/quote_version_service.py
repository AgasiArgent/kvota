"""
Quote Version Service

Handles creation and retrieval of quote versions.
Each save/recalculation creates a new immutable version.
"""
import os
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, Any
from uuid import UUID

from supabase import create_client, Client

from domain_models.quote_version import QuoteVersion, QuoteVersionCreate, QuoteVersionSummary
from services.multi_currency_service import get_multi_currency_service


# Configure logging
logger = logging.getLogger(__name__)


class QuoteVersionService:
    """
    Service for managing quote versions.

    Key behaviors:
    - Each save creates a new immutable version
    - Versions are never modified, only new ones created
    - Latest version becomes current_version_id on quotes table
    """

    def __init__(self):
        self._supabase: Optional[Client] = None

    @property
    def supabase(self) -> Client:
        """Lazy-load Supabase client"""
        if self._supabase is None:
            self._supabase = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            )
        return self._supabase

    async def create_version(
        self,
        quote_id: UUID,
        org_id: UUID,
        quote_variables: dict[str, Any],
        products: list[dict[str, Any]],
        calculation_results: dict[str, Any],
        total_usd: Decimal,
        total_quote_currency: Decimal,
        user_id: UUID,
        change_reason: Optional[str] = None,
        parent_version_id: Optional[UUID] = None,
    ) -> QuoteVersion:
        """
        Create a new version of a quote.

        Args:
            quote_id: The parent quote ID
            org_id: Organization ID for rate lookup
            quote_variables: Complete quote-level variables
            products: Products with their calculations
            calculation_results: Full calculation output
            total_usd: Total in USD
            total_quote_currency: Total in quote currency
            user_id: User creating this version
            change_reason: Optional reason for the version
            parent_version_id: Previous version if recalculating

        Returns:
            The created QuoteVersion
        """
        # Get exchange rates used
        rates = await self._get_exchange_rates_for_org(org_id)
        rates_source = await self._determine_rates_source(org_id)

        # Get next version number
        version_number = await self._get_latest_version_number(quote_id) + 1

        # Save the version
        version = await self._save_version(
            quote_id=quote_id,
            version_number=version_number,
            quote_variables=quote_variables,
            products_snapshot=products,
            exchange_rates_used=rates,
            rates_source=rates_source,
            calculation_results=calculation_results,
            total_usd=total_usd,
            total_quote_currency=total_quote_currency,
            change_reason=change_reason,
            parent_version_id=parent_version_id,
            created_by=user_id,
        )

        # Update quotes table with current version
        await self._update_quote_current_version(
            quote_id=quote_id,
            version_id=version.id,
            total_usd=total_usd,
            total_quote_currency=total_quote_currency,
            version_count=version_number,
        )

        logger.info(
            f"Created version {version_number} for quote {quote_id} by user {user_id}"
        )

        return version

    async def get_version_history(
        self,
        quote_id: UUID,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Get version history for a quote.

        Args:
            quote_id: Quote to get history for
            limit: Max versions to return

        Returns:
            List of version summaries, newest first
        """
        versions = await self._fetch_versions(quote_id, limit)
        return versions

    async def get_version(self, version_id: UUID) -> Optional[dict[str, Any]]:
        """
        Get a specific version by ID.

        Args:
            version_id: The version UUID

        Returns:
            Full version data or None if not found
        """
        return await self._fetch_version_by_id(version_id)

    async def get_current_version(self, quote_id: UUID) -> Optional[dict[str, Any]]:
        """
        Get the current (latest) version for a quote.

        Args:
            quote_id: Quote to get current version for

        Returns:
            Current version data or None
        """
        return await self._fetch_current_version(quote_id)

    async def recalculate_with_fresh_rates(
        self,
        quote_id: UUID,
        org_id: UUID,
        user_id: UUID,
    ) -> QuoteVersion:
        """
        Recalculate a quote with fresh exchange rates.
        Creates a new version with updated calculations.

        Args:
            quote_id: Quote to recalculate
            org_id: Organization ID for rates
            user_id: User performing recalculation

        Returns:
            The new version with fresh calculations
        """
        # Get current version
        current = await self._fetch_current_version(quote_id)
        if not current:
            raise ValueError(f"No current version found for quote {quote_id}")

        # Use existing variables and products
        quote_variables = current["quote_variables"]
        products = current["products_snapshot"]

        # TODO: Re-run calculation engine with fresh rates
        # For now, we'll just create a placeholder version
        calculation_results = current.get("calculation_results", {})
        total_usd = Decimal(str(current.get("total_usd", 0)))
        total_quote_currency = Decimal(str(current.get("total_quote_currency", 0)))

        # Create new version
        return await self.create_version(
            quote_id=quote_id,
            org_id=org_id,
            quote_variables=quote_variables,
            products=products,
            calculation_results=calculation_results,
            total_usd=total_usd,
            total_quote_currency=total_quote_currency,
            user_id=user_id,
            change_reason="Recalculated with fresh rates",
            parent_version_id=UUID(current["id"]),
        )

    # ============================================================
    # Private helper methods
    # ============================================================

    async def _get_latest_version_number(self, quote_id: UUID) -> int:
        """Get the latest version number for a quote (0 if no versions)"""
        result = self.supabase.table("quote_versions") \
            .select("version_number") \
            .eq("quote_id", str(quote_id)) \
            .order("version_number", desc=True) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]["version_number"]
        return 0

    async def _get_exchange_rates_for_org(self, org_id: UUID) -> dict[str, str]:
        """Get all exchange rates for an organization"""
        currency_service = get_multi_currency_service()
        rates = await currency_service.get_all_rates_for_org(org_id)
        # Convert Decimal to string for JSON storage
        return {k: str(v) for k, v in rates.items()}

    async def _determine_rates_source(self, org_id: UUID) -> str:
        """Determine if org uses manual or CBR rates"""
        result = self.supabase.table("calculation_settings") \
            .select("use_manual_exchange_rates") \
            .eq("organization_id", str(org_id)) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            if result.data[0].get("use_manual_exchange_rates"):
                return "manual"
        return "cbr"

    async def _save_version(
        self,
        quote_id: UUID,
        version_number: int,
        quote_variables: dict[str, Any],
        products_snapshot: list[dict[str, Any]],
        exchange_rates_used: dict[str, str],
        rates_source: str,
        calculation_results: dict[str, Any],
        total_usd: Decimal,
        total_quote_currency: Decimal,
        change_reason: Optional[str],
        parent_version_id: Optional[UUID],
        created_by: UUID,
    ) -> QuoteVersion:
        """Save a version to the database"""
        now = datetime.now(timezone.utc)

        data = {
            "quote_id": str(quote_id),
            "version_number": version_number,
            "status": "draft",
            "quote_variables": quote_variables,
            "products_snapshot": products_snapshot,
            "exchange_rates_used": exchange_rates_used,
            "rates_source": rates_source,
            "rates_fetched_at": now.isoformat(),
            "calculation_results": calculation_results,
            "total_usd": float(total_usd),
            "total_quote_currency": float(total_quote_currency),
            "change_reason": change_reason,
            "parent_version_id": str(parent_version_id) if parent_version_id else None,
            "created_by": str(created_by),
            "created_at": now.isoformat(),
        }

        result = self.supabase.table("quote_versions").insert(data).execute()

        if not result.data or len(result.data) == 0:
            raise ValueError("Failed to save quote version")

        row = result.data[0]
        return QuoteVersion(
            id=UUID(row["id"]),
            quote_id=UUID(row["quote_id"]),
            version_number=row["version_number"],
            status=row["status"],
            quote_variables=row["quote_variables"],
            products_snapshot=row["products_snapshot"],
            exchange_rates_used=row["exchange_rates_used"],
            rates_source=row["rates_source"],
            rates_fetched_at=row.get("rates_fetched_at"),
            calculation_results=row["calculation_results"],
            total_usd=Decimal(str(row["total_usd"])),
            total_quote_currency=Decimal(str(row["total_quote_currency"])),
            change_reason=row.get("change_reason"),
            parent_version_id=UUID(row["parent_version_id"]) if row.get("parent_version_id") else None,
            created_by=UUID(row["created_by"]),
            created_at=row["created_at"],
        )

    async def _update_quote_current_version(
        self,
        quote_id: UUID,
        version_id: UUID,
        total_usd: Decimal,
        total_quote_currency: Decimal,
        version_count: int,
    ) -> None:
        """Update quotes table with current version info"""
        self.supabase.table("quotes") \
            .update({
                "current_version_id": str(version_id),
                "total_usd": float(total_usd),
                "total_quote_currency": float(total_quote_currency),
                "version_count": version_count,
                "last_calculated_at": datetime.now(timezone.utc).isoformat(),
            }) \
            .eq("id", str(quote_id)) \
            .execute()

    async def _fetch_versions(
        self,
        quote_id: UUID,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Fetch versions from database"""
        result = self.supabase.table("quote_versions") \
            .select("*") \
            .eq("quote_id", str(quote_id)) \
            .order("version_number", desc=True) \
            .limit(limit) \
            .execute()

        return result.data or []

    async def _fetch_version_by_id(self, version_id: UUID) -> Optional[dict[str, Any]]:
        """Fetch a specific version by ID"""
        result = self.supabase.table("quote_versions") \
            .select("*") \
            .eq("id", str(version_id)) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0]
        return None

    async def _fetch_current_version(self, quote_id: UUID) -> Optional[dict[str, Any]]:
        """Fetch the current version for a quote"""
        # First get the current_version_id from quotes
        quote_result = self.supabase.table("quotes") \
            .select("current_version_id") \
            .eq("id", str(quote_id)) \
            .limit(1) \
            .execute()

        if not quote_result.data or len(quote_result.data) == 0:
            return None

        current_version_id = quote_result.data[0].get("current_version_id")
        if not current_version_id:
            # Fallback to latest version
            result = self.supabase.table("quote_versions") \
                .select("*") \
                .eq("quote_id", str(quote_id)) \
                .order("version_number", desc=True) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return result.data[0]
            return None

        return await self._fetch_version_by_id(UUID(current_version_id))


# Singleton instance
_service_instance: Optional[QuoteVersionService] = None


def get_quote_version_service() -> QuoteVersionService:
    """Get or create the global quote version service instance"""
    global _service_instance
    if _service_instance is None:
        _service_instance = QuoteVersionService()
    return _service_instance
