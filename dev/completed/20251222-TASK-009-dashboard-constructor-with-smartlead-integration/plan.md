# Dashboard Constructor with SmartLead Integration - Implementation Plan

**Task ID:** TASK-009
**Created:** 2025-12-22
**Status:** Planning
**Owner:** User + Agents
**Estimated Time:** 8-12 hours
**Last Updated:** 2025-12-22

---

## 1. Objective

### What Problem Are We Solving?

Need a flexible dashboard system to visualize email outreach campaign results. Currently:
- Campaign data lives in SmartLead with no unified view
- Manual tracking requires spreadsheets
- No way to compare campaign performance or see aggregated metrics
- Future need: extend to kvota business metrics

### Why Is This Important?

- **Visibility:** See campaign performance at a glance
- **Decision-making:** Compare campaigns, identify what works
- **Flexibility:** Constructor approach allows any metric/visualization
- **Reusability:** Same system can display kvota metrics later

### Success Criteria (Measurable)

- [ ] Dashboard constructor UI with drag-and-drop widget placement
- [ ] 4 widget types: KPI Card, Chart (line/bar/pie), Table, Filter
- [ ] SmartLead API integration (fetch campaigns, metrics)
- [ ] Manual data entry for campaigns without API access
- [ ] Save/load dashboard configurations
- [ ] Aggregate view across multiple campaigns
- [ ] Individual campaign drill-down
- [ ] All tests pass (unit + integration)
- [ ] Responsive design (desktop + tablet)

---

## 2. Technical Approach

### Architecture Decisions

**Decision 1: Data Architecture**

**Options considered:**
1. **Live API calls:** Fetch from SmartLead on every dashboard load
   - Pros: Always fresh data
   - Cons: Slow, API rate limits, offline doesn't work
2. **Cached/synced data:** Periodic sync to local DB
   - Pros: Fast, offline works, historical data preserved
   - Cons: Data might be stale (5-15 min delay)
3. **Hybrid:** Cache with manual refresh button
   - Pros: Fast + user can force refresh
   - Cons: More complex

**Decision:** Hybrid (cached with manual refresh)

**Rationale:**
- Dashboard loads fast from cached data
- User can click "Refresh" to get latest
- Historical data preserved for trends
- Works offline with cached data

---

**Decision 2: Dashboard Storage**

**Options considered:**
1. **localStorage:** Store dashboard config in browser
   - Pros: Simple, no backend changes
   - Cons: Lost if browser cleared, not shared across devices
2. **Database:** Store in PostgreSQL
   - Pros: Persistent, shared, multi-user
   - Cons: More backend work
3. **JSON files:** Store as files
   - Pros: Simple
   - Cons: Not scalable

**Decision:** Database (PostgreSQL)

**Rationale:**
- Dashboards should persist across sessions
- Can share dashboards between users later
- Fits existing architecture
- RLS already in place

---

**Decision 3: Widget Component Architecture**

**Options considered:**
1. **Single widget component:** One component handles all types
   - Pros: Simpler imports
   - Cons: Complex, hard to maintain
2. **Separate components:** KPICard, Chart, Table, Filter
   - Pros: Clean separation, easier to test
   - Cons: More files
3. **Headless + rendering:** Separate data logic from presentation
   - Pros: Very flexible
   - Cons: Over-engineered for current needs

**Decision:** Separate components with shared base

**Rationale:**
- Each widget type has distinct rendering needs
- Shared base handles common functionality (title, loading, error)
- Easy to add new widget types later

---

### Technologies Used

**Backend:**
- FastAPI routes: `/api/dashboards/*`, `/api/campaigns/*`
- Pydantic models: Dashboard, Widget, Campaign, CampaignMetrics
- SmartLead integration: `services/smartlead_service.py`
- Database: 3 new tables (dashboards, widgets, campaign_data)

**Frontend:**
- Pages: `/app/dashboards/*` (Next.js 15)
- Components: Dashboard constructor, Widget library
- Charting: Recharts (already in project) or Chart.js
- Grid: react-grid-layout for drag-and-drop
- State: React Query for caching

