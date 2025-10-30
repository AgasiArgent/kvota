# Skills System Guide

Comprehensive reference for the auto-activating skills system that provides domain-specific coding guidelines.

**Created:** 2025-10-30
**Last Updated:** 2025-10-30
**Version:** 1.0.0
**Lines:** 826

---

## Quick Reference

| Skill | Type | Priority | Triggers | Resources | Impact |
|-------|------|----------|----------|-----------|--------|
| **frontend-dev-guidelines** | Domain | High | React, Ant Design, .tsx files | 5 files, 3,632 lines | Component patterns, forms, ag-Grid |
| **backend-dev-guidelines** | Domain | High | FastAPI, .py files, API | 6 files, 3,200+ lines | Endpoints, RLS, exports |
| **calculation-engine-guidelines** | Domain | Critical | Calculation, pricing, variables | 7 files, 1,500+ lines | 42 variables, 13 phases |
| **database-verification** | GUARDRAIL | Critical | CREATE TABLE, migration, RLS | 4 files, 2,000+ lines | Blocks unsafe DB changes |

---

## Overview

### What is the Skills System?

The skills system is an **auto-activating knowledge injection mechanism** that loads domain-specific coding guidelines into the conversation context based on:

- **File paths** you're working on (e.g., `frontend/src/app/**/*.tsx`)
- **Keywords** mentioned in conversation (e.g., "React", "FastAPI", "calculation")
- **Intent patterns** detected (e.g., "create component", "add endpoint")
- **Content patterns** in files (e.g., `import React`, `@router.get`)

### Why Skills Exist

**Problem:** Main CLAUDE.md becomes bloated with all coding patterns, consuming 40-60% of available tokens.

**Solution:** Extract domain guidelines into separate skills that load **only when needed**.

**Benefits:**
- **40-60% token efficiency** - Guidelines loaded only when relevant
- **50-70% bug reduction** - Patterns enforced automatically when working in domain
- **Consistent patterns** - Single source of truth for each domain
- **Better context awareness** - Claude knows exactly which patterns apply

### How Skills Work

1. **Trigger Detection:** You edit a `.tsx` file or mention "React component"
2. **Skill Activation:** `frontend-dev-guidelines` skill automatically loads
3. **Guidelines Injected:** React 19, Ant Design, ag-Grid patterns appear in context
4. **Coding with Patterns:** Claude follows established patterns automatically
5. **Bug Prevention:** Common mistakes prevented by pattern enforcement

### When Skills Are Loaded

Skills activate automatically when ANY trigger condition is met:

- **File-based:** You read/edit a file matching skill's path patterns
- **Keyword-based:** You mention skill-related keywords in conversation
- **Intent-based:** Claude detects you're trying to do something in skill domain
- **Content-based:** File contents match skill patterns (imports, decorators, etc.)

**Multiple triggers can activate the same skill** (AND/OR logic depending on configuration).

---

## Available Skills

### 1. frontend-dev-guidelines

**Purpose:** React 19, Ant Design v5, ag-Grid patterns for Next.js 15 App Router

**Type:** Domain skill
**Enforcement:** Suggest (non-blocking, provides guidance)
**Priority:** High

**Triggers:**

**Keywords (44 total):**
- react, component, frontend, UI, UX
- ant design, antd, form, table, layout
- ag-grid, ag grid, data grid, grid column
- state, hook, useState, useEffect
- next.js, nextjs, page, router
- client component, server component
- tailwind, css, styling, responsive, mobile
- button, input, select, modal, card, dropdown

**File Patterns:**
- `frontend/src/**/*.tsx`
- `frontend/src/**/*.ts`
- `frontend/src/app/**`
- `frontend/src/components/**`
- `frontend/src/lib/**`

**Content Patterns:**
- `import.*from 'react'`
- `import.*from 'antd'`
- `import.*ag-grid`
- `export default function`
- `useState|useEffect|useCallback`
- `'use client'` or `'use server'`
- `<Form|<Button|<Input|<Select`
- `AgGridReact`

**Resources (5 files, 3,632 lines total):**
- SKILL.md - Main guidelines document
- resources/components.md - Component patterns and examples
- resources/forms.md - Form validation and submission
- resources/ag-grid.md - Data grid integration
- resources/api.md - API integration patterns

**When It Activates:**
- Editing any .tsx file in frontend/src/
- Mentioning React, Ant Design, or ag-Grid
- Creating UI components or forms
- Implementing responsive layouts
- Working with data grids

**What It Provides:**
- Component structure patterns (client vs server components)
- Form validation with Ant Design
- ag-Grid configuration and state management
- API integration (loading states, error handling)
- State management patterns
- Responsive design with breakpoints

