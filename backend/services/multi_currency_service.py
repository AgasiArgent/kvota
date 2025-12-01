"""
Multi-Currency Service
Handles currency conversions with org-specific rate settings.

Supports converting any monetary value to USD using either:
1. CBR (Central Bank of Russia) rates - automatic daily updates
2. Manual organization-specific rates - admin-controlled

Rate Priority:
1. Check org setting: use_manual_exchange_rates
2. If manual enabled: query organization_exchange_rates table
3. If no manual rate: fallback to CBR rates
"""
import os
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from supabase import create_client, Client

from domain_models.monetary import MonetaryValue, Currency
from services.exchange_rate_service import get_exchange_rate_service

# Configure logging
logger = logging.getLogger(__name__)


class MultiCurrencyService:
    """
    Service for multi-currency operations.
    Respects organization settings for manual vs CBR rates.

    Key Methods:
        convert_to_usd(): Convert a value from any currency to USD
        get_all_rates_for_org(): Get all currency rates for quote version snapshots
    """

    async def convert_to_usd(
        self,
        value: Decimal,
        from_currency: Currency,
        org_id: UUID
    ) -> MonetaryValue:
        """
        Convert a value to USD using org's rate settings.

        Args:
            value: The monetary value to convert
            from_currency: Source currency code (USD, EUR, RUB, TRY, CNY)
            org_id: Organization ID for rate settings lookup

        Returns:
            MonetaryValue with original value, USD conversion, and rate info

        Raises:
            ValueError: If no exchange rate is available for the currency

        Example:
            >>> result = await service.convert_to_usd(
            ...     value=Decimal("1500.00"),
            ...     from_currency="EUR",
            ...     org_id=org_id
            ... )
            >>> print(result.value_usd)  # 1620.00 (at rate 1.08)
        """
        now = datetime.now(timezone.utc)

        # USD to USD - identity conversion (no rate lookup needed)
        if from_currency == "USD":
            return MonetaryValue(
                value=value,
                currency="USD",
                value_usd=value,
                rate_used=Decimal("1.0"),
                rate_source="identity",
                rate_timestamp=now
            )

        # Zero value - no conversion needed
        if value == Decimal("0"):
            return MonetaryValue(
                value=Decimal("0"),
                currency=from_currency,
                value_usd=Decimal("0"),
                rate_used=Decimal("1.0"),  # Rate doesn't matter for zero
                rate_source="identity",
                rate_timestamp=now
            )

        # Check if org uses manual rates
        use_manual = await self._get_org_uses_manual_rates(org_id)

        rate: Optional[Decimal] = None
        source: str = "cbr"

        if use_manual:
            # Try manual rate first
            rate = await self._get_manual_rate(org_id, from_currency, "USD")
            if rate is not None:
                source = "manual"
                logger.debug(
                    f"Using manual rate for {from_currency}/USD: {rate}"
                )

        # Fallback to CBR if no manual rate
        if rate is None:
            rate = await self._get_cbr_rate_to_usd(from_currency)
            source = "cbr"
            if rate is not None:
                logger.debug(
                    f"Using CBR rate for {from_currency}/USD: {rate}"
                )

        if rate is None:
            raise ValueError(
                f"No exchange rate available for {from_currency}/USD. "
                f"Please configure a manual rate or wait for CBR rates to update."
            )

        # Calculate USD value with proper rounding
        value_usd = (value * rate).quantize(Decimal("0.01"))

        return MonetaryValue(
            value=value,
            currency=from_currency,
            value_usd=value_usd,
            rate_used=rate,
            rate_source=source,
            rate_timestamp=now
        )

    async def _get_org_uses_manual_rates(self, org_id: UUID) -> bool:
        """
        Check if organization uses manual exchange rates.

        Args:
            org_id: Organization UUID

        Returns:
            True if org has use_manual_exchange_rates=True, False otherwise
        """
        try:
            supabase: Client = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            )

            result = supabase.table("calculation_settings") \
                .select("use_manual_exchange_rates") \
                .eq("organization_id", str(org_id)) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return result.data[0].get("use_manual_exchange_rates", False)
            return False

        except Exception as e:
            logger.warning(f"Failed to check org manual rates setting: {e}")
            return False

    async def _get_manual_rate(
        self,
        org_id: UUID,
        from_currency: str,
        to_currency: str
    ) -> Optional[Decimal]:
        """
        Get manual exchange rate from organization's rate table.

        Args:
            org_id: Organization UUID
            from_currency: Source currency code
            to_currency: Target currency code

        Returns:
            Exchange rate as Decimal, or None if not configured
        """
        try:
            supabase: Client = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            )

            result = supabase.table("organization_exchange_rates") \
                .select("rate") \
                .eq("organization_id", str(org_id)) \
                .eq("from_currency", from_currency) \
                .eq("to_currency", to_currency) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                return Decimal(str(result.data[0]["rate"]))
            return None

        except Exception as e:
            logger.warning(
                f"Failed to get manual rate for {from_currency}/{to_currency}: {e}"
            )
            return None

    async def _get_cbr_rate_to_usd(self, from_currency: str) -> Optional[Decimal]:
        """
        Get exchange rate to USD using CBR service.

        CBR provides rates as currency/RUB. We convert to currency/USD:
        - EUR/USD = (EUR/RUB) / (USD/RUB)
        - RUB/USD = 1 / (USD/RUB)

        Args:
            from_currency: Source currency code

        Returns:
            Exchange rate to USD as Decimal, or None if unavailable
        """
        try:
            service = get_exchange_rate_service()

            # Special case: RUB to USD
            if from_currency == "RUB":
                # Get USD/RUB rate
                usd_rub = await service.get_rate("USD", "RUB")
                if usd_rub is not None and usd_rub > 0:
                    # RUB/USD = 1 / (USD/RUB)
                    return (Decimal("1") / usd_rub).quantize(Decimal("0.000001"))
                return None

            # For other currencies: get currency/RUB and USD/RUB
            currency_rub = await service.get_rate(from_currency, "RUB")
            usd_rub = await service.get_rate("USD", "RUB")

            if currency_rub is not None and usd_rub is not None and usd_rub > 0:
                # currency/USD = (currency/RUB) / (USD/RUB)
                return (currency_rub / usd_rub).quantize(Decimal("0.000001"))

            return None

        except Exception as e:
            logger.warning(
                f"Failed to get CBR rate for {from_currency}/USD: {e}"
            )
            return None

    async def get_all_rates_for_org(self, org_id: UUID) -> dict[str, Decimal]:
        """
        Get all currency rates to USD for an organization.

        Used when creating quote versions to snapshot the exchange rates.

        Args:
            org_id: Organization UUID

        Returns:
            Dict mapping currency codes to USD rates
            Example: {"USD": 1.0, "EUR": 1.08, "RUB": 0.0105, "TRY": 0.0303, "CNY": 0.1381}
        """
        currencies = ["EUR", "RUB", "TRY", "CNY"]
        rates: dict[str, Decimal] = {"USD": Decimal("1.0")}

        for currency in currencies:
            try:
                mv = await self.convert_to_usd(
                    value=Decimal("1.0"),
                    from_currency=currency,
                    org_id=org_id
                )
                rates[currency] = mv.rate_used
            except ValueError:
                # Rate not available for this currency - skip
                logger.warning(
                    f"No rate available for {currency}/USD - excluding from snapshot"
                )
                pass

        return rates


# Singleton instance
_service_instance: Optional[MultiCurrencyService] = None


def get_multi_currency_service() -> MultiCurrencyService:
    """Get or create the global multi-currency service instance"""
    global _service_instance
    if _service_instance is None:
        _service_instance = MultiCurrencyService()
    return _service_instance