**Database Schema:**

```sql
-- Dashboard configurations
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  layout JSONB NOT NULL DEFAULT '[]', -- widget positions
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Widget configurations within dashboards
CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- 'kpi', 'chart', 'table', 'filter'
  title TEXT NOT NULL,
  config JSONB NOT NULL, -- widget-specific settings
  data_source JSONB NOT NULL, -- where to get data
  position JSONB NOT NULL, -- {x, y, w, h}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cached campaign data from SmartLead + manual entries
CREATE TABLE campaign_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  source TEXT NOT NULL, -- 'smartlead' or 'manual'
  campaign_id TEXT, -- SmartLead campaign ID (null for manual)
  campaign_name TEXT NOT NULL,
  metrics JSONB NOT NULL, -- {sent, opened, clicked, replied, etc.}
  period_start DATE,
  period_end DATE,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dashboards_org ON dashboards(organization_id);
CREATE INDEX idx_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX idx_campaign_data_org ON campaign_data(organization_id);
CREATE INDEX idx_campaign_data_source ON campaign_data(source, organization_id);
```

---

### Integration Points

**Systems Touched:**
1. **SmartLead API** - External API for campaign metrics
2. **Database** - 3 new tables with RLS
3. **Frontend routing** - New `/dashboards` section
4. **Auth** - Reuse existing auth for API key storage

**SmartLead API Endpoints Used:**

```
GET /api/v1/campaigns - List all campaigns
GET /api/v1/campaigns/{id}/analytics - Campaign metrics
GET /api/v1/campaigns/{id}/lead-statistics - Lead breakdown
```

**API Key Storage:**
- Store SmartLead API key in `organization_settings` table
- Or environment variable for single-org setup

---

### Data Models

**Pydantic Models (Backend):**

```python
class WidgetType(str, Enum):
    KPI = "kpi"
    CHART = "chart"
    TABLE = "table"
    FILTER = "filter"

class ChartType(str, Enum):
    LINE = "line"
    BAR = "bar"
    PIE = "pie"

class DataSource(BaseModel):
    type: str  # 'smartlead', 'manual', 'aggregate'
    campaign_ids: Optional[List[str]] = None
    metric: str  # 'sent', 'opened', 'replied', etc.
    aggregation: Optional[str] = None  # 'sum', 'avg', 'max'

class WidgetConfig(BaseModel):
    widget_type: WidgetType
    title: str
    data_source: DataSource
    config: Dict[str, Any]  # type-specific config
    position: Dict[str, int]  # {x, y, w, h}

class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    widgets: List[WidgetConfig] = []

class CampaignMetrics(BaseModel):
    sent_count: int
    open_count: int
    unique_open_count: int
    click_count: int
    reply_count: int
    bounce_count: int
    unsubscribed_count: int
    interested_count: int
    # Calculated rates
    open_rate: float
    click_rate: float
    reply_rate: float
```

**TypeScript Interfaces (Frontend):**

```typescript
interface Widget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'filter';
  title: string;
  dataSource: DataSource;
  config: WidgetConfig;
  position: { x: number; y: number; w: number; h: number };
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
}

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}
```

---

## 3. Implementation Plan

### Phase 1: Database & Models (1 hour)

**Tasks:**
- [ ] Create migration for dashboards, widgets, campaign_data tables
- [ ] Add RLS policies (organization isolation)
- [ ] Create Pydantic models for all entities
- [ ] Create TypeScript interfaces
- [ ] Test migration locally

**Files:**
- `backend/migrations/058_dashboard_constructor.sql` (new)
- `backend/domain_models/dashboard.py` (new)
- `frontend/src/types/dashboard.ts` (new)

---

### Phase 2: SmartLead Integration (1.5 hours)

**Tasks:**
- [ ] Create SmartLead API client service
- [ ] Implement campaign list fetch
- [ ] Implement campaign metrics fetch
- [ ] Add error handling (rate limits, auth errors)
- [ ] Add caching layer (5-min TTL)
- [ ] Write unit tests for service
- [ ] Add API key configuration endpoint

