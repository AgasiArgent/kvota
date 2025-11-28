"""
Unit tests for SimplifiedExcelParser

Tests the parsing of simplified Excel templates (template_quote_input_v5.xlsx format).
"""

import pytest
from pathlib import Path
from decimal import Decimal

from excel_parser.simplified_parser import (
    SimplifiedExcelParser,
    SimplifiedQuoteInput,
    ProductInput,
    PaymentMilestone,
    MonetaryValue,
    Currency,
    parse_simplified_template,
)


@pytest.fixture
def template_v5_path():
    """Path to the v5 template file"""
    return Path(__file__).parent.parent.parent.parent / "validation_data" / "template_quote_input_v5.xlsx"


@pytest.fixture
def parser(template_v5_path):
    """Initialize parser with v5 template"""
    return SimplifiedExcelParser(str(template_v5_path))


class TestParserInitialization:
    """Tests for parser initialization and sheet finding"""

    def test_parser_loads_workbook(self, template_v5_path):
        """Parser should load Excel workbook without error"""
        parser = SimplifiedExcelParser(str(template_v5_path))
        assert parser.workbook is not None

    def test_parser_finds_sheet(self, parser):
        """Parser should find 'Котировка' sheet or use active sheet"""
        assert parser.sheet is not None

    def test_parser_accepts_file_path(self, template_v5_path):
        """Parser should accept file path string"""
        parser = SimplifiedExcelParser(str(template_v5_path))
        assert parser.sheet is not None

    def test_parser_accepts_bytes(self, template_v5_path):
        """Parser should accept BytesIO object"""
        import io
        with open(template_v5_path, 'rb') as f:
            content = f.read()

        file_stream = io.BytesIO(content)
        parser = SimplifiedExcelParser(file_stream)
        assert parser.sheet is not None


class TestQuoteSettings:
    """Tests for quote settings parsing (Section A: НАСТРОЙКИ КОТИРОВКИ)"""

    def test_parse_returns_quote_input(self, parser):
        """parse() should return SimplifiedQuoteInput"""
        result = parser.parse()
        assert isinstance(result, SimplifiedQuoteInput)

    def test_seller_company_parsed(self, parser):
        """seller_company should be parsed from B2"""
        result = parser.parse()
        assert result.seller_company is not None
        # Default in template is МАСТЕР БЭРИНГ ООО
        assert "МАСТЕР БЭРИНГ" in result.seller_company or result.seller_company != ""

    def test_sale_type_parsed(self, parser):
        """sale_type should be parsed from B3"""
        result = parser.parse()
        # Should be one of the enum values
        assert result.sale_type in ["поставка", "транзит", "финтранзит", "экспорт"]

    def test_incoterms_parsed(self, parser):
        """incoterms should be parsed from B4"""
        result = parser.parse()
        assert result.incoterms in ["DDP", "DAP", "CIF", "FOB", "EXW"]

    def test_quote_currency_parsed(self, parser):
        """quote_currency should be parsed from B5"""
        result = parser.parse()
        assert isinstance(result.quote_currency, Currency)
        assert result.quote_currency in [Currency.USD, Currency.EUR, Currency.RUB, Currency.TRY, Currency.CNY]

    def test_delivery_days_parsed(self, parser):
        """delivery_days should be parsed from B6"""
        result = parser.parse()
        assert isinstance(result.delivery_days, int)
        assert result.delivery_days > 0

    def test_advance_to_supplier_parsed(self, parser):
        """advance_to_supplier should be parsed from B7"""
        result = parser.parse()
        assert isinstance(result.advance_to_supplier, Decimal)
        assert Decimal("0") <= result.advance_to_supplier <= Decimal("100")


class TestPaymentMilestones:
    """Tests for payment milestones parsing (Section D: УСЛОВИЯ ОПЛАТЫ)"""

    def test_payment_milestones_list(self, parser):
        """payment_milestones should be a list"""
        result = parser.parse()
        assert isinstance(result.payment_milestones, list)
        assert len(result.payment_milestones) == 5  # 5 milestones in template

    def test_payment_milestones_sum_100(self, parser):
        """Payment milestone percentages should sum to 100%"""
        result = parser.parse()
        total = sum(m.percentage for m in result.payment_milestones)
        assert abs(total - Decimal("100")) < Decimal("0.01")

    def test_milestone_structure(self, parser):
        """Each milestone should have name, percentage, and optional days"""
        result = parser.parse()
        for milestone in result.payment_milestones:
            assert isinstance(milestone, PaymentMilestone)
            assert milestone.name is not None
            assert isinstance(milestone.percentage, Decimal)

    def test_milestone_names(self, parser):
        """Milestones should have expected names"""
        result = parser.parse()
        expected_names = [
            "advance_from_client",
            "advance_on_loading",
            "advance_on_shipping",
            "advance_on_customs",
            "on_receiving"
        ]
        actual_names = [m.name for m in result.payment_milestones]
        assert actual_names == expected_names


