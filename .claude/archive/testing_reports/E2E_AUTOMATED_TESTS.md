# E2E Automated Tests - Session 26

**Date:** 2025-10-26
**Session:** 26 - Pre-deployment Infrastructure (Waves 1-6)
**Tool:** Chrome DevTools MCP
**Purpose:** Automated browser testing of new features before deployment

---

## Test Environment

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000
- **Browser:** Chrome with remote debugging (port 9222)
- **Test User:** andrey@masterbearingsales.ru / password
- **Organization:** МАСТЕР БЭРИНГ ООО

---

## Test Suite Overview

| Category | Tests | Status |
|----------|-------|--------|
| Authentication | 2 | ⏳ Pending |
| User Profile (Wave 1-2) | 3 | ⏳ Pending |
| Exchange Rates (Wave 1-2) | 2 | ⏳ Pending |
| Feedback System (Wave 1-2) | 2 | ⏳ Pending |
| Activity Log (Wave 3) | 2 | ⏳ Pending |
| Dashboard (Wave 3) | 2 | ⏳ Pending |
| Quote Creation (Existing) | 3 | ⏳ Pending |
| Edge Cases | 3 | ⏳ Pending |
| **Total** | **19** | **0/19** |

---

## Test Scenarios

### 1. Authentication Flow

#### Test 1.1: Successful Login
**Description:** Verify user can log in with valid credentials

**Steps:**
1. Navigate to http://localhost:3000
2. Check if already logged in (user menu visible)
3. If logged in, logout first
4. Enter email: andrey@masterbearingsales.ru
5. Enter password: password
6. Click login button
7. Wait for redirect to home page

**Expected:**
- Login successful
- Redirected to home page
- User menu shows correct email
- No console errors

**Automated Test:**
```javascript
// Navigate to home
await page.goto('http://localhost:3000');

// Check if login form visible
const loginForm = await page.$('form'); // Adjust selector

// Fill in credentials
await page.type('input[type="email"]', 'andrey@masterbearingsales.ru');
await page.type('input[type="password"]', 'password');

// Click login
await page.click('button[type="submit"]');

// Wait for navigation
await page.waitForNavigation();

// Verify logged in
const userMenu = await page.$('.user-menu'); // Adjust selector
assert(userMenu !== null, 'User menu should be visible after login');
```

**Result:** ⏳ Pending

---

#### Test 1.2: Invalid Login
**Description:** Verify error message on invalid credentials

**Steps:**
1. Logout if logged in
2. Enter email: andrey@masterbearingsales.ru
3. Enter wrong password: wrongpassword
4. Click login button

**Expected:**
- Error message appears
- Not logged in
- Form still visible

**Result:** ⏳ Pending

---

### 2. User Profile Management (Wave 1-2)

#### Test 2.1: View Profile
**Description:** Verify profile page loads and displays user info

**Steps:**
1. Login as test user
2. Navigate to http://localhost:3000/profile
3. Check page loads
4. Verify two cards visible

**Expected:**
- Page loads without errors
- Email displayed correctly
- Role displayed (admin/owner)
- Organization name shown

**Automated Test:**
```javascript
await page.goto('http://localhost:3000/profile');

// Check cards exist
const profileCard = await page.$('text=Профиль пользователя');
const managerCard = await page.$('text=Информация для КП');

assert(profileCard !== null, 'Profile card should be visible');
assert(managerCard !== null, 'Manager info card should be visible');

// Check console for errors
const errors = await page.evaluate(() => {
  return console.errors || [];
});
assert(errors.length === 0, 'No console errors');
```

**Result:** ⏳ Pending

---

#### Test 2.2: Edit Manager Info
**Description:** Verify manager info can be edited and saved

**Steps:**
1. Navigate to /profile
2. Click "Редактировать" button
3. Fill in manager info:
   - Name: "Тестовый Менеджер"
   - Position: "Менеджер по продажам"
   - Phone: "+7 (495) 123-45-67"
   - Email: "test@example.com"
4. Click "Сохранить"
5. Wait for success message

**Expected:**
- Form appears on click
- Values save successfully
- Success message appears
- Card updates with new data
- Form closes

