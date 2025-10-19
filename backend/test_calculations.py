"""
Test script to validate calculation engine against Excel results
WITH EXCEL COMPARISON TABLE for easy manual validation
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


def print_comparison_table(result, quote_totals=None):
    """
    Print results in table format for easy Excel comparison
    
    Table columns:
    - Excel Cell
    - Phase
    - Calculation Name
    - Python Value
    - Excel Value (empty - user fills in)
    - Match? (✅/❌)
    """
    
    print("\n" + "=" * 120)
    print("EXCEL COMPARISON TABLE - Copy Excel values to compare".center(120))
    print("=" * 120)
    print(f"{'Cell':<8} {'Phase':<8} {'Calculation Name':<40} {'Python Value':<15} {'Excel Value':<15} {'Match?':<8}")
    print("-" * 120)
    
    # PHASE 1: PURCHASE PRICE
    print_row("N16", "Phase 1", "Purchase price (no VAT)", result.purchase_price_no_vat)
    print_row("P16", "Phase 1", "After supplier discount", result.purchase_price_after_discount)
    print_row("R16", "Phase 1", "Per unit in quote currency", result.purchase_price_per_unit_quote_currency)
    print_row("S16", "Phase 1", "Total purchase price", result.purchase_price_total_quote_currency)
    
    print("-" * 120)
    
    # PHASE 2: DISTRIBUTION BASE
    print_row("BD16", "Phase 2", "Distribution base (product share)", result.distribution_base)
    if quote_totals:
        print_row("S13", "Phase 2", "Total purchase price (all products)", quote_totals.get('S13', 'N/A'))
    
    print("-" * 120)
    
    # PHASE 3: LOGISTICS
    print_row("T16", "Phase 3", "Logistics first leg", result.logistics_first_leg)
    print_row("U16", "Phase 3", "Logistics last leg", result.logistics_last_leg)
    print_row("V16", "Phase 3", "Total logistics", result.logistics_total)
    
    print("-" * 120)
    
    # PHASE 4: INTERNAL PRICING & DUTIES
    print_row("AX16", "Phase 4", "Internal sale price per unit", result.internal_sale_price_per_unit)
    print_row("AY16", "Phase 4", "Internal sale price total", result.internal_sale_price_total)
    print_row("Y16", "Phase 4", "Customs fee (import tariff)", result.customs_fee)
    print_row("Z16", "Phase 4", "Excise tax", result.excise_tax_amount)
    if quote_totals:
        print_row("AZ16", "Phase 4", "Purchase with supplier VAT", quote_totals.get('AZ16', 'N/A'))
        print_row("AZ13", "Phase 5", "Total purchase with VAT", quote_totals.get('AZ13', 'N/A'))
    
    print("-" * 120)
    
    # PHASE 5-6: SUPPLIER PAYMENT & REVENUE
    if quote_totals:
        print_row("BH6", "Phase 5", "Supplier payment needed", quote_totals.get('BH6', 'N/A'))
        print_row("BH4", "Phase 5", "Total before forwarding", quote_totals.get('BH4', 'N/A'))
        print_row("BH2", "Phase 6", "Evaluated revenue (estimated)", quote_totals.get('BH2', 'N/A'))
    
    print("-" * 120)
    
    # PHASE 7: FINANCING COSTS
    if quote_totals:
        print_row("BH3", "Phase 7", "Client advance payment", quote_totals.get('BH3', 'N/A'))
        print_row("BH7", "Phase 7", "Supplier financing need", quote_totals.get('BH7', 'N/A'))
        print_row("BI7", "Phase 7", "FV of supplier financing", quote_totals.get('BI7', 'N/A'))
        print_row("BJ7", "Phase 7", "Supplier financing COST", quote_totals.get('BJ7', 'N/A'))
        print_row("BH10", "Phase 7", "Operational financing need", quote_totals.get('BH10', 'N/A'))
        print_row("BI10", "Phase 7", "FV of operational financing", quote_totals.get('BI10', 'N/A'))
        print_row("BJ10", "Phase 7", "Operational financing COST", quote_totals.get('BJ10', 'N/A'))
        print_row("BJ11", "Phase 7", "TOTAL FINANCING COST", quote_totals.get('BJ11', 'N/A'))
    
    print("-" * 120)
    
    # PHASE 8: CREDIT SALES INTEREST
    if quote_totals:
        print_row("BL3", "Phase 8", "Amount client owes", quote_totals.get('BL3', 'N/A'))
        print_row("BL4", "Phase 8", "FV with interest", quote_totals.get('BL4', 'N/A'))
        print_row("BL5", "Phase 8", "Credit sales interest COST", quote_totals.get('BL5', 'N/A'))
    
    print("-" * 120)
    
    # PHASE 9: DISTRIBUTE FINANCING
    print_row("BA16", "Phase 9", "Initial financing per product", result.financing_cost_initial)
    print_row("BB16", "Phase 9", "Credit interest per product", result.financing_cost_credit)
    
    print("-" * 120)
    
    # PHASE 10: FINAL COGS
    print_row("AA16", "Phase 10", "COGS per unit", result.cogs_per_unit)
    print_row("AB16", "Phase 10", "COGS per product", result.cogs_per_product)
    if quote_totals:
        print_row("AB13", "Phase 10", "TOTAL COGS (all products)", quote_totals.get('AB13', 'N/A'))
    
    print("-" * 120)
    
    # PHASE 11: PROFIT & SALES PRICE
    print_row("AF16", "Phase 11", "Profit per product", result.profit)
    print_row("AG16", "Phase 11", "DM fee", result.dm_fee)
    print_row("AH16", "Phase 11", "Forex risk reserve", result.forex_reserve)
    print_row("AI16", "Phase 11", "Financial agent fee", result.financial_agent_fee)
    print_row("AD16", "Phase 11", "Sale price/unit (excl financial)", result.sale_price_per_unit_excl_financial)
    print_row("AE16", "Phase 11", "Sale price total (excl financial)", result.sale_price_total_excl_financial)
    print_row("AJ16", "Phase 11", "Sales price per unit (no VAT)", result.sales_price_per_unit_no_vat)
    print_row("AK16", "Phase 11", "Sales price total (no VAT)", result.sales_price_total_no_vat)
    
    print("-" * 120)
    
    # PHASE 12: VAT
    print_row("AM16", "Phase 12", "Sales price per unit (with VAT)", result.sales_price_per_unit_with_vat)
    print_row("AL16", "Phase 12", "Sales price total (with VAT)", result.sales_price_total_with_vat)
    print_row("AN16", "Phase 12", "VAT from sales", result.vat_from_sales)
    print_row("AO16", "Phase 12", "VAT on import", result.vat_on_import)
    print_row("AP16", "Phase 12", "Net VAT payable", result.vat_net_payable)
    
    print("-" * 120)
    
    # PHASE 13: TRANSIT COMMISSION
    print_row("AQ16", "Phase 13", "Transit commission", result.transit_commission)
    
    print("=" * 120)
    print("\n")


def print_row(cell, phase, name, value):
    """Print a single row in the comparison table"""
    if isinstance(value, Decimal):
        value_str = f"{value:,.2f}"
    elif isinstance(value, (int, float)):
        value_str = f"{value:,.2f}"
    else:
        value_str = str(value)
    
    print(f"{cell:<8} {phase:<8} {name:<40} {value_str:<15} {'[ ]':<15} {'[ ]':<8}")


def print_summary(result):
    """Print quick summary of key values"""
    print("\n" + "=" * 80)
    print("QUICK SUMMARY - KEY VALUES TO CHECK".center(80))
    print("=" * 80)
    print(f"\n{'Description':<40} {'Cell':<10} {'Value':>20}")
    print("-" * 80)
    print(f"{'Purchase Price (total)':<40} {'S16':<10} {result.purchase_price_total_quote_currency:>20,.2f}")
    print(f"{'COGS (per product)':<40} {'AB16':<10} {result.cogs_per_product:>20,.2f}")
    print(f"{'Sales Price per unit (no VAT)':<40} {'AJ16':<10} {result.sales_price_per_unit_no_vat:>20,.2f}")
    print(f"{'Sales Price total (no VAT)':<40} {'AK16':<10} {result.sales_price_total_no_vat:>20,.2f}")
    print(f"{'Sales Price total (WITH VAT)':<40} {'AL16':<10} {result.sales_price_total_with_vat:>20,.2f}")
    print(f"{'Profit':<40} {'AF16':<10} {result.profit:>20,.2f}")
    print(f"{'Financing Cost (initial)':<40} {'BA16':<10} {result.financing_cost_initial:>20,.2f}")
    print(f"{'Credit Interest':<40} {'BB16':<10} {result.financing_cost_credit:>20,.2f}")
    print("=" * 80)


def test_simple_quote():
    """
    Test with simple example - compare with your Excel
    """
    print("=" * 120)
    print("B2B QUOTATION CALCULATOR - EXCEL VALIDATION TEST".center(120))
    print("=" * 120)
    
    # Create test input
    test_input = QuoteCalculationInput(
        product=ProductInfo(
            base_price_VAT=Decimal("1200.00"),  # K16
            quantity=10,                         # E16
            weight_in_kg=Decimal("25.0"),       # G16
            currency_of_base_price=Currency.USD, # J16
            customs_code="8708913509"            # W16
        ),
        financial=FinancialParams(
            currency_of_quote=Currency.RUB,                     # D8
            exchange_rate_base_price_to_quote=Decimal("0.0105"), # Q16
            supplier_discount=Decimal("10"),                    # O16 (10%)
            markup=Decimal("15"),                               # AC16 (15%)
            rate_forex_risk=Decimal("3"),                       # AH11 (3%)
            dm_fee_type=DMFeeType.FIXED,                        # AG3
            dm_fee_value=Decimal("1000")                        # AG7
        ),
        logistics=LogisticsParams(
            supplier_country=SupplierCountry.TURKEY,            # L16
            offer_incoterms=Incoterms.DDP,                      # D7
            delivery_time=30,                                    # D9
            logistics_supplier_hub=Decimal("1500.00"),          # W2
            logistics_hub_customs=Decimal("800.00"),            # W3
            logistics_customs_client=Decimal("500.00")          # W4
        ),
        taxes=TaxesAndDuties(
            import_tariff=Decimal("5"),      # X16 (5%)
            excise_tax=Decimal("0"),         # Z16
            util_fee=Decimal("0")
        ),
        payment=PaymentTerms(
            advance_from_client=Decimal("50"),        # J5 (50%)
            advance_to_supplier=Decimal("100"),       # D11 (100%)
            time_to_advance=7,                        # K5
            time_to_advance_on_receiving=15           # K9
        ),
        customs=CustomsAndClearance(
            brokerage_customs=Decimal("500.00"),      # W6
            customs_documentation=Decimal("200.00")   # W8
        ),
        company=CompanySettings(
            seller_company=SellerCompany.MASTER_BEARING_RU,  # D5
            offer_sale_type=OfferSaleType.SUPPLY              # D6
        ),
        system=SystemConfig(
            rate_fin_comm=Decimal("2"),           # Financial agent fee 2%
            rate_loan_interest_daily=Decimal("0.00069")  # ~25% annual
        )
    )
    
    # Calculate
    print("\nInput values configured. Calculating...")
    print("Please enter these same values in your Excel file to compare results.")
    print("\nCalculating all 13 phases...\n")
    
    result = calculate_single_product_quote(test_input)
    
    # For single product, extract quote totals from result
    # In a real multi-product scenario, these would come from summing all products
    quote_totals = {
        'S13': result.purchase_price_total_quote_currency,  # Single product
        'AZ16': result.purchase_price_total_quote_currency * Decimal("1.20"),  # With 20% VAT (Turkey)
        'AZ13': result.purchase_price_total_quote_currency * Decimal("1.20"),  # Same for single product
        'BH6': result.quote_level_supplier_payment,
        'BH4': result.quote_level_total_before_forwarding,
        'BH2': result.quote_level_evaluated_revenue,
        'BH3': result.quote_level_client_advance,
        'BH7': result.quote_level_supplier_financing_need,
        'BI7': result.quote_level_supplier_financing_fv,
        'BJ7': result.quote_level_supplier_financing_cost,
        'BH10': result.quote_level_operational_financing_need,
        'BI10': result.quote_level_operational_financing_fv,
        'BJ10': result.quote_level_operational_financing_cost,
        'BJ11': result.quote_level_total_financing_cost,
        'BL3': result.quote_level_credit_sales_amount,
        'BL4': result.quote_level_credit_sales_fv,
        'BL5': result.quote_level_credit_sales_interest,
        'AB13': result.cogs_per_product,  # Single product
    }
    
    # Print comparison table
    print_comparison_table(result, quote_totals)
    
    # Print summary
    print_summary(result)
    
    # Instructions
    print("\n" + "=" * 120)
    print("HOW TO USE THIS TABLE".center(120))
    print("=" * 120)
    print("""
