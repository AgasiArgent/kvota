# B2B Quotation Platform - Project Instructions

**Last Updated:** 2025-10-28 (Session 33 - CLAUDE.md optimization)

Russian B2B quotation platform for cross-border trade (import/export).

**Tech Stack:** Next.js 15.5 + React 19 + Ant Design + ag-Grid | FastAPI + Supabase PostgreSQL

---

## Core Principles

### 1. PREFER EXISTING SOLUTIONS

**ALWAYS search for existing libraries/tools before building custom code.**

When user requests a feature:
1. Search for 2-3 existing solutions (npm/pip packages)
2. Evaluate: free vs paid, compatibility, TypeScript support
3. Present options with pros/cons + recommendation
4. Only build from scratch if no suitable solution exists

### 2. MAINTAIN CONTEXT AWARENESS

**CRITICAL:** Always know where we are and what's next.

**On session start, ALWAYS:**
1. Read `.claude/SESSION_PROGRESS.md` - What's done, what's awaiting verification, what's next
2. Check current session goal and phase
3. Identify any blocked tasks
4. Continue from where we left off

### 3. TRACK PROGRESS RELIGIOUSLY

After completing significant work (30+ min):
1. Update `.claude/SESSION_PROGRESS.md`
2. Mark task as `[~]` awaiting user verification (NEVER mark `[x]` until user confirms!)
3. Note blockers as `[!]` with details

**Task states:** `[ ]` Not started, `[>]` In progress, `[~]` Awaiting verification, `[x]` Verified, `[!]` Blocked

### 4. ANALYZE TASKS FOR PARALLEL EXECUTION

**CRITICAL:** Before starting work, analyze which tasks can run in parallel using specialized agents.

**Rule:** If 2+ tasks are independent (no dependencies, different files), ALWAYS run them in parallel using a single message with multiple Task tool calls.

**Benefits:** 3x faster completion, better resource utilization

**When NOT to parallelize:**
- Tasks have dependencies (output of Task A needed for Task B)
- Tasks modify the same file (merge conflicts)
- Tasks require sequential verification

### 5. AUTO-UPDATE DOCUMENTATION

**Keep documentation synchronized with codebase changes.**

**Update immediately when:**
- Installing new packages (npm/pip)
- Adding MCP servers
- Changing tech stack versions
- Discovering new patterns or gotchas
- Changing project structure

**Process:** Install package → Update docs immediately → Inform user → At 85% tokens, sync all docs

---

## Communication Style

- User is novice coder - explain technical concepts simply
- Not too verbose, but ensure understanding
- No emojis unless requested
- Focus on facts over validation
- Disagree when necessary for correctness

---

## Git Worktree Workflow

**For detailed commands, see `.claude/GIT_WORKTREE_QUICK_REFERENCE.md`**
**For workflows, see `.claude/WORKFLOWS.md`**

### Concept

Git worktrees allow multiple working directories from the same repository, each checked out to different branches. This enables running multiple versions of the app simultaneously without switching branches or stashing changes.

**Three-Worktree Structure:**
- **Main:** `/home/novi/quotation-app` (main branch) → :3000/:8000 (users test here - stable)
- **Dev:** `/home/novi/quotation-app-dev` (dev branch) → :3001/:8001 (active work - 90% of development)
- **Hotfix:** Created as needed from main → fix bug → merge to both → delete

### Key Rules

1. **Work in dev worktree 90% of the time** - Never code directly in main (only merges)
2. **Main receives changes via merges only** - Keeps main stable for user testing
3. **Hotfixes:** Create worktree from main → fix → merge to both main + dev → delete worktree
4. **@orchestrator agent is worktree-aware** - Detects location, commits to appropriate branch

---

## Specialized Agent Team

**9 specialized agents + 2 built-in for parallel execution with model optimization (Sonnet for quality + Opus for complex problems).**

**See `.claude/agents/*.md` for agent prompts.**

### Agent Tiers

**Tier 1: Orchestration**
- **@orchestrator** (Sonnet) - Coordinates all agents, updates docs, manages git workflow

**Tier 2: Builders**
- **@frontend-dev** (Sonnet) - Next.js/React features
- **@backend-dev** (Sonnet) - FastAPI endpoints

**Tier 3: Quality Assurance**
- **@qa-tester** (Sonnet) - Automated tests with edge case reasoning
- **@security-auditor** (Sonnet) - RLS policies, permissions, SQL injection
- **@code-reviewer** (Sonnet) - Patterns, quality, performance

**Tier 4: User Experience**
- **@ux-reviewer** (Sonnet) - UI consistency, accessibility, responsive design
- **@integration-tester** (Sonnet) - E2E testing with Chrome DevTools MCP

**Tier 5: Expert Problem Solving**
- **@expert** (Opus) - 10x+ bottlenecks, architecture decisions, complex bugs, race conditions

**Built-in:**
- **@Explore** (Haiku) - Fast codebase exploration
- **@Plan** (Sonnet) - Planning and task breakdown

