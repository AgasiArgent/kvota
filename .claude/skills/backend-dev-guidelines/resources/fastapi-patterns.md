# FastAPI Patterns - B2B Quotation Platform

**Last Updated:** 2025-10-29

Comprehensive patterns for FastAPI backend development in this project.

---

## 1. Route Definition Patterns

### Basic Router Setup

```python
from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_user, User

router = APIRouter(prefix="/api/quotes", tags=["quotes"])

@router.get("/")
async def list_quotes(user: User = Depends(get_current_user)):
    """List all quotes for user's organization"""
    # Implementation
    return {"quotes": quotes}
```

**Key Points:**
- Always use `APIRouter` with prefix and tags
- All routes must be `async def` (asyncio pattern)
- Include authentication via `Depends(get_current_user)`
- Use descriptive docstrings for auto-generated API docs

### Path Parameters

```python
from uuid import UUID
from typing import Optional

@router.get("/{quote_id}")
async def get_quote(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """Get single quote by ID"""
    result = supabase.table("quotes").select("*")\
        .eq("id", str(quote_id))\
        .eq("organization_id", str(user.org_id))\
        .execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )

    return result.data[0]
```

### Query Parameters

```python
@router.get("/")
async def list_quotes(
    status: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    user: User = Depends(get_current_user)
):
    """List quotes with optional filtering"""
    query = supabase.table("quotes").select("*")\
        .eq("organization_id", str(user.org_id))

    if status:
        query = query.eq("status", status)

    result = query.order("created_at", desc=True)\
        .range(offset, offset + limit - 1)\
        .execute()

    return {"quotes": result.data, "total": len(result.data)}
```

### Request Body Handling

```python
from pydantic import BaseModel

class QuoteCreate(BaseModel):
    customer_id: UUID
    items: list[dict]
    notes: Optional[str] = None

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_quote(
    data: QuoteCreate,
    user: User = Depends(get_current_user)
):
    """Create new quote"""
    quote = {
        "customer_id": str(data.customer_id),
        "organization_id": str(user.org_id),
        "status": "draft",
        "created_by": str(user.id)
    }

    result = supabase.table("quotes").insert(quote).execute()
    return result.data[0]
```

---

## 2. Pydantic Model Patterns

### Request Models (Input Validation)

```python
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from typing import Optional
from datetime import datetime

class ProductInput(BaseModel):
    """Product data for quote creation"""
    sku: Optional[str] = None
    brand: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=200)
    base_price_vat: Decimal = Field(gt=0, description="Price including VAT")
    quantity: int = Field(gt=0)
    weight_in_kg: Optional[Decimal] = Field(default=None, ge=0)

    # Optional overrides
    currency_of_base_price: Optional[str] = Field(
        default=None,
        pattern="^(USD|RUB|EUR|CNY|TRY)$"
    )
    supplier_country: Optional[str] = None

    @field_validator('sku')
    @classmethod
    def validate_sku(cls, v: Optional[str]) -> Optional[str]:
        """SKU must be alphanumeric if provided"""
        if v and not v.replace('-', '').replace('_', '').isalnum():
            raise ValueError("SKU must be alphanumeric (-, _ allowed)")
        return v
```

**Field Validation Options:**
- `gt` - Greater than
- `ge` - Greater than or equal
- `lt` - Less than
- `le` - Less than or equal
- `min_length`, `max_length` - String length
- `pattern` - Regex pattern
- `default` - Default value
- `...` - Required field (no default)

### Response Models (Output Formatting)

```python
class QuoteResponse(BaseModel):
    """Quote response with computed fields"""
    id: str
    quote_number: str
    customer_name: str
    total_amount: Decimal
    currency: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Allows SQLAlchemy/DB models
        json_encoders = {
            Decimal: lambda v: float(v),  # Convert Decimal to float for JSON
            datetime: lambda v: v.isoformat()  # ISO format for dates
        }
```

### Nested Models

```python
class AddressInput(BaseModel):
    street: str
    city: str
    country: str
    postal_code: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    address: AddressInput  # Nested model
    credit_limit: Optional[Decimal] = Field(default=None, ge=0)
```

### Optional vs Required Fields

```python
from typing import Optional

class QuoteUpdate(BaseModel):
    """All fields optional for PATCH operations"""
    customer_id: Optional[UUID] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        # Don't include fields with None values in output
        exclude_none = True
```

---

## 3. Dependency Injection

### Basic Authentication

