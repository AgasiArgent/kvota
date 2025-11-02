# Financial Analytics System - Manual Testing Plan

**Feature:** Financial Analytics & Reporting System
**Date:** 2025-11-02
**Tester:** User (Admin/Owner role required)
**Estimated Time:** 30-45 minutes

---

## Pre-Testing Setup

### Step 1: Start Backend Server

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**Expected:** Server starts on http://localhost:8000

### Step 2: Start Frontend Server

```bash
cd frontend
npm run dev
```

**Expected:** Frontend starts on http://localhost:3000

### Step 3: Login as Admin

- **URL:** http://localhost:3000/auth/login
- **Email:** `andrey@masterbearingsales.ru`
- **Password:** `password`
- **Role:** Admin/Owner

**Expected:** Logged in successfully, redirected to dashboard

### Step 4: Navigate to Analytics

- Click **"Аналитика"** in left sidebar
- **Expected:** Submenu shows 4 items:
  - Запросы (Queries)
  - Сохранённые отчёты (Saved Reports)
  - История (History)
  - Расписание (Schedule)

---

## Test Suite 1: Analytics Query Builder (15 min)

### Test 1.1: Basic Query Execution

**Page:** `/analytics` (Запросы)

**Steps:**
1. Leave all filters empty
2. Click **"Выполнить запрос"** (Run Query) button
3. Wait for results to load

**Expected:**
- ✅ Loading spinner shows
- ✅ ag-Grid table appears with quotes
- ✅ Columns: Quote Number, Customer Name, Total Amount, Status (default fields)
- ✅ Aggregation row at bottom shows totals
- ✅ "Found X quotes" message appears

**Bugs to watch:**
- ❌ Error message appears
- ❌ Empty table (no data)
- ❌ Loading never completes

---

### Test 1.2: Filter by Date Range

**Steps:**
1. Click **"Период"** (Period) card to expand
2. Select **"От"** (From): September 25, 2024
3. Select **"До"** (To): November 25, 2024
4. Click **"Выполнить запрос"**

**Expected:**
- ✅ Only quotes in date range are shown
- ✅ Quote count updates
- ✅ Table refreshes with filtered data

---

### Test 1.3: Filter by Status

**Steps:**
1. Click **"Статус"** (Status) filter
2. Select: **"Согласовано"** (Approved) + **"Принято клиентом"** (Accepted)
3. Click **"Выполнить запрос"**

**Expected:**
- ✅ Only approved/accepted quotes shown
- ✅ Other statuses excluded

---

### Test 1.4: Filter by Sale Type

**Steps:**
1. Click **"Вид КП"** (Sale Type) filter
2. Select: **"Поставка"** (Supply)
3. Click **"Выполнить запрос"**

**Expected:**
- ✅ Only "поставка" quotes shown
- ✅ Transit/export quotes excluded

---

### Test 1.5: Filter by Seller Company

**Steps:**
1. Click **"Компания-продавец"** (Seller Company) filter
2. **Deselect:** "МАСТЕР БЭРИНГ ООО"
3. Click **"Выполнить запрос"**

**Expected:**
- ✅ Quotes from "МАСТЕР БЭРИНГ ООО" excluded
- ✅ Other seller companies shown

---

### Test 1.6: Combine Multiple Filters

**Steps:**
1. Set date range: Sep 25 - Nov 25
2. Set status: Approved
3. Set sale type: Поставка
4. Deselect seller: МАСТЕР БЭРИНГ ООО
5. Click **"Выполнить запрос"**

**Expected:**
- ✅ All filters applied together (AND logic)
- ✅ Results match ALL conditions

---

### Test 1.7: Field Selection

**Steps:**
1. Click **"Выбрать поля"** (Select Fields) button
2. Check additional fields:
   - НДС импорт (Import VAT)
   - Себестоимость (COGS)
   - Прибыль (Profit)
