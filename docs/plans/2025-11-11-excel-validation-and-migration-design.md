# Excel Validation and Migration System Design

**Date:** 2025-11-11
**Author:** Backend Team
**Status:** Design Complete
**Purpose:** Validate calculation accuracy and migrate historical quotes

---

## Problem Statement

We built a 13-phase calculation engine in Python. We need to prove it calculates correctly by comparing results with the original Excel files. We also need to load 1000+ historical quotes from Excel into the database.

**Two distinct goals:**
1. **Validation:** Prove our engine matches Excel (test 5-10 files, generate reports)
2. **Migration:** Load historical data into database (batch import 1000+ files)

---

## Solution Overview

Build a unified system with reusable Excel parser and two specialized modules:

**Shared Component:**
- Excel parser reads inputs and results from formula-based Excel files

**Validation Module:**
- Web UI in admin panel for interactive testing
- Pytest tests for CI/CD automation
- Two comparison modes: Summary (3 fields) vs Detailed (24 fields)
- HTML/PDF reports for presentations

**Migration Module:**
- CLI tool for batch importing 1000+ files
- Progress tracker with ETA
- Duplicate detection
- Error handling with detailed logs

---

## Architecture

```
backend/
├── excel_parser/           # Shared parser (used by both modules)
│   ├── quote_parser.py    # Parse Excel with smart sheet detection
│   └── field_mapping.py   # Map Excel cells to variables
│
├── validation/            # Validation module
│   ├── calculator_validator.py  # Compare Excel vs engine
│   └── report_generator.py      # HTML/PDF reports
│
├── migration/             # Migration module
│   ├── bulk_importer.py        # Batch database import
│   └── progress_tracker.py     # Visual progress display
│
├── routes/
│   └── excel_validation.py     # API for Web UI
│
└── tests/
    └── validation/
        └── test_excel_validation.py

frontend/src/app/admin/
└── excel-validation/
    └── page.tsx           # Admin UI for validation

scripts/
└── import_quotes.py       # CLI for migration
```

---

## Component Design

### 1. Excel Parser (Shared)

**Purpose:** Extract inputs and results from Excel files with formula-based layout.

**Key Challenge:** Excel files have 5-10 sheets. We need the calculation sheet named "Расчет" or similar.

**Solution - Three-Level Fallback:**
```python
# 1. Try exact name "Расчет"
# 2. Try similar names (расчёт, Calculation, calc)
# 3. Search all sheets for markers (D5 has company name, E16 has quantity)
# 4. Fail with clear error listing all sheet names
```

**Variable Extraction:**
- Quote-level: Fixed cells (D5=seller_company, D6=sale_type, D8=currency)
- Products: Dynamic rows starting at 16 (E16=quantity, K16=price, etc.)
- Loop while E{row} has value to auto-detect product count

**Result Extraction:**
- Summary fields: AK16 (final price), AM16 (with VAT), AQ16 (profit)
- Detailed fields: All 24 intermediate values from 13 phases

**Output:**
```python
QuoteData(
    filename="quote_001.xlsx",
    sheet_name="Расчет",
    inputs={
        "quote": {"seller_company": "...", "currency": "RUB"},
        "products": [{"quantity": 100, "base_price": 50.0}, ...]
    },
    expected_results={
        "products": [{"AK16": 125000.0, "AM16": 150000.0}, ...]
    }
)
```

---

### 2. Validation Module

**Purpose:** Prove calculation accuracy through comparison.

**Two Comparison Modes:**

**Summary Mode (3 fields):**
- AK16: Final price total
- AM16: Price with VAT
- AQ16: Profit

Use case: Quick validation, pass/fail determination.

**Detailed Mode (24 fields):**
- All phases: Currency (M16, S16), Logistics (T16, V16), COGS (AB16), etc.
- Grouped by calculation phase for diagnosis

Use case: Debugging discrepancies, detailed analysis.

