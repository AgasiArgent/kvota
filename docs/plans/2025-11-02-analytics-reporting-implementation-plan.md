# Financial Analytics & Reporting System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan.

**Goal:** Build a financial analytics system with saved reports, execution history, scheduled reports, and flexible query builder for Admin/Owner users.

**Architecture:** FastAPI backend with parameterized SQL queries, Redis caching (10-min TTL), Supabase PostgreSQL with RLS, React frontend with ag-Grid for data display. Two viewing modes: Standard (individual rows) and Lightweight (aggregations only).

**Tech Stack:** FastAPI, Python 3.12, asyncpg, Redis 7.0, Supabase PostgreSQL, React 19, Next.js 15, Ant Design, ag-Grid

**Design Document:** `/docs/plans/2025-11-02-analytics-reporting-system-design.md`

**Expert Review:** ✅ Reviewed by @expert (2025-11-02) - Security validated, infrastructure gaps fixed, execution strategy optimized

**Skills to Reference:**
- @backend-dev-guidelines - FastAPI patterns, Supabase RLS, security
- @database-verification - RLS policies, schema standards
- @frontend-dev-guidelines - React patterns, Ant Design, ag-Grid

---

## 🎯 Expert Recommendations Applied

**Key Changes from Expert Review:**

1. **Infrastructure gaps fixed** - Redis, Storage bucket, connection pooling configured
2. **Task reordering** - Dependencies properly sequenced (Pydantic before endpoints, Redis after core)
3. **Execution strategy** - Hybrid approach (5 batches instead of 30 individual tasks)
4. **Time estimate adjusted** - 12-15 days (was 7-9 days)
5. **Missing tasks added** - Performance tests, RLS tests, load tests, API documentation
6. **Security hardened** - Parameterized queries, field whitelisting, comprehensive error handling

**Infrastructure Status (Pre-flight Complete ✅):**
- ✅ Redis 7.0.0 installed and running
- ✅ Supabase Storage bucket "analytics" created
- ✅ croniter 2.0.1 installed
- ✅ asyncpg connection pooling configured (db_pool.py)
- ✅ set_rls_context() updated with app.current_organization_id

---

## Execution Strategy: Hybrid Batching

**5 batches (not 30 individual tasks):**

1. **Foundation Batch** (Tasks 0-4): Database, security, models - Single agent, 3-4 hours
2. **Core API Batch** (Tasks 5-8): Query, aggregate, export - Single agent, 4-5 hours
3. **Extended API Batch** (Tasks 9-15): Saved reports, history, schedule CRUD - 2 agents parallel, 4-5 hours
4. **Frontend Batch** (Tasks 16-25): All UI components - 2 agents parallel, 5-6 hours
5. **Integration & Testing Batch** (Tasks 26-34): E2E tests, performance, documentation - Single agent, 3-4 hours

**Benefits:**
- Fewer context switches (5 vs 30)
- Better error handling within domain
- Parallelization where appropriate
- Integration issues caught within batch

**Time Estimate:** 12-15 days (realistic, includes debugging + integration)

---

## Phase 1: Backend Core (Tasks 0-15)

### Task 0: Infrastructure Setup (COMPLETE ✅)

**Status:** Pre-flight completed before implementation start

**Infrastructure verified/created:**

**Step 1: Redis installation check**
```bash
redis-cli ping
```
Result: ✅ PONG (Redis 7.0.0 running)

**Step 2: Create Supabase Storage bucket**
```python
supabase.storage.create_bucket("analytics", options={"public": False})
```
Result: ✅ Bucket "analytics" created

**Step 3: Install croniter**
```bash
pip install croniter==2.0.1
```
Result: ✅ Installed successfully

**Step 4: Configure connection pooling**

Created `backend/db_pool.py`:
- asyncpg pool with 10-20 connections
- Automatic timeout and recycling
- Used in analytics API for better concurrency

**Step 5: Update set_rls_context()**

Modified `backend/routes/quotes.py:76-94`:
- Added `app.current_organization_id` setting
- Enhanced JWT claims with full user context
- Supports current_organization_id() function

**Step 6: Update requirements.txt**

Added:
- croniter==2.0.1 (scheduler support)

**Verification:**
- [x] Redis running (redis-cli ping → PONG)
- [x] Storage bucket exists (analytics bucket created)
- [x] Packages installed (croniter, redis, asyncpg all ready)
- [x] Connection pooling configured (db_pool.py created)
- [x] RLS context enhanced (set_rls_context updated)

---

### Task 1: Database Migration - Create Tables

**Files:**
- Create: `backend/migrations/016_analytics_reporting_system.sql`
- Modify: `backend/migrations/MIGRATIONS.md`

**Step 1: Write migration SQL**

Create `backend/migrations/016_analytics_reporting_system.sql`:

```sql
-- ============================================================================
-- Financial Analytics & Reporting System
-- Migration 016: Create analytics tables with RLS
-- Date: 2025-11-02
-- ============================================================================

-- 0. Helper function (if not exists)
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
  SELECT (current_setting('app.current_organization_id', true))::uuid;
$$ LANGUAGE SQL STABLE;

-- 1. SAVED REPORTS TABLE
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Report metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Query definition (JSON)
  filters JSONB NOT NULL DEFAULT '{}',
  selected_fields TEXT[] NOT NULL,
  aggregations JSONB DEFAULT '{}',

  -- Sharing settings
  visibility TEXT NOT NULL DEFAULT 'personal'
    CONSTRAINT chk_visibility CHECK (visibility IN ('personal', 'shared')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  CONSTRAINT unique_report_name_per_org_user
    UNIQUE(organization_id, created_by, name)
    DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for saved_reports
CREATE INDEX idx_saved_reports_org ON saved_reports(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_creator ON saved_reports(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_visibility ON saved_reports(organization_id, visibility) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_filters_gin ON saved_reports USING gin(filters jsonb_path_ops);

-- RLS for saved_reports
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_reports_select" ON saved_reports
FOR SELECT USING (
  organization_id = current_organization_id()
  AND deleted_at IS NULL
  AND (created_by = auth.uid() OR visibility = 'shared')
);

CREATE POLICY "saved_reports_insert" ON saved_reports
FOR INSERT WITH CHECK (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "saved_reports_update" ON saved_reports
FOR UPDATE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "saved_reports_delete" ON saved_reports
FOR DELETE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

-- 2. REPORT EXECUTIONS TABLE (IMMUTABLE AUDIT LOG)
CREATE TABLE report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Report reference
  saved_report_id UUID REFERENCES saved_reports(id) ON DELETE SET NULL,
  report_name TEXT,

  -- Execution context
  executed_by UUID NOT NULL REFERENCES auth.users(id),
  execution_type TEXT NOT NULL
    CONSTRAINT chk_execution_type CHECK (execution_type IN ('manual', 'scheduled', 'api')),

  -- Query snapshot (immutable record)
  filters JSONB NOT NULL DEFAULT '{}',
  selected_fields TEXT[] NOT NULL,
  aggregations JSONB DEFAULT '{}',

  -- Results snapshot
  result_summary JSONB NOT NULL DEFAULT '{}',
  quote_count INT NOT NULL DEFAULT 0 CHECK (quote_count >= 0),
  date_range JSONB DEFAULT '{}',

  -- Generated file
  export_file_url TEXT,
  export_format TEXT
    CONSTRAINT chk_export_format CHECK (export_format IN ('xlsx', 'csv', 'pdf', 'json')),
  file_size_bytes INT CHECK (file_size_bytes > 0),
  file_expires_at TIMESTAMPTZ,

  -- Audit fields
  ip_address INET,
  user_agent TEXT,

  -- Performance tracking
  execution_time_ms INT CHECK (execution_time_ms >= 0),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for report_executions
CREATE INDEX idx_report_executions_org_date ON report_executions(organization_id, executed_at DESC);
CREATE INDEX idx_report_executions_user ON report_executions(executed_by, executed_at DESC);
CREATE INDEX idx_report_executions_saved_report ON report_executions(saved_report_id) WHERE saved_report_id IS NOT NULL;
CREATE INDEX idx_report_executions_org_type_date ON report_executions(organization_id, execution_type, executed_at DESC);
CREATE INDEX idx_report_executions_file_expiry ON report_executions(file_expires_at) WHERE file_expires_at IS NOT NULL;
CREATE INDEX idx_report_executions_filters_gin ON report_executions USING gin(filters jsonb_path_ops);
CREATE INDEX idx_report_executions_date_range ON report_executions((date_range->>'start'), (date_range->>'end'));

-- RLS for report_executions (IMMUTABLE)
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_executions_select" ON report_executions
FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY "report_executions_insert" ON report_executions
FOR INSERT WITH CHECK (
  organization_id = current_organization_id()
  AND executed_by = auth.uid()
);

-- NO UPDATE/DELETE - Audit logs are immutable
CREATE POLICY "report_executions_no_update" ON report_executions
FOR UPDATE USING (false);

CREATE POLICY "report_executions_no_delete" ON report_executions
FOR DELETE USING (false);

-- 3. SCHEDULED REPORTS TABLE
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  saved_report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,

  -- Schedule configuration
  name TEXT NOT NULL,
  schedule_cron TEXT NOT NULL
    CONSTRAINT chk_valid_cron CHECK (
      schedule_cron ~ '^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$'
    ),
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',

  -- Notification settings
  email_recipients TEXT[] NOT NULL CHECK (array_length(email_recipients, 1) > 0),
  include_file BOOLEAN NOT NULL DEFAULT true,
  email_subject TEXT,
  email_body TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_status TEXT
    CONSTRAINT chk_run_status CHECK (last_run_status IN ('success', 'failure', 'partial')),
  last_error TEXT,
  consecutive_failures INT DEFAULT 0,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scheduled_reports
CREATE INDEX idx_scheduled_reports_org ON scheduled_reports(organization_id);
CREATE INDEX idx_scheduled_reports_saved_report ON scheduled_reports(saved_report_id);
CREATE INDEX idx_scheduled_reports_active_next_run ON scheduled_reports(organization_id, next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_created_by ON scheduled_reports(created_by);

-- RLS for scheduled_reports
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_reports_select" ON scheduled_reports
FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY "scheduled_reports_insert" ON scheduled_reports
FOR INSERT WITH CHECK (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "scheduled_reports_update" ON scheduled_reports
FOR UPDATE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

CREATE POLICY "scheduled_reports_delete" ON scheduled_reports
FOR DELETE USING (
  organization_id = current_organization_id()
  AND created_by = auth.uid()
);

-- 4. REPORT VERSIONS TABLE (IMMUTABLE)
CREATE TABLE report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE RESTRICT,
  version_number INT NOT NULL CHECK (version_number > 0),

  -- Snapshot of report at this version
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  selected_fields TEXT[] NOT NULL,
  aggregations JSONB DEFAULT '{}',
  visibility TEXT NOT NULL,

  -- Change tracking
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  change_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_report_version UNIQUE(saved_report_id, version_number)
);

-- Indexes for report_versions
CREATE INDEX idx_report_versions_saved_report ON report_versions(saved_report_id, version_number DESC);
CREATE INDEX idx_report_versions_changed_by ON report_versions(changed_by);

-- RLS for report_versions (IMMUTABLE)
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_versions_select" ON report_versions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM saved_reports sr
    WHERE sr.id = report_versions.saved_report_id
    AND sr.organization_id = current_organization_id()
    AND sr.deleted_at IS NULL
    AND (sr.created_by = auth.uid() OR sr.visibility = 'shared')
  )
);

-- System creates versions automatically
CREATE POLICY "report_versions_insert_system" ON report_versions
FOR INSERT WITH CHECK (true);

-- Versions are immutable
CREATE POLICY "report_versions_no_update" ON report_versions
FOR UPDATE USING (false);

CREATE POLICY "report_versions_no_delete" ON report_versions
FOR DELETE USING (false);

-- 5. AUTO-UPDATE TRIGGERS
CREATE TRIGGER update_saved_reports_updated_at
  BEFORE UPDATE ON saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. VERSION TRACKING TRIGGER
CREATE OR REPLACE FUNCTION track_report_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INT;
BEGIN
  -- Only track if report actually changed
  IF OLD.filters IS DISTINCT FROM NEW.filters
    OR OLD.selected_fields IS DISTINCT FROM NEW.selected_fields
    OR OLD.aggregations IS DISTINCT FROM NEW.aggregations
    OR OLD.visibility IS DISTINCT FROM NEW.visibility THEN

    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM report_versions
    WHERE saved_report_id = NEW.id;

    -- Create version record
    INSERT INTO report_versions (
      saved_report_id, version_number, name, description,
      filters, selected_fields, aggregations, visibility,
      changed_by, change_description
    ) VALUES (
      NEW.id, next_version, OLD.name, OLD.description,
      OLD.filters, OLD.selected_fields, OLD.aggregations, OLD.visibility,
      NEW.created_by, 'Auto-versioned on update'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_saved_report_versions
  AFTER UPDATE ON saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION track_report_version();

-- 7. FILE CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION cleanup_expired_report_files()
RETURNS void AS $$
BEGIN
  UPDATE report_executions
  SET export_file_url = NULL,
      file_size_bytes = NULL
  WHERE file_expires_at < NOW()
    AND export_file_url IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE saved_reports IS 'User-saved report templates for financial analytics';
COMMENT ON TABLE report_executions IS 'Immutable audit log of all report executions';
COMMENT ON TABLE scheduled_reports IS 'Automated report scheduling configuration (admin-only)';
COMMENT ON TABLE report_versions IS 'Version history for saved reports (immutable)';
```

