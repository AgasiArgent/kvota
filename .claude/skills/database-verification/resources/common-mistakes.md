# Common Database Mistakes & Prevention Guide

**Created:** 2025-10-29 22:15 UTC
**Purpose:** Extract common RLS, multi-tenant, and database mistakes from project history
**Source:** RLS_CHECKLIST.md + COMMON_GOTCHAS.md (41 tracked bugs, 6 sessions)
**Target:** Backend developers implementing database features
**Usage:** Read before writing database migrations or Supabase queries

---

## Critical Mistakes (Will Break Production)

### Mistake 1: Missing organization_id Column

**Symptom:** RLS policies fail to create, data leaks between organizations

**Root Cause:** Forgot to add `organization_id` column before enabling RLS

**Wrong Pattern:**
```sql
-- ❌ Missing organization_id
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  customer_name TEXT,
  amount DECIMAL
);
-- RLS policies can't be created - no organization_id to filter by
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;  -- What do we filter on?
```

**Correct Pattern:**
```sql
-- ✅ Add organization_id FIRST
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_name TEXT,
  amount DECIMAL
);

-- THEN enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
```

**Impact:** Multi-tenant isolation fails silently. All organizations see each other's data. Critical security breach.

**Real Bug:** Common pattern across Session 28-33 (multiple tables created without proper organization isolation)

---

### Mistake 2: RLS Enabled But No Policies Created

**Symptom:** Table returns 0 rows for all queries, queries fail with "permission denied"

**Root Cause:** Enabled RLS but forgot to create policies

**Wrong Pattern:**
```sql
-- ❌ RLS enabled but no policies
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
-- Now ALL queries are blocked (no policies to allow access)
SELECT * FROM quotes;  -- Returns 0 rows (permission denied)
```

**Correct Pattern:**
```sql
-- ✅ Enable RLS THEN create policies
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Create policies for all operations
CREATE POLICY "Users can view their organization's quotes"
ON quotes FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can insert quotes for their organization"
ON quotes FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can update their organization's quotes"
ON quotes FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can delete their organization's quotes"
ON quotes FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Impact:** Users cannot read or modify data. Feature completely broken.

**Real Bug:** BUG-007 from Session 33 - Missing policies on multiple tables

---

### Mistake 3: Missing Policy Type (Only SELECT, No INSERT/UPDATE/DELETE)

**Symptom:** Users can read data but cannot create, edit, or delete records

**Root Cause:** Created only SELECT policy, forgot INSERT/UPDATE/DELETE

**Wrong Pattern:**
```sql
-- ❌ Only SELECT policy
CREATE POLICY "Users can view their quotes"
ON quotes FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- INSERT, UPDATE, DELETE are blocked (no policies)
INSERT INTO quotes (...) VALUES (...);  -- Fails: permission denied
UPDATE quotes SET ... WHERE ...;         -- Fails: permission denied
DELETE FROM quotes WHERE ...;            -- Fails: permission denied
```

**Correct Pattern:**
```sql
-- ✅ Create all 4 policies
-- SELECT
CREATE POLICY "Select policy" ON quotes FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- INSERT
CREATE POLICY "Insert policy" ON quotes FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- UPDATE (need both USING and WITH CHECK)
CREATE POLICY "Update policy" ON quotes FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- DELETE
CREATE POLICY "Delete policy" ON quotes FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Verification:**
```sql
-- Check all 4 policies exist
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'quotes'
ORDER BY cmd;
-- Should show: SELECT, INSERT, UPDATE, DELETE
```

**Impact:** Create/edit/delete workflows completely blocked.

---

### Mistake 4: Wrong RLS Context Setting (asyncpg)

**Symptom:** Queries return 0 rows, RLS policy fails silently

**Root Cause:** Config variable name doesn't match policy condition

**Wrong Pattern:**
```python
# ❌ Config variable name mismatch
await conn.execute(
    "SELECT set_config('organization_id', $1, true)",  # Wrong name!
    str(user.current_organization_id)
)
# Policy checks 'app.current_organization_id', not 'organization_id'
rows = await conn.fetch("SELECT * FROM quotes")  # Returns 0 rows
```

**Correct Pattern:**
```python
# ✅ Match config variable name exactly
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",  # Matches policy!
    str(user.current_organization_id)
)
rows = await conn.fetch("SELECT * FROM quotes")  # Returns rows ✅
```

**Matching Convention:**
```
Policy uses:     current_setting('app.current_organization_id')
Code should set: set_config('app.current_organization_id', $1, true)
                 ↑ Must match exactly!
```

