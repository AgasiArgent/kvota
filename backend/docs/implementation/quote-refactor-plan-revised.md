# Quote Refactoring - Revised Implementation Plan

**Created:** 2025-11-22
**Status:** Ready to Implement
**Estimated Effort:** 3 hours (Phase 1: 2h, Phase 2: 1h)

---

## EXECUTIVE SUMMARY

**Phase 1:** Add `custom_fields` to `quote_items` to enable product-level variable overrides
**Phase 2:** Optimize export queries by combining 3 HTTP requests into 1

**Key Decision:** Keep `quote_calculation_variables` as separate table (schema clarity > premature optimization)

---

## PROBLEM STATEMENT

### Issue 1: Product-level overrides not persisted ⚠️ CRITICAL
**Impact:** User data loss

- User sets different markup for each product in ag-Grid
- Values lost on save (no `custom_fields` column in `quote_items`)
- Export shows quote-level default for all products
- Blocks two-tier variable system feature

**Example:**
```
User input:  Product 1: markup=18%, Product 2: markup=5%
What saves:  All products: markup=15% (quote default)
User sees:   Excel export shows 15% for everything ❌
```

---

### Issue 2: Multiple HTTP requests slow down exports ⚠️ MEDIUM
**Impact:** Performance degradation

Current financial approval export:
- **Request 1:** `quotes` + `customers` + `quote_calculation_summaries` (~50-100ms)
- **Request 2:** `quote_calculation_variables` (~30-50ms)
- **Request 3:** `quote_items` (~50-100ms)
- **Total:** 130-250ms in network overhead

**Root cause:** Separate REST API calls instead of single nested query
**Solution:** Use Supabase nested selects to fetch all data in one request

---

## SOLUTION OVERVIEW

### Phase 1: Enable Product-Level Overrides
**Goal:** Allow users to customize variables per product

**Changes:**
1. Add `custom_fields JSONB` column to `quote_items` table
2. Update backend to save/read product overrides
3. Update frontend to track which cells were manually edited
4. Update export to use product-level values when available

**Benefits:**
- ✅ Enables two-tier variable system (quote defaults + product overrides)
- ✅ Solves critical data loss issue
- ✅ No breaking changes (additive column)

---

### Phase 2: Query Optimization
**Goal:** Reduce export time by 50-67%

**Changes:**
1. Combine 3 separate queries into 1 nested select
2. Keep `quote_calculation_variables` table (schema clarity)
3. Update `financial_approval.py` only (~40 lines)

**Benefits:**
- ✅ 100-150ms faster exports (1 HTTP request vs 3)
- ✅ Zero migration risk (pure code change)
- ✅ Maintains schema normalization
- ✅ No FK constraints lost

**Why NOT merge tables:**
- ❌ JOIN cost is negligible (<1ms on indexed PK)
- ❌ Real bottleneck is HTTP requests, not JOINs
- ❌ Would lose schema clarity and FK constraints
- ❌ Migration risk for <5% real improvement

---

## PHASE 1: ADD CUSTOM_FIELDS TO QUOTE_ITEMS

### 1.1 Database Migration

**File:** `backend/migrations/030_add_custom_fields_to_quote_items.sql`

```sql
-- ============================================================================
-- Migration 030: Add custom_fields column for product-level variable overrides
-- ============================================================================

-- Add custom_fields JSONB column
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Add GIN index for JSONB queries (important for performance)
CREATE INDEX IF NOT EXISTS idx_quote_items_custom_fields
ON quote_items USING GIN (custom_fields);

-- Add documentation
COMMENT ON COLUMN quote_items.custom_fields IS
  'Product-level variable overrides. Example: {"markup": 18.5, "supplier_discount": 5.0, "import_tariff": 12.0}.
  Empty {} means use quote-level defaults.';

-- Verify migration
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'quote_items'
  AND column_name = 'custom_fields';

-- Expected output:
-- column_name   | data_type | column_default | is_nullable
-- custom_fields | jsonb     | '{}'::jsonb    | YES
```

