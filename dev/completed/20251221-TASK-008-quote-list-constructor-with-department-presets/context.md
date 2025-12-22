# Quote List Constructor with Department Presets - Context

**Task ID:** TASK-008
**Last Updated:** 2025-12-21 15:30
**Session:** Session 49
**Current Phase:** Phase 0 of 8 - Planning Complete
**Status:** Ready for Implementation

---

## 1. Task Overview

### Quick Summary

Building a universal quote list page with ag-Grid that supports department-specific column presets (Sales, Logistics, Accounting, Management). This consolidates 3 separate Excel spreadsheets (~200 columns total) into a single source of truth with ~80 unique available columns, filtered by preset.

**Key achievement so far:** Complete column mapping from 3 Excel files (ЕРПС LITE 64 cols, Реестр КА 70 cols, Реестр КП 66 cols) to database schema - identifying what exists, what needs new storage, and what can be derived on-the-fly.

### Current Phase Progress

**Phase 0: Planning & Mapping** [✓ Complete]
- ✅ Mapped 66 columns from Реестр КП (Quote Registry)
- ✅ Mapped 64 columns from ЕРПС LITE (Sales)
- ✅ Mapped 70 columns from Реестр КА (Cost Analysis)
- ✅ Identified ~80 unique columns across all sources
- ✅ Documented storage requirements for new fields
- ✅ Created implementation plan (plan.md)
- ✅ Created mapping document (.claude/reference/list-constructor-mapping.md)

**Phase 1: Database Schema** [❌ Not Started]
**Phase 2-8: Implementation** [❌ Not Started]

### What's Been Completed

**Mapping Phase (complete):**
- Analyzed all 3 Excel department lists with 200 total columns
- Identified ~80 unique columns after deduplication
- Mapped to existing DB schema where fields already exist
- Documented new tables needed: purchasing_companies, suppliers, quote_approval_history
- Documented new fields needed in quotes, quote_items, quote_calculation_summaries
- Created comprehensive mapping document with source tracking

**Documentation Created:**
- `.claude/reference/list-constructor-mapping.md` - Complete column mapping (~600 lines)
- `dev/active/20251221-TASK-008-*/plan.md` - Implementation plan (8 phases)
- This context file
- tasks.md (to be updated)

### What's In Progress Right Now

**Current Task:** Completing dev-docs, then starting Phase 1 (Database Schema)

**Next immediate action:** Create database migrations for new tables and fields

**Blockers:** None

### What's Next

**Immediate next steps (this session):**
1. Update tasks.md with proper TASK-008 task breakdown
2. Create migration 052: New tables (purchasing_companies, suppliers, quote_approval_history)
3. Create migration 053: New fields in existing tables
4. Create migration 054: list_presets table
5. Add RLS policies for all new tables

**Future phases:**
- Phase 2: Backend - Preset API (~2 hours)
- Phase 3: Backend - List Query API (~3 hours)
- Phase 4: Frontend - ag-Grid Setup (~3 hours)
- Phase 5: Frontend - Preset Management (~2 hours)
- Phase 6: Calculation Engine Updates (~2 hours)
- Phase 7: Testing & QA (~2 hours)
- Phase 8: Documentation & Deployment (~1 hour)

---

## 2. Code Inventory

### Files Created (New) - Documentation Only So Far

**Documentation:**
1. `.claude/reference/list-constructor-mapping.md` (~600 lines)
   - Complete mapping of ~80 columns from 3 Excel files
   - Classification: exists / new storage / derived
   - Aggregation strategies for per-product fields

2. `dev/active/20251221-TASK-008-*/plan.md` (~450 lines)
   - 8 implementation phases
   - Architecture decisions (DB presets, base+derived data)
   - API contracts and data models
   - Risk mitigation

3. `dev/active/20251221-TASK-008-*/context.md` (this file)
4. `dev/active/20251221-TASK-008-*/tasks.md` (to be filled)

### Files to Create (Planned)

**Database Migrations:**
1. `backend/migrations/052_list_constructor_tables.sql` (~150 lines)
   - purchasing_companies table
   - suppliers table
   - quote_approval_history table
   - RLS policies

2. `backend/migrations/053_quote_fields_expansion.sql` (~100 lines)
   - New quote-level fields
   - New quote_items fields
   - New aggregated fields in quote_calculation_summaries

3. `backend/migrations/054_list_presets.sql` (~80 lines)
   - list_presets table
   - Indexes

4. `backend/migrations/055_seed_department_presets.sql` (~200 lines)
   - 4 system presets (Sales, Logistics, Accounting, Management)

