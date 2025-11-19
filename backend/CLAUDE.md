# Backend - FastAPI + Supabase Patterns

**Stack:** FastAPI + Python 3.12 + Supabase PostgreSQL + Pydantic

---

## Project Structure

```
backend/
├── main.py                    # FastAPI app entry point
├── auth.py                    # Authentication & authorization
├── routes/
│   ├── customers.py           # Customer CRUD
│   ├── quotes.py              # Quote CRUD
│   ├── quotes_calc.py         # Calculation engine
│   ├── calculation_settings.py # Admin settings
│   ├── organizations.py       # Organization management
│   └── team.py                # Team member management
├── migrations/
│   └── *.sql                  # Database migrations
└── venv/                      # Virtual environment
```

---

## FastAPI Patterns

### Route Definition
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

### Pydantic Models
```python
from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional

class ProductInput(BaseModel):
    sku: Optional[str] = None
    brand: Optional[str] = None
    name: str
    base_price_vat: Decimal = Field(gt=0)
    quantity: int = Field(gt=0)
    weight_in_kg: Optional[Decimal] = Field(default=None, ge=0)

    # Overrides (optional)
    currency_of_base_price: Optional[str] = None
    supplier_country: Optional[str] = None
```

### Response Models
```python
class QuoteResponse(BaseModel):
    id: str
    quote_number: str
    customer_name: str
    total_amount: Decimal
    status: str
    created_at: str

    class Config:
        from_attributes = True  # Allows SQLAlchemy models
```

---

## Authentication & Authorization

### Get Current User
```python
from auth import get_current_user, User

async def my_endpoint(user: User = Depends(get_current_user)):
    user.id          # User ID
    user.email       # Email
    user.role        # Role (member, manager, admin, owner)
    user.org_id      # Organization ID
```

### Role-Based Access
```python
from auth import require_role, require_permission, UserRole

# Require specific role
@router.post("/admin")
async def admin_only(user: User = Depends(require_role(UserRole.ADMIN))):
    pass

# Require permission
@router.get("/")
async def read_all(user: User = Depends(require_permission("quotes:read_all"))):
    pass

# Require manager or above
from auth import require_manager_or_above

@router.post("/approve")
async def approve(user: User = Depends(require_manager_or_above())):
    pass
```

### Admin Permission Check
```python
from auth import check_admin_permissions

async def update_settings(user: User = Depends(get_current_user)):
    # Raises HTTPException if not admin/owner
    await check_admin_permissions(user)
    # Proceed with admin operation
```

---

## Supabase Client Patterns

### Basic Query
```python
from supabase import create_client
import os

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Select
result = supabase.table("quotes").select("*").eq("id", quote_id).execute()
quotes = result.data

# Insert
result = supabase.table("quotes").insert({
    "customer_id": customer_id,
    "total_amount": 1000.00
}).execute()
new_quote = result.data[0]

# Update
result = supabase.table("quotes").update({
    "status": "approved"
}).eq("id", quote_id).execute()

# Delete
result = supabase.table("quotes").delete().eq("id", quote_id).execute()
```

### RLS Context (Row-Level Security)
```python
import asyncpg

# Connect with RLS context
conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

# Set user context for RLS
await conn.execute(
    "SELECT set_config('request.jwt.claims', $1, true)",
    f'{{"sub": "{user.id}", "role": "authenticated"}}'
)

# Queries will now respect RLS policies
customers = await conn.fetch("SELECT * FROM customers")
await conn.close()
```

### Filtering & Ordering
```python
# Filter
result = supabase.table("quotes") \
    .select("*") \
    .eq("status", "draft") \
    .gte("total_amount", 1000) \
    .execute()

# Order
result = supabase.table("quotes") \
    .select("*") \
    .order("created_at", desc=True) \
    .limit(10) \
    .execute()

# Join (use foreign key names)
result = supabase.table("quotes") \
    .select("*, customer:customers(name, email)") \
    .execute()
```

