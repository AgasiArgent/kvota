# Common Gotchas & Bug Patterns

**Created:** 2025-10-29 20:45 UTC
**Purpose:** Pattern recognition guide to prevent repeating 41 tracked bugs
**Source:** MASTER_BUG_INVENTORY.md (verified bugs from Sessions 28-33)
**Usage:** Quick reference before coding - scan for relevant patterns in <10 seconds

---

## Overview

This document captures learnings from 41 tracked bugs across 6 sessions. Each gotcha follows the pattern:
- **Problem:** What breaks
- **Solution:** How to fix
- **Why It Matters:** Impact explanation (2-3 sentences)
- **Real Bug:** Link to actual bug instance

**Target audience:** Both human developers and AI agents
**Maintenance:** Low (patterns rarely change, update only for new categories)

---

## 🔴 Critical Gotchas (Will Break Production)

### 1. Missing Organization Filter in Multi-Tenant Queries

**Quick Fix:** Always include `organization_id` filter in Supabase queries

#### ❌ Bug Pattern
```python
# Leaks data across organizations!
quotes = supabase.table("quotes").select("*").execute()
return quotes.data  # Returns ALL organizations' quotes
```

#### ✅ Correct Pattern
```python
# Properly filtered to user's organization
quotes = supabase.table("quotes")\
    .select("*")\
    .eq("organization_id", user.organization_id)\
    .execute()
return quotes.data  # Returns only current org's quotes
```

**Why It Matters:** Without organization filtering, users see competitors' quotes, prices, and customer data. This is a critical security breach that violates data privacy regulations and destroys customer trust.

**Real Bug:** Session 33 - Quote list showed all organizations' data (common pattern across multiple endpoints)

**Deep Dive:** [→ See RLS_CHECKLIST.md for complete multi-tenant security patterns]

---

### 2. Missing Customer JOIN in Quote Endpoints

**Quick Fix:** Use Supabase nested select syntax: `.select("*, customer:customers(name, email, inn)")`

#### ❌ Bug Pattern
```python
# Only returns customer_id, not customer object
quote = supabase.table("quotes")\
    .select("*")\
    .eq("id", quote_id)\
    .single()\
    .execute()
# quote.data.customer_id = UUID
# quote.data.customer = undefined ❌
```

#### ✅ Correct Pattern
```python
# Returns nested customer object
quote = supabase.table("quotes")\
    .select("*, customer:customers(name, email, inn)")\
    .eq("id", quote_id)\
    .single()\
    .execute()
# quote.data.customer = {name: "...", email: "...", inn: "..."} ✅
```

**Why It Matters:** Frontend displays blank customer name in quote detail page. Users cannot identify which customer the quote is for, breaking the review workflow.

**Real Bug:** BUG-001 - Client field blank on quote detail page (NOT FIXED)

**Deep Dive:** [→ Skill: backend-queries] *(Coming in Phase 1)*

---

### 3. Case-Sensitive Role Checks

**Quick Fix:** Always use `.toLowerCase()` when comparing user roles

#### ❌ Bug Pattern
```typescript
// Breaks if role is "Admin" instead of "admin"
if (user.role === 'admin') {
  showAdminMenu();
}
```

#### ✅ Correct Pattern
```typescript
// Works with "Admin", "ADMIN", "admin"
if (user.role.toLowerCase() === 'admin') {
  showAdminMenu();
}
```

**Why It Matters:** Admin users cannot access team management page because Supabase returns "Admin" (capital A) but code checks for "admin" (lowercase). This blocks critical administrative functions.

**Real Bug:** BUG-006 - Team menu not visible for admin users (Session 33, FIXED)
**Fix Location:** `frontend/src/components/layout/MainLayout.tsx:120, 128`

**Deep Dive:** [→ Skill: frontend-patterns] *(Coming in Phase 1)*

---

### 4. Activity Log Decorator Not Applied to Critical Endpoints

**Quick Fix:** Add `@log_activity_decorator` to all CRUD and export endpoints

#### ❌ Bug Pattern
```python
# Quote creation not logged ❌
@router.post("/api/quotes/calculate")
async def create_quote(data: QuoteInput):
    # No @log_activity_decorator
    result = await calculation_engine(data)
    return result
```

