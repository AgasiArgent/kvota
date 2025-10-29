# Backend Testing Patterns

**Last Updated:** 2025-10-29

Pytest-based testing patterns for FastAPI + Supabase backend with async support and RLS testing.

---

## Quick Reference

### Running Tests

```bash
cd backend

# All tests
pytest -v

# With coverage
pytest --cov=. --cov-report=term-missing

# Specific file
pytest tests/test_quotes_calc_mapper.py -v

# Specific test
pytest tests/test_file.py::test_function_name -v

# Watch mode (requires pytest-watch)
ptw -v  # Install: pip install pytest-watch

# By markers
pytest -m unit -v          # Only unit tests
pytest -m integration -v   # Only integration tests
pytest -m "not slow" -v    # Skip slow tests
```

### Coverage Commands

```bash
# HTML report
pytest --cov=. --cov-report=html
open htmlcov/index.html

# Specific module
pytest --cov=routes.quotes_calc --cov-report=term-missing

# Show uncovered lines
pytest --cov=. --cov-report=term-missing
```

---

## 1. Pytest Basics

### Test File Structure

```
backend/tests/
├── __init__.py
├── conftest.py                      # Shared fixtures
├── test_quotes_calc_mapper.py       # Unit tests
├── test_quotes_calc_validation.py   # Validation tests
├── test_quotes_calc_integration.py  # Integration tests
└── sample_products.csv              # Test data
```

### Naming Conventions

- **Files:** `test_*.py` or `*_test.py`
- **Classes:** `Test*` (e.g., `TestMapperFunction`)
- **Functions:** `test_*` (e.g., `test_mapper_with_minimal_data`)

### Async Test Pattern

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    """Test async database operation"""
    result = await fetch_quotes()
    assert len(result) > 0
```

**Configuration:** `pytest.ini` sets `asyncio_mode = auto` for auto-async support.

---

## 2. Fixtures

Fixtures provide reusable test data and setup. Defined in `conftest.py`.

### Common Fixtures

```python
"""backend/tests/conftest.py"""
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
```

### Using Fixtures

```python
def test_with_fixtures(sample_product, admin_settings):
    """Fixtures are injected by name"""
    result = calculate(sample_product, admin_settings)
    assert result.total > 0
```

### Database Connection Fixture

```python
import asyncpg
import pytest

@pytest.fixture
async def db_connection():
    """Provide database connection for tests"""
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    yield conn
    await conn.close()


@pytest.mark.asyncio
async def test_with_db(db_connection):
    """Use database fixture"""
    rows = await db_connection.fetch("SELECT * FROM quotes LIMIT 1")
    assert len(rows) >= 0
```

### Test User Fixture

```python
@pytest.fixture
def test_user():
    """Test user credentials"""
    return {
        "id": "test-user-uuid",
        "email": "andrey@masterbearingsales.ru",
        "password": "password",
        "org_id": "test-org-uuid",
        "role": "admin"
    }


@pytest.fixture
def auth_headers(test_user):
    """Authorization headers for API tests"""
    # Get token (implement login logic)
    token = get_test_token(test_user["email"], test_user["password"])
    return {"Authorization": f"Bearer {token}"}
```

### Cleanup Patterns

```python
@pytest.fixture
async def test_quote(db_connection):
    """Create test quote and clean up after"""
    # Setup
    quote_id = await db_connection.fetchval(
        "INSERT INTO quotes (customer_id, total_amount) VALUES ($1, $2) RETURNING id",
        "test-customer", 1000.00
    )

    yield quote_id

    # Teardown
    await db_connection.execute("DELETE FROM quotes WHERE id = $1", quote_id)
```

---

## 3. Testing Patterns

### API Endpoint Testing

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_calculate_endpoint(auth_headers):
    """Test /calculate endpoint"""
    response = client.post(
        "/api/quotes-calc/calculate",
        json={
            "customer_id": "123",
            "products": [{"name": "Test", "base_price_vat": 1000, "quantity": 10}]
        },
        headers=auth_headers
    )

    assert response.status_code == 201
    data = response.json()
    assert "quote_id" in data
    assert data["total_amount"] > 0
```

