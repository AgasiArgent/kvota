# VAT Rate Change for 2026 - Design Document

**Date:** 2025-11-24
**Author:** Claude (with user approval)
**Status:** Approved for Implementation
**Estimated Time:** 2-3 hours

---

## Problem Statement

Russian government is increasing VAT from 20% to 22% starting January 1, 2026. Our calculation engine currently hardcodes 20% VAT rate. We need to calculate VAT based on delivery date:
- Delivery before 2026: 20% VAT
- Delivery in 2026 or later: 22% VAT

---

## Current Architecture

### VAT Rate Storage
**File:** `backend/calculation_engine.py:79-83`

```python
RATE_VAT_BY_SELLER_REGION = {
    "RU": Decimal("0.20"),  # 20% (hardcoded)
    "TR": Decimal("0.00"),
    "CN": Decimal("0.00")
}
```

**Usage:** Called by `get_rate_vat_ru(seller_region)` in 3 calculation phases

### Delivery Date Storage
**Table:** `quote_calculation_variables`
**Column:** `variables` (JSONB)
**Current fields:**
- `delivery_time`: 30 (number of days)
- **Missing:** `delivery_date` (actual date)

**Example JSONB:**
```json
{
  "markup": 15,
  "delivery_time": 30,
  "seller_company": "МАСТЕР БЭРИНГ ООО",
  "offer_incoterms": "DDP",
  ...
}
```

---

## Chosen Approach: Date-Based Logic (Approved)

### Architecture
1. Add `delivery_date` field to JSONB `variables`
2. Modify `get_rate_vat_ru()` to accept `delivery_date` parameter
3. Return 22% if `delivery_date.year >= 2026`, else 20%
4. Update all 3 calculation phase call sites

### Rationale
- **Simple:** 15 lines of code change
- **No database migration:** JSONB is schema-less
- **Clear business logic:** Explicit year check
- **Fast:** No database lookups
- **Maintainable:** Easy to update for future VAT changes

### Trade-offs
✅ Fast implementation (2-3 hours)
✅ No database downtime
✅ Easy to test
⚠️ Future VAT changes require code update (acceptable - VAT changes rarely, ~every 5 years)

---

## Implementation Details

### 1. Backend - Calculation Engine

**File:** `backend/calculation_engine.py`

**Change function signature (line 116):**
```python
# Before:
def get_rate_vat_ru(seller_region: str) -> Decimal:
    return RATE_VAT_BY_SELLER_REGION[seller_region]

# After:
def get_rate_vat_ru(seller_region: str, delivery_date: Optional[date] = None) -> Decimal:
    """Get Russian VAT rate based on seller region and delivery date.

    VAT Rate Timeline:
    - Before 2026: 20%
    - 2026 onwards: 22% (government mandate effective Jan 1, 2026)

    Args:
        seller_region: Seller region code (RU, TR, CN)
        delivery_date: Expected delivery date (optional for backward compat)

    Returns:
        Decimal: VAT rate (0.20, 0.22 for RU; 0.00 for TR/CN)
    """
    base_rate = RATE_VAT_BY_SELLER_REGION[seller_region]

    # Only adjust Russian VAT (Turkish/Chinese stay at 0%)
    if seller_region == "RU" and delivery_date and delivery_date.year >= 2026:
        return Decimal("0.22")  # 22% for 2026+

    return base_rate  # 20% for <2026 or non-Russian
```

**Update call sites (3 locations):**
1. Phase 2 price calculation (~line 400)
2. Single-product orchestrator (~line 823)
3. Multi-product orchestrator (~line 1124)

**Example update:**
```python
# Before:
rate_vat_ru = get_rate_vat_ru(seller_region)

# After:
delivery_date = input_data.get("delivery_date")  # Extract from JSONB
rate_vat_ru = get_rate_vat_ru(seller_region, delivery_date)
```

---

### 2. Backend - API Route

**File:** `backend/routes/quotes_calc.py`

