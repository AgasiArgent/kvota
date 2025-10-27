# Manual Testing Plan - Session 21: Quote Management System

**Created:** 2025-10-23 (Updated from Session 19)
**Session:** 21 - Quote Management Complete with Soft Delete & Date Fields
**Features:** Quote list with drawer, detail page, edit page, bin page, date fields, soft delete

---

## Test Environment

**Prerequisites:**
- ✅ Backend running on http://localhost:8000
- ✅ Frontend running on http://localhost:3001 (or 3000)
- ✅ User logged in: `andrey@masterbearingsales.ru` / `password`
- ✅ Database migration 011 executed (soft delete + date fields)

---

## Session 21 New Features

**✅ Implemented (Ready to Test):**
- ✅ Date fields in create form (quote_date, valid_until) with calendar dropdowns
- ✅ Quote detail page (`/quotes/[id]`)
- ✅ Quote edit page (`/quotes/[id]/edit`)
- ✅ Quote bin page (`/quotes/bin`)
- ✅ Soft delete system (7-day retention)
- ✅ Drawer quick-view on quote list
- ✅ Restore from bin
- ✅ Permanent delete from bin
- ✅ TypeScript types fixed (CI passing)

**From Session 19-20 (Previously Built):**
- ✅ Quote list page (`/quotes`)
- ✅ Search/filter functionality
- ✅ Pagination
- ✅ Calculation results display

---

## Test Suite 1: Quote List Page (`/quotes`)

**Objective:** Verify quote list loads and displays correctly

### Test 1.1: Basic List Display
1. Navigate to `http://localhost:3001/quotes`
2. **Expected:**
   - Page loads without errors
   - Statistics cards show (Total КП, Утверждено, На утверждении, Общая выручка)
   - Table displays with columns: Номер КП, Клиент, Название, Сумма, Статус, Дата КП, Действительно до, Действия
   - At least one quote visible (from previous sessions)
3. **Check console for:**
   - No red errors
   - Successful API call: `GET /api/quotes?page=1&limit=10`
   - Response status: 200

### Test 1.2: Empty State (if no quotes)
1. If no quotes exist, verify:
   - Empty table state
   - "Создать КП" button visible
2. Click "Создать КП" → should navigate to `/quotes/create`

### Test 1.3: Quote Data Display
1. For each quote in the list, verify:
   - Quote number is clickable (blue underlined)
   - Customer name displayed
   - Title displayed
   - Amount formatted as Russian currency (₽)
   - Status tag with correct color
   - Dates formatted as DD.MM.YYYY
   - Action buttons visible (👁 View, ✏ Edit for drafts, 🗑 Delete for drafts)

**✅ Pass Criteria:**
- List loads without errors
- All columns display correctly
- At least one quote visible
- API call returns 200

---

## Test Suite 2: Search & Filter (`/quotes`)

**Objective:** Verify filtering and search work correctly

### Test 2.1: Search by Text
1. Type in search box: quote number or customer name
2. Press Enter or click search icon
3. **Expected:**
   - Table updates with filtered results
   - API call: `GET /api/quotes?page=1&limit=10&search=<term>`
   - Only matching quotes displayed
4. Clear search → full list returns

### Test 2.2: Filter by Status
1. Click "Статус" dropdown
2. Select a status (e.g., "Черновик")
3. **Expected:**
   - Table updates with only quotes of that status
   - API call includes: `quote_status=draft`
4. Clear filter → full list returns

