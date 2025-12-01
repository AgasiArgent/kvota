# Implementation Plan: VAT Rate 2026 Increase

**Design Doc:** `docs/plans/2025-11-24-vat-rate-2026-increase-design.md`
**Estimated Time:** 2.5 hours
**Complexity:** Low
**Worktree:** `/home/novi/workspace/tech/projects/kvota/user-feedback`

---

## Task Breakdown

### **Task 1: Update Calculation Engine Core (30 min)**

**File:** `backend/calculation_engine.py`

**Changes:**

1. **Modify `get_rate_vat_ru()` function** (lines 116-118):
   ```python
   # Current:
   def get_rate_vat_ru(seller_region: str) -> Decimal:
       return RATE_VAT_BY_SELLER_REGION[seller_region]

   # New:
   def get_rate_vat_ru(seller_region: str, delivery_date: Optional[date] = None) -> Decimal:
       """Get Russian VAT rate based on delivery date.

       Returns 22% for Russian sellers if delivery year >= 2026.
       Returns 20% for Russian sellers if delivery year < 2026 or date unknown.
       Returns 0% for Turkish/Chinese sellers regardless of date.
       """
       base_rate = RATE_VAT_BY_SELLER_REGION[seller_region]

       if seller_region == "RU" and delivery_date and delivery_date.year >= 2026:
           return Decimal("0.22")

       return base_rate
   ```

2. **Update 3 call sites** (lines ~400, ~823, ~1124):
   - Extract `delivery_date` from input
   - Pass to `get_rate_vat_ru(seller_region, delivery_date)`

   **Example:**
   ```python
   # Before:
   rate_vat_ru = get_rate_vat_ru(seller_region)

   # After:
   delivery_date = quote_data.get("delivery_date")
   rate_vat_ru = get_rate_vat_ru(seller_region, delivery_date)
   ```

**Verification:**
- [ ] Function signature updated
- [ ] All 3 call sites updated
- [ ] Imports include `from datetime import date`

---

### **Task 2: Update API Route to Include delivery_date (45 min)**

**File:** `backend/routes/quotes_calc.py`

**Changes:**

1. **Add delivery_date calculation in mapper:**
   ```python
   def map_variables_to_calculation_input(variables: dict, quote_date: date) -> dict:
       """Map JSONB variables to calculation input."""

       # Calculate delivery_date from delivery_time
       delivery_time_days = variables.get("delivery_time", 30)
       calculated_delivery_date = quote_date + timedelta(days=delivery_time_days)

       # Allow explicit override
       delivery_date_str = variables.get("delivery_date")
       if delivery_date_str:
           delivery_date = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
       else:
           delivery_date = calculated_delivery_date

       return {
           "delivery_date": delivery_date,
           "seller_company": variables["seller_company"],
           # ... other variables
       }
   ```

2. **Add validation:**
   ```python
   if not delivery_date:
       raise ValueError("delivery_date is required for VAT calculation")

   if delivery_date < quote_date:
       raise ValueError("delivery_date cannot be before quote_date")
   ```

3. **Update imports:**
   ```python
   from datetime import datetime, date, timedelta
   ```

**Verification:**
- [ ] delivery_date calculated from quote_date + delivery_time
- [ ] delivery_date passed to calculation engine
- [ ] Validation prevents invalid dates
- [ ] Import timedelta added

---

### **Task 3: Write Unit Tests (30 min)**

**File:** `backend/tests/calculation/test_vat_rate_2026.py` (new file)

**Tests to write:**

```python
import pytest
from decimal import Decimal
from datetime import date
from calculation_engine import get_rate_vat_ru

def test_vat_20_percent_before_2026():
    """Returns 20% for delivery before 2026."""
    delivery = date(2025, 12, 31)
    assert get_rate_vat_ru("RU", delivery) == Decimal("0.20")

def test_vat_22_percent_from_2026():
    """Returns 22% for delivery in 2026 or later."""
    test_dates = [
        date(2026, 1, 1),   # First day of 2026
        date(2026, 6, 15),  # Mid-year
        date(2027, 1, 1),   # 2027
        date(2030, 12, 31), # Far future
    ]
    for delivery in test_dates:
        rate = get_rate_vat_ru("RU", delivery)
        assert rate == Decimal("0.22"), f"Failed for {delivery}"

def test_vat_backward_compatible():
    """Returns 20% when no delivery_date provided."""
    assert get_rate_vat_ru("RU", None) == Decimal("0.20")

def test_vat_turkish_unchanged():
    """Turkish sellers always 0% regardless of date."""
    delivery_2026 = date(2026, 6, 15)
    assert get_rate_vat_ru("TR", delivery_2026) == Decimal("0.00")
    assert get_rate_vat_ru("CN", delivery_2026) == Decimal("0.00")

def test_vat_boundary_conditions():
    """Test exact boundary dates."""
    # Last day of 2025 = 20%
    assert get_rate_vat_ru("RU", date(2025, 12, 31)) == Decimal("0.20")
    # First day of 2026 = 22%
    assert get_rate_vat_ru("RU", date(2026, 1, 1)) == Decimal("0.22")
```

**Run tests:**
```bash
cd backend
pytest tests/calculation/test_vat_rate_2026.py -v
```

**Expected:** 5/5 tests passing ✅

**Verification:**
- [ ] All 5 tests written
- [ ] All tests pass
- [ ] Edge cases covered (boundary dates, None, Turkish sellers)

---

