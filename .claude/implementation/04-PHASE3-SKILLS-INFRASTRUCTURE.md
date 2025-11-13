# Phase 3: Skills Infrastructure

**Time:** 3-4 hours
**Priority:** 🟡 IMPORTANT  
**Prerequisites:** Phases 1-2 completed (skill content created)
**Output:** Auto-activating skills system

---

## Overview

Make skills auto-activate based on:
- File paths being edited
- Keywords in prompts
- Content patterns in files

**Phases 1-2 created content, Phase 3 makes it automatic.**

---

## Task 3.1: skill-rules.json Configuration (2 hours)

### Create File

**Location:** `.claude/skills/skill-rules.json`

### Content Structure

```json
{
  "frontend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "description": "React 19, Ant Design v5, ag-Grid patterns",
    "promptTriggers": {
      "keywords": [
        "react", "component", "frontend", "UI", "UX",
        "ant design", "antd", "form", "table", "layout",
        "ag-grid", "ag grid", "data grid", "grid column",
        "state", "hook", "useState", "useEffect"
      ],
      "intentPatterns": [
        "(create|add|build|implement).*?(component|page|feature|UI)",
        "(how to|best practice|pattern).*?(react|frontend|component)",
        "(style|design|layout).*?(page|component)",
        "(form|validation|submit)",
        "(grid|table|ag-grid)",
        "(data.*fetch|query|mutation)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "frontend/src/**/*.tsx",
        "frontend/src/**/*.ts",
        "frontend/src/**/*.jsx"
      ],
      "contentPatterns": [
        "import.*from 'react'",
        "import.*from 'antd'",
        "import.*ag-grid",
        "export.*function.*Component",
        "const.*=.*\\(\\).*=>",
        "useState|useEffect|useCallback"
      ]
    }
  },

  "backend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "description": "FastAPI, Supabase, PostgreSQL, RLS patterns",
    "promptTriggers": {
      "keywords": [
        "backend", "api", "endpoint", "route", "controller",
        "fastapi", "supabase", "database", "postgres",
        "rls", "policy", "permission", "auth",
        "export", "excel", "pdf", "weasyprint"
      ],
      "intentPatterns": [
        "(create|add|build|implement).*?(route|endpoint|api|controller|service)",
        "(how to|best practice|pattern).*?(backend|api|endpoint)",
        "(database|query|schema)",
        "(rls|policy|permission|security)",
        "(export|excel|pdf|download)",
        "(error.*handle|exception|try.*catch)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "backend/**/*.py",
        "backend/routes/**",
        "backend/services/**"
      ],
      "contentPatterns": [
        "from fastapi",
        "@router\\.",
        "@app\\.",
        "async def",
        "supabase\\.",
        "raise HTTPException",
        "openpyxl|weasyprint"
      ]
    }
  },

  "calculation-engine-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "critical",
    "description": "42 variables, 13 phases, two-tier system",
    "promptTriggers": {
      "keywords": [
        "calculation", "calculate", "quote price", "pricing",
        "variable", "variables", "rate", "percent",
        "forex", "discount", "markup", "margin",
        "advance payment", "delivery days", "customs duty"
      ],
      "intentPatterns": [
        "(calculate|computation|pricing|quote).*?(price|cost|total)",
        "(add|modify|change).*?(variable|calculation|formula)",
        "(validation|validate).*?(quote|price|calculation)",
        "(two-tier|product.*override|quote.*default)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "backend/routes/quotes_calc.py",
        "backend/tests/test_quotes_calc*.py"
      ],
      "contentPatterns": [
        "map_variables_to_calculation_input",
        "validate_calculation_input",
        "CalculationInput",
        "get_value.*product.*quote",
        "rate_forex|pct_discount|pct_markup"
      ]
    }
  },

  "database-verification": {
    "type": "guardrail",
    "enforcement": "block",
    "priority": "critical",
    "description": "Database schema and migration guardrails with RLS",
    "promptTriggers": {
      "keywords": [
        "migration", "schema", "column", "table",
        "alter table", "create table", "drop",
        "database", "postgres", "supabase", "rls",
        "policy", "row level security"
      ],
      "intentPatterns": [
        "(create|add|modify|drop|alter).*?(table|column|schema)",
        "(migration|migrate)",
        "(database.*change|schema.*change)",
        "(rls|policy|row.*level.*security)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "backend/migrations/**/*.sql"
      ],
      "contentPatterns": [
        "CREATE TABLE",
        "ALTER TABLE",
        "DROP TABLE",
        "ADD COLUMN",
        "DROP COLUMN",
        "ENABLE ROW LEVEL SECURITY",
        "CREATE POLICY"
      ]
    }
  }
}
```

### Testing Triggers

**Test each skill activates correctly:**

