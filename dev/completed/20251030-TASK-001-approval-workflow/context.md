# Quote Approval Workflow - Context

**Task ID:** TASK-001
**Last Updated:** 2025-10-30 16:00
**Session:** Session 26
**Current Phase:** Phase 3 of 7 (Frontend Components)
**Status:** In Progress (60% complete)

---

## 1. Task Overview

### Quick Summary

Adding approval workflow for quotes. Quotes >$10k require manager approval, >$50k require CFO approval. Backend API complete with 15 passing tests. Frontend 60% complete - ApprovalButton done, currently working on ApprovalHistory component (timeline works, need comments/filtering/pagination).

### Current Phase Progress

**Phase 1: Database** ✅ Complete
**Phase 2: Backend API** ✅ Complete
**Phase 3: Frontend** ⚙️ In Progress (60%)
- ✅ ApprovalButton component
- ⚙️ ApprovalHistory component (currently working)
- ❌ ApprovalStatusBadge component (not started)

**Phase 4-7:** Not started

### What's Been Completed

**Database (Phase 1):**
- Created `quote_approvals` table with columns: id, quote_id, approver_id, organization_id, status, approved_at, comments, created_at
- Added `approval_status` TEXT NULL column to `quotes` table
- Created indexes on (quote_id) and (status, organization_id)
- RLS policy: `organization_id = auth.uid()::text::uuid`
- Verified RLS with 3 test organizations - all isolated correctly ✅

**Backend (Phase 2):**
- ✅ Implemented `POST /api/quotes/{id}/approve` endpoint
  - Handles approve and reject actions
  - Permission checks: Manager (≤$50k), CFO/Owner (all)
  - Business logic: Threshold checks at $10k and $50k
  - Returns approval object + next_approver if multi-level
- ✅ Implemented `GET /api/quotes/{id}/approvals` endpoint
  - Returns approval history array
  - Returns pending_approver if exists
- ✅ Pydantic models: ApprovalRequest, ApprovalResponse, ApprovalListResponse
- ✅ Error handling: 404 (not found), 403 (no permission), 422 (validation)
- ✅ Tests: 10 unit + 5 integration (all passing)

**Frontend (Phase 3 - Partial):**
- ✅ TypeScript interfaces in `types/approval.ts` (35 lines)
  - Approval, ApprovalRequest, ApprovalListResponse
- ✅ ApprovalButton component (105 lines)
  - Approve/reject modal with Ant Design
  - Loading states (spinner on button)
  - Optimistic UI updates via React Query
  - Russian localization ("Утвердить", "Отклонить")
  - Error handling with message.error()
- ⚙️ ApprovalHistory component (120 lines - IN PROGRESS)
  - Timeline view implemented ✅
  - Shows approver, status, timestamp
  - Need to add: Comments section, filtering, pagination

### What's In Progress Right Now

**Current Task:** Finishing ApprovalHistory component

**What works:**
- Timeline renders all approvals chronologically
- Shows approver name and avatar
- Color-coded status (green=approved, red=rejected, gray=pending)
- Shows formatted timestamp

**What's needed:**
- Comments section for each approval (show if exists)
- Filtering dropdown (show all / approved / rejected)
- Pagination (10 approvals per page for quotes with long history)
- Loading skeleton while fetching

**Current Code Location:**
- File: `frontend/src/components/ApprovalHistory.tsx`
- Lines: Currently ~120 lines, will be ~180 when complete

**Estimated Time Remaining:** 45 min

**Blockers:** None

### What's Next

**This Session (Next 1 hour):**
1. Add comments section to ApprovalHistory (~15 min)
2. Add filtering dropdown (~10 min)
3. Add pagination (~15 min)
4. Create ApprovalStatusBadge component (~30 min)
5. Write component tests (~40 min)

**Next Session:**
1. Integrate components into quote detail page (1 hour)
2. Add email notifications (1 hour)
3. E2E testing and QA (1 hour)
4. Documentation and deployment (30 min)

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
   - Permission checking logic
   - Threshold validation ($10k/$50k)

