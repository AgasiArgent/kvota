# [Task Name] - Task Checklist

**Task ID:** TASK-###
**Last Updated:** YYYY-MM-DD HH:MM
**Total Tasks:** ## (## completed, ## remaining)
**Progress:** ##%
**Session:** Session ##

---

## Task Status Legend

```
[ ] Not started
[>] In progress (currently working on)
[~] Awaiting verification (done but needs user confirmation)
[x] Complete (verified)
[!] Blocked (waiting on something)
[-] Skipped (decided not to do)
```

---

## Summary

**Completed:** ## tasks
**In Progress:** ## tasks
**Blocked:** ## tasks
**Remaining:** ## tasks

**Estimated Time Remaining:** ## hours

---

## Phase 1: Database Setup

**Status:** Complete ✅
**Estimated:** 30 min
**Actual:** 35 min

### Tasks

- [x] Create migration file `20251030_add_quote_approvals.sql`
  - Owner: backend-dev
  - Completed: 2025-10-30 10:15
  - Notes: Added RLS policies, indexes

- [x] Create `quote_approvals` table with schema
  - Owner: backend-dev
  - Completed: 2025-10-30 10:20
  - Dependencies: None
  - Notes: Schema matches plan exactly

- [x] Add `approval_status` column to `quotes` table
  - Owner: backend-dev
  - Completed: 2025-10-30 10:25
  - Dependencies: None
  - Notes: NULL for backward compatibility

- [x] Create indexes for performance
  - Owner: backend-dev
  - Completed: 2025-10-30 10:28
  - Dependencies: Tables created
  - Notes: Indexes on quote_id and (status, organization_id)

- [x] Add RLS policies (organization isolation)
  - Owner: backend-dev
  - Completed: 2025-10-30 10:32
  - Dependencies: Table created
  - Notes: Policy: organization_id = auth.uid()

- [x] Test RLS with multiple orgs
  - Owner: security-auditor
  - Completed: 2025-10-30 10:45
  - Dependencies: RLS policies
  - Notes: Tested with 3 orgs, all isolated correctly ✅

---

## Phase 2: Backend API

**Status:** Complete ✅
**Estimated:** 1.5 hours
**Actual:** 1.75 hours (extra time for tests)

### Tasks

- [x] Create `routes/quotes_approval.py` with 2 endpoints
  - Owner: backend-dev
  - Completed: 2025-10-30 11:30
  - Dependencies: Database schema
  - Notes: 220 lines, well-structured

- [x] Implement `POST /api/quotes/{id}/approve` handler
  - Owner: backend-dev
  - Completed: 2025-10-30 11:45
  - Dependencies: Router created
  - Notes: Handles approve and reject actions

- [x] Implement `GET /api/quotes/{id}/approvals` handler
  - Owner: backend-dev
  - Completed: 2025-10-30 12:00
  - Dependencies: Router created
  - Notes: Returns approval history + pending approver

- [x] Add permission checks (can user approve this quote?)
  - Owner: backend-dev
  - Completed: 2025-10-30 12:15
  - Dependencies: Endpoint logic
  - Notes: check_approval_permission() function

- [x] Add business logic (threshold checks: $10k, $50k)
  - Owner: backend-dev
  - Completed: 2025-10-30 12:30
  - Dependencies: Permission checks
  - Notes: Manager ≤$50k, CFO/Owner all amounts

- [x] Add email notification trigger
  - Owner: backend-dev
  - Completed: 2025-10-30 12:35
  - Dependencies: Approval logic
  - Notes: Placeholder for now (Phase 5 will implement)

- [x] Write Pydantic models for request/response
  - Owner: backend-dev
  - Completed: 2025-10-30 12:50
  - Dependencies: None
  - Notes: ApprovalRequest, ApprovalResponse, ApprovalListResponse

- [x] Add error handling (404, 403, 422)
  - Owner: backend-dev
  - Completed: 2025-10-30 13:00
  - Dependencies: Endpoint logic
  - Notes: Proper HTTP status codes with error messages

- [x] Write unit tests (10 tests)
  - Owner: qa-tester
  - Completed: 2025-10-30 13:45
  - Dependencies: API complete
  - Notes: All 10 tests passing ✅

