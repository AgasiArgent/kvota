"""
Shared fixtures and helpers for Excel validation tests.
Tolerance settings and assertion helpers for comparing Python vs Excel values.
"""
import pytest
from decimal import Decimal
from typing import Union


# Tolerance settings
# 0.1% relative tolerance OR 0.01 absolute (for rounding differences)
RELATIVE_TOLERANCE = Decimal("0.001")  # 0.1%
ABSOLUTE_TOLERANCE = Decimal("0.01")   # 0.01 absolute


def assert_close(
    actual: Union[Decimal, float],
    expected: Union[Decimal, float],
    field_name: str = "",
    rtol: Decimal = RELATIVE_TOLERANCE,
    atol: Decimal = ABSOLUTE_TOLERANCE
) -> None:
    """
    Assert that actual value matches expected within tolerance.

    Uses the larger of:
    - Relative tolerance (0.1% of expected)
    - Absolute tolerance (0.01 for rounding)

    Args:
        actual: Calculated value from Python
        expected: Expected value from Excel
        field_name: Name of field for error message
        rtol: Relative tolerance (default 0.1%)
        atol: Absolute tolerance (default 0.01)

    Raises:
        AssertionError: If values differ beyond tolerance
    """
    # Convert to Decimal for precision
    actual_dec = Decimal(str(actual)) if not isinstance(actual, Decimal) else actual
    expected_dec = Decimal(str(expected)) if not isinstance(expected, Decimal) else expected

    # Calculate difference
    diff = abs(actual_dec - expected_dec)

    # Threshold is max of relative or absolute tolerance
    rel_threshold = abs(expected_dec) * rtol if expected_dec != 0 else Decimal("0")
    threshold = max(atol, rel_threshold)

    # Build error message
    field_info = f" [{field_name}]" if field_name else ""
    assert diff <= threshold, (
        f"Value mismatch{field_info}: "
        f"expected {expected_dec}, got {actual_dec}, "
        f"diff={diff}, threshold={threshold}"
    )


def assert_all_close(
    result,
    expected: dict,
    field_mapping: dict
) -> None:
    """
    Assert all mapped fields match expected values.

    Args:
        result: ProductCalculationResult object
        expected: Dict of Excel cell -> expected value
        field_mapping: Dict of Excel cell -> Python attribute name

    Example:
        field_mapping = {
            "S16": "purchase_price_total_quote_currency",
            "AB16": "cogs_per_product",
        }
        assert_all_close(result, product["expected"], field_mapping)
    """
    errors = []

    for excel_cell, python_attr in field_mapping.items():
        if excel_cell not in expected:
            continue

        expected_val = expected[excel_cell]
        actual_val = getattr(result, python_attr, None)

        if actual_val is None:
            errors.append(f"{excel_cell} ({python_attr}): attribute not found")
            continue

        try:
            assert_close(actual_val, expected_val, f"{excel_cell}={python_attr}")
        except AssertionError as e:
            errors.append(str(e))

    if errors:
        raise AssertionError(
            f"Found {len(errors)} mismatches:\n" + "\n".join(errors)
        )


# Standard field mapping: Excel cell -> Python attribute
PRODUCT_FIELD_MAPPING = {
    # Phase 1: Purchase Price
    "N16": "purchase_price_no_vat",
    "P16": "purchase_price_after_discount",
    "R16": "purchase_price_per_unit_quote_currency",
    "S16": "purchase_price_total_quote_currency",

    # Phase 2: Distribution
    "BD16": "distribution_base",

    # Phase 2.5: Internal Pricing
    "AX16": "internal_sale_price_per_unit",
    "AY16": "internal_sale_price_total",

    # Phase 3: Logistics
    "T16": "logistics_first_leg",
    "U16": "logistics_last_leg",
    "V16": "logistics_total",

    # Phase 4: Duties
    "Y16": "customs_fee",
    "Z16": "excise_tax_amount",

    # Phase 9: Financing Distribution
    "BA16": "financing_cost_initial",
    "BB16": "financing_cost_credit",

    # Phase 10: COGS
    "AA16": "cogs_per_unit",
    "AB16": "cogs_per_product",

    # Phase 11: Sales Price
    "AD16": "sale_price_per_unit_excl_financial",
    "AE16": "sale_price_total_excl_financial",
    "AF16": "profit",
    "AG16": "dm_fee",
    "AH16": "forex_reserve",
    "AI16": "financial_agent_fee",
    "AJ16": "sales_price_per_unit_no_vat",
    "AK16": "sales_price_total_no_vat",

    # Phase 12: VAT
    "AL16": "sales_price_total_with_vat",
    "AM16": "sales_price_per_unit_with_vat",
    "AN16": "vat_from_sales",
    "AO16": "vat_on_import",
    "AP16": "vat_net_payable",

    # Phase 13: Transit
    "AQ16": "transit_commission",
}


@pytest.fixture
def field_mapping():
    """Provide standard field mapping for tests."""
    return PRODUCT_FIELD_MAPPING
