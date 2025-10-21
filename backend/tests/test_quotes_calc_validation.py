"""
Tests for validation logic in quotes_calc.py
"""
import pytest
from routes.quotes_calc import ProductFromFile, validate_calculation_input


class TestValidationRequired:
    """Test validation of required fields"""

    def test_missing_base_price_vat(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=0,  # Invalid
            quantity=10
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0",
            "markup": "15"
        }

        errors = validate_calculation_input(product, variables)
        assert len(errors) > 0
        assert any("base_price_vat" in err for err in errors)

    def test_missing_quantity(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=0  # Invalid
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0",
            "markup": "15"
        }

        errors = validate_calculation_input(product, variables)
        assert len(errors) > 0
        assert any("quantity" in err for err in errors)

    def test_missing_seller_company(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=10
        )
        variables = {
            # Missing seller_company
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0",
            "markup": "15"
        }

        errors = validate_calculation_input(product, variables)
        assert len(errors) > 0
        assert any("seller_company" in err for err in errors)

    def test_missing_markup(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=10
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0"
            # Missing markup
        }

        errors = validate_calculation_input(product, variables)
        assert len(errors) > 0
        assert any("markup" in err for err in errors)

    def test_invalid_exchange_rate(self):
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=10
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "0",  # Invalid - must be > 0
            "markup": "15",
            "supplier_country": "Турция"  # Add required field
        }

        errors = validate_calculation_input(product, variables)
        assert len(errors) > 0
        # Check for Russian error message with user-friendly guidance
        # Error message should use Russian label "Курс к валюте КП" and say "больше нуля"
        assert any("Курс к валюте КП" in err and "больше нуля" in err for err in errors)


class TestBusinessRules:
    """Test business logic validation rules"""

    def test_non_exw_requires_logistics_cost(self):
        """If incoterms ≠ EXW, at least one logistics field must be > 0"""
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=10,
            supplier_country="Турция"
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",  # Not EXW
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0",
            "markup": "15",
            # All logistics costs are 0 or missing
            "logistics_supplier_hub": "0",
            "logistics_hub_customs": "0",
            "logistics_customs_client": "0"
        }

        errors = validate_calculation_input(product, variables)
        assert len(errors) > 0
        # Check for Russian logistics error message
        assert any("логистическая" in err.lower() or "логистика" in err.lower() for err in errors)

    def test_non_exw_passes_with_at_least_one_logistics_cost(self):
        """If incoterms = DDP and logistics_supplier_hub > 0, should pass"""
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=10,
            supplier_country="Турция"
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0",
            "markup": "15",
            "logistics_supplier_hub": "1500.00",  # Has logistics cost
            "logistics_hub_customs": "0",
            "logistics_customs_client": "0"
        }

        errors = validate_calculation_input(product, variables)
        # Should not have logistics-related errors
        assert not any("логистическая" in err.lower() or "логистика" in err.lower() for err in errors)

    def test_exw_allows_zero_logistics_costs(self):
        """If incoterms = EXW, logistics costs can all be 0"""
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=100.0,
            quantity=10,
            supplier_country="Турция"
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "EXW",  # EXW allows zero logistics
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0",
            "markup": "15",
            "logistics_supplier_hub": "0",
            "logistics_hub_customs": "0",
            "logistics_customs_client": "0"
        }

        errors = validate_calculation_input(product, variables)
        # Should not have logistics-related errors
        assert not any("логистическая" in err.lower() or "логистика" in err.lower() for err in errors)


class TestMultipleErrors:
    """Test that all errors are returned at once"""

    def test_returns_all_errors_at_once(self):
        """Should return all validation errors, not just the first one"""
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=0,  # Error 1
            quantity=0  # Error 2
        )
        variables = {
            # Missing seller_company - Error 3
            # Missing offer_incoterms - Error 4
            # Missing currency_of_base_price - Error 5
            # Missing currency_of_quote - Error 6
            # Missing exchange_rate - Error 7
            # Missing markup - Error 8
        }

        errors = validate_calculation_input(product, variables)
        # Should return multiple errors
        assert len(errors) >= 5  # At least several errors

    def test_valid_input_returns_no_errors(self):
        """Valid input should return empty error list"""
        product = ProductFromFile(
            product_name="Test",
            base_price_vat=1000.0,
            quantity=10,
            supplier_country="Турция"
        )
        variables = {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "EXW",
            "currency_of_base_price": "USD",
            "currency_of_quote": "USD",
            "exchange_rate_base_price_to_quote": "1.0",
            "markup": "15"
        }

        errors = validate_calculation_input(product, variables)
        assert len(errors) == 0
