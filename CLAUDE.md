# B2B Quotation Platform - Project Instructions

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

**Example:** ag-Grid for Excel-like tables instead of custom implementation.

### 2. MAINTAIN CONTEXT AWARENESS

**CRITICAL:** Always know where we are and what's next.

**On session start, ALWAYS:**
1. Read `.claude/SESSION_PROGRESS.md` - What's done, what's awaiting verification, what's next
2. Check current session goal and phase
3. Identify any blocked tasks
4. Continue from where we left off

**User's main complaint:** "You should be in context of what's going on, where we are, and what are next steps"

### 3. TRACK PROGRESS RELIGIOUSLY

After completing significant work (30+ min):
1. Update `.claude/SESSION_PROGRESS.md`
2. Mark task as `[~]` awaiting user verification
3. Only mark `[x]` complete after user confirms it works
4. Note blockers as `[!]` with details

**Task states:**
- `[ ]` Not started
- `[>]` In progress
- `[~]` Awaiting user verification (NEVER skip this!)
- `[x]` Completed and verified by user
- `[!]` Blocked/has issues

### 4. AUTO-UPDATE DOCUMENTATION

**Keep CLAUDE.md files synchronized with codebase changes.**

**Update immediately when:**
- Installing new packages (npm/pip)
- Adding MCP servers
- Changing tech stack versions
- Discovering new patterns or gotchas
- Changing project structure

**Pre-autocompact update (at 85% token usage = ~170k tokens):**
1. Trigger automatic documentation sync
2. Review all changes made this session:
   - New dependencies installed?
   - Database schema changes?
   - New patterns discovered?
   - Project structure changes?
3. Update relevant CLAUDE.md files (root/frontend/backend)
4. Update SESSION_PROGRESS.md with session summary
5. Summarize updates for user

**Process:**
```
Install package → Update CLAUDE.md immediately → Inform user
...
Reach 85% tokens → Auto-sync all docs → Prepare for autocompact
```

---

## Communication Style

- User is novice coder - explain technical concepts simply
- Not too verbose, but ensure understanding
- No emojis unless requested
- Focus on facts over validation
- Disagree when necessary for correctness

---

## Specialized Agent Team

**8 specialized agents for automated workflow orchestration.**

The project uses specialized AI agents that work in parallel to ensure quality, security, and consistency. Agents automatically trigger when features are complete.

### Agent Overview

**Tier 1: Orchestration**
- **DevOps/Project Manager** (`/finalize`) - Coordinates all agents, updates docs, manages git workflow

**Tier 2: Builders**
- **Frontend Developer** (`/build-frontend`) - Implements Next.js/React features
- **Backend Developer** (`/build-backend`) - Implements FastAPI endpoints

**Tier 3: Quality Assurance**
- **QA/Tester** (`/qa-check`) - Writes automated tests, checks coverage
- **Security Auditor** (`/security-check`) - Audits RLS policies, permissions, SQL injection
- **Code Reviewer** (`/review-code`) - Reviews patterns, quality, performance

**Tier 4: User Experience**
- **UX/Design** (`/review-ux`) - Checks UI consistency, accessibility, responsive design
- **Integration Tester** (`/integration-test`) - E2E testing with Chrome DevTools MCP

### Typical Workflow

**When you complete a feature, the orchestrator asks:**
> "Feature looks complete. Run quality checks and finalize? [Yes/No]"

**If you say "Yes", orchestrator automatically:**

1. **Parallel Quality Checks** (~2-3 min)
   - Launches QA, Security, and Code Review agents simultaneously
   - All run in parallel in separate contexts

2. **Review Findings**
   - ✅ Auto-fixes minor issues (formatting, missing comments)
   - ⚠️ Reports important issues (needs review)
   - 🔴 Creates GitHub Issues for critical/security bugs

3. **Update Documentation**
   - Updates SESSION_PROGRESS.md
   - Updates CLAUDE.md (if packages/architecture changed)
   - Updates test docs (if new tests)

4. **Git Workflow**
   - Asks: "Commit and push?"
   - Runs tests one final time
   - Generates commit message (follows repo style)
   - Commits with proper format
   - Pushes to GitHub
   - Monitors CI/CD

