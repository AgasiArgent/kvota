"""
API-style tests for calculation engine validation.

Tests the full API pipeline:
1. JSON payload structure (like frontend sends)
2. Variable mapping (map_variables_to_calculation_input)
3. Multi-product calculation
4. Response structure validation

Compares calculation results against Excel expected values.
"""
import pytest
import json
import os
from decimal import Decimal
from typing import Dict, Any, List

# Add backend to path
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from calculation_engine import calculate_multiproduct_quote
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
    Currency,
    SupplierCountry,
    SellerCompany,
    OfferSaleType,
    Incoterms,
    DMFeeType,
)
from .conftest import assert_close


# Path to test data JSON (same as unit tests)
JSON_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "validation_data", "csv", "test_cases_complete.json"
)


# =============================================================================
# API-STYLE JSON PAYLOAD (mimics frontend request)
# =============================================================================

def build_api_payload() -> Dict[str, Any]:
    """Build a JSON payload mimicking the frontend API request structure."""
    # Load products from JSON
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    scenario = data.get("test_raschet", {})
    json_products = scenario.get("products", [])

    # Filter valid products (price_vat > 0)
    valid_products = [p for p in json_products if p.get("price_vat", 0) > 0]

    # Build products array (API format)
    products = []
    for p in valid_products:
        products.append({
            "sku": p.get("sku", ""),
            "brand": p.get("brand", ""),
            "product_name": p.get("product_name", "Unknown"),
            "base_price_vat": float(p["price_vat"]),
            "quantity": int(p["quantity"]),
            "weight_in_kg": float(p.get("weight_kg", 0)),
            "customs_code": str(p.get("hs_code", "")).zfill(10),
            "supplier_country": p.get("country", "Китай"),
            # Product-level overrides
            "currency_of_base_price": "CNY",
            "exchange_rate_base_price_to_quote": float(p["exchange_rate"]),
            "markup": float(p["markup"]) * 100,  # Convert 0.19 to 19%
            "import_tariff": float(p.get("tariff", 0)) * 100,  # Convert 0.05 to 5%
        })

    # Build variables dict (API format - matches QuoteCalculationRequest.variables)
    variables = {
        # Financial settings (from Excel)
        "currency_of_quote": "USD",
        "rate_forex_risk": 3,  # AH11 = 0.03 = 3%
        "dm_fee_type": "fixed",
        "dm_fee_value": 0,

        # Logistics (from Excel W2, W3, W4)
        "logistics_supplier_hub": 2000,
        "logistics_hub_customs": 0,
        "logistics_customs_client": 0,

        # Brokerage (all 0 in Excel)
        "brokerage_hub": 0,
        "brokerage_customs": 0,
        "warehousing_at_customs": 0,
        "customs_documentation": 0,
        "brokerage_extra": 0,

        # Payment terms (100% prepayment)
        "advance_from_client": 100,
        "advance_to_supplier": 100,
        "time_to_advance": 0,

        # Delivery
        "delivery_time": 60,
        "offer_incoterms": "DDP",

        # Company
        "seller_company": "МАСТЕР БЭРИНГ ООО",
        "offer_sale_type": "поставка",

        # System config (admin-only, would come from DB)
        "rate_fin_comm": 2,
        "rate_loan_interest_daily": 0.00069,
        "rate_insurance": 0.00047,
        "customs_logistics_pmt_due": 10,
    }

    return {
        "products": products,
        "variables": variables,
        # These would be in real request but not needed for calculation
        "customer_id": "test-customer-id",
        "title": "Test Quote for Excel Validation",
        "quote_date": "2025-11-26",
        "valid_until": "2025-12-26",
    }


