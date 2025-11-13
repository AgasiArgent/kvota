# Quick Wins - 75 Minutes of Immediate Value

**Created:** 2025-10-29 15:00 UTC
**Time Required:** 75 minutes
**Can Do Today:** Yes
**Impact:** Immediate bug prevention and developer reference

---

## Overview

These three documents provide **immediate value** with minimal effort:
1. Extract knowledge from existing bug tracking
2. Document calculation patterns
3. Create RLS verification checklist

**No infrastructure changes** - just capture knowledge that's already in your head/docs.

---

## Task 1: Common Gotchas Document (30 minutes)

**Goal:** Extract learnings from 41 tracked bugs and prevent repeating mistakes.

**Source:** `.claude/MASTER_BUG_INVENTORY.md` (41 bugs documented)

**Create:** `.claude/COMMON_GOTCHAS.md`

### Content Structure

```markdown
# Common Gotchas & Bug Patterns

**Last Updated:** 2025-10-29
**Source:** MASTER_BUG_INVENTORY.md (41 bugs analyzed)
**Purpose:** Prevent repeating past mistakes

---

## Critical Gotchas (Will Break Production)

### 1. Missing Customer JOIN in Quote Endpoints

**Bug:** BUG-001 - Client field shows blank on quote detail page

**Symptom:** Quote detail shows blank for "Клиент" field

**Root Cause:** Backend returns `customer_id` but not customer object

**Fix:**
```python
# ❌ WRONG - Returns only ID
.select("*")

# ✅ CORRECT - Returns customer details
.select("*, customer:customers(name, email, inn)")
```

**Files to Check:**
- Any endpoint returning quotes
- Quote list, detail, approval pages

**Prevention:** Always JOIN related tables when displaying entities

---

### 2. Case-Sensitive Role Checks

**Bug:** BUG-006 - Team menu not visible for admin users

**Symptom:** "Команда" submenu missing in Settings for admin users

**Root Cause:** Role stored as "Admin" but code checks for "admin"

**Fix:**
```typescript
// ❌ WRONG - Case sensitive
if (userRole === 'admin')

// ✅ CORRECT - Case insensitive
if (userRole.toLowerCase() === 'admin')
```

**Files to Check:**
- MainLayout.tsx
- Any component with role-based rendering
- Backend permission checks

**Prevention:** Always use `.toLowerCase()` for role comparisons

---

### 3. Activity Log Decorator Not Applied

**Bug:** BUG-003 - Activity log not recording quote creation

**Symptom:** Activity log empty for quote creation actions

**Root Cause:** Decorator exists but not applied to all endpoints

**Fix:**
```python
# ✅ Apply decorator to ALL mutation endpoints
@router.post("/api/quotes/calculate")
@log_activity_decorator(
    action="create",
    entity_type="quote",
    entity_id_field="id"
)
async def calculate_quote(...):
    ...
```

**Files to Check:**
- routes/quotes_calc.py - Missing decorators
- Any new CRUD endpoints

**Prevention:** Checklist all new endpoints for activity logging

---

## High-Priority Gotchas (Will Break UX)

### 4. No Form Validation Feedback

**Bug:** BUG-002 - No validation feedback on quote creation

**Symptom:** Form validation errors don't show to users

**Root Cause:** No validation rules, error messages, or visual feedback

**Fix:**
```typescript
// Add to Ant Design Form.Item
<Form.Item
  name="client_id"
  label="Клиент"
  rules={[
    { required: true, message: 'Пожалуйста, выберите клиента' }
  ]}
  required // Shows asterisk (*)
>
  <Select />
</Form.Item>
```

**Prevention:**
- All required fields must have `rules` prop
- All required fields must have `required` prop (shows *)
- Show validation summary on submit error

---

### 5. Deprecated Ant Design APIs

**Bug:** BUG-034, BUG-040 - Deprecated APIs cause warnings/bugs

**Symptom:** Console warnings, dropdown bugs

**Root Cause:** Using old Ant Design v4 patterns in v5

**Fix:**
```typescript
// ❌ WRONG - Deprecated in v5
<Button type="ghost">...</Button>
dropdownMatchSelectWidth={false}

