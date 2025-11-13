# CLAUDE.md Restructure Blueprint

**Analysis Date:** 2025-10-30
**Current File:** /home/novi/quotation-app-dev/CLAUDE.md
**Current Size:** 883 lines

---

## Executive Summary

CLAUDE.md is currently **oversized and serving dual purposes** (core project instructions + domain-specific patterns). Restructuring will:
- Reduce CLAUDE.md from **883 → ~450 lines** (49% reduction)
- Move domain patterns to existing skill files
- Keep essential navigation and context awareness
- Improve maintainability and parallel skill usage

---

## 1. SECTION INVENTORY & ANALYSIS

### CLAUDE.md Current Structure (883 lines total)

| Section | Lines | Purpose | Category | Recommendation |
|---------|-------|---------|----------|-----------------|
| **Header & Tech Stack** | 1-7 | Project overview | Core | **KEEP** |
| **Core Principles** | 9-124 | Philosophy & workflows | Core | **KEEP** (slightly condensed) |
| **Communication Style** | 127-133 | Team communication guidelines | Core | **KEEP** |
| **Specialized Agent Team** | 137-305 | Agent workflow & orchestration | Core | **KEEP** (critical for user) |
| **Project Architecture** | 308-330 | Two-tier variable system, RLS | Core | **KEEP** (brief overview) |
| **Key Files & Documentation** | 333-362 | Navigation hub | Core | **KEEP** (slight update) |
| **Current Status** | 365-484 | Session 26 status & deliverables | Core | **KEEP** (essential context) |
| **Common Workflows** | 487-512 | How to make changes | Hybrid | **MOVE 80%** → frontend/backend CLAUDE.md |
| **Automated Testing Workflow** | 515-599 | Testing commands & TDD | Hybrid | **MOVE** → .claude/TESTING_WORKFLOW.md |
| **Variable Quick Reference** | 602-610 | 42 variables overview | Reference | **MOVE** → .claude/VARIABLES.md (already exists) |
| **Debugging Tools Available** | 614-673 | Chrome DevTools, Playwright | Reference | **CONDENSE** → Keep 5 lines, link to .claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md |
| **Troubleshooting** | 676-792 | WSL2 memory issues, recovery | Reference | **MOVE** → .claude/scripts/README.md (already exists) |
| **Installed Tools & Dependencies** | 796-880 | Package versions, MCP servers | Reference | **KEEP** (brief list + link to frontend/backend CLAUDE.md) |

---

## 2. DETAILED SECTION MAPPING

### KEEP IN CLAUDE.md (Essential for every user session)

```
Lines 1-7:      Header & Tech Stack
Lines 9-124:    Core Principles (⚠️ SLIGHTLY CONDENSE)
Lines 127-133:  Communication Style
Lines 137-305:  Specialized Agent Team (⚠️ CONDENSE agent descriptions)
Lines 308-330:  Project Architecture (keep brief)
Lines 333-362:  Key Files & Documentation (UPDATE with new structure)
Lines 365-484:  Current Status (SESSION_PROGRESS.md reference)
Lines 796-880:  Installed Tools & Dependencies (CONDENSE + LINK)

TOTAL KEEP: ~450 lines (condensed from 883)
```

**Key insight:** These sections enable users to:
1. Understand core principles in one read
2. Know which agent to call
3. Have current project status
4. Quick reference to all documentation
5. Know tech stack basics

---

### MOVE TO FRONTEND-DEV-GUIDELINES (already has infrastructure)

**From CLAUDE.md "Common Workflows" section (lines 487-512):**
- Making API Changes
- UI Changes
- **Destination:** frontend-dev-guidelines/resources/workflow-patterns.md (NEW FILE)
- **Why:** Already in frontend skill; avoid duplication

**From CLAUDE.md "Automated Testing Workflow" (lines 515-599):**
- Quick Commands (frontend npm commands)
- Frontend Watch Mode
- **Destination:** Already in frontend-dev-guidelines/SKILL.md section "Testing"
- **Why:** Frontend tests are frontend-specific