1. **Frontend skill:**
   - Open `frontend/src/app/quotes/create/page.tsx`
   - Ask: "How should I structure this React component?"
   - Should activate: frontend-dev-guidelines

2. **Backend skill:**
   - Open `backend/routes/quotes.py`
   - Ask: "How do I add a new FastAPI endpoint?"
   - Should activate: backend-dev-guidelines

3. **Calculation skill:**
   - Open `backend/routes/quotes_calc.py`
   - Ask: "How do I validate quote variables?"
   - Should activate: calculation-engine-guidelines

4. **Database skill:**
   - Create test file: `backend/migrations/999_test.sql`
   - Ask: "I want to create a new table"
   - Should activate: database-verification (GUARDRAIL - blocks until verified)

---

## Task 3.2: CLAUDE.md Restructure (1-2 hours)

### Current State

**Root CLAUDE.md:** ~1000+ lines (too large)

### Goal

**Reduce to 250-300 lines** by moving patterns to skills.

### What to Remove

Move to skills (Phases 1-2):
- React patterns → frontend-dev-guidelines
- Ant Design patterns → frontend-dev-guidelines  
- ag-Grid patterns → frontend-dev-guidelines
- FastAPI patterns → backend-dev-guidelines
- RLS patterns → backend-dev-guidelines + database-verification
- Calculation patterns → calculation-engine-guidelines

### What to Keep

Keep in CLAUDE.md:
- Project overview
- Tech stack list
- Quick commands (npm run dev, pytest)
- Server addresses (localhost:3000, :8000)
- Test credentials
- MCP servers list
- File operation workflows
- When to use which agent
- Skills system explanation
- Session progress tracking

### Add to CLAUDE.md

```markdown
## Skills System

**We use auto-activating skills for consistent code patterns.**

### Available Skills

1. **frontend-dev-guidelines** - React 19, Ant Design v5, ag-Grid
   - Auto-activates: frontend/**/*.tsx files, React keywords
   - Purpose: Consistent UI patterns, prevent common bugs
   - Details: `.claude/skills/frontend-dev-guidelines/SKILL.md`

2. **backend-dev-guidelines** - FastAPI, Supabase, RLS
   - Auto-activates: backend/**/*.py files, API keywords  
   - Purpose: Consistent API patterns, RLS security
   - Details: `.claude/skills/backend-dev-guidelines/SKILL.md`

3. **calculation-engine-guidelines** - 42 variables, 13 phases
   - Auto-activates: quotes_calc.py, calculation keywords
   - Purpose: Prevent calculation errors, enforce validation
   - Details: `.claude/skills/calculation-engine-guidelines/SKILL.md`

4. **database-verification** - Schema changes, RLS guardrails
   - Auto-activates: migrations/*.sql, schema keywords
   - Type: GUARDRAIL (blocks until verified)
   - Purpose: Prevent data leakage, enforce RLS
   - Details: `.claude/skills/database-verification/SKILL.md`

### How Skills Work

**Automatic activation based on:**
- Files being edited (path patterns)
- Keywords in prompts
- Code content patterns

**You don't need to manually load skills** - They activate automatically when relevant.

**Guardrail skills (database-verification):**
- BLOCK operations until checklist verified
- Ask for confirmation before proceeding
- Prevent security bugs

### When Skills Activate

**Example 1: Frontend work**
```
User: "I want to add a new form"
Files: frontend/src/app/settings/page.tsx
→ frontend-dev-guidelines auto-activates
→ Shows Ant Design form patterns
→ Shows validation patterns
```

**Example 2: Database migration**
```
User: "Create a new quotes_approval table"  
Files: backend/migrations/010_quotes_approval.sql
→ database-verification auto-activates (GUARDRAIL)
→ Shows RLS checklist
→ BLOCKS until verified
→ Asks: "Have you added RLS policies?"
```

**Example 3: Calculation changes**
```
User: "Add a new pricing variable"
Files: backend/routes/quotes_calc.py
→ calculation-engine-guidelines auto-activates
→ Shows 42 variable classification
→ Shows two-tier system rules
→ Shows validation requirements
```

### Skill Priority

When multiple skills match:
1. **CRITICAL** (database-verification, calculation-engine) - Always apply
2. **HIGH** (frontend-dev, backend-dev) - Apply if relevant
3. **MEDIUM** (general patterns) - Apply if no higher priority

### Disabling Skills (If Needed)

To temporarily disable a skill:
```
User: "Skip frontend-dev-guidelines for this task"
```

Skills are meant to help, not hinder. Can be bypassed when intentional.
```

### Target Result

**CLAUDE.md after restructure:**
- 250-300 lines (down from 1000+)
- High-level project info
- Quick commands and workflows
- Skills system explanation
- Points to skills for detailed patterns

---

