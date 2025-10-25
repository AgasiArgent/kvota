"""
Tests for PDF Export Service (Session 23)
"""
import pytest
from decimal import Decimal
from datetime import datetime
from pdf_service import QuotePDFService
from services.export_data_mapper import ExportData


@pytest.fixture
def sample_export_data():
    """Create sample export data for testing"""
    return ExportData(
        quote={
            'id': 'test-quote-id',
            'quote_number': 'KP-2025-001',
            'created_at': datetime(2025, 10, 24, 10, 30, 0),
            'delivery_address': 'г. Москва, ул. Тверская, д. 12'
        },
        items=[
            {
                'id': 'item-1',
                'brand': 'SKF',
                'sku': '6205',
                'product_name': 'Bearing SKF 6205',
                'quantity': 10,
                'weight_in_kg': 0.5,
                'customs_code': '8482100009',
                'calculation_results': {
                    'purchase_price_no_vat': 1000.00,
                    'purchase_price_total_quote_currency': 95000.00,
                    'logistics_total': 5000.00,
                    'customs_fee': 5000.00,
                    'excise_tax': 0.00,
                    'util_fee': 0.00,
                    'transit_commission': 0.00,
                    'sales_price_per_unit': 12085.00,
                    'sales_price_total_no_vat': 120850.00,
                    'vat_amount': 24170.00,
                    'sales_price_per_unit_with_vat': 14502.00,
                    'sales_price_total_with_vat': 145020.00,
                    'import_tariff': 5
                }
            },
            {
                'id': 'item-2',
                'brand': 'FAG',
                'sku': '6206',
                'product_name': 'Bearing FAG 6206',
                'quantity': 5,
                'weight_in_kg': 0.6,
                'customs_code': '8482100009',
                'calculation_results': {
                    'purchase_price_no_vat': 1500.00,
                    'purchase_price_total_quote_currency': 142500.00,
                    'logistics_total': 7500.00,
                    'customs_fee': 7500.00,
                    'excise_tax': 0.00,
                    'util_fee': 0.00,
                    'transit_commission': 0.00,
                    'sales_price_per_unit': 18127.50,
                    'sales_price_total_no_vat': 90637.50,
                    'vat_amount': 18127.50,
                    'sales_price_per_unit_with_vat': 21753.00,
                    'sales_price_total_with_vat': 108765.00,
                    'import_tariff': 5
                }
            }
        ],
        customer={'name': 'ООО "ТОРГОВАЯ КОМПАНИЯ"', 'inn': '7707083893'},
        contact={'name': 'Иван Петров', 'phone': '+7 (495) 123-45-67', 'email': 'ivanov@company.ru'},
        manager={'name': 'Андрей Смирнов', 'phone': '+7 (495) 987-65-43', 'email': 'smirnov@seller.ru'},
        organization={'ceo_name': 'Петров Иван Иванович', 'ceo_title': 'Генеральный директор'},
        variables={
            'seller_company': 'МАСТЕР БЭРИНГ ООО',
            'offer_incoterms': 'DDP',
            'delivery_time': 60,
            'advance_from_client': 100,
            'currency_of_base_price': 'USD',
            'currency_of_quote': 'RUB'
        },
        calculations={
            'total_subtotal': 211487.50,
            'total_with_vat': 253785.00,
            'currency': 'RUB'
        }
    )


class TestPDFService:
    """Test PDF generation service"""

    def test_format_russian_currency(self):
        """Test Russian currency formatting"""
        # Test with Decimal
        assert QuotePDFService.format_russian_currency(Decimal('1234.56')) == "1 234,56 ₽"

        # Test with float
        assert QuotePDFService.format_russian_currency(1234.56) == "1 234,56 ₽"

        # Test with zero
        assert QuotePDFService.format_russian_currency(0) == "0,00 ₽"

        # Test with None
        assert QuotePDFService.format_russian_currency(None) == "0,00 ₽"

        # Test with large number
        assert QuotePDFService.format_russian_currency(1234567.89) == "1 234 567,89 ₽"

    def test_supply_pdf_generation(self, sample_export_data):
        """Test КП поставка PDF generation"""
        pdf_service = QuotePDFService()

        # Generate PDF
        pdf_bytes = pdf_service.generate_supply_pdf(sample_export_data)

        # Verify PDF was generated
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0

        # Check PDF header
        assert pdf_bytes[:4] == b'%PDF'

    def test_openbook_pdf_generation(self, sample_export_data):
        """Test КП open book PDF generation"""
        pdf_service = QuotePDFService()

        # Generate PDF
        pdf_bytes = pdf_service.generate_openbook_pdf(sample_export_data)

        # Verify PDF was generated
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0

        # Check PDF header
        assert pdf_bytes[:4] == b'%PDF'

    def test_supply_letter_pdf_generation(self, sample_export_data):
        """Test КП поставка письмо PDF generation"""
        pdf_service = QuotePDFService()

        # Generate PDF
        pdf_bytes = pdf_service.generate_supply_letter_pdf(sample_export_data)

        # Verify PDF was generated
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0

        # Check PDF header
        assert pdf_bytes[:4] == b'%PDF'

    def test_openbook_letter_pdf_generation(self, sample_export_data):
        """Test КП open book письмо PDF generation"""
        pdf_service = QuotePDFService()

        # Generate PDF
        pdf_bytes = pdf_service.generate_openbook_letter_pdf(sample_export_data)

        # Verify PDF was generated
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0

        # Check PDF header
        assert pdf_bytes[:4] == b'%PDF'

    def test_pdf_with_missing_data(self):
        """Test PDF generation with minimal/missing data"""
        # Create minimal export data
        minimal_data = ExportData(
            quote={'id': 'test', 'quote_number': 'KP-001', 'created_at': datetime.now()},
            items=[],
            customer=None,
            contact=None,
            manager=None,
            organization={},
            variables={},
            calculations={'total_subtotal': 0, 'total_with_vat': 0, 'currency': 'RUB'}
        )

        pdf_service = QuotePDFService()

        # Should still generate without errors
        pdf_bytes = pdf_service.generate_supply_pdf(minimal_data)
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0

    def test_pdf_with_special_characters(self, sample_export_data):
        """Test PDF generation with Russian special characters"""
        # Add special characters to test data
        sample_export_data.customer['name'] = 'ООО "КОМПАНИЯ №1" (Москва)'
        sample_export_data.items[0]['product_name'] = 'Подшипник "Премиум" №6205/2RS'

        pdf_service = QuotePDFService()

        # Should handle special characters without errors
        pdf_bytes = pdf_service.generate_supply_pdf(sample_export_data)
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 0

    def test_all_pdf_formats_use_export_data(self, sample_export_data):
        """Test that all 4 PDF formats work with ExportData"""
        pdf_service = QuotePDFService()

        formats = [
            ('supply', pdf_service.generate_supply_pdf),
            ('openbook', pdf_service.generate_openbook_pdf),
            ('supply_letter', pdf_service.generate_supply_letter_pdf),
            ('openbook_letter', pdf_service.generate_openbook_letter_pdf)
        ]

        for format_name, generator_method in formats:
            pdf_bytes = generator_method(sample_export_data)

            # Verify PDF was generated
            assert pdf_bytes is not None, f"{format_name} failed to generate PDF"
            assert len(pdf_bytes) > 0, f"{format_name} generated empty PDF"
            assert pdf_bytes[:4] == b'%PDF', f"{format_name} did not generate valid PDF"
