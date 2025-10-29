# Calculation Engine Guidelines Skill

**Complete reference for B2B quotation calculation engine**

**Status:** Production Ready (15/15 tests passing ✅)
**Last Updated:** 2025-10-29
**Total Documentation:** 5,100+ lines across 8 files

---

## Overview

The calculation engine is a 13-phase sequential system that transforms quote inputs into final sales prices with full cost breakdowns. It handles:

- Single and multi-product quotes
- Multiple suppliers with different VAT rates
- International trade (import/export, customs, excise)
- Financing calculations with compound interest
- Transit vs supply sales
- VAT deductions and net payment

---

## Navigation Guide

### For Quick Lookup
**Start here:** `resources/quick-reference.md` (2 pages)
- Phase overview diagram
- Variable lookup table
- Decision tree for common questions
- Common errors & fixes

### For Complete Phase Details
**Read next:** `resources/calculation-phases.md` (1,068 lines)
- All 13 phases explained in detail
- Input/output specifications per phase
- Excel formulas and implementation patterns
- Phase dependency diagram
- Variable cross-reference table (42 variables)

### For Business Logic
**Learn the rules:** `resources/two-tier-system.md` (710 lines)
- Two-tier variable system (product override > quote default > fallback)
- Quote-level vs product-level variables
- 42 variables classified by level
- Distribution key logic (BD16)

### For Code Implementation
**Implementation guide:** `resources/mapper-patterns.md` (823 lines)
- How to map 42 variables to calculation inputs
- Pydantic model patterns
- Safe type conversions
- Error handling patterns

### For Validation
**Validation rules:** `resources/validation-rules.md` (332 lines)
- Input validation before calculation
- Business rule checks
- Required fields per scenario
- Edge case handling

### For Variable Definitions
**Variable specs:** `resources/variable-specification.md` (530 lines)
- All 42 variables defined
- Data types and allowed ranges
- Default values
- Excel cell mappings

### For Troubleshooting
**Problem solving:** `resources/common-errors.md` (715 lines)
- Real bugs from testing and fixes
- Precision issues and solutions
- Multi-product distribution errors
- Admin settings issues

### For Architecture Overview
**High-level view:** `SKILL.md` (links to all above)
- Skill overview and learning outcomes
- Common tasks (adding phases, fixing bugs)
- Code quality standards
- Integration points
- Performance characteristics

---

## Quick Start (5 Minutes)

### Understanding How It Works
1. Read `quick-reference.md` Phase Overview diagram
2. Look at the 13-phase flow
3. Notice BD16 is "distribution key" used in phases 3-9

### Finding a Specific Variable
1. Open `quick-reference.md` - Variable Quick Lookup table
2. Find your variable (e.g., "AJ16")
3. See which phase produces it
4. See its formula

### Understanding a Phase
1. Open `calculation-phases.md`
2. Find section "## Phase N: [Name]"
3. Read Inputs, Outputs, Formula sections
4. Check Implementation Pattern

### Debugging a Wrong Value
1. Open `common-errors.md`
2. Search for your symptom
3. Read cause and solution
4. Apply fix
5. Test with provided test case

---

## Common Workflows

### Workflow 1: Adding a New Calculation Phase

**Scenario:** New requirement to calculate carbon offset

**Steps:**
1. Determine dependencies: What phases must complete first?
2. Define inputs: What data does this phase need?
3. Define outputs: What calculations does it produce?
4. Check `calculation-phases.md` for phase diagram placement
5. Implement following "Implementation Pattern" section
6. Write tests with expected values
7. Call from orchestrator (between appropriate phases)
8. Test with multi-product quote

**Resources:**
- `calculation-phases.md` - Phase diagram
- `quick-reference.md` - Phase input/output summary table
- `mapper-patterns.md` - Pydantic patterns

### Workflow 2: Finding Why Variable X is Wrong

**Scenario:** AJ16 (final sales price) doesn't match Excel

**Steps:**
1. Open `calculation-phases.md` Phase 11 section
2. Check formula: `AJ16 = (AB16 + AF16 + AG16 + AH16 + AI16) / quantity`
3. Trace back: Check all inputs (AB16, AF16, etc.) from previous phases
4. Use `quick-reference.md` to find which phases produce each input
5. Check `common-errors.md` for known issues with this variable
6. Look at implementation pattern and compare to actual code
7. Check special cases (transit, export, Turkish seller)

**Resources:**
- `calculation-phases.md` - Detailed phase specs
- `quick-reference.md` - Variable lookup and special cases
- `common-errors.md` - Known bugs and solutions

