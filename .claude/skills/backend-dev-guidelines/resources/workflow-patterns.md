# Backend Workflow Patterns

Complete workflows for common backend development tasks in the B2B quotation platform.

**Last Updated:** 2025-10-30 (Expert agent)

---

## 1. Making API Changes Workflow

When modifying existing API endpoints, follow this systematic approach:

### Step-by-Step Process

```python
# 1. Understand the current implementation
# backend/routes/your_route.py
# Read the existing endpoint first
```

```python
# 2. Update Pydantic models if needed
# backend/models/your_model.py
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

class UpdatedRequest(BaseModel):
    """Request model with new fields"""
    existing_field: str
    new_field: Optional[str] = Field(None, description="New optional field")
    amount: Decimal = Field(..., ge=0, description="Amount must be positive")

class UpdatedResponse(BaseModel):
    """Response model with changes"""
    id: int
    status: str
    new_data: dict  # New field
    # removed_field: str  # Comment out first, then remove after frontend updates
```

```python
# 3. Update the route handler
# backend/routes/your_route.py
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from ..auth import get_current_user, get_supabase_client
from ..models import UpdatedRequest, UpdatedResponse

router = APIRouter()

@router.post("/endpoint", response_model=UpdatedResponse)
async def update_endpoint(
    request: UpdatedRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Updated endpoint with new functionality.

    Changes:
    - Added new_field processing
    - Enhanced validation
    - Improved error handling
    """
    try:
        # Verify permissions (RLS will also check)
        if not current_user:
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Process the new field
        processed_data = {
            "existing_field": request.existing_field,
            "new_field": request.new_field or "default_value",
            "amount": str(request.amount),
            "organization_id": current_user["organization_id"],
            "updated_by": current_user["id"],
            "updated_at": "now()"
        }

        # Database operation
        result = supabase.table("your_table") \
            .update(processed_data) \
            .eq("id", request.id) \
            .eq("organization_id", current_user["organization_id"]) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Record not found")

        # Return updated response
        return UpdatedResponse(
            id=result.data[0]["id"],
            status="success",
            new_data={"processed": True}
        )

    except Exception as e:
        logger.error(f"Update failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

```python
# 4. Update or create tests
# backend/tests/test_your_route.py
import pytest
from httpx import AsyncClient
from unittest.mock import Mock, patch

@pytest.mark.asyncio
async def test_updated_endpoint_with_new_field(client: AsyncClient, mock_user):
    """Test endpoint with new field"""

    # Prepare test data
    request_data = {
        "existing_field": "test",
        "new_field": "new_value",
        "amount": "100.50"
    }

    # Mock Supabase response
    with patch('routes.your_route.get_supabase_client') as mock_supabase:
        mock_client = Mock()
        mock_client.table().update().eq().eq().execute.return_value = Mock(
            data=[{"id": 1, "status": "success"}]
        )
        mock_supabase.return_value = mock_client

        # Make request
        response = await client.post(
            "/endpoint",
            json=request_data,
            headers={"Authorization": "Bearer test_token"}
        )

        # Assertions
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert "new_data" in response.json()

@pytest.mark.asyncio
async def test_updated_endpoint_validation(client: AsyncClient):
    """Test validation for negative amount"""

    request_data = {
        "existing_field": "test",
        "amount": "-100"  # Invalid: negative amount
    }

    response = await client.post("/endpoint", json=request_data)

    assert response.status_code == 422
    assert "validation error" in response.json()["detail"][0]["msg"].lower()
```

```bash
# 5. Test the changes
# Terminal 1: Run backend
cd backend && uvicorn main:app --reload

# Terminal 2: Run tests
cd backend && pytest tests/test_your_route.py -v

# Terminal 3: Test with curl
curl -X POST http://localhost:8000/endpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"existing_field": "test", "new_field": "value", "amount": "100"}'
```

### API Change Checklist

- [ ] Pydantic models updated with validation
- [ ] Route handler implements new logic
- [ ] RLS policies verified for security
- [ ] Error handling comprehensive
- [ ] Tests cover new functionality
- [ ] Documentation/comments updated
- [ ] Frontend notified of breaking changes
- [ ] Migration script if database changes

---

## 2. Database Migration Workflow

### Complete Migration Process

```sql
-- 1. Create migration file
-- backend/migrations/YYYY_MM_DD_description.sql

