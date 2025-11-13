# CRM Implementation Plan - Comprehensive Evaluation

**Project:** B2B Quotation Platform (kvota)  
**Branch:** feature/q1-crm-module  
**Evaluation Date:** 2025-11-13  
**Status:** READY TO IMPLEMENT with architectural refinements

---

## EXECUTIVE SUMMARY

The CRM implementation plan is **technically sound and well-aligned with existing patterns**. However, there are critical refinements needed before execution:

1. **Database design**: Lead-to-customer conversion workflow needs clearer definition
2. **Security model**: Lead assignment & ownership requires explicit RLS policies
3. **Integration points**: Quote→Lead relationship not addressed in plan
4. **UI/UX**: Kanban stage transitions need confirmation of business logic
5. **Testing strategy**: Activity log integration needs verification

**Estimated Implementation Time:** 25-30 hours (80% backend, 20% frontend)

---

## 1. COMPLETENESS ANALYSIS

### ✅ INCLUDED & SOLID

| Requirement | Status | Notes |
|---|---|---|
| Lead CRUD operations | ✅ Complete | Pattern matches customers.py exactly |
| Lead stages (customizable) | ✅ Complete | Well-designed with order & color fields |
| Activities CRUD | ✅ Complete | Follows activity_logs.py pattern |
| Organization isolation (RLS) | ✅ Complete | Multi-tenant foundation exists |
| Role-based access | ✅ Complete | Permission system in place |
| Activity logging integration | ✅ Complete | Log decorator pattern ready to use |

### ⚠️ MISSING OR UNCLEAR

| Requirement | Gap | Severity | Recommendation |
|---|---|---|---|
| Lead ownership model | No `assigned_to` field in plan | **HIGH** | Add `assigned_to UUID` + RLS policy |
| Lead→Customer conversion | Process unclear | **HIGH** | Define data mapping strategy |
| Activity types for CRM | Only lists "calls/meetings/tasks" | **MEDIUM** | Add enum like `LeadActivityType` |
| Lead merge/duplicate handling | Not mentioned | **MEDIUM** | Document policy (allow/prevent) |
| Lead scoring/pipeline stages | No data model | **MEDIUM** | Add custom fields support later |
| Export functionality | Not included | **LOW** | Add in Phase 4 (with quote exports) |

### ❌ CRITICAL GAPS (MUST FIX)

#### 1. Lead→Customer Conversion Service

**Current plan:** "Service: Lead qualification service (copy data to customers table)"

**Problem:** No implementation details for conversion workflow

**Solution needed:**
```python
# backend/services/lead_qualification_service.py
async def convert_lead_to_customer(
    lead_id: UUID,
    organization_id: UUID,
    user: User
) -> Customer:
    """
    Convert qualified lead to customer with data mapping
    
    Required mapping:
    lead.name → customer.name
    lead.phone → customer.phone (primary contact)
    lead.email → customer.email (primary contact)
    lead.company → customer.company (needs new field)
    lead.inn → customer.inn
    lead.source → customer.notes (prepend "Source: {source}")
    
    Creates:
    - New customer record
    - Primary contact from lead info
    - Activity log entry
    - Soft-deletes lead (mark converted_at timestamp)
    """
```

#### 2. Lead Assignment & Access Control

**Current plan:** `assigned_to` field mentioned but no RLS policy

**Problem:** Cannot restrict lead access per assignee without explicit policy

**Solution needed in Migration 027:**
```sql
-- Table change
ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES auth.users(id);

-- RLS Policy for assignee access
CREATE POLICY "Users can view assigned leads" ON leads
FOR SELECT USING (
    assigned_to = auth.uid()
    OR organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role_id IN (
            SELECT role_id FROM roles WHERE slug IN ('admin', 'manager', 'owner')
        )
    )
);
```

#### 3. Activity Integration - CRM Activities vs System Activities

**Current plan:** Separate activities table

**Problem:** How do CRM activities relate to system activity logs?

**Questions to resolve:**
- Should CRM "call" activity create a system activity log entry? (YES - use decorator)
- Should lead_id appear in system activity logs? (YES - new entity_id)
- Query: Can we join activities table with activity_logs table? (NO - separate purposes)

