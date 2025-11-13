# E2E Manual Testing Checklist - Session 26

**Date:** 2025-10-26
**Session:** 26 - Pre-deployment Infrastructure (Waves 1-6)
**Purpose:** Verify all new features and existing functionality before deployment

---

## Prerequisites

- [ ] Frontend running on http://localhost:3000
- [ ] Backend running on http://localhost:8000
- [ ] Logged in as test user (andrey@masterbearingsales.ru)
- [ ] Database migrations applied (014, 015, 016, ~~017~~, 021)

---

## Wave 1-2 Features: User Profile & Manager Info

### User Profile Page (/profile)

- [ ] **Navigate to profile page**
  - [ ] Click profile menu in header
  - [ ] Page loads without errors
  - [ ] Two cards visible: "Профиль пользователя" and "Информация для КП"

- [ ] **View current profile**
  - [ ] Email displayed correctly
  - [ ] Role displayed correctly (should be "admin" or "owner")
  - [ ] Organization name shown

- [ ] **Edit manager information**
  - [ ] Click "Редактировать" button on "Информация для КП" card
  - [ ] Form appears with 4 fields:
    - [ ] Имя менеджера (Manager Name)
    - [ ] Должность (Position)
    - [ ] Телефон (Phone)
    - [ ] Email
  - [ ] Fill in test data:
    - Name: "Андрей Иванов"
    - Position: "Менеджер по продажам"
    - Phone: "+7 (495) 123-45-67"
    - Email: "andrey@masterbearingsales.ru"
  - [ ] Click "Сохранить"
  - [ ] Success message appears
  - [ ] Card updates with new data
  - [ ] Form closes automatically

- [ ] **Update manager information**
  - [ ] Click "Редактировать" again
  - [ ] Previous values pre-filled
  - [ ] Change phone to "+7 (495) 999-88-77"
  - [ ] Click "Сохранить"
  - [ ] Updated phone displayed

- [ ] **Cancel editing**
  - [ ] Click "Редактировать"
  - [ ] Change some values
  - [ ] Click "Отмена"
  - [ ] Form closes, no changes saved

---

## Wave 1-2 Features: Exchange Rates

### Exchange Rate Dashboard (Home Page)

- [ ] **Navigate to home page**
  - [ ] Go to http://localhost:3000
  - [ ] "Курсы валют ЦБ РФ" card visible

- [ ] **View exchange rates**
  - [ ] USD rate displayed (or "Загрузка..." if loading)
  - [ ] EUR rate displayed (or "Загрузка..." if loading)
  - [ ] CNY rate displayed (or "Загрузка..." if loading)
  - [ ] "Обновлено" timestamp shown

- [ ] **Manual refresh**
  - [ ] Click "Обновить" button
  - [ ] Loading spinner appears
  - [ ] Rates update (timestamp changes)
  - [ ] Success message appears

- [ ] **Auto-load behavior**
  - [ ] If rates are empty, they auto-load on page mount
  - [ ] Check browser console for API call
  - [ ] No errors in console

- [ ] **Error handling**
  - [ ] Stop backend server: `pkill -f uvicorn`
  - [ ] Click "Обновить"
  - [ ] Error message appears
  - [ ] UI doesn't crash
  - [ ] Restart backend: `cd backend && source venv/bin/activate && uvicorn main:app --reload`

---

## Wave 1-2 Features: Feedback System

### Feedback Button (All Pages)

- [ ] **Locate feedback button**
  - [ ] Floating button visible in bottom-right corner
  - [ ] Button shows feedback icon
  - [ ] Button appears on all pages (home, quotes, customers, etc.)

- [ ] **Submit feedback**
  - [ ] Click feedback button
  - [ ] Modal opens with title "Обратная связь"
  - [ ] Form has fields:
    - [ ] Категория (dropdown: Ошибка, Предложение, Вопрос, Другое)
    - [ ] Тема (text input)
    - [ ] Сообщение (textarea)
  - [ ] Fill in test feedback:
    - Category: "Предложение"
    - Subject: "Улучшение интерфейса"
    - Message: "Было бы здорово добавить темную тему"
  - [ ] Click "Отправить"
  - [ ] Success message appears
  - [ ] Modal closes automatically