-- Add migration metadata
-- Migration: Add new_column to quotes table
-- Author: Your Name
-- Date: 2025-10-30
-- Ticket: JIRA-123

-- Start transaction for safety
BEGIN;

-- 2. Schema changes
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS new_field TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quotes_new_field
ON quotes(new_field)
WHERE new_field IS NOT NULL;

-- 3. Update RLS policies
-- Drop old policy if exists
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;

-- Create updated policy
CREATE POLICY "quotes_select_policy" ON quotes
    FOR SELECT
    USING (
        organization_id = auth.jwt() ->> 'organization_id'::text
        AND deleted_at IS NULL
    );

-- 4. Backfill data if needed
UPDATE quotes
SET new_field = 'default_value'
WHERE new_field IS NULL
  AND created_at < '2025-10-30';

-- 5. Add constraints after backfill
ALTER TABLE quotes
ADD CONSTRAINT check_new_field_valid
CHECK (new_field IN ('value1', 'value2', 'value3'));

-- Commit transaction
COMMIT;
```

```python
# 2. Test migration locally
# backend/scripts/test_migration.py
import asyncio
from supabase import create_client
import os

async def test_migration():
    """Test migration on local database"""

    # Connect to local Supabase
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    try:
        # Read migration file
        with open('migrations/2025_10_30_add_new_field.sql', 'r') as f:
            migration_sql = f.read()

        # Execute migration
        result = supabase.rpc('exec_sql', {'sql': migration_sql}).execute()
        print("Migration successful:", result)

        # Verify changes
        test_result = supabase.table('quotes').select('new_field').limit(1).execute()
        assert 'new_field' in test_result.data[0] if test_result.data else True
        print("Verification passed")

    except Exception as e:
        print(f"Migration failed: {e}")
        # Rollback handled by transaction
        raise

if __name__ == "__main__":
    asyncio.run(test_migration())
```

```bash
# 3. Apply migration
# Via Supabase Dashboard SQL Editor
# Or via migration script
python backend/scripts/run_migration.py migrations/2025_10_30_add_new_field.sql

# 4. Verify migration
psql $DATABASE_URL -c "\d quotes"  # Check schema
psql $DATABASE_URL -c "SELECT * FROM quotes LIMIT 1;"  # Check data
```

### Migration Best Practices

```sql
-- Always use IF EXISTS/IF NOT EXISTS
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS new_col TEXT;
DROP INDEX IF EXISTS old_index;
CREATE INDEX IF NOT EXISTS new_index ON table(column);

-- Make migrations idempotent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='quotes' AND column_name='new_col') THEN
        ALTER TABLE quotes ADD COLUMN new_col TEXT;
    END IF;
END $$;

-- Use transactions for multi-step migrations
BEGIN;
-- multiple changes
COMMIT;

-- Add comments for context
COMMENT ON COLUMN quotes.new_field IS 'Stores the new feature data';

-- Consider performance impact
-- For large tables, use CONCURRENTLY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_name ON table(column);
```

---

## 3. Adding New Endpoint Workflow

### Complete Endpoint Creation

```python
# 1. Create route file
# backend/routes/new_feature.py
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from ..auth import get_current_user, get_supabase_client, check_permission
from ..models.new_feature import (
    NewFeatureCreate,
    NewFeatureUpdate,
    NewFeatureResponse,
    NewFeatureListResponse
)
from supabase import Client
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/new-feature", tags=["new-feature"])

