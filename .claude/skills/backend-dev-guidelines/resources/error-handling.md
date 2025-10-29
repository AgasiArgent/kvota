# Error Handling Patterns - Backend

**Last Updated:** 2025-10-29

Complete guide to error handling in FastAPI backend with proper status codes, validation, and recovery strategies.

---

## Core Principles

1. **Always re-raise HTTPException** - Don't catch and convert to generic error
2. **Use correct status codes** - 404 for not found, 400 for bad input, 401 for auth, 403 for forbidden, 500 for server errors
3. **Consistent error structure** - All errors return JSON with `detail` field
4. **Never expose sensitive info** - Don't leak database structure, credentials, or internal paths
5. **Log before raising 500s** - Help debugging without exposing details to client
6. **Validate early** - Use Pydantic for input validation, catch errors at boundary

---

## 1. HTTPException Patterns

### Standard Try/Except Pattern

**✅ CORRECT - Re-raise HTTPException:**
```python
from fastapi import HTTPException, status

@router.get("/{quote_id}")
async def get_quote(
    quote_id: str,
    user: User = Depends(get_current_user)
):
    try:
        result = supabase.table("quotes") \
            .select("*") \
            .eq("id", quote_id) \
            .eq("organization_id", str(user.current_organization_id)) \
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        return result.data[0]

    except HTTPException:
        raise  # ✅ Re-raise HTTP exceptions as-is

    except Exception as e:
        # Log for debugging (server-side only)
        print(f"Error fetching quote {quote_id}: {str(e)}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
```

**❌ WRONG - Catching HTTPException and converting:**
```python
try:
    if not result.data:
        raise HTTPException(status_code=404, detail="Quote not found")
    return result.data[0]
except Exception as e:  # ❌ Catches HTTPException too!
    # Now user gets 500 instead of 404
    raise HTTPException(status_code=500, detail=str(e))
```

---

## 2. Status Codes Reference

### 2xx Success
- **200 OK** - Successful GET/PUT/PATCH
- **201 Created** - Successful POST (resource created)
- **204 No Content** - Successful DELETE

### 4xx Client Errors
- **400 Bad Request** - Invalid input (business logic violation)
- **401 Unauthorized** - Missing or invalid auth token
- **403 Forbidden** - Valid token but insufficient permissions
- **404 Not Found** - Resource doesn't exist
- **409 Conflict** - Duplicate resource (e.g., email already exists)
- **422 Unprocessable Entity** - Validation error (Pydantic)

### 5xx Server Errors
- **500 Internal Server Error** - Unexpected server/database error
- **503 Service Unavailable** - Temporary downtime

### When to Use Which Status Code

**404 Not Found:**
```python
# Resource doesn't exist
if not result.data or len(result.data) == 0:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Quote not found"
    )
```

**400 Bad Request:**
```python
# Business rule violation
if incoterms != "EXW" and logistics_total <= 0:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Incoterms {incoterms} requires at least one logistics cost > 0"
    )
```

**401 Unauthorized:**
```python
# Missing or invalid token (handled in auth.py)
if not token:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"}
    )
```

**403 Forbidden:**
```python
# User doesn't have permission
if user.role not in ["admin", "owner"]:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required"
    )
```

**409 Conflict:**
```python
# Duplicate resource
existing = supabase.table("customers").select("*").eq("email", email).execute()
if existing.data:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Customer with this email already exists"
    )
```

**422 Unprocessable Entity:**
```python
# Pydantic validation error (see section 3)
try:
    product = ProductInput(**data)
except ValidationError as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=e.errors()
    )
```

**500 Internal Server Error:**
```python
# Unexpected database/system error
except Exception as e:
    print(f"Unexpected error: {str(e)}")  # Log it
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="An unexpected error occurred"  # Don't expose details
    )
```

---

## 3. Validation Errors

### Pydantic Validation

**Automatic validation (preferred):**
```python
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal

class ProductInput(BaseModel):
    sku: str = Field(..., min_length=1, max_length=50)
    quantity: int = Field(gt=0, le=10000)
    base_price_vat: Decimal = Field(gt=0, decimal_places=2)

    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("SKU cannot be empty or whitespace")
        return v.strip().upper()

# FastAPI automatically validates and returns 422 if invalid
@router.post("/products")
async def create_product(product: ProductInput):
    # product is already validated here
    return {"product": product}
```

**Manual validation (when needed):**
```python
from pydantic import ValidationError

@router.post("/products/bulk")
async def create_products(data: dict):
    try:
        products = [ProductInput(**item) for item in data["products"]]
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.errors()  # Returns field-level errors
        )

    # Process validated products
    return {"created": len(products)}
```