**Backend:**
5. `backend/routes/list_presets.py` (~200 lines)
6. `backend/routes/quotes_list.py` (~400 lines)
7. `backend/services/list_query_builder.py` (~300 lines)
8. `backend/tests/test_list_presets.py` (~150 lines)
9. `backend/tests/test_quotes_list.py` (~200 lines)

**Frontend:**
10. `frontend/src/app/quotes/list/page.tsx` (~300 lines)
11. `frontend/src/components/quotes/ListGrid.tsx` (~300 lines)
12. `frontend/src/components/quotes/columnDefs.ts` (~500 lines)
13. `frontend/src/components/quotes/PresetSelector.tsx` (~150 lines)
14. `frontend/src/components/quotes/ColumnConfigModal.tsx` (~200 lines)

### Files to Modify (Existing)

1. `backend/main.py` (+10 lines) - Add routers
2. `backend/services/calculation_service.py` (~50 lines) - Add aggregations
3. `backend/routes/quotes_calc.py` (~30 lines) - Trigger aggregation
4. `frontend/src/app/quotes/page.tsx` (major refactor)

---

## 3. Important Decisions Made

### Decision 1: Aggregate in USD, Not Quote Currency

**Date:** 2025-12-21
**Decision:** All monetary aggregations stored in USD equivalent

**Rationale:**
- Products in same quote can have different currencies (RUB, EUR, USD, TRY, CNY)
- Can't aggregate RUB + EUR + USD meaningfully
- Organization's base currency is USD
- USD equivalents already calculated in calculation engine

**Impact:**
- Simplified aggregation logic
- Consistent reporting across quotes
- Need to ensure USD conversion happens before aggregation

---

### Decision 2: Per-Product Storage for Purchasing Manager

**Date:** 2025-12-21
**Decision:** Store purchasing_manager_id per quote_item (product), not derived from workflow

**Rationale:**
- Each product can have different purchasing manager
- Assignment happens during purchasing phase (sales uploads → purchasing fills)
- Can't derive from workflow state (workflow is quote-level)

**Impact:**
- New column: quote_items.purchasing_manager_id UUID REFERENCES auth.users(id)
- Need UI for purchasing manager assignment per product
- List can show aggregated (LIST of unique managers) or filter

---

### Decision 3: Store Total Quantity and Weight at Quote Level

**Date:** 2025-12-21
**Decision:** Store total_quantity and total_weight_kg in quotes table (aggregated)

**Rationale:**
- Performance: Quotes can have up to 1000 products
- Derived on-the-fly = slow for list views with many quotes
- Recalculated by calculation engine on save

**Impact:**
- New columns: quotes.total_quantity INTEGER, quotes.total_weight_kg DECIMAL(15,3)
- Calculation engine updates these on every save
- Fast list queries

---

### Decision 4: Filters Instead of Derived Columns for Flags

**Date:** 2025-12-21
**Decision:** Use frontend filters instead of storing flag columns

**Original columns considered for storage:**
- Row number (№ строки)
- Week number (№ недели)
- Month number (Номер месяца)
- Today flag (флаг сегодня)
- Week flag (Флаг текущая неделя)
- Month flag (Флаг месяц)
- Revenue size category (Размер выручки)
- Amount thresholds (>50k USD, >1B RUB)

**Rationale:**
- These are all derived from existing date/amount fields
- ag-Grid has powerful filtering built-in
- Storing derived boolean flags is redundant
- Frontend can calculate in column definitions using valueGetter

**Impact:**
- No new columns for these derived flags
- Use ag-Grid valueGetter for derived values
- Use ag-Grid filterParams for threshold filtering

---

### Decision 5: Database Presets (Not LocalStorage)

**Date:** 2025-12-21
**Decision:** Store column presets in database, not browser localStorage

**Options considered:**
1. LocalStorage - Store column state client-side (simple, not shareable)
2. Database presets - Store in DB per user/org (shareable, persistent)
3. Hybrid - LocalStorage + DB sync (complex)

**Rationale:**
- Department presets are org-level (all Sales users see same preset)
- Custom presets can be personal or shared
- Persistent across devices and browsers
- Admins can manage org presets

**Impact:**
- New table: list_presets
- API endpoints for preset CRUD
- More complex than localStorage, but more powerful

---

## 4. Integration Points

### Systems Touched

1. **quotes table**
   - New fields: document_folder_link, executor_user_id, spec_sign_date, total_quantity, total_weight_kg

