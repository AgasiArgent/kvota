# Manual Testing Guide: Calculation Engine Updates (2025-11-09)

**Feature:** Calculation engine overhaul with 7 formula updates
**Date:** 2025-11-09
**Status:** Ready for manual UI testing
**Automated Tests:** ✅ 38/38 passing (mapper, validation, calculation scenarios)

---

## Prerequisites

**Backend running:**
```bash
cd backend
uvicorn main:app --reload  # Port 8000
```

**Frontend running:**
```bash
cd frontend
npm run dev  # Port 3000
```

**Test user:**
- Email: `andrey@masterbearingsales.ru`
- Password: `password`
- Organization: МАСТЕР БЭРИНГ ООО

---

## Test Sequence

### Test 1: Verify Supplier Countries Dropdown

**Purpose:** Check that supplier_country dropdown loads from database

**Steps:**
1. Navigate to `/quotes/create`
2. Scroll to "📦 Значения по умолчанию для товаров" card
3. Find "Страна закупки" field

**Expected:**
- ✅ Field is a dropdown (Select), not text input
- ✅ Contains 11 countries:
  - Турция
  - Турция (отгрузка на транзитной зоне)
  - Россия
  - Китай
  - Литва
  - Латвия
  - Болгария
  - Польша
  - ЕС (закупка между странами ЕС)
  - ОАЭ
  - Прочие
- ✅ Has search functionality (typing filters options)
- ✅ Default value: "Турция"

**In ag-Grid table:**
1. Add product row
2. Click on supplier_country cell

**Expected:**
- ✅ Dropdown appears with same 11 countries
- ✅ Can select any country

---

### Test 2: Verify New Admin Settings Fields

**Purpose:** Check new admin variables appear in settings page

**Steps:**
1. Navigate to `/settings/calculation`
2. Scroll through form fields

**Expected:**
- ✅ "Годовая процентная ставка" field visible
  - Default: 25.0%
  - Tooltip: "Годовая процентная ставка кредита (автоматически конвертируется в дневную ставку)"
- ✅ "Дневная ставка" display below (read-only)
  - Shows calculated value: 0.00068493 (25% / 365)
  - Formula shown: "годовая ставка ÷ 365"
- ✅ "Срок оплаты таможни и логистики" field visible
  - Default: 10 дней
  - Range: 0-365
  - Tooltip: "Количество дней на оплату таможенных и логистических расходов. Используется в формуле BI10"

**Save test:**
1. Change annual rate to 30%
2. Change customs payment term to 15 days
3. Click "Сохранить настройки"

**Expected:**
- ✅ Success message
- ✅ Daily rate recalculates: 30% / 365 = 0.00082192
- ✅ Values persist after page reload

---

### Test 3: Test New Y16 Formula (with T16)

**Purpose:** Verify customs duty includes first-leg logistics

**Test Case:**
- Страна закупки: Турция
- Базис поставки: DDP
- AY16 (internal price): 100,000 RUB
- T16 (first-leg logistics): 5,000 RUB
- Импортная пошлина: 5%

**Expected Y16:**
```
OLD formula: Y16 = AY16 × 5% = 100,000 × 0.05 = 5,000 RUB
NEW formula: Y16 = (AY16 + T16) × 5% = (100,000 + 5,000) × 0.05 = 5,250 RUB
```

**Steps:**
1. Go to `/quotes/create`
2. Upload product or add manually:
   - Цена закупки: 1,200 TRY (with VAT)
   - Количество: 10
   - Вес: 25 кг
3. Set quote defaults:
   - Валюта КП: RUB
   - Курс: 0.0105 (TRY to RUB)
   - Страна закупки: Турция
   - Базис поставки: DDP
   - Импортная пошлина: 5%
   - Логистика Поставщик-Турция: 1,500 RUB
4. Click "Рассчитать"
5. Check Y16 value in results

**Expected:**
- Y16 should be **higher** than before (includes T16)
- Approximately 43,839 RUB (based on test output)

---

### Test 4: Test New AO16 Formula (with T16)

**Purpose:** Verify deductible VAT includes first-leg logistics

**Test Case:**
- Same as Test 3
- Базис поставки: DDP
- Вид КП: Внутренняя продажа (NOT export)

**Expected AO16:**
```
OLD formula: AO16 = (AY16 + Y16 + Z16) × 20%
NEW formula: AO16 = (AY16 + Y16 + Z16 + T16) × 20%
```

**Steps:**
1. Use same quote from Test 3
2. Verify offer_sale_type = "поставка" (NOT "export")
3. After calculation, check AO16

**Expected:**
- AO16 should be **higher** than before (includes T16)
- With T16 = 2,500, difference ≈ 2,500 × 0.20 = 500 RUB more

---

### Test 5: Test New BH4 Formula (includes Y13, Z13, AO13)

**Purpose:** Verify supplier payment total includes customs duties and VAT

**Expected BH4:**
```
OLD formula: BH4 = (AZ13 + T13) × (1 + rate_fin_comm)
NEW formula: BH4 = (AZ13 + T13) × (1 + rate_fin_comm) + Y13 + Z13 + AO13
```