**Automated Test:**
```javascript
await page.goto('http://localhost:3000/profile');

// Click edit button
await page.click('button:has-text("Редактировать")');

// Wait for form
await page.waitForSelector('input[name="manager_name"]');

// Fill in form
await page.fill('input[name="manager_name"]', 'Тестовый Менеджер');
await page.fill('input[name="manager_position"]', 'Менеджер по продажам');
await page.fill('input[name="manager_phone"]', '+7 (495) 123-45-67');
await page.fill('input[name="manager_email"]', 'test@example.com');

// Save
await page.click('button:has-text("Сохранить")');

// Wait for success message
await page.waitForSelector('.ant-message-success', { timeout: 5000 });

// Verify card updated
const cardText = await page.textContent('.manager-info-card'); // Adjust selector
assert(cardText.includes('Тестовый Менеджер'), 'Manager name should be updated');
```

**Result:** ⏳ Pending

---

#### Test 2.3: Cancel Manager Info Edit
**Description:** Verify canceling edit doesn't save changes

**Steps:**
1. Navigate to /profile
2. Click "Редактировать"
3. Change some values
4. Click "Отмена"

**Expected:**
- Form closes
- No changes saved
- Card shows original data

**Result:** ⏳ Pending

---

### 3. Exchange Rates (Wave 1-2)

#### Test 3.1: View Exchange Rates
**Description:** Verify exchange rates load on home page

**Steps:**
1. Navigate to http://localhost:3000
2. Check exchange rates card visible
3. Verify USD, EUR, CNY rates displayed

**Expected:**
- Card with title "Курсы валют ЦБ РФ"
- Three rates displayed (or loading state)
- Timestamp shown

**Automated Test:**
```javascript
await page.goto('http://localhost:3000');

// Check exchange rates card
const ratesCard = await page.$('text=Курсы валют ЦБ РФ');
assert(ratesCard !== null, 'Exchange rates card should be visible');

// Check for rates or loading state
const usdRate = await page.textContent('text=USD'); // Adjust selector
const eurRate = await page.textContent('text=EUR');
const cnyRate = await page.textContent('text=CNY');

assert(usdRate !== null, 'USD rate should be displayed');
assert(eurRate !== null, 'EUR rate should be displayed');
assert(cnyRate !== null, 'CNY rate should be displayed');
```

**Result:** ⏳ Pending

---

#### Test 3.2: Manual Refresh
**Description:** Verify manual refresh button works

**Steps:**
1. Navigate to home page
2. Note current timestamp
3. Click "Обновить" button
4. Wait for refresh to complete

**Expected:**
- Loading spinner appears
- Rates update
- Timestamp changes
- Success message appears

**Automated Test:**
```javascript
await page.goto('http://localhost:3000');

// Get initial timestamp
const initialTimestamp = await page.textContent('.rates-timestamp'); // Adjust selector

// Click refresh
await page.click('button:has-text("Обновить")');

// Wait for loading to complete
await page.waitForSelector('.ant-spin', { state: 'hidden', timeout: 10000 });

// Get new timestamp
const newTimestamp = await page.textContent('.rates-timestamp');

// Verify timestamp changed (or stayed same if cache hit)
console.log(`Initial: ${initialTimestamp}, New: ${newTimestamp}`);
```

**Result:** ⏳ Pending

---

### 4. Feedback System (Wave 1-2)

#### Test 4.1: Submit Feedback
**Description:** Verify feedback can be submitted

**Steps:**
1. Navigate to any page
2. Click floating feedback button
3. Fill in form:
   - Category: "Предложение"
   - Subject: "Test Feedback"
   - Message: "This is a test feedback message"
4. Click "Отправить"

**Expected:**
- Modal opens on button click
- Form validates required fields
- Submission succeeds
- Success message appears
- Modal closes

**Automated Test:**
```javascript
await page.goto('http://localhost:3000');

// Click feedback button
await page.click('.feedback-button'); // Adjust selector

// Wait for modal
await page.waitForSelector('.ant-modal', { state: 'visible' });

// Fill in form
await page.selectOption('select[name="category"]', 'Предложение');
await page.fill('input[name="subject"]', 'Test Feedback');
await page.fill('textarea[name="message"]', 'This is a test feedback message');

// Submit
await page.click('button:has-text("Отправить")');

// Wait for success message
await page.waitForSelector('.ant-message-success', { timeout: 5000 });

// Modal should close
await page.waitForSelector('.ant-modal', { state: 'hidden' });
```

**Result:** ⏳ Pending (Expected to fail - migration 017 not applied)

---

#### Test 4.2: Feedback Validation
**Description:** Verify form validation works

**Steps:**
1. Click feedback button
2. Leave all fields empty
3. Click "Отправить"

**Expected:**
- Validation errors appear
- Form not submitted
- Modal stays open

**Result:** ⏳ Pending

