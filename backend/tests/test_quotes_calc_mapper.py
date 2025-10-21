"""
Tests for variable mapper function in quotes_calc.py
"""
import pytest
from decimal import Decimal
from routes.quotes_calc import (
    ProductFromFile,
    map_variables_to_calculation_input,
    safe_decimal,
    safe_str,
    safe_int,
    get_value
)


class TestHelperFunctions:
    """Test safe conversion helper functions"""

    def test_safe_decimal_valid(self):
        assert safe_decimal("123.45") == Decimal("123.45")
        assert safe_decimal(100) == Decimal("100")
        assert safe_decimal(Decimal("50.5")) == Decimal("50.5")

    def test_safe_decimal_invalid(self):
        assert safe_decimal(None) == Decimal("0")
        assert safe_decimal("") == Decimal("0")
        assert safe_decimal("invalid", Decimal("99")) == Decimal("99")

    def test_safe_str_valid(self):
        assert safe_str("hello") == "hello"
        assert safe_str(123) == "123"

    def test_safe_str_invalid(self):
        assert safe_str(None) == ""
        assert safe_str("", "default") == "default"

    def test_safe_int_valid(self):
        assert safe_int("42") == 42
        assert safe_int(99) == 99

    def test_safe_int_invalid(self):
        assert safe_int(None) == 0
        assert safe_int("", 10) == 10
        assert safe_int("invalid", 5) == 5


class TestGetValue:
    """Test two-tier value retrieval logic"""

    def test_product_override_takes_precedence(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=1,
            supplier_country="Китай"
        )
        variables = {"supplier_country": "Турция"}

        result = get_value("supplier_country", product, variables, "Россия")
        assert result == "Китай"  # Product override wins

    def test_quote_default_used_when_no_product_override(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=1
        )
        variables = {"supplier_country": "Турция"}

        result = get_value("supplier_country", product, variables, "Россия")
        assert result == "Турция"  # Quote default wins

    def test_fallback_used_when_neither_present(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=1
        )
        variables = {}

        result = get_value("supplier_country", product, variables, "Россия")
        assert result == "Россия"  # Fallback wins


class TestMapVariables:
    """Test the main variable mapper function"""

    def test_mapper_with_minimal_data(self):
        """Test with only required fields"""
        product = ProductFromFile(
            product_name="Test Product",
            base_price_vat=1000.0,
            quantity=10
        )

        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate": "1.0",
            "markup": "15",
            "supplier_country": "Турция"
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("2"),
            "rate_loan_interest_daily": Decimal("0.00069")
        }

        result = map_variables_to_calculation_input(product, variables, admin_settings)

        # Verify product info
        assert result.product.base_price_VAT == Decimal("1000.0")
        assert result.product.quantity == 10
        assert result.product.currency_of_base_price.value == "USD"

        # Verify financial params
        assert result.financial.currency_of_quote.value == "USD"
        assert result.financial.markup == Decimal("15")
        assert result.financial.rate_forex_risk == Decimal("3")

        # Verify logistics params
        assert result.logistics.supplier_country.value == "Турция"
        assert result.logistics.offer_incoterms.value == "DDP"
        assert result.logistics.delivery_time == 60  # Default

        # Verify system config (admin settings)
        assert result.system.rate_fin_comm == Decimal("2")
        assert result.system.rate_loan_interest_daily == Decimal("0.00069")

    def test_mapper_with_product_overrides(self):
        """Test that product-level overrides work"""
        product = ProductFromFile(
            product_name="Test Product",
            base_price_vat=1000.0,
            quantity=10,
            supplier_country="Китай",  # Product override
            customs_code="1234567890",
            weight_in_kg=25.5
        )

        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "EXW",
            "currency_of_base_price": "USD",
            "currency_of_quote": "RUB",
            "exchange_rate": "95.5",
            "markup": "20",
            "supplier_country": "Турция",  # Quote default
            "customs_code": "9999999999"   # Quote default
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("2"),
            "rate_loan_interest_daily": Decimal("0.00069")
        }

        result = map_variables_to_calculation_input(product, variables, admin_settings)

        # Product overrides should win
        assert result.logistics.supplier_country.value == "Китай"
        assert result.product.customs_code == "1234567890"
        assert result.product.weight_in_kg == Decimal("25.5")

        # Quote-level values
        assert result.financial.exchange_rate_base_price_to_quote == Decimal("95.5")
        assert result.financial.currency_of_quote.value == "RUB"

    def test_mapper_with_all_logistics_fields(self):
        """Test with all logistics costs populated"""
        product = ProductFromFile(
            product_name="Test Product",
            base_price_vat=1000.0,
            quantity=10
        )

        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate": "1.0",
            "markup": "15",
            "supplier_country": "Турция",
            "logistics_supplier_hub": "1500.00",
            "logistics_hub_customs": "800.00",
            "logistics_customs_client": "500.00"
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("2"),
            "rate_loan_interest_daily": Decimal("0.00069")
        }

        result = map_variables_to_calculation_input(product, variables, admin_settings)

        assert result.logistics.logistics_supplier_hub == Decimal("1500.00")
        assert result.logistics.logistics_hub_customs == Decimal("800.00")
        assert result.logistics.logistics_customs_client == Decimal("500.00")

    def test_mapper_defaults_applied(self):
        """Test that defaults are properly applied when values are missing"""
        product = ProductFromFile(
            product_name="Test Product",
            base_price_vat=1000.0,
            quantity=10
        )

        # Minimal variables - rely on defaults
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate": "1.0",
            "markup": "15",
            "supplier_country": "Турция"
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("2"),
            "rate_loan_interest_daily": Decimal("0.00069")
        }

        result = map_variables_to_calculation_input(product, variables, admin_settings)

        # Check defaults
        assert result.financial.supplier_discount == Decimal("0")
        assert result.financial.dm_fee_type.value == "fixed"
        assert result.financial.dm_fee_value == Decimal("0")
        assert result.payment.advance_from_client == Decimal("100")
        assert result.payment.advance_to_supplier == Decimal("100")
        assert result.taxes.import_tariff == Decimal("0")
        assert result.taxes.excise_tax == Decimal("0")
        assert result.taxes.util_fee == Decimal("0")
        assert result.product.customs_code == "0000000000"