### **Task 4: Frontend UI Updates (30 min)**

**File:** `frontend/src/app/quotes/create/page.tsx`

**Changes:**

1. **Add delivery_date calculation:**
   ```typescript
   const deliveryDate = useMemo(() => {
     if (!formData.quote_date || !formData.delivery_time) return null;
     const date = new Date(formData.quote_date);
     date.setDate(date.getDate() + parseInt(formData.delivery_time));
     return date;
   }, [formData.quote_date, formData.delivery_time]);

   const vatRate = useMemo(() => {
     if (!deliveryDate) return '20%';
     return deliveryDate.getFullYear() >= 2026 ? '22%' : '20%';
   }, [deliveryDate]);
   ```

2. **Add visual indicator:**
   ```tsx
   <Form.Item label="Срок поставки (дней)" name="delivery_time">
     <InputNumber min={1} max={365} defaultValue={30} />
   </Form.Item>

   {deliveryDate && (
     <Alert
       message={
         <>
           <strong>Дата поставки:</strong> {deliveryDate.toLocaleDateString('ru-RU')}
           {' • '}
           <strong>НДС:</strong> {vatRate}
         </>
       }
       type={vatRate === '22%' ? 'warning' : 'info'}
       showIcon
       style={{ marginTop: 8 }}
     />
   )}
   ```

**Verification:**
- [ ] delivery_date calculated correctly
- [ ] VAT rate indicator shows 20% or 22%
- [ ] Visual feedback for 2026+ dates (warning alert)
- [ ] Russian date format used

---

### **Task 5: Integration Testing (15 min)**

**Manual test scenarios:**

1. **Scenario: 2025 delivery**
   - Create quote with delivery_time = 30 days (current date + 30)
   - Expected: VAT rate = 20%
   - Verify calculation results show 20% VAT

2. **Scenario: 2026 delivery**
   - Create quote with delivery_time = 400 days (crosses into 2026)
   - Expected: VAT rate = 22%
   - Verify calculation results show 22% VAT
   - Verify frontend shows orange warning alert

3. **Scenario: Turkish seller**
   - Create quote with seller_company = "TEXCEL OTOMOTİV..."
   - Set delivery_time = 400 days (2026)
   - Expected: VAT rate = 0% (unchanged)

**Checklist:**
- [ ] 2025 delivery shows 20% VAT
- [ ] 2026 delivery shows 22% VAT
- [ ] Frontend alert displays correct info
- [ ] Turkish/Chinese sellers unaffected
- [ ] No calculation errors in console

---

### **Task 6: Optional - Backfill Existing Quotes (10 min)**

**Script:** `backend/scripts/backfill_delivery_dates.py` (create if needed)

**Purpose:** Add `delivery_date` to existing quotes' JSONB variables.

**Run:**
```bash
cd backend
python -m scripts.backfill_delivery_dates
```

**Expected output:**
```
Found 23 quotes to backfill
Backfilled 23 quotes with delivery_date
```

**Verification:**
- [ ] Script runs without errors
- [ ] Query shows delivery_date in JSONB:
  ```sql
  SELECT variables->'delivery_date' FROM quote_calculation_variables LIMIT 5;
  ```

---

## Deployment Checklist

**Pre-deployment:**
- [ ] All unit tests pass (5/5)
- [ ] Integration tests pass (3/3 scenarios)
- [ ] Code reviewed by @code-reviewer agent
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Backend tests pass: `pytest backend/tests/`

**Deployment:**
1. [ ] Deploy backend first (backward compatible)
2. [ ] Deploy frontend
3. [ ] Run backfill script (optional)
4. [ ] Smoke test: Create 1 quote with 2026 delivery

**Post-deployment:**
- [ ] Verify 2026 quotes show 22% VAT
- [ ] Verify existing 2025 quotes still show 20%
- [ ] Monitor for errors in Sentry
- [ ] No performance degradation (<5ms calculation time)

---

## Rollback Plan

**If critical issue:**

1. **Revert calculation_engine.py** (2 min):
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Redeploy backend** (5 min)

3. **Frontend optional** - Can stay deployed (graceful degradation)

**No database rollback needed** - JSONB changes are non-breaking.

---

## Success Criteria

✅ Unit tests: 5/5 passing
✅ Integration tests: 3/3 scenarios working
✅ 2025 deliveries: 20% VAT
✅ 2026+ deliveries: 22% VAT
✅ Turkish/Chinese sellers: 0% VAT (unchanged)
✅ Frontend displays correct delivery_date and VAT rate
✅ No errors in production logs
✅ Calculation time < 5ms (no performance regression)

---

## Timeline

| Task | Duration | Owner |
|------|----------|-------|
| Task 1: Calculation engine | 30 min | Backend dev |
| Task 2: API route | 45 min | Backend dev |
| Task 3: Unit tests | 30 min | Backend dev |
| Task 4: Frontend UI | 30 min | Frontend dev |
| Task 5: Integration testing | 15 min | QA / Dev |
| Task 6: Backfill (optional) | 10 min | Backend dev |
| **Total** | **2.5 hours** | |

---

## Ready to Start?

**Next step:** Begin Task 1 - Update `calculation_engine.py`

**Command to start:**
```bash
cd /home/novi/workspace/tech/projects/kvota/user-feedback/backend
code calculation_engine.py
```

All tasks are independent and can be worked on in parallel by different developers. Backend tasks (1-3) should complete before frontend (Task 4).
