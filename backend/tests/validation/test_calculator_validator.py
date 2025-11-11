"""Test CalculatorValidator functionality

Note: This test verifies the validator's mapping logic works correctly.
For real calculation validation, see test_excel_validation_e2e.py which uses actual Excel files.
"""
import pytest
from decimal import Decimal
from validation.calculator_validator import (
    CalculatorValidator,
    ValidationMode,
    ValidationResult,
    EXCEL_TO_MODEL_FIELD_MAP
)
from excel_parser.quote_parser import QuoteData
from calculation_models import ProductCalculationResult


def test_field_mapping_correctness():
    """Verify EXCEL_TO_MODEL_FIELD_MAP points to valid ProductCalculationResult fields"""

    # Get all valid fields from the model
    valid_fields = set(ProductCalculationResult.model_fields.keys())

    # Check each mapping
    for excel_cell, model_field in EXCEL_TO_MODEL_FIELD_MAP.items():
        assert model_field in valid_fields, (
            f"Mapping error: {excel_cell} → {model_field} (field doesn't exist in ProductCalculationResult)"
        )


def test_critical_mappings():
    """Test that critical field mappings are correct (from code review fixes)"""

    # AQ16 should map to transit_commission (NOT profit)
    assert EXCEL_TO_MODEL_FIELD_MAP["AQ16"] == "transit_commission"

    # AM16 should map to sales_price_per_unit_with_vat (NOT sales_price_total_with_vat)
    assert EXCEL_TO_MODEL_FIELD_MAP["AM16"] == "sales_price_per_unit_with_vat"

    # AK16 should map to sales_price_total_no_vat
    assert EXCEL_TO_MODEL_FIELD_MAP["AK16"] == "sales_price_total_no_vat"


def test_validator_initialization():
    """Test validator can be initialized with different modes"""

    # Summary mode
    validator_summary = CalculatorValidator(
        tolerance_rub=Decimal("2.0"),
        mode=ValidationMode.SUMMARY
    )
    assert validator_summary.mode == ValidationMode.SUMMARY
    assert validator_summary.tolerance == Decimal("2.0")

    # Detailed mode
    validator_detailed = CalculatorValidator(
        tolerance_rub=Decimal("1.0"),
        mode=ValidationMode.DETAILED
    )
    assert validator_detailed.mode == ValidationMode.DETAILED
    assert validator_detailed.tolerance == Decimal("1.0")
