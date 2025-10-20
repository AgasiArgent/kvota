# Manual Testing Guide - Quote Creation Page

## Prerequisites
- ✅ Frontend dev server running: `npm run dev` (localhost:3000)
- ✅ Backend API running: `uvicorn main:app --reload` (localhost:8000)
- ✅ **Test User Credentials:**
  - Email: `andrey@masterbearingsales.ru`
  - Password: `password`
  - Organization: МАСТЕР БЭРИНГ ООО

---

## Test 1: Page Load & Initial State

1. **Navigate to:** http://localhost:3000/quotes/create
2. **Verify you see:**
   - ✅ "Создать котировку" header
   - ✅ "Загрузить товары" section with drag-and-drop zone
   - ✅ "Выбрать клиента" dropdown (empty initially)
   - ✅ "Шаблон переменных" section (collapsed accordions)
   - ✅ NO grid visible yet (grid only shows after upload)

---

## Test 2: File Upload - Drag & Drop

1. **Prepare:** Open file explorer to `/home/novi/quotation-app/backend/test_data/sample_products.csv`
2. **Drag the file** into the upload zone
3. **Verify:**
   - ✅ Green success message: "Загружено 5 товаров"
   - ✅ File name appears: "sample_products.csv"
   - ✅ Grid appears below with 5 rows
   - ✅ Grid has checkbox column on the LEFT (first column)
   - ✅ Grid shows columns: Артикул, Бренд, Наименование, Кол-во, Цена с НДС, Вес, etc.

**Expected Data (5 products):**
- Bearing SKF 6205 (qty: 10)
- Seal NBR 45x62x7 (qty: 20)
- Gasket Set Universal (qty: 5)
- Oil Filter HF-204 (qty: 15)
- Brake Pad Set Front (qty: 8)

---

## Test 3: File Upload - Click to Browse