- [ ] **Validation**
  - [ ] Click feedback button
  - [ ] Leave all fields empty
  - [ ] Click "Отправить"
  - [ ] Validation errors appear (all fields required)
  - [ ] Fill in required fields
  - [ ] Submit successfully

- [ ] **Cancel submission**
  - [ ] Click feedback button
  - [ ] Fill in some fields
  - [ ] Click "Отмена" or close modal (X)
  - [ ] Modal closes, no feedback saved

### Feedback Admin Dashboard (/admin/feedback)

- [ ] **Navigate to admin dashboard**
  - [ ] Go to http://localhost:3000/admin/feedback
  - [ ] Page loads (only accessible to admin/owner)

- [ ] **View feedback list**
  - [ ] Table displays submitted feedback
  - [ ] Columns: Category, Subject, Message, User, Status, Created At
  - [ ] Test feedback from previous step visible

- [ ] **Update feedback status**
  - [ ] Click on a feedback item
  - [ ] Status dropdown appears
  - [ ] Change status from "новый" to "в работе"
  - [ ] Status updates in table

- [ ] **Filter feedback**
  - [ ] Filter by category
  - [ ] Filter by status
  - [ ] Search by subject

**⚠️ Note:** Feedback migration 017 is NOT applied yet, so this feature may not work. Expected error: "relation 'feedback' does not exist"

---

## Wave 3 Features: Activity Log Viewer

### Activity Log Page (/activity)

- [ ] **Navigate to activity log**
  - [ ] Go to http://localhost:3000/activity
  - [ ] Page loads without errors
  - [ ] Table displays activity logs

- [ ] **View activity logs**
  - [ ] Columns: Action, Resource Type, Resource ID, Details, User, Timestamp
  - [ ] Logs are sorted by timestamp (newest first)
  - [ ] At least some logs visible (from other actions)

- [ ] **Filter logs**
  - [ ] Filter by action type (CREATE, UPDATE, DELETE, LOGIN, etc.)
  - [ ] Filter by resource type (quotes, customers, users, etc.)
  - [ ] Filter by date range
  - [ ] Apply filters, table updates

- [ ] **Pagination**
  - [ ] If more than 20 logs, pagination appears
  - [ ] Click "Next page"
  - [ ] Next 20 logs load
  - [ ] Click "Previous page"
  - [ ] Previous logs load

- [ ] **CSV Export**
  - [ ] Click "Экспорт CSV" button
  - [ ] CSV file downloads
  - [ ] Open CSV, contains activity log data

**⚠️ Note:** Activity logging is NOT yet integrated into CRUD routes, so logs may be empty. Expected behavior: Very few or no logs.

---

## Wave 3 Features: Dashboard

### Dashboard Stats (Home Page)

- [ ] **Navigate to home page**
  - [ ] Go to http://localhost:3000
  - [ ] Dashboard cards visible

- [ ] **View statistics**
  - [ ] "Клиенты" card shows customer count
  - [ ] "Коммерческие предложения" card shows quote count
  - [ ] "Выручка" card shows revenue (if any quotes exist)
  - [ ] Numbers match actual data

- [ ] **View revenue trends**
  - [ ] "Динамика выручки" chart visible
  - [ ] Chart shows revenue by month
  - [ ] Hover over chart points to see details

- [ ] **Cache behavior**
  - [ ] Note the timestamp on stats
  - [ ] Refresh page (F5)
  - [ ] Stats load instantly from cache (same timestamp)
  - [ ] Wait 5+ minutes
  - [ ] Refresh page
  - [ ] Stats reload from database (new timestamp)

---

## Existing Features: Quote Creation

### Quote Creation Flow (/quotes/create)

- [ ] **Navigate to quote creation**
  - [ ] Go to http://localhost:3000/quotes/create
  - [ ] Page loads without errors
  - [ ] Four cards visible: Product Data, Logistics, Financial, Customer

- [ ] **Create simple quote**
  - [ ] Fill in customer info:
    - Customer name: "Test Customer Ltd"
    - Contact name: "Ivan"
    - Contact last name: "Petrov"
  - [ ] Add one product to grid:
    - Name: "Bearing 6204"
    - Quantity: 10
    - Base price (VAT): 100
  - [ ] Click "Сохранить КП"
  - [ ] Success message appears
  - [ ] Redirected to quote list or detail page

