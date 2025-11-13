# Excel Validation and Migration System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build system to validate calculation accuracy and migrate 1000+ historical quotes from Excel.

**Architecture:** Unified Excel parser feeds two modules: validation (Web UI + pytest) for testing accuracy, and migration (CLI) for batch database import.

**Tech Stack:** Python 3.12, openpyxl, FastAPI, Next.js 15, Ant Design, pytest, asyncpg, Pydantic

---

## Prerequisites

**Before starting:**
- Backend venv activated
- Frontend dependencies installed
- Database accessible
- Sample Excel files in `validation_data/` directory

**Estimated Time:** 16-18 hours total

---

## Phase 1: Excel Parser Module (3-4 hours)

### Task 1.1: Create Parser Structure and Tests

**Files:**
- Create: `backend/excel_parser/__init__.py`
- Create: `backend/excel_parser/quote_parser.py`
- Create: `backend/tests/excel_parser/__init__.py`
- Create: `backend/tests/excel_parser/test_quote_parser.py`
- Create: `backend/tests/fixtures/sample_quote.xlsx` (copy from validation_data)

**Step 1: Write failing test for sheet detection**

```python
# backend/tests/excel_parser/test_quote_parser.py
import pytest
from pathlib import Path
from excel_parser.quote_parser import ExcelQuoteParser

@pytest.fixture
def sample_excel_path():
    return Path(__file__).parent.parent / "fixtures" / "sample_quote.xlsx"

def test_find_calculation_sheet_by_name(sample_excel_path):
    """Test that parser finds sheet named 'Расчет'"""
    parser = ExcelQuoteParser(str(sample_excel_path))

    assert parser.sheet is not None
    assert parser.sheet.title in ["Расчет", "расчет", "Расчёт"]
```

**Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/excel_parser/test_quote_parser.py::test_find_calculation_sheet_by_name -v
```

Expected: `ModuleNotFoundError: No module named 'excel_parser'`

**Step 3: Create basic parser class**

```python
# backend/excel_parser/__init__.py
from .quote_parser import ExcelQuoteParser, QuoteData

__all__ = ["ExcelQuoteParser", "QuoteData"]
```

```python
# backend/excel_parser/quote_parser.py
import openpyxl
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class QuoteData:
    """Parsed quote data from Excel"""
    filename: str
    sheet_name: str
    inputs: Dict
    expected_results: Dict

class ExcelQuoteParser:
    """Parse quotes from Excel files with formula-based layout"""

    def __init__(self, filepath: str):
        self.filepath = filepath
        self.workbook = openpyxl.load_workbook(filepath, data_only=True)
        self.sheet = self._find_calculation_sheet()

    def _find_calculation_sheet(self):
        """Find calculation sheet with 3-level fallback"""
        # Strategy 1: Try exact name "Расчет"
        if "Расчет" in self.workbook.sheetnames:
            sheet = self.workbook["Расчет"]
            if self._validate_sheet_structure(sheet):
                return sheet

        # Strategy 2: Try similar names
        similar_names = ["расчет", "Расчёт", "расчёт", "Calculation", "calc"]
        for name in self.workbook.sheetnames:
            if any(similar in name.lower() for similar in similar_names):
                sheet = self.workbook[name]
                if self._validate_sheet_structure(sheet):
                    return sheet

        # Strategy 3: Search all sheets for markers
        for sheet in self.workbook.worksheets:
            if self._validate_sheet_structure(sheet):
                return sheet

        # Fail with clear error
        available = ", ".join(self.workbook.sheetnames)
        raise ValueError(
            f"Cannot find calculation sheet in {self.filepath}.\n"
            f"Available sheets: {available}\n"
            f"Expected sheet with cells D5, E16, K16"
        )

    def _validate_sheet_structure(self, sheet) -> bool:
        """Check if sheet has expected structure"""
        try:
            # Check E16 is number (quantity)
            e16 = sheet["E16"].value
            if e16 and isinstance(e16, (int, float)) and e16 > 0:
                # Check K16 is number (price)
                k16 = sheet["K16"].value
                if k16 and isinstance(k16, (int, float)) and k16 > 0:
                    return True
            return False
        except Exception:
            return False
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/excel_parser/test_quote_parser.py::test_find_calculation_sheet_by_name -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/excel_parser/ backend/tests/excel_parser/
git commit -m "feat(parser): add Excel parser with smart sheet detection

- 3-level fallback strategy (name, similar, markers)
- Validates sheet structure (E16, K16)
- Clear error with available sheets list

🤖 Generated with Claude Code"
```

---

### Task 1.2: Implement Input Extraction

**Files:**
- Modify: `backend/excel_parser/quote_parser.py:44-90`
- Modify: `backend/tests/excel_parser/test_quote_parser.py:15-50`

**Step 1: Write failing test for input extraction**

```python
def test_extract_quote_level_variables(sample_excel_path):
    """Test extraction of quote-level variables"""
    parser = ExcelQuoteParser(str(sample_excel_path))
    data = parser.parse()

    assert "quote" in data.inputs
    assert data.inputs["quote"]["seller_company"] is not None
    assert data.inputs["quote"]["currency_of_quote"] in ["RUB", "USD", "EUR"]

def test_extract_products(sample_excel_path):
    """Test extraction of product rows"""
    parser = ExcelQuoteParser(str(sample_excel_path))
    data = parser.parse()

    assert "products" in data.inputs
    assert len(data.inputs["products"]) > 0

    product = data.inputs["products"][0]
    assert "quantity" in product
    assert "base_price_VAT" in product
    assert product["quantity"] > 0
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/excel_parser/test_quote_parser.py::test_extract_quote_level_variables -v
pytest tests/excel_parser/test_quote_parser.py::test_extract_products -v
```

Expected: `AttributeError: 'ExcelQuoteParser' object has no attribute 'parse'`

**Step 3: Implement parse method**

Add to `ExcelQuoteParser` class:

```python
def parse(self) -> QuoteData:
    """Extract complete quote data from Excel"""
    return QuoteData(
        filename=os.path.basename(self.filepath),
        sheet_name=self.sheet.title,
        inputs=self._extract_inputs(),
        expected_results=self._extract_results()
    )