**Solution:** Add entity_type to activity_logs for "lead" (already supported by design)

---

## 2. TECHNICAL FEASIBILITY ANALYSIS

### Architecture Integration ✅

**Database patterns:** FULLY COMPATIBLE
```
leads table structure → customers table (same design)
├─ UUID primary key ✅
├─ organization_id (multi-tenant) ✅
├─ RLS policies ✅
├─ Timestamps + soft delete ✅
└─ Indexes for performance ✅
```

**Backend route patterns:** FULLY COMPATIBLE
```
customers.py → leads.py (copy structure)
├─ List with pagination ✅
├─ CRUD with permission checks ✅
├─ Search/filter functionality ✅
├─ Organization isolation ✅
└─ Activity logging ✅
```

**Frontend structure:** NEEDS WORK

Current directory structure:
```
frontend/src/app/
├─ quotes/              ✅ (exists)
├─ customers/          ✅ (exists)
├─ crm/                ❌ (doesn't exist - plan mentions it)
```

The plan suggests: `frontend/src/modules/crm/`

**Recommendation:** Use `frontend/src/app/crm/` (not modules) to match existing pattern:
```
frontend/src/app/crm/
├─ page.tsx                   # Dashboard/overview
├─ leads/
│  ├─ page.tsx               # List view
│  ├─ create/page.tsx        # Create form
│  ├─ [id]/
│  │  ├─ page.tsx            # Detail/timeline
│  │  └─ activities/page.tsx # Activity list
│  └─ pipeline/page.tsx      # Kanban view (optional Phase 2)
└─ stages/
   └─ page.tsx               # Stage management (admin)
```

### Calculation Engine Compatibility ✅

**Good news:** Leads are customer acquisition, not transaction processing
- No impact on calculation_engine_guidelines
- No impact on quote calculation
- No business rule conflicts

### Navigation Integration ✅

**MainLayout.tsx current menu structure:**
```typescript
baseItems = [
  { Dashboard },
  { Quotes (with submenu) },
  { Customers },        ← CRM goes near here
  { Organizations },
  { Activity },
]
```

**Recommended addition:**
```typescript
{
  key: 'crm-menu',
  icon: <PhoneOutlined />,  // Or <TeamOutlined /> if different icon
  label: 'CRM',
  children: [
    { key: '/crm/leads', label: 'Лиды' },
    { key: '/crm/pipeline', label: 'Воронка', visible: isSalesRole },
    { key: '/crm/stages', label: 'Этапы', visible: isAdmin }
  ]
}
```

---

## 3. SECURITY & MULTI-TENANT ANALYSIS

### ✅ RLS Architecture - SOLID

The plan correctly implements organization-based isolation:
```sql
CREATE POLICY "Users can view leads in their organization"
    ON leads FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );
```

### ⚠️ OWNERSHIP MODEL - NEEDS REFINEMENT

**Current design:** Lead assigned to user via `assigned_to` field

**Security risk:** Manager should see all leads, not just assigned ones

**Proposed RLS policy (better):**
```sql
CREATE POLICY "Sales can view their assigned leads" ON leads
FOR SELECT USING (
    -- Sales team members see only their leads
    (
        assigned_to = auth.uid()
        AND auth.jwt() ->> 'role' NOT IN ('admin', 'manager', 'owner')
    )
    OR
    -- Managers/admins see all leads in org
    (
        organization_id IN (
            SELECT organization_id FROM organization_members om
            JOIN roles r ON om.role_id = r.id
            WHERE om.user_id = auth.uid()
            AND r.slug IN ('admin', 'manager', 'owner')
            AND om.status = 'active'
        )
    )
);
```

### ✅ Activity Logging - COMPATIBLE

Existing activity_logs.py decorator pattern works:
```python
@log_activity_decorator("lead", "created")
async def create_lead(...):
    # Auto-logged with entity_type="lead", action="created"
```

---

## 4. INTEGRATION POINTS ANALYSIS

### Current Flow: Quote Creation
```
Customer → Quote → Quote Items → Calculation → Approval
```

### Proposed CRM Flow:
```
Lead → [Qualify] → Customer → Quote → ... (same as above)
```