1. OPEN YOUR EXCEL FILE with the same input values entered

2. FOR EACH ROW in the table above:
   - Find the Excel cell (e.g., S16, AB16, etc.)
   - Compare the Excel value with the Python value shown
   - Mark ✅ if they match (within 0.01 RUB tolerance)
   - Mark ❌ if they don't match

3. START WITH PHASE 1 (S16):
   - If S16 doesn't match, fix Phase 1 first before checking other phases
   - Errors in early phases cascade to later phases

4. KEY CELLS TO CHECK (Priority order):
   ⭐ S16  - Purchase price (foundation)
   ⭐ AB16 - Final COGS (critical)
   ⭐ AJ16 - Sales price per unit
   ⭐ AL16 - Final price with VAT (what client pays!)

5. IF MISMATCH FOUND:
   - Note the cell, phase, and difference
   - Report to Claude Code with: "Cell AB16: Excel shows X, Python shows Y"
   - Claude Code will debug that specific phase

6. FINANCING CELLS (BH*, BJ*, BL*):
   - These are quote-level calculations (not per-product)
   - Currently showing N/A - need to extract from calculation engine
   - Focus on BA16 and BB16 (financing distributed to product)

7. ACCEPTABLE TOLERANCE:
   - ±0.01 RUB for rounding differences
   - ±0.5% for intermediate calculations
   - Final price (AL16) should be exact or within 1 RUB
    """)
    
    print("=" * 120)
    print("\n✅ Calculation completed successfully!")
    print("\nNow compare each cell with your Excel file and report any mismatches.\n")
    
    return result


def compare_with_excel():
    """
    Instructions for comparing with Excel
    """
    print("\n" + "=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print("""
1. Go through the comparison table above row by row
2. Check each cell value in your Excel file
3. Report any mismatches found:
   
   Format: "Cell [CELL]: Excel=[VALUE], Python=[VALUE]"
   Example: "Cell AB16: Excel=11500.00, Python=11234.56"

4. If all values match: ✅ Report "All cells validated successfully!"

5. If issues found: Claude Code will debug the specific phase
    """)


if __name__ == "__main__":
    # Run test
    result = test_simple_quote()
    
    # Show comparison instructions
    compare_with_excel()