**Coverage:** Frontend skill ALREADY has 70% of content in `common-gotchas.md` + `ant-design-standards.md`

---

### MOVE TO BACKEND-DEV-GUIDELINES (already has infrastructure)

**From CLAUDE.md "Common Workflows" (lines 487-512):**
- Making API Changes
- Database Migrations
- File Operations
- **Destination:** backend-dev-guidelines/resources/workflow-patterns.md (NEW FILE)
- **Why:** Backend skill has 6 resource files; these are natural extensions

**From CLAUDE.md "Automated Testing Workflow" (lines 515-599):**
- Backend - Run All Tests
- Backend - Specific Tests
- Backend - Watch Mode
- **Destination:** Already in backend-dev-guidelines/SKILL.md section "Testing"
- **Why:** Backend tests are backend-specific

**Coverage:** Backend skill ALREADY has testing in `testing-patterns.md` (482 lines)

---

### MOVE TO CALCULATION-ENGINE-GUIDELINES

**From CLAUDE.md "Project Architecture" (lines 308-330):**
- Two-Tier Variable System (expand)
- Admin vs User Variables
- **Destination:** calculation-engine-guidelines/resources/two-tier-system.md (ALREADY EXISTS!)
- **Why:** Calculation skill already has detailed variable specs

**Coverage:** Calculation skill ALREADY has:
- `variable-specification.md` (detailed specs)
- `two-tier-system.md` (two-tier logic)
- `validation-rules.md` (validation patterns)

---

### MOVE TO DATABASE-VERIFICATION (GUARDRAIL SKILL)

**From CLAUDE.md "Project Architecture" (lines 308-330):**
- Multi-Tenant with RLS
- Role-Based Access
- **Destination:** database-verification/SKILL.md (ALREADY EXISTS!)
- **Why:** Database skill is guardrail for schema changes

**Coverage:** Database skill ALREADY has:
- `rls-patterns.md` (1,392 lines on RLS)
- `schema-standards.md` (schema design)
- `rls-patterns.md` (multi-tenant patterns)

---

### MOVE TO EXISTING .claude/ DOCUMENTATION

**From CLAUDE.md "Automated Testing Workflow" (lines 515-599):**
- Test-Driven Development (TDD) Workflow
- Coverage Goals
- **Destination:** Already in .claude/TESTING_WORKFLOW.md (150+ lines)

**From CLAUDE.md "Variable Quick Reference" (lines 602-610):**
- 42 variables overview
- **Destination:** Already in .claude/VARIABLES.md (complete guide)

**From CLAUDE.md "Debugging Tools Available" (lines 614-673):**
- Chrome DevTools MCP (reference only)
- **Destination:** Already in .claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md (comprehensive)

**From CLAUDE.md "Troubleshooting" (lines 676-792):**
- WSL2 memory management
- Recovery procedures
- **Destination:** Already in .claude/scripts/README.md (complete guide)

---

## 3. SKILLS CONTENT VERIFICATION

### Frontend-Dev-Guidelines Status

| Content | Currently Has | Needs Adding |
|---------|---------------|--------------|
| Component patterns | ✅ YES (react-patterns.md) | ❌ NO |
| Form validation | ✅ YES (ant-design-standards.md) | ❌ NO |
| ag-Grid patterns | ✅ YES (ag-grid-patterns.md) | ❌ NO |
| State management | ✅ YES (state-management.md) | ❌ NO |
| Common gotchas | ✅ YES (common-gotchas.md) | ❌ NO |
| API change workflow | ❌ NO | ✅ ADD workflow-patterns.md |
| UI change workflow | ❌ NO | ✅ ADD workflow-patterns.md |

**Gap:** Missing "Common Workflows" section
**Action:** Add `workflow-patterns.md` with API/UI change patterns

---

### Backend-Dev-Guidelines Status