@router.post("/", response_model=NewFeatureResponse)
async def create_new_feature(
    data: NewFeatureCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Create a new feature record.

    Required permissions: authenticated user
    """
    try:
        # Validate business rules
        if data.amount < 0:
            raise HTTPException(
                status_code=422,
                detail="Amount cannot be negative"
            )

        # Prepare data for database
        db_data = {
            **data.dict(exclude_unset=True),
            "organization_id": current_user["organization_id"],
            "created_by": current_user["id"],
            "created_at": datetime.utcnow().isoformat()
        }

        # Insert with RLS
        result = supabase.table("new_feature") \
            .insert(db_data) \
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create record"
            )

        # Log activity
        await log_activity(
            supabase,
            current_user["id"],
            "new_feature.create",
            {"id": result.data[0]["id"]}
        )

        return NewFeatureResponse(**result.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=NewFeatureListResponse)
async def list_new_features(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    List features with pagination and filters.
    """
    try:
        # Build query
        query = supabase.table("new_feature") \
            .select("*", count="exact") \
            .eq("organization_id", current_user["organization_id"]) \
            .is_("deleted_at", "null")

        # Apply filters
        if search:
            query = query.ilike("name", f"%{search}%")
        if status:
            query = query.eq("status", status)

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1) \
            .order("created_at", desc=True)

        result = query.execute()

        return NewFeatureListResponse(
            data=[NewFeatureResponse(**item) for item in result.data],
            total=result.count,
            page=page,
            page_size=page_size
        )

    except Exception as e:
        logger.error(f"List failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{feature_id}", response_model=NewFeatureResponse)
