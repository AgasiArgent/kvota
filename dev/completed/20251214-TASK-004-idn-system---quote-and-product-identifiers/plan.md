# IDN System - Quote and Product Identifiers - Implementation Plan

**Task ID:** TASK-004
**Created:** 2025-12-14
**Status:** Planning
**Owner:** Claude
**Estimated Time:** 4-5 hours
**Last Updated:** 2025-12-14

---

## 1. Objective

### What Problem Are We Solving?

Currently, quotes and products lack standardized identification numbers for external tracking and compliance. The business needs:

1. **Quote-level IDN** - Unique identifier for each quote combining:
   - Supplier code (3-letter org identifier)
   - Client INN (tax identification number)
   - Sequential quote number per year

2. **Product-level IDN-SKU** - Unique identifier for each product in a quote:
   - Based on quote IDN + position number

### IDN Formula

```
[SUPPLIER_CODE]-[CLIENT_INN]-[UNIQUE_QUOTE_NUMBER]

Where:
- SUPPLIER_CODE: 3-letter uppercase code (MBR, RAR, CMT, GES, TEX, etc.)
- CLIENT_INN: 10-12 digit tax ID from customer
- UNIQUE_QUOTE_NUMBER: YYYYNNNNN (year + 5-digit padded sequence)

Example: CMT-1234567890-2025004525
```

### IDN-SKU Formula

```
[QUOTE_IDN]-[POSITION]

Examples:
- Position 1: CMT-1234567890-2025004525-1
- Position 2: CMT-1234567890-2025004525-2
- Position 3: CMT-1234567890-2025004525-3
```

### Supplier Code Mapping (Known)

| Company | Code |
|---------|------|
| МАСТЕР БЭРИНГ ООО | MBR |
| Рад Ресур ООО | RAR |
| ЦМТО1 ООО | CMT |
| GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ | GES |
| TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ | TEX |

*(Full list to be provided by Zhanna)*

### Why Is This Important?

- **Compliance:** Tax authorities require traceable identifiers
- **Logistics:** External systems need standardized SKU references
- **Customer communication:** Easy to reference specific products
- **Analytics:** Track quotes across organizations and years

### Success Criteria (Measurable)

- [ ] Each organization has a `supplier_code` field (3-letter uppercase)
- [ ] Quotes auto-generate IDN on creation
- [ ] IDN format: `{SUPPLIER_CODE}-{CLIENT_INN}-{YEAR}{SEQUENCE:05d}`
- [ ] Quote items auto-generate IDN-SKU as `{QUOTE_IDN}-{POSITION}`
- [ ] Admin UI allows managing organization supplier_code
- [ ] IDN and IDN-SKU visible in quote views and exports
- [ ] Sequential counter persists per organization per year
- [ ] All tests pass
- [ ] RLS verified

---

## 2. Technical Approach

### Architecture Decision: Counter in Organizations Table

**Options considered:**
1. **Option A (Chosen):** Counter stored in organizations table
   - Add `supplier_code VARCHAR(3)` column
   - Add `idn_counters JSONB` column for year-based counters
   - Pros: Simple, no extra tables, easy to query
   - Cons: Need atomic increment (use `SELECT FOR UPDATE`)

2. **Option B:** Separate idn_sequences table
   - Pros: More normalized, auditable history
   - Cons: Over-engineered for 5 organizations

**Decision:** Option A - Simple counter in organizations table

**Rationale:**
- Only ~5 organizations currently
- Counter per year stored as JSONB: `{"2024": 3200, "2025": 4525}`
- Atomic increment ensures no duplicates
- Can migrate to sequences later if needed

### Data Model Changes

**Organizations Table (Modified):**
```sql
ALTER TABLE organizations
ADD COLUMN supplier_code VARCHAR(3),
ADD COLUMN idn_counters JSONB DEFAULT '{}';

-- Example idn_counters value:
-- {"2024": 3200, "2025": 4525}
```