// ✅ CORRECT - v5 syntax
<Button type="default" variant="outlined">...</Button>
dropdownStyle={{ width: 'auto' }}
```

**Files Affected:**
- Any component using Ant Design dropdowns/buttons

**Prevention:** Check Ant Design v5 migration guide when adding components

---

## Medium-Priority Gotchas (Performance/Security)

### 6. Missing RLS Policies on New Tables

**Bug Pattern:** New tables often missing organization isolation

**Symptom:** Users can see other organizations' data

**Root Cause:** Forgot to add RLS policies to new tables

**Fix:** See RLS CHECKLIST section below

**Prevention:** Use checklist for every new table/migration

---

### 7. Concurrent Request Performance

**Bug:** BUG-038 - 66x slowdown with concurrent requests

**Symptom:** API becomes extremely slow under load

**Root Cause:** Missing connection pooling, async wrappers

**Fix:**
```python
# ✅ Use concurrent-safe wrapper
from utils.concurrent_safe import concurrent_safe_supabase

@concurrent_safe_supabase
async def get_quotes(...):
    ...
```

**Files to Check:**
- All route handlers (90% need wrapper)

**Prevention:** Apply wrapper to all new endpoints

---

### 8. Excel/PDF Export UUID Bugs

**Bug Pattern:** Export generates but can't be downloaded

**Symptom:** File created but 404 on download

**Root Cause:** UUID not properly tracked or cleaned up

**Fix:**
```python
# Generate unique filename
export_id = str(uuid.uuid4())
filepath = f"/tmp/quote_export_{export_id}.xlsx"

# Return in response
return {"export_id": export_id, "filename": "quote.xlsx"}

# Frontend downloads from: /api/exports/{export_id}
```

**Prevention:** Always use UUID for export files, clean up after download

---

## WSL2-Specific Gotchas

### 9. Chrome DevTools Freezing WSL2

**Symptom:** VS Code disconnects, WSL2 becomes unresponsive

**Root Cause:** Chrome accumulates memory, exceeds WSL2 limit

**Fix:**
```bash
# ✅ Use tiered testing approach
# Tier 1: Backend tests (100 MB, 5s)
cd backend && pytest -v

# Tier 2: Backend API tests (200 MB, 30s)
./.claude/test-backend-only.sh

# Tier 3: Headless browser (500 MB, 60s)
./.claude/launch-chrome-testing.sh headless

# Tier 4: Full browser (1.2 GB, 120s) - ONLY WHEN NEEDED
./.claude/launch-chrome-testing.sh full

# ✅ Use safe session wrapper (auto-cleanup)
./.claude/safe-test-session.sh headless http://localhost:3001 10
```

**Prevention:**
- Always start with fastest tier that covers what you need
- Kill Chrome after tests (`launch-chrome-testing.sh kill`)
- Monitor resources (`./.claude/monitor-wsl-resources.sh`)

---

### 10. File Path Issues in WSL2

**Symptom:** File uploads fail, paths not found

**Root Cause:** Windows paths (\) vs Linux paths (/)

**Fix:**
```bash
# ❌ WRONG - Windows path
/mnt/c/Users/Lenovo/file.xlsx

# ✅ CORRECT - WSL2 path
/home/novi/file.xlsx
```

**Prevention:** Always use WSL2 native paths for testing

---

## ag-Grid Gotchas

### 11. Column Definitions Not Reactive

**Symptom:** Adding/removing columns doesn't update grid

**Root Cause:** ag-Grid needs new array reference

**Fix:**
```typescript
// ❌ WRONG - Mutating array
columnDefs.push(newCol);

