# B2B Quotation Platform - Project Instructions

Russian B2B quotation platform for cross-border trade (import/export).

**Tech Stack:** Next.js 15.5 + React 19 + Ant Design + ag-Grid | FastAPI + Supabase PostgreSQL

---

## Core Principles

### 1. PREFER EXISTING SOLUTIONS

**Rule:** Always search for 2-3 existing libraries before building custom code.

When user requests a feature:
1. Search for existing solutions (npm/pip packages)
2. Evaluate: free vs paid, compatibility, TypeScript support
3. Present options with pros/cons + recommendation
4. Only build from scratch if no suitable solution exists

**Example:** ag-Grid for Excel-like tables instead of custom implementation.

### 2. MAINTAIN CONTEXT AWARENESS

**Rule:** Always read `.claude/SESSION_PROGRESS.md` on session start.

- Know: current phase, blocked tasks, what's next
- Check: current session goal and status
- Continue from where we left off

**User's main complaint:** "You should be in context of what's going on, where we are, and what are next steps"

### 3. TRACK PROGRESS RELIGIOUSLY

**After completing work (30+ min):**
1. Update `.claude/SESSION_PROGRESS.md`
2. Mark task as `[~]` awaiting user verification
3. Only mark `[x]` complete after user confirms
4. Note blockers as `[!]` with details

**Task states:** `[ ]` Not started | `[>]` In progress | `[~]` Awaiting verification | `[x]` Complete | `[!]` Blocked

### 4. ANALYZE TASKS FOR PARALLEL EXECUTION

**Rule:** If 2+ tasks are independent, ALWAYS run them in parallel.

- Identify independent tasks (no dependencies)
- Group by agent type (frontend, backend, testing, documentation)
- Use Task tool with multiple agents in SINGLE message
- **Benefits:** 3x faster completion, better resource utilization

**When NOT to parallelize:** Tasks have dependencies, modify same file, require sequential verification

### 5. AUTO-UPDATE DOCUMENTATION

**Update immediately when:**
- Installing new packages (npm/pip)
- Adding MCP servers
- Changing tech stack versions
- Discovering new patterns or gotchas
- Changing project structure

**Process:** Install package → Update CLAUDE.md immediately → Inform user

**Pre-autocompact (at 85% tokens):** Sync all docs, update SESSION_PROGRESS.md, prepare summary

---

## Communication Style

- User is novice coder - explain technical concepts simply
- Not too verbose, but ensure understanding
- No emojis unless requested
- Focus on facts over validation
- Disagree when necessary for correctness

---

## Skills System

**Location:** `.claude/skills/` directory

**How skills work:**
- Each skill is a domain-specific knowledge base
- Loaded by agents when working in that domain
- Single source of truth for patterns and workflows
- Reduces main CLAUDE.md size (focus on core context)

**Available Skills:**

1. **frontend-dev-guidelines** - Next.js, React, Ant Design, ag-Grid patterns
   - Component patterns, form validation, state management
   - API integration, UI workflows
   - See: `.claude/skills/frontend-dev-guidelines/SKILL.md`

2. **backend-dev-guidelines** - FastAPI, Supabase, Python patterns
   - API endpoints, RLS security, exports, testing
   - Database migrations, error handling
   - See: `.claude/skills/backend-dev-guidelines/SKILL.md`

3. **calculation-engine-guidelines** - 13-phase calculation pipeline
   - 42 variables, two-tier system, validation rules
   - Mapper patterns, common errors
   - See: `.claude/skills/calculation-engine-guidelines/SKILL.md`

4. **database-verification** - Schema standards and RLS guardrails
   - Multi-tenant patterns, column naming, migration checklist
   - RLS testing, common mistakes
   - See: `.claude/skills/database-verification/SKILL.md`

**When to reference skills:**
- Frontend work → Load frontend-dev-guidelines
- Backend work → Load backend-dev-guidelines
- Calculation changes → Load calculation-engine-guidelines
- Database changes → Load database-verification (guardrail)