**Validation error response format:**
```json
{
  "detail": [
    {
      "type": "greater_than",
      "loc": ["body", "base_price_vat"],
      "msg": "Input should be greater than 0",
      "input": -10.5
    },
    {
      "type": "string_too_short",
      "loc": ["body", "sku"],
      "msg": "String should have at least 1 character",
      "input": ""
    }
  ]
}
```

### Business Logic Validation

**Validate before database operations:**
```python
def validate_quote_data(data: dict) -> list[str]:
    """Validate quote business rules, return list of errors"""
    errors = []

    # Required fields
    if not data.get("seller_company"):
        errors.append("seller_company is required")

    if not data.get("offer_incoterms"):
        errors.append("offer_incoterms is required")

    # Business rule: Non-EXW requires logistics
    incoterms = data.get("offer_incoterms")
    if incoterms and incoterms != "EXW":
        logistics_total = sum([
            data.get("logistics_supplier_hub", 0),
            data.get("logistics_hub_customs", 0),
            data.get("logistics_customs_client", 0)
        ])
        if logistics_total <= 0:
            errors.append(
                f"Incoterms {incoterms} requires at least one logistics cost > 0"
            )

    # Currency validation
    valid_currencies = ["USD", "RUB", "EUR"]
    currency = data.get("currency_of_base_price")
    if currency and currency not in valid_currencies:
        errors.append(f"Invalid currency: {currency}. Must be one of {valid_currencies}")

    return errors

@router.post("/quotes")
async def create_quote(data: dict):
    errors = validate_quote_data(data)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"errors": errors}  # Return all errors at once
        )

    # Proceed with creation
```

---

## 4. Database Errors

### Connection Errors

**Supabase client (REST API - more reliable):**
```python
try:
    result = supabase.table("quotes").select("*").execute()
    return result.data
except Exception as e:
    # Network error, Supabase API down, etc.
    print(f"Supabase API error: {str(e)}")
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database service temporarily unavailable"
    )
```

**asyncpg (direct connection - prone to timeout):**
```python
import asyncpg

async def get_quotes_with_stats():
    try:
        conn = await asyncpg.connect(
            os.getenv("DATABASE_URL"),
            timeout=10  # ✅ Always set timeout
        )

        try:
            await set_rls_context(conn, user)
            result = await conn.fetch("SELECT * FROM quotes")
            return result
        finally:
            await conn.close()  # ✅ Always close in finally

    except asyncpg.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Database query timeout"
        )
    except asyncpg.PostgresConnectionError as e:
        print(f"Database connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    except Exception as e:
        print(f"Unexpected database error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )
```

### Constraint Violations

**Unique constraint:**
```python
try:
    result = supabase.table("customers").insert({
        "email": email,
        "organization_id": org_id
    }).execute()
except Exception as e:
    if "duplicate key value" in str(e).lower():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer with this email already exists"
        )
    raise
```

**Foreign key constraint:**
```python
try:
    result = supabase.table("quotes").insert({
        "customer_id": customer_id,
        "organization_id": org_id
    }).execute()
except Exception as e:
    if "foreign key constraint" in str(e).lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid customer_id"
        )
    raise
```

---

## 5. Error Response Format

### Consistent Structure

**Simple error:**
```json
{
  "detail": "Quote not found"
}
```

**Validation errors (Pydantic):**
```json
{
  "detail": [
    {
      "type": "greater_than",
      "loc": ["body", "quantity"],
      "msg": "Input should be greater than 0",
      "input": -5
    }
  ]
}
```

**Business logic errors:**
```json
{
  "detail": {
    "errors": [
      "seller_company is required",
      "Incoterms DDP requires at least one logistics cost > 0"
    ]
  }
}
```

### Error Messages (User-Facing vs Technical)

**✅ User-facing errors (in Russian if needed):**
```python
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Необходимо заполнить стоимость логистики для условий DDP"
)
```

**❌ Don't expose technical details:**
```python
# ❌ WRONG - Exposes database structure
detail=f"Foreign key constraint failed on column 'customer_id' in table 'quotes'"

# ✅ CORRECT - User-friendly message
detail="Invalid customer ID"
```

**❌ Don't expose credentials:**
```python
# ❌ WRONG
detail=f"Cannot connect to postgresql://user:password@host:5432/db"

# ✅ CORRECT
detail="Database connection failed"
```

---

## 6. Logging Patterns

### Log Before Raising 500s