- [x] Write API tests (5 integration tests)
  - Owner: integration-tester
  - Completed: 2025-10-30 14:15
  - Dependencies: Unit tests
  - Notes: All 5 tests passing ✅

---

## Phase 3: Frontend Components

**Status:** In Progress ⚙️
**Estimated:** 2 hours
**Actual:** 1.5 hours so far (1 hour remaining)

### Tasks

- [x] Create `components/ApprovalButton.tsx`
  - Owner: frontend-dev
  - Completed: 2025-10-30 15:00
  - Dependencies: TypeScript interfaces
  - Notes: 105 lines, includes modal, loading states

- [>] Create `components/ApprovalHistory.tsx`
  - Owner: frontend-dev
  - Status: In progress (60% complete)
  - Started: 2025-10-30 15:30
  - Dependencies: TypeScript interfaces
  - Notes: Timeline works, need comments/filtering/pagination
  - Estimated remaining: 45 min

- [ ] Create `components/ApprovalStatusBadge.tsx`
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: None
  - Estimated: 30 min
  - Notes: Simple badge component (green/red/yellow)

- [x] Add TypeScript interfaces
  - Owner: frontend-dev
  - Completed: 2025-10-30 14:45
  - Dependencies: None
  - Notes: types/approval.ts created (35 lines)

- [x] Implement approval modal (Ant Design)
  - Owner: frontend-dev
  - Completed: 2025-10-30 15:10
  - Dependencies: ApprovalButton component
  - Notes: Modal with approve/reject + comments field

- [x] Add loading states and error handling
  - Owner: frontend-dev
  - Completed: 2025-10-30 15:20
  - Dependencies: Approval modal
  - Notes: React Query handles loading, Button shows spinner

- [x] Add optimistic UI updates
  - Owner: frontend-dev
  - Completed: 2025-10-30 15:25
  - Dependencies: Error handling
  - Notes: React Query onMutate updates cache immediately

- [x] Style components (match existing design)
  - Owner: ux-reviewer
  - Completed: 2025-10-30 15:40
  - Dependencies: Components created
  - Notes: Matches quote detail page styling ✅

- [x] Add Russian localization
  - Owner: frontend-dev
  - Completed: 2025-10-30 15:50
  - Dependencies: Components created
  - Notes: All strings translated ("Утвердить", "Отклонить")

- [ ] Write component tests (3 tests)
  - Owner: qa-tester
  - Status: Not started
  - Dependencies: Components complete
  - Estimated: 40 min
  - Notes: Test ApprovalButton, ApprovalHistory, ApprovalStatusBadge

---

## Phase 4: Quote Detail Page Integration

**Status:** Not Started ❌
**Estimated:** 1 hour

### Tasks

- [ ] Add approval section to quote detail page
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: Phase 3 complete
  - Estimated: 20 min
  - Notes: Add below quote header, above line items

- [ ] Show approval status badge
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: ApprovalStatusBadge component
  - Estimated: 5 min

- [ ] Show approval history
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: ApprovalHistory component
  - Estimated: 10 min

- [ ] Show approval button (if user can approve)
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: ApprovalButton component
  - Estimated: 10 min

- [ ] Add React Query for data fetching
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: Components integrated
  - Estimated: 15 min
  - Notes: useQuery for approval history, useMutation for approve action

- [ ] Handle permission errors gracefully
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: React Query setup
  - Estimated: 10 min
  - Notes: Show message "You don't have permission" instead of button

- [ ] Add loading skeleton
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: Components integrated
  - Estimated: 5 min

- [ ] Test with different user roles
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: All integration complete
  - Estimated: 15 min
  - Notes: Test as member, manager, CFO, owner

---

## Phase 5: Email Notifications

**Status:** Not Started ❌
**Estimated:** 1 hour

### Tasks

- [ ] Create Supabase Edge Function for emails
  - Owner: backend-dev
  - Status: Not started
  - Dependencies: Backend approval endpoints
  - Estimated: 20 min
  - Notes: supabase/functions/approval-email/index.ts

- [ ] Design approval request email template
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: Edge function created
  - Estimated: 15 min
  - Notes: "Quote #123 needs your approval"

- [ ] Design approval granted email template
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: Edge function created
  - Estimated: 10 min
  - Notes: "Your quote #123 was approved"

