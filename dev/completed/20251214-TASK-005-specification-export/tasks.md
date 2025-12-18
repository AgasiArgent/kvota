# TASK-005: Specification Export - Task Checklist

**Task ID:** TASK-005
**Last Updated:** 2025-12-14 14:30
**Total Tasks:** 38 (0 completed, 38 remaining)
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
**Remaining:** 38 tasks

**Estimated Time Remaining:** 6-8 hours

---

## Phase 1: Database Migration (30 min)

**Status:** Complete ✅
**Estimated:** 30 min
**Actual:** 10 min

### Tasks

- [x] Create migration file 045_specification_export.sql
  - Completed: 2025-12-14 14:45
  - Notes: Added customer_contracts, specification_exports tables, altered customers and organizations
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min

- [ ] Create customer_contracts table with all columns
  - Owner: backend-dev
  - Dependencies: Migration file
  - Estimated: 5 min
  - Notes: contract_number, contract_date, status, next_specification_number

- [ ] Alter customers table - add signatory fields
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min
  - Notes: general_director_name, general_director_position

- [ ] Alter customers table - add warehouse_addresses JSONB
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min
  - Notes: JSONB array of {name, address}

- [ ] Alter organizations table - add business info (inn, kpp, ogrn)
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min

- [ ] Alter organizations table - add signatory fields
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min
  - Notes: general_director_name, general_director_position, registration_address

- [ ] Add RLS policies for customer_contracts
  - Owner: backend-dev
  - Dependencies: Table created
  - Estimated: 10 min

- [ ] Add indexes for performance
  - Owner: backend-dev
  - Dependencies: All tables created
  - Estimated: 5 min

---

## Phase 2: Backend - Data Models & CRUD (1 hour)

**Status:** Not Started
**Estimated:** 1 hour

### Tasks

- [ ] Create CustomerContract Pydantic models (Create, Update, Response)
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 10 min

- [ ] Create routes/customer_contracts.py - list contracts for customer
  - Owner: backend-dev
  - Dependencies: Pydantic models
  - Estimated: 10 min

- [ ] Create routes/customer_contracts.py - create contract
  - Owner: backend-dev
  - Dependencies: List endpoint
  - Estimated: 10 min

- [ ] Create routes/customer_contracts.py - update contract
  - Owner: backend-dev
  - Dependencies: Create endpoint
  - Estimated: 10 min

- [ ] Create routes/customer_contracts.py - delete contract
  - Owner: backend-dev
  - Dependencies: Update endpoint
  - Estimated: 5 min

- [ ] Update CustomerUpdate model - add signatory and warehouse fields
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min

- [ ] Update OrganizationUpdate model - add business info and signatory
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min

- [ ] Register customer_contracts router in main.py
  - Owner: backend-dev
  - Dependencies: Router complete
  - Estimated: 5 min

---

## Phase 3: Backend - DOCX Export (2 hours)

**Status:** Not Started
**Estimated:** 2 hours

### Tasks

- [ ] Install python-docx and num2words packages
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 5 min
  - Notes: pip install python-docx num2words

- [ ] Create backend/templates/ directory
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 2 min

- [ ] Create specification_template.docx with placeholders
  - Owner: backend-dev
  - Dependencies: Templates dir
  - Estimated: 20 min
  - Notes: Use user's template, replace text with placeholders

- [ ] Create services/specification_export_service.py - init
  - Owner: backend-dev
  - Dependencies: Template file
  - Estimated: 10 min

- [ ] Implement number_to_russian_words() function
  - Owner: backend-dev
  - Dependencies: num2words installed
  - Estimated: 15 min
  - Notes: Handle rubles, kopecks, and currency names

- [ ] Implement currency_to_russian_text() mapping
  - Owner: backend-dev
  - Dependencies: None
  - Estimated: 10 min
  - Notes: USD -> "долларах США", EUR -> "евро", RUB -> "рублях"

- [ ] Implement gather_specification_data() - collect all variables
  - Owner: backend-dev
  - Dependencies: Service init
  - Estimated: 20 min
  - Notes: Fetch quote, customer, contract, org, calculate totals

- [ ] Implement replace_variables_in_docx()
  - Owner: backend-dev
  - Dependencies: Data gathering
  - Estimated: 20 min
  - Notes: Find/replace all [Placeholder] in template

- [ ] Implement fill_products_table() for product rows
  - Owner: backend-dev
  - Dependencies: Variable replacement
  - Estimated: 15 min
  - Notes: Add rows to products table in template

- [ ] Create routes/specification_export.py - export endpoint
  - Owner: backend-dev
  - Dependencies: Export service
  - Estimated: 15 min
  - Notes: POST /api/quotes/{id}/export/specification

- [ ] Implement validation for required fields
  - Owner: backend-dev
  - Dependencies: Export endpoint
  - Estimated: 10 min
  - Notes: Return list of missing fields if incomplete

- [ ] Return DOCX as file download
  - Owner: backend-dev
  - Dependencies: All above
  - Estimated: 10 min
  - Notes: StreamingResponse with proper headers

---

## Phase 4: Frontend - Contract Management UI (1.5 hours)

**Status:** Not Started
**Estimated:** 1.5 hours

### Tasks

