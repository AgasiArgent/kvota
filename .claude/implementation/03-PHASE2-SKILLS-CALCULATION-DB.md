# Phase 2: Skills Content - Calculation Engine & Database

**Time:** 4-6 hours
**Priority:** 🔴 CRITICAL
**Prerequisites:** Phase 1 completed
**Output:** 2 specialized domain skills

---

## Overview

Create two domain-specific skills for complex areas:

1. **calculation-engine-guidelines** - 42 variables, 13 phases, validation (NEW ⭐)
2. **database-verification** - Schema patterns, RLS guardrails, migrations

These are **specialized skills** for areas with high complexity and bug potential.

---

## Task 2.1: Calculation Engine Guidelines Skill (2-3 hours)

### Why This Skill is Critical

- **42 variables** to track (39 user-editable + 3 admin-only)
- **13 calculation phases** with complex dependencies
- **Two-tier system** (product overrides quote defaults)
- **High bug potential** - Wrong calculations = wrong prices = lost money

**Without this skill:** Claude forgets variable rules, breaks two-tier logic, skips validation.

**With this skill:** Auto-activates when working with calculations, enforces all rules.

---

### Directory Structure

```
.claude/skills/calculation-engine-guidelines/
├── SKILL.md                           # Main file (<500 lines)
└── resources/
    ├── variable-specification.md      # All 42 variables classified
    ├── validation-rules.md            # Required fields + business rules
    ├── two-tier-system.md             # Product > Quote > Default precedence
    ├── calculation-phases.md          # 13 phases explained
    ├── mapper-patterns.md             # Map to 7 Pydantic models
    └── common-errors.md               # Calculation bugs we've hit
```

---

### Content to Create

#### SKILL.md (Main File)

```markdown
# Calculation Engine Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29
**Applies To:** Quote calculation engine (backend/routes/quotes_calc.py)

## When This Skill Applies

Auto-activates when:
- Working in `backend/routes/quotes_calc.py`
- Modifying calculation logic
- Adding/changing variables
- Debugging calculation errors
- User mentions: "calculation", "quote price", "variables", "pricing"

## Quick Reference

**See resource files for details:**
- `variable-specification.md` - All 42 variables with types/scope
- `validation-rules.md` - 10 required fields + business rules
- `two-tier-system.md` - Product overrides quote defaults
- `calculation-phases.md` - 13 sequential phases
- `mapper-patterns.md` - Map 42 variables → 7 Pydantic models
- `common-errors.md` - Bugs we've hit and solutions

## Critical Rules

### 1. Two-Tier Variable System

**Hierarchy:** Product Override > Quote Default > System Fallback

```python
def get_value(product_value, quote_value, default):
    """ALWAYS check product first, then quote, then default"""
    if product_value is not None:
        return product_value  # Product-level override
    if quote_value is not None:
        return quote_value    # Quote-level default
    return default            # System fallback
```

### 2. Required Field Validation

**10 required fields** (see validation-rules.md):
- Product-only: sku, brand, base_price_VAT, quantity
- Quote-only: currency_base, delivery_days, pct_advance_pymt_1/2/3, rate_forex

**Validate before calculation** - Return all errors at once, not one at a time.

### 3. Admin-Only Variables

**3 variables ONLY editable by admin** (stored in calculation_settings table):
- rate_forex_risk
- rate_fin_comm  
- rate_loan_interest_daily

**Never allow users to override these.**

### 4. Business Rules

- Advance payments total ≤ 100%
- Delivery days > 0
- Quantity > 0
- Currency in [USD, EUR, CNY, RUB]

## Variable Classification

### Product-Only (5)
sku, brand, base_price_VAT, quantity, weight_in_kg

### Quote-Only (19)
currency_base, delivery_days, pct_advance_pymt_1/2/3, etc.

### Both Levels (15)
rate_forex, pct_discount, pct_customs_duty, etc.

### Admin-Only (3)
rate_forex_risk, rate_fin_comm, rate_loan_interest_daily

**Full list:** See `variable-specification.md`

## When to Use Agents

**Before changes:**
- Complex calculation logic? → `@Plan` agent for design review
- Performance issues? → `@expert` agent for optimization

**During implementation:**
- Stuck on validation logic? → `@expert` agent
- Need edge case testing? → `@qa-tester` agent

**After implementation:**
- `@qa-tester` writes tests automatically (orchestrator invokes)
- `@code-reviewer` checks patterns (orchestrator invokes)

## Common Errors

**Top 3 (see common-errors.md for full list):**
1. Wrong two-tier order (checking quote before product)
2. Missing required field validation
3. Type errors (None instead of Decimal)

## Testing

**See:** `backend/tests/test_quotes_calc_*.py`
- test_quotes_calc_mapper.py - Two-tier logic tests
- test_quotes_calc_validation.py - Required fields + business rules
- Coverage goal: 80%+ for calculation code
```

