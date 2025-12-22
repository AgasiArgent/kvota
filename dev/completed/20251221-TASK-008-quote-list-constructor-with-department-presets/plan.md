# Quote List Constructor with Department Presets - Implementation Plan

**Task ID:** TASK-008
**Created:** 2025-12-21
**Status:** Planning
**Owner:** User + Claude
**Estimated Time:** 15-20 hours
**Last Updated:** 2025-12-21

---

## 1. Objective

### What Problem Are We Solving?

Currently, different departments use separate Excel spreadsheets to track quotes:
- **Sales (ЕРПС LITE)** - 64 columns tracking deals and specifications
- **Accounting (Реестр КА)** - 70 columns for cost analysis
- **Management (Реестр КП)** - 66 columns for quote registry

This creates:
- Data duplication and sync issues
- No single source of truth
- Manual data entry across multiple systems
- Difficulty analyzing cross-department data

### Why Is This Important?

- **Efficiency:** Single interface for all departments
- **Accuracy:** One source of truth, no sync errors
- **Flexibility:** Each department sees relevant columns
- **Analytics:** Cross-department data analysis possible
- **Future-proof:** Foundation for advanced reporting

### Success Criteria (Measurable)

- [ ] Universal quote list page with ag-Grid
- [ ] 4 department presets (Sales, Logistics, Accounting, Management)
- [ ] Users can save/load custom column configurations
- [ ] All mapped columns from 3 Excel files available
- [ ] Presets stored per organization (shareable)
- [ ] Performance: <500ms load for 1000 quotes
- [ ] All new DB fields created and populated
- [ ] RLS verified for multi-tenant isolation

---

## 2. Technical Approach

### Architecture Decisions

**Decision 1: ag-Grid Column State Persistence**

**Options considered:**
1. **LocalStorage** - Store column state client-side
   - Pros: Simple, fast
   - Cons: Not shareable, lost on device change
2. **Database presets** - Store in DB per user/org
   - Pros: Shareable, persistent, org-level defaults
   - Cons: More complex, requires API
3. **Hybrid** - LocalStorage + DB sync
   - Pros: Fast + persistent + shareable
   - Cons: Sync complexity

**Decision:** Option 2 (Database presets)

**Rationale:**
- Department presets need to be org-level (all users see same Sales preset)
- Custom presets can be personal or shared
- ag-Grid state (column order, width, visibility) stored as JSON

---

**Decision 2: Data Fetching Strategy**

**Options considered:**
1. **Single query** - Join all tables, return all columns
   - Pros: Simple
   - Cons: Slow, returns unused data
2. **Dynamic query** - Only fetch visible columns
   - Pros: Optimal performance
   - Cons: Complex query building
3. **Base + derived** - Fetch base data, derive on frontend
   - Pros: Balance of simplicity and performance
   - Cons: Some columns can't be derived

**Decision:** Option 3 (Base + derived)

**Rationale:**
- Fetch quote + customer + calc_summaries (base data)
- Derive simple calculations on frontend (logistics totals, flags)
- Complex aggregations pre-computed in DB

---

### Technologies Used

**Backend:**
- FastAPI endpoint: `GET /api/quotes/list` with column selection
- FastAPI endpoint: `GET/POST/PUT/DELETE /api/list-presets`
- Pydantic models for preset configuration
- Dynamic column selection based on preset

**Frontend:**
- Page: `/app/quotes` (existing, enhanced)
- ag-Grid Enterprise for list display
- Preset selector dropdown
- Column configuration modal
- State persistence via API

**Database Schema:**

```sql
-- List presets (department defaults + custom)
CREATE TABLE list_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    preset_type TEXT CHECK (preset_type IN ('system', 'org', 'personal')),
    department TEXT, -- 'sales', 'logistics', 'accounting', 'management', null for custom
    created_by UUID REFERENCES auth.users(id),
    columns JSONB NOT NULL, -- ag-Grid column state
    filters JSONB, -- saved filters
    sort_model JSONB, -- saved sort
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_list_presets_org ON list_presets(organization_id);
CREATE INDEX idx_list_presets_type ON list_presets(preset_type, department);
```

---

### Integration Points

