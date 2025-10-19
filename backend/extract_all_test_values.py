"""
Simple script to extract all cell values from all tests for manual Excel comparison
Includes both INPUT VARIABLES and OUTPUT RESULTS
"""

from test_suite_10_cases import *
from test_suite_extended import *
from calculation_engine import calculate_single_product_quote, calculate_multiproduct_quote


def print_input_variables(test_input):
    """Print all input variables with Excel cell references"""
    print("\n📥 INPUT VARIABLES - Enter these values in Excel:")
    print("-" * 100)

    # Product Info
    print("\n--- PRODUCT INFO ---")
    print(f"K16  base_price_VAT              = {test_input.product.base_price_VAT}")
    print(f"E16  quantity                    = {test_input.product.quantity}")
    print(f"G16  weight_in_kg                = {test_input.product.weight_in_kg}")
    print(f"J16  currency_of_base_price      = {test_input.product.currency_of_base_price.value}")
    print(f"W16  customs_code                = {test_input.product.customs_code}")

    # Financial Parameters
    print("\n--- FINANCIAL PARAMETERS ---")
    print(f"D8   currency_of_quote           = {test_input.financial.currency_of_quote.value}")
    print(f"Q16  exchange_rate               = {test_input.financial.exchange_rate_base_price_to_quote}")
    print(f"O16  supplier_discount           = {test_input.financial.supplier_discount}")
    print(f"AC16 markup                      = {test_input.financial.markup}")
    print(f"AH11 rate_forex_risk             = {test_input.financial.rate_forex_risk}")
    print(f"AG3  dm_fee_type                 = {test_input.financial.dm_fee_type.value}")
    print(f"AG7  dm_fee_value                = {test_input.financial.dm_fee_value}")

    # Logistics
    print("\n--- LOGISTICS ---")
    print(f"L16  supplier_country            = {test_input.logistics.supplier_country.value}")
    print(f"D7   offer_incoterms             = {test_input.logistics.offer_incoterms.value}")
    print(f"D9   delivery_time               = {test_input.logistics.delivery_time}")
    print(f"W2   logistics_supplier_hub      = {test_input.logistics.logistics_supplier_hub}")
    print(f"W3   logistics_hub_customs       = {test_input.logistics.logistics_hub_customs}")
    print(f"W4   logistics_customs_client    = {test_input.logistics.logistics_customs_client}")

    # Taxes & Duties
    print("\n--- TAXES & DUTIES ---")
    print(f"X16  import_tariff               = {test_input.taxes.import_tariff}")
    print(f"Z16  excise_tax                  = {test_input.taxes.excise_tax}")

    # Payment Terms
    print("\n--- PAYMENT TERMS ---")
    print(f"J5   advance_from_client         = {test_input.payment.advance_from_client}")
    print(f"D11  advance_to_supplier         = {test_input.payment.advance_to_supplier}")
    print(f"K5   time_to_advance             = {test_input.payment.time_to_advance}")
    print(f"K9   time_to_advance_on_receiving = {test_input.payment.time_to_advance_on_receiving}")

    # Customs & Clearance
    print("\n--- CUSTOMS & CLEARANCE ---")
    print(f"W5   brokerage_hub               = {test_input.customs.brokerage_hub}")
    print(f"W6   brokerage_customs           = {test_input.customs.brokerage_customs}")
    print(f"W7   warehousing_at_customs      = {test_input.customs.warehousing_at_customs}")
    print(f"W8   customs_documentation       = {test_input.customs.customs_documentation}")
    print(f"W9   brokerage_extra             = {test_input.customs.brokerage_extra}")

    # Company Settings
    print("\n--- COMPANY SETTINGS ---")
    print(f"D5   seller_company              = {test_input.company.seller_company.value}")
    print(f"D6   offer_sale_type             = {test_input.company.offer_sale_type.value}")

    # System Config
    print("\n--- SYSTEM CONFIGURATION ---")
    print(f"     rate_fin_comm               = {test_input.system.rate_fin_comm}")
    print(f"     rate_loan_interest_daily    = {test_input.system.rate_loan_interest_daily}")
    print(f"     rate_insurance              = {test_input.system.rate_insurance}")
    print()