---

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

**Plus Built-in:**
- @Explore (Haiku) - Fast codebase exploration
- @Plan (Sonnet) - Feature planning

### Typical Workflow

```
1. PLANNING (if complex)
   User: "Add feature X"
   @plan → Creates implementation roadmap

2. BUILDING
   @frontend-dev → Implements UI
   @backend-dev → Implements API
   (Run in parallel)

3. FINALIZATION
   User: "@orchestrator"
   Orchestrator automatically:
   ├─ @qa-tester (writes tests)
   ├─ @security-auditor (checks RLS)  } Parallel
   └─ @code-reviewer (checks patterns)
   → Auto-fixes minor issues
   → Reports critical issues
   → Creates GitHub issues (critical only)
   → Updates docs
   → Commits & pushes
```

### When to Use Agents

**Before starting:** @plan (complex features) | @expert (architecture decisions)
**During work:** Reference skills first, @expert if stuck
**After work:** @orchestrator (auto-runs QA, Security, Review in parallel)

**Configuration:** `.claude/agents/*.md` (9 custom agent files)

### Orchestrator Autonomous Invocation (Phase 5)

**@orchestrator can now auto-detect feature completion:**

**Triggers:**
- 200+ lines changed
- 5+ files modified
- Keywords: "done with feature", "ready for review", "feature complete"

**What happens:**
1. Orchestrator analyzes changes (files, lines, areas)
2. Asks: "Run quality checks now? (QA/Security/Review in parallel - ~5 min)"
3. User confirms "yes" or "no"
4. If yes: Runs full workflow automatically

**Configuration:** `.claude/orchestrator-config.json`
- Enable/disable autonomous invocation
- Adjust detection thresholds
- Configure auto-fix behavior
- Set GitHub issue creation preferences

**Manual mode:** Call `@orchestrator` explicitly to skip detection and run immediately

### GitHub Issue Creation

Agents auto-create GitHub Issues for:
- Security vulnerabilities (RLS bypass, SQL injection, auth bypass)
- Data integrity risks (missing validation, incorrect calculations)
- Breaking changes without migration
- Failed tests that can't be auto-fixed

**Labels:** `security`, `critical`, `agent-found`
**Minor issues (formatting, comments, style) are reported locally only.**

---

## Project Architecture

### Two-Tier Variable System
- **Quote-level defaults:** Apply to all products
- **Product-level overrides:** Can override defaults per product
- **Color coding:** Gray (default), Blue (user override), Red (admin override)

**See:** `.claude/skills/calculation-engine-guidelines/` for detailed specs

### Admin vs User Variables
- **Admin-only (3):** rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
  - Stored in `calculation_settings` table, apply organization-wide
- **User-editable (39):** All other variables
  - Can be quote-level or product-level

**See:** `.claude/VARIABLES.md` for complete 42-variable reference

### Multi-Tenant with RLS
- Organization-based data isolation
- Row-Level Security on all tables
- JWT claims passed to PostgreSQL for RLS context

**See:** `.claude/skills/database-verification/` for RLS patterns

### Role-Based Access
- Roles: member, manager, admin, owner
- Backend validates via `check_admin_permissions()`
- Frontend hides based on role (still validate in backend)

---

## Key Documentation Map

### Core Navigation Hub
- **`.claude/SESSION_PROGRESS.md`** ⭐ - Current progress, what's next, blockers
- **`.claude/VARIABLES.md`** - All 42 variables classified and documented
- **`.claude/TESTING_WORKFLOW.md`** - Automated testing workflow and TDD guide
- **`.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`** ⭐ - Browser automation guide
- **`.claude/scripts/README.md`** - Shell scripts for testing and monitoring

