# Phase 1: Skills Content - Frontend & Backend

**Time:** 6-8 hours
**Priority:** 🔴 CRITICAL
**Prerequisites:** Quick Wins completed (optional but recommended)
**Output:** 2 comprehensive skills with resources

---

## Overview

Create the two most important skills:
1. **frontend-dev-guidelines** - React 19, Ant Design, ag-Grid patterns
2. **backend-dev-guidelines** - FastAPI, Supabase, RLS patterns

Each skill has:
- Main SKILL.md file (<500 lines) - Quick reference + when to use agents
- Resource files - Detailed patterns, examples, gotchas

---

## Task 1.1: Frontend Dev Guidelines Skill (3-4 hours)

### Directory Structure

```
.claude/skills/frontend-dev-guidelines/
├── SKILL.md                           # Main file (<500 lines)
└── resources/
    ├── react-patterns.md              # React 19 patterns
    ├── ant-design-standards.md        # Ant Design v5 patterns
    ├── ag-grid-patterns.md            # ag-Grid usage (NEW ⭐)
    ├── state-management.md            # Context, useState patterns
    └── common-gotchas.md              # Frontend bugs from MASTER_BUG_INVENTORY
```

### Content to Create

#### SKILL.md (Main File)

**Goal:** Quick reference that points to detailed resources.

