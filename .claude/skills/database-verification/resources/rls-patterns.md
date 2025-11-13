# RLS (Row-Level Security) Patterns & Guardrails

**Created:** 2025-10-29 21:15 UTC
**Purpose:** Security guardrails for multi-tenant RLS verification
**Scope:** Row-Level Security policies, organization isolation, data breach prevention
**For Agent:** @security-auditor, @code-reviewer, backend developers
**Usage:** Reference when auditing database tables, migrations, and API endpoints

---

## Executive Summary

Row-Level Security is the **PRIMARY DEFENSE AGAINST DATA LEAKS** in multi-tenant systems.

**Three layers of protection:**
1. **RLS Policies** (PostgreSQL enforced) - Blocks unauthorized row access at database level
2. **Manual Filtering** (Backend code) - Supabase service role requires manual `organization_id` filtering
3. **Role-Based Access** (Application) - FastAPI validates user roles before database operations

**Critical:** If ANY layer fails, data leaks between organizations.

---

## Why RLS Matters (Business Impact)

### Without RLS
- Organization A can see Organization B's quotes, customers, invoices
- SQL injection could expose all organizations' data
- GDPR violations and customer trust destroyed
- Liability: Data breach settlements (millions of dollars)

### With RLS
- PostgreSQL enforces organization isolation at database level
- Even with backend bugs or SQL injection, database prevents cross-organization data access
- Compliance with data privacy regulations (GDPR, SOC2)
- Defense in depth: Multiple layers catch security bugs

**Real Example (from codebase):** Missing `.eq("organization_id", str(user.current_organization_id))` in Supabase queries returns ALL organizations' data instead of just current user's organization.

---

## RLS Architecture Overview

### Multi-Tenant Data Model

```
Organizations
├── organization_id (UUID, PK)
├── name
└── rows in ALL tables reference this organization_id

quotes (example)
├── id (UUID, PK)
├── organization_id (UUID, FK to organizations)
│   └── RLS filters by this value
├── customer_id
├── total_amount
└── ...

customers (example)
├── id (UUID, PK)
├── organization_id (UUID, FK to organizations)
│   └── RLS filters by this value
├── name
└── ...
```

**Key Pattern:** Every data table has `organization_id` column used in RLS policies.

### How RLS Policies Work

```
User Query: SELECT * FROM quotes
            ↓
PostgreSQL Evaluates RLS Policies
            ↓
Policy Check: organization_id = current_setting('app.current_organization_id')::uuid
            ↓
Only matching rows returned
            ↓
Result: User sees ONLY their organization's quotes
```

---

## RLS Policy Template (Copy-Paste)

### Complete SQL for New Tables

```sql
-- Step 1: Add organization_id column to existing table
ALTER TABLE your_table_name
ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);

-- Step 2: Create index for query performance
CREATE INDEX idx_your_table_name_organization_id
ON your_table_name(organization_id);

-- Step 3: Enable Row-Level Security
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;

-- Step 4a: SELECT Policy (Read)
CREATE POLICY "Users can view their organization's records"
ON your_table_name FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 4b: INSERT Policy (Create)
CREATE POLICY "Users can insert into their organization"
ON your_table_name FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 4c: UPDATE Policy (Modify)
CREATE POLICY "Users can update their organization's records"
ON your_table_name FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- Step 4d: DELETE Policy (Remove)
CREATE POLICY "Users can delete their organization's records"
ON your_table_name FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Mandatory checklist:**
- [ ] `organization_id` column exists and is NOT NULL
- [ ] Foreign key: `REFERENCES organizations(id)`
- [ ] Index: `idx_{table_name}_organization_id` for performance
- [ ] RLS enabled: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] 4 policies created: SELECT, INSERT, UPDATE, DELETE
- [ ] Config variable matches: `app.current_organization_id` (not just `organization_id`)

---

## Guardrail 1: Database Structure Verification

### Required Columns

Every data table MUST have:

```sql
-- Verify with this query
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'your_table'
  AND column_name IN ('organization_id', 'id', 'created_at');
