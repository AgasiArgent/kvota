# B2B Quotation Platform - Claude Code Session Guide

**READ THIS FIRST when starting any new session!**

Last Updated: 2025-10-19

---

## Project Overview

Russian B2B quotation platform for cross-border trade (import/export).
- **Frontend:** Next.js 15.5, React 19, TypeScript, Ant Design + ag-Grid
- **Backend:** FastAPI (Python), Supabase PostgreSQL
- **Auth:** Supabase Auth with Row-Level Security (RLS)
- **Key Feature:** Multi-variable quote calculations with admin/user overrides

---

## Important Principles

### ⚠️ PREFER EXISTING SOLUTIONS OVER CUSTOM CODE

**Before implementing any complex feature, ALWAYS:**

1. **Search for existing libraries/tools** that solve the problem
2. **Evaluate 2-3 options** (free vs paid, React compatibility, TypeScript support)
3. **Present options to user** with pros/cons and recommendation
4. **Only build from scratch** if no suitable solution exists or user explicitly requests it

**Example:** When user needed Excel-like table editing:
- ❌ BAD: "Let me build custom clipboard handler and cell selection logic"
- ✅ GOOD: "Found ag-Grid, Handsontable, react-data-grid. Here's comparison..."

### Why This Matters
- **Saves time:** 2-3 hours vs 8-10 hours for custom implementation
- **Better quality:** Battle-tested libraries vs custom bugs
- **Maintainability:** Community support vs maintaining custom code
- **User benefits:** Better UX from specialized tools

---

### 🎯 TRACK PROGRESS AFTER SIGNIFICANT TASKS

**After completing any significant task (30+ min work), update `.claude/SESSION_PROGRESS.md`:**

1. Mark task as **awaiting verification**: `- [~] Task name (awaiting user verification)`
2. Add brief note about what was accomplished
3. Update "In Progress" section with next task
4. Note any blockers or issues encountered
5. **IMPORTANT:** Only mark as complete `[x]` after user has verified it works

**Task States:**
- `[ ]` - Not started
- `[>]` - In progress
- `[~]` - **Awaiting user verification** (work done, needs testing)
- `[x]` - **Completed and verified by user**
- `[!]` - Blocked or has issues

**Verification Workflow:**
1. Complete implementation → Mark as `[~]` awaiting verification
2. Notify user that task is ready for testing
3. If user is working on other things, remind every 2-3 interactions
4. User tests → provides feedback
5. If approved → Mark as `[x]` completed
6. If issues found → Mark as `[!]` blocked, note issues, fix, return to step 1

**Why:** Ensures quality - nothing is marked "done" without user confirmation that it actually works.

**Example:**
```markdown
- [~] Install ag-Grid dependencies (awaiting user verification)
  - Added ag-grid-react@32.0.0, ag-grid-community@32.0.0
  - Verified no compilation errors
  - Ready for user to test in browser
  - Time: 5 min
  - Status: Awaiting user to verify ag-Grid appears correctly
```

**When to update:**
- ✅ After completing a phase or major task → Mark as `[~]`
- ✅ After user verifies → Change `[~]` to `[x]`
- ✅ Before switching to a different area of work
- ✅ When encountering blockers or issues → Mark as `[!]`
- ✅ At end of session

**When NOT to update:**
- ❌ Tiny tasks (<10 min)
- ❌ Documentation reading only
- ❌ Small debugging fixes

**Reminder Protocol:**
- If user hasn't tested after 2-3 interactions, gently remind: "Ready to test [task name] when you have a moment"
- Don't be pushy, but ensure verification isn't forgotten
- Track which tasks are awaiting verification at the end of session

---

## Current Session Focus (Session 8)

**Goal:** Restructure quote creation page with ag-Grid for Excel-like editing

**Status:** Phase 1 - Documentation & Setup

**Next Steps:**
1. Create implementation plan document
2. Install ag-Grid
3. Build quote-level defaults section
4. Implement ag-Grid products table

**Key Files:**
- Implementation Plan: `.claude/IMPLEMENTATION_PLAN_AG_GRID.md`
- Variable Classification: `.claude/VARIABLES_CLASSIFICATION.md`
- Quote Creation Page: `frontend/src/app/quotes/create/page.tsx`

---

## Tech Stack

### Frontend
- **Framework:** Next.js 15.5 with App Router
- **UI Library:** Ant Design (antd) for forms/layout/cards
- **Data Grid:** ag-Grid Community (for products table)
- **Language:** TypeScript
- **State:** React hooks (useState, useEffect)
- **API Calls:** Fetch with Supabase client for auth headers

