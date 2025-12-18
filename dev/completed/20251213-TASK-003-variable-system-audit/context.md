# Variable System Documentation Audit - Context

**Task ID:** TASK-003
**Last Updated:** 2025-12-13
**Session:** Current
**Current Phase:** COMPLETE
**Status:** Audit finished, deliverables created

---

## 1. Task Overview

### Quick Summary

Thorough audit of the variable/calculation system to create reliable documentation. Priority #1 was figuring out currency handling. Output upgraded the calculation-engine-guidelines skill with verified info from actual code.

### Key Findings

**Currency Truth (SOLVED):**
- Calculations happen in **QUOTE CURRENCY** (not USD!)
- Storage is **DUAL**: Both quote currency AND USD
- CBR API provides RUB rates, cross-rates calculated via RUB as base
- Exchange rate locked at calculation time for audit trail

**Variable Count:**
- 42 input variables (user-editable)
- 4 derived variables (auto-calculated)
- 39 output variables (calculation results)
- 3 admin-only variables (rate_forex_risk, rate_fin_comm, rate_loan_interest_daily)

**Discrepancies Found:**
- Archive doc `Variables_specification_notion.md` has OUTDATED internal_markup values
- Code was updated 2025-11-09, archive never updated
- 2026 VAT rate (22%) not in archive docs

---

## 2. Decisions Made

### Decision 1: Read Code, Not Docs
**Date:** 2025-12-13
**Decision:** Trust actual code execution, not comments or documentation
**Rationale:** User confirmed docs may be outdated or wrong - CONFIRMED by finding outdated internal_markup

### Decision 2: Skill Upgrade Output
**Date:** 2025-12-13
**Decision:** Put all verified info into calculation-engine-guidelines skill
**Rationale:** Auto-activates when relevant, survives autocompact

### Decision 3: Skip UI Documentation
**Date:** 2025-12-13
**Decision:** Don't document frontend types/forms
**Rationale:** User said rebuilding UI from scratch, only Excel upload matters

---

## 3. Deliverables Created

### Skill Resources (4 new files)

1. **`resources/currency-handling.md`**
   - Complete currency flow: Excel → CBR cross-rates → Quote currency → Dual storage → Export
   - Answers: "In what currency do calculations happen?" = QUOTE CURRENCY
   - Data flow diagram

2. **`resources/database-mapping.md`**
   - 5 main tables documented
   - JSONB structures for quote_calculation_variables and phase_results
   - Query examples
   - RLS notes

3. **`resources/export-mapping.md`**
   - Excel cell references (D5-BL5)
   - 6 export formats (5 PDF + 1 Excel validation)
   - Value transformations (percentages, country codes)
   - API endpoints

4. **`resources/derived-variables.md`**
   - 4 derived variables with CORRECT values from code
   - **SUPERSEDES** archive docs
   - Documents 2025-11-09 internal_markup update
   - Documents 2026 VAT rate change

### Updated Files

5. **`SKILL.md`**
   - Added new resources to Key Resources section
   - Added Archive section noting outdated docs
   - Added Audit History table
   - Updated Last Updated date

---

## 4. Code References

### Primary Source Files
| File | Lines | What It Contains |
|------|-------|------------------|
| `calculation_engine.py` | 23-84 | Derived variable mappings (TRUTH) |
| `calculation_engine.py` | 107-142 | Derived variable functions |
| `calculation_engine.py` | 143-763 | 13 phase functions |
| `quotes_upload.py` | 177-251 | Currency conversion logic |
| `export_data_mapper.py` | 124-128 | Export currency handling |
| `export_validation_service.py` | * | Excel cell mappings |

### Migration Files Read
- `007_quotes_calculation_schema.sql` - Base schema
- `022_quote_calculation_summaries.sql` - Pre-aggregated totals
- `037_dual_currency_storage.sql` - Dual currency columns

---

## 5. For Autocompact

**If context resets, know this:**

1. **Task:** Variable system audit - COMPLETE
2. **Deliverables:** 4 new skill resources + SKILL.md update
3. **Key finding:** Calculations in QUOTE CURRENCY, storage is DUAL
4. **Discrepancy:** Archive internal_markup is WRONG (outdated since 2025-11-09)
5. **Dev docs:** `dev/active/20251213-TASK-003-variable-system-audit/`

**Optional remaining:** Create VARIABLES_QUICK_REF.md (50-line cheat sheet)

