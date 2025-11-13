# Database Verification Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29
**Type:** ⚠️ GUARDRAIL SKILL (Blocks until verified)
**Tech Stack:** Supabase PostgreSQL, RLS, Multi-tenant architecture

---

## ⚠️ What is a Guardrail Skill?

**This skill BLOCKS dangerous database operations until verified.**

**How it works:**
1. You create/modify database schema
2. Skill automatically activates and shows RLS checklist
3. **PAUSES before executing migration**
4. Asks user: "Have you verified all checklist items?"
5. **Only proceeds after explicit user confirmation**

**Why:** Prevents catastrophic security failures (RLS bypasses, data leaks across organizations).

**Critical blockers:**
- 🔴 Missing `organization_id` column
- 🔴 RLS enabled but no policies
- 🔴 Service role operations without RLS context
- 🔴 Missing policy types (SELECT only, no INSERT/UPDATE/DELETE)

---

## When This Skill Applies

**Auto-activates when:**
- Creating/modifying migrations in `backend/migrations/**/*.sql`
- Working with schema changes
- Adding/modifying tables or columns
- User mentions: "migration", "schema", "table", "column", "RLS", "database"

**Does NOT apply to:**
- Data queries (SELECT/INSERT/UPDATE/DELETE on existing tables)
- Application code changes
- Frontend development

---

## 🔴 CRITICAL: RLS Verification Checklist

**Before executing ANY migration, verify ALL 9 items:**

### Required for Every New Table:

- [ ] **1. organization_id column added**
  ```sql
  organization_id UUID NOT NULL REFERENCES organizations(id)
  ```

- [ ] **2. Index on organization_id**
  ```sql
  CREATE INDEX idx_[table]_organization ON [table](organization_id);
  ```

- [ ] **3. RLS enabled**
  ```sql
  ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
  ```

- [ ] **4. SELECT policy created**
  ```sql
  CREATE POLICY "[table]_select_policy" ON [table]
  FOR SELECT USING (organization_id = current_organization_id());
  ```

- [ ] **5. INSERT policy created**
  ```sql
  CREATE POLICY "[table]_insert_policy" ON [table]
  FOR INSERT WITH CHECK (organization_id = current_organization_id());
  ```

- [ ] **6. UPDATE policy created**
  ```sql
  CREATE POLICY "[table]_update_policy" ON [table]
  FOR UPDATE USING (organization_id = current_organization_id());
  ```

- [ ] **7. DELETE policy created**
  ```sql
  CREATE POLICY "[table]_delete_policy" ON [table]
  FOR DELETE USING (organization_id = current_organization_id());
  ```

- [ ] **8. Helper function exists**
  ```sql
  CREATE OR REPLACE FUNCTION current_organization_id()
  RETURNS UUID AS $$
    SELECT (current_setting('app.current_organization_id', true))::uuid;
  $$ LANGUAGE SQL STABLE;
  ```

- [ ] **9. RLS tested with multiple organizations**
  - Verified data isolation between orgs
  - Tested all CRUD operations
  - Confirmed service role sets context

**See:** `resources/rls-patterns.md` for complete RLS implementation guide

---

## Schema Standards Quick Reference

### Required Columns (4 mandatory for all tables):

```sql
CREATE TABLE [table_name] (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    organization_id UUID NOT NULL REFERENCES organizations(id)
);
```

**Additional common patterns:**
- `created_by UUID` - User who created record
- `updated_by UUID` - User who last updated record
- `deleted_at TIMESTAMP WITH TIME ZONE` - Soft delete timestamp

**See:** `resources/schema-standards.md` for complete standards

### Column Naming Conventions

**Follow these rules:**
- Use `snake_case` for all column names
- Boolean columns: `is_*` or `has_*` prefix
- Timestamps: `*_at` suffix
- Foreign keys: `[referenced_table]_id`
- Money/currency: Always `Decimal(12, 2)`, never `float`
- IDs: Always `UUID`, never `SERIAL` or `BIGINT`

**See:** `resources/column-naming.md` for 1,200+ lines of naming rules

### Migration Workflow

**3-phase approach:**
1. **Design** - Schema planning, RLS design
2. **Implementation** - Write SQL, test locally
3. **Verification** - Security audit, data integrity checks

**See:** `resources/migration-checklist.md` for complete workflow

---

## When to Use Agents

### Before Migration:
```
Complex schema change?
→ @plan "Design multi-level approval workflow schema"

Unsure about RLS?
→ @security-auditor "Review RLS policies for quote_approvals table"

Performance concerns?
→ @expert "Optimize indexes for quotes table with 100k+ rows"
```