5. **Final Report**
   - Summary of all checks
   - Test results (X/X passing)
   - Security status
   - Documentation updates
   - Git commit hash
   - CI/CD status

### GitHub Issue Creation

**Agents auto-create GitHub Issues for:**
- 🔴 Security vulnerabilities (RLS bypass, SQL injection, auth bypass)
- 🔴 Data integrity risks (missing validation, incorrect calculations)
- 🔴 Breaking changes without migration
- 🔴 Failed tests that can't be auto-fixed

**Issues are labeled:** `security`, `critical`, `agent-found`

**Minor issues (formatting, comments, style) are reported locally only.**

### Agent Commands

**Manual invocation:**
- `/finalize` - Full orchestration workflow (recommended after features)
- `/build-frontend [description]` - Build frontend feature
- `/build-backend [description]` - Build backend feature
- `/qa-check` - Just run QA agent (tests + coverage)
- `/security-check` - Just run security audit
- `/review-code` - Run code review agents
- `/review-ux` - Check UI consistency
- `/integration-test [description]` - E2E workflow testing

**Automatic triggers:**
The orchestrator detects when features are complete and asks if you want to finalize.

### Agent Configuration

**Location:** `.claude/commands/*.md` (8 agent files)

**Parallel execution:**
Agents run in parallel using single message with multiple Task tool calls for maximum efficiency.

**Example:**
```
Feature complete → Orchestrator asks → You say "Yes" →
  ├─ QA Agent (writes tests)
  ├─ Security Agent (checks RLS)  } All run simultaneously (~2-3 min)
  └─ Code Review (checks patterns)
→ Findings reviewed → Docs updated → Committed → Pushed
```

### Best Practices

1. **Always run `/finalize` after completing features** - Ensures quality, tests, and docs
2. **Review critical issues** - Before auto-fixing, agent shows you critical problems
3. **Trust the agents** - They follow project patterns and best practices
4. **Check GitHub Issues** - Critical findings are tracked there
5. **Verify CI/CD** - Agents report CI status, check if tests pass

### Benefits

- ✅ **Automated testing** - QA agent writes tests for every feature
- ✅ **Security guaranteed** - Security agent catches RLS/permission bugs
- ✅ **Consistency enforced** - Code review ensures patterns match
- ✅ **Docs always updated** - SESSION_PROGRESS.md stays current
- ✅ **Parallel efficiency** - 3 agents run together in ~3 min vs 10 min sequential
- ✅ **GitHub tracking** - Critical issues auto-filed
- ✅ **Quality safety net** - Nothing reaches production without checks
- ✅ **Pre-tested for user** - Integration tests run before asking user to manually test (saves user time)

### Testing Workflow

**Before asking user to manually test UI features:**

1. ✅ Run unit tests (pytest/jest)
2. ✅ Run integration tests (Chrome DevTools MCP)
3. ✅ Check console for errors
4. ✅ Verify happy path works
5. ✅ Fix obvious bugs found
6. **THEN** ask user to test edge cases and UX

**Why:** Catches 80% of bugs automatically. User only tests the tricky 20% that matters (UX, edge cases, business logic).

**Tool:** Chrome DevTools MCP (priority tool in WSL2)
- See `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`
- Automatically runs during `/finalize` for UI features

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

## Current Status (Session 15 - CALCULATION ENGINE INTEGRATED ✅)

**CI/CD Status:** ⚠️ **Waiting for GitHub Secrets** (Backend tests failing)
- ❌ Backend Tests (need GitHub secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL)
- ✅ Frontend Lint & Type Check (0 errors, 108 warnings)
- ✅ Frontend Build
- ✅ TypeScript (0 errors)
- ✅ **Tests pass locally:** 30 passed, 2 skipped

**Session 15 Deliverables (2025-10-21) - CALCULATION ENGINE INTEGRATED:**

**Planning Phase (~2.5 hours):**
- ✅ PLAN_CALCULATION_ENGINE_CONNECTION.md (500+ lines) - Complete implementation roadmap
- ✅ TESTING_WORKFLOW.md (150+ lines) - Automated testing guide with TDD workflow
- ✅ Key architectural decisions documented