### Typical Workflow

**Feature Development:**
1. **Planning** (if complex): `@plan` → Creates roadmap
2. **Building**: `@frontend-dev` + `@backend-dev` → Implement feature
3. **Finalization**: `@orchestrator` → Automatically runs @qa-tester, @security-auditor, @code-reviewer in parallel → Auto-fixes minor issues → Reports critical issues → Updates docs → Commits & pushes

### When to Use

- **@orchestrator:** After completing features (ensures quality, tests, docs)
- **@plan:** Complex features needing roadmap before building
- **@expert:** Hard problems (don't waste time struggling, get Opus-level analysis)
- **@integration-tester:** E2E testing with Chrome DevTools before asking user to manually test

### GitHub Issue Creation

Agents auto-create Issues for critical findings: Security vulnerabilities, data integrity risks, breaking changes, failed tests. Minor issues (formatting, style) reported locally only.

### Testing Philosophy

**Before asking user to test UI:** Run unit tests → integration tests → check console → verify happy path → fix bugs → THEN ask user to test edge cases. Catches 80% of bugs automatically; user tests the tricky 20% that matters.

---

## Project Architecture

### Two-Tier Variable System
- **Quote-level defaults:** Apply to all products
- **Product-level overrides:** Can override defaults per product
- **Color coding:** Gray (default), Blue (user override), Red (admin override)

### Admin vs User Variables
- **Admin-only (3):** rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
  - Stored in `calculation_settings` table, apply organization-wide
- **User-editable (39):** All other variables
  - Can be quote-level or product-level

### Role-Based Access
- Roles: member, manager, admin, owner
- Backend validates via `check_admin_permissions()`
- Frontend hides based on role (still validate in backend)

### Multi-Tenant with RLS
- Organization-based data isolation
- Row-Level Security on all tables
- JWT claims passed to PostgreSQL for RLS context

---

## Key Files & Documentation

### Core Documentation
- **`.claude/SESSION_PROGRESS.md`** ⭐ - Current progress, what's next, blockers
- **`.claude/VARIABLES.md`** - All 42 variables classified and documented
- **`frontend/CLAUDE.md`** - Frontend patterns and conventions
- **`backend/CLAUDE.md`** - Backend patterns and conventions

### Implementation Plans
- **`.claude/PLAN_CALCULATION_ENGINE_CONNECTION.md`** ⭐ - Quote creation to calculation engine integration (Session 15)
- `.claude/IMPLEMENTATION_PLAN_AG_GRID.md` - ag-Grid restructure plan (Sessions 8-14 COMPLETE)
- `.claude/calculation_engine_summary.md` - Calculation engine (13 phases)

### Testing Documentation
- **`.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`** ⭐ **PRIORITY TOOL** - Complete guide for Chrome DevTools MCP testing
- `.claude/TESTING_WORKFLOW.md` - Automated testing workflow and TDD guide
- `.claude/MANUAL_TESTING_GUIDE.md` - Manual + automated testing scenarios for quote creation

### Key Source Files
- `frontend/src/app/quotes/create/page.tsx` - Quote creation (RESTRUCTURING)
- `frontend/src/app/settings/calculation/page.tsx` - Admin settings
- `backend/routes/quotes_calc.py` - Calculation engine
- `backend/routes/calculation_settings.py` - Admin settings API
- `backend/auth.py` - Authentication system

---

## Current Status & Progress

**For current progress, blockers, and recent session deliverables, see `.claude/SESSION_PROGRESS.md`**

**Quick Status:**
- CI/CD: ⚠️ Waiting for GitHub Secrets (tests pass locally: 75/84)
- Deployment Readiness: 65/100 (see TECHNICAL_DEBT.md for blockers)
- Development Environment: WSL2 (do NOT migrate to Windows native)
- Test User: `andrey@masterbearingsales.ru` / `password`
- Servers: Main (:3000/:8000), Dev (:3001/:8001)

---

## Common Workflows

### Making API Changes
1. Update backend route in `backend/routes/*.py`
2. Update Pydantic models if needed
3. Update frontend service in `frontend/src/lib/api/*-service.ts`
4. Update TypeScript interfaces
5. Test with real API call

### Database Migrations
1. Create migration in `backend/migrations/*.sql`
2. Update table definitions and RLS policies
3. Test via Supabase dashboard

### UI Changes
1. Read current component first
2. Use Ant Design for forms/layout, ag-Grid for data tables
3. Match existing styling patterns
4. Ensure responsive design

### File Operations
- **ALWAYS use Read tool** for reading files (not `cat`)
- **ALWAYS use Edit tool** for editing files (not `sed`/`awk`)
- **ALWAYS use Write tool** for new files (not `echo >`)
- **Reserve Bash** for actual terminal commands (git, npm, python)

---

## Testing

**See `.claude/TESTING_WORKFLOW.md` for comprehensive guide and TDD workflow.**

**Quick Commands:**
```bash
# Backend tests
cd backend && pytest -v
pytest --cov=. --cov-report=term-missing  # With coverage

# Frontend tests
cd frontend && npm test
npm test -- --coverage  # With coverage

# Pre-push checks
cd frontend && npm run lint && npm run type-check && npm run build
```

**Coverage Goals:** Backend 80%+, Frontend 60%+

**TDD Workflow:** Write test (RED) → Implement feature (GREEN) → Refactor → Check coverage

---

## Variable Quick Reference

**Total:** 42 variables
- Product-only: 5 (sku, brand, base_price_VAT, quantity, weight_in_kg)
- Quote-only: 19
- Both levels: 15 (can be default or override)
- Admin-only: 3 (rate_forex_risk, rate_fin_comm, rate_loan_interest_daily)

**See `.claude/VARIABLES.md` for complete details.**

---

## Debugging & Testing Tools

### Chrome DevTools MCP ✅ PRIORITY TOOL

**The PRIMARY tool for automated browser testing in WSL2.**

- **Status:** ✅ Fully working with WSLg (Windows 11 X server)
- **Documentation:** `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`
- **Quick Start:**
  ```bash
  ./.claude/launch-chrome-testing.sh headless  # 60% less memory
  ./.claude/launch-chrome-testing.sh full      # Full browser
  ./.claude/launch-chrome-testing.sh kill      # Stop Chrome
  ```

- **🎯 Golden Rule:** Use tiered testing (fastest to slowest)
  1. Backend unit tests (5s) → 2. Backend API tests (30s) → 3. Headless browser (60s) → 4. Full browser (120s)

- **⚠️ Resource Management:**
  - WSL2 can freeze if Chrome uses >85% memory
  - Use `./.claude/monitor-wsl-resources.sh` to monitor
  - See `.claude/TIERED_TESTING_GUIDE.md` for preventing freezes

### Other Tools

- **Backend Logs:** uvicorn output (via BashOutput tool)
- **Database:** Direct SQL (Supabase dashboard or Postgres MCP)
- **Browser Console:** `frontend/.claude-read-console.js` (read-only monitoring)

---

## Quick Start

**For detailed setup and daily routine, see `.claude/QUICK_START.md`**

**Daily Development:**
```bash
# Start dev worktree servers
cd /home/novi/quotation-app-dev
./start-dev.sh both  # Frontend :3001, Backend :8001

# Test user credentials
Email: andrey@masterbearingsales.ru
Password: password
```

---

## Important Gotchas

### WSL2 Environment
- ✅ **Use WSL2 for everything** - Frontend + Backend both in WSL2
- ❌ **Do NOT migrate to Windows native** - Native modules fail (lightningcss, weasyprint)
- ⚠️ **Memory limits** - Chrome can freeze WSL2 at 85%+ memory (see TROUBLESHOOTING.md)

### Git Worktrees
- Work in dev worktree 90% of the time
- Never code directly in main (only merges)
- Use @orchestrator for worktree-aware commits

### CI/CD
- ⚠️ **GitHub Actions needs secrets** - Tests fail without Supabase credentials
- ✅ **Tests pass locally** - 75/84 passing
- Add secrets at: https://github.com/AgasiArgent/kvota/settings/secrets/actions

### Chrome DevTools MCP
- ✅ **PRIORITY TOOL** for automated testing
- ⚠️ **Use tiered testing** - Start with backend tests, browser only when needed
- See `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`

---

## Documentation Map

### Read First (Every Session)
- **`.claude/SESSION_PROGRESS.md`** ⭐ - Current progress, blockers, next steps
- **`CLAUDE.md`** - This file (core principles and navigation)

### Workflows & Guides
- **`.claude/QUICK_START.md`** - Daily routine, essential commands
- **`.claude/WORKFLOWS.md`** - Git worktree, API changes, migrations
- **`.claude/GIT_WORKTREE_QUICK_REFERENCE.md`** - Git commands
- **`.claude/TESTING_WORKFLOW.md`** - TDD workflow, coverage goals

### Testing
- **`.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`** ⭐ - Browser testing guide
- **`.claude/TIERED_TESTING_GUIDE.md`** - Prevent WSL2 freezing
- **`.claude/MANUAL_TESTING_GUIDE.md`** - Manual test scenarios

### Reference
- **`.claude/DEPENDENCIES.md`** - All installed tools & versions
- **`.claude/TROUBLESHOOTING.md`** - Common issues & solutions
- **`.claude/VARIABLES.md`** - 42 calculation variables
- **`.claude/TECHNICAL_DEBT.md`** - Known issues & blockers

### Architecture
- **`frontend/CLAUDE.md`** - Frontend patterns and conventions
- **`backend/CLAUDE.md`** - Backend patterns and conventions
- **`.claude/PLAN_CALCULATION_ENGINE_CONNECTION.md`** - Calculation engine integration

---

**Remember:** Read SESSION_PROGRESS.md on every session start to maintain context!