```

**Expected columns:**
- `id` - UUID, PRIMARY KEY
- `organization_id` - UUID, NOT NULL, FOREIGN KEY to organizations(id)
- `created_at` - TIMESTAMPTZ, DEFAULT NOW()

**🔴 Red Flags:**
- `organization_id` is nullable (allows NULL values)
- `organization_id` is not indexed
- `organization_id` has no foreign key constraint
- Column type is not UUID

### Required Indexes

```sql
-- Verify RLS index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'your_table'
  AND indexdef LIKE '%organization_id%';
```

**Expected:** At least one index on `organization_id`

**Why:** RLS policies filter by `organization_id` on EVERY query. Without index, full table scans become slow.

---

## Guardrail 2: RLS Policy Verification

### Check RLS Enabled

```sql
-- Verify RLS is enabled on table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'your_table_name';
```

**Expected:** `rowsecurity = true`

**🔴 Red Flag:** `rowsecurity = false` means policies are NOT enforced!

### Check All 4 Policies Exist

```sql
-- List all policies on table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'your_table_name'
ORDER BY cmd;
```

**Expected output:**
| policyname | cmd | qual | with_check |
|-----------|-----|------|-----------|
| "Users can view..." | SELECT | organization_id = ... | (null) |
| "Users can insert..." | INSERT | (null) | organization_id = ... |
| "Users can update..." | UPDATE | organization_id = ... | organization_id = ... |
| "Users can delete..." | DELETE | organization_id = ... | (null) |

**🔴 Red Flags:**
- Missing any of the 4 operations (SELECT, INSERT, UPDATE, DELETE)
- Policy uses wrong config variable name (e.g., `organization_id` instead of `app.current_organization_id`)
- `USING` clause checks wrong value
- `WITH CHECK` clause missing for INSERT/UPDATE

### Verify Policy Context Variable

```sql
-- Check what config variable policies use
SELECT policyname, qual, with_check
FROM pg_policies
WHERE tablename = 'your_table_name';
```

**Expected:** All policies check `current_setting('app.current_organization_id')::uuid`

**🔴 Red Flag:** Policies check different variable names or wrong format

---

## Guardrail 3: Backend Code Patterns

### Pattern A: Supabase Client (MANUAL FILTERING REQUIRED)

**Critical:** Supabase service role key BYPASSES RLS. You MUST manually filter.

```python
# ✅ CORRECT: Always include organization_id filter
result = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .filter("status", "eq", "draft") \
    .execute()

if not result.data:
    raise HTTPException(status_code=404, detail="Quote not found")

return result.data
```

**🔴 RED FLAG PATTERN - NEVER DO THIS:**
```python
# ❌ WRONG: Missing organization_id filter
result = supabase.table("quotes") \
    .select("*") \
    .filter("status", "eq", "draft") \
    .execute()
# Returns ALL organizations' quotes! Data leak! ❌

# ❌ WRONG: Trusting RLS will filter
result = supabase.table("quotes").select("*").execute()
# Service role key bypasses RLS! ❌

# ❌ WRONG: Wrong UUID type
result = supabase.table("quotes") \
    .eq("organization_id", user.current_organization_id) \  # UUID object, not string
    .execute()
# Silent failure - query returns 0 rows ❌
```

**Mandatory checks:**
- [ ] `.eq("organization_id", str(user.current_organization_id))` present
- [ ] UUID converted to string: `str(...)`
- [ ] Filter chain includes status/type-specific filters after org filter
- [ ] Error handling for not found (404)

### Pattern B: asyncpg with RLS Context (CONTEXT SETTING REQUIRED)

```python
import asyncpg
import os

async def get_org_quotes(user, org_id_str):
    """Get quotes for organization with RLS enforcement"""

    # Step 1: Connect
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

    try:
        # Step 2: SET RLS CONTEXT (CRITICAL!)
        await conn.execute(
            "SELECT set_config('app.current_organization_id', $1, true)",
            str(user.current_organization_id)  # Convert UUID to string
        )

        # Step 3: Query (RLS policies apply automatically)
        rows = await conn.fetch("SELECT * FROM quotes WHERE status = $1", "draft")

        return rows

    finally:
        # Step 4: Close connection
        await conn.close()
