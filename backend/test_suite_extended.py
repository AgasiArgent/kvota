"""
B2B Quotation Calculator - Extended Test Suite
Tests for China, EU, UAE, and Russia suppliers

Tests 11-20: Supplier country variations
"""

from decimal import Decimal
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
    DMFeeType
)
from calculation_engine import calculate_single_product_quote


def print_test_header(test_num, description):
    """Print test header"""
    print("\n" + "=" * 120)
    print(f"TEST {test_num}: {description}".center(120))
    print("=" * 120)


def print_key_results(result, test_name, special_checks=None):
    """Print key results for Excel comparison"""
    print(f"\n{test_name} - KEY RESULTS FOR EXCEL COMPARISON")
    print("-" * 100)
    print(f"{'Cell':<10} {'Description':<40} {'Python Value':>20}")
    print("-" * 100)

    # Phase 1: Purchase Price
    print(f"{'S16':<10} {'Total purchase price':<40} {result.purchase_price_total_quote_currency:>20,.2f}")

    # Phase 3: Logistics
    print(f"{'T16':<10} {'Logistics first leg':<40} {result.logistics_first_leg:>20,.2f}")
    print(f"{'U16':<10} {'Logistics last leg':<40} {result.logistics_last_leg:>20,.2f}")
    print(f"{'V16':<10} {'Total logistics':<40} {result.logistics_total:>20,.2f}")

    # Phase 4: Customs & Internal Pricing
    print(f"{'Y16':<10} {'Customs fee':<40} {result.customs_fee:>20,.2f}")
    print(f"{'AY16':<10} {'Internal sale price total':<40} {result.internal_sale_price_total:>20,.2f}")

    # Phase 5-8: Financing
    print(f"{'BH6':<10} {'Supplier payment needed':<40} {result.quote_level_supplier_payment:>20,.2f}")
    print(f"{'BH4':<10} {'Total before forwarding':<40} {result.quote_level_total_before_forwarding:>20,.2f}")
    print(f"{'BJ11':<10} {'Total financing cost':<40} {result.quote_level_total_financing_cost:>20,.2f}")
    print(f"{'BL5':<10} {'Credit sales interest':<40} {result.quote_level_credit_sales_interest:>20,.2f}")

    # Phase 9: Distributed Financing
    print(f"{'BA16':<10} {'Initial financing per product':<40} {result.financing_cost_initial:>20,.2f}")
    print(f"{'BB16':<10} {'Credit interest per product':<40} {result.financing_cost_credit:>20,.2f}")

    # Phase 10: COGS
    print(f"{'AB16':<10} {'COGS per product':<40} {result.cogs_per_product:>20,.2f}")
    print(f"{'AA16':<10} {'COGS per unit':<40} {result.cogs_per_unit:>20,.2f}")

    # Phase 11: Profit & Sales Price
    print(f"{'AF16':<10} {'Profit':<40} {result.profit:>20,.2f}")
    print(f"{'AG16':<10} {'DM fee':<40} {result.dm_fee:>20,.2f}")
    print(f"{'AD16':<10} {'Sale price/unit (excl financial)':<40} {result.sale_price_per_unit_excl_financial:>20,.2f}")
    print(f"{'AJ16':<10} {'Sales price per unit (no VAT)':<40} {result.sales_price_per_unit_no_vat:>20,.2f}")
    print(f"{'AK16':<10} {'Sales price total (no VAT)':<40} {result.sales_price_total_no_vat:>20,.2f}")

    # Phase 12: Final Price
    print(f"{'AL16':<10} {'FINAL PRICE (with VAT)':<40} {result.sales_price_total_with_vat:>20,.2f}")
    print(f"{'AP16':<10} {'Net VAT payable':<40} {result.vat_net_payable:>20,.2f}")

    # Phase 13: Transit
    print(f"{'AQ16':<10} {'Transit commission':<40} {result.transit_commission:>20,.2f}")

    print("-" * 100)

    # Print special checks if provided
    if special_checks:
        print(f"\n{special_checks}")

    print()


