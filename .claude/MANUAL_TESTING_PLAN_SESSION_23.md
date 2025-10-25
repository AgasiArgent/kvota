# Manual Testing Plan - Session 23 Export System

**Date:** 2025-10-24
**Session:** 23 - Export System Complete
**Tester:** User Manual Testing

---

## System Status

- ✅ **Backend:** Running on port 8000 (healthy)
- ✅ **Frontend:** Running on port 3001 (ready)
- ⚠️ **Note:** Port 3000 occupied by unknown process, using 3001

**Test Credentials:**
- **Email:** `andrey@masterbearingsales.ru`
- **Password:** `password`
- **Organization:** МАСТЕР БЭРИНГ ООО (Master Bearing LLC)

**Frontend URL:** http://localhost:3001
**Backend API:** http://localhost:8000

---

## Priority 1: Core Export System (Session 23 - NEW) ⭐

### A. Quote Export - PDF Formats

#### Test 1: КП Поставка (9-column supply quote)
- [ ] Navigate to existing quote with products
- [ ] Click "Экспорт" dropdown → "КП поставка (PDF)"
- [ ] Verify file downloads: `КП_[number]_[date].pdf`
- [ ] Open PDF: Check 9 columns exist:
  - SKU, Brand, Description, Qty, Unit, Unit Price, Subtotal, VAT%, Total
- [ ] Verify Russian number formatting: `1 234,56 ₽` (spaces + comma)
- [ ] Check date format: `DD.MM.YYYY` (Russian standard)
- [ ] Verify UTF-8 encoding (Russian text displays correctly)

**Expected Result:** PDF downloads with professional 9-column table, Russian formatting.

---

#### Test 2: КП Open Book (21-column detailed quote)
- [ ] Same quote → "КП open book (PDF)"
- [ ] Verify file downloads: `КП_openbook_[number]_[date].pdf`
- [ ] Open PDF: Check 21 columns include calculation breakdown
- [ ] Verify cost breakdown columns visible:
  - Purchase price, forex, commission, interest, etc.
- [ ] Check professional styling and layout
- [ ] Verify all numbers in Russian format

**Expected Result:** PDF with detailed 21-column cost breakdown table.

---

#### Test 3: КП Поставка Письмо (Formal letter + 9 columns)
- [ ] Same quote → "КП поставка письмо (PDF)"
- [ ] Verify formal letter header appears
- [ ] Check customer contact info displayed correctly
- [ ] Check manager info (name, phone, email) from user profile
- [ ] Verify letter includes delivery address
- [ ] Check payment terms formatted correctly (e.g., "100% предоплата")
- [ ] Verify 9-column table appears below letter
- [ ] Check letter date in Russian format

**Expected Result:** Professional formal letter with 9-column table attached.

---

#### Test 4: КП Open Book Письмо (Formal letter + 21 columns)
- [ ] Same quote → "КП open book письмо (PDF)"
- [ ] Verify formal letter + detailed 21-column table
- [ ] All letter elements from Test 3 + detailed calculations
- [ ] Check letter is properly formatted for printing
- [ ] Verify company letterhead style (if implemented)

**Expected Result:** Formal letter with detailed cost breakdown table.

---

### B. Quote Export - Excel Formats

#### Test 5: Validation Export (Input/Output comparison)
- [ ] Navigate to quote with calculated results
- [ ] Export → "Проверка расчетов (Excel)"
- [ ] Verify file downloads: `КП_validation_[number]_[date].xlsx`
- [ ] Open Excel: Check 2 sheets exist:
  - Sheet 1: "Входные данные" (Input Data)
  - Sheet 2: "Выходные данные" (Output Data)
- [ ] **Input sheet:** Verify all 42 variables with cell references:
  - B16, C16, D16, E16, F16, G16, H16, I16, J16, K16, L16
  - M16, N16, O16, P16, Q16, R16, S16, T16, U16, V16, W16
  - X16, Y16, Z16, AA16, AB16, AC16, AD16, AE16, AF16, AG16
  - AH16, AI16, AJ16, AK16, AL16, AM16, AN16, AO16, AP16, AQ16, AR16