**Structure:**
```markdown
# Frontend Development Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29
**Applies To:** React 19, Next.js 15.5, Ant Design v5, ag-Grid Community

## When This Skill Applies

Auto-activates when:
- Working in `frontend/src/**` directory
- Creating/modifying React components (.tsx, .jsx files)
- Implementing UI features
- Working with forms, tables, data grids
- Data fetching or state management

## Quick Reference

**See resource files for details:**
- `react-patterns.md` - Component structure, hooks, Suspense, Error Boundaries
- `ant-design-standards.md` - Forms, validation, theming, v5 migration
- `ag-grid-patterns.md` - Grid setup, column defs, cell renderers ⭐ NEW
- `state-management.md` - When to use Context vs useState vs props
- `common-gotchas.md` - Bugs we've hit and solutions

## Critical Patterns (Brief Overview)

### Component Structure
[1-2 paragraphs with link to react-patterns.md]

### Forms & Validation
[1-2 paragraphs with link to ant-design-standards.md]

### Data Tables (ag-Grid)
[1-2 paragraphs with link to ag-grid-patterns.md] ⭐ NEW

### State Management
[1-2 paragraphs with link to state-management.md]

## When to Use Agents

**Before starting:**
- Large UI changes? → `@Plan` agent for architectural planning

**During implementation:**
- Stuck on React/TypeScript? → `@expert` agent for deep analysis
- Need UX review? → `@ux-reviewer` agent checks consistency

**After implementation:**
- `@code-reviewer` runs automatically (orchestrator invokes)
- `@integration-tester` runs browser tests (orchestrator invokes)

## Common Gotchas

**Top 5 (see common-gotchas.md for full list):**
1. Case-sensitive role checks (use `.toLowerCase()`)
2. Missing form validation rules (add `rules` prop)
3. Ant Design v5 vs v4 APIs (check migration guide)
4. ag-Grid column defs not reactive (need new array reference)
5. ag-Grid API not available on mount (use `onGridReady`)

## Testing

**See:** `.claude/TESTING_WORKFLOW.md`
- Jest unit tests for utils/services
- React Testing Library for components
- Chrome DevTools MCP for E2E (see `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`)
```

---

#### resources/ag-grid-patterns.md ⭐ NEW

**Goal:** Consistent ag-Grid usage across 149 references in codebase.

**Content:** Extract from existing quote creation page, add best practices.

**Sections:**
1. **Grid Setup** - Basic configuration
2. **Column Definitions** - Types, formatters, editors
3. **Cell Renderers** - Custom components in cells
4. **Data Updates** - Reactive updates, row data changes
5. **Grid API** - Common operations (export, select, filter)
6. **Performance** - Virtualization, pagination, row height
7. **Common Patterns** - Editable grids, selection, bulk operations
8. **Gotchas** - Column defs reactivity, API timing, re-rendering

**Extract from:** 
- `frontend/src/app/quotes/create/page.tsx` (main example)
- Document current patterns
- Add what we wish we'd known at start

---

#### resources/ant-design-standards.md

**Content to include:**

1. **Form Patterns**
   - Required fields (rules + asterisk)
   - Validation feedback
   - Error messages in Russian
   - Submit handlers

2. **v5 Migration**
   - Deprecated APIs we've hit:
     - Button type="ghost" → type="default" variant="outlined"
     - dropdownMatchSelectWidth → dropdownStyle
   - See BUG-034, BUG-040 in MASTER_BUG_INVENTORY.md

3. **Common Components**
   - Form, Select, Input, DatePicker
   - Table (when NOT to use - prefer ag-Grid for complex tables)
   - Layout (Sider, Header, Content)

4. **Theming**
   - Our color scheme
   - ConfigProvider setup

**Extract from:**
- Existing forms (quote create, settings pages)
- Bug inventory (BUG-034, BUG-040)

---

#### resources/common-gotchas.md

**Content:** Extract frontend bugs from `.claude/COMMON_GOTCHAS.md` (created in Quick Wins).

**Sections:**
1. Role checks (BUG-006)
2. Form validation (BUG-002)
3. Ant Design deprecated APIs (BUG-034, BUG-040)
4. ag-Grid reactivity issues
5. React 19 compatibility (BUG-043)
6. TypeScript warnings (BUG-044)

---

### Verification Checklist

After creating frontend skill:

- [ ] SKILL.md < 500 lines
- [ ] ag-grid-patterns.md created with current usage patterns
- [ ] ant-design-standards.md includes v5 migration gotchas
- [ ] common-gotchas.md includes bugs from inventory
- [ ] All cross-references between files work
- [ ] Agent invocation guidance included

---

## Task 1.2: Backend Dev Guidelines Skill (3-4 hours)

### Directory Structure

```
.claude/skills/backend-dev-guidelines/
├── SKILL.md                           # Main file (<500 lines)
└── resources/
    ├── fastapi-patterns.md            # Route handlers, dependencies
    ├── supabase-rls.md                # RLS patterns (EXPANDED ⭐)
    ├── export-patterns.md             # Excel/PDF export (NEW ⭐)
    ├── error-handling.md              # HTTPException, status codes
    ├── testing-patterns.md            # Pytest, fixtures, async tests
    └── common-gotchas.md              # Backend bugs from MASTER_BUG_INVENTORY
```

### Content to Create

#### SKILL.md (Main File)

**Structure:** Similar to frontend skill.

**Key sections:**
- When this skill applies (backend/**/*.py files)
- Quick reference to resources
- Critical patterns overview
- When to use agents (`@expert` for performance, `@security-auditor` for RLS)
- Common gotchas (top 5)
- Testing guidance

---

#### resources/supabase-rls.md (EXPANDED ⭐)

**Goal:** Prevent RLS bugs (critical for multi-tenant security).

**Content:**
- Copy from `.claude/RLS_CHECKLIST.md` (created in Quick Wins)
- Add code examples from existing migrations
- Add testing patterns
- Add common bugs (missing policies, wrong context)

**Why expanded:** 284 RLS references in codebase - security critical.

---

#### resources/export-patterns.md (NEW ⭐)

**Goal:** Consistent Excel/PDF export handling.

**Content:**

1. **Excel Export (openpyxl)**
   - Workbook creation
   - Styling (headers, borders, alignment)
   - Formula generation
   - File saving with UUID

2. **PDF Export (WeasyPDF)**
   - HTML template rendering
   - CSS styling
   - Page breaks
   - File generation

3. **File Management**
   - UUID generation for filenames
   - Temporary file storage (/tmp/)
   - Cleanup after download
   - Error handling