2. **quote_items table**
   - New fields: production_time_days, product_category, proforma_number, proforma_date, proforma_currency, proforma_amount_excl_vat, proforma_amount_incl_vat, proforma_amount_excl_vat_usd, proforma_amount_incl_vat_usd, purchasing_company_id, supplier_id, purchasing_manager_id

3. **quote_calculation_summaries table**
   - New aggregated fields: calc_supplier_advance_total, calc_purchase_with_vat_usd_total

4. **New tables:**
   - purchasing_companies (id, organization_id, name, country, timestamps)
   - suppliers (id, organization_id, name, country, timestamps)
   - quote_approval_history (id, quote_id, approver_user_id, workflow_state, approved_at, comment)
   - list_presets (id, organization_id, name, preset_type, department, created_by, columns, filters, sort_model, is_default, timestamps)

5. **Calculation engine**
   - Updates to populate aggregated fields (total_quantity, total_weight_kg, supplier_advance_total, purchase_with_vat_usd_total)

6. **Frontend quotes list**
   - Complete redesign from simple table to ag-Grid with preset management

### API Contracts

**GET /api/quotes/list**
- Query params: preset_id, page, page_size, filters, sort
- Returns: quotes array, total count, available columns

**GET /api/list-presets**
- Returns all presets for current user's organization (system + org + personal)

**POST /api/list-presets**
- Create new preset (personal or org-level for admins)

**PUT /api/list-presets/{id}**
- Update preset (own presets or org presets for admins)

**DELETE /api/list-presets/{id}**
- Delete preset (own presets or org presets for admins)

### Database Changes Summary

**4 New Tables:**
- purchasing_companies - Закупочная компания per product
- suppliers - Поставщик per product
- quote_approval_history - Approver per workflow stage
- list_presets - Column configurations

**~10 New Columns in quotes**
**~12 New Columns in quote_items**
**~5 New Columns in quote_calculation_summaries**

### Dependencies

**Backend:**
- None new (using existing FastAPI, Supabase, Pydantic)

**Frontend:**
- ag-Grid Enterprise already installed
- React Query already installed

---

## 5. Known Issues

### Technical Debt to Watch

**Debt 1: Executor User Deprecated**
- **Description:** executor_user_id stored but field is deprecated in current workflow
- **Why Created:** Legacy data from old Excel system
- **Payoff Plan:** Keep for legacy data, don't use in new features
- **Priority:** Low (may remove in future migration)

**Debt 2: Multiple Aggregation Strategies**
- **Description:** Different columns use different aggregation strategies:
  - SUM: quantities, amounts, weights
  - MAX: production_time_days
  - LIST: brands, suppliers, purchasing managers
- **Why Created:** Business requirements vary per column
- **Payoff Plan:** Document clearly in columnDefs.ts with valueGetter logic
- **Priority:** Medium (document during implementation)

---

### Performance Concerns

**Concern 1: 80 Columns in Query**
- **Issue:** Fetching all possible columns would be slow
- **Mitigation:**
  - Fetch only visible columns based on preset
  - Use base query + conditional joins based on requested columns
  - Pre-aggregate expensive calculations in DB

**Concern 2: 1000 Products per Quote**
- **Issue:** Derived aggregations would be slow for list views
- **Mitigation:**
  - Pre-aggregate in calculation engine on save
  - Store aggregated values in quotes table (total_quantity, total_weight_kg)
  - Store aggregated values in quote_calculation_summaries

**Concern 3: List Page Load Time**
- **Target:** <500ms for 1000 quotes
- **Mitigation:**
  - Pagination (50 quotes per page default)
  - ag-Grid virtualization (built-in)
  - Lazy load derived calculations
  - Indexes on frequently filtered columns

---

### Security Considerations

**Security Check 1: RLS for New Tables**
- **Issue:** All 4 new tables need RLS policies
- **Mitigation:** Add RLS policies in migration
- **Status:** To be implemented

**Security Check 2: Preset Access Control**
- **Issue:** Users shouldn't see other orgs' presets
- **Mitigation:**
  - RLS on list_presets table
  - preset_type = 'system' visible to all
  - preset_type = 'org' visible to org members
  - preset_type = 'personal' visible to creator only
- **Status:** To be implemented

**Security Audit:** Will run @security-auditor before merging

---

## 6. Next Steps

### Immediate Actions (This Session)

**Priority 1: Complete Dev-Docs**
- [x] Update context.md with TASK-008 content (this file)
- [ ] Update tasks.md with TASK-008 task breakdown