---

#### resources/variable-specification.md

**Content:** Copy from `.claude/CALCULATION_PATTERNS.md` (created in Quick Wins).

**Add:**
- Complete list of all 42 variables
- Classification (product-only, quote-only, both, admin-only)
- Data types (Decimal, str, int)
- Valid ranges/values
- Default values

**Source:** `.claude/VARIABLES.md` (existing file)

---

#### resources/validation-rules.md

**Content:** Copy validation section from `.claude/CALCULATION_PATTERNS.md`.

**Add:**
- Required field validation code
- Business rule validation code  
- Error message formats (in Russian)
- Validation order (required first, then business rules)

---

#### resources/two-tier-system.md

**Content:** 
- Detailed explanation of product > quote > default hierarchy
- Code examples of get_value() helper
- Edge cases (what if product value is 0? None? Empty string?)
- Test scenarios

---

#### resources/calculation-phases.md

**Content:**
- All 13 phases listed in order
- Input/output for each phase
- Dependencies between phases
- Common errors in each phase

**Source:** `.claude/calculation_engine_summary.md` (existing file)

---

#### resources/mapper-patterns.md

**Content:**
- Map 42 variables to 7 Pydantic models
- Code examples from quotes_calc.py
- Helper functions (safe_decimal, safe_str, safe_int)
- Error handling

**Source:** `backend/routes/quotes_calc.py:map_variables_to_calculation_input()`

---

#### resources/common-errors.md

**Content:**
- Missing required variables
- Type mismatches (None vs Decimal)
- Wrong two-tier order
- Admin settings not fetched
- Business rule violations

**Source:** Extract from test failures, bug reports

---

### Verification Checklist

- [ ] SKILL.md < 500 lines
- [ ] All 42 variables documented
- [ ] Two-tier system explained with examples
- [ ] Validation rules with code examples
- [ ] 13 calculation phases listed
- [ ] Mapper patterns documented
- [ ] Common errors with solutions
- [ ] Cross-references work

---

## Task 2.2: Database Verification Skill (2-3 hours)

### Why This Skill is Critical

- **Multi-tenant security** - RLS prevents data leakage
- **284 RLS references** in codebase - critical to get right
- **Guardrail skill** - Blocks dangerous operations until verified

**Without this skill:** Forget RLS policies, expose other orgs' data, security breach.

**With this skill:** Auto-activates on schema changes, enforces RLS checklist.

---

### Directory Structure

```
.claude/skills/database-verification/
├── SKILL.md                           # Main file (<500 lines)
└── resources/
    ├── rls-patterns.md                # Complete RLS guide
    ├── schema-standards.md            # Table structure patterns
    ├── migration-checklist.md         # Safe migration process
    ├── column-naming.md               # Naming conventions
    └── common-mistakes.md             # Database bugs we've hit
```

---

### Content to Create

#### SKILL.md (Main File)

```markdown
# Database Verification Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29
**Type:** Guardrail Skill (Blocks until verified)
**Applies To:** Database migrations, schema changes

## When This Skill Applies

Auto-activates when:
- Creating/modifying migrations (backend/migrations/**/*.sql)
- Working with schema changes
- Adding/modifying tables
- User mentions: "migration", "schema", "table", "column", "RLS"

## Critical: This is a GUARDRAIL Skill

**BLOCKING behavior:**
When you create/modify database schema:

1. ✅ Show RLS checklist (from rls-patterns.md)
2. ⏸️ PAUSE before executing migration
3. ❓ Ask user: "Have you verified all checklist items?"
4. ✅ Only proceed after explicit confirmation

**Why:** Database bugs = data leakage = security breach.

## RLS Checklist (MUST VERIFY)

For every new table:

- [ ] organization_id column added (UUID NOT NULL)
- [ ] organization_id references organizations(id)
- [ ] Index created on organization_id
- [ ] RLS enabled (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
- [ ] SELECT policy created
- [ ] INSERT policy created  
- [ ] UPDATE policy created
- [ ] DELETE policy created
- [ ] Policies tested with multiple organizations

**Full checklist:** See `rls-patterns.md`

## Schema Standards

### Required Columns

Every table MUST have:
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES organizations(id),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Column Naming

- snake_case (not camelCase)
- Descriptive names (not abbreviations)
- Foreign keys: [table]_id (e.g., customer_id, quote_id)
- Booleans: is_[adjective] (e.g., is_active, is_approved)
- Dates: [action]_at (e.g., created_at, approved_at)

**Full guide:** See `column-naming.md`

## Migration Workflow

1. **Write SQL** - Create migration file
2. **Add RLS** - Follow RLS checklist
3. **Test locally** - Run migration on dev database
4. **Verify RLS** - Test with multiple organizations
5. **Create rollback** - Write reverse migration
6. **Document** - Update MIGRATIONS.md
7. **Commit** - Push to repo

**Detailed process:** See `migration-checklist.md`

## When to Use Agents

**Before migration:**
- Complex schema change? → `@Plan` agent for design review
- Unsure about RLS? → `@security-auditor` agent for review

**After migration:**
- `@security-auditor` verifies RLS automatically (orchestrator invokes)
- `@qa-tester` tests database operations (orchestrator invokes)

## Common Mistakes

**Top 5 (see common-mistakes.md for full list):**
1. Missing organization_id column
2. RLS enabled but no policies created
3. Missing policy type (e.g., only SELECT, no INSERT)
4. Wrong context setting in backend
5. No index on organization_id (performance issue)

## Testing RLS

**Manual test (Supabase Dashboard):**
```sql
-- Get two org UUIDs
SELECT id, name FROM organizations LIMIT 2;