def print_test_values(test_name, test_input, result):
    """Print all cell values for a single-product test"""
    print(f"\n{'=' * 100}")
    print(f"{test_name}")
    print('=' * 100)

    # Print input variables if available
    if test_input:
        print_input_variables(test_input)

    print("\n📤 PYTHON RESULTS - Compare with Excel:")
    print("-" * 100)
    print()

    # Phase 1: Purchase Price
    print(f"N16  = {result.purchase_price_no_vat:>15,.2f}    P16  = {result.purchase_price_after_discount:>15,.2f}")
    print(f"R16  = {result.purchase_price_per_unit_quote_currency:>15,.2f}    S16  = {result.purchase_price_total_quote_currency:>15,.2f}")

    # Phase 2: Distribution
    print(f"BD16 = {result.distribution_base:>15,.2f}    S13  = {result.purchase_price_total_quote_currency:>15,.2f}")

    # Phase 3: Logistics
    print(f"T16  = {result.logistics_first_leg:>15,.2f}    U16  = {result.logistics_last_leg:>15,.2f}    V16  = {result.logistics_total:>15,.2f}")

    # Phase 4: Internal Pricing
    print(f"AX16 = {result.internal_sale_price_per_unit:>15,.2f}    AY16 = {result.internal_sale_price_total:>15,.2f}")
    print(f"Y16  = {result.customs_fee:>15,.2f}    Z16  = {result.excise_tax_amount:>15,.2f}")
    az16_val = result.purchase_price_total_quote_currency * Decimal("1.2")
    print(f"AZ16 = {az16_val:>15,.2f}    AZ13 = {az16_val:>15,.2f}")

    # Phase 5-6: Supplier Payment & Revenue
    print(f"BH6  = {result.quote_level_supplier_payment:>15,.2f}    BH4  = {result.quote_level_total_before_forwarding:>15,.2f}")
    print(f"BH2  = {result.quote_level_evaluated_revenue:>15,.2f}")

    # Phase 7: Financing Costs
    print(f"BH3  = {result.quote_level_client_advance:>15,.2f}    BH7  = {result.quote_level_supplier_financing_need:>15,.2f}")
    print(f"BI7  = {result.quote_level_supplier_financing_fv:>15,.2f}    BJ7  = {result.quote_level_supplier_financing_cost:>15,.2f}")
    print(f"BH10 = {result.quote_level_operational_financing_need:>15,.2f}    BI10 = {result.quote_level_operational_financing_fv:>15,.2f}")
    print(f"BJ10 = {result.quote_level_operational_financing_cost:>15,.2f}    BJ11 = {result.quote_level_total_financing_cost:>15,.2f}")

    # Phase 8: Credit Sales Interest
    print(f"BL3  = {result.quote_level_credit_sales_amount:>15,.2f}    BL4  = {result.quote_level_credit_sales_fv:>15,.2f}")
    print(f"BL5  = {result.quote_level_credit_sales_interest:>15,.2f}")

    # Phase 9: Distributed Financing
    print(f"BA16 = {result.financing_cost_initial:>15,.2f}    BB16 = {result.financing_cost_credit:>15,.2f}")

    # Phase 10: COGS
    print(f"AA16 = {result.cogs_per_unit:>15,.2f}    AB16 = {result.cogs_per_product:>15,.2f}")
    print(f"AB13 = {result.cogs_per_product:>15,.2f}")

    # Phase 11: Profit & Sales Price
    print(f"AF16 = {result.profit:>15,.2f}    AG16 = {result.dm_fee:>15,.2f}")
    print(f"AH16 = {result.forex_reserve:>15,.2f}    AI16 = {result.financial_agent_fee:>15,.2f}")
    print(f"AD16 = {result.sale_price_per_unit_excl_financial:>15,.2f}    AE16 = {result.sale_price_total_excl_financial:>15,.2f}")
    print(f"AJ16 = {result.sales_price_per_unit_no_vat:>15,.2f}    AK16 = {result.sales_price_total_no_vat:>15,.2f}")

    # Phase 12: VAT
    print(f"AM16 = {result.sales_price_per_unit_with_vat:>15,.2f}    AL16 = {result.sales_price_total_with_vat:>15,.2f}")
    print(f"AN16 = {result.vat_from_sales:>15,.2f}    AO16 = {result.vat_on_import:>15,.2f}")
    print(f"AP16 = {result.vat_net_payable:>15,.2f}")

    # Phase 13: Transit Commission
    print(f"AQ16 = {result.transit_commission:>15,.2f}")
    print()