**Testing:**
```sql
-- Test write
UPDATE quote_items
SET custom_fields = '{"markup": 18.5, "supplier_discount": 5.0}'::jsonb
WHERE id = 'some-item-id';

-- Test read
SELECT id, product_name, custom_fields
FROM quote_items
WHERE quote_id = 'some-quote-id';

-- Test GIN index (should use index scan, not seq scan)
EXPLAIN SELECT * FROM quote_items
WHERE custom_fields @> '{"markup": 18.5}'::jsonb;
```

---

### 1.2 Backend: Save custom_fields on Quote Creation

**File:** `backend/routes/quotes_calc.py` (around line 1164)

**Current code:**
```python
items_response = supabase.table("quote_items").insert(items_data).execute()
```

**Change to:**
```python
# Extract custom_fields from Product model for each item
for i, product in enumerate(request.products):
    custom_fields = {}

    # Fields that can be overridden per product
    override_fields = [
        'currency_of_base_price',
        'exchange_rate_base_price_to_quote',
        'supplier_discount',
        'markup',
        'customs_code',
        'import_tariff',
        'excise_tax',
        'util_fee'
    ]

    # Check if product has overrides
    for field in override_fields:
        product_value = getattr(product, field, None)
        if product_value is not None:
            # Store override in custom_fields
            # Convert Decimal to float for JSON serialization
            if isinstance(product_value, Decimal):
                custom_fields[field] = float(product_value)
            else:
                custom_fields[field] = product_value

    # Add custom_fields to item_data (empty dict if no overrides)
    items_data[i]['custom_fields'] = custom_fields

# Insert items with custom_fields
items_response = supabase.table("quote_items").insert(items_data).execute()
```

**Error handling:**
```python
# Add error handling for robustness
try:
    items_response = supabase.table("quote_items").insert(items_data).execute()
    if not items_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save quote items"
        )
except Exception as e:
    # Rollback: delete quote if items failed
    supabase.table("quotes").delete().eq("id", quote_id).execute()
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to save quote items: {str(e)}"
    )
```

---

### 1.3 Backend: Read custom_fields in Export

**File:** `backend/routes/financial_approval.py` (around line 107 and 169)

**Change 1: Include custom_fields in query (line 107)**

**Current:**
```python
items_result = supabase.table("quote_items") \
    .select("id, product_name, description, quantity") \
    .eq("quote_id", str(quote_id)) \
    .order("position") \
    .execute()
```

**Change to:**
```python
items_result = supabase.table("quote_items") \
    .select("id, product_name, description, quantity, custom_fields") \
    .eq("quote_id", str(quote_id)) \
    .order("position") \
    .execute()
```

---

**Change 2: Use product override if exists (line 169)**

**Current:**
```python
# BUGFIX: Use INPUT markup value, not calculated
# TODO: Check if item has product-level override in custom_fields
# For now, use quote-level markup as we don't store product-level overrides yet
markup = quote_level_markup
```

**Change to:**
```python
# Check for product-level markup override in custom_fields
custom_fields = item.get('custom_fields', {})
product_markup = custom_fields.get('markup') if custom_fields else None

# Use product override if exists, otherwise use quote-level default
if product_markup is not None:
    markup = Decimal(str(product_markup))
    print(f"[DEBUG] Using product-level markup: {markup}% (item: {item.get('product_name')})")
else:
    markup = quote_level_markup
    print(f"[DEBUG] Using quote-level markup: {markup}% (item: {item.get('product_name')})")
```

**Apply same pattern for other overridable fields:**
```python
# Supplier discount
supplier_discount = custom_fields.get('supplier_discount')
if supplier_discount is None:
    supplier_discount = input_vars.get('supplier_discount', 0)

# Import tariff
import_tariff = custom_fields.get('import_tariff')
if import_tariff is None:
    import_tariff = input_vars.get('import_tariff', 0)

# And so on for all override fields...
```

