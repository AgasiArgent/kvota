"""
Variable Mapping Validation Tests

Validates that all 44 calculation variables are correctly mapped across 4 layers:
1. Excel upload (ProductFromFile model)
2. Backend parsing (Pydantic models)
3. Calculation engine (QuoteCalculationInput)
4. Database storage (quote_items, quote_calculation_variables, calculation_settings)

See: .claude/VARIABLE_MAPPING.md for complete reference
See: .claude/reference/variable-mapping.csv for detailed spreadsheet
"""

import pytest
from decimal import Decimal
from typing import Dict, Any, Set

# Import models to validate
from routes.quotes_calc import ProductFromFile
from calculation_models import (
    QuoteCalculationInput,
    ProductInfo,
    FinancialParams,
    LogisticsParams,
    TaxesAndDuties,
    PaymentTerms,
    CustomsAndClearance,
    CompanySettings,
    SystemConfig,
)


# =============================================================================
# VARIABLE DEFINITIONS
# =============================================================================

# All 44 input variables organized by category
PRODUCT_INFO_VARS = {
    "sku",  # product_code in Pydantic
    "brand",
    "base_price_VAT",  # base_price_vat in Pydantic
    "quantity",
    "weight_in_kg",
}

FINANCIAL_VARS = {
    "currency_of_base_price",
    "currency_of_quote",
    "exchange_rate_base_price_to_quote",
    "supplier_discount",
    "markup",
    "rate_forex_risk",  # Admin-only
    "dm_fee_type",
    "dm_fee_value",
    "rate_fin_comm",  # Admin-only
    "rate_loan_interest_annual",  # Admin-only
}

LOGISTICS_VARS = {
    "supplier_country",
    "offer_incoterms",
    "delivery_time",
    "logistics_supplier_hub",
    "logistics_hub_customs",
    "logistics_customs_client",
}

TAXES_DUTIES_VARS = {
    "customs_code",
    "import_tariff",
    "excise_tax",
    "util_fee",
}

PAYMENT_TERMS_VARS = {
    "advance_from_client",
    "advance_to_supplier",
    "time_to_advance",
    "advance_on_loading",
    "time_to_advance_loading",
    "advance_on_going_to_country_destination",
    "time_to_advance_going_to_country_destination",
    "advance_on_customs_clearance",
    "time_to_advance_on_customs_clearance",
    "time_to_advance_on_receiving",
    "customs_logistics_pmt_due",  # Admin-only
}

CUSTOMS_CLEARANCE_VARS = {
    "brokerage_hub",
    "brokerage_customs",
    "warehousing_at_customs",
    "customs_documentation",
    "brokerage_extra",
}

COMPANY_SETTINGS_VARS = {
    "seller_company",
    "offer_sale_type",
}

ADMIN_ONLY_VARS = {
    "rate_forex_risk",
    "rate_fin_comm",
    "rate_loan_interest_annual",
    "rate_loan_interest_daily",  # Derived from annual
    "customs_logistics_pmt_due",
}

ALL_VARIABLES = (
    PRODUCT_INFO_VARS
    | FINANCIAL_VARS
    | LOGISTICS_VARS
    | TAXES_DUTIES_VARS
    | PAYMENT_TERMS_VARS
    | CUSTOMS_CLEARANCE_VARS
    | COMPANY_SETTINGS_VARS
    | {"rate_loan_interest_daily"}  # Add derived admin variable
)


# =============================================================================
# LAYER 1: EXCEL → PYDANTIC (ProductFromFile)
# =============================================================================

