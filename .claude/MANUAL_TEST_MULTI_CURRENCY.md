# Manual Testing Sequence: Multi-Currency Input Feature

**Created:** 2025-11-25
**Feature:** Multi-currency input for logistics and brokerage fields
**Tester:** Claude Code via Chrome DevTools MCP

---

## Pre-requisites

- [ ] Backend running on :8000
- [ ] Frontend running on :3000
- [ ] Chrome connected via DevTools MCP (port 9222)
- [ ] Test user logged in

---

## Test 1: Navigate to Quote Creation Page

**URL:** `http://localhost:3000/quotes/create`

**Steps:**
1. Open Chrome to localhost:3000
2. Click "Создать КП" or navigate directly to /quotes/create
3. Verify page loads with form

**Expected:** Quote creation form displays with all sections

**Status:** [ ] Pass / [ ] Fail

---

## Test 2: Verify MonetaryInput Components Render

**Location:** Quote Creation Page → "🚚 Логистика и таможня" section

**Steps:**
1. Scroll to "🚚 Логистика и таможня" section
2. Verify "Детально" radio is selected by default
3. Check each logistics field has:
   - Number input (spinbutton)
   - Currency dropdown (combobox) adjacent to it

**Fields to verify:**
- [ ] Поставщик - Хаб (50%) - has currency selector
- [ ] Хаб - Таможня РФ (30%) - has currency selector
- [ ] Таможня РФ - Клиент (20%) - has currency selector

**Expected:** Each field shows `[number input] [currency dropdown]` pattern

**Status:** [ ] Pass / [ ] Fail

---

## Test 3: Verify Default Currency Values

**Expected defaults per field:**

| Field | Default Currency |
|-------|-----------------|
| Поставщик - Хаб (50%) | EUR |
| Хаб - Таможня РФ (30%) | EUR |
| Таможня РФ - Клиент (20%) | RUB |
| Брокеридж Хаб | EUR |
| Брокеридж Таможня | RUB |
| Хранение на таможне | RUB |
| Таможенное оформление | RUB |
| Доп. расходы брокера | RUB |

**Steps:**
1. Click on each currency dropdown
2. Verify the default selected value matches table above

**Status:** [ ] Pass / [ ] Fail

---

## Test 4: Test Currency Switching

**Steps:**
1. Find "Поставщик - Хаб (50%)" field
2. Click the currency dropdown next to the number input
3. Select "USD" from the list
4. Verify dropdown now shows "USD"
5. Enter value "1500" in the number input
6. Click somewhere else to blur
7. Verify value "1500" and "USD" both persist

**Repeat for:**
- [ ] EUR → USD switch
- [ ] EUR → RUB switch
- [ ] EUR → TRY switch
- [ ] EUR → CNY switch

**Expected:** Currency selection persists after change, value stays

**Status:** [ ] Pass / [ ] Fail

---

## Test 5: Test Logistics Total Mode Auto-Distribution

**Steps:**
1. Find "Логистика" section with radio buttons
2. Click "Итого" radio button
3. Verify detail fields become disabled/hidden
4. Find the total logistics input field
5. Enter value "3000" with currency "EUR"
6. Click somewhere else or switch to "Детально"
7. Verify values distributed:
   - Поставщик - Хаб: 1500 EUR (50%)
   - Хаб - Таможня РФ: 900 EUR (30%)
   - Таможня РФ - Клиент: 600 EUR (20%)

**Expected:** Total distributes proportionally, currency propagates to all fields

**Status:** [ ] Pass / [ ] Fail

---

## Test 6: Test Brokerage Fields (Expanded Section)

**Steps:**
1. Find "▶ Показать брокеридж" button
2. Click to expand brokerage section
3. Verify all brokerage fields appear with MonetaryInput:
   - [ ] Брокеридж Хаб - has currency selector
   - [ ] Брокеридж Таможня - has currency selector
   - [ ] Хранение на таможне - has currency selector
   - [ ] Таможенное оформление - has currency selector
   - [ ] Доп. расходы брокера - has currency selector

**Steps continued:**
4. Enter values in each field with different currencies:
   - Брокеридж Хаб: 200 EUR
   - Брокеридж Таможня: 15000 RUB
   - Хранение на таможне: 10000 RUB
5. Verify all values and currencies persist

**Expected:** All brokerage fields have MonetaryInput, values persist

**Status:** [ ] Pass / [ ] Fail

---

## Test 7: Full Quote Calculation with Multi-Currency

**Prerequisites:**
- Customer selected
- Product file uploaded
- Multi-currency logistics/brokerage values entered

**Steps:**
1. Select customer from dropdown (e.g., "Andrey Novikov")
2. Upload a test product file (Excel/CSV)
3. Enter logistics values:
   - Поставщик - Хаб: 1500 EUR
   - Хаб - Таможня РФ: 800 EUR
   - Таможня РФ - Клиент: 25000 RUB
4. Expand brokerage and enter:
   - Брокеридж Хаб: 200 EUR
   - Брокеридж Таможня: 15000 RUB
5. Click "Рассчитать котировку" button
6. Open browser console (F12 → Console tab)
7. Check for errors

**Expected:**
- No JavaScript errors in console
- No network errors (4xx/5xx responses)
- Calculation completes successfully
- Results display (or redirect to quote view)

**Status:** [ ] Pass / [ ] Fail

---

## Test 8: Console Error Check

**Steps:**
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Filter by "Error" or "Warning"
4. Perform all above tests
5. Note any errors related to:
   - MonetaryInput component
   - Currency conversion
   - Form validation
   - API calls

**Expected:** No errors related to multi-currency feature

**Errors found:**
```
(list any errors here)
```

**Status:** [ ] Pass / [ ] Fail

---

## Test 9: Network Request Verification

**Steps:**
1. Open Chrome DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Click "Рассчитать котировку"
4. Find the calculation API request
5. Click on it and check:
   - Request payload includes monetary fields with currency
   - Response is 200 OK
   - Response body has calculation results

**Expected request payload structure:**
```json
{
  "quote_defaults": {
    "logistics_supplier_hub": {"value": 1500, "currency": "EUR"},
    "logistics_hub_customs": {"value": 800, "currency": "EUR"},
    "logistics_customs_client": {"value": 25000, "currency": "RUB"},
    ...
  },
  "products": [...]
}
```

**Status:** [ ] Pass / [ ] Fail

---

## Summary

| Test | Description | Status |
|------|-------------|--------|
| 1 | Navigate to quote creation | [ ] |
| 2 | MonetaryInput components render | [ ] |
| 3 | Default currency values | [ ] |
| 4 | Currency switching | [ ] |
| 5 | Logistics total auto-distribution | [ ] |
| 6 | Brokerage fields | [ ] |
| 7 | Full quote calculation | [ ] |
| 8 | Console error check | [ ] |
| 9 | Network request verification | [ ] |

**Overall Result:** [ ] Pass / [ ] Fail

**Notes:**
```
(Add any observations, issues, or follow-up items here)
```

---

## Troubleshooting

### MonetaryInput not showing currency dropdown
- Check if component is imported correctly in page.tsx
- Verify Form.Item name matches expected field

### Currency not persisting after selection
- Check onChange handler in MonetaryInput
- Verify form state management

### Calculation fails with multi-currency values
- Check backend logs for conversion errors
- Verify MultiCurrencyService is working
- Check if exchange rates are available

### Console shows "No exchange rate available"
- Run: `GET /api/exchange-rates/refresh` to fetch CBR rates
- Check organization_exchange_rates table