#### ✅ Correct Pattern
```python
# Quote creation logged ✅
from services.activity_log_service import log_activity_decorator

@router.post("/api/quotes/calculate")
@log_activity_decorator(
    action_type="create",
    entity_type="quote"
)
async def create_quote(data: QuoteInput):
    result = await calculation_engine(data)
    return result
```

**Why It Matters:** Activity log page shows empty data for quote creation and export actions. This breaks audit trails required for compliance and makes debugging user issues impossible.

**Real Bug:** BUG-003 - Activity log incomplete (PARTIALLY FIXED - decorator exists but not applied)
**Status:** Decorator implemented, applied to customers/quotes CRUD, but NOT applied to quote creation endpoint (`routes/quotes_calc.py`)

**Deep Dive:** [→ See backend/services/activity_log_service.py:70-118]

---

## 🟡 High-Priority Gotchas (Will Break UX)

### 5. No Form Validation Feedback

**Quick Fix:** Add `rules` prop to all Form.Item components for required fields

#### ❌ Bug Pattern
```tsx
// No validation - silent failure
<Form.Item name="customer_id" label="Customer">
  <Select />
</Form.Item>
```

#### ✅ Correct Pattern
```tsx
// Clear validation with red border and error message
<Form.Item
  name="customer_id"
  label="Customer"
  rules={[{ required: true, message: 'Пожалуйста, выберите клиента' }]}
>
  <Select />
</Form.Item>
```

**Why It Matters:** Users submit forms without knowing what's required, get confused when submission fails with no feedback. This creates frustration and support tickets.

**Real Bug:** BUG-002 - No validation feedback on quote creation form (NOT FIXED)
**Related:** BUG-007 - Incomplete validation for 4 critical fields (Session 33, FIXED)

**Deep Dive:** [→ Skill: frontend-forms] *(Coming in Phase 1)*

---

### 6. Ant Design Deprecated APIs

**Quick Fix:** Use `menu` prop instead of `overlay` for Dropdowns

#### ❌ Bug Pattern
```tsx
// Deprecated - dropdown doesn't work
<Dropdown overlay={menu}>
  <Button>Actions</Button>
</Dropdown>
```

#### ✅ Correct Pattern
```tsx
// Modern API - works correctly
const menuItems = [
  { key: '1', label: 'Edit' },
  { key: '2', label: 'Delete' }
];

<Dropdown menu={{ items: menuItems }}>
  <Button>Actions</Button>
</Dropdown>
```

**Why It Matters:** Export dropdown in quote detail page uses deprecated `overlay` prop, causing dropdown menu to not appear or work incorrectly. This blocks the export workflow entirely.

**Real Bug:** BUG-040 - Export dropdown bug due to deprecated API (NOT FIXED)
**Impact:** Users cannot export quotes (critical workflow blocker)
**Location:** `frontend/src/app/quotes/[id]/page.tsx:414`

**Deep Dive:** [→ See Ant Design v5 migration guide]

---

## 🟢 Medium-Priority Gotchas (Performance/Security)

### 7. Missing RLS Policies on New Tables

**Quick Fix:** Always enable RLS and create 4 policies (SELECT, INSERT, UPDATE, DELETE) for every new table

#### ❌ Bug Pattern
```sql
-- Missing RLS = data leak
CREATE TABLE new_feature (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  data jsonb
);
-- No RLS enabled ❌
```

#### ✅ Correct Pattern
```sql
-- RLS enabled with policies
CREATE TABLE new_feature (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  data jsonb
);

-- Enable RLS
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

-- Create 4 policies (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Users can view their org's records"
  ON new_feature FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- (Repeat for INSERT, UPDATE, DELETE)
```

**Why It Matters:** Without RLS, multi-tenant isolation breaks silently. All organizations can see each other's data even with proper frontend filtering.

**Real Bug:** Common pattern across multiple tables (caught during code reviews)

**Deep Dive:** [→ RLS_CHECKLIST.md for complete template]

---

### 8. Concurrent Request Performance Bottleneck

**Quick Fix:** Use `async_supabase_call()` wrapper for all Supabase operations

#### ❌ Bug Pattern
```python
# Blocks entire event loop during I/O
result = supabase.table("quotes").select("*").execute()
# 66x slower with 20 concurrent requests
```

#### ✅ Correct Pattern
```python
# Non-blocking I/O with thread pool
from async_supabase import async_supabase_call

result = await async_supabase_call(
    lambda: supabase.table("quotes").select("*").execute()
)
# Handles 50+ concurrent users smoothly
```

