"""
Tests for Exchange Rate Service
"""
import pytest
import asyncio
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from services.exchange_rate_service import ExchangeRateService
import httpx


@pytest.fixture
def service():
    """Create a fresh service instance for each test"""
    return ExchangeRateService()


@pytest.fixture
def mock_cbr_response():
    """Mock CBR API response"""
    return {
        "Date": "2025-10-26T11:30:00+03:00",
        "PreviousDate": "2025-10-25T11:30:00+03:00",
        "PreviousURL": "//www.cbr-xml-daily.ru/archive/2025/10/25/daily_json.js",
        "Timestamp": "2025-10-26T13:00:00+03:00",
        "Valute": {
            "USD": {
                "ID": "R01235",
                "NumCode": "840",
                "CharCode": "USD",
                "Nominal": 1,
                "Name": "Доллар США",
                "Value": 95.4567,
                "Previous": 95.3456
            },
            "EUR": {
                "ID": "R01239",
                "NumCode": "978",
                "CharCode": "EUR",
                "Nominal": 1,
                "Name": "Евро",
                "Value": 103.7890,
                "Previous": 103.6789
            },
            "CNY": {
                "ID": "R01375",
                "NumCode": "156",
                "CharCode": "CNY",
                "Nominal": 10,
                "Name": "Китайских юаней",
                "Value": 132.4500,
                "Previous": 132.3400
            }
        }
    }


class TestCBRAPIIntegration:
    """Test CBR API parsing and error handling"""

    @pytest.mark.asyncio
    async def test_fetch_cbr_rates_success(self, service, mock_cbr_response):
        """Test successful CBR API fetch and parsing"""
        # Mock httpx client
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = MagicMock()
            mock_response.json.return_value = mock_cbr_response
            mock_response.raise_for_status = MagicMock()

            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            # Mock database storage
            with patch.object(service, '_store_rates', new_callable=AsyncMock):
                rates = await service.fetch_cbr_rates()

            # Verify rates parsed correctly
            assert "USD" in rates
            assert "EUR" in rates
            assert "CNY" in rates
            assert "RUB" in rates  # Should be added automatically

            assert rates["USD"] == Decimal("95.4567")
            assert rates["EUR"] == Decimal("103.7890")
            assert rates["RUB"] == Decimal("1.0")

    @pytest.mark.asyncio
    async def test_fetch_cbr_rates_retry_on_timeout(self, service):
        """Test retry mechanism on timeout"""
        with patch('httpx.AsyncClient') as mock_client:
            # First two attempts timeout, third succeeds
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=[
                    httpx.TimeoutException("Timeout 1"),
                    httpx.TimeoutException("Timeout 2"),
                    MagicMock(json=lambda: {"Valute": {"USD": {"Value": 95.0}}})
                ]
            )

            with patch.object(service, '_store_rates', new_callable=AsyncMock):
                with patch('asyncio.sleep', new_callable=AsyncMock):  # Speed up test
                    rates = await service.fetch_cbr_rates()

            # Should succeed on 3rd attempt
            assert "USD" in rates

    @pytest.mark.asyncio
    async def test_fetch_cbr_rates_all_retries_fail(self, service):
        """Test when all retries are exhausted"""
        with patch('httpx.AsyncClient') as mock_client:
            # All attempts fail
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.TimeoutException("Persistent timeout")
            )

            with patch('asyncio.sleep', new_callable=AsyncMock):
                with pytest.raises(httpx.TimeoutException):
                    await service.fetch_cbr_rates()


class TestCachingLogic:
    """Test rate caching and TTL behavior"""

    @pytest.mark.asyncio
    async def test_get_rate_uses_fresh_cache(self, service):
        """Test that recent cached rates are used"""
        # Mock database with fresh rate (< 24 hours old)
        fresh_time = datetime.utcnow() - timedelta(hours=12)

        with patch('asyncpg.connect') as mock_connect:
            mock_conn = AsyncMock()
            mock_conn.fetchrow = AsyncMock(return_value={
                'rate': Decimal("95.4567"),
                'fetched_at': fresh_time
            })
            mock_conn.close = AsyncMock()
            mock_connect.return_value = mock_conn

            rate = await service.get_rate("USD", "RUB")

            assert rate == Decimal("95.4567")
            # Should NOT call fetch_cbr_rates (cache hit)

    @pytest.mark.asyncio
    async def test_get_rate_fetches_when_cache_expired(self, service):
        """Test that expired cache triggers fresh fetch"""
        # Mock database with expired rate (> 24 hours old)
        with patch('asyncpg.connect') as mock_connect:
            mock_conn = AsyncMock()
            # First call: no recent cache
            # Second call: no fallback either (will trigger fetch)
            mock_conn.fetchrow = AsyncMock(return_value=None)
            mock_conn.close = AsyncMock()
            mock_connect.return_value = mock_conn

            # Mock fetch_cbr_rates to return fresh data
            with patch.object(
                service,
                'fetch_cbr_rates',
                new_callable=AsyncMock,
                return_value={"USD": Decimal("96.0")}
            ):
                rate = await service.get_rate("USD", "RUB")

            assert rate == Decimal("96.0")

    @pytest.mark.asyncio
    async def test_get_rate_same_currency(self, service):
        """Test same currency conversion returns 1.0"""
        rate = await service.get_rate("USD", "USD")
        assert rate == Decimal("1.0")

        rate = await service.get_rate("RUB", "RUB")
        assert rate == Decimal("1.0")


