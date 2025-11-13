# Phase 7: Slash Commands (Optional)

**Time:** 4-5 hours
**Priority:** 🔵 OPTIONAL
**Prerequisites:** Phases 1-6 completed
**Output:** 4 project-specific workflow commands

---

## Overview

Streamlined workflows for common tasks. **This phase is OPTIONAL** - defer if time-constrained.

---

## Command 1: /test-quote-creation (1.5 hours)

**Purpose:** Complete quote workflow test (backend + browser E2E)

**Location:** `.claude/commands/test-quote-creation.md`

**What it does:**
1. Starts backend server (if not running)
2. Starts frontend server (if not running)
3. Runs backend tests for quote calculation
4. Launches Chrome with preflight check
5. Navigates to quote creation page
6. Tests happy path workflow
7. Checks console for errors
8. Verifies data saves correctly
9. Generates report
10. Cleans up Chrome

**Usage:** `/test-quote-creation`

**Benefits:** One command instead of 10 manual steps.

---

## Command 2: /fix-typescript-errors (1 hour)

**Purpose:** Auto-fix common TypeScript errors

**Location:** `.claude/commands/fix-typescript-errors.md`

**What it does:**
1. Runs `npm run type-check` to find errors
2. Categorizes errors (unused imports, type mismatches, etc.)
3. Auto-fixes safe errors:
   - Remove unused imports
   - Add missing types (any → proper type)
   - Fix common React 19 issues
4. Reports errors that need manual fix
5. Re-runs type-check to verify

**Usage:** `/fix-typescript-errors`

**Benefits:** Fixes 108 warnings automatically.

---

## Command 3: /apply-migration (1 hour)

**Purpose:** Safe migration apply with backup and verification

**Location:** `.claude/commands/apply-migration.md`

**What it does:**
1. Shows current migration status
2. Lists pending migrations
3. Creates database backup (pg_dump)
4. Applies migration
5. Verifies migration (checks tables/columns exist)
6. Runs RLS policy check
7. Tests with backend API call
8. Updates MIGRATIONS.md
9. If failed: Auto-rollback to backup

**Usage:** `/apply-migration <migration_file>`

**Benefits:** Safe migration with auto-rollback.

---

## Command 4: /debug-calculation (1 hour)

**Purpose:** Step-through calculation debug with variable tracking

**Location:** `.claude/commands/debug-calculation.md`

**What it does:**
1. Takes quote data as input (JSON)
2. Validates 10 required fields
3. Shows two-tier precedence for each variable
4. Maps to 7 Pydantic models
5. Steps through 13 calculation phases
6. Shows intermediate values at each phase
7. Identifies where calculation fails
8. Suggests fixes

**Usage:** `/debug-calculation <quote_data.json>`

**Benefits:** Quickly find calculation bugs.

---

## Implementation Notes

### Slash commands are markdown files

**Format:**
```markdown
# Command Name

**Description:** What this command does

**Usage:** /command-name [args]

**Implementation:**

1. Step 1
   - Details
   - Code/commands to run

2. Step 2
   - Details
   - Code/commands to run

...
```

**Claude expands the markdown into the conversation when user types /command-name.**

---

## Success Criteria

- [ ] All 4 commands created
- [ ] Commands tested and working
- [ ] Error handling included
- [ ] Documentation clear
- [ ] Benefits realized (time savings)

---

## See Full Details

Original plan: IMPLEMENTATION_PLAN_BEST_PRACTICES.md (lines 2400-2800)
- Complete command implementations
- Code examples for each step
- Error handling patterns
- Testing scenarios