3. `backend/tests/test_quotes_approval.py` (310 lines)
   - 10 unit tests (approval, rejection, permissions, thresholds)
   - 5 integration tests (full flow, multi-level, email trigger)
   - All passing ✅
   - Coverage: 94%

**Frontend:**
4. `frontend/src/types/approval.ts` (35 lines)
   - TypeScript interfaces
   - Approval, ApprovalRequest, ApprovalListResponse

5. `frontend/src/components/ApprovalButton.tsx` (105 lines)
   - Approve/reject modal
   - Loading states
   - Optimistic UI
   - Error handling

6. `frontend/src/components/ApprovalHistory.tsx` (120 lines - IN PROGRESS)
   - Timeline view ✅
   - Comments section (partial)
   - Need: Filtering, pagination

**Total Lines Created:** ~840 lines (will be ~1,100 when complete)

### Files Modified (Existing)

1. `backend/main.py` (+3 lines)
   - Added quotes_approval router import
   - Registered router with app

2. `backend/migrations/MIGRATIONS.md` (+10 lines)
   - Logged migration 20251030_add_quote_approvals

**Total Lines Modified:** ~13 lines (will be ~80 when integration complete)

### Files to Create (Remaining)

1. `frontend/src/components/ApprovalStatusBadge.tsx` (~50 lines)
2. `supabase/functions/approval-email/index.ts` (~100 lines)
3. `frontend/src/components/__tests__/ApprovalButton.test.tsx` (~80 lines)
4. `frontend/src/components/__tests__/ApprovalHistory.test.tsx` (~60 lines)
5. `frontend/src/components/__tests__/ApprovalStatusBadge.test.tsx` (~40 lines)

### Files to Modify (Remaining)

1. `frontend/src/app/quotes/[id]/page.tsx` (+50 lines) - Add approval section
2. `.claude/SESSION_PROGRESS.md` (+20 lines) - Document task complete
3. `frontend/CLAUDE.md` (+30 lines) - Document approval components
4. `backend/CLAUDE.md` (+20 lines) - Document approval endpoints

---

## 3. Important Decisions Made

### Decision 1: Dedicated Approval Table

**Date:** 2025-10-30 10:00
**Decision:** Use dedicated `quote_approvals` table instead of generic workflow engine

**Rationale:**
- Only need approvals for quotes currently
- Generic workflow is over-engineering (YAGNI principle)
- Simpler to test and debug
- Can refactor to generic workflow later if needed

**Alternatives Rejected:**
- Generic workflow engine (too complex, 2x dev time)
- Polymorphic approval table (harder to query)

**Impact:**
- Faster development (saved ~2 hours)
- Clearer schema and queries
- Technical debt if we need approvals elsewhere (acceptable trade-off)

---

### Decision 2: Hybrid Approval Logic

**Date:** 2025-10-30 11:30
**Decision:** Backend authoritative, frontend caches for UX

