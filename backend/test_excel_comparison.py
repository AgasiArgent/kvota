"""
B2B Quotation Calculator - Excel Comparison Format
Generates complete input/output for each test for easy Excel validation
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


def print_excel_format(test_num, test_name, test_input, result):
    """Print test in Excel comparison format"""

    print("\n" + "=" * 140)
    print(f"TEST {test_num}: {test_name}".center(140))
    print("=" * 140)

    # SECTION 1: INPUT VARIABLES (for Excel entry)
    print("\n📥 INPUT VARIABLES - Enter these values in Excel:")
    print("-" * 140)
    print(f"{'Excel Cell':<15} {'Variable Name':<40} {'Value':<30} {'Notes':<50}")
    print("-" * 140)

    # Product Info
    print("\n--- PRODUCT INFO ---")
    print(f"{'K16':<15} {'base_price_VAT':<40} {test_input.product.base_price_VAT:<30} {'Product base price WITH VAT':<50}")
    print(f"{'E16':<15} {'quantity':<40} {test_input.product.quantity:<30} {'Number of units':<50}")
    print(f"{'G16':<15} {'weight_in_kg':<40} {test_input.product.weight_in_kg:<30} {'Product weight in kg':<50}")
    print(f"{'J16':<15} {'currency_of_base_price':<40} {test_input.product.currency_of_base_price.value:<30} {'Base price currency':<50}")
    print(f"{'W16':<15} {'customs_code':<40} {test_input.product.customs_code:<30} {'10-digit customs code':<50}")

    # Financial Params
    print("\n--- FINANCIAL PARAMETERS ---")
    print(f"{'D8':<15} {'currency_of_quote':<40} {test_input.financial.currency_of_quote.value:<30} {'Quote currency':<50}")
    print(f"{'Q16':<15} {'exchange_rate':<40} {test_input.financial.exchange_rate_base_price_to_quote:<30} {'Exchange rate (base to quote)':<50}")
    print(f"{'O16':<15} {'supplier_discount':<40} {test_input.financial.supplier_discount:<30} {'Supplier discount %':<50}")
    print(f"{'AC16':<15} {'markup':<40} {test_input.financial.markup:<30} {'Markup on COGS %':<50}")
    print(f"{'AH11':<15} {'rate_forex_risk':<40} {test_input.financial.rate_forex_risk:<30} {'Forex risk reserve %':<50}")
    print(f"{'AG3':<15} {'dm_fee_type':<40} {test_input.financial.dm_fee_type.value:<30} {'DM fee type (fixed or %)':<50}")
    print(f"{'AG7':<15} {'dm_fee_value':<40} {test_input.financial.dm_fee_value:<30} {'DM fee value':<50}")

    # Logistics Params
    print("\n--- LOGISTICS ---")
    print(f"{'L16':<15} {'supplier_country':<40} {test_input.logistics.supplier_country.value:<30} {'Supplier country':<50}")
    print(f"{'D7':<15} {'offer_incoterms':<40} {test_input.logistics.offer_incoterms.value:<30} {'INCOTERMS':<50}")
    print(f"{'D9':<15} {'delivery_time':<40} {test_input.logistics.delivery_time:<30} {'Delivery time in days':<50}")
    print(f"{'W2':<15} {'logistics_supplier_hub':<40} {test_input.logistics.logistics_supplier_hub:<30} {'Cost from supplier to hub':<50}")
    print(f"{'W3':<15} {'logistics_hub_customs':<40} {test_input.logistics.logistics_hub_customs:<30} {'Cost from hub to customs':<50}")
    print(f"{'W4':<15} {'logistics_customs_client':<40} {test_input.logistics.logistics_customs_client:<30} {'Cost from customs to client':<50}")

    # Taxes and Duties
    print("\n--- TAXES & DUTIES ---")
    print(f"{'X16':<15} {'import_tariff':<40} {test_input.taxes.import_tariff:<30} {'Import tariff %':<50}")
    print(f"{'Z16':<15} {'excise_tax':<40} {test_input.taxes.excise_tax:<30} {'Excise tax per kg':<50}")

    # Payment Terms
    print("\n--- PAYMENT TERMS ---")
    print(f"{'J5':<15} {'advance_from_client':<40} {test_input.payment.advance_from_client:<30} {'Client upfront payment %':<50}")
    print(f"{'D11':<15} {'advance_to_supplier':<40} {test_input.payment.advance_to_supplier:<30} {'Supplier upfront payment %':<50}")
    print(f"{'K5':<15} {'time_to_advance':<40} {test_input.payment.time_to_advance:<30} {'Days until client pays advance':<50}")
    print(f"{'K9':<15} {'time_to_advance_on_receiving':<40} {test_input.payment.time_to_advance_on_receiving:<30} {'Days to final payment after receiving':<50}")

    # Customs & Clearance
    print("\n--- CUSTOMS & CLEARANCE ---")
    print(f"{'W5':<15} {'brokerage_hub':<40} {test_input.customs.brokerage_hub:<30} {'Hub brokerage cost':<50}")
    print(f"{'W6':<15} {'brokerage_customs':<40} {test_input.customs.brokerage_customs:<30} {'Customs brokerage cost':<50}")
    print(f"{'W7':<15} {'warehousing_at_customs':<40} {test_input.customs.warehousing_at_customs:<30} {'Warehousing cost':<50}")
    print(f"{'W8':<15} {'customs_documentation':<40} {test_input.customs.customs_documentation:<30} {'Documentation cost':<50}")
    print(f"{'W9':<15} {'brokerage_extra':<40} {test_input.customs.brokerage_extra:<30} {'Extra brokerage fees':<50}")

    # Company Settings
    print("\n--- COMPANY SETTINGS ---")
    print(f"{'D5':<15} {'seller_company':<40} {test_input.company.seller_company.value:<30} {'Seller company':<50}")
    print(f"{'D6':<15} {'offer_sale_type':<40} {test_input.company.offer_sale_type.value:<30} {'Deal type':<50}")

    # System Config
    print("\n--- SYSTEM CONFIGURATION ---")
    print(f"{'(system)':<15} {'rate_fin_comm':<40} {test_input.system.rate_fin_comm:<30} {'Financial agent fee %':<50}")
    print(f"{'(system)':<15} {'rate_loan_interest_daily':<40} {test_input.system.rate_loan_interest_daily:<30} {'Daily loan interest rate':<50}")
    print(f"{'(system)':<15} {'rate_insurance':<40} {test_input.system.rate_insurance:<30} {'Insurance rate':<50}")

    # SECTION 2: PYTHON RESULTS (for Excel comparison)
    print("\n" + "=" * 140)
    print("📤 PYTHON RESULTS - Compare these with your Excel calculations:")
    print("-" * 140)
    print(f"{'Excel Cell':<15} {'Phase':<10} {'Description':<45} {'Python Value':<20} {'Excel Value':<20} {'Match?':<10}")
    print("-" * 140)

    # Phase 1: Purchase Price
    print("\n--- PHASE 1: PURCHASE PRICE ---")
    print(f"{'N16':<15} {'Phase 1':<10} {'Purchase price (no VAT)':<45} {result.purchase_price_no_vat:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'P16':<15} {'Phase 1':<10} {'After supplier discount':<45} {result.purchase_price_after_discount:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'R16':<15} {'Phase 1':<10} {'Per unit in quote currency':<45} {result.purchase_price_per_unit_quote_currency:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'S16':<15} {'Phase 1':<10} {'Total purchase price':<45} {result.purchase_price_total_quote_currency:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 2: Distribution Base
    print("\n--- PHASE 2: DISTRIBUTION BASE ---")
    print(f"{'BD16':<15} {'Phase 2':<10} {'Distribution base (product share)':<45} {result.distribution_base:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'S13':<15} {'Phase 2':<10} {'Total purchase price (all products)':<45} {result.purchase_price_total_quote_currency:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 3: Logistics
    print("\n--- PHASE 3: LOGISTICS ---")
    print(f"{'T16':<15} {'Phase 3':<10} {'Logistics first leg':<45} {result.logistics_first_leg:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'U16':<15} {'Phase 3':<10} {'Logistics last leg':<45} {result.logistics_last_leg:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'V16':<15} {'Phase 3':<10} {'Total logistics':<45} {result.logistics_total:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 4: Internal Pricing & Duties
    print("\n--- PHASE 4: INTERNAL PRICING & DUTIES ---")
    print(f"{'AX16':<15} {'Phase 4':<10} {'Internal sale price per unit':<45} {result.internal_sale_price_per_unit:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AY16':<15} {'Phase 4':<10} {'Internal sale price total':<45} {result.internal_sale_price_total:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'Y16':<15} {'Phase 4':<10} {'Customs fee (import tariff)':<45} {result.customs_fee:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'Z16':<15} {'Phase 4':<10} {'Excise tax':<45} {result.excise_tax_amount:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AZ16':<15} {'Phase 4':<10} {'Purchase with supplier VAT':<45} {result.purchase_price_total_quote_currency * Decimal('1.20'):>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 5-6: Quote-level financing
    if result.quote_level_supplier_payment:
        print("\n--- PHASE 5-6: SUPPLIER PAYMENT & REVENUE ---")
        print(f"{'BH6':<15} {'Phase 5':<10} {'Supplier payment needed':<45} {result.quote_level_supplier_payment:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BH4':<15} {'Phase 5':<10} {'Total before forwarding':<45} {result.quote_level_total_before_forwarding:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BH2':<15} {'Phase 6':<10} {'Evaluated revenue (estimated)':<45} {result.quote_level_evaluated_revenue:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

        print("\n--- PHASE 7: FINANCING COSTS ---")
        print(f"{'BH3':<15} {'Phase 7':<10} {'Client advance payment':<45} {result.quote_level_client_advance:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BH7':<15} {'Phase 7':<10} {'Supplier financing need':<45} {result.quote_level_supplier_financing_need:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BI7':<15} {'Phase 7':<10} {'FV of supplier financing':<45} {result.quote_level_supplier_financing_fv:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BJ7':<15} {'Phase 7':<10} {'Supplier financing COST':<45} {result.quote_level_supplier_financing_cost:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BH10':<15} {'Phase 7':<10} {'Operational financing need':<45} {result.quote_level_operational_financing_need:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BI10':<15} {'Phase 7':<10} {'FV of operational financing':<45} {result.quote_level_operational_financing_fv:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BJ10':<15} {'Phase 7':<10} {'Operational financing COST':<45} {result.quote_level_operational_financing_cost:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BJ11':<15} {'Phase 7':<10} {'TOTAL FINANCING COST':<45} {result.quote_level_total_financing_cost:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

        print("\n--- PHASE 8: CREDIT SALES INTEREST ---")
        print(f"{'BL3':<15} {'Phase 8':<10} {'Amount client owes':<45} {result.quote_level_credit_sales_amount:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BL4':<15} {'Phase 8':<10} {'FV with interest':<45} {result.quote_level_credit_sales_fv:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
        print(f"{'BL5':<15} {'Phase 8':<10} {'Credit sales interest COST':<45} {result.quote_level_credit_sales_interest:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 9: Distributed Financing
    print("\n--- PHASE 9: DISTRIBUTED FINANCING ---")
    print(f"{'BA16':<15} {'Phase 9':<10} {'Initial financing per product':<45} {result.financing_cost_initial:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'BB16':<15} {'Phase 9':<10} {'Credit interest per product':<45} {result.financing_cost_credit:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 10: COGS
    print("\n--- PHASE 10: FINAL COGS ---")
    print(f"{'AA16':<15} {'Phase 10':<10} {'COGS per unit':<45} {result.cogs_per_unit:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AB16':<15} {'Phase 10':<10} {'COGS per product':<45} {result.cogs_per_product:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AB13':<15} {'Phase 10':<10} {'TOTAL COGS (all products)':<45} {result.cogs_per_product:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 11: Profit & Sales Price
    print("\n--- PHASE 11: PROFIT & SALES PRICE ---")
    print(f"{'AF16':<15} {'Phase 11':<10} {'Profit per product':<45} {result.profit:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AG16':<15} {'Phase 11':<10} {'DM fee':<45} {result.dm_fee:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AD16':<15} {'Phase 11':<10} {'Sale price/unit (excl financial)':<45} {result.sale_price_per_unit_excl_financial:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AE16':<15} {'Phase 11':<10} {'Sale price total (excl financial)':<45} {result.sale_price_total_excl_financial:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AH16':<15} {'Phase 11':<10} {'Forex risk reserve':<45} {result.forex_reserve:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AI16':<15} {'Phase 11':<10} {'Financial agent fee':<45} {result.financial_agent_fee:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AJ16':<15} {'Phase 11':<10} {'Sales price per unit (no VAT)':<45} {result.sales_price_per_unit_no_vat:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AK16':<15} {'Phase 11':<10} {'Sales price total (no VAT)':<45} {result.sales_price_total_no_vat:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 12: VAT
    print("\n--- PHASE 12: VAT ---")
    print(f"{'AM16':<15} {'Phase 12':<10} {'Sales price per unit (with VAT)':<45} {result.sales_price_per_unit_with_vat:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AL16':<15} {'Phase 12':<10} {'FINAL PRICE (with VAT)':<45} {result.sales_price_total_with_vat:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AN16':<15} {'Phase 12':<10} {'VAT from sales':<45} {result.vat_from_sales:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AO16':<15} {'Phase 12':<10} {'VAT on import':<45} {result.vat_on_import:>20,.2f} {'[ ]':<20} {'[ ]':<10}")
    print(f"{'AP16':<15} {'Phase 12':<10} {'Net VAT payable':<45} {result.vat_net_payable:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    # Phase 13: Transit Commission
    print("\n--- PHASE 13: TRANSIT COMMISSION ---")
    print(f"{'AQ16':<15} {'Phase 13':<10} {'Transit commission':<45} {result.transit_commission:>20,.2f} {'[ ]':<20} {'[ ]':<10}")

    print("\n" + "=" * 140)
    print()


def generate_all_tests():
    """Generate all 8 single-product tests in Excel format"""

    # Test 1: Baseline
    test1_input = QuoteCalculationInput(
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
    result1 = calculate_single_product_quote(test1_input)
    print_excel_format(1, "Baseline SUPPLY RU->Turkey DDP 50% advance (FIXED DM fee)", test1_input, result1)

    # Test 2: Transit
    test2_input = test1_input.model_copy(deep=True)
    test2_input.company.offer_sale_type = OfferSaleType.TRANSIT
    result2 = calculate_single_product_quote(test2_input)
    print_excel_format(2, "TRANSIT RU->Turkey DDP 50% advance (FIXED DM fee)", test2_input, result2)

    # Test 3: Export
    test3_input = test1_input.model_copy(deep=True)
    test3_input.company.offer_sale_type = OfferSaleType.EXPORT
    test3_input.logistics.offer_incoterms = Incoterms.DAP
    test3_input.payment.advance_from_client = Decimal("100")
    result3 = calculate_single_product_quote(test3_input)
    print_excel_format(3, "EXPORT RU->Turkey DAP 100% advance (FIXED DM fee)", test3_input, result3)

    # Test 4: Turkish seller
    test4_input = test1_input.model_copy(deep=True)
    test4_input.company.seller_company = SellerCompany.TEXCEL_TR
    result4 = calculate_single_product_quote(test4_input)
    print_excel_format(4, "SUPPLY TR->Turkey DDP 50% advance (FIXED DM fee)", test4_input, result4)

    # Test 5: Non-DDP + 0% advance
    test5_input = test1_input.model_copy(deep=True)
    test5_input.logistics.offer_incoterms = Incoterms.DAP
    test5_input.payment.advance_from_client = Decimal("0")
    result5 = calculate_single_product_quote(test5_input)
    print_excel_format(5, "SUPPLY RU->Turkey DAP 0% advance (FIXED DM fee)", test5_input, result5)

    # Test 6: Full advance
    test6_input = test1_input.model_copy(deep=True)
    test6_input.payment.advance_from_client = Decimal("100")
    result6 = calculate_single_product_quote(test6_input)
    print_excel_format(6, "SUPPLY RU->Turkey DDP 100% advance (FIXED DM fee)", test6_input, result6)

    # Test 7: Zero advance
    test7_input = test1_input.model_copy(deep=True)
    test7_input.payment.advance_from_client = Decimal("0")
    result7 = calculate_single_product_quote(test7_input)
    print_excel_format(7, "SUPPLY RU->Turkey DDP 0% advance (FIXED DM fee)", test7_input, result7)

    # Test 8: Percentage DM fee
    test8_input = test1_input.model_copy(deep=True)
    test8_input.financial.dm_fee_type = DMFeeType.PERCENTAGE
    test8_input.financial.dm_fee_value = Decimal("2")
    result8 = calculate_single_product_quote(test8_input)
    print_excel_format(8, "SUPPLY RU->Turkey DDP 50% advance (PERCENTAGE DM fee)", test8_input, result8)

    print("\n" + "=" * 140)
    print("INSTRUCTIONS FOR EXCEL VALIDATION".center(140))
    print("=" * 140)
    print("""
1. For each test, copy the INPUT VARIABLES section
2. Enter these values in your Excel file (use the cell references provided)
3. Let Excel calculate all results
4. Compare Excel results with the PYTHON RESULTS section
5. Fill in the "Excel Value" column with your Excel results
6. Mark "Match?" column with ✅ (match) or ❌ (mismatch)
7. Note any differences > 1 RUB (except financing costs which may differ up to 100 RUB)

PRIORITY CELLS TO CHECK:
⭐⭐⭐ S16 (Purchase price) - should match EXACTLY
⭐⭐⭐ T16, U16, V16 (Logistics) - should match EXACTLY
⭐⭐⭐ AB16 (COGS) - should match within 150 RUB
⭐⭐⭐ AD16 (Sale price excl financial) - should match within 20 RUB
⭐⭐⭐ AL16 (FINAL PRICE) - should match within 200 RUB

After validation, share results in this format:
"Test X: All match ✅" or "Test X: Cell Y16 Excel=100, Python=105 ❌"
    """)


if __name__ == "__main__":
    generate_all_tests()