**Impact:** Queries mysteriously return 0 rows, making feature appear broken while RLS works correctly.

**Real Bug:** Session 28 - Multiple asyncpg queries returning no results due to config mismatch

---

### Mistake 5: Service Role Key Bypasses RLS (Supabase Client)

**Symptom:** Queries return all organizations' data, multi-tenant isolation completely broken

**Root Cause:** Supabase service role key has BYPASSRLS permission

**Wrong Pattern:**
```python
# ❌ CRITICAL: Service role bypasses RLS, returns all orgs' data
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # ← BYPASSRLS role!
)

# This returns ALL organizations' quotes (not just user's org)
quotes = supabase.table("quotes").select("*").execute()
return quotes.data  # ❌ Data leak: Organization A sees Organization B's quotes
```

**Correct Pattern:**
```python
# ✅ Manually filter by organization_id
quotes = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()
return quotes.data  # ✅ Only current org's quotes
```

**Why?** Supabase service role key bypasses ALL RLS policies. RLS only works with non-service-role users.

**Critical Rule:** When using Supabase client with service role key, **YOU MUST MANUALLY FILTER BY organization_id**. RLS provides NO protection.

**Impact:** 🔴 **CRITICAL SECURITY BREACH** - Complete multi-tenant isolation failure, data exposed across organizations, GDPR violations

**Real Bug:** BUG-001 from Session 33 - Quote list exposed all organizations' data (CRITICAL)

---

## High-Priority Mistakes (Break UX/Performance)

### Mistake 6: Missing Index on organization_id Column

**Symptom:** Queries slow down dramatically as data grows, dashboard loads in 10+ seconds

**Root Cause:** RLS filters by organization_id on every query, but no index to speed up lookup

**Wrong Pattern:**
```sql
-- ❌ No index = full table scan on every query
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  data JSONB
);
-- With 100k quotes, finding 50 org-specific quotes requires scanning ALL 100k rows
```

**Correct Pattern:**
```sql
-- ✅ Create index for fast filtering
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  data JSONB
);

-- Add index IMMEDIATELY
CREATE INDEX idx_quotes_organization_id
ON quotes(organization_id);

-- Now finding 50 org-specific quotes is instant (milliseconds)
```

**Impact:** Performance degrades as data grows. Dashboard queries slow from 100ms to 5+ seconds.

**Real Bug:** Multiple tables lacked indexes (discovered during Session 26 performance audit)

**Naming Convention:** `idx_{table_name}_{column_name}`

---

### Mistake 7: Missing organization_id Filter in Supabase Queries

**Symptom:** Quotes list shows all organizations' data, customers list shows all customers

**Root Cause:** Forgot `.eq("organization_id", user.organization_id)` filter

**Wrong Pattern:**
```python
# ❌ No organization filter
quotes = supabase.table("quotes").select("*").execute()
# Returns ALL organizations' quotes

customers = supabase.table("customers").select("*").execute()
# Returns ALL organizations' customers
```

**Correct Pattern:**
```python
# ✅ Always include organization filter
quotes = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()

customers = supabase.table("customers") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()
```

**Critical Note:** UUIDs must be converted to strings using `str()` when using Supabase client. Passing UUID objects causes silent query failures.

**Impact:** Users see competitors' data, multi-tenant isolation fails silently

**Real Bug:** BUG-001 from Session 33 - Quote list exposed all organizations' data (CRITICAL)

---

### Mistake 8: Missing Nested SELECT for Related Objects

**Symptom:** Quote detail page shows customer_id UUID instead of customer name, export uses wrong customer info

**Root Cause:** Didn't use nested select syntax to fetch related customer data

**Wrong Pattern:**
```python
# ❌ Returns only customer_id, not customer object
quote = supabase.table("quotes") \
    .select("*") \
    .eq("id", quote_id) \
    .single() \
    .execute()

# quote.data.customer_id = "550e8400-e29b-41d4-a716-446655440000"
# quote.data.customer = undefined ❌
```

**Correct Pattern:**
```python
# ✅ Use nested select to fetch customer details
quote = supabase.table("quotes") \
    .select("*, customer:customers(id, name, email, inn)") \
    .eq("id", quote_id) \
    .single() \
    .execute()

# quote.data.customer = {
#   id: "550e8400-e29b-41d4-a716-446655440000",
#   name: "Компания А",
#   email: "contact@companya.ru",
#   inn: "7701234567"
# } ✅
```

**Syntax Pattern:**
```
.select("*, related_table:table_name(field1, field2, field3)")
           ↑                  ↑           ↑
        alias             table name    fields to include
```

