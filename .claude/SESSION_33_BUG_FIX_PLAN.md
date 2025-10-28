# Session 33 - Manual Testing Bug Fixes

**Date:** 2025-10-28
**Testing Results:** 6/23 scenarios passing (26% pass rate)
**Target:** 100% pass rate
**Branch:** dev worktree (`/home/novi/quotation-app-dev`)

---

## Bug Summary

**Total Bugs:** 12 (all frontend)
- P0 Critical: 3 bugs
- P1 High Priority: 3 bugs
- P2 Medium Priority: 5 bugs
- P3 Low Priority: 1 bug

---

## CRITICAL (P0) - Block User Testing

### Bug 2: Team Menu Not Visible
- **File:** `frontend/src/components/layout/MainLayout.tsx` (line 118)
- **Issue:** "Команда" submenu missing in Settings (only "Профиль" shows)
- **Root Cause:** Role check `['admin', 'owner', 'manager'].includes(profile.role)` doesn't match user's actual role
- **Investigation Needed:** Check what roles exist in database vs what code expects
- **Fix Options:**
  1. Expand accepted roles to include actual database roles
  2. Add role hierarchy helper function
  3. Check if role metadata is being loaded correctly

### Bug 3: Organizations Page 404
- **Issue:** `/organizations` returns Page Not Found
- **Root Cause:** Likely missing page file
- **Fix:**
  1. Check if `frontend/src/app/organizations/page.tsx` exists
  2. If missing, create page or remove from navigation
  3. Verify routing structure

### Bug 4: Team Page Non-Functional
- **File:** `frontend/src/app/settings/team/page.tsx`
- **Issue:** Page loads but shows no breadcrumbs, no members, no buttons
- **Root Cause:** Likely API call failing or role metadata issues
- **Fix:**
  1. Debug data loading logic
  2. Verify API calls work
  3. Check error handling
  4. Add console logging to identify failure point

---

## HIGH PRIORITY (P1) - Core Functionality

### Bug 5: Incomplete Quote Validation
- **File:** `frontend/src/app/quotes/create/page.tsx`
- **Issue:** Missing `required` validation for:
  - `seller_company` (Компания-продавец)
  - `offer_sale_type` (Вид КП)
  - `offer_incoterms` (Базис поставки)
  - `exchange_rate_base_price_to_quote` (Курс к валюте КП)
- **Also:** Remove "Курс USN/CNY" field from form
- **Fix:** Add `rules={[{ required: true, message: '...' }]}` to each Form.Item
- **Search Pattern:** Look for Form.Item with these field names

### Bug 11: No Redirect After Quote Creation
- **File:** `frontend/src/app/quotes/create/page.tsx` (lines 608-618)
- **Issue:** Successful submission stays on page (no redirect)
- **Current Code Analysis:**
  ```typescript
  // Lines 608-618
  console.log('✅ Quote created successfully:', quoteNumber);
  console.log('✅ Quote ID for redirect:', quoteId);

  // Show success message and redirect to quote view page
  message.success(`Котировка №${quoteNumber} создана!`, 1.5);

  // Redirect to quote view page (where user can see results and export)
  console.log('Redirecting to view page:', `/quotes/${quoteId}`);
  setTimeout(() => {
    router.push(`/quotes/${quoteId}`);
  }, 1500);
  ```
- **Root Cause:**
  1. Validate quoteId is not undefined/null
  2. Ensure router.push executes
  3. Check if setTimeout is being cleared somewhere
- **Fix:** Add validation for quoteId, ensure router.push executes

### Bug 12: Customer Name Not Displayed
- **File:** `frontend/src/app/quotes/[id]/page.tsx` (line 130)
- **Issue:** Quote detail shows blank customer name
- **Current Code Analysis:**
  ```typescript
  // Line 130
  customer_name: quoteData.customer_name,
  ```
- **Root Cause:** Backend returns `customer` object, not `customer_name` string
- **Fix:** Change to `customer?.name` or verify backend response structure

---

## MEDIUM PRIORITY (P2) - UX Improvements

### Bug 1: Slow Authentication Redirect
- **Issue:** >10 second delay after login (should be <1s)
- **Investigation Needed:**
  1. Add performance logging to auth flow
  2. Check what happens between login success and redirect
  3. Profile loading might be slow