**Systems Touched:**
1. **quotes table** - Add new fields (total_quantity, total_weight_kg, etc.)
2. **quote_items table** - Add new fields (purchasing_manager_id, proforma_*, etc.)
3. **quote_calculation_summaries** - Add aggregated fields
4. **New tables** - purchasing_companies, suppliers, quote_approval_history, list_presets
5. **Frontend quotes list** - Complete redesign with ag-Grid

**API Contracts:**

**Endpoint:** `GET /api/quotes/list`

**Query params:**
- `preset_id` - UUID of preset to use
- `page`, `page_size` - pagination
- `filters` - JSON encoded filters
- `sort` - JSON encoded sort model

**Response:**
```json
{
  "quotes": [...],
  "total": 1000,
  "page": 1,
  "page_size": 50,
  "columns_available": ["idn_quote", "customer_name", ...]
}
```

**Endpoint:** `GET /api/list-presets`

**Response:**
```json
{
  "presets": [
    {
      "id": "uuid",
      "name": "Sales View",
      "preset_type": "system",
      "department": "sales",
      "is_default": true,
      "columns": {...}
    }
  ]
}
```

---

### Data Models

**Column Definition:**

```typescript
interface ListColumn {
  field: string;           // DB field name or derived key
  headerName: string;      // Display name (Russian)
  source: 'quotes' | 'customers' | 'calc_summaries' | 'quote_items' | 'derived';
  aggregation?: 'sum' | 'max' | 'count' | 'list'; // for per-product fields
  derivedFormula?: string; // for calculated columns
  visible: boolean;
  width?: number;
  pinned?: 'left' | 'right';
}
```

**Preset Model:**

```python
class ListPreset(BaseModel):
    id: Optional[UUID]
    name: str
    preset_type: Literal['system', 'org', 'personal']
    department: Optional[str]
    columns: List[ColumnConfig]
    filters: Optional[Dict]
    sort_model: Optional[List[Dict]]
    is_default: bool = False
```

---

## 3. Implementation Plan

### Phase 1: Database Schema (2 hours)

**Tasks:**
- [ ] Create migration for new tables (purchasing_companies, suppliers, quote_approval_history)
- [ ] Create migration for quotes table new fields
- [ ] Create migration for quote_items new fields
- [ ] Create migration for quote_calculation_summaries new fields
- [ ] Create migration for list_presets table
- [ ] Add RLS policies for all new tables
- [ ] Seed 4 system presets (Sales, Logistics, Accounting, Management)

**Dependencies:** None

**Files:**
- `backend/migrations/052_list_constructor_tables.sql`
- `backend/migrations/053_list_presets.sql`
- `backend/migrations/054_seed_department_presets.sql`

---

### Phase 2: Backend - Preset API (2 hours)

**Tasks:**
- [ ] Create `routes/list_presets.py`
- [ ] Implement CRUD endpoints for presets
- [ ] Add permission checks (org isolation, personal vs shared)
- [ ] Add validation for column configurations
- [ ] Write unit tests

**Dependencies:** Phase 1

**Files:**
- `backend/routes/list_presets.py` (new, ~200 lines)
- `backend/tests/test_list_presets.py` (new, ~150 lines)

---

### Phase 3: Backend - List Query API (3 hours)

**Tasks:**
- [ ] Create `routes/quotes_list.py`
- [ ] Implement dynamic column selection
- [ ] Add joins based on requested columns
- [ ] Implement derived field calculations
- [ ] Add pagination, filtering, sorting
- [ ] Optimize queries for performance
- [ ] Write unit tests

**Dependencies:** Phase 1, Phase 2

**Files:**
- `backend/routes/quotes_list.py` (new, ~400 lines)
- `backend/services/list_query_builder.py` (new, ~300 lines)
- `backend/tests/test_quotes_list.py` (new, ~200 lines)

---

### Phase 4: Frontend - ag-Grid Setup (3 hours)

**Tasks:**
- [ ] Create column definitions for all mapped fields (~80 columns)
- [ ] Implement column grouping by category
- [ ] Add cell renderers (currency, date, status badges)
- [ ] Add cell editors where applicable
- [ ] Implement Russian localization
- [ ] Add export functionality (CSV, Excel)

**Dependencies:** Phase 3

**Files:**
- `frontend/src/app/quotes/list/page.tsx` (new)
- `frontend/src/components/quotes/ListGrid.tsx` (new, ~300 lines)
- `frontend/src/components/quotes/columnDefs.ts` (new, ~500 lines)