**Quotes Table (Modified):**
```sql
ALTER TABLE quotes
ADD COLUMN idn TEXT;

-- Unique constraint per organization
CREATE UNIQUE INDEX idx_quotes_idn ON quotes(organization_id, idn);
```

**Quote Items Table (Modified):**
```sql
ALTER TABLE quote_items
ADD COLUMN idn_sku TEXT;

-- Unique constraint per quote
CREATE UNIQUE INDEX idx_quote_items_idn_sku ON quote_items(quote_id, idn_sku);
```

### IDN Generation Logic

```python
async def generate_quote_idn(
    conn: asyncpg.Connection,
    organization_id: UUID,
    client_inn: str
) -> str:
    """
    Generate IDN with atomic counter increment.
    Uses SELECT FOR UPDATE to prevent race conditions.
    """
    current_year = datetime.now().year

    # Lock row and get current counter
    org = await conn.fetchrow("""
        SELECT supplier_code, idn_counters
        FROM organizations
        WHERE id = $1
        FOR UPDATE
    """, organization_id)

    if not org['supplier_code']:
        raise ValueError("Organization supplier_code not set")

    # Get current counter for year, default 0
    counters = org['idn_counters'] or {}
    current = counters.get(str(current_year), 0)
    new_counter = current + 1

    # Update counter
    counters[str(current_year)] = new_counter
    await conn.execute("""
        UPDATE organizations
        SET idn_counters = $1
        WHERE id = $2
    """, json.dumps(counters), organization_id)

    # Generate IDN
    sequence = f"{current_year}{new_counter:05d}"  # 2025004525
    idn = f"{org['supplier_code']}-{client_inn}-{sequence}"

    return idn
```

### IDN-SKU Generation

```python
def generate_idn_sku(quote_idn: str, position: int) -> str:
    """Generate product-level IDN-SKU"""
    return f"{quote_idn}-{position}"
```

---

## 3. Implementation Plan

### Phase 1: Database Migration (30 min)

**Tasks:**
- [ ] Create migration `041_add_idn_system.sql`
- [ ] Add `supplier_code` VARCHAR(3) to organizations
- [ ] Add `idn_counters` JSONB to organizations
- [ ] Add `idn` TEXT to quotes
- [ ] Add `idn_sku` TEXT to quote_items
- [ ] Add unique indexes for IDN lookup
- [ ] Update MIGRATIONS.md

**Files:**
- `backend/migrations/041_add_idn_system.sql` (new, ~50 lines)
- `backend/migrations/MIGRATIONS.md` (+15 lines)

---

### Phase 2: Backend IDN Service (1 hour)

**Tasks:**
- [ ] Create `services/idn_service.py`
- [ ] Implement `generate_quote_idn()` with atomic counter
- [ ] Implement `generate_idn_sku()` for items
- [ ] Handle concurrent quote creation (database locking)
- [ ] Add validation for supplier_code (3 uppercase letters)
- [ ] Add validation for INN format (10 or 12 digits)
- [ ] Write unit tests

**Files:**
- `backend/services/idn_service.py` (new, ~100 lines)
- `backend/tests/test_idn_service.py` (new, ~150 lines)

---

### Phase 3: Quote Creation Integration (45 min)

**Tasks:**
- [ ] Modify `routes/quotes.py` create endpoint
- [ ] Auto-fetch client INN from customer record
- [ ] Call IDN service to generate IDN on quote creation
- [ ] Generate IDN-SKU for all items after creation
- [ ] Handle missing INN (validation error)
- [ ] Handle missing supplier_code (validation error)

**Files Modified:**
- `backend/routes/quotes.py` (+50 lines)

---

### Phase 4: Organization Settings API (30 min)

**Tasks:**
- [ ] Add supplier_code to organization endpoints
- [ ] Create endpoint GET/PUT `/api/organizations/{id}/settings`
- [ ] Validate supplier_code uniqueness across orgs
- [ ] Admin-only access for updates

