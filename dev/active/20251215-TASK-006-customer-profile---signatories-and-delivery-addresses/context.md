# Customer Profile - Signatories and Delivery Addresses - Context

**Task ID:** TASK-006
**Last Updated:** 2025-12-15 HH:MM
**Session:** Session ##
**Current Phase:** Phase # of #
**Status:** In Progress / Blocked / Ready for Testing

---

## 1. Task Overview

### Quick Summary

[One-paragraph summary of what this task is doing]

**Example:**
Adding approval workflow for quotes. Quotes >$10k require manager approval, >$50k require CFO approval. Backend API complete, frontend UI in progress. Currently working on ApprovalHistory component.

### Current Phase Progress

**Phase 2: Backend API** [✓ Complete]
- ✅ Database schema
- ✅ API endpoints
- ✅ Tests

**Phase 3: Frontend Components** [⚙️ In Progress - 60%]
- ✅ ApprovalButton component
- ⚙️ ApprovalHistory component (currently working)
- ❌ ApprovalStatusBadge component (not started)

**Phase 4: Integration** [❌ Not Started]

### What's Been Completed

**Database (Phase 1):**
- Created `quote_approvals` table with RLS policies
- Added `approval_status` column to `quotes` table
- Created indexes for performance
- RLS verified across 3 test organizations

**Backend (Phase 2):**
- Implemented `POST /api/quotes/{id}/approve` endpoint
- Implemented `GET /api/quotes/{id}/approvals` endpoint
- Added permission checks (role-based)
- Added business logic (threshold checks)
- Wrote 10 unit tests (all passing)
- Wrote 5 integration tests (all passing)

**Frontend (Phase 3 - Partial):**
- ✅ Created ApprovalButton component
  - Shows approve/reject modal
  - Handles loading states
  - Optimistic UI updates
  - Russian localization complete
- ⚙️ Working on ApprovalHistory component
  - Timeline view implemented
  - Need to add comments section
  - Need to add filtering

### What's In Progress Right Now

**Current Task:** Building ApprovalHistory component

**What I'm doing:**
- Component renders approval timeline (✅ Done)
- Adding comments section for each approval (⚙️ In progress)
- Need to add filtering by status (❌ Not started)
- Need to add pagination (❌ Not started)

**Current Code Location:**
- File: `frontend/src/components/ApprovalHistory.tsx`
- Lines: Currently ~120 lines, will be ~180 when complete

**Blockers:** None

### What's Next

**Immediate next steps (this session):**
1. Finish comments section in ApprovalHistory
2. Add filtering dropdown (approved/rejected/all)
3. Add pagination (10 approvals per page)
4. Write component tests
5. Create ApprovalStatusBadge component

**Next session:**
1. Integrate components into quote detail page
2. Test end-to-end approval flow
3. Add email notifications
4. Run @orchestrator for quality checks

---

## 2. Code Inventory

### Files Created (New)

**Backend:**
1. `backend/migrations/20251030_add_quote_approvals.sql` (50 lines)
   - Creates quote_approvals table
   - Adds approval_status to quotes
   - Creates indexes
   - Adds RLS policies

2. `backend/routes/quotes_approval.py` (220 lines)
   - POST /api/quotes/{id}/approve
   - GET /api/quotes/{id}/approvals
   - Permission checks
   - Business logic

3. `backend/tests/test_quotes_approval.py` (310 lines)
   - 10 unit tests
   - 5 integration tests
   - All passing ✅

**Frontend:**
4. `frontend/src/components/ApprovalButton.tsx` (105 lines)
   - Approve/reject modal
   - Loading states
   - Error handling

5. `frontend/src/components/ApprovalHistory.tsx` (120 lines - IN PROGRESS)
   - Timeline view
   - Comments section (partial)
   - Need: Filtering, pagination

6. `frontend/src/types/approval.ts` (35 lines)
   - TypeScript interfaces
   - Approval, ApprovalRequest, ApprovalListResponse

**Total Lines Created:** ~840 lines (will be ~1,000 when complete)

### Files Modified (Existing)

1. `backend/main.py` (+3 lines)
   - Added quotes_approval router

2. `backend/migrations/MIGRATIONS.md` (+10 lines)
   - Logged migration 20251030

3. `frontend/src/app/quotes/[id]/page.tsx` (NOT YET - planned +50 lines)
   - Will add approval section

**Total Lines Modified:** ~13 lines (will be ~63 when complete)

### Files to Create (Remaining)

1. `frontend/src/components/ApprovalStatusBadge.tsx` (~50 lines)
2. `supabase/functions/approval-email/index.ts` (~100 lines)
3. `frontend/src/components/__tests__/ApprovalButton.test.tsx` (~80 lines)

### Files to Modify (Remaining)