**Implementation Phase (~2.5 hours):**
- ✅ **Backend Code** (~300 lines new code in routes/quotes_calc.py):
  - map_variables_to_calculation_input() - Maps 42 variables to 7 nested Pydantic models
  - fetch_admin_settings() - Fetches rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
  - validate_calculation_input() - Validates 10 required fields + business rules
  - Helper functions: safe_decimal(), safe_str(), safe_int(), get_value()
- ✅ **Automated Tests** (23/23 passing ✅):
  - test_quotes_calc_mapper.py (13 tests) - Variable mapper with two-tier logic
  - test_quotes_calc_validation.py (10 tests) - Required fields + business rules
  - Coverage: routes/quotes_calc.py 38% → 49% (+11%)
- ✅ **Fixed broken integration** at line 804-815 (replaced TODO with working code)
- ✅ **Git commits:** b512346, 117c831, 54b6621 - All pushed to main

**Key Features:**
- Two-tier variable system: product override > quote default > fallback
- Validation prevents invalid calculations (all errors returned at once)
- Admin settings auto-fetched from database
- Defaults: USD currency, 60-day delivery, 100% advance payments

**Sessions 8-14 Deliverables:**
- ✅ Quote creation page UI complete with ag-Grid
- ✅ 4-card compact layout with role-based grouping
- ✅ Template system with save/update functionality
- ✅ Grid features: filters, column chooser, bulk edit
- ✅ All manual testing passed and bugs fixed