### Backend
- **Framework:** FastAPI (Python)
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth (JWT tokens)
- **Validation:** Pydantic models
- **ORM:** Supabase client (REST API)

### Database
- **Multi-tenant:** Organization-based isolation with RLS
- **Key Tables:**
  - `organizations` - Companies using the platform
  - `organization_members` - User-organization relationships with roles
  - `customers` - B2B clients
  - `quotes` - Quote headers
  - `quote_items` - Quote line items (products)
  - `calculation_settings` - Admin-only calculation defaults

---

## Key Architectural Patterns

### 1. Two-Tier Variable System
- **Quote-level defaults:** Apply to all products (set in form section)
- **Product-level overrides:** Can override defaults per product (in ag-Grid table)
- **Color coding:** Gray (default), Blue (user override), Red (admin override)

### 2. Admin vs User Variables
- **Admin-only (3):** rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
  - Stored in `calculation_settings` table
  - Only admin/owner can modify
  - Apply organization-wide
- **User-editable (37):** All other variables
  - Can be quote-level or product-level
  - Users can modify per quote

### 3. Role-Based Access Control
- **Roles:** member, manager, admin, owner
- **Permissions:** Checked in backend via `check_admin_permissions()`
- **Frontend:** Role-based UI hiding (still validate in backend)

### 4. File Upload Workflow
1. User uploads Excel/CSV with products
2. Parse to extract: name, SKU, brand, quantity, price, weight, etc.
3. Populate ag-Grid table (editable)
4. User fills quote-level defaults
5. User can override product-level variables
6. Calculate button sends to backend
7. Results shown in results table

---

## Available Debugging Tools

### 🔧 Tools Claude Can Use for Debugging

**Playwright MCP (Model Context Protocol)**
- **What:** I can use Playwright to interact with the browser directly
- **When to use:**
  - Frontend debugging when visual inspection is needed
  - Testing user flows automatically
  - Capturing screenshots of bugs
  - Checking if elements are visible/clickable
  - Inspecting DOM structure
- **How:** I can launch browser, navigate pages, click elements, fill forms, take screenshots
- **Example:** `playwright.goto('http://localhost:3000/quotes/create')` → `playwright.screenshot()`

**Chrome DevTools (via MCP)**
- **What:** Direct access to Chrome debugging when Chrome is running with `--remote-debugging-port=9222`
- **When to use:**
  - Need to see console errors in real-time
  - Inspect network requests/responses
  - Check if JavaScript is loading correctly
  - Debug React component state
- **How:** Start Chrome with debugging, then I can access console/network tabs

**Browser Console Logging**
- **What:** Add `console.log()` statements to frontend code
- **When to use:**
  - Track state changes
  - Debug component rendering
  - Check what data is being passed to components
- **How:** Add debug logs to code, check browser console (user shares output)

**Backend Logging**
- **What:** Python `print()` or FastAPI logging
- **When to use:**
  - Debug API requests/responses
  - Check database queries
  - Track authentication flow
- **How:** Add print statements, check uvicorn server output

**Database Inspection**
- **What:** Direct SQL queries via psql or Supabase dashboard
- **When to use:**
  - Verify data is saved correctly
  - Check RLS policies
  - Inspect table structure
- **How:** Run SQL commands via `psql` or execute migrations

### 🎯 Debugging Strategy

**When user reports a bug:**
1. **First:** Ask user to check browser console (F12) and share errors
2. **If frontend issue:** Consider using Playwright to see it myself
3. **If backend issue:** Check uvicorn logs via BashOutput tool
4. **If data issue:** Query database directly
5. **Always:** Add console.log/print debugging to confirm assumptions

**Example Debugging Flow:**
```
User: "Table not showing after upload"
↓
Me: Add console.log to see if data is loaded
↓
Check browser console OR use Playwright to inspect
↓
Verify ag-Grid component is rendering
↓
Check CSS is loaded
↓
Fix issue + verify
```

---

## Common Tasks

