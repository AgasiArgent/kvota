# Financial Approval MVP - Test Plan

**Date:** 2025-11-20
**Feature:** Financial approval workflow with Excel export and auto-validations
**Tester:** Claude (Chrome DevTools MCP)

---

## Prerequisites

**Environment:**
- ✅ Frontend running on :3000 or :3001
- ✅ Backend running on :8000
- ✅ Migration 026 applied to database
- ✅ Test user credentials:
  - Email: `andrey@masterbearingsales.ru`
  - Password: `password`
  - Organization: МАСТЕР БЭРИНГ ООО

**Test Data Requirements:**
- At least 1 quote with `workflow_state = 'awaiting_financial_approval'`
- Quote should have calculation results (totals, markup, etc.)
- If no quotes exist, create one via UI

---

## Test Scenarios

### Scenario 1: Happy Path - Approve Quote ✅

**Objective:** Financial manager successfully approves quote with valid data

**Steps:**
1. Login as test user
2. Navigate to Quotes list
3. Find quote with status "Awaiting Financial Approval"
4. Open quote detail page
5. Verify Financial Approval Actions card is visible
6. Click "Скачать Финансовый Анализ" button
7. Verify Excel file downloads successfully
8. Open Excel file and verify:
   - Quote info populated (number, customer, total)
   - Basic info section (D5-D11 equivalent)
   - Payment terms section
   - Logistics breakdown
   - Quote totals row (horizontal layout)
   - Products table
   - No red cells (all validations pass)
9. Return to UI
10. Click "Одобрить" button
11. Modal opens with comment field
12. Add optional comment: "All checks passed"
13. Click "Одобрить" in modal
14. Verify success message appears
15. Verify quote status changes to "Одобрено"
16. Verify workflow card updates

**Expected Results:**
- ✅ Excel downloads with correct filename (Financial_Review_[quote_number].xlsx)
- ✅ Excel contains all quote data
- ✅ No validation issues (no red cells)
- ✅ Approve action succeeds
- ✅ Quote workflow_state → 'approved'
- ✅ Comment saved in database
- ✅ UI refreshes and shows new state

**Success Criteria:**
- All steps complete without errors
- Excel format matches specification
- Workflow transition recorded

---

### Scenario 2: Send Back - Quote Has Issues ✅

**Status:** PASSED (2025-11-20)
**Bug Found & Fixed:** Comments field mapping error (commit: dca8eef)

**Objective:** Financial manager finds issues and sends quote back for corrections

**Steps:**
1. Find/create quote with `workflow_state = 'awaiting_financial_approval'`
2. Set quote data to have validation issues:
   - `markup = 3.0` (too low, need 15%)
   - `dm_fee_value = 150000`
   - `total_margin = 100000` (DM fee > margin)
   - `vat_removed = false`
3. Open quote detail page
4. Click "Скачать Финансовый Анализ"
5. Verify Excel shows validation issues:
   - Markup cell (E19) is RED with comment
   - DM Fee cell (M19) is RED with comment
   - VAT status is YELLOW with warning
6. Return to UI
7. Click "Вернуть на доработку" button
8. Modal opens
9. Try to submit without comment → should show error
10. Add comment: "Наценка слишком низкая (8%, требуется 15%). DM гонорар превышает маржу."
11. Click "Вернуть"
12. Verify success message
13. Verify workflow_state → 'draft'
14. Verify comment saved

**Expected Results:**
- ✅ Excel highlights issues (red cells + comments)
- ✅ Send Back requires comment (validation works)
- ✅ Quote returns to 'draft' state
- ✅ Reason saved and visible to sales manager
- ✅ UI updates correctly

**Success Criteria:**
- Validation highlighting works
- Comment validation enforced
- Workflow transition correct

**Test Results (2025-11-20):**
- ✅ Quote setup: КП25-0071 set to awaiting_financial_approval with validation issues
- ✅ Excel download: Successful
- ✅ Comment validation: Form correctly prevented submission without comment
- ✅ Send back action: Successfully sent back with comment
- ✅ Workflow transition: awaiting_financial_approval → draft
- ✅ Comment saved: "Наценка слишком низкая (3%, требуется 15%). DM гонорар превышает маржу. Исправьте перед повторной отправкой."
- ✅ UI update: Financial Approval Actions card correctly disappeared

**Bug Fixed:**
- Field name `"reason"` → `"comments"` in send_back function (routes/financial_approval.py:403)
- Commit: dca8eef

---

### Scenario 3: Excel Validation - Low Markup

**Objective:** Verify markup validation logic with different advance/delivery combinations

**Test Cases:**

**Case 3.1: Standard threshold**
- Advance: 70%
- Delivery: 60 days
- Markup: 3%
- Expected: ❌ RED (need 5%)

