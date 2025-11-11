# Excel Parser Module

Unified Excel quote parser for validation and migration workflows.

## Purpose

Extracts quote data from historical Excel calculation files with smart sheet detection and structured data models.

## Features

- **3-level sheet detection fallback**
  - Strategy 1: Exact name match ("Расчет")
  - Strategy 2: Similar names (case-insensitive search)
  - Strategy 3: Structural markers (E16, K16 validation)

- **Structured data extraction**
  - Quote-level variables (6 fields: seller, sale type, currency, advance, etc.)
  - Product-level variables (10+ fields per product: quantity, price, weight, customs, etc.)
  - Calculated results (summary + detailed fields for validation)

- **Dynamic row detection**
  - Auto-detects number of products via while loop
  - Handles variable-length quote files (1-100+ products)

## Usage

### Basic Parsing

```python
from excel_parser.quote_parser import ExcelQuoteParser

# Parse Excel file
parser = ExcelQuoteParser("path/to/quote.xlsx")
quote_data = parser.parse()

# Access data
print(f"File: {quote_data.filename}")
print(f"Sheet: {quote_data.sheet_name}")
print(f"Products: {len(quote_data.inputs['products'])}")

# Quote-level variables
quote_vars = quote_data.inputs["quote"]
print(f"Currency: {quote_vars['currency_of_quote']}")
print(f"Seller: {quote_vars['seller_company']}")

# Product data
for i, product in enumerate(quote_data.inputs["products"]):
    print(f"Product {i+1}: Qty={product['quantity']}, Price={product['base_price_VAT']}")
```

### Validation Workflow

```python
from excel_parser.quote_parser import ExcelQuoteParser
from validation.calculator_validator import CalculatorValidator, ValidationMode

# Parse Excel
parser = ExcelQuoteParser("quote.xlsx")
excel_data = parser.parse()

# Validate against calculation engine
validator = CalculatorValidator(
    tolerance_rub=Decimal("2.0"),
    mode=ValidationMode.SUMMARY
)
result = validator.validate_quote(excel_data)

if result.passed:
    print("✅ Validation PASSED")
else:
    print(f"❌ Validation FAILED - Max deviation: {result.max_deviation:.2f} ₽")
```

### Migration Workflow

```python
from excel_parser.quote_parser import ExcelQuoteParser
from migration.bulk_importer import BulkQuoteImporter

# Bulk import
importer = BulkQuoteImporter(
    organization_id="uuid",
    user_id="uuid",
    batch_size=50
)

file_paths = glob.glob("validation_data/*.xlsx")
results = await importer.import_files(file_paths)

print(f"Imported: {results['successful']} / {results['total']}")
```

## Data Models

### QuoteData

Container for parsed Excel data.

```python
@dataclass
class QuoteData:
    filename: str                      # Original filename
    sheet_name: str                    # Calculation sheet name
    inputs: Dict[str, Any]             # All input variables
    expected_results: Dict[str, Any]   # Calculated results for comparison
```

### Input Structure

```python
inputs = {
    "quote": {
        "seller_company": str,
        "offer_sale_type": str,
        "offer_incoterms": str,
        "currency_of_quote": str,
        "advance_from_client": Decimal,
        "time_to_advance": int
    },
    "products": [
        {
            "quantity": int,
            "weight_in_kg": Decimal,
            "currency_of_base_price": str,
            "base_price_VAT": Decimal,
            "supplier_country": str,
            "supplier_discount": Decimal,
            "exchange_rate_base_price_to_quote": Decimal,
            "customs_code": str,
            "import_tariff": Decimal,
            "excise_tax": Decimal
        },
        # ... more products
    ]
}
```

### Results Structure

```python
expected_results = {
    "products": [
        {
            # Summary fields (for SUMMARY mode)
            "AK16": Decimal,  # Final price total
            "AM16": Decimal,  # Price with VAT
            "AQ16": Decimal,  # Profit

            # Detailed fields (for DETAILED mode)
            "M16": Decimal,   # Base price without VAT
            "S16": Decimal,   # Purchase price in quote currency
            "T16": Decimal,   # Logistics supplier-hub
            "V16": Decimal,   # Total logistics
            "Y16": Decimal,   # Customs duty
            "AB16": Decimal   # COGS
        },
        # ... more products
    ]
}
```

## Error Handling

### Sheet Not Found

```python
try:
    parser = ExcelQuoteParser("invalid.xlsx")
except ValueError as e:
    # Error message includes:
    # - Available sheets list
    # - Expected structure (cells D5, E16, K16)
    print(e)
```