3. Click **"Применить"** (Apply)
4. Run query

**Expected:**
- ✅ Table shows new columns
- ✅ Values displayed correctly
- ✅ Russian number formatting (1 234,56)

---

### Test 1.8: Lightweight Mode (Aggregations Only)

**Steps:**
1. Toggle view mode switch to **"Облегчённый"** (Lightweight)
2. Click **"Выполнить запрос"**

**Expected:**
- ✅ ag-Grid table HIDES
- ✅ Statistic cards SHOW instead
- ✅ Cards display:
  - Всего НДС (Total VAT)
  - Общая выручка (Total Revenue)
  - Количество КП (Quote Count)
- ✅ Large numbers with Russian formatting

---

### Test 1.9: Drill-Down (Lightweight → Standard)

**Steps:**
1. While in Lightweight mode (cards showing)
2. Click on any statistic card (e.g., "Всего НДС")

**Expected:**
- ✅ Switches to Standard mode
- ✅ Shows ag-Grid table with same filters
- ✅ Can see individual quote rows

---

### Test 1.10: Export to Excel

**Steps:**
1. Run a query (any filters)
2. Click **"Экспорт в Excel"** (Export to Excel) button
3. Wait for download

**Expected:**
- ✅ File downloads: `analytics_YYYYMMDD_HHMMSS.xlsx`
- ✅ File opens in Excel
- ✅ Contains selected columns
- ✅ Russian number formatting (space as thousand separator, comma as decimal)
- ✅ Styled headers (blue background)

**Bugs to watch:**
- ❌ CSV file downloads instead of Excel
- ❌ Numbers formatted wrong (1,234.56 instead of 1 234,56)
- ❌ Empty file

---

### Test 1.11: Export to CSV

**Steps:**
1. Run a query
2. Click **"Экспорт в CSV"** button
3. Wait for download

**Expected:**
- ✅ File downloads: `analytics_YYYYMMDD_HHMMSS.csv`
- ✅ File opens in Excel/text editor
- ✅ UTF-8 encoding (Russian text displays correctly)

---

### Test 1.12: Aggregation Builder

**Steps:**
1. Click **"Добавить агрегацию"** (Add Aggregation) button
2. Select field: **"НДС импорт"** (Import VAT)
3. Select function: **"SUM"** (Сумма)
4. Enter label: **"Общий НДС"**
5. Add another: AVG on "Прибыль" (Profit)
6. Switch to Lightweight mode
7. Run query

**Expected:**
- ✅ Cards show custom aggregations
- ✅ "Общий НДС" card with sum value
- ✅ "Средняя прибыль" card with average value

---

### Test 1.13: Save Query as Template

**Steps:**
1. Set up filters + fields + aggregations
2. Click **"Сохранить запрос"** (Save Query) button
3. Enter name: **"Тестовый отчёт по НДС"**
4. Enter description: **"Отчёт для тестирования"**
5. Select visibility: **"Личный"** (Personal)
6. Click **"Сохранить"**

**Expected:**
- ✅ Success message: "Отчёт сохранён"
- ✅ Modal closes
- ✅ Can navigate to Saved Reports and see it

---

## Test Suite 2: Saved Reports (10 min)

### Test 2.1: View Saved Reports List

**Page:** `/analytics/saved` (Сохранённые отчёты)

**Expected:**
- ✅ Table shows saved reports
- ✅ Columns: Name, Description, Visibility, Created Date, Actions
- ✅ At least 1 report (from Test 1.13)

---

### Test 2.2: Search Reports

**Steps:**
1. Type in search box: **"НДС"**

**Expected:**
- ✅ Only reports with "НДС" in name shown
- ✅ Other reports hidden

---

### Test 2.3: Filter by Visibility

**Steps:**
1. Click **"Видимость"** (Visibility) filter
2. Select **"Личный"** (Personal)

**Expected:**
- ✅ Only personal reports shown
- ✅ Shared reports hidden

