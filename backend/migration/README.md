# Migration Module

Bulk import historical Excel quotes into PostgreSQL database with progress tracking and error handling.

## Purpose

Import 1000+ historical quotes from Excel files into production database while preserving data integrity and providing user feedback.

## Features

- **Batch processing** - Process 50 files per transaction
- **Progress tracking** - Visual progress bar with ETA
- **Duplicate detection** - Skip already-imported quotes
- **Error handling** - Continue on error, collect failures
- **Dry-run mode** - Test without database writes
- **RLS context** - Multi-tenant security compliance
- **Transaction safety** - Batch commits with rollback

## Usage

### CLI Script (Recommended)

```bash
cd /home/novi/workspace/tech/projects/kvota/dev

# Dry-run first (test without DB writes)
python scripts/import_quotes.py validation_data/*.xlsx \
  --org-id "your-org-uuid" \
  --user-id "your-user-uuid" \
  --dry-run

# Real import (with confirmation)
python scripts/import_quotes.py validation_data/*.xlsx \
  --org-id "your-org-uuid" \
  --user-id "your-user-uuid" \
  --batch-size 50

# Import specific files
python scripts/import_quotes.py \
  validation_data/quote_001.xlsx \
  validation_data/quote_002.xlsx \
  --org-id "uuid" \
  --user-id "uuid"
```

### Programmatic Usage

```python
from migration.bulk_importer import BulkQuoteImporter
import glob

# Create importer
importer = BulkQuoteImporter(
    organization_id="org-uuid",
    user_id="user-uuid",
    batch_size=50,
    dry_run=False
)

# Get file list
file_paths = glob.glob("validation_data/*.xlsx")

# Run import
results = await importer.import_files(file_paths)

# Check results
print(f"Total:      {results['total']}")
print(f"Successful: {results['successful']}")
print(f"Skipped:    {results['skipped']}")
print(f"Failed:     {results['failed']}")

# Show errors
for error in results['errors']:
    print(f"  {error['file']}: {error['error']}")
```

## Data Models

### BulkQuoteImporter

Main import orchestrator.

```python
class BulkQuoteImporter:
    def __init__(
        self,
        organization_id: str,      # Organization UUID
        user_id: str,              # Importer user UUID
        batch_size: int = 50,      # Files per transaction
        dry_run: bool = False      # Simulate without DB writes
    )

    async def import_files(
        self,
        file_paths: List[str]      # List of Excel file paths
    ) -> Dict:                     # Import results
```

### Import Results

```python
{
    "total": 100,                  # Total files attempted
    "successful": 95,              # Successfully imported
    "failed": 3,                   # Failed with errors
    "skipped": 2,                  # Skipped (duplicates)
    "errors": [
        {
            "file": "quote_002.xlsx",
            "error": "Invalid sheet structure"
        }
    ]
}
```

### ProgressTracker

Visual progress feedback.

```python
class ProgressTracker:
    def start(self, total: int)                    # Initialize progress
    def increment(self, status: str, message: str) # Update progress
    def finish(self)                               # Show final stats
```

**Status Symbols:**
- ✅ Success
- ❌ Error
- ⏭️ Skipped (duplicate)

## CLI Options

### Required Arguments

- **files** - Excel file paths (supports wildcards: `*.xlsx`)
- **--org-id** - Organization UUID
- **--user-id** - User UUID (must have import permissions)

### Optional Arguments

- **--batch-size** - Files per transaction (default: 50)
- **--dry-run** - Simulate without database writes

### Examples

```bash
# Import all files in directory
python scripts/import_quotes.py validation_data/*.xlsx \
  --org-id "uuid" --user-id "uuid"

# Import with smaller batches
python scripts/import_quotes.py data/*.xlsx \
  --org-id "uuid" --user-id "uuid" \
  --batch-size 25

# Test run (no DB writes)
python scripts/import_quotes.py *.xlsx \
  --org-id "uuid" --user-id "uuid" \
  --dry-run
```

