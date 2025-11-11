"""Test Excel field mapping validation

Ensures EXCEL_TO_MODEL_FIELD_MAP uses valid ProductCalculationResult fields.
Prevents mapping errors like AQ16 → wrong field.
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from validation.calculator_validator import EXCEL_TO_MODEL_FIELD_MAP
from calculation_models import ProductCalculationResult
import pytest


def test_all_mapped_fields_exist_in_model():
    """Verify all EXCEL_TO_MODEL_FIELD_MAP values are valid ProductCalculationResult fields"""

    # Get all field names from ProductCalculationResult
    valid_fields = set(ProductCalculationResult.model_fields.keys())

    # Check each mapped field
    invalid_mappings = []
    for excel_cell, model_field in EXCEL_TO_MODEL_FIELD_MAP.items():
        if model_field not in valid_fields:
            invalid_mappings.append(f"{excel_cell} → {model_field}")

    # Assert no invalid mappings
    assert not invalid_mappings, (
        f"Invalid field mappings found:\n" +
        "\n".join(f"  - {m}" for m in invalid_mappings) +
        f"\n\nValid fields: {sorted(valid_fields)}"
    )


def test_critical_field_mappings():
    """Test specific critical mappings that were previously wrong"""

    # AQ16 should map to transit_commission (NOT profit)
    assert EXCEL_TO_MODEL_FIELD_MAP["AQ16"] == "transit_commission", (
        "AQ16 should map to 'transit_commission' (AF16 = profit, AQ16 = transit_commission)"
    )

    # AM16 should map to sales_price_per_unit_with_vat (NOT sales_price_total_with_vat)
    assert EXCEL_TO_MODEL_FIELD_MAP["AM16"] == "sales_price_per_unit_with_vat", (
        "AM16 should map to 'sales_price_per_unit_with_vat' "
        "(AM16 = per-unit, AL16 = total)"
    )

    # AK16 should map to sales_price_total_no_vat (this was correct)
    assert EXCEL_TO_MODEL_FIELD_MAP["AK16"] == "sales_price_total_no_vat", (
        "AK16 should map to 'sales_price_total_no_vat'"
    )


def test_no_duplicate_excel_cells():
    """Ensure no Excel cell is mapped twice"""

    cells = list(EXCEL_TO_MODEL_FIELD_MAP.keys())
    unique_cells = set(cells)

    assert len(cells) == len(unique_cells), (
        f"Duplicate Excel cells found: {[c for c in cells if cells.count(c) > 1]}"
    )


def test_mapping_coverage():
    """Verify we have mappings for all commonly used fields"""

    # Critical fields that should always be mapped
    required_cells = ["AK16", "AM16", "AQ16"]

    missing = [cell for cell in required_cells if cell not in EXCEL_TO_MODEL_FIELD_MAP]

    assert not missing, f"Missing required field mappings: {missing}"
