## TODO - Next Session

### 1. Test Dual Currency Storage End-to-End
- Create quote and verify both USD and quote currency values are stored
- Check `quote_calculation_summaries` has populated `*_quote` columns
- Check `quote_calculation_results` has `phase_results_quote_currency` JSONB
- Verify `quotes` table has exchange rate metadata and quote currency totals

### 2. Investigate Organization Switching Bug
- Bug: Customer created after switching organizations goes to wrong org
- Likely cause: Frontend cache or backend JWT token not refreshing properly
- Files to check: `OrganizationSwitcher.tsx`, `organization-cache.ts`, `auth.py`

### 3. Test VPS Latency from Russia
- Use Russian VPN to test actual latency improvement
- Compare api.kvotaflow.ru (VPS Russia) vs previous Railway US
- Expected: 150-300ms (vs 2-4s from US)

### Completed
- ~~Fix currency_of_quote None handling~~ ✅ (Session 64)
- ~~Fix rate_loan_interest_daily precision~~ ✅ (Session 65)
- ~~Fix BI10 to use customs_logistics_pmt_due~~ ✅ (Session 65)
- ~~Fix EUR quote USD totals showing 90x too large~~ ✅ (Session 66)
- ~~Add author filter to quotes list~~ ✅ (Session 66)
- ~~Complete shadcn/ui migration and testing~~ ✅ (Session 67)
- ~~Fix templates endpoint missing supabase dependency~~ ✅ (Session 68)
- ~~VPS Migration + CreateQuoteModal Fix~~ ✅ (Session 69)

---

## Session 69 (2025-12-07) - VPS Migration & CreateQuoteModal Fix

### Goal
1. Fix "Создать КП" button not working
2. Set up GitHub Actions auto-deploy to VPS

### Status: COMPLETE ✅

**Time:** ~45 minutes

---

### Infrastructure Migration (Previous Session)
VPS migration from Railway US + Supabase Cloud → Russian VPS completed:
- **Backend:** api.kvotaflow.ru (VPS Russia, Docker)
- **Database:** db.kvotaflow.ru (Self-hosted Supabase on VPS)
- **Frontend:** kvotaflow.ru (Vercel, pointing to VPS)

### Fix 1: CreateQuoteModal Button

**Problem:**
"Создать КП" button triggered file picker but nothing happened after file selection - no client dialog, no file download.

**Root Cause:**
`handleFileSelect` only showed a toast with "TODO: Open create quote modal with file" - CreateQuoteModal component existed but wasn't connected.

**Fix:**
- Added CreateQuoteModal import
- Added state for `selectedFile` and `createModalOpen`
- Updated `handleFileSelect` to store file and open modal
- Added CreateQuoteModal component to JSX

### Fix 2: GitHub Actions Auto-Deploy

**Problem:**
User needed automatic deployment on push to main (like Railway had).