**Case 3.2: Advance-based penalty**
- Advance: 50%
- Delivery: 60 days
- Markup: 8%
- Expected: ❌ RED (need 15% = 5% base + 10% penalty)

**Case 3.3: High penalty**
- Advance: 30%
- Delivery: 90 days
- Markup: 12%
- Expected: ❌ RED (need 20% = 5% base + 15% penalty)

**Case 3.4: Boundary case**
- Advance: 50%
- Delivery: 60 days
- Markup: 15.0%
- Expected: ✅ GREEN (exactly meets threshold)

**Steps:**
For each case:
1. Create/modify quote with specified parameters
2. Download Financial Review Excel
3. Check markup cell (E19) color and comment
4. Verify formula matches: required = 5% + (delivery/30) * 5% if advance ≤ 50%

**Expected Results:**
- Formula calculates correctly for all cases
- Red highlighting appears for failed cases
- Green/no highlighting for passed cases
- Comments explain exact threshold required

---

### Scenario 4: Excel Validation - DM Fee vs Margin

**Objective:** Verify DM fee validation

**Test Cases:**

**Case 4.1: DM fee exceeds margin**
- DM fee: 120,000 ₽
- Margin: 96,000 ₽
- Expected: ❌ RED with comment

**Case 4.2: DM fee below margin**
- DM fee: 50,000 ₽
- Margin: 100,000 ₽
- Expected: ✅ GREEN (no highlighting)

**Case 4.3: DM fee equals margin (boundary)**
- DM fee: 100,000 ₽
- Margin: 100,000 ₽
- Expected: ✅ GREEN (equal is OK)

**Steps:**
1. Modify quote to set DM fee and margin values
2. Download Excel
3. Check DM Гонорар cell (M19) color
4. Verify comment text if red

**Expected Results:**
- Correct highlighting based on DM fee vs margin
- Clear error message in comment

---

### Scenario 5: VAT Removal Warning ⚠️

**Objective:** Verify VAT removal status indication

**Test Cases:**

**Case 5.1: VAT removed**
- `vat_removed = true`
- Expected: Shows "ДА" with no highlighting

**Case 5.2: VAT not removed**
- `vat_removed = false`
- Expected: Shows "НЕТ" with YELLOW highlighting + warning comment

**Steps:**
1. Set quote vat_removed flag
2. Download Excel
3. Check VAT status row
4. Verify color and comment

**Expected Results:**
- Yellow warning when VAT not removed
- Clear warning message
- Green/normal when VAT removed

---

### Scenario 6: Product-Level Markup Validation

**Objective:** Verify per-product markup validation

**Test Data:**
```
Quote: advance=50%, delivery=60 days → require 15% markup

Product 1: markup=7%  → ❌ RED (too low)
Product 2: markup=16% → ✅ GREEN (OK)
Product 3: markup=4%  → ❌ RED (very low)
```

**Steps:**
1. Create quote with 3 products with different markups
2. Download Excel
3. Check Products table (rows 26-28)
4. Verify markup column (F26, F27, F28) colors
5. Read comments for failed products

**Expected Results:**
- Product 1 markup RED with comment
- Product 2 markup GREEN (no issue)
- Product 3 markup RED with comment
- Comments explain required threshold

---

### Scenario 7: Authorization & Permissions

**Objective:** Verify only authorized users see approval actions

**Test Cases:**

**Case 7.1: Finance Manager role**
- User role: finance_manager
- Expected: ✅ See approval actions

**Case 7.2: Admin role**
- User role: admin
- Expected: ✅ See approval actions

**Case 7.3: Sales Manager role**
- User role: sales_manager
- Expected: ❌ Don't see approval actions (maybe see download only?)

**Steps:**
1. Login with different role users
2. Open quote with workflow_state='awaiting_financial_approval'
3. Check if Financial Approval Actions card visible
4. Try to call API directly (if hidden in UI)

**Expected Results:**
- Finance managers see all actions
- Other roles see appropriate subset or nothing
- API returns 403 Forbidden for unauthorized roles

---

### Scenario 8: Workflow State Transitions

**Objective:** Verify workflow state changes correctly

**Test Cases:**

**Case 8.1: Approve transition**
- Initial: 'awaiting_financial_approval'
- Action: Approve
- Expected: 'approved'

**Case 8.2: Send back transition**
- Initial: 'awaiting_financial_approval'
- Action: Send Back
- Expected: 'draft'

**Case 8.3: Invalid state**
- Initial: 'draft'
- Action: Approve
- Expected: Error (not in correct state)

**Steps:**
1. Set quote to initial state
2. Perform action
3. Check workflow_state in database
4. Check workflow_transitions table has record
5. Check UI updates