### Implementation Plans
- **`.claude/archive/PLAN_CALCULATION_ENGINE_CONNECTION.md`** ⭐ - Calculation engine integration (Session 15)
- `.claude/archive/IMPLEMENTATION_PLAN_AG_GRID.md` - ag-Grid restructure (Sessions 8-14 COMPLETE)
- `.claude/reference/calculation_engine_summary.md` - 13-phase calculation pipeline

### Quick Wins Documentation
- **`.claude/COMMON_GOTCHAS.md`** ⭐ - 18 bug patterns from 41 tracked bugs
- `.claude/CALCULATION_PATTERNS.md` - 42 variables validation rules
- `.claude/RLS_CHECKLIST.md` - Multi-tenant security checklist

### Domain-Specific Patterns (Skills)
- `.claude/skills/frontend-dev-guidelines/` - Frontend patterns
- `.claude/skills/backend-dev-guidelines/` - Backend patterns
- `.claude/skills/calculation-engine-guidelines/` - Calculation patterns
- `.claude/skills/database-verification/` - Database guardrails

---

## Current Status (Session 26 - PRE-DEPLOYMENT INFRASTRUCTURE ⚙️)

**CI/CD Status:** ⚠️ **Waiting for GitHub Secrets** (Backend tests failing)
- ❌ Backend Tests (need GitHub secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL)
- ✅ Frontend Lint & Type Check (0 errors, 108 warnings)
- ✅ Frontend Build
- ✅ TypeScript (0 errors)
- ✅ **Tests pass locally:** 75/84 passing (9 pre-existing failures)

**Deployment Readiness:** 65/100 ⚠️ (testing revealed integration gaps)
- Infrastructure: 85/100 ✅ (well-designed, high quality)
- Integration: 45/100 ⚠️ (features built but not connected)
- **Critical Blockers:** 5 (activity logging, feedback migration, exchange rates, concurrency, rate limiting)
- See `.claude/archive/TECHNICAL_DEBT_SUPERSEDED_2025-10-29.md` for archived details

**Session 26 Deliverables (2025-10-26) - PRE-DEPLOYMENT INFRASTRUCTURE:**

**Wave 1: Backend Systems (3-4 hours)**
- ✅ User Profile System - Manager info for exports (`GET/PUT /api/users/profile`)
- ✅ Exchange Rate Service - CBR API integration with daily cron job
- ✅ Activity Log System - Async batching, 12 integration points

**Wave 2: Frontend UI (2-3 hours)**
- ✅ User Profile Page - Manager info editor
- ✅ Exchange Rate UI - Auto-load + manual refresh in quote create
- ✅ Feedback System - Floating button + admin dashboard

**Wave 3: Activity Log + Dashboard (3-4 hours)**
- ✅ Activity Log Viewer - Filters, pagination, CSV export
- ✅ Dashboard - Stats cards, revenue trends, recent quotes

**Wave 4: Performance Audit (3-4 hours)**
- ✅ Backend Audit - 8 issues fixed (infinite loops, cache limits, indexes, rate limiting)
- ✅ Frontend Audit - Bundle size analysis, optimization recommendations
- ✅ Performance Improvements - Dashboard 83% faster, Activity logs 87% faster

**Wave 5: Comprehensive Testing (4-5 hours)**
- ✅ Feature Testing - 26 scenarios analyzed, 77% infrastructure ready
- ✅ Load Testing - Identified concurrency bottleneck (66x slowdown)
- ✅ Critical issues documented in TECHNICAL_DEBT.md

**New Features:**
- User profiles with manager info for exports
- Exchange rate auto-loading from CBR API (daily cron)
- Activity log system (audit trail for compliance)
- Feedback system (in-app bug reporting)
- Dashboard (business intelligence)
- Performance optimizations (indexes, rate limiting, timeouts, caching)

**Files:** ~5,500 lines (backend + frontend + tests + docs)
**Time:** ~16 hours (parallel agent execution, 35-40% faster than sequential)

