# CRM Implementation - Specific Code References

Quick reference guide for implementation with exact file paths and line numbers.

---

## BACKEND ROUTE PATTERNS

### Pattern 1: List with Pagination (Copy from customers.py)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/routes/customers.py`  
**Lines:** 60-148 (list_customers function)

What to copy:
- Router pagination query parameters (page, limit, search)
- Supabase filtering with `.or_()` syntax
- Organization isolation check
- Response format (CustomerListResponse)

### Pattern 2: CRUD Operations (Copy from customers.py)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/routes/customers.py`

- **Create:** Lines 151-229 (create_customer)
- **Get:** Lines 232-271 (get_customer)
- **Update:** Lines 275-359 (update_customer)
- **Delete:** Lines 362-424 (delete_customer)

All use same patterns:
- Supabase client initialization
- Organization ID checks
- Permission decorators
- Activity logging integration

### Pattern 3: Activity Logging Integration (Copy from customers.py)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/routes/customers.py`  
**Examples:**
- Line 152: `@log_activity_decorator("customer", "created")`
- Line 276: `@log_activity_decorator("customer", "updated")`
- Line 363: `@log_activity_decorator("customer", "deleted")`

---

## DATABASE MIGRATION PATTERNS

### Schema Pattern 1: Multi-Tenant Table (Copy from customers.py migration)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/migrations/005_create_customers_table.sql`

Structure to replicate:
```
- UUID primary key ✅
- organization_id with ON DELETE CASCADE ✅
- Indexes on: organization_id, key search fields, created_at ✅
- Unique constraints with WHERE clause for nulls ✅
- Timestamps with timezone support ✅
- Enable RLS ✅
```

### Schema Pattern 2: RLS Policies (Copy structure)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/migrations/005_create_customers_table.sql`  
**Lines:** 54-112 (RLS policies)

Policies to implement:
```sql
-- SELECT: Check organization_id via organization_members
CREATE POLICY "Users can view X in their organization"
    ON table_name FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

-- INSERT: Check both organization AND permission
CREATE POLICY "Users can create X in their organization"
    ON table_name FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT om.organization_id
            FROM organization_members om
            JOIN role_permissions rp ON om.role_id = rp.role_id
            WHERE om.user_id = auth.uid()
            AND om.status = 'active'
            AND rp.permission_slug = 'x:create'
        )
    );

-- Similar for UPDATE and DELETE
```

### Schema Pattern 3: Triggers (Copy from customers.py migration)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/migrations/005_create_customers_table.sql`  
**Lines:** 115-126 (updated_at trigger)

Auto-update timestamp trigger to implement:
```sql
CREATE OR REPLACE FUNCTION update_table_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_table_updated_at
    BEFORE UPDATE ON table_name
    FOR EACH ROW
    EXECUTE FUNCTION update_table_updated_at();
```

---

## PYDANTIC MODELS

### Model Pattern 1: Base Model (Copy from models.py)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/models.py`  
**Customer model reference:** Lines 290-330

Structure for Lead:
```python
class LeadBase(BaseModel):
    name: str
    email: Optional[str]
    phone: Optional[str]
    # ... other fields
    
class LeadCreate(LeadBase):
    pass
    
class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    # ... all fields optional
    
class Lead(LeadBase):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

### Model Pattern 2: Enum Definition (Copy structure)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/models.py`

Examples to reference:
- Lines 18-24 (CompanyType enum)
- Lines 26-30 (CustomerStatus enum)
- Lines 33-47 (QuoteStatus enum)

For Lead:
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
```

### Model Pattern 3: Response Models (Copy structure)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/models.py`

Look for pagination response pattern (search "ListResponse"):
```python
class LeadListResponse(BaseModel):
    leads: List[Lead]
    total: int
    page: int
    limit: int
    has_more: bool
```

---

## FRONTEND PATTERNS

### Component Pattern 1: Page Structure (Copy from customers)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/frontend/src/app/customers/page.tsx`

Structure to follow:
- 'use client' at top
- Import Ant Design components
- Import API service
- State management (useState for filters/pagination)
- ag-Grid table setup
- Search/filter controls

### Component Pattern 2: Detail Page (Copy structure)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/frontend/src/app/customers/[id]/page.tsx`

Structure:
- Dynamic route parameter [id]
- Fetch customer data on mount
- Tabs or sections for different data
- Edit form integration
- Activity timeline (if exists)

### Component Pattern 3: Form Handling (Copy from quote create)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/frontend/src/app/quotes/create/page.tsx`

Form patterns:
- Ant Design Form component
- Form validation
- Async submit handling
- Loading states
- Error notifications

