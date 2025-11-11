import pytest
from decimal import Decimal
from validation.calculator_validator import (
    CalculatorValidator,
    ValidationMode,
    ValidationResult
)
from excel_parser.quote_parser import QuoteData

@pytest.fixture
def mock_excel_data():
    """Mock parsed Excel data"""
    return QuoteData(
        filename="test.xlsx",
        sheet_name="Расчет",
        inputs={
            "quote": {"seller_company": "Test", "currency_of_quote": "RUB"},
            "products": [{"quantity": 100, "base_price_VAT": 50.0}]
        },
        expected_results={
            "products": [{
                "AK16": Decimal("125000.00"),
                "AM16": Decimal("150000.00"),
                "AQ16": Decimal("26500.00")
            }]
        }
    )

def test_summary_mode_validation(mock_excel_data, mocker):
    """Test validation in summary mode"""
    # Mock calculation engine
    mocker.patch(
        'validation.calculator_validator.calculation_engine.calculate_multiproduct_quote',
        return_value=[{
            "AK16": Decimal("124998.00"),
            "AM16": Decimal("149998.00"),
            "AQ16": Decimal("26498.00")
        }]
    )

    validator = CalculatorValidator(
        tolerance_rub=Decimal("2.0"),
        mode=ValidationMode.SUMMARY
    )

    result = validator.validate_quote(mock_excel_data)

    assert isinstance(result, ValidationResult)
    assert result.passed is True
    assert result.max_deviation <= Decimal("2.0")  # Within tolerance
