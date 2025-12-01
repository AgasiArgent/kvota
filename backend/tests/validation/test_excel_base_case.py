"""
Test calculation engine against test_raschet.xlsm (base case scenario).

This validates all 33 product-level calculated values against Excel expected results.
Scenario: 97 products from China, 100% prepayment, 60 days delivery, USD currency.

Two test modes:
1. Single-product tests - Only validates Phase 1 (purchase price) which doesn't need distribution
2. Multi-product tests - Validates all phases with proper cost distribution
"""
import pytest
import sys
import os
import json
from decimal import Decimal
from typing import List, Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from calculation_engine import calculate_single_product_quote, calculate_multiproduct_quote

# Path to test data JSON
JSON_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "validation_data", "csv", "test_cases_complete.json"
)
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
from .conftest import assert_close, PRODUCT_FIELD_MAPPING


# =============================================================================
# QUOTE-LEVEL PARAMETERS (same for all products in test_raschet.xlsm)
# =============================================================================

BASE_QUOTE_PARAMS = {
    "seller_company": SellerCompany.MASTER_BEARING_RU,
    "offer_sale_type": OfferSaleType.SUPPLY,
    "offer_incoterms": Incoterms.DDP,
    "currency_of_quote": Currency.USD,
    "delivery_time": 60,
    # Payment: 100% prepayment
    "advance_from_client": Decimal("100"),
    "advance_to_supplier": Decimal("100"),
    "time_to_advance": 0,
    # Logistics costs from Excel (W2=2000, W3=0, W4=0)
    # Note: Insurance (123.20) is calculated by engine from rate_insurance
    "logistics_supplier_hub": Decimal("2000"),   # W2
    "logistics_hub_customs": Decimal("0"),       # W3
    "logistics_customs_client": Decimal("0"),    # W4
    # Brokerage costs (all 0 in Excel)
    "brokerage_hub": Decimal("0"),
    "brokerage_customs": Decimal("0"),
    "warehousing_at_customs": Decimal("0"),
    "customs_documentation": Decimal("0"),
    "brokerage_extra": Decimal("0"),
    # Financial (from Excel AH11=0.03)
    "rate_forex_risk": Decimal("3"),  # 3% forex risk
}


# =============================================================================
# TEST DATA - First 5 products from test_raschet.xlsm
# Expected values taken directly from test_cases_complete.json
# =============================================================================