**Files Modified:**
- `backend/routes/organizations.py` (+40 lines)

---

### Phase 5: Frontend - Admin UI (45 min)

**Tasks:**
- [ ] Add supplier_code field to org settings page
- [ ] 3-letter uppercase input with validation
- [ ] Show current IDN counter (read-only info)
- [ ] Russian localization

**Files Modified:**
- `frontend/src/app/settings/organization/page.tsx` (+50 lines)

---

### Phase 6: Frontend - Display IDN (45 min)

**Tasks:**
- [ ] Show IDN in quote list (new column)
- [ ] Show IDN in quote detail header
- [ ] Show IDN-SKU in products table (ag-Grid column)
- [ ] Add IDN to quote exports (Excel/PDF)

**Files Modified:**
- `frontend/src/app/quotes/page.tsx` (+15 lines)
- `frontend/src/app/quotes/[id]/page.tsx` (+15 lines)
- Quote creation grid config (+20 lines)

---

### Phase 7: Testing & QA (30 min)

**Tasks:**
- [ ] Test IDN generation with mock data
- [ ] Test concurrent quote creation (race condition)
- [ ] Test customer without INN (error handling)
- [ ] Test organization without supplier_code (error handling)
- [ ] Verify IDN displayed correctly in UI
- [ ] Run backend tests: `pytest`
- [ ] Run frontend tests: `npm test`

---

### Phase 8: Documentation (15 min)

**Tasks:**
- [ ] Update `backend/CLAUDE.md` with IDN service
- [ ] Update `SESSION_PROGRESS.md`
- [ ] Commit and push

---

## 4. Risks & Mitigation

### Risk 1: Race Condition on Counter

**Description:** Two users create quotes simultaneously, get same counter
**Probability:** Medium
**Impact:** High (duplicate IDN)
**Mitigation:**
- Use `SELECT FOR UPDATE` to lock organization row
- Transaction ensures atomic increment
- Unique constraint as final safeguard

### Risk 2: Customer Without INN

**Description:** Customer record has no INN field populated
**Probability:** Low
**Impact:** Medium (quote creation fails)
**Mitigation:**
- Clear error message in Russian
- Validation in frontend before API call
- Allow admin to add INN to customer

### Risk 3: Organization Without Supplier Code

**Description:** Org hasn't set supplier_code yet
**Probability:** High (initial rollout)
**Impact:** Medium (quote creation fails)
**Mitigation:**
- Require supplier_code before first quote creation
- Admin notification banner if not set
- Clear setup instructions

---

## 5. Rollback Plan

**If IDN System Fails:**
1. IDN columns are nullable, existing quotes still work
2. Remove IDN generation from quote creation endpoint
3. Keep columns for data integrity
4. Fix issue and re-enable

**Database Rollback:**
```sql
-- If needed, columns can be dropped:
ALTER TABLE quotes DROP COLUMN idn;
ALTER TABLE quote_items DROP COLUMN idn_sku;
ALTER TABLE organizations DROP COLUMN supplier_code;
ALTER TABLE organizations DROP COLUMN idn_counters;
```

---

## 6. References

### Skills
- `.claude/skills/backend-dev-guidelines/` - FastAPI patterns
- `.claude/skills/database-verification/` - RLS checklist

### Existing Code
- `backend/routes/quotes.py` - Quote creation endpoint
- `backend/migrations/007_quotes_calculation_schema.sql` - Quotes schema
- `backend/migrations/005_create_customers_table_simple.sql` - Customer INN field

---

## 7. Post-Implementation Notes

*(To be filled during implementation)*

### Decisions Made
- TBD

### Follow-Up Tasks
- [ ] Add IDN to quote PDF export
- [ ] Add IDN search functionality
- [ ] Backfill existing quotes with IDN (if requested)
- [ ] Add supplier_code to organization registration flow