### Workflow 3: Understanding Multi-Product Logic

**Scenario:** Two products with different costs, need to understand how costs distributed

**Steps:**
1. Read `calculation-phases.md` Phase 2 section (Distribution Base)
2. Understand: BD16 = S16 / S13 (product value proportion)
3. Find all phases that use BD16: Phases 3-9
4. For each phase, cost_per_product = cost_total × BD16
5. Test: Sum of all cost_per_product should equal cost_total

**Resources:**
- `calculation-phases.md` - Phase 2 explanation
- `quick-reference.md` - Phase input/output table (shows which use BD16)
- `two-tier-system.md` - Distribution logic explained

### Workflow 4: Implementing API Integration

**Scenario:** Frontend needs to calculate 5-product quote via API

**Steps:**
1. Read `mapper-patterns.md` for mapping 42 variables to inputs
2. Create Pydantic models for request/response
3. Fetch admin settings from database
4. Map frontend variables to calculation inputs
5. Call calculation engine function
6. Validate outputs
7. Store in database

**Resources:**
- `mapper-patterns.md` - Variable mapping patterns
- `validation-rules.md` - Input validation rules
- `SKILL.md` Integration Points section

---

## File Structure

```
calculation-engine-guidelines/
├── README.md                    ← You are here
├── SKILL.md                     ← Skill overview & standards
└── resources/
    ├── calculation-phases.md    ← 13 phases detailed (1,068 lines)
    ├── quick-reference.md       ← 2-page cheat sheet (239 lines)
    ├── two-tier-system.md       ← Variable system explained (710 lines)
    ├── mapper-patterns.md       ← Implementation patterns (823 lines)
    ├── validation-rules.md      ← Input validation (332 lines)
    ├── variable-specification.md ← Variable definitions (530 lines)
    └── common-errors.md         ← Bug fixes & solutions (715 lines)

Total: 5,100+ lines of documentation
```

---

## Key Concepts

### The 13 Phases (Sequential)
1. **Purchase Price** - Base cost in quote currency
2. **Distribution Base** - Key for multi-product allocation (BD16)
3. **Logistics** - Transport and insurance costs
4. **Internal Pricing & Duties** - Customs, excise, VAT
5. **Supplier Payment** - Amount to pay supplier
6. **Revenue Estimation** - Expected total revenue
7. **Financing Costs** - Interest on loans
8. **Credit Sales Interest** - Interest on unpaid invoices
9. **Distribute Financing** - Allocate financing per product
10. **Final COGS** - Cost of goods sold
11. **Sales Price** - Final selling price
12. **VAT Calculations** - Sales VAT and deductions
13. **Transit Commission** - For resale without modification

### The Distribution Key (BD16)
- Calculated once per quote in Phase 2
- Represents each product's proportion of total value
- Sum of all BD16 values = 1.0
- Used to proportionally distribute quote-level costs to products
- Formula: BD16[i] = S16[i] / SUM(S16)

### Two-Tier Variable System
- **Quote-level defaults** - Apply to all products
- **Product-level overrides** - Can override per product
- **Admin-only settings** - rate_forex_risk, rate_fin_comm, rate_loan_interest_daily

### Key Admin Settings (Fetch From Database)
- `rate_forex_risk` (3.0%) - Buffer for currency fluctuations
- `rate_fin_comm` (0.5%) - Commission on supplier payment
- `rate_loan_interest_daily` (0.15%) - Daily compound interest

---

## Standards & Best Practices

### Decimal Arithmetic
```python
# ALWAYS use Decimal for money
from decimal import Decimal, ROUND_HALF_UP

price = Decimal("1234.56")  # Correct
price = 1234.56             # WRONG - loses precision
```

### Phase Functions
- Pure functions (no side effects)
- Clear input parameters (all explicit)
- Type hints for all parameters
- Return dict with phase outputs
- Validate inputs before calculating

### Testing
- Success criteria: <0.1% difference from Excel
- 15 tests covering single/multi-product/multi-supplier
- All tests must pass before deployment

### Multi-Product Safety
- Always use BD16 for distribution (not quantity)
- Verify BD16 sums to 1.0
- Test with 1, 2, 3+ products

---

## Source Code Reference

### Production Code
- **Phases 1-13:** `backend/calculation_engine.py` lines 143-763
- **Helper functions:** `backend/calculation_engine.py` lines 89-120
- **Orchestrators:** `backend/calculation_engine.py` lines 770-1130
- **API Integration:** `backend/routes/quotes_calc.py`

