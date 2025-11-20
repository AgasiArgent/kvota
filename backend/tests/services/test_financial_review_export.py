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