### Integration Points (Implementation Order)

**Phase 1: Core CRM**
1. Lead CRUD (`backend/routes/leads.py`)
2. Lead stages management (`backend/routes/lead_stages.py`)
3. Activities CRUD (`backend/routes/activities.py`)
4. Backend migration (Migration 027)

**Phase 2: Lead→Customer Conversion**
1. Qualification service (`backend/services/lead_qualification_service.py`)
2. `/api/leads/{lead_id}/qualify` endpoint
3. Triggers: Create customer, create contact, create activity log, soft-delete lead

**Phase 3: Frontend UI**
1. Leads list page (simple table)
2. Lead detail page (with activities timeline)
3. Quick create button in main menu

**Phase 4: Advanced Features** (Q2 scope)
1. Kanban pipeline view
2. Lead scoring
3. Bulk actions
4. Email integration
5. Lead merging

---

## 5. TECHNICAL IMPLEMENTATION PATTERNS

### Backend Route Pattern (Copy from customers.py)

**File:** `backend/routes/leads.py`

Key structure points:
```python
# 1. Router setup (same as customers.py)
router = APIRouter(
    prefix="/api/leads",
    tags=["leads"],
    dependencies=[Depends(get_current_user)]
)

# 2. Database helper (same as customers.py)
async def get_db_connection():
    # Existing pattern in customers.py line 37-45

# 3. CRUD operations
@router.get("/")                    # List with pagination
@router.post("/")                   # Create
@router.get("/{lead_id}")           # Detail
@router.put("/{lead_id}")           # Update
@router.delete("/{lead_id}")        # Delete (soft)

# 4. Business operations
@router.post("/{lead_id}/qualify")  # Convert to customer
@router.post("/{lead_id}/activities")  # Add activity
```

### Database Migrations Required

**Migration 027: Create CRM Tables**

Three tables needed:
```sql
-- 1. leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Lead info
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(100),
    company VARCHAR(255),
    position VARCHAR(100),
    
    -- Lead qualification
    inn VARCHAR(12),           -- Optional, for Russian businesses
    source VARCHAR(100),       -- Website, Cold call, Referral, etc.
    status VARCHAR(50) DEFAULT 'new',  -- new, contacted, qualified, converted
    assigned_to UUID REFERENCES auth.users(id),
    
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    qualified_at TIMESTAMPTZ,
    converted_to_customer_id UUID REFERENCES customers(id),
    converted_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES auth.users(id)
);

-- 2. lead_stages table (customizable pipeline stages)
CREATE TABLE lead_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_qualified BOOLEAN DEFAULT FALSE,  -- True for final stage
    order_index INT NOT NULL,
    color VARCHAR(7),  -- Hex color for UI
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (organization_id, name)
);

-- 3. lead_activities table (calls, meetings, tasks)
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL,  -- call, meeting, email, task, note
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    due_date DATE,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Add indexes and RLS policies...
```

### Pydantic Models Required

**File:** `backend/models.py` (extend)