**Steps:**
1. Use same quote from Test 3
2. After calculation, check quote-level values:
   - BH6 (supplier payment)
   - BH4 (total before forwarding)
   - Y13 (total customs duties)
   - AO13 (total deductible VAT)

**Expected:**
- BH4 should be **significantly higher** than before
- BH4 should include Y13, Z13, AO13 directly added

**Validation:**
```
BH4_old = (AZ13 + T13) × 1.02
BH4_new = BH4_old + Y13 + Z13 + AO13

If Y13 = 43,839 and AO13 = 184,125:
Difference ≈ 227,964 RUB
```

---

### Test 6: Test Simplified BI7 Formula

**Purpose:** Verify supplier financing uses simple interest (not compound)

**Expected BI7:**
```
OLD formula: BI7 = BH7 × (1 + rate)^D9  (compound interest)
NEW formula: BI7 = BH7 × (1 + rate × D9)  (simple interest)
```

**Test Case:**
- BH7 (supplier financing need): 400,000 RUB
- D9 (delivery time): 30 days
- rate_loan_interest_daily: 0.000685 (25% annual)

**Expected:**
```
OLD BI7 = 400,000 × (1.000685)^30 ≈ 408,260 RUB
NEW BI7 = 400,000 × (1 + 0.000685 × 30) = 400,000 × 1.02055 = 408,220 RUB
```

**Steps:**
1. Create quote with 50% advance from client (so BH7 > 0)
2. Set delivery_time = 30 days
3. Calculate
4. Check BI7 value

**Expected:**
- BI7 should be **slightly lower** than old formula (simple < compound for same period)
- Interest cost (BJ7) should be around 2% for 30 days

---

### Test 7: Test New customs_logistics_pmt_due Variable

**Purpose:** Verify BI10 uses new admin variable

**Expected BI10:**
```
OLD formula: BI10 = BH10 × (1 + rate)^(D9 + K9 - K6)
NEW formula: BI10 = BH10 × (1 + rate × customs_logistics_pmt_due)
```

**Steps:**
1. Go to `/settings/calculation`
2. Set customs_logistics_pmt_due = 10 days
3. Save settings
4. Create quote
5. Check BI10 calculation

**Expected:**
- BI10 now uses fixed 10-day term (not variable D9+K9-K6)
- Interest period: exactly 10 days

---

### Test 8: Test Updated Internal Markup (2% vs 10%)

**Purpose:** Verify internal markup percentages changed

**Test Case - Turkey:**
- OLD: Турция → РФ = 10%
- NEW: Турция → РФ = 2%

**Steps:**
1. Create quote:
   - S16 (purchase price): 100,000 RUB
   - supplier_country: Турция
   - seller_company: МАСТЕР БЭРИНГ ООО (RU entity)
2. Calculate
3. Check AY16 (internal sale price total)

**Expected:**
```
OLD AY16 = 100,000 × 1.10 = 110,000 RUB
NEW AY16 = 100,000 × 1.02 = 102,000 RUB
```

**Difference:** 8,000 RUB lower with new markup

**Test Case - Lithuania:**
- OLD: Литва → РФ = 13%
- NEW: Литва → РФ = 4%

**Steps:**
1. Change supplier_country to Литва
2. Calculate
3. Check AY16

**Expected:**
```
OLD AY16 = 100,000 × 1.13 = 113,000 RUB
NEW AY16 = 100,000 × 1.04 = 104,000 RUB
```

**Difference:** 9,000 RUB lower

---

### Test 9: Test VAT Removal Logic

**Purpose:** Verify VAT is correctly removed from purchase price

**Test Cases:**

**9.1 - Turkey (20% VAT):**
- base_price_VAT: 1,200 TRY (includes 20% VAT)
- Expected N16: 1,200 / 1.20 = 1,000 TRY

**9.2 - China (13% VAT):**
- base_price_VAT: 1,130 CNY (includes 13% VAT)
- Expected N16: 1,130 / 1.13 = 1,000 CNY

**9.3 - Lithuania (21% VAT):**
- base_price_VAT: 1,210 EUR (includes 21% VAT)
- Expected N16: 1,210 / 1.21 = 1,000 EUR

**9.4 - EU cross-border (0% VAT):**
- base_price_VAT: 1,000 EUR (0% VAT)
- Expected N16: 1,000 / 1.00 = 1,000 EUR (no change)

**Steps:**
1. Create 4 separate quotes with above scenarios
2. Check N16 value after calculation
3. Verify correct VAT removal

**Expected:**
- ✅ All N16 values = 1,000 (base price without VAT)
- ✅ Different countries use different VAT rates correctly

---

### Test 10: Verify Annual → Daily Rate Conversion

**Purpose:** Check admin enters annual rate, system calculates daily

**Steps:**
1. Go to `/settings/calculation`
2. Enter 25% annual rate
3. Check displayed daily rate

**Expected:**
- Daily rate = 25% / 365 = 0.00068493

**Alternative test:**
1. Enter 36.5% annual rate
2. Check daily rate = 0.001 exactly