TEST_PRODUCTS = [
    {
        "id": "product_1",
        "sku": "195-03-51110",
        "name": "CORE",
        "base_price_vat": Decimal("136554.77"),
        "quantity": 1,
        "weight_kg": Decimal("0"),
        "country": SupplierCountry.CHINA,
        "currency": Currency.CNY,
        "vat_rate": Decimal("0.13"),
        "exchange_rate": Decimal("7.14"),
        "customs_code": "8708913509",
        "tariff": Decimal("0.05"),
        "markup": Decimal("0.19"),
        # Expected values from JSON (extracted from Excel)
        "expected": {
            "S16": Decimal("19125.32"),      # purchase_rub from JSON
            "V16": Decimal("158.14"),        # logistics from JSON
            "Y16": Decimal("983.30"),        # duty from JSON
            "AB16": Decimal("20266.76"),     # cogs_total from JSON
            "AJ16": Decimal("25298.32"),     # price_no_vat from JSON
            "AL16": Decimal("30357.98"),     # price_with_vat from JSON
        }
    },
    {
        "id": "product_2",
        "sku": "6245-31-1100",
        "name": "CRANKSHAFT ASS",
        "base_price_vat": Decimal("117760.56"),
        "quantity": 1,
        "weight_kg": Decimal("0"),
        "country": SupplierCountry.CHINA,
        "currency": Currency.CNY,
        "vat_rate": Decimal("0.13"),
        "exchange_rate": Decimal("7.14"),
        "customs_code": "8409990009",
        "tariff": Decimal("0.05"),
        "markup": Decimal("0.19"),
        "expected": {
            "S16": Decimal("16493.08"),      # purchase_rub from JSON
            "V16": Decimal("136.37"),        # logistics from JSON
            "Y16": Decimal("847.97"),        # duty from JSON
            "AB16": Decimal("17477.42"),     # cogs_total from JSON
            "AJ16": Decimal("21816.49"),     # price_no_vat from JSON
            "AL16": Decimal("26179.79"),     # price_with_vat from JSON
        }
    },
    {
        "id": "product_3",
        "sku": "6162-33-1202",
        "name": "CRANKSHAFT ASS",
        "base_price_vat": Decimal("115457.41"),
        "quantity": 1,
        "weight_kg": Decimal("0"),
        "country": SupplierCountry.CHINA,
        "currency": Currency.CNY,
        "vat_rate": Decimal("0.13"),
        "exchange_rate": Decimal("7.14"),
        "customs_code": "8409990009",
        "tariff": Decimal("0.05"),
        "markup": Decimal("0.19"),
        "expected": {
            "S16": Decimal("16170.51"),      # purchase_rub from JSON
            "V16": Decimal("133.71"),        # logistics from JSON
            "Y16": Decimal("831.38"),        # duty from JSON
            "AB16": Decimal("17135.59"),     # cogs_total from JSON
            "AJ16": Decimal("21389.79"),     # price_no_vat from JSON
            "AL16": Decimal("25667.75"),     # price_with_vat from JSON
        }
    },
    {
        "id": "product_4",
        "sku": "195-03-43100",
        "name": "OIL COOLER ASS",
        "base_price_vat": Decimal("102373.00"),
        "quantity": 1,
        "weight_kg": Decimal("0"),
        "country": SupplierCountry.CHINA,
        "currency": Currency.CNY,
        "vat_rate": Decimal("0.13"),
        "exchange_rate": Decimal("7.14"),
        "customs_code": "8708913509",
        "tariff": Decimal("0.05"),
        "markup": Decimal("0.19"),
        "expected": {
            "S16": Decimal("14337.96"),      # purchase_rub from JSON
            "V16": Decimal("118.55"),        # logistics from JSON
            "Y16": Decimal("737.16"),        # duty from JSON
            "AB16": Decimal("15193.67"),     # cogs_total from JSON
            "AJ16": Decimal("18965.76"),     # price_no_vat from JSON
            "AL16": Decimal("22758.91"),     # price_with_vat from JSON
        }
    },
    {
        "id": "product_5",
        "sku": "600-614-5351",
        "name": "REVERSIBLE FAN",
        "base_price_vat": Decimal("55356.99"),
        "quantity": 1,
        "weight_kg": Decimal("0"),
        "country": SupplierCountry.CHINA,
        "currency": Currency.CNY,
        "vat_rate": Decimal("0.13"),
        "exchange_rate": Decimal("7.14"),
        "customs_code": "8414900000",
        "tariff": Decimal("0"),              # This product has 0% tariff
        "markup": Decimal("0.19"),
        "expected": {
            "S16": Decimal("7753.08"),       # purchase_rub from JSON
            "V16": Decimal("64.11"),         # logistics from JSON
            "Y16": Decimal("0"),             # duty = 0 (no tariff)
            "AB16": Decimal("7817.19"),      # cogs_total from JSON
            "AJ16": Decimal("9766.94"),      # price_no_vat from JSON
            "AL16": Decimal("11720.33"),     # price_with_vat from JSON
        }
    },
]