```python
class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    CONVERTED = "converted"

class LeadActivityType(str, Enum):
    CALL = "call"
    MEETING = "meeting"
    EMAIL = "email"
    TASK = "task"
    NOTE = "note"

class LeadBase(BaseModel):
    name: str
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]
    position: Optional[str]
    inn: Optional[str]
    source: Optional[str]
    assigned_to: Optional[UUID]
    status: LeadStatus = LeadStatus.NEW

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    # ... (all fields optional)
    status: Optional[LeadStatus] = None
    assigned_to: Optional[UUID] = None

class Lead(LeadBase):
    id: UUID
    organization_id: UUID
    qualified_at: Optional[datetime]
    converted_to_customer_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

---

## 6. POTENTIAL ISSUES & MITIGATION

### Issue 1: Lead Deduplication
**Problem:** Multiple leads for same company/email
**Mitigation:** 
- Add unique constraint on (organization_id, email) per org
- Provide "Merge leads" UI button (Phase 4)
- Consider fuzzy matching (Phase 5)

### Issue 2: Lead→Customer Field Mapping
**Problem:** Lead has extra fields (source, stage) that don't exist in customers
**Mitigation:**
- Store source in customer.notes as "Lead source: ..."
- Document mapping in CONVERSION_GUIDE.md
- Validate all required customer fields before conversion

### Issue 3: Activity Logging Overhead
**Problem:** Each lead activity creates both lead_activity record + activity_log entry
**Impact:** 2x database writes
**Mitigation:** Acceptable - leads are not high-volume like quotes
**Optimization (Phase 3):** Batch activity logging with async queue

### Issue 4: Kanban Pipeline Performance
**Problem:** Rendering 100+ leads in kanban can be slow
**Mitigation (Phase 2):**
- Virtual scrolling in React
- Load leads by stage (not all at once)
- Implement lead count per stage first (lighter)

### Issue 5: Quote from Lead Workflow
**Problem:** Quote detail page needs to show "Lead" origin
**Current:** No connection between leads and quotes
**Mitigation:**
- Add optional `lead_id` to quotes table (Phase 3)
- Update quote detail page to show lead info
- Auto-populate customer when creating quote from lead

---

## 7. ROLE-BASED ACCESS CONTROL

Recommended role permissions for CRM:

```python
PERMISSIONS_BY_ROLE = {
    "sales_team": [
        "leads:create",      # Can create leads
        "leads:read_own",    # Can see own assigned leads
        "leads:update_own",  # Can update own assigned leads
        "activities:create", # Can log activities
    ],
    "sales_manager": [
        "leads:create",
        "leads:read_all",    # Can see all team leads
        "leads:update",      # Can update any lead
        "leads:delete",      # Can delete leads
        "activities:create",
        "lead_stages:read",
    ],
    "admin": [
        "leads:*",           # All lead operations
        "activities:*",      # All activity operations
        "lead_stages:*",     # Can customize pipeline
    ]
}
```

---

## 8. TESTING STRATEGY

### Unit Tests Required

```
backend/tests/routes/
├─ test_leads_crud.py         # Create, read, update, delete
├─ test_leads_qualification.py # Lead→customer conversion
├─ test_lead_activities.py     # Activity creation and linking
├─ test_lead_rls.py            # Organization isolation
└─ test_lead_stage_permissions.py  # Role-based access
```

### Integration Tests

```
1. Create lead → Add activity → View activity timeline → Delete lead
2. Create lead → Qualify lead → Verify customer created → Verify lead soft-deleted
3. Create lead → Assign to user → Verify user can see in list
4. Create lead as salesrep → Verify manager can see it
5. Create 50 leads → Load kanban view → Verify performance
```

### Manual Testing Checklist

- [ ] Create lead with minimal data (name + email only)
- [ ] Search leads by name/email/company
- [ ] Filter leads by status/stage/assigned_to
- [ ] Add activity to lead (call, meeting, note)
- [ ] Convert lead to customer (verify customer created correctly)
- [ ] Soft-delete lead (verify it disappears from list)
- [ ] Verify activity log shows lead creation/update/delete
- [ ] Check permission enforcement (salesperson cannot see other's leads)

---

## 9. QUICK WINS (IMPLEMENT FIRST)

**Phase 1A - Foundation (4-6 hours)**
1. Migration 027: Create leads, lead_stages, lead_activities tables
2. Pydantic models in models.py
3. Lead CRUD route (`/api/leads`)
4. Add "leads:create", "leads:read", "leads:update", "leads:delete" permissions

**Phase 1B - Activities (3-4 hours)**
1. Lead activities CRUD
2. Activity logging integration (use decorator)
3. Activity timeline view on lead detail

**Phase 1C - Basic UI (4-5 hours)**
1. Leads list page (simple ag-Grid table)
2. Create lead form
3. Lead detail page with timeline

**Estimated time to "minimum viable CRM":** 12-15 hours

---

## 10. ARCHITECTURAL RECOMMENDATIONS

### 1. Database Naming Consistency
Current: Activities → both `activities` (system) and `lead_activities` (CRM)
**Recommended:** Rename to:
- `system_activities` (keep as is - or maybe `activity_logs` already correct)
- `lead_activities` (new CRM table) ✅

### 2. Lead Source Enumeration
Add lead source as system reference:
```python
class LeadSource(str, Enum):
    WEBSITE = "website"
    COLD_CALL = "cold_call"
    REFERRAL = "referral"
    EVENT = "event"
    INBOUND_EMAIL = "inbound_email"
    OTHER = "other"
