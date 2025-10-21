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
- `.claude/TESTING_WORKFLOW.md` - Automated testing workflow and TDD guide

### Key Source Files
- `frontend/src/app/quotes/create/page.tsx` - Quote creation (RESTRUCTURING)
- `frontend/src/app/settings/calculation/page.tsx` - Admin settings
- `backend/routes/quotes_calc.py` - Calculation engine
- `backend/routes/calculation_settings.py` - Admin settings API
- `backend/auth.py` - Authentication system

---

## Current Status (Session 15 - CALCULATION ENGINE INTEGRATION PLANNED)

**CI/CD Status:** ✅ **ALL CHECKS PASSING**
- ✅ Backend Tests
- ✅ Frontend Lint & Type Check (0 errors, 108 warnings)
- ✅ Frontend Build
- ✅ TypeScript (0 errors)

**Session 15 Deliverables (2025-10-21):**
- ✅ Created PLAN_CALCULATION_ENGINE_CONNECTION.md (500+ lines)
  - 6-phase implementation plan for connecting quote creation to calculation engine
  - Variable requirements: 10 required, 32 optional with defaults
  - Business logic rules and validation strategy documented
  - Estimated time: 4.5 hours
- ✅ Created TESTING_WORKFLOW.md
  - Automated testing guide with TDD workflow
  - Quick command reference for pytest and npm test
  - Coverage goals and debugging tips
- ✅ Key architectural decisions:
  - Keep flat dict on frontend, backend transforms to nested
  - Fetch admin settings every request (no cache)
  - Return all validation errors at once
  - currency_of_quote default: USD (not RUB)
  - delivery_time default: 60 days

**Sessions 8-14 Deliverables:**
- ✅ Quote creation page UI complete with ag-Grid
- ✅ 4-card compact layout with role-based grouping
- ✅ Template system with save/update functionality
- ✅ Grid features: filters, column chooser, bulk edit
- ✅ All manual testing passed and bugs fixed

**Known Technical Debt:**
- ❗ **Quote creation NOT connected to calculation engine** (line 568-579 in quotes_calc.py has incomplete TODO)
  - **Next:** Follow PLAN_CALCULATION_ENGINE_CONNECTION.md to fix integration
- Quote-related pages have temporary stubs (need organizationId context implementation)
  - customers/[id], dashboard, quotes/*, quotes/approval pages
  - See TODOs in code for details
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

- **Browser Console Reader:** ✅ Playwright-based console monitor
  - **Location:** `frontend/.claude-read-console.js`
  - **Usage:** `cd frontend && node .claude-read-console.js http://localhost:3001`
  - **Features:** Color-coded console logs (ERROR/WARNING/INFO/LOG), file paths, line numbers
  - **Note:** Launches Chromium browser and captures all console output in real-time
- **Backend Logs:** Check uvicorn output via BashOutput tool
- **Database:** Direct SQL via Supabase dashboard or Postgres MCP
- **Chrome DevTools:** ❌ Not working from WSL2 (networking issues between WSL2 and Windows Chrome)
  - Attempted fixes: mirrored networking, firewall rules, --remote-debugging-address=0.0.0.0
  - Use Browser Console Reader script instead

---

## Installed Tools & Dependencies

**Last Updated:** 2025-10-21

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
- **postgres** - Direct Supabase database queries and schema inspection ✅ Working
- **github** - ❌ Not functional (returns empty resources)
  - **Workaround:** Use curl commands with GitHub API directly
  - Token: `***REMOVED***`
  - Example commands:
    ```bash
    # Get repo info
    curl -H "Authorization: token ***REMOVED***" https://api.github.com/repos/AgasiArgent/kvota

    # List issues
    curl -H "Authorization: token ***REMOVED***" https://api.github.com/repos/AgasiArgent/kvota/issues

    # Create issue
    curl -X POST -H "Authorization: token ***REMOVED***" \
      -d '{"title":"Issue title","body":"Issue description"}' \
      https://api.github.com/repos/AgasiArgent/kvota/issues
    ```
- **chrome-devtools** - Browser debugging via remote debugging port 9222 (not tested)
- **puppeteer** - Browser automation (not tested)
- **Configuration:** `.mcp.json` (server definitions) + `.claude/settings.json` (enable servers)
- **See:** `.claude/RECOMMENDED_MCP_SERVERS.md` for configuration details and additional optional servers

### Database
- **Supabase PostgreSQL** - Multi-tenant with RLS
- **Connection:** Direct via DATABASE_URL + REST API via Supabase client
- **Migrations:** Tracked in `backend/migrations/MIGRATIONS.md`

---

**Remember:** Read SESSION_PROGRESS.md on every session start to maintain context!