// ✅ CORRECT - New array reference
setColumnDefs([...columnDefs, newCol]);
```

---

### 12. Grid API Not Available on Mount

**Symptom:** Cannot call grid API methods after render

**Root Cause:** Grid not fully initialized

**Fix:**
```typescript
// ✅ Use onGridReady callback
const onGridReady = (params: GridReadyEvent) => {
  gridRef.current = params.api;
  // Now safe to call API methods
  params.api.sizeColumnsToFit();
};
```

---

### 13. Cell Renderers Not Re-rendering

**Symptom:** Cell content doesn't update on data change

**Root Cause:** ag-Grid caches renderers

**Fix:**
```typescript
// ✅ Add refresh callback
cellRenderer: (params: ICellRendererParams) => {
  return <CustomComponent data={params.data} />;
},
cellRendererParams: {
  refresh: true // Force re-render on data change
}
```

---

## Calculation Engine Gotchas

### 14. Missing Variable Validation

**Symptom:** Calculation fails with cryptic error

**Root Cause:** Required variable missing or wrong type

**Fix:** See "Calculation Patterns" document (Task 2)

**Prevention:** Validate all 42 variables before calculation

---

### 15. Two-Tier Variable Precedence

**Symptom:** Product value doesn't override quote default

**Root Cause:** Not checking product-level value first

**Fix:**
```python
# ✅ CORRECT - Product overrides quote
value = get_value(
    product.get('variable_name'),  # Check product first
    quote.get('variable_name'),    # Fall back to quote
    default_value                   # Fall back to default
)
```

---

## TypeScript Gotchas

### 16. Unused Imports/Variables (108 warnings)

**Bug:** BUG-044 - 108 TypeScript warnings

**Symptom:** CI logs flooded with warnings

**Root Cause:** Strict unused checks enabled

**Fix:**
```typescript
// ✅ Remove unused imports
// OR prefix with underscore if intentionally unused
const _unusedVar = getValue();
```

**Prevention:** Run `npm run type-check` before commit

---

### 17. React 19 Compatibility

**Bug:** BUG-043 - React 19 ref handling

**Symptom:** Warning about ref usage in functional components

**Root Cause:** React 19 changed ref behavior

**Fix:** Needs investigation (see bug tracker)

---

## Prevention Checklist

Use this checklist when implementing new features:

### Backend Endpoints
- [ ] RLS policy added to new tables
- [ ] Activity log decorator applied to mutations
- [ ] Customer/relations JOINed in SELECT queries
- [ ] Role checks are case-insensitive (`.lower()`)
- [ ] Concurrent-safe wrapper applied
- [ ] Error handling with proper status codes
- [ ] Input validation for all parameters

### Frontend Components
- [ ] Form validation rules on required fields
- [ ] Required fields have asterisk (`required` prop)
- [ ] Ant Design v5 APIs used (not v4 deprecated)
- [ ] ag-Grid columns use new array reference when updated
- [ ] ag-Grid API called only after `onGridReady`
- [ ] TypeScript strict mode passes (no warnings)
- [ ] Case-insensitive role checks

### Testing
- [ ] Backend tests pass (`cd backend && pytest`)
- [ ] Frontend type check passes (`cd frontend && npm run type-check`)
- [ ] Use tiered testing (start with backend, escalate to browser only if needed)
- [ ] Chrome killed after browser tests

### Calculation Changes
- [ ] All 42 variables validated
- [ ] Two-tier precedence checked (product > quote > default)
- [ ] Edge cases tested (zero values, missing fields)

### Database Migrations
- [ ] RLS policies added (see RLS CHECKLIST below)
- [ ] Indexes added for foreign keys
- [ ] Migration tested on dev database
- [ ] Rollback script created

---

## Quick Reference Links

- **Bug Inventory:** `.claude/MASTER_BUG_INVENTORY.md` (41 bugs)
- **Calculation Patterns:** `.claude/CALCULATION_PATTERNS.md` (Task 2)
- **RLS Checklist:** `.claude/RLS_CHECKLIST.md` (Task 3)
- **Testing Guide:** `.claude/TIERED_TESTING_GUIDE.md`
- **Chrome DevTools Guide:** `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`
```

---

## Task 2: Calculation Patterns Document (30 minutes)

**Goal:** Document 42 variables, validation rules, two-tier system.

**Source:** `.claude/VARIABLES.md`, calculation engine code

**Create:** `.claude/CALCULATION_PATTERNS.md`

### Content Structure

```markdown
# Calculation Engine Patterns

**Last Updated:** 2025-10-29
**Variables:** 42 (39 user-editable + 3 admin-only)
**Phases:** 13 calculation phases
**Purpose:** Prevent calculation errors

---

## Two-Tier Variable System

**Hierarchy:** Product Override > Quote Default > System Fallback

```python
def get_value(product_value, quote_value, default_value):
    """Get variable value with two-tier precedence"""
    if product_value is not None:
        return product_value  # Product-level override
    if quote_value is not None:
        return quote_value    # Quote-level default
    return default_value      # System fallback