# ============================================================================
# TEST 11: China Supplier - SUPPLY from RU
# ============================================================================

def test_11_china_supply_ru():
    """
    TEST 11: SUPPLY RU→China DDP 50% advance (FIXED DM fee)

    Key differences from Turkey (Test 1):
    - Supplier country: Китай (China)
    - VAT: 13% (vs 20% Turkey)
    - Internal markup: 10% (same as Turkey)
    - Expected: Different purchase price due to VAT difference
    """
    print_test_header(11, "SUPPLY RU→China DDP 50% advance (FIXED DM fee)")

    test_input = QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("1200.00"),
            quantity=10,
            weight_in_kg=Decimal("25.0"),
            currency_of_base_price=Currency.USD,
            customs_code="8708913509"
        ),
        financial=FinancialParams(
            currency_of_quote=Currency.RUB,
            exchange_rate_base_price_to_quote=Decimal("0.0105"),
            supplier_discount=Decimal("10"),
            markup=Decimal("15"),
            rate_forex_risk=Decimal("3"),
            dm_fee_type=DMFeeType.FIXED,
            dm_fee_value=Decimal("1000")
        ),
        logistics=LogisticsParams(
            supplier_country=SupplierCountry.CHINA,  # CHINA
            offer_incoterms=Incoterms.DDP,
            delivery_time=30,
            logistics_supplier_hub=Decimal("1500.00"),
            logistics_hub_customs=Decimal("800.00"),
            logistics_customs_client=Decimal("500.00")
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal("5"),
            excise_tax=Decimal("0"),
            util_fee=Decimal("0")
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal("50"),
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_customs=Decimal("500.00"),
            customs_documentation=Decimal("200.00"),
            brokerage_hub=Decimal("200.00"),
            warehousing_at_customs=Decimal("100.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)

    special_checks = """CHINA-SPECIFIC CHECKS:
  - Supplier VAT: 13% (vs 20% Turkey)
  - Internal markup: 10% (same as Turkey)
  - Purchase price (S16) should differ from Test 1 due to VAT
  - All other logic same as Test 1 (SUPPLY, 50% advance)"""

    print_key_results(result, "TEST 11", special_checks)
    return result


# ============================================================================
# TEST 12: China Supplier - TRANSIT from RU
# ============================================================================

def test_12_china_transit_ru():
    """
    TEST 12: TRANSIT RU→China DDP 50% advance (FIXED DM fee)

    Key differences from Test 2:
    - Supplier country: Китай (China)
    - VAT: 13%
    - Expected: Transit commission applies, different pricing
    """
    print_test_header(12, "TRANSIT RU→China DDP 50% advance (FIXED DM fee)")

    test_input = QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("1200.00"),
            quantity=10,
            weight_in_kg=Decimal("25.0"),
            currency_of_base_price=Currency.USD,
            customs_code="8708913509"
        ),
        financial=FinancialParams(
            currency_of_quote=Currency.RUB,
            exchange_rate_base_price_to_quote=Decimal("0.0105"),
            supplier_discount=Decimal("10"),
            markup=Decimal("15"),
            rate_forex_risk=Decimal("3"),
            dm_fee_type=DMFeeType.FIXED,
            dm_fee_value=Decimal("1000")
        ),
        logistics=LogisticsParams(
            supplier_country=SupplierCountry.CHINA,
            offer_incoterms=Incoterms.DDP,
            delivery_time=30,
            logistics_supplier_hub=Decimal("1500.00"),
            logistics_hub_customs=Decimal("800.00"),
            logistics_customs_client=Decimal("500.00")
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal("5"),
            excise_tax=Decimal("0"),
            util_fee=Decimal("0")
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal("50"),
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_customs=Decimal("500.00"),
            customs_documentation=Decimal("200.00"),
            brokerage_hub=Decimal("200.00"),
            warehousing_at_customs=Decimal("100.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.TRANSIT  # TRANSIT
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)

    special_checks = """CHINA TRANSIT-SPECIFIC CHECKS:
  - AQ16 (Transit commission) should be > 0
  - AD16 uses S16 (not AB16) for transit pricing
  - Profit (AF16) based on S16"""

    print_key_results(result, "TEST 12", special_checks)
    return result


# ============================================================================
# TEST 13: China Supplier - Turkish Seller
# ============================================================================

def test_13_china_turkish_seller():
    """
    TEST 13: SUPPLY TR→China DDP 50% advance (FIXED DM fee)

    Key differences:
    - Supplier: China
    - Seller: TEXCEL (Turkey)
    - Internal markup: 0% (TR seller)
    - No financial agent fee
    """
    print_test_header(13, "SUPPLY TR→China DDP 50% advance (FIXED DM fee)")

    test_input = QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("1200.00"),
            quantity=10,
            weight_in_kg=Decimal("25.0"),
            currency_of_base_price=Currency.USD,
            customs_code="8708913509"
        ),
        financial=FinancialParams(
            currency_of_quote=Currency.RUB,
            exchange_rate_base_price_to_quote=Decimal("0.0105"),
            supplier_discount=Decimal("10"),
            markup=Decimal("15"),
            rate_forex_risk=Decimal("3"),
            dm_fee_type=DMFeeType.FIXED,
            dm_fee_value=Decimal("1000")
        ),
        logistics=LogisticsParams(
            supplier_country=SupplierCountry.CHINA,
            offer_incoterms=Incoterms.DDP,
            delivery_time=30,
            logistics_supplier_hub=Decimal("1500.00"),
            logistics_hub_customs=Decimal("800.00"),
            logistics_customs_client=Decimal("500.00")
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal("5"),
            excise_tax=Decimal("0"),
            util_fee=Decimal("0")
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal("50"),
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_customs=Decimal("500.00"),
            customs_documentation=Decimal("200.00"),
            brokerage_hub=Decimal("200.00"),
            warehousing_at_customs=Decimal("100.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.TEXCEL_TR,  # TURKISH SELLER
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)

    special_checks = """TURKISH SELLER + CHINA CHECKS:
  - AI16 (Financial agent fee) should be 0
  - Internal markup (AW16) = 0% (TR seller)
  - Lower COGS vs Test 11 (no internal markup)"""

    print_key_results(result, "TEST 13", special_checks)
    return result


# ============================================================================
# TEST 14: Lithuania Supplier - SUPPLY from RU
# ============================================================================

def test_14_lithuania_supply_ru():
    """
    TEST 14: SUPPLY RU→Lithuania DDP 50% advance (FIXED DM fee)

    Key differences:
    - Supplier: Lithuania (EU)
    - VAT: 21%
    - Internal markup: 13% (much higher than Turkey/China!)
    - Expected: Significantly higher costs
    """
    print_test_header(14, "SUPPLY RU→Lithuania DDP 50% advance (FIXED DM fee)")

    test_input = QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("1200.00"),
            quantity=10,
            weight_in_kg=Decimal("25.0"),
            currency_of_base_price=Currency.EUR,  # EUR for EU
            customs_code="8708913509"
        ),
        financial=FinancialParams(
            currency_of_quote=Currency.RUB,
            exchange_rate_base_price_to_quote=Decimal("0.0095"),  # EUR rate
            supplier_discount=Decimal("10"),
            markup=Decimal("15"),
            rate_forex_risk=Decimal("3"),
            dm_fee_type=DMFeeType.FIXED,
            dm_fee_value=Decimal("1000")
        ),
        logistics=LogisticsParams(
            supplier_country=SupplierCountry.LITHUANIA,  # LITHUANIA
            offer_incoterms=Incoterms.DDP,
            delivery_time=30,
            logistics_supplier_hub=Decimal("1500.00"),
            logistics_hub_customs=Decimal("800.00"),
            logistics_customs_client=Decimal("500.00")
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal("5"),
            excise_tax=Decimal("0"),
            util_fee=Decimal("0")
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal("50"),
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_customs=Decimal("500.00"),
            customs_documentation=Decimal("200.00"),
            brokerage_hub=Decimal("200.00"),
            warehousing_at_customs=Decimal("100.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)

    special_checks = """LITHUANIA (EU) SPECIFIC CHECKS:
  - Supplier VAT: 21% (vs 20% Turkey, 13% China)
  - Internal markup: 13% (vs 10% Turkey/China) - MUCH HIGHER!
  - Expected: Significantly higher internal sale price (AY16)
  - Higher COGS and final price vs Test 1 and Test 11"""

    print_key_results(result, "TEST 14", special_checks)
    return result


# ============================================================================
# TEST 15: Lithuania Supplier - Turkish Seller
# ============================================================================

def test_15_lithuania_turkish_seller():
    """
    TEST 15: SUPPLY TR→Lithuania DDP 50% advance (FIXED DM fee)

    Key differences:
    - Supplier: Lithuania
    - Seller: TEXCEL (Turkey)
    - Internal markup: 3% (vs 13% for RU seller)
    - No financial agent fee
    """
    print_test_header(15, "SUPPLY TR→Lithuania DDP 50% advance (FIXED DM fee)")

    test_input = QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("1200.00"),
            quantity=10,
            weight_in_kg=Decimal("25.0"),
            currency_of_base_price=Currency.EUR,
            customs_code="8708913509"
        ),
        financial=FinancialParams(
            currency_of_quote=Currency.RUB,
            exchange_rate_base_price_to_quote=Decimal("0.0095"),
            supplier_discount=Decimal("10"),
            markup=Decimal("15"),
            rate_forex_risk=Decimal("3"),
            dm_fee_type=DMFeeType.FIXED,
            dm_fee_value=Decimal("1000")
        ),
        logistics=LogisticsParams(
            supplier_country=SupplierCountry.LITHUANIA,
            offer_incoterms=Incoterms.DDP,
            delivery_time=30,
            logistics_supplier_hub=Decimal("1500.00"),
            logistics_hub_customs=Decimal("800.00"),
            logistics_customs_client=Decimal("500.00")
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal("5"),
            excise_tax=Decimal("0"),
            util_fee=Decimal("0")
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal("50"),
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_customs=Decimal("500.00"),
            customs_documentation=Decimal("200.00"),
            brokerage_hub=Decimal("200.00"),
            warehousing_at_customs=Decimal("100.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.TEXCEL_TR,  # TURKISH SELLER
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)

    special_checks = """TURKISH SELLER + LITHUANIA CHECKS:
  - AI16 (Financial agent fee) should be 0
  - Internal markup (AW16) = 3% (vs 13% for RU seller)
  - Much lower COGS vs Test 14 (10% markup difference)
  - Compare: Test 14 vs Test 15 shows seller impact"""

    print_key_results(result, "TEST 15", special_checks)
    return result


# ============================================================================
# Run All Extended Tests
# ============================================================================

def run_all_extended_tests():
    """Run all extended tests (11-15)"""
    print("\n" + "=" * 120)
    print("B2B QUOTATION CALCULATOR - EXTENDED TEST SUITE".center(120))
    print("Tests 11-15: China and EU Supplier Scenarios".center(120))
    print("=" * 120)

    tests = [
        test_11_china_supply_ru,
        test_12_china_transit_ru,
        test_13_china_turkish_seller,
        test_14_lithuania_supply_ru,
        test_15_lithuania_turkish_seller,
    ]

    results = []
    for test_func in tests:
        result = test_func()
        results.append(result)

    print("\n" + "=" * 120)
    print("✅ ALL EXTENDED TESTS COMPLETE".center(120))
    print("=" * 120)
    print("\nNext steps:")
    print("1. Compare Python values with Excel for each test")
    print("2. Pay special attention to:")
    print("   - Test 11 vs Test 1: China vs Turkey VAT impact")
    print("   - Test 14 vs Test 1: EU 13% internal markup impact")
    print("   - Test 14 vs Test 15: RU seller vs TR seller markup difference (13% vs 3%)")
    print()

    return results


if __name__ == "__main__":
    run_all_extended_tests()