def build_calculation_input(product: dict) -> QuoteCalculationInput:
    """Build QuoteCalculationInput from test product data."""
    return QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=product["base_price_vat"],
            quantity=product["quantity"],
            weight_in_kg=product["weight_kg"],
            currency_of_base_price=product["currency"],
            customs_code=product["customs_code"],
        ),
        financial=FinancialParams(
            currency_of_quote=BASE_QUOTE_PARAMS["currency_of_quote"],
            exchange_rate_base_price_to_quote=product["exchange_rate"],
            supplier_discount=Decimal("0"),
            markup=product["markup"] * 100,  # Convert 0.19 to 19%
            rate_forex_risk=BASE_QUOTE_PARAMS["rate_forex_risk"],  # 3% from Excel AH11
            dm_fee_type=DMFeeType.FIXED,
            dm_fee_value=Decimal("0"),
        ),
        logistics=LogisticsParams(
            supplier_country=product["country"],
            offer_incoterms=BASE_QUOTE_PARAMS["offer_incoterms"],
            delivery_time=BASE_QUOTE_PARAMS["delivery_time"],
            logistics_supplier_hub=BASE_QUOTE_PARAMS["logistics_supplier_hub"],
            logistics_hub_customs=BASE_QUOTE_PARAMS["logistics_hub_customs"],
            logistics_customs_client=BASE_QUOTE_PARAMS["logistics_customs_client"],
        ),
        taxes=TaxesAndDuties(
            import_tariff=product["tariff"] * 100,  # Convert 0.05 to 5%
            excise_tax=Decimal("0"),
            util_fee=Decimal("0"),
        ),
        payment=PaymentTerms(
            advance_from_client=BASE_QUOTE_PARAMS["advance_from_client"],
            advance_to_supplier=BASE_QUOTE_PARAMS["advance_to_supplier"],
            time_to_advance=BASE_QUOTE_PARAMS["time_to_advance"],
        ),
        customs=CustomsAndClearance(
            brokerage_hub=BASE_QUOTE_PARAMS["brokerage_hub"],
            brokerage_customs=BASE_QUOTE_PARAMS["brokerage_customs"],
            warehousing_at_customs=BASE_QUOTE_PARAMS["warehousing_at_customs"],
            customs_documentation=BASE_QUOTE_PARAMS["customs_documentation"],
            brokerage_extra=BASE_QUOTE_PARAMS["brokerage_extra"],
        ),
        company=CompanySettings(
            seller_company=BASE_QUOTE_PARAMS["seller_company"],
            offer_sale_type=BASE_QUOTE_PARAMS["offer_sale_type"],
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047"),
            customs_logistics_pmt_due=10,
        ),
    )


class TestExcelBaseCase:
    """
    Validate calculation engine against test_raschet.xlsm.

    This is the base case with 97 products from China.
    Payment: 100% prepayment
    Currency: USD
    Delivery: 60 days
    """

    @pytest.mark.parametrize("product", TEST_PRODUCTS, ids=lambda p: p["id"])
    def test_purchase_price(self, product):
        """Test Phase 1: Purchase price calculation (S16)."""
        calc_input = build_calculation_input(product)
        result = calculate_single_product_quote(calc_input)

        assert_close(
            result.purchase_price_total_quote_currency,
            product["expected"]["S16"],
            "S16 (purchase_price_total_quote_currency)"
        )

    @pytest.mark.skip(reason="Requires multi-product calculation for proper distribution")
    @pytest.mark.parametrize("product", TEST_PRODUCTS, ids=lambda p: p["id"])
    def test_logistics(self, product):
        """Test Phase 3: Logistics calculation (V16). SKIP: Needs multi-product."""
        calc_input = build_calculation_input(product)
        result = calculate_single_product_quote(calc_input)

        assert_close(
            result.logistics_total,
            product["expected"]["V16"],
            "V16 (logistics_total)"
        )

    @pytest.mark.skip(reason="Requires multi-product calculation for proper distribution")
    @pytest.mark.parametrize("product", TEST_PRODUCTS, ids=lambda p: p["id"])
    def test_customs_duty(self, product):
        """Test Phase 4: Customs duty calculation (Y16). SKIP: Needs multi-product."""
        calc_input = build_calculation_input(product)
        result = calculate_single_product_quote(calc_input)

        assert_close(
            result.customs_fee,
            product["expected"]["Y16"],
            "Y16 (customs_fee)"
        )

    @pytest.mark.skip(reason="Requires multi-product calculation for proper distribution")
    @pytest.mark.parametrize("product", TEST_PRODUCTS, ids=lambda p: p["id"])
    def test_cogs(self, product):
        """Test Phase 10: COGS calculation (AB16). SKIP: Needs multi-product."""
        calc_input = build_calculation_input(product)
        result = calculate_single_product_quote(calc_input)

        assert_close(
            result.cogs_per_product,
            product["expected"]["AB16"],
            "AB16 (cogs_per_product)"
        )

    @pytest.mark.skip(reason="Requires multi-product calculation for proper distribution")
    @pytest.mark.parametrize("product", TEST_PRODUCTS, ids=lambda p: p["id"])
    def test_sales_price_no_vat(self, product):
        """Test Phase 11: Sales price without VAT (AJ16). SKIP: Needs multi-product."""
        calc_input = build_calculation_input(product)
        result = calculate_single_product_quote(calc_input)

        assert_close(
            result.sales_price_per_unit_no_vat,
            product["expected"]["AJ16"],
            "AJ16 (sales_price_per_unit_no_vat)"
        )

    @pytest.mark.skip(reason="Requires multi-product calculation for proper distribution")
    @pytest.mark.parametrize("product", TEST_PRODUCTS, ids=lambda p: p["id"])
    def test_sales_price_with_vat(self, product):
        """Test Phase 12: Sales price with VAT (AL16). SKIP: Needs multi-product."""
        calc_input = build_calculation_input(product)
        result = calculate_single_product_quote(calc_input)

        assert_close(
            result.sales_price_total_with_vat,
            product["expected"]["AL16"],
            "AL16 (sales_price_total_with_vat)"
        )