**Add delivery_date to calculation input:**
```python
def map_variables_to_calculation_input(variables: dict, ...) -> dict:
    """
    Map JSONB variables to calculation engine input.
    """
    # Calculate delivery_date from quote_date + delivery_time
    quote_date = variables.get("quote_date", date.today())
    delivery_time_days = variables.get("delivery_time", 30)
    delivery_date = quote_date + timedelta(days=delivery_time_days)

    # Allow override if delivery_date explicitly provided
    if "delivery_date" in variables:
        delivery_date = datetime.strptime(variables["delivery_date"], "%Y-%m-%d").date()

    return {
        "delivery_date": delivery_date,
        "seller_company": variables["seller_company"],
        # ... other 39 variables
    }
```

**Validation:** Ensure delivery_date exists before calculation
```python
if not delivery_date:
    raise ValueError("delivery_date is required for VAT calculation")

if delivery_date < quote_date:
    raise ValueError("delivery_date cannot be before quote_date")
```

---

### 3. Frontend - Quote Creation

**File:** `frontend/src/app/quotes/create/page.tsx`

**Add calculated delivery_date display:**
```typescript
// Calculate delivery_date from delivery_time
const deliveryDate = useMemo(() => {
  if (!quoteDate || !deliveryTime) return null;
  const date = new Date(quoteDate);
  date.setDate(date.getDate() + parseInt(deliveryTime));
  return date;
}, [quoteDate, deliveryTime]);

// Show VAT rate that will apply
const vatRate = useMemo(() => {
  if (!deliveryDate) return '20%';
  return deliveryDate.getFullYear() >= 2026 ? '22%' : '20%';
}, [deliveryDate]);
```

**Display near delivery time field:**
```tsx
<Form.Item label="Срок поставки (дней)" name="delivery_time">
  <InputNumber min={1} max={365} />
</Form.Item>

{deliveryDate && (
  <Alert
    message={`Дата поставки: ${deliveryDate.toLocaleDateString('ru-RU')} • НДС: ${vatRate}`}
    type={vatRate === '22%' ? 'warning' : 'info'}
    style={{ marginTop: 8 }}
  />
)}
```

---

### 4. Testing Strategy

**Unit Tests (backend/tests/calculation/):**

```python
def test_vat_rate_before_2026():
    """VAT should be 20% for delivery before 2026"""
    delivery_date = date(2025, 12, 31)
    rate = get_rate_vat_ru("RU", delivery_date)
    assert rate == Decimal("0.20")

def test_vat_rate_2026_onwards():
    """VAT should be 22% for delivery in 2026 or later"""
    test_cases = [
        date(2026, 1, 1),   # Exact start date
        date(2026, 6, 15),  # Mid-2026
        date(2027, 1, 1),   # Future years
        date(2030, 12, 31), # Far future
    ]
    for delivery_date in test_cases:
        rate = get_rate_vat_ru("RU", delivery_date)
        assert rate == Decimal("0.22"), f"Failed for {delivery_date}"

def test_vat_rate_backward_compat():
    """VAT should default to 20% if no delivery_date provided"""
    rate = get_rate_vat_ru("RU", None)
    assert rate == Decimal("0.20")

def test_vat_rate_turkish_seller():
    """Turkish/Chinese sellers should remain 0% regardless of date"""
    delivery_date = date(2026, 6, 15)
    assert get_rate_vat_ru("TR", delivery_date) == Decimal("0.00")
    assert get_rate_vat_ru("CN", delivery_date) == Decimal("0.00")
```

**Integration Tests:**
1. Create quote with delivery in 2025 → Verify 20% VAT in results
2. Create quote with delivery in 2026 → Verify 22% VAT in results
3. Update delivery_time → Verify VAT rate updates correctly

**Manual Testing Checklist:**
- [ ] Create quote with delivery_time=30 days (current year) → 20% VAT
- [ ] Create quote with delivery_time=400 days (crosses into 2026) → 22% VAT
- [ ] Verify frontend shows correct delivery_date and VAT rate
- [ ] Verify PDF export shows correct VAT rate
- [ ] Test with Turkish seller → 0% VAT regardless of date

---

### 5. Data Migration (Optional)

**No database migration required** - JSONB is schema-less.