class TestLogistics:
    """Tests for logistics parsing (Section H: ЛОГИСТИКА)"""

    def test_logistics_supplier_hub(self, parser):
        """logistics_supplier_hub should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.logistics_supplier_hub, MonetaryValue)
        assert isinstance(result.logistics_supplier_hub.value, Decimal)
        assert isinstance(result.logistics_supplier_hub.currency, Currency)

    def test_logistics_hub_customs(self, parser):
        """logistics_hub_customs should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.logistics_hub_customs, MonetaryValue)

    def test_logistics_customs_client(self, parser):
        """logistics_customs_client should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.logistics_customs_client, MonetaryValue)
        # Default currency for last leg is RUB
        # (can be EUR in template, but validation should work either way)


class TestBrokerage:
    """Tests for brokerage services parsing (Section H: БРОКЕРСКИЕ УСЛУГИ)"""

    def test_brokerage_hub(self, parser):
        """brokerage_hub should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.brokerage_hub, MonetaryValue)

    def test_brokerage_customs(self, parser):
        """brokerage_customs should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.brokerage_customs, MonetaryValue)

    def test_warehousing(self, parser):
        """warehousing should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.warehousing, MonetaryValue)

    def test_documentation(self, parser):
        """documentation should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.documentation, MonetaryValue)

    def test_other_costs(self, parser):
        """other_costs should be MonetaryValue"""
        result = parser.parse()
        assert isinstance(result.other_costs, MonetaryValue)


class TestLPR:
    """Tests for LPR/DM fee parsing (Section D: ВОЗНАГРАЖДЕНИЕ ЛПР)"""

    def test_dm_fee_type(self, parser):
        """dm_fee_type should be parsed"""
        result = parser.parse()
        assert result.dm_fee_type in ["% от суммы", "фикс. сумма"]

    def test_dm_fee_value(self, parser):
        """dm_fee_value should be Decimal"""
        result = parser.parse()
        assert isinstance(result.dm_fee_value, Decimal)
        assert result.dm_fee_value >= Decimal("0")


class TestProducts:
    """Tests for products parsing (Section A: ТОВАРЫ)"""

    def test_products_list(self, parser):
        """products should be a list of ProductInput"""
        result = parser.parse()
        assert isinstance(result.products, list)
        # Template has sample products
        assert len(result.products) > 0

    def test_product_structure(self, parser):
        """Each product should have required fields"""
        result = parser.parse()
        for product in result.products:
            assert isinstance(product, ProductInput)
            assert product.name is not None
            assert isinstance(product.quantity, int)
            assert product.quantity > 0
            assert isinstance(product.base_price_vat, Decimal)
            assert product.base_price_vat > 0
            assert isinstance(product.currency, Currency)

    def test_product_optional_fields(self, parser):
        """Products should have optional fields with defaults"""
        result = parser.parse()
        for product in result.products:
            # These have default values
            assert isinstance(product.supplier_discount, Decimal)
            assert isinstance(product.markup, Decimal)

    def test_product_currencies(self, parser):
        """Product currencies should be valid"""
        result = parser.parse()
        for product in result.products:
            assert product.currency in [
                Currency.USD, Currency.EUR, Currency.RUB,
                Currency.TRY, Currency.CNY
            ]


class TestConvenienceFunction:
    """Tests for parse_simplified_template convenience function"""

    def test_convenience_function(self, template_v5_path):
        """parse_simplified_template should work like parser.parse()"""
        result = parse_simplified_template(str(template_v5_path))
        assert isinstance(result, SimplifiedQuoteInput)
        assert len(result.products) > 0

    def test_convenience_function_with_bytes(self, template_v5_path):
        """parse_simplified_template should accept BytesIO"""
        import io
        with open(template_v5_path, 'rb') as f:
            content = f.read()

        file_stream = io.BytesIO(content)
        result = parse_simplified_template(file_stream)
        assert isinstance(result, SimplifiedQuoteInput)


class TestErrorHandling:
    """Tests for error handling"""

    def test_invalid_file_raises_error(self, tmp_path):
        """Parser should raise error for invalid file"""
        invalid_file = tmp_path / "invalid.xlsx"
        invalid_file.write_bytes(b"not an excel file")

        with pytest.raises(Exception):
            parser = SimplifiedExcelParser(str(invalid_file))
            parser.parse()