- [ ] **Output sheet:** Verify calculated selling prices match quote detail page
- [ ] Compare against old Excel calculation file (if available)
- [ ] Check Russian number formatting in Excel

**Expected Result:** 2-sheet Excel file matching old calculation format for validation.

---

#### Test 6: Professional Grid Export (2-sheet)
- [ ] Same quote → "Таблицы (Excel)"
- [ ] Verify file downloads: `КП_grid_[number]_[date].xlsx`
- [ ] Open Excel: Check 2 sheets exist:
  - Sheet 1: "Товары" (Products)
  - Sheet 2: "Итоги" (Totals)
- [ ] **Products sheet:**
  - Check grid formatting
  - Russian number format: `1 234,56 ₽`
  - All product rows present
  - Column headers in Russian
- [ ] **Totals sheet:**
  - Subtotal before VAT
  - VAT amount
  - Grand total with VAT
  - Currency displayed correctly

**Expected Result:** Professional 2-sheet Excel export ready for client.

---

### C. Customer Contact Management

#### Test 7: Create Customer Contact
- [ ] Navigate to `/customers/[any_id]/contacts`
- [ ] Click "Добавить контакт" button
- [ ] Fill contact form:
  - Name: e.g., "Иванов Иван Иванович"
  - Position: e.g., "Менеджер по закупкам"
  - Phone: e.g., "+7 (495) 123-45-67"
  - Email: e.g., "ivanov@example.ru"
- [ ] Check "Primary contact" checkbox
- [ ] Save → Verify contact appears in list
- [ ] Verify primary contact has badge/indicator (e.g., blue "Primary" tag)
- [ ] Create second contact without primary flag
- [ ] Verify only one contact can be primary

**Expected Result:** Contact created successfully, primary flag works.

---

#### Test 8: Use Contact in Quote Creation
- [ ] Go to `/quotes/create`
- [ ] Select customer that has contacts (from Test 7)
- [ ] Check contact selector dropdown appears
- [ ] Select contact from dropdown
- [ ] Verify contact info displays in form (read-only)
- [ ] Verify manager info auto-filled from user profile:
  - Manager name
  - Manager phone
  - Manager email
- [ ] Add products to quote
- [ ] Save quote
- [ ] Export as "КП поставка письмо" (letter format)
- [ ] Open PDF → Verify selected contact appears in letter header
- [ ] Verify manager info appears in letter signature

**Expected Result:** Contact and manager info correctly populate in exported letter.

---

## Priority 2: Quote Management (Session 21)

### D. Quote Drawer Quick View

#### Test 9: Drawer Functionality
- [ ] Navigate to `/quotes` (quote list page)
- [ ] Click on quote number link (e.g., "КП-000123")
- [ ] Verify drawer opens from right side
- [ ] Check drawer width is 680px (comfortable reading width)
- [ ] **Section 1 - Summary:**
  - Quote number, date, customer name
  - Description field
  - Status badge
- [ ] **Section 2 - Products Table:**
  - Table with 5 columns minimum
  - Max height 300px (scrollable if more products)
  - Columns: SKU, Brand, Description, Quantity, Price
- [ ] **CRITICAL TEST - Selling Prices:**
  - ✅ **Expected:** Calculated selling price (~1951₽)
  - ❌ **NOT:** Purchase price (~1200₽)
  - Verify calculation results are displayed
  - Check VAT is included in price
- [ ] **Section 3 - Totals:**
  - Subtotal (before VAT)
  - Total (with VAT)
  - Use Ant Design Statistic component
  - Large, readable numbers
- [ ] **Section 4 - Action Buttons:**
  - "View Full Page" button → navigates to `/quotes/[id]`
  - "Edit" button → navigates to `/quotes/[id]/edit`
  - "Delete" button → soft delete with confirmation
- [ ] Click outside drawer → Verify drawer closes
- [ ] Press Escape key → Verify drawer closes

**Expected Result:** Drawer opens smoothly, displays selling prices (NOT purchase), all actions work.