**Files:**
- `backend/services/smartlead_service.py` (new, ~200 lines)
- `backend/routes/campaigns.py` (new, ~150 lines)
- `backend/tests/test_smartlead_service.py` (new)

---

### Phase 3: Dashboard CRUD API (1.5 hours)

**Tasks:**
- [ ] Create dashboard router with CRUD endpoints
- [ ] GET /api/dashboards - List user's dashboards
- [ ] POST /api/dashboards - Create dashboard
- [ ] GET /api/dashboards/{id} - Get dashboard with widgets
- [ ] PUT /api/dashboards/{id} - Update dashboard
- [ ] DELETE /api/dashboards/{id} - Delete dashboard
- [ ] Add widget management endpoints
- [ ] Write API tests

**Files:**
- `backend/routes/dashboards.py` (new, ~250 lines)
- `backend/tests/test_dashboards.py` (new)
- `backend/main.py` (add routers)

---

### Phase 4: Manual Data Entry API (1 hour)

**Tasks:**
- [ ] POST /api/campaign-data - Add manual campaign data
- [ ] PUT /api/campaign-data/{id} - Update manual entry
- [ ] DELETE /api/campaign-data/{id} - Delete entry
- [ ] GET /api/campaign-data - List all (SmartLead + manual)
- [ ] Sync endpoint to refresh SmartLead data
- [ ] Write tests

**Files:**
- `backend/routes/campaign_data.py` (new, ~150 lines)
- `backend/tests/test_campaign_data.py` (new)

---

### Phase 5: Frontend - Widget Components (2 hours)

**Tasks:**
- [ ] Install react-grid-layout for drag-drop
- [ ] Create base Widget component (loading, error, title)
- [ ] Create KPICard widget (single metric display)
- [ ] Create Chart widget (line/bar/pie with Recharts)
- [ ] Create Table widget (ag-Grid or simple table)
- [ ] Create Filter widget (date range, campaign selector)
- [ ] Style all widgets (shadcn/Tailwind)
- [ ] Write component tests

**Files:**
- `frontend/src/components/dashboard/Widget.tsx` (new)
- `frontend/src/components/dashboard/KPICard.tsx` (new)
- `frontend/src/components/dashboard/ChartWidget.tsx` (new)
- `frontend/src/components/dashboard/TableWidget.tsx` (new)
- `frontend/src/components/dashboard/FilterWidget.tsx` (new)
- `frontend/src/components/dashboard/index.ts` (exports)

---

### Phase 6: Frontend - Dashboard Constructor (2 hours)

**Tasks:**
- [ ] Create dashboard list page (/dashboards)
- [ ] Create dashboard view page (/dashboards/[id])
- [ ] Create dashboard edit page (/dashboards/[id]/edit)
- [ ] Implement drag-drop grid with react-grid-layout
- [ ] Add widget picker sidebar
- [ ] Add widget configuration modal
- [ ] Implement save/load functionality
- [ ] Add "Add Dashboard" flow
- [ ] Connect to API with React Query

**Files:**
- `frontend/src/app/dashboards/page.tsx` (new)
- `frontend/src/app/dashboards/[id]/page.tsx` (new)
- `frontend/src/app/dashboards/[id]/edit/page.tsx` (new)
- `frontend/src/components/dashboard/DashboardGrid.tsx` (new)
- `frontend/src/components/dashboard/WidgetPicker.tsx` (new)
- `frontend/src/components/dashboard/WidgetConfigModal.tsx` (new)
- `frontend/src/lib/api/dashboard-service.ts` (new)

---

### Phase 7: Campaign Management UI (1 hour)

**Tasks:**
- [ ] Create campaigns list page (/campaigns)
- [ ] Show SmartLead campaigns with sync status
- [ ] Add manual campaign entry form
- [ ] Add "Refresh from SmartLead" button
- [ ] Show campaign metrics in expandable row
- [ ] Connect to API

**Files:**
- `frontend/src/app/campaigns/page.tsx` (new)
- `frontend/src/components/campaigns/CampaignList.tsx` (new)
- `frontend/src/components/campaigns/ManualCampaignForm.tsx` (new)
- `frontend/src/lib/api/campaign-service.ts` (new)