```

---

## 42 Variables Classification

### Product-Only (5 variables)
Cannot be quote-level defaults, must be per-product:

1. `sku` - Product identifier
2. `brand` - Manufacturer brand
3. `base_price_VAT` - Base price with VAT
4. `quantity` - Order quantity
5. `weight_in_kg` - Product weight

---

### Quote-Only (19 variables)
Cannot be per-product, apply to entire quote:

1. `currency_base` - Quote currency (USD/EUR/CNY)
2. `delivery_days` - Delivery timeframe
3. `pct_advance_pymt_1` - First advance payment %
4. `pct_advance_pymt_2` - Second advance payment %
5. `pct_advance_pymt_3` - Third advance payment %
... (list all 19)

---

### Both Levels (15 variables)
Can be quote default OR product override:

1. `rate_forex` - Exchange rate
2. `pct_discount` - Discount %
3. `pct_customs_duty` - Customs duty %
... (list all 15)

---

### Admin-Only (3 variables)
Organization-wide, stored in calculation_settings:

1. `rate_forex_risk` - Forex risk rate
2. `rate_fin_comm` - Financial commission rate
3. `rate_loan_interest_daily` - Daily loan interest rate

---

## Validation Rules

### Required Fields (10)

```python
REQUIRED_FIELDS = [
    'sku',
    'brand',
    'base_price_VAT',
    'quantity',
    'currency_base',
    'delivery_days',
    'pct_advance_pymt_1',
    'pct_advance_pymt_2',
    'pct_advance_pymt_3',
    'rate_forex'
]

# Validate before calculation
def validate_required_fields(quote_data, products_data):
    errors = []
    for field in REQUIRED_FIELDS:
        if field in ['sku', 'brand', 'base_price_VAT', 'quantity']:
            # Check each product
            for i, product in enumerate(products_data):
                if not product.get(field):
                    errors.append(f"Product {i+1}: Missing {field}")
        else:
            # Check quote-level
            if not quote_data.get(field):
                errors.append(f"Quote: Missing {field}")

    return errors
```

---

### Business Rules

```python
# 1. Advance payments must total ≤ 100%
def validate_advance_payments(quote_data):
    total = (
        quote_data.get('pct_advance_pymt_1', 0) +
        quote_data.get('pct_advance_pymt_2', 0) +
        quote_data.get('pct_advance_pymt_3', 0)
    )
    if total > 100:
        raise ValueError(f"Advance payments total {total}% > 100%")

# 2. Delivery days must be > 0
def validate_delivery_days(quote_data):
    days = quote_data.get('delivery_days', 0)
    if days <= 0:
        raise ValueError(f"Delivery days must be > 0, got {days}")

# 3. Quantity must be > 0
def validate_quantity(product):
    qty = product.get('quantity', 0)
    if qty <= 0:
        raise ValueError(f"Quantity must be > 0, got {qty}")

# 4. Currency must be valid
def validate_currency(quote_data):
    currency = quote_data.get('currency_base')
    if currency not in ['USD', 'EUR', 'CNY', 'RUB']:
        raise ValueError(f"Invalid currency: {currency}")
```

---

## Mapping to Calculation Engine

### 7 Nested Pydantic Models

The calculation engine expects 7 nested models:

```python
class CalculationInput(BaseModel):
    basic: BasicInput
    pricing: PricingInput
    payments: PaymentsInput
    logistics: LogisticsInput
    fees: FeesInput
    costs: CostsInput
    settings: SettingsInput
```

### Variable → Model Mapping

```python
def map_variables_to_calculation_input(quote_data, products_data, admin_settings):
    """Map 42 variables to 7 nested models"""

    # For each product
    for product in products_data:
        # Helper: Get value with two-tier precedence
        def get_value(product_key, quote_key, default):
            return (
                product.get(product_key) or
                quote_data.get(quote_key) or
                default
            )

        # Basic model (product-only variables)
        basic = BasicInput(
            sku=product['sku'],
            brand=product['brand'],
            base_price_VAT=product['base_price_VAT'],
            quantity=product['quantity'],
            currency_base=quote_data['currency_base']
        )

        # Pricing model (quote + product overrides)
        pricing = PricingInput(
            rate_forex=get_value('rate_forex', 'rate_forex', None),
            pct_discount=get_value('pct_discount', 'pct_discount', 0),
            ...
        )

        # ... (repeat for other 5 models)
```

---

## Calculation Flow (13 Phases)

```
Input Validation
↓
Phase 1: Base Price Conversion (currency)
↓
Phase 2: Purchase Price (with discount)
↓
Phase 3: Logistics Costs (shipping, customs)
↓
Phase 4: Import Duties
↓
Phase 5: Warehouse & Handling
↓
Phase 6: Total Import Costs
↓
Phase 7: Financing Costs
↓
Phase 8: Total Costs
↓
Phase 9: Markup Application
↓
Phase 10: Price Before VAT
↓
Phase 11: VAT Calculation
↓
Phase 12: Final Price
↓
Output Generation
```

---

## Common Calculation Errors

### 1. Missing Required Variable

**Error:** `KeyError: 'rate_forex'`

**Cause:** Required variable not in quote or product data

**Fix:** Validate required fields before calculation

---

### 2. Type Mismatch

**Error:** `TypeError: unsupported operand type(s) for *: 'NoneType' and 'Decimal'`

**Cause:** Variable is None instead of number

**Fix:** Use safe_decimal() helper

```python
def safe_decimal(value, default=0):
    """Safely convert to Decimal"""
    if value is None:
        return Decimal(str(default))
    try:
        return Decimal(str(value))
    except:
        return Decimal(str(default))