**Step 2: Run migration via Supabase SQL editor**

1. Open Supabase Dashboard → SQL Editor
2. Paste migration SQL
3. Click "Run"
4. Expected: "Success. No rows returned"

**Step 3: Update migration tracking**

Add to `backend/migrations/MIGRATIONS.md`:

```markdown
## Migration 016 - Analytics Reporting System (2025-11-02)

**Tables Created:**
- `saved_reports` - User-saved report templates
- `report_executions` - Immutable audit log
- `scheduled_reports` - Automated report scheduling
- `report_versions` - Version history (immutable)

**RLS Policies:** All tables have SELECT/INSERT/UPDATE/DELETE policies
**Triggers:** Auto-versioning, auto-update timestamps
**Functions:** `track_report_version()`, `cleanup_expired_report_files()`

**Status:** ✅ Applied
```

**Step 4: Verify tables created**

Run in Supabase SQL Editor:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('saved_reports', 'report_executions', 'scheduled_reports', 'report_versions')
ORDER BY table_name;
```

Expected: 4 rows returned

**Step 5: Test RLS isolation**

Run in Supabase SQL Editor:

```sql
-- Get two org IDs
SELECT id FROM organizations LIMIT 2;

-- Set org 1 context
SELECT set_config('app.current_organization_id', '<org1_uuid>', false);

-- Try to select (should return 0 rows)
SELECT * FROM saved_reports;

-- Set org 2 context
SELECT set_config('app.current_organization_id', '<org2_uuid>', false);