### Database Testing

```python
@pytest.mark.asyncio
async def test_create_quote_in_db(db_connection):
    """Test quote is saved to database"""
    # Create quote
    quote_id = await db_connection.fetchval(
        "INSERT INTO quotes (customer_id, total_amount) VALUES ($1, $2) RETURNING id",
        "test-customer", 1500.50
    )

    # Verify in DB
    row = await db_connection.fetchrow(
        "SELECT * FROM quotes WHERE id = $1", quote_id
    )

    assert row is not None
    assert row["total_amount"] == 1500.50

    # Cleanup
    await db_connection.execute("DELETE FROM quotes WHERE id = $1", quote_id)
```

### RLS Testing (Organization Isolation)

```python
@pytest.mark.asyncio
async def test_rls_isolates_organizations(db_connection):
    """Test that RLS prevents cross-organization access"""
    # Set RLS context for User A (Org 1)
    await db_connection.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        '{"sub": "user-a", "organization_id": "org-1"}'
    )

    # Create quote for Org 1
    quote_id = await db_connection.fetchval(
        "INSERT INTO quotes (organization_id, customer_id, total_amount) "
        "VALUES ($1, $2, $3) RETURNING id",
        "org-1", "customer-1", 1000.00
    )

    # User A can see their quote
    rows = await db_connection.fetch("SELECT * FROM quotes WHERE id = $1", quote_id)
    assert len(rows) == 1

    # Set RLS context for User B (Org 2)
    await db_connection.execute(
        "SELECT set_config('request.jwt.claims', $1, true)",
        '{"sub": "user-b", "organization_id": "org-2"}'
    )

    # User B CANNOT see Org 1's quote
    rows = await db_connection.fetch("SELECT * FROM quotes WHERE id = $1", quote_id)
    assert len(rows) == 0  # RLS blocks access
```

### Mock Patterns (External Services)

```python
from unittest.mock import patch, MagicMock

@patch("routes.quotes_calc.fetch_exchange_rate")
def test_with_mocked_exchange_rate(mock_fetch):
    """Test with mocked external API call"""
    # Mock returns fixed rate
    mock_fetch.return_value = Decimal("95.5")

    result = calculate_quote_with_exchange_rate()

    assert result.exchange_rate == Decimal("95.5")
    mock_fetch.assert_called_once()


@pytest.mark.asyncio
@patch("supabase.create_client")
async def test_with_mocked_supabase(mock_supabase):
    """Test with mocked Supabase client"""
    # Mock Supabase response
    mock_client = MagicMock()
    mock_client.table().select().execute.return_value.data = [
        {"id": "1", "name": "Test Customer"}
    ]
    mock_supabase.return_value = mock_client

    result = await get_customer("1")

    assert result["name"] == "Test Customer"
```

---

## 4. Test Organization

### Test Class Pattern

```python
class TestQuotesCalcMapper:
    """Group related tests together"""

    def test_minimal_data(self, sample_product, admin_settings):
        """Test with only required fields"""
        result = map_variables_to_calculation_input(
            sample_product, {}, admin_settings
        )
        assert result.product.base_price_VAT > 0

    def test_with_product_overrides(self, sample_product, admin_settings):
        """Test that product-level overrides work"""
        sample_product["supplier_country"] = "Китай"
        variables = {"supplier_country": "Турция"}

        result = map_variables_to_calculation_input(
            sample_product, variables, admin_settings
        )

        # Product override wins
        assert result.logistics.supplier_country.value == "Китай"

    def test_with_quote_defaults(self, sample_product, admin_settings):
        """Test quote-level defaults"""
        variables = {"supplier_country": "Турция"}

        result = map_variables_to_calculation_input(
            sample_product, variables, admin_settings
        )

        # Quote default used
        assert result.logistics.supplier_country.value == "Турция"
```

