# Testing Guide: Quote Calculation Summaries

**Feature:** Pre-aggregated quote-level totals to fix mixed aggregation duplication
**Created:** 2025-11-08
**Related:** Issue #2 in ANALYTICS_TECHNICAL_DEBT.md

---

## Prerequisites

**Migration applied:**
- ✅ Migration `022_quote_calculation_summaries.sql` executed
- ✅ Table `quote_calculation_summaries` exists
- ✅ RLS policies enabled and tested

**Backend updated:**
- ✅ `quotes_calc.py` - aggregation function added
- ✅ `analytics_security.py` - whitelist updated with 43 calc_ fields
- ✅ Query builders use 1:1 JOIN (not 1:N)

**Frontend updated:**
- ✅ Analytics page shows new calculated fields
- ✅ Field labels for aggregation auto-generation

---

## Test Sequence

### 1. Create New Quote with Calculations

**Purpose:** Populate `quote_calculation_summaries` table

**Steps:**
1. Go to `/quotes/create`
2. Upload products file or add products manually
3. Fill in quote defaults
4. Click "Рассчитать" (Calculate)
5. Verify quote created successfully

**Expected:**
- Quote created in `quotes` table
- Products saved in `quote_items` table
- Per-product results in `quote_calculation_results` table
- **NEW:** Quote-level summary in `quote_calculation_summaries` table

**Verification Query:**
```sql
SELECT * FROM quote_calculation_summaries
WHERE quote_id = '[new_quote_id]';
```

**Should see:**
- 43 calculated fields populated
- calc_ak16_final_price_total = sum of all products' AK16
- calc_ab16_cogs_total = sum of all products' AB16
- calc_af16_profit_margin = (revenue - cogs) / revenue
- All other monetary fields = sum of products

---

### 2. Test Mixed Aggregation (The Bug Fix!)

**Purpose:** Verify no duplication when aggregating quote-level + calculated fields

**Steps:**
1. Go to `/analytics`
2. Switch to "Агрегация" (Lightweight) mode
3. Add custom aggregation:
   - Field: `calc_y16_customs_duty`
   - Function: `sum`
   - Label: Auto-generated
4. Default aggregations should show:
   - Общая выручка (total_amount)
   - Количество КП (quote_count)
5. Set filter: offer_sale_type = "транзит" (to get 1 КП with 5 products)
6. Click "Выполнить запрос"

**Expected Result:**
- ✅ sum_total_amount = 7,983.36 RUB (correct!)
- ✅ sum_calc_y16_customs_duty = 156.91 RUB (correct!)
- ✅ quote_count = 1

**Before the fix (old behavior):**
- ❌ sum_total_amount = 39,916.80 RUB (7,983.36 × 5 products - WRONG!)
- ❌ sum_customs_duty would also be multiplied

**Why it's fixed:**
- No longer JOIN to `quote_items` (1:N)
- Only JOIN to `quote_calculation_summaries` (1:1)
- No row duplication → No value multiplication

---

### 3. Test All 43 Calculated Fields

**Purpose:** Verify all new fields work in analytics

**Test each category:**

**Phase 1-2: Purchase Prices**
- calc_s16_total_purchase_price - Total purchase price
- calc_s13_sum_purchase_prices - Distribution base

**Phase 3: Logistics**
- calc_v16_total_logistics - Total logistics cost

**Phase 4: Duties**
- calc_y16_customs_duty - Customs duty
- calc_z16_excise_tax - Excise tax

**Phase 10: COGS**
- calc_ab16_cogs_total - Total cost of goods sold

**Phase 11: Sales Pricing**
- calc_af16_profit_margin - Profit margin %
- calc_ag16_dm_fee - DM fee
- calc_ak16_final_price_total - Final price

**Phase 12: VAT**
- calc_an16_sales_vat - Sales VAT
- calc_ao16_deductible_vat - Deductible VAT
- calc_ap16_net_vat_payable - Net VAT

**For each field:**
1. Select field in analytics
2. Add aggregation (SUM or AVG)
3. Execute query
4. Verify value matches expected calculation

---

### 4. Test Standard Mode with Calculated Fields

**Purpose:** Verify row-level queries work with new table

**Steps:**
1. Go to `/analytics`
2. Switch to "Таблица" (Standard) mode
3. Select fields:
   - quote_number
   - total_amount
   - calc_y16_customs_duty
   - calc_ab16_cogs_total
   - calc_af16_profit_margin
