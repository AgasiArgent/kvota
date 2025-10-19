# B2B Quotation Calculator - 10 Test Cases for Manual Excel Validation

## Overview
This document provides instructions for running 10 comprehensive test cases and comparing results with Excel.

## Quick Start

```bash
cd /home/novi/quotation-app/backend
source venv/bin/activate
python test_suite_10_cases.py
```

This will run all 10 tests and print key results for each.

---

## Test Matrix Summary

| Test | sale_type | seller_region | incoterms | advance% | products | dm_fee | Key Feature Tested |
|------|-----------|---------------|-----------|----------|----------|--------|--------------------|
| 1 | поставка | RU | DDP | 50% | 1 | FIXED | ✅ Baseline (current test) |
| 2 | транзит | RU | DDP | 50% | 1 | FIXED | Transit formulas (AF16, AD16, AQ16) |
| 3 | экспорт | RU | DAP | 100% | 1 | FIXED | Export (AI16=0, no VAT) |
| 4 | поставка | TR | DDP | 50% | 1 | FIXED | Turkish seller (AI16=0) |
| 5 | поставка | RU | DAP | 0% | 1 | FIXED | Non-DDP + max financing |
| 6 | поставка | RU | DDP | 100% | 1 | FIXED | Full advance (min financing) |
| 7 | поставка | RU | DDP | 0% | 1 | FIXED | Zero advance (max financing) |
| 8 | поставка | RU | DDP | 50% | 1 | % | Percentage DM fee |
| 9 | поставка | RU | DDP | 50% | 2 | FIXED | 🔴 Distribution logic (BD16) |
| 10 | поставка | RU | DDP | 50% | 3 | FIXED | 🔴 Multi-product distribution |

---

## Test Details

### Test 1: Baseline ✅ (Already Validated)
- **Purpose**: Core calculation path validation
- **Key checks**: All phases, standard SUPPLY flow
- **Status**: This is your current test - should already match Excel

### Test 2: Transit Scenario
- **Purpose**: Validate transit-specific formulas
- **Key checks**:
  - AF16 (Profit) uses S16 instead of AB16
  - AD16 (Sale price excl financial) uses S16 instead of AB16
  - AQ16 (Transit commission) > 0
  - Y16 (Customs fee) uses S16 instead of AY16

### Test 3: Export Scenario
- **Purpose**: Validate export-specific logic
- **Key checks**:
  - AI16 (Financial agent fee) = 0
  - Y16 (Customs fee) = 0 (DAP)
  - AO16 (Import VAT) = 0
  - AM16 = AJ16 (no VAT added)

### Test 4: Turkish Seller
- **Purpose**: Validate seller_region = TR logic
- **Key checks**:
  - AI16 (Financial agent fee) = 0
  - Internal markup (AW16) = 0% (Turkey->TR)
  - rate_vatRu = 0% (not implemented for TR)

### Test 5: Non-DDP (DAP) + Zero Advance
- **Purpose**: Validate non-DDP INCOTERMS and maximum financing
- **Key checks**:
  - Y16 (Customs fee) = 0
  - AO16 (Import VAT) = 0
  - AM16 = AJ16 (no VAT)
  - BH7 (Supplier financing) is HIGH
  - BL3 (Credit sales) = BH2

### Test 6: Full Advance (100%)
- **Purpose**: Validate minimum financing scenario
- **Key checks**:
  - BH3 ≈ BH2 (client pays full upfront)
  - BH7 ≈ 0 (no supplier financing needed)
  - BL3 = 0 (no credit sales)
  - BA16 + BB16 is MINIMAL

### Test 7: Zero Advance (0%)
- **Purpose**: Validate maximum financing scenario
- **Key checks**:
  - BH3 = 0 (no client advance)
  - BH7 = BH6 (full supplier financing)
  - BL3 = BH2 (full credit sales)
  - BA16 + BB16 is MAXIMUM

### Test 8: Percentage DM Fee
- **Purpose**: Validate percentage-based DM fee calculation
- **Key checks**:
  - AG16 = 2% of AB16 (not fixed 1000)
  - Compare with Test 1 to see difference

### Test 9: Two Products 🔴 CRITICAL
- **Purpose**: Validate distribution logic (BD16 ≠ 1.0)
- **Setup**:
  - Product 1: $1200, qty 10 (same as Test 1)
  - Product 2: $2500, qty 5
- **Key checks**:
  - S13 = S16(prod1) + S16(prod2)
  - BD16(prod1) = S16(prod1) / S13
  - BD16(prod2) = S16(prod2) / S13
  - BA16, BB16, T16, U16 distributed proportionally
  - Quote-level BH*, BJ*, BL* calculated ONCE
- **⚠️ Note**: Requires multi-product Excel sheet

### Test 10: Three Products 🔴
- **Purpose**: Validate distribution with 3 products
- **Setup**:
  - Product 1: $800, qty 20
  - Product 2: $1200, qty 10
  - Product 3: $2500, qty 5
- **Key checks**: Same as Test 9, but with 3 distribution bases
- **⚠️ Note**: Requires multi-product Excel sheet

---

## Running Individual Tests