```

**🔴 RED FLAG PATTERNS:**
```python
# ❌ WRONG: Forgot to set RLS context
conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
rows = await conn.fetch("SELECT * FROM quotes")
# RLS policies fail! Returns 0 rows ❌

# ❌ WRONG: Wrong config variable name
await conn.execute(
    "SELECT set_config('organization_id', $1, true)",  # Wrong name!
    str(user.current_organization_id)
)
# Policy expects 'app.current_organization_id', not 'organization_id' ❌

# ❌ WRONG: Not using string format
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    user.current_organization_id  # UUID object, not string
)
# Silent type mismatch ❌
```

**Mandatory checks:**
- [ ] `set_config('app.current_organization_id', $1, true)` exactly matched
- [ ] UUID converted to string: `str(...)`
- [ ] Set BEFORE any queries
- [ ] Connection properly closed in finally block

### Pattern C: Backend Endpoint Validation

```python
from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_user, User

router = APIRouter(prefix="/api/quotes")

@router.get("/{quote_id}")
async def get_quote(
    quote_id: str,
    user: User = Depends(get_current_user)  # ✅ Always require auth
):
    """Get quote - respects organization isolation"""

    try:
        # ✅ CORRECT: Manual filtering + error handling
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
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error"
        )
```

**🔴 RED FLAG PATTERNS:**
```python
# ❌ WRONG: No authentication required
@router.get("/quotes/{quote_id}")
async def get_quote(quote_id: str):  # No Depends(get_current_user)!
    # Anyone can access! ❌

# ❌ WRONG: Missing organization filter
@router.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, user: User = Depends(get_current_user)):
    result = supabase.table("quotes") \
        .select("*") \
        .eq("id", quote_id) \
        .execute()  # Missing .eq("organization_id", ...)
    # Can access other orgs' quotes! ❌

# ❌ WRONG: No error handling
@router.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, user: User = Depends(get_current_user)):
    result = supabase.table("quotes") \
        .select("*") \
        .eq("id", quote_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .execute()
    return result.data[0]  # What if result.data is empty?
```

**Mandatory checks:**
- [ ] `user: User = Depends(get_current_user)` present
- [ ] `.eq("organization_id", str(user.current_organization_id))` in query
- [ ] Not found check: `if not result.data: raise HTTPException(404)`
- [ ] Try/except for database errors
- [ ] HTTP exceptions re-raised

---

## Guardrail 4: Testing RLS Isolation

### Manual SQL Testing

```sql
-- Test script: Verify organization isolation
-- Run in Supabase Dashboard SQL Editor

-- 1. Create test organizations
INSERT INTO organizations (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Org B');

-- 2. Create test data for each org
INSERT INTO quotes (id, organization_id, customer_id, quote_number, total_amount, status) VALUES
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid(), 'QA-001', 1000.00, 'draft'),
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', gen_random_uuid(), 'QA-002', 2000.00, 'draft'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', gen_random_uuid(), 'QB-001', 5000.00, 'draft');

-- 3. Test Org A context
SET app.current_organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT id, quote_number, organization_id FROM quotes;
-- Expected: QA-001, QA-002 (2 rows)

-- 4. Test Org B context
SET app.current_organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT id, quote_number, organization_id FROM quotes;
-- Expected: QB-001 (1 row)

-- 5. Test no context (should fail or return 0 rows)
RESET app.current_organization_id;
SELECT id, quote_number, organization_id FROM quotes;
-- Expected: ERROR or 0 rows

-- 6. Cleanup test data
DELETE FROM quotes WHERE organization_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
DELETE FROM organizations WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
```

**Expected results:**
- ✅ Org A context: Returns only QA-001, QA-002
- ✅ Org B context: Returns only QB-001
- ✅ No context: Returns 0 rows or ERROR
- ✅ Cross-organization isolation confirmed

### Backend API Testing

```python
# backend/tests/test_rls_quotes.py

import pytest
from uuid import uuid4
from supabase import create_client
import os

@pytest.fixture
def supabase():
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