---

### 5. Activity Log (Wave 3)

#### Test 5.1: View Activity Logs
**Description:** Verify activity log page loads

**Steps:**
1. Navigate to http://localhost:3000/activity
2. Check table loads
3. Verify columns displayed

**Expected:**
- Page loads without errors
- Table with columns: Action, Resource Type, Resource ID, Details, User, Timestamp
- Pagination if more than 20 logs

**Automated Test:**
```javascript
await page.goto('http://localhost:3000/activity');

// Check table exists
const table = await page.$('.ant-table'); // Adjust selector
assert(table !== null, 'Activity log table should be visible');

// Check columns
const columns = await page.$$('.ant-table-thead th');
assert(columns.length >= 5, 'Should have at least 5 columns');
```

**Result:** ⏳ Pending (Expected to show few/no logs - not integrated)

---

#### Test 5.2: Export Activity Logs
**Description:** Verify CSV export works

**Steps:**
1. Navigate to /activity
2. Click "Экспорт CSV" button
3. Wait for download

**Expected:**
- CSV file downloads
- Contains activity log data

**Result:** ⏳ Pending

---

### 6. Dashboard (Wave 3)

#### Test 6.1: View Dashboard Stats
**Description:** Verify dashboard statistics display

**Steps:**
1. Navigate to http://localhost:3000
2. Check stats cards visible
3. Verify data displayed

**Expected:**
- Three stat cards: Клиенты, Коммерческие предложения, Выручка
- Numbers displayed correctly
- No loading state stuck

**Automated Test:**
```javascript
await page.goto('http://localhost:3000');

// Wait for stats to load
await page.waitForSelector('.stat-card', { timeout: 10000 }); // Adjust selector

// Check all three stat cards
const statCards = await page.$$('.stat-card');
assert(statCards.length >= 3, 'Should have at least 3 stat cards');

// Check for numbers (not "0" or "Загрузка...")
const customerCount = await page.textContent('.customer-count'); // Adjust selector
console.log(`Customer count: ${customerCount}`);
```

**Result:** ⏳ Pending

---

#### Test 6.2: Revenue Trends Chart
**Description:** Verify revenue chart displays

**Steps:**
1. Navigate to home page
2. Scroll to revenue trends section
3. Check chart visible

**Expected:**
- Chart component rendered
- Shows revenue by month
- No errors

**Result:** ⏳ Pending

---

### 7. Quote Creation (Existing Feature)

#### Test 7.1: Load Quote Creation Page
**Description:** Verify quote creation page loads correctly

**Steps:**
1. Navigate to http://localhost:3000/quotes/create
2. Check all cards load
3. Verify ag-Grid initializes

**Expected:**
- Four cards visible: Product Data, Logistics, Financial, Customer
- ag-Grid visible and interactive
- No console errors

**Automated Test:**
```javascript
await page.goto('http://localhost:3000/quotes/create');

// Wait for all cards to load
await page.waitForSelector('.ant-card', { timeout: 10000 });

// Check for four cards
const cards = await page.$$('.ant-card');
assert(cards.length >= 4, 'Should have at least 4 cards');

// Check ag-Grid loaded
const grid = await page.$('.ag-root'); // ag-Grid root element
assert(grid !== null, 'ag-Grid should be initialized');

// Check console for errors
const errors = await page.evaluate(() => console.errors || []);
assert(errors.length === 0, 'No console errors on quote creation page');
```

**Result:** ⏳ Pending

---

#### Test 7.2: Add Product to Quote
**Description:** Verify products can be added to quote

**Steps:**
1. Navigate to /quotes/create
2. Click "Добавить продукт" or add row in grid
3. Enter product data:
   - Name: "Test Product"
   - Quantity: 5
   - Base Price VAT: 100
4. Save quote

**Expected:**
- Row appears in grid
- Data saved correctly
- Calculations work (if connected)

**Result:** ⏳ Pending

---

#### Test 7.3: Save Quote
**Description:** Verify quote can be saved

**Steps:**
1. Create quote with customer + product data
2. Click "Сохранить КП"
3. Wait for response

**Expected:**
- Success message appears
- Quote saved to database
- Redirects to quote list or detail

**Result:** ⏳ Pending

---

### 8. Edge Cases

#### Test 8.1: Backend Offline
**Description:** Verify graceful error handling when backend is down

**Steps:**
1. Stop backend server
2. Try to load dashboard
3. Try to create quote

**Expected:**
- Graceful error messages
- UI doesn't crash
- Retry possible after backend restarts

