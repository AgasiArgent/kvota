# Quote Calculation Summaries - Design Document

**Date:** 2025-11-08
**Status:** Approved
**Effort:** 4-6 hours
**Priority:** HIGH

---

## Problem Statement

Analytics queries that aggregate both quote-level fields (`total_amount`) and calculated fields (`customs_duty`, `cogs`) produce incorrect results. The JOIN with `quote_items` table creates multiple rows per quote, causing quote-level values to multiply by the product count.

**Example:**
- Quote with 5 products, total_amount = 7,983.36 RUB
- Current result: SUM(total_amount) = 39,916.80 RUB (7,983.36 × 5) ❌
- Expected result: SUM(total_amount) = 7,983.36 RUB ✅

**User impact:** Analytics reports show inflated revenue and costs, making business intelligence unreliable.

**Current workaround:** Users must aggregate quote-level OR calculated fields separately, never together.

---

## Solution Overview

Create `quote_calculation_summaries` table to store pre-aggregated quote-level totals for all 43 calculated variables. This eliminates the 1:N JOIN that causes duplication.

**Architecture change:**
- Before: `quotes → quote_items (1:N) → quote_calculation_results (1:1)`
- After: `quotes → quote_calculation_summaries (1:1)`

**Benefits:**
- No duplication in mixed aggregations
- 5-10x faster analytics queries (no complex JOINs)
- Users can aggregate any combination of fields
- Percentage fields (markup) can use AVG correctly

---

## Database Schema

### New Table: quote_calculation_summaries

```sql
CREATE TABLE quote_calculation_summaries (
  quote_id UUID PRIMARY KEY REFERENCES quotes(id) ON DELETE CASCADE,

  -- Phase 1-4: Purchase, logistics, duties (totals per quote)
  calc_s16_total_purchase_price DECIMAL(15,2),
  calc_v16_total_logistics DECIMAL(15,2),
  calc_y16_customs_duty DECIMAL(15,2),
  calc_z16_excise_tax DECIMAL(15,2),
  calc_ay16_internal_price_total DECIMAL(15,2),

  -- Phase 5-9: Financing (quote-level values)
  calc_bh2_revenue_estimated DECIMAL(15,2),
  calc_bj11_total_financing_cost DECIMAL(15,2),
  calc_bl5_credit_sales_interest DECIMAL(15,2),

  -- Phase 10: COGS
  calc_ab16_cogs_total DECIMAL(15,2),

  -- Phase 11: Sales pricing
  calc_af16_profit_margin DECIMAL(10,4),  -- Calculated as percentage
  calc_ag16_dm_fee DECIMAL(15,2),
  calc_ah16_forex_risk_reserve DECIMAL(15,2),
  calc_ai16_agent_fee DECIMAL(15,2),
  calc_ae16_sale_price_total DECIMAL(15,2),
  calc_ak16_final_price_total DECIMAL(15,2),

  -- Phase 12: VAT
  calc_al16_total_with_vat DECIMAL(15,2),
  calc_an16_sales_vat DECIMAL(15,2),
  calc_ao16_deductible_vat DECIMAL(15,2),
  calc_ap16_net_vat_payable DECIMAL(15,2),

  -- Phase 13: Transit commission
  calc_aq16_transit_commission DECIMAL(15,2),

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_calc_summaries_quote_id
  ON quote_calculation_summaries(quote_id);
```

**Note:** Schema shows ~20 key fields. Full implementation includes all 43 calculated variables from the 13-phase pipeline.

### RLS Policies

```sql
ALTER TABLE quote_calculation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY quote_calc_summaries_select ON quote_calculation_summaries
  FOR SELECT USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id = (current_setting('app.current_organization_id', true))::uuid
    )
  );

CREATE POLICY quote_calc_summaries_insert ON quote_calculation_summaries
  FOR INSERT WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id = (current_setting('app.current_organization_id', true))::uuid
    )
  );

CREATE POLICY quote_calc_summaries_update ON quote_calculation_summaries
  FOR UPDATE USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id = (current_setting('app.current_organization_id', true))::uuid
    )
  );
```

---

## Aggregation Rules

### SUM (Monetary Fields - 40 fields)