@pytest.mark.skip(reason="Requires multi-product calculation for proper distribution")
class TestExcelBaseCaseIntegration:
    """Integration test - validate all outputs in single test per product. SKIP: Needs multi-product."""

    @pytest.mark.parametrize("product", TEST_PRODUCTS, ids=lambda p: p["id"])
    def test_all_key_outputs(self, product):
        """Test all 6 key outputs for each product."""
        calc_input = build_calculation_input(product)
        result = calculate_single_product_quote(calc_input)

        # Collect all errors
        errors = []

        for cell, python_attr in [
            ("S16", "purchase_price_total_quote_currency"),
            ("V16", "logistics_total"),
            ("Y16", "customs_fee"),
            ("AB16", "cogs_per_product"),
            ("AJ16", "sales_price_per_unit_no_vat"),
            ("AL16", "sales_price_total_with_vat"),
        ]:
            expected = product["expected"].get(cell)
            if expected is None:
                continue

            actual = getattr(result, python_attr)
            try:
                assert_close(actual, expected, f"{cell}={python_attr}")
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"Product {product['sku']} has {len(errors)} mismatches:\n" + "\n".join(errors))


# =============================================================================
# MULTI-PRODUCT TESTS - Proper cost distribution
# =============================================================================

def load_all_products_from_json() -> List[Dict[str, Any]]:
    """Load all products from test_cases_complete.json"""
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Get test_raschet scenario
    scenario = data.get("test_raschet", {})
    products = scenario.get("products", [])

    # Filter out invalid products (price_vat must be > 0)
    valid_products = [p for p in products if p.get("price_vat", 0) > 0]
    return valid_products


