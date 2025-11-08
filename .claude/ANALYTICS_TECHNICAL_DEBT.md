# Analytics System - Technical Debt

**Created:** 2025-11-08
**Session:** Testing Session (Manual Analytics Testing)

---

## 1. Drill-Down from Lightweight Mode (Test 1.9)

**Priority:** Medium
**Status:** Deferred
**Estimated Effort:** 30 min

**Problem:**
Clicking on aggregation cards in Lightweight mode should switch to Standard mode and show the detailed table with same filters. Currently:
- Switch to Standard mode works ✅
- But grid shows loading spinner forever (query doesn't complete)

**Current Code:**
```tsx
<Card hoverable onClick={() => {
  setViewMode('standard');
  handleExecuteQuery();
}}>
  <Statistic title={label} value={value} />
</Card>
```

**Root Cause:**
Unknown - need to debug why `handleExecuteQuery()` hangs when called from card click.

**Possible Solutions:**
1. Add `await` and error handling to card click
2. Clear aggregationResults state before switching modes
3. Use `setTimeout` to delay query execution until mode switch completes

**Impact:**
Low - users can manually switch to Standard mode and click "Execute Query" button as workaround.

---

## 2. Mixed Aggregations Duplicate Quote-Level Values

**Priority:** HIGH
**Status:** Known Issue
**Estimated Effort:** 2-3 hours

**Problem:**
When aggregating both quote-level fields (`total_amount`) and calculated fields (`customs_duty`) in same query, quote-level values are duplicated by the number of products.

**Example:**
- 1 КП with 5 products, total_amount = 7983.36
- Query result: `SUM(total_amount) = 39916.80` (7983.36 × 5) ❌
- Expected: `7983.36` ✅

**Root Cause:**
```sql
SELECT
  COALESCE(SUM(q.total_amount), 0) as sum_total_amount,  -- Duplicated 5 times!
  COALESCE(SUM((qcr.phase_results->>'customs_fee')::numeric), 0) as sum_customs_duty
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id  -- Creates 5 rows per quote
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE q.organization_id = $1
```

Each product creates a separate row in JOIN, so `q.total_amount` gets summed 5 times.

**Current Workaround:**
Users can only aggregate quote-level OR calculated fields separately, not together.

**Proposed Solutions:**

### Solution A: Add Aggregated Columns to `quotes` Table (RECOMMENDED)
**Effort:** 4-6 hours (migration + update logic + backfill)

Add columns to `quotes`:
- `total_customs_duty DECIMAL(15,2)`
- `total_import_vat DECIMAL(15,2)`
- `total_logistics_cost DECIMAL(15,2)`
- `total_cogs DECIMAL(15,2)`
- `total_profit DECIMAL(15,2)`

**Pros:**
- Simple, fast queries (no JOIN needed)
- No duplication issues
- Better performance for analytics

**Cons:**
- Requires migration
- Need to update quote creation/update logic
- Need to backfill existing quotes (~34 records)

**Implementation:**
1. Create migration `023_add_quote_aggregates.sql`
2. Update `backend/routes/quotes_calc.py` to save aggregates when creating/updating quote
3. Backfill script: sum values from `quote_calculation_results` for each quote
4. Update `analytics_security.py` to use quote columns instead of JOIN

### Solution B: Two Separate Queries
**Effort:** 2-3 hours

Split aggregations into two groups:
1. Quote-level aggregations (no JOIN)
2. Calculated aggregations (with JOIN)

Execute both queries and merge results.

**Pros:**
- No schema changes
- Works immediately

**Cons:**
- Two database queries instead of one
- More complex code
- Still slower than Solution A

**Implementation:**
Modify `backend/routes/analytics.py` aggregate endpoint:
```python
# Separate aggregations by type
quote_aggs = {k: v for k, v in aggs.items() if v['field'] in QUOTE_FIELDS}
calc_aggs = {k: v for k, v in aggs.items() if v['field'] in CALC_FIELDS}

# Execute quote aggregations (no JOIN)
sql1, params1 = build_aggregation_query(org_id, filters, quote_aggs)
result1 = await conn.fetchrow(sql1, *params1)

# Execute calculated aggregations (with JOIN)
sql2, params2 = build_aggregation_query(org_id, filters, calc_aggs)
result2 = await conn.fetchrow(sql2, *params2)

# Merge results
final_result = {**dict(result1), **dict(result2)}
```

### Solution C: Subquery for Quote Fields
**Effort:** 1-2 hours

Use correlated subquery for quote-level fields in mixed aggregations:

```sql
SELECT
  (SELECT SUM(total_amount) FROM quotes q2
   WHERE q2.organization_id = $1 AND q2.id IN (
     SELECT DISTINCT q.id FROM quotes q
     LEFT JOIN quote_calculation_variables qcv ON qcv.quote_id = q.id
     WHERE ...filters...
   )) as sum_total_amount,
  COALESCE(SUM((qcr.phase_results->>'customs_fee')::numeric), 0) as sum_customs_duty
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE ...
```

**Pros:**
- Single query
- No schema changes

**Cons:**
- Complex SQL
- Potentially slower
- Harder to maintain

---

## 3. Import VAT Not Calculated

**Priority:** Low
**Status:** TODO
**Estimated Effort:** Unknown

**Problem:**
`import_vat` field returns `0` in all queries. Need to research where this value is stored/calculated.

**Current Code:**
```python
# analytics_security.py:194
elif field == 'import_vat':
    # TODO: Research how import_vat is calculated/stored
    # For now, return 0 as placeholder
    select_clauses.append("0 as import_vat")
```

**Investigation Needed:**
1. Check calculation engine code for import VAT
2. Check if it's stored in `quote_calculation_results.phase_results`
3. Find correct JSONB key or formula

---

## 4. Scheduled Reports Module Not Implemented

**Priority:** Medium
**Status:** Not Started
**Estimated Effort:** 8-12 hours

**Problem:**
The scheduled reports functionality (`/analytics/scheduled`) is only partially implemented with UI stub. Backend endpoints and scheduling infrastructure are missing.

**Current State:**
- ✅ Frontend page exists at `/analytics/scheduled`
- ✅ TypeScript interfaces defined in `analytics-service.ts`
- ❌ Backend API endpoints not implemented
- ❌ No cron job scheduler
- ❌ No email sending integration
- ❌ Cannot create, edit, or run scheduled reports

**What's Missing:**

### Backend API Endpoints
Need to implement in `backend/routes/analytics.py`:
```python
@router.get("/scheduled")
async def get_scheduled_reports() -> List[ScheduledReport]

@router.post("/scheduled")
async def create_scheduled_report(data: ScheduledReportCreate) -> ScheduledReport

@router.put("/scheduled/{report_id}")
async def update_scheduled_report(report_id: str, data: ScheduledReportUpdate) -> ScheduledReport

@router.delete("/scheduled/{report_id}")
async def delete_scheduled_report(report_id: str)

@router.post("/scheduled/{report_id}/run")
async def run_scheduled_report(report_id: str) -> dict
```

### Database Tables
Need migration to create:
```sql
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    saved_report_id UUID NOT NULL REFERENCES saved_reports(id),
    name VARCHAR(255) NOT NULL,
    schedule_cron VARCHAR(100) NOT NULL,  -- e.g., "0 9 * * 1" (Mondays 9am)
    timezone VARCHAR(50) DEFAULT 'UTC',
    email_recipients TEXT[] NOT NULL,
    include_file BOOLEAN DEFAULT true,
    email_subject TEXT,
    email_body TEXT,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(20),  -- 'success', 'failure', 'partial'
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_org ON scheduled_reports(organization_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
```

### Scheduler Service
Need to implement cron job runner:
- Option 1: Python `APScheduler` library
- Option 2: PostgreSQL `pg_cron` extension
- Option 3: External service (Celery + Redis)

**Recommended:** APScheduler for simplicity

### Email Integration
Need to add email sending:
- SMTP configuration (environment variables)
- Email templates (HTML + plain text)
- Attachment handling (Excel/CSV files)
- Retry logic for failed sends

### Testing Gaps
Test suites 4-8 cannot be completed without implementation:
- Test 4.x: Create scheduled report
- Test 5.x: Edit scheduled report
- Test 6.x: Trigger manual run
- Test 7.x: Deactivate schedule
- Test 8.x: View schedule history

**Implementation Order:**
1. Database migration (1 hour)
2. Backend API endpoints (3-4 hours)
3. Scheduler service (2-3 hours)
4. Email integration (2-3 hours)
5. Frontend integration testing (1 hour)

**Dependencies:**
- Email server configuration (SMTP credentials)
- Decision on scheduler architecture
- File storage for generated reports (S3 or local)

**Workaround:**
Users can export manually from analytics page and send via email themselves.

---

## Recommendation

**For Production:** Implement **Solution A** (add aggregated columns to quotes table)

**Reasoning:**
1. One-time effort vs ongoing complexity
2. Much better performance (no JOINs)
3. Simpler analytics queries
4. Only 34 existing quotes to backfill
5. Future-proof solution

**Implementation Plan:**
1. Create migration with new columns
2. Update quote creation endpoint to calculate and save aggregates
3. Write backfill script
4. Update analytics whitelist to include new fields
5. Test with existing filters

**Total Effort:** ~6 hours
**Performance Gain:** 5-10x faster analytics queries

---

**Last Updated:** 2025-11-08 07:30 UTC