```

---

### 3. Wrong Two-Tier Order

**Error:** Product override not applied

**Cause:** Checking quote before product

**Fix:** Always check product first

```python
# ❌ WRONG
value = quote.get('pct_discount') or product.get('pct_discount') or 0

# ✅ CORRECT
value = product.get('pct_discount') or quote.get('pct_discount') or 0
```

---

## Testing Checklist

When testing calculations:

- [ ] All 10 required fields provided
- [ ] Advance payments total ≤ 100%
- [ ] Delivery days > 0
- [ ] Quantity > 0 for all products
- [ ] Currency is valid (USD/EUR/CNY/RUB)
- [ ] Product overrides work (test with different product/quote values)
- [ ] Admin settings fetched correctly
- [ ] Edge cases: zero discount, 100% advance, minimum quantities

---

## Quick Reference

**Full variable list:** `.claude/VARIABLES.md`
**Calculation engine:** `backend/routes/quotes_calc.py`
**Tests:** `backend/tests/test_quotes_calc_*.py`
```

---

## Task 3: RLS Checklist (15 minutes)

**Goal:** Prevent RLS bugs in multi-tenant system.

**Source:** Backend RLS patterns, CLAUDE.md

**Create:** `.claude/RLS_CHECKLIST.md`

### Content Structure

```markdown
# RLS (Row-Level Security) Checklist

**Last Updated:** 2025-10-29
**Purpose:** Prevent multi-tenant data leakage bugs
**Context:** 284 RLS references in codebase - security critical

---

## Why RLS Matters

**Multi-tenant system:** Users must ONLY see their organization's data.

**Without RLS:** Users can access other organizations' data (CRITICAL SECURITY BUG).

**With RLS:** PostgreSQL enforces organization isolation at database level.

---

## RLS Policy Template

```sql
-- Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT (read)
CREATE POLICY "[table_name]_select_policy"
ON [table_name]
FOR SELECT
USING (
  organization_id = (current_setting('app.organization_id', TRUE))::UUID
);

-- Policy for INSERT (create)
CREATE POLICY "[table_name]_insert_policy"
ON [table_name]
FOR INSERT
WITH CHECK (
  organization_id = (current_setting('app.organization_id', TRUE))::UUID
);

-- Policy for UPDATE (modify)
CREATE POLICY "[table_name]_update_policy"
ON [table_name]
FOR UPDATE
USING (
  organization_id = (current_setting('app.organization_id', TRUE))::UUID
)
WITH CHECK (
  organization_id = (current_setting('app.organization_id', TRUE))::UUID
);