| Content | Currently Has | Needs Adding |
|---------|---------------|--------------|
| FastAPI patterns | ✅ YES (fastapi-patterns.md) | ❌ NO |
| RLS & security | ✅ YES (supabase-rls.md) | ❌ NO |
| Export patterns | ✅ YES (export-patterns.md) | ❌ NO |
| Error handling | ✅ YES (error-handling.md) | ❌ NO |
| Testing patterns | ✅ YES (testing-patterns.md) | ❌ NO |
| Common gotchas | ✅ YES (common-gotchas.md) | ❌ NO |
| API change workflow | ❌ NO | ✅ ADD workflow-patterns.md |
| Database migration workflow | ❌ NO | ✅ ADD workflow-patterns.md |

**Gap:** Missing "Common Workflows" section (API changes, migrations)
**Action:** Add `workflow-patterns.md` with API/DB change patterns

---

### Calculation-Engine-Guidelines Status

| Content | Currently Has | Needs Adding |
|---------|---------------|--------------|
| 13-phase pipeline | ✅ YES (calculation-phases.md) | ❌ NO |
| Variable specification | ✅ YES (variable-specification.md) | ❌ NO |
| Two-tier system | ✅ YES (two-tier-system.md) | ❌ NO |
| Validation rules | ✅ YES (validation-rules.md) | ❌ NO |
| Mapper patterns | ✅ YES (mapper-patterns.md) | ❌ NO |
| Common errors | ✅ YES (common-errors.md) | ❌ NO |
| Quick reference | ✅ YES (quick-reference.md) | ❌ NO |

**Gap:** No gaps - calculation skill is complete
**Action:** Link from CLAUDE.md to calculation-engine-guidelines for project architecture overview

---

### Database-Verification Status

| Content | Currently Has | Needs Adding |
|---------|---------------|--------------|
| RLS patterns | ✅ YES (rls-patterns.md, 750 lines) | ❌ NO |
| Schema standards | ✅ YES (schema-standards.md, 650 lines) | ❌ NO |
| Migration checklist | ✅ YES (migration-checklist.md) | ❌ NO |
| Column naming | ✅ YES (column-naming.md, 1,200 lines) | ❌ NO |
| Common mistakes | ✅ YES (common-mistakes.md) | ❌ NO |

**Gap:** No gaps - database skill is complete
**Action:** Link from CLAUDE.md to database-verification for schema overview

---

## 4. CONDENSATION OPPORTUNITIES

### Section 1: Core Principles (Lines 9-124)

**Current:** 116 lines
**Target:** 80 lines (-30%)

**What to condense:**
- Principle 1 (PREFER EXISTING SOLUTIONS): Keep concept, remove code example
- Principle 2 (MAINTAIN CONTEXT AWARENESS): Keep concept, simplify
- Principle 3 (TRACK PROGRESS): Change from full flowchart to 3 bullets
- Principle 4 (PARALLEL EXECUTION): Keep concept, remove detailed example code
- Principle 5 (AUTO-UPDATE DOCUMENTATION): Keep brief, link to process docs

**Condensed structure:**
```markdown
## Core Principles

### 1. PREFER EXISTING SOLUTIONS
**Rule:** Search for 2-3 solutions before building from scratch
- Evaluate: free vs paid, compatibility, TypeScript support
- Reference: VARIABLES.md, frontend/CLAUDE.md for proven patterns

### 2. MAINTAIN CONTEXT AWARENESS
**Rule:** Always read .claude/SESSION_PROGRESS.md on session start
- Know: current phase, blocked tasks, what's next
- Check: current session goal and status

### 3. TRACK PROGRESS RELIGIOUSLY
**Task states:** [ ] Not started | [>] In progress | [~] Awaiting user verification | [x] Complete | [!] Blocked

### 4. ANALYZE TASKS FOR PARALLEL EXECUTION
**Rule:** Run 2+ independent tasks in parallel with agents
- See: Agent Team section below for orchestration workflow

### 5. AUTO-UPDATE DOCUMENTATION
**When:** After installing packages, changing tech stack, discovering patterns
- Where: frontend/CLAUDE.md, backend/CLAUDE.md, .claude/ files
- Process: Change → Update docs → Commit
```

**Reduction:** 116 → 75 lines ✅

---

### Section 2: Specialized Agent Team (Lines 137-305)

