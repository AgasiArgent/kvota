# Database Migration Checklist

**Created:** 2025-10-29 22:15 UTC
**Purpose:** Step-by-step workflow for creating and verifying safe database migrations
**Scope:** New tables, schema changes, RLS policies, indexes
**Audience:** Backend developers, DevOps engineers

---

## Overview

**Goal:** Execute database migrations safely with zero data loss and guaranteed security (RLS policies).

**High-Level Process:**
1. **Design** - Plan migration with organization_id requirement
2. **Create** - Write migration SQL file with all components
3. **Verify** - Test migration in staging environment
4. **Rollback** - Create rollback script
5. **Document** - Update MIGRATIONS.md
6. **Backup** - Ensure backup exists before production deployment
7. **Execute** - Run migration in production with monitoring

**Time Estimate:** 30-45 minutes per migration (including testing)

---

## Step 1: Migration Design (Pre-Development)

Before writing SQL, answer these questions:

### Checklist
- [ ] **Table Purpose:** What is the table for? (e.g., "Track user activity for audit logs")
- [ ] **Organization Isolation:** Does this table contain tenant-specific data?
  - If YES → Must have `organization_id UUID NOT NULL REFERENCES organizations(id)`
  - If NO → Document why (rare case)
- [ ] **Security Model:** Who should access this data?
  - All organization members?
  - Specific roles only (admin, manager)?
  - Public read, private write?
- [ ] **Related Tables:** What tables does this depend on?
  - Identify foreign key relationships
  - Plan indexes for join columns
- [ ] **Indexes:** What columns will be filtered/sorted most often?
  - Always index: organization_id, created_at, status, foreign keys
- [ ] **Rollback Plan:** How will we undo this migration if something fails?
  - Drop table? Revert columns? Data recovery needed?

### Example Design
```
Table: quote_approvals
Purpose: Track quote approval workflow
Organization-specific: YES → must have organization_id
Security: Managers/Admins only (RLS policy on manager role)
Related tables: quotes (foreign key), users (approval history)
Indexes needed: quote_id, organization_id, created_at
Rollback: DROP TABLE quote_approvals (simple)
```

---

## Step 2: Create Migration File

### File Naming
```
backend/migrations/NNN_description.sql
```

**Rules:**
- NNN = Sequential number (001, 002, ..., 999)
- description = Lower-case, hyphenated (add_approval_table, rename_column_x)
- Example: `011_add_quote_approvals_table.sql`

### Full Migration Template

```sql
-- Migration: [Clear description of what this does]
-- Date: YYYY-MM-DD HH:MM UTC
-- Purpose: [One sentence explaining why]
-- Rollback: [How to undo this migration]

-- ============================================================================
-- STEP 1: Create table with organization_id column
-- ============================================================================

CREATE TABLE quote_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    approved_by UUID NOT NULL REFERENCES auth.users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'pending')),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: Create indexes for query performance
-- ============================================================================

-- Speed up filtering by organization (RLS queries use this)
CREATE INDEX idx_quote_approvals_organization_id
ON quote_approvals(organization_id);

-- Speed up finding approvals for a specific quote
CREATE INDEX idx_quote_approvals_quote_id
ON quote_approvals(quote_id);

-- Speed up filtering by status (common filter in UI)
CREATE INDEX idx_quote_approvals_status
ON quote_approvals(status);

-- Speed up finding latest approvals
CREATE INDEX idx_quote_approvals_created_at_desc
ON quote_approvals(created_at DESC);

-- Speed up finding approvals by user
CREATE INDEX idx_quote_approvals_approved_by
ON quote_approvals(approved_by);

-- ============================================================================
-- STEP 3: Enable Row-Level Security (RLS)
-- ============================================================================

ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS policies (SELECT, INSERT, UPDATE, DELETE)
-- ============================================================================

-- SELECT: Users can view approvals from their organization
CREATE POLICY "Users can view approvals in their organization"
ON quote_approvals FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- INSERT: Users can create approvals for their organization
CREATE POLICY "Users can insert approvals for their organization"
ON quote_approvals FOR INSERT
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- UPDATE: Users can modify approvals in their organization
CREATE POLICY "Users can update approvals in their organization"
ON quote_approvals FOR UPDATE
USING (organization_id = current_setting('app.current_organization_id')::uuid)
WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

-- DELETE: Users can delete approvals in their organization
CREATE POLICY "Users can delete approvals in their organization"
ON quote_approvals FOR DELETE
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- ============================================================================
-- STEP 5: Add updated_at trigger (for tracking changes)
-- ============================================================================

CREATE TRIGGER update_quote_approvals_updated_at
BEFORE UPDATE ON quote_approvals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: Verification queries (run after migration)
-- ============================================================================

-- Verify table created
-- SELECT tablename FROM pg_tables WHERE tablename = 'quote_approvals';
-- Expected: 1 row (quote_approvals)

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'quote_approvals';
-- Expected: quote_approvals | true

-- Verify 4 policies created
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'quote_approvals' ORDER BY cmd;
-- Expected: 4 rows (SELECT, INSERT, UPDATE, DELETE)

-- Verify indexes created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'quote_approvals';
-- Expected: 6 rows (5 explicit + 1 primary key)
```

