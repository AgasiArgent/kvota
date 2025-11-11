import pytest
from pathlib import Path
import glob
from decimal import Decimal

from excel_parser.quote_parser import ExcelQuoteParser
from validation.calculator_validator import CalculatorValidator, ValidationMode

# Collect all Excel files (.xlsx and .xlsm)
VALIDATION_DIR = Path(__file__).parent.parent.parent.parent / "validation_data"
excel_files = glob.glob(str(VALIDATION_DIR / "*.xlsx")) + glob.glob(str(VALIDATION_DIR / "*.xlsm"))

@pytest.fixture
def validator_summary():
    return CalculatorValidator(
        tolerance_rub=Decimal("2.0"),
        mode=ValidationMode.SUMMARY
    )

@pytest.fixture
def validator_detailed():
    return CalculatorValidator(
        tolerance_rub=Decimal("2.0"),
        mode=ValidationMode.DETAILED
    )

@pytest.mark.parametrize("excel_path", excel_files, ids=lambda p: Path(p).name)
def test_excel_validation_summary(excel_path, validator_summary):
    """Test calculation matches Excel (summary mode)"""

    # Parse Excel
    parser = ExcelQuoteParser(excel_path)
    excel_data = parser.parse()

    # Validate
    result = validator_summary.validate_quote(excel_data)

    # Assert
    assert result.passed, (
        f"\n❌ Validation failed for {excel_data.filename}\n"
        f"Max deviation: {result.max_deviation:.2f} ₽\n"
        f"Failed fields: {', '.join(result.failed_fields)}"
    )

@pytest.mark.detailed
@pytest.mark.parametrize("excel_path", excel_files, ids=lambda p: Path(p).name)
def test_excel_validation_detailed(excel_path, validator_detailed):
    """Test ALL phases match Excel (detailed mode)"""

    parser = ExcelQuoteParser(excel_path)
    excel_data = parser.parse()
    result = validator_detailed.validate_quote(excel_data)

    if not result.passed:
        error_details = []
        for comp in result.comparisons:
            if not comp.passed:
                error_details.append(f"\nProduct {comp.product_index + 1}:")
                for fc in comp.field_comparisons:
                    if not fc.passed:
                        error_details.append(
                            f"  {fc.field} ({fc.field_name}): "
                            f"{fc.our_value:.2f} vs {fc.excel_value:.2f} "
                            f"(diff: {fc.difference:.2f} ₽)"
                        )

        assert False, (
            f"\n❌ Detailed validation failed for {excel_data.filename}\n"
            + "\n".join(error_details)
        )

def test_overall_accuracy(validator_summary):
    """Test overall accuracy across all files"""

    results = []
    for excel_path in excel_files:
        parser = ExcelQuoteParser(excel_path)
        excel_data = parser.parse()
        result = validator_summary.validate_quote(excel_data)
        results.append(result)

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    pass_rate = (passed / total * 100) if total > 0 else 0
    avg_dev = sum(r.max_deviation for r in results) / total if total > 0 else 0

    assert pass_rate >= 95.0, f"Pass rate {pass_rate:.1f}% below 95% threshold"
    assert avg_dev < Decimal("1.0"), f"Avg deviation {avg_dev:.2f} ₽ above 1 ₽"