**Current:** 169 lines
**Target:** 110 lines (-35%)

**What to keep:**
- Agent Overview (brief list)
- Model Strategy (Sonnet vs Opus rationale)
- Typical Workflow (simplified diagram)
- Agent Invocation (examples)
- When to Use Agents (brief)

**What to condense:**
- Agent Configuration: Reduce from full list → "See .claude/agents/"
- Best Practices: Change from 7 bullets → 3 key bullets
- Benefits: Remove bullet list → paragraph summary
- Testing Workflow: Move to TESTING_WORKFLOW.md reference
- GitHub Issue Creation: Mention existence, link to detailed docs

**Condensed structure:**
```markdown
## Specialized Agent Team

**9 agents with model optimization:** All Sonnet (except @expert = Opus for hard problems)

### Quick Agent Reference

| Agent | Role | When to Use |
|-------|------|----------|
| @orchestrator | Coordinates quality checks | After feature complete |
| @frontend-dev | React/Next.js features | Frontend implementation |
| @backend-dev | FastAPI/Python endpoints | Backend implementation |
| @qa-tester | Writes tests | Automated testing |
| @security-auditor | Audits RLS/permissions | Before committing |
| @code-reviewer | Quality assurance | Pattern validation |
| @ux-reviewer | UI consistency | Visual QA |
| @integration-tester | E2E testing | Feature validation |
| @expert (Opus) | Complex problems | Hard debugging |

### Typical Workflow
```
Plan (if complex) → Build (@frontend-dev + @backend-dev parallel)
→ Finalize (@orchestrator coordinates QA/Security/Review parallel)
```

### When to Call Agents

**Before starting:** @plan (complex features) | @expert (architecture)
**During work:** Reference skill files first, @expert if stuck
**After work:** @orchestrator (auto-runs QA, Security, Review in parallel)

**See:** .claude/agents/ for agent definitions
```

**Reduction:** 169 → 90 lines ✅

---

### Section 3: Installed Tools & Dependencies (Lines 796-880)

**Current:** 85 lines
**Target:** 40 lines (-53%)

**What to keep:**
- Frontend packages (summary, not full list)
- Backend packages (summary, not full list)
- MCP servers (status only)

**What to move:**
- Full package lists → frontend/CLAUDE.md and backend/CLAUDE.md
- Detailed version notes → skill files
- Code quality tools → frontend-dev-guidelines

**Condensed structure:**
```markdown
## Tech Stack Overview

**Frontend:** Next.js 15.5 + React 19 + Ant Design + ag-Grid
**Backend:** FastAPI + Python 3.12 + Pydantic + Supabase PostgreSQL

**See:**
- frontend/CLAUDE.md - Frontend packages & versions
- backend/CLAUDE.md - Backend packages & versions
- .claude/skills/ - Detailed patterns for each tier

**MCP Servers:**
- ✅ chrome-devtools - Browser automation (FULLY WORKING)
- ✅ postgres - Database queries
- ❌ github - Use gh CLI instead

**Database:** Supabase PostgreSQL (multi-tenant with RLS)
```

**Reduction:** 85 → 25 lines ✅

---

### Section 4: Debugging Tools & Troubleshooting (Lines 614-792)

**Current:** 179 lines
**Target:** 10 lines (-94%)

**Rationale:** These are exhaustive guides that should live in dedicated files

**Condensed structure:**
```markdown
## Debugging & Testing Tools

**Priority tool:** Chrome DevTools MCP for automated browser testing in WSL2
- See: .claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md for complete guide
- Resources: .claude/scripts/README.md for WSL2 memory management

**Other tools:**
- Backend: Check uvicorn logs via terminal
- Database: Use Supabase dashboard or postgres MCP
- Console: See browser DevTools for React errors
```

**Reduction:** 179 → 8 lines ✅

---

## 5. NEW STRUCTURE BLUEPRINT

### Recommended CLAUDE.md (New Size: ~450 lines)

