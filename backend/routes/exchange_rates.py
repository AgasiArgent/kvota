"""
Exchange Rates API Endpoints
Manual refresh and rate lookup endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional

from auth import get_current_user, User
from services.exchange_rate_service import get_exchange_rate_service
from routes.calculation_settings import check_admin_permissions

router = APIRouter(prefix="/api/exchange-rates", tags=["exchange-rates"])


class ExchangeRateResponse(BaseModel):
    """Exchange rate response model"""
    rate: Decimal
    fetched_at: Optional[datetime]
    source: str = "cbr"
    from_currency: str
    to_currency: str


class RefreshResponse(BaseModel):
    """Refresh response model"""
    success: bool
    rates_updated: int
    message: str


@router.get("/{from_currency}/{to_currency}", response_model=ExchangeRateResponse)
async def get_exchange_rate(
    from_currency: str,
    to_currency: str,
    user: User = Depends(get_current_user)
):
    """
    Get exchange rate between two currencies

    Example: GET /api/exchange-rates/USD/RUB

    Currencies are cached for 24 hours. If cache is expired or missing,
    fresh rates are fetched from CBR API.

    Args:
        from_currency: Source currency code (e.g., "USD")
        to_currency: Target currency code (e.g., "RUB")

    Returns:
        Exchange rate with metadata
    """
    # Normalize currency codes to uppercase
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    service = get_exchange_rate_service()

    try:
        rate = await service.get_rate(from_currency, to_currency)

        if rate is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exchange rate not available for {from_currency}/{to_currency}"
            )

        return ExchangeRateResponse(
            rate=rate,
            fetched_at=datetime.utcnow(),
            source="cbr",
            from_currency=from_currency,
            to_currency=to_currency
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch exchange rate: {str(e)}"
        )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_exchange_rates(user: User = Depends(get_current_user)):
    """
    Manually trigger exchange rate refresh from CBR API

    Admin only endpoint. Forces a fresh fetch even if cache is valid.

    Returns:
        Success status and number of rates updated
    """
    # Check admin permissions
    await check_admin_permissions(user)

    service = get_exchange_rate_service()

    try:
        rates = await service.fetch_cbr_rates()

        return RefreshResponse(
            success=True,
            rates_updated=len(rates),
            message=f"Successfully refreshed {len(rates)} exchange rates from CBR API"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh exchange rates: {str(e)}"
        )
