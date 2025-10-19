"""
B2B Quotation Calculator - 10 Test Cases for Manual Excel Validation
Hybrid Approach: Phase 1 - Manual Validation

Run each test individually and compare results with Excel.
After validation, convert to automated pytest suite.
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


def print_key_results(result, test_name):
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

    # Phase 4: Duties
    print(f"{'Y16':<10} {'Customs fee':<40} {result.customs_fee:>20,.2f}")
    print(f"{'AY16':<10} {'Internal sale price total':<40} {result.internal_sale_price_total:>20,.2f}")

    # Phase 5-8: Financing (quote-level)
    if result.quote_level_supplier_payment:
        print(f"{'BH6':<10} {'Supplier payment needed':<40} {result.quote_level_supplier_payment:>20,.2f}")
        print(f"{'BH4':<10} {'Total before forwarding':<40} {result.quote_level_total_before_forwarding:>20,.2f}")
        print(f"{'BJ11':<10} {'Total financing cost':<40} {result.quote_level_total_financing_cost:>20,.2f}")
        print(f"{'BL5':<10} {'Credit sales interest':<40} {result.quote_level_credit_sales_interest:>20,.2f}")

    # Phase 9: Distributed financing
    print(f"{'BA16':<10} {'Initial financing per product':<40} {result.financing_cost_initial:>20,.2f}")
    print(f"{'BB16':<10} {'Credit interest per product':<40} {result.financing_cost_credit:>20,.2f}")

    # Phase 10: COGS
    print(f"{'AB16':<10} {'COGS per product':<40} {result.cogs_per_product:>20,.2f}")
    print(f"{'AA16':<10} {'COGS per unit':<40} {result.cogs_per_unit:>20,.2f}")

    # Phase 11: Pricing
    print(f"{'AF16':<10} {'Profit':<40} {result.profit:>20,.2f}")
    print(f"{'AG16':<10} {'DM fee':<40} {result.dm_fee:>20,.2f}")
    print(f"{'AD16':<10} {'Sale price/unit (excl financial)':<40} {result.sale_price_per_unit_excl_financial:>20,.2f}")
    print(f"{'AJ16':<10} {'Sales price per unit (no VAT)':<40} {result.sales_price_per_unit_no_vat:>20,.2f}")
    print(f"{'AK16':<10} {'Sales price total (no VAT)':<40} {result.sales_price_total_no_vat:>20,.2f}")

    # Phase 12: Final price with VAT
    print(f"{'AL16':<10} {'FINAL PRICE (with VAT)':<40} {result.sales_price_total_with_vat:>20,.2f}")
    print(f"{'AP16':<10} {'Net VAT payable':<40} {result.vat_net_payable:>20,.2f}")

    # Phase 13: Transit commission
    print(f"{'AQ16':<10} {'Transit commission':<40} {result.transit_commission:>20,.2f}")

    print("-" * 100)
    print()


# ============================================================================
# TEST 1: Baseline - SUPPLY, RU seller, Turkey supplier, DDP, 50% advance
# ============================================================================

def test_1_baseline():
    """
    TEST 1: Baseline SUPPLY RU->Turkey DDP 50% advance
    This is the current test - validates core calculation path
    """
    print_test_header(1, "Baseline SUPPLY RU->Turkey DDP 50% advance (FIXED DM fee)")

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
            supplier_country=SupplierCountry.TURKEY,
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
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
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
    print_key_results(result, "TEST 1")
    return result


# ============================================================================
# TEST 2: Transit scenario
# ============================================================================

def test_2_transit():
    """
    TEST 2: TRANSIT RU->Turkey DDP 50% advance
    Tests transit-specific formulas (AF16 uses S16, AQ16 calculated, AD16 uses S16)
    """
    print_test_header(2, "TRANSIT RU->Turkey DDP 50% advance (FIXED DM fee)")

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
            supplier_country=SupplierCountry.TURKEY,
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
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.TRANSIT  # ← CHANGE TO TRANSIT
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)
    print_key_results(result, "TEST 2")

    print("TRANSIT-SPECIFIC CHECKS:")
    print(f"  - AF16 (Profit) should be based on S16 (not AB16)")
    print(f"  - AD16 (Sale price excl financial) should use S16 (not AB16)")
    print(f"  - AQ16 (Transit commission) should be > 0: {result.transit_commission:,.2f}")
    print()

    return result


# ============================================================================
# TEST 3: Export scenario
# ============================================================================

def test_3_export():
    """
    TEST 3: EXPORT RU->Turkey DAP 100% advance
    Tests export-specific logic (AI16 = 0, no import VAT)
    """
    print_test_header(3, "EXPORT RU->Turkey DAP 100% advance (FIXED DM fee)")

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
            supplier_country=SupplierCountry.TURKEY,
            offer_incoterms=Incoterms.DAP,  # ← Non-DDP
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
            advance_from_client=Decimal("100"),  # ← Full advance
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.EXPORT  # ← EXPORT
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)
    print_key_results(result, "TEST 3")

    print("EXPORT-SPECIFIC CHECKS:")
    print(f"  - AI16 (Financial agent fee) should be 0: {result.financial_agent_fee:,.2f}")
    print(f"  - Y16 (Customs fee) should be 0 (DAP): {result.customs_fee:,.2f}")
    print(f"  - AO16 (Import VAT) should be 0: {result.vat_on_import:,.2f}")
    print(f"  - AM16 = AJ16 (no VAT added): {result.sales_price_per_unit_with_vat:,.2f} vs {result.sales_price_per_unit_no_vat:,.2f}")
    print()

    return result


# ============================================================================
# TEST 4: Turkish seller scenario
# ============================================================================

def test_4_turkish_seller():
    """
    TEST 4: SUPPLY TR->Turkey DDP 50% advance
    Tests Turkish seller logic (AI16 = 0, different VAT handling)
    """
    print_test_header(4, "SUPPLY TR (Turkish seller)->Turkey DDP 50% advance (FIXED DM fee)")

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
            supplier_country=SupplierCountry.TURKEY,
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
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
            brokerage_extra=Decimal("50.00")
        ),
        company=CompanySettings(
            seller_company=SellerCompany.TEXCEL_TR,  # ← TURKISH SELLER
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )

    result = calculate_single_product_quote(test_input)
    print_key_results(result, "TEST 4")

    print("TURKISH SELLER-SPECIFIC CHECKS:")
    print(f"  - AI16 (Financial agent fee) should be 0: {result.financial_agent_fee:,.2f}")
    print(f"  - Internal markup (AW16) should be 0%: Turkey->TR = 0%")
    print(f"  - rate_vatRu should be 0% (not implemented for TR)")
    print()

    return result


# ============================================================================
# TEST 5: Non-DDP (DAP) scenario
# ============================================================================

def test_5_non_ddp():
    """
    TEST 5: SUPPLY RU->Turkey DAP 0% advance
    Tests non-DDP logic (no customs fee, no import VAT, no VAT in final price)
    """
    print_test_header(5, "SUPPLY RU->Turkey DAP 0% advance (FIXED DM fee)")

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
            supplier_country=SupplierCountry.TURKEY,
            offer_incoterms=Incoterms.DAP,  # ← DAP (not DDP)
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
            advance_from_client=Decimal("0"),  # ← 0% advance (max financing)
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
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
    print_key_results(result, "TEST 5")

    print("NON-DDP SPECIFIC CHECKS:")
    print(f"  - Y16 (Customs fee) should be 0: {result.customs_fee:,.2f}")
    print(f"  - AO16 (Import VAT) should be 0: {result.vat_on_import:,.2f}")
    print(f"  - AM16 = AJ16 (no VAT added): {result.sales_price_per_unit_with_vat:,.2f} vs {result.sales_price_per_unit_no_vat:,.2f}")
    print()
    print("ZERO ADVANCE CHECKS:")
    print(f"  - BH7 (Supplier financing) should be high: {result.quote_level_supplier_financing_need:,.2f}")
    print(f"  - BL3 (Credit sales amount) should equal BH2: {result.quote_level_credit_sales_amount:,.2f}")
    print()

    return result


# ============================================================================
# TEST 6: Full advance (100%) scenario
# ============================================================================

def test_6_full_advance():
    """
    TEST 6: SUPPLY RU->Turkey DDP 100% advance
    Tests full advance scenario (minimal financing costs)
    """
    print_test_header(6, "SUPPLY RU->Turkey DDP 100% advance (FIXED DM fee)")

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
            supplier_country=SupplierCountry.TURKEY,
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
            advance_from_client=Decimal("100"),  # ← 100% advance
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
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
    print_key_results(result, "TEST 6")

    print("FULL ADVANCE CHECKS:")
    print(f"  - BH3 (Client advance) should equal BH2: {result.quote_level_client_advance:,.2f} vs {result.quote_level_evaluated_revenue:,.2f}")
    print(f"  - BH7 (Supplier financing) should be 0 or very low: {result.quote_level_supplier_financing_need:,.2f}")
    print(f"  - BL3 (Credit sales amount) should be 0: {result.quote_level_credit_sales_amount:,.2f}")
    print(f"  - BA16+BB16 (Total financing) should be minimal: {result.financing_cost_initial + result.financing_cost_credit:,.2f}")
    print()

    return result


# ============================================================================
# TEST 7: Zero advance scenario
# ============================================================================

def test_7_zero_advance():
    """
    TEST 7: SUPPLY RU->Turkey DDP 0% advance
    Tests zero advance scenario (maximum financing costs)
    """
    print_test_header(7, "SUPPLY RU->Turkey DDP 0% advance (FIXED DM fee)")

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
            supplier_country=SupplierCountry.TURKEY,
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
            advance_from_client=Decimal("0"),  # ← 0% advance
            advance_to_supplier=Decimal("100"),
            time_to_advance=7,
            time_to_advance_on_receiving=15
        ),
        customs=CustomsAndClearance(
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
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
    print_key_results(result, "TEST 7")

    print("ZERO ADVANCE CHECKS:")
    print(f"  - BH3 (Client advance) should be 0: {result.quote_level_client_advance:,.2f}")
    print(f"  - BH7 (Supplier financing) should equal BH6: {result.quote_level_supplier_financing_need:,.2f} vs {result.quote_level_supplier_payment:,.2f}")
    print(f"  - BL3 (Credit sales amount) should equal BH2: {result.quote_level_credit_sales_amount:,.2f} vs {result.quote_level_evaluated_revenue:,.2f}")
    print(f"  - BA16+BB16 (Total financing) should be MAXIMUM: {result.financing_cost_initial + result.financing_cost_credit:,.2f}")
    print()

    return result


# ============================================================================
# TEST 8: Percentage DM fee scenario
# ============================================================================

def test_8_percentage_dm_fee():
    """
    TEST 8: SUPPLY RU->Turkey DDP 50% advance (PERCENTAGE DM fee)
    Tests percentage-based DM fee calculation
    """
    print_test_header(8, "SUPPLY RU->Turkey DDP 50% advance (PERCENTAGE DM fee)")

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
            dm_fee_type=DMFeeType.PERCENTAGE,  # ← PERCENTAGE
            dm_fee_value=Decimal("2")  # ← 2% of COGS
        ),
        logistics=LogisticsParams(
            supplier_country=SupplierCountry.TURKEY,
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
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
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
    print_key_results(result, "TEST 8")

    print("PERCENTAGE DM FEE CHECKS:")
    print(f"  - AG16 should be 2% of AB16: {result.dm_fee:,.2f} vs {result.cogs_per_product * Decimal('0.02'):,.2f}")
    print(f"  - Compare with Test 1 fixed DM fee (1000.00)")
    print()

    return result


# ============================================================================
# TEST 9: Two-product scenario (CRITICAL)
# ============================================================================

def test_9_two_products():
    """
    TEST 9: Two-product SUPPLY RU->Turkey DDP 50% advance
    CRITICAL TEST: Validates distribution logic (BD16 ≠ 1.0)

    NOTE: This requires a multi-product calculation function
    For now, we'll run two separate single-product calculations
    and show how to manually combine them
    """
    print_test_header(9, "Two-product SUPPLY RU->Turkey DDP 50% advance (DISTRIBUTION TEST)")

    print("\n⚠️  IMPORTANT: Multi-product calculation requires manual combination")
    print("Run each product separately, then combine quote-level values (BH*, BJ*, BL*)")
    print("=" * 100)

    # Product 1: Same as Test 1
    print("\n--- PRODUCT 1: Base product ---")
    product1_input = QuoteCalculationInput(
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
            supplier_country=SupplierCountry.TURKEY,
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
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
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

    # Product 2: Different price and quantity
    print("\n--- PRODUCT 2: Higher-priced product ---")
    product2_input = QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("2500.00"),  # ← Higher price
            quantity=5,  # ← Different quantity
            weight_in_kg=Decimal("15.0"),
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
            supplier_country=SupplierCountry.TURKEY,
            offer_incoterms=Incoterms.DDP,
            delivery_time=30,
            logistics_supplier_hub=Decimal("1500.00"),  # SHARED
            logistics_hub_customs=Decimal("800.00"),    # SHARED
            logistics_customs_client=Decimal("500.00")  # SHARED
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
            brokerage_hub=Decimal("200.00"),
            brokerage_customs=Decimal("150.00"),
            warehousing_at_customs=Decimal("100.00"),
            customs_documentation=Decimal("300.00"),
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

    print("\n📋 MANUAL COMBINATION INSTRUCTIONS:")
    print("-" * 100)
    print("1. Run product1 calculation separately")
    print("2. Run product2 calculation separately")
    print("3. Calculate S13 = S16(product1) + S16(product2)")
    print("4. Calculate BD16 for each product: BD16 = S16 / S13")
    print("5. Re-run with correct BD16 values to get distributed costs (BA16, BB16, T16, U16)")
    print("6. Quote-level values (BH*, BJ*, BL*) should be calculated once for entire quote")
    print("-" * 100)

    print("\n⚠️  For Test 9, please use Excel multi-product sheet")
    print("Compare individual product rows and quote-level totals")
    print()

    return None  # Multi-product requires special handling


# ============================================================================
# TEST 10: Three-product scenario
# ============================================================================

def test_10_three_products():
    """
    TEST 10: Three-product SUPPLY RU->Turkey DDP 50% advance
    Tests distribution with 3 products of varying sizes

    NOTE: Same as Test 9, requires multi-product calculation
    """
    print_test_header(10, "Three-product SUPPLY RU->Turkey DDP 50% advance (DISTRIBUTION TEST)")

    print("\n⚠️  IMPORTANT: Multi-product calculation requires manual combination")
    print("This test validates distribution across 3 products with different:")
    print("  - Prices: 800, 1200, 2500")
    print("  - Quantities: 20, 10, 5")
    print("  - Weights: 10kg, 25kg, 15kg")
    print()
    print("For Test 10, please use Excel multi-product sheet with 3 rows")
    print("=" * 100)

    return None


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def run_all_tests():
    """Run all 10 test cases"""
    print("\n" + "=" * 120)
    print("B2B QUOTATION CALCULATOR - 10 TEST SUITE FOR MANUAL EXCEL VALIDATION".center(120))
    print("=" * 120)

    tests = [
        ("Test 1", test_1_baseline),
        ("Test 2", test_2_transit),
        ("Test 3", test_3_export),
        ("Test 4", test_4_turkish_seller),
        ("Test 5", test_5_non_ddp),
        ("Test 6", test_6_full_advance),
        ("Test 7", test_7_zero_advance),
        ("Test 8", test_8_percentage_dm_fee),
        ("Test 9", test_9_two_products),
        ("Test 10", test_10_three_products)
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result, "SUCCESS"))
        except Exception as e:
            results.append((test_name, None, f"ERROR: {str(e)}"))

    # Summary
    print("\n" + "=" * 120)
    print("TEST SUMMARY".center(120))
    print("=" * 120)
    for test_name, result, status in results:
        print(f"{test_name:<15} {status}")
    print("=" * 120)

    print("\n📝 NEXT STEPS:")
    print("1. Copy key results for each test")
    print("2. Enter same input values in Excel")
    print("3. Compare Python values with Excel")
    print("4. Report any mismatches (>1 RUB difference)")
    print("5. Share results for automated test suite creation")
    print()


if __name__ == "__main__":
    # Run all tests
    run_all_tests()

    # Or run individual test:
    # test_1_baseline()
    # test_2_transit()
    # etc.