- [ ] Create TypeScript interfaces for Contract
  - Owner: frontend-dev
  - Dependencies: None
  - Estimated: 5 min
  - Notes: Contract, ContractCreate, ContractUpdate

- [ ] Create ContractsList.tsx component
  - Owner: frontend-dev
  - Dependencies: TypeScript interfaces
  - Estimated: 20 min
  - Notes: Table with contract number, date, status, spec count

- [ ] Create ContractModal.tsx - create/edit dialog
  - Owner: frontend-dev
  - Dependencies: ContractsList
  - Estimated: 25 min
  - Notes: Form with contract number, date, notes

- [ ] Create WarehouseAddresses.tsx - JSONB array editor
  - Owner: frontend-dev
  - Dependencies: None
  - Estimated: 20 min
  - Notes: Add/remove warehouse addresses dynamically

- [ ] Add contracts section to customer detail page
  - Owner: frontend-dev
  - Dependencies: ContractsList, ContractModal
  - Estimated: 15 min

- [ ] Add signatory fields to customer form
  - Owner: frontend-dev
  - Dependencies: None
  - Estimated: 10 min
  - Notes: General director name and position fields

- [ ] Add org business info to organization settings
  - Owner: frontend-dev
  - Dependencies: None
  - Estimated: 15 min
  - Notes: INN, KPP, OGRN, registration address, signatory

---

## Phase 5: Frontend - Export Flow (1.5 hours)

**Status:** Not Started
**Estimated:** 1.5 hours

### Tasks

- [ ] Create SpecificationExportModal.tsx
  - Owner: frontend-dev
  - Dependencies: All Phase 4 components
  - Estimated: 30 min
  - Notes: Multi-step modal: contract -> missing data -> warehouse -> export

- [ ] Implement contract selection step
  - Owner: frontend-dev
  - Dependencies: Modal created
  - Estimated: 15 min
  - Notes: Select from existing contracts or create new

- [ ] Implement missing data form step
  - Owner: frontend-dev
  - Dependencies: Contract selection
  - Estimated: 20 min
  - Notes: Show form fields for any missing data

- [ ] Implement warehouse address selection
  - Owner: frontend-dev
  - Dependencies: Missing data form
  - Estimated: 10 min
  - Notes: Select or add warehouse address for delivery

- [ ] Implement DOCX download handler
  - Owner: frontend-dev
  - Dependencies: All steps
  - Estimated: 10 min
  - Notes: POST to API, download blob as .docx file

- [ ] Add "Export Specification" button to quote detail
  - Owner: frontend-dev
  - Dependencies: Modal complete
  - Estimated: 5 min
  - Notes: Only show for accepted quotes

---

## Phase 6: Testing & QA (1 hour)

**Status:** Not Started
**Estimated:** 1 hour

### Tasks

- [ ] Test contract CRUD endpoints
  - Owner: qa-tester
  - Dependencies: Phase 2 complete
  - Estimated: 10 min

- [ ] Test DOCX generation with sample data
  - Owner: qa-tester
  - Dependencies: Phase 3 complete
  - Estimated: 15 min
  - Notes: Verify all placeholders replaced correctly

- [ ] Test num2words Russian output correctness
  - Owner: qa-tester
  - Dependencies: Phase 3 complete
  - Estimated: 10 min
  - Notes: Check various amounts, currencies

- [ ] Test missing data prompts and auto-save
  - Owner: qa-tester
  - Dependencies: Phase 5 complete
  - Estimated: 15 min
  - Notes: Data should save to customer/contract records

- [ ] Test RLS - contracts isolated by organization
  - Owner: security-auditor
  - Dependencies: All phases complete
  - Estimated: 10 min

---

## Phase 7: Documentation (30 min)

**Status:** Not Started
**Estimated:** 30 min

### Tasks

- [ ] Update backend/CLAUDE.md with new endpoints
  - Owner: docs
  - Dependencies: All code complete
  - Estimated: 10 min

- [ ] Update SESSION_PROGRESS.md
  - Owner: docs
  - Dependencies: Feature complete
  - Estimated: 10 min

- [ ] Archive dev-docs to completed/
  - Owner: docs
  - Dependencies: All tests pass
  - Estimated: 5 min
  - Notes: mv dev/active/TASK-005 dev/completed/

---

## Blocked Tasks

**Currently:** None

---

## Completed Tasks Archive

(Move completed tasks here with completion date)

---

## Task Dependencies Graph

```
Phase 1 (Database)
    ↓
Phase 2 (Backend CRUD)
    ↓
Phase 3 (Backend DOCX Export)
    ↓
Phase 4 (Frontend Contracts UI)
    ↓
Phase 5 (Frontend Export Flow)
    ↓
Phase 6 (Testing)
    ↓
Phase 7 (Documentation)
```

**Critical Path:** All phases are sequential

**Parallel Opportunities:**
- Phase 4 frontend work can start once API contract is defined (mock API)
- Multiple frontend components can be built in parallel

---

## Notes

- Specification number auto-increments per contract (stored in customer_contracts.next_specification_number)
- Warehouse addresses stored as JSONB: `[{"name": "Основной склад", "address": "..."}, ...]`
- Organization business info (inn, kpp, ogrn) should also support Dadata auto-fill in future
- VAT is 20% in Russia - always calculate: price_with_vat = price * 1.2

---

**Last Updated:** 2025-12-14 14:30
