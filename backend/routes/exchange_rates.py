"""
Exchange Rates API Endpoints

CBR rates are fetched once daily at 12:05 MSK (after CBR publishes ~11:30-12:00).
Rates are cached in memory - lookups are instant, no DB queries.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict

from auth import get_current_user, User
from services.exchange_rate_service import get_exchange_rate_service

router = APIRouter(prefix="/api/exchange-rates", tags=["exchange-rates"])


class ExchangeRateResponse(BaseModel):
    """Exchange rate response model"""
    rate: Decimal
    from_currency: str
    to_currency: str


class AllRatesResponse(BaseModel):
    """All rates with cache info"""
    rates: Dict[str, float]  # Currency -> rate to RUB
    last_updated: Optional[str]  # ISO timestamp
    cbr_date: Optional[str]  # Date from CBR response
    currencies_count: int


@router.get("/all", response_model=AllRatesResponse)
async def get_all_rates(user: User = Depends(get_current_user)):
    """
    Get all CBR exchange rates in one request.

    Returns all cached rates (currency -> RUB rate) with cache metadata.
    Rates are refreshed daily at 12:05 MSK.

    Example response:
    {
        "rates": {"USD": 103.45, "EUR": 112.30, "CNY": 14.25, ...},
        "last_updated": "2025-12-03T09:05:00+00:00",
        "cbr_date": "2025-12-03T11:30:00+03:00",
        "currencies_count": 45
    }
    """
    service = get_exchange_rate_service()

    # Ensure cache is populated
    if not service.get_all_rates():
        await service.get_rate("USD", "RUB")  # Triggers cache load

    cache_info = service.get_cache_info()
    rates = service.get_all_rates()

    return AllRatesResponse(
        rates={k: float(v) for k, v in rates.items()},
        last_updated=cache_info.get("last_updated"),
        cbr_date=cache_info.get("cbr_date"),
        currencies_count=len(rates)
    )


@router.get("/{from_currency}/{to_currency}", response_model=ExchangeRateResponse)
async def get_exchange_rate(
    from_currency: str,
    to_currency: str,
    user: User = Depends(get_current_user)
):
    """
    Get exchange rate between two currencies.

    Example: GET /api/exchange-rates/USD/RUB

    Rates are cached in memory and refreshed daily at 12:05 MSK.
    Lookups are instant (no DB query).

    Args:
        from_currency: Source currency code (e.g., "USD")
        to_currency: Target currency code (e.g., "RUB")

    Returns:
        Exchange rate
    """
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