**Why It Matters:** System slows down 66x with just 20 concurrent users. Under load, API response times go from 100ms to 6+ seconds, making the app unusable.

**Real Bug:** BUG-038 - Concurrent request performance (INFRASTRUCTURE READY, needs deployment)
**Status:** Wrapper exists (`backend/async_supabase.py`), but only 1 file uses it
**Remaining work:** Apply to `quotes_calc.py`, `customers.py`, `calculation_settings.py` (2-3 hours)

**Deep Dive:** [→ See backend/async_supabase.py]

---

### 9. Excel/PDF Export UUID Type Errors

**Quick Fix:** Convert UUID to string before using `.replace()` or string operations

#### ❌ Bug Pattern
```python
# TypeError: UUID object has no attribute 'replace'
quote_number = quote.id  # UUID object
filename = f"quote_{quote_number.replace('-', '_')}.pdf"  # ❌ Crashes
```

#### ✅ Correct Pattern
```python
# Convert to string first
quote_number = str(quote.id)  # Now a string
filename = f"quote_{quote_number.replace('-', '_')}.pdf"  # ✅ Works
```

**Why It Matters:** PDF exports create files but crash with 500 error before sending to client. User sees "Download failed" even though file was generated successfully.

**Real Bug:** BUG-023 - PDF export failing with 500 error (Session 30, FIXED)
**Fix Location:** `backend/routes/quotes.py:1598, 1612, 1832`

**Deep Dive:** [→ Skill: backend-patterns] *(Coming in Phase 1)*

---

## 💻 WSL2-Specific Gotchas

### 10. Chrome DevTools Freezing WSL2

**Quick Fix:** Monitor memory usage, kill Chrome when reaching 75% of WSL2 limit

#### ⚠️ Problem Pattern
```bash
# Chrome accumulates memory over time
# Memory: 500MB → 1GB → 2GB → 4GB
# WSL2 becomes unresponsive at 85% memory usage
# VS Code disconnects, can't reconnect without restart
```

#### ✅ Prevention Pattern
```bash
# Use resource-optimized testing workflow
./.claude/scripts/testing/safe-test-session.sh headless http://localhost:3001 10

# Or monitor manually
./.claude/scripts/monitoring/monitor-wsl-resources.sh
# Kill Chrome when memory hits 75%
./.claude/scripts/testing/launch-chrome-testing.sh kill
```

**Why It Matters:** Chrome memory accumulation pushes WSL2 to limits, causing VS Code disconnections and requiring WSL2 restart (8 seconds downtime). This disrupts development flow and loses uncommitted work.

**Real Bug:** Common issue during extended testing sessions (multiple occurrences)

**Deep Dive:** [→ See .claude/scripts/README.md for complete prevention guide]

---

### 11. File Path Issues (Windows vs Linux)

**Quick Fix:** Always use WSL2 paths (`/home/user/...`) not Windows paths (`C:\...`)

#### ❌ Bug Pattern
```python
# Windows path doesn't work in WSL2
file_path = "C:\\Users\\Lenovo\\project\\data.csv"  # ❌
with open(file_path) as f:  # FileNotFoundError
```

#### ✅ Correct Pattern
```python
# WSL2 path works correctly
file_path = "/home/novi/quotation-app-dev/data.csv"  # ✅
with open(file_path) as f:  # Works
```

**Why It Matters:** File operations fail silently or with confusing errors. Particularly affects file uploads, exports, and Chrome DevTools screenshot paths.

**Real Bug:** Multiple file upload issues during Session 17 automation testing

**Deep Dive:** [→ CLAUDE.md - Development Environment section]

---

## 📊 ag-Grid Gotchas

### 12. Column Definitions Not Reactive

**Quick Fix:** Recreate columnDefs array when data changes, don't mutate in place

#### ❌ Bug Pattern
```typescript
// Mutation doesn't trigger re-render
columnDefs.push(newColumn);  // ❌ Grid doesn't update
```

#### ✅ Correct Pattern
```typescript
// Create new array to trigger React re-render
setColumnDefs([...columnDefs, newColumn]);  // ✅ Grid updates
```

**Why It Matters:** Adding columns dynamically (e.g., after Excel import) doesn't show in grid. Users must refresh page to see changes.

**Real Bug:** Multiple instances during ag-Grid restructure (Sessions 8-14)

