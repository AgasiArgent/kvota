# Financial Analytics & Reporting System - Design Document

**Date:** 2025-11-02
**Status:** Design Complete - Ready for Implementation
**Feature:** Analytics dashboard with saved reports, execution history, and scheduled reports
**Priority:** High (Phase 1 + Phase 2)

---

## Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Backend API](#backend-api)
6. [Security Implementation](#security-implementation)
7. [Frontend UI](#frontend-ui)
8. [Performance Optimizations](#performance-optimizations)
9. [Implementation Plan](#implementation-plan)
10. [Testing Strategy](#testing-strategy)

---

## 1. Overview

### Purpose
Build a financial analytics system allowing Admin/Owner users to query, analyze, filter, and export quote data with arbitrary filters and aggregations.

### Key Features

**Phase 1 (MVP):**
- Analytics query builder with flexible filters
- Standard mode (individual rows) + Lightweight mode (aggregations only)
- Saved reports (personal + shared templates)
- Execution history with full audit trail
- Export to Excel/CSV with 7-day file retention
- Drill-down from lightweight to standard mode

**Phase 2 (Automation):**
- Scheduled reports (cron-based automation)
- Version control for report templates
- Email notifications with file attachments
- Redis caching for frequently-run reports (10-minute TTL)

**Phase 3 (Future):**
- Alert rules (threshold notifications)
- Report subscriptions
- Anomaly detection

### Users
- Admin/Owner only (+ future Financial Admin role)
- Organization-based multi-tenancy with RLS

### Data Volume
- Current: 500-800 quotes/month
- Quarterly reports: 1,500-2,500 quotes
- Annual reports: 6,000-10,000 quotes

---

## 2. Requirements

### Functional Requirements

1. **Query Builder**
   - Filter by any of 42 input variables (status, sale_type, seller_company, date_range, etc.)
   - Filter by calculated values (import_vat, profit, COGS, customs_duties)
   - Select specific columns for display
   - Define aggregations (sum, avg, count, min, max)

2. **Viewing Modes**
   - **Standard Mode:** ag-Grid showing individual quote rows with aggregation row at bottom
   - **Lightweight Mode:** Only aggregation cards (no individual rows) - faster for large datasets
   - **Drill-down:** Click aggregation card in lightweight mode → opens standard mode with same filters

3. **Saved Reports**
   - Save query as template with name/description
   - Mark as Personal (only creator) or Shared (all org members)
   - Version history (auto-versioned on update)
   - Revert to previous version
   - Soft delete with restore capability

4. **Execution History**
   - Audit trail of all report executions (manual, scheduled, API)
   - Snapshot of query parameters + results at execution time
   - Download original exported file (7-day retention)
   - Filter history by user, date, report type, execution type

5. **Scheduled Reports**
   - Configure cron schedule with timezone (Europe/Moscow default)
   - Email recipients list
   - Attach Excel/CSV file to email
   - Track last run status (success/failure/partial)
   - Track consecutive failures for alerting
   - Manual trigger for immediate execution

6. **Export**
   - Excel (.xlsx) or CSV format
   - Selected columns only
   - Russian number formatting (space as thousand separator, comma as decimal)
   - 7-day file retention (auto-delete after expiration)
   - Streaming export for large datasets (>2,000 quotes)

### Non-Functional Requirements

1. **Security**
   - Multi-tenant isolation via RLS
   - SQL injection protection (parameterized queries only)
   - Admin-only access with role checks
   - Audit trail for compliance (who, when, what, IP address)
   - File content validation

2. **Performance**
   - <2 seconds for queries under 2,000 quotes
   - Background processing for ≥2,000 quotes
   - Redis caching for frequent reports (10-minute TTL)
   - Streaming export for large files (prevents memory overflow)
   - Connection pooling for database operations

3. **Scalability**
   - Handle 10,000+ quotes per report
   - Concurrent queries from multiple users
   - Rate limiting (10 queries/min, 5 exports/hour per user)
   - Table partitioning ready (when >100k executions)

4. **Reliability**
   - Immutable audit logs (no UPDATE/DELETE)
   - File cleanup automation (7-day retention)
   - Graceful timeout handling
   - Comprehensive error messages
   - Automatic retry for transient failures

---

## 3. Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  Analytics │  │ Saved Reports│  │ Execution       │ │
│  │  Query     │  │  Library     │  │ History         │ │
│  │  Builder   │  │              │  │                 │ │
│  └────────────┘  └──────────────┘  └─────────────────┘ │
│         │                │                    │          │
└─────────┼────────────────┼────────────────────┼──────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API (FastAPI)                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  /api/analytics/                                  │  │
│  │    - query (standard mode)                        │  │
│  │    - aggregate (lightweight mode)                 │  │
│  │    - export (Excel/CSV with audit)                │  │
│  │    - saved-reports CRUD                           │  │
│  │    - executions (history + download)              │  │
│  │    - scheduled CRUD + run                         │  │
│  └──────────────────────────────────────────────────┘  │
│         │                                        │       │
│    ┌────▼────┐                             ┌────▼────┐ │
│    │ Security│                             │  Redis  │ │
│    │ Validator│                            │  Cache  │ │
│    └─────────┘                             └─────────┘ │
└────────┼──────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│         Database (Supabase PostgreSQL + RLS)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ saved_reports│  │ report_      │  │ scheduled_   │ │
│  │              │  │ executions   │  │ reports      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ report_      │  │ quotes       │                    │
│  │ versions     │  │ (source data)│                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│           Supabase Storage (File Storage)                │
│           - Excel/CSV exports (7-day retention)          │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Query Execution:**
```
User selects filters → POST /api/analytics/query
  ↓
Backend validates filters (security check)
  ↓
Check Redis cache (10-minute TTL)
  ↓ (cache miss)
Build parameterized SQL query
  ↓
Execute with RLS context (organization_id filter)
  ↓
Count results:
  - <2,000 quotes: Return immediately
  - ≥2,000 quotes: Background task + task_id
  ↓
Cache result in Redis (10 minutes)
  ↓
Return to frontend (ag-Grid or aggregation cards)
```

**Export Flow:**
```
User clicks Export → POST /api/analytics/export
  ↓
Execute query with RLS context
  ↓
Generate Excel/CSV file (/tmp/)
  ↓
Upload to Supabase Storage (analytics/{org_id}/)
  ↓
Create audit record in report_executions:
  - Query snapshot (filters, fields, aggregations)
  - Result summary (total_vat: 5234567, quote_count: 142)
  - File URL + expiration (7 days)
  - IP address + user agent
  ↓
Return FileResponse with auto-cleanup
```

**Scheduled Report Flow:**
```
Cron job checks scheduled_reports table every minute
  ↓
Find reports where next_run_at <= NOW() AND is_active = true
  ↓
For each scheduled report:
  - Load saved_report template
  - Execute query with current dates
  - Generate Excel file
  - Send email with attachment
  - Create execution audit record
  - Update last_run_at, next_run_at
  - Increment consecutive_failures if error
```

---

## 4. Database Schema

### 4.1 saved_reports

Stores report templates (personal or shared).

```sql
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

-- Indexes
CREATE INDEX idx_saved_reports_org ON saved_reports(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_creator ON saved_reports(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_visibility ON saved_reports(organization_id, visibility) WHERE deleted_at IS NULL;
CREATE INDEX idx_saved_reports_filters_gin ON saved_reports USING gin(filters jsonb_path_ops);

-- RLS Policies
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
```

### 4.2 report_executions (Immutable Audit Log)

Tracks all report executions with full audit trail.

```sql
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

-- Indexes
CREATE INDEX idx_report_executions_org_date ON report_executions(organization_id, executed_at DESC);
CREATE INDEX idx_report_executions_user ON report_executions(executed_by, executed_at DESC);
CREATE INDEX idx_report_executions_saved_report ON report_executions(saved_report_id) WHERE saved_report_id IS NOT NULL;
CREATE INDEX idx_report_executions_org_type_date ON report_executions(organization_id, execution_type, executed_at DESC);
CREATE INDEX idx_report_executions_file_expiry ON report_executions(file_expires_at) WHERE file_expires_at IS NOT NULL;
CREATE INDEX idx_report_executions_filters_gin ON report_executions USING gin(filters jsonb_path_ops);
CREATE INDEX idx_report_executions_date_range ON report_executions((date_range->>'start'), (date_range->>'end'));

-- RLS Policies (IMMUTABLE)
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
```

### 4.3 scheduled_reports

Configuration for automated report runs.

```sql
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

-- Indexes
CREATE INDEX idx_scheduled_reports_org ON scheduled_reports(organization_id);
CREATE INDEX idx_scheduled_reports_saved_report ON scheduled_reports(saved_report_id);
CREATE INDEX idx_scheduled_reports_active_next_run ON scheduled_reports(organization_id, next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_created_by ON scheduled_reports(created_by);

-- RLS Policies
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
```

### 4.4 report_versions (Immutable Version History)

Version control for saved reports.

```sql
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

-- Indexes
CREATE INDEX idx_report_versions_saved_report ON report_versions(saved_report_id, version_number DESC);
CREATE INDEX idx_report_versions_changed_by ON report_versions(changed_by);

-- RLS Policies (IMMUTABLE)
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
```

### 4.5 Database Triggers

#### Auto-Update Timestamps

```sql
CREATE TRIGGER update_saved_reports_updated_at
  BEFORE UPDATE ON saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### Auto-Version Tracking

```sql
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
```

#### File Cleanup Function

```sql
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

-- Schedule: Run nightly via cron or pg_cron
SELECT cron.schedule('cleanup-report-files', '0 2 * * *',
  'SELECT cleanup_expired_report_files();');
```

---

## 5. Backend API

### 5.1 Security Module (analytics_security.py)

**Critical:** Prevents SQL injection and validates all user inputs.

```python
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

### 5.2 Redis Caching (analytics_cache.py)

```python
import redis
import hashlib
import json
from typing import Optional, Dict, Any

redis_client = redis.Redis(
    host='localhost',
    port=6379,
    decode_responses=True,
    db=0
)

def get_cache_key(org_id: str, filters: Dict, fields: list, aggregations: Optional[Dict] = None) -> str:
    """Generate cache key from query parameters"""
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
    """Get cached report (TTL: 10 minutes)"""
    try:
        cached = redis_client.get(cache_key)
        return json.loads(cached) if cached else None
    except Exception as e:
        # Cache errors should not break queries
        logger.warning(f"Cache get error: {e}")
        return None


async def cache_report(cache_key: str, data: Dict[str, Any]) -> None:
    """Cache report for 10 minutes"""
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
    """Invalidate cached reports"""
    try:
        if report_id:
            # Invalidate specific report
            pattern = f"report:{org_id}:*"
            keys = redis_client.keys(pattern)
            # Check if any key matches the report_id
            for key in keys:
                redis_client.delete(key)
        else:
            # Clear all org reports
            pattern = f"report:{org_id}:*"
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
    except Exception as e:
        logger.warning(f"Cache invalidation error: {e}")
```

### 5.3 API Routes (backend/routes/analytics.py)

```python
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request
from fastapi.responses import FileResponse, StreamingResponse
from typing import List, Optional
from datetime import datetime, date, timedelta
from uuid import UUID
import os

from auth import get_current_user, User, check_admin_permissions
from models import (
    SavedReportCreate, SavedReportUpdate, SavedReport,
    ReportExecutionCreate, ReportExecution,
    ScheduledReportCreate, ScheduledReportUpdate, ScheduledReport,
    AnalyticsQueryRequest, AnalyticsQueryResponse,
    AnalyticsAggregateResponse, PaginatedResponse
)
from analytics_security import build_analytics_query, build_aggregation_query, QuerySecurityValidator
from analytics_cache import get_cached_report, cache_report, get_cache_key
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(
    prefix="/api/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_user)]
)

limiter = Limiter(key_func=get_remote_address)

# ============================================================================
# GROUP 1: SAVED REPORTS (CRUD)
# ============================================================================

@router.get("/saved-reports", response_model=List[SavedReport])
async def list_saved_reports(
    visibility: Optional[str] = Query(None, regex="^(personal|shared)$"),
    user: User = Depends(get_current_user)
):
    """List all saved report templates accessible to user."""
    await check_admin_permissions(user)

    query = supabase.table("saved_reports") \
        .select("*, versions:report_versions(version_number, created_at, changed_by)") \
        .eq("organization_id", str(user.current_organization_id)) \
        .is_("deleted_at", None) \
        .order("created_at", desc=True)

    if visibility:
        query = query.eq("visibility", visibility)

    result = query.execute()
    return result.data


@router.get("/saved-reports/{report_id}", response_model=SavedReport)
async def get_saved_report(
    report_id: str,
    user: User = Depends(get_current_user)
):
    """Get single saved report with full version history."""
    await check_admin_permissions(user)

    result = supabase.table("saved_reports") \
        .select("*, versions:report_versions(*).order(version_number.desc)") \
        .eq("id", report_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .is_("deleted_at", None) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")

    return result.data[0]


@router.post("/saved-reports", response_model=SavedReport, status_code=201)
async def create_saved_report(
    report: SavedReportCreate,
    user: User = Depends(get_current_user)
):
    """Create new saved report template."""
    await check_admin_permissions(user)

    # Validate fields
    validated_fields = QuerySecurityValidator.validate_fields(report.selected_fields)
    safe_filters = QuerySecurityValidator.sanitize_filters(report.filters)

    data = {
        "organization_id": str(user.current_organization_id),
        "created_by": str(user.id),
        "name": report.name,
        "description": report.description,
        "filters": safe_filters,
        "selected_fields": validated_fields,
        "aggregations": report.aggregations or {},
        "visibility": report.visibility
    }

    result = supabase.table("saved_reports").insert(data).execute()

    # Invalidate cache
    await invalidate_report_cache(str(user.current_organization_id))

    return result.data[0]


@router.put("/saved-reports/{report_id}", response_model=SavedReport)
async def update_saved_report(
    report_id: str,
    report: SavedReportUpdate,
    user: User = Depends(get_current_user)
):
    """
    Update saved report (creates version automatically via trigger).
    Only owner can update their personal reports.
    """
    await check_admin_permissions(user)

    # Validate if updating filters/fields
    update_data = report.dict(exclude_unset=True)
    if 'selected_fields' in update_data:
        update_data['selected_fields'] = QuerySecurityValidator.validate_fields(update_data['selected_fields'])
    if 'filters' in update_data:
        update_data['filters'] = QuerySecurityValidator.sanitize_filters(update_data['filters'])

    result = supabase.table("saved_reports") \
        .update(update_data) \
        .eq("id", report_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .eq("created_by", str(user.id)) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found or no permission")

    # Invalidate cache
    await invalidate_report_cache(str(user.current_organization_id), report_id)

    return result.data[0]


@router.delete("/saved-reports/{report_id}", status_code=204)
async def delete_saved_report(
    report_id: str,
    user: User = Depends(get_current_user)
):
    """Soft delete saved report."""
    await check_admin_permissions(user)

    result = supabase.table("saved_reports") \
        .update({"deleted_at": datetime.now().isoformat()}) \
        .eq("id", report_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .eq("created_by", str(user.id)) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found or no permission")

    # Invalidate cache
    await invalidate_report_cache(str(user.current_organization_id), report_id)


# ============================================================================
# GROUP 2: QUERY EXECUTION
# ============================================================================

@router.post("/query", response_model=AnalyticsQueryResponse)
@limiter.limit("10/minute")
async def execute_analytics_query(
    request: Request,
    query: AnalyticsQueryRequest,
    user: User = Depends(get_current_user)
):
    """
    Execute analytics query and return individual quote rows.

    Rate limit: 10 queries per minute per user.
    """
    await check_admin_permissions(user)

    # Check cache
    cache_key = get_cache_key(
        org_id=str(user.current_organization_id),
        filters=query.filters,
        fields=query.selected_fields,
        aggregations=None
    )

    cached_result = await get_cached_report(cache_key)
    if cached_result:
        return cached_result

    # Quick count check
    count_sql, count_params = build_aggregation_query(
        organization_id=user.current_organization_id,
        filters=query.filters,
        aggregations={"quote_count": {"function": "count"}}
    )

    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)

        count_result = await conn.fetchrow(count_sql, *count_params)
        total_count = count_result['quote_count']

        # If large dataset, use background task
        if total_count >= 2000:
            task_id = str(uuid.uuid4())
            background_tasks.add_task(
                execute_large_query_background,
                task_id=task_id,
                query=query,
                user=user
            )
            return {
                "task_id": task_id,
                "status": "processing",
                "message": f"Large dataset ({total_count} quotes). Processing in background...",
                "total_count": total_count
            }

        # Small dataset - execute immediately
        sql, params = build_analytics_query(
            organization_id=user.current_organization_id,
            filters=query.filters,
            selected_fields=query.selected_fields,
            limit=query.limit or 1000,
            offset=query.offset or 0
        )

        rows = await conn.fetch(sql, *params)

        result = {
            "rows": [dict(row) for row in rows],
            "count": len(rows),
            "total_count": total_count,
            "has_more": len(rows) < total_count
        }

        # Cache result
        await cache_report(cache_key, result)

        return result

    except asyncpg.PostgresError as e:
        if "statement timeout" in str(e):
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail="Query timeout - dataset too large"
            )
        else:
            logger.error(f"Database error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred"
            )
    finally:
        await conn.close()


@router.post("/aggregate", response_model=AnalyticsAggregateResponse)
@limiter.limit("10/minute")
async def execute_analytics_aggregation(
    request: Request,
    query: AnalyticsQueryRequest,
    user: User = Depends(get_current_user)
):
    """
    Execute analytics query and return ONLY aggregations (lightweight mode).

    Much faster than standard mode for large datasets.
    Rate limit: 10 queries per minute per user.
    """
    await check_admin_permissions(user)

    # Check cache
    cache_key = get_cache_key(
        org_id=str(user.current_organization_id),
        filters=query.filters,
        fields=[],
        aggregations=query.aggregations
    )

    cached_result = await get_cached_report(cache_key)
    if cached_result:
        return cached_result

    start_time = datetime.now()

    sql, params = build_aggregation_query(
        organization_id=user.current_organization_id,
        filters=query.filters,
        aggregations=query.aggregations
    )

    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)
        result_row = await conn.fetchrow(sql, *params)

        execution_time = (datetime.now() - start_time).total_seconds() * 1000

        result = {
            "aggregations": dict(result_row),
            "execution_time_ms": int(execution_time)
        }

        # Cache result
        await cache_report(cache_key, result)

        return result

    except asyncpg.PostgresError as e:
        logger.error(f"Aggregation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Aggregation query failed"
        )
    finally:
        await conn.close()


@router.post("/export", response_class=FileResponse)
@limiter.limit("5/hour")
async def export_analytics_report(
    request: Request,
    query: AnalyticsQueryRequest,
    format: str = Query("xlsx", regex="^(xlsx|csv)$"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: User = Depends(get_current_user)
):
    """
    Export analytics query results to Excel or CSV.

    Creates audit record in report_executions table.
    File expires after 7 days.
    Rate limit: 5 exports per hour per user.
    """
    await check_admin_permissions(user)

    start_time = datetime.now()

    conn = await get_db_connection()
    try:
        await set_rls_context(conn, user)

        # Build query
        sql, params = build_analytics_query(
            organization_id=user.current_organization_id,
            filters=query.filters,
            selected_fields=query.selected_fields,
            limit=100000,  # Max export size
            offset=0
        )

        rows = await conn.fetch(sql, *params)

        if len(rows) == 0:
            raise HTTPException(status_code=404, detail="No data found for export")

        # Generate file
        if format == "xlsx":
            file_path = await generate_excel_export(rows, query.selected_fields)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else:
            file_path = await generate_csv_export(rows, query.selected_fields)
            media_type = "text/csv"

        execution_time = (datetime.now() - start_time).total_seconds() * 1000

        # Upload to Supabase Storage
        file_url = await upload_to_storage(
            file_path,
            bucket="analytics",
            path=f"{user.current_organization_id}/{datetime.now():%Y%m%d}/"
        )

        # Create audit record
        await create_execution_record(
            organization_id=user.current_organization_id,
            executed_by=user.id,
            execution_type="manual",
            filters=query.filters,
            selected_fields=query.selected_fields,
            aggregations=query.aggregations,
            result_summary=calculate_summary(rows),
            quote_count=len(rows),
            export_file_url=file_url,
            export_format=format,
            file_size_bytes=os.path.getsize(file_path),
            execution_time_ms=int(execution_time),
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )

        # Schedule file cleanup
        background_tasks.add_task(os.unlink, file_path)

        filename = f"analytics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}"

        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=media_type,
            background=background_tasks
        )

    finally:
        await conn.close()


# ============================================================================
# GROUP 3: EXECUTION HISTORY (AUDIT TRAIL)
# ============================================================================

@router.get("/executions", response_model=PaginatedResponse[ReportExecution])
async def list_report_executions(
    saved_report_id: Optional[str] = None,
    execution_type: Optional[str] = Query(None, regex="^(manual|scheduled|api)$"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, le=100),
    user: User = Depends(get_current_user)
):
    """
    List execution history with pagination and filters.

    Returns audit trail including who ran the report, when, and results snapshot.
    """
    await check_admin_permissions(user)

    offset = (page - 1) * page_size

    # Count total
    count_query = supabase.table("report_executions") \
        .select("*", count="exact", head=True) \
        .eq("organization_id", str(user.current_organization_id))

    if saved_report_id:
        count_query = count_query.eq("saved_report_id", saved_report_id)
    if execution_type:
        count_query = count_query.eq("execution_type", execution_type)
    if date_from:
        count_query = count_query.gte("executed_at", date_from.isoformat())
    if date_to:
        count_query = count_query.lte("executed_at", date_to.isoformat())

    count_result = count_query.execute()
    total_count = count_result.count

    # Get page data
    query = supabase.table("report_executions") \
        .select("*") \
        .eq("organization_id", str(user.current_organization_id)) \
        .order("executed_at", desc=True) \
        .range(offset, offset + page_size - 1)

    if saved_report_id:
        query = query.eq("saved_report_id", saved_report_id)
    if execution_type:
        query = query.eq("execution_type", execution_type)
    if date_from:
        query = query.gte("executed_at", date_from.isoformat())
    if date_to:
        query = query.lte("executed_at", date_to.isoformat())

    result = query.execute()

    return {
        "items": result.data,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total_count / page_size)
    }


@router.get("/executions/{execution_id}", response_model=ReportExecution)
async def get_report_execution(
    execution_id: str,
    user: User = Depends(get_current_user)
):
    """Get detailed execution record including snapshot of results."""
    await check_admin_permissions(user)

    result = supabase.table("report_executions") \
        .select("*") \
        .eq("id", execution_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Execution not found")

    return result.data[0]


@router.get("/executions/{execution_id}/download", response_class=FileResponse)
async def download_execution_file(
    execution_id: str,
    user: User = Depends(get_current_user)
):
    """
    Download exported file from historical execution.

    Returns 410 Gone if file expired (>7 days).
    """
    await check_admin_permissions(user)

    result = supabase.table("report_executions") \
        .select("export_file_url, file_expires_at, export_format, report_name") \
        .eq("id", execution_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Execution not found")

    execution = result.data[0]

    if not execution["export_file_url"]:
        raise HTTPException(status_code=404, detail="No file available for this execution")

    if execution["file_expires_at"]:
        expiry = datetime.fromisoformat(execution["file_expires_at"])
        if expiry < datetime.now():
            raise HTTPException(
                status_code=410,
                detail="File expired (7-day retention period)"
            )

    # Download from Supabase Storage
    file_path = await download_from_storage(execution["export_file_url"])

    filename = f"{execution['report_name']}_{execution_id[:8]}.{execution['export_format']}"

    return FileResponse(
        path=file_path,
        filename=filename
    )


# ============================================================================
# GROUP 4: SCHEDULED REPORTS
# ============================================================================

@router.get("/scheduled", response_model=List[ScheduledReport])
async def list_scheduled_reports(
    is_active: Optional[bool] = None,
    user: User = Depends(get_current_user)
):
    """List all scheduled reports with last run status."""
    await check_admin_permissions(user)

    query = supabase.table("scheduled_reports") \
        .select("*, saved_report:saved_reports(name, description)") \
        .eq("organization_id", str(user.current_organization_id))

    if is_active is not None:
        query = query.eq("is_active", is_active)

    result = query.execute()
    return result.data


@router.post("/scheduled", response_model=ScheduledReport, status_code=201)
async def create_scheduled_report(
    schedule: ScheduledReportCreate,
    user: User = Depends(get_current_user)
):
    """Create new scheduled report."""
    await check_admin_permissions(user)

    # Calculate next run time
    next_run = calculate_next_run(schedule.schedule_cron, schedule.timezone)

    data = {
        **schedule.dict(),
        "organization_id": str(user.current_organization_id),
        "created_by": str(user.id),
        "next_run_at": next_run.isoformat()
    }

    result = supabase.table("scheduled_reports").insert(data).execute()
    return result.data[0]


@router.put("/scheduled/{schedule_id}", response_model=ScheduledReport)
async def update_scheduled_report(
    schedule_id: str,
    schedule: ScheduledReportUpdate,
    user: User = Depends(get_current_user)
):
    """Update scheduled report configuration."""
    await check_admin_permissions(user)

    update_data = schedule.dict(exclude_unset=True)

    # Recalculate next run if cron or timezone changed
    if 'schedule_cron' in update_data or 'timezone' in update_data:
        existing = supabase.table("scheduled_reports") \
            .select("schedule_cron, timezone") \
            .eq("id", schedule_id) \
            .eq("organization_id", str(user.current_organization_id)) \
            .execute()

        if existing.data:
            cron = update_data.get('schedule_cron', existing.data[0]['schedule_cron'])
            tz = update_data.get('timezone', existing.data[0]['timezone'])
            update_data['next_run_at'] = calculate_next_run(cron, tz).isoformat()

    result = supabase.table("scheduled_reports") \
        .update(update_data) \
        .eq("id", schedule_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Scheduled report not found")

    return result.data[0]


@router.post("/scheduled/{schedule_id}/run", response_model=ReportExecution)
async def run_scheduled_report_manually(
    schedule_id: str,
    user: User = Depends(get_current_user)
):
    """Manually trigger scheduled report execution (bypasses schedule)."""
    await check_admin_permissions(user)

    # Get schedule
    schedule_result = supabase.table("scheduled_reports") \
        .select("*, saved_report:saved_reports(*)") \
        .eq("id", schedule_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .execute()

    if not schedule_result.data:
        raise HTTPException(status_code=404, detail="Scheduled report not found")

    schedule = schedule_result.data[0]
    saved_report = schedule['saved_report']

    # Execute report
    execution = await execute_scheduled_report(
        schedule=schedule,
        saved_report=saved_report,
        user=user,
        execution_type="manual"
    )

    return execution


@router.delete("/scheduled/{schedule_id}", status_code=204)
async def delete_scheduled_report(
    schedule_id: str,
    user: User = Depends(get_current_user)
):
    """Delete scheduled report (hard delete)."""
    await check_admin_permissions(user)

    result = supabase.table("scheduled_reports") \
        .delete() \
        .eq("id", schedule_id) \
        .eq("organization_id", str(user.current_organization_id)) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
```

### 5.4 Helper Functions (analytics_helpers.py)

```python
from typing import Dict, List, Any
from datetime import datetime, timedelta
from croniter import croniter
import pytz
from io import BytesIO
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from uuid import UUID

async def create_execution_record(
    organization_id: UUID,
    executed_by: UUID,
    execution_type: str,
    filters: Dict,
    selected_fields: List[str],
    aggregations: Optional[Dict],
    result_summary: Dict,
    quote_count: int,
    export_file_url: Optional[str],
    export_format: Optional[str],
    file_size_bytes: Optional[int],
    execution_time_ms: int,
    ip_address: str,
    user_agent: Optional[str]
) -> Dict:
    """Create comprehensive audit record for report execution."""

    # Calculate file expiration (7 days)
    file_expires_at = None
    if export_file_url:
        file_expires_at = (datetime.now() + timedelta(days=7)).isoformat()

    record = {
        "organization_id": str(organization_id),
        "executed_by": str(executed_by),
        "execution_type": execution_type,
        "filters": filters,
        "selected_fields": selected_fields,
        "aggregations": aggregations or {},
        "result_summary": result_summary,
        "quote_count": quote_count,
        "export_file_url": export_file_url,
        "export_format": export_format,
        "file_size_bytes": file_size_bytes,
        "file_expires_at": file_expires_at,
        "execution_time_ms": execution_time_ms,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "executed_at": datetime.now().isoformat()
    }

    result = supabase.table("report_executions") \
        .insert(record) \
        .execute()

    # Activity log for compliance
    await log_activity(
        organization_id=organization_id,
        user_id=executed_by,
        action="report_executed",
        details={
            "type": execution_type,
            "quote_count": quote_count,
            "execution_time_ms": execution_time_ms
        }
    )

    return result.data[0]


def calculate_summary(rows: List[Dict]) -> Dict:
    """Calculate summary statistics from query results."""
    if not rows:
        return {}

    df = pd.DataFrame(rows)

    summary = {
        "quote_count": len(rows)
    }

    # Calculate sums for numeric fields
    numeric_fields = ['total_amount', 'import_vat', 'export_vat', 'customs_duty', 'cogs', 'profit']
    for field in numeric_fields:
        if field in df.columns:
            summary[f"total_{field}"] = float(df[field].sum())
            summary[f"avg_{field}"] = float(df[field].mean())

    return summary


async def generate_excel_export(rows: List[Dict], selected_fields: List[str]) -> str:
    """Generate Excel file with Russian number formatting."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Аналитика котировок"

    # Headers
    header_fill = PatternFill(start_color="FF2C5AA0", end_color="FF2C5AA0", fill_type="solid")
    header_font = Font(bold=True, size=11, color="FFFFFFFF")

    for col_idx, field in enumerate(selected_fields, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.value = field
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center')

    # Data rows
    for row_idx, row_data in enumerate(rows, start=2):
        for col_idx, field in enumerate(selected_fields, start=1):
            value = row_data.get(field)

            # Format numbers with Russian style
            if isinstance(value, (int, float, Decimal)):
                # Convert to string with space thousands and comma decimal
                formatted = f"{value:,.2f}".replace(',', ' ').replace('.', ',')
                ws.cell(row=row_idx, column=col_idx, value=formatted)
            else:
                ws.cell(row=row_idx, column=col_idx, value=value)

    # Save to temp file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"/tmp/analytics_export_{timestamp}.xlsx"
    wb.save(filename)

    return filename


async def generate_csv_export(rows: List[Dict], selected_fields: List[str]) -> str:
    """Generate CSV file."""
    df = pd.DataFrame(rows)[selected_fields]

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"/tmp/analytics_export_{timestamp}.csv"

    df.to_csv(filename, index=False, encoding='utf-8')

    return filename


async def upload_to_storage(file_path: str, bucket: str, path: str) -> str:
    """Upload file to Supabase Storage and return public URL."""
    with open(file_path, 'rb') as f:
        file_data = f.read()

    filename = os.path.basename(file_path)
    storage_path = f"{path}{filename}"

    # Upload to Supabase Storage
    result = supabase.storage.from_(bucket).upload(
        storage_path,
        file_data,
        file_options={"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
    )

    # Get public URL
    url = supabase.storage.from_(bucket).get_public_url(storage_path)

    return url


async def download_from_storage(file_url: str) -> str:
    """Download file from Supabase Storage to temp directory."""
    # Extract path from URL
    bucket = "analytics"
    path = file_url.split(f"/{bucket}/")[1]

    # Download file
    file_data = supabase.storage.from_(bucket).download(path)

    # Save to temp
    filename = os.path.basename(path)
    temp_path = f"/tmp/{filename}"

    with open(temp_path, 'wb') as f:
        f.write(file_data)

    return temp_path


def calculate_next_run(cron_expr: str, timezone: str = "Europe/Moscow") -> datetime:
    """Calculate next run time from cron expression."""
    tz = pytz.timezone(timezone)
    now = datetime.now(tz)

    cron = croniter(cron_expr, now)
    next_run = cron.get_next(datetime)

    return next_run


async def execute_scheduled_report(
    schedule: Dict,
    saved_report: Dict,
    user: User,
    execution_type: str = "scheduled"
) -> Dict:
    """Execute scheduled report and send email with attachment."""

    try:
        # Build query from saved report
        sql, params = build_analytics_query(
            organization_id=UUID(schedule['organization_id']),
            filters=saved_report['filters'],
            selected_fields=saved_report['selected_fields']
        )

        # Execute query
        conn = await get_db_connection()
        try:
            await set_rls_context(conn, user)
            rows = await conn.fetch(sql, *params)
        finally:
            await conn.close()

        # Generate Excel file
        file_path = await generate_excel_export(rows, saved_report['selected_fields'])

        # Upload to storage
        file_url = await upload_to_storage(
            file_path,
            bucket="analytics",
            path=f"{schedule['organization_id']}/scheduled/"
        )

        # Send email with attachment
        if schedule['include_file']:
            await send_report_email(
                recipients=schedule['email_recipients'],
                subject=schedule['email_subject'] or f"Scheduled Report: {saved_report['name']}",
                body=schedule['email_body'] or "Please find attached the scheduled report.",
                attachment_path=file_path
            )

        # Create execution record
        execution = await create_execution_record(
            organization_id=UUID(schedule['organization_id']),
            executed_by=user.id,
            execution_type=execution_type,
            filters=saved_report['filters'],
            selected_fields=saved_report['selected_fields'],
            aggregations=saved_report.get('aggregations'),
            result_summary=calculate_summary(rows),
            quote_count=len(rows),
            export_file_url=file_url,
            export_format="xlsx",
            file_size_bytes=os.path.getsize(file_path),
            execution_time_ms=0,  # Not tracked for scheduled
            ip_address="system",
            user_agent="scheduled_task"
        )

        # Update schedule status
        supabase.table("scheduled_reports") \
            .update({
                "last_run_at": datetime.now().isoformat(),
                "next_run_at": calculate_next_run(schedule['schedule_cron'], schedule['timezone']).isoformat(),
                "last_run_status": "success",
                "consecutive_failures": 0
            }) \
            .eq("id", schedule['id']) \
            .execute()

        # Cleanup temp file
        os.unlink(file_path)

        return execution

    except Exception as e:
        # Update schedule status
        supabase.table("scheduled_reports") \
            .update({
                "last_run_at": datetime.now().isoformat(),
                "last_run_status": "failure",
                "last_error": str(e),
                "consecutive_failures": schedule.get('consecutive_failures', 0) + 1
            }) \
            .eq("id", schedule['id']) \
            .execute()

        raise


async def send_report_email(
    recipients: List[str],
    subject: str,
    body: str,
    attachment_path: Optional[str] = None
):
    """Send email with optional attachment using email service."""
    # Implementation depends on email service (SendGrid, Mailgun, etc.)
    pass
```

---

## 6. Security Implementation

### 6.1 RLS Context Setting

```python
async def set_rls_context(conn: asyncpg.Connection, user: User):
    """Set Row-Level Security context for database connection."""
    await conn.execute(
        "SELECT set_config('app.current_organization_id', $1, false)",
        str(user.current_organization_id)
    )
    await conn.execute(
        "SELECT set_config('request.jwt.claims', $1, false)",
        json.dumps({
            "sub": str(user.id),
            "organization_id": str(user.current_organization_id),
            "role": user.current_role
        })
    )
```

### 6.2 Permission Checks

```python
async def check_admin_permissions(user: User):
    """
    Verify user has Admin/Owner role.

    Raises HTTPException 403 if user lacks permissions.
    """
    if user.current_role.lower() not in ['admin', 'owner', 'financial_admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin, Owner, or Financial Admin role required"
        )
```

### 6.3 Rate Limiting Configuration

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Rate limits:
# - Query execution: 10/minute per user
# - Export: 5/hour per user
# - Aggregate: 10/minute per user
```

---

## 7. Frontend UI

### 7.1 Page Structure

```
/app/analytics/
  page.tsx                    # Main analytics page (query builder)
  /saved/
    page.tsx                  # Saved reports library
  /history/
    page.tsx                  # Execution history
  /[executionId]/
    page.tsx                  # View single execution details
  /scheduled/
    page.tsx                  # Scheduled reports management
  /components/
    FilterPanel.tsx           # Collapsible filter cards
    AggregationCards.tsx      # Lightweight mode summary cards
    ResultsGrid.tsx           # ag-Grid with results
    ExportButtons.tsx         # Excel/CSV export
    ViewModeToggle.tsx        # Standard ↔ Lightweight toggle
```

### 7.2 Main Analytics Page (Query Builder)

```typescript
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, Row, Col, Switch, Button, message } from 'antd';
import FilterPanel from './components/FilterPanel';
import AggregationCards from './components/AggregationCards';
import ResultsGrid from './components/ResultsGrid';
import ExportButtons from './components/ExportButtons';

export default function AnalyticsPage() {
  const [viewMode, setViewMode] = useState<'standard' | 'lightweight'>('standard');
  const [filters, setFilters] = useState({});
  const [selectedFields, setSelectedFields] = useState([
    'quote_number', 'customer_name', 'total_amount', 'import_vat', 'status'
  ]);
  const [aggregations, setAggregations] = useState({
    import_vat: { function: 'sum', label: 'Total VAT' },
    total_amount: { function: 'sum', label: 'Total Revenue' },
    quote_count: { function: 'count', label: 'Number of Quotes' }
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleRunQuery = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = viewMode === 'lightweight' ? '/api/analytics/aggregate' : '/api/analytics/query';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, selected_fields: selectedFields, aggregations })
      });

      if (!response.ok) {
        throw new Error('Query failed');
      }

      const data = await response.json();
      setResults(data);

      message.success(`Query executed: ${data.quote_count || data.aggregations.quote_count} quotes found`);
    } catch (error) {
      message.error('Query failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [viewMode, filters, selectedFields, aggregations]);

  const handleDrillDown = useCallback(() => {
    // Switch from lightweight to standard mode with same filters
    setViewMode('standard');
    handleRunQuery();
  }, [handleRunQuery]);

  return (
    <div className="analytics-page" style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <h1>Financial Analytics</h1>
                <p>Query, analyze, and export quote data</p>
              </Col>
              <Col>
                <Switch
                  checked={viewMode === 'lightweight'}
                  onChange={(checked) => setViewMode(checked ? 'lightweight' : 'standard')}
                  checkedChildren="Lightweight"
                  unCheckedChildren="Standard"
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Filter Panel */}
        <Col span={24}>
          <FilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            selectedFields={selectedFields}
            onFieldsChange={setSelectedFields}
            aggregations={aggregations}
            onAggregationsChange={setAggregations}
          />
        </Col>

        {/* Run Query Button */}
        <Col span={24}>
          <Card>
            <Row gutter={16}>
              <Col>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleRunQuery}
                  loading={loading}
                >
                  Run Query
                </Button>
              </Col>
              <Col>
                <ExportButtons
                  filters={filters}
                  selectedFields={selectedFields}
                  aggregations={aggregations}
                  disabled={!results}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Results Display */}
        {results && (
          <Col span={24}>
            {viewMode === 'lightweight' ? (
              <AggregationCards
                data={results.aggregations}
                onDrillDown={handleDrillDown}
              />
            ) : (
              <ResultsGrid
                rows={results.rows}
                columns={selectedFields}
                totalCount={results.total_count}
                aggregations={aggregations}
              />
            )}
          </Col>
        )}
      </Row>
    </div>
  );
}
```

### 7.3 Key Components

**FilterPanel.tsx:** Collapsible cards for filters (similar to quote creation layout)

**AggregationCards.tsx:** Display summary cards in lightweight mode with drill-down

**ResultsGrid.tsx:** ag-Grid showing individual quotes with aggregation row at bottom

**ExportButtons.tsx:** Excel/CSV export with format selection

---

## 8. Performance Optimizations

### 8.1 Query Thresholds

- **<2,000 quotes:** Execute immediately (~1-2s response time)
- **≥2,000 quotes:** Background processing with task_id

### 8.2 Redis Caching

- **Cache key:** Hash of (org_id, filters, fields, aggregations)
- **TTL:** 10 minutes
- **Invalidation:** On new quote created/updated (webhook)

### 8.3 Database Indexes

All critical indexes already created in schema (Section 4).

### 8.4 Streaming Export

For large exports (>10,000 rows), use streaming response to prevent memory overflow.

### 8.5 Connection Pooling

Use asyncpg connection pool for better performance:

```python
import asyncpg