## Progress Output

### Console Output

```
📂 Found 100 Excel files

⚠️  Import 100 quotes? (yes/no): yes

🚀 Starting import of 100 files...
============================================================
✅ [████████████████████████████████████████] 100/100 (100.0%) | ETA: 00:00:00 | ✅ 95 ❌ 3 ⏭️ 2

============================================================
✅ Import complete in 0:02:34
   Successful: 95
   Failed:     3
   Skipped:    2

============================================================
📊 IMPORT SUMMARY
============================================================
Total files:    100
✅ Successful:  95
⏭️  Skipped:     2
❌ Failed:      3

❌ ERRORS:
  quote_002.xlsx: Cannot find calculation sheet
  quote_045.xlsx: Database error: foreign key violation
  quote_089.xlsx: Invalid customs code format
```

## Import Workflow

### Phase 1: Parse Excel

```python
parser = ExcelQuoteParser(filepath)
excel_data = parser.parse()
```

Extracts:
- Quote-level variables
- Product data (quantity, price, weight, etc.)
- Seller company

### Phase 2: Generate Quote Number

```python
quote_number = self._generate_quote_number(excel_data)
# Examples:
# - "КП-001" (from filename "quote_001.xlsx")
# - "КП-IMP-20251111132045" (from timestamp)
```

### Phase 3: Check Duplicates

```python
existing = await conn.fetchrow(
    "SELECT id FROM quotes WHERE organization_id = $1 AND quote_number = $2",
    organization_id,
    quote_number
)

if existing:
    raise FileExistsError(f"Quote {quote_number} already exists")
```

Skips if quote number already exists.

### Phase 4: Create Customer

```python
customer_id = await self._ensure_customer(conn, "Imported Customer")
```

Creates customer if not exists (idempotent).

**TODO (Phase 5):** Extract customer info from Excel metadata.

### Phase 5: Create Quote

```python
quote_id = await self._create_quote(
    conn,
    excel_data,
    quote_number,
    customer_id
)
```

Creates quote record with:
- Organization ID (RLS context)
- Customer ID
- Quote number
- Status: "draft"
- Seller company (from Excel)

### Phase 6: Create Products

```python
await self._create_products(
    conn,
    quote_id,
    excel_data.inputs["products"]
)
```

Creates product records with:
- Product name (placeholder: "Product 1", "Product 2", etc.)
- Quantity
- Base price with VAT
- Line number

**TODO (Phase 5):** Parse full product fields from Excel (SKU, brand, dimensions, supplier info, etc.).

## Database Schema

### Tables Created

**quotes**
```sql
INSERT INTO quotes (
    organization_id,
    customer_id,
    quote_number,
    status,
    seller_company,
    created_by
) VALUES (...)
```

**quote_items**
```sql
INSERT INTO quote_items (
    quote_id,
    product_name,
    quantity,
    base_price_vat,
    line_number
) VALUES (...)
```

**customers**
```sql
INSERT INTO customers (
    organization_id,
    name,
    company_type,
    status,
    created_by
) VALUES (...)
ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
```

## Security

### RLS Context

```python
# Set user context for Row-Level Security
await conn.execute(
    "SELECT set_config('request.jwt.claims', $1, true)",
    f'{{"sub": "{self.user_id}", "role": "authenticated"}}'
)
```

Ensures:
- Quotes isolated by organization
- User permissions respected
- Audit trail preserved

### Transaction Safety

```python
# Batch processing with transactions
async with conn.transaction():
    for filepath in batch:
        await self._import_single_file(conn, filepath)
```

Benefits:
- Atomic batch commits
- Rollback on error
- Data integrity

## Error Handling

### File-Level Errors

**Skipped (duplicate):**
```python
FileExistsError: Quote КП-001 already exists
```

**Failed (invalid file):**
```python
ValueError: Cannot find calculation sheet
```