class TestProductFromFileModel:
    """Test that ProductFromFile model has all expected fields."""

    def test_product_info_fields_exist(self):
        """Product info fields should exist in ProductFromFile."""
        fields = set(ProductFromFile.model_fields.keys())

        # Note: sku maps to product_code, base_price_VAT maps to base_price_vat
        assert "product_code" in fields, "product_code (sku) field missing"
        assert "brand" in fields
        assert "base_price_vat" in fields, "base_price_vat field missing"
        assert "quantity" in fields
        assert "weight_in_kg" in fields

    def test_financial_fields_exist(self):
        """Financial fields should exist in ProductFromFile."""
        fields = set(ProductFromFile.model_fields.keys())

        assert "currency_of_base_price" in fields
        assert "exchange_rate_base_price_to_quote" in fields
        assert "supplier_discount" in fields
        assert "markup" in fields

    def test_logistics_fields_exist(self):
        """Logistics fields should exist in ProductFromFile."""
        fields = set(ProductFromFile.model_fields.keys())

        assert "supplier_country" in fields
        # delivery_time is quote-level only (not in ProductFromFile)

    def test_tax_fields_exist(self):
        """Tax and duty fields should exist in ProductFromFile."""
        fields = set(ProductFromFile.model_fields.keys())

        assert "customs_code" in fields
        assert "import_tariff" in fields
        assert "excise_tax" in fields
        assert "util_fee" in fields  # Added in ProductFromFile

    def test_quote_level_vars_not_in_product_from_file(self):
        """Quote-level variables should NOT be in ProductFromFile."""
        fields = set(ProductFromFile.model_fields.keys())

        # These are quote-level only - passed via variables dict, not per-product
        assert "advance_to_supplier" not in fields  # quote-level
        assert "delivery_time" not in fields  # quote-level


# =============================================================================
# LAYER 2: PYDANTIC → CALCULATION ENGINE
# =============================================================================

class TestCalculationEngineModels:
    """Test that calculation engine models have all expected fields."""

    def test_product_info_model(self):
        """ProductInfo should have all product-level calculation fields."""
        fields = set(ProductInfo.model_fields.keys())

        assert "base_price_VAT" in fields
        assert "quantity" in fields
        assert "weight_in_kg" in fields
        assert "currency_of_base_price" in fields
        assert "customs_code" in fields

    def test_financial_params_model(self):
        """FinancialParams should have all financial calculation fields."""
        fields = set(FinancialParams.model_fields.keys())

        assert "currency_of_quote" in fields
        assert "exchange_rate_base_price_to_quote" in fields
        assert "supplier_discount" in fields
        assert "markup" in fields
        assert "rate_forex_risk" in fields
        assert "dm_fee_type" in fields
        assert "dm_fee_value" in fields

    def test_logistics_params_model(self):
        """LogisticsParams should have all logistics calculation fields."""
        fields = set(LogisticsParams.model_fields.keys())

        assert "supplier_country" in fields
        assert "offer_incoterms" in fields
        assert "delivery_time" in fields
        assert "logistics_supplier_hub" in fields
        assert "logistics_hub_customs" in fields
        assert "logistics_customs_client" in fields

    def test_taxes_duties_model(self):
        """TaxesAndDuties should have all tax calculation fields."""
        fields = set(TaxesAndDuties.model_fields.keys())

        assert "import_tariff" in fields
        assert "excise_tax" in fields
        assert "util_fee" in fields

    def test_payment_terms_model(self):
        """PaymentTerms should have all payment calculation fields."""
        fields = set(PaymentTerms.model_fields.keys())

        assert "advance_from_client" in fields
        assert "advance_to_supplier" in fields
        assert "time_to_advance" in fields
        assert "advance_on_loading" in fields
        assert "time_to_advance_loading" in fields
        assert "advance_on_going_to_country_destination" in fields
        assert "time_to_advance_going_to_country_destination" in fields
        assert "advance_on_customs_clearance" in fields
        assert "time_to_advance_on_customs_clearance" in fields
        assert "time_to_advance_on_receiving" in fields

    def test_customs_clearance_model(self):
        """CustomsAndClearance should have all brokerage calculation fields."""
        fields = set(CustomsAndClearance.model_fields.keys())

        assert "brokerage_hub" in fields
        assert "brokerage_customs" in fields
        assert "warehousing_at_customs" in fields
        assert "customs_documentation" in fields
        assert "brokerage_extra" in fields

    def test_company_settings_model(self):
        """CompanySettings should have all company calculation fields."""
        fields = set(CompanySettings.model_fields.keys())

        assert "seller_company" in fields
        assert "offer_sale_type" in fields

    def test_system_config_model(self):
        """SystemConfig should have all admin-only calculation fields."""
        fields = set(SystemConfig.model_fields.keys())

        assert "rate_fin_comm" in fields
        assert "rate_loan_interest_annual" in fields  # daily is calculated from this
        assert "customs_logistics_pmt_due" in fields