**See `.claude/SESSION_PROGRESS.md` Session 26 for full details**

---

**Session 15 Deliverables (2025-10-21) - CALCULATION ENGINE INTEGRATED:**

**Planning Phase (~2.5 hours):**
- ✅ PLAN_CALCULATION_ENGINE_CONNECTION.md (500+ lines) - Complete implementation roadmap
- ✅ TESTING_WORKFLOW.md (150+ lines) - Automated testing guide with TDD workflow
- ✅ Key architectural decisions documented

**Implementation Phase (~2.5 hours):**
- ✅ **Backend Code** (~300 lines new code in routes/quotes_calc.py):
  - map_variables_to_calculation_input() - Maps 42 variables to 7 nested Pydantic models
  - fetch_admin_settings() - Fetches admin-only variables
  - validate_calculation_input() - Validates 10 required fields + business rules
- ✅ **Automated Tests** (23/23 passing ✅):
  - test_quotes_calc_mapper.py (13 tests) - Variable mapper with two-tier logic
  - test_quotes_calc_validation.py (10 tests) - Required fields + business rules
- ✅ **Git commits:** b512346, 117c831, 54b6621 - All pushed to main

**Sessions 8-14 Deliverables:**
- ✅ Quote creation page UI complete with ag-Grid
- ✅ 4-card compact layout with role-based grouping
- ✅ Template system with save/update functionality
- ✅ All manual testing passed and bugs fixed

**Known Technical Debt:**
- ✅ **Quote creation NOW CONNECTED to calculation engine** (Session 15 - COMPLETE!)
- Quote-related pages have temporary stubs (NOW UNBLOCKED - can build list/detail/approval pages)
- ⚠️ **CI tests failing** - need GitHub secrets
- GitHub MCP not functional (using direct API calls via curl as workaround)
- TypeScript strict unused checks temporarily disabled

**Development Environment:**
- **Use WSL2 for everything** - Frontend + Backend both run in WSL2
- ⚠️ **Do NOT migrate to native Windows** - Multiple issues with native modules
- All dependencies work correctly in WSL2

**Servers Running:**
- Frontend: `npm run dev` on :3000 (or :3001 if 3000 in use)
- Backend: `uvicorn main:app --reload` on :8000

**Test User Credentials:**
- Email: `andrey@masterbearingsales.ru`
- Password: `password`
- Organization: МАСТЕР БЭРИНГ ООО (Master Bearing LLC)

---

## Tech Stack Overview

**Frontend:** Next.js 15.5 + React 19 + Ant Design + ag-Grid
**Backend:** FastAPI + Python 3.12 + Pydantic + Supabase PostgreSQL

**See:**
- `frontend/CLAUDE.md` - Frontend packages & versions
- `backend/CLAUDE.md` - Backend packages & versions
- `.claude/skills/` - Detailed patterns for each tier

**MCP Servers:**
- ✅ **chrome-devtools** - Browser automation (FULLY WORKING with WSLg)
- ✅ **postgres** - Database queries and schema inspection
- ❌ **github** - Not functional (use curl with GitHub API)
  - Token: `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`
  - Example: `curl -H "Authorization: token TOKEN" https://api.github.com/repos/AgasiArgent/kvota`
- ⚠️ **puppeteer** - NOT RECOMMENDED (Chrome DevTools MCP is better)

**Configuration:** `.mcp.json` (server definitions) + `.claude/settings.json` (enable servers + permissions)

**Database:** Supabase PostgreSQL (multi-tenant with RLS)
- Connection: Direct via DATABASE_URL + REST API via Supabase client
- Migrations: Tracked in `backend/migrations/MIGRATIONS.md`

---

## Where to Find Everything

### For Frontend Development
**See:** `.claude/skills/frontend-dev-guidelines/SKILL.md`
- **Patterns:** React, Ant Design, ag-Grid, state management
- **Workflows:** API integration, UI changes
- **Resources:** 5 resource files (3,632 lines)

