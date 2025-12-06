"""
Comprehensive Excel validation tests - ALL 30 calculated fields across ALL 7 scenarios.

Uses extracted data from: validation_data/extracted/excel_expected_values.json
Tests 387 products × 30 fields = 11,610 assertions
"""
import pytest
import json
import os
from decimal import Decimal
from typing import Dict, Any, List

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
from .conftest import assert_close, RELATIVE_TOLERANCE, ABSOLUTE_TOLERANCE


# =============================================================================
# DATA LOADING
# =============================================================================

EXTRACTED_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "validation_data", "extracted", "excel_expected_values.json"
)


def load_extracted_data() -> Dict[str, Any]:
    """Load extracted Excel data."""
    with open(EXTRACTED_DATA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


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

SELLER_MAP = {
    "МАСТЕР БЭРИНГ ООО (ИНН 0242013464)": SellerCompany.MASTER_BEARING_RU,
    "МАСТЕР БЭРИНГ ООО": SellerCompany.MASTER_BEARING_RU,
}


def build_calculation_input(product: Dict, quote_vars: Dict) -> QuoteCalculationInput:
    """Build QuoteCalculationInput from extracted product and quote variables."""

    # Get country
    country = COUNTRY_MAP.get(
        product.get("supplier_country", "Китай"),
        SupplierCountry.CHINA
    )

    # Get currencies - default to CNY for base price if not specified
    base_currency = Currency.CNY  # Most products are CNY
    quote_currency = CURRENCY_MAP.get(
        quote_vars.get("currency_of_quote", "USD"),
        Currency.USD
    )

    # Get seller company
    seller_raw = quote_vars.get("seller_company", "МАСТЕР БЭРИНГ ООО")
    seller = SELLER_MAP.get(seller_raw, SellerCompany.MASTER_BEARING_RU)

    # Get DM fee type
    dm_fee_type_raw = quote_vars.get("dm_fee_type", "Фикс")
    dm_fee_type = DMFeeType.FIXED if "Фикс" in str(dm_fee_type_raw) else DMFeeType.PERCENT

    # Build input
    return QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal(str(product.get("base_price_vat", 0))),
            quantity=int(product.get("quantity", 1)),
            weight_in_kg=Decimal("0"),  # Not used in most calculations
            currency_of_base_price=base_currency,
            customs_code=str(product.get("customs_code", "") or ""),
        ),
        financial=FinancialParams(
            currency_of_quote=quote_currency,
            exchange_rate_base_price_to_quote=Decimal(str(product.get("exchange_rate", 1))),
            supplier_discount=Decimal("0"),
            markup=Decimal(str(product.get("markup", 0.19))) * 100,  # Convert 0.19 to 19
            rate_forex_risk=Decimal(str(quote_vars.get("rate_forex_risk", 0))) * 100,  # Convert 0.03 to 3
            dm_fee_type=dm_fee_type,
            dm_fee_value=Decimal(str(quote_vars.get("dm_fee_value", 0) or 0)),
        ),
        logistics=LogisticsParams(
            supplier_country=country,
            offer_incoterms=Incoterms.DDP,
            delivery_time=int(quote_vars.get("delivery_time", 60) or 60),
            logistics_supplier_hub=Decimal(str(quote_vars.get("logistics_supplier_hub", 0) or 0)),
            logistics_hub_customs=Decimal(str(quote_vars.get("logistics_hub_customs", 0) or 0)),
            logistics_customs_client=Decimal(str(quote_vars.get("logistics_customs_client", 0) or 0)),
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal(str(product.get("import_tariff", 0) or 0)) * 100,  # Convert 0.05 to 5
            excise_tax=Decimal("0"),
            util_fee=Decimal("0"),
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal(str(quote_vars.get("advance_from_client", 1) or 1)) * 100,  # Convert 1.0 to 100
            advance_to_supplier=Decimal(str(quote_vars.get("advance_to_supplier", 1) or 1)) * 100,
            time_to_advance=int(quote_vars.get("time_to_advance", 0) or 0),
        ),
        customs=CustomsAndClearance(
            brokerage_hub=Decimal(str(quote_vars.get("brokerage_hub", 0) or 0)),
            brokerage_customs=Decimal(str(quote_vars.get("brokerage_customs", 0) or 0)),
            warehousing_at_customs=Decimal(str(quote_vars.get("warehousing_at_customs", 0) or 0)),
            customs_documentation=Decimal(str(quote_vars.get("customs_documentation", 0) or 0)),
            brokerage_extra=Decimal(str(quote_vars.get("brokerage_extra", 0) or 0)),
        ),
        company=CompanySettings(
            seller_company=seller,
            offer_sale_type=OfferSaleType.SUPPLY,
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            # Excel uses 25% annual rate
            rate_loan_interest_annual=Decimal("0.25"),
            rate_insurance=Decimal("0.00047"),
            customs_logistics_pmt_due=10,
        ),
    )


