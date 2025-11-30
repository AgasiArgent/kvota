"""
HTTP endpoint tests for calculation engine validation.

Tests the full HTTP request/response cycle via POST /api/quotes-calc/calculate.
Compares calculation results against Excel expected values.
"""
import pytest
import warnings

# Suppress SSL socket warnings from mocked Supabase client
pytestmark = pytest.mark.filterwarnings(
    "ignore::pytest.PytestUnraisableExceptionWarning"
)
import json
import os
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from main import app
from auth import User, get_current_user
from .conftest import assert_close


# =============================================================================
# CONSTANTS
# =============================================================================

EXTRACTED_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "validation_data", "extracted", "excel_expected_values.json"
)


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def client():
    """TestClient with localhost base_url to pass TrustedHostMiddleware."""
    return TestClient(app, base_url="http://localhost")


@pytest.fixture
def mock_user():
    """Authenticated user with organization."""
    return User(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        email="test@masterbearingsales.ru",
        current_organization_id=UUID("00000000-0000-0000-0000-000000000010"),
        current_role="Admin",
        current_role_slug="admin",
        is_owner=False,
        organizations=[],
        permissions=["*"],
        created_at="2025-01-01T00:00:00Z",
        full_name="Test User",
    )


@pytest.fixture
def excel_data():
    """Load Excel test data."""
    with open(EXTRACTED_DATA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


@pytest.fixture
def supabase_mock():
    """Mock Supabase client that tracks inserts."""
    mock = MagicMock()

    def make_table(table_name):
        table = MagicMock()

        # insert returns data with generated IDs
        def do_insert(data):
            result = MagicMock()
            if isinstance(data, list):
                result.data = [{**d, "id": str(uuid4())} for d in data]
            else:
                result.data = [{**data, "id": str(uuid4())}]
            return result

        table.insert.return_value.execute = do_insert
        table.insert.side_effect = lambda d: MagicMock(execute=lambda: do_insert(d))

        # update/upsert/delete
        table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{}])
        table.upsert.return_value.execute.return_value = MagicMock(data=[{}])
        table.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        # select for calculation_settings
        if table_name == "calculation_settings":
            table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
                "rate_forex_risk": 3.0,
                "rate_fin_comm": 3.0,
                "rate_loan_interest_daily": 0.06
            }])
        else:
            table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        return table

    mock.table.side_effect = make_table
    return mock


# =============================================================================
# HELPERS
# =============================================================================

def map_dm_fee_type(raw: str) -> str:
    """Map Russian DM fee type to enum value."""
    mapping = {
        "Фикс": "fixed",
        "фикс": "fixed",
        "fixed": "fixed",
        "Процент": "%",
        "процент": "%",
        "percent": "%",
        "%": "%",
    }
    return mapping.get(raw, "fixed")


def map_seller_company(raw: str) -> str:
    """Map seller company to enum value (strip INN suffix)."""
    # Excel has "МАСТЕР БЭРИНГ ООО (ИНН 0242013464)" but enum expects "МАСТЕР БЭРИНГ ООО"
    if "МАСТЕР БЭРИНГ" in raw:
        return "МАСТЕР БЭРИНГ ООО"
    if "ЦМТО1" in raw:
        return "ЦМТО1 ООО"
    if "РАД РЕСУРС" in raw:
        return "РАД РЕСУРС ООО"
    if "TEXCEL" in raw:
        return "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ"
    if "GESTUS" in raw:
        return "GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ"
    if "UPDOOR" in raw:
        return "UPDOOR Limited"
    return "МАСТЕР БЭРИНГ ООО"  # Default


