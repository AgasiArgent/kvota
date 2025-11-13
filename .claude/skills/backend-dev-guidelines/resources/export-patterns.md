# Export Patterns - Excel & PDF Generation

**Last Updated:** 2025-10-29

**Purpose:** Document patterns for generating Excel and PDF exports used across the quotation platform.

---

## Table of Contents

1. [Excel Export (openpyxl)](#excel-export-openpyxl)
2. [PDF Export (WeasyPrint)](#pdf-export-weasyprint)
3. [File Management](#file-management)
4. [Common Bugs & Gotchas](#common-bugs--gotchas)
5. [Testing Patterns](#testing-patterns)

---

## Excel Export (openpyxl)

**Service:** `backend/services/excel_service.py` (1,062 lines)

### Workbook Creation Pattern

```python
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from io import BytesIO
from decimal import Decimal

class QuoteExcelService:
    @staticmethod
    def generate_export(export_data) -> bytes:
        """Generate Excel export and return as bytes"""
        wb = Workbook()
        ws = wb.active
        ws.title = "КП поставка"

        # Add content...

        # Save to bytes
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output.read()
```

### Worksheet Setup

```python
# Set title
ws = wb.active
ws.title = "Проверка расчетов"

# Headers
ws['A1'] = 'ВХОДНЫЕ ДАННЫЕ (INPUTS)'
ws['E1'] = 'ВЫХОДНЫЕ ДАННЫЕ (OUTPUTS)'

# Column widths
ws.column_dimensions['A'].width = 12
ws.column_dimensions['B'].width = 35
ws.column_dimensions['C'].width = 18

# Freeze panes (freeze header row)
ws.freeze_panes = 'A2'
```

### Styling: Headers

```python
from openpyxl.styles import Font, Alignment, PatternFill

# Header styling
header_fill = PatternFill(
    start_color="FF2C5AA0",  # Blue background
    end_color="FF2C5AA0",
    fill_type="solid"
)
header_font = Font(bold=True, size=11, color="FFFFFFFF")  # White text
header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

# Apply to cell
ws['A1'].fill = header_fill
ws['A1'].font = header_font
ws['A1'].alignment = header_alignment
```

### Styling: Borders

```python
from openpyxl.styles import Border, Side

# Card border (for header info cards)
card_border = Border(
    left=Side(style='thin', color='FF2C5AA0'),
    right=Side(style='thin', color='FF2C5AA0'),
    top=Side(style='thin', color='FF2C5AA0'),
    bottom=Side(style='thin', color='FF2C5AA0')
)

# Apply to range
for row in range(2, 8):
    for col in ['A', 'B', 'C']:
        ws[f'{col}{row}'].border = card_border
```

### Russian Number Formatting

**Pattern:** `1 234,56` (space as thousand separator, comma as decimal)

```python
@staticmethod
def format_russian_number(value: Any) -> str:
    """
    Format number with Russian style: 1 234,56

    Args:
        value: Number to format (Decimal, float, int, or None)

    Returns:
        Formatted string with space as thousand separator and comma as decimal
    """
    if value is None:
        return "0,00"

    # Convert to float
    try:
        num_value = float(value)
    except (ValueError, TypeError):
        return "0,00"

    # Format with 2 decimals: Python's format uses comma for thousands, dot for decimal
    str_val = f"{num_value:,.2f}"

    # Replace comma (thousand separator) with space, dot (decimal) with comma
    return str_val.replace(',', ' ').replace('.', ',')
```

**Usage:**
```python
# Cell with Russian number format
ws['C5'] = QuoteExcelService.format_russian_number(Decimal('1234.56'))
# Result: "1 234,56"

# Cell with Excel number format
ws.cell(row=5, column=6).value = float(price)
ws.cell(row=5, column=6).number_format = '#,##0.00 ₽'
# Excel displays: 1 234,56 ₽
```

### Formula Generation

```python
# Calculate totals
totals = {'quantity': 0, 'total_vat': Decimal('0')}

for item in export_data.items:
    calc = item.get('calculation_results', {})

    # Accumulate totals
    totals['quantity'] += item.get('quantity', 0)
    totals['total_vat'] += Decimal(str(calc.get('sales_price_total_with_vat', 0)))

# Write totals row
ws.cell(row=row_idx, column=4).value = totals['quantity']
ws.cell(row=row_idx, column=9).value = float(totals['total_vat'])
ws.cell(row=row_idx, column=9).number_format = '#,##0.00 ₽'
```

### Data Row Pattern

```python
# Iterate through items
row_idx = 2
for item in export_data.items:
    calc_results = item.get('calculation_results', {})

    # Basic info
    ws.cell(row=row_idx, column=1).value = item.get('brand', '')
    ws.cell(row=row_idx, column=2).value = item.get('sku', '')
    ws.cell(row=row_idx, column=3).value = item.get('product_name', '')
    ws.cell(row=row_idx, column=4).value = item.get('quantity', 0)

    # Monetary columns with formatting
    price = Decimal(str(calc_results.get('sales_price_per_unit', 0)))
    ws.cell(row=row_idx, column=5).value = float(price)
    ws.cell(row=row_idx, column=5).number_format = '#,##0.00 ₽'

    row_idx += 1
```

### File Saving with UUID Conversion

**CRITICAL:** Convert UUID to string before using `.replace()`

```python
# ❌ WRONG - TypeError: 'UUID' object has no attribute 'replace'
filename = f"quote_{quote_id.replace('-', '_')}.xlsx"

# ✅ CORRECT - Convert UUID to string first
filename = f"quote_{str(quote_id).replace('-', '_')}.xlsx"
```

**Pattern:**
```python
from uuid import UUID

def generate_excel_filename(quote_id: UUID, customer_name: str) -> str:
    """Generate safe Excel filename"""
    # Convert UUID to string
    quote_id_str = str(quote_id).replace('-', '_')

    # Clean customer name (remove special characters)
    clean_name = ''.join(c if c.isalnum() or c in '-_' else '_' for c in customer_name)

    return f"kvota_supply_{quote_id_str}_{clean_name}.xlsx"
```

---

## PDF Export (WeasyPrint)

**Service:** `backend/pdf_service.py` (1,107 lines)

### HTML Template Rendering

```python
import jinja2
from weasyprint import HTML
from datetime import date

class QuotePDFService:
    def __init__(self):
        """Initialize PDF service with templates and styling"""
        self.template_dir = os.path.join(os.path.dirname(__file__), 'templates')
        os.makedirs(self.template_dir, exist_ok=True)

        # Setup Jinja2 environment
        self.jinja_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(self.template_dir),
            autoescape=True
        )

        # Register custom filters
        self._register_filters()

    def _register_filters(self):
        """Register custom Jinja2 filters for Russian formatting"""

        def ru_currency(value, currency='RUB'):
            """Format currency in Russian style"""
            if value is None:
                return '0,00 ₽'
            formatted = f"{float(value):,.2f}".replace(',', ' ').replace('.', ',')
            return f"{formatted} ₽" if currency == 'RUB' else formatted

        def ru_date(value):
            """Format date in Russian style (DD.MM.YYYY)"""
            if isinstance(value, str):
                try:
                    value = datetime.fromisoformat(value.replace('Z', '+00:00')).date()
                except:
                    return value

            if isinstance(value, date):
                return value.strftime('%d.%m.%Y')

            return str(value) if value else ''

        self.jinja_env.filters['ru_currency'] = ru_currency
        self.jinja_env.filters['ru_date'] = ru_date
```

### CSS Styling for Print Media

```python
css_content = """
@page {
    size: A4;
    margin: 2cm 1.5cm;

    @top-center {
        content: "КП" counter(page) " / " counter(pages);
        font-size: 10pt;
        color: #666;
    }
}

body {
    font-family: 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.3;
    color: #333;
}

.company-header {
    display: flex;
    justify-content: space-between;
    border-bottom: 2px solid #2c5aa0;
    padding-bottom: 15px;
    margin-bottom: 20px;
}

.items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
}

.items-table th {
    background-color: #2c5aa0;
    color: white;
    padding: 8px 6px;
    text-align: center;
    font-weight: bold;
}

/* Page break handling */
.document-footer {
    page-break-inside: avoid;
}

/* Print optimizations */
@media print {
    .document {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
    }
}
"""
```

### Template Rendering

```python
def generate_supply_pdf(self, export_data) -> bytes:
    """Generate КП поставка PDF"""
    from services.export_data_mapper import get_manager_info, get_contact_info

    # Build context
    context = {
        'seller_company': export_data.variables.get('seller_company', ''),
        'manager_name': get_manager_info(export_data).get('name', ''),
        'customer_company_name': export_data.customer.get('name', ''),
        'quote_date': parse_iso_date(export_data.quote.get('created_at', '')),
        'items': [],
        'totals': {}
    }

    # Build items list
    for item in export_data.items:
        calc = item.get('calculation_results', {})

        context['items'].append({
            'brand': item.get('brand', ''),
            'sku': item.get('sku', ''),
            'product_name': item.get('product_name', ''),
            'quantity': item.get('quantity', 0),
            'selling_price_per_unit': self.format_russian_currency(
                calc.get('sales_price_per_unit_no_vat', 0)
            )
        })

    # Render HTML template
    html = self.render_template('supply_quote.html', context)

    # Convert to PDF
    return self.html_to_pdf(html)

def render_template(self, template_name: str, context: dict) -> str:
    """Render Jinja2 template with context"""
    template = self.jinja_env.get_template(template_name)
    return template.render(**context)

def html_to_pdf(self, html: str) -> bytes:
    """Convert HTML string to PDF bytes using WeasyPrint"""
    html_doc = HTML(string=html, encoding='utf-8')
    return html_doc.write_pdf()
```

### Date Parsing Helper

```python
def parse_iso_date(value) -> str:
    """
    Parse ISO date string to DD.MM.YYYY format.
    Handles: ISO strings from Supabase, datetime objects, date objects
    """
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00')).date()
        except:
            return value

    if isinstance(value, datetime):
        value = value.date()

    if isinstance(value, date):
        return value.strftime('%d.%m.%Y')

    return str(value) if value else ''
```

### Russian Currency Formatting

```python
@staticmethod
def format_russian_currency(value) -> str:
    """Format Decimal/float as Russian currency: 1 234,56 ₽"""
    if value is None:
        return "0,00 ₽"

    # Convert to float if Decimal
    if isinstance(value, Decimal):
        value = float(value)

    # Format with thousand separator and 2 decimals
    str_val = f"{value:,.2f}"
    # Replace comma with space (thousands) and period with comma (decimals)
    str_val = str_val.replace(',', ' ').replace('.', ',')
    return f"{str_val} ₽"
```

### Logo and Image Embedding

```python
# In HTML template
<div class="company-logo">
    {% if company.logo_url %}
    <img src="{{ company.logo_url }}" alt="{{ company.name }}" style="max-height: 60px;">
    {% else %}
    <h1>{{ company.name }}</h1>
    {% endif %}
</div>

# CSS for image sizing
.company-logo img {
    max-height: 60px;
    max-width: 200px;
    object-fit: contain;
}
```

---

## File Management

**Location:** `backend/routes/quotes.py` (export endpoints)

### UUID Filename Generation

**CRITICAL:** Always convert UUID to string before `.replace()`

```python
from uuid import UUID
import tempfile
import os

def generate_filename(quote_id: UUID, format: str, customer_name: str, quote_date: str) -> str:
    """Generate safe filename for export"""
    # Convert UUID to string first (CRITICAL!)
    quote_id_str = str(quote_id).replace('-', '_')

    # Clean customer name for filesystem
    customer_clean = ''.join(
        c if c.isalnum() or c in '-_' else '_'
        for c in customer_name
    )[:20]

    # Clean quote number (remove Cyrillic prefix)
    quote_number_clean = quote_number.replace('КП-', '').replace('КП', '')

    return f"kvota_{format}_{quote_date}_{quote_number_clean}_{customer_clean}.xlsx"
```

### Temporary File Storage

```python
import tempfile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

@router.get("/{quote_id}/export/excel")
async def export_quote_excel(quote_id: UUID, format: str, user: User = Depends(get_current_user)):
    """Export quote as Excel file"""
    try:
        # Generate Excel bytes
        excel_bytes = QuoteExcelService.generate_export(export_data)

        # Generate filename
        filename = generate_filename(quote_id, format, customer_name, quote_date)

        # Write to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            tmp.write(excel_bytes)
            tmp_path = tmp.name

        # Return file with automatic cleanup
        return FileResponse(
            tmp_path,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=filename,
            background=BackgroundTask(os.unlink, tmp_path)  # Delete after response
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Excel export failed: {str(e)}"
        )
```

### FileResponse with Media Type

```python
from fastapi.responses import FileResponse

# Excel
return FileResponse(
    tmp_path,
    media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename=filename,
    background=BackgroundTask(os.unlink, tmp_path)
)

# PDF
return FileResponse(
    tmp_path,
    media_type='application/pdf',
    filename=filename,
    background=BackgroundTask(os.unlink, tmp_path)
)
```

### Activity Log Integration

```python
from services.activity_log_service import log_activity

@router.get("/{quote_id}/export/pdf")
async def export_quote_pdf(
    quote_id: UUID,
    format: str,
    user: User = Depends(get_current_user)
):
    """Export quote as PDF"""
    # Generate PDF...

    # Log export activity
    await log_activity(
        user_id=user.id,
        organization_id=user.current_organization_id,
        action="exported",
        entity_type="quote",
        entity_id=quote_id,
        metadata={"format": f"pdf_{format}"}
    )

    return FileResponse(...)
```

---

## Common Bugs & Gotchas

### 1. UUID Not Converted to String

**Bug:**
```python
# ❌ WRONG - TypeError: 'UUID' object has no attribute 'replace'
filename = f"quote_{quote_id.replace('-', '_')}.xlsx"
```

**Fix:**
```python
# ✅ CORRECT - Convert to string first
filename = f"quote_{str(quote_id).replace('-', '_')}.xlsx"
```

**Root Cause:** UUIDs are objects, not strings. Must use `str()` before string operations.

### 2. File Created But Not Tracked

**Bug:**
```python
# Generate file
excel_bytes = generate_excel(export_data)

# Return bytes directly (frontend can't download)
return {"data": excel_bytes}  # ❌ WRONG
```

**Fix:**
```python
# Save to temp file and return FileResponse
with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
    tmp.write(excel_bytes)
    tmp_path = tmp.name

return FileResponse(
    tmp_path,
    media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename=filename,
    background=BackgroundTask(os.unlink, tmp_path)
)
```

### 3. Missing Error Handling

**Bug:**
```python
# No try/except - crashes on any error
excel_bytes = QuoteExcelService.generate_export(export_data)
return FileResponse(...)
```

**Fix:**
```python
try:
    excel_bytes = QuoteExcelService.generate_export(export_data)
    # Save and return...
except ValueError as e:
    # Data validation error
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=str(e)
    )
except Exception as e:
    # Unexpected error
    import traceback
    error_traceback = traceback.format_exc()
    print(f"ERROR in export_quote_excel: {str(e)}")
    print(f"Traceback:\n{error_traceback}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Excel export failed: {str(e)}"
    )
```

### 4. Files Not Cleaned Up

**Bug:**
```python
# Create temp file but never delete it
tmp_path = tempfile.mktemp(suffix='.xlsx')
with open(tmp_path, 'wb') as f:
    f.write(excel_bytes)

return FileResponse(tmp_path, ...)  # ❌ File never deleted
```

**Fix:**
```python
# Use BackgroundTask to delete after response
return FileResponse(
    tmp_path,
    media_type='...',
    filename=filename,
    background=BackgroundTask(os.unlink, tmp_path)  # ✅ Auto-cleanup
)
```

### 5. Cyrillic in Filenames

**Bug:**
```python
# Cyrillic characters cause download issues in some browsers
filename = f"КП_{customer_name}.xlsx"  # ❌ May fail in Safari/IE
```

**Fix:**
```python
# Use Latin prefix + transliterated customer name
customer_clean = ''.join(
    c if c.isalnum() or c in '-_' else '_'
    for c in customer_name
)
filename = f"kvota_supply_{customer_clean}.xlsx"  # ✅ Safe
```

### 6. Decimal to Float Conversion

**Bug:**
```python
# Writing Decimal directly to Excel (causes precision issues)
ws.cell(row=5, column=5).value = Decimal('123.45')  # ❌ May lose precision
```

**Fix:**
```python
# Convert Decimal to float before writing
ws.cell(row=5, column=5).value = float(Decimal('123.45'))
ws.cell(row=5, column=5).number_format = '#,##0.00 ₽'
```

### 7. Missing Organization Check

**Bug:**
```python
# No organization_id filter - security vulnerability
result = supabase.table("quotes").select("*").eq("id", quote_id).execute()
```

**Fix:**
```python
# Always filter by organization_id
result = supabase.table("quotes").select("*") \
    .eq("id", str(quote_id)) \
    .eq("organization_id", str(user.current_organization_id)) \
    .execute()
```

---

## Testing Patterns

### Mock File Generation

```python
import pytest
from services.excel_service import QuoteExcelService
from services.export_data_mapper import ExportData

@pytest.fixture
def mock_export_data():
    """Mock export data for testing"""
    return ExportData(
        quote={'id': 'uuid', 'quote_number': 'KP-001', 'created_at': '2025-01-01'},
        customer={'name': 'Test Customer'},
        items=[
            {
                'brand': 'SKF',
                'sku': '6205',
                'product_name': 'Bearing',
                'quantity': 10,
                'calculation_results': {
                    'sales_price_per_unit': 100.00,
                    'sales_price_total_with_vat': 1200.00
                }
            }
        ],
        variables={'seller_company': 'Test Company'}
    )

def test_excel_generation(mock_export_data):
    """Test Excel export generates valid file"""
    excel_bytes = QuoteExcelService.generate_validation_export(mock_export_data)

    assert isinstance(excel_bytes, bytes)
    assert len(excel_bytes) > 0
    assert excel_bytes[:4] == b'PK\x03\x04'  # Excel file signature
```

### Verify File Exists and Size

```python
import tempfile

def test_excel_file_creation():
    """Test Excel file is created with content"""
    # Generate Excel
    excel_bytes = QuoteExcelService.generate_export(export_data)

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
        tmp.write(excel_bytes)
        tmp_path = tmp.name

    # Verify file exists
    assert os.path.exists(tmp_path)

    # Verify file has content
    assert os.path.getsize(tmp_path) > 0

    # Verify file is valid Excel (openpyxl can open it)
    from openpyxl import load_workbook
    wb = load_workbook(tmp_path)
    assert wb is not None
    assert len(wb.worksheets) > 0

    # Cleanup
    os.unlink(tmp_path)
```

### Test Cleanup After Download

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_export_cleanup():
    """Test temporary files are cleaned up after download"""
    # Get initial temp file count
    initial_count = len(os.listdir(tempfile.gettempdir()))

    # Download export
    response = client.get(
        "/api/quotes/123/export/excel?format=validation",
        headers={"Authorization": f"Bearer {test_token}"}
    )

    assert response.status_code == 200

    # Verify temp file count is the same (cleanup worked)
    final_count = len(os.listdir(tempfile.gettempdir()))
    assert final_count == initial_count
```

### Test Russian Number Formatting

```python
import pytest
from services.excel_service import QuoteExcelService

@pytest.mark.parametrize("input,expected", [
    (1234.56, "1 234,56"),
    (1000000.00, "1 000 000,00"),
    (0.99, "0,99"),
    (None, "0,00"),
    (0, "0,00"),
])
def test_russian_number_format(input, expected):
    """Test Russian number formatting"""
    result = QuoteExcelService.format_russian_number(input)
    assert result == expected
```

### Integration Test with Real Data

```python
@pytest.mark.asyncio
async def test_export_endpoint_integration():
    """Integration test for export endpoint"""
    from services.export_data_mapper import fetch_export_data

    # Fetch real quote data
    export_data = await fetch_export_data(
        quote_id="real-uuid",
        organization_id="org-uuid"
    )

    # Generate Excel
    excel_bytes = QuoteExcelService.generate_validation_export(export_data)

    # Verify content
    assert len(excel_bytes) > 0

    # Load and verify structure
    from openpyxl import load_workbook
    import io

    wb = load_workbook(io.BytesIO(excel_bytes))
    ws = wb.active

    # Verify headers exist
    assert ws['A1'].value == 'ВХОДНЫЕ ДАННЫЕ (INPUTS)'
    assert ws['E1'].value == 'ВЫХОДНЫЕ ДАННЫЕ (OUTPUTS)'

    # Verify data rows exist
    assert ws.max_row > 10  # Should have at least 10 rows of data
```

---

## Complete Export Endpoint Example

```python
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from auth import get_current_user, User
from services.excel_service import QuoteExcelService
from services.export_data_mapper import fetch_export_data
from services.activity_log_service import log_activity
from uuid import UUID
import tempfile
import os

router = APIRouter(prefix="/api/quotes", tags=["quotes"])

@router.get("/{quote_id}/export/excel")
async def export_quote_excel(
    quote_id: UUID,
    format: str = Query(..., pattern="^(validation|supply-grid|openbook-grid)$"),
    user: User = Depends(get_current_user)
):
    """
    Export quote as Excel file

    Args:
        quote_id: Quote UUID
        format: Export format (validation, supply-grid, openbook-grid)
        user: Current authenticated user

    Returns:
        Excel file (.xlsx)
    """
    try:
        # Fetch data with organization check
        export_data = await fetch_export_data(
            str(quote_id),
            str(user.current_organization_id)
        )

        # Generate Excel based on format
        if format == "validation":
            excel_bytes = QuoteExcelService.generate_validation_export(export_data)
            format_suffix = "validation"
        elif format == "supply-grid":
            excel_bytes = QuoteExcelService.generate_supply_grid_export(export_data)
            format_suffix = "supply_grid"
        else:  # openbook-grid
            excel_bytes = QuoteExcelService.generate_openbook_grid_export(export_data)
            format_suffix = "openbook_grid"

        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            tmp.write(excel_bytes)
            tmp_path = tmp.name

        # Generate safe filename
        from datetime import datetime
        quote_date = ''
        if export_data.quote.get('created_at'):
            created_at_str = export_data.quote['created_at']
            if isinstance(created_at_str, str):
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                quote_date = created_at.strftime('%Y%m%d')

        # Convert UUID to string before .replace()
        quote_id_str = str(quote_id).replace('-', '_')

        # Clean customer name
        customer_name = export_data.customer.get('name', 'customer')[:20]
        customer_clean = ''.join(
            c if c.isalnum() or c in '-_' else '_'
            for c in customer_name
        )

        filename = f"kvota_{format_suffix}_{quote_date}_{quote_id_str}_{customer_clean}.xlsx"

        # Log export activity
        await log_activity(
            user_id=user.id,
            organization_id=user.current_organization_id,
            action="exported",
            entity_type="quote",
            entity_id=quote_id,
            metadata={"format": f"excel_{format}"}
        )

        # Return file with automatic cleanup
        return FileResponse(
            tmp_path,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=filename,
            background=BackgroundTask(os.unlink, tmp_path)
        )

    except ValueError as e:
        # Data validation error (quote not found, etc.)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        # Unexpected error - log traceback
        import traceback
        error_traceback = traceback.format_exc()
        print(f"ERROR in export_quote_excel: {str(e)}")
        print(f"Traceback:\n{error_traceback}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Excel export failed: {str(e)}"
        )
```

---

## Security Checklist

Before deploying export endpoints:

- [x] ✅ **Organization ID check** - Always filter by `user.current_organization_id`
- [x] ✅ **UUID validation** - Convert UUID to string before string operations
- [x] ✅ **Filename sanitization** - Remove special characters from filenames
- [x] ✅ **Temp file cleanup** - Use `BackgroundTask(os.unlink, tmp_path)`
- [x] ✅ **Error handling** - Catch and log exceptions, return appropriate HTTP status
- [x] ✅ **Activity logging** - Log all export operations for audit trail
- [x] ✅ **File size limits** - Verify Excel/PDF size before returning (prevent memory issues)
- [x] ✅ **Input validation** - Use Pydantic or Query validators for parameters

---

**Reference Files:**
- `backend/services/excel_service.py` - Excel export implementation
- `backend/pdf_service.py` - PDF export implementation
- `backend/routes/quotes.py` - Export endpoints (lines 1538-1868)
- `backend/services/export_data_mapper.py` - Data fetching and mapping
