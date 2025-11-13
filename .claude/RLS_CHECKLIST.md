# RLS (Row-Level Security) Checklist

**Created:** 2025-10-29 20:55 UTC
**Purpose:** Multi-tenant security verification for PostgreSQL tables
**Source:** backend/CLAUDE.md + backend/migrations/*.sql
**Usage:** Copy-paste templates when creating new tables or migrations

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

**Real Bug:** Common pattern - Missing organization_id filter in queries (see COMMON_GOTCHAS.md #1)

---

## RLS Policy Template

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

**Use template from "RLS Policy Template" section above.**

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

## Migration Checklist

When creating a database migration with new table:

- [ ] **Column:** Add `organization_id UUID NOT NULL REFERENCES organizations(id)`
- [ ] **Index:** Create index on `organization_id` for performance
- [ ] **RLS:** Enable RLS with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] **Policies:** Create all 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] **Verify:** Run verification SQL queries in Supabase dashboard
- [ ] **Test:** Insert test row, verify isolation between organizations
- [ ] **Document:** Add migration to `backend/migrations/MIGRATIONS.md`
- [ ] **Code:** Update Supabase queries to always filter by `organization_id`
- [ ] **Backend:** Test endpoints with users from different organizations
- [ ] **Frontend:** Verify UI only shows organization's data

**Time estimate:** 15-20 minutes per table (including testing)

---

## Backend Code Checklist

### Pattern 1: Supabase Client Queries (Preferred)

```python
# ✅ CORRECT: Always filter by organization_id
result = supabase.table("your_table") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()
```

```python
# ❌ WRONG: Missing organization_id filter
result = supabase.table("your_table") \
    .select("*") \
    .execute()
# Returns ALL organizations' data (RLS bypassed with service role key)
```

**Key Point:** Supabase service role key BYPASSES RLS. You MUST manually filter by `organization_id`.

**⚠️ UUID Conversion Required:** Always convert UUIDs to strings using `str()` when using the Supabase client. The client doesn't automatically serialize UUID objects, causing silent query failures. Example: `.eq("organization_id", str(user.current_organization_id))`

---

### Pattern 2: asyncpg with RLS Context

```python
import asyncpg
import os

# Connect to database
conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

# Set RLS context (CRITICAL: Do this BEFORE any queries)
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    str(user.current_organization_id)
)

# Now queries respect RLS policies automatically
rows = await conn.fetch("SELECT * FROM your_table")
# Only returns rows matching user's organization

await conn.close()
```

**Key Steps:**
1. Connect to database via `asyncpg.connect()`
2. Set `app.current_organization_id` config variable
3. Run queries (RLS policies apply automatically)
4. Close connection

**Common Mistake:** Forgetting step 2 → RLS policies fail, query returns 0 rows

---

### Helper Function Pattern

```python
async def set_rls_context(conn, user):
    """Set RLS context for user's organization"""
    await conn.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(user.current_organization_id)
    )

async def get_db_connection():
    """Get database connection"""
    return await asyncpg.connect(os.getenv("DATABASE_URL"))

# Usage in endpoint
@router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        stats = await conn.fetchrow("SELECT COUNT(*) FROM your_table")
        return {"count": stats['count']}
    finally:
        await conn.close()
```

**Benefits:**
- Reusable helper functions
- Consistent RLS context setting
- Proper connection cleanup with try/finally

---

## Common RLS Bugs

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

**Fix:** Create missing policies using template

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

---

## Testing RLS

### Manual Testing (Supabase Dashboard SQL)

```sql
-- Test 1: Create test organizations and data
INSERT INTO organizations (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Org A'),
  ('22222222-2222-2222-2222-222222222222', 'Org B');

INSERT INTO your_table (id, organization_id, name) VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Record A1'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'Record A2'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Record B1');

-- Test 2: Set context to Org A
SET app.current_organization_id = '11111111-1111-1111-1111-111111111111';
SELECT * FROM your_table;
-- Expected: Only "Record A1" and "Record A2"

-- Test 3: Set context to Org B
SET app.current_organization_id = '22222222-2222-2222-2222-222222222222';
SELECT * FROM your_table;
-- Expected: Only "Record B1"

-- Test 4: No context
RESET app.current_organization_id;
SELECT * FROM your_table;
-- Expected: 0 rows or ERROR

-- Cleanup
DELETE FROM your_table WHERE organization_id IN (
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
- ✅ Cross-organization isolation confirmed

---

### Automated Testing (pytest)

```python
# backend/tests/test_rls_your_table.py

import pytest
from uuid import uuid4

@pytest.mark.asyncio
async def test_rls_isolation_between_organizations(db_connection, test_org_a, test_org_b):
    """Test that organizations cannot see each other's data"""

    # Create test records
    record_a = await db_connection.fetchval("""
        INSERT INTO your_table (organization_id, name)
        VALUES ($1, $2)
        RETURNING id
    """, test_org_a.id, "Record A")

    record_b = await db_connection.fetchval("""
        INSERT INTO your_table (organization_id, name)
        VALUES ($1, $2)
        RETURNING id
    """, test_org_b.id, "Record B")

    # Set context to Org A
    await db_connection.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(test_org_a.id)
    )

    # Query should only return Org A's record
    rows = await db_connection.fetch("SELECT * FROM your_table")
    assert len(rows) == 1
    assert rows[0]['id'] == record_a
    assert rows[0]['name'] == "Record A"

    # Set context to Org B
    await db_connection.execute(
        "SELECT set_config('app.current_organization_id', $1, true)",
        str(test_org_b.id)
    )

    # Query should only return Org B's record
    rows = await db_connection.fetch("SELECT * FROM your_table")
    assert len(rows) == 1
    assert rows[0]['id'] == record_b
    assert rows[0]['name'] == "Record B"

    # Cleanup
    await db_connection.execute("DELETE FROM your_table WHERE id IN ($1, $2)", record_a, record_b)
```

**Test Coverage:**
- Create data for 2 organizations
- Verify isolation (each org sees only their data)
- Verify context switching works correctly
- Cleanup test data

---

## Advanced RLS Patterns

### Pattern 1: Admin-Only Rows

**Use Case:** Some rows visible only to admin/owner roles

```sql
-- Allow users to see their org's records OR admin-only records
CREATE POLICY "Users can view their org's records and admin records"
ON your_table FOR SELECT
USING (
  organization_id = current_setting('app.current_organization_id')::uuid
  OR is_admin_only = true
);
```

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

### Pattern 3: Public + Private Rows

**Use Case:** Some rows are public, others are organization-specific

```sql
-- Allow users to see public rows OR their org's private rows
CREATE POLICY "Users can view public and their org's records"
ON your_table FOR SELECT
USING (
  is_public = true
  OR organization_id = current_setting('app.current_organization_id')::uuid
);
```

---

## Quick Reference

### Verification Commands

```sql
-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'your_table';

-- List policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'your_table';

-- Check index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'your_table' AND indexdef LIKE '%organization_id%';
```

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

### Related Documentation

- **[COMMON_GOTCHAS.md](./COMMON_GOTCHAS.md)** - Bug #1 (Missing organization filter), Bug #7 (Missing RLS policies)
- **[backend/CLAUDE.md](../backend/CLAUDE.md)** - RLS context patterns, Supabase vs asyncpg
- **[backend/migrations/](../backend/migrations/)** - Real RLS policy examples
- **[backend/auth.py](../backend/auth.py)** - Authentication and organization context

---

## Migration Template (Complete Example)

```sql
-- Migration: Add activity_logs table with RLS
-- Date: 2025-10-29
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

**Copy this template for every new table in the system.**

---

**Last Updated:** 2025-10-29 20:55 UTC
**Policy Templates:** 4 (SELECT, INSERT, UPDATE, DELETE)
**Verification Queries:** 5 (RLS enabled, policies, index, test isolation)
**Common Bugs:** 5 (missing column, RLS not enabled, missing policy, wrong context, service role bypass)
**Maintenance:** Update when discovering new RLS patterns or edge cases