def _extract_inputs(self) -> Dict:
    """Extract all input variables"""
    # Quote-level (fixed cells)
    quote_vars = {
        "seller_company": self.sheet["D5"].value,
        "offer_sale_type": self.sheet["D6"].value,
        "offer_incoterms": self.sheet["D7"].value,
        "currency_of_quote": self.sheet["D8"].value,
        "advance_from_client": self.sheet["J5"].value,
        "time_to_advance": self.sheet["K5"].value,
    }

    # Products (dynamic rows starting from 16)
    products = []
    row = 16  # First product

    while self.sheet[f"E{row}"].value:  # While quantity exists
        product = {
            "quantity": self.sheet[f"E{row}"].value,
            "weight_in_kg": self.sheet[f"G{row}"].value,
            "currency_of_base_price": self.sheet[f"J{row}"].value,
            "base_price_VAT": self.sheet[f"K{row}"].value,
            "supplier_country": self.sheet[f"L{row}"].value,
            "supplier_discount": self.sheet[f"O{row}"].value,
            "exchange_rate_base_price_to_quote": self.sheet[f"Q{row}"].value,
            "customs_code": self.sheet[f"W{row}"].value,
            "import_tariff": self.sheet[f"X{row}"].value,
            "excise_tax": self.sheet[f"Z{row}"].value,
        }
        products.append(product)
        row += 1

    return {"quote": quote_vars, "products": products}

def _extract_results(self) -> Dict:
    """Extract calculated results for comparison"""
    results = []
    row = 16

    while self.sheet[f"E{row}"].value:
        result = {
            # Summary fields
            "AK16": self.sheet[f"AK{row}"].value,  # Final price
            "AM16": self.sheet[f"AM{row}"].value,  # With VAT
            "AQ16": self.sheet[f"AQ{row}"].value,  # Profit

            # Detailed fields (for detailed mode)
            "M16": self.sheet[f"M{row}"].value,
            "S16": self.sheet[f"S{row}"].value,
            "T16": self.sheet[f"T{row}"].value,
            "V16": self.sheet[f"V{row}"].value,
            "Y16": self.sheet[f"Y{row}"].value,
            "AB16": self.sheet[f"AB{row}"].value,
        }
        results.append(result)
        row += 1

    return {"products": results}
```

Add import at top:

```python
import os
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/excel_parser/test_quote_parser.py -v
```

Expected: All PASS

**Step 5: Commit**

```bash
git add backend/excel_parser/quote_parser.py backend/tests/excel_parser/test_quote_parser.py
git commit -m "feat(parser): add input and result extraction

- Extract quote-level variables from fixed cells
- Extract products with dynamic row detection
- Extract both summary and detailed result fields
- Auto-detect product count via while loop

🤖 Generated with Claude Code"
```

---

## Phase 2: Validation Module (3-4 hours)

### Task 2.1: Create Validator with Two Modes

**Files:**
- Create: `backend/validation/__init__.py`
- Create: `backend/validation/calculator_validator.py`
- Create: `backend/tests/validation/__init__.py`
- Create: `backend/tests/validation/test_calculator_validator.py`

**Step 1: Write failing test for summary mode**

```python
# backend/tests/validation/test_calculator_validator.py
import pytest
from decimal import Decimal
from validation.calculator_validator import (
    CalculatorValidator,
    ValidationMode,
    ValidationResult
)
from excel_parser.quote_parser import QuoteData

@pytest.fixture
def mock_excel_data():
    """Mock parsed Excel data"""
    return QuoteData(
        filename="test.xlsx",
        sheet_name="Расчет",
        inputs={
            "quote": {"seller_company": "Test", "currency_of_quote": "RUB"},
            "products": [{"quantity": 100, "base_price_VAT": 50.0}]
        },
        expected_results={
            "products": [{
                "AK16": Decimal("125000.00"),
                "AM16": Decimal("150000.00"),
                "AQ16": Decimal("26500.00")
            }]
        }
    )

def test_summary_mode_validation(mock_excel_data, mocker):
    """Test validation in summary mode"""
    # Mock calculation engine
    mocker.patch(
        'validation.calculator_validator.calculation_engine.calculate_quote',
        return_value=[{
            "AK16": Decimal("124998.00"),
            "AM16": Decimal("149998.00"),
            "AQ16": Decimal("26498.00")
        }]
    )

    validator = CalculatorValidator(
        tolerance_rub=Decimal("2.0"),
        mode=ValidationMode.SUMMARY
    )

    result = validator.validate_quote(mock_excel_data)

    assert isinstance(result, ValidationResult)
    assert result.passed is True
    assert result.max_deviation < Decimal("2.0")
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/validation/test_calculator_validator.py::test_summary_mode_validation -v
```

Expected: `ModuleNotFoundError: No module named 'validation'`

**Step 3: Create validator class**

```python
# backend/validation/__init__.py
from .calculator_validator import (
    CalculatorValidator,
    ValidationMode,
    ValidationResult,
    ProductComparison,
    FieldComparison
)

__all__ = [
    "CalculatorValidator",
    "ValidationMode",
    "ValidationResult",
    "ProductComparison",
    "FieldComparison"
]
```

```python
# backend/validation/calculator_validator.py
from enum import Enum
from decimal import Decimal
from dataclasses import dataclass
from typing import List, Dict
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
import calculation_engine

class ValidationMode(Enum):
    """Validation comparison modes"""
    SUMMARY = "summary"
    DETAILED = "detailed"

# Field definitions
SUMMARY_FIELDS = {
    "AK16": "Final Price Total",
    "AM16": "Price with VAT",
    "AQ16": "Profit",
}

DETAILED_FIELDS = {
    "M16": "Base price without VAT",
    "S16": "Purchase price in quote currency",
    "T16": "Logistics supplier-hub",
    "V16": "Total logistics",
    "Y16": "Customs duty",
    "AB16": "COGS",
    "AK16": "Final price total",
    "AM16": "Price with VAT",
    "AQ16": "Profit",
}

@dataclass
class FieldComparison:
    """Single field comparison result"""
    field: str
    field_name: str
    our_value: Decimal
    excel_value: Decimal
    difference: Decimal
    passed: bool
    phase: str

