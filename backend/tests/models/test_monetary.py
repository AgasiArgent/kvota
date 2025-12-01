"""Tests for MonetaryValue model"""
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from domain_models.monetary import MonetaryValue, MonetaryInput, Currency, SUPPORTED_CURRENCIES


class TestSupportedCurrencies:
    """Test currency definitions"""

    def test_supported_currencies(self):
        """Test that supported currencies are correctly defined"""
        assert SUPPORTED_CURRENCIES == ["USD", "EUR", "RUB", "TRY", "CNY"]


class TestMonetaryValue:
    """Test MonetaryValue Pydantic model"""

    def test_create_monetary_value_valid(self):
        """Test creating a valid MonetaryValue"""
        mv = MonetaryValue(
            value=Decimal("1500.00"),
            currency="EUR",
            value_usd=Decimal("1620.00"),
            rate_used=Decimal("1.08"),
            rate_source="cbr"
        )
        assert mv.value == Decimal("1500.00")
        assert mv.currency == "EUR"
        assert mv.value_usd == Decimal("1620.00")
        assert mv.rate_used == Decimal("1.08")
        assert mv.rate_source == "cbr"

    def test_monetary_value_with_timestamp(self):
        """Test creating MonetaryValue with rate timestamp"""
        now = datetime.now(timezone.utc)
        mv = MonetaryValue(
            value=Decimal("1000.00"),
            currency="TRY",
            value_usd=Decimal("30.30"),
            rate_used=Decimal("0.0303"),
            rate_source="manual",
            rate_timestamp=now
        )
        assert mv.rate_timestamp == now

    def test_monetary_value_rejects_negative_value(self):
        """Test that negative values are rejected"""
        with pytest.raises(ValueError):
            MonetaryValue(
                value=Decimal("-100.00"),
                currency="USD",
                value_usd=Decimal("100.00"),
                rate_used=Decimal("1.0"),
                rate_source="identity"
            )

    def test_monetary_value_rejects_negative_value_usd(self):
        """Test that negative USD values are rejected"""
        with pytest.raises(ValueError):
            MonetaryValue(
                value=Decimal("100.00"),
                currency="USD",
                value_usd=Decimal("-100.00"),
                rate_used=Decimal("1.0"),
                rate_source="identity"
            )

    def test_monetary_value_rejects_zero_rate(self):
        """Test that zero rate is rejected"""
        with pytest.raises(ValueError):
            MonetaryValue(
                value=Decimal("100.00"),
                currency="EUR",
                value_usd=Decimal("108.00"),
                rate_used=Decimal("0"),
                rate_source="cbr"
            )

    def test_monetary_value_rejects_negative_rate(self):
        """Test that negative rate is rejected"""
        with pytest.raises(ValueError):
            MonetaryValue(
                value=Decimal("100.00"),
                currency="EUR",
                value_usd=Decimal("108.00"),
                rate_used=Decimal("-1.08"),
                rate_source="cbr"
            )

    def test_monetary_value_rejects_invalid_currency(self):
        """Test that invalid currency codes are rejected"""
        with pytest.raises(ValueError):
            MonetaryValue(
                value=Decimal("100.00"),
                currency="GBP",  # Not supported
                value_usd=Decimal("130.00"),
                rate_used=Decimal("1.30"),
                rate_source="manual"
            )

    def test_usd_identity_conversion(self):
        """Test USD to USD conversion uses identity rate"""
        mv = MonetaryValue(
            value=Decimal("100.00"),
            currency="USD",
            value_usd=Decimal("100.00"),
            rate_used=Decimal("1.0"),
            rate_source="identity"
        )
        assert mv.value == mv.value_usd
        assert mv.rate_used == Decimal("1.0")

    def test_monetary_value_allows_zero_value(self):
        """Test that zero value is allowed (for optional fields)"""
        mv = MonetaryValue(
            value=Decimal("0"),
            currency="USD",
            value_usd=Decimal("0"),
            rate_used=Decimal("1.0"),
            rate_source="identity"
        )
        assert mv.value == Decimal("0")
        assert mv.value_usd == Decimal("0")

    def test_all_supported_currencies(self):
        """Test creating MonetaryValue with each supported currency"""
        for currency in SUPPORTED_CURRENCIES:
            mv = MonetaryValue(
                value=Decimal("100.00"),
                currency=currency,
                value_usd=Decimal("100.00"),
                rate_used=Decimal("1.0"),
                rate_source="cbr"
            )
            assert mv.currency == currency


class TestMonetaryInput:
    """Test MonetaryInput model (frontend input)"""

    def test_create_monetary_input_valid(self):
        """Test creating a valid MonetaryInput"""
        mi = MonetaryInput(
            value=Decimal("1500.00"),
            currency="EUR"
        )
        assert mi.value == Decimal("1500.00")
        assert mi.currency == "EUR"

    def test_monetary_input_default_currency(self):
        """Test MonetaryInput defaults to USD"""
        mi = MonetaryInput(value=Decimal("100.00"))
        assert mi.currency == "USD"

    def test_monetary_input_rejects_negative(self):
        """Test that negative values are rejected"""
        with pytest.raises(ValueError):
            MonetaryInput(value=Decimal("-100.00"), currency="USD")

    def test_monetary_input_rejects_invalid_currency(self):
        """Test that invalid currency codes are rejected"""
        with pytest.raises(ValueError):
            MonetaryInput(value=Decimal("100.00"), currency="GBP")

    def test_monetary_input_allows_zero(self):
        """Test that zero value is allowed"""
        mi = MonetaryInput(value=Decimal("0"), currency="RUB")
        assert mi.value == Decimal("0")
