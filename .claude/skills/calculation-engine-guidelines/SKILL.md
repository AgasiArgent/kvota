# Calculation Engine Guidelines

**Agent Role:** Backend calculation engine developer
**Tech Stack:** Python 3.12 + Decimal + Pydantic
**Scope:** 13-phase quote calculation pipeline

---

## What This Skill Teaches

This skill provides everything needed to understand, maintain, and extend the B2B quotation calculation engine:

### Core Concepts
- **13-phase sequential calculation** for pricing quotes
- **Single vs multi-product** quote handling
- **Decimal precision** for financial calculations
- **Distributed financing** and cost allocation

### Implementation Details
- **Phase dependencies** (input/output per phase)
- **Excel cell mapping** (K16, M16, AB16, etc.)
- **Special cases** (transit, export, Turkish sellers)
- **Admin-only settings** (forex risk, financing rates)

### Design Patterns
- Pure functional phases with clear interfaces
- Multi-product logic using proportional distribution (BD16 key)
- Pydantic validation for all inputs
- Compound interest calculations for financing

---

## Key Resources

### Phase Documentation
- **`resources/calculation-phases.md`** (1,068 lines)
  - All 13 phases with detailed explanations
  - Input/output specifications
  - Excel formulas and implementation patterns
  - Variable cross-reference table
  - Phase dependency diagram

### Currency & Data Flow (Verified 2025-12-13)
- **`resources/currency-handling.md`** - Complete currency flow
  - Currency at each stage (input → calculation → storage → export)
  - RUB as CBR cross-rate base
  - Dual storage (Quote currency + USD)
  - Exchange rate audit trail

- **`resources/database-mapping.md`** - Variables to database tables
  - 5 main tables: quotes, quote_items, quote_calculation_variables, quote_calculation_results, quote_calculation_summaries
  - JSONB structures documented
  - Query examples

- **`resources/export-mapping.md`** - Variables to Excel/PDF
  - Excel cell references (D5-BL5)
  - 6 PDF export formats
  - Value transformations (percentages, country codes)

- **`resources/derived-variables.md`** - 4 derived variables
  - seller_region, vat_seller_country, internal_markup, rate_vatRu
  - **SUPERSEDES** archive docs (archive has outdated internal_markup values)
  - Updated 2025-11-09 markup percentages

### Source Code Reference
- **`backend/calculation_engine.py`** (1,200+ lines)
  - Derived variable mappings (lines 23-84)
  - Derived variable functions (lines 107-142)
  - Phase functions (lines 143-763)
  - Helper functions (lines 89-120)
  - Orchestrators (lines 770-1130)
- **`backend/routes/quotes_calc.py`**
  - API integration and validation
- **`backend/routes/quotes_upload.py`**
  - Excel upload and currency conversion (lines 177-251)

---

## Common Tasks

### Understanding Phase Dependencies
See the phase diagram in `calculation-phases.md`. Each phase:
1. Takes outputs from previous phases as inputs
2. Performs specific calculations
3. Produces outputs used by subsequent phases

### Adding a New Phase
Example: Calculate carbon offset:
1. Determine where it fits (after Phase X, before Phase Y)
2. Define inputs (what phases feed into it)
3. Define outputs (what phases will use it)
4. Implement phase function following pattern
5. Update orchestrators to call new phase
6. Add tests validating calculation

### Fixing Phase Bugs
1. Identify which phase has wrong output
2. Check formula against Excel reference
3. Verify all dependencies are correct inputs
4. Use Decimal arithmetic (no floats!)
5. Test with provided test cases

### Multi-Product Quote Logic
Key insight: Some costs are **quote-level** (calculated once):
- Logistics totals (T13, U13)
- Financing totals (BJ11, BL5)
- Revenue (BH2)

Other costs are **per-product** (distributed using BD16):
- Logistics per product (T16, U16)
- Financing per product (BA16, BB16)
- All pricing (AJ16, AK16)

Distribution key BD16 = S16 / S13 (product value proportion)

---

## Code Quality Standards

### Decimal Usage
```python
# Always use Decimal for money
from decimal import Decimal, ROUND_HALF_UP

price = Decimal("1234.56")  # Good
price = 1234.56             # BAD - float!
```

### Rounding
```python
# Use quantize for consistent rounding
rounded = price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

# ROUNDUP behavior
rounded_up = (value * Decimal("10")).quantize(Decimal("1"), rounding=ROUND_CEILING) / Decimal("10")
```

### Phase Functions
- **Pure functions** (no side effects)
- **Clear parameters** (all inputs explicit)
- **Type hints** (Decimal, str, bool)
- **Early validation** (check inputs before calculating)
- **Return dict** with all phase outputs

---

## Testing Philosophy

### Test Cases Provided
- **Tests 1-8:** Single product scenarios
- **Tests 9-10:** Multi-product scenarios
- **Tests 11-15:** Extended scenarios (China, EU suppliers)