**Failed (database error):**
```python
asyncpg.exceptions.ForeignKeyViolationError
```

### Batch Behavior

- **Continue on error** - One file failure doesn't stop batch
- **Collect errors** - All failures reported at end
- **Partial success** - Successful files committed per batch

## Testing

### Unit Tests

```bash
cd backend
pytest tests/migration/ -v
```

### Integration Tests

```bash
# Test with real database (dry-run)
python scripts/import_quotes.py test_data/*.xlsx \
  --org-id "test-org-uuid" \
  --user-id "test-user-uuid" \
  --dry-run

# Verify no data written
SELECT COUNT(*) FROM quotes;  -- Should be unchanged
```

### Performance Testing

```bash
# Measure import speed
time python scripts/import_quotes.py large_dataset/*.xlsx \
  --org-id "uuid" --user-id "uuid"

# Expected: ~200-300 files/minute
```

## Configuration

### Batch Size

Tune based on:
- **Large files** → Smaller batches (25)
- **Small files** → Larger batches (100)
- **Network latency** → Smaller batches
- **Local database** → Larger batches

```python
importer = BulkQuoteImporter(batch_size=25)  # Conservative
importer = BulkQuoteImporter(batch_size=100) # Aggressive
```

### Dry-Run Mode

Always test first:

```bash
# Step 1: Dry-run
python scripts/import_quotes.py *.xlsx --dry-run --org-id X --user-id Y

# Step 2: Review output

# Step 3: Real import
python scripts/import_quotes.py *.xlsx --org-id X --user-id Y
```

## Dependencies

- **asyncpg** - PostgreSQL async driver
- **excel_parser** - Excel data extraction
- **asyncio** - Async processing

## Known Limitations

1. **Minimal product data** - Only saves name, quantity, price (not SKU, brand, weight, etc.)
2. **Generic customer** - All quotes assigned to "Imported Customer"
3. **No metadata** - Excel metadata (author, dates) not extracted
4. **No validation** - Calculation not run (only data import)
5. **No conflict resolution** - Duplicate quote numbers skipped

**Future Enhancements (Phase 5):**
- Parse customer info from Excel
- Extract full product fields
- Run calculation validation
- Store calculated values
- Import historical versions

## Troubleshooting

### Import Hangs

Check batch size:
```bash
# Reduce batch size
python scripts/import_quotes.py *.xlsx --batch-size 10 ...
```

### Duplicate Skips

Check quote number generation:
```python
# Filename: quote_001.xlsx → Quote number: КП-001
# Ensure unique filenames
```

### Permission Denied

Verify user has permissions:
```sql
SELECT * FROM organization_members
WHERE user_id = 'your-user-uuid'
AND organization_id = 'your-org-uuid';
```

### RLS Bypass

Always set RLS context:
```python
await conn.execute(
    "SELECT set_config('request.jwt.claims', $1, true)",
    f'{{"sub": "{user_id}", "role": "authenticated"}}'
)
```

## Common Use Cases

### 1. Initial Data Migration

Import all historical quotes on first deployment:

```bash
python scripts/import_quotes.py validation_data/*.xlsx \
  --org-id "prod-org-uuid" \
  --user-id "admin-user-uuid" \
  --batch-size 50
```

### 2. Incremental Import

Import new historical files discovered:

```bash
python scripts/import_quotes.py new_files/*.xlsx \
  --org-id "uuid" \
  --user-id "uuid"
```

### 3. Retry Failed Imports

Re-import only failed files:

```bash
# Collect failed filenames from error report
python scripts/import_quotes.py \
  quote_002.xlsx \
  quote_045.xlsx \
  quote_089.xlsx \
  --org-id "uuid" --user-id "uuid"
```

## See Also

- **excel_parser/** - Excel data extraction
- **validation/** - Calculation accuracy validation
- **scripts/import_quotes.py** - CLI entry point
- **backend/CLAUDE.md** - Database patterns

## Created

2025-11-11 (Session 37)
