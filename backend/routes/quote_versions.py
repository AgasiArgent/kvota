"""
Quote Versions API

Endpoints for managing quote versions - creating, viewing, and recalculating.
Each save/recalculation creates a new immutable version.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime
from typing import Optional, Any
from uuid import UUID
import logging

from auth import get_current_user, User
from services.quote_version_service import get_quote_version_service
from domain_models.quote_version import QuoteVersion, QuoteVersionSummary


# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quotes", tags=["Quote Versions"])


# ============================================================
# Request/Response Models
# ============================================================

class CreateVersionRequest(BaseModel):
    """Request to create a new quote version"""
    quote_variables: dict[str, Any] = Field(..., description="Complete quote-level variables")
    products: list[dict[str, Any]] = Field(..., description="Products with calculations")
    calculation_results: dict[str, Any] = Field(..., description="Full calculation output")
    total_usd: Decimal = Field(..., ge=0, description="Total in USD")
    total_quote_currency: Decimal = Field(..., ge=0, description="Total in quote currency")
    change_reason: Optional[str] = Field(None, description="Optional reason for this version")


class RecalculateRequest(BaseModel):
    """Request to recalculate with fresh rates"""
    change_reason: Optional[str] = Field(
        default="Recalculated with fresh exchange rates",
        description="Reason for recalculation"
    )


class VersionSummaryResponse(BaseModel):
    """Summary response for version listings"""
    id: str
    version_number: int
    status: str
    total_usd: float
    total_quote_currency: float
    rates_source: str
    change_reason: Optional[str]
    created_by: str
    created_at: datetime


class VersionHistoryResponse(BaseModel):
    """Response containing version history"""
    quote_id: str
    versions: list[VersionSummaryResponse]
    total_count: int


class VersionDetailResponse(BaseModel):
    """Full version detail response"""
    id: str
    quote_id: str
    version_number: int
    status: str
    quote_variables: dict[str, Any]
    products_snapshot: list[dict[str, Any]]
    exchange_rates_used: dict[str, Any]
    rates_source: str
    rates_fetched_at: Optional[datetime]
    calculation_results: dict[str, Any]
    total_usd: float
    total_quote_currency: float
    change_reason: Optional[str]
    parent_version_id: Optional[str]
    created_by: str
    created_at: datetime


# ============================================================
# Endpoints
# ============================================================

@router.post("/{quote_id}/versions", response_model=VersionDetailResponse)
async def create_quote_version(
    quote_id: UUID,
    request: CreateVersionRequest,
    user: User = Depends(get_current_user)
):
    """
    Create a new version of a quote.

    This is called when saving a quote. Each save creates an immutable
    snapshot with exchange rates, calculations, and all data frozen
    at that point in time.

    Args:
        quote_id: The quote to version
        request: Complete quote data including variables, products, calculations

    Returns:
        The created version with all snapshot data
    """
    service = get_quote_version_service()

    try:
        version = await service.create_version(
            quote_id=quote_id,
            org_id=user.current_organization_id,
            quote_variables=request.quote_variables,
            products=request.products,
            calculation_results=request.calculation_results,
            total_usd=request.total_usd,
            total_quote_currency=request.total_quote_currency,
            user_id=user.id,
            change_reason=request.change_reason,
        )

        logger.info(
            f"Created version {version.version_number} for quote {quote_id} "
            f"by user {user.id}"
        )

        return _version_to_response(version)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create version for quote {quote_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create quote version"
        )


@router.get("/{quote_id}/versions", response_model=VersionHistoryResponse)
async def get_quote_versions(
    quote_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    user: User = Depends(get_current_user)
):
    """
    Get version history for a quote.

    Returns a list of version summaries, newest first.
    Use this to show version history in the UI.

    Args:
        quote_id: The quote to get history for
        limit: Max versions to return (default 50, max 100)

    Returns:
        List of version summaries with metadata
    """
    service = get_quote_version_service()

    try:
        versions = await service.get_version_history(quote_id, limit)

        return VersionHistoryResponse(
            quote_id=str(quote_id),
            versions=[
                VersionSummaryResponse(
                    id=v["id"],
                    version_number=v["version_number"],
                    status=v["status"],
                    total_usd=float(v["total_usd"]),
                    total_quote_currency=float(v["total_quote_currency"]),
                    rates_source=v["rates_source"],
                    change_reason=v.get("change_reason"),
                    created_by=v["created_by"],
                    created_at=v["created_at"],
                )
                for v in versions
            ],
            total_count=len(versions),
        )

    except Exception as e:
        logger.error(f"Failed to get versions for quote {quote_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve version history"
        )


@router.get("/{quote_id}/versions/{version_id}", response_model=VersionDetailResponse)
async def get_quote_version(
    quote_id: UUID,
    version_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Get full details of a specific version.

    Use this to view or compare a specific historical version.
    Includes complete snapshots of all data.

    Args:
        quote_id: The parent quote ID
        version_id: The specific version to retrieve

    Returns:
        Complete version data including all snapshots
    """
    service = get_quote_version_service()

    try:
        version = await service.get_version(version_id)

        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_id} not found"
            )

        # Verify version belongs to specified quote
        if version["quote_id"] != str(quote_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_id} does not belong to quote {quote_id}"
            )

        return VersionDetailResponse(
            id=version["id"],
            quote_id=version["quote_id"],
            version_number=version["version_number"],
            status=version["status"],
            quote_variables=version["quote_variables"],
            products_snapshot=version["products_snapshot"],
            exchange_rates_used=version["exchange_rates_used"],
            rates_source=version["rates_source"],
            rates_fetched_at=version.get("rates_fetched_at"),
            calculation_results=version["calculation_results"],
            total_usd=float(version["total_usd"]),
            total_quote_currency=float(version["total_quote_currency"]),
            change_reason=version.get("change_reason"),
            parent_version_id=version.get("parent_version_id"),
            created_by=version["created_by"],
            created_at=version["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get version {version_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve version"
        )


@router.get("/{quote_id}/versions/current", response_model=VersionDetailResponse)
async def get_current_version(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """
    Get the current (latest) version of a quote.

    This is a convenience endpoint that returns the most recent
    version without needing to know the version ID.

    Args:
        quote_id: The quote to get current version for

    Returns:
        Current version data
    """
    service = get_quote_version_service()

    try:
        version = await service.get_current_version(quote_id)

        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No versions found for quote {quote_id}"
            )

        return VersionDetailResponse(
            id=version["id"],
            quote_id=version["quote_id"],
            version_number=version["version_number"],
            status=version["status"],
            quote_variables=version["quote_variables"],
            products_snapshot=version["products_snapshot"],
            exchange_rates_used=version["exchange_rates_used"],
            rates_source=version["rates_source"],
            rates_fetched_at=version.get("rates_fetched_at"),
            calculation_results=version["calculation_results"],
            total_usd=float(version["total_usd"]),
            total_quote_currency=float(version["total_quote_currency"]),
            change_reason=version.get("change_reason"),
            parent_version_id=version.get("parent_version_id"),
            created_by=version["created_by"],
            created_at=version["created_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get current version for quote {quote_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve current version"
        )


@router.post("/{quote_id}/recalculate", response_model=VersionDetailResponse)
async def recalculate_quote(
    quote_id: UUID,
    request: RecalculateRequest = None,
    user: User = Depends(get_current_user)
):
    """
    Recalculate a quote with fresh exchange rates.

    Creates a new version with updated calculations based on
    current exchange rates. The previous version is preserved.

    Use this when:
    - Exchange rates have changed significantly
    - User wants to see impact of new rates
    - Before sending quote to client

    Args:
        quote_id: The quote to recalculate
        request: Optional reason for recalculation

    Returns:
        The new version with recalculated values
    """
    service = get_quote_version_service()
    change_reason = request.change_reason if request else "Recalculated with fresh exchange rates"

    try:
        version = await service.recalculate_with_fresh_rates(
            quote_id=quote_id,
            org_id=user.current_organization_id,
            user_id=user.id,
        )

        logger.info(
            f"Recalculated quote {quote_id} - created version {version.version_number}"
        )

        return _version_to_response(version)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to recalculate quote {quote_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to recalculate quote"
        )


# ============================================================
# Helper functions
# ============================================================

def _version_to_response(version: QuoteVersion) -> VersionDetailResponse:
    """Convert QuoteVersion model to API response"""
    return VersionDetailResponse(
        id=str(version.id),
        quote_id=str(version.quote_id),
        version_number=version.version_number,
        status=version.status,
        quote_variables=version.quote_variables,
        products_snapshot=version.products_snapshot,
        exchange_rates_used=version.exchange_rates_used,
        rates_source=version.rates_source,
        rates_fetched_at=version.rates_fetched_at,
        calculation_results=version.calculation_results,
        total_usd=float(version.total_usd),
        total_quote_currency=float(version.total_quote_currency),
        change_reason=version.change_reason,
        parent_version_id=str(version.parent_version_id) if version.parent_version_id else None,
        created_by=str(version.created_by),
        created_at=version.created_at,
    )