def map_api_product_to_input(product: Dict[str, Any], variables: Dict[str, Any]) -> QuoteCalculationInput:
    """
    Map API-style product JSON to QuoteCalculationInput.

    This mimics what the real API does in map_variables_to_calculation_input().
    """
    # Map country name to enum
    country_map = {
        "Китай": SupplierCountry.CHINA,
        "Турция": SupplierCountry.TURKEY,
        "Россия": SupplierCountry.RUSSIA,
        "Болгария": SupplierCountry.BULGARIA,
        "ЕС (закупка между странами ЕС)": SupplierCountry.EU_CROSS_BORDER,
    }

    country = country_map.get(product.get("supplier_country", "Китай"), SupplierCountry.CHINA)

    # Map currency
    currency_map = {
        "USD": Currency.USD,
        "EUR": Currency.EUR,
        "RUB": Currency.RUB,
        "CNY": Currency.CNY,
        "TRY": Currency.TRY,
    }

    base_currency = currency_map.get(
        product.get("currency_of_base_price", variables.get("currency_of_base_price", "CNY")),
        Currency.CNY
    )
    quote_currency = currency_map.get(
        variables.get("currency_of_quote", "USD"),
        Currency.USD
    )

    # Map incoterms
    incoterms_map = {
        "DDP": Incoterms.DDP,
        "EXW": Incoterms.EXW,
        "FOB": Incoterms.FOB,
        "CIF": Incoterms.CIF,
        "CPT": Incoterms.CPT,
    }
    incoterms = incoterms_map.get(variables.get("offer_incoterms", "DDP"), Incoterms.DDP)

    # Map DM fee type
    dm_fee_type_map = {
        "fixed": DMFeeType.FIXED,
        "percent": DMFeeType.PERCENT,
        "Фикс": DMFeeType.FIXED,
        "Процент": DMFeeType.PERCENT,
    }
    dm_fee_type = dm_fee_type_map.get(
        variables.get("dm_fee_type", "fixed"),
        DMFeeType.FIXED
    )

    return QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal(str(product["base_price_vat"])),
            quantity=int(product["quantity"]),
            weight_in_kg=Decimal(str(product.get("weight_in_kg", 0))),
            currency_of_base_price=base_currency,
            customs_code=str(product.get("customs_code", "")),
        ),
        financial=FinancialParams(
            currency_of_quote=quote_currency,
            exchange_rate_base_price_to_quote=Decimal(str(
                product.get("exchange_rate_base_price_to_quote") or
                variables.get("exchange_rate_base_price_to_quote", 1)
            )),
            supplier_discount=Decimal(str(product.get("supplier_discount", 0))),
            markup=Decimal(str(product.get("markup", variables.get("markup", 19)))),
            rate_forex_risk=Decimal(str(variables.get("rate_forex_risk", 0))),
            dm_fee_type=dm_fee_type,
            dm_fee_value=Decimal(str(variables.get("dm_fee_value", 0))),
        ),
        logistics=LogisticsParams(
            supplier_country=country,
            offer_incoterms=incoterms,
            delivery_time=int(variables.get("delivery_time", 60)),
            logistics_supplier_hub=Decimal(str(variables.get("logistics_supplier_hub", 0))),
            logistics_hub_customs=Decimal(str(variables.get("logistics_hub_customs", 0))),
            logistics_customs_client=Decimal(str(variables.get("logistics_customs_client", 0))),
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal(str(product.get("import_tariff", variables.get("import_tariff", 0)))),
            excise_tax=Decimal(str(product.get("excise_tax", variables.get("excise_tax", 0)))),
            util_fee=Decimal(str(product.get("util_fee", variables.get("util_fee", 0)))),
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal(str(variables.get("advance_from_client", 100))),
            advance_to_supplier=Decimal(str(variables.get("advance_to_supplier", 100))),
            time_to_advance=int(variables.get("time_to_advance", 0)),
        ),
        customs=CustomsAndClearance(
            brokerage_hub=Decimal(str(variables.get("brokerage_hub", 0))),
            brokerage_customs=Decimal(str(variables.get("brokerage_customs", 0))),
            warehousing_at_customs=Decimal(str(variables.get("warehousing_at_customs", 0))),
            customs_documentation=Decimal(str(variables.get("customs_documentation", 0))),
            brokerage_extra=Decimal(str(variables.get("brokerage_extra", 0))),
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.SUPPLY,
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal(str(variables.get("rate_fin_comm", 2))),
            rate_loan_interest_daily=Decimal(str(variables.get("rate_loan_interest_daily", 0.00069))),
            rate_insurance=Decimal(str(variables.get("rate_insurance", 0.00047))),
            customs_logistics_pmt_due=int(variables.get("customs_logistics_pmt_due", 10)),
        ),
    )


def load_expected_values() -> Dict[str, Dict[str, Any]]:
    """Load expected values from JSON, indexed by SKU."""
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    scenario = data.get("test_raschet", {})
    products = scenario.get("products", [])

    # Index by SKU
    return {
        p["sku"]: {
            "expected": p["expected"],
            "product": p,
        }
        for p in products if p.get("price_vat", 0) > 0
    }


# =============================================================================
# API-STYLE TEST CLASS
# =============================================================================