```

### 3. Lead Stage Defaults
Pre-populate default stages for new organizations:
```python
DEFAULT_LEAD_STAGES = [
    {"name": "Новый лид", "order": 1, "is_qualified": False, "color": "#1890ff"},
    {"name": "Контакт установлен", "order": 2, "is_qualified": False, "color": "#faad14"},
    {"name": "Квалифицирован", "order": 3, "is_qualified": True, "color": "#52c41a"},
    {"name": "Продан", "order": 4, "is_qualified": True, "color": "#1890ff"},
    {"name": "Потеря", "order": 5, "is_qualified": False, "color": "#ff7875"},
]
```

### 4. Service Layer Organization
Recommend new directory:
```
backend/services/
├─ activity_log_service.py       (existing)
├─ lead_qualification_service.py  (new)
└─ lead_stage_service.py          (new)
```

---

## 11. MIGRATION STRATEGY

**Do NOT run migrations directly** - Use Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard > Your Project > SQL Editor
2. Copy content from `backend/migrations/027_crm_system.sql`
3. Execute
4. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('leads', 'lead_stages', 'lead_activities')
   ORDER BY table_name;
   ```
   Should return 3 rows

---

## 12. MISSING DOCUMENTATION NEEDED

Before implementation, create:

1. **CRM_IMPLEMENTATION_SPEC.md**
   - Detailed lead→customer conversion algorithm
   - Lead deduplication rules
   - Permission matrix for each role

2. **LEAD_QUALIFICATION_SERVICE.md**
   - How to convert lead to customer
   - Field mapping from lead to customer
   - Example workflow

3. **CRM_API_REFERENCE.md**
   - Endpoint documentation
   - Request/response examples
   - Error codes

---

## RECOMMENDATIONS

### IMMEDIATE ACTIONS (Before Implementation)

- [ ] **Decision 1:** Confirm lead assignment model (1:1 with user or team-based?)
- [ ] **Decision 2:** Should quote→lead relationship be tracked?
- [ ] **Decision 3:** Are there custom fields needed for leads?
- [ ] **Decision 4:** Should lead email be unique per organization?

### IMPLEMENTATION PRIORITIES

**Priority 1 (Must have):**
- Lead CRUD
- Lead stages (customizable)
- Basic activities (attach to lead)
- Permission checks
- Activity logging integration

**Priority 2 (Should have):**
- Lead search/filter
- Activity timeline view
- Lead detail page
- Lead→customer conversion

**Priority 3 (Nice to have):**
- Kanban pipeline view
- Lead scoring
- Bulk actions
- Email integration

### RISK ASSESSMENT

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| RLS policy bugs | Medium | High | Add comprehensive RLS tests |
| Lead deduplication issues | Medium | Medium | Add UI warning for duplicates |
| Performance with 1000+ leads | Low | Medium | Implement pagination + filtering |
| Activity logging overhead | Low | Low | Benchmark, batch if needed |
| Quote→Lead relationship missing | Medium | Medium | Plan Phase 2 integration |

---

## CONCLUSION

**The CRM implementation plan is SOUND and FEASIBLE.**

**Green lights:**
- Database schema is well-designed ✅
- Follows existing patterns perfectly ✅
- Security model is solid ✅
- Integrates naturally with current architecture ✅
- No conflicts with calculation engine ✅

**Yellow flags to address:**
- Lead→customer conversion process needs detailed specification
- Lead assignment model needs RLS clarification
- Quote→Lead relationship should be planned for Phase 2
- Kanban UI performance needs thought-through design

**Ready to proceed with Phase 1A (Database + CRUD APIs):**
- Estimated time: 15-20 hours
- Can start immediately after finalizing decisions above
- Frontend can start in parallel after API contracts defined

---

## NEXT STEPS

1. Review evaluation with team
2. Answer 4 architectural decisions
3. Create IMPLEMENTATION_SPEC.md with detailed requirements
4. Create Migration 027 SQL file
5. Start Phase 1A implementation

