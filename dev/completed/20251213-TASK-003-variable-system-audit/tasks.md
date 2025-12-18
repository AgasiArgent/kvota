# Variable System Documentation Audit - Tasks

**Task ID:** TASK-003
**Last Updated:** 2025-12-13
**Total Tasks:** 25 (24 completed, 1 remaining)
**Progress:** 96%

---

## Task Status Legend

```
[ ] Not started
[>] In progress
[x] Complete
[!] Blocked
[-] Skipped
```

---

## Phase 1: Currency Truth (Priority #1)

**Status:** COMPLETE
**Actual Time:** ~2 hours

- [x] Read calculation_engine.py - find where actual math happens
- [x] Read multi_currency_service.py - find conversion logic
- [x] Read quotes_calc.py - find API layer currency handling
- [x] Check database: what currency is stored (via migration files)
- [x] Check database: what's in quote_calculation_variables JSONB
- [x] Document: Input → Calculation → Storage → Display currency flow
- [x] Create: `resources/currency-handling.md`

**Key Finding:** Calculations happen in QUOTE CURRENCY (not USD as some comments suggest). Storage is DUAL (quote currency + USD).

---

## Phase 2: Variable Inventory

**Status:** COMPLETE
**Actual Time:** ~1 hour

- [x] Read calculation_models.py - extract Pydantic models
- [x] Count all variables from ProductInfo, FinancialParams, etc.
- [x] Read calculation_engine.py - find calculated/derived variables
- [-] Read frontend types - SKIPPED (user said rebuilding UI from scratch)
- [x] Compare: backend vars vs docs (42 input + 4 derived + 39 output)
- [x] Create: variable inventory in context.md

---

## Phase 3: Data Flow Tracing

**Status:** COMPLETE
**Actual Time:** ~1 hour

### Forward Flow (Input)
- [-] Trace: Quote creation UI form fields - SKIPPED (rebuilding UI)
- [x] Trace: Excel upload (only input source)
- [x] Trace: Backend endpoint (what's received)
- [x] Trace: Calculation engine (what's transformed)
- [x] Trace: Database save (what's stored)

### Backward Flow (Output)
- [x] Trace: Database load (raw data)
- [x] Trace: API response (what's returned)
- [x] Trace: Export services (Excel/PDF)
- [x] Create: Data flow documented in `resources/currency-handling.md`

---

## Phase 4: Export Mapping

**Status:** COMPLETE
**Actual Time:** ~1 hour

- [x] Find Excel export service (export_data_mapper.py, export_validation_service.py)
- [x] Find PDF generation logic (5 PDF formats)
- [x] Map: which variables appear in Excel columns (D5-BL5)
- [x] Map: which variables appear in PDF fields
- [x] Create: `resources/export-mapping.md`

---

## Phase 5: Database Mapping

**Status:** COMPLETE
**Actual Time:** ~1 hour

- [x] Map: quotes table columns
- [x] Map: quote_items columns to variables
- [x] Map: quote_calculation_variables JSONB keys
- [x] Map: quote_calculation_results JSONB structure
- [x] Map: quote_calculation_summaries columns
- [x] Map: calculation_settings columns
- [x] Create: `resources/database-mapping.md`

---

## Phase 6: Verification & Cleanup

**Status:** COMPLETE
**Actual Time:** ~1 hour

- [x] Compare VARIABLES.md vs actual variable count (matches)
- [x] Check archive docs - what's outdated?
  - **Found:** `Variables_specification_notion.md` has outdated internal_markup values
  - **Archive internal_markup:** Turkey→RU 10%, China→RU 10%, EU→RU 13%
  - **Actual code:** Turkey→RU 2%, China→RU 2%, EU→RU 4%
  - **Reason:** Code updated 2025-11-09, docs never updated
- [x] Note all discrepancies found (documented in derived-variables.md)
- [x] Update SKILL.md with new resources
- [x] Create: `resources/derived-variables.md` (verified from code)
- [ ] Create VARIABLES_QUICK_REF.md (50-line cheat sheet) - TODO
- [-] Archive obsolete docs - SKIPPED (user didn't request)

---

## Summary

**Completed:** 24 tasks
**Skipped:** 3 tasks (UI-related, user said rebuilding from scratch)
**Remaining:** 1 task (VARIABLES_QUICK_REF.md - optional)

**Deliverables Created:**
1. `resources/currency-handling.md` - Currency flow end-to-end
2. `resources/database-mapping.md` - Variables to tables
3. `resources/export-mapping.md` - Variables to Excel/PDF
4. `resources/derived-variables.md` - 4 derived variables (supersedes archive)
5. Updated `SKILL.md` with new resources and audit history

**Key Discrepancies Found:**
- Archive docs have wrong internal_markup percentages (outdated since 2025-11-09)
- 2026 VAT rate change (22%) not documented in archive