### Reading Files
- Always use Read tool, not `cat` bash command
- Read full file by default (don't use offset/limit unless huge file)
- Check VARIABLES_CLASSIFICATION.md for variable categorization

### Making API Changes
1. Update backend route in `backend/routes/*.py`
2. Update Pydantic models if needed
3. Update frontend service in `frontend/src/lib/api/*-service.ts`
4. Update TypeScript interfaces
5. Test with real API call

### Database Changes
1. Create migration in `backend/migrations/*.sql`
2. Update table definitions
3. Update RLS policies if needed
4. Test with Supabase dashboard

### UI Changes
1. Read current component first
2. Use Ant Design components when possible
3. Use ag-Grid for data tables
4. Match existing styling/patterns
5. Ensure responsive design

---

## Key Commands

### Frontend (Next.js)
```bash
cd /home/novi/quotation-app/frontend
npm run dev  # Already running in background (bash e31355)
npm install <package>
npm run build
```

### Backend (FastAPI)
```bash
cd /home/novi/quotation-app/backend
source venv/bin/activate
python -m uvicorn main:app --reload  # Already running (bash 481cc4 or f8720f)
pip install <package>
```

### Database
- Supabase Dashboard: https://supabase.com/dashboard
- Migrations: `backend/migrations/`
- Connection: Use SUPABASE_SERVICE_ROLE_KEY for admin operations

---

## Important Files Reference

### 📚 Core Documentation (Always Read These)
- `.claude/README.md` - **THIS FILE** - Read first every session ⭐
- `.claude/SESSION_PROGRESS.md` - Incremental progress tracking ⭐
- `.claude/IMPLEMENTATION_PLAN_AG_GRID.md` - Current implementation plan (Session 8) ⭐
- `.claude/VARIABLES_CLASSIFICATION.md` - All 42 variables classified ⭐
- `.claude/Variables_specification_notion.md` - Complete variable specs with formulas ⭐
- `.claude/calculation_engine_summary.md` - Calculation engine reference (13 phases)

### 📂 Session History (Reference Only)
- `.claude/SESSION_7_COMPLETION_SUMMARY.md` - Session 7 summary (backend quotes infrastructure)
- `.claude/SESSION_7_QUOTES_IMPLEMENTATION.md` - Session 7 detailed implementation notes
- `.claude/SESSION_8_QUICK_START.md` - Session 8 start guide (now superseded by README)
- `.claude/NEXT_SESSION_START_HERE.md` - Session 7 start guide (historical)

### 📖 Background Context (Optional Reading)
- `.claude/quotation_app_context.md` - Original project business context and goals

### Frontend Key Files
- `frontend/src/app/quotes/create/page.tsx` - Quote creation page (RESTRUCTURING NOW)
- `frontend/src/app/settings/calculation/page.tsx` - Admin settings page
- `frontend/src/lib/api/calculation-settings-service.ts` - Admin settings API client
- `frontend/src/lib/api/quotes-calc-service.ts` - Quote calculation API client

### Backend Key Files
- `backend/main.py` - FastAPI app entry point
- `backend/auth.py` - Authentication logic
- `backend/routes/calculation_settings.py` - Admin settings endpoints
- `backend/routes/quotes_calc.py` - Quote calculation endpoints
- `backend/routes/quotes.py` - Quote CRUD endpoints

### Database Migrations
- `backend/migrations/008_calculation_settings.sql` - Admin settings table (LATEST)

---

## Variable Classification Quick Reference

**Total Variables:** 40

**By Level:**
- Product-only (3): quantity, base_price_vat, weight_in_kg
- Quote-only (19): seller_company, currency_of_quote, advance_from_client, etc.
- Both (15): Can be quote default OR overridden per product
- Admin-only (3): rate_forex_risk, rate_fin_comm, rate_loan_interest_daily

**By Category:**
- Product Info (5 + 2 new): base_price, quantity, weight, SKU, Brand
- Financial (9): currency, rates, discounts, markup, fees
- Logistics (7): country, delivery, shipping costs
- Taxes & Duties (2): import tariff, excise
- Payment Terms (12): advance payments, timing
- Customs & Clearance (5): brokerage, docs, warehousing
- Company Settings (2): seller_company, sale_type

---

## Session History Summary

- **Session 1-6:** Database schema, authentication, basic CRUD
- **Session 7:** Quote creation page with backend integration, calculation API
- **Session 8 (CURRENT):** Admin settings page completed, restructuring quote creation with ag-Grid

---

## Problem-Solving Checklist

When stuck or encountering errors:

1. ✅ **Check if existing solution exists** (libraries, tools, patterns)
2. ✅ Read relevant documentation files in `.claude/`
3. ✅ Read current implementation files before editing
4. ✅ Check variable classification for correct categorization
5. ✅ Verify backend and frontend are in sync (types, interfaces)
6. ✅ Test with real data, not just theory
7. ✅ Check browser console and backend logs
8. ✅ Verify database schema matches code expectations
9. ✅ Check RLS policies aren't blocking operations
10. ✅ Ask user if unsure about business logic

---

## Contact & Feedback

- User prefers concise technical communication
- Likes to review plans before implementation
- Values existing solutions over custom code
- Appreciates detailed documentation
- Russian language used in UI (English in code/comments)

---

**Remember:** Always look for existing solutions first! 🚀
