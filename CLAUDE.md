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
- `.claude/IMPLEMENTATION_PLAN_AG_GRID.md` - Current ag-Grid restructure plan
- `.claude/calculation_engine_summary.md` - Calculation engine (13 phases)

### Key Source Files
- `frontend/src/app/quotes/create/page.tsx` - Quote creation (RESTRUCTURING)
- `frontend/src/app/settings/calculation/page.tsx` - Admin settings
- `backend/routes/quotes_calc.py` - Calculation engine
- `backend/routes/calculation_settings.py` - Admin settings API
- `backend/auth.py` - Authentication system

---

## Current Status (Session 8)

**Goal:** Restructure quote creation page with ag-Grid for Excel-like editing

**Progress:** Phases 1-6 complete, awaiting user verification
- ✅ Documentation & setup
- ✅ Quote-level defaults form (6 cards)
- ✅ ag-Grid products table with override columns
- ✅ Bulk edit functionality
- ✅ Color coding (gray/blue for defaults/overrides)
- ✅ Backend updates (SKU, Brand columns added)

**Next Steps:**
1. User verification of all frontend changes
2. Test upload → edit → calculate workflow
3. Fix any issues discovered in testing
4. Mark verified tasks as complete

**Servers Running:**
- Frontend: `npm run dev` on :3000 (bash e31355)
- Backend: `uvicorn main:app --reload` on :8000 (bash 481cc4 or f8720f)

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

## Variable Quick Reference

**Total:** 42 variables
- Product-only: 5 (sku, brand, base_price_VAT, quantity, weight_in_kg)
- Quote-only: 19
- Both levels: 15 (can be default or override)
- Admin-only: 3 (rate_forex_risk, rate_fin_comm, rate_loan_interest_daily)

**See `.claude/VARIABLES.md` for complete details.**

---

## Debugging Tools Available

- **Browser Console:** Add `console.log()` for frontend debugging
- **Backend Logs:** Check uvicorn output via BashOutput tool
- **Database:** Direct SQL via Supabase dashboard
- **Playwright MCP:** Can interact with browser for visual debugging
- **Chrome DevTools:** When Chrome running with `--remote-debugging-port=9222`

---

## Installed Tools & Dependencies

**Last Updated:** 2025-10-19

### Frontend (package.json)
- **Next.js:** 15.5.4 (App Router with Turbopack)
- **React:** 19.1.0
- **Ant Design:** 5.27.4 (UI components)
- **ag-Grid:** 34.2.0 (Community - Excel-like tables)
- **Supabase:** 2.58.0 (@supabase/supabase-js, @supabase/ssr)
- **Tailwind CSS:** 4.0 (@tailwindcss/postcss)
- **TypeScript:** 5.x
- **Playwright:** 1.56.1 (testing)
- **Day.js:** 1.11.18 (date handling)

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

### MCP Servers (Model Context Protocol)
- **chrome-devtools** - Browser debugging via remote debugging port 9222

### Database
- **Supabase PostgreSQL** - Multi-tenant with RLS
- **Connection:** Direct via DATABASE_URL + REST API via Supabase client

---

**Remember:** Read SESSION_PROGRESS.md on every session start to maintain context!