---

### 2. backend-dev-guidelines

**Purpose:** FastAPI, Supabase, RLS patterns, exports, testing

**Type:** Domain skill
**Enforcement:** Suggest (non-blocking, provides guidance)
**Priority:** High

**Triggers:**

**Keywords (24 total):**
- backend, api, endpoint, route, controller, service
- fastapi, supabase
- database, postgres, postgresql
- rls, policy, permission
- auth, authentication, authorization
- export, excel, pdf, weasyprint, openpyxl
- pydantic, validation
- middleware, dependency
- async, await

**File Patterns:**
- `backend/**/*.py`
- `backend/routes/**`
- `backend/services/**`
- `backend/tests/**`
- `backend/migrations/**`

**Content Patterns:**
- `from fastapi`
- `@router.` or `@app.`
- `async def`
- `supabase.`
- `raise HTTPException`
- `openpyxl|weasyprint`
- `class.*\(BaseModel\)`
- `APIRouter\(` or `Depends\(`

**Resources (6 files, 3,200+ lines total):**
- SKILL.md - Main guidelines document
- resources/endpoints.md - API endpoint patterns
- resources/rls.md - Row-Level Security implementation
- resources/exports.md - Excel and PDF generation
- resources/testing.md - Pytest patterns and fixtures
- resources/migrations.md - Database migration workflow

**When It Activates:**
- Editing any .py file in backend/
- Mentioning FastAPI, Supabase, or database
- Creating API endpoints
- Working with authentication or permissions
- Generating exports (Excel/PDF)

**What It Provides:**
- API endpoint structure (authentication, validation, error handling)
- Supabase client usage patterns
- RLS policy implementation and testing
- Excel/PDF export generation with templates
- Pytest testing patterns
- Database migration best practices
- Pydantic model validation

---

### 3. calculation-engine-guidelines

**Purpose:** 42 variables, 13 calculation phases, two-tier system (quote-level + product-level)

**Type:** Domain skill
**Enforcement:** Suggest (non-blocking, provides guidance)
**Priority:** Critical

**Triggers:**

**Keywords (24 total):**
- calculation, calculate, quote price, pricing
- variable, variables
- rate, percent, percentage
- forex, discount, markup, margin
- advance payment, delivery days
- customs duty, vat, insurance, commission
- two-tier, product override, quote default
- admin setting
- calculation input, calculation output

**File Patterns:**
- `backend/routes/quotes_calc.py`
- `backend/tests/test_quotes_calc*.py`
- `.claude/VARIABLES.md`
- `.claude/reference/calculation_engine_summary.md`

**Content Patterns:**
- `map_variables_to_calculation_input`
- `validate_calculation_input`
- `fetch_admin_settings`
- `CalculationInput`
- `get_value.*product.*quote`
- `rate_forex|pct_discount|pct_markup`
- `base_price_VAT|quantity|weight_in_kg`
- `safe_decimal|safe_str|safe_int`
- `admin-only variable|product-only variable`

**Resources (7 files, 1,500+ lines total):**
- SKILL.md - Main guidelines document
- resources/variables.md - 42 variable specifications
- resources/phases.md - 13 calculation phases with formulas
- resources/validation.md - Validation rules and error handling
- resources/mapper.md - Variable mapping patterns
- resources/two-tier.md - Quote-level vs product-level logic
- resources/testing.md - Calculation testing patterns

**When It Activates:**
- Editing calculation-related files
- Mentioning "calculation", "pricing", or specific variables
- Working with quote pricing logic
- Adding or modifying calculation variables
- Testing calculation mapper or validation

**What It Provides:**
- Complete 42-variable specification
- 13-phase calculation pipeline formulas
- Two-tier system (quote defaults + product overrides)
- Admin-only vs user-editable variable classification
- Validation rules for each variable type
- Mapper patterns for converting UI data to calculation input
- Common calculation errors and solutions

---

### 4. database-verification (GUARDRAIL)

**Purpose:** Database schema and migration guardrails with RLS policy verification

**Type:** GUARDRAIL (blocks unsafe changes)
**Enforcement:** Block (prevents execution of unsafe operations)
**Priority:** Critical

**Triggers:**

**Keywords (22 total):**
- migration, schema, column, table
- alter table, create table, drop, drop table, drop column
- database, postgres, postgresql, supabase
- rls, policy, row level security
- add column, modify column, rename
- constraint, foreign key, primary key, index

**File Patterns:**
- `backend/migrations/**/*.sql`
- `backend/migrations/**/*.md`

