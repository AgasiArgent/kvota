# Excel Validation Testing Guide

**Created:** 2025-11-28
**Purpose:** Document the process for validating the calculation engine against Excel reference files

---

## Overview

The calculation engine must produce results that match the Excel calculator within 0.01% tolerance. This guide describes the complete workflow for:
1. Preparing Excel test files
2. Extracting test data and expected values
3. Running comparison tests
4. Debugging discrepancies

---

## 1. Excel File Structure

### Sheet Names
- **расчет** (calculation) - Main calculation sheet with all formulas
- **helpsheet** - Admin parameters (rates, settings)
- **Вводные** (inputs) - Some input parameters

### Key Cell Ranges

#### Quote-Level Inputs (расчет sheet)
| Cell | Variable | Description |
|------|----------|-------------|
| J5 | advance_from_client | Client advance % (decimal, e.g., 0.30 = 30%) |
| D9 | delivery_time | Delivery time in days |
| K9 | offer_post_pmt_due | Post-payment due days |
| D11 | advance_to_supplier | Supplier advance % (decimal) |
| A10 | payment_type | Payment terms (pmt_1, pmt_2, pmt_3) |

#### Admin Rates (helpsheet)
| Cell | Variable | Description |
|------|----------|-------------|
| E11 | rate_loan_interest_daily | Daily loan rate (e.g., 0.000685 = 25%/365) |
| E13 | rate_fin_comm | Financial commission % |
| E14 | rate_insurance | Insurance rate % |
| O7 | rate_vatRu | Russian VAT rate (0.20 or 0.22) |

#### Product Data (rows 16-20 in расчет)
| Column | Cell Example | Variable |
|--------|--------------|----------|
| A | A16 | Row number |
| B | B16 | SKU |
| C | C16 | Product name |
| E | E16 | Quantity |
| K | K16 | Base price with VAT |
| L | L16 | Supplier country |
| M | M16 | VAT seller country rate |
| Q | Q16 | Exchange rate |
| S | S16 | Purchase price in quote currency |
| T | T16 | First leg logistics |
| U | U16 | Second leg logistics |
| V | V16 | Total logistics |
| Y | Y16 | Customs fee |
| Z | Z16 | Excise tax |
| AA | AA16 | COGS per unit |
| AB | AB16 | COGS total |
| BA | BA16 | Initial financing per product |
| BB | BB16 | Credit interest per product |

#### Financing Block (расчет sheet)
| Cell | Variable | Description |
|------|----------|-------------|
| BH2 | revenue_estimate | Estimated revenue with VAT |
| BH3 | client_advance | Client advance amount |
| BH4 | total_before_forwarding | Total amount before forwarding |
| BH6 | supplier_advance | Supplier advance amount |
| BH7 | supplier_financing_need | Amount to finance for supplier |
| BH8 | payable_after_supplier | Amount payable after supplier payment |
| BH9 | additional_milestones | Additional payment milestones (usually 0) |
| BH10 | operational_financing_need | Operational financing need |
| BI7 | supplier_fv | FV of supplier financing |
| BJ7 | supplier_financing_cost | Supplier financing cost |
| BI10 | operational_fv | FV of operational financing |
| BJ10 | operational_financing_cost | Operational financing cost |
| BJ11 | total_financing_cost | Total financing cost |
| BL3 | credit_amount_financed | Amount financed for credit |
| BL4 | credit_fv | FV of credit financing |
| BL5 | credit_interest_cost | Credit interest cost |

---

## 2. Extracting Data from Excel

### Using Python with openpyxl

