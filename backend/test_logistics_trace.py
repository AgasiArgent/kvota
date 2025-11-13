#!/usr/bin/env python3
"""
Trace the actual logistics calculation to find the discrepancy.
"""

import sys
from decimal import Decimal
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from excel_parser.quote_parser import ExcelQuoteParser
from validation.calculator_validator import CalculatorValidator, ValidationMode
import calculation_engine


def trace_calculation():
    """Trace the actual calculation"""

    # Parse Excel file
    excel_file = "/home/novi/workspace/tech/projects/kvota/dev/validation_data/test_raschet.xlsm"
    parser = ExcelQuoteParser(excel_file)
    excel_data = parser.parse()

    # Extract data
    quote_vars = excel_data.inputs["quote"]
    products_data = excel_data.inputs["products"]

    # Map to calculation inputs
    validator = CalculatorValidator(tolerance_rub=Decimal("2.0"), mode=ValidationMode.DETAILED)
    products_list = []
    for product_dict in products_data:
        calc_input = validator._map_to_calculation_input(product_dict, quote_vars)
        products_list.append(calc_input)

    print("Number of products:", len(products_list))
    print()

    # Run calculation
    print("Running calculation engine...")
    our_results = calculation_engine.calculate_multiproduct_quote(products_list)

    # Check first few products
    for i in range(min(3, len(our_results))):
        our = our_results[i]
        excel = excel_data.expected_results["products"][i]

        print(f"Product {i+1}:")
        print(f"  Our T16: {our.T16:.2f}")
        print(f"  Excel T16: {excel.get('T16', 'N/A')}")

        if excel.get('T16'):
            ratio = our.T16 / Decimal(str(excel['T16']))
            print(f"  Ratio (Our/Excel): {ratio:.2f}")

        print()

    # Check if the issue is that we're passing the total for each product
    # when we should distribute it
    first_excel_T16 = Decimal(str(excel_data.expected_results["products"][0]['T16']))
    first_our_T16 = our_results[0].T16

    print(f"Analysis:")
    print(f"  First product Excel T16: {first_excel_T16:.2f}")
    print(f"  First product Our T16: {first_our_T16:.2f}")
    print(f"  Ratio: {first_our_T16 / first_excel_T16:.2f}x")

    # Check total across all products
    total_excel_T16 = sum(
        Decimal(str(p.get('T16', 0)))
        for p in excel_data.expected_results["products"]
        if p.get('T16')
    )
    total_our_T16 = sum(r.T16 for r in our_results)

    print(f"\nTotals:")
    print(f"  Total Excel T16: {total_excel_T16:.2f}")
    print(f"  Total Our T16: {total_our_T16:.2f}")
    print(f"  Our total / Quote-level logistics: {total_our_T16 / 2000:.2f}")

    # The key insight
    if abs(total_our_T16 - 2000) < 100:  # Close to the quote-level value
        print("\n✅ INSIGHT: Our calculation correctly distributes the 2000 across all products!")
        print("The total of all T16 values equals the quote-level logistics cost.")
    else:
        print(f"\n❌ ISSUE: Total T16 ({total_our_T16:.2f}) doesn't match quote-level logistics (2000)")

    # Check if Excel is also distributing correctly
    print(f"\nExcel total T16 / Quote-level logistics: {total_excel_T16 / 2000:.2f}")

    if abs(total_excel_T16 - 2000) > 100:
        print("⚠️  Excel's total T16 doesn't match the quote-level logistics either!")
        print("This suggests Excel might be using a different value or calculation method.")


if __name__ == "__main__":
    trace_calculation()