### Arrange-Act-Assert Pattern

```python
def test_calculate_quote():
    # Arrange - set up test data
    product = ProductFromFile(
        product_name="Test",
        base_price_vat=1000.0,
        quantity=10
    )
    variables = {"markup": "15", "seller_company": "МАСТЕР БЭРИНГ ООО"}
    admin_settings = {"rate_forex_risk": Decimal("3")}

    # Act - perform action
    result = calculate(product, variables, admin_settings)

    # Assert - verify results
    assert result.total_amount > 0
    assert result.markup_percent == 15
```

### Meaningful Test Names

```python
# ✅ GOOD - describes what is being tested
def test_mapper_uses_product_override_when_provided():
    pass

def test_validation_fails_for_missing_seller_company():
    pass

def test_non_exw_incoterms_requires_logistics_cost():
    pass

# ❌ BAD - vague, meaningless
def test_mapper_1():
    pass

def test_validation():
    pass

def test_incoterms():
    pass
```

---

## 5. Common Test Scenarios

### CRUD Operations

```python
@pytest.mark.asyncio
async def test_crud_operations(db_connection):
    """Test Create, Read, Update, Delete"""
    # Create
    quote_id = await db_connection.fetchval(
        "INSERT INTO quotes (customer_id, total_amount, status) "
        "VALUES ($1, $2, $3) RETURNING id",
        "customer-1", 1000.00, "draft"
    )
    assert quote_id is not None

    # Read
    row = await db_connection.fetchrow("SELECT * FROM quotes WHERE id = $1", quote_id)
    assert row["status"] == "draft"

    # Update
    await db_connection.execute(
        "UPDATE quotes SET status = $1 WHERE id = $2", "approved", quote_id
    )
    row = await db_connection.fetchrow("SELECT * FROM quotes WHERE id = $1", quote_id)
    assert row["status"] == "approved"

    # Delete
    await db_connection.execute("DELETE FROM quotes WHERE id = $1", quote_id)
    row = await db_connection.fetchrow("SELECT * FROM quotes WHERE id = $1", quote_id)
    assert row is None
```

### Authentication Testing

```python
def test_protected_endpoint_requires_auth():
    """Test that endpoint rejects unauthenticated requests"""
    response = client.get("/api/quotes")
    assert response.status_code == 401


def test_protected_endpoint_with_valid_token(auth_headers):
    """Test that endpoint accepts valid token"""
    response = client.get("/api/quotes", headers=auth_headers)
    assert response.status_code == 200
```

### Authorization (Role Checks)

```python
def test_admin_endpoint_rejects_non_admin(member_auth_headers):
    """Test that admin endpoint rejects member role"""
    response = client.put(
        "/api/settings/calculation",
        json={"rate_forex_risk": 5.0},
        headers=member_auth_headers
    )
    assert response.status_code == 403


def test_admin_endpoint_allows_admin(admin_auth_headers):
    """Test that admin endpoint allows admin role"""
    response = client.put(
        "/api/settings/calculation",
        json={"rate_forex_risk": 5.0},
        headers=admin_auth_headers
    )
    assert response.status_code == 200
```

### Validation Errors

```python
from fastapi import HTTPException
import pytest

def test_validation_fails_for_invalid_data():
    """Test validation raises proper errors"""
    product = ProductFromFile(
        product_name="Test",
        base_price_vat=0,  # Invalid - must be > 0
        quantity=10
    )
    variables = {}

    errors = validate_calculation_input(product, variables)

    assert len(errors) > 0
    assert any("base_price_vat" in err for err in errors)


def test_validation_returns_all_errors_at_once():
    """Test that all errors are returned, not just first one"""
    product = ProductFromFile(
        product_name="Test",
        base_price_vat=0,  # Error 1
        quantity=0         # Error 2
    )
    variables = {}  # Missing required fields - Errors 3-8

    errors = validate_calculation_input(product, variables)

    assert len(errors) >= 5  # Multiple errors reported
```

