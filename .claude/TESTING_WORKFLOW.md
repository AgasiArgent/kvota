# Automated Testing Workflow

**Purpose:** Run tests automatically after implementing features to ensure quality and catch regressions early.

**Philosophy:** Test-Driven Development (TDD) - Write tests first, then implement, then verify.

---

## Quick Commands

### Run All Tests

```bash
# Backend - all tests
cd backend
pytest -v

# Backend - with coverage
cd backend
pytest --cov=. --cov-report=term-missing

# Frontend - all tests
cd frontend
npm test

# Frontend - with coverage
cd frontend
npm test -- --coverage
```

### Run Specific Test Files

```bash
# Backend - specific module
cd backend
pytest tests/test_quotes_calc_mapper.py -v
pytest tests/test_quotes_calc_integration.py -v
pytest tests/test_calculation_settings.py -v

# Frontend - specific component
cd frontend
npm test -- quotes/create
npm test -- api/quotes-calc-service
```

### Watch Mode (Auto-rerun on file changes)

```bash
# Backend - watch mode (requires pytest-watch)
cd backend
ptw -v  # Install: pip install pytest-watch

# Frontend - watch mode (built-in)
cd frontend
npm test -- --watch
```

### Run Tests with Specific Markers

```bash
# Backend - only integration tests
cd backend
pytest -m integration -v

# Backend - only unit tests
cd backend
pytest -m unit -v

# Backend - skip slow tests
cd backend
pytest -m "not slow" -v
```

---

## Test-Driven Development (TDD) Workflow

### Red → Green → Refactor Cycle

**Example: Implementing Variable Mapper Function**

#### Step 1: Write Test First (RED - fails)

```bash
# Create test file
touch backend/tests/test_quotes_calc_mapper.py

# Write test cases (see PLAN_CALCULATION_ENGINE_CONNECTION.md)
# Example test:
```

```python
def test_mapper_with_minimal_data():
    """Test mapper with only required fields"""
    product = MockProduct()
    variables = {'seller_company': 'МАСТЕР БЭРИНГ ООО', ...}
    admin_settings = {'rate_forex_risk': 3.0, ...}

    result = map_variables_to_calculation_input(product, variables, admin_settings)

    assert result.product.base_price_VAT == Decimal("1000.0")
    assert result.financial.markup == Decimal("15")
```

```bash
# Run test (will FAIL - function doesn't exist yet)
cd backend
pytest tests/test_quotes_calc_mapper.py::test_mapper_with_minimal_data -v

# Output: RED (test fails)
# FAILED - ImportError: cannot import name 'map_variables_to_calculation_input'
```

#### Step 2: Implement Feature (GREEN - passes)

```bash
# Implement mapper function in backend/routes/quotes_calc.py
# (Follow implementation plan)

# Run test again
pytest tests/test_quotes_calc_mapper.py::test_mapper_with_minimal_data -v

# Output: GREEN (test passes)
# PASSED tests/test_quotes_calc_mapper.py::test_mapper_with_minimal_data
```

#### Step 3: Refactor & Verify Coverage

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

## Testing After Each Feature Implementation

### Phase-by-Phase Testing Guide

Following `.claude/PLAN_CALCULATION_ENGINE_CONNECTION.md`:

#### After Phase 1: Variable Mapper

```bash
cd backend

# Run unit tests for mapper
pytest tests/test_quotes_calc_mapper.py -v

# Expected: All tests pass
# - test_safe_decimal_conversion
# - test_mapper_with_minimal_data
# - test_mapper_with_product_overrides
# - test_mapper_with_all_defaults

# Check coverage
pytest tests/test_quotes_calc_mapper.py --cov=routes.quotes_calc --cov-report=term-missing

# Expected coverage: 80%+ for mapper functions
```

#### After Phase 3: Update Endpoint

```bash
cd backend

# Run integration test
pytest tests/test_quotes_calc_integration.py::test_calculate_quote_with_minimal_data -v

# Expected: Test passes, quote created successfully
```

#### After Phase 4: Validation

```bash
cd backend

# Run validation tests
pytest tests/test_quotes_calc_integration.py::test_calculate_quote_validation_errors -v

# Expected: Test passes, validation errors returned correctly
```

#### After All Phases Complete