- [ ] **Verify quote saved**
  - [ ] Go to quotes list (if available)
  - [ ] New quote visible with correct data
  - [ ] Or query database directly

- [ ] **Template functionality**
  - [ ] Create quote with some data
  - [ ] Click "Сохранить как шаблон"
  - [ ] Enter template name: "Test Template"
  - [ ] Template saved
  - [ ] Click "Загрузить шаблон"
  - [ ] Select "Test Template"
  - [ ] Form pre-fills with template data

---

## Existing Features: Authentication

### Login Flow

- [ ] **Logout**
  - [ ] Click logout button in header
  - [ ] Redirected to login page

- [ ] **Login**
  - [ ] Enter credentials:
    - Email: andrey@masterbearingsales.ru
    - Password: password
  - [ ] Click "Войти"
  - [ ] Redirected to home page
  - [ ] User menu shows correct email

- [ ] **Invalid credentials**
  - [ ] Logout
  - [ ] Enter wrong password
  - [ ] Click "Войти"
  - [ ] Error message appears
  - [ ] Not logged in

---

## Edge Cases & Error Handling

### Network Errors

- [ ] **Backend offline**
  - [ ] Stop backend: `pkill -f uvicorn`
  - [ ] Try to load dashboard
  - [ ] Graceful error message (not crash)
  - [ ] Try to create quote
  - [ ] Error message appears
  - [ ] Restart backend

### Validation

- [ ] **Quote creation validation**
  - [ ] Try to create quote without customer name
  - [ ] Validation error appears
  - [ ] Try to add product with negative quantity
  - [ ] Validation prevents it

- [ ] **Profile validation**
  - [ ] Edit manager info
  - [ ] Enter invalid email (e.g., "not-an-email")
  - [ ] Validation error appears
  - [ ] Enter invalid phone (e.g., "abc")
  - [ ] Validation error appears

### Permission Checks

- [ ] **Admin-only features**
  - [ ] If logged in as non-admin user:
    - [ ] Feedback admin page (/admin/feedback) should redirect or show error
    - [ ] Settings page (/settings/calculation) should redirect or show error

- [ ] **Organization isolation**
  - [ ] Create quote in one organization
  - [ ] Switch organizations (if multi-org user)
  - [ ] Verify quote not visible in other organization

---

## Performance

### Page Load Times

- [ ] **Home page**
  - [ ] Load time < 2 seconds
  - [ ] No console errors

- [ ] **Quote creation page**
  - [ ] Load time < 2 seconds
  - [ ] ag-Grid renders without lag

- [ ] **Activity log page**
  - [ ] Load time < 2 seconds
  - [ ] Table renders with 100+ logs without lag

### Memory Usage

- [ ] **Browser memory**
  - [ ] Open DevTools > Performance > Memory
  - [ ] Navigate through all pages
  - [ ] Memory usage stays under 200 MB
  - [ ] No memory leaks (memory released after navigation)

---

## Browser Console

### Check for Errors

- [ ] **Open DevTools Console (F12)**
  - [ ] No red errors during normal operations
  - [ ] Warnings acceptable (if not critical)
  - [ ] All API calls return 200/201 status codes

### Network Tab

- [ ] **Check API calls**
  - [ ] All `/api/*` calls to http://localhost:8000
  - [ ] Authorization header present in all requests
  - [ ] No 401 Unauthorized errors
  - [ ] No 500 Internal Server errors

---

## Test Summary

**Date Tested:** _____________
**Tested By:** _____________
**Overall Status:** [ ] ✅ Pass  [ ] ⚠️ Pass with issues  [ ] ❌ Fail

**Issues Found:**

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Notes:**

_______________________________________________
_______________________________________________
_______________________________________________

---

## Known Issues (Expected)

1. **Feedback System:** Migration 017 not applied - feedback table doesn't exist
2. **Activity Logs:** Not integrated into CRUD routes - very few logs visible
3. **Exchange Rates:** Table may be empty on first load - requires manual refresh
4. **Rate Limiting:** Not enforced (Redis not configured)
5. **Concurrent Performance:** Slowdown on concurrent requests (Supabase client blocking)