```python
from auth import get_current_user, User

@router.get("/profile")
async def get_profile(user: User = Depends(get_current_user)):
    """Get current user profile"""
    # user.id          - User UUID
    # user.email       - Email address
    # user.role        - Role enum (member, manager, admin, owner)
    # user.org_id      - Organization UUID

    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "organization_id": str(user.org_id)
    }
```

### Role-Based Access

```python
from auth import require_role, require_permission, UserRole

# Require specific role (admin or owner only)
@router.post("/admin/settings")
async def admin_settings(
    user: User = Depends(require_role(UserRole.ADMIN))
):
    """Admin-only endpoint"""
    pass

# Require permission (custom permission check)
@router.get("/all-organizations")
async def read_all_orgs(
    user: User = Depends(require_permission("organizations:read_all"))
):
    """Cross-organization read (super admin only)"""
    pass

# Require manager or above (manager, admin, owner)
from auth import require_manager_or_above

@router.post("/quotes/{quote_id}/approve")
async def approve_quote(
    quote_id: UUID,
    user: User = Depends(require_manager_or_above())
):
    """Approve quote (managers and admins only)"""
    pass
```

### Admin Permission Check (Manual)

```python
from auth import check_admin_permissions

@router.put("/settings/calculation")
async def update_calculation_settings(
    settings: CalculationSettingsUpdate,
    user: User = Depends(get_current_user)
):
    """Update admin-only calculation settings"""
    # Raises HTTPException 403 if not admin/owner
    await check_admin_permissions(user)

    # Proceed with admin operation
    result = supabase.table("calculation_settings")\
        .update(settings.dict(exclude_none=True))\
        .eq("organization_id", str(user.org_id))\
        .execute()

    return result.data[0]
```

### Custom Dependencies

```python
from fastapi import Depends, HTTPException, Header

async def verify_api_key(x_api_key: str = Header(...)):
    """Custom dependency for API key validation"""
    if x_api_key != os.getenv("INTERNAL_API_KEY"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    return x_api_key

@router.post("/internal/sync")
async def internal_sync(
    api_key: str = Depends(verify_api_key),
    user: User = Depends(get_current_user)
):
    """Internal endpoint with both auth and API key"""
    pass
```

### Dependency Chains

```python
from auth import get_current_user, User
from supabase import create_client, Client
import os

async def get_supabase_client() -> Client:
    """Dependency to provide Supabase client"""
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

@router.get("/customers")
async def list_customers(
    user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """List customers using injected Supabase client"""
    result = supabase.table("customers").select("*")\
        .eq("organization_id", str(user.org_id))\
        .execute()

    return {"customers": result.data}
```

---

## 4. Response Patterns

### Return Types

```python
# Return dict (auto-converts to JSON)
@router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    return {"total": 100, "active": 75}

# Return Pydantic model (type-safe response)
@router.get("/profile", response_model=UserResponse)
async def get_profile(user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(user.id),
        email=user.email,
        role=user.role.value
    )

# Return list of models
@router.get("/quotes", response_model=list[QuoteResponse])
async def list_quotes(user: User = Depends(get_current_user)):
    result = supabase.table("quotes").select("*")\
        .eq("organization_id", str(user.org_id))\
        .execute()

    return [QuoteResponse(**quote) for quote in result.data]
```

### Status Codes

```python
from fastapi import status

# 201 Created for POST endpoints
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_resource(data: ResourceCreate):
    # ...
    return created_resource

# 204 No Content for DELETE endpoints
@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(resource_id: UUID):
    # ...
    return  # Empty response with 204

# 200 OK (default for GET, PUT, PATCH)
@router.get("/{resource_id}")
async def get_resource(resource_id: UUID):
    # ...
    return resource
```

### Response Model with Exclusions

```python
class UserWithPassword(BaseModel):
    id: str
    email: str
    hashed_password: str
    role: str

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    # Excludes hashed_password

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Response automatically excludes password"""
    return user  # FastAPI strips hashed_password based on response_model
```

### Error Responses

```python
from fastapi import HTTPException, status

@router.get("/{quote_id}")
async def get_quote(
    quote_id: UUID,
    user: User = Depends(get_current_user)
):
    """Get quote with proper error handling"""
    try:
        result = supabase.table("quotes").select("*")\
            .eq("id", str(quote_id))\
            .eq("organization_id", str(user.org_id))\
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        return result.data[0]

    except HTTPException:
        raise  # Re-raise HTTP exceptions

    except Exception as e:
        # Log error for debugging
        print(f"Database error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
```

### Streaming Responses (File Downloads)