**Validation:**
```
Annual %   →  Daily rate (decimal)
25%        →  0.000684931506849315
30%        →  0.000821917808219178
36.5%      →  0.001000000000000000
50%        →  0.001369863013698630
```

---

## Edge Cases

### Edge Case 1: EXW Incoterms

**Scenario:** EXW (buyer arranges logistics)

**Expected:**
- Y16 = 0 (no customs duty)
- AO16 = 0 (no deductible VAT)
- BH4 should NOT include Y13/AO13 (they're zero)

### Edge Case 2: Export Sale Type

**Scenario:** Вид КП = "export"

**Expected:**
- AO16 = 0 (export sales have no deductible VAT)
- AN16 = 0 (export sales have no VAT charged)
- AP16 = 0 (no net VAT)

### Edge Case 3: Turkish Seller

**Scenario:** seller_company = TEXCEL OTOMOTİV (TR entity)

**Expected:**
- internal_markup = 0% for most countries
- internal_markup = 2% for EU countries
- internal_markup = 1% for UAE

### Edge Case 4: Zero Logistics Costs

**Scenario:** logistics_supplier_hub = 0

**Expected:**
- T16 = 0
- Y16 = AY16 × import_tariff (only internal price, no logistics)
- AO16 = (AY16 + Y16 + Z16 + 0) × rate_vat_ru

---

## Validation Checklist

After running all tests above, verify:

- [ ] **supplier_country dropdown** loads 11 countries from database
- [ ] **Admin settings** show 2 new fields (annual rate, customs payment term)
- [ ] **Y16 values** are higher than before (includes T16)
- [ ] **AO16 values** are higher than before (includes T16)
- [ ] **BH4 values** are significantly higher (includes Y13+Z13+AO13)
- [ ] **BI7/BI10** use simple interest (slightly lower than compound)
- [ ] **Internal markup** percentages are 2-4% (not 10-13%)
- [ ] **VAT removal** works for all supplier countries
- [ ] **Annual → Daily rate** conversion accurate
- [ ] **No calculation errors** (all quotes calculate successfully)

---

## Common Issues & Solutions

### Issue 1: supplier_country dropdown empty

**Symptom:** Dropdown shows "Выберите страну" but no options

**Cause:** supplier_countries table not populated or API endpoint not working

**Debug:**
```bash
# Check table
psql $DATABASE_URL -c "SELECT COUNT(*) FROM supplier_countries;"

# Test API
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/supplier-countries
```

**Solution:**
- Re-run migration 025
- Restart backend server

---

### Issue 2: Admin settings not saving

**Symptom:** Changes to annual rate or customs payment term don't persist

**Cause:** calculation_settings table missing new columns

**Debug:**
```bash
psql $DATABASE_URL -c "SELECT rate_loan_interest_annual, customs_logistics_pmt_due FROM calculation_settings LIMIT 1;"
```

**Solution:**
- Re-run migration 025 column additions
- Check for ALTER TABLE errors

---

### Issue 3: Calculations produce different results

**Symptom:** Numbers don't match expected values from tests

**Cause:** Formula changes affect all downstream calculations

**Debug:**
1. Check Y16 first - should include T16
2. Check AO16 - should include T16
3. Check BH4 - should include Y13+Z13+AO13
4. Check BI7 - should use simple interest (lower than compound)

**Solution:**
- Compare with test_suite_10_cases.py outputs
- Run: `python test_calculations.py` for detailed comparison table

---

### Issue 4: Tests show "offer_incoterms not found"

**Symptom:** AttributeError about company.offer_incoterms

**Cause:** offer_incoterms is in logistics, not company

**Status:** ✅ FIXED in commit 84a16b5

---

## Success Criteria

All tests above should pass. Key indicators:

1. **UI works** - No errors, dropdowns populate, forms save
2. **Calculations run** - No exceptions, all 13 phases execute
3. **Values reasonable** - Prices in expected range, no negative values
4. **Formulas updated** - Y16, AO16, BH4, BI7, BI10 reflect new logic

---

## Test Results Log

**Tester:** _______________
**Date:** _______________

| Test # | Test Name | Result | Notes |
|--------|-----------|--------|-------|
| 1 | Supplier countries dropdown | ☐ Pass ☐ Fail | |
| 2 | New admin settings fields | ☐ Pass ☐ Fail | |
| 3 | Y16 formula with T16 | ☐ Pass ☐ Fail | |
| 4 | AO16 formula with T16 | ☐ Pass ☐ Fail | |
| 5 | BH4 formula with duties | ☐ Pass ☐ Fail | |
| 6 | BI7 simple interest | ☐ Pass ☐ Fail | |
| 7 | customs_logistics_pmt_due | ☐ Pass ☐ Fail | |
| 8 | Internal markup 2-4% | ☐ Pass ☐ Fail | |
| 9 | VAT removal logic | ☐ Pass ☐ Fail | |
| 10 | Annual→Daily conversion | ☐ Pass ☐ Fail | |

**Overall Result:** ☐ All Pass ☐ Some Failed

**Issues Found:**
```
(List any issues encountered during testing)
```

---

**Created:** 2025-11-09
**Automated Tests Status:** ✅ 38/38 passing
**Ready for:** Manual UI verification