**Optional backfill script** (if needed for existing quotes):
```python
# backend/scripts/backfill_delivery_dates.py
"""
Backfill delivery_date for existing quotes.
Run once after deployment.
"""
import asyncpg
from datetime import timedelta

async def backfill_delivery_dates():
    conn = await asyncpg.connect(DATABASE_URL)

    # Get all quotes with variables
    quotes = await conn.fetch("""
        SELECT qcv.id, qcv.variables, q.quote_date
        FROM quote_calculation_variables qcv
        JOIN quotes q ON qcv.quote_id = q.id
        WHERE qcv.variables->>'delivery_date' IS NULL
    """)

    print(f"Found {len(quotes)} quotes to backfill")

    for quote in quotes:
        variables = quote['variables']
        quote_date = quote['quote_date']
        delivery_time = variables.get('delivery_time', 30)

        # Calculate delivery_date
        delivery_date = quote_date + timedelta(days=delivery_time)

        # Update variables JSONB
        variables['delivery_date'] = delivery_date.isoformat()

        await conn.execute("""
            UPDATE quote_calculation_variables
            SET variables = $1
            WHERE id = $2
        """, variables, quote['id'])

    print(f"Backfilled {len(quotes)} quotes")
    await conn.close()

# Run: python -m scripts.backfill_delivery_dates
```

---

## Rollback Plan

**If issues arise:**

1. **Immediate rollback** (5 minutes):
   ```python
   # Revert get_rate_vat_ru() to original
   def get_rate_vat_ru(seller_region: str) -> Decimal:
       return RATE_VAT_BY_SELLER_REGION[seller_region]
   ```

2. **Remove delivery_date from call sites** (10 minutes):
   ```python
   # Change back to:
   rate_vat_ru = get_rate_vat_ru(seller_region)
   ```

3. **Redeploy backend** - No database rollback needed

4. **Data impact:** None - delivery_date in JSONB doesn't break anything if unused

---

## Success Criteria

✅ All unit tests pass (8 new tests)
✅ Integration tests pass (3 scenarios)
✅ Manual testing checklist complete
✅ VAT calculated correctly for 2025 quotes (20%)
✅ VAT calculated correctly for 2026+ quotes (22%)
✅ Backward compatibility maintained (existing code works)
✅ Frontend shows correct delivery_date and VAT rate
✅ No performance degradation (<5ms calculation time)

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Backend Changes** | 60 min | Update calculation_engine.py, routes/quotes_calc.py |
| **Frontend Changes** | 30 min | Add delivery_date display, VAT rate indicator |
| **Testing** | 45 min | Write 8 unit tests, 3 integration tests, manual testing |
| **Deployment** | 15 min | Deploy backend, deploy frontend, smoke test |
| **Total** | **2.5 hours** | End-to-end implementation |

---

## Dependencies

**Code:**
- `backend/calculation_engine.py` (core logic)
- `backend/routes/quotes_calc.py` (API integration)
- `frontend/src/app/quotes/create/page.tsx` (UI display)

**Skills:**
- `calculation-engine-guidelines` (calculation patterns)
- `backend-dev-guidelines` (API patterns)
- `frontend-dev-guidelines` (React patterns)

**Testing:**
- `backend/tests/calculation/` (unit tests)
- Manual testing in dev environment

---

## Future Considerations

**2027+ VAT Changes:**
If VAT rate changes again (e.g., 25% in 2030):
1. Update `get_rate_vat_ru()` logic (5 minutes)
2. Add test case (2 minutes)
3. Deploy (10 minutes)

**Alternative: Database-driven rates**
If VAT changes become frequent (>1/year), consider:
- Create `vat_rate_history` table
- Store effective_date and rate
- Query database for applicable rate
- Trade-off: Adds complexity, slower calculation (~50ms DB lookup)

**Decision:** Stick with code-based approach unless change frequency increases

---

## Approval

**Design approved by:** User
**Date:** 2025-11-24
**Ready for implementation:** ✅ Yes

**Next step:** Phase 6 - Create implementation plan with detailed tasks