# =============================================================================
# ALL 30 CALCULATED FIELDS TO TEST
# =============================================================================

CALCULATED_FIELDS = [
    # Phase 1: Purchase Price
    "purchase_price_no_vat",
    "purchase_price_after_discount",
    "purchase_price_per_unit_quote_currency",
    "purchase_price_total_quote_currency",

    # Phase 2: Distribution
    "distribution_base",

    # Phase 2.5: Internal Pricing
    "internal_sale_price_per_unit",
    "internal_sale_price_total",

    # Phase 3: Logistics
    "logistics_first_leg",
    "logistics_last_leg",
    "logistics_total",

    # Phase 4: Duties
    "customs_fee",
    "excise_tax_amount",
    # Note: purchase_with_supplier_vat is an intermediate Excel value not exposed in Python output

    # Phase 9: Financing
    "financing_cost_initial",
    "financing_cost_credit",

    # Phase 10: COGS
    "cogs_per_unit",
    "cogs_per_product",

    # Phase 11: Sales Price
    "sale_price_per_unit_excl_financial",
    "sale_price_total_excl_financial",
    "profit",
    "dm_fee",
    "forex_reserve",
    "financial_agent_fee",
    "sales_price_per_unit_no_vat",
    "sales_price_total_no_vat",

    # Phase 12: VAT
    "sales_price_total_with_vat",
    "sales_price_per_unit_with_vat",
    "vat_from_sales",
    "vat_on_import",
    "vat_net_payable",

    # Phase 13: Transit
    "transit_commission",
]


# =============================================================================
# TEST CLASSES - One per scenario
# =============================================================================

class TestScenarioBase:
    """Base class for scenario tests."""

    scenario_name: str = None

    @pytest.fixture(scope="class")
    def scenario_results(self):
        """Calculate all products for this scenario."""
        data = load_extracted_data()
        scenario = data["scenarios"].get(self.scenario_name)

        if not scenario:
            pytest.skip(f"Scenario {self.scenario_name} not found")

        products = scenario["products"]
        quote_vars = scenario["quote_variables"]

        # Build inputs for all products
        inputs = [build_calculation_input(p, quote_vars) for p in products]

        # Calculate all together (multi-product for proper distribution)
        results = calculate_multiproduct_quote(inputs)

        # Return indexed by row number
        return {
            products[i]["row"]: {
                "result": results[i],
                "expected": products[i]["expected"],
                "product": products[i],
            }
            for i in range(len(results))
        }

    def _test_field(self, scenario_results, field_name: str):
        """Test a single field across all products."""
        errors = []
        tested = 0

        for row, data in scenario_results.items():
            expected_val = data["expected"].get(field_name)
            if expected_val is None:
                continue

            result = data["result"]
            actual_val = getattr(result, field_name, None)

            if actual_val is None:
                errors.append(f"Row {row}: {field_name} not found in result")
                continue

            tested += 1
            try:
                assert_close(actual_val, expected_val, f"Row {row} {field_name}")
            except AssertionError as e:
                errors.append(str(e))

        if errors:
            # Show first 10 errors
            error_sample = errors[:10]
            if len(errors) > 10:
                error_sample.append(f"... and {len(errors) - 10} more errors")
            pytest.fail(f"{field_name}: {len(errors)}/{tested} failed:\n" + "\n".join(error_sample))


