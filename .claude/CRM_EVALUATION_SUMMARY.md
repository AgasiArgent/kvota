# CRM Implementation Plan - Executive Summary

**Status:** READY TO IMPLEMENT with 4 critical decisions needed

---

## VERDICT: ✅ SOUND ARCHITECTURE, NEEDS REFINEMENT

The CRM plan is **technically feasible** and **well-aligned with existing patterns**. No architectural conflicts detected. However, several implementation details need clarification before coding begins.

---

## KEY FINDINGS

### 1. GREEN LIGHTS ✅

| Area | Finding | Evidence |
|---|---|---|
| **Database Design** | Perfectly aligned with existing patterns | Matches customers.py schema structure |
| **Backend Patterns** | Can copy directly from customers.py | Same RLS, same permission model |
| **Security Model** | Organization isolation is solid | RLS policies are well-designed |
| **Integration** | Zero conflicts with quotes/calculation | Separate concern, independent workflow |
| **Navigation** | Natural fit in main menu | Between Customers and Organizations |

### 2. YELLOW FLAGS ⚠️

| Issue | Severity | Impact | Fix |
|---|---|---|---|
| Lead→Customer conversion unclear | HIGH | Cannot implement Phase 2 | Define field mapping algorithm |
| Lead assignment RLS policy missing | HIGH | Managers won't see team leads | Add role-based RLS policy |
| No quote→lead relationship | MEDIUM | Quote origin tracking impossible | Add `lead_id` to quotes (Phase 2) |
| Kanban performance unaddressed | MEDIUM | Rendering 100+ leads will be slow | Design pagination strategy |
| No deduplication rules | MEDIUM | Duplicate leads will accumulate | Add email uniqueness constraint |

### 3. QUICK WINS

These can be implemented immediately (12-15 hours total):
- ✅ Migration 027 (tables + RLS)
- ✅ Lead CRUD API
- ✅ Lead activities API
- ✅ Basic UI (list + detail pages)

---

## CRITICAL DECISIONS NEEDED

### Decision 1: Lead Assignment Model
**Question:** When assigning lead to salesperson, who can see it?

**Option A (More restrictive):**
- Salesperson sees ONLY their assigned leads
- Manager sees all leads
- Issue: Salesperson cannot share load with colleague

**Option B (More flexible):**
- Salesperson sees their leads + unassigned leads
- Manager sees all leads
- Lead can have multiple assignees
- Issue: More complex RLS policy

**Recommendation:** Start with Option A, upgrade to Option B in Phase 2

### Decision 2: Quote→Lead Relationship
**Question:** Should quotes track which lead they came from?

**Option A:** No relationship
- Lead is just customer acquisition tracking
- Simple implementation
- Cannot report "leads converted to customers" easily

**Option B:** Optional `lead_id` on quotes
- Quotes can link back to originating lead
- Enables conversion reporting
- Slightly more complex

**Recommendation:** Plan Phase 2 to add optional `lead_id` to quotes table

### Decision 3: Custom Lead Fields
**Question:** Do organizations need custom fields on leads?

**Option A:** No custom fields (now)
- Standard fields: name, email, phone, company, position, INN, source
- Simpler implementation
- Add later if needed

**Option B:** Custom fields support (now)
- 3-5 extra hours of work
- Similar to Salesforce approach
- Needed for complex workflows

**Recommendation:** Start with Option A, add Phase 3 if needed

### Decision 4: Lead Email Uniqueness
**Question:** Can same email appear in multiple leads?

**Option A:** Unique per organization
- Prevents accidental duplicates
- Cannot re-engage same person
- Stricter constraint

**Option B:** Allow duplicates
- Flexible for multi-stakeholder deals
- Requires merge/duplicate detection UI
- Needs fuzzy matching

**Recommendation:** Start with Option A, implement merge UI in Phase 4

---

## IMPLEMENTATION ROADMAP

### Phase 1A: Foundation (4-6 hours) - READY NOW
```
✅ Database: Create 3 tables (leads, lead_stages, lead_activities)
✅ Backend: Lead CRUD route (/api/leads)
✅ Backend: Permissions setup
✅ Models: Add Lead/LeadActivity Pydantic models
```

### Phase 1B: Activities (3-4 hours) - READY AFTER 1A
```
✅ Backend: Lead activities CRUD
✅ Activity logging integration (use @log_activity_decorator)
✅ Frontend: Activity timeline component
```

### Phase 1C: UI (4-5 hours) - READY AFTER 1B
```
✅ Frontend: Leads list page (ag-Grid table)
✅ Frontend: Create lead form
✅ Frontend: Lead detail page with timeline
```

**Total Phase 1: 12-15 hours** → Minimum viable CRM

### Phase 2: Lead→Customer Conversion (8-10 hours) - Q1 Q2
```
- Lead qualification service
- /api/leads/{id}/qualify endpoint
- Frontend conversion UI
- Needs Decision 2 answer
```

### Phase 3: Advanced (10-15 hours) - Q2 Q3
```
- Kanban pipeline view
- Lead deduplication/merge
- Quote→lead linking
- Lead scoring
- Bulk actions
```

---