1. **Click the upload zone** (don't drag)
2. **Select file:** Navigate to `backend/test_data/sample_products.csv`
3. **Verify:**
   - ✅ NO infinite loading spinner
   - ✅ Same success message and grid appears
   - ✅ Grid renders correctly

---

## Test 4: Row Selection with Checkboxes

1. **Check individual row:**
   - Click checkbox on first row (Bearing SKF 6205)
   - **Verify:** Row background turns **GREY** (#e0e0e0)

2. **Check multiple rows:**
   - Click checkboxes on 2nd and 3rd rows
   - **Verify:** 3 rows total selected with grey background

3. **Hover over selected row:**
   - **Verify:** Background becomes darker grey (#d4d4d4)

4. **Select all:**
   - Click checkbox in HEADER row
   - **Verify:** All 5 rows selected with grey background

5. **Deselect all:**
   - Click header checkbox again
   - **Verify:** All rows deselected, grey background removed

---

## Test 5: Grid Editing - Decimal Input

1. **Double-click** on a cell with numbers (e.g., "Цена с НДС" = 1200.00)
2. **Type:** `1500,50` (with COMMA)
3. **Press Enter**
4. **Verify:** Value changes to `1500.50` (comma converted to period)

5. **Double-click** another numeric cell
6. **Type:** `2000.75` (with PERIOD)
7. **Press Enter**
8. **Verify:** Value saved as `2000.75`

**This tests the `parseDecimalInput` helper function**

---

## Test 6: Batch Editing

1. **Select 2-3 rows** using checkboxes
2. **Click** "Массовое редактирование" button (top right above grid)
3. **Modal opens:**
   - Title: "Массовое редактирование"
   - Text: "Выберите поле и введите значение для выбранных строк"

4. **In modal:**
   - **Select field:** "Акциз (УЕ КП на тонну)" from dropdown
   - **Enter value:** `150`
   - **Press Enter key** (should trigger apply)

5. **Verify:**
   - ✅ Modal closes
   - ✅ Success message: "Обновлено X строк"
   - ✅ Selected rows now have 150 in Акциз column

6. **Test modal keyboard shortcut:**
   - Select rows again
   - Click "Массовое редактирование"
   - **Press ESC key**
   - **Verify:** Modal closes without changes

---

## Test 7: Field Labels (Session 11 Fixes)

**Verify these renamed fields:**

1. **In grid columns:**
   - ✅ "Акциз (УЕ КП на тонну)" - width 180px (NOT "Акциз (%)")

2. **In "Логистика" section (expand accordion):**
   - ✅ "Поставщик - Турция (₽)"
   - ✅ "Турция - Таможня РФ (₽)"
   - ✅ "Таможня РФ - Клиент (₽)"

3. **In "Таможня и пошлины" section:**
   - ✅ "Акциз (УЕ КП на тонну)" (NOT "Акциз (%)")

4. **In Batch Edit modal dropdown:**
   - ✅ "Акциз (УЕ КП на тонну)" option

---

## Test 8: Grid Visual Checks

1. **Check column groups:**
   - ✅ "Информация о товаре" group
   - ✅ "Финансовые параметры" group

2. **Check column order (left to right):**
   - Column 1: Checkbox (no header text)
   - Column 2: Артикул
   - Column 3: Бренд
   - Column 4: Наименование
   - Column 5: Кол-во

3. **Check cell backgrounds:**
   - ✅ Regular cells: White (#fff) or light grey (#f5f5f5)
   - ✅ Override cells (when edited): Light blue (#e6f7ff)
   - ✅ Selected rows: Grey (#e0e0e0)

---

## Test 9: Variable Templates

1. **Expand** "Настройки компании" accordion
2. **Verify fields:**
   - ✅ Компания-продавец: "МАСТЕР БЭРИНГ ООО"
   - ✅ Вид КП: "поставка"

3. **Expand** "Финансовые параметры" accordion
4. **Check fields:**
   - ✅ Валюта КП: "RUB (Рубль)"
   - ✅ Наценка (%): 15
   - ✅ Размер вознаграждения: 1000

5. **Click** "Сохранить как шаблон" link (top right)
6. **Enter name:** "Test Template"
7. **Verify:** Success message "Шаблон сохранен"

---

## Test 10: Calculate Quote

1. **Select customer:** Choose "ООО Ромашка'П" from dropdown
2. **Verify:** Upload file (if not already done)
3. **Verify:** Grid has products loaded
4. **Click:** "Рассчитать котировку" button (bottom)
5. **Expected:**
   - Loading spinner appears
   - Calculation runs (may take a few seconds)
   - Success message OR calculation results appear

**If button is disabled:**
- ✅ Check error text below: "Выберите клиента" or "загрузите товары"

---

## Test 11: Console Errors

1. **Open browser console:** Press F12, go to Console tab
2. **Reload page:** Ctrl+Shift+R
3. **Check for errors:**

**Expected warnings (OK to ignore):**
- ⚠️ `[rc-collapse] children will be removed` - non-critical Ant Design warning
- ⚠️ `[antd: compatible] antd v5 support React is 16 ~ 18` - React 19 compatibility warning
- ⚠️ `[antd: message] Static function can not consume` - non-critical

**NO errors expected:**
- ❌ NO ag-Grid module registration errors
- ❌ NO "Unable to use enableRangeSelection" errors
- ❌ NO JavaScript errors (red text)

---

## Test 12: Upload File Removal

1. **Upload file** (if not done)
2. **Verify:** Grid visible with products
3. **Click X icon** next to file name to remove
4. **Verify:**
   - ✅ File removed
   - ✅ Grid disappears (no products)
   - ✅ Upload zone appears again

---

## Test 13: Grid Copy/Paste (Excel-like)

1. **Upload file** with products
2. **Click on a cell** (e.g., Quantity = 10)
3. **Press Ctrl+C** to copy
4. **Click another cell** in same column
5. **Press Ctrl+V** to paste
6. **Verify:** Value copied successfully

---

## Test 14: Grid Tooltips & Help

1. **Hover over** "Настройки администратора (только чтение)" section
2. **Verify:** Info icon (ℹ️) visible
3. **Check tooltip text:** "Эти параметры установлены администратором..."

---

## Known Issues (Not Bugs)

- ⚠️ rc-collapse warning about `children` prop - will fix in future
- ⚠️ React 19 compatibility warnings - Ant Design needs update
- ⚠️ Some quote-related pages have temporary stubs (documented in CLAUDE.md)

---

## Success Criteria

✅ **ALL of the following MUST work:**
1. File upload (drag & drop + click)
2. Grid renders with checkbox column
3. Row selection shows GREY background
4. Batch editing modal works
5. Decimal input accepts both comma and period
6. All field labels match renamed versions
7. No critical console errors

---

## Quick Smoke Test (2 minutes)

If you're in a hurry, just test these 5 things:

1. ✅ Upload file → Grid appears
2. ✅ Click checkbox → Row turns grey
3. ✅ Select 2 rows → Batch edit button → Enter value → Rows updated
4. ✅ Check field name: "Акциз (УЕ КП на тонну)" (NOT "Акциз (%)")
5. ✅ No red errors in console

If all 5 pass → **Page is working correctly!** 🎉

---

## Reporting Issues

If something doesn't work:

1. **Note the exact step** where it failed
2. **Take a screenshot** if visual issue
3. **Copy console errors** (F12 → Console tab)
4. **Describe expected vs actual behavior**

Example:
> Step 3 failed. Expected grey selection, but got blue.
> Console shows: [error message here]
> Screenshot: [attach]
