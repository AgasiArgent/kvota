"""
Tests for multi-currency conversion in calculation engine.

This test suite verifies that all monetary fields properly handle currency conversion
when different currencies are specified in monetary_fields.

Test scenarios:
1. Logistics fields (EUR, USD) -> RUB quote currency
2. Brokerage fields (EUR, RUB mix) -> RUB quote currency
3. Mixed currencies in same quote
4. Same currency (no conversion needed)
5. All fields with USD -> RUB conversion
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import patch, MagicMock

# Import the functions we're testing
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.quotes_calc import (
    get_exchange_rate,
    get_converted_monetary_value,
    map_variables_to_calculation_input,
    ProductFromFile
)


class TestGetExchangeRate:
    """Tests for exchange rate fetching"""

    def test_same_currency_returns_one(self):
        """Same currency should return 1.0 (no conversion)"""
        rate = get_exchange_rate("RUB", "RUB")
        assert rate == Decimal("1.0")

        rate = get_exchange_rate("USD", "USD")
        assert rate == Decimal("1.0")

        rate = get_exchange_rate("EUR", "EUR")
        assert rate == Decimal("1.0")

    def test_usd_to_rub_returns_positive_rate(self):
        """USD to RUB should return a positive rate from database"""
        rate = get_exchange_rate("USD", "RUB")
        # Just verify we get a positive rate (actual rate varies)
        assert rate > Decimal("0")
        assert rate > Decimal("50")  # USD/RUB should be > 50

    def test_eur_to_rub_returns_positive_rate(self):
        """EUR to RUB should return a positive rate from database"""
        rate = get_exchange_rate("EUR", "RUB")
        # Just verify we get a positive rate (actual rate varies)
        assert rate > Decimal("0")
        assert rate > Decimal("50")  # EUR/RUB should be > 50


class TestGetConvertedMonetaryValue:
    """Tests for monetary value conversion"""

    def test_no_monetary_fields_uses_raw_value(self):
        """When no monetary_fields, use raw numeric value"""
        variables = {
            "logistics_supplier_hub": 1500
        }

        result = get_converted_monetary_value(
            "logistics_supplier_hub",
            variables,
            "RUB"
        )

        assert result == Decimal("1500")

    def test_same_currency_no_conversion(self):
        """Same currency in monetary_fields - no conversion"""
        variables = {
            "logistics_supplier_hub": 1500,
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 1500, "currency": "RUB"}
            }
        }

        result = get_converted_monetary_value(
            "logistics_supplier_hub",
            variables,
            "RUB"
        )

        assert result == Decimal("1500")

    @patch('routes.quotes_calc.get_exchange_rate')
    def test_usd_to_rub_conversion(self, mock_rate):
        """USD value converted to RUB"""
        mock_rate.return_value = Decimal("90.0")

        variables = {
            "logistics_supplier_hub": 1500,
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 1500, "currency": "USD"}
            }
        }

        result = get_converted_monetary_value(
            "logistics_supplier_hub",
            variables,
            "RUB"
        )

        # 1500 USD * 90 = 135000 RUB
        assert result == Decimal("135000")
        mock_rate.assert_called_with("USD", "RUB")

    @patch('routes.quotes_calc.get_exchange_rate')
    def test_eur_to_rub_conversion(self, mock_rate):
        """EUR value converted to RUB"""
        mock_rate.return_value = Decimal("100.0")

        variables = {
            "brokerage_hub": 500,
            "monetary_fields": {
                "brokerage_hub": {"value": 500, "currency": "EUR"}
            }
        }

        result = get_converted_monetary_value(
            "brokerage_hub",
            variables,
            "RUB"
        )

        # 500 EUR * 100 = 50000 RUB
        assert result == Decimal("50000")
        mock_rate.assert_called_with("EUR", "RUB")

    def test_missing_field_returns_default(self):
        """Missing field returns default value"""
        variables = {}

        result = get_converted_monetary_value(
            "nonexistent_field",
            variables,
            "RUB",
            default=Decimal("100")
        )

        assert result == Decimal("100")

    def test_zero_value_returns_zero(self):
        """Zero value should return zero"""
        variables = {
            "brokerage_extra": 0,
            "monetary_fields": {
                "brokerage_extra": {"value": 0, "currency": "EUR"}
            }
        }

        result = get_converted_monetary_value(
            "brokerage_extra",
            variables,
            "RUB"
        )

        assert result == Decimal("0")


class TestAllMonetaryFieldsCoverage:
    """Test that all monetary fields are properly handled"""

    MONETARY_FIELDS = [
        "logistics_supplier_hub",
        "logistics_hub_customs",
        "logistics_customs_client",
        "brokerage_hub",
        "brokerage_customs",
        "warehousing_at_customs",
        "customs_documentation",
        "brokerage_extra"
    ]

    @patch('routes.quotes_calc.get_exchange_rate')
    def test_all_fields_with_usd_currency(self, mock_rate):
        """All monetary fields should convert from USD to RUB"""
        mock_rate.return_value = Decimal("90.0")

        # Create variables with all monetary fields in USD
        variables = {
            "monetary_fields": {}
        }

        for field in self.MONETARY_FIELDS:
            variables[field] = 100  # Raw value
            variables["monetary_fields"][field] = {"value": 100, "currency": "USD"}

        # Test each field
        for field in self.MONETARY_FIELDS:
            result = get_converted_monetary_value(field, variables, "RUB")
            # 100 USD * 90 = 9000 RUB
            assert result == Decimal("9000"), f"Field {field} conversion failed"

    @patch('routes.quotes_calc.get_exchange_rate')
    def test_mixed_currencies(self, mock_rate):
        """Mix of EUR, USD, and RUB fields"""
        def rate_side_effect(from_curr, to_curr):
            if from_curr == to_curr:
                return Decimal("1.0")
            elif from_curr == "USD":
                return Decimal("90.0")
            elif from_curr == "EUR":
                return Decimal("100.0")
            return Decimal("1.0")

        mock_rate.side_effect = rate_side_effect

        variables = {
            "logistics_supplier_hub": 1000,
            "logistics_hub_customs": 500,
            "logistics_customs_client": 300,
            "brokerage_hub": 200,
            "brokerage_customs": 150,
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 1000, "currency": "EUR"},  # EUR
                "logistics_hub_customs": {"value": 500, "currency": "USD"},    # USD
                "logistics_customs_client": {"value": 300, "currency": "RUB"}, # RUB (no convert)
                "brokerage_hub": {"value": 200, "currency": "EUR"},            # EUR
                "brokerage_customs": {"value": 150, "currency": "RUB"},        # RUB (no convert)
            }
        }

        # Test logistics
        assert get_converted_monetary_value("logistics_supplier_hub", variables, "RUB") == Decimal("100000")  # 1000 * 100
        assert get_converted_monetary_value("logistics_hub_customs", variables, "RUB") == Decimal("45000")   # 500 * 90
        assert get_converted_monetary_value("logistics_customs_client", variables, "RUB") == Decimal("300")  # No conversion

        # Test brokerage
        assert get_converted_monetary_value("brokerage_hub", variables, "RUB") == Decimal("20000")  # 200 * 100
        assert get_converted_monetary_value("brokerage_customs", variables, "RUB") == Decimal("150")  # No conversion


class TestMapperIntegration:
    """Integration tests for the full mapper function - now converts to USD (canonical currency)"""

    def test_mapper_converts_all_monetary_fields_to_usd(self):
        """
        Mapper should convert all monetary fields to USD (canonical calculation currency).

        NOTE: This test was updated for USD canonical currency (2025-11-25).
        Old behavior: Convert to quote_currency (RUB)
        New behavior: Convert to USD (always)
        """
        product = ProductFromFile(
            product_name="Test Product",
            base_price_vat=Decimal("1000"),
            quantity=10,
            weight_in_kg=Decimal("5"),
            currency_of_base_price="USD",
        )

        variables = {
            "currency_of_quote": "RUB",  # Client wants RUB, but internal calc is USD
            "supplier_country": "Турция",
            "markup": 15,
            "offer_incoterms": "DDP",
            "delivery_time": 30,
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "exchange_rate_base_price_to_quote": 1.0,
            # Monetary fields with various currencies
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 1500, "currency": "USD"},
                "logistics_hub_customs": {"value": 800, "currency": "EUR"},
                "logistics_customs_client": {"value": 5000, "currency": "RUB"},
                "brokerage_hub": {"value": 500, "currency": "EUR"},
                "brokerage_customs": {"value": 10000, "currency": "RUB"},
            }
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("2"),
            "rate_loan_interest_daily": Decimal("0.00069")
        }

        result = map_variables_to_calculation_input(
            product=product,
            variables=variables,
            admin_settings=admin_settings,
            quote_date=date.today(),
            quote_currency="RUB"
        )

        # Verify internal currency is USD
        assert result.financial.currency_of_quote.value == "USD"

        # Verify logistics fields were converted TO USD (not RUB)
        # USD 1500 → USD 1500 (same currency)
        assert result.logistics.logistics_supplier_hub == Decimal("1500")

        # EUR 800 → USD ~865 (not RUB 72000+)
        eur_logistics = float(result.logistics.logistics_hub_customs)
        assert 500 < eur_logistics < 1500, f"EUR→USD expected ~865, got {eur_logistics}"

        # RUB 5000 → USD ~63 (not RUB 5000)
        rub_logistics = float(result.logistics.logistics_customs_client)
        assert 30 < rub_logistics < 150, f"RUB→USD expected ~63, got {rub_logistics}"

        # Verify brokerage fields were converted TO USD
        # EUR 500 → USD ~540
        eur_brokerage = float(result.customs.brokerage_hub)
        assert 300 < eur_brokerage < 900, f"EUR→USD expected ~540, got {eur_brokerage}"

        # RUB 10000 → USD ~126
        rub_brokerage = float(result.customs.brokerage_customs)
        assert 60 < rub_brokerage < 300, f"RUB→USD expected ~126, got {rub_brokerage}"


class TestFinancialParamsUSD:
    """Test financial params use USD as calculation currency."""

    def test_currency_of_quote_is_usd_internally(self):
        """Internal calculation should use USD regardless of client quote currency."""
        from routes.quotes_calc import map_variables_to_calculation_input

        product = ProductFromFile(
            base_price_vat=Decimal("1000"),
            quantity=10,
            weight_in_kg=Decimal("5"),
            product_name="Test",
            currency_of_base_price="TRY",
        )

        variables = {
            "currency_of_quote": "RUB",  # Client wants RUB quote
            "supplier_country": "Турция",
            "offer_incoterms": "DDP",
            "delivery_time": 60,
            "markup": 15,
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "exchange_rate_base_price_to_quote": 1.0,
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("0.5"),
            "rate_loan_interest_daily": Decimal("0.15"),
        }

        result = map_variables_to_calculation_input(
            product=product,
            variables=variables,
            admin_settings=admin_settings,
            quote_date=date.today(),
            quote_currency="RUB"
        )

        # Internal calculation currency should be USD
        assert result.financial.currency_of_quote.value == "USD", \
            f"Expected USD for internal calculation, got {result.financial.currency_of_quote.value}"


class TestLogisticsConversionToUSD:
    """Test logistics fields convert to USD, not quote currency."""

    def test_logistics_converts_to_usd_not_quote_currency(self):
        """EUR logistics should convert to USD regardless of quote currency."""
        from routes.quotes_calc import map_variables_to_calculation_input

        # Product with TRY base price
        product = ProductFromFile(
            base_price_vat=Decimal("1000"),
            quantity=10,
            weight_in_kg=Decimal("5"),
            product_name="Test",
            currency_of_base_price="TRY",
        )

        variables = {
            "currency_of_quote": "RUB",  # Quote is in RUB
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 1000, "currency": "EUR"}
            },
            "supplier_country": "Турция",
            "offer_incoterms": "DDP",
            "delivery_time": 60,
            "markup": 15,
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "exchange_rate_base_price_to_quote": 1.0,
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("0.5"),
            "rate_loan_interest_daily": Decimal("0.15"),
        }

        result = map_variables_to_calculation_input(
            product=product,
            variables=variables,
            admin_settings=admin_settings,
            quote_date=date.today(),
            quote_currency="RUB"  # This should be ignored for logistics
        )

        # Logistics should be in USD, NOT RUB
        # EUR 1000 ≈ USD 1080 (not RUB 91000+)
        logistics_value = float(result.logistics.logistics_supplier_hub)
        assert logistics_value < 2000, f"Expected USD ~1080, got {logistics_value} (probably RUB)"
        assert logistics_value > 500, f"Expected USD ~1080, got {logistics_value}"


class TestGetRatesSnapshot:
    """Test exchange rates snapshot for audit trail."""

    def test_snapshot_contains_all_supported_currencies(self):
        """Snapshot should have rates for EUR, RUB, TRY, CNY to USD."""
        from routes.quotes_calc import get_rates_snapshot_to_usd

        snapshot = get_rates_snapshot_to_usd(date.today())

        assert "EUR_USD" in snapshot
        assert "RUB_USD" in snapshot
        assert "TRY_USD" in snapshot
        assert "CNY_USD" in snapshot
        assert "quote_date" in snapshot
        assert "source" in snapshot
        assert snapshot["source"] == "cbr"

    def test_snapshot_rates_are_positive(self):
        """All rates should be positive floats."""
        from routes.quotes_calc import get_rates_snapshot_to_usd

        snapshot = get_rates_snapshot_to_usd(date.today())

        assert float(snapshot["EUR_USD"]) > 0
        assert float(snapshot["RUB_USD"]) > 0
        assert float(snapshot["TRY_USD"]) > 0
        assert float(snapshot["CNY_USD"]) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