```bash
cd backend

# Run full test suite
pytest tests/test_quotes_calc*.py -v --cov=routes.quotes_calc --cov-report=term-missing

# Expected:
# - All tests pass (6-8 tests)
# - Coverage 80%+ for routes/quotes_calc.py
# - No critical warnings
```

---

## CI/CD Integration

### GitHub Actions (Automatic)

**On every push to main:**
1. Backend: `pytest` runs all tests
2. Frontend: `npm run lint && npm run type-check && npm run build`

**View CI results:**
- GitHub repo → Actions tab
- Check green ✅ or red ❌ status

### Local Pre-commit Hooks

**Configured in `.husky/pre-commit`:**
- ESLint auto-fixes frontend code
- Prettier formats all code
- TypeScript type checks
- Tests NOT run (too slow for pre-commit)

### Before Pushing to GitHub

```bash
# Ensure all tests pass locally
cd backend && pytest
cd frontend && npm test

# Ensure CI checks will pass
cd frontend && npm run lint && npm run type-check && npm run build

# If all green, safe to push
git push
```

---

## Test Coverage Goals

### Backend

| Module | Coverage Goal | Current |
|--------|--------------|---------|
| Routes | 80%+ | Check: `pytest --cov=routes` |
| Calculation Engine | 95%+ | Critical business logic |
| Models | 70%+ | Pydantic validation |
| Auth | 85%+ | Security-critical |

### Frontend

| Component Type | Coverage Goal | Current |
|----------------|--------------|---------|
| Pages | 60%+ | UI components |
| Services (API) | 80%+ | Data layer |
| Utils | 90%+ | Pure functions |
| Components | 60%+ | Reusable UI |

### How to Check Coverage

```bash
# Backend - all modules
cd backend
pytest --cov=. --cov-report=html
open htmlcov/index.html  # View in browser

# Backend - specific module
pytest --cov=routes.quotes_calc --cov-report=term-missing

# Frontend - all files
cd frontend
npm test -- --coverage
# View: coverage/lcov-report/index.html
```

---

## Test Data & Fixtures

### Backend Test Data

**Location:** `backend/tests/`

**Fixtures defined in:** `backend/tests/conftest.py`

```python
# Example fixtures
@pytest.fixture
def test_user():
    """Returns test user credentials"""
    return {
        "email": "andrey@masterbearingsales.ru",
        "password": "password"
    }

@pytest.fixture
def mock_product():
    """Returns mock product for testing"""
    return ProductFromFile(
        product_name="Test Bearing",
        base_price_vat=1000.0,
        quantity=10,
        weight_in_kg=25.0
    )
```

**Sample data files:**
- `backend/tests/sample_products.csv` - Sample product upload
- `backend/tests/sample_products.xlsx` - Excel version

### Frontend Test Data

**Mock API responses:** `frontend/src/__mocks__/`

**Test utilities:** `frontend/src/lib/test-utils.tsx`

```typescript
// Example mock
export const mockQuote = {
  quote_id: "test-quote-123",
  quote_number: "КП25-0001",
  customer_id: "test-customer",
  total_amount: 150000.50
};
```

---

## Debugging Failed Tests

### View Detailed Output

```bash
# Very verbose mode
pytest -vv

# Show print statements
pytest -s

# Drop into debugger on failure
pytest --pdb

# Show full traceback
pytest --tb=long
```

### Run Single Test

```bash
# Specific test function
pytest tests/test_file.py::test_function_name -v

# Specific test class
pytest tests/test_file.py::TestClassName -v

# Specific test with keyword
pytest -k "mapper" -v  # Runs all tests with "mapper" in name
```

### See What Tests Exist

```bash
# List all tests without running
pytest --collect-only

# List tests in specific file
pytest tests/test_quotes_calc_mapper.py --collect-only
```

### Debug with Print Statements

```python
def test_mapper():
    result = map_variables(...)
    print(f"DEBUG: result = {result}")  # Will show with -s flag
    assert result.markup == 15
```

```bash
# Run with print output
pytest tests/test_file.py::test_mapper -s
```

---

## Common Testing Scenarios

### Testing API Endpoints

```python
@pytest.mark.asyncio
async def test_calculate_endpoint(test_client, auth_headers):
    """Test /calculate endpoint"""
    response = test_client.post(
        "/api/quotes-calc/calculate",
        json={"customer_id": "123", "products": [...]},
        headers=auth_headers
    )
    assert response.status_code == 201
    assert "quote_id" in response.json()
```

### Testing with Database

