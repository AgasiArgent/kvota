import pytest
from pathlib import Path
from excel_parser.quote_parser import ExcelQuoteParser

@pytest.fixture
def sample_excel_path():
    return Path(__file__).parent.parent / "fixtures" / "sample_quote.xlsx"

def test_find_calculation_sheet_by_name(sample_excel_path):
    """Test that parser finds sheet named 'Расчет'"""
    parser = ExcelQuoteParser(str(sample_excel_path))

    assert parser.sheet is not None
    assert parser.sheet.title in ["Расчет", "расчет", "Расчёт"]