```python
from fastapi.responses import StreamingResponse
import io

@router.get("/export/csv")
async def export_csv(user: User = Depends(get_current_user)):
    """Export data as CSV file"""
    # Generate CSV content
    csv_content = "id,name,amount\n1,Product A,100\n2,Product B,200"

    # Create in-memory file
    buffer = io.StringIO(csv_content)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"}
    )
```

---

## 5. Async Patterns

### All Routes Are Async

```python
# ✅ CORRECT: Async route
@router.get("/")
async def list_items(user: User = Depends(get_current_user)):
    result = supabase.table("items").select("*").execute()
    return result.data

# ❌ WRONG: Sync route (don't do this)
@router.get("/")
def list_items(user: User = Depends(get_current_user)):
    result = supabase.table("items").select("*").execute()
    return result.data
```

### Async Database Operations (asyncpg)

```python
import asyncpg

@router.get("/stats/complex")
async def get_complex_stats(user: User = Depends(get_current_user)):
    """Use asyncpg for complex queries"""
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

    try:
        # Set RLS context
        await conn.execute(
            "SELECT set_config('request.jwt.claims', $1, true)",
            f'{{"sub": "{user.id}", "role": "authenticated"}}'
        )

        # Complex query
        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) as total_quotes,
                COUNT(*) FILTER (WHERE status = 'approved') as approved,
                SUM(total_amount) as total_revenue
            FROM quotes
            WHERE organization_id = $1
        """, user.org_id)

        return dict(stats)

    finally:
        await conn.close()
```

### Parallel Async Operations

```python
import asyncio

@router.get("/dashboard")
async def get_dashboard(user: User = Depends(get_current_user)):
    """Fetch multiple resources in parallel"""

    async def fetch_quotes():
        result = supabase.table("quotes").select("*")\
            .eq("organization_id", str(user.org_id))\
            .limit(5)\
            .execute()
        return result.data

    async def fetch_customers():
        result = supabase.table("customers").select("*")\
            .eq("organization_id", str(user.org_id))\
            .limit(5)\
            .execute()
        return result.data

    async def fetch_stats():
        result = supabase.rpc("get_quote_stats", {
            "org_id": str(user.org_id)
        }).execute()
        return result.data

    # Run in parallel (3x faster than sequential)
    quotes, customers, stats = await asyncio.gather(
        fetch_quotes(),
        fetch_customers(),
        fetch_stats()
    )

    return {
        "recent_quotes": quotes,
        "recent_customers": customers,
        "stats": stats
    }
```

---

## 6. Type Hints for IDE Support

### Full Type Annotations

```python
from typing import Optional, List, Dict, Any
from uuid import UUID
from decimal import Decimal
from datetime import datetime

@router.post("/calculate")
async def calculate_quote(
    products: List[Dict[str, Any]],
    settings: Optional[Dict[str, Decimal]] = None,
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Calculate quote with full type hints"""
    result: Dict[str, Any] = {
        "total": Decimal("0.00"),
        "items": []
    }

    for product in products:
        price: Decimal = Decimal(str(product.get("price", "0")))
        quantity: int = int(product.get("quantity", 1))
        result["total"] += price * quantity

    return result
```

### Type Aliases for Clarity

```python
from typing import TypeAlias

# Define type aliases
OrganizationID: TypeAlias = UUID
UserID: TypeAlias = UUID
QuoteID: TypeAlias = UUID

@router.get("/{quote_id}")
async def get_quote(
    quote_id: QuoteID,
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Type aliases make code more readable"""
    org_id: OrganizationID = user.org_id
    # ...
```

---

## 7. Error Handling Hooks

### Global Exception Handler

```python
# In main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueError globally"""
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions"""
    print(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

### Route-Level Error Handling

```python
from pydantic import ValidationError

@router.post("/")
async def create_resource(data: dict):
    """Handle validation errors at route level"""
    try:
        validated_data = ResourceCreate(**data)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.errors()
        )

    # Process validated data
    result = supabase.table("resources").insert(
        validated_data.dict()
    ).execute()

    return result.data[0]
```

---

## Quick Reference

**Route Pattern:**
```python
@router.method("/path", status_code=201, response_model=Model)
async def endpoint_name(
    path_param: Type,
    query_param: Type = default,
    body: Model = Body(...),
    user: User = Depends(get_current_user)
) -> ReturnType:
    """Docstring for API docs"""
    pass
```

**Always Remember:**
- ✅ All routes are `async def`
- ✅ Include `Depends(get_current_user)` for auth
- ✅ Use Pydantic models for validation
- ✅ Add `.eq("organization_id", str(user.org_id))` to queries
- ✅ Return proper HTTP status codes
- ✅ Include type hints for IDE support
- ✅ Handle errors with HTTPException
