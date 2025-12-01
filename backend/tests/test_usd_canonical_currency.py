"""
Integration tests for USD as canonical calculation currency.

Tests the full flow:
1. Input with mixed currencies (EUR logistics, RUB brokerage, TRY product)
2. Calculation in USD
3. Output in both USD and quote currency
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.quotes_calc import (
    map_variables_to_calculation_input,
    get_exchange_rate,
    get_rates_snapshot_to_usd,
    ProductFromFile
)


class TestUSDCanonicalCurrency:
    """Integration tests for USD-based calculation."""

    def test_full_flow_eur_logistics_rub_brokerage_try_product(self):
        """
        Complete flow with mixed currencies:
        - Product: 1000 TRY
        - Logistics: 500 EUR
        - Brokerage: 10000 RUB
        - Quote currency: RUB

        All should calculate in USD, then convert final prices to RUB.
        """
        product = ProductFromFile(
            base_price_vat=Decimal("1000"),
            quantity=10,
            weight_in_kg=Decimal("5"),
            product_name="Test Bearing",
            currency_of_base_price="TRY",
            customs_code="8482109000",
            supplier_country="Турция",
        )

        variables = {
            "currency_of_quote": "RUB",
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 300, "currency": "EUR"},
                "logistics_hub_customs": {"value": 200, "currency": "EUR"},
                "logistics_customs_client": {"value": 5000, "currency": "RUB"},
                "brokerage_customs": {"value": 10000, "currency": "RUB"},
            },
            "supplier_country": "Турция",
            "offer_incoterms": "DDP",
            "delivery_time": 60,
            "markup": Decimal("15"),
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "exchange_rate_base_price_to_quote": 1.0,  # Will be auto-fetched
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

        # Verify internal currency is USD
        assert result.financial.currency_of_quote.value == "USD"

        # Verify logistics converted to USD (not RUB)
        # EUR 300 ≈ USD 324 (not RUB 27000+)
        logistics_hub = float(result.logistics.logistics_supplier_hub)
        assert logistics_hub < 500, f"Expected USD ~324, got {logistics_hub}"
        assert logistics_hub > 200, f"Expected USD ~324, got {logistics_hub}"

        # Verify brokerage converted to USD
        # RUB 10000 ≈ USD 126 (not RUB 10000)
        brokerage = float(result.customs.brokerage_customs)
        assert brokerage < 200, f"Expected USD ~126, got {brokerage}"
        assert brokerage > 50, f"Expected USD ~126, got {brokerage}"

        # Verify rates snapshot exists
        snapshot = get_rates_snapshot_to_usd(date.today())
        assert snapshot["source"] == "cbr"
        assert "EUR_USD" in snapshot
        assert "RUB_USD" in snapshot
        assert "TRY_USD" in snapshot

    def test_all_currencies_convert_to_usd(self):
        """All supported currencies should convert to USD correctly."""
        currencies_to_test = ["EUR", "RUB", "TRY", "CNY"]

        for currency in currencies_to_test:
            rate = get_exchange_rate(currency, "USD")
            assert rate > 0, f"{currency} to USD rate should be positive, got {rate}"

            # USD rates should be less than 1 (except for currencies worth less than USD)
            if currency in ["RUB", "TRY"]:
                assert rate < 1, f"{currency}/USD rate should be < 1 (1 {currency} < 1 USD)"
            elif currency == "EUR":
                assert rate > 1, f"EUR/USD rate should be > 1 (1 EUR > 1 USD)"


class TestExchangeRateConsistency:
    """Test exchange rate handling."""

    def test_rates_snapshot_matches_rates_used(self):
        """Snapshot should contain same rates as used in conversion."""
        snapshot = get_rates_snapshot_to_usd(date.today())

        eur_usd_direct = get_exchange_rate("EUR", "USD")
        eur_usd_snapshot = Decimal(str(snapshot["EUR_USD"]))

        # Should match (within floating point tolerance)
        assert abs(float(eur_usd_direct) - float(eur_usd_snapshot)) < 0.0001

    def test_usd_to_usd_is_one(self):
        """USD to USD should return 1."""
        rate = get_exchange_rate("USD", "USD")
        assert rate == Decimal("1.0")

    def test_bidirectional_rates_are_inverse(self):
        """A→B rate * B→A rate should approximately equal 1."""
        eur_to_usd = get_exchange_rate("EUR", "USD")
        usd_to_eur = get_exchange_rate("USD", "EUR")

        product = float(eur_to_usd * usd_to_eur)
        assert 0.99 < product < 1.01, f"EUR↔USD inverse rates should multiply to ~1, got {product}"


class TestLogisticsBrokerageAllUSD:
    """Test that all logistics and brokerage convert to USD."""

    def test_logistics_all_fields_to_usd(self):
        """All logistics fields should convert to USD."""
        product = ProductFromFile(
            base_price_vat=Decimal("1000"),
            quantity=10,
            weight_in_kg=Decimal("5"),
            product_name="Test",
            currency_of_base_price="USD",
        )

        variables = {
            "currency_of_quote": "RUB",  # Client wants RUB
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 100, "currency": "EUR"},
                "logistics_hub_customs": {"value": 200, "currency": "TRY"},
                "logistics_customs_client": {"value": 5000, "currency": "RUB"},
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
            quote_currency="RUB"
        )

        # EUR 100 → USD ~108
        assert 50 < float(result.logistics.logistics_supplier_hub) < 200

        # TRY 200 → USD ~6
        assert 1 < float(result.logistics.logistics_hub_customs) < 50

        # RUB 5000 → USD ~63
        assert 30 < float(result.logistics.logistics_customs_client) < 150

    def test_brokerage_all_fields_to_usd(self):
        """All brokerage fields should convert to USD."""
        product = ProductFromFile(
            base_price_vat=Decimal("1000"),
            quantity=10,
            weight_in_kg=Decimal("5"),
            product_name="Test",
            currency_of_base_price="USD",
        )

        variables = {
            "currency_of_quote": "RUB",
            "monetary_fields": {
                "brokerage_hub": {"value": 100, "currency": "EUR"},
                "brokerage_customs": {"value": 5000, "currency": "RUB"},
                "warehousing_at_customs": {"value": 3000, "currency": "RUB"},
                "customs_documentation": {"value": 2000, "currency": "RUB"},
                "brokerage_extra": {"value": 1000, "currency": "RUB"},
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
            quote_currency="RUB"
        )

        # EUR 100 → USD ~108
        assert 50 < float(result.customs.brokerage_hub) < 200

        # RUB 5000 → USD ~63
        assert 30 < float(result.customs.brokerage_customs) < 150

        # RUB 3000 → USD ~38
        assert 15 < float(result.customs.warehousing_at_customs) < 80

        # RUB 2000 → USD ~25
        assert 10 < float(result.customs.customs_documentation) < 60

        # RUB 1000 → USD ~12
        assert 5 < float(result.customs.brokerage_extra) < 30


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