**Tolerance:** Accept ±2 rubles difference (configurable).

**Validation Logic:**
```python
1. Parse Excel → extract inputs and expected results
2. Run inputs through our calculation engine
3. Compare field by field: abs(our_value - excel_value) ≤ tolerance
4. Generate result: passed/failed, max deviation, failed fields
```

**Output Example:**
```
Product 1: ✅ PASSED (max deviation: 1.2 ₽)
  ✅ AK16 (Final Price): 125,000.00 vs 124,998.80 (diff: 1.20)
  ✅ AM16 (With VAT):    150,000.00 vs 149,998.56 (diff: 1.44)
  ✅ AQ16 (Profit):       26,500.00 vs  26,498.80 (diff: 1.20)
```

---

### 3. Web UI (Admin Panel)

**Location:** `/admin/excel-validation` (admin/owner only)

**Features:**
- Drag-and-drop file upload (max 10 files)
- Mode selector: Summary vs Detailed
- Tolerance input (default 2.0 ₽)
- Results table with pass/fail indicators
- Modal for detailed comparison per file
- Export PDF/HTML report buttons

**User Flow:**
1. Admin uploads 5 test Excel files
2. Selects "Detailed" mode
3. Clicks "Run Validation"
4. Views results: 4 passed, 1 failed
5. Clicks failed file → sees side-by-side comparison
6. Identifies Phase 9 (COGS) has 12.3 ₽ discrepancy
7. Exports PDF report for documentation

**API Endpoints:**
- `POST /api/admin/excel-validation/validate` - Run validation
- `POST /api/admin/excel-validation/generate-report` - Generate PDF/HTML

---

### 4. Report Generator

**Purpose:** Create presentation-ready reports.

**HTML Report Features:**
- Summary statistics (total, passed, failed, pass rate, deviations)
- Table of all files with status
- Detailed field comparisons (in detailed mode)
- Phase grouping for easy diagnosis
- Green/red color coding
- Recommendations section

**PDF Generation:**
- Convert HTML to PDF using WeasyPrint
- Preserve styling and colors
- Suitable for stakeholder presentations

---

### 5. Pytest Integration

**Purpose:** Automated testing in CI/CD pipeline.

**Test Structure:**
```python
@pytest.mark.parametrize("excel_path", excel_files, ids=lambda p: Path(p).name)
def test_excel_validation_summary(excel_path, validator_summary):
    parser = ExcelQuoteParser(excel_path)
    excel_data = parser.parse()
    result = validator_summary.validate_quote(excel_data)
    assert result.passed
```

**One test runs all Excel files.** Pytest parametrization creates individual test cases.

**Commands:**
```bash
# Run all validation tests
pytest tests/validation/ -v

# Generate HTML report
pytest tests/validation/ --html=report.html

# Stop on first failure
pytest tests/validation/ -x
```

**CI/CD Integration:**
```yaml
# .github/workflows/test.yml
- name: Validate Excel Calculations
  run: pytest tests/validation/ --html=report.html
- name: Upload Report
  uses: actions/upload-artifact@v3
  with:
    name: validation-report
    path: report.html
```

---

### 6. Migration Module

**Purpose:** Batch import 1000+ historical quotes from Excel into database.

**Process:**
1. Parse Excel files (reuse excel_parser)
2. Check for duplicates (by quote_number)
3. Create customer if needed
4. Create quote record
5. Create product records
6. Save calculation results as JSONB
7. Save calculation variables as JSONB