---

### E. Quote Detail Page

#### Test 10: View Quote Details
- [ ] Navigate to `/quotes/[id]` (from drawer or directly)
- [ ] Verify page loads without errors
- [ ] Check all quote information displays:
  - Header: Quote number, status, dates
  - Customer info section
  - Contact info (if contact selected)
  - Manager info
  - Quote-level variables
- [ ] Check products table with calculated selling prices
- [ ] Verify prices match drawer prices
- [ ] Check totals section:
  - Subtotal
  - VAT breakdown
  - Grand total
- [ ] Test "Edit" button → navigates to `/quotes/[id]/edit`
- [ ] Test "Delete" button → shows confirmation modal
- [ ] Test "Export" dropdown → all 6 formats available
- [ ] Verify "Back to List" button returns to `/quotes`

**Expected Result:** All quote data displays correctly, navigation works.

---

### F. Quote Edit Page

#### Test 11: Edit Existing Quote
- [ ] Navigate to `/quotes/[id]/edit`
- [ ] Verify all fields pre-populated with current values:
  - Customer selector shows current customer
  - Contact selector shows current contact
  - All quote-level variables filled
  - Date fields show current dates
- [ ] Verify ag-Grid loads with existing products:
  - All rows present
  - All columns show correct data
  - Variable overrides preserved (blue indicators)
- [ ] Make changes:
  - Modify quote-level variable (e.g., `delivery_days` from 60 to 45)
  - Modify product quantity in grid
  - Add new product row
  - Delete existing product row
- [ ] Click "Save" button
- [ ] Verify success message appears
- [ ] Navigate back to detail page (`/quotes/[id]`)
- [ ] Verify all changes saved correctly:
  - delivery_days = 45
  - Product quantities updated
  - New product appears
  - Deleted product gone
- [ ] Check calculation results updated based on changes

**Expected Result:** Edit page loads with data, saves changes successfully.

---

### G. Soft Delete & Bin System

#### Test 12: Soft Delete Quote
- [ ] From quote list page (`/quotes`)
- [ ] Find quote to delete
- [ ] Click delete icon/button
- [ ] Verify confirmation modal appears:
  - Message: "Are you sure you want to delete this quote?"
  - "Cancel" button
  - "Delete" button (red/danger style)
- [ ] Click "Delete"
- [ ] Verify success message: "Quote moved to bin"
- [ ] Verify quote disappears from main list
- [ ] Check quote counter decreases by 1
- [ ] Verify deleted quote NOT shown in regular list

**Expected Result:** Quote soft deleted, moved to bin, removed from main list.

---

#### Test 13: Bin Page - Restore & Permanent Delete
- [ ] Navigate to `/quotes/bin` (from sidebar menu)
- [ ] Verify deleted quotes appear in bin list
- [ ] Check columns:
  - Quote number
  - Customer name
  - Deleted date/time
  - Actions (Restore, Delete Forever)
- [ ] **Test Restore:**
  - Click "Restore" button on a quote
  - Verify confirmation: "Quote restored successfully"
  - Navigate to `/quotes` main list
  - Verify quote reappears in list
  - Verify deleted_at timestamp cleared
- [ ] **Test Delete Forever:**
  - Delete another quote (from main list → bin)
  - Go to `/quotes/bin`
  - Click "Delete Forever" button
  - Verify confirmation modal: "This action cannot be undone"
  - Confirm deletion
  - Verify quote disappears from bin
  - Verify quote cannot be accessed via URL anymore
  - Check database to confirm permanent deletion

**Expected Result:** Restore works, permanent delete removes from database.

---

## Priority 3: Quote Creation (Sessions 8-21)

### H. Date Fields & Manager Info

#### Test 14: Quote Creation with Dates
- [ ] Navigate to `/quotes/create`
- [ ] Verify 2 new DatePicker fields appear:
  - "Дата КП" (Quote Date)
  - "Действительно до" (Valid Until)
- [ ] Click on date field → verify Russian calendar appears
- [ ] Select dates:
  - Quote Date: Today
  - Valid Until: +30 days from today
