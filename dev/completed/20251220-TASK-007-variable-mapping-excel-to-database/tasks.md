# TASK-007: Variable Mapping - Task Checklist

**Task ID:** TASK-007
**Last Updated:** 2025-12-20 11:45
**Total Tasks:** 18 (0 completed, 18 remaining)
**Progress:** 0%
**Session:** Session 1

---

## Task Status Legend

```
[ ] Not started
[>] In progress (currently working on)
[~] Awaiting verification (done but needs user confirmation)
[x] Complete (verified)
[!] Blocked (waiting on something)
[-] Skipped (decided not to do)
```

---

## Summary

**Completed:** 0 tasks
**In Progress:** 1 task
**Blocked:** 0 tasks
**Remaining:** 17 tasks

**Estimated Time Remaining:** 4-6 hours

---

## Phase 1: Discovery

**Status:** In Progress
**Estimated:** 1-2 hours

### Tasks

- [>] Read existing `.claude/VARIABLES.md` for baseline
  - Owner: Claude
  - Status: Starting now
  - Notes: Understand current 42 variables documentation

- [ ] Read `backend/routes/quotes_upload.py` - Excel column names
  - Owner: Claude
  - Dependencies: None
  - Notes: Find Excel column name mappings

- [ ] Read `backend/services/excel_validation_service.py` - Column validation
  - Owner: Claude
  - Dependencies: None
  - Notes: Find column name patterns

- [ ] Read `backend/domain_models/product.py` - Python variable names
  - Owner: Claude
  - Dependencies: None
  - Notes: Product-level variables

- [ ] Read `backend/domain_models/quote_defaults.py` - Quote defaults
  - Owner: Claude
  - Dependencies: None
  - Notes: Quote-level default variables

- [ ] Read `backend/routes/quotes_calc.py` - Calculation mapper
  - Owner: Claude
  - Dependencies: None
  - Notes: How variables map to calc engine

- [ ] Query database schema for `quotes` and `quote_products` tables
  - Owner: Claude
  - Dependencies: None
  - Notes: Use postgres MCP to get column names

- [ ] Create discovery summary with all variable names per layer
  - Owner: Claude
  - Dependencies: All reads complete
  - Notes: Temp notes before formal documentation

---

## Phase 2: Documentation

**Status:** Not Started
**Estimated:** 1-2 hours

### Tasks

- [ ] Create `.claude/reference/variable-mapping.csv` structure
  - Owner: Claude
  - Dependencies: Phase 1 complete
  - Notes: 12 columns as defined in plan.md

- [ ] Fill CSV with all 42 variables
  - Owner: Claude
  - Dependencies: CSV structure created
  - Notes: One row per variable

- [ ] Create `.claude/VARIABLE_MAPPING.md` from CSV
  - Owner: Claude
  - Dependencies: CSV complete
  - Notes: Markdown tables organized by category

- [ ] Document any naming inconsistencies found
  - Owner: Claude
  - Dependencies: CSV complete
  - Notes: Note in markdown + discuss with user

---

## Phase 3: Validation

**Status:** Not Started
**Estimated:** 1-2 hours

### Tasks

- [ ] Create `backend/tests/test_variable_mapping.py` structure
  - Owner: Claude
  - Dependencies: Phase 2 complete
  - Notes: pytest test file

- [ ] Write tests for Excel → Python variable mapping
  - Owner: Claude
  - Dependencies: Test structure created
  - Notes: Verify column names map correctly

- [ ] Write tests for Python → Calc Engine variable mapping
  - Owner: Claude
  - Dependencies: Test structure created
  - Notes: Verify mapper function

- [ ] Write tests for Calc Engine → Database column mapping
  - Owner: Claude
  - Dependencies: Test structure created
  - Notes: Verify DB columns exist

- [ ] Run pytest and verify all tests pass
  - Owner: Claude
  - Dependencies: All tests written
  - Notes: `cd backend && pytest tests/test_variable_mapping.py -v`

---

## Phase 4: Gap Fixes (As Needed)

**Status:** Not Started
**Estimated:** Variable (depends on gaps found)

### Tasks

- [ ] Address any missing database columns discovered
  - Owner: Claude + User
  - Dependencies: Phase 1-3 reveal gaps
  - Notes: Discuss with user, create migrations if needed

---

## Blocked Tasks

**Currently:** No blocked tasks

---

## Notes

**User Decision:** If gaps found (missing DB columns, inconsistent naming), discuss and fix iteratively rather than just documenting the broken state.

**Deliverables:**
1. `.claude/VARIABLE_MAPPING.md` - Quick reference markdown
2. `.claude/reference/variable-mapping.csv` - Detailed spreadsheet
3. `backend/tests/test_variable_mapping.py` - Validation tests

---

**Last Updated:** 2025-12-20 11:45