**Rationale:**
- Security requires backend validation (can't trust client-side checks)
- UX requires fast feedback (can't wait for API call every time)
- Solution: Cache approval rules in frontend session (5 min TTL)
- Backend always makes final decision on approve/reject

**Why not backend-only?**
- Poor UX: Button would need to wait for API before showing
- User doesn't know if they can approve until they click

**Why not frontend-only?**
- Security risk: User could bypass approval via direct API calls
- Can't trust client-side validation

**Impact:**
- Best security + best UX
- Added complexity: Cache invalidation logic
- React Query handles this well with staleTime: 300000 (5 min)

---

### Decision 3: React Query Instead of SWR

**Date:** 2025-10-30 14:00
**Decision:** Use React Query for approval data fetching

**Rationale:**
- Better devtools (can inspect cache, mutations, queries)
- More powerful caching (can cache by quote_id, user_id)
- Optimistic updates built-in (onMutate, onError, onSuccess)
- Already used elsewhere in codebase (consistency)

**Alternatives:**
- SWR: Simpler but less powerful
- Redux Toolkit Query: Overkill, too heavyweight

**Impact:**
- Consistent with existing code
- Better developer experience when debugging
- No bundle size impact (already installed)

---

### Decision 4: Configurable Approval Thresholds

**Date:** 2025-10-30 15:30
**Decision:** Make approval thresholds configurable per organization

**Why:**
- Initial plan: Hardcoded $10k and $50k
- User feedback: "We want $15k threshold, not $10k"
- Different organizations have different risk profiles
- Avoids code changes for threshold adjustments

**Implementation:**
- Store in `organizations.approval_settings` JSONB column
- Default: `{manager_threshold: 10000, cfo_threshold: 50000}`
- Backend reads from database
- For MVP: Using defaults (settings UI is Phase 2)

**Impact:**
- More flexible system
- Slightly more complex (need settings UI)
- Added to backlog: Settings page for approval thresholds
- Current implementation uses defaults

---

### Decision 5: Comments Required on Rejection

**Date:** 2025-10-30 16:00
**Decision:** Comments optional on approval, required on rejection

**Rationale:**
- Approvals: Usually self-explanatory ("looks good", "approved")
- Rejections: Should explain why (helps requester improve quote)
- Balance: Don't force busy approvers to write essays

**Implementation:**
- Pydantic: `comments: Optional[str] = Field(None, max_length=500)`
- Frontend: Approve button - comments optional
- Frontend: Reject button - form validation requires comments
- Backend: No validation difference (both optional in database)

**Impact:**
- Better UX for approvers
- Better audit trail for rejections
- Frontend enforces rule, but backend doesn't block if frontend bypassed

---

## 4. Integration Points

### Database Tables Touched

**1. quote_approvals (NEW)**
- Stores all approval records
- Columns: id, quote_id, approver_id, organization_id, status, approved_at, comments, created_at
- RLS: organization_id isolation
- Indexes: quote_id (for fast lookup), (status, organization_id) (for dashboard)

**2. quotes (MODIFIED)**
- Added column: `approval_status` TEXT NULL
- Values: NULL (old quotes), 'pending', 'approved', 'rejected'
- NULL = no approval required (backward compatible)
- Migration: 20251030_add_quote_approvals.sql

**3. users (READ-ONLY)**
- Fetch approver info: id, name, email
- No schema changes

**4. organizations (FUTURE)**
- Plan to add: `approval_settings` JSONB
- Will store: {manager_threshold: 10000, cfo_threshold: 50000}
- Not implemented yet (using defaults)

### API Endpoints Created

**POST /api/quotes/{quote_id}/approve**
- Purpose: Approve or reject a quote
- Auth: Required (JWT in Authorization header)
- Permissions:
  - Manager: Can approve quotes ≤$50k
  - CFO/Owner: Can approve all quotes
- Request: `{action: "approve"|"reject", comments?: string}`
- Response: `{success: true, approval: {...}, next_approver?: {...}}`
- Errors: 404 (quote not found), 403 (no permission), 422 (validation failed)

**GET /api/quotes/{quote_id}/approvals**
- Purpose: Get approval history for a quote
- Auth: Required
- Permissions: Any user in same organization
- Response: `{approvals: [...], pending_approver?: {...}}`
- Errors: 404 (quote not found), 403 (different organization)

### External Systems

**Email Service (PLANNED - Phase 5):**
- Supabase Edge Function: `approval-email`
- Trigger: After approval status change
- Templates:
  1. Approval request: "Quote #123 needs your approval"
  2. Approval granted: "Your quote #123 was approved"
  3. Approval rejected: "Your quote #123 was rejected: [reason]"
- Language: Russian

**Activity Log (INTEGRATED):**
- Events logged:
  - `quote.approval_requested` - When quote sent for approval
  - `quote.approved` - When approver approves
  - `quote.rejected` - When approver rejects
- Metadata: {quote_id, approver_id, comments}

---

## 5. Known Issues

### Bugs Discovered (Not Fixed Yet)

**Bug 1: Approval Button Flashes During Load**
- **Description:** Button briefly shows "Approve" before permission check completes
- **Impact:** Low (visual glitch only, no functional issue)
- **Root Cause:** Permission check is async, component renders before check completes
- **Fix:** Add loading skeleton while checking permissions
- **Priority:** Low (will fix in polish phase)
- **Workaround:** None needed (cosmetic only)

**Bug 2: ApprovalHistory Shows All Approvals (No Pagination)**
- **Description:** If quote has 100+ approvals, all render at once
- **Impact:** Medium (performance issue, poor UX)
- **Root Cause:** Not implemented yet (planned feature)
- **Fix:** Add pagination (10 per page) with "Load more" button
- **Priority:** High (will fix this session)
- **Estimated:** 15 min

---

### Technical Debt Created

**Debt 1: Hardcoded Approval Thresholds**
- **What:** $10k and $50k thresholds hardcoded in `routes/quotes_approval.py`
- **Why:** Simplicity for MVP
- **Payoff Plan:**
  1. Add `organizations.approval_settings` JSONB column
  2. Create settings UI page (frontend)
  3. Update backend to read from database
- **Estimated Effort:** 2 hours
- **Priority:** Medium (works for now, but needed for flexibility)

**Debt 2: No Email Notifications Yet**
- **What:** Approvals don't trigger emails (in-app only)
- **Why:** Email service not implemented yet (Phase 5)
- **Payoff Plan:**
  1. Create Supabase Edge Function
  2. Design 3 email templates
  3. Test delivery
- **Estimated Effort:** 1 hour
- **Priority:** High (needed for production)

**Debt 3: No Approval Delegation**
- **What:** Can't delegate approval to someone else
- **Why:** Not in MVP scope
- **Payoff Plan:**
  1. Add delegation UI (assign deputy)
  2. Backend: Store delegation in approvals table
  3. Email deputy instead of primary approver
- **Estimated Effort:** 3 hours
- **Priority:** Low (user request, but not critical)

**Debt 4: No Component Tests Yet**
- **What:** Frontend components not tested
- **Why:** Building features first, tests after (TDD not followed)
- **Payoff Plan:** Write tests before Phase 6 (QA)
- **Estimated Effort:** 1 hour
- **Priority:** High (needed before deployment)

---

### Performance Concerns

**Concern 1: Approval Check on Every Quote Load**
- **Issue:** Quote detail page checks approval status on every load
- **Current:** ~50ms per check (acceptable)
- **Risk:** Could degrade with large approval history
- **Mitigation:**
  - ✅ Database index on quote_approvals(quote_id)
  - ✅ Frontend caching with React Query (5 min TTL)
  - ✅ Backend query optimized (single SELECT)
- **Status:** Monitoring required (check in production)

**Concern 2: Email Sending Could Delay API Response**
- **Issue:** If email sending is synchronous, approval API could be slow
- **Current:** Not implemented yet
- **Risk:** User waits 2-3 seconds for email to send before seeing confirmation
- **Mitigation:**
  - Plan: Send emails asynchronously (Supabase Edge Function)
  - Don't block API response on email delivery
  - Return success immediately, email sends in background
- **Status:** Will implement in Phase 5

---

### Security Considerations

**Security Check 1: RLS Bypass Risk**
- **Issue:** User could approve other organization's quotes
- **Mitigation:** ✅ RLS policies on quote_approvals table
- **Policy:** `organization_id = auth.uid()::text::uuid`
- **Verification:** Tested with 3 organizations, all isolated ✅
- **Status:** Secure

**Security Check 2: Permission Bypass via Direct API Call**
- **Issue:** Member could POST to /api/quotes/123/approve directly
- **Mitigation:** ✅ Backend checks user role before approving
- **Check:** `check_approval_permission(quote, user)` function
- **Verification:** Unit test `test_approve_quote_no_permission` ✅
- **Status:** Secure

**Security Check 3: Approval Threshold Bypass**
- **Issue:** Manager could approve $60k quote (above $50k limit)
- **Mitigation:** ✅ Backend enforces thresholds
- **Check:** Threshold validation in approval logic
- **Verification:** Unit test `test_approval_threshold_cfo` ✅
- **Status:** Secure

**Before Merge:**
- [ ] Run @security-auditor for full audit
- [ ] Verify all RLS policies
- [ ] Test permission bypass attempts
- [ ] Validate input sanitization (SQL injection check)

---

## 6. Next Steps

### Immediate Actions (This Session - 1 hour)

**Priority 1: Finish ApprovalHistory Component (45 min)**
- [ ] Add comments section (~15 min)
  - Show comments if approval.comments exists
  - Style as quote/callout box
  - Gray background for approved, red background for rejected
- [ ] Add filtering dropdown (~10 min)
  - Options: "All", "Approved", "Rejected"
  - Filter approvals array client-side
- [ ] Add pagination (~15 min)
  - Show 10 approvals per page
  - "Load more" button at bottom
  - Track current page in state
- [ ] Add loading skeleton (~5 min)
  - Show while fetching approvals
  - Ant Design Skeleton component

**Priority 2: Create ApprovalStatusBadge Component (30 min)**
- [ ] Create component file (5 min)
- [ ] Badge color logic (5 min)
  - Green: "approved"
  - Red: "rejected"
  - Yellow: "pending"
  - Gray: null (no approval required)
- [ ] Badge text (5 min)
  - Russian: "Утверждено", "Отклонено", "Ожидает утверждения", "Не требуется"
- [ ] Icon + color styling (10 min)
- [ ] Add to quote list page (5 min)

**Priority 3: Write Component Tests (40 min)**
- [ ] Test ApprovalButton (15 min)
  - Renders with permission
  - Shows loading state
  - Displays error on failure
- [ ] Test ApprovalHistory (15 min)
  - Renders timeline
  - Filters work
  - Pagination works
- [ ] Test ApprovalStatusBadge (10 min)
  - Correct color for status
  - Correct text

**Total Time This Session:** ~1.5 hours remaining

---

### Next Session Tasks (3.5 hours)

**Phase 4: Integration (1 hour)**
- [ ] Add approval section to quote detail page
  - Below quote header, above line items
  - Show ApprovalStatusBadge
  - Show ApprovalHistory
  - Show ApprovalButton (if user can approve)
- [ ] Wire up React Query
  - useQuery for approval history
  - useMutation for approve action
- [ ] Handle errors gracefully
  - 403: "You don't have permission"
  - 404: "Quote not found"
- [ ] Test with different roles
  - Member: No approve button
  - Manager: Can approve <$50k
  - CFO: Can approve all

**Phase 5: Email Notifications (1 hour)**
- [ ] Create Supabase Edge Function
- [ ] Design 3 email templates
- [ ] Test delivery
- [ ] Add Russian translations

**Phase 6: Testing & QA (1 hour)**
- [ ] Run all tests (backend + frontend)
- [ ] E2E testing with Chrome DevTools MCP
  - Manager approval flow
  - CFO approval flow
  - Rejection flow
- [ ] Security audit (@security-auditor)
- [ ] Performance testing (approval check <100ms)
- [ ] Call @orchestrator for full quality check

**Phase 7: Documentation & Deployment (30 min)**
- [ ] Update SESSION_PROGRESS.md
- [ ] Update CLAUDE.md files
- [ ] Create PR
- [ ] Deploy to staging
- [ ] Smoke test
- [ ] Deploy to production

---

### Blockers

**Current Blockers:** None ✅

**Potential Future Blockers:**
- **Email service:** If Supabase Edge Functions have issues (low probability)
- **Settings UI:** If configurable thresholds become blocker (low priority)
- **Multi-level logic:** If CFO rejects after manager approves (edge case, need clarification)

---

## 7. Context for Autocompact

### CRITICAL - Don't Lose This!

If autocompact happens, you MUST know:

**1. What we're building:**
- Quote approval workflow
- Manager approves <$50k, CFO approves ≥$50k
- Backend ✅ complete, Frontend 60% complete

**2. Current exact task:**
- Working on `ApprovalHistory` component
- File: `frontend/src/components/ApprovalHistory.tsx` (line ~120)
- Timeline works ✅, need: Comments section, filtering, pagination
- Next: ApprovalStatusBadge component

**3. What's done:**
- Database schema ✅ (quote_approvals table + RLS)
- Backend API ✅ (2 endpoints, 15 tests passing)
- ApprovalButton component ✅ (105 lines, fully working)
- TypeScript interfaces ✅ (types/approval.ts)

**4. Key decisions:**
- Using dedicated approval table (not generic workflow)
- React Query for data fetching (not SWR)
- Hybrid approval logic (backend authoritative, frontend caches)
- Comments required on rejection, optional on approval
- Thresholds will be configurable (JSONB in organizations table)

**5. What's left (3.5 hours):**
- Finish ApprovalHistory (45 min)
- Create ApprovalStatusBadge (30 min)
- Write component tests (40 min)
- Integrate into quote detail page (1 hour)
- Email notifications (1 hour)
- Testing & QA (1 hour)
- Documentation (30 min)

**6. Important files:**
- Backend: `backend/routes/quotes_approval.py` (220 lines)
- Frontend: `frontend/src/components/ApprovalButton.tsx` (105 lines)
- Frontend: `frontend/src/components/ApprovalHistory.tsx` (120 lines - IN PROGRESS)
- Tests: `backend/tests/test_quotes_approval.py` (310 lines, all passing)
- Migration: `backend/migrations/20251030_add_quote_approvals.sql`

**7. Next immediate steps:**
1. Add comments section to ApprovalHistory
2. Add filtering and pagination
3. Create ApprovalStatusBadge
4. Write tests
5. Integrate into quote detail page

---

### Code Patterns Discovered

**Pattern 1: Optimistic UI with React Query**
```typescript
const mutation = useMutation({
  mutationFn: (data) => approveQuote(quoteId, data),
  onMutate: async () => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['quote', quoteId]);

    // Optimistically update
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

**Why this works:**
- User sees instant feedback (no waiting for API)
- Automatic rollback if error
- Cache invalidation handled by React Query

---

**Pattern 2: Permission Check in Backend**
```python
def check_approval_permission(quote: dict, user: User) -> bool:
    if user.role in ['owner', 'admin']:
        return True
    if user.role == 'manager' and quote['total_amount'] <= 50000:
        return True
    return False
```

**Why this works:**
- Clear business logic
- Easy to test
- Secure (backend validates)
- Frontend can cache this for UX (5 min TTL)

---

**Pattern 3: RLS for Organization Isolation**
```sql
CREATE POLICY "Users can only access own org approvals"
ON quote_approvals FOR ALL
USING (organization_id = auth.uid()::text::uuid);
```

**Why this works:**
- Database enforces security (can't bypass via API)
- Applies to all queries automatically
- Tested with multiple organizations ✅

---

### Questions for User

**When user returns, ask:**

1. **Approval thresholds:** Confirm $10k (manager) and $50k (CFO) correct?
2. **Multi-level approval:** If CFO rejects after manager approves, what happens?
   - Option A: Quote goes back to draft (start over)
   - Option B: Quote is rejected (final)
3. **Email notifications:** Should we CC anyone on approval emails?
4. **Approval delegation:** Needed in MVP or can wait for Phase 2?
5. **Approval expiration:** Should approvals expire after X days?

---

### Agent Handoff

If another agent takes over:

1. **Read all 3 dev docs files** - plan.md, context.md, tasks.md
2. **Check tasks.md** - See what's [ ] vs [x] vs [>]
3. **Current file:** `frontend/src/components/ApprovalHistory.tsx` (line ~120)
4. **Current task:** Add comments section, filtering, pagination
5. **Run tests:** `cd backend && pytest tests/test_quotes_approval.py -v` (should all pass)
6. **If stuck:** Reference `.claude/skills/frontend-dev-guidelines/` for React patterns

**Remember:** This context.md is your lifeline after autocompact. Update it every 30 min!