---

### 1.4 Frontend: Track and Send custom_fields

**Files:**
- `frontend/src/app/quotes/create/page.tsx`
- `frontend/src/app/quotes/[id]/edit/page.tsx` (if exists)

**Implementation approach:**

**Step 1: Add state to track edited cells**
```typescript
// Track which cells were manually edited (not just populated with defaults)
const [editedCells, setEditedCells] = useState<Set<string>>(new Set());

// Map of product index → custom fields
const [productOverrides, setProductOverrides] = useState<Map<number, Record<string, any>>>(
  new Map()
);
```

**Step 2: Mark cells as edited on change**
```typescript
// Add to ag-Grid props
onCellValueChanged={(event: CellValueChangedEvent) => {
  const rowIndex = event.rowIndex;
  const field = event.colDef.field;
  const newValue = event.newValue;

  if (!rowIndex || !field) return;

  // Track this cell as manually edited
  const cellKey = `${rowIndex}-${field}`;
  setEditedCells(prev => new Set(prev).add(cellKey));

  // Store the override value
  const overrides = productOverrides.get(rowIndex) || {};
  overrides[field] = newValue;
  setProductOverrides(prev => new Map(prev).set(rowIndex, overrides));

  // Update product data in state
  setUploadedProducts((prevProducts) => {
    const updatedProducts = [...prevProducts];
    updatedProducts[rowIndex] = event.data as Product;
    return updatedProducts;
  });
}}
```

**Step 3: Build custom_fields when saving**
```typescript
// When user clicks save/calculate
const handleSaveQuote = async () => {
  // Build products array with custom_fields
  const productsWithCustomFields = uploadedProducts.map((product, index) => {
    const overrides = productOverrides.get(index);

    return {
      ...product,
      // Include custom_fields only if user edited something
      custom_fields: overrides || {}
    };
  });

  // Send to API
  const result = await quotesCalcService.calculateQuote({
    customer_id: selectedCustomer,
    products: productsWithCustomFields,
    variables: variables,
    // ... other fields
  });
};
```

**Step 4: (Optional) Visual indication of overrides**
```typescript
// Add cellStyle to show which cells have overrides
const columnDefs: ColDef[] = [
  {
    field: 'markup',
    headerName: 'Наценка (%)',
    editable: true,
    cellStyle: (params) => {
      const rowIndex = params.node?.rowIndex;
      const cellKey = `${rowIndex}-markup`;

      // Blue background if manually edited (override)
      if (editedCells.has(cellKey)) {
        return { backgroundColor: '#e6f7ff', fontWeight: 'bold' };
      }

      // Gray background if using default
      return { backgroundColor: '#f5f5f5' };
    }
  },
  // ... other columns
];
```

---

### 1.5 Testing Phase 1

**Test 1: Basic override persistence**
```bash
# 1. Create quote with 3 products, different markup each
#    Product 1: markup=18% (override)
#    Product 2: markup=15% (default, not edited)
#    Product 3: markup=5% (override)

# 2. Save quote, check database
psql $DATABASE_URL -c "
  SELECT id, product_name, custom_fields
  FROM quote_items
  WHERE quote_id = 'newly-created-quote-id'
  ORDER BY position;
"

# Expected:
# Product 1: custom_fields = {"markup": 18.0}
# Product 2: custom_fields = {}  (empty, using default)
# Product 3: custom_fields = {"markup": 5.0}
```

**Test 2: Export shows correct values**
```bash
# Download financial review Excel
# Verify Products table shows:
# - Product 1: 18% markup
# - Product 2: 15% markup (default)
# - Product 3: 5% markup
```

**Test 3: Edit quote preserves overrides**
```bash
# 1. Create quote with overrides
# 2. Navigate to edit page (if exists)
# 3. Load quote → verify overrides show in grid
# 4. Change Product 1 markup to 20%
# 5. Save → verify custom_fields updated
```