@dataclass
class ProductComparison:
    """Product-level comparison result"""
    product_index: int
    passed: bool
    max_deviation: Decimal
    field_comparisons: List[FieldComparison]

@dataclass
class ValidationResult:
    """Complete validation result"""
    mode: ValidationMode
    passed: bool
    comparisons: List[ProductComparison]
    max_deviation: Decimal
    failed_fields: List[str]
    excel_file: str
    total_products: int
    fields_checked: int

class CalculatorValidator:
    """Compare Excel results with calculation engine"""

    def __init__(
        self,
        tolerance_rub: Decimal = Decimal("2.0"),
        mode: ValidationMode = ValidationMode.SUMMARY
    ):
        self.tolerance = tolerance_rub
        self.mode = mode

    def validate_quote(self, excel_data) -> ValidationResult:
        """Run calculation and compare with Excel"""

        # Get fields to check based on mode
        fields_to_check = (
            SUMMARY_FIELDS if self.mode == ValidationMode.SUMMARY
            else DETAILED_FIELDS
        )

        # Run through calculation engine
        our_results = calculation_engine.calculate_quote(
            products=excel_data.inputs["products"],
            quote_vars=excel_data.inputs["quote"],
            admin_settings={}  # Will add later
        )

        # Compare products
        comparisons = []
        for i, (our_product, excel_product) in enumerate(
            zip(our_results, excel_data.expected_results["products"])
        ):
            comparison = self._compare_product(
                our_product,
                excel_product,
                fields_to_check,
                i
            )
            comparisons.append(comparison)

        # Calculate summary stats
        all_passed = all(c.passed for c in comparisons)
        max_dev = max(c.max_deviation for c in comparisons) if comparisons else Decimal("0")
        failed_fields = self._get_failed_fields(comparisons)

        return ValidationResult(
            mode=self.mode,
            passed=all_passed,
            comparisons=comparisons,
            max_deviation=max_dev,
            failed_fields=failed_fields,
            excel_file=excel_data.filename,
            total_products=len(comparisons),
            fields_checked=len(fields_to_check)
        )

    def _compare_product(
        self,
        our: Dict,
        excel: Dict,
        fields_to_check: Dict,
        product_index: int
    ) -> ProductComparison:
        """Compare one product"""
        field_comparisons = []

        for field_code, field_name in fields_to_check.items():
            our_value = Decimal(str(our.get(field_code, 0)))
            excel_value = Decimal(str(excel.get(field_code, 0)))
            diff = abs(our_value - excel_value)
            passed = diff <= self.tolerance

            field_comparisons.append(FieldComparison(
                field=field_code,
                field_name=field_name,
                our_value=our_value,
                excel_value=excel_value,
                difference=diff,
                passed=passed,
                phase=self._get_phase_name(field_code)
            ))

        all_passed = all(fc.passed for fc in field_comparisons)
        max_dev = max(fc.difference for fc in field_comparisons)

        return ProductComparison(
            product_index=product_index,
            passed=all_passed,
            max_deviation=max_dev,
            field_comparisons=field_comparisons
        )

    def _get_phase_name(self, field_code: str) -> str:
        """Map field to phase"""
        phase_map = {
            "M16": "Phase 1: Currency",
            "S16": "Phase 1: Currency",
            "T16": "Phase 3: Logistics",
            "V16": "Phase 3: Logistics",
            "Y16": "Phase 4: Customs",
            "AB16": "Phase 9: COGS",
            "AK16": "Phase 11: Sales Price",
            "AM16": "Phase 12: VAT",
            "AQ16": "Phase 13: Profit",
        }
        return phase_map.get(field_code, "Unknown Phase")

    def _get_failed_fields(self, comparisons: List[ProductComparison]) -> List[str]:
        """Get list of failed field codes"""
        failed = set()
        for comp in comparisons:
            for fc in comp.field_comparisons:
                if not fc.passed:
                    failed.add(fc.field)
        return list(failed)
```

**Step 4: Install pytest-mock for mocking**

```bash
pip install pytest-mock
echo "pytest-mock==3.14.0" >> backend/requirements.txt
```

**Step 5: Run test to verify it passes**

```bash
pytest tests/validation/test_calculator_validator.py::test_summary_mode_validation -v
```

Expected: PASS

**Step 6: Commit**

```bash
git add backend/validation/ backend/tests/validation/ backend/requirements.txt
git commit -m "feat(validation): add validator with two modes

- Summary mode: 3 fields (AK16, AM16, AQ16)
- Detailed mode: 9+ fields across phases
- Configurable tolerance (default 2 rubles)
- Product-level and field-level comparisons

🤖 Generated with Claude Code"
```

---

### Task 2.2: Create Report Generator

**Files:**
- Create: `backend/validation/report_generator.py`
- Create: `backend/tests/validation/test_report_generator.py`

**Step 1: Write failing test for HTML report**

```python
# backend/tests/validation/test_report_generator.py
import pytest
from validation.report_generator import ReportGenerator
from validation.calculator_validator import ValidationMode, ValidationResult
from decimal import Decimal

@pytest.fixture
def mock_results():
    """Mock validation results"""
    # Create mock results using dataclasses from previous task
    # ... (abbreviated for brevity)
    pass

def test_generate_html_report(mock_results):
    """Test HTML report generation"""
    generator = ReportGenerator()
    html = generator.generate_html_report(mock_results, ValidationMode.SUMMARY)

    assert "<html>" in html
    assert "Validation Report" in html
    assert "SUMMARY" in html
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/validation/test_report_generator.py::test_generate_html_report -v
```

Expected: `ModuleNotFoundError: No module named 'report_generator'`

**Step 3: Implement report generator**

```python
# backend/validation/report_generator.py
from jinja2 import Template
from typing import List
from datetime import datetime
from validation.calculator_validator import ValidationResult, ValidationMode

