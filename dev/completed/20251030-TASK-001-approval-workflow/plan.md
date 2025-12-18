# Quote Approval Workflow - Implementation Plan

**Task ID:** TASK-001
**Created:** 2025-10-30
**Status:** In Progress (Phase 3 of 7)
**Owner:** frontend-dev
**Estimated Time:** 7.5 hours
**Last Updated:** 2025-10-30 16:00

---

## 1. Objective

### What Problem Are We Solving?

Currently, quotes go directly from "draft" to "final" without any approval process. This creates risk because:
- Junior managers can approve large deals without oversight
- No audit trail for who approved what
- CFO/owner can't review quotes before they're sent to customers
- Compliance issues for deals over certain thresholds

### Why Is This Important?

- **Compliance:** Financial regulations require approval trail for deals >$10k
- **Risk management:** Prevents unauthorized commitments
- **Business intelligence:** Track approval patterns and bottlenecks
- **Quality control:** Catch pricing errors before customer sees quote

### Success Criteria (Measurable)

- [x] Quotes >$10k require manager approval before sending
- [x] Quotes >$50k require CFO/owner approval
- [x] Full audit trail showing who approved, when, and why
- [ ] Approval emails sent to next approver automatically
- [ ] Dashboard shows pending approvals count
- [ ] All tests pass (unit + integration + E2E)
- [ ] Performance: Approval check <100ms
- [ ] RLS verified: Users can't approve other orgs' quotes

---

## 2. Technical Approach

### Architecture Decisions

**Decision 1: Dedicated Approval Table vs Generic Workflow Engine**

**Options considered:**
1. Single approval table with polymorphic relationships
2. **Dedicated quote_approvals table** ← SELECTED
3. Generic workflow engine

**Decision:** Dedicated `quote_approvals` table

**Rationale:**
- Only need approvals for quotes (not orders, invoices, etc.)
- Generic workflow engine is over-engineering (YAGNI)
- Can refactor later if we need approvals for other entities
- Simpler to test and debug
- Faster development (saves ~2 hours)

---

**Decision 2: Approval Logic Location**

**Options considered:**
1. Frontend-only: Client-side approval checks
2. Backend-only: All logic in API
3. **Hybrid: Backend authoritative, frontend caches for UX** ← SELECTED

**Decision:** Hybrid approach