class TestFallbackBehavior:
    """Test fallback to stale cache when API fails"""

    @pytest.mark.asyncio
    async def test_fallback_to_stale_cache_on_api_failure(self, service):
        """Test that stale cache is used when fresh fetch fails"""
        stale_time = datetime.utcnow() - timedelta(hours=30)  # Expired

        with patch('asyncpg.connect') as mock_connect:
            mock_conn = AsyncMock()

            # First fetchrow: no fresh cache
            # Second fetchrow: has stale cache for fallback
            mock_conn.fetchrow = AsyncMock(side_effect=[
                None,  # No fresh cache
                {'rate': Decimal("95.0"), 'fetched_at': stale_time}  # Stale fallback
            ])
            mock_conn.close = AsyncMock()
            mock_connect.return_value = mock_conn

            # Mock fetch_cbr_rates to fail
            with patch.object(
                service,
                'fetch_cbr_rates',
                new_callable=AsyncMock,
                side_effect=httpx.TimeoutException("API down")
            ):
                rate = await service.get_rate("USD", "RUB")

            # Should use stale cache as fallback
            assert rate == Decimal("95.0")

    @pytest.mark.asyncio
    async def test_returns_none_when_no_fallback(self, service):
        """Test that None is returned when no fallback exists"""
        with patch('asyncpg.connect') as mock_connect:
            mock_conn = AsyncMock()
            mock_conn.fetchrow = AsyncMock(return_value=None)  # No cache at all
            mock_conn.close = AsyncMock()
            mock_connect.return_value = mock_conn

            # Mock fetch to fail
            with patch.object(
                service,
                'fetch_cbr_rates',
                new_callable=AsyncMock,
                side_effect=httpx.TimeoutException("API down")
            ):
                rate = await service.get_rate("USD", "RUB")

            assert rate is None


class TestRateConversion:
    """Test rate conversion accuracy"""

    @pytest.mark.asyncio
    async def test_get_rate_direct_conversion(self, service):
        """Test direct currency to RUB conversion"""
        with patch('asyncpg.connect') as mock_connect:
            mock_conn = AsyncMock()
            mock_conn.fetchrow = AsyncMock(return_value={
                'rate': Decimal("95.456700"),
                'fetched_at': datetime.utcnow()
            })
            mock_conn.close = AsyncMock()
            mock_connect.return_value = mock_conn

            rate = await service.get_rate("USD", "RUB")

            # Should match exactly
            assert rate == Decimal("95.456700")

    @pytest.mark.asyncio
    async def test_get_rate_inverse_conversion(self, service):
        """Test RUB to other currency (inverse rate)"""
        # Not implemented in current version (direct to RUB only)
        # This test documents expected behavior for future enhancement
        pass

    @pytest.mark.asyncio
    async def test_get_rate_cross_conversion(self, service):
        """Test cross-rate between two non-RUB currencies"""
        # Not implemented in current version (direct to RUB only)
        # This test documents expected behavior for future enhancement
        pass


class TestDatabaseOperations:
    """Test database storage and cleanup"""

    @pytest.mark.asyncio
    async def test_cleanup_old_rates(self, service):
        """Test cleanup of old exchange rate records"""
        with patch('asyncpg.connect') as mock_connect:
            mock_conn = AsyncMock()
            mock_conn.execute = AsyncMock(return_value="DELETE 150")
            mock_conn.close = AsyncMock()
            mock_connect.return_value = mock_conn

            deleted = await service.cleanup_old_rates(days_to_keep=30)

            assert deleted == 150
            mock_conn.execute.assert_called_once()