## ARCHITECTURAL DIFFERENCES FROM PLAN

### What the Plan Got Right
- Lead CRUD structure ✅
- Customizable stages ✅
- RLS organization isolation ✅
- Activity tracking ✅

### What Needs Clarification
1. **Lead→Customer conversion service:** Plan says "copy data to customers table" but doesn't explain:
   - Which fields map to which? (lead.source → customer.notes?)
   - How to create primary contact?
   - What happens to lead.stage after conversion?

2. **Lead assignment:** Plan mentions `assigned_to` but no RLS policy showing:
   - Can salesperson see other's leads? (Should be NO)
   - Can manager see all? (Should be YES)
   - How does permission model work?

3. **Activity duplicate:** Plan has both:
   - `lead_activities` table (CRM-specific)
   - `activity_logs` integration (system-wide)
   - Need to clarify: Are they separate or linked?

### File Structure - MINOR ISSUE
**Plan suggested:** `frontend/src/modules/crm/`
**Correct for this project:** `frontend/src/app/crm/`
- Other pages use `frontend/src/app/`
- No "modules" directory exists
- Must follow Next.js 15 app router conventions

---

## RISK MATRIX

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| RLS policy bypasses | 30% | HIGH | Add comprehensive RLS tests before Phase 1B |
| Lead duplication explosion | 60% | MEDIUM | Add email unique constraint + duplicate detection UI in Phase 3 |
| Performance with 1000+ leads | 20% | MEDIUM | Implement pagination from Phase 1C, not Phase 4 |
| Conversion process loses data | 40% | MEDIUM | Define exact field mapping in Decision 1 process |
| Activity logging overhead | 10% | LOW | Benchmark after Phase 1B, optimize if needed |

---

## CODE REUSE OPPORTUNITIES

### Copy Directly From These Files
- `backend/routes/customers.py` (lines 1-100) → `backend/routes/leads.py`
  - Router setup ✅
  - Permission decorators ✅
  - Pagination pattern ✅
  
- `backend/models.py` (lines 290-330) → Lead models
  - Customer model structure matches lead needs ✅
  
- `frontend/src/app/customers/` → `frontend/src/app/crm/leads/`
  - List page structure ✅
  - Detail page structure ✅
  - Form patterns ✅

### Extend Existing Files
- `backend/routes/activity_logs.py` → Add CRM activity support
- `frontend/src/components/layout/MainLayout.tsx` → Add CRM menu
- `backend/models.py` → Add Lead/LeadActivity/LeadStage models

---

## ESTIMATED EFFORT BREAKDOWN

| Component | Hours | Difficulty |
|---|---|---|
| Migration 027 (3 tables + RLS) | 2 | Medium |
| Pydantic models | 1 | Easy |
| Lead CRUD route | 3 | Easy (copy from customers.py) |
| Lead activities route | 2 | Easy |
| RLS tests | 3 | Medium |
| Frontend list page | 2 | Easy |
| Frontend detail page | 2 | Easy |
| Frontend create form | 1 | Easy |
| Navigation integration | 0.5 | Easy |
| **TOTAL PHASE 1** | **16.5 hours** | — |

**Can be done by 1-2 developers in parallel:** 8-10 hours (parallel backend + frontend)

---

## NEXT STEPS (CHECKLIST)

Before you write any code:

- [ ] **Review this evaluation** with team/stakeholders
- [ ] **Answer 4 Critical Decisions** (see section above)
- [ ] **Create CRM_IMPLEMENTATION_SPEC.md** (detailed requirements from decisions)
- [ ] **Create Migration 027 SQL file** (from specification)
- [ ] **Define Pydantic models** (in models.py)
- [ ] **Create test cases** (for Phase 1A)

Only after above:
- [ ] Start Phase 1A: Backend database + CRUD
- [ ] Start Phase 1B: Activities (after 1A passes tests)
- [ ] Start Phase 1C: Frontend (after 1B API documented)

---

## RECOMMENDATION: GO AHEAD ✅

**The plan is sound. Proceed with Phase 1A after answering the 4 decisions.**

Key strengths:
- Zero conflicts with existing architecture
- Clear migration path (Phase 1A → 1B → 1C → Phase 2)
- Can copy 80% of code from existing patterns
- Security model is correct
- No database constraints that would prevent scaling

Potential blockers:
- Need Decision 1-4 answers to unblock Phase 2
- Need to review RLS policy before Phase 1B
- Need to document field mapping before Phase 2

---

## REFERENCE FILES

Full evaluation with code examples:
- `.claude/CRM_EVALUATION.md` (complete 12-section evaluation)

Key files to review before starting:
- `backend/routes/customers.py` (240 lines - reference implementation)
- `backend/migrations/005_create_customers_table.sql` (90 lines - reference schema)
- `frontend/src/components/layout/MainLayout.tsx` (330 lines - navigation pattern)
- `backend/models.py` (lines 290-330, Customer model pattern)

---

**Evaluation by:** Claude Code (File Search Specialist)  
**Date:** 2025-11-13  
**Branch:** feature/q1-crm-module  
**Project:** kvota/q1-crm (B2B Quotation Platform)
