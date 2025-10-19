"""
Pytest configuration and shared fixtures
"""
import os
import pytest
from decimal import Decimal
from typing import Dict, Any

# Set test environment
os.environ["ENVIRONMENT"] = "test"


@pytest.fixture
def sample_product() -> Dict[str, Any]:
    """Sample product data for testing"""
    return {
        "sku": "TEST-001",
        "brand": "Test Brand",
        "name": "Test Product",
        "base_price_vat": Decimal("1000.00"),
        "quantity": 10,
        "weight_in_kg": Decimal("25.5"),
        "currency_of_base_price": "USD",
        "supplier_country": "Турция",
    }


@pytest.fixture
def sample_quote_defaults() -> Dict[str, Any]:
    """Sample quote-level defaults for testing"""
    return {
        "seller_company": "МАСТЕР БЭРИНГ ООО",
        "currency_of_quote": "RUB",
        "advance_from_client": Decimal("100"),
        "offer_sale_type": "поставка",
        "offer_incoterms": "DDP",
        "delivery_time": 30,
    }


@pytest.fixture
def admin_settings() -> Dict[str, Decimal]:
    """Sample admin settings for testing"""
    return {
        "rate_forex_risk": Decimal("3.0"),
        "rate_fin_comm": Decimal("2.0"),
        "rate_loan_interest_daily": Decimal("0.00069"),
    }