### Component Pattern 4: Navigation Integration

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/frontend/src/components/layout/MainLayout.tsx`  
**Lines:** 50-209 (getMenuItems function)

Current structure:
- Lines 54-98: baseItems array
- Lines 101-111: Manager-only approval items
- Lines 174-179: Settings submenu
- Lines 182-206: Admin-only items

Add CRM menu around line 92-93:
```typescript
{
  key: 'crm-menu',
  icon: <PhoneOutlined />,
  label: 'CRM',
  children: [
    { key: '/crm/leads', label: 'Лиды' },
    { key: '/crm/stages', label: 'Этапы', visible: isAdmin }
  ]
}
```

---

## EXISTING ROUTES TO EXTEND

### Activity Logging Service (Existing)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/services/activity_log_service.py`

How to use decorator:
```python
@log_activity_decorator("lead", "created")
async def create_lead(data: LeadCreate, user: User):
    # Your implementation
    # Automatically logs: entity_type="lead", action="created"
```

### Permission System (Existing)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/auth.py`

How to use decorators:
```python
# Require specific permission
async def create_lead(
    user: User = Depends(require_permission("leads:create"))
):

# Require specific role
async def admin_only(
    user: User = Depends(require_role(UserRole.ADMIN))
):

# Require manager or above
async def manager_only(
    user: User = Depends(require_manager_or_above())
):
```

---

## KEY CONFIGURATION FILES

### Next.js Configuration

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/frontend/tsconfig.json`

Check that path aliases are set up:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Environment Variables

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/.env` (local)

Required for backend:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
```

### Migration Tracking

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/migrations/MIGRATIONS.md`

After creating Migration 027:
- Add entry to migration log table
- Update "Next Migration Number" to 028
- Document what Migration 027 does

---

## TESTING PATTERNS

### Backend Test Pattern (Copy structure)

**File:** `/home/novi/workspace/tech/projects/kvota/q1-crm/backend/tests/routes/test_customers_simple.py`

What to replicate:
- Test setup with test client
- Authentication mocking
- Organization context setup
- CRUD test cases
- RLS verification tests

### Frontend Component Tests (If using Jest)

Check if tests exist for:
- `frontend/src/app/customers/page.tsx`
- `frontend/src/app/customers/[id]/page.tsx`

---

## DEPLOYMENT & CI/CD

### GitHub Actions

**File:** `.github/workflows/` (if exists)

Check for:
- Backend tests run on push
- Frontend lint/type check
- Build verification

---

## DOCUMENTATION TO UPDATE

### After Implementation - Files to Update

1. **backend/CLAUDE.md** - Add lead route documentation
2. **frontend/CLAUDE.md** - Add CRM page patterns
3. **.claude/CLAUDE.md** - Update status and track progress
4. **.claude/SESSION_PROGRESS.md** - Mark feature complete

---

## QUICK START - IMPLEMENTATION ORDER

### Step 1: Backend Foundation
```
1. Copy backend/migrations/005_create_customers_table.sql → 027_crm_system.sql
2. Modify table names: customers → leads, customer_contacts → (remove)
3. Adjust columns for lead fields
4. Update RLS policies for lead access
5. Run migration in Supabase SQL Editor
```

### Step 2: Pydantic Models
```
1. Open backend/models.py
2. Add LeadStatus enum (after CompanyType)
3. Add LeadActivityType enum
4. Add LeadBase, LeadCreate, LeadUpdate, Lead classes
5. Add LeadListResponse class
6. Add LeadActivity* classes
```

### Step 3: Backend Routes
```
1. Create backend/routes/leads.py
2. Copy from customers.py lines 1-40 (router setup)
3. Copy from customers.py lines 60-148 (list function)
4. Copy from customers.py lines 151-360 (create/update/delete)
5. Modify for lead-specific fields
6. Add to backend/main.py: include_router(leads.router)
```

### Step 4: Frontend Navigation
```
1. Edit frontend/src/components/layout/MainLayout.tsx
2. Add import for phone icon: import { PhoneOutlined } from '@ant-design/icons'
3. Add CRM menu item around line 92
4. Test navigation works
```

### Step 5: Frontend UI
```
1. Create frontend/src/app/crm/ directory
2. Create frontend/src/app/crm/leads/ directory
3. Copy customers/page.tsx → leads/page.tsx
4. Copy customers/[id]/page.tsx → leads/[id]/page.tsx
5. Copy customers/create/page.tsx → leads/create/page.tsx
6. Modify column definitions for leads
7. Update API calls to /api/leads
```

---

## TROUBLESHOOTING REFERENCE

### "Cannot find module" errors
- Check path aliases in tsconfig.json
- Verify imports use @/lib/... format

### "RLS policy violation" errors
- Check organization_id is included in WHERE clause
- Verify set_rls_context is called with user data
- Check RLS policy for SELECT/INSERT/UPDATE permissions

### "Unique constraint violation"
- Check if composite unique constraint exists
- For emails: (organization_id, email) should be unique
- For quote numbers: (organization_id, quote_number) should be unique

### "Cannot connect to Supabase"
- Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
- Verify database connection string
- Check IP whitelist in Supabase dashboard

---

**Last Updated:** 2025-11-13  
**Reference for:** CRM Implementation Phase 1A-1C
