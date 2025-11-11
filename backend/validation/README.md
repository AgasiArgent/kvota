# Validation Module

Compare calculation engine results with historical Excel quotes to verify accuracy.

## Purpose

Validates that Python calculation engine produces same results as original Excel formulas across 1000+ historical quotes.

## Features

- **Two validation modes**
  - **SUMMARY:** 3 critical fields (final price, VAT, profit)
  - **DETAILED:** 9+ fields across all 13 calculation phases

- **Configurable tolerance**
  - Default: 2.00 ₽ (accepts rounding differences)
  - Adjustable per validation run

- **Structured comparison results**
  - File-level: Pass/fail, max deviation
  - Product-level: Per-product comparison
  - Field-level: Each field difference with phase info

- **HTML report generation**
  - Summary statistics (pass rate, deviations)
  - Table of all file results
  - Color-coded status (green/red)

## Usage

### Basic Validation (Summary Mode)

```python
from excel_parser.quote_parser import ExcelQuoteParser
from validation.calculator_validator import CalculatorValidator, ValidationMode
from decimal import Decimal

# Parse Excel
parser = ExcelQuoteParser("quote.xlsx")
excel_data = parser.parse()

# Validate
validator = CalculatorValidator(
    tolerance_rub=Decimal("2.0"),
    mode=ValidationMode.SUMMARY
)
result = validator.validate_quote(excel_data)

# Check results
if result.passed:
    print("✅ PASSED")
else:
    print(f"❌ FAILED - Max deviation: {result.max_deviation:.2f} ₽")
    print(f"Failed fields: {', '.join(result.failed_fields)}")
```

### Detailed Mode (All Phases)

```python
validator = CalculatorValidator(
    tolerance_rub=Decimal("2.0"),
    mode=ValidationMode.DETAILED
)

result = validator.validate_quote(excel_data)

# Detailed field analysis
for product_comparison in result.comparisons:
    for field_comp in product_comparison.field_comparisons:
        if not field_comp.passed:
            print(f"{field_comp.field} ({field_comp.phase}):")
            print(f"  Excel: {field_comp.excel_value:.2f}")
            print(f"  Our:   {field_comp.our_value:.2f}")
            print(f"  Diff:  {field_comp.difference:.2f} ₽")
```

### Batch Validation with Report

```python
from validation.report_generator import ReportGenerator
import glob

validator = CalculatorValidator(mode=ValidationMode.SUMMARY)
results = []

# Validate all files
for filepath in glob.glob("validation_data/*.xlsx"):
    parser = ExcelQuoteParser(filepath)
    excel_data = parser.parse()
    result = validator.validate_quote(excel_data)
    results.append(result)

# Generate HTML report
generator = ReportGenerator()
html = generator.generate_html_report(results, ValidationMode.SUMMARY)

# Save report
with open("validation_report.html", "w", encoding="utf-8") as f:
    f.write(html)

print(f"Report saved: validation_report.html")
```

## Data Models

### ValidationResult

Complete validation result for one file.

```python
@dataclass
class ValidationResult:
    mode: ValidationMode              # SUMMARY or DETAILED
    passed: bool                      # All fields within tolerance
    comparisons: List[ProductComparison]  # Per-product results
    max_deviation: Decimal            # Largest difference across all fields
    failed_fields: List[str]          # List of failed field codes
    excel_file: str                   # Original filename
    total_products: int               # Number of products validated
    fields_checked: int               # Number of fields compared
```

### ProductComparison

Product-level validation result.

```python
@dataclass
class ProductComparison:
    product_index: int                # Product position (0-based)
    passed: bool                      # All fields within tolerance
    max_deviation: Decimal            # Largest difference for this product
    field_comparisons: List[FieldComparison]  # Per-field results
```

### FieldComparison

Field-level validation result.

```python
@dataclass
class FieldComparison:
    field: str                        # Excel cell code (e.g., "AK16")
    field_name: str                   # Human-readable name
    our_value: Decimal                # Calculation engine result
    excel_value: Decimal              # Excel formula result
    difference: Decimal               # Absolute difference
    passed: bool                      # Within tolerance
    phase: str                        # Calculation phase name
```

## Validation Modes

### SUMMARY Mode (3 Fields)