### ⚠️ asyncpg vs Supabase Client - When to Use Each

**IMPORTANT:** Prefer Supabase client for reliability. Only use asyncpg when absolutely necessary.

#### ✅ Use Supabase Client For:
- **Simple CRUD operations** (create, read, update, delete)
- **Single-table queries** with filtering and sorting
- **Pagination** with `.range(start, end)`
- **Count queries** with `count="exact"`
- **Most endpoint implementations**

**Why:** Supabase client uses REST API which is more reliable than direct database connections. Network errors are much less common.

**Pattern:**
```python
@router.get("/{customer_id}")
async def get_customer(
    customer_id: UUID,
    user: User = Depends(get_current_user)
):
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    result = supabase.table("customers").select("*")\
        .eq("id", str(customer_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Customer not found")

    return Customer(**result.data[0])
```

#### ⚙️ Use asyncpg ONLY For:
- **Complex aggregations** (COUNT, SUM, AVG with FILTER clause)
- **Multi-step transactions** requiring `async with conn.transaction()`
- **JOIN queries with auth.users** (not exposed via REST API)
- **Advanced PostgreSQL features** (CTEs, window functions, custom SQL)
- **Database migrations and schema changes**

**Why:** These operations aren't well-supported by Supabase REST API.

**Pattern:**
```python
@router.get("/stats/overview")
async def get_customer_stats(user: User = Depends(get_current_user)):
    # Complex aggregation with FILTER - requires asyncpg
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)

        stats = await conn.fetchrow("""
            SELECT
                COUNT(*) as total_customers,
                COUNT(*) FILTER (WHERE status = 'active') as active_customers,
                AVG(credit_limit) as avg_credit_limit
            FROM customers
        """)

        return {"overview": dict(stats)}
    finally:
        await conn.close()
```

#### 🚨 Common Mistakes to Avoid:

1. **❌ WRONG:** Using asyncpg for simple CRUD
   ```python
   # DON'T DO THIS - prone to network errors
   conn = await get_db_connection()
   row = await conn.fetchrow("SELECT * FROM customers WHERE id = $1", customer_id)
   ```

   **✅ CORRECT:** Use Supabase client
   ```python
   result = supabase.table("customers").select("*").eq("id", str(customer_id)).execute()
   ```

2. **❌ WRONG:** Forgetting organization_id filter in Supabase queries
   ```python
   # SECURITY BUG - bypasses RLS, returns data from all organizations
   result = supabase.table("customers").select("*").eq("id", customer_id).execute()
   ```

   **✅ CORRECT:** Always filter by organization_id
   ```python
   result = supabase.table("customers").select("*")\
       .eq("id", str(customer_id))\
       .eq("organization_id", str(user.current_organization_id))\
       .execute()
   ```

#### 📋 Conversion Checklist:

When converting asyncpg to Supabase client:
- [ ] Replace `conn = await get_db_connection()` with `supabase = create_client(...)`
- [ ] Replace `await conn.fetchrow(...)` with `supabase.table(...).select(...).execute()`
- [ ] Add `.eq("organization_id", str(user.current_organization_id))` to ALL queries
- [ ] Convert UUID to string with `str(uuid_value)`
- [ ] Check `result.data` and `len(result.data)` instead of checking if `row` is None
- [ ] Access data with `result.data[0]` instead of `dict(row)`
- [ ] Remove `try/finally` with `conn.close()` (Supabase client doesn't need it)
- [ ] For count queries, use `.select("*", count="exact")` and check `result.count`

---

## Database Migrations

### Creating Migrations
```sql
-- backend/migrations/009_add_sku_brand.sql

-- Add columns to quote_items table
ALTER TABLE quote_items
ADD COLUMN sku TEXT,
ADD COLUMN brand TEXT;

-- Add index for searching
CREATE INDEX idx_quote_items_sku ON quote_items(sku);

-- Update RLS policy if needed
DROP POLICY IF EXISTS "Users can access quote items" ON quote_items;
CREATE POLICY "Users can access quote items" ON quote_items
FOR ALL USING (
  quote_id IN (
    SELECT id FROM quotes WHERE organization_id = current_organization_id()
  )
);
```

### Running Migrations
Execute via Supabase SQL Editor or:
```python
import asyncpg

conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
with open('migrations/009_add_sku_brand.sql', 'r') as f:
    migration_sql = f.read()
await conn.execute(migration_sql)
await conn.close()
```

---

## Calculation Engine Patterns

### Variable Derivation
```python
SELLER_REGION_MAP = {
    "МАСТЕР БЭРИНГ ООО": "RU",
    "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ": "TR",
    "UPDOOR Limited": "CN"
}

def get_seller_region(seller_company: str) -> str:
    """Derive seller_region from seller_company"""
    region = SELLER_REGION_MAP.get(seller_company)
    if region is None:
        raise ValueError(f"Unknown seller company: {seller_company}")
    return region
```

### Two-Stage Financing
```python
from decimal import Decimal
import numpy_financial as npf

def calculate_future_value_loan(
    principal: Decimal,
    daily_interest_rate: Decimal,
    days: int
) -> Decimal:
    """Calculate FV with daily compound interest"""
    if days <= 0 or principal <= 0:
        return principal

    rate = float(daily_interest_rate)
    pv = float(principal)
    fv = npf.fv(rate, days, 0, -pv)

    return Decimal(str(round(fv, 2)))

def calculate_supplier_financing(
    supplier_payment: Decimal,
    client_advance: Decimal,
    time_to_advance: int,
    delivery_time: int,
    time_to_payment: int,
    daily_rate: Decimal
) -> dict:
    """Two-stage supplier payment financing"""
    # Stage 1: Full amount until advance
    stage1_fv = calculate_future_value_loan(
        supplier_payment, daily_rate, time_to_advance
    )

    # Stage 2: Reduced amount after advance
    stage2_principal = stage1_fv - client_advance
    stage2_days = delivery_time + time_to_payment - time_to_advance
    stage2_fv = calculate_future_value_loan(
        stage2_principal, daily_rate, stage2_days
    )

    total_interest = (stage1_fv - supplier_payment) + (stage2_fv - stage2_principal)

    return {
        "total_interest": total_interest,
        "stage1_interest": stage1_fv - supplier_payment,
        "stage2_interest": stage2_fv - stage2_principal
    }
```

---

## Error Handling

### Standard Pattern
```python
from fastapi import HTTPException, status

@router.get("/{id}")
async def get_quote(id: str, user: User = Depends(get_current_user)):
    try:
        result = supabase.table("quotes") \
            .select("*") \
            .eq("id", id) \
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
```

### Validation Errors
```python
from pydantic import ValidationError

try:
    product = ProductInput(**data)
except ValidationError as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=e.errors()
    )
```

---

## Testing Patterns

### Test User Creation
```python
# For development only
from auth import create_test_user

user_id = await create_test_user()
```

### API Testing
```python
import requests

# Get test token
response = requests.post("http://localhost:8000/api/auth/login", json={
    "email": "test@example.com",
    "password": "password123"
})
token = response.json()["access_token"]

# Use token in requests
headers = {"Authorization": f"Bearer {token}"}
response = requests.get("http://localhost:8000/api/quotes", headers=headers)
```

---

## Environment Variables

Required in `.env`:
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
```

---

## Exchange Rate Service

### Overview
Exchange rates are fetched daily from Central Bank of Russia (CBR) API and cached in the database.

### Service Pattern
```python
from services.exchange_rate_service import get_exchange_rate_service

# Get service singleton
service = get_exchange_rate_service()

# Get exchange rate (auto-fetches if stale)
rate = await service.get_rate("USD", "RUB")

# Manual refresh (admin only)
rates = await service.fetch_cbr_rates()
```

### Automatic Updates
- **Daily Update:** 10:00 AM Moscow Time
- **Weekly Cleanup:** Sundays (keeps 30 days of history)
- **Cache Duration:** 24 hours

### Database Schema
```sql
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY,
    from_currency TEXT NOT NULL,  -- e.g., "USD"
    to_currency TEXT NOT NULL,    -- e.g., "RUB"
    rate DECIMAL NOT NULL,        -- e.g., 81.13
    fetched_at TIMESTAMPTZ,       -- When fetched from CBR
    source TEXT DEFAULT 'cbr',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on currency pair and fetch time
CREATE UNIQUE INDEX idx_exchange_rates_unique
ON exchange_rates(from_currency, to_currency, fetched_at);
```

### API Endpoints
```python
# Get exchange rate
GET /api/exchange-rates/{from_currency}/{to_currency}
# Example: GET /api/exchange-rates/USD/RUB
# Returns: {"rate": 81.13, "fetched_at": "2025-11-15T10:00:00Z", ...}

# Manual refresh (admin only)
POST /api/exchange-rates/refresh
# Returns: {"success": true, "rates_updated": 56, ...}
```

### Important Notes
- **Always use Supabase client** - More reliable than asyncpg for network operations
- **Use upsert() not insert()** - Handles duplicate entries gracefully
- **56 currencies supported** - All CBR API currencies
- **Automatic fallback** - If cache miss, fetches fresh data

---

## Development Commands

```bash
cd /home/novi/quotation-app/backend

# Activate virtual environment
source venv/bin/activate

# Start server (already running on :8000)
python -m uvicorn main:app --reload

# Install package
pip install <package>

# Run tests
python -m pytest

# Check dependencies
pip list
```

---

## Common Gotchas

1. **Use SERVICE_ROLE_KEY for backend** - ANON_KEY is for frontend only
2. **Set RLS context for asyncpg** - Must set JWT claims for RLS to work
3. **Decimal for money** - Always use `Decimal`, never `float`
4. **Validation in Pydantic** - Use `Field(gt=0)` not manual checks
5. **Return Pydantic models** - FastAPI auto-serializes to JSON
6. **Admin permissions** - Always validate role, don't trust frontend

---

## Database Schema Conventions

- Table names: `snake_case` plural (e.g., `quotes`, `quote_items`)
- Column names: `snake_case` (e.g., `customer_id`, `created_at`)
- Primary keys: `id` (UUID)
- Foreign keys: `<table>_id` (e.g., `customer_id`)
- Timestamps: `created_at`, `updated_at` (with triggers)
- RLS: All tables have RLS policies based on organization

---

## Admin-Only Operations

```python
from auth import check_admin_permissions

@router.put("/settings/calculation")
async def update_calculation_settings(
    settings: CalculationSettingsUpdate,
    user: User = Depends(get_current_user)
):
    # Validate admin/owner
    await check_admin_permissions(user)

    # Update settings
    result = supabase.table("calculation_settings") \
        .update(settings.dict(exclude_unset=True)) \
        .eq("organization_id", user.org_id) \
        .execute()

    return result.data[0]
```

---

## File Upload Handling

```python
from fastapi import UploadFile, File
import pandas as pd

@router.post("/upload")
async def upload_products_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    # Read file
    contents = await file.read()

    # Parse Excel
    if file.filename.endswith('.xlsx'):
        df = pd.read_excel(io.BytesIO(contents))
    elif file.filename.endswith('.csv'):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        raise HTTPException(400, "Invalid file type")

    # Convert to product list
    products = []
    for _, row in df.iterrows():
        products.append({
            "name": row.get("product_name"),
            "sku": row.get("sku"),
            "quantity": row.get("quantity", 1),
            # ...
        })

    return {"products": products, "count": len(products)}
```

---

## Team Management API

**Location:** `backend/routes/team.py`

**Base URL:** `/api/organizations/{organization_id}/members`

### Endpoints

#### 1. List Team Members

**GET `/api/organizations/{organization_id}/members`**

List all team members in the organization.

**Auth:** Any authenticated user in the organization

**Response:**
```python
[
    {
        "id": "uuid",
        "user_id": "uuid",
        "user_email": "user@example.com",
        "user_full_name": "John Doe",
        "role_id": "uuid",
        "role_name": "Admin",
        "role_slug": "admin",
        "is_owner": false,
        "status": "active",
        "joined_at": "2024-01-01T00:00:00Z"
    }
]
```

**Features:**
- Ordered by role hierarchy (owner → admin → manager → member)
- Then sorted by name
- Only shows active and invited members
- RLS ensures organization isolation

#### 2. Invite Team Member

**POST `/api/organizations/{organization_id}/members`**

Invite new member by email.

**Auth:** Manager/Admin/Owner only (`require_org_admin()`)

**Request Body:**
```python
{
    "email": "newuser@example.com",
    "role_id": "uuid"  # UUID of role to assign
}
```

**Response:**
```python
{
    "message": "Member added successfully",
    "member_id": "uuid",
    "user_email": "newuser@example.com",
    "role": "Member"
}
```

**Validation:**
- User must exist in Supabase Auth
- User cannot already be a member
- Role must be valid

**Error Codes:**
- `404` - User not found
- `409` - User already a member
- `400` - Invalid role ID

#### 3. Update Member Role

**PUT `/api/organizations/{organization_id}/members/{member_id}/role`**

Change a member's role.

**Auth:** Admin/Owner only (`require_org_admin()`)

**Request Body:**
```python
{
    "role_id": "uuid"  # New role UUID
}
```

**Response:**
```python
{
    "id": "uuid",
    "user_id": "uuid",
    "role_id": "uuid",
    "status": "active",
    ...
}
```

**Validation:**
- Cannot change owner's role
- Cannot change your own role
- Cannot promote to owner (ownership transfer not supported)

**Error Codes:**
- `400` - Attempting to change owner role or own role
- `404` - Member not found

#### 4. Remove Team Member

**DELETE `/api/organizations/{organization_id}/members/{member_id}`**

Remove member from organization (soft delete).

**Auth:** Admin/Owner only (`require_org_admin()`)

**Response:** `204 No Content`

**Validation:**
- Cannot remove owner
- Cannot remove yourself
- Soft delete (sets status to 'left')

**Error Codes:**
- `400` - Attempting to remove owner or yourself
- `404` - Member not found

### Usage Example

```python
from routes.team import router as team_router
from auth import get_organization_context, require_org_admin

# List members (any org member)
@router.get("/{organization_id}/members")
async def list_members(
    organization_id: str,
    context: OrganizationContext = Depends(get_organization_context)
):
    # Implementation

# Invite member (admin only)
@router.post("/{organization_id}/members")
async def invite_member(
    organization_id: str,
    email: str,
    role_id: UUID,
    context: OrganizationContext = Depends(require_org_admin())
):
    # Implementation
```

### Security Notes

1. **Organization Isolation:** All endpoints filter by `organization_id`
2. **Role-Based Access:** Invite/update/delete require admin privileges
3. **Owner Protection:** Owner cannot be removed or have role changed
4. **Self-Protection:** Users cannot remove themselves or change their own role
5. **Supabase Auth Integration:** User lookup via Supabase Admin API

### Database Schema

**Table:** `organization_members`

```sql
CREATE TABLE organization_members (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    status TEXT NOT NULL DEFAULT 'active',  -- active, invited, suspended, left
    is_owner BOOLEAN NOT NULL DEFAULT false,
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_status ON organization_members(status);
```

### RLS Policies

```sql
-- Members can see other members in their organization
CREATE POLICY "Members can view org members" ON organization_members
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Admins can add members
CREATE POLICY "Admins can add members" ON organization_members
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM organization_members om
        JOIN roles r ON om.role_id = r.id
        WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND (om.is_owner = true OR r.slug IN ('admin'))
    )
);
```