-- Set context to org1
SET app.organization_id = '[org1_uuid]';
SELECT * FROM [table_name];
-- Should only see org1 data

-- Set context to org2  
SET app.organization_id = '[org2_uuid]';
SELECT * FROM [table_name];
-- Should only see org2 data (different from org1)
```

**Automated test (Pytest):**
See `rls-patterns.md` for pytest examples.

## Quick Reference

- **RLS guide:** `rls-patterns.md` (complete RLS implementation)
- **Schema patterns:** `schema-standards.md` (table structure)
- **Migration checklist:** `migration-checklist.md` (safe process)
- **Column naming:** `column-naming.md` (conventions)
- **Common mistakes:** `common-mistakes.md` (bugs we've hit)
```

---

#### resources/rls-patterns.md

**Content:** Copy from `.claude/RLS_CHECKLIST.md` (created in Quick Wins).

**Add:**
- Complete RLS policy templates
- Context setting code (backend)
- Testing code (SQL + pytest)
- Debugging RLS issues

---

#### resources/schema-standards.md

**Content:**
- Required columns (id, organization_id, created_at, updated_at)
- Foreign key patterns
- Index patterns
- Data types (prefer UUID, TIMESTAMPTZ, NUMERIC)

---

#### resources/migration-checklist.md

**Content:**
- Step-by-step migration process
- Testing procedure
- Rollback script creation
- Documentation requirements

---

#### resources/column-naming.md

**Content:**
- snake_case convention
- Boolean naming (is_*)
- Date naming (*_at)
- Foreign key naming ([table]_id)
- Common gotchas (our codebase has some inconsistencies - document them)

---

#### resources/common-mistakes.md

**Content:** Database bugs from MASTER_BUG_INVENTORY.md + RLS bugs we've hit.

---

### Verification Checklist

- [ ] SKILL.md < 500 lines
- [ ] GUARDRAIL behavior explained (blocks until verified)
- [ ] RLS checklist complete
- [ ] Schema standards documented
- [ ] Migration workflow detailed
- [ ] Column naming conventions listed
- [ ] Common mistakes with solutions
- [ ] Cross-references work

---

## Time Breakdown

| Task | Time | Notes |
|------|------|-------|
| Calculation SKILL.md | 30 min | Quick reference |
| variable-specification.md | 30 min | Copy from CALCULATION_PATTERNS.md |
| validation-rules.md | 30 min | Extract validation code |
| two-tier-system.md | 30 min | Explain precedence |
| calculation-phases.md | 30 min | List 13 phases |
| mapper-patterns.md | 30 min | Extract from quotes_calc.py |
| common-errors.md | 30 min | From tests/bug reports |
| Database SKILL.md | 30 min | Quick reference + guardrail |
| rls-patterns.md | 60 min | Copy from RLS_CHECKLIST.md + expand |
| schema-standards.md | 30 min | Document our conventions |
| migration-checklist.md | 30 min | Safe process |
| column-naming.md | 30 min | Naming conventions |
| common-mistakes.md | 30 min | Database bugs |
| **TOTAL** | **4-6 hours** | |

---

## Next Steps

After Phase 2:

1. **Verify skills work** - Check file structure, cross-references
2. **Move to Phase 3** - Skills infrastructure (see `04-PHASE3-SKILLS-INFRASTRUCTURE.md`)
3. **Phase 3 makes skills auto-activate** - Creates skill-rules.json

**Phases 1-2 create content, Phase 3 makes it automatic.**

---

## Success Criteria

- [ ] Calculation engine skill complete with 42 variables documented
- [ ] Database verification skill complete with RLS guardrails
- [ ] All resource files created
- [ ] Cross-references work
- [ ] Agent guidance included
- [ ] Files readable (<800 lines each)
- [ ] Ready for auto-activation (Phase 3)