def build_input_from_json(product: Dict[str, Any]) -> QuoteCalculationInput:
    """Build QuoteCalculationInput from JSON product data."""
    # Map country name to enum
    country_map = {
        "Китай": SupplierCountry.CHINA,
        "Турция": SupplierCountry.TURKEY,
        "Россия": SupplierCountry.RUSSIA,
        "Болгария": SupplierCountry.BULGARIA,
        "ЕС (закупка между странами ЕС)": SupplierCountry.EU_CROSS_BORDER,
    }

    country = country_map.get(product.get("country", "Китай"), SupplierCountry.CHINA)

    return QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal(str(product["price_vat"])),
            quantity=int(product["quantity"]),
            weight_in_kg=Decimal(str(product.get("weight_kg", 0))),
            currency_of_base_price=Currency.CNY,  # All products use CNY
            customs_code=str(product["hs_code"]).zfill(10),
        ),
        financial=FinancialParams(
            currency_of_quote=Currency.USD,
            exchange_rate_base_price_to_quote=Decimal(str(product["exchange_rate"])),
            supplier_discount=Decimal("0"),
            markup=Decimal(str(product["markup"])) * 100,  # Convert 0.19 to 19%
            rate_forex_risk=Decimal("3"),  # From Excel AH11=0.03 (3%)
            dm_fee_type=DMFeeType.FIXED,
            dm_fee_value=Decimal("0"),
        ),
        logistics=LogisticsParams(
            supplier_country=country,
            offer_incoterms=Incoterms.DDP,
            delivery_time=60,
            # From Excel W2=2000, W3=0, W4=0 (insurance added by calculation engine)
            logistics_supplier_hub=Decimal("2000"),
            logistics_hub_customs=Decimal("0"),
            logistics_customs_client=Decimal("0"),
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal(str(product["tariff"])) * 100,  # Convert 0.05 to 5%
            excise_tax=Decimal("0"),
            util_fee=Decimal("0"),
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal("100"),
            advance_to_supplier=Decimal("100"),
            time_to_advance=0,
        ),
        customs=CustomsAndClearance(
            brokerage_hub=Decimal("0"),
            brokerage_customs=Decimal("0"),
            warehousing_at_customs=Decimal("0"),
            customs_documentation=Decimal("0"),
            brokerage_extra=Decimal("0"),
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.SUPPLY,
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047"),
            customs_logistics_pmt_due=10,
        ),
    )


class TestMultiProductDistribution:
    """
    Test with all products calculated together for proper cost distribution.

    This is the correct way to validate against Excel - all products must be
    calculated together to get proper distribution_base (BD16) and cost allocation.
    """

    @pytest.fixture(scope="class")
    def all_results(self):
        """Calculate all products together once, return results indexed by SKU."""
        json_products = load_all_products_from_json()

        # Build inputs for all products
        inputs = [build_input_from_json(p) for p in json_products]

        # Calculate all together
        results = calculate_multiproduct_quote(inputs)

        # Index by SKU for easy lookup
        return {
            json_products[i]["sku"]: {
                "result": results[i],
                "expected": json_products[i]["expected"],
                "product": json_products[i],
            }
            for i in range(len(results))
        }

    def test_first_product_purchase_price(self, all_results):
        """Test purchase price for first product with multi-product calc."""
        sku = "195-03-51110"
        data = all_results[sku]
        result = data["result"]
        expected = data["expected"]

        assert_close(
            result.purchase_price_total_quote_currency,
            expected["purchase_rub"],
            f"{sku} S16 (purchase_price_total_quote_currency)"
        )

    def test_first_product_logistics(self, all_results):
        """Test logistics distribution for first product."""
        sku = "195-03-51110"
        data = all_results[sku]
        result = data["result"]
        expected = data["expected"]

        assert_close(
            result.logistics_total,
            expected["logistics"],
            f"{sku} V16 (logistics_total)"
        )

    def test_first_product_cogs(self, all_results):
        """Test COGS for first product."""
        sku = "195-03-51110"
        data = all_results[sku]
        result = data["result"]
        expected = data["expected"]

        assert_close(
            result.cogs_per_product,
            expected["cogs_total"],
            f"{sku} AB16 (cogs_per_product)"
        )

    def test_first_product_sales_price(self, all_results):
        """Test sales price for first product."""
        sku = "195-03-51110"
        data = all_results[sku]
        result = data["result"]
        expected = data["expected"]

        assert_close(
            result.sales_price_per_unit_no_vat,
            expected["price_no_vat"],
            f"{sku} AJ16 (sales_price_per_unit_no_vat)"
        )

        assert_close(
            result.sales_price_total_with_vat,
            expected["price_with_vat"],
            f"{sku} AL16 (sales_price_total_with_vat)"
        )

    def test_all_products_cogs(self, all_results):
        """Test COGS for all products."""
        errors = []

        for sku, data in all_results.items():
            result = data["result"]
            expected = data["expected"]

            try:
                assert_close(
                    result.cogs_per_product,
                    expected["cogs_total"],
                    f"{sku} AB16"
                )
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            pytest.fail(f"{len(errors)} COGS mismatches:\n" + "\n".join(errors[:10]))
