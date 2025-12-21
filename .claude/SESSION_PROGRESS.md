# Session Progress

**Last Updated:** 2025-12-21 (Session 77)

---

## Current TODO

**TASK-008: Quote List Constructor with Department Presets**
- Status: 96% complete (50/52 tasks)
- Phases 0-7 complete
- Phase 8: Documentation in progress
- Ready for commit and PR

**Uncommitted files:**
- `dev/active/20251221-TASK-008-quote-list-constructor-with-department-presets/` - Task docs
- `.claude/reference/list-constructor-mapping.md` - Column mapping reference
- Backend: `routes/list_presets.py`, `routes/quotes_list.py`, `routes/purchasing_companies.py`, `routes/suppliers.py`, `services/list_query_builder.py`
- Frontend: `components/quotes/list-constructor/` (ListGrid, PresetSelector, ColumnConfigModal, etc.)
- Migrations: 052-055 (purchasing_companies, suppliers, quote_approval_history, new fields, list_presets)

---

## Recent Completed

### Session 77 (2025-12-21) - TASK-008 Quote List Constructor

**Quote List Constructor with Department Presets**

Major feature: Consolidate 3 department Excel spreadsheets (~200 columns) into single ag-Grid view with ~80 unique columns and department presets.

**Database (4 migrations applied):**
- 052: `purchasing_companies`, `suppliers`, `quote_approval_history` tables with RLS
- 053: 32 new columns across quotes, quote_items, quote_calculation_summaries
- 054: `list_presets` table for column configurations
- 055: 4 system presets (Продажи, Логистика, Бухгалтерия, Руководство)

**Backend (~2,000 lines):**
- `routes/list_presets.py` - CRUD for presets with permission checks
- `routes/quotes_list.py` - Dynamic query with preset support
- `routes/purchasing_companies.py` - CRUD for purchasing companies
- `routes/suppliers.py` - CRUD for suppliers
- `services/list_query_builder.py` - Dynamic SQL builder with 61 columns

**Frontend (~1,500 lines):**
- `ListGrid.tsx` - ag-Grid wrapper with pagination, sorting, filtering
- `PresetSelector.tsx` - Dropdown with grouped presets
- `ColumnConfigModal.tsx` - Column configuration with category grouping
- `ListGridWithPresets.tsx` - Main entry point component
- `columnDefs.ts` - 61 column definitions with Russian headers
- `preset-service.ts` - API hooks for preset management
- `quotes-list-service.ts` - API hooks for list data

**Testing:**
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors (209 warnings pre-existing)
- ✅ Frontend build: Success
- ✅ Backend imports: All 61 columns available, routes registered

---

### Session 76 (2025-12-18) - Production Hotfix

**Backend crash fix - missing Python dependencies**

Root cause: After BFG secrets cleanup, VPS had diverged git history and wasn't pulling latest code properly.

**Issues fixed:**
- `ModuleNotFoundError: No module named 'docx'` - Added `python-docx==1.1.2` to requirements.txt (PR #30, #31)
- `ModuleNotFoundError: No module named 'num2words'` - Added `num2words==0.5.14` to requirements.txt (PR #32)
- VPS git divergence - Force reset to `origin/main` after BFG history rewrite

**PRs merged:**
- PR #30: fix/add-python-docx → feature/user-feedback
- PR #31: feature/user-feedback → main (python-docx fix)
- PR #32: fix/add-python-docx → main (num2words fix)

**GitHub branch protection configured:**
- main: Protected, admin bypass enabled
- feature/user-feedback: Protected, admin bypass enabled

---

### Session 75 (2025-12-18) - Security Audit

**Git secrets cleanup with BFG Repo Cleaner**

- Removed 11 hardcoded secrets from git history (GitHub tokens, DB passwords, API keys)
- Force-pushed cleaned history to all branches
- Set up branch protection rules
- Created `DEVELOPER_ONBOARDING.md` (988 lines)

**Secrets removed:**
- GitHub PAT tokens (2)
- VPS SSH password
- Supabase keys (3)
- Notion API key
- Todoist API key
- Dadata API key

---

### Session 74 (2025-12-14) - TASK-002 Complete

**USD Calculation Engine Fixes** - PR #26

Key discovery: Calculation engine already currency-agnostic!
- Fixed `quotes_upload.py` to match `quotes_calc.py` (both use USD)
- Fixed validation export currency conversion (column D formulas)
- Fixed DM fee conversion, conditional formatting threshold

### Sessions 67-73 (Dec 7-13)

- VPS Migration complete (api.kvotaflow.ru, db.kvotaflow.ru)
- shadcn/ui migration complete
- Dual currency storage (USD + quote currency)
- Telegram notifications + Sentry error tracking
- GitHub Actions auto-deploy

---

## Architecture

```
Vercel (kvotaflow.ru) → VPS Russia (<VPS_IP>)
                        ├─ api.kvotaflow.ru (FastAPI)
                        ├─ db.kvotaflow.ru (Supabase)
                        └─ Caddy (HTTPS)
```

---

## Key References

- **Skills:** `.claude/skills/` (calculation-engine, database-verification, frontend-dev, backend-dev)
- **Variables:** `.claude/VARIABLES.md`
- **Testing:** `.claude/TESTING_WORKFLOW.md`

---

## Archive

Sessions 61 and earlier: See git history.

Milestones: Multi-currency (48-49), Pre-deployment infra (26), Calculation engine (15), ag-Grid (8-14)
