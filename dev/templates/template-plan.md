# [Task Name] - Implementation Plan

**Task ID:** TASK-###
**Created:** YYYY-MM-DD
**Status:** Planning / In Progress / Blocked / Complete
**Owner:** [Agent name or User]
**Estimated Time:** X hours
**Last Updated:** YYYY-MM-DD

---

## 1. Objective

### What Problem Are We Solving?

[Describe the problem or need this task addresses]

**Example:**
Currently, quotes go directly from "draft" to "final" without any approval process. This creates risk because:
- Junior managers can approve large deals without oversight
- No audit trail for who approved what
- CFO/owner can't review quotes before they're sent to customers

### Why Is This Important?

[Business value, user impact, or technical necessity]

**Example:**
- **Compliance:** Financial regulations require approval trail for deals >$10k
- **Risk management:** Prevents unauthorized commitments
- **Business intelligence:** Track approval patterns and bottlenecks

### Success Criteria (Measurable)

[How do we know when this is complete and successful?]

**Example:**
- [ ] Quotes >$10k require manager approval before sending
- [ ] Quotes >$50k require CFO/owner approval
- [ ] Full audit trail showing who approved, when, and why
- [ ] Approval emails sent to next approver automatically
- [ ] Dashboard shows pending approvals count
- [ ] All tests pass (unit + integration + E2E)
- [ ] Performance: Approval check <100ms
- [ ] RLS verified: Users can't approve other orgs' quotes

---

## 2. Technical Approach

### Architecture Decisions

**[Decision 1: Component Architecture]**

**Options considered:**
1. **Option A:** Single approval table with polymorphic relationships
   - Pros: Flexible, extensible to other entities
   - Cons: Complex queries, harder to optimize
2. **Option B:** Dedicated quote_approvals table
   - Pros: Simple, optimized for quotes, clear schema
   - Cons: Duplicate code if we add approvals to other entities
3. **Option C:** Generic workflow engine
   - Pros: Reusable across all entities
   - Cons: Over-engineered for current needs, longer dev time

**Decision:** Option B (dedicated table)

**Rationale:**
- Current need is quote approvals only
- Premature abstraction is costly
- Can refactor to generic workflow later if needed (YAGNI principle)
- Simpler to test and debug

---

**[Decision 2: Approval Logic Location]**

**Options considered:**
1. **Frontend-only:** Client-side approval checks
   - Pros: Fast UI feedback
   - Cons: Insecure, can be bypassed
2. **Backend-only:** All logic in API
   - Pros: Secure, single source of truth
   - Cons: Need API call for every check
3. **Hybrid:** Backend authoritative, frontend caches for UX
   - Pros: Secure + fast UX
   - Cons: More complex, cache invalidation needed

**Decision:** Hybrid approach

**Rationale:**
- Security requires backend validation
- UX requires fast feedback (optimistic UI)
- Cache approval rules in frontend session (5 min TTL)
- Backend always makes final decision

---

### Technologies Used

**Backend:**
- FastAPI endpoint: `POST /api/quotes/{id}/approve`
- Pydantic models: `ApprovalRequest`, `ApprovalResponse`
- Database: New table `quote_approvals` with RLS
- Email: Supabase Edge Function for approval notifications

**Frontend:**
- Page: `/app/quotes/[id]/approval` (Next.js 15)
- Components: `ApprovalButton`, `ApprovalHistory`, `ApprovalStatusBadge`
- State: React Query for caching approval status
- UI: Ant Design Modal for approval confirmation

**Database Schema:**
```sql
CREATE TABLE quote_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quote_approvals_quote_id ON quote_approvals(quote_id);
CREATE INDEX idx_quote_approvals_status ON quote_approvals(status, organization_id);
```

---

### Integration Points

**Systems Touched:**
1. **Quotes Table** - Add `approval_status` column
2. **Users Table** - Read for approver info
3. **Calculation Engine** - No changes (approval is post-calculation)
4. **Email Service** - New approval notification template
5. **Activity Log** - Log approval events

**API Contracts:**

**Endpoint:** `POST /api/quotes/{quote_id}/approve`

**Request:**
```json
{
  "action": "approve" | "reject",
  "comments": "Optional approval comments"
}
```

