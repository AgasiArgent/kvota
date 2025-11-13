from enum import Enum
from decimal import Decimal
from dataclasses import dataclass
from typing import List, Dict
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
import calculation_engine
from calculation_models import (
    QuoteCalculationInput, ProductInfo, FinancialParams,
    LogisticsParams, TaxesAndDuties, PaymentTerms,
    CustomsAndClearance, CompanySettings, SystemConfig,
    Currency, Incoterms, SupplierCountry, DMFeeType, SellerCompany, OfferSaleType
)

class ValidationMode(Enum):
    """Validation comparison modes"""
    SUMMARY = "summary"
    DETAILED = "detailed"

# Field definitions (Excel cell codes → description)
# Quote-level fields from row 13 (5 key fields)
SUMMARY_FIELDS = {
    "AK13": "Цена",                    # Final Price Total without VAT (quote-level)
    "AL13": "Цена с НДС",              # Final Price Total with VAT (quote-level)
    "AB13": "Себестоимость (COGS)",    # Cost of Goods Sold (quote-level)
    "V13": "Логистика",                # Total Logistics (quote-level)
    "Y13": "Пошлина",                  # Customs Duty (quote-level)
}

# Mapping from Excel cell codes to QuoteCalculationSummary field names (quote-level)
EXCEL_TO_QUOTE_SUMMARY_MAP = {
    "AK13": "total_revenue_no_vat",           # Final price without VAT
    "AL13": "total_revenue_with_vat",         # Final price with VAT (AL13, not AM13!)
    "AB13": "total_cogs",                     # Total Cost of Goods Sold
    "V13": "total_logistics",                 # Total logistics costs
    "Y13": "total_customs_duty",              # Total customs duty
}

# Product-level mapping (for detailed validation if needed later)
EXCEL_TO_PRODUCT_FIELD_MAP = {
    "AK16": "sales_price_total_no_vat",       # Final price without VAT
    "AM16": "sales_price_per_unit_with_vat",  # Price per unit with VAT
    "AB16": "cogs_per_product",               # Cost of Goods Sold
    "V16": "logistics_total",                 # Total logistics costs
    "Y16": "customs_duty",                    # Customs duty
    "AQ16": "transit_commission",             # Transit commission
}

DETAILED_FIELDS = {
    "M16": "Base price without VAT",
    "S16": "Purchase price in quote currency",
    "T16": "Logistics supplier-hub",
    "V16": "Total logistics",
    "Y16": "Customs duty",
    "AB16": "COGS",
    "AK16": "Final price total",
    "AM16": "Price with VAT (per unit)",
    "AQ16": "Transit Commission",
}

@dataclass
class FieldComparison:
    """Single field comparison result"""
    field: str
    field_name: str
    our_value: Decimal
    excel_value: Decimal
    difference: Decimal
    passed: bool
    phase: str

@dataclass
class ProductComparison:
    """Product-level comparison result"""
    product_index: int
    passed: bool
    max_deviation: Decimal
    field_comparisons: List[FieldComparison]

@dataclass
class ValidationResult:
    """Complete validation result"""
    mode: ValidationMode
    passed: bool
    comparisons: List[ProductComparison]
    max_deviation: Decimal
    failed_fields: List[str]
    excel_file: str
    total_products: int
    fields_checked: int