- [ ] Design approval rejected email template
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: Edge function created
  - Estimated: 10 min
  - Notes: "Your quote #123 was rejected: [reason]"

- [ ] Add Russian translations
  - Owner: frontend-dev
  - Status: Not started
  - Dependencies: Email templates
  - Estimated: 10 min

- [ ] Test email delivery
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: All templates complete
  - Estimated: 10 min
  - Notes: Send test emails, check formatting

- [ ] Add email logging
  - Owner: backend-dev
  - Status: Not started
  - Dependencies: Email delivery works
  - Estimated: 5 min
  - Notes: Log to activity_log table

---

## Phase 6: Testing & QA

**Status:** Not Started ❌
**Estimated:** 1 hour

### Tasks

- [ ] Run all backend tests
  - Owner: qa-tester
  - Status: Not started
  - Dependencies: All backend code complete
  - Estimated: 5 min
  - Notes: cd backend && pytest -v

- [ ] Run all frontend tests
  - Owner: qa-tester
  - Status: Not started
  - Dependencies: All frontend code complete
  - Estimated: 5 min
  - Notes: cd frontend && npm test

- [ ] E2E test: Manager approves quote
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: All code complete
  - Estimated: 10 min
  - Notes: Use Chrome DevTools MCP

- [ ] E2E test: CFO approves high-value quote
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: Manager approval test
  - Estimated: 10 min

- [ ] E2E test: Rejection flow
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: Approval tests
  - Estimated: 10 min

- [ ] E2E test: Approval email received
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: Email system working
  - Estimated: 5 min

- [ ] Security test: User can't approve other org's quotes
  - Owner: security-auditor
  - Status: Not started
  - Dependencies: All code complete
  - Estimated: 5 min

- [ ] Security test: User can't bypass approval via API
  - Owner: security-auditor
  - Status: Not started
  - Dependencies: Security test 1
  - Estimated: 5 min

- [ ] Performance test: Approval check <100ms
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: All code complete
  - Estimated: 5 min

- [ ] Call @orchestrator for quality checks
  - Owner: orchestrator
  - Status: Not started
  - Dependencies: All tests passing
  - Estimated: 10 min
  - Notes: Auto-runs QA, Security, Review in parallel

---

## Phase 7: Documentation & Deployment

**Status:** Not Started ❌
**Estimated:** 30 min

### Tasks

- [ ] Update `.claude/SESSION_PROGRESS.md`
  - Owner: code-reviewer
  - Status: Not started
  - Dependencies: Task complete
  - Estimated: 5 min

- [ ] Add approval docs to `frontend/CLAUDE.md`
  - Owner: code-reviewer
  - Status: Not started
  - Dependencies: Feature complete
  - Estimated: 5 min
  - Notes: Document ApprovalButton, ApprovalHistory, ApprovalStatusBadge

- [ ] Add approval docs to `backend/CLAUDE.md`
  - Owner: code-reviewer
  - Status: Not started
  - Dependencies: Feature complete
  - Estimated: 5 min
  - Notes: Document approval endpoints, Pydantic models

- [ ] Update user guide (if exists)
  - Owner: User
  - Status: Not started
  - Dependencies: Feature complete
  - Estimated: 0 min (user responsibility)

- [ ] Commit changes with descriptive message
  - Owner: User
  - Status: Not started
  - Dependencies: All docs updated
  - Estimated: 2 min

- [ ] Create PR (if using feature branch)
  - Owner: User
  - Status: Not started
  - Dependencies: Committed
  - Estimated: 3 min

- [ ] Deploy to staging
  - Owner: User
  - Status: Not started
  - Dependencies: PR merged or commit pushed
  - Estimated: 5 min

- [ ] Smoke test in staging
  - Owner: integration-tester
  - Status: Not started
  - Dependencies: Deployed to staging
  - Estimated: 5 min

- [ ] Deploy to production
  - Owner: User
  - Status: Not started
  - Dependencies: Staging verified
  - Estimated: 5 min

---

## Completed Tasks Archive

**Note:** Tasks move here when marked [x]