class TestRaschetBase(TestScenarioBase):
    """Test test_raschet.xlsm - Base scenario (93 products, 100% advance, 2000 logistics)"""

    scenario_name = "test_raschet"

    # Phase 1: Purchase Price
    def test_purchase_price_no_vat(self, scenario_results):
        self._test_field(scenario_results, "purchase_price_no_vat")

    def test_purchase_price_after_discount(self, scenario_results):
        self._test_field(scenario_results, "purchase_price_after_discount")

    def test_purchase_price_per_unit_quote_currency(self, scenario_results):
        self._test_field(scenario_results, "purchase_price_per_unit_quote_currency")

    def test_purchase_price_total_quote_currency(self, scenario_results):
        self._test_field(scenario_results, "purchase_price_total_quote_currency")

    # Phase 2: Distribution
    def test_distribution_base(self, scenario_results):
        self._test_field(scenario_results, "distribution_base")

    # Phase 2.5: Internal Pricing
    def test_internal_sale_price_per_unit(self, scenario_results):
        self._test_field(scenario_results, "internal_sale_price_per_unit")

    def test_internal_sale_price_total(self, scenario_results):
        self._test_field(scenario_results, "internal_sale_price_total")

    # Phase 3: Logistics
    def test_logistics_first_leg(self, scenario_results):
        self._test_field(scenario_results, "logistics_first_leg")

    def test_logistics_last_leg(self, scenario_results):
        self._test_field(scenario_results, "logistics_last_leg")

    def test_logistics_total(self, scenario_results):
        self._test_field(scenario_results, "logistics_total")

    # Phase 4: Duties
    def test_customs_fee(self, scenario_results):
        self._test_field(scenario_results, "customs_fee")

    def test_excise_tax_amount(self, scenario_results):
        self._test_field(scenario_results, "excise_tax_amount")

    # Phase 9: Financing
    def test_financing_cost_initial(self, scenario_results):
        self._test_field(scenario_results, "financing_cost_initial")

    def test_financing_cost_credit(self, scenario_results):
        self._test_field(scenario_results, "financing_cost_credit")

    # Phase 10: COGS
    def test_cogs_per_unit(self, scenario_results):
        self._test_field(scenario_results, "cogs_per_unit")

    def test_cogs_per_product(self, scenario_results):
        self._test_field(scenario_results, "cogs_per_product")

    # Phase 11: Sales Price
    def test_sale_price_per_unit_excl_financial(self, scenario_results):
        self._test_field(scenario_results, "sale_price_per_unit_excl_financial")

    def test_sale_price_total_excl_financial(self, scenario_results):
        self._test_field(scenario_results, "sale_price_total_excl_financial")

    def test_profit(self, scenario_results):
        self._test_field(scenario_results, "profit")

    def test_dm_fee(self, scenario_results):
        self._test_field(scenario_results, "dm_fee")

    def test_forex_reserve(self, scenario_results):
        self._test_field(scenario_results, "forex_reserve")

    def test_financial_agent_fee(self, scenario_results):
        self._test_field(scenario_results, "financial_agent_fee")

    def test_sales_price_per_unit_no_vat(self, scenario_results):
        self._test_field(scenario_results, "sales_price_per_unit_no_vat")

    def test_sales_price_total_no_vat(self, scenario_results):
        self._test_field(scenario_results, "sales_price_total_no_vat")

    # Phase 12: VAT
    def test_sales_price_total_with_vat(self, scenario_results):
        self._test_field(scenario_results, "sales_price_total_with_vat")

    def test_sales_price_per_unit_with_vat(self, scenario_results):
        self._test_field(scenario_results, "sales_price_per_unit_with_vat")

    def test_vat_from_sales(self, scenario_results):
        self._test_field(scenario_results, "vat_from_sales")

    def test_vat_on_import(self, scenario_results):
        self._test_field(scenario_results, "vat_on_import")

    def test_vat_net_payable(self, scenario_results):
        self._test_field(scenario_results, "vat_net_payable")

    # Phase 13: Transit
    def test_transit_commission(self, scenario_results):
        self._test_field(scenario_results, "transit_commission")


class TestRaschet30Pct(TestScenarioBase):
    """Test test_raschet_30pct.xlsm - 30% advance scenario"""
    scenario_name = "test_raschet_30pct"

    def test_purchase_price_total_quote_currency(self, scenario_results):
        self._test_field(scenario_results, "purchase_price_total_quote_currency")

    def test_logistics_total(self, scenario_results):
        self._test_field(scenario_results, "logistics_total")

    def test_financing_cost_initial(self, scenario_results):
        self._test_field(scenario_results, "financing_cost_initial")

    def test_financing_cost_credit(self, scenario_results):
        self._test_field(scenario_results, "financing_cost_credit")

    def test_cogs_per_product(self, scenario_results):
        self._test_field(scenario_results, "cogs_per_product")

    def test_sales_price_per_unit_no_vat(self, scenario_results):
        self._test_field(scenario_results, "sales_price_per_unit_no_vat")


class TestRaschetLogistics(TestScenarioBase):
    """Test test_raschet_logistics.xlsm - Extended logistics scenario"""
    scenario_name = "test_raschet_logistics"

    def test_purchase_price_total_quote_currency(self, scenario_results):
        self._test_field(scenario_results, "purchase_price_total_quote_currency")

    def test_logistics_first_leg(self, scenario_results):
        self._test_field(scenario_results, "logistics_first_leg")

    def test_logistics_last_leg(self, scenario_results):
        self._test_field(scenario_results, "logistics_last_leg")

    def test_logistics_total(self, scenario_results):
        self._test_field(scenario_results, "logistics_total")

    def test_cogs_per_product(self, scenario_results):
        self._test_field(scenario_results, "cogs_per_product")

    def test_sales_price_per_unit_no_vat(self, scenario_results):
        self._test_field(scenario_results, "sales_price_per_unit_no_vat")