### After Migration (Automatic):
```
@orchestrator automatically invokes:
├─ @security-auditor (verifies RLS policies)
├─ @qa-tester (tests database operations)
└─ @code-reviewer (checks migration quality)
```

---

## Top 5 Common Mistakes

### 1. Missing organization_id Column 🔴 CRITICAL
**Impact:** Data leaks across organizations, GDPR violation

**Example:**
```sql
-- ❌ WRONG
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT
);

-- ✅ CORRECT
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id)
);
```

### 2. RLS Enabled But No Policies 🔴 CRITICAL
**Impact:** All operations denied, application breaks

**Example:**
```sql
-- ❌ WRONG
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
-- No policies = nobody can access data

-- ✅ CORRECT
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (...);
CREATE POLICY "quotes_insert" ON quotes FOR INSERT WITH CHECK (...);
```

### 3. Missing Policy Types 🔴 CRITICAL
**Impact:** Read-only tables, can't insert/update/delete

**Example:**
```sql
-- ❌ WRONG (only SELECT policy)
CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (...);

-- ✅ CORRECT (all 4 policy types)
CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (...);
CREATE POLICY "quotes_insert" ON quotes FOR INSERT WITH CHECK (...);
CREATE POLICY "quotes_update" ON quotes FOR UPDATE USING (...);
CREATE POLICY "quotes_delete" ON quotes FOR DELETE USING (...);
```

### 4. Service Role Bypass 🔴 CRITICAL SECURITY
**Impact:** Backend can access all org data, breaks multi-tenancy

**Example:**
```python
# ❌ WRONG (no org context)
result = supabase.table("quotes").select("*").execute()

# ✅ CORRECT (set org context)
await conn.execute(
    "SELECT set_config('app.current_organization_id', $1, true)",
    user.organization_id
)
result = await conn.fetch("SELECT * FROM quotes")
```

### 5. No Index on organization_id 🟡 PERFORMANCE
**Impact:** Slow queries, poor performance

**Example:**
```sql
-- ❌ WRONG (no index)
CREATE TABLE quotes (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL
);

-- ✅ CORRECT (with index)
CREATE TABLE quotes (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL
);
CREATE INDEX idx_quotes_organization ON quotes(organization_id);
```

**See:** `resources/common-mistakes.md` for complete list with fixes

---

## Testing RLS (Quick Template)

**Required before migration approval:**

```sql
-- Step 1: Get two organization UUIDs
SELECT id, name FROM organizations LIMIT 2;
-- Save org1_uuid and org2_uuid

-- Step 2: Test org1 isolation
SET app.current_organization_id = '[org1_uuid]';
SELECT * FROM [table_name];
-- Record: Should see X rows

-- Step 3: Test org2 isolation
SET app.current_organization_id = '[org2_uuid]';
SELECT * FROM [table_name];
-- Verify: Different data than org1

-- Step 4: Test all operations
-- INSERT
SET app.current_organization_id = '[org1_uuid]';
INSERT INTO [table_name] (organization_id, ...) VALUES ('[org1_uuid]', ...);
-- Should succeed

-- UPDATE
UPDATE [table_name] SET ... WHERE id = '[record_from_org1]';
-- Should succeed

-- DELETE
DELETE FROM [table_name] WHERE id = '[record_from_org1]';
-- Should succeed

-- Step 5: Test cross-org access (should fail)
SET app.current_organization_id = '[org1_uuid]';
UPDATE [table_name] SET ... WHERE id = '[record_from_org2]';
-- Should affect 0 rows (RLS blocks)

-- Step 6: Reset context
RESET app.current_organization_id;
```

**See:** `resources/rls-patterns.md` Section 6 for comprehensive testing guide

---

## Migration Approval Process

**GUARDRAIL checkpoint:**

```
┌─────────────────────────────────────────────┐
│ ⚠️ MIGRATION READY FOR EXECUTION            │
│                                             │
│ File: backend/migrations/XXX_name.sql       │
│                                             │
│ RLS VERIFICATION CHECKLIST:                 │
│ [ ] organization_id column added            │
│ [ ] Index on organization_id created        │
│ [ ] RLS enabled                             │
│ [ ] SELECT policy created                   │
│ [ ] INSERT policy created                   │
│ [ ] UPDATE policy created                   │
│ [ ] DELETE policy created                   │
│ [ ] Helper function exists                  │
│ [ ] Tested with multiple organizations      │
│                                             │
│ Have you verified ALL items? (yes/no)       │
└─────────────────────────────────────────────┘
```