async def get_new_feature(
    feature_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get single feature by ID."""
    result = supabase.table("new_feature") \
        .select("*") \
        .eq("id", feature_id) \
        .eq("organization_id", current_user["organization_id"]) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Feature not found")

    return NewFeatureResponse(**result.data)

@router.put("/{feature_id}", response_model=NewFeatureResponse)
async def update_new_feature(
    feature_id: int,
    data: NewFeatureUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Update existing feature."""

    # Check permissions if needed
    # await check_permission(current_user, "new_feature.update")

    update_data = {
        **data.dict(exclude_unset=True),
        "updated_by": current_user["id"],
        "updated_at": datetime.utcnow().isoformat()
    }

    result = supabase.table("new_feature") \
        .update(update_data) \
        .eq("id", feature_id) \
        .eq("organization_id", current_user["organization_id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Feature not found")

    return NewFeatureResponse(**result.data[0])

@router.delete("/{feature_id}")
async def delete_new_feature(
    feature_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Soft delete a feature."""

    # Check admin permissions
    if current_user["role"] not in ["admin", "owner"]:
        raise HTTPException(
            status_code=403,
            detail="Admin permission required"
        )

    result = supabase.table("new_feature") \
        .update({"deleted_at": datetime.utcnow().isoformat()}) \
        .eq("id", feature_id) \
        .eq("organization_id", current_user["organization_id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Feature not found")

    return {"message": "Feature deleted successfully"}
```

```python
# 2. Register route in main.py
# backend/main.py
from routes import new_feature

app.include_router(new_feature.router)
```

```python
# 3. Create comprehensive tests
# backend/tests/test_new_feature.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestNewFeatureEndpoints:

    async def test_create_feature(self, client: AsyncClient, auth_headers):
        """Test feature creation"""
        data = {
            "name": "Test Feature",
            "amount": 100.50,
            "description": "Test description"
        }

        response = await client.post(
            "/api/new-feature/",
            json=data,
            headers=auth_headers
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Test Feature"

    async def test_list_features_with_pagination(self, client, auth_headers):
        """Test pagination"""
        response = await client.get(
            "/api/new-feature/?page=1&page_size=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        assert "data" in response.json()
        assert "total" in response.json()
        assert response.json()["page"] == 1

    async def test_unauthorized_access(self, client):
        """Test without auth"""
        response = await client.get("/api/new-feature/")
        assert response.status_code == 401
```

---

## 4. Export Feature Workflow

### Complete Export Implementation

```python
# backend/routes/exports.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from typing import Optional
import pandas as pd
from datetime import datetime
import os
import tempfile
from ..auth import get_current_user, get_supabase_client
from ..utils.excel_generator import generate_excel
from ..utils.pdf_generator import generate_pdf

router = APIRouter(prefix="/api/exports", tags=["exports"])

@router.get("/quotes/{format}")
async def export_quotes(
    format: str,  # excel, csv, pdf
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Export quotes in specified format.

    Formats: excel, csv, pdf
    """
    try:
        # Validate format
        if format not in ['excel', 'csv', 'pdf']:
            raise HTTPException(
                status_code=400,
                detail="Invalid format. Use: excel, csv, or pdf"
            )

        # Build query
        query = supabase.table("quotes") \
            .select("*") \
            .eq("organization_id", current_user["organization_id"])

        # Apply filters
        if start_date:
            query = query.gte("created_at", start_date.isoformat())
        if end_date:
            query = query.lte("created_at", end_date.isoformat())
        if status:
            query = query.eq("status", status)

        # Fetch data
        result = query.execute()

        if not result.data:
            raise HTTPException(
                status_code=404,
                detail="No data found for export"
            )

        # Convert to DataFrame
        df = pd.DataFrame(result.data)

        # Process data
        df['created_at'] = pd.to_datetime(df['created_at'])
        df = df.sort_values('created_at', ascending=False)

        # Generate file based on format
        temp_dir = tempfile.gettempdir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if format == 'excel':
            file_path = os.path.join(temp_dir, f"quotes_{timestamp}.xlsx")

            with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Quotes', index=False)

                # Add formatting
                worksheet = writer.sheets['Quotes']
                for column in df.columns:
                    column_width = max(
                        df[column].astype(str).map(len).max(),
                        len(column)
                    ) + 2
                    col_idx = df.columns.get_loc(column)
                    worksheet.column_dimensions[
                        worksheet.cell(1, col_idx + 1).column_letter
                    ].width = column_width

            media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

        elif format == 'csv':
            file_path = os.path.join(temp_dir, f"quotes_{timestamp}.csv")
            df.to_csv(file_path, index=False)
            media_type = 'text/csv'

        elif format == 'pdf':
            file_path = os.path.join(temp_dir, f"quotes_{timestamp}.pdf")

            # Generate PDF with custom template
            html_content = generate_quote_html(df, current_user)
            generate_pdf(html_content, file_path)
            media_type = 'application/pdf'

        # Log export activity
        await log_activity(
            supabase,
            current_user["id"],
            "export.quotes",
            {
                "format": format,
                "count": len(df),
                "filters": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                    "status": status
                }
            }
        )

        # Return file
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=os.path.basename(file_path),
            headers={
                "Content-Disposition": f"attachment; filename={os.path.basename(file_path)}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup temp file after response (FastAPI handles this)
        pass

def generate_quote_html(df: pd.DataFrame, user: dict) -> str:
    """Generate HTML for PDF export"""

    # Get organization info
    org_name = user.get("organization_name", "Company")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            h1 {{ color: #333; }}
            table {{
                border-collapse: collapse;
                width: 100%;
                margin-top: 20px;
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }}
            th {{
                background-color: #4CAF50;
                color: white;
            }}
            .header {{
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
            }}
            .total-row {{
                font-weight: bold;
                background-color: #f2f2f2;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Quote Export - {org_name}</h1>
            <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Quote #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    """

    for _, row in df.iterrows():
        html += f"""
            <tr>
                <td>{row['quote_number']}</td>
                <td>{row['customer_name']}</td>
                <td>{row['created_at'].strftime('%Y-%m-%d')}</td>
                <td>${row['total_amount']:,.2f}</td>
                <td>{row['status']}</td>
            </tr>
        """

    # Add totals
    total = df['total_amount'].sum()
    html += f"""
            <tr class="total-row">
                <td colspan="3">Total</td>
                <td>${total:,.2f}</td>
                <td></td>
            </tr>
        """

    html += """
            </tbody>
        </table>
    </body>
    </html>
    """

    return html

# Cleanup task for old export files
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=2, minute=0)  # Run at 2 AM daily
async def cleanup_old_exports():
    """Remove export files older than 24 hours"""
    temp_dir = tempfile.gettempdir()
    now = datetime.now()

    for filename in os.listdir(temp_dir):
        if filename.startswith(('quotes_', 'export_')):
            file_path = os.path.join(temp_dir, filename)
            file_age = now - datetime.fromtimestamp(os.path.getmtime(file_path))

            if file_age.days >= 1:
                try:
                    os.remove(file_path)
                    logger.info(f"Removed old export: {filename}")
                except Exception as e:
                    logger.error(f"Failed to remove {filename}: {e}")

# Start scheduler when app starts
scheduler.start()
```

### Export Testing

```python
# backend/tests/test_exports.py
import pytest
import os
import pandas as pd
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_excel_export(client: AsyncClient, auth_headers):
    """Test Excel export generation"""

    response = await client.get(
        "/api/exports/quotes/excel",
        headers=auth_headers
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == \
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    # Save and verify file
    with open("/tmp/test_export.xlsx", "wb") as f:
        f.write(response.content)

    # Read back and verify
    df = pd.read_excel("/tmp/test_export.xlsx")
    assert not df.empty
    assert "quote_number" in df.columns

    # Cleanup
    os.remove("/tmp/test_export.xlsx")

@pytest.mark.asyncio
async def test_csv_export_with_filters(client, auth_headers):
    """Test CSV export with date filters"""

    response = await client.get(
        "/api/exports/quotes/csv?status=approved&start_date=2025-01-01",
        headers=auth_headers
    )

    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
```

---

## 5. Testing Workflow

### Unit Testing Pattern

```python
# backend/tests/test_calculation_logic.py
import pytest
from decimal import Decimal
from routes.quotes_calc import calculate_total, validate_input

class TestCalculationLogic:
    """Unit tests for calculation functions"""

    def test_calculate_total_basic(self):
        """Test basic total calculation"""
        result = calculate_total(
            base_price=Decimal("100"),
            quantity=10,
            discount=Decimal("0.1")
        )
        assert result == Decimal("900")  # 100 * 10 * (1 - 0.1)

    def test_calculate_total_edge_cases(self):
        """Test edge cases"""
        # Zero quantity
        assert calculate_total(Decimal("100"), 0, Decimal("0")) == Decimal("0")

        # 100% discount
        assert calculate_total(Decimal("100"), 1, Decimal("1")) == Decimal("0")

        # Negative values should raise error
        with pytest.raises(ValueError):
            calculate_total(Decimal("-100"), 1, Decimal("0"))

    @pytest.mark.parametrize("base,qty,discount,expected", [
        (Decimal("100"), 1, Decimal("0"), Decimal("100")),
        (Decimal("99.99"), 2, Decimal("0.5"), Decimal("99.99")),
        (Decimal("1"), 1000, Decimal("0.99"), Decimal("10")),
    ])
    def test_calculate_total_parametrized(self, base, qty, discount, expected):
        """Parametrized tests for various inputs"""
        assert calculate_total(base, qty, discount) == expected
```

### Integration Testing Pattern

```python
# backend/tests/test_api_integration.py
import pytest
from httpx import AsyncClient
from unittest.mock import patch, Mock

@pytest.mark.asyncio
class TestQuoteAPIIntegration:
    """Integration tests for quote API"""

    async def test_quote_creation_flow(self, client: AsyncClient, auth_headers):
        """Test complete quote creation flow"""

        # Step 1: Create quote
        quote_data = {
            "customer_id": 1,
            "products": [
                {"sku": "ABC123", "quantity": 10, "price": 100}
            ]
        }

        create_response = await client.post(
            "/api/quotes/",
            json=quote_data,
            headers=auth_headers
        )
        assert create_response.status_code == 200
        quote_id = create_response.json()["id"]

        # Step 2: Calculate totals
        calc_response = await client.post(
            f"/api/quotes/{quote_id}/calculate",
            headers=auth_headers
        )
        assert calc_response.status_code == 200
        assert "total" in calc_response.json()

        # Step 3: Submit for approval
        submit_response = await client.post(
            f"/api/quotes/{quote_id}/submit",
            headers=auth_headers
        )
        assert submit_response.status_code == 200
        assert submit_response.json()["status"] == "pending_approval"

        # Step 4: Verify quote state
        get_response = await client.get(
            f"/api/quotes/{quote_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "pending_approval"
```

### RLS Testing Pattern

```python
# backend/tests/test_rls_policies.py
import pytest
from supabase import create_client

@pytest.mark.asyncio
class TestRLSPolicies:
    """Test Row Level Security policies"""

    async def test_organization_isolation(self, supabase_client):
        """Test that users can only see their org's data"""

        # Create test data for two orgs
        org1_data = {"name": "Test 1", "organization_id": "org1"}
        org2_data = {"name": "Test 2", "organization_id": "org2"}

        # Insert as service role (bypasses RLS)
        supabase_admin = create_client(
            url=SUPABASE_URL,
            key=SERVICE_ROLE_KEY
        )

        supabase_admin.table("quotes").insert([org1_data, org2_data]).execute()

        # Query as org1 user
        org1_client = create_client(url=SUPABASE_URL, key=org1_user_token)
        result1 = org1_client.table("quotes").select("*").execute()

        # Should only see org1 data
        assert len(result1.data) == 1
        assert result1.data[0]["organization_id"] == "org1"

        # Query as org2 user
        org2_client = create_client(url=SUPABASE_URL, key=org2_user_token)
        result2 = org2_client.table("quotes").select("*").execute()

        # Should only see org2 data
        assert len(result2.data) == 1
        assert result2.data[0]["organization_id"] == "org2"

    async def test_permission_based_access(self, supabase_client):
        """Test role-based permissions"""

        # Admin can update
        admin_result = supabase_client.table("settings") \
            .update({"value": "new"}) \
            .eq("key", "test") \
            .execute()
        assert admin_result.data

        # Member cannot update settings
        member_client = create_client(url=SUPABASE_URL, key=member_token)
        member_result = member_client.table("settings") \
            .update({"value": "hack"}) \
            .eq("key", "test") \
            .execute()
        assert not member_result.data  # Should be empty (blocked by RLS)
```

### Test Helpers

```python
# backend/tests/conftest.py
import pytest
from httpx import AsyncClient
from fastapi.testclient import TestClient
from main import app
import jwt
from datetime import datetime, timedelta

@pytest.fixture
def client():
    """Create test client"""
    with TestClient(app) as client:
        yield client

@pytest.fixture
def async_client():
    """Create async test client"""
    return AsyncClient(app=app, base_url="http://test")

@pytest.fixture
def mock_user():
    """Create mock user for testing"""
    return {
        "id": "test-user-123",
        "email": "test@example.com",
        "organization_id": "test-org-123",
        "role": "admin"
    }

@pytest.fixture
def auth_headers(mock_user):
    """Generate auth headers with JWT token"""
    token = jwt.encode(
        {
            "sub": mock_user["id"],
            "email": mock_user["email"],
            "organization_id": mock_user["organization_id"],
            "role": mock_user["role"],
            "exp": datetime.utcnow() + timedelta(hours=1)
        },
        "test-secret-key",
        algorithm="HS256"
    )
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def mock_supabase():
    """Mock Supabase client"""
    with patch('auth.get_supabase_client') as mock:
        client = Mock()
        mock.return_value = client
        yield client
```

---

## Common Patterns & Best Practices

### Error Handling Pattern

```python
# backend/utils/errors.py
from fastapi import HTTPException
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class AppException(HTTPException):
    """Base application exception"""

    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code
        self.context = context or {}

        # Log error
        logger.error(
            f"AppException: {error_code or 'UNKNOWN'} - {detail}",
            extra={"context": context}
        )

class ValidationException(AppException):
    """Validation error"""
    def __init__(self, detail: str, field: Optional[str] = None):
        super().__init__(
            status_code=422,
            detail=detail,
            error_code="VALIDATION_ERROR",
            context={"field": field} if field else {}
        )

class NotFoundException(AppException):
    """Resource not found"""
    def __init__(self, resource: str, id: Any):
        super().__init__(
            status_code=404,
            detail=f"{resource} not found",
            error_code="NOT_FOUND",
            context={"resource": resource, "id": id}
        )

class PermissionException(AppException):
    """Permission denied"""
    def __init__(self, action: str):
        super().__init__(
            status_code=403,
            detail=f"Permission denied for action: {action}",
            error_code="PERMISSION_DENIED",
            context={"action": action}
        )

# Usage in routes
@router.get("/items/{item_id}")
async def get_item(item_id: int):
    result = supabase.table("items").select("*").eq("id", item_id).execute()

    if not result.data:
        raise NotFoundException("Item", item_id)

    return result.data[0]
```

### Database Transaction Pattern

```python
# backend/utils/database.py
from contextlib import asynccontextmanager
from supabase import Client
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def database_transaction(supabase: Client):
    """
    Context manager for database transactions.

    Usage:
        async with database_transaction(supabase) as tx:
            tx.table("table1").insert(...).execute()
            tx.table("table2").update(...).execute()
    """
    try:
        # Start transaction
        await supabase.rpc("begin_transaction").execute()

        yield supabase

        # Commit on success
        await supabase.rpc("commit_transaction").execute()

    except Exception as e:
        # Rollback on error
        try:
            await supabase.rpc("rollback_transaction").execute()
        except:
            pass  # Rollback might fail if connection lost

        logger.error(f"Transaction failed: {str(e)}")
        raise

# Usage
async def create_quote_with_items(data, supabase):
    async with database_transaction(supabase) as tx:
        # Create quote
        quote = tx.table("quotes").insert(data["quote"]).execute()
        quote_id = quote.data[0]["id"]

        # Create items
        items = [
            {**item, "quote_id": quote_id}
            for item in data["items"]
        ]
        tx.table("quote_items").insert(items).execute()

        return quote_id
```

### Async Background Tasks

```python
# backend/utils/background_tasks.py
from fastapi import BackgroundTasks
import asyncio
from typing import Callable, Any

async def run_async_task(func: Callable, *args, **kwargs):
    """Run async task in background"""
    try:
        await func(*args, **kwargs)
    except Exception as e:
        logger.error(f"Background task failed: {str(e)}")

# Usage in route
@router.post("/quotes/{quote_id}/send-email")
async def send_quote_email(
    quote_id: int,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    # Quick response
    background_tasks.add_task(
        send_email_async,
        quote_id=quote_id,
        user_email=current_user["email"]
    )

    return {"message": "Email will be sent shortly"}

async def send_email_async(quote_id: int, user_email: str):
    """Send email in background"""
    # Fetch quote data
    # Generate PDF
    # Send email
    await asyncio.sleep(1)  # Simulate work
    logger.info(f"Email sent for quote {quote_id}")
```

---

## Debugging Tools

### Request Logging

```python
# backend/middleware/logging.py
from fastapi import Request
import time
import logging

logger = logging.getLogger(__name__)

async def log_requests(request: Request, call_next):
    """Log all requests"""
    start_time = time.time()

    # Log request
    logger.info(
        f"Request: {request.method} {request.url.path}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host
        }
    )

    # Process request
    response = await call_next(request)

    # Log response
    process_time = time.time() - start_time
    logger.info(
        f"Response: {response.status_code} in {process_time:.3f}s",
        extra={
            "status": response.status_code,
            "duration": process_time
        }
    )

    return response

# Add to main.py
app.middleware("http")(log_requests)
```

### SQL Query Logging

```python
# backend/utils/debug.py
import functools
import logging

logger = logging.getLogger(__name__)

def log_sql(func):
    """Decorator to log SQL queries"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        # Extract query from args/kwargs
        query = kwargs.get("query") or (args[0] if args else "Unknown")

        logger.debug(f"SQL Query: {query}")

        try:
            result = await func(*args, **kwargs)
            logger.debug(f"SQL Result: {len(result.data)} rows")
            return result
        except Exception as e:
            logger.error(f"SQL Error: {str(e)}")
            raise

    return wrapper

# Usage
@log_sql
async def execute_query(query: str, supabase: Client):
    return supabase.rpc("exec_sql", {"sql": query}).execute()
```

---

## Quick Reference

### File Structure

```
backend/
├── routes/           # API endpoints
├── models/          # Pydantic models
├── utils/           # Utility functions
├── migrations/      # Database migrations
├── tests/           # Test files
├── auth.py         # Authentication
├── main.py         # FastAPI app
└── config.py       # Configuration
```

### Common Commands

```bash
# Development
cd backend && uvicorn main:app --reload

# Testing
pytest -v                           # Run all tests
pytest tests/test_file.py -v      # Single file
pytest -k "test_name" -v          # Single test
pytest --cov=. --cov-report=term  # With coverage

# Database
python scripts/migrate.py          # Run migrations
python scripts/seed_data.py        # Seed test data
```

### Environment Variables

```env
# backend/.env
DATABASE_URL=postgresql://user:pass@localhost/dbname
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
JWT_SECRET=xxx
```

---

## See Also

- [FastAPI Patterns](./fastapi-patterns.md) - Framework patterns
- [Supabase RLS](./supabase-rls.md) - Row Level Security
- [Error Handling](./error-handling.md) - Error patterns
- [Export Patterns](./export-patterns.md) - File generation
- [Testing Patterns](./testing-patterns.md) - Test strategies
- [Quick Reference](./quick-reference.md) - Cheat sheet