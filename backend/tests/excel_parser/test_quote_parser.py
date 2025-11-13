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

def test_extract_quote_level_variables(sample_excel_path):
    """Test extraction of quote-level variables"""
    parser = ExcelQuoteParser(str(sample_excel_path))
    data = parser.parse()

    assert "quote" in data.inputs
    assert data.inputs["quote"]["seller_company"] is not None
    assert data.inputs["quote"]["currency_of_quote"] in ["RUB", "USD", "EUR"]

def test_extract_products(sample_excel_path):
    """Test extraction of product rows"""
    parser = ExcelQuoteParser(str(sample_excel_path))
    data = parser.parse()

    assert "products" in data.inputs
    assert len(data.inputs["products"]) > 0

    product = data.inputs["products"][0]
    assert "quantity" in product
    assert "base_price_VAT" in product
    assert product["quantity"] > 0