---

## PHASE 2: OPTIMIZE EXPORT QUERY

### 2.1 Analysis: Why NOT Merge Tables

**Rejected approach:** Merge `quote_calculation_variables` into `quotes` table

**Why rejected:**

| Concern | Analysis |
|---------|----------|
| **"JOIN is slow"** | ❌ FALSE - 1:1 JOIN on indexed PK adds <1ms |
| **"Simplifies schema"** | ❌ FALSE - Loses clarity, FK constraints, timestamps |
| **"10-15% faster"** | ❌ FALSE - Real bottleneck is 3 HTTP requests (150ms), not JOIN (1ms) |
| **"Good performance"** | ❌ FALSE - JSONB queries often SLOWER than indexed columns |

**What we keep by NOT merging:**
- ✅ Schema clarity - separate table clearly indicates "calculation input data"
- ✅ Foreign key to `variable_templates` - maintains referential integrity
- ✅ Separate timestamps - know when variables changed
- ✅ Migration risk = 0 - no data migration needed

**Real bottleneck:**
```
Current: 3 HTTP requests = 130-250ms
Proposed: 1 HTTP request = 50-100ms
Savings: 80-150ms (50-67% improvement)
```

---

### 2.2 Backend: Single Query with Nested Selects

**File:** `backend/routes/financial_approval.py` (lines 70-120)

**Current approach (3 separate requests):**
```python
# Request 1: Quote + customer + calc summary
result = supabase.table("quotes") \
    .select("*, customer:customers(name), calculation_summary:quote_calculation_summaries(*)") \
    .eq("id", str(quote_id)) \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()

quote = result.data[0]

# Request 2: Calculation variables
calc_vars_result = supabase.table("quote_calculation_variables") \
    .select("variables") \
    .eq("quote_id", str(quote_id)) \
    .execute()

input_vars = calc_vars_result.data[0].get('variables', {})

# Request 3: Quote items
items_result = supabase.table("quote_items") \
    .select("id, product_name, description, quantity, custom_fields") \
    .eq("quote_id", str(quote_id)) \
    .order("position") \
    .execute()

items = items_result.data
```

---

**New approach (1 request with nested selects):**
```python
# Single request: Fetch ALL related data
result = supabase.table("quotes") \
    .select("""
        *,
        customer:customers(name),
        calculation_summary:quote_calculation_summaries(*),
        calculation_variables:quote_calculation_variables(variables, template_id),
        items:quote_items(id, product_name, description, quantity, custom_fields)
    """) \
    .eq("id", str(quote_id)) \
    .eq("organization_id", str(user.current_organization_id)) \
    .order("items.position") \
    .execute()

if not result.data or len(result.data) == 0:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Quote not found"
    )

quote = result.data[0]

# Extract nested data (Supabase returns 1:1 joins as arrays)
calc_summary = quote.get('calculation_summary')
if isinstance(calc_summary, list):
    calc_summary = calc_summary[0] if calc_summary else None

# Extract calculation variables
input_vars = {}
calc_vars = quote.get('calculation_variables')
if calc_vars:
    if isinstance(calc_vars, list):
        input_vars = calc_vars[0].get('variables', {}) if calc_vars else {}
    else:
        input_vars = calc_vars.get('variables', {})

if not input_vars:
    print(f"[WARNING] No calculation_variables found for quote {quote_id}")

# Extract items (already ordered by position)
items = quote.get('items', [])

# Continue with Excel generation as before...
```

**Lines changed:** ~40 lines in `financial_approval.py`

**Benefits:**
- ✅ 1 HTTP request instead of 3
- ✅ Saves 100-150ms (50-67% faster)
- ✅ No schema changes
- ✅ No migration needed
- ✅ Same data structure returned

---

### 2.3 Testing Phase 2