Fast validation of critical outputs only.

| Field | Cell | Description | Phase |
|-------|------|-------------|-------|
| AK16 | Final Price Total | Sales price without VAT | Phase 11: Sales Price |
| AM16 | Price with VAT | Per-unit with VAT | Phase 12: VAT |
| AQ16 | Profit | Profit/commission | Phase 13: Profit |

**Use when:**
- Quick validation needed
- Testing overall accuracy
- CI/CD pipeline checks

### DETAILED Mode (9+ Fields)

Comprehensive validation across all calculation phases.

| Field | Cell | Description | Phase |
|-------|------|-------------|-------|
| M16 | Base Price w/o VAT | Converted currency | Phase 1: Currency |
| S16 | Purchase Price | After discounts | Phase 1: Currency |
| T16 | Logistics (Supplier-Hub) | Transport cost | Phase 3: Logistics |
| V16 | Total Logistics | All transport | Phase 3: Logistics |
| Y16 | Customs Duty | Import tariff | Phase 4: Customs |
| AB16 | COGS | Cost of goods sold | Phase 9: COGS |
| AK16 | Final Price Total | Sales price w/o VAT | Phase 11: Sales Price |
| AM16 | Price with VAT | Per-unit with VAT | Phase 12: VAT |
| AQ16 | Profit | Profit/commission | Phase 13: Profit |

**Use when:**
- Debugging calculation discrepancies
- Testing new calculation features
- Regression testing after changes

## HTML Report

### Report Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Validation Report - SUMMARY</title>
    <style>/* Embedded CSS */</style>
</head>
<body>
    <h1>📊 Validation Report</h1>

    <!-- Summary Statistics -->
    <div class="summary">
        <div class="stat">Total Files: 100</div>
        <div class="stat passed">Passed: 95</div>
        <div class="stat failed">Failed: 5</div>
        <div class="stat">Pass Rate: 95.0%</div>
    </div>

    <!-- Detailed Results Table -->
    <table>
        <thead>
            <tr>
                <th>File</th>
                <th>Status</th>
                <th>Max Deviation (₽)</th>
                <th>Failed Fields</th>
            </tr>
        </thead>
        <tbody>
            <tr class="file-passed">
                <td>quote_001.xlsx</td>
                <td>✅ PASSED</td>
                <td>0.52</td>
                <td>-</td>
            </tr>
            <tr class="file-failed">
                <td>quote_002.xlsx</td>
                <td>❌ FAILED</td>
                <td>5.43</td>
                <td>AK16, AM16</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
```

### Report Generation

```python
from validation.report_generator import ReportGenerator

generator = ReportGenerator()

# Generate HTML
html = generator.generate_html_report(
    results=validation_results,
    mode=ValidationMode.SUMMARY
)

# Statistics included
# - Total files
# - Passed count
# - Failed count
# - Pass rate %
# - Average deviation
# - Max deviation
# - File with max deviation
```

## API Integration

### FastAPI Endpoint

**POST /api/admin/excel-validation/validate**

Upload Excel files for validation.

```python
# Request
files: List[UploadFile]  # Max 10 files
mode: str                # "summary" or "detailed"
tolerance: float         # Tolerance in rubles (default: 2.0)

# Response
{
    "summary": {
        "total": 5,
        "passed": 4,
        "failed": 1,
        "pass_rate": 80.0,
        "avg_deviation": 1.23,
        "max_deviation": 3.45
    },
    "results": [
        {
            "filename": "quote.xlsx",
            "passed": true,
            "max_deviation": 0.52,
            "total_products": 3,
            "failed_fields": [],
            "comparisons": [...]
        }
    ]
}
```

See: `backend/routes/excel_validation.py`

## Testing

### Unit Tests

```bash
cd backend
pytest tests/validation/ -v
```

### Test Coverage

- Summary mode validation
- Detailed mode validation
- Field mapping (Excel cells → model fields)
- Tolerance thresholds
- Report generation

### Parametrized E2E Tests

```python
# tests/validation/test_excel_validation_e2e.py
import pytest
import glob

excel_files = glob.glob("validation_data/*.xlsx")