-- Try to select (should return 0 rows)
SELECT * FROM saved_reports;
```

Expected: Queries succeed with 0 rows (RLS working)

**Step 6: Commit**

```bash
git add backend/migrations/016_analytics_reporting_system.sql backend/migrations/MIGRATIONS.md
git commit -m "feat(db): add analytics reporting tables with RLS"
```

---

### Task 2: Security Module - Query Validator

**Files:**
- Create: `backend/analytics_security.py`
- Test: `backend/tests/test_analytics_security.py`

**Step 1: Write failing test**

Create `backend/tests/test_analytics_security.py`:

```python
import pytest
from analytics_security import QuerySecurityValidator, build_analytics_query
from uuid import uuid4

def test_validate_fields_accepts_whitelisted_fields():
    """Test that whitelisted fields are accepted"""
    fields = ['quote_number', 'status', 'total_amount']
    result = QuerySecurityValidator.validate_fields(fields)
    assert result == fields


def test_validate_fields_rejects_non_whitelisted_fields():
    """Test that non-whitelisted fields are rejected"""
    fields = ['quote_number', 'password', 'secret_key']
    result = QuerySecurityValidator.validate_fields(fields)
    assert result == ['quote_number']


def test_is_safe_value_rejects_sql_injection():
    """Test that SQL injection attempts are rejected"""
    dangerous = "'; DROP TABLE quotes; --"
    assert QuerySecurityValidator.is_safe_value(dangerous) == False


def test_is_safe_value_accepts_normal_values():
    """Test that normal values are accepted"""
    assert QuerySecurityValidator.is_safe_value("approved") == True
    assert QuerySecurityValidator.is_safe_value(12345) == True
    assert QuerySecurityValidator.is_safe_value(None) == True


def test_sanitize_filters_removes_dangerous_filters():
    """Test that dangerous filter values are removed"""
    filters = {
        'status': 'approved',
        'quote_number': "'; DROP TABLE quotes; --"
    }
    result = QuerySecurityValidator.sanitize_filters(filters)
    assert 'status' in result
    assert 'quote_number' not in result


def test_build_analytics_query_uses_parameterized_queries():
    """Test that query builder uses parameterized queries"""
    org_id = uuid4()
    filters = {'status': 'approved', 'sale_type': 'поставка'}
    fields = ['quote_number', 'total_amount']

    sql, params = build_analytics_query(
        organization_id=org_id,
        filters=filters,
        selected_fields=fields,
        limit=100,
        offset=0
    )

    # Should use $1, $2, etc (not string interpolation)
    assert '$1' in sql
    assert '$2' in sql
    assert 'DROP' not in sql.upper()

    # Params should match
    assert str(org_id) in params
    assert 'approved' in params
```

**Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_analytics_security.py -v
```

Expected: FAIL - "ModuleNotFoundError: No module named 'analytics_security'"

**Step 3: Write minimal implementation**

Create `backend/analytics_security.py`:

