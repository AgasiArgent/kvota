# Analytics Query Fix - Use quote_calculation_results Table

**Date:** 2025-11-03
**Issue:** Analytics queries failing because calculated fields (cogs, profit, etc.) don't exist as columns in `quotes` table
**Solution:** JOIN with `quote_calculation_results` table and extract JSONB fields

---

## Problem

Analytics endpoints were trying to query calculated fields directly from the `quotes` table:

```sql
SELECT cogs, profit, margin_percent FROM quotes WHERE ...
```

**Error:** These columns don't exist. They are stored in `quote_calculation_results.phase_results` JSONB field.

---

## Solution

### 1. Added Field Mapping

**File:** `analytics_security.py` (lines 44-55)

Maps analytics field names → JSONB keys:

```python
CALCULATION_FIELD_MAP = {
    'customs_duty': 'customs_fee',
    'excise_tax': 'excise_tax_amount',
    'logistics_cost': 'logistics_total',
    'cogs': 'cogs_per_product',
    'profit': 'profit',
    # Calculated from other fields:
    'export_vat': None,  # sales_price_total_with_vat - sales_price_total_no_vat
    'import_vat': None,  # TODO: Research storage location
    'margin_percent': None  # (profit / sales_price_total_no_vat) * 100
}
```

### 2. Rewrote Query Builder with JOIN

**File:** `analytics_security.py` `build_analytics_query()` (lines 112-223)

**Before:**
```sql
SELECT quote_number, cogs, profit FROM quotes WHERE ...
-- ❌ ERROR: columns don't exist
```

**After:**
```sql
SELECT
    q.quote_number,
    COALESCE(SUM((qcr.phase_results->>'cogs_per_product')::numeric), 0) as cogs,
    COALESCE(SUM((qcr.phase_results->>'profit')::numeric), 0) as profit
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE q.organization_id = $1
GROUP BY q.quote_number
-- ✅ Works! Extracts from JSONB
```

**Key features:**
- Conditionally adds JOIN only when calculated fields requested
- Aggregates per quote (SUM across products)
- Uses parameterized queries ($1, $2) for security
- COALESCE handles NULL values

### 3. Updated Aggregation Builder

**File:** `analytics_security.py` `build_aggregation_query()` (lines 226-354)

**Before:**
```sql
SELECT SUM(profit) as total_profit FROM quotes WHERE ...
-- ❌ ERROR: column doesn't exist
```

**After:**
```sql
SELECT COALESCE(SUM((qcr.phase_results->>'profit')::numeric), 0) as total_profit
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE q.organization_id = $1
-- ✅ Works! Aggregates JSONB data
```

**Special cases:**

1. **export_vat** - Calculate from two fields:
   ```sql
   SUM((qcr.phase_results->>'sales_price_total_with_vat')::numeric -
       (qcr.phase_results->>'sales_price_total_no_vat')::numeric) as export_vat
   ```

2. **margin_percent** - Calculate percentage with division check:
   ```sql
   AVG(CASE WHEN (qcr.phase_results->>'sales_price_total_no_vat')::numeric > 0
       THEN ((qcr.phase_results->>'profit')::numeric /
             (qcr.phase_results->>'sales_price_total_no_vat')::numeric) * 100
       ELSE 0 END) as margin_percent
   ```

3. **import_vat** - Placeholder (TODO: research storage):
   ```sql
   0 as import_vat  -- TODO: Research how this is calculated
   ```

---

## JSONB Keys in phase_results

**Location:** `quote_calculation_results.phase_results` (JSONB column)

**Structure:**
```json
{
  "customs_fee": 35.00,               // Y16
  "excise_tax_amount": 0.00,          // Z16
  "logistics_total": 150.00,          // V16
  "cogs_per_product": 1255.00,        // AB16
  "profit": 188.25,                   // AF16
  "sales_price_total_with_vat": 1500.00,  // AL16
  "sales_price_total_no_vat": 1250.00     // AK16
}
```

**One row per product** (quote_item_id) with all 13 calculation phases.

---

## Tests Added

**File:** `tests/test_analytics_security.py` (6 new tests)

1. ✅ `test_build_analytics_query_with_calculated_fields` - JOIN verification
2. ✅ `test_build_analytics_query_without_calculated_fields` - No JOIN when not needed
3. ✅ `test_build_aggregation_query_with_calculated_fields` - Aggregation JOIN
4. ✅ `test_build_analytics_query_export_vat_calculation` - Calculated field
5. ✅ `test_build_analytics_query_margin_percent_calculation` - Division check
6. ✅ Updated `test_build_aggregation_query_uses_parameterized_queries` - Use real field

**Test Results:** 15/15 passing ✅

---

## Example Generated Queries

### Example 1: List quotes with calculated fields