**Deep Dive:** [→ Skill: ag-grid-patterns] *(Coming in Phase 1)*

---

### 13. Grid API Not Available on Mount

**Quick Fix:** Access grid API only in `onGridReady` callback or after mount

#### ❌ Bug Pattern
```typescript
// gridRef.current is null during mount
useEffect(() => {
  gridRef.current.api.sizeColumnsToFit();  // ❌ Cannot read api of null
}, []);
```

#### ✅ Correct Pattern
```typescript
// Wait for grid ready
const onGridReady = (params: GridReadyEvent) => {
  params.api.sizeColumnsToFit();  // ✅ API available
};

<AgGridReact onGridReady={onGridReady} />
```

**Why It Matters:** Grid operations fail silently on page load, breaking auto-sizing and filters.

**Real Bug:** Common pattern during ag-Grid implementation (Sessions 8-14)

**Deep Dive:** [→ ag-Grid React lifecycle docs]

---

### 14. Cell Renderers Not Re-rendering

**Quick Fix:** Use `params.node.setData()` to trigger cell re-render

#### ❌ Bug Pattern
```typescript
// Mutating data doesn't update cell display
params.data.status = 'approved';  // ❌ Cell shows old value
```

#### ✅ Correct Pattern
```typescript
// Trigger re-render explicitly
const rowData = {...params.data, status: 'approved'};
params.node.setData(rowData);  // ✅ Cell updates
```

**Why It Matters:** Status changes in grid cells don't reflect visually until full page refresh.

**Real Bug:** Cell color coding not updating during quote edit (Session 14)

**Deep Dive:** [→ ag-Grid cell rendering docs]

---

## 🧮 Calculation Engine Gotchas

### 15. Missing Variable Validation

**Quick Fix:** Validate ALL required fields before sending to calculation engine

#### ❌ Bug Pattern
```python
# Missing validation - calculation fails with cryptic error
calculation_input = {
    "sku": None,  # ❌ Required field
    "quantity": 0,  # ❌ Must be > 0
    "currency_base": ""  # ❌ Required field
}
result = calculate(calculation_input)  # Fails deep in calculation
```

#### ✅ Correct Pattern
```python
# Validate before calculation
errors = []
if not calculation_input.get("sku"):
    errors.append("SKU is required")
if calculation_input.get("quantity", 0) <= 0:
    errors.append("Quantity must be greater than 0")
if not calculation_input.get("currency_base"):
    errors.append("Base currency is required")

if errors:
    return {"error": errors}  # ✅ Clear error messages

result = calculate(calculation_input)
```

**Why It Matters:** Calculation engine crashes with vague errors deep in formula logic. Users don't know what's wrong or how to fix it.

**Real Bug:** Multiple validation gaps found during Session 15 integration

**Deep Dive:** [→ CALCULATION_PATTERNS.md for validation rules]

---

### 16. Two-Tier Variable Precedence Issues

**Quick Fix:** Use `get_value()` helper function to respect product override > quote default

#### ❌ Bug Pattern
```python
# Always uses quote default, ignores product override
rate_forex = quote_data.get("rate_forex")  # ❌ Missing product override
```

#### ✅ Correct Pattern
```python
# Respects two-tier system
def get_value(product, quote, field):
    product_val = product.get(field)
    if product_val is not None and product_val != "":
        return product_val  # Product override
    return quote.get(field)  # Quote default

rate_forex = get_value(product, quote, "rate_forex")  # ✅ Correct precedence
```

**Why It Matters:** Product-specific overrides are ignored, calculations use wrong values. Quotes for special products show incorrect pricing.

**Real Bug:** Commission distribution bug (BUG-024, Session 29, FIXED)

**Deep Dive:** [→ CALCULATION_PATTERNS.md - Two-Tier System]

---

## 📝 TypeScript Gotchas

### 17. ag-Grid Ref Type Incompatibility

**Quick Fix:** Use `useRef<any>` instead of `useRef<AgGridReact>` for ag-Grid refs

#### ❌ Bug Pattern
```typescript
// Type error blocks CI
const gridRef = useRef<AgGridReact>(null);  // ❌ Type incompatibility
```

#### ✅ Correct Pattern
```typescript
// Works with ag-Grid 34.x
const gridRef = useRef<any>(null);  // ✅ No type errors
// @ts-expect-error ag-Grid ref type incompatibility
<AgGridReact ref={gridRef} />
```