def print_multiproduct_test(test_name, products_config):
    """
    Print multi-product test values
    products_config: list of (price_vat, qty, desc) tuples
    """
    print(f"\n{'=' * 100}")
    print(f"{test_name} - MULTI-PRODUCT SCENARIO")
    print('=' * 100)

    # Print common inputs (same for all products)
    print("\n📥 COMMON INPUT VARIABLES (same for all products):")
    print("-" * 100)
    print("\n--- FINANCIAL PARAMETERS ---")
    print("D8   currency_of_quote           = RUB")
    print("Q16  exchange_rate               = 0.0105")
    print("O16  supplier_discount           = 10")
    print("AC16 markup                      = 15")
    print("AH11 rate_forex_risk             = 3")
    print("AG3  dm_fee_type                 = fixed")
    print("AG7  dm_fee_value                = 1000")
    print("\n--- LOGISTICS ---")
    print("L16  supplier_country            = Турция")
    print("D7   offer_incoterms             = DDP")
    print("D9   delivery_time               = 30")
    print("W2   logistics_supplier_hub      = 1500.00")
    print("W3   logistics_hub_customs       = 800.00")
    print("W4   logistics_customs_client    = 500.00")
    print("\n--- TAXES & DUTIES ---")
    print("X16  import_tariff               = 5")
    print("Z16  excise_tax                  = 0")
    print("\n--- PAYMENT TERMS ---")
    print("J5   advance_from_client         = 50")
    print("D11  advance_to_supplier         = 100")
    print("K5   time_to_advance             = 7")
    print("K9   time_to_advance_on_receiving = 15")
    print("\n--- CUSTOMS & CLEARANCE ---")
    print("W5   brokerage_hub               = 200.00")
    print("W6   brokerage_customs           = 500.00")
    print("W7   warehousing_at_customs      = 100.00")
    print("W8   customs_documentation       = 200.00")
    print("W9   brokerage_extra             = 50.00")
    print("\n--- COMPANY SETTINGS ---")
    print("D5   seller_company              = МАСТЕР БЭРИНГ ООО")
    print("D6   offer_sale_type             = поставка")
    print("\n--- SYSTEM CONFIGURATION ---")
    print("     rate_fin_comm               = 2")
    print("     rate_loan_interest_daily    = 0.00069")
    print("     rate_insurance              = 0.00047")

    # Print product-specific inputs
    print("\n📥 PRODUCT-SPECIFIC INPUTS:")
    print("-" * 100)
    for idx, (price_vat, qty, desc) in enumerate(products_config, 1):
        print(f"\nPRODUCT {idx}: {desc}")
        print(f"  K16 base_price_VAT           = {price_vat}")
        print(f"  E16 quantity                 = {qty}")
        print(f"  G16 weight_in_kg             = 25.0")
        print(f"  J16 currency_of_base_price   = USD")
        print(f"  W16 customs_code             = 8708913509")

    print()

    # Create test inputs for ALL products
    test_inputs = []
    descs = []
    for idx, (price_vat, qty, desc) in enumerate(products_config, 1):
        # Create test input (same as baseline but with different product)
        test_input = QuoteCalculationInput(
            product=ProductInfo(
                base_price_VAT=Decimal(str(price_vat)),
                quantity=qty,
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
        test_inputs.append(test_input)
        descs.append(desc)

    # Calculate using multi-product function
    product_results = calculate_multiproduct_quote(test_inputs)
    results = list(zip(product_results, descs))

    # Calculate quote-level totals
    S13 = sum(r.purchase_price_total_quote_currency for r, _ in results)
    AZ13 = sum(r.purchase_price_total_quote_currency * Decimal("1.2") for r, _ in results)
    T13 = sum(r.logistics_first_leg for r, _ in results)
    U13 = sum(r.logistics_last_leg for r, _ in results)
    AB13 = sum(r.cogs_per_product for r, _ in results)

    print("\n📊 QUOTE-LEVEL TOTALS (calculated once for entire quote):")
    print(f"S13  = {S13:>15,.2f}  (Total purchase price - sum of all products)")
    print(f"AZ13 = {AZ13:>15,.2f}  (Total purchase with VAT)")
    print(f"T13  = {T13:>15,.2f}  (Total first leg logistics)")
    print(f"U13  = {U13:>15,.2f}  (Total last leg logistics)")
    print(f"AB13 = {AB13:>15,.2f}  (Total COGS)")

    # Use first product's quote-level values (same for all products)
    first_result = results[0][0]
    print(f"\nBH6  = {first_result.quote_level_supplier_payment:>15,.2f}  (Supplier payment needed)")
    print(f"BH4  = {first_result.quote_level_total_before_forwarding:>15,.2f}  (Total before forwarding)")
    print(f"BH2  = {first_result.quote_level_evaluated_revenue:>15,.2f}  (Evaluated revenue)")
    print(f"BH3  = {first_result.quote_level_client_advance:>15,.2f}  (Client advance)")
    print(f"BH7  = {first_result.quote_level_supplier_financing_need:>15,.2f}  (Supplier financing need)")
    print(f"BJ7  = {first_result.quote_level_supplier_financing_cost:>15,.2f}  (Supplier financing cost)")
    print(f"BH10 = {first_result.quote_level_operational_financing_need:>15,.2f}  (Operational financing need)")
    print(f"BJ10 = {first_result.quote_level_operational_financing_cost:>15,.2f}  (Operational financing cost)")
    print(f"BJ11 = {first_result.quote_level_total_financing_cost:>15,.2f}  (TOTAL financing cost)")
    print(f"BL3  = {first_result.quote_level_credit_sales_amount:>15,.2f}  (Credit sales amount)")
    print(f"BL5  = {first_result.quote_level_credit_sales_interest:>15,.2f}  (Credit sales interest)")

    # Print each product's values
    for idx, (result, desc) in enumerate(results, 1):
        print(f"\n{'─' * 100}")
        print(f"PRODUCT {idx}: {desc}")
        print('─' * 100)

        # Distribution base
        BD16 = result.purchase_price_total_quote_currency / S13
        print(f"BD16 = {BD16:>15,.6f}  (Distribution base = S16/S13 = {result.purchase_price_total_quote_currency:,.2f}/{S13:,.2f})")

        # Phase 1: Purchase Price
        print(f"\nN16  = {result.purchase_price_no_vat:>15,.2f}    P16  = {result.purchase_price_after_discount:>15,.2f}")
        print(f"R16  = {result.purchase_price_per_unit_quote_currency:>15,.2f}    S16  = {result.purchase_price_total_quote_currency:>15,.2f}  (Purchase price for this product)")

        # Logistics (distributed)
        print(f"T16  = {result.logistics_first_leg:>15,.2f}  (First leg logistics × BD16)")
        print(f"U16  = {result.logistics_last_leg:>15,.2f}  (Last leg logistics × BD16)")
        print(f"V16  = {result.logistics_total:>15,.2f}  (Total logistics)")

        # Internal pricing
        print(f"AX16 = {result.internal_sale_price_per_unit:>15,.2f}")
        print(f"AY16 = {result.internal_sale_price_total:>15,.2f}")
        print(f"Y16  = {result.customs_fee:>15,.2f}")
        print(f"Z16  = {result.excise_tax_amount:>15,.2f}")
        az16_val = result.purchase_price_total_quote_currency * Decimal("1.2")
        print(f"AZ16 = {az16_val:>15,.2f}")

        # Distributed financing (KEY!)
        print(f"\nBA16 = {result.financing_cost_initial:>15,.2f}  (Initial financing × BD16)")
        print(f"BB16 = {result.financing_cost_credit:>15,.2f}  (Credit interest × BD16)")

        # COGS
        print(f"\nAA16 = {result.cogs_per_unit:>15,.2f}")
        print(f"AB16 = {result.cogs_per_product:>15,.2f}  (COGS for this product)")

        # Profit & Sales Price
        print(f"\nAF16 = {result.profit:>15,.2f}")
        print(f"AG16 = {result.dm_fee:>15,.2f}")
        print(f"AH16 = {result.forex_reserve:>15,.2f}")
        print(f"AI16 = {result.financial_agent_fee:>15,.2f}")
        print(f"AD16 = {result.sale_price_per_unit_excl_financial:>15,.2f}")
        print(f"AE16 = {result.sale_price_total_excl_financial:>15,.2f}")
        print(f"AJ16 = {result.sales_price_per_unit_no_vat:>15,.2f}")
        print(f"AK16 = {result.sales_price_total_no_vat:>15,.2f}")

        # VAT
        print(f"\nAM16 = {result.sales_price_per_unit_with_vat:>15,.2f}")
        print(f"AL16 = {result.sales_price_total_with_vat:>15,.2f}  (FINAL PRICE for this product)")
        print(f"AN16 = {result.vat_from_sales:>15,.2f}")
        print(f"AO16 = {result.vat_on_import:>15,.2f}")
        print(f"AP16 = {result.vat_net_payable:>15,.2f}")

        # Transit
        print(f"AQ16 = {result.transit_commission:>15,.2f}")

    print()


# Helper functions to get test inputs for extended tests
def get_test_input_11():
    """Test 11: SUPPLY RU→China"""
    return QuoteCalculationInput(
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
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),
            rate_loan_interest_daily=Decimal("0.00069"),
            rate_insurance=Decimal("0.00047")
        )
    )