### Key Components Explained

**1. Organization Isolation**
```sql
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
```
- **NOT NULL:** Every row MUST belong to an organization
- **REFERENCES organizations(id):** Foreign key constraint (referential integrity)
- **ON DELETE CASCADE:** If organization deleted, cascade delete this row

**2. Timestamps**
```sql
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```
- Always include both for audit trail
- WITH TIME ZONE prevents timezone confusion
- DEFAULT NOW() auto-sets current time

**3. Foreign Keys**
```sql
quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
approved_by UUID NOT NULL REFERENCES auth.users(id)
```
- Use CASCADE for parent-child relationships
- Use RESTRICT for lookup tables (prevent orphaned data)

**4. CHECK Constraints**
```sql
status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'pending'))
```
- Prevents invalid values at database level
- Reduces frontend validation burden

**5. Indexes**
```sql
CREATE INDEX idx_quote_approvals_quote_id ON quote_approvals(quote_id);
```
- Naming: `idx_{table_name}_{column_name}`
- Always index: organization_id, created_at, foreign keys
- Index sorted columns: `CREATE INDEX ... ON table(created_at DESC)`

**6. RLS Policies**
```sql
CREATE POLICY "Users can view approvals in their organization"
ON quote_approvals FOR SELECT
USING (organization_id = current_setting('app.current_organization_id')::uuid);
```
- One policy per operation (SELECT, INSERT, UPDATE, DELETE)
- Descriptive names including operation type
- Must match backend RLS context setting

---

## Step 3: Verification Queries

Run these in Supabase SQL Editor after migration.

### SQL Verification Script

```sql
-- ============================================================================
-- RLS VERIFICATION FOR: quote_approvals
-- ============================================================================

-- 1. CHECK: Table exists
SELECT tablename FROM pg_tables WHERE tablename = 'quote_approvals';
-- Expected: 1 row

-- 2. CHECK: RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'quote_approvals';
-- Expected: quote_approvals | true

-- 3. CHECK: Columns exist with correct types
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'quote_approvals'
ORDER BY ordinal_position;
-- Expected: organization_id (UUID, NO), quote_id (UUID, NO), status (TEXT, NO), etc.

-- 4. CHECK: All 4 RLS policies created
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'quote_approvals'
ORDER BY cmd;
-- Expected: 4 rows (SELECT, INSERT, UPDATE, DELETE)

-- 5. CHECK: Indexes created
SELECT indexname FROM pg_indexes
WHERE tablename = 'quote_approvals'
ORDER BY indexname;
-- Expected: 6 rows (5 explicit + 1 primary key)

-- 6. CHECK: Foreign key constraints
SELECT constraint_name, column_name, foreign_table_name
FROM information_schema.key_column_usage
WHERE table_name = 'quote_approvals' AND foreign_table_name IS NOT NULL
ORDER BY constraint_name;
-- Expected: quote_id → quotes, approved_by → auth.users, organization_id → organizations

-- ============================================================================
-- SECURITY VERIFICATION (RLS ISOLATION TEST)
-- ============================================================================

-- Create test organizations
INSERT INTO organizations (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Org B');

-- Test user (replace with real user IDs if needed)
-- Note: auth.users must already exist

-- Create test data for Org A
INSERT INTO quote_approvals (id, organization_id, quote_id, approved_by, status)
VALUES (
  gen_random_uuid(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',  -- Must exist in quotes table
  '99999999-9999-9999-9999-999999999999',  -- Must exist in auth.users
  'approved'
);

-- Create test data for Org B
INSERT INTO quote_approvals (id, organization_id, quote_id, approved_by, status)
VALUES (
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  '99999999-9999-9999-9999-999999999999',
  'rejected'
);

-- Test 1: Org A can see Org A's data
SET app.current_organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT COUNT(*) FROM quote_approvals;
-- Expected: 1 (only Org A's record)

-- Test 2: Org B can see Org B's data
SET app.current_organization_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT COUNT(*) FROM quote_approvals;
-- Expected: 1 (only Org B's record)

-- Test 3: No context returns 0 rows (fail-safe)
RESET app.current_organization_id;
SELECT COUNT(*) FROM quote_approvals;
-- Expected: 0 (RLS blocks access)

-- Cleanup
DELETE FROM quote_approvals
WHERE organization_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
DELETE FROM organizations WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
```