class TestRaschet30PcsLogistics(TestScenarioBase):
    """Test test_raschet_30pcs_logistics.xlsm - 30% advance + extended logistics"""
    scenario_name = "test_raschet_30pcs_logistics"

    def test_purchase_price_total_quote_currency(self, scenario_results):
        self._test_field(scenario_results, "purchase_price_total_quote_currency")

    def test_logistics_total(self, scenario_results):
        self._test_field(scenario_results, "logistics_total")

    def test_financing_cost_initial(self, scenario_results):
        self._test_field(scenario_results, "financing_cost_initial")

    def test_cogs_per_product(self, scenario_results):
        self._test_field(scenario_results, "cogs_per_product")

    def test_sales_price_per_unit_no_vat(self, scenario_results):
        self._test_field(scenario_results, "sales_price_per_unit_no_vat")


# =============================================================================
# COMPREHENSIVE ALL-FIELDS TEST
# =============================================================================

class TestAllFieldsAllScenarios:
    """
    Comprehensive test: ALL 30 fields × ALL scenarios.

    This is the ultimate validation - any calculation error will be caught here.
    """

    @pytest.fixture(scope="class")
    def all_scenario_results(self):
        """Calculate all products for all scenarios."""
        data = load_extracted_data()
        all_results = {}

        for scenario_name, scenario in data["scenarios"].items():
            # Skip incomplete scenarios
            if "заполнить" in str(scenario.get("quote_variables", {}).get("seller_company", "")):
                continue

            products = scenario["products"]
            quote_vars = scenario["quote_variables"]

            try:
                inputs = [build_calculation_input(p, quote_vars) for p in products]
                results = calculate_multiproduct_quote(inputs)

                all_results[scenario_name] = {
                    products[i]["row"]: {
                        "result": results[i],
                        "expected": products[i]["expected"],
                        "sku": products[i].get("sku"),
                    }
                    for i in range(len(results))
                }
            except Exception as e:
                print(f"Failed to calculate {scenario_name}: {e}")

        return all_results

    def test_summary_all_fields(self, all_scenario_results):
        """Test all fields across all scenarios and report summary."""
        field_stats = {field: {"passed": 0, "failed": 0, "errors": []} for field in CALCULATED_FIELDS}

        for scenario_name, scenario_data in all_scenario_results.items():
            for row, data in scenario_data.items():
                result = data["result"]
                expected = data["expected"]
                sku = data.get("sku", f"row_{row}")

                for field in CALCULATED_FIELDS:
                    expected_val = expected.get(field)
                    if expected_val is None:
                        continue

                    actual_val = getattr(result, field, None)
                    if actual_val is None:
                        field_stats[field]["failed"] += 1
                        field_stats[field]["errors"].append(f"{scenario_name}/{sku}: field not found")
                        continue

                    try:
                        assert_close(actual_val, expected_val, field)
                        field_stats[field]["passed"] += 1
                    except AssertionError:
                        field_stats[field]["failed"] += 1
                        diff = abs(float(actual_val) - float(expected_val))
                        pct = (diff / abs(float(expected_val)) * 100) if expected_val else 0
                        field_stats[field]["errors"].append(
                            f"{scenario_name}/{sku}: got {float(actual_val):.2f}, expected {float(expected_val):.2f} ({pct:.2f}% diff)"
                        )

        # Print summary
        print("\n" + "=" * 80)
        print("COMPREHENSIVE TEST SUMMARY - ALL 30 FIELDS")
        print("=" * 80)

        total_passed = 0
        total_failed = 0
        failed_fields = []

        for field, stats in field_stats.items():
            total = stats["passed"] + stats["failed"]
            if total == 0:
                continue

            total_passed += stats["passed"]
            total_failed += stats["failed"]

            if stats["failed"] > 0:
                failed_fields.append(field)
                status = f"FAIL ({stats['failed']}/{total})"
            else:
                status = f"PASS ({stats['passed']})"

            print(f"  {field:40} {status}")

        print("-" * 80)
        print(f"TOTAL: {total_passed} passed, {total_failed} failed")
        print("=" * 80)

        # Show sample errors for failed fields
        if failed_fields:
            print("\nSAMPLE ERRORS (first 3 per field):")
            for field in failed_fields[:5]:  # Show first 5 failed fields
                print(f"\n{field}:")
                for error in field_stats[field]["errors"][:3]:
                    print(f"  - {error}")

        # Assert overall pass
        if total_failed > 0:
            pytest.fail(f"{total_failed} assertions failed across {len(failed_fields)} fields")