```python
# In Python REPL or Jupyter:
from test_suite_10_cases import *

# Run specific test
test_1_baseline()      # Test 1
test_2_transit()       # Test 2
test_3_export()        # Test 3
# ... etc

# Or run all:
run_all_tests()
```

---

## Excel Validation Process

For each test:

### Step 1: Run Python Test
```bash
python test_suite_10_cases.py > test_results.txt
```

### Step 2: Copy Input Values to Excel
Each test prints its configuration. Enter these exact values in Excel:
- Product info (K16, E16, G16, J16, W16)
- Financial params (D8, Q16, O16, AC16, rate_forex_risk, dm_fee)
- Logistics (L16, D7, D9, W2-W9)
- Taxes (X16, Z16)
- Payment terms (J5, D11, K5, K9)
- Company (D5, D6)

### Step 3: Compare Key Cells
For each test, compare these priority cells:

| Priority | Cell | Description | Tolerance |
|----------|------|-------------|-----------|
| ⭐⭐⭐ | S16 | Purchase price | ±0.10 RUB |
| ⭐⭐⭐ | T16, U16, V16 | Logistics | ±0.10 RUB |
| ⭐⭐⭐ | AB16 | COGS | ±150 RUB* |
| ⭐⭐⭐ | AD16 | Sale price excl financial | ±20 RUB* |
| ⭐⭐⭐ | AL16 | FINAL PRICE | ±200 RUB* |
| ⭐⭐ | BH4, BH6 | Supplier payment | ±1.00 RUB |
| ⭐⭐ | BJ11, BL5 | Financing costs | ±100 RUB* |
| ⭐ | BA16, BB16 | Distributed financing | ±100 RUB* |

*Larger tolerance due to documented two-stage financing model differences

### Step 4: Document Results
For each test, create a report:

```
TEST X: [Name]
STATUS: ✅ PASS / ⚠️ MINOR DIFF / ❌ FAIL

Key Cells:
- S16: Excel=[value], Python=[value], Diff=[diff]
- AB16: Excel=[value], Python=[value], Diff=[diff]
- AL16: Excel=[value], Python=[value], Diff=[diff]
- ...

NOTES:
[Any observations, especially for failing tests]
```

---

## Expected Results Summary

### Tests 1-8 (Single Product)
**Should Pass:** All cells within tolerance
- Purchase price (S16): EXACT MATCH
- Logistics (T16, U16, V16): EXACT MATCH
- COGS (AB16): Within 150 RUB (financing differences)
- Final price (AL16): Within 200 RUB

### Tests 9-10 (Multi-Product) 🔴
**Requires Special Handling:**
- Must calculate distribution base (BD16) correctly
- Quote-level values (BH*, BJ*, BL*) calculated once
- Product-level values (BA16, BB16, T16, U16) distributed

**Manual Process:**
1. Calculate each product's S16
2. Calculate S13 = sum of all S16
3. Calculate BD16 for each product = S16 / S13
4. Calculate quote-level financing ONCE
5. Distribute to products using BD16

---

## Common Issues & Solutions

### Issue: Large AD16 Difference
**Cause**: Incorrect transit formula or calculation error
**Check**:
- For SUPPLY: AD16 = (AB16 × (1 + markup)) / qty
- For TRANSIT: AD16 = (S16 × (1 + markup)) / qty

### Issue: High BA16/BB16 Differences
**Cause**: Two-stage financing model (documented)
**Status**: ACCEPTABLE if within 100 RUB
**Note**: Python is MORE accurate than Excel

### Issue: Y16 (Customs fee) Doesn't Match
**Check**:
- INCOTERMS must be DDP for customs fee
- For SUPPLY: uses AY16 as base
- For TRANSIT: uses S16 as base

### Issue: AI16 (Financial agent fee) Wrong
**Check**:
- Must be 0 if seller_region = "TR" OR offer_sale_type = "экспорт"
- Otherwise: rate_fin_comm × (AZ16 + AZ16×AW16 + T16)

---

## Reporting Results

After completing validation, provide this format:

```markdown
# Test Results Summary

## Test 1: Baseline
✅ PASS - All cells within tolerance

## Test 2: Transit
✅ PASS - Transit formulas working correctly
- AQ16 calculated correctly: 19,558.52

## Test 3: Export
⚠️ MINOR DIFF - AI16 showing small value instead of 0
- AI16: Excel=0.00, Python=0.15 ❌

## Test 4: Turkish Seller
✅ PASS

... (continue for all 10 tests)

## Overall Summary
- Tests Passed: X/10
- Tests with Minor Differences: Y/10
- Tests Failed: Z/10

## Issues Found
1. [Issue description]
2. [Issue description]
```

---

## Next Steps After Validation

Once you've validated all 10 tests:

1. **Share results** with detailed comparison for any failing tests
2. **Fix any bugs** found during validation
3. **Convert to automated pytest suite** using validated values as expected results
4. **Add to CI/CD** for regression testing

---

## Questions?

If you encounter issues:
1. Check test configuration matches Excel exactly
2. Verify Excel formulas match documentation
3. Note any cells with >1 RUB difference (excluding documented financing differences)
4. Share specific test number and cell reference with difference value