**Response:**
```json
{
  "success": true,
  "approval": {
    "id": "uuid",
    "status": "approved",
    "approved_at": "2025-10-30T10:30:00Z",
    "approver": {
      "id": "uuid",
      "name": "John Smith"
    }
  },
  "next_approver": null | {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

**Endpoint:** `GET /api/quotes/{quote_id}/approvals`

**Response:**
```json
{
  "approvals": [
    {
      "id": "uuid",
      "approver": {"id": "uuid", "name": "John Smith"},
      "status": "approved",
      "approved_at": "2025-10-30T10:30:00Z",
      "comments": "Approved - good margin"
    }
  ],
  "pending_approver": null | {"id": "uuid", "name": "Jane Doe"}
}
```

---

### Data Models

**Pydantic Models (Backend):**

```python
class ApprovalAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"

class ApprovalRequest(BaseModel):
    action: ApprovalAction
    comments: Optional[str] = Field(None, max_length=500)

class ApprovalResponse(BaseModel):
    id: str
    quote_id: str
    approver_id: str
    approver_name: str
    status: str
    approved_at: Optional[datetime]
    comments: Optional[str]

class ApprovalListResponse(BaseModel):
    approvals: List[ApprovalResponse]
    pending_approver: Optional[Dict[str, str]]