**Test 1: Verify nested query works**
```python
# Test in Python shell
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Test nested select with a real quote ID
result = supabase.table("quotes").select("""
    *,
    customer:customers(name),
    calculation_variables:quote_calculation_variables(variables),
    items:quote_items(id, product_name, custom_fields)
""").eq("id", "real-quote-id-here").execute()

print("Quote data:", result.data)
print("\nCustomer:", result.data[0].get('customer'))
print("\nVariables:", result.data[0].get('calculation_variables'))
print("\nItems:", result.data[0].get('items'))
```

**Expected output:**
```python
{
  'id': 'quote-id',
  'quote_number': 'КП25-0077',
  'customer': {'name': 'Customer Name'},  # Nested object
  'calculation_variables': [{'variables': {...}}],  # Array with 1 item
  'items': [  # Array of items
    {'id': 'item-1', 'product_name': 'Product 1', 'custom_fields': {'markup': 18.0}},
    {'id': 'item-2', 'product_name': 'Product 2', 'custom_fields': {}}
  ]
}
```

---

**Test 2: Performance benchmark**
```python
import time

# Benchmark old approach (3 requests)
start = time.time()
q1 = supabase.table("quotes").select("*").eq("id", quote_id).execute()
q2 = supabase.table("quote_calculation_variables").select("*").eq("quote_id", quote_id).execute()
q3 = supabase.table("quote_items").select("*").eq("quote_id", quote_id).execute()
old_time = time.time() - start

# Benchmark new approach (1 request)
start = time.time()
result = supabase.table("quotes").select("""
    *,
    calculation_variables:quote_calculation_variables(*),
    items:quote_items(*)
""").eq("id", quote_id).execute()
new_time = time.time() - start

improvement = (1 - new_time/old_time) * 100
print(f"Old: {old_time:.3f}s")
print(f"New: {new_time:.3f}s")
print(f"Improvement: {improvement:.1f}% faster")

# Expected: 50-67% improvement
# Example: Old: 0.150s, New: 0.055s, Improvement: 63.3%
```

---

**Test 3: Export regression test**
```bash
# Download financial review Excel for same quote
# - Before changes: should work
# - After Phase 1: should show product overrides
# - After Phase 2: should be faster but same data

# Verify:
# 1. Excel downloads successfully
# 2. All data present (no missing fields)
# 3. Product overrides show correctly
# 4. Performance improved by ~50%
```

---

## FILE CHANGE CHECKLIST

### Phase 1: Product Overrides
- [ ] Create migration `030_add_custom_fields_to_quote_items.sql`
- [ ] Apply migration to database
- [ ] Update `backend/routes/quotes_calc.py` (save custom_fields)
- [ ] Update `backend/routes/financial_approval.py` (read custom_fields in query)
- [ ] Update `backend/routes/financial_approval.py` (use product overrides in export logic)
- [ ] Update `frontend/src/app/quotes/create/page.tsx` (track edits, send custom_fields)
- [ ] (Optional) Update edit page if exists
- [ ] Test: Create quote with overrides → verify database
- [ ] Test: Download export → verify shows correct markups
- [ ] Commit Phase 1 changes

### Phase 2: Query Optimization
- [ ] Update `backend/routes/financial_approval.py` (combine 3 queries into 1)
- [ ] Test: Verify nested query returns all data
- [ ] Test: Performance benchmark (should be 50-67% faster)
- [ ] Test: Export regression (same data, faster)
- [ ] Commit Phase 2 changes

---

## DEPLOYMENT PLAN

### Phase 1 Deployment (Recommended: Do First)

**Steps:**
1. Apply migration 030 to staging database
2. Deploy backend changes (quotes_calc.py, financial_approval.py)
3. Deploy frontend changes (create page)
4. Test quote creation with overrides
5. Verify export shows correct per-product values
6. Deploy to production (additive change, zero downtime)