class ReportGenerator:
    """Generate validation reports in HTML and PDF"""

    def generate_html_report(
        self,
        results: List[ValidationResult],
        mode: ValidationMode
    ) -> str:
        """Generate HTML report"""

        # Calculate statistics
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed
        pass_rate = (passed / total * 100) if total > 0 else 0
        avg_dev = sum(r.max_deviation for r in results) / total if total > 0 else 0
        max_dev = max(r.max_deviation for r in results) if results else 0
        max_dev_file = max(results, key=lambda r: r.max_deviation).excel_file if results else ""

        template = Template("""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Validation Report - {{ mode.value|upper }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #2c3e50; }
        .summary { background: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .stat { display: inline-block; margin-right: 40px; }
        .stat-value { font-size: 28px; font-weight: bold; }
        .passed { color: #27ae60; }
        .failed { color: #e74c3c; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #bdc3c7; padding: 10px; text-align: left; }
        th { background: #34495e; color: white; }
        .file-passed { background: #d5f4e6; }
        .file-failed { background: #fadbd8; }
    </style>
</head>
<body>
    <h1>📊 Validation Report</h1>
    <p><strong>Mode:</strong> {{ mode.value|upper }}</p>
    <p><strong>Generated:</strong> {{ timestamp }}</p>

    <div class="summary">
        <div class="stat">
            <div>Total Files</div>
            <div class="stat-value">{{ total }}</div>
        </div>
        <div class="stat">
            <div>Passed</div>
            <div class="stat-value passed">{{ passed }}</div>
        </div>
        <div class="stat">
            <div>Failed</div>
            <div class="stat-value failed">{{ failed }}</div>
        </div>
        <div class="stat">
            <div>Pass Rate</div>
            <div class="stat-value">{{ "%.1f"|format(pass_rate) }}%</div>
        </div>
    </div>

    <h2>Results</h2>
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
            {% for result in results %}
            <tr class="{{ 'file-passed' if result.passed else 'file-failed' }}">
                <td>{{ result.excel_file }}</td>
                <td>{{ '✅ PASSED' if result.passed else '❌ FAILED' }}</td>
                <td>{{ "%.2f"|format(result.max_deviation) }}</td>
                <td>{{ result.failed_fields|join(', ') if result.failed_fields else '-' }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</body>
</html>
        """)

        return template.render(
            mode=mode,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total=total,
            passed=passed,
            failed=failed,
            pass_rate=pass_rate,
            avg_dev=avg_dev,
            max_dev=max_dev,
            max_dev_file=max_dev_file,
            results=results
        )
```

**Step 4: Install jinja2**

```bash
pip install jinja2
echo "jinja2==3.1.2" >> backend/requirements.txt
```

**Step 5: Run test to verify it passes**

```bash
pytest tests/validation/test_report_generator.py -v
```

Expected: PASS

**Step 6: Commit**

```bash
git add backend/validation/report_generator.py backend/tests/validation/ backend/requirements.txt
git commit -m "feat(validation): add HTML report generator

- Summary statistics (pass rate, deviations)
- Table with all file results
- Color-coded status (green/red)
- Jinja2 templates for formatting

🤖 Generated with Claude Code"
```

---

## Phase 3: Web UI (4-5 hours)

### Task 3.1: Create Backend API

**Files:**
- Create: `backend/routes/excel_validation.py`
- Modify: `backend/main.py:15-20` (add router)

**Step 1: Write API endpoint skeleton**

```python
# backend/routes/excel_validation.py
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from typing import List
from decimal import Decimal
import os
import tempfile

from auth import get_current_user, check_admin_permissions, User
from excel_parser.quote_parser import ExcelQuoteParser
from validation.calculator_validator import CalculatorValidator, ValidationMode

router = APIRouter(prefix="/api/admin/excel-validation", tags=["admin-validation"])

@router.post("/validate")
async def validate_excel_files(
    files: List[UploadFile] = File(...),
    mode: str = "summary",
    tolerance: float = 2.0,
    user: User = Depends(get_current_user)
):
    """Validate uploaded Excel files against calculation engine"""

    # Admin only
    await check_admin_permissions(user)

    # Limit files
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed"
        )

    results = []

    for file in files:
        # Save to temp
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            tmp.write(await file.read())
            temp_path = tmp.name

        try:
            # Parse Excel
            parser = ExcelQuoteParser(temp_path)
            excel_data = parser.parse()

            # Validate
            validator = CalculatorValidator(
                tolerance_rub=Decimal(str(tolerance)),
                mode=ValidationMode.SUMMARY if mode == "summary" else ValidationMode.DETAILED
            )
            result = validator.validate_quote(excel_data)

            # Convert to JSON-serializable format
            results.append({
                "filename": file.filename,
                "passed": result.passed,
                "max_deviation": float(result.max_deviation),
                "total_products": result.total_products,
                "failed_fields": result.failed_fields,
                "comparisons": [
                    {
                        "product_index": c.product_index,
                        "passed": c.passed,
                        "max_deviation": float(c.max_deviation),
                        "fields": [
                            {
                                "field": fc.field,
                                "field_name": fc.field_name,
                                "our_value": float(fc.our_value),
                                "excel_value": float(fc.excel_value),
                                "difference": float(fc.difference),
                                "passed": fc.passed,
                                "phase": fc.phase
                            }
                            for fc in c.field_comparisons
                        ]
                    }
                    for c in result.comparisons
                ]
            })

        except Exception as e:
            results.append({
                "filename": file.filename,
                "passed": False,
                "error": str(e)
            })

        finally:
            # Cleanup
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    # Summary stats
    total = len(results)
    passed = sum(1 for r in results if r.get("passed", False))
    failed = total - passed
    avg_dev = sum(r.get("max_deviation", 0) for r in results) / total if total > 0 else 0
    max_dev = max((r.get("max_deviation", 0) for r in results), default=0)

    return {
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": (passed / total * 100) if total > 0 else 0,
            "avg_deviation": avg_dev,
            "max_deviation": max_dev
        },
        "results": results
    }
```

**Step 2: Register router in main.py**

```python
# backend/main.py
# Add import
from routes import excel_validation

# Add after other routers (around line 20)
app.include_router(excel_validation.router)
```

**Step 3: Test API manually**

```bash
# Start backend
cd backend
uvicorn main:app --reload

# In another terminal, test with curl
curl -X POST http://localhost:8000/api/admin/excel-validation/validate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@validation_data/sample.xlsx" \
  -F "mode=summary" \
  -F "tolerance=2.0"