### Tests (All Passing ✅)
- **Single product tests:** `backend/tests/test_quotes_calc_*.py` (8 tests)
- **Multi-product tests:** `backend/tests/test_quotes_calc_*.py` (10+ tests)
- **Test data:** Realistic B2B trade scenarios

### Excel Reference
- Original Excel model: Shared by business team
- Variables imported from Excel, calculation logic validated

---

## Learning Path

### For New Team Members (2-3 hours)
1. Read `quick-reference.md` (15 min)
2. Read `calculation-phases.md` overview section (30 min)
3. Review Phase 1-5 sections in detail (1 hour)
4. Read `two-tier-system.md` (30 min)
5. Run tests: `pytest backend/tests/ -v` (10 min)

### For Code Implementation (1-2 days)
1. Complete new team members path above
2. Read full `calculation-phases.md` (2 hours)
3. Read `mapper-patterns.md` and `validation-rules.md` (1 hour)
4. Review actual implementation in `calculation_engine.py` (2 hours)
5. Implement small change (fix, add validation) and test
6. Read `common-errors.md` for gotchas (1 hour)

### For Full Mastery (1 week)
1. Complete code implementation path above
2. Deep dive into `calculation_engine.py` source code
3. Understand orchestrator logic (multi-product flow)
4. Write tests for edge cases
5. Contribute bug fixes or optimizations

---

## FAQ

**Q: How do I add a new calculation phase?**
A: See `calculation-phases.md` phase diagram, then follow "Implementation Pattern" section of target phase. Add to orchestrator between appropriate phases.

**Q: Why does BD16 sum to 1.0?**
A: BD16 is each product's proportion. Sum of proportions = 100% = 1.0. If it doesn't, Phase 2 distribution base is wrong.

**Q: Which phases must run for every product?**
A: Phases 1, 3, 4, 9, 10, 11, 12, 13. Phases 2, 5, 6, 7, 8 are quote-level (once per quote).

**Q: Why can't I use float for money?**
A: Floats lose precision after ~7 significant digits. 1234567.89 becomes 1234567.875. Use Decimal always.

**Q: What's the difference between S16 and AB16?**
A: S16 = purchase price only. AB16 = COGS = purchase + logistics + duties + financing. AB16 is used for pricing, S16 is just input.

**Q: Can I change rate_vat_ru?**
A: No, it's fixed by Russian law at 18%. It's not in admin settings, hardcoded in code.

**Q: What if advance_from_client_percent = 100%?**
A: Then BL3 = 0 (no credit sales), BL5 = 0 (no credit interest).

**Q: How do I handle Turkish sellers?**
A: Set seller_region = "TR", then Y16 = 0 (no customs) and AI16 = 0 (no agent fee).

---

## Getting Help

### Resources
1. **Quick questions:** Check `quick-reference.md` variable lookup
2. **Phase details:** Find phase in `calculation-phases.md`
3. **Implementation help:** See `mapper-patterns.md`
4. **Bug diagnosis:** Check `common-errors.md`
5. **Validation rules:** See `validation-rules.md`

### When Something's Wrong
1. Identify which phase output is wrong
2. Check that phase's inputs are correct
3. Review formula in `calculation-phases.md`
4. Check `common-errors.md` for known issues
5. Run tests to validate your fix

### Reporting Issues
When reporting a calculation bug, include:
- Which variable is wrong (e.g., AJ16 = 2500 but should be 2400)
- Test scenario (single/multi-product, supplier country, incoterms)
- Products involved (quantities, prices, costs)
- Expected vs actual difference
- Phase suspected

---

## Maintenance & Updates

**Last Updated:** 2025-10-29
**Test Status:** 15/15 passing ✅
**Code Status:** Production Ready
**Deprecations:** None

When updating this skill:
1. Update timestamp in all files
2. Run full test suite: `pytest backend/tests/test_quotes_calc*.py -v`
3. Update relevant resource files
4. Verify variable references still correct
5. Commit with message: "docs: Update calculation engine documentation"

---

## Summary

This skill provides everything needed to understand, implement, and maintain the calculation engine:

- **5,100+ lines** of structured documentation
- **13-phase** flow with detailed specs
- **2-page** quick reference for lookups
- **Common error** solutions with fixes
- **Implementation** patterns and examples
- **Tests** covering all scenarios

Use this as your reference for any calculation engine work!

---

**Version:** 1.0
**Status:** Production Ready
**Owner:** Backend Calculation Team
