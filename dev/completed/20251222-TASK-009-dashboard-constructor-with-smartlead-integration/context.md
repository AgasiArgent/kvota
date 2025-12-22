# Dashboard Constructor with SmartLead Integration - Context

**Task ID:** TASK-009
**Last Updated:** 2025-12-22 22:00
**Sessions:** 81-82
**Status:** ✅ COMPLETE (PR #38)

---

## 1. Task Overview

### Quick Summary

Dashboard constructor system for visualizing email outreach campaign results:
1. Pull campaign metrics from SmartLead API (leads, replies, warm leads, applications)
2. Allow manual data entry for campaigns without API access
3. Campaign analytics with grouping by company and expandable rows
4. Conversion rate tracking with configurable formulas
5. Store campaign data in PostgreSQL with RLS

### All Phases Complete

**Planning** [Complete]
**Phase 1: Database & Models** [Complete]
**Phase 2: SmartLead Service** [Complete]
**Phase 3: Dashboard CRUD API** [Complete]
**Phase 4: Campaign Data API** [Complete]
**Phase 5: Frontend - Campaigns Page** [Complete]
**Phase 6: Session 82 Enhancements** [Complete]

### What's Been Completed

**Phase 1: Database & Models (~45 min)**
- ✅ Migration `058_dashboard_constructor.sql` - 317 lines
  - 3 tables: dashboards, dashboard_widgets, campaign_data
  - Full RLS policies for org isolation
  - Indexes and triggers
- ✅ Pydantic models `domain_models/dashboard.py` - 380 lines
- ✅ TypeScript interfaces `types/dashboard.ts` - 280 lines

**Phase 2: SmartLead Integration (~30 min)**
- ✅ SmartLead service `services/smartlead_service.py` - 350 lines
  - Campaign list fetch
  - Analytics + lead stats fetching
  - Retry with exponential backoff
  - 5-min cache TTL

**Phase 3: Dashboard CRUD API (~30 min)**
- ✅ Dashboard router `routes/dashboards.py` - 500 lines
  - Full CRUD for dashboards
  - Widget CRUD within dashboards
  - Bulk widget position updates

**Phase 4: Campaign Data API (~20 min)**
- ✅ Campaign data router `routes/campaign_data.py` - 300 lines
  - Manual entry CRUD
  - SmartLead sync (single + bulk)
  - Aggregated metrics endpoint
- ✅ Routers registered in main.py

### Session 82 Enhancements (2025-12-22)

**Expandable Grouped View:**
- Group campaigns by company prefix (e.g., "phmb-main" → "phmb")
- Click company row to expand/collapse individual campaigns
- Chevron icons (▶/▼) indicate state
- ИТОГО row shows grand totals

**Lead Count Fix:**
- Removed 1000 lead limit (was capping large campaigns)
- Uses SmartLead API's `total_leads` field (authoritative count)
- Fetches all leads for proper category counting

**Column Renaming:**
- Позитив → Теплые (warm leads)
- Встречи → Заявки (applications)
- All % → CR (conversion rate)

**Updated Conversion Formulas:**
- **CR** = Ответов / Лидов (replies / total_leads)
- **Тепл. CR** = Теплые / Ответов (positive / replies)
- **Заяв. CR** = Заявки / Теплые (meetings / positive)

### What's Complete

All phases complete. PR #38 created for merge to main.

---

## 2. Code Inventory

### Files Created (Backend Complete)

**Backend:**
1. ✅ `backend/migrations/058_dashboard_constructor.sql` (317 lines)
2. ✅ `backend/domain_models/dashboard.py` (380 lines)
3. ✅ `backend/services/smartlead_service.py` (350 lines)
4. ✅ `backend/routes/dashboards.py` (500 lines)
5. ✅ `backend/routes/campaign_data.py` (300 lines)
6. ✅ `backend/main.py` - Modified (added router imports)
7. ⏳ `backend/tests/test_dashboards.py` - Pending
8. ⏳ `backend/tests/test_smartlead_service.py` - Pending
9. ⏳ `backend/tests/test_campaign_data.py` - Pending

**Backend Total:** ~1,550 lines created

### Files to Create (Frontend - Phase 5-7)

**Frontend:**
1. ✅ `frontend/src/types/dashboard.ts` (280 lines)
2. ⏳ `frontend/src/components/dashboard/Widget.tsx` (~80 lines)
3. ⏳ `frontend/src/components/dashboard/KPICard.tsx` (~100 lines)
4. ⏳ `frontend/src/components/dashboard/ChartWidget.tsx` (~150 lines)
5. ⏳ `frontend/src/components/dashboard/TableWidget.tsx` (~120 lines)
6. ⏳ `frontend/src/components/dashboard/FilterWidget.tsx` (~100 lines)
7. ⏳ `frontend/src/components/dashboard/DashboardGrid.tsx` (~150 lines)
8. ⏳ `frontend/src/components/dashboard/WidgetPicker.tsx` (~80 lines)
9. ⏳ `frontend/src/components/dashboard/WidgetConfigModal.tsx` (~120 lines)
10. ⏳ `frontend/src/app/dashboards/page.tsx` (~100 lines)
11. ⏳ `frontend/src/app/dashboards/[id]/page.tsx` (~120 lines)
12. ⏳ `frontend/src/app/dashboards/[id]/edit/page.tsx` (~150 lines)
13. ⏳ `frontend/src/app/campaigns/page.tsx` (~100 lines)
14. ⏳ `frontend/src/components/campaigns/CampaignList.tsx` (~100 lines)
15. ⏳ `frontend/src/components/campaigns/ManualCampaignForm.tsx` (~80 lines)
16. ⏳ `frontend/src/lib/api/dashboard-service.ts` (~100 lines)
17. ⏳ `frontend/src/lib/api/campaign-service.ts` (~80 lines)

**Estimated Frontend Remaining:** ~1,350 lines

### Files Modified

1. ✅ `backend/main.py` - Added router imports
2. ⏳ `backend/migrations/MIGRATIONS.md` - Pending migration log

---

## 3. Important Decisions Made

### Decision 1: Modular Widget System Architecture

**Date:** 2025-12-22
**Decision:** Use modular widget system with separate components for each widget type

**Rationale:**
- Each widget type (KPI, Chart, Table, Filter) has distinct rendering needs
- Easier to test individual widgets
- Easy to add new widget types later
- Reusable for kvota metrics in future

**Alternatives Rejected:**
- Simple predefined dashboard (less flexible, harder to extend)
- External tool integration like Metabase (dependency, auth complexity)

---

### Decision 2: Hybrid Data Caching

**Date:** 2025-12-22
**Decision:** Cache SmartLead data in database with manual refresh button

**Rationale:**
- Fast dashboard loads (no API wait)
- User controls when to refresh ("Sync" button)
- Historical data preserved for trends
- Works if SmartLead API is down

**Implementation:**
- `campaign_data` table stores cached metrics
- `synced_at` timestamp shows data freshness
- 5-min cache TTL in service layer
- Manual sync endpoint: POST /api/campaign-data/sync

---

### Decision 3: PostgreSQL for Dashboard Storage

**Date:** 2025-12-22
**Decision:** Store dashboard configs in PostgreSQL (not localStorage)

**Rationale:**
- Persistent across sessions/devices
- Can share dashboards between users later
- Fits existing architecture
- RLS already in place for multi-tenant

---

### Decision 4: react-grid-layout for Drag-Drop

**Date:** 2025-12-22
**Decision:** Use react-grid-layout library for dashboard grid

**Rationale:**
- Well-maintained, 18k stars on GitHub
- Responsive grid layout
- Built-in drag-drop, resize
- React-native (not wrapper)

---

## 4. SmartLead API Reference

### Available Metrics from API

**Email Engagement:**
- `open_count` - Total opens
- `unique_open_count` - Unique opens
- `click_count` - Total clicks
- `unique_click_count` - Unique clicks
- `reply_count` - Direct replies

**Delivery:**
- `sent_count` / `unique_sent_count`
- `bounce_count`
- `unsubscribed_count`

**Lead Status (campaign_lead_stats):**
- `interested` - Positive sentiment leads
- `notStarted` - Awaiting first sequence
- `inprogress` - Active in campaign
- `completed` - Finished or replied
- `blocked`, `paused`, `stopped`
- `total` - Overall count

**Calculated Rates:**
- `open_rate` = unique_open_count / sent_count
- `click_rate` = unique_click_count / sent_count
- `reply_rate` = reply_count / sent_count

### API Endpoints

```
Base URL: https://server.smartlead.ai/api/v1

GET /campaigns?api_key={key}
GET /campaigns/{id}/analytics?api_key={key}
GET /campaigns/{id}/lead-statistics?api_key={key}
GET /campaigns/{id}/statistics?api_key={key}&offset=0&limit=100
```

### API Key Storage

Store in environment variable or `organization_settings` table.

---

## 5. Database Schema Summary

### dashboards
- `id` UUID PK
- `organization_id` UUID FK → organizations
- `name` TEXT
- `description` TEXT
- `layout` JSONB (widget positions)
- `created_by` UUID FK → auth.users
- `created_at`, `updated_at` TIMESTAMPTZ

### dashboard_widgets
- `id` UUID PK
- `dashboard_id` UUID FK → dashboards (CASCADE)
- `widget_type` TEXT ('kpi', 'chart', 'table', 'filter')
- `title` TEXT
- `config` JSONB (widget-specific)
- `data_source` JSONB (what data to show)
- `position` JSONB ({x, y, w, h})
- `created_at` TIMESTAMPTZ

### campaign_data
- `id` UUID PK
- `organization_id` UUID FK → organizations
- `source` TEXT ('smartlead', 'manual')
- `campaign_id` TEXT (SmartLead ID, null for manual)
- `campaign_name` TEXT
- `metrics` JSONB (sent, opened, clicked, etc.)
- `period_start`, `period_end` DATE
- `synced_at`, `created_at` TIMESTAMPTZ

---

## 6. Next Steps

### Immediate Actions (Start Here)

1. **Create migration file:**
   ```
   backend/migrations/058_dashboard_constructor.sql
   ```

2. **Create Pydantic models:**
   ```
   backend/domain_models/dashboard.py
   ```

3. **Create TypeScript interfaces:**
   ```
   frontend/src/types/dashboard.ts
   ```

### Need From User

- SmartLead API key (for testing integration)
- Confirm: Should dashboards be org-scoped or user-scoped?

---

## 7. Context for Autocompact

### Critical Information - Don't Lose This!

**If autocompact happens, you MUST know:**

1. **What we're building:**
   - Dashboard constructor like Yandex DataLens
   - For email campaign metrics from SmartLead
   - 4 widget types: KPI, Chart, Table, Filter
   - Drag-drop grid layout

2. **Architecture decisions:**
   - Hybrid caching (DB + manual refresh)
   - Modular widget components
   - PostgreSQL for dashboard storage
   - react-grid-layout for drag-drop

3. **SmartLead API:**
   - Base: https://server.smartlead.ai/api/v1
   - Key metrics: sent, opened, clicked, replied, bounced
   - Auth via `api_key` query parameter

4. **Dev docs location:**
   - `dev/active/20251222-TASK-009-dashboard-constructor-with-smartlead-integration/`
   - plan.md - Full implementation plan
   - tasks.md - 52 tasks across 9 phases
   - context.md - This file

5. **Current status:**
   - Planning complete
   - Ready to start Phase 1 (Database)
   - Estimated: 10-12 hours total

---

### Questions for User (When Continuing)

1. Do you have a SmartLead API key I can use for testing?
2. Should dashboards be per-organization or per-user?
3. Any specific campaigns you want to start with?

---

**Last Updated:** 2025-12-22 15:30