---

### Test 2.4: Run Saved Report

**Steps:**
1. Find your saved report "Тестовый отчёт по НДС"
2. Click **"Выполнить"** (Run) button

**Expected:**
- ✅ Redirects to `/analytics` page
- ✅ Filters pre-loaded from saved report
- ✅ Query executes automatically
- ✅ Results displayed

---

### Test 2.5: Edit Saved Report

**Steps:**
1. Click **"Редактировать"** (Edit) icon
2. Change name to: **"Месячный отчёт НДС"**
3. Change visibility to: **"Общий"** (Shared)
4. Click **"Сохранить"**

**Expected:**
- ✅ Success message
- ✅ Table updates with new name
- ✅ Visibility shows "Общий"

---

### Test 2.6: Clone Report

**Steps:**
1. Click **"Клонировать"** (Clone) icon
2. Enter new name: **"Копия отчёта НДС"**
3. Click **"Создать"**

**Expected:**
- ✅ New report created
- ✅ Same filters/fields as original
- ✅ Marked as "Личный" (Personal)

---

### Test 2.7: Delete Report

**Steps:**
1. Click **"Удалить"** (Delete) icon on cloned report
2. Confirm deletion in modal

**Expected:**
- ✅ Confirmation modal appears
- ✅ Report removed from list after confirmation
- ✅ Success message

---

## Test Suite 3: Execution History (8 min)

### Test 3.1: View Execution History

**Page:** `/analytics/history` (История)

**Expected:**
- ✅ Table shows past query executions
- ✅ Columns: Date, Report Name, Run By, Type, Quote Count, File, Download
- ✅ Paginated (50 per page)
- ✅ Sorted by date DESC (newest first)

**Note:** If empty, go back to analytics page and run a query with export to generate history

---

### Test 3.2: Filter by Date Range

**Steps:**
1. Select date range: Today only
2. Table refreshes

**Expected:**
- ✅ Only today's executions shown

---

### Test 3.3: Filter by Execution Type

**Steps:**
1. Click **"Тип"** (Type) filter
2. Select **"Ручной"** (Manual)

**Expected:**
- ✅ Only manual executions shown
- ✅ Scheduled executions hidden

---

### Test 3.4: View Execution Details

**Steps:**
1. Click on any row in history table
2. Modal opens

**Expected:**
- ✅ Shows full execution details:
  - Filters used
  - Fields selected
  - Aggregations (if any)
  - Results summary (Total VAT, Quote Count, etc.)
  - Execution time
  - IP address, user agent

---

### Test 3.5: Download Exported File

**Steps:**
1. Find execution with file (check "Файл" column shows format)
2. Click **"Скачать"** (Download) button

**Expected:**
- ✅ File downloads
- ✅ Filename: `report_<execution_id>.xlsx` or `.csv`
- ✅ File opens correctly
- ✅ Contains data from that execution

**Bugs to watch:**
- ❌ "File expired" error (if >7 days old)
- ❌ 404 error

---

### Test 3.6: Expired File Indicator

**Steps:**
1. Find execution older than 7 days (if exists)

**Expected:**
- ✅ Shows **"Истёк"** (Expired) badge
- ✅ Download button disabled

**Note:** May not have 7-day-old data yet - skip if no old executions

---

### Test 3.7: Pagination

**Steps:**
1. If >50 executions, click page 2

**Expected:**
- ✅ Table shows next 50 executions
- ✅ Pagination controls at bottom
- ✅ Can navigate between pages

---

## Test Suite 4: Scheduled Reports (12 min)

### Test 4.1: View Scheduled Reports List

**Page:** `/analytics/scheduled` (Расписание)

**Expected:**
- ✅ Table shows scheduled reports (likely empty)
- ✅ Columns: Name, Saved Report, Schedule, Next Run, Last Run, Status, Active, Actions
- ✅ Create button visible

---