def get_test_input_12():
    """Test 12: TRANSIT RU→China"""
    input_11 = get_test_input_11()
    return QuoteCalculationInput(
        product=input_11.product,
        financial=input_11.financial,
        logistics=input_11.logistics,
        taxes=input_11.taxes,
        payment=input_11.payment,
        customs=input_11.customs,
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,
            offer_sale_type=OfferSaleType.TRANSIT  # Changed to TRANSIT
        ),
        system=input_11.system
    )


def get_test_input_13():
    """Test 13: SUPPLY TR→China"""
    input_11 = get_test_input_11()
    return QuoteCalculationInput(
        product=input_11.product,
        financial=input_11.financial,
        logistics=input_11.logistics,
        taxes=input_11.taxes,
        payment=input_11.payment,
        customs=input_11.customs,
        company=CompanySettings(
            seller_company=SellerCompany.TEXCEL_TR,  # Changed to TR seller
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=input_11.system
    )


def get_test_input_14():
    """Test 14: SUPPLY RU→Lithuania"""
    return QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("1200.00"),
            quantity=10,
            weight_in_kg=Decimal("25.0"),
            currency_of_base_price=Currency.EUR,  # EUR for Lithuania
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
            supplier_country=SupplierCountry.LITHUANIA,  # Lithuania
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


def get_test_input_15():
    """Test 15: SUPPLY TR→Lithuania"""
    input_14 = get_test_input_14()
    return QuoteCalculationInput(
        product=input_14.product,
        financial=input_14.financial,
        logistics=input_14.logistics,
        taxes=input_14.taxes,
        payment=input_14.payment,
        customs=input_14.customs,
        company=CompanySettings(
            seller_company=SellerCompany.TEXCEL_TR,  # Changed to TR seller
            offer_sale_type=OfferSaleType.SUPPLY
        ),
        system=input_14.system
    )


if __name__ == "__main__":
    print("=" * 100)
    print("B2B QUOTATION CALCULATOR - ALL TEST VALUES FOR EXCEL COMPARISON")
    print("=" * 100)

    # Tests 1-8: Single product
    tests_single = [
        ("TEST 1: Baseline SUPPLY RU->Turkey DDP 50% advance (FIXED DM fee)", test_1_baseline),
        ("TEST 2: TRANSIT RU->Turkey DDP 50% advance (FIXED DM fee)", test_2_transit),
        ("TEST 3: EXPORT RU->Turkey DAP 100% advance (FIXED DM fee)", test_3_export),
        ("TEST 4: Turkish Seller TR->Turkey DDP 50% advance (FIXED DM fee)", test_4_turkish_seller),
        ("TEST 5: SUPPLY RU->Turkey DAP 0% advance (FIXED DM fee)", test_5_non_ddp),
        ("TEST 6: SUPPLY RU->Turkey DDP 100% advance (FIXED DM fee)", test_6_full_advance),
        ("TEST 7: SUPPLY RU->Turkey DDP 0% advance (FIXED DM fee)", test_7_zero_advance),
        ("TEST 8: SUPPLY RU->Turkey DDP 50% advance (PERCENTAGE DM fee)", test_8_percentage_dm_fee),
    ]

    # For tests 1-8, we can't get input easily, so skip inputs
    for test_name, test_func in tests_single:
        result = test_func()  # test_func already returns the result
        print_test_values(test_name, None, result)

    # Tests 11-15: Extended (China, EU) - We'll create inputs manually
    tests_extended_configs = [
        ("TEST 11: SUPPLY RU→China DDP 50% advance (FIXED DM fee)",
         get_test_input_11()),
        ("TEST 12: TRANSIT RU→China DDP 50% advance (FIXED DM fee)",
         get_test_input_12()),
        ("TEST 13: SUPPLY TR→China DDP 50% advance (FIXED DM fee)",
         get_test_input_13()),
        ("TEST 14: SUPPLY RU→Lithuania DDP 50% advance (FIXED DM fee)",
         get_test_input_14()),
        ("TEST 15: SUPPLY TR→Lithuania DDP 50% advance (FIXED DM fee)",
         get_test_input_15()),
    ]

    for test_name, test_input in tests_extended_configs:
        result = calculate_single_product_quote(test_input)
        print_test_values(test_name, test_input, result)

    # Test 9: Two products
    print_multiproduct_test(
        "TEST 9: Two Products",
        [
            (1200, 10, "$1200 × 10 units (same as Test 1)"),
            (2500, 5, "$2500 × 5 units")
        ]
    )

    # Test 10: Three products
    print_multiproduct_test(
        "TEST 10: Three Products",
        [
            (800, 20, "$800 × 20 units"),
            (1200, 10, "$1200 × 10 units"),
            (2500, 5, "$2500 × 5 units")
        ]
    )

    print("\n" + "=" * 100)
    print("✅ ALL TESTS COMPLETE - Compare these values with your Excel file")
    print("=" * 100)