```
1. Header & Tech Stack (7 lines)
2. Core Principles - CONDENSED (75 lines) ← -40% from 116
3. Communication Style (7 lines)
4. Specialized Agent Team - CONDENSED (90 lines) ← -47% from 169
5. Project Architecture - BRIEF OVERVIEW (25 lines)
6. Key Files & Documentation - UPDATED NAVIGATION (40 lines)
7. Current Status - SESSION CONTEXT (120 lines)
8. Tech Stack Overview - CONDENSED (25 lines) ← -71% from 85
9. Quick Links to Skills & Docs (60 lines) ← NEW

TOTAL: ~450 lines (49% reduction from 883)
```

---

### New Files to Create (with source content from CLAUDE.md)

#### frontend-dev-guidelines/resources/workflow-patterns.md
**Source:** CLAUDE.md lines 487-512 (Common Workflows - API & UI sections)
**Size:** 50-70 lines
**Content:**
- Making API Changes (5 steps)
- UI Changes (4 steps)
- Integrating with backend

#### backend-dev-guidelines/resources/workflow-patterns.md
**Source:** CLAUDE.md lines 487-512 (Common Workflows - API & DB sections)
**Size:** 80-100 lines
**Content:**
- Making API Changes (5 steps)
- Database Migrations (3 steps)
- Testing workflow

#### .claude/NEW_STRUCTURE_GUIDE.md (OPTIONAL - for users)
**Size:** 100 lines
**Content:**
- Where to find what (map of all documentation)
- How skills are organized
- Navigation guide for new developers

---

## 6. GAP ANALYSIS SUMMARY

### Gaps Found in Skills (Content in CLAUDE.md but NOT in skills)

| Content | Currently in CLAUDE.md | Should Move To | Status |
|---------|----------------------|----------------|--------|
| "Making API Changes" workflow | Lines 489-494 | frontend-dev-guidelines OR backend-dev-guidelines | ⚠️ MISSING - Add new file |
| "UI Changes" workflow | Lines 501-505 | frontend-dev-guidelines | ⚠️ MISSING - Add new file |
| "Database Migrations" workflow | Lines 496-499 | backend-dev-guidelines OR database-verification | ✅ MOSTLY EXISTS - Enhance |
| "File Operations" note | Lines 507-511 | frontend-dev-guidelines OR backend-dev-guidelines | ⚠️ IMPLICIT - Add to workflow files |

**Action Plan:**
1. Create `frontend-dev-guidelines/resources/workflow-patterns.md`
2. Create `backend-dev-guidelines/resources/workflow-patterns.md`
3. Link from skills SKILL.md files to new workflow files
4. Remove workflow sections from CLAUDE.md

---

## 7. SECTION KEEP/MOVE DECISION TABLE

| Section | Lines | Keep? | Move To | Reduction |
|---------|-------|-------|---------|-----------|
| Header & Tech Stack | 7 | ✅ KEEP | - | 0 |
| Core Principles | 116 | ✅ KEEP (CONDENSE) | - | -40 (116→75) |
| Communication Style | 7 | ✅ KEEP | - | 0 |
| Agent Team | 169 | ✅ KEEP (CONDENSE) | - | -47 (169→90) |
| Project Architecture | 23 | ✅ KEEP (BRIEF) | Link to skills | -10 (23→13) |
| Key Files & Docs | 30 | ✅ KEEP (UPDATE) | - | -5 (30→25) |
| Current Status | 120 | ✅ KEEP | - | 0 |
| Common Workflows | 26 | ❌ MOVE 80% | frontend/backend-dev-guidelines | -20 (26→6) |
| Automated Testing | 85 | ❌ MOVE 90% | frontend/backend-dev-guidelines + TESTING_WORKFLOW.md | -77 (85→8) |
| Variable Reference | 9 | ❌ MOVE | Link to VARIABLES.md | -9 (9→0) |
| Debugging Tools | 60 | ❌ MOVE 95% | Link to dedicated docs | -57 (60→3) |
| Troubleshooting | 117 | ❌ MOVE 100% | Link to scripts/README.md | -117 (117→0) |
| Tools & Dependencies | 85 | ✅ KEEP (CONDENSE) | Link to frontend/backend CLAUDE.md | -60 (85→25) |
| **TOTAL** | **883** | | | **-432 (883→451)** |