### Test 4.2: Create Daily Schedule

**Steps:**
1. Click **"Создать расписание"** (Create Schedule) button
2. Modal opens
3. Select saved report: **"Месячный отчёт НДС"** (from earlier test)
4. Enter name: **"Ежедневный НДС в 9 утра"**
5. Click preset: **"Ежедневно в 9:00"** (Daily at 9am)
6. Enter email recipients: `test@example.com` (press Enter to add)
7. Check **"Прикрепить файл"** (Include file) checkbox
8. Click **"Создать"**

**Expected:**
- ✅ Success message
- ✅ Schedule appears in table
- ✅ Next run shows tomorrow at 9am (Moscow time)
- ✅ Status: Active

---

### Test 4.3: Custom Cron Expression

**Steps:**
1. Create another schedule
2. Instead of preset, enter custom cron: `0 18 * * 5` (Fridays at 6pm)
3. Enter name: **"Еженедельный отчёт в пятницу"**
4. Email: `weekly@example.com`
5. Save

**Expected:**
- ✅ Next run shows next Friday at 18:00
- ✅ Cron expression accepted

**Bugs to watch:**
- ❌ Invalid cron error (should only happen for truly invalid cron)
- ❌ Next run calculation wrong

---

### Test 4.4: Manual Trigger (Run Now)

**Steps:**
1. Find schedule created in Test 4.2
2. Click **"Запустить сейчас"** (Run Now) button
3. Wait for execution

**Expected:**
- ✅ Loading indicator shows
- ✅ Success message: "Отчёт выполнен"
- ✅ Last Run updates to current time
- ✅ Status shows: Success (green checkmark)
- ✅ Can navigate to History and see this execution

**Check History:**
- Go to `/analytics/history`
- **Expected:** New execution with type "Manual"

---

### Test 4.5: Toggle Active/Inactive

**Steps:**
1. Click **Switch** toggle to deactivate schedule
2. Wait for update

**Expected:**
- ✅ Active column shows "Неактивно" (Inactive)
- ✅ Schedule won't run automatically
- ✅ Toggle back works

---

### Test 4.6: Edit Schedule

**Steps:**
1. Click **"Редактировать"** (Edit) icon
2. Change name to: **"Ежедневный отчёт НДС (обновлён)"**
3. Change cron to: `0 10 * * *` (10am instead of 9am)
4. Add another email: `admin@example.com`
5. Save

**Expected:**
- ✅ Changes saved
- ✅ Next run updates to 10am
- ✅ Email recipients shows 2 emails

---

### Test 4.7: Delete Schedule

**Steps:**
1. Click **"Удалить"** (Delete) icon
2. Confirm deletion

**Expected:**
- ✅ Confirmation modal
- ✅ Schedule removed from list
- ✅ Success message

---

## Test Suite 5: Lightweight Mode (5 min)

### Test 5.1: Switch to Lightweight Mode

**Page:** `/analytics`

**Steps:**
1. Set filters: Status = Approved, Sale Type = Поставка
2. Toggle view mode to **"Облегчённый"** (Lightweight)
3. Run query

**Expected:**
- ✅ ag-Grid table HIDDEN
- ✅ Large statistic cards SHOWN:
  - "Всего НДС импорт" (Total Import VAT)
  - "Общая выручка" (Total Revenue)
  - "Количество КП" (Quote Count)
- ✅ Numbers formatted large (e.g., "5 234 567 ₽")

---

### Test 5.2: Drill-Down from Card

**Steps:**
1. While in Lightweight mode
2. Click on **"Всего НДС импорт"** card

**Expected:**
- ✅ Switches to Standard mode
- ✅ Shows ag-Grid with individual quotes
- ✅ Same filters still applied

---

### Test 5.3: Add Custom Aggregations

**Steps:**
1. Click **"Настроить агрегации"** (Configure Aggregations)
2. Add: SUM on "Таможенные пошлины" (Customs Duty)
3. Add: AVG on "Прибыль" (Profit)
4. Switch to Lightweight mode
5. Run query