## Task 3.3: Skills README (30 minutes)

### Create File

**Location:** `.claude/skills/README.md`

### Content

```markdown
# Skills System

**Last Updated:** 2025-10-29
**Purpose:** Auto-activating coding guidelines and guardrails

---

## Overview

Skills provide **context-aware coding guidelines** that auto-activate based on:
- Files being edited
- Keywords in prompts  
- Code content patterns

**Benefits:**
- Consistent patterns across codebase
- Prevent common bugs
- Enforce security (RLS policies)
- Reduce token usage (40-60% savings)

---

## Available Skills

### Domain Skills (Suggestions)

1. **frontend-dev-guidelines** (HIGH priority)
   - React 19, Ant Design v5, ag-Grid patterns
   - Auto-activates: frontend/**/*.tsx files
   - Details: `frontend-dev-guidelines/SKILL.md`

2. **backend-dev-guidelines** (HIGH priority)
   - FastAPI, Supabase, RLS patterns
   - Auto-activates: backend/**/*.py files
   - Details: `backend-dev-guidelines/SKILL.md`

3. **calculation-engine-guidelines** (CRITICAL priority)
   - 42 variables, 13 phases, two-tier system
   - Auto-activates: quotes_calc.py
   - Details: `calculation-engine-guidelines/SKILL.md`

### Guardrail Skills (Blocking)

4. **database-verification** (CRITICAL priority)
   - Database schema, RLS verification
   - Auto-activates: migrations/**/*.sql
   - **BLOCKS** until checklist verified
   - Details: `database-verification/SKILL.md`

---

## How Skills Work

### Automatic Activation

Skills activate based on **skill-rules.json** configuration:

```
User prompt contains "create a form"
+ Editing frontend/src/app/page.tsx
→ frontend-dev-guidelines activates
→ Shows Ant Design form patterns
```

### Trigger Types

1. **Prompt triggers** - Keywords in user message
2. **File triggers** - Path patterns being edited
3. **Content triggers** - Code patterns in files

### Enforcement Modes

- **suggest** - Provide guidelines, user can ignore
- **block** - MUST verify checklist before proceeding

### Priority Levels

- **critical** - Always apply (calculation, database)
- **high** - Apply when relevant (frontend, backend)
- **medium** - Apply if no conflicts

---

## Skill Structure

Each skill has:

```
skill-name/
├── SKILL.md                    # Main file (<500 lines)
│                              # Quick reference + agent guidance
└── resources/                 # Detailed patterns
    ├── patterns.md
    ├── gotchas.md
    └── examples.md
```

**Main SKILL.md:**
- When skill applies
- Quick reference (points to resources)
- Critical patterns (brief overview)
- When to use agents
- Common gotchas (top 5)

**Resource files:**
- Detailed patterns with code examples
- Complete gotchas list
- Testing guidance
- Links to related files

---

## Configuration

**skill-rules.json** - Defines when skills activate

**Format:**
```json
{
  "skill-name": {
    "type": "domain" | "guardrail",
    "enforcement": "suggest" | "block",
    "priority": "critical" | "high" | "medium",
    "promptTriggers": {
      "keywords": ["react", "component", ...],
      "intentPatterns": ["regex patterns"]
    },
    "fileTriggers": {
      "pathPatterns": ["frontend/**/*.tsx"],
      "contentPatterns": ["import.*react"]
    }
  }
}
```

---

## Testing Skills

### Manual Testing

1. Open file matching path pattern
2. Use keywords that should trigger skill
3. Verify skill activates and shows correct content

### Example Tests

**Frontend skill:**
```
1. Open: frontend/src/app/quotes/create/page.tsx
2. Ask: "How should I add form validation?"
3. Verify: frontend-dev-guidelines activates
4. Check: Shows Ant Design validation patterns
```

**Database skill (GUARDRAIL):**
```
1. Create: backend/migrations/999_test.sql
2. Ask: "I want to add a new table"
3. Verify: database-verification activates
4. Check: Shows RLS checklist, BLOCKS until verified
```

---

## Maintenance

### Adding New Skill

1. Create directory: `.claude/skills/new-skill-name/`
2. Create SKILL.md (< 500 lines)
3. Create resources/*.md files
4. Add to skill-rules.json
5. Test activation triggers
6. Update this README

### Updating Existing Skill

1. Edit SKILL.md or resources/*.md
2. Update "Last Updated" timestamp
3. Test changes
4. Update skill-rules.json if triggers change

### Removing Skill

1. Remove from skill-rules.json
2. Archive directory to `.claude/skills/_archived/`
3. Update this README

---

## Quick Reference

**For coding guidelines:** Read SKILL.md in each skill directory

**For skill configuration:** Read skill-rules.json

**For skill architecture:** Read main CLAUDE.md (Skills System section)