---

### Phase 5: Frontend - Preset Management (2 hours)

**Tasks:**
- [ ] Create preset selector dropdown
- [ ] Create "Save as preset" modal
- [ ] Create "Manage presets" page
- [ ] Implement preset switching
- [ ] Add column configuration sidebar
- [ ] Persist user's last preset preference

**Dependencies:** Phase 4

**Files:**
- `frontend/src/components/quotes/PresetSelector.tsx` (new)
- `frontend/src/components/quotes/ColumnConfigModal.tsx` (new)
- `frontend/src/app/settings/list-presets/page.tsx` (new)

---

### Phase 6: Calculation Engine Updates (2 hours)

**Tasks:**
- [ ] Update calculation engine to populate new aggregated fields
- [ ] Add total_quantity and total_weight_kg calculation
- [ ] Add supplier_advance_total calculation
- [ ] Add purchase_with_vat_usd_total calculation
- [ ] Update quote save to trigger recalculation

**Dependencies:** Phase 1

**Files:**
- `backend/services/calculation_service.py` (modify)
- `backend/routes/quotes_calc.py` (modify)

---

### Phase 7: Testing & QA (2 hours)

**Tasks:**
- [ ] Run all backend tests
- [ ] Run all frontend tests
- [ ] E2E test: Load quotes list with Sales preset
- [ ] E2E test: Switch between presets
- [ ] E2E test: Save custom preset
- [ ] Performance test: 1000 quotes <500ms
- [ ] RLS test: Org isolation verified
- [ ] Call @orchestrator for quality checks

**Dependencies:** All phases complete

---

### Phase 8: Documentation & Deployment (1 hour)

**Tasks:**
- [ ] Update `.claude/SESSION_PROGRESS.md`
- [ ] Update `.claude/reference/list-constructor-mapping.md` with final status
- [ ] Add user documentation for preset management
- [ ] Commit with descriptive message
- [ ] Create PR

**Dependencies:** Phase 7

---

## 4. Risks & Mitigation

### Technical Risks

**Risk 1: Performance with many columns**
- **Description:** 80+ columns may slow down rendering
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Use ag-Grid virtualization (built-in)
  - Only fetch visible columns from API
  - Lazy load derived calculations

**Risk 2: Complex derived fields**
- **Description:** Some derived fields require multiple table joins
- **Probability:** Medium
- **Impact:** Low
- **Mitigation:**
  - Pre-compute in calculation engine
  - Store aggregated values in DB
  - Simple derivations only on frontend

**Risk 3: Preset migration**
- **Description:** Column names change, presets become invalid
- **Probability:** Low
- **Impact:** High
- **Mitigation:**
  - Version presets schema
  - Migration script to update old presets
  - Fallback to default if preset invalid

---

## 5. Testing Strategy

### Backend Tests

**Preset API:**
- CRUD operations for presets
- Permission checks (org isolation)
- Default preset logic

**List Query API:**
- Column selection works correctly
- Joins added based on columns
- Derived fields calculated
- Pagination, sorting, filtering

### Frontend Tests

**ag-Grid:**
- Renders with correct columns
- Preset switching works
- Column configuration persists

**E2E Tests:**
- Full flow: Load → Switch preset → Save custom → Reload

---

## 6. References

### Mapping Document

- `.claude/reference/list-constructor-mapping.md` - Complete column mapping

### Skills

- `.claude/skills/frontend-dev-guidelines/` - ag-Grid patterns
- `.claude/skills/backend-dev-guidelines/` - FastAPI patterns
- `.claude/skills/database-verification/` - RLS checklist

### External

- [ag-Grid Column Definitions](https://www.ag-grid.com/react-data-grid/column-definitions/)
- [ag-Grid State Persistence](https://www.ag-grid.com/react-data-grid/grid-state/)

---

## 7. Post-Implementation Notes

### Decisions Made During Implementation

[Update as implementation progresses]

### Follow-Up Tasks

- [ ] Add preset sharing between users
- [ ] Add preset templates library
- [ ] Add scheduled exports from presets
- [ ] Add preset-based notifications (e.g., "New quotes in Sales view")

---

**Remember:** This plan is a living document. Update it as you learn more during implementation.