**Expected:**
- ✅ Cards show:
  - "Сумма таможенных пошлин"
  - "Средняя прибыль"
- ✅ Values calculated correctly

---

## Test Suite 6: Error Handling (5 min)

### Test 6.1: Empty Results

**Steps:**
1. Set filters that return no quotes:
   - Date range: Jan 1, 2020 - Jan 2, 2020
2. Run query

**Expected:**
- ✅ Message: "Нет данных" or "0 котировок найдено"
- ✅ Empty table (no error)

---

### Test 6.2: Invalid Date Range

**Steps:**
1. Set "От" (From): Nov 25, 2024
2. Set "До" (To): Sep 25, 2024 (earlier than "from")
3. Try to run query

**Expected:**
- ✅ Error message: "Дата 'до' должна быть позже даты 'от'"
- ✅ Query doesn't execute

---

### Test 6.3: No Fields Selected

**Steps:**
1. Deselect ALL fields in field selector
2. Try to run query

**Expected:**
- ✅ Error message: "Выберите хотя бы одно поле"
- ✅ Query doesn't execute

---

### Test 6.4: Rate Limiting

**Steps:**
1. Run query 11 times rapidly (click Run Query repeatedly)

**Expected:**
- ✅ First 10 queries succeed
- ✅ 11th query shows error: "Too many requests. Try again later."
- ✅ Wait 1 minute → can query again

---

## Test Suite 7: Role-Based Access (3 min)

### Test 7.1: Admin/Owner Can Access

**User:** Already logged in as admin

**Expected:**
- ✅ "Аналитика" menu visible in sidebar
- ✅ All 4 pages accessible

---

### Test 7.2: Non-Admin Cannot Access

**Steps:**
1. Logout
2. Login as non-admin user (member or manager role)
3. Check sidebar

**Expected:**
- ✅ "Аналитика" menu NOT visible
- ✅ Direct URL navigation (e.g., `/analytics`) shows 403 Forbidden or redirects

**Note:** If no non-admin user exists, skip this test

---

## Test Suite 8: Responsive Design (2 min)

### Test 8.1: Mobile View

**Steps:**
1. Open browser DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone or Android device
4. Navigate through all 4 analytics pages

**Expected:**
- ✅ Filters collapse by default (mobile)
- ✅ Tables have horizontal scroll
- ✅ Cards stack vertically
- ✅ Buttons remain accessible

---

## Bug Reporting Template

**If you find bugs, report using this format:**

```
**Bug:** [Short description]
**Page:** /analytics/...
**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected:** What should happen
**Actual:** What actually happened
**Screenshot:** [If applicable]
**Console Errors:** [Open DevTools Console, copy errors]
```

---

## Success Criteria

**Minimum requirements to pass testing:**

- [ ] Can execute queries with filters ✅
- [ ] Results display in table (Standard mode) ✅
- [ ] Aggregations display in cards (Lightweight mode) ✅
- [ ] Export to Excel works ✅
- [ ] Can save query as template ✅
- [ ] Can run saved report ✅
- [ ] Execution history displays ✅
- [ ] Can download historical files ✅
- [ ] Can create scheduled report ✅
- [ ] Manual trigger works ✅
- [ ] Admin-only access enforced ✅

**Nice to have (not critical):**
- [ ] CSV export works
- [ ] Email configuration accepts multiple recipients
- [ ] Cron expression validation shows helpful errors
- [ ] Loading states smooth
- [ ] Responsive on mobile

---

## Post-Testing

After testing, report:

**What works:** [List]
**What's broken:** [List with bug template above]
**UX improvements:** [List suggestions]

Then I'll fix bugs and polish based on your feedback!

---

**Estimated Testing Time:** 30-45 minutes
**Have fun exploring the new analytics system!** 📊