**Expected Results:**
- Correct state transitions
- Transitions recorded in workflow_transitions table
- Comments saved correctly
- UI reflects new state

---

### Scenario 9: Excel Layout & Formatting

**Objective:** Verify Excel structure matches specification

**Checks:**

**Layout:**
- [ ] Row 1: Header "ФИНАНСОВЫЙ АНАЛИЗ КП" (merged A1:M1, centered)
- [ ] Row 3: Quote info (number, customer, total) in columns A-K
- [ ] Row 5: Section headers (ОСНОВНЫЕ ДАННЫЕ | УСЛОВИЯ ОПЛАТЫ | ЛОГИСТИКА)
- [ ] Rows 6-14: Three sections side-by-side
- [ ] Row 17-19: Quote totals header + values (horizontal)
- [ ] Row 21: VAT status + DM fee type
- [ ] Row 23+: Products table

**Formatting:**
- [ ] Russian labels throughout
- [ ] Currency formatted as #,##0.00 ₽
- [ ] Percentages formatted as 0.00"%"
- [ ] Bold headers
- [ ] Merged cells for long text
- [ ] Proper column widths (readable)

**Content:**
- [ ] All quote-level fields present
- [ ] All logistics components (9 items)
- [ ] Payment terms (advance, time to advance)
- [ ] Quote totals (7 fields)
- [ ] Products table (7 columns)

**Validations:**
- [ ] Red cells for failed validations
- [ ] Yellow cells for warnings
- [ ] Comments attached to cells
- [ ] Comment text explains issue clearly

---

### Scenario 10: Error Handling

**Objective:** Verify error handling for edge cases

**Test Cases:**

**Case 10.1: Quote not found**
- Access `/api/quotes/invalid-uuid/financial-review`
- Expected: 404 Not Found

**Case 10.2: Wrong organization**
- Use quote from different organization
- Expected: 404 Not Found (RLS blocks)

**Case 10.3: Wrong workflow state**
- Quote in 'draft' state
- Try to approve
- Expected: 400 Bad Request with clear message

**Case 10.4: Missing required comment**
- Send back without comment
- Expected: 400 Bad Request

**Case 10.5: Network error**
- Simulate backend down
- Expected: Frontend shows error message, doesn't crash

**Steps:**
1. Set up each error condition
2. Perform action
3. Verify error response
4. Check error message clarity
5. Verify UI handles error gracefully

---

## Test Execution Checklist

**Before testing:**
- [ ] Backend running (port 8000)
- [ ] Frontend running (port 3000/3001)
- [ ] Migration 026 applied
- [ ] Chrome DevTools MCP available
- [ ] Test user can login

**During testing:**
- [ ] Take screenshots of issues
- [ ] Document console errors
- [ ] Note API response codes
- [ ] Record unexpected behavior

**After testing:**
- [ ] Create bug report with severity
- [ ] Document workarounds
- [ ] Prioritize fixes
- [ ] Update test results

---

## Bug Report Template

```markdown
## Bug #{number}: {Title}

**Severity:** Critical / High / Medium / Low
**Found in:** {Scenario number}
**Component:** Backend / Frontend / Integration

**Description:**
{What happened}

**Expected:**
{What should happen}

**Actual:**
{What actually happened}

**Steps to Reproduce:**
1. {Step 1}
2. {Step 2}
3. {Result}

**Evidence:**
- Screenshot: {path}
- Console error: {error message}
- Network response: {status code, body}

**Root Cause:**
{Analysis of why it happened}

**Proposed Fix:**
{How to fix it}

**Priority:** {Immediate / This session / Future}
```

---

## Success Criteria

**MVP considered successful when:**

1. ✅ Financial manager can download Excel with quote data
2. ✅ Excel shows all required fields (basic info, payment, logistics, totals)
3. ✅ Excel highlights validation issues automatically:
   - Red cells for failed validations (markup < threshold, DM fee > margin)
   - Yellow cells for warnings (VAT not removed)
   - Comments explain issues clearly
4. ✅ Financial manager can approve quote in UI
5. ✅ Financial manager can send back quote with reason
6. ✅ Comments saved in database
7. ✅ Workflow state transitions correctly
8. ✅ UI updates after action (shows new state)
9. ✅ Authorization works (only finance managers see actions)
10. ✅ No security vulnerabilities (RLS isolation verified)

**Acceptance Rate:** 9/10 criteria must pass (90%)

---

## Notes

**Known limitations (not bugs):**
- Products data may not be populated (TODO in backend)
- Some calculation fields may be missing (depends on quote creation)
- No notification system yet (future feature)

**Focus areas:**
- Core workflow (download → approve/send back → state change)
- Excel generation and validation logic
- UI/UX (buttons appear, modals work, errors clear)
- Security (RLS, auth, permissions)