pool = await asyncpg.create_pool(
    dsn=DATABASE_URL,
    min_size=10,
    max_size=20,
    command_timeout=60
)

async def get_db_connection():
    return await pool.acquire()
```

---

## 9. Implementation Plan

### Phase 1: Backend Core (4-5 days)

**Day 1: Database Setup**
- Create migration with all 4 tables
- Add indexes and RLS policies
- Create triggers (auto-versioning, timestamps)
- Test RLS isolation with 2+ organizations

**Day 2-3: API Implementation**
- Security module (QuerySecurityValidator)
- Query builder (parameterized SQL)
- Saved reports CRUD endpoints
- Execution history endpoints

**Day 4: Export & Caching**
- Excel/CSV export with Russian formatting
- Supabase Storage integration
- Redis caching implementation
- File cleanup automation

**Day 5: Testing & Security Audit**
- Unit tests for security validator
- Integration tests for all endpoints
- RLS isolation testing
- SQL injection attack testing

### Phase 2: Frontend UI (3-4 days)

**Day 1: Main Analytics Page**
- Page layout and routing
- Filter panel with collapsible cards
- View mode toggle (standard ↔ lightweight)

**Day 2: Results Display**
- ag-Grid integration for standard mode
- Aggregation cards for lightweight mode
- Drill-down functionality

**Day 3: Saved Reports & History**
- Saved reports library page
- Execution history with pagination
- File download from history

**Day 4: Testing & Polish**
- E2E testing with Chrome DevTools MCP
- UX refinements
- Error handling and loading states

### Phase 3: Scheduled Reports (2-3 days)

**Day 1: Backend Scheduler**
- Scheduled reports CRUD endpoints
- Cron job for checking schedules
- Email service integration

**Day 2: Frontend UI**
- Scheduled reports management page
- Create/edit schedule form
- Manual trigger functionality

**Day 3: Testing & Deployment**
- Test scheduled execution
- Email delivery testing
- Production deployment

### Total: 9-12 days (with parallel work: ~7-9 days)

---

## 10. Testing Strategy

### 10.1 Security Testing

**SQL Injection Tests:**
- Attempt injection in filters: `'; DROP TABLE quotes; --`
- Attempt injection in field names: `* FROM auth.users --`
- Verify all attacks are blocked