```

**TypeScript Interfaces (Frontend):**

```typescript
interface Approval {
  id: string;
  quoteId: string;
  approver: {
    id: string;
    name: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  comments?: string;
}

interface ApprovalRequest {
  action: 'approve' | 'reject';
  comments?: string;
}

interface ApprovalListResponse {
  approvals: Approval[];
  pendingApprover?: {
    id: string;
    name: string;
    email: string;
  };
}
```

---

## 3. Implementation Plan

### Phase 1: Database Setup (30 min)

**Tasks:**
- [ ] Create migration file `20251030_add_quote_approvals.sql`
- [ ] Create `quote_approvals` table with schema
- [ ] Add `approval_status` column to `quotes` table
- [ ] Create indexes for performance
- [ ] Add RLS policies (organization isolation)
- [ ] Test RLS with multiple orgs

**Dependencies:** None

**Parallel Execution:** Can run independently

**Files Modified:**
- `backend/migrations/20251030_add_quote_approvals.sql` (new)
- `backend/migrations/MIGRATIONS.md` (update log)

---

### Phase 2: Backend API (1.5 hours)

**Tasks:**
- [ ] Create `routes/quotes_approval.py` with 2 endpoints
- [ ] Implement `POST /api/quotes/{id}/approve` handler
- [ ] Implement `GET /api/quotes/{id}/approvals` handler
- [ ] Add permission checks (can user approve this quote?)
- [ ] Add business logic (threshold checks: $10k, $50k)
- [ ] Add email notification trigger
- [ ] Write Pydantic models for request/response
- [ ] Add error handling (404, 403, 422)
- [ ] Write unit tests (10 tests)
- [ ] Write API tests (5 integration tests)

**Dependencies:** Phase 1 (database must exist)

**Parallel Execution:** Can start after Phase 1

**Files Modified:**
- `backend/routes/quotes_approval.py` (new, ~200 lines)
- `backend/tests/test_quotes_approval.py` (new, ~300 lines)
- `backend/main.py` (add router)

---

### Phase 3: Frontend Components (2 hours)

**Tasks:**
- [ ] Create `components/ApprovalButton.tsx`
- [ ] Create `components/ApprovalHistory.tsx`
- [ ] Create `components/ApprovalStatusBadge.tsx`
- [ ] Add TypeScript interfaces
- [ ] Implement approval modal (Ant Design)
- [ ] Add loading states and error handling
- [ ] Add optimistic UI updates
- [ ] Style components (match existing design)
- [ ] Add Russian localization
- [ ] Write component tests (3 tests)

**Dependencies:** Phase 2 (API must exist)

**Parallel Execution:** Can work on components while API is being built (mock API responses)

**Files Modified:**
- `frontend/src/components/ApprovalButton.tsx` (new, ~100 lines)
- `frontend/src/components/ApprovalHistory.tsx` (new, ~150 lines)
- `frontend/src/components/ApprovalStatusBadge.tsx` (new, ~50 lines)
- `frontend/src/types/approval.ts` (new, ~30 lines)

---

### Phase 4: Quote Detail Page Integration (1 hour)

**Tasks:**
- [ ] Add approval section to quote detail page
- [ ] Show approval status badge
- [ ] Show approval history
- [ ] Show approval button (if user can approve)
- [ ] Add React Query for data fetching
- [ ] Handle permission errors gracefully
- [ ] Add loading skeleton
- [ ] Test with different user roles

**Dependencies:** Phase 3 (components must exist)

**Parallel Execution:** Must run after Phase 3

**Files Modified:**
- `frontend/src/app/quotes/[id]/page.tsx` (modify, +50 lines)

---

### Phase 5: Email Notifications (1 hour)

**Tasks:**
- [ ] Create Supabase Edge Function for emails
- [ ] Design approval request email template
- [ ] Design approval granted email template
- [ ] Design approval rejected email template
- [ ] Add Russian translations
- [ ] Test email delivery
- [ ] Add email logging

**Dependencies:** Phase 2 (backend triggers emails)

**Parallel Execution:** Can build in parallel with Phase 3/4

**Files Modified:**
- `supabase/functions/approval-email/index.ts` (new, ~100 lines)

---

### Phase 6: Testing & QA (1 hour)

**Tasks:**
- [ ] Run all backend tests
- [ ] Run all frontend tests
- [ ] E2E test: Manager approves quote
- [ ] E2E test: CFO approves high-value quote
- [ ] E2E test: Rejection flow
- [ ] E2E test: Approval email received
- [ ] Security test: User can't approve other org's quotes
- [ ] Security test: User can't bypass approval via API
- [ ] Performance test: Approval check <100ms
- [ ] Call @orchestrator for quality checks

**Dependencies:** All phases 1-5 complete

**Parallel Execution:** Must run sequentially after implementation

**Files Modified:**
- None (testing only)

---

### Phase 7: Documentation & Deployment (30 min)

**Tasks:**
- [ ] Update `.claude/SESSION_PROGRESS.md`
- [ ] Add approval docs to `frontend/CLAUDE.md`
- [ ] Add approval docs to `backend/CLAUDE.md`
- [ ] Update user guide (if exists)
- [ ] Commit changes with descriptive message
- [ ] Create PR (if using feature branch)
- [ ] Deploy to staging
- [ ] Smoke test in staging
- [ ] Deploy to production

**Dependencies:** Phase 6 (tests must pass)

**Parallel Execution:** Must run last

**Files Modified:**
- `.claude/SESSION_PROGRESS.md`
- `frontend/CLAUDE.md`
- `backend/CLAUDE.md`

---

## 4. Risks & Mitigation

### Technical Risks

**Risk 1: Race Condition (Multiple Approvals)**
- **Description:** Two managers approve same quote simultaneously
- **Probability:** Low
- **Impact:** High (data corruption)
- **Mitigation:**
  - Database unique constraint on (quote_id, approver_id)
  - Optimistic locking with version column
  - Backend checks approval doesn't already exist

**Risk 2: Email Delivery Failure**
- **Description:** Approval email not sent/received
- **Probability:** Medium
- **Impact:** Medium (approval delayed)
- **Mitigation:**
  - Retry mechanism (3 attempts)
  - Log all email attempts
  - In-app notification as backup
  - Dashboard shows pending approvals

**Risk 3: Performance Degradation**
- **Description:** Approval checks slow down quote operations
- **Probability:** Low
- **Impact:** Medium (poor UX)
- **Mitigation:**
  - Database indexes on approval_status
  - Cache approval rules in memory
  - Async approval checks where possible
  - Monitor query performance

### Timeline Risks

**Risk 1: Scope Creep**
- **Description:** Users request additional approval features
- **Probability:** High
- **Impact:** High (delays delivery)
- **Mitigation:**
  - MVP: Basic approve/reject only
  - Phase 2: Multi-level approvals
  - Phase 3: Delegation, escalation
  - Document future enhancements separately

**Risk 2: Integration Issues**
- **Description:** Approval conflicts with existing quote workflows
- **Probability:** Medium
- **Impact:** High (breaks existing features)
- **Mitigation:**
  - Review existing quote state machine
  - Add approval state to existing states (don't replace)
  - Backward compatibility for old quotes
  - Feature flag for gradual rollout

---

## 5. Testing Strategy

### Unit Tests (Backend)

**File:** `backend/tests/test_quotes_approval.py`

**Tests:**
1. `test_approve_quote_success` - Happy path
2. `test_approve_quote_not_found` - 404 error
3. `test_approve_quote_no_permission` - 403 error
4. `test_approve_quote_wrong_org` - RLS check
5. `test_reject_quote_with_comments` - Rejection flow
6. `test_approval_requires_auth` - 401 check
7. `test_approval_threshold_manager` - $10k threshold
8. `test_approval_threshold_cfo` - $50k threshold
9. `test_duplicate_approval_rejected` - Idempotency
10. `test_get_approval_history` - List approvals

**Coverage Target:** >90%

---

### Integration Tests (Backend)

**File:** `backend/tests/test_quotes_approval_integration.py`

**Tests:**
1. `test_full_approval_flow` - Create quote → Approve → Check status
2. `test_multi_level_approval` - Manager → CFO approval chain
3. `test_approval_email_triggered` - Email sent on approval request
4. `test_activity_log_created` - Approval logged to activity table
5. `test_quote_status_updated` - Quote.approval_status changes

**Coverage Target:** All integration points tested

---

### Component Tests (Frontend)

**File:** `frontend/src/components/__tests__/ApprovalButton.test.tsx`

**Tests:**
1. `renders approve button when user has permission`
2. `shows loading state during approval`
3. `displays error message on approval failure`

**Coverage Target:** >80% (UI components)

---

### E2E Tests (Browser Automation)

**File:** `.claude/tests/e2e/test_approval_workflow.md`

**Scenarios:**
1. **Manager Approval Flow:**
   - Create quote >$10k
   - Login as manager
   - Approve quote
   - Verify status updated
   - Verify email sent

2. **CFO Approval Flow:**
   - Create quote >$50k
   - Manager approves
   - Login as CFO
   - Approve quote
   - Verify final approval

3. **Rejection Flow:**
   - Create quote
   - Reject with comments
   - Verify quote status = rejected
   - Verify comments saved

**Tool:** Chrome DevTools MCP (headless mode)

---

### Manual Testing Scenarios

**Scenario 1: Permission Testing**
- [ ] Member can't approve quotes
- [ ] Manager can approve <$50k quotes
- [ ] CFO/Owner can approve all quotes

**Scenario 2: UI Testing**
- [ ] Approval button disabled for unauthorized users
- [ ] Approval modal shows correct threshold info
- [ ] Approval history shows all approvals chronologically
- [ ] Status badge shows correct color/text

**Scenario 3: Error Handling**
- [ ] 404 error if quote doesn't exist
- [ ] 403 error if user can't approve
- [ ] Network error handled gracefully
- [ ] Optimistic UI rolls back on error

---

## 6. Rollback Plan

### If Approval System Fails in Production

**Immediate Response:**
1. Disable approval checks via feature flag
2. All quotes bypass approval (revert to old behavior)
3. Investigate root cause
4. Fix issue
5. Re-enable gradually (by organization)

**Feature Flag:**
```python
# backend/config.py
APPROVAL_ENABLED = os.getenv("FEATURE_APPROVAL_ENABLED", "true") == "true"
```

**Database Rollback:**
```sql
-- If we need to remove approval system entirely:
ALTER TABLE quotes DROP COLUMN approval_status;
DROP TABLE quote_approvals;
```

**Data Migration Rollback:**
- All quotes created before approval feature: `approval_status = NULL`
- NULL means "approval not required" (backward compatible)
- Can re-enable approval without data migration

---

### Breaking Changes

**None expected** - Approval is additive feature:
- Old quotes: NULL approval_status (no approval required)
- New quotes: Can have approval status
- API backward compatible (approval endpoints are new)

---

## 7. References

### Skills

- `.claude/skills/frontend-dev-guidelines/` - React/Next.js patterns
- `.claude/skills/backend-dev-guidelines/` - FastAPI patterns
- `.claude/skills/database-verification/` - RLS checklist

### Documentation

- `.claude/SESSION_PROGRESS.md` - Track this task's progress
- `frontend/CLAUDE.md` - Frontend tech stack
- `backend/CLAUDE.md` - Backend tech stack
- `.claude/TESTING_WORKFLOW.md` - Automated testing guide

### External Resources

- [FastAPI Authentication](https://fastapi.tiangolo.com/tutorial/security/)
- [Ant Design Modal](https://ant.design/components/modal/)
- [Supabase RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [React Query](https://tanstack.com/query/latest)

---

## 8. Post-Implementation Notes

### Decisions Made During Implementation

[Update this section as you make decisions during implementation]

**Example:**
- Decided to use React Query instead of SWR (better devtools)
- Changed approval threshold from $10k to $15k (user feedback)
- Added approval_deadline column (not in original plan)

### Lessons Learned

[Update after task complete]

**Example:**
- RLS policies more complex than expected (2 hours instead of 30 min)
- Email delivery needs retry mechanism (added in Phase 5)
- Users want approval delegation (add to backlog)

### Follow-Up Tasks

[Tasks discovered during implementation that should be done later]

**Example:**
- [ ] Add approval delegation (assign approver to someone else)
- [ ] Add approval expiration (auto-reject after 7 days)
- [ ] Add approval analytics (approval rate, time to approve)
- [ ] Add bulk approval (approve multiple quotes at once)

---

**Remember:** This plan is a living document. Update it as you learn more during implementation.