### Test 2.3: Filter by Date Range
1. Click date range picker
2. Select "От" and "До" dates
3. **Expected:**
   - Table updates with quotes in date range
   - API call includes: `date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
4. Clear dates → full list returns

### Test 2.4: Combined Filters
1. Apply search + status filter + date range
2. **Expected:**
   - All filters work together
   - API call includes all parameters
   - Correct results displayed

**✅ Pass Criteria:**
- Search filters quotes correctly
- Status filter works
- Date range filter works
- Multiple filters work together
- API calls include correct parameters

---

## Test Suite 3: Pagination (`/quotes`)

**Objective:** Verify pagination works correctly

### Test 3.1: Page Navigation
1. If more than 10 quotes exist:
   - Click page 2
   - **Expected:** API call with `page=2`
   - Different quotes displayed
2. Click "Next" button
3. Click "Previous" button
4. Verify page numbers update

### Test 3.2: Page Size Change
1. Click page size dropdown (10, 20, 50, 100)
2. Select different size (e.g., 20)
3. **Expected:**
   - API call with `limit=20`
   - More quotes displayed per page
   - Total pages recalculated

**✅ Pass Criteria:**
- Pagination controls work
- API calls include correct page/limit
- Correct quotes displayed for each page

---

## Test Suite 4: Quote Detail Page (`/quotes/[id]`)

**Objective:** Verify quote detail displays correctly with calculation results

### Test 4.1: Navigation to Detail
1. From quote list, click on quote number
2. **Expected:**
   - Navigate to `/quotes/<id>`
   - Page loads without errors
   - API call: `GET /api/quotes/<id>`
   - Response status: 200

### Test 4.2: Quote Header Display
1. Verify header shows:
   - Quote number (large, bold)
   - Status tag with correct color
   - "Назад" button (back to list)
   - Action buttons (context-dependent)

### Test 4.3: Quote Information Card
1. Verify "Информация о КП" card shows:
   - Номер КП
   - Статус
   - Клиент (clickable link)
   - Email клиента
   - Название
   - Описание (if exists)
   - Дата КП
   - Действительно до
   - Условия оплаты
   - Валюта

### Test 4.4: Quote Items Table
1. Verify "Позиции" card shows:
   - Table with columns: №, Наименование, Количество, Цена за ед., Сумма
   - All product items from quote
   - Product codes (артикул) if available
   - Quantities with units
   - Prices formatted as currency
   - Table summary row with "Подытог"

### Test 4.5: **Calculation Results Display** ⭐ **CRITICAL**
1. Verify items have calculation results
2. **Check console:**
   - `calculation_results` field present in item data?
   - `calculated_at` timestamp present?
3. **Expected behavior:**
   - If calculation results exist → should be visible somewhere (TBD: where to display?)
   - If no calculation results → items show without calculated fields
4. **Open browser console (F12) and run:**
   ```javascript
   // Check if API response includes calculation_results
   // Look for the /api/quotes/<id> network call
   // Inspect the response JSON
   ```

### Test 4.6: Financial Breakdown Card
1. Verify "Финансовая разбивка" card shows:
   - Подытог (subtotal)
   - Скидка (if > 0)
   - НДС (20%)
   - Импортная пошлина (if > 0)
   - Стоимость кредита (if > 0)
   - **Итого** (large, bold, blue)

### Test 4.7: Notes Display (if exists)
1. If quote has notes, verify:
   - "Примечания" card visible
   - Client notes
   - Internal notes (grayed out)

**✅ Pass Criteria:**
- Detail page loads without errors
- All information displayed correctly
- Quote items table shows all products
- Financial breakdown calculated correctly
- Calculation results present in API response

---

## Test Suite 5: Delete Operations

**Objective:** Verify delete functionality works correctly

### Test 5.1: Delete from List Page
1. Find a draft quote in the list
2. Click 🗑 (delete) button
3. **Expected:**
   - Confirmation modal appears: "Удалить КП?"
   - Cancel button → modal closes, no action
4. Click "Удалить" (confirm)
5. **Expected:**
   - API call: `DELETE /api/quotes/<id>`
   - Success message: "КП успешно удалено"
   - Quote removed from list
   - List refreshes

### Test 5.2: Delete from Detail Page
1. Open a draft quote detail page
2. Click "Удалить" button in header
3. **Expected:**
   - Confirmation modal appears
4. Confirm deletion
5. **Expected:**
   - API call: `DELETE /api/quotes/<id>`
   - Success message
   - Redirects to `/quotes` list
   - Quote no longer in list

### Test 5.3: Delete Button Visibility
1. **Draft quotes:** Delete button visible ✅
2. **Non-draft quotes:** Delete button hidden ❌
3. Verify this on both list and detail pages

**✅ Pass Criteria:**
- Delete confirmation works
- Quote deleted from database
- Success message shown
- List refreshes after deletion
- Delete only available for drafts

---

## Test Suite 6: End-to-End Workflow

**Objective:** Verify complete quote lifecycle works

### Test 6.1: Create → List → Detail Flow ⭐ **MOST IMPORTANT**
1. Create new quote at `/quotes/create`
   - Fill product table (at least 2 products)
   - Set variables (seller_company, currency, etc.)
   - Click "Рассчитать котировку"
2. **Expected:**
   - Success message with quote number
   - Calculation results displayed
3. Navigate to `/quotes` list
4. **Expected:**
   - New quote appears at top of list
   - Quote number, customer, title visible
   - Status = "draft"
5. Click on new quote number
6. **Expected:**
   - Detail page opens
   - All data correct (customer, products, variables)
   - **Calculation results present** (from Session 15)
   - Financial totals match calculation page

### Test 6.2: List → Detail → Back Navigation
1. From list, click quote number
2. On detail page, click "Назад" button
3. **Expected:** Returns to list at same page/filters

**✅ Pass Criteria:**
- Complete workflow works end-to-end
- Data persists across pages
- Calculation results saved and displayed
- Navigation works correctly

---

## Test Suite 7: Error Handling

**Objective:** Verify errors are handled gracefully

### Test 7.1: Invalid Quote ID
1. Navigate to `/quotes/invalid-uuid`
2. **Expected:**
   - Error message: "Ошибка загрузки КП"
   - Redirects to `/quotes` list
   - No crash

### Test 7.2: Network Error Simulation
1. Stop backend: `pkill -f uvicorn`
2. Try to load quote list
3. **Expected:**
   - Error message displayed
   - No crash
   - User-friendly error message
4. Restart backend: `cd /home/novi/quotation-app/backend && source venv/bin/activate && uvicorn main:app --reload &`
5. Refresh page → should work

### Test 7.3: Unauthorized Access
1. Clear cookies (logout)
2. Try to access `/quotes`
3. **Expected:** Redirect to login

**✅ Pass Criteria:**
- Invalid IDs handled gracefully
- Network errors don't crash app
- Auth errors redirect to login
- User sees helpful error messages

---

## Test Suite 8: Console Error Check

**Throughout all tests, monitor Chrome console (F12 → Console tab):**

### ❌ Should NOT see:
- Red error messages
- React warnings
- "Failed to fetch" errors
- TypeScript errors
- 404/500 errors
- Uncaught exceptions

### ✅ Should see:
- All API calls return 200
- Successful navigation logs
- Component mount/unmount (debug mode)

**How to check:**
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Filter by "Errors" only
4. Perform each test
5. Verify no red errors appear

---

## Test Suite 9: Date Fields (Session 21) ⭐ NEW

**Objective:** Verify quote_date and valid_until fields work correctly

### Test 9.1: Date Fields in Create Form
1. Navigate to `/quotes/create`
2. **Expected:**
   - Two date pickers visible at top: "Дата КП" and "Действительно до"
   - "Дата КП" defaults to today
   - "Действительно до" defaults to today + 7 days
3. Change "Дата КП" to a different date
4. **Expected:**
   - "Действительно до" auto-updates to selected date + 7 days
5. Manually change "Действительно до"
6. **Expected:**
   - Manual change preserved (not overwritten)

### Test 9.2: Date Fields Saved with Quote
1. Create a new quote with custom dates
2. Submit quote
3. Navigate to quote list
4. **Expected:**
   - New quote shows correct "Дата КП" and "Действительно до" columns
5. Open quote detail
6. **Expected:**
   - Dates match what was entered

**✅ Pass Criteria:**
- Date pickers appear and work
- Auto-calculation works (date + 7 days)
- Dates persist to database
- Dates display correctly in list and detail

---

## Test Suite 10: Drawer Quick-View (Session 21) ⭐ NEW

**Objective:** Verify drawer opens from quote list for quick viewing

### Test 10.1: Open Drawer
1. On quote list page, click on a quote number (blue link)
2. **Expected:**
   - Drawer slides in from right (680px wide)
   - Shows quote header with quote number
   - Loading spinner initially
   - Then displays quote data

### Test 10.2: Drawer Content
1. Verify drawer shows:
   - Quote summary (customer, dates, status, title)
   - Products table with columns: Наименование, Количество, Цена, Сумма
   - Totals section: Подытог and Общая сумма (Statistic cards)
   - Action buttons: "Полная страница", "Редактировать", "Удалить"

### Test 10.3: Drawer Actions
1. Click "Полная страница" → should navigate to `/quotes/[id]`
2. Go back to list, open drawer again
3. Click "Редактировать" → should navigate to `/quotes/[id]/edit`
4. Go back to list, open drawer again
5. Click "Удалить" → confirmation modal → delete → drawer closes, list refreshes

### Test 10.4: Close Drawer
1. Open drawer
2. Click X button in top-right → drawer closes
3. Open drawer
4. Click outside drawer (on backdrop) → drawer closes

**✅ Pass Criteria:**
- Drawer opens with correct quote data
- Products table displays correctly
- Totals calculate correctly
- All action buttons work
- Drawer closes properly

---

## Test Suite 11: Edit Page (Session 21) ⭐ NEW

**Objective:** Verify quote editing works correctly

### Test 11.1: Navigate to Edit Page
1. From quote list, click "✏ Edit" button (for draft quote)
2. **Expected:** Navigate to `/quotes/[id]/edit`
3. Alternatively: From detail page, click "Редактировать" button
4. Or from drawer, click "Редактировать"

### Test 11.2: Edit Page Pre-Population
1. Verify form is pre-filled with existing quote data:
   - Customer selected in dropdown
   - Quote title filled
   - Date fields show existing dates
   - All variable cards filled with saved values
   - Products table loaded with all items (SKU, brand, name, quantity, price, etc.)

### Test 11.3: Make Changes
1. Change customer
2. Change quote title
3. Change dates
4. Modify a product (quantity or price)
5. Add a new product row
6. Delete a product row
7. Change variables (e.g., delivery_time_days)

### Test 11.4: Save Changes
1. Click "Сохранить изменения" button
2. **Expected:**
   - API call: `PUT /api/quotes/<id>`
   - Success message appears
   - Redirects to quote detail or list (TBD)
   - Changes persisted in database

### Test 11.5: Edit Page for Non-Draft Quotes
1. Try to edit a quote with status "approved" or "sent"
2. **Expected:**
   - Edit button should be hidden (not available for non-drafts)
   - Or edit page should show "read-only" mode

**✅ Pass Criteria:**
- Edit page loads with pre-filled data
- All fields editable
- Changes save correctly
- Redirects after save
- Only drafts can be edited

---

## Test Suite 12: Bin Page (Session 21) ⭐ NEW

**Objective:** Verify soft delete bin system works

### Test 12.1: Navigate to Bin
1. Click "Корзина" in sidebar menu
2. **Expected:**
   - Navigate to `/quotes/bin`
   - Page title: "Корзина КП"
   - Info banner at top: "Автоматическое удаление" with 7-day message

### Test 12.2: Bin Page Display
1. Verify table columns:
   - Номер КП
   - Клиент
   - Название
   - Сумма
   - Статус
   - Дата КП
   - Действительно до
   - **Удалено** (with relative time, e.g., "2 дня назад")
   - Действия
2. Verify action buttons: "Восстановить" (green) and "Удалить навсегда" (red)

### Test 12.3: Soft Delete → Bin Flow
1. From quote list, delete a draft quote
2. **Expected:**
   - Quote removed from main list
   - API call: `PATCH /api/quotes/<id>/soft-delete`
3. Navigate to bin
4. **Expected:**
   - Deleted quote appears in bin
   - "Удалено" column shows "несколько секунд назад" or similar

### Test 12.4: Restore from Bin
1. In bin, find a soft-deleted quote
2. Click "Восстановить" button
3. **Expected:**
   - Confirmation or immediate action
   - API call: `PATCH /api/quotes/<id>/restore`
   - Success message: "КП восстановлено"
   - Quote removed from bin
4. Navigate to main quote list
5. **Expected:**
   - Restored quote appears in list
   - `deleted_at` = NULL in database

### Test 12.5: Permanent Delete from Bin
1. In bin, find a soft-deleted quote
2. Click "Удалить навсегда" button
3. **Expected:**
   - Confirmation modal: "Безвозвратно удалить КП?" with warning
4. Confirm deletion
5. **Expected:**
   - API call: `DELETE /api/quotes/<id>/permanent`
   - Success message: "КП удалено безвозвратно"
   - Quote removed from bin
   - Quote permanently deleted from database

### Test 12.6: Bin Empty State
1. Restore or permanently delete all quotes in bin
2. **Expected:**
   - Empty table state
   - Message: "Корзина пуста" or similar

**✅ Pass Criteria:**
- Bin page displays soft-deleted quotes
- "Удалено" column shows relative time
- Restore works (quote returns to main list)
- Permanent delete works (quote gone forever)
- Empty state displays correctly

---

## Testing Execution Order

**Recommended order (Session 21 focus):**

1. ⭐ **Test Suite 9** (Date fields) - 5 min
2. ⭐ **Test Suite 10** (Drawer quick-view) - 5 min
3. ⭐ **Test Suite 11** (Edit page) - 10 min
4. ⭐ **Test Suite 12** (Bin page) - 10 min
5. **Test Suite 6.1** (E2E workflow) - 5 min
6. **Test Suite 1** (Basic list) - 5 min
7. **Test Suite 4** (Detail page) - 10 min
8. **Test Suite 2** (Search/filter) - 5 min
9. **Test Suite 3** (Pagination) - 3 min
10. **Test Suite 5** (Delete) - 5 min
11. **Test Suite 6.2** (Navigation) - 2 min
12. **Test Suite 7** (Error handling) - 5 min

**Total estimated time:** 70 minutes

---

## Issue Reporting Template

**For each issue found, provide:**

```
## Issue #X: [Short Description]