class TestExcelApiValidation:
    """
    Test calculation engine using API-style JSON payloads.

    These tests mimic the full API flow:
    1. Build JSON payload (like frontend)
    2. Map to calculation inputs (like API handler)
    3. Run multi-product calculation
    4. Compare results to Excel expected values
    """

    @pytest.fixture(scope="class")
    def api_calculation_results(self):
        """
        Run calculation using API-style JSON payload.
        Returns results indexed by SKU with expected values.
        """
        # Build API payload
        payload = build_api_payload()
        products = payload["products"]
        variables = payload["variables"]

        # Map all products to calculation inputs
        inputs = [map_api_product_to_input(p, variables) for p in products]

        # Run multi-product calculation
        results = calculate_multiproduct_quote(inputs)

        # Load expected values
        expected_by_sku = load_expected_values()

        # Index by SKU
        result_by_sku = {}
        for i, product in enumerate(products):
            sku = product.get("sku", f"product_{i}")
            if sku in expected_by_sku:
                result_by_sku[sku] = {
                    "result": results[i],
                    "expected": expected_by_sku[sku]["expected"],
                    "product": product,
                }

        return result_by_sku

    def test_api_payload_builds_correctly(self):
        """Test that API payload builds without errors."""
        payload = build_api_payload()

        assert "products" in payload
        assert "variables" in payload
        assert len(payload["products"]) > 0
        assert payload["variables"]["currency_of_quote"] == "USD"
        assert payload["variables"]["rate_forex_risk"] == 3

    def test_first_product_purchase_price(self, api_calculation_results):
        """Test purchase price calculation for first product."""
        sku = "195-03-51110"
        data = api_calculation_results[sku]

        assert_close(
            data["result"].purchase_price_total_quote_currency,
            data["expected"]["purchase_rub"],
            f"{sku} purchase_price"
        )

    def test_first_product_logistics(self, api_calculation_results):
        """Test logistics distribution for first product."""
        sku = "195-03-51110"
        data = api_calculation_results[sku]

        assert_close(
            data["result"].logistics_total,
            data["expected"]["logistics"],
            f"{sku} logistics_total"
        )

    def test_first_product_cogs(self, api_calculation_results):
        """Test COGS for first product."""
        sku = "195-03-51110"
        data = api_calculation_results[sku]

        assert_close(
            data["result"].cogs_per_product,
            data["expected"]["cogs_total"],
            f"{sku} cogs_per_product"
        )

    def test_first_product_sales_price(self, api_calculation_results):
        """Test sales price for first product."""
        sku = "195-03-51110"
        data = api_calculation_results[sku]

        assert_close(
            data["result"].sales_price_per_unit_no_vat,
            data["expected"]["price_no_vat"],
            f"{sku} sales_price_per_unit_no_vat"
        )

    def test_all_products_purchase_price(self, api_calculation_results):
        """Test purchase price for all products."""
        errors = []

        for sku, data in api_calculation_results.items():
            try:
                assert_close(
                    data["result"].purchase_price_total_quote_currency,
                    data["expected"]["purchase_rub"],
                    f"{sku} purchase_price"
                )
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"{len(errors)} purchase price mismatches:\n" + "\n".join(errors[:10]))

    def test_all_products_cogs(self, api_calculation_results):
        """Test COGS for all products."""
        errors = []

        for sku, data in api_calculation_results.items():
            try:
                assert_close(
                    data["result"].cogs_per_product,
                    data["expected"]["cogs_total"],
                    f"{sku} cogs"
                )
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"{len(errors)} COGS mismatches:\n" + "\n".join(errors[:10]))

    def test_all_products_sales_price(self, api_calculation_results):
        """Test sales price for all products."""
        errors = []

        for sku, data in api_calculation_results.items():
            try:
                assert_close(
                    data["result"].sales_price_per_unit_no_vat,
                    data["expected"]["price_no_vat"],
                    f"{sku} price_no_vat"
                )
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"{len(errors)} sales price mismatches:\n" + "\n".join(errors[:10]))

    def test_quote_totals(self, api_calculation_results):
        """Test that quote totals sum correctly."""
        total_purchase = sum(
            data["result"].purchase_price_total_quote_currency
            for data in api_calculation_results.values()
        )

        total_cogs = sum(
            data["result"].cogs_per_product
            for data in api_calculation_results.values()
        )

        total_sales = sum(
            data["result"].sales_price_total_no_vat
            for data in api_calculation_results.values()
        )

        # Verify totals are positive and sums make sense
        assert total_purchase > 0, "Total purchase should be positive"
        assert total_cogs > 0, "Total COGS should be positive"
        assert total_sales > 0, "Total sales should be positive"
        assert total_sales > total_cogs, "Sales should exceed COGS (profit margin)"
        assert total_cogs > total_purchase, "COGS should exceed purchase (includes costs)"


class TestApiPayloadMapping:
    """Test JSON payload mapping to calculation inputs."""

    def test_product_mapping_creates_valid_input(self):
        """Test that mapping creates valid QuoteCalculationInput."""
        payload = build_api_payload()
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        # Verify types
        assert isinstance(calc_input, QuoteCalculationInput)
        assert isinstance(calc_input.product.base_price_VAT, Decimal)
        assert calc_input.product.base_price_VAT > 0

    def test_forex_risk_is_applied(self):
        """Test that forex risk from variables is correctly applied."""
        payload = build_api_payload()
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        assert calc_input.financial.rate_forex_risk == Decimal("3")

    def test_logistics_values_from_variables(self):
        """Test that logistics values come from variables."""
        payload = build_api_payload()
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        assert calc_input.logistics.logistics_supplier_hub == Decimal("2000")
        assert calc_input.logistics.logistics_hub_customs == Decimal("0")

    def test_product_override_takes_precedence(self):
        """Test that product-level values override quote-level."""
        payload = build_api_payload()
        product = payload["products"][0]
        variables = payload["variables"]

        # Product has exchange_rate_base_price_to_quote
        calc_input = map_api_product_to_input(product, variables)

        # Should use product value, not variables
        expected_rate = Decimal(str(product["exchange_rate_base_price_to_quote"]))
        assert calc_input.financial.exchange_rate_base_price_to_quote == expected_rate