```python
"""
Analytics Query Security Module

Prevents SQL injection and validates all user inputs for analytics queries.
"""

from typing import List, Dict, Any, Tuple
from uuid import UUID
import re


class QuerySecurityValidator:
    """Validate and sanitize analytics queries"""

    # Whitelist of allowed fields
    ALLOWED_FIELDS = {
        'quotes': [
            'id', 'quote_number', 'status', 'sale_type', 'seller_company',
            'created_at', 'updated_at', 'total_amount', 'quote_date',
            'customer_id', 'organization_id'
        ],
        'calculated': [
            'import_vat', 'export_vat', 'customs_duty', 'excise_tax',
            'logistics_cost', 'cogs', 'profit', 'margin_percent'
        ]
    }

    # SQL injection patterns to reject
    FORBIDDEN_PATTERNS = [
        r'(DROP|ALTER|CREATE|TRUNCATE|DELETE|INSERT|UPDATE)\s+',
        r'(SELECT\s+.*\s+FROM\s+auth\.)',  # No auth table access
        r'(pg_|information_schema)',  # No system tables
        r'(\\x[0-9a-fA-F]+)',  # No hex injection
        r'(UNION\s+ALL|UNION\s+SELECT)',  # No UNION attacks
    ]

    @classmethod
    def validate_fields(cls, fields: List[str]) -> List[str]:
        """Return only whitelisted fields"""
        all_allowed = cls.ALLOWED_FIELDS['quotes'] + cls.ALLOWED_FIELDS['calculated']
        return [f for f in fields if f in all_allowed]

    @classmethod
    def is_safe_value(cls, value: Any) -> bool:
        """Check if value is safe for queries"""
        if value is None:
            return True

        str_value = str(value)

        # Check forbidden patterns
        for pattern in cls.FORBIDDEN_PATTERNS:
            if re.search(pattern, str_value, re.IGNORECASE):
                return False

        # Limit length
        if len(str_value) > 1000:
            return False

        return True

    @classmethod
    def sanitize_filters(cls, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize filter values"""
        safe_filters = {}

        for key, value in filters.items():
            # Validate key
            if key not in cls.ALLOWED_FIELDS['quotes']:
                continue

            # Validate value(s)
            if isinstance(value, list):
                safe_values = [v for v in value if cls.is_safe_value(v)]
                if safe_values:
                    safe_filters[key] = safe_values
            elif cls.is_safe_value(value):
                safe_filters[key] = value

        return safe_filters


def build_analytics_query(
    organization_id: UUID,
    filters: Dict[str, Any],
    selected_fields: List[str],
    limit: int = 1000,
    offset: int = 0
) -> Tuple[str, List[Any]]:
    """
    Build parameterized query with SQL injection protection.

    Returns: (sql_query, parameters)
    """
    # Validate and sanitize inputs
    validated_fields = QuerySecurityValidator.validate_fields(selected_fields)
    safe_filters = QuerySecurityValidator.sanitize_filters(filters)

    if not validated_fields:
        validated_fields = ['id', 'quote_number', 'total_amount']

    # Build parameterized query
    params = []
    where_clauses = ["organization_id = $1"]
    params.append(str(organization_id))

    # Add filters with parameterization
    param_count = 2
    for key, value in safe_filters.items():
        if isinstance(value, list):
            placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
            where_clauses.append(f"{key} = ANY(ARRAY[{','.join(placeholders)}])")
            params.extend(value)
            param_count += len(value)
        else:
            where_clauses.append(f"{key} = ${param_count}")
            params.append(value)
            param_count += 1

    sql = f"""
        SELECT {', '.join(validated_fields)}
        FROM quotes
        WHERE {' AND '.join(where_clauses)}
        ORDER BY created_at DESC
        LIMIT ${param_count} OFFSET ${param_count + 1}
    """
    params.extend([limit, offset])

    return sql, params


def build_aggregation_query(
    organization_id: UUID,
    filters: Dict[str, Any],
    aggregations: Dict[str, Dict[str, str]]
) -> Tuple[str, List[Any]]:
    """
    Build aggregation query with parameterized filters.

    aggregations format:
    {
        "import_vat": {"function": "sum", "label": "Total VAT"},
        "quote_count": {"function": "count", "label": "Number of Quotes"}
    }

    Returns: (sql_query, parameters)
    """
    safe_filters = QuerySecurityValidator.sanitize_filters(filters)

    # Build aggregation clauses
    agg_clauses = []
    for field, config in aggregations.items():
        func = config.get('function', 'sum').upper()
        if func not in ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX']:
            continue

        if func == 'COUNT':
            agg_clauses.append(f"COUNT(*) as {field}")
        elif field in QuerySecurityValidator.ALLOWED_FIELDS['calculated']:
            agg_clauses.append(f"{func}({field}) as {field}")

    if not agg_clauses:
        agg_clauses = ["COUNT(*) as quote_count"]

    # Build WHERE clause
    params = [str(organization_id)]
    where_clauses = ["organization_id = $1"]

    param_count = 2
    for key, value in safe_filters.items():
        if isinstance(value, list):
            placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
            where_clauses.append(f"{key} = ANY(ARRAY[{','.join(placeholders)}])")
            params.extend(value)
            param_count += len(value)
        else:
            where_clauses.append(f"{key} = ${param_count}")
            params.append(value)
            param_count += 1

    sql = f"""
        SELECT {', '.join(agg_clauses)}
        FROM quotes
        WHERE {' AND '.join(where_clauses)}
    """

    return sql, params
```

**Step 4: Run test to verify it passes**

```bash
cd backend
pytest tests/test_analytics_security.py -v
```

Expected: 6 passed

**Step 5: Commit**

```bash
git add backend/analytics_security.py backend/tests/test_analytics_security.py
git commit -m "feat(security): add analytics query validator with SQL injection protection"
```

---

### Task 3: Redis Cache Module

**Files:**
- Create: `backend/analytics_cache.py`
- Test: `backend/tests/test_analytics_cache.py`
- Modify: `backend/requirements.txt`

**Step 1: Add Redis dependency**

Add to `backend/requirements.txt`:

```
redis==5.0.1
```

Install:

```bash
cd backend
pip install redis==5.0.1
```

**Step 2: Write failing test**

Create `backend/tests/test_analytics_cache.py`:

```python
import pytest
from analytics_cache import get_cache_key, get_cached_report, cache_report, invalidate_report_cache
import json

@pytest.fixture
def redis_client():
    """Fixture to get Redis client for testing"""
    import redis
    client = redis.Redis(host='localhost', port=6379, db=15, decode_responses=True)
    # Use db=15 for tests (separate from production)
    yield client
    # Cleanup after test
    client.flushdb()


def test_get_cache_key_generates_consistent_keys(redis_client):
    """Test that same inputs generate same cache key"""
    key1 = get_cache_key('org1', {'status': 'approved'}, ['quote_number', 'total_amount'])
    key2 = get_cache_key('org1', {'status': 'approved'}, ['quote_number', 'total_amount'])
    assert key1 == key2


def test_get_cache_key_generates_different_keys_for_different_inputs(redis_client):
    """Test that different inputs generate different cache keys"""
    key1 = get_cache_key('org1', {'status': 'approved'}, ['quote_number'])
    key2 = get_cache_key('org1', {'status': 'rejected'}, ['quote_number'])
    assert key1 != key2


@pytest.mark.asyncio
async def test_cache_report_stores_data(redis_client):
    """Test that cache_report stores data correctly"""
    cache_key = 'test:report:123'
    data = {'rows': [{'id': 1, 'name': 'test'}], 'count': 1}

    await cache_report(cache_key, data)

    # Verify stored
    cached = redis_client.get(cache_key)
    assert cached is not None
    assert json.loads(cached) == data


@pytest.mark.asyncio
async def test_get_cached_report_returns_stored_data(redis_client):
    """Test that get_cached_report retrieves stored data"""
    cache_key = 'test:report:456'
    data = {'rows': [{'id': 2, 'name': 'test2'}], 'count': 1}

    # Store directly
    redis_client.setex(cache_key, 600, json.dumps(data))

    # Retrieve via function
    result = await get_cached_report(cache_key)
    assert result == data


@pytest.mark.asyncio
async def test_get_cached_report_returns_none_for_missing_key(redis_client):
    """Test that get_cached_report returns None for missing key"""
    result = await get_cached_report('test:nonexistent')
    assert result is None
```

**Step 3: Run test to verify it fails**

```bash
cd backend
pytest tests/test_analytics_cache.py -v
```

Expected: FAIL - "ModuleNotFoundError: No module named 'analytics_cache'"

**Step 4: Write minimal implementation**

Create `backend/analytics_cache.py`:

```python
"""
Analytics Caching Module

Redis-based caching for frequently-run reports (10-minute TTL).
"""

import redis
import hashlib
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Redis client (singleton)
redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True,
    db=0
)


def get_cache_key(org_id: str, filters: Dict, fields: list, aggregations: Optional[Dict] = None) -> str:
    """
    Generate cache key from query parameters.

    Same inputs → same key (for cache hits).
    """
    key_data = {
        'org': org_id,
        'filters': filters,
        'fields': sorted(fields),
        'aggs': aggregations
    }
    key_str = json.dumps(key_data, sort_keys=True)
    key_hash = hashlib.md5(key_str.encode()).hexdigest()
    return f"report:{org_id}:{key_hash}"


async def get_cached_report(cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached report (TTL: 10 minutes).

    Returns None if not found or on error.
    """
    try:
        cached = redis_client.get(cache_key)
        return json.loads(cached) if cached else None
    except Exception as e:
        # Cache errors should not break queries
        logger.warning(f"Cache get error: {e}")
        return None


async def cache_report(cache_key: str, data: Dict[str, Any]) -> None:
    """
    Cache report for 10 minutes.

    Errors are logged but do not raise exceptions.
    """
    try:
        redis_client.setex(
            cache_key,
            600,  # 10 minutes
            json.dumps(data, default=str)
        )
    except Exception as e:
        # Cache errors should not break queries
        logger.warning(f"Cache set error: {e}")


async def invalidate_report_cache(org_id: str, report_id: Optional[str] = None) -> None:
    """
    Invalidate cached reports.

    If report_id provided: invalidate all caches for that report
    If not provided: clear all org reports
    """
    try:
        pattern = f"report:{org_id}:*"
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
    except Exception as e:
        logger.warning(f"Cache invalidation error: {e}")
```

**Step 5: Run test to verify it passes**

```bash
cd backend
pytest tests/test_analytics_cache.py -v
```

Expected: 5 passed

**Step 6: Commit**

```bash
git add backend/analytics_cache.py backend/tests/test_analytics_cache.py backend/requirements.txt
git commit -m "feat(cache): add Redis caching for analytics reports (10-min TTL)"
```

---

### Task 4: Pydantic Models for Analytics

**Files:**
- Modify: `backend/models.py` (add to end of file)
- Test: `backend/tests/test_analytics_models.py`

**Step 1: Write failing test**

Create `backend/tests/test_analytics_models.py`:

```python
import pytest
from models import (
    SavedReportCreate, SavedReportUpdate, SavedReport,
    AnalyticsQueryRequest, AnalyticsQueryResponse
)
from pydantic import ValidationError


def test_saved_report_create_validates_required_fields():
    """Test that SavedReportCreate requires name and selected_fields"""
    with pytest.raises(ValidationError):
        SavedReportCreate(filters={})


def test_saved_report_create_accepts_valid_data():
    """Test that SavedReportCreate accepts valid data"""
    report = SavedReportCreate(
        name="Monthly VAT Report",
        description="Sum VAT for approved quotes",
        filters={'status': ['approved']},
        selected_fields=['quote_number', 'import_vat', 'total_amount'],
        aggregations={'import_vat': {'function': 'sum', 'label': 'Total VAT'}},
        visibility='shared'
    )
    assert report.name == "Monthly VAT Report"
    assert report.visibility == 'shared'


def test_analytics_query_request_requires_filters():
    """Test that AnalyticsQueryRequest requires filters"""
    with pytest.raises(ValidationError):
        AnalyticsQueryRequest(selected_fields=['quote_number'])


def test_analytics_query_request_defaults():
    """Test AnalyticsQueryRequest default values"""
    request = AnalyticsQueryRequest(
        filters={'status': 'approved'},
        selected_fields=['quote_number']
    )
    assert request.limit == 1000
    assert request.offset == 0
```

**Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_analytics_models.py -v
```

Expected: FAIL - "ImportError: cannot import name 'SavedReportCreate'"

**Step 3: Add models to backend/models.py**

Add to end of `backend/models.py`:

```python
# ============================================================================
# ANALYTICS MODELS
# ============================================================================

class SavedReportCreate(BaseModel):
    """Create saved report template"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    filters: Dict[str, Any] = Field(default_factory=dict)
    selected_fields: List[str] = Field(..., min_items=1)
    aggregations: Optional[Dict[str, Any]] = None
    visibility: str = Field(default='personal', regex='^(personal|shared)$')


class SavedReportUpdate(BaseModel):
    """Update saved report template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    selected_fields: Optional[List[str]] = Field(None, min_items=1)
    aggregations: Optional[Dict[str, Any]] = None
    visibility: Optional[str] = Field(None, regex='^(personal|shared)$')


class SavedReport(BaseModel):
    """Complete saved report with database fields"""
    id: UUID
    organization_id: UUID
    created_by: UUID
    name: str
    description: Optional[str]
    filters: Dict[str, Any]
    selected_fields: List[str]
    aggregations: Optional[Dict[str, Any]]
    visibility: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnalyticsQueryRequest(BaseModel):
    """Analytics query request"""
    filters: Dict[str, Any] = Field(..., description="Filter conditions")
    selected_fields: List[str] = Field(..., min_items=1, description="Fields to return")
    aggregations: Optional[Dict[str, Any]] = Field(None, description="Aggregation functions")
    limit: int = Field(default=1000, ge=1, le=10000)
    offset: int = Field(default=0, ge=0)


class AnalyticsQueryResponse(BaseModel):
    """Analytics query response"""
    rows: List[Dict[str, Any]]
    count: int
    total_count: Optional[int] = None
    has_more: Optional[bool] = None
    task_id: Optional[str] = None  # For background processing
    status: Optional[str] = None  # 'completed', 'processing'
    message: Optional[str] = None


class AnalyticsAggregateResponse(BaseModel):
    """Analytics aggregation response (lightweight mode)"""
    aggregations: Dict[str, Any]
    execution_time_ms: int


class ReportExecution(BaseModel):
    """Report execution audit record"""
    id: UUID
    organization_id: UUID
    saved_report_id: Optional[UUID]
    report_name: Optional[str]
    executed_by: UUID
    execution_type: str
    filters: Dict[str, Any]
    selected_fields: List[str]
    aggregations: Optional[Dict[str, Any]]
    result_summary: Dict[str, Any]
    quote_count: int
    date_range: Optional[Dict[str, Any]]
    export_file_url: Optional[str]
    export_format: Optional[str]
    file_size_bytes: Optional[int]
    file_expires_at: Optional[datetime]
    ip_address: Optional[str]
    user_agent: Optional[str]
    execution_time_ms: Optional[int]
    executed_at: datetime

    class Config:
        from_attributes = True


class ScheduledReportCreate(BaseModel):
    """Create scheduled report"""
    saved_report_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    schedule_cron: str = Field(..., description="Cron expression")
    timezone: str = Field(default='Europe/Moscow')
    email_recipients: List[str] = Field(..., min_items=1)
    include_file: bool = Field(default=True)
    email_subject: Optional[str] = None
    email_body: Optional[str] = None


