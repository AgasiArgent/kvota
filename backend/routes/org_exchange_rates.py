"""
Organization Exchange Rates API
Admin management of per-organization exchange rates.

Endpoints:
- GET /api/exchange-rates/org - Get org's rate settings and rates
- PUT /api/exchange-rates/org/settings - Toggle manual rates on/off
- PUT /api/exchange-rates/org/{currency} - Update a specific rate
- POST /api/exchange-rates/org/sync - Sync all rates from CBR
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
import os
import logging

from supabase import create_client, Client

from auth import get_current_user, User, check_admin_permissions
from services.exchange_rate_service import get_exchange_rate_service
from domain_models.monetary import SUPPORTED_CURRENCIES

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exchange-rates/org", tags=["Organization Exchange Rates"])


# ============================================================
# Request/Response Models
# ============================================================

class OrgExchangeRate(BaseModel):
    """Single exchange rate entry"""
    from_currency: str
    to_currency: str = "USD"
    rate: float
    source: str  # 'manual', 'cbr_sync'
    updated_at: datetime
    updated_by_email: Optional[str] = None


class OrgExchangeRateSettings(BaseModel):
    """Organization exchange rate settings"""
    use_manual_exchange_rates: bool
    default_input_currency: str
    rates: list[OrgExchangeRate]


class UpdateRateRequest(BaseModel):
    """Request to update a specific rate"""
    rate: float = Field(..., gt=0, description="Exchange rate (currency to USD)")


class UpdateSettingsRequest(BaseModel):
    """Request to update exchange rate settings"""
    use_manual_exchange_rates: bool


class SyncResponse(BaseModel):
    """Response from sync operation"""
    success: bool
    rates_synced: int
    message: str


# ============================================================
# Endpoints
# ============================================================

@router.get("", response_model=OrgExchangeRateSettings)
async def get_org_exchange_rates(user: User = Depends(get_current_user)):
    """
    Get organization's exchange rate settings and current rates.

    Returns:
        - use_manual_exchange_rates: Whether org uses manual rates
        - default_input_currency: Default currency for new inputs
        - rates: List of all configured rates (currency to USD)
    """
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)

    # Get settings from calculation_settings
    settings_result = supabase.table("calculation_settings") \
        .select("use_manual_exchange_rates, default_input_currency") \
        .eq("organization_id", org_id) \
        .limit(1) \
        .execute()

    use_manual = False
    default_currency = "USD"

    if settings_result.data and len(settings_result.data) > 0:
        use_manual = settings_result.data[0].get("use_manual_exchange_rates", False)
        default_currency = settings_result.data[0].get("default_input_currency", "USD")

    # Get rates from organization_exchange_rates
    rates_result = supabase.table("organization_exchange_rates") \
        .select("from_currency, to_currency, rate, source, updated_at, updated_by") \
        .eq("organization_id", org_id) \
        .order("from_currency") \
        .execute()

    rates = []
    for r in rates_result.data or []:
        rates.append(OrgExchangeRate(
            from_currency=r["from_currency"],
            to_currency=r["to_currency"],
            rate=float(r["rate"]),
            source=r["source"],
            updated_at=r["updated_at"],
            updated_by_email=None  # Could join with users table if needed
        ))

    return OrgExchangeRateSettings(
        use_manual_exchange_rates=use_manual,
        default_input_currency=default_currency,
        rates=rates
    )


@router.put("/settings")
async def update_exchange_rate_settings(
    request: UpdateSettingsRequest,
    user: User = Depends(get_current_user)
):
    """
    Toggle manual exchange rates on/off.
    Admin only.

    When enabled, the system will use rates from organization_exchange_rates table.
    When disabled, the system will use CBR rates automatically.
    """
    await check_admin_permissions(user)

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)

    # Update the setting
    result = supabase.table("calculation_settings") \
        .update({
            "use_manual_exchange_rates": request.use_manual_exchange_rates,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": str(user.id)
        }) \
        .eq("organization_id", org_id) \
        .execute()

    logger.info(
        f"User {user.id} {'enabled' if request.use_manual_exchange_rates else 'disabled'} "
        f"manual exchange rates for org {org_id}"
    )

    return {
        "success": True,
        "use_manual_exchange_rates": request.use_manual_exchange_rates
    }


@router.put("/{currency}")
async def update_org_rate(
    currency: str,
    request: UpdateRateRequest,
    user: User = Depends(get_current_user)
):
    """
    Update a specific exchange rate for the organization.
    Admin only.

    Args:
        currency: Currency code (EUR, RUB, TRY, CNY)
        rate: Exchange rate to USD (how many USD per 1 unit of currency)

    Example:
        PUT /api/exchange-rates/org/EUR
        {"rate": 1.08}
        Means 1 EUR = 1.08 USD
    """
    await check_admin_permissions(user)

    currency = currency.upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Currency must be one of {SUPPORTED_CURRENCIES}"
        )

    if currency == "USD":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set USD rate (always 1.0)"
        )

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)
    now = datetime.now(timezone.utc)

    # Upsert the rate
    result = supabase.table("organization_exchange_rates") \
        .upsert({
            "organization_id": org_id,
            "from_currency": currency,
            "to_currency": "USD",
            "rate": request.rate,
            "source": "manual",
            "updated_by": str(user.id),
            "updated_at": now.isoformat()
        }, on_conflict="organization_id,from_currency,to_currency") \
        .execute()

    logger.info(
        f"User {user.id} updated {currency}/USD rate to {request.rate} for org {org_id}"
    )

    return {
        "success": True,
        "currency": currency,
        "rate": request.rate,
        "source": "manual"
    }


@router.post("/sync", response_model=SyncResponse)
async def sync_rates_from_cbr(user: User = Depends(get_current_user)):
    """
    Sync all rates from CBR to organization's manual rate table.
    Admin only.

    This fetches the latest rates from Central Bank of Russia and
    copies them to the organization's rate table. The rates can
    then be manually adjusted if needed.

    Rates are stored as currency/USD (how many USD per 1 unit).
    """
    await check_admin_permissions(user)

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)
    exchange_service = get_exchange_rate_service()

    # Fetch fresh rates from CBR
    rates = await exchange_service.fetch_cbr_rates()

    if not rates:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to fetch rates from CBR. Please try again later."
        )

    # CBR gives us currency/RUB rates
    # We need to convert to currency/USD
    usd_rub = rates.get("USD")
    if not usd_rub or usd_rub <= 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="USD/RUB rate not available from CBR"
        )

    synced_count = 0
    now = datetime.now(timezone.utc)

    # Currencies to sync (all supported except USD)
    currencies_to_sync = ["EUR", "TRY", "CNY", "RUB"]

    for currency in currencies_to_sync:
        try:
            if currency == "RUB":
                # RUB to USD rate: 1 / (USD/RUB)
                rate_to_usd = Decimal("1") / usd_rub
            elif currency in rates:
                # Other currency to USD: (currency/RUB) / (USD/RUB)
                rate_to_usd = rates[currency] / usd_rub
            else:
                logger.warning(f"No CBR rate for {currency}, skipping")
                continue

            # Round to 6 decimal places
            rate_to_usd = float(rate_to_usd.quantize(Decimal("0.000001")))

            supabase.table("organization_exchange_rates") \
                .upsert({
                    "organization_id": org_id,
                    "from_currency": currency,
                    "to_currency": "USD",
                    "rate": rate_to_usd,
                    "source": "cbr_sync",
                    "updated_by": str(user.id),
                    "updated_at": now.isoformat()
                }, on_conflict="organization_id,from_currency,to_currency") \
                .execute()

            synced_count += 1
            logger.info(f"Synced {currency}/USD = {rate_to_usd} for org {org_id}")

        except Exception as e:
            logger.error(f"Failed to sync {currency} rate: {e}")
            continue

    logger.info(
        f"User {user.id} synced {synced_count} rates from CBR for org {org_id}"
    )

    return SyncResponse(
        success=True,
        rates_synced=synced_count,
        message=f"Synced {synced_count} rates from CBR"
    )