**Priority 2: Database Migrations**
- [ ] Create migration 052: New tables (purchasing_companies, suppliers, quote_approval_history)
- [ ] Create migration 053: New fields in existing tables
- [ ] Create migration 054: list_presets table
- [ ] Create migration 055: Seed 4 department presets
- [ ] Add RLS policies for all new tables
- [ ] Apply migrations to remote DB

**Priority 3: Calculation Engine Updates**
- [ ] Add total_quantity aggregation on save
- [ ] Add total_weight_kg aggregation on save
- [ ] Add supplier_advance_total aggregation
- [ ] Add purchase_with_vat_usd_total aggregation

---

### Next Session Tasks

**Phase 2: Backend - Preset API (~2 hours)**
- [ ] Create routes/list_presets.py with CRUD endpoints
- [ ] Add permission checks (org isolation, personal vs shared)
- [ ] Write unit tests

**Phase 3: Backend - List Query API (~3 hours)**
- [ ] Create routes/quotes_list.py
- [ ] Implement dynamic column selection
- [ ] Add pagination, filtering, sorting
- [ ] Write unit tests

**Phase 4: Frontend - ag-Grid Setup (~3 hours)**
- [ ] Create column definitions for ~80 columns
- [ ] Implement column grouping by category
- [ ] Add cell renderers and formatters

---

### Blockers

**Current Blockers:** None

**Potential Future Blockers:**
- Complex derived fields may need more DB storage
- Performance with 80 columns (mitigate with preset-based selection)
- ag-Grid Enterprise license (already have)

---

## 7. Context for Autocompact

### Critical Information - Don't Lose This!

**If autocompact happens, you MUST know:**

1. **What we're building:**
   - Universal quote list page with department presets
   - Consolidates 3 Excel files (ЕРПС LITE, Реестр КА, Реестр КП) into one ag-Grid view
   - ~80 columns available, filtered by preset (Sales, Logistics, Accounting, Management)

2. **What's complete:**
   - Column mapping from all 3 Excel files ✅
   - Implementation plan (plan.md) ✅
   - Context document (this file) ✅
   - Mapping document (.claude/reference/list-constructor-mapping.md) ✅

3. **Key decisions made:**
   - Aggregate in USD (not quote currency) - can't mix currencies
   - Store purchasing_manager per product (not derived)
   - Store total_quantity, total_weight_kg at quote level (performance)
   - Use filters for date/amount flags (not stored columns)
   - Store presets in DB (not localStorage)

4. **New DB structures needed:**
   - 4 new tables: purchasing_companies, suppliers, quote_approval_history, list_presets
   - ~10 new columns in quotes
   - ~12 new columns in quote_items
   - ~5 new columns in quote_calculation_summaries

5. **What's next:**
   - Update tasks.md with proper task breakdown
   - Create database migrations (052-055)
   - Implement backend preset API
   - Implement backend list query API
   - Build frontend ag-Grid with preset management

6. **Important files:**
   - Mapping: `.claude/reference/list-constructor-mapping.md`
   - Plan: `dev/active/20251221-TASK-008-*/plan.md`
   - Context: This file
   - Tasks: `dev/active/20251221-TASK-008-*/tasks.md`

---

### Key Column Mapping Reference

**Columns that already exist in DB:**
- quote_number, created_at, customer_name, status, workflow_state
- total_sale_incl_vat, currency, delivery_basis, delivery_time_days
- payment_terms, offer_sale_type (deal type), all 42 calculation variables

**Columns that need new storage:**
- Quote-level: document_folder_link, spec_sign_date, total_quantity, total_weight_kg
- Product-level: production_time_days, product_category, proforma_*, purchasing_company_id, supplier_id, purchasing_manager_id
- Aggregated: calc_supplier_advance_total, calc_purchase_with_vat_usd_total

**Columns derived on-the-fly:**
- Week/month/today flags (from created_at)
- USD equivalents (already calculated)
- Approval status per stage (join quote_approval_history)
- Brand list, supplier list (aggregate from quote_items)

---

### Agent Handoff Instructions

**If another agent takes over:**

1. **Read all 3 dev-docs files first** - plan.md, context.md, tasks.md
2. **Read mapping document** - `.claude/reference/list-constructor-mapping.md`
3. **Check current DB schema** - Use postgres MCP to see existing tables
4. **Start with migrations** - Phase 1 is database schema
5. **Reference plan.md** - Has detailed API contracts and data models

---

**Remember:** This context file is your lifeline after autocompact. Update it as you make progress!