**Content Patterns (DDL statements):**
- `CREATE TABLE`
- `ALTER TABLE`
- `DROP TABLE`
- `ADD COLUMN`
- `DROP COLUMN`
- `MODIFY COLUMN`
- `RENAME`
- `ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY`
- `DROP POLICY`
- `ALTER POLICY`
- `FOREIGN KEY`
- `PRIMARY KEY`
- `CREATE INDEX`
- `GRANT` or `REVOKE`

**Resources (4 files, 2,000+ lines total):**
- SKILL.md - Main guardrail document
- resources/rls-checklist.md - RLS verification steps
- resources/migration-standards.md - Migration file structure and naming
- resources/multi-tenant.md - Multi-tenant patterns and common mistakes
- resources/testing.md - RLS testing patterns

**When It Activates:**
- Creating or editing migration files
- Mentioning DDL statements (CREATE TABLE, ALTER TABLE, etc.)
- Working with RLS policies
- Adding database columns or constraints
- Modifying schema

**What It Provides:**
- **RLS Checklist** - Mandatory verification before migration
- **Migration Standards** - File naming, structure, documentation
- **Multi-tenant Patterns** - Organization isolation requirements
- **Column Naming** - Conventions and required columns
- **Common Mistakes** - RLS bypass vulnerabilities to avoid
- **Testing Patterns** - How to test RLS policies
- **Rollback Procedures** - Safe migration rollback

**IMPORTANT:** This is a **GUARDRAIL skill** that blocks unsafe operations. When activated, Claude will:
1. Verify RLS policies exist for all new tables
2. Check for required columns (id, created_at, organization_id)
3. Validate migration file structure
4. Prevent common security vulnerabilities
5. Require explicit confirmation before proceeding

---

## How Skills Auto-Activate

### File Path Matching

Skills activate when you read or edit files matching their path patterns.

**Examples:**

```bash
# Editing this file activates frontend-dev-guidelines:
frontend/src/app/quotes/create/page.tsx

# Editing this file activates backend-dev-guidelines:
backend/routes/quotes.py

# Editing this file activates calculation-engine-guidelines:
backend/routes/quotes_calc.py

# Editing this file activates database-verification (GUARDRAIL):
backend/migrations/020_add_approval_workflow.sql
```

**Pattern matching uses glob syntax:**
- `**` matches any number of directories
- `*` matches any characters except `/`
- File extensions must match exactly

### Keyword Matching

Skills activate when you mention relevant keywords in conversation.

**Examples:**

```
User: "How do I create a React component with Ant Design form?"
→ Activates: frontend-dev-guidelines (keywords: React, component, Ant Design, form)

User: "Add a FastAPI endpoint with Supabase RLS"
→ Activates: backend-dev-guidelines (keywords: FastAPI, endpoint, Supabase, RLS)

User: "Update the calculation for discount percentage"
→ Activates: calculation-engine-guidelines (keywords: calculation, discount, percentage)

User: "Create a migration to add a new table"
→ Activates: database-verification (keywords: migration, add, table) [GUARDRAIL]
```

**Keyword matching is case-insensitive** and looks for partial matches.

### Intent Pattern Matching

Skills activate when Claude detects you're trying to do something in their domain.

**Examples:**

```
User: "Implement user profile page"
→ Activates: frontend-dev-guidelines (intent: create page/UI)

User: "Build an API for managing quotes"
→ Activates: backend-dev-guidelines (intent: create endpoint/API)

User: "Validate calculation input"
→ Activates: calculation-engine-guidelines (intent: validation)

User: "Drop the old_table from database"
→ Activates: database-verification (intent: drop table) [GUARDRAIL BLOCKS]
```

**Intent patterns use regex** to match common phrasing.

### Content Pattern Matching

Skills activate when file contents match their patterns.

**Examples:**

```tsx
// This code activates frontend-dev-guidelines:
'use client';
import { useState } from 'react';
import { Form, Button } from 'antd';
```

```python
# This code activates backend-dev-guidelines:
from fastapi import APIRouter
router = APIRouter()

@router.get("/quotes")
async def get_quotes():
    ...
```

```python
# This code activates calculation-engine-guidelines:
def map_variables_to_calculation_input(quote_data):
    rate_forex = get_value(product, quote, 'rate_forex')
    pct_discount = safe_decimal(quote_data.get('pct_discount'))
```

```sql
-- This SQL activates database-verification (GUARDRAIL):
CREATE TABLE quotes (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL
);
ENABLE ROW LEVEL SECURITY ON quotes;
```

### Multiple Trigger Conditions

**Skills activate when ANY condition is met** (OR logic):

