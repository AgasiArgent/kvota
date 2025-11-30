"""
API-style tests for calculation engine validation.

Tests the full API pipeline:
1. JSON payload structure (like frontend sends)
2. Variable mapping (map_variables_to_calculation_input)
3. Multi-product calculation
4. Response structure validation

Uses excel_expected_values.json with all 29 calculated fields.
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
from .conftest import assert_close, CALCULATED_FIELDS


# Path to test data JSON (new comprehensive data)
EXTRACTED_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "validation_data", "extracted", "excel_expected_values.json"
)


# =============================================================================
# MAPPING HELPERS
# =============================================================================

COUNTRY_MAP = {
    "Китай": SupplierCountry.CHINA,
    "Турция": SupplierCountry.TURKEY,
    "Россия": SupplierCountry.RUSSIA,
    "Болгария": SupplierCountry.BULGARIA,
    "ЕС (закупка между странами ЕС)": SupplierCountry.EU_CROSS_BORDER,
}

CURRENCY_MAP = {
    "USD": Currency.USD,
    "EUR": Currency.EUR,
    "RUB": Currency.RUB,
    "CNY": Currency.CNY,
    "TRY": Currency.TRY,
}

INCOTERMS_MAP = {
    "DDP": Incoterms.DDP,
    "EXW": Incoterms.EXW,
    "FOB": Incoterms.FOB,
    "CIF": Incoterms.CIF,
    "DAP": Incoterms.DAP,
}

DM_FEE_TYPE_MAP = {
    "fixed": DMFeeType.FIXED,
    "percent": DMFeeType.PERCENTAGE,
    "%": DMFeeType.PERCENTAGE,
    "Фикс": DMFeeType.FIXED,
    "Процент": DMFeeType.PERCENTAGE,
}

SELLER_MAP = {
    "МАСТЕР БЭРИНГ ООО (ИНН 0242013464)": SellerCompany.MASTER_BEARING_RU,
    "МАСТЕР БЭРИНГ ООО": SellerCompany.MASTER_BEARING_RU,
}


# =============================================================================
# DATA LOADING
# =============================================================================

def load_extracted_data() -> Dict[str, Any]:
    """Load extracted Excel data."""
    with open(EXTRACTED_DATA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


# =============================================================================
# API-STYLE JSON PAYLOAD BUILDER
# =============================================================================

def build_api_payload(scenario_name: str = "test_raschet") -> Dict[str, Any]:
    """
    Build a JSON payload mimicking the frontend API request structure.

    Uses excel_expected_values.json which has all 29 expected fields.
    """
    data = load_extracted_data()
    scenario = data["scenarios"].get(scenario_name)

    if not scenario:
        raise ValueError(f"Scenario {scenario_name} not found")

    quote_vars = scenario["quote_variables"]
    products = scenario["products"]

    # Build products array (API format)
    api_products = []
    for p in products:
        api_products.append({
            "sku": p.get("sku", ""),
            "brand": "",  # Not in extracted data
            "product_name": p.get("product_name", "Unknown"),
            "base_price_vat": float(p["base_price_vat"]),
            "quantity": int(p["quantity"]),
            "weight_in_kg": 0,
            "customs_code": str(p.get("customs_code", "") or ""),
            "supplier_country": p.get("supplier_country", "Китай"),
            # Product-level overrides
            "currency_of_base_price": "CNY",  # Default, most products are CNY
            "exchange_rate_base_price_to_quote": float(p.get("exchange_rate", 1)),
            "markup": float(p.get("markup", 0.19)) * 100,  # Convert 0.19 to 19%
            "import_tariff": float(p.get("import_tariff", 0)) * 100,  # Convert 0.05 to 5%
        })

    # Build variables dict (API format)
    variables = {
        # Financial settings
        "currency_of_quote": quote_vars.get("currency_of_quote", "USD"),
        "rate_forex_risk": float(quote_vars.get("rate_forex_risk", 0)) * 100,  # Convert 0.03 to 3
        "dm_fee_type": quote_vars.get("dm_fee_type", "Фикс"),
        "dm_fee_value": float(quote_vars.get("dm_fee_value", 0) or 0),

        # Logistics
        "logistics_supplier_hub": float(quote_vars.get("logistics_supplier_hub", 0) or 0),
        "logistics_hub_customs": float(quote_vars.get("logistics_hub_customs", 0) or 0),
        "logistics_customs_client": float(quote_vars.get("logistics_customs_client", 0) or 0),

        # Brokerage
        "brokerage_hub": float(quote_vars.get("brokerage_hub", 0) or 0),
        "brokerage_customs": float(quote_vars.get("brokerage_customs", 0) or 0),
        "warehousing_at_customs": float(quote_vars.get("warehousing_at_customs", 0) or 0),
        "customs_documentation": float(quote_vars.get("customs_documentation", 0) or 0),
        "brokerage_extra": float(quote_vars.get("brokerage_extra", 0) or 0),

        # Payment terms
        "advance_from_client": float(quote_vars.get("advance_from_client", 1) or 1) * 100,  # Convert 1.0 to 100
        "advance_to_supplier": float(quote_vars.get("advance_to_supplier", 1) or 1) * 100,
        "time_to_advance": int(quote_vars.get("time_to_advance", 0) or 0),

        # Delivery
        "delivery_time": int(quote_vars.get("delivery_time", 60) or 60),
        "offer_incoterms": quote_vars.get("offer_incoterms", "DDP"),

        # Company
        "seller_company": quote_vars.get("seller_company", "МАСТЕР БЭРИНГ ООО"),
        "offer_sale_type": quote_vars.get("offer_sale_type", "поставка"),
    }

    return {
        "products": api_products,
        "variables": variables,
        "scenario_name": scenario_name,
        "quote_vars_raw": quote_vars,  # Keep raw for reference
        "expected_products": products,  # Keep for expected values
    }


def map_api_product_to_input(product: Dict[str, Any], variables: Dict[str, Any]) -> QuoteCalculationInput:
    """
    Map API-style product JSON to QuoteCalculationInput.

    This mimics what the real API does in map_variables_to_calculation_input().
    """
    # Map country
    country = COUNTRY_MAP.get(
        product.get("supplier_country", "Китай"),
        SupplierCountry.CHINA
    )

    # Map currencies
    base_currency = CURRENCY_MAP.get(
        product.get("currency_of_base_price", "CNY"),
        Currency.CNY
    )
    quote_currency = CURRENCY_MAP.get(
        variables.get("currency_of_quote", "USD"),
        Currency.USD
    )

    # Map incoterms
    incoterms = INCOTERMS_MAP.get(
        variables.get("offer_incoterms", "DDP"),
        Incoterms.DDP
    )

    # Map DM fee type
    dm_fee_type_raw = variables.get("dm_fee_type", "Фикс")
    dm_fee_type = DM_FEE_TYPE_MAP.get(
        dm_fee_type_raw if isinstance(dm_fee_type_raw, str) else "Фикс",
        DMFeeType.FIXED
    )

    # Map seller
    seller_raw = variables.get("seller_company", "МАСТЕР БЭРИНГ ООО")
    seller = SELLER_MAP.get(seller_raw, SellerCompany.MASTER_BEARING_RU)

    return QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal(str(product["base_price_vat"])),
            quantity=int(product["quantity"]),
            weight_in_kg=Decimal(str(product.get("weight_in_kg", 0))),
            currency_of_base_price=base_currency,
            customs_code=str(product.get("customs_code", "") or ""),
        ),
        financial=FinancialParams(
            currency_of_quote=quote_currency,
            exchange_rate_base_price_to_quote=Decimal(str(
                product.get("exchange_rate_base_price_to_quote", 1)
            )),
            supplier_discount=Decimal("0"),
            markup=Decimal(str(product.get("markup", 19))),  # Already in % form
            rate_forex_risk=Decimal(str(variables.get("rate_forex_risk", 0))),  # Already in % form
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
            import_tariff=Decimal(str(product.get("import_tariff", 0))),  # Already in % form
            excise_tax=Decimal("0"),
            util_fee=Decimal("0"),
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
            seller_company=seller,
            offer_sale_type=OfferSaleType.SUPPLY,
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            # Excel uses 25% annual / 365 days
            rate_loan_interest_daily=Decimal("0.25") / 365,
            rate_insurance=Decimal("0.00047"),
            customs_logistics_pmt_due=10,
        ),
    )


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
    4. Compare results to Excel expected values (29 fields)
    """

    @pytest.fixture(scope="class")
    def api_calculation_results(self):
        """
        Run calculation using API-style JSON payload.
        Returns results indexed by row with expected values.
        """
        payload = build_api_payload("test_raschet")
        products = payload["products"]
        variables = payload["variables"]
        expected_products = payload["expected_products"]

        # Map all products to calculation inputs
        inputs = [map_api_product_to_input(p, variables) for p in products]

        # Run multi-product calculation
        results = calculate_multiproduct_quote(inputs)

        # Index by row number for comparison
        result_by_row = {}
        for i, product in enumerate(products):
            row = expected_products[i]["row"]
            result_by_row[row] = {
                "result": results[i],
                "expected": expected_products[i]["expected"],
                "product": product,
                "sku": product.get("sku", f"product_{i}"),
            }

        return result_by_row

    def test_api_payload_builds_correctly(self):
        """Test that API payload builds without errors."""
        payload = build_api_payload("test_raschet")

        assert "products" in payload
        assert "variables" in payload
        assert len(payload["products"]) > 0
        assert payload["variables"]["currency_of_quote"] == "USD"

    def test_first_product_purchase_price(self, api_calculation_results):
        """Test purchase price calculation for first product."""
        data = api_calculation_results[16]  # Row 16 is first product

        assert_close(
            data["result"].purchase_price_total_quote_currency,
            data["expected"]["purchase_price_total_quote_currency"],
            f"{data['sku']} purchase_price"
        )

    def test_first_product_logistics(self, api_calculation_results):
        """Test logistics distribution for first product."""
        data = api_calculation_results[16]

        assert_close(
            data["result"].logistics_total,
            data["expected"]["logistics_total"],
            f"{data['sku']} logistics_total"
        )

    def test_first_product_cogs(self, api_calculation_results):
        """Test COGS for first product."""
        data = api_calculation_results[16]

        assert_close(
            data["result"].cogs_per_product,
            data["expected"]["cogs_per_product"],
            f"{data['sku']} cogs_per_product"
        )

    def test_first_product_sales_price(self, api_calculation_results):
        """Test sales price for first product."""
        data = api_calculation_results[16]

        assert_close(
            data["result"].sales_price_per_unit_no_vat,
            data["expected"]["sales_price_per_unit_no_vat"],
            f"{data['sku']} sales_price_per_unit_no_vat"
        )

    def test_all_29_fields_first_product(self, api_calculation_results):
        """Test all 29 calculated fields for first product."""
        data = api_calculation_results[16]
        errors = []

        for field in CALCULATED_FIELDS:
            expected_val = data["expected"].get(field)
            if expected_val is None:
                continue

            actual_val = getattr(data["result"], field, None)
            if actual_val is None:
                errors.append(f"{field}: attribute not found on result")
                continue

            try:
                assert_close(actual_val, expected_val, f"{field}")
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"Row 16: {len(errors)} field mismatches:\n" + "\n".join(errors[:10]))

    def test_all_products_purchase_price(self, api_calculation_results):
        """Test purchase price for all products."""
        errors = []

        for row, data in api_calculation_results.items():
            expected = data["expected"].get("purchase_price_total_quote_currency")
            if expected is None:
                continue

            try:
                assert_close(
                    data["result"].purchase_price_total_quote_currency,
                    expected,
                    f"Row {row} purchase_price"
                )
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"{len(errors)} purchase price mismatches:\n" + "\n".join(errors[:10]))

    def test_all_products_cogs(self, api_calculation_results):
        """Test COGS for all products."""
        errors = []

        for row, data in api_calculation_results.items():
            expected = data["expected"].get("cogs_per_product")
            if expected is None:
                continue

            try:
                assert_close(
                    data["result"].cogs_per_product,
                    expected,
                    f"Row {row} cogs"
                )
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"{len(errors)} COGS mismatches:\n" + "\n".join(errors[:10]))

    def test_all_products_sales_price(self, api_calculation_results):
        """Test sales price for all products."""
        errors = []

        for row, data in api_calculation_results.items():
            expected = data["expected"].get("sales_price_per_unit_no_vat")
            if expected is None:
                continue

            try:
                assert_close(
                    data["result"].sales_price_per_unit_no_vat,
                    expected,
                    f"Row {row} price_no_vat"
                )
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"{len(errors)} sales price mismatches:\n" + "\n".join(errors[:10]))

    def test_all_products_all_fields(self, api_calculation_results):
        """
        Test ALL 29 calculated fields for ALL products.
        This is the comprehensive API validation test.
        """
        total_assertions = 0
        errors = []

        for row, data in api_calculation_results.items():
            for field in CALCULATED_FIELDS:
                expected_val = data["expected"].get(field)
                if expected_val is None:
                    continue

                actual_val = getattr(data["result"], field, None)
                if actual_val is None:
                    errors.append(f"Row {row} {field}: attribute not found")
                    continue

                total_assertions += 1
                try:
                    assert_close(actual_val, expected_val, f"Row {row} {field}")
                except AssertionError as e:
                    errors.append(str(e))

        if errors:
            pytest.fail(
                f"{len(errors)} mismatches out of {total_assertions} assertions:\n" +
                "\n".join(errors[:20])  # Show first 20 errors
            )

        # Report success count
        print(f"\n✅ {total_assertions} assertions passed for API-style calculation")

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
        payload = build_api_payload("test_raschet")
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        # Verify types
        assert isinstance(calc_input, QuoteCalculationInput)
        assert isinstance(calc_input.product.base_price_VAT, Decimal)
        assert calc_input.product.base_price_VAT > 0

    def test_forex_risk_is_applied(self):
        """Test that forex risk from variables is correctly applied."""
        payload = build_api_payload("test_raschet")
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        # rate_forex_risk should be 3 (3%)
        assert calc_input.financial.rate_forex_risk == Decimal("3")

    def test_logistics_values_from_variables(self):
        """Test that logistics values come from variables."""
        payload = build_api_payload("test_raschet")
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        assert calc_input.logistics.logistics_supplier_hub == Decimal("2000")
        assert calc_input.logistics.logistics_hub_customs == Decimal("0")

    def test_product_override_takes_precedence(self):
        """Test that product-level values override quote-level."""
        payload = build_api_payload("test_raschet")
        product = payload["products"][0]
        variables = payload["variables"]

        # Product has exchange_rate_base_price_to_quote
        calc_input = map_api_product_to_input(product, variables)

        # Should use product value, not variables
        expected_rate = Decimal(str(product["exchange_rate_base_price_to_quote"]))
        assert calc_input.financial.exchange_rate_base_price_to_quote == expected_rate

    def test_incoterms_mapping(self):
        """Test that incoterms are correctly mapped."""
        payload = build_api_payload("test_raschet")
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        # Default is DDP
        assert calc_input.logistics.offer_incoterms == Incoterms.DDP

    def test_country_mapping(self):
        """Test that supplier country is correctly mapped."""
        payload = build_api_payload("test_raschet")
        product = payload["products"][0]
        variables = payload["variables"]

        calc_input = map_api_product_to_input(product, variables)

        # First product is from China
        assert calc_input.logistics.supplier_country == SupplierCountry.CHINA