---

### Phase 8: Testing & Polish (1 hour)

**Tasks:**
- [ ] Run all backend tests
- [ ] Run frontend lint and type-check
- [ ] E2E test: Create dashboard with widgets
- [ ] E2E test: SmartLead sync flow
- [ ] E2E test: Manual data entry
- [ ] Fix any UI/UX issues
- [ ] Add loading states and error boundaries

---

### Phase 9: Documentation & Deployment (30 min)

**Tasks:**
- [ ] Update SESSION_PROGRESS.md
- [ ] Add dashboard docs to CLAUDE.md
- [ ] Commit with descriptive message
- [ ] Create PR

---

## 4. Risks & Mitigation

### Technical Risks

**Risk 1: SmartLead API Rate Limits**
- **Probability:** Medium
- **Impact:** Medium (sync fails)
- **Mitigation:**
  - Cache data aggressively (5-min minimum)
  - Batch requests where possible
  - Exponential backoff on failures
  - Show "last synced" timestamp

**Risk 2: Complex Widget Interactions**
- **Probability:** Medium
- **Impact:** Low (UX issue)
- **Mitigation:**
  - Start with simple widgets
  - Add cross-widget filtering in v2
  - Keep initial scope limited

**Risk 3: Performance with Many Widgets**
- **Probability:** Low
- **Impact:** Medium (slow dashboard)
- **Mitigation:**
  - Lazy load widget data
  - Virtualize large tables
  - Limit widgets per dashboard (12 max)

---

## 5. Testing Strategy

### Backend Tests

**SmartLead Service:**
- `test_fetch_campaigns_success`
- `test_fetch_campaigns_auth_error`
- `test_fetch_metrics_success`
- `test_cache_hit_returns_cached`
- `test_rate_limit_handling`

**Dashboard API:**
- `test_create_dashboard`
- `test_update_dashboard_layout`
- `test_delete_dashboard`
- `test_rls_prevents_cross_org_access`

**Campaign Data API:**
- `test_create_manual_entry`
- `test_sync_from_smartlead`
- `test_aggregate_metrics`

### Frontend Tests

**Widget Components:**
- `KPICard renders value correctly`
- `ChartWidget renders correct chart type`
- `TableWidget handles pagination`

**Dashboard Constructor:**
- `Can add widget via drag-drop`
- `Can configure widget`
- `Saves layout on change`

---

## 6. Rollback Plan

**If Dashboard System Fails:**
1. Feature is additive - doesn't affect existing kvota features
2. Can disable via feature flag
3. No migration rollback needed (new tables only)

**SmartLead Integration Issues:**
1. Manual data entry still works
2. Can retry sync later
3. Cached data remains available

---

## 7. References

### SmartLead API Documentation
- [Full API Docs](https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation)
- [Campaign Analytics API](https://api.smartlead.ai/reference/fetch-campaign-top-level-analytics)
- [Lead Statistics API](https://api.smartlead.ai/reference/lead-statistics)
- [Replicate UI Analytics](https://helpcenter.smartlead.ai/en/articles/122-how-to-replicate-the-ui-campaign-analytics-using-the-api)

### Internal Skills
- `.claude/skills/frontend-dev-guidelines/` - React patterns
- `.claude/skills/backend-dev-guidelines/` - FastAPI patterns
- `.claude/skills/database-verification/` - RLS policies

### Libraries
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) - Drag-drop grid
- [Recharts](https://recharts.org/) - Charts (already in project)
- [React Query](https://tanstack.com/query) - Data fetching

---

## 8. Post-Implementation Notes

### Decisions Made During Implementation

[To be updated during implementation]

### Future Enhancements (v2)

- [ ] Cross-widget filtering (filter widget affects others)
- [ ] Dashboard sharing between users
- [ ] Scheduled email reports
- [ ] More data sources (Mailchimp, SendGrid)
- [ ] Custom metric calculations
- [ ] Dashboard templates

---

**Remember:** This plan is a living document. Update it as you learn more during implementation.