### Expected Results

| Check | Query | Expected Result |
|-------|-------|-----------------|
| Table exists | `SELECT tablename` | 1 row: quote_approvals |
| RLS enabled | `SELECT rowsecurity` | true |
| 4 policies | `SELECT cmd FROM pg_policies` | 4 rows: SELECT, INSERT, UPDATE, DELETE |
| Indexes | `SELECT indexname` | 6 rows (5 custom + 1 PK) |
| Foreign keys | `SELECT constraint_name` | 3 rows: quote_id, approved_by, organization_id |
| Org A isolation | Context set to Org A | 1 row (Org A's data only) |
| Org B isolation | Context set to Org B | 1 row (Org B's data only) |
| No context | Context reset | 0 rows (blocked by RLS) |

---

## Step 4: Create Rollback Script

Before executing migration in production, create rollback script.

### File Naming
```
backend/migrations/ROLLBACK_NNN_description.sql
```

Example: `ROLLBACK_011_add_quote_approvals_table.sql`

### Rollback Template

```sql
-- ROLLBACK: Removes quote_approvals table
-- Date: 2025-10-29 22:15 UTC
-- Reason for rollback: [Specify if migration caused issues]

-- Check if table exists before dropping
DROP TABLE IF EXISTS quote_approvals CASCADE;

-- Verify table is gone
-- SELECT tablename FROM pg_tables WHERE tablename = 'quote_approvals';
-- Expected: 0 rows
```

### Rollback Strategies

**Strategy 1: Full Table Rollback (Simple)**
```sql
DROP TABLE IF EXISTS quote_approvals CASCADE;
```
Use when: New table (no data loss), or data can be recreated

**Strategy 2: Column Rollback (Data Preservation)**
```sql
ALTER TABLE quotes DROP COLUMN IF EXISTS approval_status CASCADE;
ALTER TABLE quotes DROP COLUMN IF EXISTS approved_at CASCADE;
```
Use when: Adding columns to existing table, data should be kept

**Strategy 3: Index/Policy Rollback (Partial)**
```sql
DROP POLICY IF EXISTS "Users can view approvals" ON quote_approvals;
DROP INDEX IF EXISTS idx_quote_approvals_organization_id;
```
Use when: Only fixing policies or indexes

**Strategy 4: Data + Schema Rollback (Complex)**
```sql
-- Backup data to separate table first
CREATE TABLE quote_approvals_backup AS SELECT * FROM quote_approvals;

-- Then drop
DROP TABLE IF EXISTS quote_approvals CASCADE;

-- Manual restore if needed:
-- INSERT INTO quote_approvals SELECT * FROM quote_approvals_backup;
-- DROP TABLE quote_approvals_backup;
```
Use when: Critical data must be preserved

---

## Step 5: Documentation Update

### Update MIGRATIONS.md

Add entry to `/home/novi/quotation-app-dev/backend/migrations/MIGRATIONS.md`:

```markdown
## Migration 011: Add Quote Approvals Table

**Date:** 2025-10-29 22:15 UTC
**Status:** [PLANNED / TESTING / DEPLOYED]
**Author:** [Your name]

### Purpose
Track quote approval workflow for manager/admin review before sending to client.

### Changes
- **New Table:** quote_approvals (tracks approvals + rejections)
- **Columns Added:** 6 (id, quote_id, approved_by, organization_id, status, comment, created_at, updated_at)
- **Indexes Added:** 5 (organization_id, quote_id, status, created_at, approved_by)
- **RLS Policies:** 4 (SELECT, INSERT, UPDATE, DELETE for organization isolation)

### Schema
```sql
CREATE TABLE quote_approvals (
    id UUID PRIMARY KEY,
    quote_id UUID REFERENCES quotes(id),
    approved_by UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id),
    status TEXT CHECK (status IN ('approved', 'rejected', 'pending')),
    comment TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Security Verification
- RLS enabled: YES
- 4 policies created: YES (SELECT, INSERT, UPDATE, DELETE)
- organization_id filtering: YES
- Cross-org isolation tested: YES

### Rollback
```sql
DROP TABLE IF EXISTS quote_approvals CASCADE;
```

### Testing Notes
- [Date] Verified RLS isolation between test orgs ✓
- [Date] Verified all 4 policies created ✓
- [Date] Verified indexes exist ✓
- [Date] Verified foreign key constraints ✓

### Related Files
- Migration file: `backend/migrations/011_add_quote_approvals_table.sql`
- Rollback file: `backend/migrations/ROLLBACK_011_add_quote_approvals_table.sql`
- Backend routes: `backend/routes/quotes_approval.py` (to be created)
```

---

## Step 6: Backup & Disaster Recovery

### Pre-Migration Checklist

Before running migration in production:

- [ ] **Database Backup Exists**
  ```bash
  # Verify backup in Supabase dashboard
  # Settings → Backups → Check latest backup date/time
  # Should be within last 24 hours
  ```

- [ ] **Backup is Restorable**
  ```bash
  # Test restore on staging environment
  # Don't skip this step!
  ```

- [ ] **Migration Tested in Staging**
  ```bash
  # Run full migration verification script
  # All checks must PASS
  ```

- [ ] **Rollback Script Prepared**
  ```bash
  # Rollback SQL ready to execute
  # Tested on copy of production database
  ```

- [ ] **Team Notified**
  - Slack message: "Starting migration X at Y time"
  - Maintenance window scheduled (if needed)
  - On-call engineer available

- [ ] **Monitoring Active**
  - Database metrics dashboard visible
  - Error logs being monitored
  - Team on call during/after migration

### Disaster Recovery Procedure

If migration fails:

1. **Stop the Migration**
   ```bash
   # Cancel any running queries
   # Do NOT retry until root cause identified
   ```

2. **Assess Damage**
   ```sql
   -- Check table status
   SELECT tablename FROM pg_tables WHERE tablename = 'quote_approvals';

   -- Check data integrity
   SELECT COUNT(*) FROM quotes;  -- Should match pre-migration count
   ```

3. **Execute Rollback** (if needed)
   ```bash
   # Open Supabase SQL Editor
   # Paste rollback script
   # Execute (takes seconds)
   ```

4. **Verify Rollback**
   ```sql
   -- Run verification queries
   -- Should show pre-migration state
   ```

5. **Restore from Backup** (if rollback doesn't work)
   ```bash
   # Go to Supabase dashboard
   # Settings → Backups → Restore point-in-time
   # Select backup before migration time
   # Confirm restore (takes 5-15 minutes)
   ```

6. **Post-Mortem**
   - Document what failed
   - Identify root cause
   - Update migration for retry
   - Schedule re-attempt after fix

---

## Step 7: Production Deployment

### Pre-Deployment Checklist (Final)

- [ ] Migration file reviewed by 2+ team members
- [ ] Rollback script tested and ready
- [ ] Database backup completed successfully
- [ ] Staging tests PASSED (all verification queries)
- [ ] Backend code ready (routes/approvals.py prepared)
- [ ] Frontend code ready (if UI changes)
- [ ] Documentation updated (MIGRATIONS.md)
- [ ] Team notified of maintenance window

### Deployment Steps

**Step 1: Take Backup** (Supabase Dashboard)
```
Settings → Backups → Request Backup
Wait for completion (2-5 minutes)
Note backup ID and timestamp
```

**Step 2: Execute Migration** (Supabase SQL Editor)
```
1. Open Supabase SQL Editor
2. Paste entire migration SQL
3. Review syntax (no obvious errors)
4. Execute (click Run)
5. Wait for completion (usually < 1 minute)
```

**Step 3: Run Verification Queries** (same SQL Editor)
```
1. Paste verification script
2. Execute all checks
3. Verify all results match expected
4. Document results with timestamp
```

**Step 4: Test Backend Endpoints** (if applicable)
```bash
# Start backend server
cd backend
uvicorn main:app --reload

# Test new endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/approvals

# Verify organization isolation
# Test with 2 different org tokens
# Each should only see their own data
```

**Step 5: Notify Team**
```
Slack message: "✓ Migration 011 deployed successfully"
- Table: quote_approvals (new)
- RLS verified
- All tests passing
- Ready for feature development
```

### Post-Deployment Monitoring

For first 24 hours:
- [ ] Monitor database metrics (CPU, connections, queries)
- [ ] Watch error logs for RLS-related errors
- [ ] Verify no data leaks between organizations
- [ ] Check query performance (RLS doesn't slow queries)

---

## Common Pitfalls & Solutions

### Pitfall 1: Missing organization_id Column

**Problem:**
```
ERROR: column "organization_id" does not exist
```

**Solution:**
```sql
-- Add column before enabling RLS
ALTER TABLE your_table
ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id);

-- Then enable RLS
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

---

### Pitfall 2: RLS Enabled But Policies Not Created

**Problem:**
```
ERROR: new row violates row-level security policy for table
```

**Solution:**
```sql
-- Check if policies exist
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- If empty, create all 4 policies
-- See RLS Policy Template above
```

---

### Pitfall 3: Foreign Key Constraint Violation

**Problem:**
```
ERROR: insert or update on table violates foreign key constraint
```

**Solution:**
```sql
-- Verify referenced row exists
SELECT * FROM quotes WHERE id = '11111111-1111-1111-1111-111111111111';

-- If empty, create reference first
INSERT INTO quotes (...) VALUES (...);

-- Then retry migration
```

---

### Pitfall 4: Migration Takes Too Long

**Problem:**
```
QUERY PLAN: Full table scan on table with 1M rows
(Takes > 5 minutes)
```

**Solution:**
```sql
-- Add CONCURRENTLY to avoid locking
CREATE INDEX CONCURRENTLY idx_new ON large_table(column);

-- Or drop old index first (if replacing)
DROP INDEX CONCURRENTLY old_index;
```

---

### Pitfall 5: Rollback Doesn't Work

**Problem:**
```
ERROR: cannot drop table X because other objects depend on it
```

**Solution:**
```sql
-- Use CASCADE to drop dependent objects
DROP TABLE IF EXISTS your_table CASCADE;

-- Then verify cleanup
SELECT tablename FROM pg_tables WHERE tablename = 'your_table';
-- Expected: 0 rows
```

---

## Quick Reference Checklist

### Pre-Migration
- [ ] Design document completed
- [ ] Migration SQL written
- [ ] Rollback script created
- [ ] All verification queries prepared
- [ ] MIGRATIONS.md updated
- [ ] Team review completed (2+ people)

### Testing Phase
- [ ] Verification queries PASSED
- [ ] RLS isolation tested
- [ ] Foreign keys tested
- [ ] Rollback tested on staging

### Deployment
- [ ] Database backup completed
- [ ] Migration executed in production
- [ ] Verification queries PASSED
- [ ] Team notified
- [ ] Monitoring active

### Post-Deployment
- [ ] 24-hour monitoring completed
- [ ] No errors in logs
- [ ] No data leaks detected
- [ ] Mark migration as DEPLOYED in MIGRATIONS.md

---

## Related Documentation

- **RLS_CHECKLIST.md** - Detailed RLS policy guide
- **backend/CLAUDE.md** - Migration patterns and examples
- **backend/migrations/MIGRATIONS.md** - Historical migration log
- **Supabase Docs** - PostgreSQL schema management

---

**Last Updated:** 2025-10-29 22:15 UTC
**Scope:** 7-step migration workflow with RLS verification
**Time to Complete:** 30-45 minutes per migration
**Verification Queries:** 8 (schema + RLS + isolation tests)
**Rollback Strategies:** 4 (simple, partial, column, data+schema)
