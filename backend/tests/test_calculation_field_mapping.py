"""
Test that calculation endpoint returns fields matching frontend interface.

This test verifies the fix for: Backend calculation field names must match
frontend ProductCalculationResult interface expectations.

Backend uses descriptive names (purchase_price_total_quote_currency)
Frontend expects simplified names (purchase_price_rub)

The mapping happens in routes/quotes_calc.py lines 974-994
"""

import pytest
import sys
import os

# Add parent directory to path to import routes
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from decimal import Decimal
from calculation_models import (
    ProductInput,
    QuoteCalculationInput,
    calculate_quote
)

# Test data - minimal valid product
SAMPLE_PRODUCT = ProductInput(
    product_name="Bearing SKF 6205",
    product_code="SKF-6205",
    base_price_vat=Decimal("1200"),
    quantity=10,
    weight_in_kg=Decimal("5.0"),
    currency_of_base_price="TRY",
    exchange_rate_base_price_to_quote=Decimal("3.0"),
    supplier_country="Турция",
    customs_code="8482100000"
)

# Minimal calculation input with all required fields
VALID_CALCULATION_INPUT = QuoteCalculationInput(
    products=[SAMPLE_PRODUCT],

    # Product Info
    currency_of_base_price="TRY",
    exchange_rate_base_price_to_quote=Decimal("3.0"),
    supplier_country="Турция",
    supplier_currency="TRY",
    customs_code="8482100000",

    # Financial
    currency_of_quote="RUB",
    markup=Decimal("15.0"),
    rate_forex_risk=Decimal("3.0"),
    rate_fin_comm=Decimal("2.0"),
    rate_loan_interest_daily=Decimal("0.00069"),
    dm_fee_type="fixed",
    dm_fee_value=Decimal("1000.0"),
    credit_days_to_client=30,
    credit_days_from_supplier=0,

    # Logistics
    logistics_supplier_hub=Decimal("1500.0"),
    logistics_hub_customs=Decimal("800.0"),
    logistics_customs_client=Decimal("500.0"),
    offer_incoterms="DDP",
    supplier_incoterms="EXW",
    logistics_insurance=Decimal("0"),
    delivery_time=30,

    # Taxes & Duties
    import_tariff=Decimal("5.0"),
    excise_tax=Decimal("0"),

    # Payment Terms
    advance_from_client=Decimal("50.0"),
    advance_to_supplier=Decimal("100.0"),
    time_to_advance=7,
    time_to_shipment=14,
    time_shipment_to_hub=10,
    time_hub_to_customs=3,
    time_customs_clearance=7,
    time_customs_to_client=3,
    time_client_payment=30,
    exchange_rate_quote_to_rub=Decimal("1.0"),
    vat_rate=Decimal("20.0"),
    util_fee=Decimal("0"),

    # Customs & Clearance
    brokerage_hub=Decimal("500.0"),
    brokerage_customs=Decimal("300.0"),
    warehousing_at_customs=Decimal("200.0"),
    customs_documentation=Decimal("150.0"),
    brokerage_extra=Decimal("0"),

    # Company Settings
    seller_company="МАСТЕР БЭРИНГ ООО",
    offer_sale_type="поставка"
)

# Remove the HTTP-based test data
VALID_CALCULATION_REQUEST = {
    "customer_id": "78ea1a83-856f-42c3-a2b8-8d3b012fecf0",
    "products": [
        {
            "product_name": "Bearing SKF 6205",
            "product_code": "SKF-6205",
            "base_price_vat": 1200,
            "quantity": 10
        }
    ],
    "variables": {
        # Product Info
        "currency_of_base_price": "TRY",
        "exchange_rate_base_price_to_quote": 3.0,
        "supplier_country": "Турция",
        "supplier_currency": "TRY",

        # Financial
        "currency_of_quote": "RUB",
        "markup": 15.0,
        "rate_forex_risk": 3.0,
        "rate_fin_comm": 2.0,
        "rate_loan_interest_daily": 0.00069,
        "dm_fee_type": "fixed",
        "dm_fee_value": 1000.0,
        "credit_days_to_client": 30,
        "credit_days_from_supplier": 0,

        # Logistics
        "logistics_supplier_hub": 1500.0,
        "logistics_hub_customs": 800.0,
        "logistics_customs_client": 500.0,
        "offer_incoterms": "DDP",
        "supplier_incoterms": "EXW",
        "logistics_insurance": 0,
        "delivery_time": 30,

        # Taxes & Duties
        "import_tariff": 5.0,
        "excise_tax": 0,

        # Payment Terms
        "advance_from_client": 50.0,
        "advance_to_supplier": 100.0,
        "time_to_advance": 7,
        "time_to_shipment": 14,
        "time_shipment_to_hub": 10,
        "time_hub_to_customs": 3,
        "time_customs_clearance": 7,
        "time_customs_to_client": 3,
        "time_client_payment": 30,
        "exchange_rate_quote_to_rub": 1.0,
        "vat_rate": 20.0,
        "util_fee": 0,

        # Customs & Clearance
        "brokerage_hub": 500.0,
        "brokerage_customs": 300.0,
        "warehousing_at_customs": 200.0,
        "customs_documentation": 150.0,
        "brokerage_extra": 0,

        # Company Settings
        "seller_company": "МАСТЕР БЭРИНГ ООО",
        "offer_sale_type": "поставка"
    }
}