**Test Suite:** [e.g., Test 4.5 - Calculation results]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Console Errors:**
[Copy/paste any errors from console]

**Screenshot:** (if helpful)
[Describe or attach]

**Severity:**
- [ ] Critical (blocks workflow)
- [ ] Major (feature broken)
- [ ] Minor (cosmetic issue)
```

---

## Known Issues / Expected Behavior

### Calculation Results Display
- **Current:** Calculation results are saved to database but **not visually displayed** on quote detail page
- **Expected:** Results should be visible somewhere (expandable section, separate card, or tooltip)
- **Action:** If results are in API response but not visible, this is a **Minor** issue (feature incomplete, not broken)

### Admin-Only Variables
- **Current:** 3 admin-only variables (rate_forex_risk, rate_fin_comm, rate_loan_interest_daily) should be hidden from regular users
- **Expected:** Form should only show user-editable variables based on role
- **Check:** Verify admin-only fields are NOT visible for regular users

---

## Success Criteria

**Session 21 considered successful if:**

**Core Features (Session 19-20):**
✅ Quote list loads and displays quotes
✅ Search and filters work
✅ Pagination works
✅ Quote detail page loads with all data
✅ Calculation results present in API response

**New Features (Session 21):**
✅ Date fields work (auto-calculation, persistence)
✅ Drawer quick-view opens and displays correctly
✅ Edit page loads with pre-filled data
✅ Edit page saves changes correctly
✅ Bin page displays soft-deleted quotes
✅ Restore from bin works
✅ Permanent delete from bin works
✅ Soft delete flow works (list → bin)

**Technical:**
✅ No critical console errors
✅ All API calls return 200
✅ TypeScript CI passes

**Minor issues acceptable:**
- Cosmetic styling issues
- Missing calculation results visualization in detail/edit pages
- Missing features (approval workflow, PDF export)

---

## Post-Testing

**After completing all tests:**

1. Document any issues found
2. Prioritize issues (critical, major, minor)
3. Update SESSION_PROGRESS.md
4. Decide next steps:
   - Fix critical issues immediately
   - Plan fixes for major issues
   - Defer minor issues to future session

---

**Ready to test!** Start with Test Suite 6.1 (E2E workflow) to verify the most critical path works.