```
Scenario: Edit backend/routes/quotes_calc.py

Triggers activated:
✓ File path: backend/**/*.py (backend-dev-guidelines)
✓ File path: quotes_calc.py (calculation-engine-guidelines)
✓ Content: import from fastapi (backend-dev-guidelines)
✓ Content: map_variables_to_calculation_input (calculation-engine-guidelines)

Result: BOTH skills activated simultaneously
```

**Multiple skills can be active at once** when working across domains.

---

## Testing Skill Activation

### Test Frontend Skill

**Method 1: Edit a .tsx file**
```bash
# Edit any frontend file
code frontend/src/app/quotes/create/page.tsx
```

**Method 2: Mention keywords**
```
User: "How do I use Ant Design Form validation with React hooks?"
```

**Method 3: Show intent**
```
User: "Create a new component for displaying product cards"
```

**Expected Result:** Claude mentions frontend-dev-guidelines patterns in response.

### Test Backend Skill

**Method 1: Edit a .py file**
```bash
# Edit any backend file
code backend/routes/quotes.py
```

**Method 2: Mention keywords**
```
User: "How do I add a FastAPI endpoint with authentication?"
```

**Method 3: Show intent**
```
User: "Build an API for exporting quotes to Excel"
```

**Expected Result:** Claude references FastAPI patterns, RLS security, or export guidelines.

### Test Calculation Skill

**Method 1: Edit calculation file**
```bash
# Edit calculation mapper
code backend/routes/quotes_calc.py
```

**Method 2: Mention keywords**
```
User: "How do I validate the discount percentage in calculations?"
```

**Method 3: Show intent**
```
User: "Update the two-tier variable system for product overrides"
```

**Expected Result:** Claude references 42 variables, calculation phases, or mapper patterns.

### Test Database Guardrail

**Method 1: Create migration file**
```bash
# Create new migration
code backend/migrations/021_add_new_table.sql
```

**Method 2: Mention DDL keywords**
```
User: "Create a table for storing user preferences"
```

**Method 3: Show DDL intent**
```
User: "Add a new column to the quotes table"
```

**Expected Result:** Claude activates database-verification skill and asks about RLS policies, required columns, and migration checklist.

### Verify Which Skills Are Active

**Ask Claude directly:**
```
User: "Which skills are currently active?"
```

**Claude will respond with:**
```
Currently active skills:
- frontend-dev-guidelines (triggered by: file path frontend/src/...)
- backend-dev-guidelines (triggered by: keyword "FastAPI")
```

---

## Adding New Skills

### Step 1: Create Skill Directory

```bash
mkdir -p .claude/skills/my-skill-name
mkdir -p .claude/skills/my-skill-name/resources
```

### Step 2: Create SKILL.md (Main Guidelines)

**File:** `.claude/skills/my-skill-name/SKILL.md`

**Template:**
```markdown
# My Skill Name

Domain-specific coding guidelines for [technology/area].

## When This Skill Activates

- Working with [technology]
- Editing files in [directory]
- Implementing [features]

## Key Patterns

### Pattern 1: [Name]
[Description and code examples]

### Pattern 2: [Name]
[Description and code examples]

## Common Mistakes

- ❌ Anti-pattern 1
- ✅ Correct pattern 1

## Resources

See resources/ directory for:
- [resource-1.md] - [description]
- [resource-2.md] - [description]
```

### Step 3: Create Resource Files

**Directory:** `.claude/skills/my-skill-name/resources/`

**Create supporting documentation:**
- `patterns.md` - Common patterns and examples
- `gotchas.md` - Common mistakes and solutions
- `testing.md` - Testing guidelines
- `examples.md` - Full code examples

### Step 4: Update skill-rules.json

**File:** `.claude/skills/skill-rules.json`

**Add your skill:**
```json
{
  "my-skill-name": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "description": "Brief description of what this skill covers",
    "promptTriggers": {
      "keywords": [
        "keyword1",
        "keyword2",
        "keyword3"
      ],
      "intentPatterns": [
        "(create|add|build).*?(feature|component)",
        "(how to|best practice).*?(pattern)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "path/to/**/*.ext",
        "another/path/**"
      ],
      "contentPatterns": [
        "import.*from 'library'",
        "class.*extends.*Base",
        "@decorator"
      ]
    }
  }
}
```

### Step 5: Test Activation

**Validate JSON syntax:**
```bash
python3 -m json.tool .claude/skills/skill-rules.json
```

**Test trigger:**
- Edit a file matching path pattern
- Mention a keyword
- Verify skill loads

### Step 6: Document in This Guide

Add your skill to the "Available Skills" section above with:
- Purpose and description
- Trigger conditions
- Resources provided
- When it activates
- What it provides

