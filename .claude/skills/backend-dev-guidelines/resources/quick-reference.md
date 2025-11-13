# Backend Quick Reference

**Purpose:** Cheat sheet for common operations and gotchas

---

## Most Common Gotchas (Top 9)

**These are real bugs we've encountered. Avoid them!**

### 1. 🔴 CRITICAL: Missing organization_id Filter (Data Leak)

**Problem:** Forgot to filter by organization, users can see other orgs' data.
**Bug Reference:** BUG-001 (Session 31, FIXED)

```python
# ❌ WRONG - Data leak!
result = supabase.table("quotes").select("*").execute()

# ✅ CORRECT
result = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", user.org_id) \
    .execute()
```

**Solution:** Always filter by `organization_id`. Test RLS isolation.

---

### 2. Missing Customer JOIN (Blank Names in UI)

**Problem:** Quote has `customer_id` but name is NULL in response.
**Bug Reference:** BUG-002 (Session 31, FIXED)

```python
# ❌ WRONG - customer_id only
result = supabase.table("quotes").select("*").execute()

# ✅ CORRECT - Join customer table
result = supabase.table("quotes") \
    .select("*, customer:customers(name, email)") \
    .execute()
```

**Solution:** Use Supabase JOIN syntax for related data.

---

### 3. Activity Log Decorator Not Applied

**Problem:** Admin changes not logged, incomplete audit trail.
**Bug Reference:** BUG-003 (Session 26, FIXED)

```python
# ❌ WRONG - No logging
@router.put("/settings")
async def update_settings(data: dict, user: User = Depends(get_current_user)):
    return await save_settings(data)

# ✅ CORRECT - Activity logged
from activity_log import log_activity

@router.put("/settings")
@log_activity("calculation_settings.update")
async def update_settings(data: dict, user: User = Depends(get_current_user)):
    return await save_settings(data)
```

**Solution:** Apply `@log_activity()` decorator to admin endpoints.

---

### 4. Concurrent Request Bottleneck (66x Slowdown)

**Problem:** Sequential database calls for 200 quotes = 66x slower than batched.
**Bug Reference:** BUG-004 (Session 26, IDENTIFIED)

```python
# ❌ WRONG - Sequential (66x slower)
for quote in quotes:
    customer = supabase.table("customers").select("*").eq("id", quote["customer_id"]).execute()
    quote["customer_name"] = customer.data[0]["name"]

# ✅ CORRECT - Single JOIN query
result = supabase.table("quotes") \
    .select("*, customer:customers(name)") \
    .execute()
```

**Solution:** Use JOINs instead of N+1 queries.

---

### 5. UUID Not Converted to String (Export Crashes)

**Problem:** `openpyxl` can't serialize UUID objects.
**Bug Reference:** BUG-005 (Session 31, FIXED)

```python
# ❌ WRONG - UUID object crashes Excel export
ws.append([quote["id"], quote["customer_id"]])  # TypeError

# ✅ CORRECT - Convert to string
ws.append([str(quote["id"]), str(quote["customer_id"])])
```

**Solution:** Always `str(uuid_value)` before export.

---

### 6. Decimal Serialization (API Returns Invalid JSON)

**Problem:** FastAPI can't serialize `Decimal` objects.
**Bug Reference:** BUG-007 (Session 33, FIXED)

```python
from decimal import Decimal
from pydantic import BaseModel

# ❌ WRONG - Decimal breaks JSON
return {"total": Decimal("1000.50")}

# ✅ CORRECT - Use Pydantic model
class QuoteResponse(BaseModel):
    total: Decimal  # Auto-serialized by Pydantic

return QuoteResponse(total=Decimal("1000.50"))
```

**Solution:** Use Pydantic models for all responses.

---

### 7. Admin Settings Not Fetched (Calculations Wrong)

**Problem:** Using default 0% rates instead of actual admin settings.
**Bug Reference:** BUG-008 (Session 15, FIXED)

```python
# ❌ WRONG - Missing admin settings
def calculate(data: dict):
    forex_risk = 0  # Should be from admin settings!
    return total * (1 + forex_risk)

# ✅ CORRECT - Fetch admin settings
def calculate(data: dict, admin_settings: dict):
    forex_risk = admin_settings.get("rate_forex_risk", 0)
    return total * (1 + forex_risk)
```

**Solution:** Always fetch `calculation_settings` for calculations.

---

### 8. Rate Limiting Not Applied (API Abuse)

**Problem:** No rate limiting on expensive endpoints.
**Bug Reference:** BUG-009 (Session 26, FIXED)

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# ❌ WRONG - No rate limit
@router.post("/calculate")
async def calculate_quote(data: dict):
    return complex_calculation(data)

# ✅ CORRECT - Rate limited
@router.post("/calculate")
@limiter.limit("10/minute")
async def calculate_quote(data: dict):
    return complex_calculation(data)
```

**Solution:** Apply `@limiter.limit()` to expensive endpoints.

---

### 9. Missing Indexes (Slow Queries)

**Problem:** Queries scan entire table instead of using index.
**Bug Reference:** BUG-010 (Session 31, FIXED)

```sql
-- ❌ WRONG - No index on organization_id
SELECT * FROM quotes WHERE organization_id = 'xxx';  -- Slow!