### For Backend Development
**See:** `.claude/skills/backend-dev-guidelines/SKILL.md`
- **Patterns:** FastAPI, Supabase RLS, exports, testing
- **Workflows:** API endpoints, database migrations
- **Resources:** 6 resource files (3,200+ lines)

### For Calculation Engine
**See:** `.claude/skills/calculation-engine-guidelines/SKILL.md`
- **Understanding:** 13-phase pipeline, 42 variables, validation
- **Integration:** API & database storage
- **Resources:** 7 resource files (1,500+ lines)

### For Database
**See:** `.claude/skills/database-verification/SKILL.md`
- **Guardrail:** RLS verification, schema standards, migrations
- **Patterns:** Multi-tenant, column naming, RLS testing
- **Resources:** 4 resource files (2,000+ lines)

### For Testing & Debugging
**Testing:**
- **Automated:** `.claude/TESTING_WORKFLOW.md` (TDD guide, tiered testing)
- **Browser automation:** `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md` ⭐ **PRIORITY TOOL**
- **Manual scenarios:** `.claude/MANUAL_TESTING_GUIDE.md`

**Debugging:**
- **Chrome DevTools MCP:** Browser automation with accessibility tree snapshots
- **Backend logs:** Check uvicorn output via terminal
- **Database:** Supabase dashboard or postgres MCP
- **Console:** Browser DevTools for React errors

**Troubleshooting:**
- **WSL2 issues:** `.claude/scripts/README.md` (memory management, recovery)
- **Bug patterns:** `.claude/COMMON_GOTCHAS.md` (18 patterns from 41 bugs)

### Quick Commands

**Backend Tests:**
```bash
cd backend
pytest -v  # Run all tests
pytest --cov=. --cov-report=term-missing  # With coverage
pytest tests/test_file.py::test_function -v  # Specific test
```

**Frontend Tests:**
```bash
cd frontend
npm test  # Run all tests
npm test -- --coverage  # With coverage
npm test -- --watch  # Watch mode
```

**Before Pushing:**
```bash
cd backend && pytest  # Ensure backend tests pass
cd frontend && npm test  # Ensure frontend tests pass
cd frontend && npm run lint && npm run type-check && npm run build  # CI checks
```

**Chrome DevTools MCP (Resource-Optimized):**
```bash
# Use tiered testing script (prevents WSL2 freezing)
./.claude/scripts/testing/launch-chrome-testing.sh headless

# Monitor resources
./.claude/scripts/monitoring/monitor-wsl-resources.sh

# Kill Chrome when done
./.claude/scripts/testing/launch-chrome-testing.sh kill
```

**Tiered Testing (Fastest to Slowest):**
1. Backend Unit Tests (100 MB, 5s) - `cd backend && pytest -v`
2. Backend API Tests (200 MB, 30s) - `./.claude/scripts/testing/test-backend-only.sh`
3. Headless Browser (500 MB, 60s) - `./.claude/scripts/testing/launch-chrome-testing.sh headless`
4. Full Browser (1.2 GB, 120s) - `./.claude/scripts/testing/launch-chrome-testing.sh full` (only when needed!)

**🎯 Golden Rule:** Always start with the fastest tier that covers what you need

---

## Remember

✅ **Read SESSION_PROGRESS.md on every session start** - Know where we are and what's next
✅ **Use @plan for complex features** - Get roadmap before building
✅ **Use @orchestrator after features complete** - Auto-runs QA, Security, Review in parallel
✅ **Reference skills for domain patterns** - Single source of truth
✅ **Call agents in parallel for speed** - 3x faster than sequential
✅ **Update docs immediately** - Install package → Update CLAUDE.md → Inform user
✅ **Always put actual timestamp** when creating/editing documents - Easy to understand history

---

**Last Updated:** 2025-10-30 (Session 26, Phase 3 - CLAUDE.md Restructure)