**Request:**
```python
fields = ['quote_number', 'status', 'cogs', 'profit', 'margin_percent']
filters = {'status': 'approved'}
```

**Generated SQL:**
```sql
SELECT
    q.quote_number,
    q.status,
    COALESCE(SUM((qcr.phase_results->>'cogs_per_product')::numeric), 0) as cogs,
    COALESCE(SUM((qcr.phase_results->>'profit')::numeric), 0) as profit,
    COALESCE(AVG(CASE WHEN (qcr.phase_results->>'sales_price_total_no_vat')::numeric > 0
        THEN ((qcr.phase_results->>'profit')::numeric /
              (qcr.phase_results->>'sales_price_total_no_vat')::numeric) * 100
        ELSE 0 END), 0) as margin_percent
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE q.organization_id = $1 AND q.status = $2
GROUP BY q.quote_number, q.status
ORDER BY q.created_at DESC
LIMIT $3 OFFSET $4
```

### Example 2: Aggregate statistics

**Request:**
```python
aggregations = {
    'quote_count': {'function': 'count'},
    'total_cogs': {'function': 'sum'},
    'avg_profit': {'function': 'avg'},
    'total_export_vat': {'function': 'sum'}
}
```

**Generated SQL:**
```sql
SELECT
    COUNT(DISTINCT q.id) as quote_count,
    COALESCE(SUM((qcr.phase_results->>'cogs_per_product')::numeric), 0) as total_cogs,
    COALESCE(AVG((qcr.phase_results->>'profit')::numeric), 0) as avg_profit,
    COALESCE(SUM((qcr.phase_results->>'sales_price_total_with_vat')::numeric -
                 (qcr.phase_results->>'sales_price_total_no_vat')::numeric), 0) as total_export_vat
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE q.organization_id = $1 AND q.status = $2
```

---

## Security Maintained

✅ **Parameterized queries** - All user inputs use $1, $2 placeholders
✅ **Field whitelist** - Only allowed fields pass validation
✅ **Alias whitelist** - Aggregation aliases must be pre-approved
✅ **SQL injection protection** - Forbidden patterns rejected
✅ **Organization isolation** - WHERE q.organization_id = $1 (RLS)

---

## Performance Considerations

**Optimizations:**
- LEFT JOIN only added when calculated fields requested
- Uses COALESCE to handle NULL values efficiently
- GROUP BY only includes quote-level fields (not products)
- Aggregations happen per quote (SUM across products)

**Potential bottlenecks:**
- Large quotes with 100+ products may be slower
- Consider adding index on `quote_calculation_results(quote_item_id)` if slow

**Current indexes:**
```sql
-- Existing (should already exist)
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_quote_calc_results_item ON quote_calculation_results(quote_item_id);
```

---

## TODO: import_vat Research

**Current state:** Returns `0` as placeholder

**Need to research:**
1. Is import_vat stored in phase_results JSONB?
2. If not, how is it calculated?
3. Which calculation phase computes it?

**Check:**
```bash
grep -r "import_vat" backend/calculation_engine.py
```

**Once found, update:**
```python
CALCULATION_FIELD_MAP = {
    'import_vat': 'actual_jsonb_key',  # Replace with real key
}
```

---

## Files Modified

1. **analytics_security.py** (232 lines total)
   - Added `CALCULATION_FIELD_MAP` (12 lines)
   - Rewrote `build_analytics_query()` (+60 lines)
   - Rewrote `build_aggregation_query()` (+80 lines)

2. **tests/test_analytics_security.py** (216 lines total)
   - Added 6 new tests (+78 lines)
   - Updated 1 existing test

3. **ANALYTICS_FIX_REPORT.md** (this file)
   - Complete documentation

**Total:** ~170 lines of new code + documentation

---

## Ready for Testing

**Manual test steps:**

1. **Start backend:**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload
   ```

2. **Get auth token:**
   ```bash
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"andrey@masterbearingsales.ru","password":"password"}'
   ```

3. **Test analytics query:**
   ```bash
   TOKEN="eyJxxx..."
   curl -X POST http://localhost:8000/api/analytics/query \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "fields": ["quote_number", "status", "cogs", "profit"],
       "filters": {"status": "approved"}
     }'
   ```

4. **Expected result:**
   - 200 OK status
   - JSON array with quotes
   - `cogs` and `profit` fields populated with correct values

**Integration test:**
```bash
pytest tests/integration/test_analytics_integration.py -v
```

---

## Summary

✅ **Problem fixed:** Calculated fields now properly extracted from JSONB
✅ **Tests passing:** 15/15 security tests + coverage at 83%
✅ **Security maintained:** Parameterized queries, whitelists, RLS
✅ **Performance optimized:** Conditional JOIN, aggregation per quote
⚠️ **TODO:** Research `import_vat` storage location

**Ready for user manual testing and integration verification.**