@pytest.mark.asyncio
async def test_organization_isolation_via_rls(supabase, test_org_a, test_org_b, test_user_a, test_user_b):
    """Verify organizations cannot see each other's quotes"""

    # Create quote for Org A
    quote_a = supabase.table("quotes").insert({
        "organization_id": str(test_org_a.id),
        "customer_id": str(uuid4()),
        "quote_number": "TEST-A-001",
        "total_amount": 1000.00,
        "status": "draft"
    }).execute()

    # Create quote for Org B
    quote_b = supabase.table("quotes").insert({
        "organization_id": str(test_org_b.id),
        "customer_id": str(uuid4()),
        "quote_number": "TEST-B-001",
        "total_amount": 2000.00,
        "status": "draft"
    }).execute()

    # User A queries (should only see their org's quote)
    result_a = supabase.table("quotes") \
        .select("*") \
        .eq("organization_id", str(test_org_a.id)) \
        .execute()

    assert len(result_a.data) == 1
    assert result_a.data[0]["quote_number"] == "TEST-A-001"

    # User B queries (should only see their org's quote)
    result_b = supabase.table("quotes") \
        .select("*") \
        .eq("organization_id", str(test_org_b.id)) \
        .execute()

    assert len(result_b.data) == 1
    assert result_b.data[0]["quote_number"] == "TEST-B-001"

    # Cleanup
    supabase.table("quotes").delete().eq("id", quote_a.data[0]["id"]).execute()
    supabase.table("quotes").delete().eq("id", quote_b.data[0]["id"]).execute()