```

Expected: JSON response with summary and results

**Step 4: Commit**

```bash
git add backend/routes/excel_validation.py backend/main.py
git commit -m "feat(api): add Excel validation endpoint

- POST /api/admin/excel-validation/validate
- Admin-only access
- Max 10 files per request
- Returns summary stats and detailed comparisons
- Temp file cleanup

🤖 Generated with Claude Code"
```

---

### Task 3.2: Create Frontend UI

**Files:**
- Create: `frontend/src/app/admin/excel-validation/page.tsx`
- Create: `frontend/src/lib/api/excel-validation-service.ts`

**Step 1: Create API service**

```typescript
// frontend/src/lib/api/excel-validation-service.ts
import { apiClient } from './client';

export interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  avg_deviation: number;
  max_deviation: number;
}

export interface ValidationResult {
  filename: string;
  passed: boolean;
  max_deviation?: number;
  total_products?: number;
  failed_fields?: string[];
  error?: string;
  comparisons?: any[];
}

export interface ValidationResponse {
  summary: ValidationSummary;
  results: ValidationResult[];
}

class ExcelValidationService {
  async validateFiles(
    files: File[],
    mode: 'summary' | 'detailed',
    tolerance: number
  ): Promise<ValidationResponse> {
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('mode', mode);
    formData.append('tolerance', tolerance.toString());

    const response = await apiClient.post<ValidationResponse>(
      '/api/admin/excel-validation/validate',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  }
}

export const excelValidationService = new ExcelValidationService();
```

**Step 2: Create UI page**

```tsx
// frontend/src/app/admin/excel-validation/page.tsx
'use client';

import { useState } from 'react';
import {
  Upload,
  Button,
  Radio,
  InputNumber,
  Table,
  Modal,
  Card,
  Statistic,
  Row,
  Col,
  message,
  Space,
  Typography
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import { excelValidationService, ValidationResponse } from '@/lib/api/excel-validation-service';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function ExcelValidationPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'summary' | 'detailed'>('summary');
  const [tolerance, setTolerance] = useState(2.0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ValidationResponse | null>(null);

  const handleUpload = async () => {
    if (files.length === 0) {
      message.warning('Please upload at least one Excel file');
      return;
    }

    setLoading(true);

    try {
      const data = await excelValidationService.validateFiles(files, mode, tolerance);
      setResults(data);
      message.success('Validation complete');
    } catch (error: any) {
      message.error(`Validation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showDetailsModal = (fileResult: any) => {
    if (!fileResult.comparisons || fileResult.comparisons.length === 0) {
      return;
    }

    const firstProduct = fileResult.comparisons[0];

    Modal.info({
      title: `${fileResult.filename} - Validation Details`,
      width: 800,
      content: (
        <div>
          <Table
            dataSource={firstProduct.fields}
            columns={[
              { title: 'Field', dataIndex: 'field_name', width: 200 },
              {
                title: 'Excel',
                dataIndex: 'excel_value',
                render: (v) => v.toFixed(2),
                width: 100
              },
              {
                title: 'Our Calc',
                dataIndex: 'our_value',
                render: (v) => v.toFixed(2),
                width: 100
              },
              {
                title: 'Diff',
                dataIndex: 'difference',
                render: (v) => v.toFixed(2),
                width: 80
              },
              {
                title: 'Status',
                dataIndex: 'passed',
                render: (p) => (p ? '✅' : '❌'),
                width: 80
              }
            ]}
            pagination={false}
            size="small"
          />
        </div>
      )
    });
  };

  const uploadProps = {
    multiple: true,
    beforeUpload: (file: File) => {
      if (files.length >= 10) {
        message.warning('Maximum 10 files allowed');
        return false;
      }
      setFiles([...files, file]);
      return false;
    },
    fileList: files.map((f, i) => ({
      uid: i.toString(),
      name: f.name,
      status: 'done' as const
    })),
    onRemove: (file: any) => {
      const index = parseInt(file.uid);
      setFiles(files.filter((_, i) => i !== index));
    }
  };

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Title level={2}>Excel Validation Tool</Title>
        <Text type="secondary">
          Upload Excel files to validate calculation accuracy
        </Text>

        <Card style={{ marginTop: 24 }}>
          <Dragger {...uploadProps} style={{ marginBottom: 24 }}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag Excel files here
            </p>
            <p className="ant-upload-hint">
              Supports .xlsx files. Maximum 10 files at once.
            </p>
          </Dragger>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Text strong>Mode:</Text>
              <Radio.Group
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{ marginLeft: 16 }}
              >
                <Radio value="summary">Summary (3 fields)</Radio>
                <Radio value="detailed">Detailed (24 fields)</Radio>
              </Radio.Group>
            </Col>
            <Col span={12}>
              <Text strong>Tolerance:</Text>
              <InputNumber
                value={tolerance}
                onChange={(v) => setTolerance(v || 2.0)}
                min={0}
                step={0.5}
                addonAfter="₽"
                style={{ marginLeft: 16, width: 120 }}
              />
            </Col>
          </Row>

          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleUpload}
              loading={loading}
              disabled={files.length === 0}
            >
              Run Validation
            </Button>
            <Button
              icon={<DeleteOutlined />}
              onClick={() => {
                setFiles([]);
                setResults(null);
              }}
              disabled={files.length === 0}
            >
              Clear All
            </Button>
          </Space>
        </Card>

        {results && (
          <>
            <Card title="Summary Statistics" style={{ marginTop: 24 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="Total Files" value={results.summary.total} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Passed"
                    value={results.summary.passed}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Failed"
                    value={results.summary.failed}
                    valueStyle={{ color: '#cf1322' }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Pass Rate"
                    value={results.summary.pass_rate}
                    precision={1}
                    suffix="%"
                  />
                </Col>
              </Row>
            </Card>

            <Card title="Detailed Results" style={{ marginTop: 24 }}>
              <Table
                dataSource={results.results}
                rowKey="filename"
                columns={[
                  { title: 'File Name', dataIndex: 'filename' },
                  {
                    title: 'Status',
                    dataIndex: 'passed',
                    render: (passed, record: any) => (
                      record.error ? (
                        <Text type="danger">❌ ERROR</Text>
                      ) : passed ? (
                        <Text type="success">✅ PASSED</Text>
                      ) : (
                        <Text type="danger">❌ FAILED</Text>
                    ))
                  },
                  {
                    title: 'Max Deviation (₽)',
                    dataIndex: 'max_deviation',
                    render: (v) => (v !== undefined ? v.toFixed(2) : '-')
                  },
                  {
                    title: 'Failed Fields',
                    dataIndex: 'failed_fields',
                    render: (fields) => (fields && fields.length > 0 ? fields.join(', ') : '-')
                  },
                  {
                    title: 'Action',
                    render: (_, record: any) => (
                      record.comparisons && (
                        <Button
                          size="small"
                          onClick={() => showDetailsModal(record)}
                        >
                          View
                        </Button>
                      )
                    )
                  }
                ]}
                pagination={false}
              />
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
```

**Step 3: Add navigation link**

Modify `frontend/src/components/layout/MainLayout.tsx` to add menu item for admins:

```tsx
// Add in Settings submenu (for admin/owner users)
{
  key: 'excel-validation',
  label: <Link href="/admin/excel-validation">Excel Validation</Link>,
  icon: <FileExcelOutlined />
}
```

**Step 4: Test manually**

```bash
# Start frontend
cd frontend
npm run dev

# Navigate to http://localhost:3000/admin/excel-validation
# Upload test files and verify validation works
```

**Step 5: Commit**

```bash
git add frontend/src/app/admin/excel-validation/ frontend/src/lib/api/excel-validation-service.ts frontend/src/components/layout/MainLayout.tsx
git commit -m "feat(ui): add Excel validation admin page

- Drag-and-drop file upload (max 10 files)
- Mode selector (summary/detailed)
- Tolerance input
- Results table with statistics
- Detail modal for field comparison
- Admin-only access

🤖 Generated with Claude Code"
```

---

## Phase 4: Migration Module (3-4 hours)

### Task 4.1: Create Bulk Importer

**Files:**
- Create: `backend/migration/__init__.py`
- Create: `backend/migration/bulk_importer.py`
- Create: `backend/migration/progress_tracker.py`
- Create: `backend/tests/migration/__init__.py`
- Create: `backend/tests/migration/test_bulk_importer.py`

**Step 1: Create progress tracker**

```python
# backend/migration/progress_tracker.py
import sys
from datetime import datetime

class ProgressTracker:
    """Track import progress with visual feedback"""

    def __init__(self):
        self.total = 0
        self.current = 0
        self.start_time = None
        self.successful = 0
        self.failed = 0
        self.skipped = 0

    def start(self, total: int):
        """Start tracking"""
        self.total = total
        self.current = 0
        self.start_time = datetime.now()

        print(f"\n🚀 Starting import of {total} files...")
        print("=" * 60)

    def increment(self, status: str = "✅", message: str = ""):
        """Update progress"""
        self.current += 1

        if status == "✅":
            self.successful += 1
        elif status == "❌":
            self.failed += 1
        elif status == "⏭️":
            self.skipped += 1

        # Progress bar
        progress = self.current / self.total
        bar_length = 40
        filled = int(bar_length * progress)
        bar = "█" * filled + "░" * (bar_length - filled)

        # ETA
        elapsed = datetime.now() - self.start_time
        if self.current > 0:
            avg_time = elapsed / self.current
            remaining = avg_time * (self.total - self.current)
            eta = f"ETA: {str(remaining).split('.')[0]}"
        else:
            eta = "ETA: calculating..."

        # Print status
        sys.stdout.write(
            f"\r{status} [{bar}] {self.current}/{self.total} "
            f"({progress*100:.1f}%) | {eta} | "
            f"✅ {self.successful} ❌ {self.failed} ⏭️ {self.skipped}"
        )
        sys.stdout.flush()

        if status == "❌" and message:
            print(f"\n  ⚠️  {message}")

    def finish(self):
        """Finish tracking"""
        elapsed = datetime.now() - self.start_time

        print("\n" + "=" * 60)
        print(f"✅ Import complete in {str(elapsed).split('.')[0]}")
        print(f"   Successful: {self.successful}")
        print(f"   Failed:     {self.failed}")
        print(f"   Skipped:    {self.skipped}")
```

**Step 2: Create bulk importer (simplified version)**

```python
# backend/migration/bulk_importer.py
import asyncio
import asyncpg
import json
import os
from typing import List, Dict
from pathlib import Path
from datetime import datetime

from excel_parser.quote_parser import ExcelQuoteParser
from migration.progress_tracker import ProgressTracker

class BulkQuoteImporter:
    """Import Excel quotes into database"""

    def __init__(
        self,
        organization_id: str,
        user_id: str,
        batch_size: int = 50,
        dry_run: bool = False
    ):
        self.organization_id = organization_id
        self.user_id = user_id
        self.batch_size = batch_size
        self.dry_run = dry_run
        self.tracker = ProgressTracker()

    async def import_files(self, file_paths: List[str]) -> Dict:
        """Import multiple Excel files"""

        total = len(file_paths)
        self.tracker.start(total)

        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))

        try:
            results = {
                "total": total,
                "successful": 0,
                "failed": 0,
                "skipped": 0,
                "errors": []
            }

            # Process in batches
            for i in range(0, total, self.batch_size):
                batch = file_paths[i:i + self.batch_size]

                for filepath in batch:
                    try:
                        await self._import_single_file(conn, filepath)
                        results["successful"] += 1
                        self.tracker.increment(status="✅")

                    except FileExistsError:
                        results["skipped"] += 1
                        self.tracker.increment(status="⏭️", message="Duplicate")

                    except Exception as e:
                        results["failed"] += 1
                        results["errors"].append({
                            "file": Path(filepath).name,
                            "error": str(e)
                        })
                        self.tracker.increment(status="❌", message=str(e))

                # Commit batch
                if not self.dry_run:
                    await conn.execute("COMMIT")

                await asyncio.sleep(0.1)

            self.tracker.finish()
            return results

        finally:
            await conn.close()

    async def _import_single_file(self, conn, filepath: str):
        """Import one Excel file"""

        # Parse Excel
        parser = ExcelQuoteParser(filepath)
        excel_data = parser.parse()

        # Generate quote number
        quote_number = self._generate_quote_number(excel_data)

        # Check duplicate
        existing = await conn.fetchrow(
            "SELECT id FROM quotes WHERE organization_id = $1 AND quote_number = $2",
            self.organization_id,
            quote_number
        )

        if existing:
            raise FileExistsError(f"Quote {quote_number} already exists")

        if self.dry_run:
            return

        # Create customer
        customer_id = await self._ensure_customer(conn, "Imported Customer")

        # Create quote
        quote_id = await self._create_quote(conn, excel_data, quote_number, customer_id)

        # Create products
        await self._create_products(conn, quote_id, excel_data.inputs["products"])

    def _generate_quote_number(self, excel_data) -> str:
        """Generate quote number from filename"""
        filename = Path(excel_data.filename).stem
        if filename.startswith("quote_"):
            number = filename.split("_")[1]
            return f"КП-{number}"
        return f"КП-IMP-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    async def _ensure_customer(self, conn, customer_name: str) -> str:
        """Get or create customer"""
        result = await conn.fetchrow(
            "INSERT INTO customers (organization_id, name, company_type, status, created_by) "
            "VALUES ($1, $2, 'organization', 'active', $3) "
            "ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name "
            "RETURNING id",
            self.organization_id,
            customer_name,
            self.user_id
        )
        return result["id"]

    async def _create_quote(self, conn, excel_data, quote_number: str, customer_id: str) -> str:
        """Create quote record"""
        quote_vars = excel_data.inputs["quote"]

        result = await conn.fetchrow(
            "INSERT INTO quotes (organization_id, customer_id, quote_number, status, "
            "seller_company, created_by) VALUES ($1, $2, $3, 'draft', $4, $5) RETURNING id",
            self.organization_id,
            customer_id,
            quote_number,
            quote_vars.get("seller_company", "Unknown"),
            self.user_id
        )

        return result["id"]

    async def _create_products(self, conn, quote_id: str, products: List[Dict]):
        """Create product records"""
        for i, product in enumerate(products):
            await conn.execute(
                "INSERT INTO quote_items (quote_id, product_name, quantity, "
                "base_price_vat, line_number) VALUES ($1, $2, $3, $4, $5)",
                quote_id,
                f"Product {i+1}",
                product.get("quantity", 1),
                product.get("base_price_VAT", 0),
                i + 1
            )
```

**Step 3: Commit**

```bash
git add backend/migration/ backend/tests/migration/
git commit -m "feat(migration): add bulk importer with progress tracking

- Batch processing (50 files per transaction)
- Progress bar with ETA
- Duplicate detection
- Error handling with continue-on-error
- Dry-run mode for safety

🤖 Generated with Claude Code"
```

---

### Task 4.2: Create CLI Script

**Files:**
- Create: `scripts/import_quotes.py`

**Step 1: Create CLI script**

```python
# scripts/import_quotes.py
#!/usr/bin/env python3
import sys
import argparse
import asyncio
import glob
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from migration.bulk_importer import BulkQuoteImporter

async def main():
    parser = argparse.ArgumentParser(
        description="Bulk import Excel quotes into database"
    )
    parser.add_argument(
        "files",
        nargs="+",
        help="Excel file paths (supports wildcards)"
    )
    parser.add_argument(
        "--org-id",
        required=True,
        help="Organization UUID"
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="User UUID (importer)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Files per batch (default: 50)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate without database writes"
    )

    args = parser.parse_args()

    # Expand wildcards
    file_paths = []
    for pattern in args.files:
        file_paths.extend(glob.glob(pattern))

    if not file_paths:
        print("❌ No files found")
        return 1

    print(f"📂 Found {len(file_paths)} Excel files")

    if args.dry_run:
        print("⚠️  DRY RUN MODE - No data will be written")
    else:
        response = input(f"\n⚠️  Import {len(file_paths)} quotes? (yes/no): ")
        if response.lower() != "yes":
            print("❌ Import cancelled")
            return 0

    # Create importer
    importer = BulkQuoteImporter(
        organization_id=args.org_id,
        user_id=args.user_id,
        batch_size=args.batch_size,
        dry_run=args.dry_run
    )

    # Run import
    results = await importer.import_files(file_paths)

    # Print summary
    print("\n" + "=" * 60)
    print("📊 IMPORT SUMMARY")
    print("=" * 60)
    print(f"Total files:    {results['total']}")
    print(f"✅ Successful:  {results['successful']}")
    print(f"⏭️  Skipped:     {results['skipped']}")
    print(f"❌ Failed:      {results['failed']}")

    if results['errors']:
        print("\n❌ ERRORS:")
        for error in results['errors']:
            print(f"  {error['file']}: {error['error']}")

    return 0 if results['failed'] == 0 else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
```

**Step 2: Make executable**

```bash
chmod +x scripts/import_quotes.py
```

**Step 3: Test with dry-run**

```bash
python scripts/import_quotes.py validation_data/*.xlsx \
  --org-id "test-org-id" \
  --user-id "test-user-id" \
  --dry-run
```

Expected: Progress bar with dry-run messages

**Step 4: Commit**

```bash
git add scripts/import_quotes.py
git commit -m "feat(migration): add CLI script for bulk import

- Supports wildcards (*.xlsx)
- Confirmation prompt
- Dry-run mode
- Error summary report
- Progress tracking with ETA

Usage:
  python scripts/import_quotes.py data/*.xlsx --org-id <id> --user-id <id>

🤖 Generated with Claude Code"
```

---

## Phase 5: Pytest Integration (2-3 hours)

### Task 5.1: Create Parametrized Tests

**Files:**
- Create: `backend/tests/validation/test_excel_validation_e2e.py`
- Modify: `backend/pytest.ini` (add markers)

**Step 1: Create parametrized test**

```python
# backend/tests/validation/test_excel_validation_e2e.py
import pytest
from pathlib import Path
import glob
from decimal import Decimal

from excel_parser.quote_parser import ExcelQuoteParser
from validation.calculator_validator import CalculatorValidator, ValidationMode

# Collect all Excel files
VALIDATION_DIR = Path(__file__).parent.parent.parent.parent / "validation_data"
excel_files = glob.glob(str(VALIDATION_DIR / "*.xlsx"))

@pytest.fixture
def validator_summary():
    return CalculatorValidator(
        tolerance_rub=Decimal("2.0"),
        mode=ValidationMode.SUMMARY
    )

@pytest.fixture
def validator_detailed():
    return CalculatorValidator(
        tolerance_rub=Decimal("2.0"),
        mode=ValidationMode.DETAILED
    )

@pytest.mark.parametrize("excel_path", excel_files, ids=lambda p: Path(p).name)
def test_excel_validation_summary(excel_path, validator_summary):
    """Test calculation matches Excel (summary mode)"""

    # Parse Excel
    parser = ExcelQuoteParser(excel_path)
    excel_data = parser.parse()

    # Validate
    result = validator_summary.validate_quote(excel_data)

    # Assert
    assert result.passed, (
        f"\n❌ Validation failed for {excel_data.filename}\n"
        f"Max deviation: {result.max_deviation:.2f} ₽\n"
        f"Failed fields: {', '.join(result.failed_fields)}"
    )

@pytest.mark.detailed
@pytest.mark.parametrize("excel_path", excel_files, ids=lambda p: Path(p).name)
def test_excel_validation_detailed(excel_path, validator_detailed):
    """Test ALL phases match Excel (detailed mode)"""

    parser = ExcelQuoteParser(excel_path)
    excel_data = parser.parse()
    result = validator_detailed.validate_quote(excel_data)

    if not result.passed:
        error_details = []
        for comp in result.comparisons:
            if not comp.passed:
                error_details.append(f"\nProduct {comp.product_index + 1}:")
                for fc in comp.field_comparisons:
                    if not fc.passed:
                        error_details.append(
                            f"  {fc.field} ({fc.field_name}): "
                            f"{fc.our_value:.2f} vs {fc.excel_value:.2f} "
                            f"(diff: {fc.difference:.2f} ₽)"
                        )

        assert False, (
            f"\n❌ Detailed validation failed for {excel_data.filename}\n"
            + "\n".join(error_details)
        )

def test_overall_accuracy(validator_summary):
    """Test overall accuracy across all files"""

    results = []
    for excel_path in excel_files:
        parser = ExcelQuoteParser(excel_path)
        excel_data = parser.parse()
        result = validator_summary.validate_quote(excel_data)
        results.append(result)

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    pass_rate = (passed / total * 100) if total > 0 else 0
    avg_dev = sum(r.max_deviation for r in results) / total if total > 0 else 0

    assert pass_rate >= 95.0, f"Pass rate {pass_rate:.1f}% below 95% threshold"
    assert avg_dev < Decimal("1.0"), f"Avg deviation {avg_dev:.2f} ₽ above 1 ₽"
```

**Step 2: Add pytest markers**

```ini
# backend/pytest.ini
[pytest]
markers =
    detailed: marks tests as detailed validation (deselect with '-m "not detailed"')
    validation: marks tests as validation tests
```

**Step 3: Run tests**

```bash
cd backend

# Summary mode tests
pytest tests/validation/test_excel_validation_e2e.py -v -m "not detailed"

# Detailed mode tests
pytest tests/validation/test_excel_validation_e2e.py -v -m detailed

# Overall accuracy test
pytest tests/validation/test_excel_validation_e2e.py::test_overall_accuracy -v
```

**Step 4: Generate HTML report**

```bash
pytest tests/validation/ --html=validation_report.html --self-contained-html
```

**Step 5: Commit**

```bash
git add backend/tests/validation/test_excel_validation_e2e.py backend/pytest.ini
git commit -m "test(validation): add parametrized E2E tests

- One test per Excel file (parametrization)
- Summary and detailed modes
- Overall accuracy test (95% pass rate, <1₽ avg)
- HTML report generation
- CI/CD ready

🤖 Generated with Claude Code"
```

---

## Final Steps

### Task 6.1: Update Documentation

**Files:**
- Create: `backend/excel_parser/README.md`
- Create: `backend/validation/README.md`
- Create: `backend/migration/README.md`
- Modify: `.claude/SESSION_PROGRESS.md` (add session entry)

**Step 1: Write README files (abbreviated)**

**Step 2: Update SESSION_PROGRESS.md**

Add new session entry documenting:
- What was built
- Time spent
- Files created/modified
- Testing status

**Step 3: Commit**

```bash
git add backend/*/README.md .claude/SESSION_PROGRESS.md
git commit -m "docs: add module READMEs and session progress

- Excel parser documentation
- Validation module guide
- Migration module guide
- Session 37 entry in SESSION_PROGRESS.md

🤖 Generated with Claude Code"
```

---

### Task 6.2: Final Testing

**Step 1: Run all tests**

```bash
cd backend
pytest -v

cd ../frontend
npm test
```

**Step 2: Manual testing checklist**

- [ ] Upload 3 Excel files via Web UI
- [ ] Verify validation results display correctly
- [ ] Test detailed modal
- [ ] Run migration with dry-run
- [ ] Verify pytest HTML report

**Step 3: Commit any fixes**

---

## Success Criteria

- ✅ All unit tests passing
- ✅ Web UI loads and accepts file uploads
- ✅ Validation produces accurate results
- ✅ Migration completes without errors
- ✅ Pytest generates HTML reports
- ✅ Documentation complete

---

## Estimated Time Breakdown

- Phase 1 (Parser): 3-4 hours
- Phase 2 (Validator): 3-4 hours
- Phase 3 (Web UI): 4-5 hours
- Phase 4 (Migration): 3-4 hours
- Phase 5 (Pytest): 2-3 hours
- Final (Docs/Testing): 1-2 hours

**Total: 16-22 hours**

---

## Notes for Implementation

**TDD Workflow:**
- Write test first
- Run to see it fail
- Write minimal code to pass
- Commit frequently

**Testing Strategy:**
- Unit tests for each module
- Integration tests for end-to-end flows
- Manual testing for UI

**Reference Skills:**
- @backend-dev-guidelines for FastAPI patterns
- @calculation-engine-guidelines for variable mapping
- @database-verification for RLS checks

---

**Plan Status:** Ready for execution
**Next Step:** Choose execution mode (subagent-driven or parallel session)