**Why It Matters:** TypeScript errors block CI pipeline, preventing deployments even though code works at runtime.

**Real Bug:** BUG-021 - TypeScript errors blocking CI (Session 30, FIXED)
**Fix Location:** `frontend/src/app/quotes/[id]/edit/page.tsx` + `quotes/create/page.tsx`

**Deep Dive:** [→ ag-Grid TypeScript docs]

---

### 18. React 19 Compatibility Warning

**Quick Fix:** Acknowledge warning, continue using React 19 (Ant Design works in practice)

#### ⚠️ Warning Message
```
Warning: [antd: compatible] antd v5 support React is 16 ~ 18.
see https://u.ant.design/v5-for-19 for compatible.
```

#### ✅ Current Approach
```json
// package.json
{
  "dependencies": {
    "react": "19.1.0",  // Continue using React 19
    "antd": "5.27.4"    // Works in practice despite warning
  }
}
```

**Why It Matters:** Application works fine in practice, but unsupported configuration may have edge case bugs. Team decision needed: downgrade to React 18 or continue with warnings.

**Real Bug:** BUG-043 - React 19 compatibility warning (NEEDS DISCUSSION)

**Deep Dive:** [→ TECHNICAL_DEBT.md:1918-1941]

---

## Prevention Checklists

### Backend Endpoint Checklist
- [ ] Add organization_id filter for multi-tenant tables
- [ ] Use nested select for related entities (`.select("*, related:table(*)")`)
- [ ] Apply `@log_activity_decorator` for CRUD operations
- [ ] Validate all required fields before processing
- [ ] Convert UUIDs to strings before string operations
- [ ] Use `async_supabase_call()` wrapper for Supabase queries
- [ ] Return all errors at once (not just first error)

### Frontend Component Checklist
- [ ] Add validation rules to Form.Item for required fields
- [ ] Use lowercase comparison for role checks
- [ ] Convert Ant Design deprecated APIs (overlay → menu, bordered → variant)
- [ ] Access ag-Grid API only in `onGridReady` callback
- [ ] Create new columnDefs array (don't mutate) for grid updates
- [ ] Handle React 19 + Ant Design warnings gracefully
- [ ] Use WSL2 paths (not Windows paths) for file operations

### Testing Checklist
- [ ] Test with multiple organizations (multi-tenant isolation)
- [ ] Test with 20+ concurrent requests (performance)
- [ ] Test with empty/null values (validation edge cases)
- [ ] Monitor WSL2 memory during Chrome DevTools testing

### Calculation Changes Checklist
- [ ] Validate all 10 required fields
- [ ] Test two-tier variable precedence (product override vs quote default)
- [ ] Verify commission distribution across products

### Database Migration Checklist
- [ ] Add organization_id column (uuid NOT NULL)
- [ ] Create index on organization_id
- [ ] Enable RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Create 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Verify RLS with test queries

---

## Quick Reference Links

**Documentation:**
- [VARIABLES.md](.claude/VARIABLES.md) - 42 variables reference
- [CALCULATION_PATTERNS.md](.claude/CALCULATION_PATTERNS.md) - Validation rules and two-tier system
- [RLS_CHECKLIST.md](.claude/RLS_CHECKLIST.md) - Multi-tenant security templates
- [MASTER_BUG_INVENTORY.md](.claude/MASTER_BUG_INVENTORY.md) - All 41 tracked bugs

**Code References:**
- Activity log decorator: `backend/services/activity_log_service.py:70-118`
- Async Supabase wrapper: `backend/async_supabase.py`
- Calculation validation: `backend/routes/quotes_calc.py` (validate_calculation_input)
- Two-tier system: `backend/routes/quotes_calc.py` (get_value helper)

**Testing Tools:**
- Chrome DevTools MCP: `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`
- Safe test session: `.claude/scripts/testing/safe-test-session.sh`
- Resource monitor: `.claude/scripts/monitoring/monitor-wsl-resources.sh`

---

**Last Updated:** 2025-10-29 20:45 UTC
**Total Gotchas:** 18 (3 Critical, 2 High, 3 Medium, 2 WSL2, 3 ag-Grid, 2 Calculation, 2 TypeScript, 1 Database)
**Maintenance:** Update when discovering new categories or critical patterns