@pytest.mark.asyncio
async def test_api_endpoint_respects_organization(client, test_user_a, test_user_b, test_org_a, test_org_b):
    """Verify API endpoints respect RLS at application level"""

    # Login as User A
    token_a = authenticate_user(test_user_a)

    # Create quote in User A's organization
    response = client.post(
        "/api/quotes",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "customer_id": str(uuid4()),
            "total_amount": 1000.00,
            "currency": "USD"
        }
    )
    assert response.status_code == 200
    quote_a_id = response.json()["id"]

    # Login as User B
    token_b = authenticate_user(test_user_b)

    # User B tries to access User A's quote (should get 404)
    response = client.get(
        f"/api/quotes/{quote_a_id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert response.status_code == 404  # Quote not found (due to RLS)
```

**Test coverage:**
- [ ] Different organizations have isolated data
- [ ] API endpoints return 404 for cross-org access
- [ ] Context switching works correctly
- [ ] Cleanup removes test data

---

## Common RLS Bugs & Fixes

### Bug 1: Missing organization_id Column

**Symptom:** RLS policy creation fails with column not found error

**Root Cause:** Forgot to add `organization_id` column before enabling RLS

```sql
-- ❌ WRONG: Enabling RLS before adding column
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;  -- FAILS
CREATE POLICY "..." ON new_table USING (organization_id = ...);  -- Column doesn't exist!

-- ✅ CORRECT: Add column first
ALTER TABLE new_table ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;  -- Now works
CREATE POLICY "..." ON new_table USING (organization_id = ...);  -- Success
```

---

### Bug 2: RLS Not Enabled on Table

**Symptom:** Policies created but data still leaks between organizations

**Root Cause:** Forgot `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

```sql
-- ❌ WRONG: Policies created without enabling RLS
CREATE POLICY "Users can view their org's records"
ON quotes FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);
-- Policy exists but is NOT enforced!

-- ✅ CORRECT: Enable RLS first
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their org's records"
ON quotes FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Verify
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'quotes';
-- Expected: rowsecurity = true
```

---

### Bug 3: Missing Policy Operation (INSERT/UPDATE/DELETE)

**Symptom:** SELECT works but INSERT/UPDATE/DELETE fail with permission errors

**Root Cause:** Only created SELECT policy, forgot INSERT/UPDATE/DELETE

```sql
-- ❌ WRONG: Only SELECT policy
CREATE POLICY "Users can view records"
ON quotes FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);
-- INSERT will fail: no INSERT policy!

-- ✅ CORRECT: Create all 4 policies
CREATE POLICY "Users can view records"
ON quotes FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can insert records"
ON quotes FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can update records"
ON quotes FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can delete records"
ON quotes FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Verify all 4 policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'quotes';
-- Expected: 4 rows with SELECT, INSERT, UPDATE, DELETE
```

---

### Bug 4: Wrong Config Variable Name

**Symptom:** Queries return 0 rows or RLS permission denied errors

**Root Cause:** Policy checks wrong config variable name

```python
# ❌ WRONG: Sets 'organization_id' but policy checks 'app.current_organization_id'
await conn.execute(
    "SELECT set_config('organization_id', $1, true)",  # Wrong name!
    str(user.current_organization_id)
)
rows = await conn.fetch("SELECT * FROM quotes")  # Returns 0 rows
# Policy expects 'app.current_organization_id', config has 'organization_id'

# ✅ CORRECT: Match policy exactly
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",  # Exact match!
    str(user.current_organization_id)
)
rows = await conn.fetch("SELECT * FROM quotes")  # Returns matching rows
```

**Fix:**
- Policy: `current_setting('app.current_organization_id')`
- Code: `set_config('app.current_organization_id', ...)`
- Both MUST match exactly

---

### Bug 5: Service Role Key Bypasses RLS (Supabase Client)

**Symptom:** Queries return all organizations' data despite RLS enabled

**Root Cause:** Supabase service role key has BYPASSRLS permission

```python
# ❌ WRONG: Trusts RLS will filter with service role key
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # BYPASSRLS role!
)
result = supabase.table("quotes").select("*").execute()
# Returns ALL organizations' quotes! RLS bypassed! ❌

# ✅ CORRECT: Manually filter by organization_id
result = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()
# Returns only user's organization quotes ✅
```

**🔴 CRITICAL:** This is the #1 cause of data leaks in multi-tenant systems!

---

### Bug 6: UUID Type Mismatch in Supabase Client

**Symptom:** Queries return 0 rows despite correct organization context

**Root Cause:** Passing UUID object instead of string to filter

```python
# ❌ WRONG: UUID object not converted to string
result = supabase.table("quotes") \
    .eq("organization_id", user.current_organization_id) \  # UUID object
    .execute()
# Silent failure: query returns 0 rows

# ✅ CORRECT: Convert UUID to string
result = supabase.table("quotes") \
    .eq("organization_id", str(user.current_organization_id)) \  # String
    .execute()
# Works correctly
```

**Remember:** Supabase client filters use string values, not UUID objects.

---

### Bug 7: Missing organization_id in INSERT

**Symptom:** Row created but invisible to user (RLS hides it)

**Root Cause:** INSERT statement forgot to set organization_id

```python
# ❌ WRONG: organization_id not set
result = supabase.table("quotes").insert({
    "customer_id": customer_id,
    "total_amount": 1000.00
    # Missing organization_id!
}).execute()
# Row created with NULL or wrong org_id, user can't see it

# ✅ CORRECT: Set organization_id explicitly
result = supabase.table("quotes").insert({
    "organization_id": str(user.current_organization_id),  # Required!
    "customer_id": customer_id,
    "total_amount": 1000.00
}).execute()
# Row visible to user
```

---

## Verification Checklist (Auditing Guide)

### Table Structure Audit

```sql
-- Run for each data table
SELECT
  tablename,
  (SELECT rowsecurity FROM pg_tables WHERE tablename = t.tablename) as rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count,
  (SELECT count(*) FROM pg_indexes WHERE tablename = t.tablename AND indexdef LIKE '%organization_id%') as org_indexes
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected output:**

| tablename | rls_enabled | policy_count | org_indexes |
|-----------|-------------|------------|-------------|
| quotes | t | 4 | 1 |
| customers | t | 4 | 1 |
| activity_logs | t | 4 | 1 |

**🔴 Red flags:**
- `rls_enabled = f` (RLS not enabled)
- `policy_count < 4` (Missing policies)
- `org_indexes = 0` (Missing index)

### Policy Content Audit

```sql
-- Verify policy content for specific table
SELECT
  policyname,
  cmd,
  qual as using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'quotes'
ORDER BY cmd;
```

**Expected:**
- All policies reference `current_setting('app.current_organization_id')`
- USING clause for SELECT, UPDATE, DELETE
- WITH CHECK clause for INSERT, UPDATE

### Backend Code Audit

**For Supabase queries:**
```python
# Search codebase for:
# ✅ GOOD: .eq("organization_id", str(user.current_organization_id))
# ❌ BAD: Missing .eq("organization_id", ...)
# ❌ BAD: .eq("organization_id", user.current_organization_id)  # Not string
```

**For asyncpg queries:**
```python
# Search for:
# ✅ GOOD: set_config('app.current_organization_id', $1, true)
# ❌ BAD: Missing set_config call
# ❌ BAD: set_config('organization_id', ...)  # Wrong variable name
```

---

## Advanced RLS Patterns

### Pattern 1: Admin-Only Data (some rows visible only to admins)

```sql
CREATE TABLE system_settings (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  is_admin_only BOOLEAN DEFAULT false
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their org's settings, admins see all"
ON system_settings FOR SELECT
USING (
  organization_id = current_setting('app.current_organization_id')::uuid
  OR is_admin_only = false
);
```

### Pattern 2: Hierarchical Relationships (quotes and quote_items)

```sql
CREATE TABLE quote_items (
  id UUID PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id),
  product_id UUID NOT NULL,
  quantity INT NOT NULL
);

ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see items from their org's quotes"
ON quote_items FOR SELECT
USING (
  quote_id IN (
    SELECT id FROM quotes
    WHERE organization_id = current_setting('app.current_organization_id')::uuid
  )
);
```

### Pattern 3: Shared (Public) Records

```sql
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY,
  organization_id UUID,  -- NULL for global products
  name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false
);

ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see public products and their org's private products"
ON product_catalog FOR SELECT
USING (
  is_public = true
  OR organization_id = current_setting('app.current_organization_id')::uuid
  OR organization_id IS NULL
);
```

---

## Related Documentation

**For deeper technical details:**
- **[backend/CLAUDE.md](../../../backend/CLAUDE.md)** - RLS context patterns, Supabase vs asyncpg examples
- **[backend/migrations/](../../../backend/migrations/)** - Real RLS policy implementations from codebase
- **[RLS_CHECKLIST.md](../../RLS_CHECKLIST.md)** - Comprehensive checklist (this file's source)
- **[COMMON_GOTCHAS.md](../../COMMON_GOTCHAS.md)** - Bug #1 (missing org filter), Bug #7 (missing RLS)

**For application context:**
- **[backend/auth.py](../../../backend/auth.py)** - User authentication, organization context
- **[backend/routes/](../../../backend/routes/)** - API endpoint patterns with RLS

---

## Quick Reference Snippets

### Verification Commands (Copy-Paste)

```sql
-- Check if RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('quotes', 'customers', 'activity_logs');