```python
import openpyxl
from decimal import Decimal

def extract_excel_data(filepath: str) -> dict:
    """Extract test data and expected values from Excel file."""

    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb['расчет']
    hs = wb['helpsheet']

    def get_val(sheet, cell):
        val = sheet[cell].value
        return Decimal(str(val)) if val is not None else None

    data = {
        # Quote-level inputs
        "quote_inputs": {
            "advance_from_client": float(get_val(ws, 'J5')) * 100,  # Convert to %
            "delivery_time": int(get_val(ws, 'D9')),
            "offer_post_pmt_due": int(get_val(ws, 'K9')),
            "advance_to_supplier": float(get_val(ws, 'D11')) * 100,
        },

        # Admin rates
        "admin_rates": {
            "rate_loan_interest_daily": str(get_val(hs, 'E11')),
            "rate_fin_comm": float(get_val(hs, 'E13')) * 100,
            "rate_insurance": float(get_val(hs, 'E14')) * 100,
            "rate_vat_ru": float(get_val(hs, 'O7')) * 100,
        },

        # Products (rows 16-20)
        "products": [],

        # Expected intermediate values
        "expected_financing": {
            "BH2": str(get_val(ws, 'BH2')),
            "BH3": str(get_val(ws, 'BH3')),
            "BH4": str(get_val(ws, 'BH4')),
            "BH6": str(get_val(ws, 'BH6')),
            "BH7": str(get_val(ws, 'BH7')),
            "BH10": str(get_val(ws, 'BH10')),
            "BJ7": str(get_val(ws, 'BJ7')),
            "BJ10": str(get_val(ws, 'BJ10')),
            "BJ11": str(get_val(ws, 'BJ11')),
            "BL3": str(get_val(ws, 'BL3')),
            "BL5": str(get_val(ws, 'BL5')),
        },
    }

    # Extract products
    for row in range(16, 21):
        if get_val(ws, f'K{row}') is None:
            continue

        product = {
            "row": row,
            "sku": ws[f'B{row}'].value,
            "name": ws[f'C{row}'].value,
            "quantity": int(get_val(ws, f'E{row}')),
            "base_price_vat": str(get_val(ws, f'K{row}')),
            "supplier_country": ws[f'L{row}'].value,
            "exchange_rate": str(get_val(ws, f'Q{row}')),

            # Expected outputs
            "expected": {
                "S16": str(get_val(ws, f'S{row}')),
                "V16": str(get_val(ws, f'V{row}')),
                "Y16": str(get_val(ws, f'Y{row}')),
                "AA16": str(get_val(ws, f'AA{row}')),
                "AB16": str(get_val(ws, f'AB{row}')),
                "BA16": str(get_val(ws, f'BA{row}')),
                "BB16": str(get_val(ws, f'BB{row}')),
            }
        }
        data["products"].append(product)

    wb.close()
    return data
```

### Storage Format (JSON)

Store extracted data in `validation_data/extracted/`:

```json
{
  "source_file": "test_raschet_multi_currency_correct_rate_2711_30pct_100k.xlsm",
  "extracted_at": "2025-11-28T12:00:00Z",

  "quote_inputs": {
    "advance_from_client": 30,
    "delivery_time": 30,
    "offer_post_pmt_due": 10,
    "advance_to_supplier": 100,
    "markup": 15,
    "quote_currency": "EUR"
  },

  "admin_rates": {
    "rate_loan_interest_daily": "0.0006849315068493151",
    "rate_fin_comm": 2,
    "rate_insurance": 0.047
  },

  "expected_financing": {
    "BJ11": "2890.148318",
    "BL5": "1207.179028"
  },

  "products": [
    {
      "row": 16,
      "sku": "195-03-51110",
      "base_price_vat": "100000",
      "currency_of_base_price": "TRY",
      "exchange_rate": "49.1889",
      "expected": {
        "S16": "1694.149154",
        "V16": "40.358524",
        "BA16": "26.569959",
        "BB16": "11.097942"
      }
    }
  ]
}
```

---

## 3. Mapping Excel to API Input

### Supplier Country Mapping

```python
SUPPLIER_COUNTRY_MAP = {
    "Турция": "turkey",
    "Турция (транзит)": "turkey_transit",
    "Россия": "russia",
    "Китай": "china",
    "Литва": "lithuania",
    "Латвия": "latvia",
    "Болгария": "bulgaria",
    "Польша": "poland",
    "ЕС (закупка между странами ЕС)": "eu_cross_border",
    "ОАЭ": "uae",
    "Другое": "other"
}
```

### Currency Mapping

```python
CURRENCY_MAP = {
    "EUR": "EUR",
    "USD": "USD",
    "RUB": "RUB",
    "TRY": "TRY",
    "CNY": "CNY"
}
```