1. `frontend/src/app/quotes/[id]/page.tsx` (+50 lines)
2. `.claude/SESSION_PROGRESS.md` (update task status)
3. `frontend/CLAUDE.md` (document approval components)
4. `backend/CLAUDE.md` (document approval endpoints)

---

## 3. Important Decisions Made

### Decision 1: Dedicated Approval Table vs Generic Workflow Engine

**Date:** 2025-10-30 10:00
**Decision:** Use dedicated `quote_approvals` table

**Rationale:**
- Only need approvals for quotes (not orders, invoices, etc.)
- Generic workflow engine is over-engineering (YAGNI)
- Can refactor later if we need approvals for other entities
- Simpler to test and debug

**Alternatives Considered:**
- Generic workflow engine (rejected - too complex)
- Polymorphic approval table (rejected - harder to query)

**Impact:**
- Faster development (saved ~2 hours)
- Simpler codebase
- Technical debt if we need approvals elsewhere (acceptable)

---

### Decision 2: Hybrid Approval Logic (Frontend + Backend)

**Date:** 2025-10-30 11:30
**Decision:** Backend authoritative, frontend caches for UX

**Rationale:**
- Security requires backend validation (can't trust client)
- UX requires fast feedback (can't wait for API on every check)
- Compromise: Cache approval rules in frontend session (5 min TTL)
- Backend always makes final decision on approve/reject

**Alternatives Considered:**
- Backend-only (rejected - poor UX)
- Frontend-only (rejected - insecure)

**Impact:**
- Best of both worlds: Secure + fast UX
- Added complexity: Cache invalidation
- Need to handle cache staleness gracefully

---

### Decision 3: React Query Instead of SWR

**Date:** 2025-10-30 14:00
**Decision:** Use React Query for data fetching

**Rationale:**
- Better devtools (easier debugging)
- More powerful caching (can cache by quote_id)
- Optimistic updates built-in
- Already used elsewhere in codebase (consistency)

**Alternatives Considered:**
- SWR (rejected - less powerful)
- Redux Toolkit Query (rejected - overkill)

**Impact:**
- Consistent with existing code
- Better developer experience
- No impact on bundle size (already installed)

---

### Decision 4: Approval Thresholds Configurable Per Organization

**Date:** 2025-10-30 15:30
**Decision:** Make approval thresholds configurable, not hardcoded

**Why:**
- User feedback: "We want $15k threshold, not $10k"
- Different organizations have different risk tolerance
- Avoids code changes for threshold adjustments

**Implementation:**
- Store thresholds in `organizations.approval_settings` JSONB column
- Default: {manager_threshold: 10000, cfo_threshold: 50000}
- Backend reads from database, not hardcoded

**Impact:**
- More flexible system
- Slightly more complex (need UI for settings)
- Add to backlog: Settings page for approval thresholds

---

### Decision 5: Approval Comments Optional

**Date:** 2025-10-30 16:00
**Decision:** Comments optional on approval, required on rejection

**Rationale:**
- Approvals: Usually don't need explanation
- Rejections: Should explain why (helps requester improve)
- Balance: Don't force busy approvers to write essays

**Implementation:**
- Pydantic validation: `comments: Optional[str]`
- Frontend: Reject button requires comments (form validation)
- Approve button: Comments optional

**Impact:**
- Better UX for approvers
- Better audit trail for rejections
- Validation in both frontend and backend

---

## 4. Integration Points

### Systems Touched

1. **Quotes Table**
   - Added column: `approval_status` (TEXT NULL)
   - Values: NULL (old quotes), 'pending', 'approved', 'rejected'
   - Migration: 20251030_add_quote_approvals.sql

2. **Users Table**
   - Read-only: Fetch approver info (name, email)
   - No changes to schema

3. **Organizations Table** (Future)
   - Plan to add: `approval_settings` JSONB column
   - Will store: manager_threshold, cfo_threshold
   - Not implemented yet (use defaults for now)

4. **Activity Log System**
   - Integration: Log approval events
   - Events: quote.approved, quote.rejected
   - Metadata: {quote_id, approver_id, comments}

5. **Email Service** (Not implemented yet)
   - Supabase Edge Function: `approval-email`
   - Templates: Approval request, approval granted, approval rejected
   - Trigger: After approval status change

### API Endpoints Created

**1. POST /api/quotes/{quote_id}/approve**
- **Purpose:** Approve or reject a quote
- **Auth:** Required (JWT)
- **Permissions:** Manager (≤$50k), CFO/Owner (all)
- **Request Body:** `{action: "approve"|"reject", comments?: string}`
- **Response:** Approval object + next_approver (if multi-level)

**2. GET /api/quotes/{quote_id}/approvals**
- **Purpose:** Get approval history for a quote
- **Auth:** Required (JWT)
- **Permissions:** Any user in same organization
- **Response:** Array of approvals + pending_approver

### Database Changes

**New Table: quote_approvals**
- Columns: id, quote_id, approver_id, organization_id, status, approved_at, comments, created_at
- Indexes: quote_id, (status, organization_id)
- RLS: Organization isolation (users.org_id = quote_approvals.organization_id)

**Modified Table: quotes**
- Added column: approval_status TEXT NULL
- No indexes (low cardinality, not filtered often)

### Dependencies Added

**Backend:**
- None (using existing FastAPI, Supabase)

**Frontend:**
- None (using existing React Query, Ant Design)

---

## 5. Known Issues

### Bugs Discovered (Not Fixed Yet)

**Bug 1: Approval Button Flashes During Load**
- **Description:** ApprovalButton briefly shows "Approve" before permission check completes
- **Impact:** Low (visual glitch, no functional issue)
- **Cause:** Permission check is async, button renders before check completes
- **Fix:** Add loading skeleton while checking permissions
- **Priority:** Low (will fix in polish phase)

**Bug 2: Approval History Pagination Missing**
- **Description:** Shows all approvals, could be 100+ for old quotes
- **Impact:** Medium (performance issue for quotes with many approvals)
- **Cause:** Not implemented yet (planned feature)
- **Fix:** Add pagination (10 per page) in ApprovalHistory component
- **Priority:** High (will fix this session)

---

### Technical Debt Created

**Debt 1: Hardcoded Approval Thresholds**
- **Description:** $10k and $50k thresholds are hardcoded in backend
- **Why Created:** Simplicity (MVP)
- **Payoff Plan:** Add `organizations.approval_settings` JSONB column
- **Estimated Effort:** 2 hours (backend + frontend settings UI)
- **Priority:** Medium (add to backlog)

**Debt 2: No Email Notifications Yet**
- **Description:** Approvals don't trigger emails (in-app only)
- **Why Created:** Email service not implemented yet (Phase 5)
- **Payoff Plan:** Create Supabase Edge Function for emails
- **Estimated Effort:** 1 hour
- **Priority:** High (will do next session)

**Debt 3: No Approval Delegation**
- **Description:** Can't delegate approval to someone else
- **Why Created:** Not in MVP scope
- **Payoff Plan:** Add delegation feature (assign approver to deputy)
- **Estimated Effort:** 3 hours
- **Priority:** Low (user request, but not critical)

---

### Performance Concerns

**Concern 1: Approval Check Performance**
- **Issue:** Every quote detail page load checks approval status
- **Current:** ~50ms per check (acceptable)
- **Risk:** Could degrade with large approval history
- **Mitigation:**
  - Database index on quote_approvals(quote_id) ✅ Done
  - Cache approval status in frontend (5 min TTL) ✅ Done
  - Monitor in production

**Concern 2: Email Delivery Performance**
- **Issue:** Email sending could delay approval API response
- **Current:** Not implemented yet
- **Risk:** User waits for email to send before seeing approval confirmation
- **Mitigation:**
  - Send emails asynchronously (background job)
  - Don't block API response on email delivery
  - Plan to use Supabase Edge Function (async)

---

### Security Considerations

**Security Check 1: RLS Bypass Risk**
- **Issue:** User could approve other org's quotes
- **Mitigation:** ✅ RLS policies on quote_approvals table
- **Verified:** Tested with 3 different organizations
- **Status:** Secure ✅

**Security Check 2: Permission Bypass Risk**
- **Issue:** Member could call approval API directly (bypass frontend)
- **Mitigation:** ✅ Backend checks user role before approving
- **Verified:** Unit test `test_approve_quote_no_permission`
- **Status:** Secure ✅

**Security Check 3: Approval Threshold Bypass**
- **Issue:** Manager could approve $60k quote (above limit)
- **Mitigation:** ✅ Backend enforces thresholds
- **Verified:** Unit test `test_approval_threshold_cfo`
- **Status:** Secure ✅

**Security Audit:** Will run @security-auditor before merging

---

## 6. Next Steps

### Immediate Actions (This Session)

**Priority 1: Finish ApprovalHistory Component**
- [ ] Add comments section (30 min)
- [ ] Add filtering dropdown (15 min)
- [ ] Add pagination (20 min)
- [ ] Test component (10 min)

**Priority 2: Create ApprovalStatusBadge Component**
- [ ] Create component file (10 min)
- [ ] Style badge (colors, icons) (15 min)
- [ ] Add to quote list page (10 min)

**Priority 3: Write Component Tests**
- [ ] Test ApprovalButton (20 min)
- [ ] Test ApprovalHistory (20 min)
- [ ] Test ApprovalStatusBadge (10 min)

**Total Time:** ~2.5 hours remaining this session

---

### Next Session Tasks

**Phase 4: Integration (1 hour)**
- [ ] Add approval section to quote detail page
- [ ] Wire up components with React Query
- [ ] Test end-to-end flow
- [ ] Handle edge cases (quote deleted, user logged out)

**Phase 5: Email Notifications (1 hour)**
- [ ] Create Supabase Edge Function
- [ ] Design email templates
- [ ] Test email delivery
- [ ] Add Russian translations

**Phase 6: Testing & QA (1 hour)**
- [ ] Run all backend tests
- [ ] Run all frontend tests
- [ ] E2E testing with Chrome DevTools MCP
- [ ] Call @orchestrator for quality checks

**Phase 7: Documentation (30 min)**
- [ ] Update SESSION_PROGRESS.md
- [ ] Document in CLAUDE.md
- [ ] Create PR
- [ ] Deploy

---

### Blockers

**Current Blockers:** None

**Potential Future Blockers:**
- Email service integration (if Supabase Edge Functions have issues)
- Approval threshold configuration (need UI for settings)
- Multi-level approval logic (if CFO rejects after manager approves)

---

## 7. Context for Autocompact

### Critical Information - Don't Lose This!

**If autocompact happens, you MUST know:**

1. **What we're building:**
   - Quote approval workflow
   - Manager approves <$50k, CFO approves all
   - Backend ✅ complete, Frontend 60% complete

2. **Current task:**
   - Working on ApprovalHistory component
   - File: `frontend/src/components/ApprovalHistory.tsx`
   - Need to add: Comments section, filtering, pagination

3. **Key decisions made:**
   - Using React Query (not SWR)
   - Approval comments optional (rejection comments required)
   - Approval thresholds hardcoded for now (will make configurable later)

4. **What works:**
   - Database schema ✅
   - Backend API ✅ (10 unit tests + 5 integration tests passing)
   - ApprovalButton component ✅
   - ApprovalHistory component (partial - timeline works, need comments/filtering/pagination)

5. **What's left:**
   - Finish ApprovalHistory (this session)
   - Create ApprovalStatusBadge (this session)
   - Integrate into quote detail page (next session)
   - Add email notifications (next session)
   - Testing & QA (next session)

6. **Important files:**
   - Backend: `backend/routes/quotes_approval.py`
   - Frontend: `frontend/src/components/ApprovalButton.tsx`, `frontend/src/components/ApprovalHistory.tsx`
   - Tests: `backend/tests/test_quotes_approval.py`
   - Migration: `backend/migrations/20251030_add_quote_approvals.sql`

---

### Shortcuts & Patterns Discovered

**Pattern 1: Optimistic UI Updates with React Query**
```typescript
// In ApprovalButton.tsx
const mutation = useMutation({
  mutationFn: approveQuote,
  onMutate: async () => {
    // Optimistically update UI
    queryClient.setQueryData(['quote', quoteId], (old) => ({
      ...old,
      approvalStatus: 'approved'
    }));
  },
  onError: () => {
    // Rollback on error
    queryClient.invalidateQueries(['quote', quoteId]);
  }
});
```

**Why this works well:** Fast UI feedback, automatic rollback on error

---

**Pattern 2: Permission Checks in Backend**
```python
# In routes/quotes_approval.py
def check_approval_permission(quote: dict, user: User) -> bool:
    if user.role in ['owner', 'admin']:
        return True  # Can approve anything
    if user.role == 'manager' and quote['total_amount'] <= 50000:
        return True
    return False
```

**Why this works well:** Clear business logic, easy to test, secure

---

**Pattern 3: RLS Policy for Organization Isolation**
```sql
CREATE POLICY "Users can only access own org approvals"
ON quote_approvals
FOR ALL
USING (organization_id = auth.uid()::text::uuid);
```

**Why this works well:** Database enforces security, can't bypass via API

---

### Questions for User (When They Return)

1. **Approval thresholds:** Confirm $10k (manager) and $50k (CFO) are correct?
2. **Email notifications:** Should we CC anyone on approval emails?
3. **Multi-level approval:** If CFO rejects after manager approves, what happens to quote?
4. **Approval delegation:** Is this needed in MVP or can it wait?

---

### Agent Handoff Instructions

**If another agent takes over:**

1. **Read this context file first** - Everything you need is here
2. **Check tasks.md** - See what's complete vs pending
3. **Run tests** - Ensure nothing broke: `cd backend && pytest tests/test_quotes_approval.py`
4. **Current file** - `frontend/src/components/ApprovalHistory.tsx` (line ~120)
5. **Next task** - Add comments section to ApprovalHistory
6. **Ask user** - If unclear, ask about approval thresholds or delegation

---

**Remember:** This context file is your lifeline after autocompact. Update it religiously!