class CalculatorValidator:
    """Compare Excel results with calculation engine"""

    def __init__(
        self,
        tolerance_percent: Decimal = Decimal("0.01"),  # Tolerance in percent (default 0.01%)
        mode: ValidationMode = ValidationMode.SUMMARY
    ):
        self.tolerance_percent = tolerance_percent
        self.mode = mode

    def validate_quote(self, excel_data) -> ValidationResult:
        """Run calculation and compare with Excel (both quote-level and products)"""

        # Map Excel data to QuoteCalculationInput models
        quote_vars = excel_data.inputs["quote"]
        products_list = []

        for product_dict in excel_data.inputs["products"]:
            # Map to QuoteCalculationInput
            calc_input = self._map_to_calculation_input(product_dict, quote_vars)
            products_list.append(calc_input)

        # Run through calculation engine
        our_results = calculation_engine.calculate_multiproduct_quote(products_list)

        # ===== QUOTE-LEVEL COMPARISON (row 13) =====
        # Calculate quote-level sums from our results
        our_quote_totals = {
            "total_revenue_no_vat": sum(p.sales_price_total_no_vat for p in our_results),
            "total_revenue_with_vat": sum(p.sales_price_total_with_vat for p in our_results),
            "total_cogs": sum(p.cogs_per_product for p in our_results),
            "total_logistics": sum(p.logistics_total for p in our_results),
            "total_customs_duty": sum(p.customs_fee for p in our_results),  # Fixed: customs_fee, not customs_duty
        }

        # Get Excel quote-level values (row 13)
        excel_quote_level = excel_data.expected_results.get("quote_level", {})

        # Compare quote-level fields
        quote_field_comparisons = []
        for field_code, field_name in SUMMARY_FIELDS.items():
            # Map Excel cell code to our summary field name
            our_field = EXCEL_TO_QUOTE_SUMMARY_MAP.get(field_code, field_code)
            our_value = Decimal(str(our_quote_totals.get(our_field, 0)))

            # Get value from Excel row 13 (handle None values)
            excel_raw = excel_quote_level.get(field_code, 0)
            excel_value = Decimal(str(excel_raw if excel_raw is not None else 0))
            diff = abs(our_value - excel_value)

            # Calculate percent deviation
            if excel_value != 0:
                deviation_percent = (diff / abs(excel_value)) * 100
                passed = deviation_percent <= self.tolerance_percent
            else:
                passed = diff <= Decimal("0.01")

            quote_field_comparisons.append(FieldComparison(
                field=field_code,
                field_name=field_name,
                our_value=our_value,
                excel_value=excel_value,
                difference=diff,
                passed=passed,
                phase="Quote-level"
            ))

        # ===== PRODUCT-LEVEL COMPARISON (rows 16+) =====
        product_comparisons = []
        # For products, always use basic product fields (not quote-level row 13 fields)
        product_fields = {
            "AK16": "Цена",
            "AM16": "Цена с НДС",
            "AB16": "Себестоимость"
        }

        for i, (our_product, excel_product) in enumerate(
            zip(our_results, excel_data.expected_results.get("products", []))
        ):
            comparison = self._compare_product(
                our_product,
                excel_product,
                product_fields,
                i
            )
            product_comparisons.append(comparison)

        # ===== COMBINED RESULT =====
        # Quote-level comparison as first item (index 0)
        quote_level_comparison = ProductComparison(
            product_index=0,
            passed=all(fc.passed for fc in quote_field_comparisons),
            max_deviation=max(fc.difference for fc in quote_field_comparisons) if quote_field_comparisons else Decimal("0"),
            field_comparisons=quote_field_comparisons
        )

        # Combine: quote-level first, then products
        all_comparisons = [quote_level_comparison] + product_comparisons

        # Overall stats
        all_passed = all(c.passed for c in all_comparisons)
        max_dev = max(c.max_deviation for c in all_comparisons) if all_comparisons else Decimal("0")
        failed_fields = list(set(fc.field for c in all_comparisons for fc in c.field_comparisons if not fc.passed))

        return ValidationResult(
            mode=self.mode,
            passed=all_passed,
            comparisons=all_comparisons,  # Quote-level + all products
            max_deviation=max_dev,
            failed_fields=failed_fields,
            excel_file=excel_data.filename,
            total_products=len(products_list),
            fields_checked=len(SUMMARY_FIELDS)  # Fixed: use SUMMARY_FIELDS
        )

    def _compare_product(
        self,
        our,  # ProductCalculationResult (Pydantic model)
        excel: Dict,
        fields_to_check: Dict,
        product_index: int
    ) -> ProductComparison:
        """Compare one product"""
        field_comparisons = []

        for field_code, field_name in fields_to_check.items():
            # Map Excel cell code to model field name
            model_field = EXCEL_TO_PRODUCT_FIELD_MAP.get(field_code, field_code)

            # Get value from Pydantic model using mapped field name
            our_value = Decimal(str(getattr(our, model_field, 0)))

            # Get value from Excel dict
            excel_value = Decimal(str(excel.get(field_code, 0)))
            diff = abs(our_value - excel_value)

            # Calculate percent deviation
            if excel_value != 0:
                deviation_percent = (diff / abs(excel_value)) * 100
                passed = deviation_percent <= self.tolerance_percent
            else:
                # If excel value is 0, check if our value is also 0 or very small
                passed = diff <= Decimal("0.01")

            field_comparisons.append(FieldComparison(
                field=field_code,
                field_name=field_name,
                our_value=our_value,
                excel_value=excel_value,
                difference=diff,
                passed=passed,
                phase=self._get_phase_name(field_code)
            ))

        all_passed = all(fc.passed for fc in field_comparisons)
        max_dev = max(fc.difference for fc in field_comparisons)

        return ProductComparison(
            product_index=product_index,
            passed=all_passed,
            max_deviation=max_dev,
            field_comparisons=field_comparisons
        )

    def _get_phase_name(self, field_code: str) -> str:
        """Map field to phase"""
        phase_map = {
            "M16": "Phase 1: Currency",
            "S16": "Phase 1: Currency",
            "T16": "Phase 3: Logistics",
            "V16": "Phase 3: Logistics",
            "Y16": "Phase 4: Customs",
            "AB16": "Phase 9: COGS",
            "AK16": "Phase 11: Sales Price",
            "AM16": "Phase 12: VAT",
            "AQ16": "Phase 13: Profit",
        }
        return phase_map.get(field_code, "Unknown Phase")

    def _get_failed_fields(self, comparisons: List[ProductComparison]) -> List[str]:
        """Get list of failed field codes"""
        failed = set()
        for comp in comparisons:
            for fc in comp.field_comparisons:
                if not fc.passed:
                    failed.add(fc.field)
        return list(failed)

    def _map_to_calculation_input(self, product: Dict, quote_vars: Dict) -> QuoteCalculationInput:
        """Map Excel data to QuoteCalculationInput Pydantic model"""

        # Translation maps for enums
        COUNTRY_MAP = {
            "China": "Китай",
            "Turkey": "Турция",
            "Russia": "Россия",
            "Lithuania": "Литва",
            "Latvia": "Латвия",
            "Bulgaria": "Болгария",
            "Poland": "Польша"
        }

        DM_FEE_TYPE_MAP = {
            "Фикс": "fixed",
            "фикс": "fixed",
            "Процент": "percent",
            "процент": "percent",
            "fixed": "fixed",
            "percent": "percent",
            "none": "none",
            None: "none"
        }

        # Helper to get value with fallback
        def get_value(key: str, default=None):
            return product.get(key) or quote_vars.get(key) or default

        # Convert to Decimal safely
        def to_decimal(val, default=Decimal("0")):
            if val is None:
                return default
            try:
                return Decimal(str(val))
            except:
                return default

        # Translate country name
        def translate_country(country: str) -> str:
            return COUNTRY_MAP.get(country, country)

        # Translate DM fee type from Russian
        def translate_dm_fee_type(fee_type) -> str:
            return DM_FEE_TYPE_MAP.get(fee_type, "none")

        # ProductInfo
        customs_code_raw = str(get_value("customs_code", "0000000000")).replace(".", "")
        customs_code_padded = customs_code_raw.ljust(10, "0")  # Pad to 10 digits

        product_info = ProductInfo(
            base_price_VAT=to_decimal(product.get("base_price_VAT"), Decimal("0")),
            quantity=int(product.get("quantity", 1)),
            weight_in_kg=to_decimal(product.get("weight_in_kg"), Decimal("0")),
            currency_of_base_price=Currency(get_value("currency_of_base_price", "USD")),
            customs_code=customs_code_padded
        )

        # FinancialParams
        # Note: Excel stores markup as decimal (0.19 = 19%), calculation engine expects percentage (19)
        markup_raw = get_value("markup")
        markup_percent = to_decimal(markup_raw, Decimal("0.15")) * Decimal("100") if markup_raw else Decimal("15")

        # Note: Excel stores rate_forex_risk as decimal (0.03 = 3%), calculation engine expects percentage (3)
        forex_risk_raw = quote_vars.get("rate_forex_risk")
        forex_risk_percent = to_decimal(forex_risk_raw, Decimal("0.03")) * Decimal("100") if forex_risk_raw else Decimal("3")

        financial = FinancialParams(
            currency_of_quote=Currency(quote_vars.get("currency_of_quote", "RUB")),
            exchange_rate_base_price_to_quote=to_decimal(get_value("exchange_rate_base_price_to_quote"), Decimal("1")),
            supplier_discount=to_decimal(get_value("supplier_discount"), Decimal("0")),
            markup=markup_percent,
            rate_forex_risk=forex_risk_percent,
            dm_fee_type=DMFeeType(translate_dm_fee_type(quote_vars.get("dm_fee_type"))),
            dm_fee_value=to_decimal(get_value("dm_fee_value"), Decimal("0"))
        )

        # LogisticsParams
        country_raw = get_value("supplier_country", "Турция")
        country_translated = translate_country(country_raw)

        logistics = LogisticsParams(
            supplier_country=SupplierCountry(country_translated),
            offer_incoterms=Incoterms(quote_vars.get("offer_incoterms", "DDP")),
            delivery_time=int(quote_vars.get("delivery_time", 60)),
            logistics_supplier_hub=to_decimal(quote_vars.get("logistics_supplier_hub"), Decimal("0")),
            logistics_hub_customs=to_decimal(quote_vars.get("logistics_hub_customs"), Decimal("0")),
            logistics_customs_client=to_decimal(quote_vars.get("logistics_customs_client"), Decimal("0"))
        )

        # TaxesAndDuties
        # Note: Excel stores import_tariff as decimal (0.05 = 5%), engine expects percentage (5)
        import_tariff_raw = get_value("import_tariff")
        import_tariff_pct = to_decimal(import_tariff_raw, Decimal("0")) * Decimal("100") if import_tariff_raw and import_tariff_raw < 1 else to_decimal(import_tariff_raw, Decimal("0"))

        taxes = TaxesAndDuties(
            import_tariff=import_tariff_pct,
            excise_tax=to_decimal(get_value("excise_tax"), Decimal("0")),
            util_fee=to_decimal(get_value("util_fee"), Decimal("0"))
        )

        # PaymentTerms
        # Note: Excel stores advances as decimals (1 = 100%), convert to percentage
        advance_from_client_raw = quote_vars.get("advance_from_client", 1)
        advance_from_client_pct = to_decimal(advance_from_client_raw, Decimal("1")) * Decimal("100")

        advance_to_supplier_raw = quote_vars.get("advance_to_supplier", 1)
        advance_to_supplier_pct = to_decimal(advance_to_supplier_raw, Decimal("1")) * Decimal("100")

        payment = PaymentTerms(
            advance_from_client=advance_from_client_pct,
            advance_to_supplier=advance_to_supplier_pct,
            time_to_advance=int(get_value("time_to_advance", 0))
        )

        # CustomsAndClearance
        customs = CustomsAndClearance(
            brokerage_hub=to_decimal(quote_vars.get("brokerage_hub"), Decimal("0")),
            brokerage_customs=to_decimal(quote_vars.get("brokerage_customs"), Decimal("0")),
            warehousing_at_customs=to_decimal(get_value("warehousing_at_customs"), Decimal("0")),
            customs_documentation=to_decimal(get_value("customs_documentation"), Decimal("0")),
            brokerage_extra=to_decimal(get_value("brokerage_extra"), Decimal("0"))
        )

        # CompanySettings
        # For validation, use default company if Excel has unknown value
        seller_company_raw = quote_vars.get("seller_company", "МАСТЕР БЭРИНГ ООО")
        try:
            seller_company = SellerCompany(seller_company_raw)
        except ValueError:
            # Unknown company in Excel, use default for validation
            seller_company = SellerCompany.MASTER_BEARING_RU

        # Same for sale type
        sale_type_raw = quote_vars.get("offer_sale_type", "поставка")
        try:
            sale_type = OfferSaleType(sale_type_raw.lower() if sale_type_raw else "поставка")
        except ValueError:
            # Use default if unknown
            sale_type = OfferSaleType.SUPPLY

        company = CompanySettings(
            seller_company=seller_company,
            offer_sale_type=sale_type
        )

        # SystemConfig (admin settings)
        # Note: rate_fin_comm not in BJ11, it's on separate sheet in Excel (default: 2%)
        # For validation, use current default rate
        fin_comm_pct = Decimal("2")

        # Note: rate_loan_interest_daily is on separate sheet (helpsheet) in Excel
        # Hardcoded: 25% annual / 365 days = 0.0685% daily
        loan_rate_daily = Decimal("25") / Decimal("365") / Decimal("100")  # 0.000684931506849315

        system = SystemConfig(
            rate_fin_comm=fin_comm_pct,
            rate_loan_interest_daily=loan_rate_daily,
            rate_insurance=Decimal("0.00047"),
            customs_logistics_pmt_due=10
        )

        return QuoteCalculationInput(
            product=product_info,
            financial=financial,
            logistics=logistics,
            taxes=taxes,
            payment=payment,
            customs=customs,
            company=company,
            system=system
        )