```python
@pytest.mark.asyncio
async def test_create_quote_in_db(supabase_client):
    """Test quote is saved to database"""
    # Create quote
    result = await create_quote(...)

    # Verify in DB
    db_quote = supabase_client.table("quotes").select("*").eq("id", result.quote_id).execute()
    assert len(db_quote.data) == 1
    assert db_quote.data[0]["total_amount"] > 0
```

### Testing Validation Errors

```python
def test_validation_fails_for_invalid_data():
    """Test validation raises proper errors"""
    with pytest.raises(HTTPException) as exc_info:
        validate_request(invalid_data)

    assert exc_info.value.status_code == 422
    assert "Отсутствует обязательное поле" in str(exc_info.value.detail)
```

### Testing Frontend Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import QuoteCreatePage from '@/app/quotes/create/page';

test('shows validation error when calculate clicked without data', async () => {
  render(<QuoteCreatePage />);

  const calculateButton = screen.getByText(/Рассчитать/i);
  fireEvent.click(calculateButton);

  expect(await screen.findByText(/Выберите клиента/i)).toBeInTheDocument();
});
```

---

## Performance Testing

### Measure Test Execution Time

```bash
# Show slowest tests
pytest --durations=10

# Show all test durations
pytest --durations=0
```

### Profile Code During Tests

```bash
# Install pytest-profiling
pip install pytest-profiling

# Run with profiling
pytest --profile

# View results
snakeviz prof/combined.prof
```

---

## Continuous Testing Best Practices

### 1. Test File Naming Convention

```
backend/tests/
├── test_quotes_calc_mapper.py      # Unit tests for mapper
├── test_quotes_calc_integration.py  # Integration tests
├── test_calculation_engine.py       # Engine logic tests
└── conftest.py                      # Shared fixtures

frontend/src/
├── app/quotes/create/__tests__/
│   └── page.test.tsx                # Component tests
└── lib/api/__tests__/
    └── quotes-calc-service.test.ts  # API service tests
```

### 2. Test Organization

```python
class TestQuotesCalcMapper:
    """Group related tests together"""

    def test_minimal_data(self):
        ...

    def test_with_overrides(self):
        ...

    def test_all_defaults(self):
        ...
```

### 3. Meaningful Test Names

```python
# Good ✅
def test_mapper_uses_product_override_when_provided():
    ...

# Bad ❌
def test_mapper_1():
    ...
```

### 4. Arrange-Act-Assert Pattern

```python
def test_calculate_quote():
    # Arrange - set up test data
    product = MockProduct()
    variables = {...}

    # Act - perform action
    result = calculate(product, variables)

    # Assert - verify results
    assert result.total > 0
```

### 5. Independent Tests

```python
# Each test should be independent
# Don't rely on execution order

def test_create_quote():
    # Create its own data
    quote = create_quote_for_test()
    ...

def test_update_quote():
    # Create its own data (don't use quote from test_create_quote)
    quote = create_quote_for_test()
    ...
```

---

## Troubleshooting Common Issues

### Issue: Tests pass locally but fail in CI

```bash
# Check environment differences
# - Python/Node version mismatch?
# - Missing dependencies?
# - Database not available in CI?

# Solution: Mirror CI environment locally
docker-compose up  # Use same Docker image as CI
```

### Issue: Flaky tests (sometimes pass, sometimes fail)

```bash
# Run test multiple times to reproduce
pytest tests/test_file.py::test_flaky --count=100

# Common causes:
# - Race conditions
# - External API calls
# - Time-dependent logic
# - Random data

# Solution: Use fixed seeds, mock external calls
```

### Issue: Tests are too slow

```bash
# Identify slow tests
pytest --durations=10

# Solutions:
# - Use pytest-xdist for parallel execution
pytest -n auto  # Run tests in parallel

# - Mock expensive operations
@patch('supabase_client.query')
def test_with_mock(mock_query):
    ...

# - Use smaller test data
```

---

## Resources

**pytest Documentation:** https://docs.pytest.org/
**Testing Best Practices:** https://docs.python-guide.org/writing/tests/
**React Testing Library:** https://testing-library.com/react
**FastAPI Testing:** https://fastapi.tiangolo.com/tutorial/testing/

---

**Last Updated:** 2025-10-21
**See Also:** `.claude/PLAN_CALCULATION_ENGINE_CONNECTION.md` for implementation-specific testing