- [ ] Verify Russian date format displays: `DD.MM.YYYY` (e.g., `24.10.2025`)
- [ ] Verify manager info fields auto-filled from user profile:
  - Manager Name: Should match logged-in user
  - Manager Phone: From user profile
  - Manager Email: From user profile
- [ ] If fields empty, check user profile has phone/email
- [ ] Add customer and products
- [ ] Save quote
- [ ] View in detail page → Verify dates saved correctly
- [ ] Export as letter → Verify dates appear in PDF

**Expected Result:** Date fields work, manager info auto-fills, dates save correctly.

---

### I. Template System

#### Test 15: Save as Template
- [ ] Navigate to `/quotes/create`
- [ ] Create quote with:
  - 3-5 products
  - Custom quote-level variables (e.g., delivery_days = 45)
  - Product-level overrides (e.g., one product with 0% VAT)
- [ ] Click "Save as Template" button
- [ ] Enter template name: "Standard Import Template"
- [ ] Save template
- [ ] Verify success message: "Template saved successfully"
- [ ] Check template appears in template list

**Expected Result:** Template saves with all variables and products.

---

#### Test 16: Load from Template
- [ ] Navigate to `/quotes/create` (fresh page)
- [ ] Click "Load Template" button
- [ ] Select "Standard Import Template" from Test 15
- [ ] Verify all variables load:
  - delivery_days = 45
  - All quote-level variables match template
- [ ] Verify all products load in grid:
  - Same SKUs
  - Same quantities
  - Same variable overrides (blue indicators)
