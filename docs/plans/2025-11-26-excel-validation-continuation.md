# Excel Validation Test Suite - Continuation Guide

**Purpose:** Resume work on Excel validation tests after context autocompact
**Created:** 2025-11-26
**Status:** In Progress

---

## Current State

### Completed
1. ✅ Created test infrastructure: `backend/tests/validation/`
2. ✅ Created `conftest.py` with `assert_close()` helper (0.1% tolerance)
3. ✅ Created `test_excel_base_case.py` with unit tests
4. ✅ Extracted actual Excel values using openpyxl
5. ✅ Documented Excel→Python cell mapping in `2025-11-26-excel-cell-reference.md`

### Test Results (Current)
| Field | Python | Excel | Status |
|-------|--------|-------|--------|
| S16 (purchase) | 19125.32 | 19125.32 | ✅ EXACT |
| AB16 (COGS) | 20276.40 | 20266.76 | ✅ 0.05% |
| V16 (logistics) | 167.32 | 158.14 | ⚠️ 6% off |
| AJ16 (price_no_vat) | 24572.96 | 25298.32 | ❌ 3% off |

---

## Key Excel Parameters (test_raschet.xlsm)

### Quote-Level Inputs
```python
EXCEL_QUOTE_PARAMS = {
    # Header cells
    "D5": "МАСТЕР БЭРИНГ ООО",   # seller_company
    "D6": "поставка",            # offer_sale_type
    "D7": "DDP",                 # incoterms
    "D8": "USD",                 # quote_currency
    "D9": 60,                    # delivery_days
    "D11": 1.0,                  # advance_to_supplier (100%)
    "J5": 1.0,                   # advance_from_client (100%)

    # Logistics costs (W column)
    "W2": 2000,                  # logistics_supplier_hub
    "W3": 0,                     # logistics_hub_customs
    "W4": 0,                     # logistics_customs_client
    "W5": 0,                     # brokerage_hub
    "W6": 0,                     # brokerage_customs
    "W7": 0,                     # warehousing
    "W8": 0,                     # documentation
    "W9": 0,                     # extra

    # Financial settings
    "AH11": 0.03,               # rate_forex_risk (3%)
    "AG7": 0,                   # dm_fee_value
    "AG3": "Фикс",              # dm_fee_type = fixed

    # Calculated totals (for verification)
    "S13": 256781.17,           # total_purchase
    "T13": 2123.20,             # logistics_first_leg_total (includes insurance)
    "U13": 0,                   # logistics_last_leg_total
    "V11": 2123.20,             # insurance_total (= T13 in this case)
}
```

### Insurance Calculation
The difference between T13 (2123.2) and W2 (2000) is **insurance (123.2)**:
- Formula: `AY13 × rate_insurance`
- AY13 = internal_sale_price_total = sum of all products' internal prices
- rate_insurance = 0.00047 (system config)

---

## Files to Read

1. **Test file:** `backend/tests/validation/test_excel_base_case.py`
2. **Helpers:** `backend/tests/validation/conftest.py`
3. **JSON data:** `validation_data/csv/test_cases_complete.json`
4. **Excel file:** `validation_data/test_raschet.xlsm`
5. **Cell reference:** `docs/plans/2025-11-26-excel-cell-reference.md`

---

## Next Steps

### 1. Fix Logistics Test
Update `build_input_from_json()` in `test_excel_base_case.py`:
```python
logistics=LogisticsParams(
    logistics_supplier_hub=Decimal("2000"),  # From Excel W2
    logistics_hub_customs=Decimal("0"),
    logistics_customs_client=Decimal("0"),
),
```

Note: Logistics includes insurance which is calculated from AY13 × rate_insurance.
The total T13 = W2 + insurance.

### 2. Fix Sales Price Test
Update financial params to include forex risk:
```python
financial=FinancialParams(
    rate_forex_risk=Decimal("3"),  # From Excel AH11 (0.03 = 3%)
    ...
),
```

### 3. Add More Products
Extract expected values for all 93 valid products using:
```python
import openpyxl
wb = openpyxl.load_workbook('validation_data/test_raschet.xlsm', data_only=True)
ws = wb.active
for row in range(16, 112):  # Rows 16-111 have products
    print(f"Row {row}:")
    print(f"  S{row}: {ws[f'S{row}'].value}")
    print(f"  AB{row}: {ws[f'AB{row}'].value}")
    print(f"  AJ{row}: {ws[f'AJ{row}'].value}")
```

### 4. Create API Tests
After unit tests pass, create `test_excel_api.py`:
- Call `POST /api/quotes/calculate` with JSON payload
- Compare response values to Excel expected

### 5. Create Browser Tests
Use Chrome DevTools MCP to:
- Fill quote form with test data
- Submit calculation
- Compare displayed values to Excel expected

---

## How to Run Tests

```bash
cd backend
source venv/bin/activate

# Run all validation tests
pytest tests/validation/ -v

# Run only multiproduct tests (with proper distribution)
pytest tests/validation/test_excel_base_case.py::TestMultiProductDistribution -v

# Run single product tests (Phase 1 only)
pytest tests/validation/test_excel_base_case.py::TestExcelBaseCase::test_purchase_price -v
```

---

## Known Issues

1. **Single-product tests fail for phases 2+** because they don't have proper cost distribution (distribution_base = 1.0 instead of actual share)

2. **Insurance adds to logistics** - T13 = W2 + W3 + insurance, not just W2 + W3

3. **Forex reserve affects sales price** - AH11 = 3% adds to COGS before markup

---

## Quick Commands

```bash
# Read Excel cell
python -c "
import openpyxl
wb = openpyxl.load_workbook('validation_data/test_raschet.xlsm', data_only=True)
print(wb.active['S16'].value)
"

# Run specific test
pytest tests/validation/test_excel_base_case.py::TestMultiProductDistribution::test_first_product_cogs -v

# Debug calculation
python -c "
from tests.validation.test_excel_base_case import load_all_products_from_json, build_input_from_json
from calculation_engine import calculate_multiproduct_quote
products = load_all_products_from_json()[:5]
inputs = [build_input_from_json(p) for p in products]
results = calculate_multiproduct_quote(inputs)
print(results[0])
"
```

---

**Last Updated:** 2025-11-26
