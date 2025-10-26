"""
Exchange Rate Service - Central Bank of Russia (CBR) API Integration
Automatic daily updates with caching and fallback mechanisms
"""
import os
import httpx
import logging
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Dict, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncpg

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

                # Parse rates from API response
                rates = {}
                if "Valute" in data:
                    for currency_code, currency_data in data["Valute"].items():
                        if "Value" in currency_data:
                            # Convert to Decimal for precision
                            rate = Decimal(str(currency_data["Value"]))
                            rates[currency_code] = rate

                # Add RUB to RUB rate (always 1.0)
                rates["RUB"] = Decimal("1.0")

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
                    logger.error("CBR API request failed after all retries")
                    raise

            except Exception as e:
                logger.error(f"Unexpected error fetching CBR rates: {e}")
                raise

    async def _store_rates(self, rates: Dict[str, Decimal]) -> None:
        """
        Store exchange rates in database

        Args:
            rates: Dict of currency codes to RUB rates
        """
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        try:
            fetched_at = datetime.utcnow()

            # Batch insert all rates in single transaction
            async with conn.transaction():
                for from_currency, rate in rates.items():
                    await conn.execute(
                        """
                        INSERT INTO exchange_rates
                            (from_currency, to_currency, rate, source, fetched_at)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        from_currency,
                        "RUB",
                        rate,
                        "cbr",
                        fetched_at
                    )

            logger.info(f"Stored {len(rates)} exchange rates in database")

        finally:
            await conn.close()

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

        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        try:
            # Check for cached rate (< 24 hours old)
            cache_cutoff = datetime.utcnow() - timedelta(hours=CACHE_TTL_HOURS)

            rate_record = await conn.fetchrow(
                """
                SELECT rate, fetched_at
                FROM exchange_rates
                WHERE from_currency = $1
                  AND to_currency = $2
                  AND fetched_at > $3
                ORDER BY fetched_at DESC
                LIMIT 1
                """,
                from_currency,
                to_currency,
                cache_cutoff
            )

            if rate_record:
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
                fallback_record = await conn.fetchrow(
                    """
                    SELECT rate, fetched_at
                    FROM exchange_rates
                    WHERE from_currency = $1 AND to_currency = $2
                    ORDER BY fetched_at DESC
                    LIMIT 1
                    """,
                    from_currency,
                    to_currency
                )

                if fallback_record:
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

        finally:
            await conn.close()

    async def cleanup_old_rates(self, days_to_keep: int = 30) -> int:
        """
        Remove exchange rates older than specified days

        Args:
            days_to_keep: Number of days of history to retain

        Returns:
            Number of rows deleted
        """
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)

            result = await conn.execute(
                "DELETE FROM exchange_rates WHERE fetched_at < $1",
                cutoff_date
            )

            # Parse "DELETE N" response
            deleted_count = int(result.split()[-1]) if result else 0

            logger.info(
                f"Cleaned up {deleted_count} exchange rate records "
                f"older than {days_to_keep} days"
            )

            return deleted_count

        finally:
            await conn.close()

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