-- ✅ CORRECT - Add index
CREATE INDEX idx_quotes_organization_id ON quotes(organization_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
```

**Solution:** Add indexes on frequently filtered columns.

---

**See:** [common-gotchas.md](common-gotchas.md) for complete details.
**See:** [../../MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md) for all bugs.

---

## Quick Commands

### Development
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload              # Start server on :8000
uvicorn main:app --reload --port 8001  # Alternative port
```

### Testing
```bash
cd backend
pytest -v                                    # Run all tests
pytest tests/test_quotes.py -v               # Specific file
pytest tests/test_quotes.py::test_name -v    # Specific test
pytest --cov=. --cov-report=term-missing     # With coverage
pytest --cov=. --cov-report=html            # HTML coverage report
ptw -v                                       # Watch mode (auto-rerun)
```

### Database
```bash
# Via Supabase dashboard SQL editor
SELECT * FROM quotes WHERE organization_id = '<uuid>';

# Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'quotes';

# Test RLS as specific user
SET request.jwt.claims = '{"organization_id": "<uuid>", "role": "member"}';
SELECT * FROM quotes;  -- Should only see that org's data
```

### Quick RLS Test
```python
# Set organization context
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    str(organization_id)
)

# Now query should only return that org's data
rows = await conn.fetch("SELECT * FROM quotes")
assert len(rows) > 0  # Should see own org's data

# Test isolation - different org
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    str(other_org_id)
)
rows = await conn.fetch("SELECT * FROM quotes WHERE id = $1", quote_id_from_first_org)
assert len(rows) == 0  # Should NOT see other org's data
```

---

## Status Code Quick Reference

| Code | When to Use | Example |
|------|-------------|---------|
| **200** | Success (GET, PUT) | Quote retrieved/updated |
| **201** | Created (POST) | New quote created |
| **204** | Success, no content (DELETE) | Quote deleted |
| **400** | Bad request | Invalid JSON, ValueError |
| **401** | Not authenticated | Missing/invalid JWT |
| **403** | Not authorized | Wrong role/permissions |
| **404** | Not found | Quote doesn't exist |
| **409** | Conflict | Duplicate quote number |
| **422** | Validation error | Pydantic validation failed |
| **500** | Server error | Uncaught exception |

---

## Pydantic Quick Patterns

### Required vs Optional Fields
```python
from typing import Optional
from pydantic import BaseModel, Field

class QuoteModel(BaseModel):
    # Required fields
    customer_id: str
    total_amount: Decimal

    # Optional fields
    notes: Optional[str] = None
    discount: Optional[Decimal] = None
```

### Field Validation
```python
class QuoteModel(BaseModel):
    quantity: int = Field(gt=0, description="Must be positive")
    email: str = Field(regex=r'^[^@]+@[^@]+\.[^@]+$')
    price: Decimal = Field(ge=0, decimal_places=2)
    delivery_days: int = Field(ge=1, le=365)
    rate: float = Field(ge=0, le=1)  # 0-100%
```

### Custom Validation
```python
from pydantic import validator

class QuoteModel(BaseModel):
    start_date: date
    end_date: date

    @validator('end_date')
    def end_after_start(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v
```

---

## Common Patterns

### Fetch with Organization Filter
```python
# Always include organization filter
result = supabase.table("quotes") \
    .select("*, customer:customers(name)") \
    .eq("organization_id", user.org_id) \
    .order("created_at", desc=True) \
    .execute()
```

### Admin Check Pattern
```python
from auth import check_admin_permissions

@router.put("/api/settings")
async def update_settings(
    data: dict,
    user: User = Depends(get_current_user)
):
    # Verify admin role
    check_admin_permissions(user)

    # Proceed with admin operation
    ...
```

### Error Handling Pattern
```python
try:
    result = await operation()
    if not result:
        raise HTTPException(404, "Not found")
    return result

except HTTPException:
    raise  # Re-raise HTTP exceptions

except Exception as e:
    logger.error(f"Error: {str(e)}")
    raise HTTPException(500, "Internal server error")
```

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| Python | 3.12 | Type hints, match statements |
| FastAPI | Latest | Async by default |
| Pydantic | 2.x | v2 API (not v1) |
| Supabase | Latest | Python client |
| PostgreSQL | 15+ | Via Supabase |
| openpyxl | Latest | Excel export |
| WeasyPrint | Latest | PDF export (requires GTK in WSL2) |
| pytest | 8.3.5 | Async testing with pytest-asyncio |

**Compatibility Notes:**
- WeasyPrint requires GTK libraries (works in WSL2, not native Windows)
- Supabase service role key bypasses RLS (CRITICAL security concern)
- asyncpg for direct DB access, Supabase client for REST API
- Decimal type requires Pydantic models for JSON serialization

---

## Performance Tips

### Database Queries
- ✅ Use JOINs to avoid N+1 queries
- ✅ Add indexes on filtered columns (organization_id, status, created_at)
- ✅ Use `select()` to limit returned columns
- ✅ Batch operations when possible

### API Optimization
- ✅ Use async/await for all I/O operations
- ✅ Apply rate limiting on expensive endpoints
- ✅ Cache admin settings (don't fetch every request)
- ✅ Return paginated results for large datasets

### Export Optimization
- ✅ Stream large files instead of loading in memory
- ✅ Use background tasks for file cleanup
- ✅ Generate exports in batches for huge datasets
- ✅ Convert UUIDs to strings before serialization

---

**Quick Links:**
- [Full Gotchas List](common-gotchas.md)
- [Bug Inventory](../../MASTER_BUG_INVENTORY.md)
- [Backend SKILL.md](../SKILL.md)
- [Testing Patterns](testing-patterns.md)
- [RLS Guide](supabase-rls.md)