All monetary values aggregate with SUM:
- Customs duties, logistics costs, COGS, revenues, VAT, commissions
- Example: `SUM(calc_y16_customs_duty)` = total customs duty across quotes

### CALCULATED (Derived from Aggregates - 1 field)

**Profit margin** recalculates from aggregated totals:
```
calc_af16_profit_margin = (SUM(revenue) - SUM(cogs)) / SUM(revenue) * 100
```

Not AVG(margin) - that produces incorrect weighted averages.

### QUOTE-LEVEL (Per-Quote Constants - 2 fields)

These fields remain constant across all products in a quote:
- `calc_ah16_forex_risk_reserve` - Forex risk percentage
- `calc_ai16_agent_fee` - Agent commission

Analytics displays the value but does not aggregate across quotes.

---

## Population Strategy

### When to Save

Save calculated summaries in two scenarios:

1. **New quote creation** - After calculation engine runs, aggregate product results and insert summary
2. **Quote update** - When user recalculates, update summary with new values

**No backfill** - Existing quotes without calculations remain NULL. Analytics queries handle this gracefully.

### Aggregation Logic

**Per-product to per-quote aggregation:**

```python
def aggregate_product_results(product_results: List[dict]) -> dict:
    """
    Aggregate 43 calculated fields from product-level to quote-level.
    """
    # SUM monetary fields
    totals = {
        'calc_y16_customs_duty': sum(p['Y16'] for p in product_results),
        'calc_ab16_cogs_total': sum(p['AB16'] for p in product_results),
        'calc_ak16_final_price_total': sum(p['AK16'] for p in product_results),
        # ... all 40 monetary fields
    }

    # Calculate profit margin from aggregated totals
    revenue = totals['calc_ak16_final_price_total']
    cogs = totals['calc_ab16_cogs_total']
    totals['calc_af16_profit_margin'] = ((revenue - cogs) / revenue) if revenue else 0

    # Quote-level fields (same for all products, take first)
    totals['calc_ah16_forex_risk_reserve'] = product_results[0]['AH16']
    totals['calc_ai16_agent_fee'] = product_results[0]['AI16']

    return totals
```

### Integration Point

Update `backend/routes/quotes_calc.py`:

```python
async def create_quote_with_calculation(request):
    # 1. Run calculation engine (existing code)
    calc_results = await run_calculation(products, settings)

    # 2. Aggregate product results to quote totals
    quote_totals = aggregate_product_results(calc_results)

    # 3. Insert quote
    quote = await insert_quote(quote_data)

    # 4. Insert calculation summary
    await supabase.table("quote_calculation_summaries").upsert({
        "quote_id": quote.id,
        **quote_totals
    }).execute()
```

---

## Analytics Integration

### Update Query Builder

**Before (complex multi-table JOIN):**
```sql
SELECT
  q.id,
  COALESCE(SUM(q.total_amount), 0) as sum_total_amount,
  COALESCE(SUM((qcr.phase_results->>'customs_fee')::numeric), 0) as sum_customs_duty
FROM quotes q
LEFT JOIN quote_items qi ON qi.quote_id = q.id  -- 1:N duplication!
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE q.organization_id = $1
GROUP BY q.id
```

**After (simple 1:1 JOIN):**
```sql
SELECT
  SUM(q.total_amount) as sum_total_amount,
  SUM(qcs.calc_y16_customs_duty) as sum_customs_duty
FROM quotes q
JOIN quote_calculation_summaries qcs ON qcs.quote_id = q.id
WHERE q.organization_id = $1
```

### Update ALLOWED_FIELDS Whitelist

`backend/analytics_security.py`:

```python
ALLOWED_FIELDS = {
    'quotes': [
        'id', 'quote_number', 'status', 'created_at', 'sent_at',
        'total_amount', 'currency', 'seller_company', 'offer_sale_type'
    ],
    'quote_calculation_summaries': [
        'calc_s16_total_purchase_price',
        'calc_v16_total_logistics',
        'calc_y16_customs_duty',
        'calc_ab16_cogs_total',
        'calc_af16_profit_margin',
        'calc_ak16_final_price_total',
        # ... all 43 calculated fields
    ],
    # Remove 'variables' and 'calculated' categories
}
```