**Rollback:**
```sql
-- If something goes wrong, just drop the column
ALTER TABLE quote_items DROP COLUMN custom_fields;
DROP INDEX idx_quote_items_custom_fields;
```

---

### Phase 2 Deployment (After Phase 1 tested)

**Steps:**
1. Update `financial_approval.py` with single query
2. Test on staging (verify nested query works)
3. Performance benchmark (confirm improvement)
4. Deploy to production
5. Monitor logs for any errors

**Rollback:**
```bash
# Just revert the code change (no database changes)
git revert <commit-hash>
```

---

## SUCCESS CRITERIA

### Phase 1: Product Overrides
- ✅ User can set different markup per product in ag-Grid
- ✅ Product overrides persist to database (`custom_fields` column)
- ✅ Export shows correct per-product markups (not all defaults)
- ✅ Create and edit pages both work
- ✅ No data loss when saving quotes

### Phase 2: Query Optimization
- ✅ Export makes 1 HTTP request instead of 3
- ✅ 50-67% faster (100-150ms saved)
- ✅ No regression (same data returned)
- ✅ No errors in production logs
- ✅ Schema remains normalized (separate tables preserved)

---

## RISKS & MITIGATION

### Phase 1 Risks

**Risk 1: Frontend state complexity** ⚠️ MEDIUM
- **Problem:** Tracking edited cells vs defaults is complex
- **Mitigation:** Use `Set<string>` to explicitly track edited cells
- **Fallback:** If bugs arise, default to saving all fields as overrides (less efficient but safe)

**Risk 2: Data loss on partial save** ⚠️ LOW
- **Problem:** Quote saves but items fail
- **Mitigation:** Add try/catch to rollback quote if items fail
- **Impact:** Low (Supabase operations are fast, failures rare)

**Risk 3: Migration timing** ⚠️ LOW
- **Problem:** Migration applied but code not deployed
- **Mitigation:** Column is additive with default value (safe)
- **Impact:** None (empty `{}` is valid default)

### Phase 2 Risks

**Risk 1: Nested query returns unexpected format** ⚠️ LOW
- **Problem:** Supabase might return different structure
- **Mitigation:** Test thoroughly on staging first
- **Fallback:** Revert code change (no migration needed)

**Risk 2: Performance doesn't improve as expected** ⚠️ LOW
- **Problem:** Network conditions vary
- **Mitigation:** Benchmark on multiple quotes
- **Impact:** Low (even 30% improvement is valuable)

---

## ESTIMATED TIMELINE

### Phase 1: Product Overrides
- Migration: 15 min
- Backend (2 files, ~100 lines): 45 min
- Frontend (1 file, ~80 lines): 45 min
- Testing & verification: 15 min
- **Total: 2 hours**

### Phase 2: Query Optimization
- Backend (1 file, ~40 lines): 30 min
- Testing & benchmarking: 20 min
- Verification: 10 min
- **Total: 1 hour**

**Overall: 3 hours**

---

## NOTES

### Phase 1 Priority: CRITICAL
- Blocks two-tier variable system feature
- Causes user data loss (overrides not saved)
- Should be done ASAP

### Phase 2 Priority: MEDIUM
- Nice performance improvement (50-67% faster)
- No user-facing bugs (just optimization)
- Can be done after Phase 1 validated

### Key Decisions Made
1. ✅ **Keep separate tables** - Schema clarity > premature optimization
2. ✅ **Use JSONB for overrides** - Flexible, doesn't require schema changes per field
3. ✅ **Track edited cells explicitly** - Prevents false positives (defaults marked as overrides)
4. ✅ **Use nested selects** - Same performance benefit as table merge, zero risk

### Next Steps
1. Execute Phase 1 → Test thoroughly
2. User validation (create quotes with overrides)
3. Execute Phase 2 → Benchmark performance
4. Mark old plan as superseded
5. Update SESSION_PROGRESS.md with completion

---

**Last Updated:** 2025-11-22