### Error Handling

```python
def test_404_for_nonexistent_quote(auth_headers):
    """Test that accessing nonexistent quote returns 404"""
    response = client.get(
        "/api/quotes/00000000-0000-0000-0000-000000000000",
        headers=auth_headers
    )
    assert response.status_code == 404


def test_422_for_invalid_request_body(auth_headers):
    """Test that invalid request body returns 422"""
    response = client.post(
        "/api/quotes-calc/calculate",
        json={"invalid_field": "invalid_value"},
        headers=auth_headers
    )
    assert response.status_code == 422
```

---

## 6. Coverage Goals

### Target Coverage Levels

| Module Type | Coverage Goal | Priority |
|-------------|---------------|----------|
| Routes (API) | 80%+ | High |
| Calculation Engine | 95%+ | Critical |
| Models (Pydantic) | 70%+ | Medium |
| Auth | 85%+ | High (security) |
| Utils | 90%+ | Medium |

### Checking Coverage

```bash
# Overall coverage
pytest --cov=. --cov-report=term-missing

# Specific module with line numbers
pytest --cov=routes.quotes_calc --cov-report=term-missing

# HTML report with visual highlighting
pytest --cov=. --cov-report=html
open htmlcov/index.html
```

**Coverage output example:**
```
routes/quotes_calc.py    49%    120-125, 150-160, 200-205
```
Lines 120-125, 150-160, 200-205 are **not covered** by tests.

---

## 7. TDD Workflow (Red → Green → Refactor)

### Step 1: Write Test First (RED)

```python
def test_mapper_with_minimal_data():
    """Test mapper with only required fields"""
    product = ProductFromFile(...)
    variables = {...}
    admin_settings = {...}

    result = map_variables_to_calculation_input(product, variables, admin_settings)

    assert result.product.base_price_VAT == Decimal("1000.0")
```

```bash
# Run test (will FAIL - function doesn't exist yet)
pytest tests/test_quotes_calc_mapper.py::test_mapper_with_minimal_data -v

# Output: FAILED - ImportError: cannot import name 'map_variables_to_calculation_input'
```

### Step 2: Implement Feature (GREEN)

```python
# backend/routes/quotes_calc.py
def map_variables_to_calculation_input(product, variables, admin_settings):
    """Map variables to calculation input"""
    # Implementation here
    return CalculationInput(...)
```

```bash
# Run test again
pytest tests/test_quotes_calc_mapper.py::test_mapper_with_minimal_data -v

# Output: PASSED ✅
```

### Step 3: Refactor & Check Coverage

```bash
# Check coverage
pytest tests/test_quotes_calc_mapper.py --cov=routes.quotes_calc --cov-report=term-missing

# Output should show 80%+ coverage for new functions
# If coverage low, add more test cases

# Refactor code for clarity (tests protect against breaking changes)
# Run tests again to ensure refactor didn't break anything
pytest tests/test_quotes_calc_mapper.py -v
```

---

## Resources

- **pytest Documentation:** https://docs.pytest.org/
- **FastAPI Testing:** https://fastapi.tiangolo.com/tutorial/testing/
- **Testing Best Practices:** https://docs.python-guide.org/writing/tests/
- **Project Testing Workflow:** `.claude/TESTING_WORKFLOW.md`
- **Implementation Plan:** `.claude/PLAN_CALCULATION_ENGINE_CONNECTION.md`

---

**See Also:**
- `/home/novi/quotation-app-dev/.claude/TESTING_WORKFLOW.md` - Complete testing guide
- `/home/novi/quotation-app-dev/backend/tests/conftest.py` - Fixture definitions
- `/home/novi/quotation-app-dev/backend/pytest.ini` - Pytest configuration