-- List all policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('quotes', 'customers', 'activity_logs')
ORDER BY tablename, cmd;

-- Check organization_id indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('quotes', 'customers', 'activity_logs')
  AND indexdef LIKE '%organization_id%';
```

### Backend Snippets

**Supabase (always filter):**
```python
.eq("organization_id", str(user.current_organization_id))
```

**asyncpg (set context):**
```python
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    str(user.current_organization_id)
)
```

---

## Security Audit Workflow

When reviewing database changes:

1. **Check migration SQL**
   - [ ] Table has `organization_id` column (UUID, NOT NULL, FK)
   - [ ] Index exists on `organization_id`
   - [ ] RLS enabled with `ALTER TABLE ... ENABLE`
   - [ ] All 4 policies created (SELECT, INSERT, UPDATE, DELETE)

2. **Verify RLS policies**
   - [ ] Each policy checks `current_setting('app.current_organization_id')`
   - [ ] USING clause correct for SELECT/UPDATE/DELETE
   - [ ] WITH CHECK clause correct for INSERT/UPDATE

3. **Audit backend code**
   - [ ] All Supabase queries filter by organization_id
   - [ ] All asyncpg code sets RLS context before queries
   - [ ] No hardcoded organization IDs
   - [ ] Error handling for not found (404)

4. **Test organization isolation**
   - [ ] Manual SQL test passes
   - [ ] API endpoint test passes
   - [ ] Cross-organization access returns 404

---

**Last Updated:** 2025-10-29 21:15 UTC
**Purpose:** RLS security guardrails for database verification
**Maintenance:** Update when discovering new RLS patterns or edge cases
**Audience:** Security auditors, backend developers, code reviewers