**If "yes":** Execute migration
**If "no":** Show relevant resource file and pause

---

## Quick Reference Links

### Core Resources (This Skill):
- **[RLS Patterns](resources/rls-patterns.md)** (750+ lines) - Complete RLS implementation guide
- **[Schema Standards](resources/schema-standards.md)** (650+ lines) - Table design rules
- **[Migration Checklist](resources/migration-checklist.md)** (200+ lines) - Step-by-step workflow
- **[Column Naming](resources/column-naming.md)** (1,200+ lines) - Naming conventions for all data types
- **[Common Mistakes](resources/common-mistakes.md)** (210 lines) - Top 10 mistakes with fixes

### Related Project Documentation:
- **`/home/novi/quotation-app-dev/backend/CLAUDE.md`** - Backend patterns
- **`/home/novi/quotation-app-dev/backend/migrations/MIGRATIONS.md`** - Migration history
- **`/home/novi/quotation-app-dev/.claude/RLS_CHECKLIST.md`** - Legacy RLS guide (superseded by this skill)

---

## Security-First Principles

**Every migration must prioritize:**

1. **Multi-tenancy** - Data isolation is non-negotiable
2. **RLS by default** - Enable RLS before policies (fail-safe)
3. **Explicit policies** - Never rely on implicit behavior
4. **Test with real data** - Use production-like org structure
5. **Audit trail** - All tables have created_at, updated_at, created_by
6. **Service role context** - Backend ALWAYS sets org context

**Remember:** A single RLS mistake can expose ALL customer data. This guardrail exists to prevent that.

---

## Example: Complete Migration Template

```sql
-- Migration: Add quote_approvals table
-- Date: 2025-10-29
-- Author: Claude
-- Verified: RLS checklist completed

-- Step 1: Create table with required columns
CREATE TABLE quote_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    approved_by UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
    comment TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Step 2: Create indexes
CREATE INDEX idx_quote_approvals_quote ON quote_approvals(quote_id);
CREATE INDEX idx_quote_approvals_organization ON quote_approvals(organization_id);
CREATE INDEX idx_quote_approvals_created_at ON quote_approvals(created_at);

-- Step 3: Enable RLS
ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies (all 4 types)
CREATE POLICY "quote_approvals_select_policy" ON quote_approvals
FOR SELECT USING (
    organization_id = current_organization_id()
);

CREATE POLICY "quote_approvals_insert_policy" ON quote_approvals
FOR INSERT WITH CHECK (
    organization_id = current_organization_id()
);

CREATE POLICY "quote_approvals_update_policy" ON quote_approvals
FOR UPDATE USING (
    organization_id = current_organization_id()
);

CREATE POLICY "quote_approvals_delete_policy" ON quote_approvals
FOR DELETE USING (
    organization_id = current_organization_id()
);

-- Step 5: Create triggers (auto-update updated_at)
CREATE TRIGGER update_quote_approvals_updated_at
    BEFORE UPDATE ON quote_approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Test RLS (run via Supabase SQL editor)
-- [See Testing RLS section above]
```

---

## Deliverables Checklist

**After migration execution, provide:**

- [ ] Migration file path
- [ ] Tables created/modified
- [ ] Columns added/removed
- [ ] Indexes created
- [ ] RLS policies added
- [ ] Testing results (org isolation verified)
- [ ] Backend code updated (if needed)
- [ ] Documentation updated

**Format:**
```markdown
## Migration Complete: [Name]

**File:** `backend/migrations/XXX_name.sql`

**Tables:**
- Created: quote_approvals (9 columns)

**Columns:**
- organization_id (UUID NOT NULL)
- [all other columns]

**Indexes:**
- idx_quote_approvals_organization
- idx_quote_approvals_quote

**RLS:**
- ✅ RLS enabled
- ✅ 4 policies created (SELECT, INSERT, UPDATE, DELETE)
- ✅ Tested with 2 organizations
- ✅ Data isolation verified

**Testing:**
- Org 1: 0 rows (empty table)
- Org 2: 0 rows (empty table)
- Cross-org update: 0 rows affected ✅
```

---

## Remember

**This is a GUARDRAIL skill:**
- Blocks until RLS verified
- Security-first, no exceptions
- Multi-tenancy is mandatory
- User confirmation required

**When in doubt:**
- Ask `@security-auditor` for review
- Reference resource files
- Test with multiple organizations
- Prefer explicit over implicit

**The cost of a RLS mistake is catastrophic. This skill prevents that.**

---

**Skill Version:** 1.0
**Lines:** 450
**Last Updated:** 2025-10-29 10:30 UTC