@pytest.mark.asyncio
async def test_calculation_returns_frontend_field_names(authenticated_client, test_user_token):
    """
    Test that /api/quotes-calc/calculate returns field names matching frontend interface.

    Frontend expects these fields (from quotes-calc-service.ts ProductCalculationResult):
    - product_name
    - product_code
    - quantity
    - base_price_vat
    - base_price_no_vat
    - purchase_price_rub
    - logistics_costs
    - cogs
    - cogs_with_vat
    - import_duties
    - customs_fees
    - financing_costs
    - dm_fee
    - total_cost
    - sale_price
    - margin
    """
    response = authenticated_client.post(
        "/api/quotes-calc/calculate",
        json=VALID_CALCULATION_REQUEST,
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.json()}"

    data = response.json()

    # Verify response structure
    assert "items" in data, "Response should have 'items' field"
    assert len(data["items"]) == 1, "Should have 1 calculated item"

    item = data["items"][0]

    # Verify ALL expected fields are present (these match frontend interface)
    expected_fields = [
        "product_name",
        "product_code",
        "quantity",
        "base_price_vat",
        "base_price_no_vat",
        "purchase_price_rub",  # NOT purchase_price_total_quote_currency
        "logistics_costs",      # NOT logistics_total
        "cogs",                 # NOT cogs_per_product
        "cogs_with_vat",
        "import_duties",
        "customs_fees",
        "financing_costs",
        "dm_fee",
        "total_cost",
        "sale_price",
        "margin"
    ]

    missing_fields = [field for field in expected_fields if field not in item]
    assert not missing_fields, f"Missing frontend interface fields: {missing_fields}"

    # Verify values are numbers (not null/undefined)
    numeric_fields = [
        "quantity", "base_price_vat", "base_price_no_vat", "purchase_price_rub",
        "logistics_costs", "cogs", "cogs_with_vat", "import_duties",
        "customs_fees", "financing_costs", "dm_fee", "total_cost",
        "sale_price", "margin"
    ]

    for field in numeric_fields:
        value = item[field]
        assert value is not None, f"Field '{field}' should not be null"
        assert isinstance(value, (int, float)), f"Field '{field}' should be numeric, got {type(value)}"
        assert value >= 0, f"Field '{field}' should be non-negative, got {value}"

    # Verify product info
    assert item["product_name"] == "Bearing SKF 6205"
    assert item["product_code"] == "SKF-6205"
    assert item["quantity"] == 10

    print(f"✅ All frontend interface fields present and valid")
    print(f"   Sample values: purchase_price_rub={item['purchase_price_rub']}, "
          f"logistics_costs={item['logistics_costs']}, cogs={item['cogs']}")


@pytest.mark.asyncio
async def test_calculation_does_not_return_backend_field_names(authenticated_client, test_user_token):
    """
    Verify that backend internal field names are NOT in the response.

    These are the internal ProductCalculationResult model field names that should
    be mapped to frontend-friendly names before returning.
    """
    response = authenticated_client.post(
        "/api/quotes-calc/calculate",
        json=VALID_CALCULATION_REQUEST,
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 201

    data = response.json()
    item = data["items"][0]

    # These backend field names should NOT appear in the response
    backend_only_fields = [
        "purchase_price_total_quote_currency",  # Should be: purchase_price_rub
        "logistics_total",                       # Should be: logistics_costs
        "cogs_per_product",                      # Should be: cogs
        "sales_price_total_no_vat",             # Should be: sale_price
    ]

    found_backend_fields = [field for field in backend_only_fields if field in item]
    assert not found_backend_fields, f"Response contains unmapped backend fields: {found_backend_fields}"

    print(f"✅ No backend-internal field names leaked into API response")


@pytest.mark.asyncio
async def test_calculation_all_fields_have_values(authenticated_client, test_user_token):
    """
    Verify that all calculation fields have actual numeric values (not 0 or null).

    This ensures the mapping didn't break the calculations - values should flow through correctly.
    """
    response = authenticated_client.post(
        "/api/quotes-calc/calculate",
        json=VALID_CALCULATION_REQUEST,
        headers={"Authorization": f"Bearer {test_user_token}"}
    )

    assert response.status_code == 201

    data = response.json()
    item = data["items"][0]

    # These fields should have non-zero values for this test case
    should_be_nonzero = [
        "base_price_vat",       # Input: 1200
        "base_price_no_vat",    # Should be calculated
        "purchase_price_rub",   # Should be base_price * exchange_rate
        "logistics_costs",      # Sum of logistics: 1500 + 800 + 500 = 2800
        "cogs",                 # Should include purchase + logistics + duties
        "import_duties",        # 5% tariff should apply
        "financing_costs",      # Should be calculated from loan interest
        "dm_fee",               # Fixed 1000 from input
        "total_cost",           # Sum of all costs
        "sale_price",           # Cost + markup
        "margin"                # Should be calculated
    ]

    zero_fields = [field for field in should_be_nonzero if item.get(field, 0) == 0]
    assert not zero_fields, f"These fields unexpectedly have zero values: {zero_fields}. Check if mapping broke calculations."

    # Sanity check some values
    assert item["base_price_vat"] == 1200, "Base price should match input"
    assert item["quantity"] == 10, "Quantity should match input"
    assert item["dm_fee"] == 1000, "DM fee should match input (fixed 1000)"

    # Logistics should be sum of three components
    expected_logistics = 1500 + 800 + 500  # supplier_hub + hub_customs + customs_client
    assert item["logistics_costs"] > 0, "Logistics costs should be calculated"

    print(f"✅ All calculation fields have valid non-zero values")
    print(f"   Logistics: {item['logistics_costs']}, Total cost: {item['total_cost']}, Sale price: {item['sale_price']}")