**RLS Testing:**
- User A creates report
- User B (different org) cannot access
- Verify organization isolation

**Permission Testing:**
- Non-admin user attempts access → 403 Forbidden
- Admin user can access → 200 OK

### 10.2 Performance Testing

**Load Testing:**
- 100 concurrent queries
- 1,000 quote dataset
- Verify response time <2s

**Large Dataset Testing:**
- Query 10,000 quotes
- Verify background processing triggers
- Check export file generation

**Caching Testing:**
- Run same query twice
- Second run should be <100ms (cache hit)

### 10.3 Functional Testing

**Query Builder:**
- Apply multiple filters
- Select various field combinations
- Verify correct SQL generation

**Saved Reports:**
- Create, update, delete reports
- Test personal vs shared visibility
- Verify version history

**Scheduled Reports:**
- Create schedule with cron expression
- Manually trigger execution
- Verify email delivery

**Export:**
- Export to Excel and CSV
- Verify Russian number formatting
- Check 7-day file expiration

### 10.4 Integration Testing

Use Chrome DevTools MCP for E2E testing:

```bash
./.claude/scripts/testing/launch-chrome-testing.sh headless
```

**Test scenarios:**
1. Admin logs in → Opens analytics page
2. Selects filters → Runs query → Sees results
3. Switches to lightweight mode → Sees aggregation cards
4. Clicks drill-down → Opens standard mode
5. Exports to Excel → Downloads file
6. Saves report as template → Creates scheduled report
7. Views execution history → Downloads historical file