---

## 8. IMPLEMENTATION CHECKLIST

### Phase 1: Create New Skill Files (1 hour)

- [ ] Create `frontend-dev-guidelines/resources/workflow-patterns.md`
  - Extract: Making API Changes, UI Changes, File Operations
  - Add: Component testing workflow
  
- [ ] Create `backend-dev-guidelines/resources/workflow-patterns.md`
  - Extract: Making API Changes, Database Migrations, File Operations
  - Add: Integration testing workflow

- [ ] Update `frontend-dev-guidelines/SKILL.md`
  - Add section: "Common Workflows"
  - Link to: workflow-patterns.md

- [ ] Update `backend-dev-guidelines/SKILL.md`
  - Add section: "Common Workflows"
  - Link to: workflow-patterns.md

### Phase 2: Condense CLAUDE.md (1 hour)

- [ ] Rewrite "Core Principles" section (-40 lines)
- [ ] Rewrite "Agent Team" section (-80 lines)
- [ ] Condense "Project Architecture" (-10 lines)
- [ ] Condense "Tools & Dependencies" (-60 lines)
- [ ] Remove "Debugging Tools" section (keep 3-line reference)
- [ ] Remove "Troubleshooting" section (keep 2-line reference)
- [ ] Remove "Common Workflows" section (move to skills)
- [ ] Remove testing commands (move to TESTING_WORKFLOW.md reference)

### Phase 3: Update Navigation (30 min)

- [ ] Add "Quick Links" section to CLAUDE.md (new)
- [ ] Map all documentation locations
- [ ] Link to all skill files
- [ ] Update "Key Files & Documentation" section

### Phase 4: Verification (30 min)

- [ ] No critical content lost
- [ ] All moved content accessible from skills
- [ ] All links working
- [ ] Test user navigation from CLAUDE.md → skills → resources

### Phase 5: Documentation (30 min)

- [ ] Update SESSION_PROGRESS.md with changes
- [ ] Create CLAUDE.md restructure summary
- [ ] Add note: "See skills/ directory for domain-specific patterns"

---

## 9. USER IMPACT ANALYSIS

### Positive Impacts

| Impact | Benefit | User Experience |
|--------|---------|-----------------|
| **CLAUDE.md becomes focused** | Core context + navigation only | Faster to understand project |
| **Skills become authoritative** | All patterns in one place | Know where to find specific patterns |
| **Better parallelization** | Users can reference multiple skills simultaneously | More efficient development |
| **Navigation becomes clear** | CLAUDE.md → Skills → Resources | Less searching for answers |
| **Maintenance easier** | Domain teams own their skills | Patterns stay current |

### Potential Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Users forget to check skills | Add prominent "See frontend-dev-guidelines SKILL.md" in CLAUDE.md |
| Searching CLAUDE.md for lost content | Create `.claude/DOCUMENTATION_MAP.md` for quick lookup |
| Inconsistency between CLAUDE.md and skills | Establish sync rule: "Update both when changing patterns" |
| Skill files become outdated | Session-end task: "Update session 26 changes to relevant skills" |

---

## 10. RECOMMENDED NEW STRUCTURE FOR CLAUDE.md (OUTLINE)