@pytest.mark.parametrize("excel_path", excel_files, ids=lambda p: Path(p).name)
def test_excel_validation_summary(excel_path, validator_summary):
    """One test per Excel file"""
    parser = ExcelQuoteParser(excel_path)
    excel_data = parser.parse()
    result = validator_summary.validate_quote(excel_data)

    assert result.passed, (
        f"Max deviation: {result.max_deviation:.2f} ₽"
    )
```

**Run tests:**
```bash
# Summary mode (fast)
pytest tests/validation/test_excel_validation_e2e.py -v -m "not detailed"

# Detailed mode (comprehensive)
pytest tests/validation/test_excel_validation_e2e.py -v -m detailed

# Overall accuracy test
pytest tests/validation/test_excel_validation_e2e.py::test_overall_accuracy -v
```

## Dependencies

- **calculation_engine** - Multiproduct quote calculator
- **calculation_models** - Pydantic input/output models
- **excel_parser** - Excel data extraction
- **jinja2** - HTML template rendering
- **decimal** - Precise money calculations

## Configuration

### Tolerance Settings

Adjust based on use case:

```python
# Strict validation (0.10 ₽)
validator = CalculatorValidator(tolerance_rub=Decimal("0.10"))

# Standard validation (2.00 ₽) - accounts for Excel rounding
validator = CalculatorValidator(tolerance_rub=Decimal("2.00"))

# Lenient validation (5.00 ₽)
validator = CalculatorValidator(tolerance_rub=Decimal("5.00"))
```

### Mode Selection

```python
# SUMMARY - 3 fields, fast
validator = CalculatorValidator(mode=ValidationMode.SUMMARY)

# DETAILED - 9+ fields, comprehensive
validator = CalculatorValidator(mode=ValidationMode.DETAILED)
```

## Field Mapping

### Excel Cell → Model Field

```python
EXCEL_TO_MODEL_FIELD_MAP = {
    "AK16": "sales_price_total_no_vat",
    "AM16": "sales_price_per_unit_with_vat",
    "AQ16": "transit_commission",
    # ... more mappings
}
```

**Important:** Excel uses cell codes (AK16), but calculation engine returns Pydantic models with field names (sales_price_total_no_vat).

## Common Use Cases

### 1. Regression Testing

After changing calculation engine:

```bash
# Run all validation tests
pytest tests/validation/test_excel_validation_e2e.py -v

# Generate report
python scripts/validate_all.py --mode summary --report report.html
```

### 2. Debugging Failed Validation

```python
# Use detailed mode
validator = CalculatorValidator(mode=ValidationMode.DETAILED)
result = validator.validate_quote(excel_data)

# Find failing phase
for comp in result.comparisons:
    for fc in comp.field_comparisons:
        if not fc.passed:
            print(f"{fc.phase} - {fc.field_name}")
            print(f"  Expected: {fc.excel_value:.2f}")
            print(f"  Got:      {fc.our_value:.2f}")
```

### 3. CI/CD Integration

```yaml
# .github/workflows/validation.yml
- name: Validate Calculations
  run: |
    pytest tests/validation/test_excel_validation_e2e.py -v
    pytest tests/validation/test_excel_validation_e2e.py::test_overall_accuracy -v
```

## Known Limitations

1. **Rounding differences** - Excel uses different precision than Python Decimal
2. **Formula bugs in Excel** - Validates against Excel output (may include bugs)
3. **Enum mapping** - Unknown seller companies default to MASTER_BEARING_RU
4. **Admin settings** - Uses hardcoded defaults (rate_fin_comm=2%, etc.)

## Troubleshooting

### High Deviation (>2 ₽)

1. Check field mapping in calculator_validator.py
2. Verify calculation_models enums match Excel values
3. Test detailed mode to isolate failing phase
4. Compare Excel formulas vs Python calculation_engine

### All Tests Failing

1. Check calculation_engine is latest version
2. Verify admin settings match Excel
3. Check Decimal precision (2 decimal places)
4. Review recent changes to calculation logic

## See Also

- **excel_parser/** - Excel data extraction
- **routes/excel_validation.py** - Web API
- **frontend/src/app/admin/excel-validation/** - Admin UI
- **calculation_engine.py** - Quote calculator
- **tests/validation/** - E2E validation tests

## Created

2025-11-11 (Session 37)
