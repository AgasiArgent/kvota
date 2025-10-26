# E2E Testing Bug Status

**Session:** Post-Session 28 E2E Testing
**Date:** 2025-10-26
**Testing Mode:** Manual testing by user with Chrome DevTools observation

---

## ✅ Phase 1: Backend API Fixes - COMPLETE

### 1.1 Activity Logs `/users` Endpoint ✅
**Problem:** `GET /api/activity-logs/users` returned 404
**Root Cause:** Endpoint didn't exist
**Fix:** Added `/users` endpoint in `backend/routes/activity_logs.py:161-211`
- Queries unique user_ids from activity_logs
- Fetches user profiles (email, first_name, last_name)
- Returns formatted list for frontend dropdown

**File Modified:** `backend/routes/activity_logs.py`

### 1.2 Trailing Slash 307 Redirects ✅
**Problem:** Requests to `/api/activity-logs?params` caused 307 redirects to `/api/activity-logs/?params`
**Root Cause:** FastAPI automatically redirects missing trailing slashes
**Fix:** Changed router prefix from `/api/activity-logs` to `/api/activity-logs/` (line 21)

**File Modified:** `backend/routes/activity_logs.py`

### 1.3 Customer/Feedback Auth ✅
**Status:** VERIFIED - No fix needed
**Finding:** Both routes use correct auth dependencies:
- `backend/routes/customers.py:151` - Uses `AuthContext = Depends(get_auth_context)`
- `backend/routes/feedback.py:60` - Uses `User = Depends(get_current_user)`
- Both auth functions exist and are correctly implemented in `auth.py`

**Conclusion:** Infinite loading on customer creation and feedback submit is a **frontend** issue, not backend auth

### 1.4 User Profile Endpoint ✅
**Status:** VERIFIED - Exists
**Endpoint:** `GET /api/users/profile` (line 70 in `backend/routes/users.py`)
**Conclusion:** Backend endpoint exists, profile page not loading is a frontend issue

---

## ✅ Phase 2.1: Commission Distribution - COMPLETE

**Fix Applied:** Changed API from loop calling `calculate_single_product_quote()` to single call to `calculate_multiproduct_quote()`

**Files Modified:**
- `backend/routes/quotes_calc.py` lines 22, 941-1065

**Changes:**
1. Added import: `calculate_multiproduct_quote`
2. Restructured calculation flow:
   - Step 5: Validate all products and build calc_inputs list
   - Step 6: Call `calculate_multiproduct_quote()` once with all products
   - Step 7: Loop through results to save and format response
3. Distribution now works correctly: `BD16 = S16 / S13` (proportional)

---

## 🔄 Phase 2.2-2.3: Frontend Data Mapping - IN PROGRESS

### Current Findings:

**File:** `frontend/src/app/quotes/create/page.tsx` (2117 lines)

**Calculation Flow:**
1. Line 527: `quotesCalcService.calculateQuote()` called
2. Line 538: Results stored in `setCalculationResults(result.data)`
3. Line 1735: Results table renders `calculationResults.items`

**Issues Identified:**

1. **Commission Distribution (Вознагр column)** ✅ **FIXED**
   - User reported: Quote-level commission (1000) should be distributed among products
   - Was showing: 1000 for all products (incorrect)
   - **Root Cause:** API called `calculate_single_product_quote()` in loop instead of `calculate_multiproduct_quote()`
   - **Fix Applied:** Changed API to call `calculate_multiproduct_quote()` once with all products
   - **Result:** Commission now distributed proportionally (e.g., 333.33, 666.67 for 2 products based on purchase price share)
   - **File Modified:** `backend/routes/quotes_calc.py` lines 22, 941-1065

2. **Sales Column Totals (Продажа)**
   - User reported: "Итого СБС" is bigger than "Продажа" total (illogical)
   - **Need to investigate:** Column definitions and total calculations

3. **Static USD/CNY Field**
   - User reported: Shows "Курс USD/CNY" but quote currency could be EUR and purchase currency TRY
   - Should dynamically show "Курс {quote_currency}/{purchase_currency}"
   - Multiple purchase currencies possible across products
   - **Need to investigate:** Where this field is defined and make it dynamic

---

## 📋 Phase 3: Search & Filtering - PENDING

**Issue:** Client name search doesn't work
**Status:** Quote number, status, date filters all work
**Need to investigate:** Search implementation in `frontend/src/app/quotes/page.tsx`

---

## 🎨 Phase 4: UX Improvements - PENDING

**Issues to fix:**

1. **Missing Post-Creation Actions**
   - After creating quote, no action buttons shown
   - Should add: Export PDF, Go to Quotes List, Create Another Quote

2. **Auto-fill valid_until**
   - Not automatically filled when quote_date changes
   - Should auto-set to quote_date + 30 days

3. **Quote Drawer Not Showing Data**
   - Clicking quote from list should show drawer with details
   - Currently shows empty drawer

4. **Edit Button Redirect Loop**
   - Click edit → redirects to "КП не найдено" → back to /quotes
   - Likely missing organization context in URL

5. **Feedback Widget Buttons**
   - "Отправить" button: infinite loading (backend exists, frontend issue)
   - "Отмена" button: doesn't work (no onClick handler)
   - Close (X) button: doesn't work (no onCancel prop)

---

## 🧪 Phase 5: Testing - PENDING

Will re-test after all fixes applied.

---

## Pattern Analysis

### Pattern 1: Frontend API Error Handling
**Symptoms:** Infinite loading (customer creation, feedback submit)
**Root Cause:** Frontend not handling API errors/responses correctly
**Affected:** Customer creation button, feedback submit button
**Solution:** Check frontend service error handling and loading state management

### Pattern 2: Backend → Frontend Mapping
**Symptoms:** Incorrect data display (commission, sales totals)
**Root Cause:** Either backend returns wrong calculations OR frontend maps incorrectly
**Affected:** Quote results table columns
**Solution:** Verify backend response structure matches frontend expectations

### Pattern 3: Missing Event Handlers
**Symptoms:** Buttons/controls don't respond
**Affected:** Feedback modal cancel/close buttons
**Solution:** Add onClick/onCancel handlers

---

## Next Steps

1. **Immediate:** Continue Phase 2 - investigate commission/sales column mapping
2. **Then:** Phase 3 - fix client name search
3. **Then:** Phase 4 - UX improvements (post-creation actions, auto-fill, feedback buttons)
4. **Finally:** Phase 5 - comprehensive re-test

---

## Files Modified So Far

**Backend:**
- ✅ `backend/routes/activity_logs.py` - Added /users endpoint, fixed trailing slash

**Frontend:**
- ⏳ None yet (starting Phase 2)

---

## Time Estimate Remaining

- Phase 2: 45 min (frontend mapping)
- Phase 3: 20 min (search fix)
- Phase 4: 30 min (UX improvements)
- Phase 5: 20 min (testing)

**Total:** ~2 hours remaining