**Always log server errors:**
```python
import logging

logger = logging.getLogger(__name__)

@router.get("/quotes")
async def list_quotes(user: User = Depends(get_current_user)):
    try:
        result = supabase.table("quotes").select("*").execute()
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        # ✅ Log full error with context
        logger.error(
            f"Failed to fetch quotes for user {user.id} "
            f"in org {user.current_organization_id}: {str(e)}",
            exc_info=True  # Include stack trace
        )

        # Return generic error to client
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch quotes"
        )
```

### Log Levels

- **DEBUG:** Variable values, flow control
- **INFO:** Successful operations (quote created, file uploaded)
- **WARNING:** Recoverable errors (retry succeeded, deprecated API used)
- **ERROR:** Failed operations (500 errors, database down)
- **CRITICAL:** System-wide failures (cannot start server)

---

## 7. Error Recovery Strategies

### Retry with Exponential Backoff

```python
import asyncio
from functools import wraps

async def retry_with_backoff(func, max_retries=3, base_delay=1):
    """Retry async function with exponential backoff"""
    for attempt in range(max_retries):
        try:
            return await func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise  # Last attempt failed
            delay = base_delay * (2 ** attempt)
            await asyncio.sleep(delay)

@router.get("/quotes")
async def list_quotes():
    async def fetch():
        return supabase.table("quotes").select("*").execute()

    try:
        result = await retry_with_backoff(fetch, max_retries=3)
        return result.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database temporarily unavailable"
        )
```

### Graceful Degradation

```python
@router.get("/dashboard/stats")
async def get_dashboard_stats(user: User = Depends(get_current_user)):
    stats = {"quotes": None, "revenue": None}

    # Try to get quote count
    try:
        result = supabase.table("quotes").select("*", count="exact").execute()
        stats["quotes"] = result.count
    except Exception as e:
        logger.warning(f"Failed to fetch quote count: {str(e)}")
        # Continue with partial data

    # Try to get revenue
    try:
        result = supabase.rpc("calculate_total_revenue").execute()
        stats["revenue"] = result.data
    except Exception as e:
        logger.warning(f"Failed to fetch revenue: {str(e)}")
        # Continue with partial data

    return stats  # Return what we have
```

### Circuit Breaker (for external APIs)

```python
from datetime import datetime, timedelta

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failures = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half_open

    async def call(self, func):
        if self.state == "open":
            if datetime.now() - self.last_failure_time > timedelta(seconds=self.timeout):
                self.state = "half_open"
            else:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Service temporarily unavailable"
                )

        try:
            result = await func()
            if self.state == "half_open":
                self.state = "closed"
                self.failures = 0
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure_time = datetime.now()
            if self.failures >= self.failure_threshold:
                self.state = "open"
            raise

# Usage
exchange_rate_breaker = CircuitBreaker(failure_threshold=3, timeout=60)

@router.get("/exchange-rates")
async def get_exchange_rates():
    async def fetch():
        # External API call
        return await cbr_api.get_rates()

    try:
        return await exchange_rate_breaker.call(fetch)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Exchange rate service unavailable"
        )
```

---

## 8. Common Patterns Summary

### Resource Not Found (404)
```python
if not result.data:
    raise HTTPException(status_code=404, detail="Quote not found")
```

### Invalid Input (400)
```python
if quantity <= 0:
    raise HTTPException(status_code=400, detail="Quantity must be positive")
```

### Unauthorized (401)
```python
if not token:
    raise HTTPException(status_code=401, detail="Authentication required")
```

### Forbidden (403)
```python
if user.role not in ["admin", "owner"]:
    raise HTTPException(status_code=403, detail="Admin access required")
```

### Validation Error (422)
```python
try:
    data = ProductInput(**request_data)
except ValidationError as e:
    raise HTTPException(status_code=422, detail=e.errors())
```

### Server Error (500)
```python
except Exception as e:
    logger.error(f"Unexpected error: {str(e)}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

---

## Best Practices Checklist

- ✅ Always re-raise HTTPException (don't convert to generic error)
- ✅ Use correct status codes (404, 400, 401, 403, 422, 500)
- ✅ Return consistent error structure with `detail` field
- ✅ Never expose sensitive info (credentials, database structure, file paths)
- ✅ Log errors before raising 500s (with context and stack trace)
- ✅ Validate input early with Pydantic (automatic 422 responses)
- ✅ Return all validation errors at once (don't make user fix one at a time)
- ✅ Use business-friendly error messages (Russian for user-facing)
- ✅ Set timeouts on database connections (prevent hanging)
- ✅ Always close connections in `finally` block
- ✅ Consider retry logic for transient failures
- ✅ Graceful degradation for non-critical features
- ✅ Circuit breaker for unreliable external APIs
