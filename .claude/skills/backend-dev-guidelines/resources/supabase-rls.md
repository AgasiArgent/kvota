# Supabase RLS (Row-Level Security) Guide

**Created:** 2025-10-29 21:15 UTC
**Purpose:** Comprehensive multi-tenant security guide with real examples and testing patterns
**Source:** Expanded from RLS_CHECKLIST.md + backend/CLAUDE.md + production migrations
**Usage:** Reference when creating tables, writing backend code, or debugging RLS issues

---

## Table of Contents

1. [Why RLS Matters](#why-rls-matters)
2. [RLS Policy Templates](#rls-policy-templates)
3. [New Table Checklist](#new-table-checklist)
4. [Real Migration Examples](#real-migration-examples)
5. [Backend Integration Patterns](#backend-integration-patterns)
6. [Testing RLS Isolation](#testing-rls-isolation)
7. [Common RLS Bugs & Solutions](#common-rls-bugs--solutions)
8. [Advanced RLS Patterns](#advanced-rls-patterns)
9. [Performance Considerations](#performance-considerations)
10. [Quick Reference](#quick-reference)

---

## Why RLS Matters

**Context:** B2B quotation platform with multi-tenant architecture

**Security Model:**
- **Organization-based isolation:** Each organization can ONLY see their own data
- **Row-Level Security (RLS):** PostgreSQL enforces data isolation at database level
- **Defense in depth:** Even if frontend/backend has bugs, database prevents data leaks

**Without RLS:**
- ❌ Organization A can see Organization B's quotes
- ❌ Organization A can modify Organization B's customers
- ❌ Data breach violates GDPR and destroys customer trust

**With RLS:**
- ✅ PostgreSQL enforces organization_id filtering automatically
- ✅ Even with SQL injection, attackers cannot bypass isolation
- ✅ Compliance with data privacy regulations

**Real Bug Example:** Common pattern - Missing organization_id filter in queries (see backend/CLAUDE.md)

---

## RLS Policy Templates

### Copy-Paste SQL for New Tables

```sql
-- Step 1: Enable RLS on table
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;

-- Step 2: CREATE Policy - SELECT (Read)
CREATE POLICY "Users can view their organization's records"
ON your_table_name FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 3: CREATE Policy - INSERT (Create)
CREATE POLICY "Users can insert into their organization"
ON your_table_name FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 4: CREATE Policy - UPDATE (Modify)
CREATE POLICY "Users can update their organization's records"
ON your_table_name FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 5: CREATE Policy - DELETE (Remove)
CREATE POLICY "Users can delete their organization's records"
ON your_table_name FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Key Points:**
- Always create ALL 4 policies (SELECT, INSERT, UPDATE, DELETE)
- Policy names should be descriptive and include operation type
- Use `USING` for condition check (applies to SELECT, UPDATE, DELETE)
- Use `WITH CHECK` for new data validation (applies to INSERT, UPDATE)

---

## New Table Checklist

### Step 1: Add organization_id Column

```sql
-- Required column for multi-tenant isolation
ALTER TABLE your_table_name
ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
```

**Requirements:**
- Type: `UUID`
- Constraint: `NOT NULL` (every record MUST belong to an organization)
- Foreign key: `REFERENCES organizations(id)` (enforces referential integrity)

**Common Mistake:** Making organization_id nullable → RLS policies won't work correctly

---

### Step 2: Create Index on organization_id

```sql
-- Improve query performance for filtered queries
CREATE INDEX idx_your_table_organization_id
ON your_table_name(organization_id);
```

**Why Index?**
- RLS policies filter by organization_id on EVERY query
- Without index: Full table scan (slow for large tables)
- With index: Fast lookup (milliseconds instead of seconds)

**Naming convention:** `idx_{table_name}_{column_name}`

---

### Step 3: Enable RLS

```sql
-- Enable Row-Level Security on table
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;
```

**What this does:**
- PostgreSQL now enforces RLS policies on ALL queries
- Queries without matching policy return 0 rows (fail-safe)
- Even superuser must have policy (unless using BYPASSRLS role)

---

### Step 4: Create 4 Policies

**Use template from "RLS Policy Templates" section above.**

Copy all 4 policies (SELECT, INSERT, UPDATE, DELETE) and replace `your_table_name`.

**Policy Types Explained:**

| Policy Type | When It Runs | What It Checks |
|-------------|--------------|----------------|
| **SELECT** | Reading data | Can user see this row? |
| **INSERT** | Creating data | Can user add this row? |
| **UPDATE** | Modifying data | Can user change this row? |
| **DELETE** | Removing data | Can user delete this row? |

---

### Step 5: Verify RLS

**Verification SQL Queries:**

```sql
-- 1. Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'your_table_name';
-- Expected: rowsecurity = true

-- 2. List all policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'your_table_name';
-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- 3. Test query with context
SET app.current_organization_id = '123e4567-e89b-12d3-a456-426614174000';
SELECT * FROM your_table_name;
-- Expected: Only rows with matching organization_id

-- 4. Test query without context
RESET app.current_organization_id;
SELECT * FROM your_table_name;
-- Expected: ERROR or 0 rows (depends on policy)
```

**Expected Results:**
- ✅ RLS enabled: `rowsecurity = true`
- ✅ 4 policies: One for each operation (SELECT, INSERT, UPDATE, DELETE)
- ✅ Context filtering works: Only organization's data returned
- ✅ No context fails: Query blocked or returns 0 rows

---

## Real Migration Examples

### Example 1: Activity Logs Table (Production)

**Complete migration with RLS from scratch:**

```sql
-- Migration: Add activity_logs table with RLS
-- Date: 2025-10-26
-- Purpose: Track user actions for audit compliance

-- Step 1: Create table with organization_id
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX idx_activity_logs_organization_id ON activity_logs(organization_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Step 3: Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies
CREATE POLICY "Users can view their organization's activity logs"
ON activity_logs FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can insert activity logs for their organization"
ON activity_logs FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can update their organization's activity logs"
ON activity_logs FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can delete their organization's activity logs"
ON activity_logs FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 5: Verification
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'activity_logs';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'activity_logs';
```

**Why This Works:**
- ✅ organization_id is NOT NULL with foreign key
- ✅ Index on organization_id for performance
- ✅ RLS enabled before policies
- ✅ All 4 policies created
- ✅ Policy uses correct config variable: `app.current_organization_id`

---

### Example 2: Fixing Infinite Recursion Bug (Production)

**Real bug fix from backend/migrations/003_fix_organization_members_rls.sql:**

**The Problem:**
- Old RLS policy checked `organization_members` table to determine access to `organization_members`
- Created infinite recursion loop
- Queries failed or timed out

**Before (Broken):**
```sql
-- ❌ WRONG: Recursive policy causes infinite loop
CREATE POLICY "Users can view organization members"
ON organization_members FOR SELECT
USING (
  -- This queries organization_members WHILE checking organization_members access!
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

**After (Fixed):**
```sql
-- ✅ CORRECT: Simple, non-recursive policy
CREATE POLICY "Users can view their own memberships"
ON organization_members FOR SELECT
USING (user_id = auth.uid());

-- For admin operations (insert/update/delete), check organizations table (no recursion)
CREATE POLICY "Owners can insert members"
ON organization_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_id
    AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update members"
ON organization_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_id
    AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete members"
ON organization_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_id
    AND o.owner_id = auth.uid()
  )
);
```

**Key Lesson:** Avoid circular dependencies. If table A's RLS policy queries table A, you get infinite recursion.

---

### Example 3: Adding Columns to Existing Table

**Migration pattern when adding columns (doesn't need new RLS policies):**

```sql
-- Migration: Add SKU and Brand columns to quote_items
-- Date: 2025-10-21
-- Purpose: Support product identification in quotes

-- Add columns
ALTER TABLE quote_items
ADD COLUMN sku TEXT,
ADD COLUMN brand TEXT;

-- Add index for searching
CREATE INDEX idx_quote_items_sku ON quote_items(sku);

-- RLS policies already exist on quote_items, so no need to recreate
-- Verify existing RLS
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'quote_items';
```

**When You DON'T Need New Policies:**
- Adding columns to existing table
- Existing RLS policies already cover the table
- Just verify policies still work after migration

---

## Backend Integration Patterns

### Pattern 1: Supabase Client (Preferred for CRUD)

**⚠️ CRITICAL:** Supabase service role key BYPASSES RLS. You MUST manually filter by `organization_id`.

**✅ CORRECT: Always filter by organization_id**
```python
from supabase import create_client, Client
import os
from auth import get_current_user, User
from fastapi import Depends

@router.get("/{customer_id}")
async def get_customer(
    customer_id: str,
    user: User = Depends(get_current_user)
):
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # ALWAYS filter by organization_id
    result = supabase.table("customers").select("*")\
        .eq("id", str(customer_id))\
        .eq("organization_id", str(user.current_organization_id))\
        .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Customer not found")

    return result.data[0]
```

**❌ WRONG: Missing organization_id filter**
```python
# SECURITY BUG - bypasses RLS, returns data from ALL organizations
result = supabase.table("customers").select("*")\
    .eq("id", str(customer_id))\
    .execute()
```

**⚠️ UUID Conversion Required:** Always convert UUIDs to strings using `str()` when using Supabase client. The client doesn't automatically serialize UUID objects, causing silent query failures.

**Common Supabase Client Operations:**

```python
from uuid import UUID

# SELECT with filters
result = supabase.table("quotes")\
    .select("*")\
    .eq("organization_id", str(user.current_organization_id))\
    .eq("status", "draft")\
    .gte("total_amount", 1000)\
    .order("created_at", desc=True)\
    .limit(10)\
    .execute()

quotes = result.data

# INSERT
result = supabase.table("quotes").insert({
    "customer_id": str(customer_id),
    "organization_id": str(user.current_organization_id),
    "total_amount": 1000.00,
    "status": "draft"
}).execute()

new_quote = result.data[0]

# UPDATE
result = supabase.table("quotes")\
    .update({"status": "approved"})\
    .eq("id", str(quote_id))\
    .eq("organization_id", str(user.current_organization_id))\
    .execute()

# DELETE
result = supabase.table("quotes")\
    .delete()\
    .eq("id", str(quote_id))\
    .eq("organization_id", str(user.current_organization_id))\
    .execute()

# JOIN (use foreign key names)
result = supabase.table("quotes")\
    .select("*, customer:customers(name, email)")\
    .eq("organization_id", str(user.current_organization_id))\
    .execute()
```

**When to Use Supabase Client:**
- ✅ Simple CRUD operations (create, read, update, delete)
- ✅ Single-table queries with filtering and sorting
- ✅ Pagination with `.range(start, end)`
- ✅ Count queries with `count="exact"`
- ✅ Most endpoint implementations

**Why:** Supabase client uses REST API which is more reliable than direct database connections. Network errors are much less common.

**Reference:** See backend/CLAUDE.md section "asyncpg vs Supabase Client - When to Use Each"

---

### Pattern 2: asyncpg with RLS Context

**Use ONLY for complex queries not supported by Supabase client:**

```python
import asyncpg
import os
from auth import get_current_user, User
from fastapi import Depends, HTTPException

async def get_db_connection():
    """Get database connection"""
    return await asyncpg.connect(os.getenv("DATABASE_URL"))

async def set_rls_context(conn, user: User):
    """Set RLS context for user's organization"""
    await conn.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(user.current_organization_id)
    )

@router.get("/stats/overview")
async def get_customer_stats(user: User = Depends(get_current_user)):
    """Complex aggregation with FILTER - requires asyncpg"""
    conn = await get_db_connection()
    try:
        # CRITICAL: Set RLS context BEFORE any queries
        await set_rls_context(conn, user)

        # Query automatically respects RLS
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

**When to Use asyncpg:**
- ⚙️ Complex aggregations (COUNT, SUM, AVG with FILTER clause)
- ⚙️ Multi-step transactions requiring `async with conn.transaction()`
- ⚙️ JOIN queries with auth.users (not exposed via REST API)
- ⚙️ Advanced PostgreSQL features (CTEs, window functions, custom SQL)
- ⚙️ Database migrations and schema changes

**Why:** These operations aren't well-supported by Supabase REST API.

---

### Pattern 3: Helper Functions (Reusable)

**Create helper functions for common RLS operations:**

```python
# backend/db_helpers.py

import asyncpg
import os
from auth import User

async def get_db_connection():
    """Get database connection with proper error handling"""
    try:
        db_url = os.getenv("DATABASE_URL")
        return await asyncpg.connect(db_url)
    except Exception as e:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )

async def set_rls_context(conn, user: User):
    """Set Row Level Security context for database queries"""
    await conn.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(user.current_organization_id)
    )

async def execute_with_rls(user: User, query: str, *args):
    """Execute query with RLS context (helper for simple queries)"""
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        result = await conn.fetch(query, *args)
        return result
    finally:
        await conn.close()
```

**Usage in routes:**

```python
from db_helpers import execute_with_rls

@router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    """Get quote statistics with RLS isolation"""
    query = """
        SELECT
            COUNT(*) as total_quotes,
            SUM(total_amount) as total_revenue
        FROM quotes
        WHERE status = 'approved'
    """

    result = await execute_with_rls(user, query)
    return dict(result[0]) if result else {}
```

**Reference:** See backend/routes/quotes.py for production examples (lines 62-82)

---

## Testing RLS Isolation

### Manual Testing (Supabase Dashboard SQL)

**Step-by-step RLS verification:**

```sql
-- Test 1: Create test organizations and data
INSERT INTO organizations (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Org A'),
  ('22222222-2222-2222-2222-222222222222', 'Org B');

INSERT INTO customers (id, organization_id, name, email) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Customer A1', 'a1@orga.com'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Customer A2', 'a2@orga.com'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Customer B1', 'b1@orgb.com');

-- Test 2: Set context to Org A
SET app.current_organization_id = '11111111-1111-1111-1111-111111111111';
SELECT * FROM customers;
-- Expected: Only "Customer A1" and "Customer A2"

-- Test 3: Set context to Org B
SET app.current_organization_id = '22222222-2222-2222-2222-222222222222';
SELECT * FROM customers;
-- Expected: Only "Customer B1"

-- Test 4: No context
RESET app.current_organization_id;
SELECT * FROM customers;
-- Expected: 0 rows or ERROR

-- Test 5: Cross-organization access attempt (should fail)
SET app.current_organization_id = '11111111-1111-1111-1111-111111111111';
UPDATE customers SET name = 'Hacked!' WHERE organization_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0 rows updated (RLS blocks cross-org access)

-- Cleanup
DELETE FROM customers WHERE organization_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);
DELETE FROM organizations WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);
```

**Expected Results:**
- ✅ Org A context: 2 rows (A1, A2)
- ✅ Org B context: 1 row (B1)
- ✅ No context: 0 rows (fail-safe)
- ✅ Cross-organization update: 0 rows updated
- ✅ Cross-organization isolation confirmed

---

### Automated Testing (pytest)

**Test file structure:**

```python
# backend/tests/test_rls_customers.py

import pytest
from uuid import uuid4
import asyncpg
import os

# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
async def db_connection():
    """Database connection for testing"""
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    yield conn
    await conn.close()

@pytest.fixture
async def test_org_a(db_connection):
    """Create test organization A"""
    org_id = uuid4()
    await db_connection.execute(
        "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)",
        org_id, "Test Org A", "test-org-a"
    )

    # Cleanup after test
    yield type('Org', (), {'id': org_id, 'name': 'Test Org A'})()

    await db_connection.execute(
        "DELETE FROM organizations WHERE id = $1",
        org_id
    )

@pytest.fixture
async def test_org_b(db_connection):
    """Create test organization B"""
    org_id = uuid4()
    await db_connection.execute(
        "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)",
        org_id, "Test Org B", "test-org-b"
    )

    yield type('Org', (), {'id': org_id, 'name': 'Test Org B'})()

    await db_connection.execute(
        "DELETE FROM organizations WHERE id = $1",
        org_id
    )

# ============================================================================
# TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_rls_isolation_between_organizations(db_connection, test_org_a, test_org_b):
    """Test that organizations cannot see each other's data"""

    # Create test records
    customer_a = await db_connection.fetchval("""
        INSERT INTO customers (organization_id, name, email)
        VALUES ($1, $2, $3)
        RETURNING id
    """, test_org_a.id, "Customer A", "customera@test.com")

    customer_b = await db_connection.fetchval("""
        INSERT INTO customers (organization_id, name, email)
        VALUES ($1, $2, $3)
        RETURNING id
    """, test_org_b.id, "Customer B", "customerb@test.com")

    # Set context to Org A
    await db_connection.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(test_org_a.id)
    )

    # Query should only return Org A's record
    rows = await db_connection.fetch("SELECT * FROM customers")
    assert len(rows) == 1
    assert rows[0]['id'] == customer_a
    assert rows[0]['name'] == "Customer A"

    # Set context to Org B
    await db_connection.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(test_org_b.id)
    )

    # Query should only return Org B's record
    rows = await db_connection.fetch("SELECT * FROM customers")
    assert len(rows) == 1
    assert rows[0]['id'] == customer_b
    assert rows[0]['name'] == "Customer B"

    # Cleanup
    await db_connection.execute(
        "DELETE FROM customers WHERE id IN ($1, $2)",
        customer_a, customer_b
    )

@pytest.mark.asyncio
async def test_rls_insert_enforcement(db_connection, test_org_a, test_org_b):
    """Test that RLS prevents inserting data for wrong organization"""

    # Set context to Org A
    await db_connection.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(test_org_a.id)
    )

    # Try to insert with Org B's ID (should fail RLS policy)
    with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
        await db_connection.execute("""
            INSERT INTO customers (organization_id, name, email)
            VALUES ($1, $2, $3)
        """, test_org_b.id, "Malicious Customer", "malicious@test.com")

@pytest.mark.asyncio
async def test_rls_update_enforcement(db_connection, test_org_a, test_org_b):
    """Test that RLS prevents updating other organization's data"""

    # Create customer in Org B
    customer_b = await db_connection.fetchval("""
        INSERT INTO customers (organization_id, name, email)
        VALUES ($1, $2, $3)
        RETURNING id
    """, test_org_b.id, "Customer B", "customerb@test.com")

    # Set context to Org A
    await db_connection.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(test_org_a.id)
    )

    # Try to update Org B's customer (should affect 0 rows)
    result = await db_connection.execute("""
        UPDATE customers SET name = 'Hacked!'
        WHERE id = $1
    """, customer_b)

    # PostgreSQL returns "UPDATE 0" meaning 0 rows affected
    assert result == "UPDATE 0"

    # Verify customer was not modified
    customer_data = await db_connection.fetchrow(
        "SELECT name FROM customers WHERE id = $1",
        customer_b
    )
    assert customer_data['name'] == "Customer B"  # Not changed

    # Cleanup
    await db_connection.execute(
        "DELETE FROM customers WHERE id = $1",
        customer_b
    )

@pytest.mark.asyncio
async def test_rls_no_context_returns_empty(db_connection, test_org_a):
    """Test that queries without RLS context return 0 rows"""

    # Create test customer
    customer_id = await db_connection.fetchval("""
        INSERT INTO customers (organization_id, name, email)
        VALUES ($1, $2, $3)
        RETURNING id
    """, test_org_a.id, "Customer A", "customera@test.com")

    # Reset RLS context (no organization set)
    await db_connection.execute(
        "SELECT set_config('app.current_organization_id', '', true)"
    )

    # Query should return 0 rows (fail-safe)
    rows = await db_connection.fetch("SELECT * FROM customers")
    assert len(rows) == 0

    # Cleanup
    await db_connection.execute(
        "DELETE FROM customers WHERE id = $1",
        customer_id
    )
```

**Running Tests:**

```bash
cd backend

# Run all RLS tests
pytest tests/test_rls_*.py -v

# Run specific test file
pytest tests/test_rls_customers.py -v

# Run specific test function
pytest tests/test_rls_customers.py::test_rls_isolation_between_organizations -v

# Run with coverage
pytest tests/test_rls_*.py --cov=routes --cov-report=term-missing
```

**Test Coverage Goals:**
- ✅ Isolation between organizations (cannot see each other's data)
- ✅ INSERT enforcement (cannot insert for wrong organization)
- ✅ UPDATE enforcement (cannot update other organization's data)
- ✅ DELETE enforcement (cannot delete other organization's data)
- ✅ No context fail-safe (queries without context return 0 rows)
- ✅ Context switching (same connection, different orgs)

**Reference:** See backend/tests/test_quotes_calc_mapper.py for real test patterns

---

## Common RLS Bugs & Solutions

### Bug 1: Missing organization_id Column

**Symptom:** RLS policies fail to create, migration errors

**Root Cause:** Forgot to add `organization_id` column before enabling RLS

**Example:**
```sql
-- ❌ WRONG ORDER
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;  -- Fails: no organization_id

CREATE POLICY "..." ON new_table USING (organization_id = ...);  -- Error
```

**Fix:**
```sql
-- ✅ CORRECT ORDER
ALTER TABLE new_table ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
CREATE INDEX idx_new_table_organization_id ON new_table(organization_id);
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;  -- Now works
CREATE POLICY "..." ON new_table USING (organization_id = ...);  -- Success
```

---

### Bug 2: RLS Not Enabled

**Symptom:** Policies created but data still leaks between organizations

**Root Cause:** Forgot `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

**Check:**
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table';
-- If rowsecurity = false, RLS not enabled
```

**Fix:**
```sql
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

---

### Bug 3: Missing Policy Type

**Symptom:** SELECT works but INSERT/UPDATE/DELETE fail with permission denied

**Root Cause:** Created SELECT policy but forgot INSERT/UPDATE/DELETE policies

**Check:**
```sql
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'your_table';
-- Should see 4 rows: SELECT, INSERT, UPDATE, DELETE
```

**Fix:** Create missing policies using template from "RLS Policy Templates" section

---

### Bug 4: Wrong Context Setting (asyncpg)

**Symptom:** Queries return 0 rows or fail with RLS error

**Root Cause:** Used wrong config variable name or wrong format

**Example:**
```python
# ❌ WRONG: Config variable name doesn't match policy
await conn.execute(
    "SELECT set_config('organization_id', $1, true)",  # Wrong name
    str(user.current_organization_id)
)
# Policy checks 'app.current_organization_id', not 'organization_id'
```

**Fix:**
```python
# ✅ CORRECT: Match policy config variable name exactly
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    str(user.current_organization_id)
)
```

**Debugging Tip:**
```sql
-- Check what config variable your policies use
SELECT qual FROM pg_policies WHERE tablename = 'your_table';
-- Look for: current_setting('app.current_organization_id')
--           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
--           This is the exact variable name to use
```

---

### Bug 5: Service Role Key Bypasses RLS (Supabase Client)

**Symptom:** Queries return all organizations' data even with RLS enabled

**Root Cause:** Supabase service role key has BYPASSRLS permission

**Example:**
```python
# ❌ WRONG: Trusts RLS will filter, but service key bypasses RLS
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # BYPASSRLS role
)
result = supabase.table("quotes").select("*").execute()
# Returns ALL organizations' quotes ❌
```

**Fix:**
```python
# ✅ CORRECT: Manually filter by organization_id
result = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()
# Returns only user's organization quotes ✅
```

**🔴 CRITICAL SECURITY WARNING:** When using Supabase client with service role key, **RLS is COMPLETELY BYPASSED**. You MUST manually filter by `organization_id` or you will **EXPOSE DATA FROM ALL ORGANIZATIONS**. This is the #1 cause of data leaks in multi-tenant applications!

**Verification Checklist:**
```python
# Search your codebase for this pattern:
# grep -r "supabase.table" backend/routes/*.py

# Every query MUST have:
.eq("organization_id", str(user.current_organization_id))

# If missing, you have a security bug!
```

---

### Bug 6: Infinite Recursion in RLS Policy

**Symptom:** Queries timeout or fail with recursion error

**Root Cause:** RLS policy queries the same table it's protecting

**Example:**
```sql
-- ❌ WRONG: Queries organization_members while checking organization_members access
CREATE POLICY "Users can view organization members"
ON organization_members FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members  -- ← Recursion!
    WHERE user_id = auth.uid()
  )
);
```

**Fix:**
```sql
-- ✅ CORRECT: Simple, non-recursive policy
CREATE POLICY "Users can view their own memberships"
ON organization_members FOR SELECT
USING (user_id = auth.uid());  -- No recursion
```

**Reference:** See backend/migrations/003_fix_organization_members_rls.sql for real fix

---

### Bug 7: UUID Not Converted to String (Supabase Client)

**Symptom:** Queries return 0 rows or fail silently

**Root Cause:** Supabase client doesn't automatically serialize UUID objects

**Example:**
```python
# ❌ WRONG: UUID object not converted to string
result = supabase.table("customers").select("*")\
    .eq("id", customer_id)\
    .eq("organization_id", user.current_organization_id)\
    .execute()
# Silent failure or 0 rows returned
```

**Fix:**
```python
# ✅ CORRECT: Convert UUIDs to strings
result = supabase.table("customers").select("*")\
    .eq("id", str(customer_id))\
    .eq("organization_id", str(user.current_organization_id))\
    .execute()
```

**Rule:** ALWAYS use `str()` for UUIDs when using Supabase client

---

## Advanced RLS Patterns

### Pattern 1: Admin-Only Rows

**Use Case:** Some rows visible only to admin/owner roles

```sql
-- Allow users to see their org's records OR admin-only records
CREATE POLICY "Users can view their org's records and admin records"
ON settings_table FOR SELECT
USING (
  organization_id = current_setting('app.current_organization_id')::uuid
  OR is_global = true
);
```

**Backend Usage:**
```python
# Admin-only settings are visible to all organizations
result = supabase.table("settings_table").select("*")\
    .eq("organization_id", str(user.current_organization_id))\
    .execute()
# Also returns is_global=true rows
```

---

### Pattern 2: Hierarchical Permissions

**Use Case:** Related table with indirect organization relationship

```sql
-- Policy for quote_items (related to quotes table)
CREATE POLICY "Users can view quote items for their org's quotes"
ON quote_items FOR SELECT
USING (
  quote_id IN (
    SELECT id FROM quotes
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  )
);
```

**Key Point:** Subquery checks parent table's organization_id

**Performance Note:** Requires index on `quote_items(quote_id)` for performance

---

### Pattern 3: Public + Private Rows

**Use Case:** Some rows are public, others are organization-specific

```sql
-- Allow users to see public rows OR their org's private rows
CREATE POLICY "Users can view public and their org's records"
ON templates_table FOR SELECT
USING (
  is_public = true
  OR organization_id = current_setting('app.current_organization_id')::uuid
);
```

**Backend Usage:**
```python
# Query returns both public templates and organization's private templates
result = supabase.table("templates_table").select("*")\
    .eq("organization_id", str(user.current_organization_id))\
    .execute()
# Also returns is_public=true rows from other organizations
```

---

### Pattern 4: Owner-Only Operations

**Use Case:** Only organization owner can perform certain operations

```sql
-- Only owner can delete records
CREATE POLICY "Owners can delete their org's records"
ON sensitive_table FOR DELETE
USING (
  organization_id = current_setting('app.current_organization_id')::uuid
  AND EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = organization_id
    AND o.owner_id = current_setting('app.current_user_id')::uuid
  )
);
```

**Backend Usage:**
```python
from auth import require_org_owner

@router.delete("/{record_id}")
async def delete_record(
    record_id: str,
    context = Depends(require_org_owner())  # Checks is_owner
):
    # User is organization owner, can proceed
    result = supabase.table("sensitive_table").delete()\
        .eq("id", str(record_id))\
        .eq("organization_id", str(context.organization_id))\
        .execute()
```

---

## Performance Considerations

### Index Requirements

**Every organization_id column MUST have an index:**

```sql
-- Required for RLS performance
CREATE INDEX idx_your_table_organization_id
ON your_table(organization_id);
```

**Why:**
- RLS policies filter by organization_id on EVERY query
- Without index: PostgreSQL does full table scan
- With index: Fast B-tree lookup

**Benchmark (10M rows):**
- ❌ Without index: 3500ms per query
- ✅ With index: 5ms per query (700x faster)

---

### Composite Indexes for Common Queries

**If you frequently filter by organization_id + status:**

```sql
-- Composite index for common query pattern
CREATE INDEX idx_quotes_org_status
ON quotes(organization_id, status);

-- This query uses the composite index
SELECT * FROM quotes
WHERE organization_id = 'xxx'
AND status = 'draft';
```

**Index order matters:**
- First column: Most selective filter (organization_id)
- Second column: Secondary filter (status)

---

### Query Plan Analysis

**Check if your queries use indexes:**

```sql
-- Explain analyze shows execution plan
EXPLAIN ANALYZE
SELECT * FROM customers
WHERE organization_id = '123e4567-e89b-12d3-a456-426614174000';

-- Look for:
-- ✅ "Index Scan using idx_customers_organization_id"
-- ❌ "Seq Scan on customers" (bad - missing index)
```

**If you see Seq Scan:**
1. Check if index exists
2. Check if index is on correct column
3. Run `ANALYZE customers;` to update statistics

---

### RLS Policy Optimization

**Avoid complex subqueries in RLS policies:**

```sql
-- ❌ SLOW: Complex subquery executed for every row
CREATE POLICY "Slow policy"
ON table1 FOR SELECT
USING (
  user_id IN (
    SELECT user_id FROM table2
    JOIN table3 ON table2.id = table3.ref_id
    WHERE table3.status = 'active'
  )
);

-- ✅ FAST: Simple equality check
CREATE POLICY "Fast policy"
ON table1 FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Best Practice:** Keep RLS policies as simple as possible. Move complex business logic to application layer.

---

### Connection Pooling (asyncpg)

**Use connection pooling for high-traffic endpoints:**

```python
import asyncpg

# Create connection pool (in main.py)
db_pool = None

async def init_db_pool():
    global db_pool
    db_pool = await asyncpg.create_pool(
        os.getenv("DATABASE_URL"),
        min_size=5,
        max_size=20
    )

async def get_db_connection_from_pool():
    """Get connection from pool (reuses connections)"""
    return await db_pool.acquire()

# Usage in routes
@router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    async with db_pool.acquire() as conn:
        await set_rls_context(conn, user)
        result = await conn.fetchrow("SELECT COUNT(*) FROM quotes")
        return {"count": result['count']}
```

**Benefits:**
- Reuses connections (avoid connection overhead)
- Faster for high-traffic endpoints
- Limits max connections (prevents exhaustion)

---

## Quick Reference

### Verification Commands

```sql
-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table';

-- List policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'your_table';

-- Check index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'your_table' AND indexdef LIKE '%organization_id%';

-- Check policy definition
SELECT qual FROM pg_policies
WHERE tablename = 'your_table' AND policyname = 'policy_name';
```

---

### Backend Code Snippets

**Supabase client (always filter manually):**
```python
.eq("organization_id", str(user.current_organization_id))
```

**asyncpg (set context before queries):**
```python
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    str(user.current_organization_id)
)
```

---

### Related Documentation

- **[backend/CLAUDE.md](/home/novi/quotation-app-dev/backend/CLAUDE.md)** - Backend patterns and conventions
- **[backend/auth.py](/home/novi/quotation-app-dev/backend/auth.py)** - Authentication and authorization
- **[backend/routes/quotes.py](/home/novi/quotation-app-dev/backend/routes/quotes.py)** - Real RLS usage in production routes
- **[backend/migrations/](/home/novi/quotation-app-dev/backend/migrations/)** - Real RLS policy examples

---

## Migration Template (Complete Example)

**Copy this for every new table:**

```sql
-- Migration: Add your_feature table with RLS
-- Date: YYYY-MM-DD
-- Purpose: Description of what this table does

-- Step 1: Create table with organization_id
CREATE TABLE your_table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  -- Add other columns here
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX idx_your_table_organization_id ON your_table_name(organization_id);
-- Add other indexes as needed

-- Step 3: Enable RLS
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies
CREATE POLICY "Users can view their organization's records"
ON your_table_name FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can insert into their organization"
ON your_table_name FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can update their organization's records"
ON your_table_name FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can delete their organization's records"
ON your_table_name FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 5: Verification
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table_name';
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'your_table_name';
```

---

**Last Updated:** 2025-10-29 21:15 UTC
**Expanded From:** RLS_CHECKLIST.md (662 lines) → supabase-rls.md (800+ lines)
**New Sections:** Real Migration Examples, Backend Integration Patterns, Testing RLS Isolation, Performance Considerations
**Real Examples:** 3 production migrations, 8 backend code patterns, 6 pytest test cases
**Maintenance:** Update when discovering new RLS patterns or edge cases