- [ ] Modify template data (change customer, add product)
- [ ] Save as new quote (not as template)
- [ ] Verify new quote created (doesn't overwrite template)
- [ ] Load template again → verify original template unchanged

**Expected Result:** Template loads correctly, can be reused multiple times.

---

### J. ag-Grid Features

#### Test 17: Grid Operations
- [ ] Navigate to `/quotes/create`
- [ ] Add 5+ products to grid (use different SKUs, brands)
- [ ] **Test Column Filters:**
  - Click filter icon on SKU column
  - Enter partial SKU → verify rows filter
  - Clear filter → verify all rows return
  - Test brand filter
  - Test numeric filter on price column (e.g., > 1000)
- [ ] **Test Column Chooser:**
  - Click column chooser icon (usually top-right)
  - Hide "Weight" column
  - Verify column disappears
  - Show column again → verify reappears
- [ ] **Test Bulk Edit:**
  - Select multiple rows (checkboxes)
  - Change VAT rate for all selected rows
  - Verify all selected rows update simultaneously
- [ ] **Test Sorting:**
  - Click "Price" column header
  - Verify rows sort ascending
  - Click again → sort descending
  - Test multi-column sort (hold Shift + click)
- [ ] **Test Row Selection:**
  - Check individual row checkbox
  - Check "Select All" checkbox
  - Verify all rows selected
- [ ] **Delete Selected Rows:**
  - Select 2 rows
  - Click "Delete Selected" button
  - Verify rows removed from grid
  - Verify total updates

**Expected Result:** All grid features work smoothly, no lag with 5+ rows.

---

#### Test 18: Two-Tier Variable System
- [ ] Navigate to `/quotes/create`
- [ ] Set quote-level default variable:
  - `rate_vat = 20%` (in quote variables card)
- [ ] Add 3 products to grid
- [ ] Verify all products inherit default:
  - Each product row shows `rate_vat = 20%`
  - **Gray color indicator** (means using default)
- [ ] Override variable for product #2:
  - Click on product #2's `rate_vat` cell
  - Change to `0%` (zero-rated export)
  - Press Enter to confirm
- [ ] Verify override behavior:
  - Product #1: Still `20%` (gray - default)
  - Product #2: Now `0%` (**blue color - user override**)
  - Product #3: Still `20%` (gray - default)
- [ ] Change quote-level default to `10%`:
  - Go to quote variables card
  - Change `rate_vat = 10%`
- [ ] Verify inheritance update:
  - Product #1: Now `10%` (follows new default)
  - Product #2: Still `0%` (blue - override preserved)
  - Product #3: Now `10%` (follows new default)
- [ ] Save quote
- [ ] Export validation Excel
- [ ] Open Excel → Verify correct values used in calculations:
  - Product #2 uses `0%` VAT
  - Products #1 and #3 use `10%` VAT

**Expected Result:** Two-tier system works, defaults propagate, overrides persist, colors indicate source.

---

## Priority 4: Edge Cases & Error Handling

### K. Export Error Cases

#### Test 19: Empty Quote Export
- [ ] Navigate to `/quotes/create`
- [ ] Enter customer, description (NO products)
- [ ] Save quote (quote with zero products)
- [ ] Navigate to quote detail page
- [ ] Try to export any format (e.g., "КП поставка")
- [ ] Verify error handling:
  - **Option A:** Error message appears: "Cannot export empty quote"
  - **Option B:** Export disabled/grayed out
  - **Option C:** PDF generates with message "No products"

**Expected Result:** System handles empty quote gracefully, doesn't crash.

---

#### Test 20: Missing Contact Export
- [ ] Create quote without selecting contact
- [ ] Leave contact field empty/null
- [ ] Save quote
- [ ] Export letter format: "КП поставка письмо"
- [ ] Open PDF
- [ ] Verify handling:
  - **Option A:** Contact block shows "N/A" or placeholder
  - **Option B:** Contact block omitted from letter
  - **Option C:** Error message before export

**Expected Result:** Missing contact handled gracefully, letter still generates or clear error shown.

---

#### Test 21: Missing Manager Info
- [ ] Login as user without manager info in profile
  - Or: Clear manager fields in user profile
- [ ] Create quote
- [ ] Export letter format
- [ ] Open PDF
- [ ] Verify handling:
  - Manager name shows username or "N/A"
  - Phone/Email show empty or placeholder
  - Letter signature still readable

**Expected Result:** Missing manager info doesn't break export, uses fallback values.

---

### L. Browser Console & Network

#### Test 22: Console Errors
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Clear console
- [ ] Navigate through all pages:
  - Login → Dashboard → Quotes List → Quote Detail → Quote Create
- [ ] Check Console tab after each page:
  - ✅ **OK:** Warnings (yellow) are acceptable
  - ❌ **NOT OK:** Red errors that block functionality
- [ ] Specifically check for:
  - Uncaught exceptions
  - Failed API calls (404, 500 errors)
  - React render errors
  - TypeScript type errors in browser
- [ ] Test export → Check console during export
- [ ] Test drawer → Check console during drawer open/close

**Expected Result:** No critical red errors, warnings OK, smooth operation.

---

#### Test 23: Network Requests
- [ ] Open DevTools (F12) → Network tab
- [ ] Clear network log
- [ ] **Test PDF Export:**
  - Export "КП поставка"
  - Find request: `GET /api/quotes/[id]/export/pdf?format=supply`
  - Verify status: `200 OK`
  - Verify response type: `application/pdf`
  - Verify size: > 10KB (reasonable PDF size)
  - Verify timing: < 5 seconds
- [ ] **Test Excel Export:**
  - Export "Проверка расчетов"
  - Find request: `GET /api/quotes/[id]/export/excel?format=validation`
  - Verify status: `200 OK`
  - Verify response type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - Verify size: > 5KB
- [ ] **Test Quote List API:**
  - Go to `/quotes`
  - Find request: `GET /api/quotes?page=1&limit=10`
  - Verify status: `200 OK`
  - Check response JSON structure
  - Verify pagination works (if 10+ quotes)

**Expected Result:** All API requests succeed with correct status codes and content types.

---

## Priority 5: Performance & UX

### M. Loading States

#### Test 24: Export Loading Indicators
- [ ] Navigate to quote detail page
- [ ] Click export button (e.g., "КП поставка")
- [ ] **During export (1-3 seconds):**
  - [ ] Verify loading spinner appears on button
  - [ ] Verify button text changes to "Exporting..." or similar
  - [ ] Verify button disabled (can't double-click)
  - [ ] Verify cursor shows loading state
- [ ] **After download:**
  - [ ] Verify spinner disappears
  - [ ] Verify button returns to normal state
  - [ ] Verify button re-enabled
  - [ ] Verify success message appears (optional)
- [ ] Test with slow network (DevTools → Network → Slow 3G):
  - Verify loading state persists during entire export
  - No timeout errors

**Expected Result:** Clear loading feedback, button disabled during export, smooth UX.

---

#### Test 25: Drawer Loading
- [ ] Navigate to `/quotes` list
- [ ] Click quote number link
- [ ] **During drawer opening (0.5-2 seconds):**
  - [ ] Verify drawer panel slides in from right
  - [ ] Verify loading spinner appears in drawer content area
  - [ ] Verify "Loading..." text or skeleton UI shows
- [ ] **After data loads:**
  - [ ] Verify spinner disappears
  - [ ] Verify quote data populates smoothly
  - [ ] Verify no layout shift (content doesn't jump)
- [ ] Test with slow network:
  - Verify loading state persists
  - Verify no error if takes 5+ seconds

**Expected Result:** Smooth drawer animation, clear loading state, no layout shift.

---

### N. Responsive Design

#### Test 26: Mobile Layout (Optional - Time Permitting)
- [ ] Open DevTools (F12) → Toggle device toolbar (Ctrl+Shift+M)
- [ ] Select mobile device (e.g., iPhone 12, 390x844)
- [ ] **Test Quote List:**
  - [ ] Verify table adapts to narrow screen
  - [ ] Columns collapse or scroll horizontally
  - [ ] Action buttons remain accessible
- [ ] **Test Drawer:**
  - [ ] Verify drawer width adapts (maybe full-screen on mobile)
  - [ ] Verify content readable on small screen
  - [ ] Verify close button accessible
- [ ] **Test Export Dropdown:**
  - [ ] Click export button
  - [ ] Verify dropdown menu readable on mobile
  - [ ] Verify all 6 options visible
  - [ ] Test tapping option → export works
- [ ] **Test Quote Creation:**
  - [ ] Verify form fields stack vertically
  - [ ] Verify ag-Grid usable (may scroll)
  - [ ] Verify date pickers work on mobile
  - [ ] Verify save button accessible

**Expected Result:** UI remains usable on mobile, no hidden controls, smooth scrolling.

---

## Testing Notes & Observations

### Issues Found
*Record any bugs or issues discovered during testing:*

1. **Issue #1:**
   - **Description:**
   - **Steps to Reproduce:**
   - **Expected:**
   - **Actual:**
   - **Severity:** Critical / High / Medium / Low

2. **Issue #2:**
   - ...

---

### Positive Observations
*Record things that work well:*

1.
2.
3.

---

### Improvement Suggestions
*Optional enhancements or UX improvements:*

1.
2.
3.

---

## Test Summary

**Total Tests:** 26
**Passed:** ___
**Failed:** ___
**Blocked:** ___
**Skipped:** ___

**Critical Bugs Found:** ___
**High Priority Bugs:** ___
**Medium/Low Priority:** ___

**Overall Assessment:**
- [ ] Ready for Production
- [ ] Minor Fixes Needed
- [ ] Major Fixes Required
- [ ] Not Ready

**Tested By:** _______________
**Date Completed:** _______________
**Total Testing Time:** _______________

---

## Quick Reference

**Backend Health Check:**
```bash
curl http://localhost:8000/
# Expected: {"message":"B2B Quotation Platform API",...}
```

**Check Backend Logs:**
```bash
# If backend issues occur
tail -50 /tmp/backend.log
```

**Check Frontend Compilation:**
```bash
# Should show "✓ Compiled / in XXX seconds"
cd frontend && npm run dev
```

**Test Database Connection:**
```bash
# Backend should show on startup:
# ✅ Database connection verified (Supabase REST API)
```

---

**END OF TEST PLAN**