def build_payload(scenario: dict, max_products: int = 5) -> dict:
    """Build HTTP request payload from Excel scenario."""
    qv = scenario["quote_variables"]
    products = scenario["products"][:max_products]

    api_products = []
    for p in products:
        api_products.append({
            "sku": p.get("sku", ""),
            "brand": "",
            "product_name": p.get("product_name", "Unknown"),
            "product_code": p.get("sku", ""),
            "base_price_vat": float(p["base_price_vat"]),
            "quantity": int(p["quantity"]),
            "weight_in_kg": 0,
            "customs_code": str(p.get("customs_code", "") or ""),
            "supplier_country": p.get("supplier_country", "Китай"),
            "currency_of_base_price": "CNY",
            "exchange_rate_base_price_to_quote": float(p.get("exchange_rate", 1)),
            "markup": float(p.get("markup", 0.19)) * 100,
            "import_tariff": float(p.get("import_tariff", 0)) * 100,
        })

    # Map dm_fee_type from Russian to enum value
    dm_fee_type_raw = qv.get("dm_fee_type", "Фикс")
    dm_fee_type = map_dm_fee_type(str(dm_fee_type_raw))

    variables = {
        "currency_of_quote": qv.get("currency_of_quote", "USD"),
        "rate_forex_risk": float(qv.get("rate_forex_risk", 0)) * 100,
        "dm_fee_type": dm_fee_type,
        "dm_fee_value": float(qv.get("dm_fee_value", 0) or 0),
        "logistics_supplier_hub": float(qv.get("logistics_supplier_hub", 0) or 0),
        "logistics_hub_customs": float(qv.get("logistics_hub_customs", 0) or 0),
        "logistics_customs_client": float(qv.get("logistics_customs_client", 0) or 0),
        "brokerage_hub": float(qv.get("brokerage_hub", 0) or 0),
        "brokerage_customs": float(qv.get("brokerage_customs", 0) or 0),
        "warehousing_at_customs": float(qv.get("warehousing_at_customs", 0) or 0),
        "customs_documentation": float(qv.get("customs_documentation", 0) or 0),
        "brokerage_extra": float(qv.get("brokerage_extra", 0) or 0),
        "advance_from_client": float(qv.get("advance_from_client", 1) or 1) * 100,
        "advance_to_supplier": float(qv.get("advance_to_supplier", 1) or 1) * 100,
        "time_to_advance": int(qv.get("time_to_advance", 0) or 0),
        "delivery_time": int(qv.get("delivery_time", 60) or 60),
        "offer_incoterms": qv.get("offer_incoterms", "DDP"),
        "seller_company": map_seller_company(str(qv.get("seller_company", "МАСТЕР БЭРИНГ ООО"))),
        "offer_sale_type": qv.get("offer_sale_type", "поставка"),
        "supplier_country": qv.get("supplier_country", "Китай"),
    }

    return {
        "customer_id": "00000000-0000-0000-0000-000000000100",
        "contact_id": None,
        "title": "HTTP Test Quote",
        "description": "Test",
        "quote_date": date.today().isoformat(),
        "valid_until": date(2025, 12, 31).isoformat(),
        "products": api_products,
        "variables": variables,
        "template_id": None,
    }


def override_auth(user: User):
    """Create auth dependency override."""
    async def get_user():
        return user
    return get_user


# =============================================================================
# TESTS - BASIC
# =============================================================================

class TestHTTPBasic:
    """Basic HTTP tests - auth, routing."""

    def test_no_auth_returns_403(self, client, excel_data):
        """Endpoint requires authentication."""
        app.dependency_overrides.clear()
        scenario = excel_data["scenarios"]["test_raschet"]
        payload = build_payload(scenario, max_products=1)

        response = client.post("/api/quotes-calc/calculate", json=payload)

        assert response.status_code in [401, 403], f"Got {response.status_code}"

    @patch('routes.quotes_calc.supabase')
    @patch('routes.quotes_calc.fetch_admin_settings')
    @patch('routes.quotes_calc.generate_quote_number')
    def test_no_org_returns_400(
        self, mock_quote_num, mock_admin, mock_sb, client, excel_data
    ):
        """User without organization gets 400."""
        user_no_org = User(
            id=UUID("00000000-0000-0000-0000-000000000001"),
            email="test@example.com",
            current_organization_id=None,
            current_role="Admin",
            current_role_slug="admin",
            is_owner=False,
            organizations=[],
            permissions=["*"],
            created_at="2025-01-01T00:00:00Z",
        )

        app.dependency_overrides[get_current_user] = override_auth(user_no_org)
        try:
            scenario = excel_data["scenarios"]["test_raschet"]
            payload = build_payload(scenario, max_products=1)
            response = client.post("/api/quotes-calc/calculate", json=payload)
            assert response.status_code == 400
            assert "organization" in response.text.lower()
        finally:
            app.dependency_overrides.clear()