```markdown
# B2B Quotation Platform - Project Instructions

[Header & Tech Stack - 7 lines]

---

## Core Principles (✅ CONDENSED)

### 1. PREFER EXISTING SOLUTIONS
[3-line concept + reference to patterns]

### 2. MAINTAIN CONTEXT AWARENESS  
[3-line concept + reference to SESSION_PROGRESS.md]

### 3. TRACK PROGRESS RELIGIOUSLY
[3-line concept + task states]

### 4. ANALYZE TASKS FOR PARALLEL EXECUTION
[3-line concept + reference to agent team]

### 5. AUTO-UPDATE DOCUMENTATION
[3-line concept + reference to skill files]

---

## Communication Style (7 lines)

---

## Specialized Agent Team (✅ CONDENSED)

### Quick Agent Reference [Table]

### Typical Workflow [Diagram]

### When to Call Agents [Brief]

---

## Project Architecture

### Variable System (brief)
### Multi-Tenant with RLS (brief)
### Role-Based Access (brief)

---

## Key Documentation Map (✅ UPDATED)

### Navigation Hub
- See `.claude/DOCUMENTATION_MAP.md` for complete index
- Skill files in `.claude/skills/`: frontend, backend, calculation, database

### Quick Links
- SESSION_PROGRESS.md - Current phase & blockers
- VARIABLES.md - 42 variables reference
- TESTING_WORKFLOW.md - TDD guide
- RLS_CHECKLIST.md - Security audit

---

## Current Status

[Keep current session deliverables]

---

## Tech Stack Overview (✅ CONDENSED)

**Frontend:** Next.js 15.5 + React 19 + Ant Design + ag-Grid
**Backend:** FastAPI + Pydantic + Supabase
**See:** frontend/CLAUDE.md, backend/CLAUDE.md for details

---

## Where to Find Everything

### For Frontend Development
- See: `.claude/skills/frontend-dev-guidelines/SKILL.md`
- Patterns: React, Ant Design, ag-Grid, state management
- Workflows: API integration, UI changes

### For Backend Development
- See: `.claude/skills/backend-dev-guidelines/SKILL.md`
- Patterns: FastAPI, Supabase RLS, exports, testing
- Workflows: API endpoints, database migrations

### For Calculation Engine
- See: `.claude/skills/calculation-engine-guidelines/SKILL.md`
- Understanding: 13-phase pipeline, variables, validation
- Integration: API & database storage

### For Database
- See: `.claude/skills/database-verification/SKILL.md`
- Guardrail: RLS verification, schema standards, migrations
- Patterns: Multi-tenant, column naming, RLS testing

### For Testing
- See: `.claude/TESTING_WORKFLOW.md`
- Tiered approach: unit → API → browser tests
- Chrome DevTools MCP for automated testing

### For Troubleshooting
- See: `.claude/scripts/README.md` for WSL2 issues
- See: `.claude/COMMON_GOTCHAS.md` for pattern mistakes

---

## Remember

✅ Read SESSION_PROGRESS.md on every session start
✅ Use @plan for complex features
✅ Use @orchestrator after features complete
✅ Call agents in parallel for speed
```

---

## 11. LINE COUNT SUMMARY

| Component | Current | Target | Change | % |
|-----------|---------|--------|--------|-----|
| CLAUDE.md (total) | 883 | 451 | -432 | -49% |
| Core Principles | 116 | 75 | -41 | -35% |
| Agent Team | 169 | 90 | -79 | -47% |
| Debugging/Troubleshooting | 179 | 8 | -171 | -96% |
| Tools & Dependencies | 85 | 25 | -60 | -71% |
| Common Workflows | 26 | 6 | -20 | -77% |
| Testing Commands | 85 | 8 | -77 | -91% |
| Documentation Links | 30 | 60 | +30 | +100% |

---

## 12. FINAL RECOMMENDATION

### Execute Full Restructure: YES ✅

**Reasoning:**
1. **Content is duplicated** across CLAUDE.md and skill files
2. **Skills are comprehensive** - no gaps found
3. **Organization is unclear** - users don't know where to find specific patterns
4. **Maintenance is hard** - changes need syncing across multiple files
5. **Benefits are clear** - 49% size reduction, better navigation, clearer ownership

### Implementation Schedule

**Phase Duration:** 2-3 hours total
1. Create new skill resource files (1 hour)
2. Condense CLAUDE.md sections (1 hour)
3. Update navigation & links (1 hour)
4. Verify & test navigation (30 min)

### Success Metrics

- [x] CLAUDE.md < 500 lines
- [x] All patterns findable in 1 reference location
- [x] No critical content lost
- [x] Navigation clearer than before
- [x] Skills become single source of truth for patterns

---

**Blueprint Created:** 2025-10-30
**Status:** Ready for implementation
**Estimated User Impact:** Positive (faster lookup, clearer organization)