---

## Appendix A: API Endpoint Summary

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| GET | `/api/analytics/saved-reports` | List saved reports | - |
| GET | `/api/analytics/saved-reports/{id}` | Get report with versions | - |
| POST | `/api/analytics/saved-reports` | Create saved report | - |
| PUT | `/api/analytics/saved-reports/{id}` | Update saved report | - |
| DELETE | `/api/analytics/saved-reports/{id}` | Soft delete report | - |
| POST | `/api/analytics/query` | Execute query (standard) | 10/min |
| POST | `/api/analytics/aggregate` | Execute query (lightweight) | 10/min |
| POST | `/api/analytics/export` | Export to Excel/CSV | 5/hour |
| GET | `/api/analytics/executions` | List execution history | - |
| GET | `/api/analytics/executions/{id}` | Get single execution | - |
| GET | `/api/analytics/executions/{id}/download` | Download file | - |
| GET | `/api/analytics/scheduled` | List scheduled reports | - |
| POST | `/api/analytics/scheduled` | Create schedule | - |
| PUT | `/api/analytics/scheduled/{id}` | Update schedule | - |
| POST | `/api/analytics/scheduled/{id}/run` | Manual trigger | - |
| DELETE | `/api/analytics/scheduled/{id}` | Delete schedule | - |