- **Fix:** Optimize auth flow, add loading states

### Bug 6: Validation Error Too Verbose
- **File:** `frontend/src/app/quotes/create/page.tsx` (lines 619-621)
- **Issue:** Backend error message extremely long and hard to read
- **Current Code:**
  ```typescript
  // Lines 619-621
  } else {
    message.error(`Ошибка расчета: ${result.error}`);
  }
  ```
- **Fix:** Parse error message, format as bullet list using Ant Design message component

### Bug 7: Customer Dropdown No Red Border
- **File:** `frontend/src/app/quotes/create/page.tsx` (lines 1016-1037)
- **Issue:** Validation doesn't add red border to customer Select
- **Fix Options:**
  1. Remove `noStyle` from Form.Item
  2. Sync error state with Select component
  3. Use validateStatus prop

### Bug 8: No File Upload Clear Button
- **File:** `frontend/src/app/quotes/create/page.tsx` (lines 347-374)
- **Issue:** Can't remove uploaded file without page refresh
- **Fix:**
  1. Add `onRemove` handler to Upload component
  2. Enable `showRemoveIcon` in uploadProps
  3. Clear uploadedProducts state

### Bug 10: Warning Alert Always Visible
- **File:** `frontend/src/app/quotes/create/page.tsx` (lines 936-952)
- **Issue:** Yellow warning box doesn't hide when conditions met
- **Root Cause:** State values (selectedCustomer, uploadedProducts) not updating
- **Fix:** Debug state values, verify condition logic

---

## LOW PRIORITY (P3) - Polish

### Bug 9: Console Errors During Validation
- **File:** `frontend/src/app/quotes/create/page.tsx`
- **Issue:** Console shows errors when clearing validation
- **Fix:** Add try-catch or error boundary around validation clearing

---

## Execution Strategy

### Phase 1: Critical Fixes (Sequential)
1. Bug 2 + Bug 4: Team menu visibility and page functionality (same component/flow)
2. Bug 3: Organizations page 404

### Phase 2: High Priority Fixes (Parallel)
1. Bug 5: Add validation rules
2. Bug 11: Quote redirect
3. Bug 12: Customer display

### Phase 3: Medium Priority Fixes (Parallel)
1. Bug 6: Error message formatting
2. Bug 7: Customer dropdown border
3. Bug 8: File upload clear
4. Bug 10: Alert visibility
5. Bug 1: Auth performance (optional - can defer)

### Phase 4: Polish
1. Bug 9: Console errors

---

## Testing Checklist After Fixes

- [ ] Team menu shows "Команда" option
- [ ] Team page loads with breadcrumbs, members, buttons
- [ ] Organizations page loads without 404
- [ ] Quote creation validates 4 required fields
- [ ] Quote creation redirects to view page on success
- [ ] Quote detail page shows customer name
- [ ] Validation errors formatted nicely
- [ ] Customer dropdown shows red border on error
- [ ] File upload has clear button
- [ ] Warning alert hides when conditions met
- [ ] No console errors during normal operation
- [ ] Login redirect < 2 seconds

---

## Success Criteria

1. All 12 bugs fixed
2. No new bugs introduced
3. No TypeScript errors
4. No lint errors
5. Servers run without errors
6. Ready for user re-testing

---

## Files to Modify

**Frontend:**
1. `src/components/layout/MainLayout.tsx` - Team menu visibility
2. `src/app/settings/team/page.tsx` - Team page functionality
3. `src/app/organizations/page.tsx` - Check if exists, create if missing
4. `src/app/quotes/create/page.tsx` - 8 bugs (validation, redirect, errors, upload, alert, console)
5. `src/app/quotes/[id]/page.tsx` - Customer name display

**Backend:**
- None (all bugs are frontend)

---

## Notes

- Work in dev worktree only (`/home/novi/quotation-app-dev`)
- Do NOT merge to main - user will re-test first
- Prioritize P0 and P1 bugs - P2/P3 can be deferred if time-constrained
- Test each fix locally before moving to next bug
- Document any bugs that couldn't be fixed (with reasons)