### Phase 1: Database Setup (Complete ✅)
- [x] Create migration file - 2025-10-30 10:15
- [x] Create quote_approvals table - 2025-10-30 10:20
- [x] Add approval_status column - 2025-10-30 10:25
- [x] Create indexes - 2025-10-30 10:28
- [x] Add RLS policies - 2025-10-30 10:32
- [x] Test RLS - 2025-10-30 10:45

### Phase 2: Backend API (Complete ✅)
- [x] Create routes file - 2025-10-30 11:30
- [x] Implement approve endpoint - 2025-10-30 11:45
- [x] Implement list endpoint - 2025-10-30 12:00
- [x] Add permission checks - 2025-10-30 12:15
- [x] Add threshold logic - 2025-10-30 12:30
- [x] Add email trigger - 2025-10-30 12:35
- [x] Write Pydantic models - 2025-10-30 12:50
- [x] Add error handling - 2025-10-30 13:00
- [x] Write unit tests - 2025-10-30 13:45
- [x] Write integration tests - 2025-10-30 14:15

### Phase 3: Frontend Components (Partial ⚙️)
- [x] TypeScript interfaces - 2025-10-30 14:45
- [x] ApprovalButton component - 2025-10-30 15:00
- [x] Approval modal - 2025-10-30 15:10
- [x] Loading states - 2025-10-30 15:20
- [x] Optimistic UI - 2025-10-30 15:25
- [x] Styling - 2025-10-30 15:40
- [x] Russian localization - 2025-10-30 15:50

---

## Blocked Tasks

**Format:**
```
- [!] Task description
  - Blocked on: What's blocking this
  - Owner: Who can unblock
  - Since: When it got blocked
  - Notes: Additional context
```

**Currently:** No blocked tasks ✅

**Past Blockers (Resolved):**
- [x] Email notifications blocked on Supabase Edge Function setup
  - Resolution: Created placeholder, will implement in Phase 5
  - Resolved: 2025-10-30 12:35

---

## Task Dependencies Graph

**Visual representation of which tasks depend on others**

```
Phase 1 (Database)
    ↓
Phase 2 (Backend API)
    ↓
    ├── Phase 3 (Frontend) ← Can start in parallel with Phase 5
    │       ↓
    │   Phase 4 (Integration)
    │       ↓
    └── Phase 5 (Email) ← Independent of Phase 3/4
            ↓
        Phase 6 (Testing)
            ↓
        Phase 7 (Docs & Deploy)
```

**Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 6 → Phase 7

**Parallel Opportunities:**
- Phase 3 and Phase 5 can run in parallel (independent)
- Phase 3 tasks (3 components) can be built in parallel
- Tests in Phase 6 can run in parallel (unit, integration, E2E, security)

---

## Time Tracking

**Original Estimate:** 7.5 hours total

**Actual Time Spent:**
- Phase 1: 35 min (estimated 30 min) - 17% over
- Phase 2: 1h 45min (estimated 1.5h) - 17% over
- Phase 3: 1h 30min so far (estimated 2h) - On track
- **Total so far:** 3h 50min

**Remaining Estimate:**
- Phase 3: 1h (to finish ApprovalHistory + ApprovalStatusBadge + tests)
- Phase 4: 1h
- Phase 5: 1h
- Phase 6: 1h
- Phase 7: 30min
- **Total remaining:** 4.5h

**Revised Total Estimate:** 8.3 hours (original 7.5h + 0.8h overrun)

---

## Notes

**Tips for Using This File:**

1. **Update frequently** - Mark tasks [x] as you complete them
2. **Be honest with status** - [>] means actively working, not "plan to work on"
3. **Track time** - Actual vs estimated helps future planning
4. **Note blockers immediately** - Don't let them hide
5. **Archive completed tasks** - Keeps active list clean
6. **Update dependencies** - If task order changes, update graph

**Common Mistakes:**

- ❌ Marking [x] before user verifies (use [~] instead)
- ❌ Starting new task while another is [>] (finish first)
- ❌ Not updating "Last Updated" timestamp
- ❌ Forgetting to note who completed task (Owner)
- ❌ Not tracking actual time (can't improve estimates)

**Integration with Context.md:**

- **tasks.md** = What to do (checklist)
- **context.md** = Why and how (decisions, files)
- **plan.md** = Overall strategy (architecture)

All three files should stay in sync. Update all three regularly.

---

**Last Updated:** YYYY-MM-DD HH:MM
