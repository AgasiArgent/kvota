"""
Tests for Financial Review Excel Export Service
Following TDD approach: Write failing test → Implement → Test passes
"""
import pytest
from decimal import Decimal
from services.financial_review_export import create_financial_review_excel


def test_creates_excel_with_quote_data():
    """Test basic Excel creation with quote data"""
    quote_data = {
        'quote_number': 'KP-2025-001',
        'customer_name': 'Test Customer',
        'total_amount': Decimal('10000.00'),
        'markup': Decimal('15.0'),
        'rate_forex_risk': Decimal('3.0'),
        'dm_fee_value': Decimal('1000.00'),
        'products': []
    }

    workbook = create_financial_review_excel(quote_data)

    assert workbook is not None
    assert 'Review' in workbook.sheetnames
    sheet = workbook['Review']
    assert sheet['A1'].value == 'Financial Review'


def test_vat_summary_all_products_removed():
    """Test VAT summary when all products have VAT removed (K16 ≠ N16)"""
    quote_data = {
        'quote_number': 'КП25-TEST',
        'customer_name': 'Test Customer',
        'total_amount': Decimal('10000.00'),
        'products': [
            {
                'name': 'Product 1',
                'supplier_country': 'TR',
                'base_price_vat': Decimal('1000.00'),  # K16
                'calc_n16_price_without_vat': Decimal('847.46'),  # N16 (VAT removed)
                'quantity': 10,
            },
            {
                'name': 'Product 2',
                'supplier_country': 'EU',
                'base_price_vat': Decimal('500.00'),  # K16
                'calc_n16_price_without_vat': Decimal('423.73'),  # N16 (VAT removed)
                'quantity': 5,
            },
        ]
    }

    wb = create_financial_review_excel(quote_data)
    ws = wb.active

    # Find VAT summary row (search for "НДС очищен на:")
    vat_summary_found = False
    for row in ws.iter_rows(min_row=1, max_row=30):
        if row[0].value == 'НДС очищен на:':
            assert row[1].value == '2 из 2 продуктов'
            vat_summary_found = True
            break

    assert vat_summary_found, "VAT summary row not found"


def test_vat_summary_partial_removal():
    """Test VAT summary when only some products have VAT removed"""
    quote_data = {
        'quote_number': 'КП25-TEST',
        'customer_name': 'Test Customer',
        'total_amount': Decimal('10000.00'),
        'products': [
            {
                'name': 'Product 1 Turkey',
                'supplier_country': 'TR',
                'base_price_vat': Decimal('1000.00'),  # K16
                'calc_n16_price_without_vat': Decimal('847.46'),  # N16 (VAT removed)
                'quantity': 10,
            },
            {
                'name': 'Product 2 China',
                'supplier_country': 'CN',
                'base_price_vat': Decimal('500.00'),  # K16
                'calc_n16_price_without_vat': Decimal('500.00'),  # N16 (same - no VAT)
                'quantity': 5,
            },
            {
                'name': 'Product 3 Turkey',
                'supplier_country': 'TR',
                'base_price_vat': Decimal('800.00'),  # K16
                'calc_n16_price_without_vat': Decimal('677.97'),  # N16 (VAT removed)
                'quantity': 8,
            },
        ]
    }

    wb = create_financial_review_excel(quote_data)
    ws = wb.active

    # Find VAT summary row
    vat_summary_found = False
    for row in ws.iter_rows(min_row=1, max_row=30):
        if row[0].value == 'НДС очищен на:':
            assert row[1].value == '2 из 3 продуктов'
            vat_summary_found = True
            break

    assert vat_summary_found, "VAT summary row not found"


def test_vat_summary_no_removal():
    """Test VAT summary when no products have VAT removed (all China)"""
    quote_data = {
        'quote_number': 'КП25-TEST',
        'customer_name': 'Test Customer',
        'total_amount': Decimal('10000.00'),
        'products': [
            {
                'name': 'Product 1 China',
                'supplier_country': 'CN',
                'base_price_vat': Decimal('1000.00'),  # K16
                'calc_n16_price_without_vat': Decimal('1000.00'),  # N16 (same)
                'quantity': 10,
            },
            {
                'name': 'Product 2 China',
                'supplier_country': 'CN',
                'base_price_vat': Decimal('500.00'),  # K16
                'calc_n16_price_without_vat': Decimal('500.00'),  # N16 (same)
                'quantity': 5,
            },
        ]
    }

    wb = create_financial_review_excel(quote_data)
    ws = wb.active

    # Find VAT summary row
    vat_summary_found = False
    for row in ws.iter_rows(min_row=1, max_row=30):
        if row[0].value == 'НДС очищен на:':
            assert row[1].value == '0 из 2 продуктов'
            vat_summary_found = True
            break

    assert vat_summary_found, "VAT summary row not found"


def test_vat_summary_calculation_logic():
    """Verify VAT removal detection uses correct formula: K16 != N16"""
    quote_data = {
        'quote_number': 'КП25-TEST',
        'customer_name': 'Test Customer',
        'total_amount': Decimal('10000.00'),
        'products': [
            {
                'name': 'Product 1 - Tiny Difference',
                'supplier_country': 'TR',
                'base_price_vat': Decimal('1000.00'),      # K16
                'calc_n16_price_without_vat': Decimal('999.99'),  # N16 (diff = 0.01 - should count)
                'quantity': 10,
            },
            {
                'name': 'Product 2 - No Difference',
                'supplier_country': 'TR',
                'base_price_vat': Decimal('500.00'),       # K16
                'calc_n16_price_without_vat': Decimal('500.00'),  # N16 (diff = 0 - should NOT count)
                'quantity': 5,
            },
        ]
    }

    wb = create_financial_review_excel(quote_data)
    ws = wb.active

    vat_summary_found = False
    for row in ws.iter_rows(min_row=1, max_row=30):
        if row[0].value == 'НДС очищен на:':
            assert row[1].value == '1 из 2 продуктов'  # Only Product 1 counted
            vat_summary_found = True
            break

    assert vat_summary_found, "VAT summary row not found"
