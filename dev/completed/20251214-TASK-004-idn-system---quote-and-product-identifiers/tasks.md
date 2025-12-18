# IDN System - Quote and Product Identifiers - Task Checklist

**Task ID:** TASK-004
**Last Updated:** 2025-12-14 16:15
**Total Tasks:** 28 (0 completed, 28 remaining)
**Progress:** 0%
**Session:** Session 49

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

**Completed:** 0 tasks
**In Progress:** 0 tasks
**Blocked:** 0 tasks
**Remaining:** 28 tasks

**Estimated Time Remaining:** 4-5 hours

---

## Phase 1: Database Migration

**Status:** Not Started ❌
**Estimated:** 30 min

### Tasks

- [ ] Create migration file `041_add_idn_system.sql`
  - Owner: backend-dev
  - Notes: Replaces quote_number with idn

- [ ] Add `supplier_code VARCHAR(3)` to organizations
  - Owner: backend-dev
  - Dependencies: Migration file created

- [ ] Add `idn_counters JSONB DEFAULT '{}'` to organizations
  - Owner: backend-dev
  - Dependencies: Migration file created

- [ ] Rename `quote_number` column to `idn` in quotes table
  - Owner: backend-dev
  - Dependencies: Migration file created
  - Notes: Use ALTER TABLE RENAME COLUMN

- [ ] Add `idn_sku TEXT` to quote_items
  - Owner: backend-dev
  - Dependencies: Migration file created

- [ ] Update unique indexes for idn
  - Owner: backend-dev
  - Dependencies: Column changes done

- [ ] Update MIGRATIONS.md
  - Owner: backend-dev
  - Dependencies: Migration complete

---

## Phase 2: Backend IDN Service

**Status:** Not Started ❌
**Estimated:** 1 hour

### Tasks

- [ ] Create `services/idn_service.py`
  - Owner: backend-dev
  - Dependencies: Phase 1 complete

- [ ] Implement `generate_quote_idn()` with atomic counter
  - Owner: backend-dev
  - Dependencies: Service file created
  - Notes: Use SELECT FOR UPDATE for locking

- [ ] Implement `generate_idn_sku()` for items
  - Owner: backend-dev
  - Dependencies: Service file created

- [ ] Add validation for supplier_code (3 uppercase letters)
  - Owner: backend-dev
  - Dependencies: Service file created

- [ ] Add validation for INN format (10 or 12 digits)
  - Owner: backend-dev
  - Dependencies: Service file created

- [ ] Write unit tests for IDN service
  - Owner: qa-tester
  - Dependencies: Service complete
  - Estimated: 30 min

---

## Phase 3: Quote Creation Integration

**Status:** Not Started ❌
**Estimated:** 45 min

### Tasks

- [ ] Update `routes/quotes.py` to use IDN instead of quote_number
  - Owner: backend-dev
  - Dependencies: Phase 2 complete

- [ ] Fetch client INN from customer on quote creation
  - Owner: backend-dev
  - Dependencies: Quotes route updated

- [ ] Call IDN service to generate IDN
  - Owner: backend-dev
  - Dependencies: IDN service complete

- [ ] Generate IDN-SKU for all items after creation
  - Owner: backend-dev
  - Dependencies: IDN service complete

- [ ] Handle missing INN with clear error message
  - Owner: backend-dev
  - Dependencies: Integration complete

- [ ] Handle missing supplier_code with clear error message
  - Owner: backend-dev
  - Dependencies: Integration complete

---

## Phase 4: Organization Settings API

**Status:** Not Started ❌
**Estimated:** 30 min

### Tasks

- [ ] Add supplier_code to organization response model
  - Owner: backend-dev
  - Dependencies: Phase 1 complete

- [ ] Add PUT endpoint for supplier_code update (admin only)
  - Owner: backend-dev
  - Dependencies: Response model updated

- [ ] Validate supplier_code uniqueness across orgs
  - Owner: backend-dev
  - Dependencies: Endpoint created

---

## Phase 5: Frontend - Admin UI

**Status:** Not Started ❌
**Estimated:** 45 min

### Tasks

- [ ] Add supplier_code field to organization settings page
  - Owner: frontend-dev
  - Dependencies: Phase 4 complete

- [ ] Add 3-letter uppercase input validation
  - Owner: frontend-dev
  - Dependencies: Field added

- [ ] Show current IDN counter (read-only info)
  - Owner: frontend-dev
  - Dependencies: Field added

---

## Phase 6: Frontend - Display IDN

**Status:** Not Started ❌
**Estimated:** 45 min

### Tasks

- [ ] Update quote list to show IDN column (was quote_number)
  - Owner: frontend-dev
  - Dependencies: Backend changes complete

- [ ] Update quote detail header to show IDN
  - Owner: frontend-dev
  - Dependencies: Backend changes complete

- [ ] Add IDN-SKU column to products table (ag-Grid)
  - Owner: frontend-dev
  - Dependencies: Backend changes complete

---

## Phase 7: Testing & QA

**Status:** Not Started ❌
**Estimated:** 30 min

### Tasks

- [ ] Test IDN generation end-to-end
  - Owner: integration-tester
  - Dependencies: All phases complete

- [ ] Test concurrent quote creation (race condition)
  - Owner: integration-tester
  - Dependencies: All phases complete

- [ ] Test error cases (no INN, no supplier_code)
  - Owner: integration-tester
  - Dependencies: All phases complete

---

## Phase 8: Documentation

**Status:** Not Started ❌
**Estimated:** 15 min

### Tasks

- [ ] Update backend/CLAUDE.md with IDN service
  - Owner: code-reviewer
  - Dependencies: All phases complete

- [ ] Update SESSION_PROGRESS.md
  - Owner: code-reviewer
  - Dependencies: All phases complete

- [ ] Commit and push
  - Owner: user
  - Dependencies: All docs updated

---

## Blocked Tasks

**Currently:** No blocked tasks ✅

---

## Task Dependencies Graph

```
Phase 1 (Database)
    ↓
Phase 2 (IDN Service)
    ↓
Phase 3 (Quote Integration)
    ↓
    ├── Phase 4 (Org API)
    │       ↓
    │   Phase 5 (Admin UI)
    │
    └── Phase 6 (Display IDN)
            ↓
        Phase 7 (Testing)
            ↓
        Phase 8 (Docs)
```

**Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 6 → Phase 7 → Phase 8

**Parallel Opportunities:**
- Phase 4 & 5 (Admin UI) can run in parallel with Phase 6

---

## Key Decision: IDN Replaces quote_number

**Decision:** IDN replaces quote_number entirely
**Rationale:** User preference - single identifier is simpler
**Impact:**
- Rename column instead of adding new one
- Update all references to quote_number
- Existing quotes will need migration (new IDN format)

---

**Last Updated:** 2025-12-14 16:15