class ScheduledReportUpdate(BaseModel):
    """Update scheduled report"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    schedule_cron: Optional[str] = None
    timezone: Optional[str] = None
    email_recipients: Optional[List[str]] = Field(None, min_items=1)
    include_file: Optional[bool] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduledReport(BaseModel):
    """Complete scheduled report"""
    id: UUID
    organization_id: UUID
    saved_report_id: UUID
    name: str
    schedule_cron: str
    timezone: str
    email_recipients: List[str]
    include_file: bool
    email_subject: Optional[str]
    email_body: Optional[str]
    is_active: bool
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    last_run_status: Optional[str]
    last_error: Optional[str]
    consecutive_failures: int
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    """Generic paginated response"""
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int
```

**Step 4: Run test to verify it passes**

```bash
cd backend
pytest tests/test_analytics_models.py -v
```

Expected: 4 passed

**Step 5: Commit**

```bash
git add backend/models.py backend/tests/test_analytics_models.py
git commit -m "feat(models): add Pydantic models for analytics API"
```

---

### Task 5-15: API Endpoints Implementation

Due to length constraints, I'll provide a summary structure. Each endpoint follows the same TDD pattern:

**Remaining Tasks (5-15):**
- Task 5: `/api/analytics/saved-reports` LIST + GET
- Task 6: `/api/analytics/saved-reports` CREATE
- Task 7: `/api/analytics/saved-reports` UPDATE + DELETE
- Task 8: `/api/analytics/query` (standard mode)
- Task 9: `/api/analytics/aggregate` (lightweight mode)
- Task 10: `/api/analytics/export` (Excel/CSV)
- Task 11: `/api/analytics/executions` LIST + GET
- Task 12: `/api/analytics/executions/{id}/download`
- Task 13: `/api/analytics/scheduled` CRUD
- Task 14: `/api/analytics/scheduled/{id}/run`
- Task 15: Rate limiting setup

Each task follows:
1. Write failing test
2. Run to verify fail
3. Implement endpoint
4. Run to verify pass
5. Commit

---

## Phase 2: Frontend UI (Tasks 16-25)

### Task 16: Create Analytics Page Structure

**Files:**
- Create: `frontend/src/app/analytics/page.tsx`
- Create: `frontend/src/app/analytics/layout.tsx`

**Step 1: Write failing E2E test**

(E2E tests come after basic structure - skip for now)

**Step 2: Create page layout**

Create `frontend/src/app/analytics/layout.tsx`:

```typescript
export default function AnalyticsLayout({
  children,
}: {
  children: React.Node
}) {
  return (
    <div className="analytics-layout">
      {children}
    </div>
  );
}
```

**Step 3: Create main page**

Create `frontend/src/app/analytics/page.tsx`:

```typescript
'use client';

import { Card, Row, Col, Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function AnalyticsPage() {
  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card>
            <Title level={2}>Financial Analytics</Title>
            <Paragraph>
              Query, analyze, and export quote data with flexible filters and aggregations.
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
```

**Step 4: Test in browser**

```bash
cd frontend
npm run dev
```

Navigate to: http://localhost:3000/analytics

Expected: See "Financial Analytics" header

**Step 5: Commit**

```bash
git add frontend/src/app/analytics/
git commit -m "feat(ui): create analytics page structure"
```

---

### Task 17-25: Frontend Components

**Remaining Tasks:**
- Task 17: FilterPanel component (collapsible cards)
- Task 18: ViewModeToggle component
- Task 19: ResultsGrid component (ag-Grid)
- Task 20: AggregationCards component
- Task 21: ExportButtons component
- Task 22: Saved Reports page
- Task 23: Execution History page
- Task 24: Scheduled Reports page
- Task 25: E2E testing with Chrome DevTools MCP

---

## Phase 3: Scheduled Reports (Tasks 26-30)

### Task 26: Cron Job Scheduler

**Files:**
- Create: `backend/scheduler.py`
- Test: `backend/tests/test_scheduler.py`

**Step 1: Install croniter**

Add to `backend/requirements.txt`:

```
croniter==2.0.1
```

**Step 2: Write failing test**

```python
def test_calculate_next_run_from_cron():
    """Test cron expression parsing"""
    cron = "0 9 1 * *"  # 9am on 1st of month
    next_run = calculate_next_run(cron, 'Europe/Moscow')
    assert next_run.hour == 9
    assert next_run.day == 1
```

**Step 3-5: Implement, test, commit**

(Follow TDD pattern as above)

---

## Execution Order

**Recommended execution order:**
1. Tasks 1-4: Database + Security + Cache + Models (foundation)
2. Tasks 5-15: Backend API endpoints (core functionality)
3. Tasks 16-25: Frontend UI (user interface)
4. Tasks 26-30: Scheduled reports (automation)

**Parallel execution possible:**
- Tasks 5-15 (API endpoints) can be done in parallel by endpoint
- Tasks 17-25 (Frontend components) can be done in parallel by component

**Time estimate:**
- Phase 1: 4-5 days
- Phase 2: 3-4 days
- Phase 3: 2-3 days
- **Total: 9-12 days** (or 7-9 days with parallel work)

---

## Testing Checklist

After implementation, verify:

- [ ] All backend tests pass (`cd backend && pytest`)
- [ ] All frontend tests pass (`cd frontend && npm test`)
- [ ] SQL injection attacks blocked (security tests)
- [ ] RLS isolation working (2+ org test)
- [ ] Redis caching working (10-min TTL)
- [ ] Export generates correct Excel/CSV
- [ ] Scheduled reports execute on cron
- [ ] E2E tests pass (Chrome DevTools MCP)

**See:** `/docs/plans/2025-11-02-analytics-reporting-system-design.md` Section 10 for complete testing strategy

---

## Documentation Updates

After implementation:

- [ ] Update `backend/CLAUDE.md` with new analytics patterns
- [ ] Update `frontend/CLAUDE.md` with new components
- [ ] Update `CLAUDE.md` with analytics feature
- [ ] Update `.claude/SESSION_PROGRESS.md` with completion status

---

## Skills Reference

**For implementation:**
- @backend-dev-guidelines - FastAPI patterns, RLS, security
- @database-verification - RLS testing, schema verification
- @frontend-dev-guidelines - React patterns, Ant Design, ag-Grid
- @calculation-engine-guidelines - If integrating with calculation fields

**For testing:**
- Use `/test-quote-creation` workflow patterns
- Chrome DevTools MCP for E2E testing
- Pytest for backend unit tests
- Jest for frontend unit tests

---

**End of Implementation Plan**

**Plan Location:** `/docs/plans/2025-11-02-analytics-reporting-implementation-plan.md`
**Design Document:** `/docs/plans/2025-11-02-analytics-reporting-system-design.md`