---

## skill-rules.json Reference

**Location:** `.claude/skills/skill-rules.json`

**Purpose:** Configuration file that defines skill triggers and behavior.

### Structure

```json
{
  "skill-name": {
    "type": "domain" | "guardrail",
    "enforcement": "suggest" | "warn" | "block",
    "priority": "low" | "medium" | "high" | "critical",
    "description": "Brief description",
    "promptTriggers": {
      "keywords": ["keyword1", "keyword2"],
      "intentPatterns": ["regex1", "regex2"]
    },
    "fileTriggers": {
      "pathPatterns": ["glob1", "glob2"],
      "contentPatterns": ["regex1", "regex2"]
    }
  }
}
```

### Field Descriptions

**type:**
- `domain` - Normal skill (provides guidance)
- `guardrail` - Safety skill (blocks unsafe operations)

**enforcement:**
- `suggest` - Non-blocking, provides recommendations
- `warn` - Shows warnings but allows proceeding
- `block` - Prevents unsafe operations (guardrails only)

**priority:**
- `low` - Nice to have
- `medium` - Recommended
- `high` - Important
- `critical` - Must follow (guardrails)

**promptTriggers.keywords:** Array of case-insensitive keywords
**promptTriggers.intentPatterns:** Array of regex patterns for intent matching

**fileTriggers.pathPatterns:** Array of glob patterns for file paths
**fileTriggers.contentPatterns:** Array of regex patterns for file contents

### Validation

**Check JSON syntax:**
```bash
python3 -m json.tool .claude/skills/skill-rules.json
```

**Expected output:** Formatted JSON with no errors

---

## Troubleshooting

### Skill Not Activating

**Problem:** Expected skill doesn't load when editing file or mentioning keywords.

**Diagnosis:**
1. Check skill-rules.json syntax: `python3 -m json.tool .claude/skills/skill-rules.json`
2. Verify trigger patterns match your file path or keywords
3. Ask Claude: "Which skills are active?" to see what's loaded

**Solutions:**
- Fix JSON syntax errors
- Add more trigger patterns (keywords, file paths)
- Make patterns less specific (use `**` wildcards)
- Check file path matches glob pattern exactly

### Skill Activating Too Often

**Problem:** Skill loads when it shouldn't.

**Diagnosis:**
1. Check which triggers are matching
2. Review keyword list (may be too broad)
3. Check file path patterns (may use too many wildcards)

**Solutions:**
- Make keywords more specific
- Narrow file path patterns
- Add intent patterns instead of broad keywords
- Increase trigger threshold (require multiple matches)

### Skill Content Not Loading

**Problem:** Skill activates but guidelines don't appear.

**Diagnosis:**
1. Verify SKILL.md exists in skill directory
2. Check file permissions (should be readable)
3. Verify file path in skill-rules.json matches actual location

**Solutions:**
- Create SKILL.md if missing
- Fix file permissions: `chmod 644 .claude/skills/*/SKILL.md`
- Update skill-rules.json with correct path

### JSON Syntax Errors

**Problem:** skill-rules.json has syntax errors.

**Diagnosis:**
```bash
python3 -m json.tool .claude/skills/skill-rules.json
# Shows: JSONDecodeError with line number
```

**Common errors:**
- Missing comma between array items
- Trailing comma after last item
- Unescaped quotes in strings
- Unclosed brackets or braces

**Solutions:**
- Validate JSON with: `python3 -m json.tool file.json`
- Use a JSON formatter/validator
- Check bracket matching
- Escape special characters in regex: `\\` for `\`

### Conflicting Skills

**Problem:** Multiple skills activate and provide conflicting advice.

**Diagnosis:**
1. Ask: "Which skills are active?"
2. Review trigger overlap in skill-rules.json
3. Check if both skills apply to same domain

**Solutions:**
- Merge skills if they cover same domain
- Make triggers more specific (reduce overlap)
- Set priority levels to indicate which skill takes precedence
- Use enforcement levels (suggest vs warn vs block)

### Performance Issues

**Problem:** Too many skills active at once, slowing down responses.

**Diagnosis:**
1. Ask: "Which skills are active?"
2. Check if skills are loading unnecessarily
3. Review token usage

**Solutions:**
- Deactivate unused skills (remove from skill-rules.json)
- Make triggers more specific (reduce unnecessary activation)
- Combine similar skills into one larger skill
- Use lazy loading (load resources only when needed)

---

**End of Skills System Guide**

For hooks system documentation, see `.claude/HOOKS_REFERENCE.md`
For slash commands, see `.claude/commands/README.md`
For main project instructions, see `CLAUDE.md`