### Building API Request

```python
def build_api_request(excel_data: dict) -> dict:
    """Convert extracted Excel data to API request format."""

    products = []
    for p in excel_data["products"]:
        products.append({
            "sku": p["sku"],
            "name": p["name"],
            "base_price_vat": p["base_price_vat"],
            "quantity": p["quantity"],
            "currency_of_base_price": p.get("currency_of_base_price", "EUR"),
            "supplier_country": SUPPLIER_COUNTRY_MAP[p["supplier_country"]],
            "exchange_rate_base_price_to_quote": p["exchange_rate"],
        })

    return {
        "quote_variables": {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "DDP",
            "offer_sale_type": "supply",
            "markup": excel_data["quote_inputs"]["markup"],
            "advance_from_client": excel_data["quote_inputs"]["advance_from_client"],
            "advance_to_supplier": excel_data["quote_inputs"]["advance_to_supplier"],
            "delivery_time": excel_data["quote_inputs"]["delivery_time"],
            "offer_post_pmt_due": excel_data["quote_inputs"]["offer_post_pmt_due"],
            "dm_fee_type": "%",
            "dm_fee_value": 0,
            # ... other variables
        },
        "products": products
    }
```

---

## 4. Running Comparison Tests

### Test Structure

```python
import pytest
from decimal import Decimal

class TestExcelValidation:

    @pytest.fixture
    def excel_data(self):
        """Load expected values from JSON."""
        with open('validation_data/extracted/excel_expected_values.json') as f:
            return json.load(f)

    def compare_value(self, actual: Decimal, expected: str, tolerance_pct: float = 0.01) -> bool:
        """Compare values within tolerance."""
        expected_dec = Decimal(expected)
        if expected_dec == 0:
            return actual == 0

        diff_pct = abs((actual - expected_dec) / expected_dec * 100)
        return diff_pct <= tolerance_pct

    def test_financing_calculations(self, excel_data, api_client):
        """Test financing block matches Excel."""

        request = build_api_request(excel_data)
        response = api_client.post("/api/quotes/calculate", json=request)
        result = response.json()

        expected = excel_data["expected_financing"]

        # Compare BJ11 (total financing)
        assert self.compare_value(
            Decimal(str(result["financing"]["total_cost"])),
            expected["BJ11"]
        ), f"BJ11 mismatch: got {result['financing']['total_cost']}, expected {expected['BJ11']}"

        # Compare BL5 (credit interest)
        assert self.compare_value(
            Decimal(str(result["financing"]["credit_interest"])),
            expected["BL5"]
        )

    def test_product_calculations(self, excel_data, api_client):
        """Test each product matches Excel."""

        request = build_api_request(excel_data)
        response = api_client.post("/api/quotes/calculate", json=request)
        result = response.json()

        for i, product in enumerate(excel_data["products"]):
            api_product = result["products"][i]
            expected = product["expected"]

            # Compare key fields
            fields_to_check = [
                ("purchase_price_quote_currency", "S16"),
                ("logistics_total", "V16"),
                ("customs_fee", "Y16"),
                ("cogs_per_unit", "AA16"),
                ("financing_initial", "BA16"),
                ("financing_credit", "BB16"),
            ]

            for api_field, excel_cell in fields_to_check:
                assert self.compare_value(
                    Decimal(str(api_product[api_field])),
                    expected[excel_cell]
                ), f"Product {i} {api_field} mismatch"
```

### Running Tests

```bash
# Run all Excel validation tests
cd backend
pytest tests/validation/test_excel_*.py -v

# Run with detailed output
pytest tests/validation/test_excel_comprehensive.py -v --tb=long

# Run specific test
pytest tests/validation/test_excel_api.py::test_financing_block -v
```

---

## 5. Debugging Discrepancies

### Step 1: Identify the Divergence Point

Extract intermediate values from both Excel and API:

```python
def debug_calculation(excel_file: str):
    """Print side-by-side comparison of intermediate values."""

    excel_data = extract_excel_data(excel_file)
    api_result = call_api(build_api_request(excel_data))

    print("=" * 60)
    print("INTERMEDIATE VALUE COMPARISON")
    print("=" * 60)

    comparisons = [
        ("BH2", api_result.get("BH2"), excel_data["expected"]["BH2"]),
        ("BH3", api_result.get("BH3"), excel_data["expected"]["BH3"]),
        ("BH4", api_result.get("BH4"), excel_data["expected"]["BH4"]),
        # ... more values
    ]

    for name, api_val, excel_val in comparisons:
        diff = abs(float(api_val) - float(excel_val))
        pct = (diff / float(excel_val) * 100) if float(excel_val) != 0 else 0
        status = "✅" if pct < 0.01 else "❌"
        print(f"{name}: API={api_val:.4f}, Excel={excel_val:.4f}, Diff={pct:.4f}% {status}")
```

### Step 2: Check Excel Formulas

Use openpyxl without `data_only=True` to see formulas:

```python
wb_formulas = openpyxl.load_workbook(filepath, data_only=False)
ws = wb_formulas['расчет']

# Check formula for specific cell
print(f"BL4 formula: {ws['BL4'].value}")
# Output: =BL3+BL3*rate_loan_interest_daily*offer_post_pmt_due
```

### Step 3: Trace Through Calculation Phases

The calculation engine has 13 phases. Identify which phase produces the first discrepancy:

1. **Phase 1:** Purchase price (N16, P16, R16, S16)
2. **Phase 2:** Logistics base (T16 partial, U16 partial)
3. **Phase 3:** Logistics distribution (T16, U16, V16)
4. **Phase 4:** Customs & taxes (Y16, Z16, AZ16)
5. **Phase 5:** Supplier payment (BH6, BH4)
6. **Phase 6:** Revenue estimation (BH2, BJ2, BJ3)
7. **Phase 7:** Financing costs (BH3, BH7, BH10, BJ11)
8. **Phase 8:** Credit sales interest (BL3, BL4, BL5)
9. **Phase 9:** Distribute financing (BA16, BB16)
10. **Phase 10:** Final COGS (AA16, AB16)
11. **Phase 11:** Sales price (AJ16, AK16)
12. **Phase 12:** VAT calculations
13. **Phase 13:** Summary & totals

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| ~100x error | Rate as % vs decimal | Check if rate needs ÷100 |
| ~20% error | Wrong formula (compound vs simple) | Compare Excel formula |
| Small but consistent error | Rounding precision | Check decimal places |
| Only affects some products | Product-level override missing | Check two-tier variable logic |

---

## 6. Test Data Files

### Location
```
validation_data/
├── test_raschet_multi_currency_correct_rate_2711.xlsm      # Base test
├── test_raschet_multi_currency_correct_rate_2711_30pct_100k.xlsm  # 30% advance
├── extracted/
│   ├── excel_expected_values.json      # Extracted expected values
│   └── excel_test_data_complete.json   # Complete test dataset
└── csv/
    └── products_input.csv              # Flattened product data
```

### Creating New Test Files

1. Copy base Excel file
2. Modify inputs (advance %, delivery time, etc.)
3. Save and note which values changed
4. Run extraction script
5. Save to `validation_data/extracted/`

---

## 7. Continuous Validation

### Pre-commit Hook

Add to `.claude/hooks/backend-syntax-check.sh`:

```bash
# Run Excel validation tests
echo "Running Excel validation..."
pytest tests/validation/test_excel_comprehensive.py -v --tb=short
```

### CI/CD Pipeline

```yaml
# .github/workflows/test.yml
- name: Excel Validation Tests
  run: |
    cd backend
    pytest tests/validation/test_excel_*.py -v
```

---

## Summary

1. **Prepare:** Use Excel files with known good calculations
2. **Extract:** Pull test data and expected values using openpyxl
3. **Store:** Save as JSON in `validation_data/extracted/`
4. **Map:** Convert Excel format to API request format
5. **Compare:** Run pytest tests with 0.01% tolerance
6. **Debug:** Trace through phases to find divergence point
7. **Fix:** Update calculation engine to match Excel formula
8. **Verify:** Re-run tests to confirm fix

**Target Accuracy:** All values within 0.01% of Excel
