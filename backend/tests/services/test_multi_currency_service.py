"""Tests for MultiCurrencyService"""
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import datetime, timezone

from services.multi_currency_service import MultiCurrencyService
from domain_models.monetary import MonetaryValue


class TestMultiCurrencyService:
    """Test MultiCurrencyService"""

    @pytest.fixture
    def service(self):
        return MultiCurrencyService()

    @pytest.fixture
    def org_id(self):
        return uuid4()

    @pytest.mark.asyncio
    async def test_convert_usd_to_usd_identity(self, service, org_id):
        """USD to USD should return identity conversion"""
        result = await service.convert_to_usd(
            value=Decimal("100.00"),
            from_currency="USD",
            org_id=org_id
        )

        assert result.value == Decimal("100.00")
        assert result.currency == "USD"
        assert result.value_usd == Decimal("100.00")
        assert result.rate_used == Decimal("1.0")
        assert result.rate_source == "identity"

    @pytest.mark.asyncio
    async def test_convert_eur_to_usd_cbr(self, service, org_id):
        """EUR to USD should use CBR rate when manual rates disabled"""
        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=False):
            with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=Decimal("1.08")):
                result = await service.convert_to_usd(
                    value=Decimal("1000.00"),
                    from_currency="EUR",
                    org_id=org_id
                )

                assert result.value == Decimal("1000.00")
                assert result.currency == "EUR"
                assert result.value_usd == Decimal("1080.00")
                assert result.rate_used == Decimal("1.08")
                assert result.rate_source == "cbr"

    @pytest.mark.asyncio
    async def test_convert_try_to_usd_manual(self, service, org_id):
        """TRY to USD should use manual rate when enabled"""
        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=True):
            with patch.object(service, '_get_manual_rate', new_callable=AsyncMock, return_value=Decimal("0.0303")):
                result = await service.convert_to_usd(
                    value=Decimal("50000.00"),
                    from_currency="TRY",
                    org_id=org_id
                )

                assert result.value == Decimal("50000.00")
                assert result.currency == "TRY"
                assert result.value_usd == Decimal("1515.00")
                assert result.rate_used == Decimal("0.0303")
                assert result.rate_source == "manual"

    @pytest.mark.asyncio
    async def test_convert_rub_to_usd(self, service, org_id):
        """RUB to USD conversion"""
        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=False):
            # 1 RUB = 0.0105 USD (when USD/RUB is ~95)
            with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=Decimal("0.0105")):
                result = await service.convert_to_usd(
                    value=Decimal("100000.00"),
                    from_currency="RUB",
                    org_id=org_id
                )

                assert result.value == Decimal("100000.00")
                assert result.currency == "RUB"
                assert result.value_usd == Decimal("1050.00")
                assert result.rate_used == Decimal("0.0105")

    @pytest.mark.asyncio
    async def test_fallback_to_cbr_when_manual_missing(self, service, org_id):
        """Should fallback to CBR when manual rate not set"""
        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=True):
            with patch.object(service, '_get_manual_rate', new_callable=AsyncMock, return_value=None):
                with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=Decimal("0.0105")):
                    result = await service.convert_to_usd(
                        value=Decimal("100000.00"),
                        from_currency="RUB",
                        org_id=org_id
                    )

                    assert result.rate_source == "cbr"
                    assert result.rate_used == Decimal("0.0105")

    @pytest.mark.asyncio
    async def test_convert_zero_value(self, service, org_id):
        """Zero value should convert to zero USD"""
        result = await service.convert_to_usd(
            value=Decimal("0"),
            from_currency="EUR",
            org_id=org_id
        )

        assert result.value == Decimal("0")
        assert result.value_usd == Decimal("0")

    @pytest.mark.asyncio
    async def test_convert_includes_timestamp(self, service, org_id):
        """Conversion should include rate timestamp"""
        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=False):
            with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=Decimal("1.08")):
                result = await service.convert_to_usd(
                    value=Decimal("1000.00"),
                    from_currency="EUR",
                    org_id=org_id
                )

                assert result.rate_timestamp is not None
                # Should be recent (within last minute)
                now = datetime.now(timezone.utc)
                assert (now - result.rate_timestamp).total_seconds() < 60

    @pytest.mark.asyncio
    async def test_no_rate_available_raises(self, service, org_id):
        """Should raise error when no rate available"""
        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=False):
            with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=None):
                with pytest.raises(ValueError, match="No exchange rate available"):
                    await service.convert_to_usd(
                        value=Decimal("1000.00"),
                        from_currency="EUR",
                        org_id=org_id
                    )

    @pytest.mark.asyncio
    async def test_precision_maintained(self, service, org_id):
        """Conversion should maintain proper precision"""
        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=False):
            # Use a rate that produces many decimal places
            with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=Decimal("0.010526")):
                result = await service.convert_to_usd(
                    value=Decimal("95000.00"),
                    from_currency="RUB",
                    org_id=org_id
                )

                # Should be rounded to 2 decimal places
                assert str(result.value_usd).count('.') <= 1
                # The fractional part should have max 2 digits
                if '.' in str(result.value_usd):
                    decimal_places = len(str(result.value_usd).split('.')[1])
                    assert decimal_places <= 2


class TestGetAllRatesForOrg:
    """Test get_all_rates_for_org method"""

    @pytest.fixture
    def service(self):
        return MultiCurrencyService()

    @pytest.fixture
    def org_id(self):
        return uuid4()

    @pytest.mark.asyncio
    async def test_get_all_rates_returns_dict(self, service, org_id):
        """Should return dict of currency rates to USD"""
        with patch.object(service, 'convert_to_usd', new_callable=AsyncMock) as mock_convert:
            # Set up mock to return different rates for each currency
            async def mock_convert_impl(value, from_currency, org_id):
                rates = {
                    "EUR": Decimal("1.08"),
                    "RUB": Decimal("0.0105"),
                    "TRY": Decimal("0.0303"),
                    "CNY": Decimal("0.1381"),
                }
                rate = rates.get(from_currency, Decimal("1.0"))
                return MonetaryValue(
                    value=value,
                    currency=from_currency,
                    value_usd=value * rate,
                    rate_used=rate,
                    rate_source="cbr"
                )

            mock_convert.side_effect = mock_convert_impl

            rates = await service.get_all_rates_for_org(org_id)

            assert "USD" in rates
            assert rates["USD"] == Decimal("1.0")
            assert "EUR" in rates
            assert "RUB" in rates
            assert "TRY" in rates
            assert "CNY" in rates

    @pytest.mark.asyncio
    async def test_get_all_rates_handles_missing(self, service, org_id):
        """Should handle missing rates gracefully"""
        with patch.object(service, 'convert_to_usd', new_callable=AsyncMock) as mock_convert:
            async def mock_convert_impl(value, from_currency, org_id):
                if from_currency == "CNY":
                    raise ValueError("No rate available")
                return MonetaryValue(
                    value=value,
                    currency=from_currency,
                    value_usd=value,
                    rate_used=Decimal("1.0"),
                    rate_source="cbr"
                )

            mock_convert.side_effect = mock_convert_impl

            rates = await service.get_all_rates_for_org(org_id)

            assert "USD" in rates
            assert "EUR" in rates
            assert "CNY" not in rates  # Should be missing, not raise