**Result:** ⏳ Pending

---

#### Test 8.2: Invalid Form Data
**Description:** Verify validation prevents invalid data

**Steps:**
1. Try to create quote without customer name
2. Try to add product with negative quantity
3. Try to submit profile with invalid email

**Expected:**
- Validation errors appear
- Submission blocked
- User-friendly error messages

**Result:** ⏳ Pending

---

#### Test 8.3: Concurrent Operations
**Description:** Verify system handles concurrent requests

**Steps:**
1. Open multiple tabs
2. Perform operations simultaneously in each tab
3. Check for conflicts or errors

**Expected:**
- Operations succeed independently
- No race conditions
- Data consistency maintained

**Result:** ⏳ Pending

---

## Console Error Monitoring

### Critical Errors (Should be 0)

**Test:** Monitor console during all test scenarios

**Expected:**
- No "Uncaught" errors
- No 500 Internal Server errors
- No React hydration errors

**Actual:** ⏳ Pending

---

### Warnings (Acceptable)

**Test:** Check for warnings during operations

**Expected:**
- Some warnings acceptable (deprecation notices, etc.)
- No performance warnings (e.g., excessive re-renders)

**Actual:** ⏳ Pending

---

## Network Monitoring

### API Call Analysis

**Test:** Monitor all API calls during test scenarios

**Expected:**
- All calls to http://localhost:8000/api/*
- Authorization header present in all requests
- Response times < 1 second (except first load)
- No 401 Unauthorized errors
- No 500 Internal Server errors

**Actual:** ⏳ Pending

---

## Performance Metrics

### Page Load Times

| Page | Target | Actual | Status |
|------|--------|--------|--------|
| Home (/) | < 2s | ⏳ | Pending |
| Profile (/profile) | < 2s | ⏳ | Pending |
| Activity (/activity) | < 2s | ⏳ | Pending |
| Quote Create (/quotes/create) | < 3s | ⏳ | Pending |
| Admin Feedback (/admin/feedback) | < 2s | ⏳ | Pending |

---

## Test Execution Plan

### Phase 1: Critical Path (Priority)
1. Authentication (Tests 1.1, 1.2)
2. Quote Creation (Tests 7.1, 7.3)
3. Profile Management (Tests 2.1, 2.2)

### Phase 2: New Features (Wave 1-3)
1. Exchange Rates (Tests 3.1, 3.2)
2. Dashboard (Tests 6.1, 6.2)
3. Activity Log (Tests 5.1, 5.2)

### Phase 3: Feedback System (Expected Failures)
1. Feedback Submit (Test 4.1) - Migration 017 not applied
2. Feedback Admin (Test 4.2)

### Phase 4: Edge Cases
1. Backend Offline (Test 8.1)
2. Invalid Data (Test 8.2)
3. Concurrent Operations (Test 8.3)

---

## Test Results Summary

**Execution Date:** _____________
**Total Tests:** 19
**Passed:** ⏳ 0
**Failed:** ⏳ 0
**Skipped:** ⏳ 0

**Critical Issues Found:**

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Known Issues (Expected):**

1. ✅ Feedback system - Migration 017 not applied (tests 4.1, 4.2 will fail)
2. ✅ Activity logs - Not integrated into CRUD routes (test 5.1 shows few/no logs)
3. ✅ Exchange rates - Table may be empty (test 3.1 may show loading/empty state)

---

## Next Steps

1. **Run Phase 1 tests** - Critical path verification
2. **Fix any blocking issues** - Before proceeding to Phase 2
3. **Run Phase 2 tests** - New features verification
4. **Document failures** - Update TECHNICAL_DEBT.md
5. **Create GitHub issues** - For critical bugs found
6. **Re-test after fixes** - Regression testing

---

## Automation Notes

**Chrome DevTools MCP Usage:**
- Connect to Chrome: `DISPLAY=:0 google-chrome --remote-debugging-port=9222`
- Use MCP tools: `mcp__chrome-devtools__*`
- Take screenshots for visual verification
- Monitor console via `mcp__chrome-devtools__list_console_messages`
- Check network via `mcp__chrome-devtools__list_network_requests`

**Resource Management:**
- Use headless mode when possible (`./.claude/launch-chrome-testing.sh headless`)
- Monitor memory (`./.claude/monitor-wsl-resources.sh`)
- Kill Chrome after tests (`./.claude/launch-chrome-testing.sh kill`)
- Prevent WSL2 freezing by staying under 75% memory usage
