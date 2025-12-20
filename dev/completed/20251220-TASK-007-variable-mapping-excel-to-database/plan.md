# TASK-007: Variable Mapping Excel to Database

**Task ID:** TASK-007
**Created:** 2025-12-20
**Status:** In Progress
**Owner:** Claude
**Estimated Time:** 4-6 hours
**Last Updated:** 2025-12-20

---

## 1. Objective

### What Problem Are We Solving?

The calculation engine has 42 variables that flow through 4 different layers:
1. **Excel upload** - Column names users see in spreadsheets
2. **Backend parsing** - Python variable names in Pydantic models
3. **Calculation engine** - Internal variable names for calculations
4. **Database storage** - Column names in PostgreSQL tables

Currently, there's no single source of truth mapping these names across layers. This makes it hard to:
- Debug calculation issues (which variable is wrong?)
- Add new variables (what do I name it in each layer?)
- Understand the data flow (where does this value come from?)

### Why Is This Important?

- **Debugging:** Trace a value from Excel upload to final database storage
- **Onboarding:** New developers can understand the system faster
- **Maintenance:** Prevent naming inconsistencies when adding features
- **Data integrity:** Identify if any variables are missing DB columns

### Success Criteria (Measurable)

- [ ] All 42 calculation variables mapped across 4 layers
- [ ] Markdown reference document in `.claude/VARIABLE_MAPPING.md`
- [ ] CSV spreadsheet in `.claude/reference/variable-mapping.csv`
- [ ] Pytest validation tests that trace variables through layers
- [ ] Gap analysis completed - identify any missing DB columns
- [ ] If gaps found, discuss with user and implement fixes

---

## 2. Technical Approach

### Data Flow to Map

```
Excel File (user uploads)
    ↓ [Excel column names]
Backend Parser (quotes_upload.py)
    ↓ [Python/Pydantic variable names]
Calculation Engine Mapper (quotes_calc.py)
    ↓ [Calculation input variable names]
Calculation Engine
    ↓ [Calculated output variable names]
Database Storage (quotes table, quote_products table)
    ↓ [PostgreSQL column names]
```

### Key Files to Examine

**Layer 1 - Excel Parsing:**
- `backend/routes/quotes_upload.py` - Excel upload handler
- `backend/services/excel_validation_service.py` - Column validation

**Layer 2 - Pydantic Models:**
- `backend/domain_models/product.py` - Product model
- `backend/domain_models/quote_defaults.py` - Quote defaults model
- `backend/domain_models/calculation_input.py` - Calc engine input

**Layer 3 - Calculation Engine:**
- `backend/routes/quotes_calc.py` - Variable mapper function
- `backend/calculation_engine/` - Engine internals

**Layer 4 - Database:**
- `backend/migrations/*.sql` - Table schemas
- Supabase schema (via postgres MCP)

**Existing Documentation:**
- `.claude/VARIABLES.md` - 42 variables reference
- `.claude/skills/calculation-engine-guidelines/` - Detailed specs

### Deliverables Format

**1. Markdown Reference (`.claude/VARIABLE_MAPPING.md`)**
- Quick reference tables organized by variable category
- Shows all 4 layer names side-by-side
- Notes for any inconsistencies

**2. CSV Spreadsheet (`.claude/reference/variable-mapping.csv`)**
Columns:
- `variable_category` - Which of 11 categories
- `excel_column_name` - Name in uploaded Excel
- `python_variable_name` - Name in Pydantic models
- `calc_engine_input_name` - Name for calculation engine input
- `calc_engine_output_name` - Name in calculation results
- `db_table` - Table storing this variable
- `db_column` - Column name in database
- `data_type` - Type (string, number, boolean, etc.)
- `is_required` - Required or optional
- `default_value` - Default if not provided
- `notes` - Any important notes

**3. Pytest Validation Suite (`backend/tests/test_variable_mapping.py`)**
Tests that:
- Parse a sample Excel file and verify variable names
- Trace specific variables through each layer
- Verify database columns exist for all variables
- Check for naming consistency

---

## 3. Implementation Plan

### Phase 1: Discovery (1-2 hours)

Read and document all variable names in each layer:
1. Read existing `.claude/VARIABLES.md` as starting point
2. Examine Excel parsing code for column names
3. Examine Pydantic models for Python names
4. Examine calculation mapper for engine names
5. Query database schema for column names

### Phase 2: Documentation (1-2 hours)

Create the mapping documents:
1. Build CSV with all 42 variables across 4 layers
2. Create markdown reference from CSV
3. Document any gaps or inconsistencies found
4. Discuss gaps with user and decide on fixes

### Phase 3: Validation (1-2 hours)

Write pytest tests:
1. Test that all Excel columns map to Python variables
2. Test that all Python variables map to calc engine inputs
3. Test that all calc outputs have DB columns
4. Integration test tracing specific values end-to-end

### Phase 4: Gap Fixes (as needed)

If missing DB columns or inconsistencies found:
1. Discuss with user
2. Create database migrations
3. Update code to use consistent names
4. Re-run validation tests

---

## 4. Variable Categories (from VARIABLES.md)

The 42 variables are organized into 11 categories:

1. **Product Info** - SKU, brand, name, description
2. **Base Pricing** - Base price, VAT, quantity
3. **Supplier** - Country, hub, customs route
4. **Logistics** - Shipping costs per leg
5. **Duties & Taxes** - Customs duty, VAT rates
6. **Brokerage** - Customs broker fees
7. **Currency** - Base currency, quote currency, rates
8. **Weight** - Product weight for shipping
9. **Margin** - Markup percentages
10. **Finance** - Forex risk, commission rates
11. **Admin-only** - Protected settings (3 variables)

---

## 5. Risks & Mitigation

**Risk 1: Missing Database Columns**
- **Probability:** Medium
- **Impact:** High (can't store calculated values)
- **Mitigation:** Identify gaps, discuss with user, create migrations

**Risk 2: Inconsistent Naming**
- **Probability:** High (likely exists)
- **Impact:** Medium (confusing but functional)
- **Mitigation:** Document all variations, propose standardization

**Risk 3: Complex JSON Storage**
- **Probability:** Medium
- **Impact:** Low (need to map nested paths)
- **Mitigation:** Document JSON paths explicitly in mapping

---

## 6. References

### Skills
- `.claude/skills/calculation-engine-guidelines/` - Calculation patterns
- `.claude/skills/backend-dev-guidelines/` - Backend patterns
- `.claude/skills/database-verification/` - Database standards

### Documentation
- `.claude/VARIABLES.md` - Current variable reference
- `backend/CLAUDE.md` - Backend tech stack
- `.claude/reference/calculation_engine_summary.md` - Engine details

---

**Remember:** This is a documentation task with validation. The goal is to create a single source of truth for variable naming across all layers. If we find gaps, we discuss and fix them iteratively.