**Solution:**
Created `.github/workflows/deploy-vps.yml`:
- Triggers on push to main (only for backend/** changes)
- Uses SSH with password authentication
- Runs `docker compose build` and `docker compose up -d`
- Manual trigger button available in GitHub UI

**GitHub Secrets Added:**
- `VPS_HOST` = ***REMOVED***
- `VPS_USER` = root
- `VPS_PASSWORD` = (SSH password)

### Files Modified
- `frontend/src/app/quotes/page.tsx` - Added CreateQuoteModal integration
- `.github/workflows/deploy-vps.yml` - New file for auto-deployment

### Environment Configuration
**Vercel (Production):**
```
NEXT_PUBLIC_SUPABASE_URL=https://db.kvotaflow.ru
NEXT_PUBLIC_API_URL=https://api.kvotaflow.ru
```

### Final Architecture
```
┌─────────────────┐     ┌─────────────────────────────────────┐
│  Vercel (Edge)  │────▶│  VPS Russia (***REMOVED***)        │
│  kvotaflow.ru   │     │  ┌─────────────────────────────────┐│
│  (Frontend)     │     │  │ api.kvotaflow.ru (Backend)     ││
└─────────────────┘     │  │ FastAPI + Docker               ││
                        │  ├─────────────────────────────────┤│
                        │  │ db.kvotaflow.ru (Database)     ││
                        │  │ Self-hosted Supabase           ││
                        │  ├─────────────────────────────────┤│
                        │  │ Caddy (Reverse Proxy + HTTPS)  ││
                        │  └─────────────────────────────────┘│
                        └─────────────────────────────────────┘
```

---

## Session 68 (2025-12-07) - Fix Templates Endpoint

### Goal
Fix /quotes/create template dropdown error

### Status: COMPLETE ✅

**Time:** ~15 minutes

---

### Problem
/quotes/create page showed error: `name 'supabase' is not defined`

Console error: `Templates load failed: Error fetching templates: name 'supabase' is not defined`

### Root Cause
Three template functions in `backend/routes/quotes_calc.py` used bare `supabase` variable without FastAPI dependency injection.

### Fix
Added `supabase: Client = Depends(get_supabase)` to:
- `list_variable_templates()` (line 838)
- `create_variable_template()` (line 882)
- `get_variable_template()` (line 938)

### Files Modified
- `backend/routes/quotes_calc.py` - Added supabase dependency to 3 template functions

---

## Session 67 (2025-12-07) - shadcn/ui Migration Testing & Fixes

### Goal
Complete testing of shadcn/ui migration (from Ant Design) across all pages

### Status: COMPLETE ✅

**Time:** ~1 hour

---

### Pages Tested via Chrome DevTools

| Page | Status | Notes |
|------|--------|-------|
| /quotes | ✅ Pass | Loads correctly |
| /quotes/create | ✅ Pass | Backend 500 for templates (separate issue) |
| /quotes/approval | ✅ Pass | Redirects to /quotes (expected) |
| /activity | ✅ Pass | Loads correctly |
| /analytics | ✅ Fixed | SelectItem value="" error |
| /analytics/history | ✅ Pass | Loads correctly |
| /analytics/scheduled | ✅ Pass | Loads correctly |
| /quotes/bin | ✅ Fixed | Objects not valid as React child |
| /admin/excel-validation | ✅ Pass | Loads correctly |
| /leads/pipeline | ✅ Fixed | SelectItem value="" error |

---

### Bugs Fixed

**Bug 1: SelectItem empty value error** (analytics, leads/pipeline)
- **Error:** `A <Select.Item /> must have a value prop that is not an empty string`
- **Fix:** Changed `SelectItem value=""` to `value="all"`, updated filter logic

**Bug 2: React child object error** (quotes/bin)
- **Error:** `Objects are not valid as a React child (found: object with keys {type, loc, msg, input, ctx})`
- **Cause:** Pydantic validation errors returned as objects, passed to toast.error()
- **Fix:** Type check `typeof response.error === 'string'` before toast

### Files Modified
- `frontend/src/app/analytics/page.tsx` - SelectItem value fix
- `frontend/src/app/leads/pipeline/page.tsx` - SelectItem value fix
- `frontend/src/app/quotes/bin/page.tsx` - toast.error object handling

### Commit
- `e8f2c4a` - Complete shadcn/ui migration with runtime fixes for SelectItem and toast errors

---

## Session 66 (2025-12-05) - Fix EUR Quote USD Totals + Author Filter

### Status: COMPLETE ✅

**Time:** ~15 minutes

### Problem
EUR quotes showed incorrect USD totals (90x too large) because `get_exchange_rates()` didn't fetch USD/RUB rate.

### Fix
`backend/routes/quotes_upload.py:191` - Added `all_currencies.add("USD")` to always fetch USD/RUB rate.

### Author Filter Feature
Added author filter to /quotes page with current user pre-selection:
- Backend: Added `created_by` query parameter
- Frontend: Added "Автор" dropdown filter

### Commits
- `cace805` - fix: always fetch USD rate for EUR quote totals conversion
- `b09cae3` - feat: add author filter to quotes list with current user pre-selection

---

## Session 65 (2025-12-05) - Fix Financial Calculation Discrepancies

### Status: COMPLETE ✅

**Time:** ~45 minutes

### Fixes
1. **BI10 formula** - Changed from `offer_post_pmt_due` to `customs_logistics_pmt_due`
2. **rate_loan_interest_daily precision** - Changed from hardcoded 0.00069 to computed 0.25/365

### Commits
- `f1234ab` - fix: use customs_logistics_pmt_due for BI10 operational financing
- `ac8abad` - fix: correct rate_loan_interest_daily precision

---

## Session 64 (2025-12-04) - Fix Quote Totals Display

### Status: COMPLETE ✅

**Time:** ~30 minutes

### Problem
"Сумма USD" and "Прибыль" columns showed empty on /quotes page.

### Root Cause
`dict.get('currency_of_quote', 'USD')` returns `None` when key exists with `None` value.

### Fix
Changed to `request.variables.get('currency_of_quote') or 'USD'`

---

## Session 63 (2025-12-03) - Production Bug Fix: Phone Number Save

### Status: COMPLETE ✅

**Time:** ~20 minutes

### Problem
"No access token available" error on production when saving phone number.

### Root Cause
Supabase uses URL-safe Base64 (`-` and `_`) but `atob()` only handles standard Base64.

### Fix
Convert URL-safe to standard Base64: `-` → `+`, `_` → `/`

---

## Session 62 (2025-12-02/03) - Dual Currency Storage Implementation

### Status: COMPLETE ✅

**Time:** ~2 hours

### Implementation
Store all monetary values in both USD (canonical) and quote currency for audit trail:

**Database Changes (Migration 037):**
- `quote_calculation_summaries`: Added quote currency columns + exchange rate metadata
- `quote_calculation_results`: Added `phase_results_quote_currency` JSONB
- `quotes`: Added `usd_to_quote_rate`, `total_amount_quote`, `total_with_vat_quote`

**Backend Changes:**
- Updated `aggregate_product_results_to_summary()` to store dual currency values
- Exchange rate captured at calculation time for historical accuracy

---

## Earlier Sessions Summary (61-55)

### Session 61 (2025-12-01) - Excel Validation Export Fixes
Fixed logistics totals, financing fields, percentage formatting, and VAT 22% for 2026+ deliveries.

### Session 60 (2025-11-30) - Exchange Rate Display Fix
Fixed TRY/RUB rate (CBR nominal handling) and changed to 4 decimal places.

### Session 59 (2025-11-30) - CI Pipeline Fixes
Added feature branch to CI triggers, fixed test parameters, all 3 CI jobs passing.

### Session 58 (2025-11-28) - Excel Validation Export Service
Created `POST /api/quotes/upload-excel-validation` endpoint with comparison export.

### Session 57 (2025-11-28) - Financing Block Formula Fixes
Fixed BL4 (simple vs compound interest) and BH9 (payment milestones formula).

### Session 56 (2025-11-28) - Precision Improvement
Changed `round_decimal()` from 2 to 4 decimal places. Achieved 0.0005% accuracy.

### Session 55 (2025-11-28) - CBR Rate Validation
Fixed Phase 3 logistics + brokerage distribution to match Excel formulas.

---

## Archive Reference

Sessions 54 and earlier have been archived. Key accomplishments:

- **Session 54:** Excel validation investigation, exchange rate override fix
- **Session 53:** Exchange rate bug fixes (frontend + backend parameter order)
- **Session 52:** Web UI testing with Chrome DevTools, CSV parsing fixes
- **Session 51:** HTTP endpoint tests using FastAPI TestClient (6 tests)
- **Session 50:** API tests for calculation engine (comprehensive)
- **Sessions 48-49:** Multi-currency support implementation
- **Sessions 39-47:** Various features including approval workflow, activity logging, feedback system

For detailed session logs prior to Session 55, see git history or contact maintainer.

---

## Key Technical References

### Calculation Engine
- 13-phase pipeline with 42 variables
- USD canonical currency (all internal calculations)
- See `.claude/skills/calculation-engine-guidelines/`

### Exchange Rates
- CBR API with daily cron refresh
- Manual rate overrides per organization
- Nominal handling for TRY, JPY, etc.

### Multi-Tenant Architecture
- Organization-based RLS on all tables
- JWT claims passed to PostgreSQL
- See `.claude/skills/database-verification/`

### Testing
- Backend: `pytest` (75/84 passing)
- Frontend: Build + lint + type-check
- Browser: Chrome DevTools MCP automation

---

**Last Updated:** 2025-12-07 (Session 68)
