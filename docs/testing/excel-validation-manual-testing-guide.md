# Excel Validation Web UI - Manual Testing Guide

**Feature:** Excel Validation Tool
**URL:** http://localhost:3000/admin/excel-validation
**Access:** Admin/Owner only
**Created:** 2025-11-11

---

## Prerequisites

**Before Testing:**
1. Backend running: `cd backend && source venv/bin/activate && uvicorn main:app --reload`
2. Frontend running: `cd frontend && npm run dev`
3. Logged in as admin user
4. Test Excel files available in `validation_data/`:
   - `test_raschet.xlsm` (100% prepay, no financing)
   - `test_raschet_30pct.xlsm` (30% advance, with financing)

---

## Test Scenarios

### Scenario 1: Basic File Upload and Validation (5 min)

**Goal:** Verify basic upload and validation workflow

**Steps:**
1. Navigate to http://localhost:3000/admin/excel-validation
2. Verify page loads with title "Валидация расчетов Excel"
3. Verify upload area displays with message "Перетащите Excel файлы сюда или нажмите для выбора"
4. Click upload area
5. Select `validation_data/test_raschet.xlsm`
6. Verify file appears in file list
7. Keep mode as "Краткий (3 поля)"
8. Keep tolerance as 2.0₽
9. Click "Запустить валидацию"
10. Verify loading spinner appears
11. Wait for results to load (~3-5 seconds for 93 products)

**Expected Results:**
- ✅ Page loads without errors
- ✅ File upload works
- ✅ Summary statistics display:
  - Total: 1
  - Passed: 1 (green)
  - Failed: 0
  - Pass rate: 100%
- ✅ Results table shows:
  - Filename: test_raschet.xlsm
  - Status: ✅ ПРОЙДЕНО (green text)
  - Max deviation: ~0.88₽
  - Failed fields: (empty dash)
- ✅ "Детали" button visible

---

### Scenario 2: Detail Modal View (3 min)

**Goal:** Verify field-by-field comparison modal

**Steps:**
1. From previous scenario results
2. Click "Детали" button for test_raschet.xlsm
3. Verify modal opens with title "test_raschet.xlsm - Детали валидации"
4. Check table has columns: Field Name, Excel Value, Our Calc, Difference, Status
5. Verify 3 rows (AK16, AM16, AQ16) in summary mode
6. Check all rows show ✅ status
7. Close modal

**Expected Results:**
- ✅ Modal opens smoothly
- ✅ Table displays 3 fields (summary mode)
- ✅ All fields show ✅ (passed)
- ✅ Differences are <1₽
- ✅ Values formatted with 2 decimals
- ✅ Close button works

---

### Scenario 3: Detailed Mode Validation (5 min)

**Goal:** Verify detailed mode with 9+ fields

**Steps:**
1. Upload `test_raschet.xlsm` again (or keep from previous)
2. Select "Подробный (9+ полей)" radio button
3. Click "Запустить валидацию"
4. Wait for results
5. Click "Детали" button
6. Verify table shows 9 fields:
   - M16, S16, T16, V16, Y16, AB16, AK16, AM16, AQ16
7. Check all show ✅ status
8. Close modal

**Expected Results:**
- ✅ Detailed mode processes successfully
- ✅ Modal shows 9 fields (not 3)
- ✅ All phase calculations visible
- ✅ All fields pass (✅ status)
- ✅ Can see intermediate values (S16, V16, AB16, etc.)

---

### Scenario 4: Tolerance Adjustment (4 min)

**Goal:** Verify tolerance setting affects validation

**Steps:**
1. Upload `test_raschet.xlsm`
2. Set tolerance to 0.5₽ (instead of 2.0₽)
3. Run validation in summary mode
4. Check if pass rate changes

**Expected Results:**
- ✅ With 0.5₽: Still 100% pass (max dev is 0.88₽ < 0.5₽ should fail some)
- ✅ Statistics update based on new tolerance
- ✅ InputNumber accepts decimal values

**Note:** With test_raschet.xlsm, even 0.5₽ tolerance should pass 95%+ products (max dev only 0.88₽).

---

### Scenario 5: Multiple Files Upload (6 min)

**Goal:** Verify batch validation works

**Steps:**
1. Click "Очистить все" to reset
2. Upload both files:
   - `test_raschet.xlsm`
   - `test_raschet_30pct.xlsm`
3. Verify both appear in file list
4. Run validation (summary mode, 2₽ tolerance)
5. Wait for results (~5-8 seconds for 186 products)

**Expected Results:**
- ✅ Summary shows:
  - Total: 2
  - Passed: 2
  - Failed: 0
  - Pass rate: 100%
- ✅ Results table has 2 rows
- ✅ Both files show ✅ ПРОЙДЕНО
- ✅ Can view details for each file separately
- ✅ Max deviations: ~0.88₽ and ~1.00₽

