import pytest
from decimal import Decimal
from validation.report_generator import ReportGenerator
from validation.calculator_validator import (
    ValidationMode,
    ValidationResult,
    ProductComparison,
    FieldComparison
)


@pytest.fixture
def mock_results():
    """Mock validation results for testing"""
    # Create field comparisons
    field_comps_passed = [
        FieldComparison(
            field="AK16",
            field_name="Final Price Total",
            our_value=Decimal("125000.00"),
            excel_value=Decimal("124998.00"),
            difference=Decimal("2.00"),
            passed=True,
            phase="Phase 11: Sales Price"
        ),
        FieldComparison(
            field="AM16",
            field_name="Price with VAT",
            our_value=Decimal("150000.00"),
            excel_value=Decimal("149998.00"),
            difference=Decimal("2.00"),
            passed=True,
            phase="Phase 12: VAT"
        ),
        FieldComparison(
            field="AQ16",
            field_name="Profit",
            our_value=Decimal("26500.00"),
            excel_value=Decimal("26498.00"),
            difference=Decimal("2.00"),
            passed=True,
            phase="Phase 13: Profit"
        ),
    ]

    field_comps_failed = [
        FieldComparison(
            field="AK16",
            field_name="Final Price Total",
            our_value=Decimal("125000.00"),
            excel_value=Decimal("120000.00"),
            difference=Decimal("5000.00"),
            passed=False,
            phase="Phase 11: Sales Price"
        ),
        FieldComparison(
            field="AM16",
            field_name="Price with VAT",
            our_value=Decimal("150000.00"),
            excel_value=Decimal("144000.00"),
            difference=Decimal("6000.00"),
            passed=False,
            phase="Phase 12: VAT"
        ),
        FieldComparison(
            field="AQ16",
            field_name="Profit",
            our_value=Decimal("26500.00"),
            excel_value=Decimal("26498.00"),
            difference=Decimal("2.00"),
            passed=True,
            phase="Phase 13: Profit"
        ),
    ]

    # Create product comparisons
    product_passed = ProductComparison(
        product_index=0,
        passed=True,
        max_deviation=Decimal("2.00"),
        field_comparisons=field_comps_passed
    )

    product_failed = ProductComparison(
        product_index=0,
        passed=False,
        max_deviation=Decimal("6000.00"),
        field_comparisons=field_comps_failed
    )

    # Create validation results
    result_passed = ValidationResult(
        mode=ValidationMode.SUMMARY,
        passed=True,
        comparisons=[product_passed],
        max_deviation=Decimal("2.00"),
        failed_fields=[],
        excel_file="test_passed.xlsx",
        total_products=1,
        fields_checked=3
    )

    result_failed = ValidationResult(
        mode=ValidationMode.SUMMARY,
        passed=False,
        comparisons=[product_failed],
        max_deviation=Decimal("6000.00"),
        failed_fields=["AK16", "AM16"],
        excel_file="test_failed.xlsx",
        total_products=1,
        fields_checked=3
    )

    return [result_passed, result_failed]


def test_generate_html_report(mock_results):
    """Test HTML report generation"""
    generator = ReportGenerator()
    html = generator.generate_html_report(mock_results, ValidationMode.SUMMARY)

    # Basic HTML structure
    assert "<html>" in html
    assert "</html>" in html
    assert "<head>" in html
    assert "<body>" in html

    # Report header
    assert "Validation Report" in html
    assert "SUMMARY" in html

    # Summary statistics
    assert "Total Files" in html
    assert "Passed" in html
    assert "Failed" in html
    assert "Pass Rate" in html

    # Summary values (2 files, 1 passed, 1 failed)
    assert "2" in html  # total
    assert "1" in html  # passed
    assert "50.0%" in html  # pass rate

    # Results table
    assert "<table>" in html
    assert "test_passed.xlsx" in html
    assert "test_failed.xlsx" in html

    # Status indicators
    assert "PASSED" in html or "✅" in html
    assert "FAILED" in html or "❌" in html

    # Failed fields
    assert "AK16" in html
    assert "AM16" in html

    # Styling
    assert "color" in html.lower() or "background" in html.lower()


def test_generate_html_report_empty():
    """Test HTML report with no results"""
    generator = ReportGenerator()
    html = generator.generate_html_report([], ValidationMode.SUMMARY)

    assert "<html>" in html
    assert "Validation Report" in html
    assert "0" in html  # total = 0


def test_generate_html_report_detailed_mode(mock_results):
    """Test HTML report in detailed mode"""
    generator = ReportGenerator()
    html = generator.generate_html_report(mock_results, ValidationMode.DETAILED)

    assert "DETAILED" in html
    assert "Validation Report" in html


def test_generate_html_report_has_timestamp(mock_results):
    """Test that report includes generation timestamp"""
    generator = ReportGenerator()
    html = generator.generate_html_report(mock_results, ValidationMode.SUMMARY)

    assert "Generated:" in html
    # Check for date-like pattern (YYYY-MM-DD or similar)
    import re
    assert re.search(r'\d{4}', html)  # Has year
