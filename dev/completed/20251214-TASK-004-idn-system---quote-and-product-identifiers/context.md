# IDN System - Quote and Product Identifiers - Context

**Task ID:** TASK-004
**Last Updated:** 2025-12-14 16:00
**Session:** Session 49
**Current Phase:** Phase 1 of 8
**Status:** Planning Complete, Ready to Implement

---

## 1. Task Overview

### Quick Summary

Implementing IDN (Identification Number) system for quotes and products. Each quote gets a unique IDN combining supplier code, client INN, and yearly sequence. Each product gets an IDN-SKU based on quote IDN + position.

**Format:**
- Quote IDN: `CMT-1234567890-2025004525`
- Product IDN-SKU: `CMT-1234567890-2025004525-1`

### Current Phase Progress

**Phase 1: Database Migration** [❌ Not Started]
- [ ] Create migration file
- [ ] Add columns to tables
- [ ] Add indexes

**All other phases:** Not Started

### User Requirements

1. **Quote IDN Format:** `[SUPPLIER_CODE]-[CLIENT_INN]-[YEAR][SEQUENCE:05d]`
2. **Product IDN-SKU Format:** `[QUOTE_IDN]-[POSITION]`
3. **Generation timing:** On quote creation (auto-generate)
4. **Storage:** Organization settings (supplier_code field)
5. **Client INN source:** From customers table (existing field)

### Key Decisions Made (During Planning)

1. **Counter Storage:** Organizations table (not separate table)
   - Rationale: Only 5 orgs, simple counter is sufficient

2. **IDN Timing:** Generate on quote creation
   - Rationale: User preference, immediate visibility

3. **Counter Format:** JSONB for year-based counters
   - Rationale: Flexible, supports multi-year tracking

---

## 2. Code Inventory

### Files to Create

1. `backend/migrations/041_add_idn_system.sql` (~50 lines)
   - Add supplier_code to organizations
   - Add idn_counters JSONB to organizations
   - Add idn to quotes
   - Add idn_sku to quote_items
   - Add unique indexes

2. `backend/services/idn_service.py` (~100 lines)
   - generate_quote_idn() with atomic counter
   - generate_idn_sku() for items
   - Validation functions

3. `backend/tests/test_idn_service.py` (~150 lines)
   - Unit tests for IDN generation
   - Concurrency tests

### Files to Modify

1. `backend/routes/quotes.py` (+50 lines)
   - Call IDN service on quote creation
   - Generate IDN-SKU for items

2. `backend/routes/organizations.py` (+40 lines)
   - Add supplier_code to endpoints

3. `frontend/src/app/settings/organization/page.tsx` (+50 lines)
   - Supplier code management UI

4. `frontend/src/app/quotes/page.tsx` (+15 lines)
   - Show IDN column

5. `frontend/src/app/quotes/[id]/page.tsx` (+15 lines)
   - Show IDN in detail view

6. Quote grid configuration (+20 lines)
   - Show IDN-SKU column

**Total New Lines:** ~300 lines
**Total Modified Lines:** ~190 lines

---

## 3. Important Decisions Made

### Decision 1: Simple Counter in Organizations Table

**Date:** 2025-12-14
**Decision:** Store counter in `idn_counters` JSONB field in organizations

**Rationale:**
- Only ~5 organizations
- JSONB allows year-based tracking: `{"2024": 3200, "2025": 4525}`
- No need for separate sequences table
- Simpler queries and maintenance

**Alternative Rejected:** Separate idn_sequences table
- Too complex for current scale

### Decision 2: Auto-generate IDN on Quote Creation

**Date:** 2025-12-14
**Decision:** Generate IDN immediately when quote is created

**Rationale:**
- User requested this timing
- IDN visible immediately for reference
- Simpler flow (no separate "assign IDN" step)

**Alternative Rejected:** Generate on approval
- Would require additional workflow step
- User prefers immediate assignment

### Decision 3: Use SELECT FOR UPDATE for Counter

**Date:** 2025-12-14
**Decision:** Lock organization row during IDN generation

**Rationale:**
- Prevents race conditions with concurrent quotes
- PostgreSQL handles locking efficiently
- Unique index as final safeguard

---

## 4. Integration Points

### Systems Touched

1. **Organizations Table**
   - Add: `supplier_code VARCHAR(3)`
   - Add: `idn_counters JSONB DEFAULT '{}'`

2. **Quotes Table**
   - Add: `idn TEXT`
   - Add: Unique index on `(organization_id, idn)`

3. **Quote Items Table**
   - Add: `idn_sku TEXT`
   - Add: Unique index on `(quote_id, idn_sku)`

4. **Customers Table**
   - Read: `inn` field for IDN generation
   - No modifications

### Database Changes Summary

```sql
-- Organizations
ALTER TABLE organizations
ADD COLUMN supplier_code VARCHAR(3),
ADD COLUMN idn_counters JSONB DEFAULT '{}';

-- Quotes
ALTER TABLE quotes ADD COLUMN idn TEXT;
CREATE UNIQUE INDEX idx_quotes_idn ON quotes(organization_id, idn);

-- Quote Items
ALTER TABLE quote_items ADD COLUMN idn_sku TEXT;
CREATE UNIQUE INDEX idx_quote_items_idn_sku ON quote_items(quote_id, idn_sku);
```

---

## 5. Known Issues

### Potential Issues (Preventive)

**Issue 1: Customer Without INN**
- **Risk:** Quote creation fails if customer has no INN
- **Prevention:** Clear validation error message
- **Workaround:** Admin adds INN to customer first

**Issue 2: Org Without Supplier Code**
- **Risk:** Quote creation fails if org hasn't set supplier_code
- **Prevention:** Admin setup notification
- **Workaround:** Admin sets supplier_code in org settings

### Technical Debt

**None created yet** - Starting fresh implementation

---

## 6. Next Steps

### Immediate Actions (This Session)

**Phase 1: Database Migration**
1. [ ] Create `041_add_idn_system.sql`
2. [ ] Apply migration
3. [ ] Verify columns added

**Phase 2: Backend Service**
4. [ ] Create `services/idn_service.py`
5. [ ] Write unit tests
6. [ ] Test IDN generation

**Phase 3: Quote Integration**
7. [ ] Modify quote creation endpoint
8. [ ] Test end-to-end

---

## 7. Context for Autocompact

### Critical Information

**If autocompact happens, you MUST know:**

1. **What we're building:**
   - IDN system for quotes and products
   - Format: `SUPPLIER-INN-YEARSEQ` (e.g., `CMT-1234567890-2025004525`)
   - Products: `QUOTE_IDN-POSITION` (e.g., `CMT-1234567890-2025004525-1`)

2. **Current status:**
   - Planning complete
   - Ready to start Phase 1 (Database Migration)

3. **Key decisions:**
   - Counter stored in organizations.idn_counters JSONB
   - Auto-generate IDN on quote creation
   - Use SELECT FOR UPDATE for concurrency

4. **Files to create:**
   - `backend/migrations/041_add_idn_system.sql`
   - `backend/services/idn_service.py`
   - `backend/tests/test_idn_service.py`

5. **Supplier codes (known):**
   - MBR = МАСТЕР БЭРИНГ ООО
   - RAR = Рад Ресур ООО
   - CMT = ЦМТО1 ООО
   - GES = GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ
   - TEX = TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ

---

**Remember:** Update this context file after each phase completion!