4. **Common Bugs**
   - UUID not tracked (BUG: file created but can't download)
   - File not cleaned up (fills disk)
   - Missing error handling

**Extract from:**
- Existing export routes
- Bug patterns we've encountered

**Why needed:** Multiple export features, need consistency.

---

#### resources/common-gotchas.md

**Content:** Extract backend bugs from `.claude/COMMON_GOTCHAS.md` (created in Quick Wins).

**Sections:**
1. Missing customer JOIN (BUG-001)
2. Activity log decorator not applied (BUG-003)
3. Concurrent request performance (BUG-038)
4. RLS policies missing
5. Export UUID bugs

---

### Verification Checklist

After creating backend skill:

- [ ] SKILL.md < 500 lines
- [ ] supabase-rls.md expanded with RLS patterns
- [ ] export-patterns.md created with Excel/PDF examples
- [ ] common-gotchas.md includes bugs from inventory
- [ ] All cross-references between files work
- [ ] Agent invocation guidance included

---

## Removals (From Reddit Post)

**Remove these references** (don't apply to our stack):

1. ❌ **Prisma patterns** → We use Supabase client
2. ❌ **TanStack Router** → We use Next.js App Router
3. ❌ **Material UI** → We use Ant Design
4. ❌ **PM2 deployment** → We don't use process manager
5. ❌ **Microservices patterns** → We have 1 backend service

**Replace with:**
1. ✅ **Supabase client patterns**
2. ✅ **Next.js App Router patterns**
3. ✅ **Ant Design patterns**
4. ✅ **Single service patterns**

---

## Customization Summary

### Additions (Not in Reddit Post)

1. ✅ **ag-Grid patterns** - 149 references, needs consistency
2. ✅ **Calculation engine guidelines** - Defer to Phase 2
3. ✅ **RLS patterns expansion** - Security critical
4. ✅ **Export patterns** - Excel/PDF consistency
5. ✅ **Bug learning** - Extract from MASTER_BUG_INVENTORY.md

### Changes from Reddit Post

| Reddit Post | Our Platform |
|-------------|--------------|
| TanStack Router patterns | Next.js App Router patterns |
| Material UI components | Ant Design v5 components |
| Prisma ORM | Supabase client + RLS |
| Generic table component | ag-Grid specific patterns |
| Microservices | Single FastAPI service |

---

## Time Breakdown

| Task | Time | Notes |
|------|------|-------|
| Frontend SKILL.md | 30 min | Quick reference + links |
| react-patterns.md | 45 min | Extract from existing code |
| ant-design-standards.md | 45 min | v5 migration, deprecations |
| ag-grid-patterns.md | 60 min | NEW - Document 149 usages |
| state-management.md | 30 min | Simple patterns |
| common-gotchas.md (frontend) | 30 min | From Quick Wins + bugs |
| Backend SKILL.md | 30 min | Quick reference + links |
| fastapi-patterns.md | 45 min | Extract from existing code |
| supabase-rls.md | 60 min | EXPANDED - From RLS checklist |
| export-patterns.md | 60 min | NEW - Excel/PDF patterns |
| error-handling.md | 30 min | HTTPException patterns |
| testing-patterns.md | 30 min | Pytest patterns |
| common-gotchas.md (backend) | 30 min | From Quick Wins + bugs |
| **TOTAL** | **6-8 hours** | |

---

## Next Steps

After Phase 1:

1. **Verify skills work** - Check file structure, cross-references
2. **Move to Phase 2** - Calculation engine + database skills (see `03-PHASE2-SKILLS-CALCULATION-DB.md`)
3. **Don't create skill-rules.json yet** - That's Phase 3 (infrastructure)

**Phase 1 creates content, Phase 3 makes it auto-activate.**

---

## Success Criteria

- [ ] Two skills created with resource files
- [ ] ag-Grid patterns documented (addresses 149 references)
- [ ] RLS patterns expanded (addresses security)
- [ ] Export patterns documented (addresses consistency)
- [ ] Bug patterns extracted (prevents repeating mistakes)
- [ ] All files < 800 lines (readable)
- [ ] Cross-references work
- [ ] Agent guidance included
- [ ] Tech stack matches our platform (no Prisma/MUI/TanStack Router)