**Known Technical Debt:**
- ✅ **Quote creation NOW CONNECTED to calculation engine** (Session 15 - COMPLETE!)
- Quote-related pages have temporary stubs (NOW UNBLOCKED - can build list/detail/approval pages)
  - customers/[id], dashboard, quotes/*, quotes/approval pages
  - See TODOs in code for details
- ⚠️ **CI tests failing** - need GitHub secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL)
  - Tests pass locally (30 passed, 2 skipped)
  - Add secrets at: https://github.com/AgasiArgent/kvota/settings/secrets/actions
- GitHub MCP not functional (using direct API calls via curl as workaround)
- TypeScript strict unused checks temporarily disabled

**Development Environment:**
- **Use WSL2 for everything** - Frontend + Backend both run in WSL2
- ⚠️ **Do NOT migrate to native Windows** - Multiple issues with native modules (lightningcss, weasyprint requires GTK)
- All dependencies and libraries work correctly in WSL2
- Windows VS Code can connect to WSL2 and edit files normally

**Ready for Development:**
- Infrastructure is solid
- CI pipeline is stable
- Can focus on implementing features without CI blocking

**Servers Running:**
- Frontend: `npm run dev` on :3000 (or :3001 if 3000 in use)
- Backend: `uvicorn main:app --reload` on :8000

**Test User Credentials:**
- Email: `andrey@masterbearingsales.ru`
- Password: `password`
- Organization: МАСТЕР БЭРИНГ ООО (Master Bearing LLC)

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

## Automated Testing Workflow

**See `.claude/TESTING_WORKFLOW.md` for comprehensive guide.**

### Quick Commands

**Backend - Run All Tests:**
```bash
cd backend
pytest -v

# With coverage
pytest --cov=. --cov-report=term-missing
```

**Backend - Specific Tests:**
```bash
# Single test file
pytest tests/test_quotes_calc_mapper.py -v

# Specific test function
pytest tests/test_file.py::test_function_name -v

# Watch mode (auto-rerun on changes)
ptw -v  # Requires: pip install pytest-watch
```

**Frontend - Run All Tests:**
```bash
cd frontend
npm test

# With coverage
npm test -- --coverage
```

**Frontend - Watch Mode:**
```bash
cd frontend
npm test -- --watch
```

### Test-Driven Development (TDD) Workflow

**Red → Green → Refactor:**
1. **Write test first** (fails - RED)
2. **Implement feature** (passes - GREEN)
3. **Refactor code** (tests protect against breaking changes)
4. **Check coverage** (aim for 80%+)

**Example:**
```bash
# Step 1: Write test (RED)
pytest tests/test_quotes_calc_mapper.py::test_mapper_with_minimal_data -v
# Output: FAILED - function doesn't exist

# Step 2: Implement feature (GREEN)
# ... implement map_variables_to_calculation_input() ...
pytest tests/test_quotes_calc_mapper.py::test_mapper_with_minimal_data -v
# Output: PASSED

# Step 3: Check coverage
pytest tests/test_quotes_calc_mapper.py --cov=routes.quotes_calc --cov-report=term-missing
# Should show 80%+ coverage
```

### Coverage Goals

- **Backend:** 80%+ (critical business logic 95%+)
- **Frontend:** 60%+ (services 80%+, utils 90%+)

### Before Pushing to GitHub

```bash
# Ensure all tests pass locally
cd backend && pytest
cd frontend && npm test

# Ensure CI checks will pass
cd frontend && npm run lint && npm run type-check && npm run build

# If all green, safe to push
git push
```

---

## Variable Quick Reference

**Total:** 42 variables
- Product-only: 5 (sku, brand, base_price_VAT, quantity, weight_in_kg)
- Quote-only: 19
- Both levels: 15 (can be default or override)
- Admin-only: 3 (rate_forex_risk, rate_fin_comm, rate_loan_interest_daily)

**See `.claude/VARIABLES.md` for complete details.**

---

## Debugging Tools Available

### 🤖 Chrome DevTools MCP (✅ PRIORITY TOOL for Testing)

**The PRIMARY tool for automated browser testing in WSL2.**

- **Status:** ✅ **FULLY WORKING** with WSLg (Windows 11 X server)
- **Documentation:** `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`
- **Tiered Testing Guide:** `.claude/TIERED_TESTING_GUIDE.md` ⭐ **Prevent WSL2 freezing**
- **Capabilities:**
  - Full browser automation (login, file upload, form filling, clicks)
  - Console monitoring and network inspection
  - Screenshots (full page or specific elements)
  - JavaScript execution in page context
  - Accessibility tree snapshots for element selection
- **Quick Start (Resource-Optimized):**
  ```bash
  # Use optimized launch script (prevents freezing)
  ./.claude/launch-chrome-testing.sh full http://localhost:3001/quotes/create

  # Or headless mode (60% less memory)
  ./.claude/launch-chrome-testing.sh headless

  # Monitor resources in separate terminal
  ./.claude/monitor-wsl-resources.sh

  # Kill Chrome when done
  ./.claude/launch-chrome-testing.sh kill
  ```
- **Tiered Testing (Fastest to Slowest):**
  1. **Backend Unit Tests** (100 MB, 5s) - `cd backend && pytest -v`
  2. **Backend API Tests** (200 MB, 30s) - `./.claude/test-backend-only.sh`
  3. **Headless Browser** (500 MB, 60s) - `./.claude/launch-chrome-testing.sh headless`
  4. **Full Browser** (1.2 GB, 120s) - `./.claude/launch-chrome-testing.sh full` (only when needed!)
- **🎯 Golden Rule:** Always start with the fastest tier that covers what you need
- **Resource Management:**
  - ⚠️ **WSL2 can freeze** if Chrome uses too much memory
  - ✅ **Configure .wslconfig:** Limit WSL2 to 6GB RAM (see `.wslconfig` in Windows user folder)
  - ✅ **Monitor resources:** Use `./.claude/monitor-wsl-resources.sh`
  - ✅ **Use tiered testing:** Start with backend tests, only use browser when needed
  - **See:** `.claude/TIERED_TESTING_GUIDE.md` for preventing freezes
- **Permission Configuration:**
  - **Location:** `.claude/settings.json`
  - **Required:** Explicit permission list (wildcards alone don't work)
  - **Pre-approved actions:** All 27 Chrome DevTools MCP tools + common Bash commands
  - **Safety:** Dangerous operations (rm -rf, shutdown, etc.) explicitly denied
  - **Reload required:** After editing settings.json, reload VS Code window (Ctrl+Shift+P → "Reload Window")
  - **See:** `.claude/settings.json` for complete permission list

### Other Debugging Tools

- **Browser Console Reader:** ✅ Playwright-based console monitor
  - **Location:** `frontend/.claude-read-console.js`
  - **Usage:** `cd frontend && node .claude-read-console.js http://localhost:3001`
  - **Features:** Color-coded console logs (ERROR/WARNING/INFO/LOG), file paths, line numbers
  - **Note:** Read-only monitoring (can't interact with page)
  - **Best For:** Watching console logs during manual testing
- **Backend Logs:** Check uvicorn output via BashOutput tool
- **Database:** Direct SQL via Supabase dashboard or Postgres MCP

---

## Installed Tools & Dependencies

**Last Updated:** 2025-10-21 (Session 16 - Resource management tools to prevent WSL2 freezing)

### Frontend (package.json)
- **Next.js:** 15.5.4 (App Router with Turbopack)
- **React:** 19.1.0
- **Ant Design:** 5.27.4 (UI components)
- **ag-Grid:** 34.2.0 (Community - Excel-like tables)
- **Supabase:** 2.58.0 (@supabase/supabase-js, @supabase/ssr)
- **Tailwind CSS:** 4.0 (@tailwindcss/postcss)
- **TypeScript:** 5.x (strict mode enabled)
- **Playwright:** 1.56.1 (E2E testing)
- **Day.js:** 1.11.18 (date handling)

**Code Quality Tools:**
- **ESLint:** 9.x (linting with Next.js config)
- **Prettier:** 3.6.2 (code formatting)
- **Husky:** 9.1.7 (pre-commit hooks)
- **lint-staged:** 16.2.4 (staged files linting)

### Backend (Python)
- **FastAPI:** Latest (async web framework)
- **Supabase:** Python client
- **Pydantic:** Latest (validation)
- **asyncpg:** Latest (PostgreSQL driver)
- **pandas:** Latest (Excel/CSV parsing)
- **openpyxl:** Latest (Excel reading)
- **python-multipart:** Latest (file uploads)
- **numpy-financial:** Latest (FV calculations)
- **psycopg2-binary:** Latest (PostgreSQL)
- **uvicorn:** Latest (ASGI server)

**Testing:**
- **pytest:** 8.3.5 (test framework)
- **pytest-asyncio:** Latest (async test support)
- **pytest-cov:** Latest (coverage reporting)
- **httpx:** Latest (API testing)

### Development Tools
- **Git:** Version control with SSH authentication
- **GitHub:** Repository at https://github.com/AgasiArgent/kvota
- **GitHub Actions:** CI/CD for automated testing
- **Pre-commit hooks:** Auto-format and lint before commits

### MCP Servers (Model Context Protocol)
- **chrome-devtools** ✅ **PRIORITY TOOL** - Browser automation via Chrome DevTools Protocol
  - **Status:** FULLY WORKING with WSLg (Windows 11 X server)
  - **Usage:** See `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md` for complete guide
  - **Launch:** `DISPLAY=:0 google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-wsl-profile "http://localhost:3001" &`
  - **Tools:** `mcp__chrome-devtools__*` (take_snapshot, click, fill, upload_file, evaluate_script, etc.)
  - **Best For:** Automated testing, file uploads, console monitoring, screenshots
- **postgres** - Direct Supabase database queries and schema inspection ✅ Working
- **github** - ❌ Not functional (returns empty resources)
  - **Workaround:** Use curl commands with GitHub API directly
  - Token: `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`
  - Example commands:
    ```bash
    # Get repo info
    curl -H "Authorization: token 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" https://api.github.com/repos/AgasiArgent/kvota

    # List issues
    curl -H "Authorization: token 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" https://api.github.com/repos/AgasiArgent/kvota/issues

    # Create issue
    curl -X POST -H "Authorization: token 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" \
      -d '{"title":"Issue title","body":"Issue description"}' \
      https://api.github.com/repos/AgasiArgent/kvota/issues
    ```
- **puppeteer** - Browser automation (not recommended, use chrome-devtools instead)
- **Configuration:** `.mcp.json` (server definitions) + `.claude/settings.json` (enable servers + permissions)
- **See:** `.claude/RECOMMENDED_MCP_SERVERS.md` for configuration details and additional optional servers

### Database
- **Supabase PostgreSQL** - Multi-tenant with RLS
- **Connection:** Direct via DATABASE_URL + REST API via Supabase client
- **Migrations:** Tracked in `backend/migrations/MIGRATIONS.md`

---

**Remember:** Read SESSION_PROGRESS.md on every session start to maintain context!