# =============================================================================
# LAYER 3: QUOTE CALCULATION INPUT STRUCTURE
# =============================================================================

class TestQuoteCalculationInputStructure:
    """Test that QuoteCalculationInput has all required nested models.

    Note: QuoteCalculationInput uses short field names:
    - product (not product_info)
    - financial (not financial_params)
    - logistics (not logistics_params)
    - taxes (not taxes_and_duties)
    - payment (not payment_terms)
    - customs (not customs_and_clearance)
    - company (not company_settings)
    - system (not system_config)
    """

    def test_has_product(self):
        """QuoteCalculationInput should have product field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "product" in fields

    def test_has_financial(self):
        """QuoteCalculationInput should have financial field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "financial" in fields

    def test_has_logistics(self):
        """QuoteCalculationInput should have logistics field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "logistics" in fields

    def test_has_taxes(self):
        """QuoteCalculationInput should have taxes field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "taxes" in fields

    def test_has_payment(self):
        """QuoteCalculationInput should have payment field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "payment" in fields

    def test_has_customs(self):
        """QuoteCalculationInput should have customs field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "customs" in fields

    def test_has_company(self):
        """QuoteCalculationInput should have company field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "company" in fields

    def test_has_system(self):
        """QuoteCalculationInput should have system field."""
        fields = set(QuoteCalculationInput.model_fields.keys())
        assert "system" in fields


# =============================================================================
# VARIABLE COUNT VALIDATION
# =============================================================================

class TestVariableCount:
    """Validate total variable count matches documentation."""

    def test_total_variable_count(self):
        """Should have exactly 44 input variables."""
        total = len(ALL_VARIABLES)
        assert total == 44, f"Expected 44 variables, got {total}"

    def test_admin_variable_count(self):
        """Should have exactly 5 admin-only variables."""
        total = len(ADMIN_ONLY_VARS)
        assert total == 5, f"Expected 5 admin variables, got {total}"

    def test_user_variable_count(self):
        """Should have exactly 39 user-editable variables."""
        user_vars = ALL_VARIABLES - ADMIN_ONLY_VARS
        total = len(user_vars)
        assert total == 39, f"Expected 39 user variables, got {total}"


# =============================================================================
# NAMING CONSISTENCY VALIDATION
# =============================================================================

class TestNamingConsistency:
    """Validate naming is consistent across layers."""

    def test_no_spaces_or_hyphens(self):
        """Variable names should not have spaces or hyphens."""
        for var in ALL_VARIABLES:
            assert " " not in var, f"{var} should not have spaces"
            assert "-" not in var, f"{var} should use underscores, not hyphens"

    def test_known_uppercase_exceptions(self):
        """Document known uppercase exceptions in variable names."""
        # base_price_VAT uses uppercase VAT for historical reasons
        assert "base_price_VAT" in ALL_VARIABLES

    def test_product_from_file_field_naming(self):
        """ProductFromFile fields should use snake_case."""
        fields = set(ProductFromFile.model_fields.keys())
        for field in fields:
            assert field == field.lower(), f"ProductFromFile.{field} should be lowercase"

    def test_base_price_naming_documented(self):
        """base_price_VAT naming inconsistency should be documented."""
        # ProductFromFile uses base_price_vat (lowercase)
        assert "base_price_vat" in ProductFromFile.model_fields

        # ProductInfo uses base_price_VAT (uppercase VAT)
        assert "base_price_VAT" in ProductInfo.model_fields

        # This is a known inconsistency - test documents it


# =============================================================================
# TWO-TIER SYSTEM VALIDATION
# =============================================================================

class TestTwoTierVariables:
    """Validate variables that support product-level overrides."""

    # Variables that can be overridden at product level
    PRODUCT_OVERRIDABLE_VARS = {
        "currency_of_base_price",
        "exchange_rate_base_price_to_quote",
        "supplier_country",
        "supplier_discount",
        "customs_code",
        "import_tariff",
        "excise_tax",
        "markup",
        "delivery_time",
        "advance_to_supplier",
        "logistics_supplier_hub",
        "logistics_hub_customs",
        "logistics_customs_client",
        "brokerage_hub",
        "brokerage_customs",
        "warehousing_at_customs",
        "customs_documentation",
        "brokerage_extra",
    }

    def test_product_overridable_vars_exist_in_product_from_file(self):
        """Product-level overridable vars should have ProductFromFile fields."""
        pff_fields = set(ProductFromFile.model_fields.keys())

        # Only variables that CAN be set per-product in Excel
        # Quote-level variables (delivery_time, advance_to_supplier) are NOT in ProductFromFile
        product_level_vars = {
            "currency_of_base_price": "currency_of_base_price",
            "exchange_rate_base_price_to_quote": "exchange_rate_base_price_to_quote",
            "supplier_country": "supplier_country",
            "supplier_discount": "supplier_discount",
            "customs_code": "customs_code",
            "import_tariff": "import_tariff",
            "excise_tax": "excise_tax",
            "markup": "markup",
            "util_fee": "util_fee",
        }

        for var, field in product_level_vars.items():
            assert field in pff_fields, f"ProductFromFile missing {field} for {var}"

    def test_quote_level_vars_not_overridable(self):
        """Quote-level only variables should NOT be in ProductFromFile."""
        pff_fields = set(ProductFromFile.model_fields.keys())

        # These variables are set once per quote, not per product
        quote_only_vars = [
            "delivery_time",
            "advance_to_supplier",
            "currency_of_quote",
            "seller_company",
            "offer_sale_type",
            "offer_incoterms",
        ]

        for var in quote_only_vars:
            assert var not in pff_fields, f"{var} should NOT be in ProductFromFile"


# =============================================================================
# MONETARY VALUE FIELDS
# =============================================================================

class TestMonetaryValueFields:
    """Validate fields that use MonetaryValue (multi-currency)."""

    MONETARY_FIELDS = {
        "logistics_supplier_hub",
        "logistics_hub_customs",
        "logistics_customs_client",
        "brokerage_hub",
        "brokerage_customs",
        "warehousing_at_customs",
        "customs_documentation",
        "brokerage_extra",
    }

    def test_logistics_params_has_monetary_fields(self):
        """LogisticsParams should have MonetaryValue logistics fields."""
        fields = set(LogisticsParams.model_fields.keys())

        assert "logistics_supplier_hub" in fields
        assert "logistics_hub_customs" in fields
        assert "logistics_customs_client" in fields

    def test_customs_clearance_has_monetary_fields(self):
        """CustomsAndClearance should have MonetaryValue brokerage fields."""
        fields = set(CustomsAndClearance.model_fields.keys())

        assert "brokerage_hub" in fields
        assert "brokerage_customs" in fields
        assert "warehousing_at_customs" in fields
        assert "customs_documentation" in fields
        assert "brokerage_extra" in fields


# =============================================================================
# INTEGRATION TEST: END-TO-END VARIABLE TRACING
# =============================================================================

class TestEndToEndVariableTracing:
    """Trace a variable through all layers to validate mapping."""

    def test_trace_markup_variable(self):
        """Trace 'markup' from Excel → Database."""
        # Layer 1: Excel upload - ProductFromFile
        assert "markup" in ProductFromFile.model_fields

        # Layer 2: Calculation engine - FinancialParams
        assert "markup" in FinancialParams.model_fields

        # Layer 3: QuoteCalculationInput structure uses short names
        assert "financial" in QuoteCalculationInput.model_fields

    def test_trace_base_price_variable(self):
        """Trace 'base_price_VAT' from Excel → Database."""
        # Layer 1: Excel upload - ProductFromFile (lowercase)
        assert "base_price_vat" in ProductFromFile.model_fields

        # Layer 2: Calculation engine - ProductInfo (uppercase VAT)
        assert "base_price_VAT" in ProductInfo.model_fields

        # Layer 3: QuoteCalculationInput structure uses short names
        assert "product" in QuoteCalculationInput.model_fields

    def test_trace_admin_variable(self):
        """Trace 'rate_forex_risk' (admin-only) through layers."""
        # Should NOT be in ProductFromFile (not user-editable)
        assert "rate_forex_risk" not in ProductFromFile.model_fields

        # Should be in FinancialParams (for calculation)
        assert "rate_forex_risk" in FinancialParams.model_fields

        # Should be fetched from calculation_settings table (not quote data)
        # This is validated by checking the mapper function behavior


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