---

### Scenario 6: File Removal (2 min)

**Goal:** Verify file list management

**Steps:**
1. Upload 2 files (test_raschet.xlsm, test_raschet_30pct.xlsm)
2. Verify both appear in list
3. Click remove (X) button on first file
4. Verify file removed from list
5. Upload another file
6. Click "Очистить все"
7. Verify all files cleared

**Expected Results:**
- ✅ Remove button works per file
- ✅ "Очистить все" clears all files
- ✅ File list updates immediately
- ✅ Results panel hidden after clear
- ✅ Can re-upload after clearing

---

### Scenario 7: Max File Limit (2 min)

**Goal:** Verify 10-file limit enforcement

**Steps:**
1. Try to upload 11 files (if you have that many)
2. Or upload same file 11 times

**Expected Results:**
- ✅ Warning message: "Максимум 10 файлов"
- ✅ 11th file not added to list
- ✅ First 10 files remain in list

**Note:** May need to create dummy Excel files for this test.

---

### Scenario 8: Non-Admin Access (2 min)

**Goal:** Verify admin-only security

**Steps:**
1. Log out
2. Log in as non-admin user (member or manager role)
3. Try to navigate to /admin/excel-validation directly
4. Check side menu

**Expected Results:**
- ✅ "Администрирование" menu not visible for non-admins
- ✅ Direct URL access: Shows error message "Доступ запрещён"
- ✅ Redirects to /dashboard
- ✅ Backend API returns 403 Forbidden if bypassed

---

### Scenario 9: Empty Upload Attempt (1 min)

**Goal:** Verify validation without files

**Steps:**
1. Clear all files
2. Click "Запустить валидацию" with no files uploaded

**Expected Results:**
- ✅ Warning message: "Загрузите хотя бы один файл Excel"
- ✅ Validation doesn't run
- ✅ No API call made

---

### Scenario 10: Invalid File Type (2 min)

**Goal:** Verify file type validation

**Steps:**
1. Try to upload a .txt or .pdf file
2. Or upload .csv file

**Expected Results:**
- ✅ Upload component should accept only .xlsx and .xlsm
- ✅ Wrong file types rejected
- ✅ Clear error message

**Note:** May depend on Upload component configuration.

---

## Expected Accuracy

**For files from current engine (test_raschet*.xlsm):**
- 100% pass rate with tolerance ±1₽
- Average deviation: 0.002-0.003%
- Maximum deviation: <0.01%

**For old engine files (reman_servis):**
- 98.9% pass rate with tolerance ±500₽
- Average deviation: ~1.8%
- Different formulas/variables

---

## Common Issues & Troubleshooting

### Issue: "Ошибка валидации: Not authenticated"
**Cause:** Session expired
**Fix:** Refresh page and log in again

### Issue: Validation takes >10 seconds
**Cause:** Large file with 500+ products
**Fix:** Normal behavior, wait for completion

### Issue: Max deviation much higher than expected
**Cause:** File from different engine version or missing variables
**Fix:** Check file is from current calculation engine export

### Issue: Results table empty after validation
**Cause:** API error or no files processed
**Fix:** Check browser console for errors, verify backend is running

---

## Browser Console Checks

**No errors expected.** If you see errors:

- ❌ `401 Unauthorized` → Session expired, re-login
- ❌ `403 Forbidden` → Not admin user
- ❌ `500 Internal Server Error` → Backend issue, check logs
- ⚠️ Warning about "UserWarning: Data Validation extension" → Normal (Excel macro warning)

---

## Performance Expectations

| Products | Expected Time | Notes |
|----------|--------------|-------|
| 1-50 | 2-3 seconds | Fast |
| 50-100 | 3-5 seconds | Normal |
| 100-200 | 5-8 seconds | Acceptable |
| 200+ | 8-15 seconds | May need progress indicator |

---

## Success Criteria

After manual testing, verify:

- ✅ All 10 scenarios pass
- ✅ No console errors
- ✅ Admin-only access enforced
- ✅ File upload works (xlsx and xlsm)
- ✅ Validation produces accurate results (100% pass rate)
- ✅ Detail modal shows field comparisons
- ✅ Both modes work (summary and detailed)
- ✅ Tolerance adjustment works
- ✅ Multiple files can be validated together
- ✅ File management works (add, remove, clear all)

---

## Next Steps After Manual Testing

1. **If all tests pass:**
   - Document test results
   - Mark feature as complete
   - Proceed with merge to main

2. **If issues found:**
   - Document bugs in issue tracker
   - Prioritize (critical, important, minor)
   - Fix critical issues before merge

---

**Tester:** _______________
**Date:** _______________
**Result:** ⬜ PASS | ⬜ FAIL | ⬜ BLOCKED
**Notes:** _______________________________________________
