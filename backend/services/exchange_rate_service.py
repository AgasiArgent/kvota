"""
Exchange Rate Service - Central Bank of Russia (CBR) API Integration

CBR publishes rates once daily around 11:30-13:30 Moscow time (varies).
This service fetches rates once per day at 14:00 MSK and caches them in memory.
No database queries needed for rate lookups - pure in-memory cache.
"""
import os
import httpx
import logging
from decimal import Decimal, ROUND_HALF_UP

# Industry standard: 4 decimal places for exchange rates
RATE_PRECISION = Decimal("0.0001")
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

# Request timeout
REQUEST_TIMEOUT = 10.0

# Retry configuration
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2  # exponential backoff: 2^0, 2^1, 2^2 seconds


class ExchangeRateService:
    """
    Service for fetching and caching exchange rates from CBR API.

    Rates are cached in memory and refreshed once daily at 14:00 MSK
    (after CBR publishes new rates around 11:30-13:30).
    """

    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        # In-memory cache: rates and timestamp
        self._cached_rates: Dict[str, Decimal] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._cbr_date: Optional[str] = None  # Date from CBR response

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

                    if "Value" in currency_data and "Nominal" in currency_data:
                        try:
                            # Convert to Decimal for precision
                            # CBR reports rates for Nominal units, so divide to get rate per 1 unit
                            # E.g., TRY: Nominal=10, Value=18.45 means 1 TRY = 1.845 RUB
                            value = Decimal(str(currency_data["Value"]))
                            nominal = Decimal(str(currency_data["Nominal"]))
                            if nominal <= 0:
                                logger.warning(f"Invalid nominal for {currency_code}: {nominal}")
                                continue
                            # Rate per 1 unit, rounded to 4 decimals (industry standard)
                            rate = (value / nominal).quantize(RATE_PRECISION, rounding=ROUND_HALF_UP)
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

                # Update in-memory cache
                self._cached_rates = rates
                self._cache_timestamp = datetime.now(timezone.utc)
                self._cbr_date = data.get("Date", "")  # e.g. "2025-12-03T11:30:00+03:00"

                # Store in database (for persistence across restarts)
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

            # Insert new rates - each batch has unique fetched_at timestamp
            # This creates historical records for audit purposes
            result = supabase.table("exchange_rates")\
                .insert(records)\
                .execute()

            logger.info(f"Stored/updated {len(rates)} exchange rates in database")

        except Exception as e:
            logger.error(f"Failed to store exchange rates: {e}")
            # Don't raise - we want the service to continue even if storage fails
            # Rates can still be fetched from API on demand

    def _calculate_rate(
        self,
        from_currency: str,
        to_currency: str,
        rates: Dict[str, Decimal]
    ) -> Optional[Decimal]:
        """Calculate rate from cached rates (all rates are X to RUB)"""
        if to_currency == "RUB":
            return rates.get(from_currency)
        elif from_currency == "RUB":
            to_rate = rates.get(to_currency)
            return (Decimal("1.0") / to_rate).quantize(RATE_PRECISION) if to_rate else None
        else:
            # Cross-rate (e.g., USD to EUR via RUB)
            from_rate = rates.get(from_currency)
            to_rate = rates.get(to_currency)
            if from_rate and to_rate:
                return (from_rate / to_rate).quantize(RATE_PRECISION)
            return None

    async def get_rate(
        self,
        from_currency: str,
        to_currency: str
    ) -> Optional[Decimal]:
        """
        Get exchange rate from in-memory cache.

        Cache is populated once daily at 12:05 MSK. On first request
        after server start, loads from DB or fetches from CBR.

        Args:
            from_currency: Source currency code (e.g., "USD")
            to_currency: Target currency code (e.g., "RUB")

        Returns:
            Exchange rate as Decimal, or None if not available
        """
        # Same currency = 1.0
        if from_currency == to_currency:
            return Decimal("1.0")

        # If cache is populated, use it (instant, no DB query)
        if self._cached_rates:
            return self._calculate_rate(from_currency, to_currency, self._cached_rates)

        # Cache empty - try to load from DB first (server just started)
        await self._load_from_db()

        if self._cached_rates:
            return self._calculate_rate(from_currency, to_currency, self._cached_rates)

        # DB empty too - fetch from CBR
        logger.info("No cached rates found, fetching from CBR...")
        await self.fetch_cbr_rates()

        if self._cached_rates:
            return self._calculate_rate(from_currency, to_currency, self._cached_rates)

        logger.error(f"No rate available for {from_currency}/{to_currency}")
        return None

    async def _load_from_db(self) -> None:
        """Load latest rates from database into memory cache"""
        try:
            supabase: Client = create_client(
                os.getenv("SUPABASE_URL"),
                os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            )

            # Get the most recent rates (one per currency)
            result = supabase.table("exchange_rates") \
                .select("from_currency, rate, fetched_at") \
                .eq("to_currency", "RUB") \
                .order("fetched_at", desc=True) \
                .limit(100) \
                .execute()

            if result.data:
                # Group by currency, take most recent
                rates = {}
                latest_timestamp = None
                for row in result.data:
                    currency = row["from_currency"]
                    if currency not in rates:
                        rates[currency] = Decimal(str(row["rate"]))
                        if latest_timestamp is None:
                            latest_timestamp = row["fetched_at"]

                if rates:
                    rates["RUB"] = Decimal("1.0")
                    self._cached_rates = rates
                    self._cache_timestamp = datetime.fromisoformat(
                        latest_timestamp.replace("Z", "+00:00")
                    ) if latest_timestamp else datetime.now(timezone.utc)
                    logger.info(f"Loaded {len(rates)} rates from DB into memory cache")

        except Exception as e:
            logger.error(f"Failed to load rates from DB: {e}")

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

    def get_cache_info(self) -> Dict:
        """
        Get information about the cached rates.

        Returns:
            Dict with cache status, timestamp, and CBR date
        """
        return {
            "cached": bool(self._cached_rates),
            "currencies_count": len(self._cached_rates),
            "last_updated": self._cache_timestamp.isoformat() if self._cache_timestamp else None,
            "cbr_date": self._cbr_date,
        }

    def get_all_rates(self) -> Dict[str, Decimal]:
        """Get all cached rates (for bulk access)"""
        return self._cached_rates.copy()

    def setup_cron_job(self) -> None:
        """
        Setup daily cron job to fetch exchange rates.

        CBR publishes rates around 11:30-13:30 MSK (varies).
        We fetch at 14:00 MSK to ensure fresh rates are available.
        """
        if self.scheduler is not None:
            logger.warning("Scheduler already running")
            return

        self.scheduler = AsyncIOScheduler()

        # Schedule daily at 14:00 Moscow time (UTC+3 = 11:00 UTC)
        trigger = CronTrigger(
            hour=11,   # 14:00 MSK = 11:00 UTC
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
        logger.info("Exchange rate scheduler started (daily at 14:00 MSK)")

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
