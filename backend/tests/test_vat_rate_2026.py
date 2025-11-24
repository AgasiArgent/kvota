"""
Unit tests for VAT rate 2026 change implementation
Tests get_rate_vat_ru() function with delivery_date parameter
"""
from decimal import Decimal
from datetime import date
import pytest

from calculation_engine import get_rate_vat_ru


class TestVATRate2026:
    """Test VAT rate changes based on delivery date"""

    def test_vat_rate_before_2026(self):
        """VAT should be 20% for delivery before 2026"""
        delivery_date = date(2025, 12, 31)
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.20"), f"Expected 0.20, got {rate}"

    def test_vat_rate_2026_exact_start(self):
        """VAT should be 22% for delivery on Jan 1, 2026"""
        delivery_date = date(2026, 1, 1)
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.22"), f"Expected 0.22, got {rate}"

    def test_vat_rate_2026_mid_year(self):
        """VAT should be 22% for delivery in mid-2026"""
        delivery_date = date(2026, 6, 15)
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.22"), f"Expected 0.22, got {rate}"

    def test_vat_rate_2027_onwards(self):
        """VAT should be 22% for delivery in 2027 and beyond"""
        test_dates = [
            date(2027, 1, 1),
            date(2030, 12, 31),
        ]
        for delivery_date in test_dates:
            rate = get_rate_vat_ru("RU", delivery_date)
            assert rate == Decimal("0.22"), f"Expected 0.22 for {delivery_date}, got {rate}"

    def test_vat_rate_backward_compat_none(self):
        """VAT should default to 20% if no delivery_date provided (backward compatibility)"""
        rate = get_rate_vat_ru("RU", None)
        assert rate == Decimal("0.20"), f"Expected 0.20, got {rate}"

    def test_vat_rate_turkish_seller_before_2026(self):
        """Turkish sellers should remain 0% regardless of date (before 2026)"""
        delivery_date = date(2025, 12, 31)
        rate = get_rate_vat_ru("TR", delivery_date)
        assert rate == Decimal("0.00"), f"Expected 0.00, got {rate}"

    def test_vat_rate_turkish_seller_2026(self):
        """Turkish sellers should remain 0% regardless of date (2026+)"""
        delivery_date = date(2026, 6, 15)
        rate = get_rate_vat_ru("TR", delivery_date)
        assert rate == Decimal("0.00"), f"Expected 0.00, got {rate}"

    def test_vat_rate_chinese_seller(self):
        """Chinese sellers should remain 0% regardless of date"""
        delivery_date = date(2026, 6, 15)
        rate = get_rate_vat_ru("CN", delivery_date)
        assert rate == Decimal("0.00"), f"Expected 0.00, got {rate}"


class TestEdgeCases:
    """Test edge cases and boundary conditions"""

    def test_vat_rate_year_2025_end_of_year(self):
        """Test last day of 2025"""
        delivery_date = date(2025, 12, 31)
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.20")

    def test_vat_rate_year_2026_first_day(self):
        """Test first day of 2026"""
        delivery_date = date(2026, 1, 1)
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.22")

    def test_vat_rate_far_past(self):
        """Test VAT rate for dates in the past (should be 20%)"""
        delivery_date = date(2020, 1, 1)
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.20")

    def test_vat_rate_far_future(self):
        """Test VAT rate for dates far in the future (should be 22%)"""
        delivery_date = date(2050, 1, 1)
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.22")