### Invalid File Format

```python
try:
    parser = ExcelQuoteParser("not-an-excel.txt")
except Exception as e:
    # openpyxl will raise error
    print(f"Invalid file: {e}")
```

## Common Use Cases

### 1. Batch Validation

Validate 100+ historical quotes for accuracy:

```python
import glob
from decimal import Decimal

excel_files = glob.glob("validation_data/*.xlsx")
validator = CalculatorValidator(tolerance_rub=Decimal("2.0"))

passed = 0
for filepath in excel_files:
    parser = ExcelQuoteParser(filepath)
    excel_data = parser.parse()
    result = validator.validate_quote(excel_data)
    if result.passed:
        passed += 1

print(f"Pass rate: {passed/len(excel_files)*100:.1f}%")
```

### 2. Data Migration

Import historical quotes into database:

```python
from migration.bulk_importer import BulkQuoteImporter

importer = BulkQuoteImporter(
    organization_id=org_id,
    user_id=user_id,
    batch_size=50,
    dry_run=False  # Set True to test without DB writes
)

results = await importer.import_files(file_paths)
```

### 3. Extract Summary Statistics

Analyze historical quote data:

```python
total_revenue = Decimal("0")
total_products = 0

for filepath in glob.glob("quotes/*.xlsx"):
    parser = ExcelQuoteParser(filepath)
    data = parser.parse()

    for product_result in data.expected_results["products"]:
        total_revenue += product_result["AK16"]  # Final price
        total_products += 1

print(f"Total revenue: {total_revenue:,.2f} ₽")
print(f"Total products: {total_products}")
```

## Cell Mapping Reference

### Quote-Level Cells

| Cell | Variable | Description |
|------|----------|-------------|
| D5 | seller_company | Legal entity name |
| D6 | offer_sale_type | Sale type (поставка/комиссия) |
| D7 | offer_incoterms | Delivery terms (EXW/FOB/DDP) |
| D8 | currency_of_quote | Quote currency (RUB/USD/EUR) |
| J5 | advance_from_client | Client advance % |
| K5 | time_to_advance | Days to advance payment |

### Product-Level Cells (Row 16+)

| Cell | Variable | Description |
|------|----------|-------------|
| E{row} | quantity | Product quantity |
| G{row} | weight_in_kg | Unit weight (kg) |
| J{row} | currency_of_base_price | Base price currency |
| K{row} | base_price_VAT | Base price with VAT |
| L{row} | supplier_country | Origin country |
| O{row} | supplier_discount | Supplier discount % |
| Q{row} | exchange_rate_base_price_to_quote | FX rate |
| W{row} | customs_code | 10-digit HS code |
| X{row} | import_tariff | Import duty % |
| Z{row} | excise_tax | Excise tax rate |

### Calculated Result Cells

| Cell | Field | Description | Mode |
|------|-------|-------------|------|
| AK{row} | Final Price Total | Sales price w/o VAT | Both |
| AM{row} | Price with VAT | Per-unit with VAT | Both |
| AQ{row} | Profit | Profit/commission | Both |
| M{row} | Base Price w/o VAT | Converted to quote currency | Detailed |
| S{row} | Purchase Price | After discounts | Detailed |
| T{row} | Logistics (Supplier-Hub) | Transport cost | Detailed |
| V{row} | Total Logistics | All transport | Detailed |
| Y{row} | Customs Duty | Import tariff amount | Detailed |
| AB{row} | COGS | Cost of goods sold | Detailed |

## Testing

### Unit Tests

```bash
cd backend
pytest tests/excel_parser/ -v
```

### Test Coverage

- Sheet detection (3 strategies)
- Input extraction (quote + products)
- Result extraction (summary + detailed)
- Error handling (invalid files, missing sheets)

## Dependencies

- **openpyxl** - Excel file reading (data_only=True mode)
- **dataclasses** - QuoteData model
- **typing** - Type hints

## Known Limitations

1. **Fixed cell mapping** - Assumes standard Excel template layout
2. **Data-only mode** - Reads calculated values, not formulas
3. **Single sheet** - Only parses calculation sheet
4. **No metadata** - Customer info not extracted (added in migration)

## See Also

- **validation/** - Calculator validator using parsed data
- **migration/** - Bulk importer for database import
- **routes/excel_validation.py** - Web API for validation UI
- **tests/validation/** - Parametrized E2E tests

## Created

2025-11-11 (Session 37)