# =============================================================================
# TESTS - CALCULATION
# =============================================================================

class TestHTTPCalculation:
    """HTTP tests with calculation validation."""

    @patch('routes.quotes_calc.supabase')
    @patch('routes.quotes_calc.fetch_admin_settings')
    @patch('routes.quotes_calc.generate_quote_number')
    def test_single_product(
        self, mock_quote_num, mock_admin, mock_sb,
        client, mock_user, supabase_mock, excel_data
    ):
        """Single product calculation matches Excel."""
        # Setup
        app.dependency_overrides[get_current_user] = override_auth(mock_user)
        mock_sb.table = supabase_mock.table
        mock_admin.return_value = {"rate_forex_risk": 3.0, "rate_fin_comm": 3.0, "rate_loan_interest_daily": 0.06}
        mock_quote_num.return_value = "КП25-0001"

        try:
            scenario = excel_data["scenarios"]["test_raschet"]
            payload = build_payload(scenario, max_products=1)

            response = client.post("/api/quotes-calc/calculate", json=payload)

            if response.status_code not in [200, 201]:
                pytest.fail(f"HTTP {response.status_code}: {response.text[:500]}")

            result = response.json()
            assert "items" in result
            assert len(result["items"]) == 1

            # Compare with Excel
            expected = scenario["products"][0]["expected"]
            actual = result["items"][0]

            errors = []
            if "AK16" in expected:
                try:
                    assert_close(actual.get("sale_price", 0), expected["AK16"], "sale_price=AK16")
                except AssertionError as e:
                    errors.append(str(e))

            if "AB16" in expected:
                try:
                    assert_close(actual.get("cogs", 0), expected["AB16"], "cogs=AB16")
                except AssertionError as e:
                    errors.append(str(e))

            if errors:
                pytest.fail(f"Mismatches:\n" + "\n".join(errors))

        finally:
            app.dependency_overrides.clear()

    @patch('routes.quotes_calc.supabase')
    @patch('routes.quotes_calc.fetch_admin_settings')
    @patch('routes.quotes_calc.generate_quote_number')
    def test_five_products(
        self, mock_quote_num, mock_admin, mock_sb,
        client, mock_user, supabase_mock, excel_data
    ):
        """5 products calculation matches Excel."""
        app.dependency_overrides[get_current_user] = override_auth(mock_user)
        mock_sb.table = supabase_mock.table
        mock_admin.return_value = {"rate_forex_risk": 3.0, "rate_fin_comm": 3.0, "rate_loan_interest_daily": 0.06}
        mock_quote_num.return_value = "КП25-0002"

        try:
            scenario = excel_data["scenarios"]["test_raschet"]
            payload = build_payload(scenario, max_products=5)

            response = client.post("/api/quotes-calc/calculate", json=payload)

            if response.status_code not in [200, 201]:
                pytest.fail(f"HTTP {response.status_code}: {response.text[:500]}")

            result = response.json()
            assert len(result["items"]) == 5

            errors = []
            for idx, (actual, prod) in enumerate(zip(result["items"], scenario["products"][:5])):
                expected = prod["expected"]
                if "AK16" in expected:
                    try:
                        assert_close(actual.get("sale_price", 0), expected["AK16"], f"p[{idx}].sale_price")
                    except AssertionError as e:
                        errors.append(str(e))

            if errors:
                pytest.fail(f"{len(errors)} mismatches:\n" + "\n".join(errors[:5]))

        finally:
            app.dependency_overrides.clear()

    @patch('routes.quotes_calc.supabase')
    @patch('routes.quotes_calc.fetch_admin_settings')
    @patch('routes.quotes_calc.generate_quote_number')
    def test_response_fields(
        self, mock_quote_num, mock_admin, mock_sb,
        client, mock_user, supabase_mock, excel_data
    ):
        """Response includes all expected fields."""
        app.dependency_overrides[get_current_user] = override_auth(mock_user)
        mock_sb.table = supabase_mock.table
        mock_admin.return_value = {"rate_forex_risk": 3.0, "rate_fin_comm": 3.0, "rate_loan_interest_daily": 0.06}
        mock_quote_num.return_value = "КП25-0003"

        try:
            scenario = excel_data["scenarios"]["test_raschet"]
            payload = build_payload(scenario, max_products=1)

            response = client.post("/api/quotes-calc/calculate", json=payload)

            if response.status_code not in [200, 201]:
                pytest.fail(f"HTTP {response.status_code}: {response.text[:500]}")

            result = response.json()
            item = result["items"][0]

            required = ["item_id", "product_name", "quantity", "cogs", "sale_price"]
            missing = [f for f in required if f not in item]

            if missing:
                pytest.fail(f"Missing fields: {missing}\nAvailable: {list(item.keys())}")

        finally:
            app.dependency_overrides.clear()