**Impact:** Blank customer names in quotes, export files show wrong customer info, broken review workflow

**Real Bug:** BUG-001 from Session 33 - Customer field blank on quote detail page (NOT FIXED)

---

## Database Design Mistakes

### Mistake 9: Not Adding Foreign Key Constraint

**Symptom:** Orphaned records (customer deleted, quotes still reference customer_id)

**Wrong Pattern:**
```sql
-- ❌ No foreign key constraint
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  organization_id UUID,  -- Missing REFERENCES
  customer_id UUID       -- Missing REFERENCES
);
-- Now you can insert quote with customer_id=999 that doesn't exist
```

**Correct Pattern:**
```sql
-- ✅ All relationships have constraints
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID NOT NULL REFERENCES customers(id)
);
-- Now you CANNOT create quote with non-existent customer_id
```

**Impact:** Data integrity broken, orphaned records cause bugs in exports and reports

---

### Mistake 10: Not Making organization_id NOT NULL

**Symptom:** Some records have no organization, breaking RLS filters

**Wrong Pattern:**
```sql
-- ❌ organization_id is nullable
ALTER TABLE quotes ADD COLUMN organization_id UUID;
-- Some records have NULL organization_id
-- RLS filter DOESN'T WORK: NULL != any org_id
```

**Correct Pattern:**
```sql
-- ✅ organization_id is required
ALTER TABLE quotes
ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);
-- Every record belongs to exactly one organization
```

**Impact:** RLS policies fail for NULL records, multi-tenant isolation breaks

---

## RLS Verification Checklist

After creating a table, run these verification queries:

```sql
-- 1. Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'your_table';
-- Expected: rowsecurity = true

-- 2. List all policies
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'your_table'
ORDER BY cmd;
-- Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- 3. Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'your_table'
AND indexdef LIKE '%organization_id%';
-- Expected: At least one index on organization_id

-- 4. Test isolation
SET app.current_organization_id = '11111111-1111-1111-1111-111111111111';
SELECT COUNT(*) FROM your_table;
-- Expected: Only rows for that organization

RESET app.current_organization_id;
SELECT COUNT(*) FROM your_table;
-- Expected: 0 rows or ERROR (RLS blocking access)
```

---

## Prevention Checklist for New Tables

When creating a new table:

- [ ] **Step 1:** Add `organization_id UUID NOT NULL REFERENCES organizations(id)`
- [ ] **Step 2:** Create index: `CREATE INDEX idx_{table}_{column} ON {table}(organization_id)`
- [ ] **Step 3:** Enable RLS: `ALTER TABLE {table} ENABLE ROW LEVEL SECURITY`
- [ ] **Step 4:** Create SELECT policy with `USING (organization_id = current_setting(...))`
- [ ] **Step 5:** Create INSERT policy with `WITH CHECK (organization_id = current_setting(...))`
- [ ] **Step 6:** Create UPDATE policy with both `USING` and `WITH CHECK`
- [ ] **Step 7:** Create DELETE policy with `USING (organization_id = current_setting(...))`
- [ ] **Step 8:** Run verification queries
- [ ] **Step 9:** Test with backend code (asyncpg context setting or Supabase filter)
- [ ] **Step 10:** Test with different organizations (verify isolation)

**Time estimate:** 20-30 minutes per table

---

## Quick Reference

### Backend Query Patterns

**Supabase Client (always filter manually):**
```python
result = supabase.table("table_name") \
    .select("*") \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()
```

**asyncpg (set context, then query):**
```python
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    str(user.current_organization_id)
)
rows = await conn.fetch("SELECT * FROM table_name")
```

### Policy Template

```sql
CREATE POLICY "policy_name" ON table_name FOR operation_type
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);
```

### Common Config Variable Names

- Supabase asyncpg context: `app.current_organization_id`
- Policy condition: `current_setting('app.current_organization_id')`
- Backend code: `str(user.current_organization_id)`

---

## Related Documentation

- **RLS_CHECKLIST.md** - Complete RLS templates and testing guide
- **COMMON_GOTCHAS.md** - 18 patterns to avoid (includes 5 database mistakes)
- **MASTER_BUG_INVENTORY.md** - All 41 tracked bugs with details
- **backend/CLAUDE.md** - Backend implementation patterns

---

**Last Updated:** 2025-10-29 22:15 UTC
**Critical Mistakes:** 5
**High-Priority:** 3
**Design Patterns:** 2
**Sources:** 41 tracked bugs from Sessions 28-33
**Maintenance:** Update when discovering new patterns
