# TASK-002 Context

**Last Updated:** 2025-12-13 (Session 73)
**Current Phase:** Phase 4 - Validation Export Currency Conversion

---

## Key Discovery: USD Implementation Already Exists!

**IMPORTANT:** After thorough code analysis, found that `quotes_calc.py` (the main quote creation flow) **already calculates in USD**.

### Current Implementation Status

| Component | Status | Details |
|-----------|--------|---------|
| **calculation_engine.py** | ✅ Currency-agnostic | Just does math with whatever rate you give it |
| **quotes_calc.py** | ✅ USD-based | Line 436: `currency_of_quote=Currency("USD")` |
| **quotes_upload.py** | ✅ USD-based | Fixed to match quotes_calc.py approach |
| **export_validation_service.py** | ✅ Excel formulas | USD→quote conversion via `=C*$E$2` formulas |

### quotes_calc.py (Manual UI Creation) - CORRECT
- Line 436: `currency_of_quote=Currency("USD")` - calculates in USD
- Lines 477-479, 512-516: Costs converted to USD
- Lines 1539-1560: Display values converted to quote currency
- Lines 1562-1567: Stores both `phase_results` (USD) and `phase_results_quote_currency`

### quotes_upload.py (File Upload) - NEEDS FIX
- Line 290: `currency_of_quote=quote_currency` - calculates in QUOTE currency
- Lines 305-391: Costs converted to quote currency
- Lines 803-819: Converts results to USD AFTER calculation (wrong approach)

---

## Current State

### Completed
- [x] Planning and approach agreed
- [x] Dev-docs created
- [x] Discovered calculation_engine.py is currency-agnostic (no changes needed!)
- [x] Deleted unnecessary calculation_engine_usd.py copy
- [x] Verified quotes_calc.py already implements USD calculation correctly
- [x] Identified inconsistency in quotes_upload.py
- [x] Fixed quotes_upload.py to match quotes_calc.py approach
- [x] Python syntax validation passed
- [x] Updated export_validation_service.py for USD→quote currency conversion
  - Added exchange rate cell (E2) for formulas
  - Added column D with `=C*$E$2` for monetary fields
  - Updated _modify_raschet_references to use column D

### In Progress
- [ ] Run full validation tests (pytest + manual E2E)

### Next Steps
1. ~~Update quotes_upload.py~~ ✅ DONE
2. ~~Update export_validation_service.py~~ ✅ DONE
3. Run full validation tests (pytest + manual E2E)
4. Update SESSION_PROGRESS.md

---

## Changes Made to quotes_upload.py

| Line(s) | Change |
|---------|--------|
| 262-264 | Renamed `quote_currency` → `client_quote_currency` (clarity) |
| 270-274 | Exchange rate now converts to "USD" (was quote_currency) |
| 293 | `currency_of_quote=CalcCurrency.USD` (was quote_currency) |
| 307-322 | Logistics costs converted to USD |
| 369-395 | Brokerage costs converted to USD |
| 807-845 | Simplified USD storage (no more quote→USD conversion) |
| 856-869 | Added `exchange_rate_base_price_to_usd` to custom_fields |
| 893-922 | Added `phase_results_quote_currency` for display values |

---

## Changes Made to export_validation_service.py

### API_Inputs Sheet Changes
| Line(s) | Change |
|---------|--------|
| 110-121 | Added `MONETARY_INPUT_FIELDS` set for fields needing conversion |
| 337 | Extended header merge to include column D |
| 339-354 | Added exchange rate info row (E2 = rate cell for formulas) |
| 368-369 | Changed column headers: "Value (USD)" and "Value ({currency})" |
| 385-393 | Added column D with Excel formulas for currency conversion |

### API_Results Sheet Changes
| Line(s) | Change |
|---------|--------|
| 541-545 | API values in column C (USD), column D = `=C*$G$2` (quote currency) |
| 544 | Compare D (converted API) vs E (Excel values) |

### _modify_raschet_references Changes
| Line(s) | Change |
|---------|--------|
| 506-509 | Row start adjusted from 5 to 6 (new header layout) |
| 507-509 | Reference column D (converted) instead of column C (USD) |
| 520-521 | dm_fee reference uses column D |

### Currency Conversion Logic

**API_Inputs sheet structure:**
```
Row 1: Header
Row 2: Exchange rate info + E2 (rate cell)
Row 4: "Quote Settings" section header
Row 5: Column headers (Cell | Field | Value USD | Value {currency})
Row 6+: Data with formulas in column D
```

**Monetary fields get formula:** `=C{row}*$E$2`
**Non-monetary fields get passthrough:** `=C{row}`

**расчет sheet references:** Column D (converted values)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Option A - Calculate in USD | Single source of truth, no double conversion |
| Implementation | Parallel file | Safe - don't modify production until validated |
| Display values | 4 values only | Minimal conversion: price, total, profit, profit/unit |

---

## Code Inventory

### Files Created
- `backend/calculation_engine_usd.py` - USD-based calculation engine (copy of original with updated docstring)
- `backend/tests/calculation/test_engine_comparison.py` - Validation tests comparing both engines

### Files Modified
- (none yet - original engine untouched until validation complete)

---

## Technical Notes

### Exchange Rate Direction Change

**Current (calculation_engine.py):**
```python
# Phase 1, line ~210
exchange_rate = exchange_rate_base_price_to_quote  # e.g., EUR→RUB rate
R16 = P16 * exchange_rate  # Result in quote currency
```

**New (calculation_engine_usd.py):**
```python
# Phase 1
exchange_rate = exchange_rate_base_price_to_usd  # e.g., EUR→USD rate
R16 = P16 * exchange_rate  # Result in USD
```

### Variable Renames
- `purchase_price_per_unit_quote_currency` → `purchase_price_per_unit_usd`
- `purchase_price_total_quote_currency` → `purchase_price_total_usd`
- Other variables keep same names (they're just in USD now)

---

## Blockers

None currently.

---

## Session Log

### 2025-12-13 (Session 73)
- Updated export_validation_service.py for Excel formula-based currency conversion
- API_Inputs sheet now has column D with `=C*$E$2` formulas for monetary fields
- API_Results sheet now has column D with `=C*$G$2` formulas for converted comparison
- расчет sheet references column D (converted) instead of column C (raw USD)

### 2025-12-13 (Session 72)
- Fixed quotes_upload.py to match quotes_calc.py USD approach
- All 8 monetary cost fields now converted to USD before calculation
- Added `phase_results_quote_currency` for display values

### 2025-12-13 (Session 71)
- Created plan for USD-based calculation engine
- Agreed on parallel implementation approach
- Created dev-docs structure