# =============================================================================
# TESTS - FULL VALIDATION
# =============================================================================

class TestHTTPFullValidation:
    """Full validation with all products."""

    @pytest.mark.slow
    @patch('routes.quotes_calc.supabase')
    @patch('routes.quotes_calc.fetch_admin_settings')
    @patch('routes.quotes_calc.generate_quote_number')
    def test_all_products(
        self, mock_quote_num, mock_admin, mock_sb,
        client, mock_user, supabase_mock, excel_data
    ):
        """All 93 products via HTTP."""
        app.dependency_overrides[get_current_user] = override_auth(mock_user)
        mock_sb.table = supabase_mock.table
        mock_admin.return_value = {"rate_forex_risk": 3.0, "rate_fin_comm": 3.0, "rate_loan_interest_daily": 0.06}
        mock_quote_num.return_value = "КП25-FULL"

        try:
            scenario = excel_data["scenarios"]["test_raschet"]
            all_products = scenario["products"]
            payload = build_payload(scenario, max_products=len(all_products))

            response = client.post("/api/quotes-calc/calculate", json=payload)

            if response.status_code not in [200, 201]:
                pytest.fail(f"HTTP {response.status_code}: {response.text[:500]}")

            result = response.json()
            assert len(result["items"]) == len(all_products)

            # Validate all
            errors = []
            max_deviation = 0.0

            for idx, (actual, prod) in enumerate(zip(result["items"], all_products)):
                expected = prod["expected"]
                if "AK16" in expected:
                    actual_val = actual.get("sale_price", 0)
                    expected_val = expected["AK16"]
                    try:
                        assert_close(actual_val, expected_val, f"p[{idx}].sale_price")
                        if expected_val != 0:
                            dev = abs((actual_val - expected_val) / expected_val) * 100
                            max_deviation = max(max_deviation, dev)
                    except AssertionError as e:
                        errors.append(str(e))

            print(f"\n{'='*50}")
            print(f"HTTP VALIDATION: {len(all_products)} products")
            print(f"Errors: {len(errors)}, Max deviation: {max_deviation:.4f}%")
            print(f"{'='*50}")

            if errors:
                pytest.fail(f"{len(errors)} errors:\n" + "\n".join(errors[:10]))

        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