-- Policy for DELETE (remove)
CREATE POLICY "[table_name]_delete_policy"
ON [table_name]
FOR DELETE
USING (
  organization_id = (current_setting('app.organization_id', TRUE))::UUID
);
```

---

## New Table Checklist

When creating a new table, follow these steps:

### Step 1: Add organization_id Column

```sql
CREATE TABLE [table_name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  -- ... other columns ...
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 2: Create Index

```sql
CREATE INDEX idx_[table_name]_organization_id
ON [table_name](organization_id);
```

### Step 3: Enable RLS

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

### Step 4: Create Policies

```sql
-- Copy from template above
-- Replace [table_name] with actual table name
```

### Step 5: Verify RLS

```sql
-- Test as different organization
SET app.organization_id = '[org1_uuid]';
SELECT * FROM [table_name]; -- Should only see org1 data

SET app.organization_id = '[org2_uuid]';
SELECT * FROM [table_name]; -- Should only see org2 data
```

---

## Migration Checklist

Use this when creating migrations:

```markdown
# Migration: [Description]

## Changes
- [ ] New table created with organization_id column
- [ ] organization_id has NOT NULL constraint
- [ ] organization_id references organizations(id)
- [ ] Index created on organization_id
- [ ] RLS enabled on table
- [ ] SELECT policy created
- [ ] INSERT policy created
- [ ] UPDATE policy created
- [ ] DELETE policy created
- [ ] Policies tested with multiple organizations

## Verification SQL
```sql
-- Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = '[table_name]';
-- Should show rowsecurity = true

-- Check policies exist
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = '[table_name]';
-- Should show 4 policies (SELECT, INSERT, UPDATE, DELETE)
```
```

---

## Backend Code Checklist

### Step 1: Set Organization Context

**Always set organization_id before queries:**

```python
# ✅ CORRECT - Set context from JWT claims
user_org_id = get_organization_id(request)  # From JWT
await set_org_context(user_org_id)

# Then run queries
result = supabase.table("quotes").select("*").execute()
```

### Step 2: Verify RLS Policies Applied

```python
# Run query as org1
set_org_context(org1_uuid)
quotes_org1 = supabase.table("quotes").select("*").execute()

# Run query as org2
set_org_context(org2_uuid)
quotes_org2 = supabase.table("quotes").select("*").execute()

# Verify no overlap
assert quotes_org1.data != quotes_org2.data
```

---

## Common RLS Bugs

### 1. Missing organization_id Column

**Symptom:** Table accessible by all users

**Cause:** Forgot to add organization_id column

**Fix:** Add column + RLS policies

---

### 2. RLS Not Enabled

**Symptom:** Policies defined but not enforced

**Cause:** Forgot `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`

**Fix:** Enable RLS

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

---

### 3. Missing Policy Type

**Symptom:** Can SELECT but not INSERT

**Cause:** Only created SELECT policy, missing INSERT/UPDATE/DELETE

**Fix:** Create all 4 policy types

---

### 4. Wrong Context Setting

**Symptom:** Backend returns no data

**Cause:** organization_id not set or set incorrectly

**Fix:** Verify JWT claims and context setting

```python
# Debug RLS context
current_org = supabase.rpc("current_setting", {"setting_name": "app.organization_id"}).execute()
print(f"Current org context: {current_org}")
```

---

## Testing RLS

### Manual Testing (Supabase Dashboard)

```sql
-- 1. Get two organization UUIDs
SELECT id, name FROM organizations LIMIT 2;

-- 2. Set context to org1
SET app.organization_id = '[org1_uuid]';

-- 3. Query table
SELECT * FROM quotes;
-- Should only see org1's quotes

-- 4. Set context to org2
SET app.organization_id = '[org2_uuid]';

-- 5. Query table again
SELECT * FROM quotes;
-- Should only see org2's quotes (different from org1)
```

### Automated Testing (Pytest)

```python
async def test_rls_isolation():
    """Test RLS prevents cross-organization access"""

    # Create data for org1
    set_org_context(org1_uuid)
    quote1 = await create_quote({"customer_id": customer1_id})

    # Create data for org2
    set_org_context(org2_uuid)
    quote2 = await create_quote({"customer_id": customer2_id})

    # Verify org1 cannot see org2's data
    set_org_context(org1_uuid)
    quotes = await get_all_quotes()
    assert quote1["id"] in [q["id"] for q in quotes]
    assert quote2["id"] not in [q["id"] for q in quotes]

    # Verify org2 cannot see org1's data
    set_org_context(org2_uuid)
    quotes = await get_all_quotes()
    assert quote2["id"] in [q["id"] for q in quotes]
    assert quote1["id"] not in [q["id"] for q in quotes]
```

---

## Quick Reference

**RLS patterns:** `backend/CLAUDE.md` (RLS section)
**Example policies:** `backend/migrations/*.sql`
**Context setting:** `backend/auth.py` (set_org_context function)
```

---

## Completion Checklist

After finishing all 3 tasks:

- [ ] COMMON_GOTCHAS.md created (30 min) - 41 bugs extracted
- [ ] CALCULATION_PATTERNS.md created (30 min) - 42 variables documented
- [ ] RLS_CHECKLIST.md created (15 min) - Security verification
- [ ] All documents reviewed for accuracy
- [ ] Links between documents added
- [ ] Total time: ~75 minutes

---

## Next Steps

**After Quick Wins:**

1. **Use these documents immediately** - Reference when coding
2. **Test effectiveness** - Do they prevent bugs?
3. **Move to Phase 1** - Skills content creation (see `02-PHASE1-SKILLS-CONTENT.md`)

**These documents will be referenced by:**
- Skills (frontend/backend guidelines)
- Hooks (validation checks)
- Slash commands (testing workflows)

---

**Ready to start? Create these 3 documents now (75 minutes total).**
