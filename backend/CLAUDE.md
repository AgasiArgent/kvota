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
│   └── organizations.py       # Organization management
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