4. Execute query

**Expected:**
- Grid shows all quotes with calculated fields
- Each row shows quote-level aggregated totals
- Values match what's in quote_calculation_summaries table

---

### 5. Test Filter Combinations with Calculated Fields

**Purpose:** Verify filters work with new table structure

**Test Cases:**

**Test 5.1:** Filter by date + aggregate calculated field
- created_at: Last month
- Aggregation: SUM(calc_ab16_cogs_total)
- Expected: Sum of COGS for quotes created in last month

**Test 5.2:** Filter by sale type + aggregate multiple fields
- offer_sale_type: "финтранзит"
- Aggregations:
  - SUM(total_amount)
  - SUM(calc_y16_customs_duty)
  - SUM(calc_ab16_cogs_total)
- Expected: All three aggregations show correct totals, no duplication

**Test 5.3:** Filter by status + calculated field in grid
- status: "sent"
- Fields: quote_number, calc_ak16_final_price_total
- Expected: Grid shows only sent quotes with their final prices

---

### 6. Test Export with Calculated Fields

**Purpose:** Verify new fields export correctly

**Steps:**
1. Select calculated fields in analytics
2. Execute query
3. Export to Excel
4. Export to CSV

**Expected:**
- Both Excel and CSV contain calculated fields
- Column headers use Russian labels
- Values match what's shown in grid
- No duplicated rows

---

### 7. Test Saved Reports with Calculated Fields

**Purpose:** Verify saved reports work with new fields

**Steps:**
1. Create query with calculated fields
2. Save as template with name
3. Edit saved report
4. Run saved report (Выполнить)
5. Delete saved report

**Expected:**
- All operations work with calc_ fields
- Loaded report executes correctly
- Results match manual execution

---

## Performance Validation

**Before fix:**
- Mixed aggregation query: 200-500ms (complex JOINs)

**After fix:**
- Mixed aggregation query: 20-50ms (simple 1:1 JOIN)

**Test:**
```sql
-- With calculated fields
EXPLAIN ANALYZE
SELECT
  SUM(q.total_amount) as sum_total_amount,
  SUM(qcs.calc_y16_customs_duty) as sum_customs_duty
FROM quotes q
JOIN quote_calculation_summaries qcs ON qcs.quote_id = q.id
WHERE q.organization_id = '77144c58-b396-4ec7-b51a-2a822ec6d889';
```

**Expected execution time:** <50ms for 34 quotes

---

## Edge Cases

### Edge Case 1: Quote without calculations
- Quote exists but no summary row
- **Expected:** NULL values in calculated fields, no crash

### Edge Case 2: Quote recalculated
- User edits quote and recalculates
- **Expected:** Summary row UPSERTed (updated if exists, inserted if not)

### Edge Case 3: Multiple products with same total_amount
- 2 quotes: both have total_amount = 10,000
- **Expected:** SUM(total_amount) = 20,000 (not duplicated by products)

### Edge Case 4: Percentage field aggregation
- calc_af16_profit_margin is a percentage (0.15 = 15%)
- **Expected:**
  - AVG works correctly
  - SUM is meaningless but doesn't crash
  - Frontend can show as percentage

---

## Rollback Procedure

If testing reveals issues:

1. **Revert backend changes:**
   ```bash
   git revert HEAD~1
   ```

2. **Drop migration:**
   ```sql
   DROP TABLE quote_calculation_summaries CASCADE;
   ```

3. **Clear Redis cache:**
   ```bash
   redis-cli FLUSHDB
   ```

4. **Restart backend:**
   ```bash
   cd backend && uvicorn main:app --reload
   ```

---

## Success Criteria

- [ ] New quotes populate quote_calculation_summaries table
- [ ] Mixed aggregations return correct values (no duplication)
- [ ] All 43 calculated fields work in analytics
- [ ] Standard mode shows calculated fields in grid
- [ ] Filters work with calculated fields
- [ ] Export includes calculated fields correctly
- [ ] Saved reports work with calculated fields
- [ ] Query performance improved 5-10x
- [ ] No RLS bypasses (org isolation maintained)

---

**Status:** Ready for testing
**Estimated Testing Time:** 30-45 minutes
**Tester:** Andrey
**Date:** 2025-11-08