### Test Accuracy
- **Success criteria:** <0.1% difference from Excel
- **Current status:** All 15 tests passing ✅
- **Maximum error:** <0.01 RUB (rounding differences)

### Writing New Tests
1. Define input scenario (products, costs, settings)
2. Calculate expected output (manually or from Excel)
3. Call calculation function
4. Assert each variable within tolerance
5. Add to test suite

---

## Admin Settings

These rates are **admin-only** and stored in `calculation_settings` table:

| Setting | Default | Type | Phase | Purpose |
|---------|---------|------|-------|---------|
| rate_forex_risk | 3.0% | Percent | 6, 11 | Buffer for forex fluctuations |
| rate_fin_comm | 0.5% | Percent | 5 | Commission on supplier payment |
| rate_loan_interest_daily | 0.15% | Percent | 7, 8 | Compound interest for financing |

These are **fetched from database** during calculation:
```python
async def fetch_admin_settings(organization_id: str) -> dict:
    """Get admin settings for organization."""
    result = supabase.table("calculation_settings") \
        .select("rate_forex_risk, rate_fin_comm, rate_loan_interest_daily") \
        .eq("organization_id", organization_id) \
        .single() \
        .execute()
    return result.data
```

---

## Common Issues & Solutions

### Issue: Precision Loss
**Symptom:** AY16 doesn't match Excel by 0.05 RUB
**Cause:** Using float instead of Decimal
**Solution:** Ensure all arithmetic uses Decimal("value"), not value

### Issue: Insurance Distribution Wrong
**Symptom:** Sum of insurance_per_product != insurance_total
**Cause:** Using quantity-based distribution instead of value-based (BD16)
**Solution:** Insurance distributed as `insurance_total × BD16`, not `insurance_total / quantity`

### Issue: VAT Deduction Not Applied
**Symptom:** AO16 = 0 but should be non-zero
**Cause:** Incorrect incoterms check or sale_type
**Solution:** AO16 only calculated if DDP incoterms AND not export sale

### Issue: Multi-Product Commission Wrong
**Symptom:** AQ16 different for same product in single vs multi-product quote
**Cause:** Financing costs not properly distributed using BD16
**Solution:** BA16 and BB16 must use BD16 from Phase 2

---

## Integration Points

### Frontend Integration
Quote creation page calls calculation API:
```typescript
// Send product list with variables
const response = await api.post("/api/quotes/calculate", {
  products: [
    {
      sku: "ABC-123",
      base_price: 1200,
      quantity: 10,
      supplier_country: "Turkey",
      ...40+ more variables
    }
  ],
  quote_defaults: { ... },
  settings: { ... }
});

// Receive calculated values for display
console.log(response.products[0].AJ16); // Final price per unit
console.log(response.products[0].AK16); // Final price total
```

### Database Storage
Quote calculations stored in `quote_calculations` table:
```sql
CREATE TABLE quote_calculations (
  id UUID PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id),
  product_id UUID REFERENCES quote_products(id),
  calculation_results JSONB,  -- All phase outputs
  created_at TIMESTAMP
);
```

---

## Performance Characteristics

- **Single product:** <10ms
- **Multi-product (5 products):** <50ms
- **Memory:** <5MB (entire calculation in memory)
- **Bottleneck:** Database fetch for admin settings (~50ms)

---

## References

### Primary (Verified from Code)
- **Currency Flow:** `resources/currency-handling.md` - How currency works end-to-end
- **Database Mapping:** `resources/database-mapping.md` - Variables to tables
- **Export Mapping:** `resources/export-mapping.md` - Variables to Excel/PDF
- **Derived Variables:** `resources/derived-variables.md` - 4 auto-calculated variables

### Secondary
- **Calculation Summary:** `.claude/reference/calculation_engine_summary.md`
- **Variables Guide:** `.claude/VARIABLES.md` (44 variables classified)
- **Variable Mapping:** `.claude/VARIABLE_MAPPING.md` ⭐ - Excel→Backend→CalcEngine→DB
- **Variable CSV:** `.claude/reference/variable-mapping.csv` - Sortable spreadsheet
- **Source Code:** `backend/calculation_engine.py`
- **Tests:** `backend/tests/test_quotes_calc_*.py`, `backend/tests/test_variable_mapping.py`

### Archive (May Be Outdated)
- `.claude/archive/Variables_specification_notion.md` - Contains outdated internal_markup values
- `.claude/archive/VARIABLES_CLASSIFICATION.md` - UI classification (still valid)

---

**Last Updated:** 2025-12-13
**Status:** Production Ready (✅ 15/15 tests passing)
**Owner:** Backend Calculation Team

## Audit History

| Date | What Changed | Verified By |
|------|--------------|-------------|
| 2025-12-13 | Full audit: currency flow, database mapping, export mapping, derived variables | Code analysis |
| 2025-11-09 | Internal markup percentages updated in code | (see calculation_engine.py:53-54) |
| 2025-10-29 | Initial skill documentation | - |