**Rationale:**
- Security requires backend validation (can't trust client)
- UX requires fast feedback (can't wait for API on every check)
- Compromise: Cache approval rules in frontend session (5 min TTL)
- Backend always makes final decision on approve/reject

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
3. **Activity Log** - Log approval events
4. **Email Service** - New approval notification template

**API Contracts:**

**POST /api/quotes/{quote_id}/approve**
```json
Request: {"action": "approve"|"reject", "comments": "Optional"}
Response: {
  "success": true,
  "approval": {...},
  "next_approver": null | {...}
}
```

**GET /api/quotes/{quote_id}/approvals**
```json
Response: {
  "approvals": [{...}],
  "pending_approver": null | {...}
}
```

---

## 3. Implementation Plan

### Phase 1: Database Setup (30 min) ✅ COMPLETE

- [x] Create migration file
- [x] Create `quote_approvals` table
- [x] Add `approval_status` column to `quotes`
- [x] Create indexes
- [x] Add RLS policies
- [x] Test RLS with multiple orgs

**Status:** Complete
**Actual time:** 35 min (5 min over due to RLS complexity)

---

### Phase 2: Backend API (1.5 hours) ✅ COMPLETE

- [x] Create `routes/quotes_approval.py`
- [x] Implement approve endpoint
- [x] Implement list endpoint
- [x] Add permission checks
- [x] Add threshold logic ($10k, $50k)
- [x] Write Pydantic models
- [x] Add error handling
- [x] Write 10 unit tests
- [x] Write 5 integration tests

**Status:** Complete
**Actual time:** 1h 45min (15 min over due to extra tests)
**Files created:** `routes/quotes_approval.py` (220 lines), `tests/test_quotes_approval.py` (310 lines)

---

### Phase 3: Frontend Components (2 hours) ⚙️ IN PROGRESS (60%)

- [x] Create TypeScript interfaces
- [x] Create `ApprovalButton` component
- [x] Implement approval modal
- [x] Add loading states
- [x] Add optimistic UI
- [x] Styling
- [x] Russian localization
- [>] Create `ApprovalHistory` component (CURRENT TASK)
- [ ] Create `ApprovalStatusBadge` component
- [ ] Write component tests

**Status:** In Progress
**Time spent:** 1h 30min
**Remaining:** 1h

---

### Phase 4: Integration (1 hour) ❌ NOT STARTED

- [ ] Add approval section to quote detail page
- [ ] Wire up components with React Query
- [ ] Test end-to-end flow
- [ ] Handle edge cases

**Dependencies:** Phase 3 complete

---

### Phase 5: Email Notifications (1 hour) ❌ NOT STARTED

- [ ] Create Supabase Edge Function
- [ ] Design email templates (3 types)
- [ ] Test email delivery
- [ ] Add Russian translations

**Dependencies:** Phase 2 complete (can run in parallel with Phase 3/4)

---

### Phase 6: Testing & QA (1 hour) ❌ NOT STARTED

- [ ] Run all backend tests
- [ ] Run all frontend tests
- [ ] E2E testing (3 scenarios)
- [ ] Security audit
- [ ] Performance testing
- [ ] Call @orchestrator

**Dependencies:** Phases 1-5 complete

---

### Phase 7: Documentation (30 min) ❌ NOT STARTED

- [ ] Update SESSION_PROGRESS.md
- [ ] Update CLAUDE.md files
- [ ] Create PR
- [ ] Deploy

**Dependencies:** Phase 6 complete

---

## 4. Risks & Mitigation

### Technical Risks

**Race Condition (Multiple Approvals)**
- **Probability:** Low
- **Impact:** High
- **Mitigation:** Database unique constraint, optimistic locking

**Email Delivery Failure**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:** Retry mechanism, in-app notifications as backup

**Performance Degradation**
- **Probability:** Low
- **Impact:** Medium
- **Mitigation:** Database indexes, caching, async checks

### Timeline Risks

**Scope Creep**
- **Probability:** High
- **Impact:** High
- **Mitigation:** MVP only (basic approve/reject), defer delegation/escalation

**Integration Issues**
- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Review existing quote state machine, backward compatibility

---

## 5. Testing Strategy

### Backend Tests (15 tests)

**Unit tests:** 10 tests in `test_quotes_approval.py`
- Happy path approval
- Permission checks
- Threshold validation
- RLS isolation
- Duplicate approval prevention

**Integration tests:** 5 tests
- Full approval flow
- Multi-level approval chain
- Email trigger
- Activity log integration
- Quote status update

**Coverage target:** >90%

### Frontend Tests (3 tests)

**Component tests:**
- ApprovalButton: Permission, loading, errors
- ApprovalHistory: Timeline rendering
- ApprovalStatusBadge: Color coding

**Coverage target:** >80%

### E2E Tests (3 scenarios)

1. Manager approves <$50k quote
2. CFO approves >$50k quote
3. Rejection flow with comments

**Tool:** Chrome DevTools MCP (headless mode)

---

## 6. Rollback Plan

### If Approval System Fails

**Immediate Response:**
1. Disable approval checks via feature flag
2. All quotes bypass approval (revert to old behavior)
3. Investigate and fix
4. Re-enable gradually

**Feature Flag:**
```python
APPROVAL_ENABLED = os.getenv("FEATURE_APPROVAL_ENABLED", "true") == "true"
```

**Database Rollback:**
```sql
ALTER TABLE quotes DROP COLUMN approval_status;
DROP TABLE quote_approvals;
```

**Breaking Changes:** None (approval is additive)
- Old quotes: NULL approval_status (no approval required)
- New quotes: Can have approval status
- API backward compatible

---

## 7. References

### Skills
- `.claude/skills/frontend-dev-guidelines/` - React patterns
- `.claude/skills/backend-dev-guidelines/` - FastAPI patterns
- `.claude/skills/database-verification/` - RLS checklist

### Documentation
- `.claude/SESSION_PROGRESS.md`
- `frontend/CLAUDE.md`
- `backend/CLAUDE.md`
- `.claude/TESTING_WORKFLOW.md`

---

## 8. Post-Implementation Notes

### Decisions Made During Implementation

**2025-10-30 11:30 - React Query over SWR**
- Reason: Better devtools, more powerful caching
- Impact: Consistent with existing code

**2025-10-30 14:00 - Configurable Thresholds**
- Original: Hardcoded $10k/$50k
- Changed: Store in organizations.approval_settings
- Reason: User feedback, flexibility
- Impact: Add to backlog (settings UI)

**2025-10-30 15:30 - Comments Required on Rejection**
- Approvals: Comments optional
- Rejections: Comments required
- Reason: Better audit trail for rejections
- Impact: Validation in frontend and backend

### Lessons Learned

- RLS policies more complex than expected (30 min → 45 min)
- Email delivery needs retry mechanism (added to Phase 5)
- Users want threshold configuration (add to backlog)

### Follow-Up Tasks

- [ ] Add approval delegation (assign to deputy)
- [ ] Add approval expiration (auto-reject after 7 days)
- [ ] Add approval analytics (approval rate, time to approve)
- [ ] Add bulk approval (multiple quotes at once)
- [ ] Settings UI for configurable thresholds