### Update Query Logic

```python
def build_query(org_id, filters, selected_fields):
    # Check if we need summaries table
    needs_summaries = any(f.startswith('calc_') for f in selected_fields)

    if needs_summaries:
        sql = """
            SELECT {fields}
            FROM quotes q
            JOIN quote_calculation_summaries qcs ON qcs.quote_id = q.id
            WHERE q.organization_id = $1
        """
    else:
        sql = """
            SELECT {fields}
            FROM quotes q
            WHERE q.organization_id = $1
        """

    # Prefix fields with correct table alias
    select_parts = []
    for field in selected_fields:
        table = 'qcs' if field.startswith('calc_') else 'q'
        select_parts.append(f"{table}.{field}")

    return sql.format(fields=', '.join(select_parts))
```

---

## Testing Strategy

### Unit Tests

Test aggregation logic:
```python
def test_aggregate_product_results():
    products = [
        {'Y16': 100, 'AB16': 500, 'AK16': 1000},
        {'Y16': 200, 'AB16': 600, 'AK16': 1200},
    ]

    result = aggregate_product_results(products)

    assert result['calc_y16_customs_duty'] == 300
    assert result['calc_ab16_cogs_total'] == 1100
    assert result['calc_ak16_final_price_total'] == 2200
    assert result['calc_af16_profit_margin'] == 0.50  # 50%
```

### Integration Tests

Test end-to-end quote creation:
```python
async def test_create_quote_populates_summaries():
    quote = await create_quote_with_calculation(test_data)

    summary = await fetch_quote_summary(quote.id)

    assert summary.calc_ab16_cogs_total == expected_cogs
    assert summary.calc_ak16_final_price_total == expected_revenue
```

### Analytics Tests

Test mixed aggregations:
```python
async def test_mixed_aggregation_no_duplication():
    # Create quote with 5 products, total_amount = 7,983.36
    quote = await create_test_quote(product_count=5, total_amount=7983.36)

    # Query with mixed fields
    result = await analytics_query(
        fields=['total_amount', 'calc_y16_customs_duty'],
        aggregations={'sum_total_amount': {'function': 'sum', 'field': 'total_amount'}}
    )

    # Should NOT multiply by product count
    assert result['sum_total_amount'] == 7983.36  # Not 39,916.80!
```

---

## Migration Checklist

- [ ] Create migration file `024_quote_calculation_summaries.sql`
- [ ] Include all 43 calculated fields
- [ ] Add indexes on `quote_id`
- [ ] Enable RLS with policies (SELECT, INSERT, UPDATE)
- [ ] Test RLS with multiple organizations
- [ ] Update `backend/routes/quotes_calc.py` with aggregation logic
- [ ] Update `backend/analytics_security.py` with new whitelist
- [ ] Update query builder in `analytics_security.py`
- [ ] Write unit tests for aggregation logic
- [ ] Write integration tests for quote creation
- [ ] Write analytics tests for mixed aggregations
- [ ] Update `.claude/ANALYTICS_TECHNICAL_DEBT.md` to mark issue resolved

---

## Performance Impact

**Before:**
- Query time: 200-500ms (multiple JOINs, GROUP BY)
- Complexity: O(quotes × products)

**After:**
- Query time: 20-50ms (single 1:1 JOIN)
- Complexity: O(quotes)

**Expected improvement:** 5-10x faster analytics queries

---

## Rollback Plan

If migration fails:
1. Drop table: `DROP TABLE quote_calculation_summaries CASCADE;`
2. Revert analytics code changes
3. Restore original JOIN logic

No data loss - product-level calculations remain in `quote_calculation_results`.

---

## Success Criteria

- [ ] Analytics queries with mixed aggregations return correct values
- [ ] No duplication in SUM aggregations
- [ ] Profit margin calculates correctly from aggregated totals
- [ ] Query performance improves by 5-10x
- [ ] All existing analytics tests pass
- [ ] RLS policies prevent cross-organization access

---

**Author:** Claude
**Reviewed:** Andrey (User)
**Approved:** 2025-11-08