**Batch Processing:**
- Process 50-100 files per transaction
- Commit after each batch
- Continue on errors (don't stop entire import)

**Progress Tracker:**
```
🚀 Starting import of 1247 files...
============================================================
✅ [████████████████████] 1247/1247 (100%) | ETA: 00:00:00
   ✅ 1200  ❌ 15  ⏭️ 32 (duplicates)
============================================================
✅ Import complete in 0:08:23
```

**Duplicate Handling:**
- Check if quote_number exists in organization
- Skip with log message (don't fail)
- Count as "skipped" in summary

**Error Handling:**
- Catch per-file errors
- Log error with filename
- Continue processing remaining files
- Report all errors at end

**CLI Usage:**
```bash
# Dry run (no database writes)
python scripts/import_quotes.py archived/*.xlsx \
    --org-id "xxx" --user-id "yyy" --dry-run

# Real import
python scripts/import_quotes.py archived/*.xlsx \
    --org-id "xxx" --user-id "yyy" --batch-size 100
```

---

## Data Flow Diagrams

### Validation Flow

```
Excel Files (5-10)
    ↓
[Web UI Upload] or [Pytest Parametrize]
    ↓
[Excel Parser] → Extract inputs & expected results
    ↓
[Calculation Engine] → Run our calculation
    ↓
[Validator] → Compare field by field
    ↓
[Report Generator] → HTML/PDF
    ↓
Admin/Stakeholder Review
```

### Migration Flow

```
Excel Files (1000+)
    ↓
[CLI Script with Progress Tracker]
    ↓
[Excel Parser] → Extract all data
    ↓
[Duplicate Check] → Skip if exists
    ↓
[Database Writer] → Insert quotes, products, results
    ↓
    ├─ Batch 1 (50 files) → COMMIT
    ├─ Batch 2 (50 files) → COMMIT
    ├─ ...
    └─ Batch N → COMMIT
    ↓
Summary Report (success/fail/skipped counts)
```

---

## Key Design Decisions

### 1. Why Two Modules?

**Separation of concerns:**
- Validation: Interactive, small scale (5-10 files), needs visualization
- Migration: Batch, large scale (1000+ files), needs progress tracking

**Different users:**
- Validation: Admins testing accuracy
- Migration: Technical team doing one-time data import

### 2. Why Reusable Parser?

Excel parsing is complex (sheet detection, cell mapping, row loops). Write once, use everywhere.

Benefits:
- Validation and migration use identical parsing logic
- Bug fixes apply to both
- Easier testing
- Future features (exports, reports) can reuse

### 3. Why Two Validation Modes?

**Summary Mode:**
- Fast: Check only 3 critical fields
- Clear pass/fail signal
- Suitable for regression testing

**Detailed Mode:**
- Diagnostic: Check all 24 fields across 13 phases
- Pinpoints exact discrepancy location
- Suitable for debugging calculation bugs

### 4. Why Web UI Instead of CLI for Validation?

**Requirements favor interactive testing:**
- Admins need visual comparison
- Side-by-side tables easier than terminal output
- Export to PDF for stakeholders
- Drag-and-drop faster than command line

CLI would work but provides worse UX for this use case.

### 5. Why CLI for Migration?

**Requirements favor batch processing:**
- 1000+ files too slow for browser upload
- Progress bar essential for long-running task
- Dry-run mode for safety
- Server-side processing more reliable

Web UI would timeout on large batches.

---

## Implementation Estimates

**Total: 16-18 hours**

### Phase 1: Excel Parser (3-4 hours)
- Smart sheet detection with fallback
- Input extraction (quote + products)
- Result extraction (summary + detailed fields)
- Unit tests

### Phase 2: Validation Module (3-4 hours)
- Calculator validator with two modes
- Field comparison logic
- Report generator (HTML/PDF)
- Unit tests

### Phase 3: Web UI (4-5 hours)
- Admin page with upload
- Results table and modal
- API integration
- Export buttons
- Manual testing

### Phase 4: Migration Module (3-4 hours)
- Bulk importer with batching
- Progress tracker
- CLI script
- Duplicate detection
- Error handling

### Phase 5: Pytest Integration (2-3 hours)
- Parametrized tests
- HTML report generation
- CI/CD configuration

---

## Testing Strategy

### Unit Tests
- Excel parser: Test with sample files (various structures)
- Validator: Test comparison logic with mock data
- Report generator: Test HTML generation

### Integration Tests
- End-to-end validation flow
- End-to-end migration flow
- Error cases (corrupt files, missing fields)

### Manual Tests
- Upload various Excel files via Web UI
- Verify reports are accurate
- Test migration with 10 files (dry-run and real)

### Performance Tests
- Validation: 10 files in <5 seconds
- Migration: 1000 files in <10 minutes

---

## Security Considerations

### Web UI
- Admin/owner role required
- File size limit: 10 MB per file
- Max 10 files per request
- No arbitrary code execution (data_only=True in openpyxl)
- Temporary files cleaned up after processing

### Migration CLI
- Requires organization_id (prevents cross-org data leaks)
- Requires user_id (audit trail)
- Validates all foreign keys before insert
- RLS policies apply to all inserts

### File Upload
- Accept only .xlsx and .xls extensions
- Scan for macros (reject if found)
- Process in isolated /tmp directory
- Delete after processing

---

## Rollout Plan

### Week 1: Core Components
- Implement Excel parser
- Write unit tests
- Validate with 5 sample Excel files

### Week 2: Validation Module
- Implement validator
- Build Web UI
- Generate first reports
- Present to stakeholders for approval

### Week 3: Migration Module
- Implement bulk importer
- Test with 50 files (dry-run)
- Fix any parsing issues
- Run full migration (1000+ files)

### Week 4: Polish & Documentation
- Pytest integration
- CI/CD setup
- User documentation
- Training for admins

---

## Success Criteria

### Validation Success
- ✅ 95%+ pass rate on test files
- ✅ Average deviation <1 ruble
- ✅ Reports clearly show discrepancies
- ✅ Admins can run validation independently

### Migration Success
- ✅ 1000+ quotes imported successfully
- ✅ <2% failure rate (due to corrupt files)
- ✅ All duplicates detected and skipped
- ✅ Import completes in <10 minutes

### System Quality
- ✅ Pytest tests pass in CI/CD
- ✅ Code reviewed and approved
- ✅ Documentation complete
- ✅ Security audit passed

---

## Future Enhancements (Not in Scope)

### V2 Features
- Web UI for migration (with progress bar)
- Bulk validation (100+ files via Web UI)
- Scheduled validation (weekly regression tests)
- Comparison history (track accuracy over time)
- Excel template validator (check structure before parsing)

### V3 Features
- Export validation results to Excel
- Compare multiple calculation engine versions
- Integration with feedback system (report bugs from validation)

---

## Appendix: Field Reference

### Summary Fields (3)
| Field | Excel Cell | Description |
|-------|-----------|-------------|
| AK16 | AK column | Final price total |
| AM16 | AM column | Price with VAT |
| AQ16 | AQ column | Profit |

### Detailed Fields (24)
| Phase | Fields | Description |
|-------|--------|-------------|
| Phase 1 | M16, S16 | Currency conversion |
| Phase 2 | BD16 | Distribution key |
| Phase 3 | T16, U16, V16 | Logistics |
| Phase 4 | Y16, Z16 | Customs & duties |
| Phase 5 | AA16 | Brokerage |
| Phase 7-8 | BA16, BB16 | Financing |
| Phase 9 | AB16 | COGS |
| Phase 10 | AY16 | Internal sale |
| Phase 11 | AF16, AG16, AH16, AI16, AJ16, AK16 | Sales price components |
| Phase 12 | AN16, AO16, AP16, AM16 | VAT calculations |
| Phase 13 | AQ16 | Profit |

---

## References

- **Calculation Engine:** `backend/calculation_engine.py`
- **Phase Documentation:** `.claude/skills/calculation-engine-guidelines/resources/calculation-phases.md`
- **Variables Guide:** `.claude/VARIABLES.md`
- **Testing Workflow:** `.claude/TESTING_WORKFLOW.md`

---

**Document Status:** Design complete, ready for implementation planning.
