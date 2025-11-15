"""
Exchange Rate Service - Central Bank of Russia (CBR) API Integration
Automatic daily updates with caching and fallback mechanisms
"""
import os
import httpx
import logging
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CBR API endpoint
CBR_API_URL = "https://www.cbr-xml-daily.ru/daily_json.js"

# Cache TTL (24 hours)
CACHE_TTL_HOURS = 24

# Request timeout
REQUEST_TIMEOUT = 10.0

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # exponential backoff: 2^0, 2^1, 2^2 seconds


class ExchangeRateService:
    """Service for fetching and caching exchange rates from CBR API"""

    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None

    async def fetch_cbr_rates(self) -> Dict[str, Decimal]:
        """
        Fetch exchange rates from Central Bank of Russia API

        Returns:
            Dict of currency codes to RUB rates (e.g., {"USD": 95.4567})

        Raises:
            httpx.HTTPError: If API request fails after retries
        """
        logger.info("Fetching exchange rates from CBR API...")

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                    response = await client.get(CBR_API_URL)
                    response.raise_for_status()
                    data = response.json()

                # Validate API response structure
                if not isinstance(data, dict):
                    raise ValueError(f"Invalid API response type: expected dict, got {type(data).__name__}")

                if "Valute" not in data:
                    raise ValueError("Missing 'Valute' field in API response")

                # Parse rates from API response
                rates = {}
                valute_data = data.get("Valute", {})

                if not isinstance(valute_data, dict):
                    raise ValueError(f"Invalid Valute data type: expected dict, got {type(valute_data).__name__}")

                for currency_code, currency_data in valute_data.items():
                    if not isinstance(currency_data, dict):
                        logger.warning(f"Skipping invalid currency data for {currency_code}")
                        continue

                    if "Value" in currency_data:
                        try:
                            # Convert to Decimal for precision
                            rate = Decimal(str(currency_data["Value"]))
                            if rate <= 0:
                                logger.warning(f"Skipping invalid rate for {currency_code}: {rate}")
                                continue
                            rates[currency_code] = rate
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Failed to parse rate for {currency_code}: {e}")
                            continue

                # Add RUB to RUB rate (always 1.0)
                rates["RUB"] = Decimal("1.0")

                if len(rates) < 2:  # At least RUB and one other currency
                    raise ValueError(f"Too few valid rates parsed: {len(rates)}")

                logger.info(f"Successfully fetched {len(rates)} exchange rates from CBR")

                # Store in database
                await self._store_rates(rates)

                return rates

            except (httpx.HTTPError, httpx.TimeoutException) as e:
                wait_time = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    f"CBR API request failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}. "
                    f"Retrying in {wait_time}s..."
                )

                if attempt < MAX_RETRIES - 1:
                    import asyncio
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"CBR API request failed after all retries: {e}")
                    # Return empty dict instead of raising to prevent service disruption
                    return {}

            except ValueError as e:
                logger.error(f"Invalid CBR API response format: {e}")
                if attempt < MAX_RETRIES - 1:
                    import asyncio
                    wait_time = RETRY_BACKOFF_BASE ** attempt
                    await asyncio.sleep(wait_time)
                else:
                    return {}

            except Exception as e:
                logger.error(f"Unexpected error fetching CBR rates: {e}", exc_info=True)
                return {}

    async def _store_rates(self, rates: Dict[str, Decimal]) -> None:
        """
        Store exchange rates in database

        Args:
            rates: Dict of currency codes to RUB rates
        """
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        try:
            fetched_at = datetime.now(timezone.utc)

            # Prepare batch of records
            records = []
            for from_currency, rate in rates.items():
                records.append({
                    "from_currency": from_currency,
                    "to_currency": "RUB",
                    "rate": float(rate),  # Convert Decimal to float for JSON
                    "source": "cbr",
                    "fetched_at": fetched_at.isoformat()
                })

            # Upsert rates - update if exists, insert if not
            # Using upsert to handle potential duplicates gracefully
            result = supabase.table("exchange_rates")\
                .upsert(
                    records,
                    on_conflict="from_currency,to_currency,fetched_at",
                    ignore_duplicates=False
                ).execute()

            logger.info(f"Stored/updated {len(rates)} exchange rates in database")

        except Exception as e:
            logger.error(f"Failed to store exchange rates: {e}")
            # Don't raise - we want the service to continue even if storage fails
            # Rates can still be fetched from API on demand

    async def get_rate(
        self,
        from_currency: str,
        to_currency: str
    ) -> Optional[Decimal]:
        """
        Get exchange rate with caching and fallback

        Args:
            from_currency: Source currency code (e.g., "USD")
            to_currency: Target currency code (e.g., "RUB")

        Returns:
            Exchange rate as Decimal, or None if not available
        """
        # Same currency conversion
        if from_currency == to_currency:
            return Decimal("1.0")

        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        try:
            # Check for cached rate (< 24 hours old)
            cache_cutoff = datetime.now(timezone.utc) - timedelta(hours=CACHE_TTL_HOURS)

            # Query for recent rates
            result = supabase.table("exchange_rates") \
                .select("rate, fetched_at") \
                .eq("from_currency", from_currency) \
                .eq("to_currency", to_currency) \
                .gte("fetched_at", cache_cutoff.isoformat()) \
                .order("fetched_at", desc=True) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                rate_record = result.data[0]
                logger.info(
                    f"Using cached rate for {from_currency}/{to_currency}: "
                    f"{rate_record['rate']} (fetched at {rate_record['fetched_at']})"
                )
                return Decimal(str(rate_record["rate"]))

            # Cache miss or expired - fetch fresh rates
            logger.info(
                f"No cached rate for {from_currency}/{to_currency}, "
                f"fetching fresh rates..."
            )

            try:
                rates = await self.fetch_cbr_rates()

                # Calculate cross-rate if needed
                if to_currency == "RUB":
                    return rates.get(from_currency)
                elif from_currency == "RUB":
                    # Inverse rate (RUB to other currency)
                    to_rate = rates.get(to_currency)
                    return Decimal("1.0") / to_rate if to_rate else None
                else:
                    # Cross-rate (e.g., USD to EUR)
                    from_rate = rates.get(from_currency)
                    to_rate = rates.get(to_currency)
                    if from_rate and to_rate:
                        return from_rate / to_rate
                    return None

            except Exception as e:
                logger.error(f"Failed to fetch fresh rates: {e}")

                # Fallback: use last cached rate (even if expired)
                fallback_result = supabase.table("exchange_rates") \
                    .select("rate, fetched_at") \
                    .eq("from_currency", from_currency) \
                    .eq("to_currency", to_currency) \
                    .order("fetched_at", desc=True) \
                    .limit(1) \
                    .execute()

                if fallback_result.data and len(fallback_result.data) > 0:
                    fallback_record = fallback_result.data[0]
                    logger.warning(
                        f"Using stale fallback rate for {from_currency}/{to_currency}: "
                        f"{fallback_record['rate']} "
                        f"(fetched at {fallback_record['fetched_at']})"
                    )
                    return Decimal(str(fallback_record["rate"]))

                logger.error(
                    f"No fallback rate available for {from_currency}/{to_currency}"
                )
                return None

        except Exception as e:
            logger.error(f"Error accessing exchange rates: {e}")
            return None

    async def cleanup_old_rates(self, days_to_keep: int = 30) -> int:
        """
        Remove exchange rates older than specified days

        Args:
            days_to_keep: Number of days of history to retain

        Returns:
            Number of rows deleted
        """
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_to_keep)

            # First count how many will be deleted
            count_result = supabase.table("exchange_rates") \
                .select("id", count="exact") \
                .lt("fetched_at", cutoff_date.isoformat()) \
                .execute()

            deleted_count = count_result.count if count_result.count else 0

            if deleted_count > 0:
                # Delete old records
                delete_result = supabase.table("exchange_rates") \
                    .delete() \
                    .lt("fetched_at", cutoff_date.isoformat()) \
                    .execute()

                logger.info(
                    f"Cleaned up {deleted_count} exchange rate records "
                    f"older than {days_to_keep} days"
                )
            else:
                logger.info(f"No exchange rate records older than {days_to_keep} days to clean up")

            return deleted_count

        except Exception as e:
            logger.error(f"Failed to cleanup old rates: {e}")
            return 0

    def setup_cron_job(self) -> None:
        """
        Setup daily cron job to fetch exchange rates
        Scheduled for 10:00 AM Moscow time (UTC+3)
        """
        if self.scheduler is not None:
            logger.warning("Scheduler already running")
            return

        self.scheduler = AsyncIOScheduler()

        # Schedule daily at 10:00 AM Moscow time (UTC+3 = 07:00 UTC)
        trigger = CronTrigger(
            hour=7,  # 10:00 AM MSK = 07:00 UTC
            minute=0,
            timezone="UTC"
        )

        self.scheduler.add_job(
            self._scheduled_fetch,
            trigger=trigger,
            id="fetch_exchange_rates",
            name="Fetch CBR Exchange Rates",
            replace_existing=True,
            max_instances=1  # Prevent overlapping runs
        )

        # Also run cleanup weekly (Sunday at 3 AM UTC)
        cleanup_trigger = CronTrigger(
            day_of_week="sun",
            hour=3,
            minute=0,
            timezone="UTC"
        )

        self.scheduler.add_job(
            self.cleanup_old_rates,
            trigger=cleanup_trigger,
            id="cleanup_exchange_rates",
            name="Cleanup Old Exchange Rates",
            replace_existing=True
        )

        self.scheduler.start()
        logger.info("Exchange rate scheduler started (daily at 10:00 AM MSK)")

    async def _scheduled_fetch(self) -> None:
        """Internal method for scheduled fetching with error handling"""
        try:
            await self.fetch_cbr_rates()
        except Exception as e:
            logger.error(f"Scheduled exchange rate fetch failed: {e}")

    def shutdown_scheduler(self) -> None:
        """Shutdown the scheduler gracefully"""
        if self.scheduler:
            self.scheduler.shutdown()
            self.scheduler = None
            logger.info("Exchange rate scheduler stopped")


# Global service instance
_service_instance: Optional[ExchangeRateService] = None


def get_exchange_rate_service() -> ExchangeRateService:
    """Get or create the global exchange rate service instance"""
    global _service_instance
    if _service_instance is None:
        _service_instance = ExchangeRateService()
    return _service_instance