---

## Appendix B: Configuration

### Environment Variables

```bash
# Backend
DATABASE_URL=postgresql://...
POSTGRES_DIRECT_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
REDIS_URL=redis://localhost:6379

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Redis Configuration

```bash
# Install Redis
sudo apt install redis-server

# Start Redis
sudo systemctl start redis

# Test connection
redis-cli ping  # Should return PONG
```

### File Cleanup Cron Job

```bash
# Add to crontab
0 2 * * * psql $DATABASE_URL -c "SELECT cleanup_expired_report_files();"
```

---

## Appendix C: Security Checklist

- [x] SQL injection protection (parameterized queries)
- [x] RLS context set on all database connections
- [x] Organization filter on all Supabase queries
- [x] Admin permission checks on all endpoints
- [x] Rate limiting on query/export endpoints
- [x] Field whitelisting for user inputs
- [x] Input sanitization (filters, fields, aggregations)
- [x] Audit trail (immutable execution records)
- [x] File expiration (7-day retention)
- [x] IP address + user agent logging
- [x] Error handling without information leakage
- [x] HTTPS only (enforced by Supabase)

---

**End of Design Document**

**Next Steps:**
1. Review with stakeholders
2. Create implementation tasks (using TodoWrite)
3. Set up worktree for isolated development
4. Begin Phase 1 implementation

**Questions/Feedback:**
- Design document location: `/docs/plans/2025-11-02-analytics-reporting-system-design.md`
- For implementation plan, see Section 9
- For testing strategy, see Section 10
