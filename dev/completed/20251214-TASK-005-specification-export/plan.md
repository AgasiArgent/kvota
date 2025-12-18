# Specification Export (Спецификация) - Implementation Plan

**Task ID:** TASK-005
**Created:** 2025-12-14
**Status:** In Progress
**Owner:** Claude
**Estimated Time:** 6-8 hours
**Last Updated:** 2025-12-14

---

## 1. Objective

### What Problem Are We Solving?

When a quote is accepted by the client, it needs to become a formal legal document called "Спецификация" (Specification) - an attachment to a supply contract. Currently there's no way to:
- Export this legal document
- Track contracts with customers
- Store customer signatory information
- Manage multiple warehouse addresses

### Why Is This Important?

- **Legal compliance:** Russian B2B requires formal specifications attached to contracts
- **Efficiency:** Currently done manually in Word - very time consuming
- **Data completeness:** Forces collection of all required legal data
- **Audit trail:** Specifications are numbered per contract for tracking

### Success Criteria (Measurable)

- [ ] User can export Specification as DOCX from accepted quote
- [ ] All 30 template variables are filled automatically
- [ ] Numbers converted to Russian words (прописью)
- [ ] Contracts table stores contract info per customer
- [ ] Customer can have multiple warehouse addresses
- [ ] Missing data prompts user and saves to customer record
- [ ] Organization signatory info stored in org settings
- [ ] Specification numbers auto-increment per contract

---

## 2. Technical Approach

### Architecture Decisions

**Decision 1: Data Storage**

- **Customer contracts** → New `customer_contracts` table (multiple contracts per customer)
- **Warehouse addresses** → JSONB array on `customers` table (1-3 addresses typical)
- **Signatory info** → Direct columns on `customers` and `organizations` tables
- **Specification counter** → Stored on `customer_contracts` table

**Rationale:**
- Contracts table allows multiple contracts per customer
- JSONB for warehouses avoids over-engineering (max 3 addresses)
- Specification number resets per contract (legal requirement)

---

**Decision 2: Export Flow**

1. User clicks "Export Specification" on accepted quote
2. System checks: does customer have a contract?
   - No → Show contract creation modal (number, date)
   - Yes → Show contract picker (if multiple) or use existing
3. System checks: all required data present?
   - Missing data → Show prompt, save to customer/contract
   - Complete → Generate DOCX
4. DOCX generated with python-docx, numbers converted with num2words

**Rationale:**
- Progressive data collection (ask only when needed)
- Data saved for future exports (no re-entry)
- Hybrid approach: auto-fill + manual input for gaps

---

### Technologies Used

**Backend:**
- `python-docx` - DOCX generation from template
- `num2words` - Numbers to Russian words (прописью)
- New tables: `customer_contracts`
- Alter tables: `customers`, `organizations`

**Frontend:**
- Export modal with contract selection
- Data completion form (if fields missing)
- shadcn/ui components (Dialog, Select, Input)

**Database Schema Changes:**

```sql
-- New table: customer_contracts
CREATE TABLE customer_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  contract_number TEXT NOT NULL,
  contract_date DATE NOT NULL,
  status TEXT DEFAULT 'active', -- active, expired, terminated
  next_specification_number INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alter customers: add signatory and warehouses
ALTER TABLE customers ADD COLUMN general_director_name TEXT;
ALTER TABLE customers ADD COLUMN general_director_position TEXT DEFAULT 'Генеральный директор';
ALTER TABLE customers ADD COLUMN warehouse_addresses JSONB DEFAULT '[]';
-- Note: address field = юридический адрес (already filled from Dadata)

-- Alter organizations: add business info and signatory
ALTER TABLE organizations ADD COLUMN inn VARCHAR(12);
ALTER TABLE organizations ADD COLUMN kpp VARCHAR(9);
ALTER TABLE organizations ADD COLUMN ogrn VARCHAR(15);
ALTER TABLE organizations ADD COLUMN registration_address TEXT;
ALTER TABLE organizations ADD COLUMN general_director_name TEXT;
ALTER TABLE organizations ADD COLUMN general_director_position TEXT DEFAULT 'Генеральный директор';
```

---

### Data Mapping (Template Variables)

| Template Variable | Source | Status |
|-------------------|--------|--------|
| [Номер договора] | customer_contracts.contract_number | NEW |
| [Дата договора] | customer_contracts.contract_date | NEW |
| [Номер спецификации] | customer_contracts.next_specification_number | NEW |
| [Дата спецификации] | Export date (today) | DERIVED |
| [Наша компания] | organizations.name | HAVE |
| [Клиент] | customers.name | HAVE |
| [Валюта] | quote.currency | HAVE |
| [IDN-SKU] | quote_items.idn + sku | HAVE |
| [Наименование позиции] | quote_items.name | HAVE |
| [Артикул поз.] | quote_items.sku | HAVE |
| [Производитель поз.] | quote_items.brand | HAVE |
| [Кол-во] | quote_items.quantity | HAVE |
| [Цена + НДС] | quote_items.unit_price * 1.2 | CALCULATED |
| [Стоимость + НДС] | unit_price * qty * 1.2 | CALCULATED |
| [Тотал стоимость + НДС] | SUM(стоимость) | CALCULATED |
| [Тотал количество Продукции] | SUM(qty) | CALCULATED |
| [Тотал сумма прописью] | num2words(total) | DERIVED |
| [Сумма НДС прописью] | num2words(vat) | DERIVED |
| [Валюта прописью] | mapping table | DERIVED |
| [Условия оплаты] | quote.payment_terms | HAVE |
| [Дни поставки] | quote.delivery_days | HAVE |
| [Условия спецификации] | quote.delivery_terms | HAVE |
| [адрес регистрации] | customers.address | HAVE |
| [адрес склада Покупателя] | customers.warehouse_addresses[selected] | NEW |
| [Иные условия] | Optional free text | OPTIONAL |
| [Должность нашего подписанта] | organizations.general_director_position | NEW |
| [ФИО Нашего подписанта] | organizations.general_director_name | NEW |
| [Должность подписанта Клиента] | customers.general_director_position | NEW |
| [ФИО подписанта Клиента] | customers.general_director_name | NEW |

---

## 3. Implementation Plan

### Phase 1: Database Migration (30 min)

**Tasks:**
- [ ] Create migration file `045_specification_export.sql`
- [ ] Create `customer_contracts` table
- [ ] Alter `customers` table (signatory, warehouses)
- [ ] Alter `organizations` table (business info, signatory)
- [ ] Add RLS policies for customer_contracts
- [ ] Test migration locally

**Files:**
- `backend/migrations/045_specification_export.sql` (new)

---

### Phase 2: Backend - Data Models & CRUD (1 hour)

**Tasks:**
- [ ] Create Pydantic models for contracts
- [ ] Create `routes/customer_contracts.py` - CRUD endpoints
- [ ] Add contract endpoints to customers router (or separate)
- [ ] Update customer model for new fields
- [ ] Update organization model for new fields
- [ ] Add num2words dependency

**Files:**
- `backend/routes/customer_contracts.py` (new, ~150 lines)
- `backend/routes/customers.py` (modify - add warehouse/signatory endpoints)
- `backend/routes/organizations.py` (modify - add signatory endpoints)

---

### Phase 3: Backend - DOCX Export (2 hours)

**Tasks:**
- [ ] Install python-docx, num2words
- [ ] Create DOCX template file (copy from user's template)
- [ ] Create `services/specification_export_service.py`
- [ ] Implement variable replacement in DOCX
- [ ] Implement num2words for Russian (прописью)
- [ ] Implement currency name mapping
- [ ] Create `routes/specification_export.py` - export endpoint
- [ ] Handle missing data validation
- [ ] Return DOCX file as download

**Files:**
- `backend/templates/specification_template.docx` (new)
- `backend/services/specification_export_service.py` (new, ~300 lines)
- `backend/routes/specification_export.py` (new, ~100 lines)

---

### Phase 4: Frontend - Contract Management UI (1.5 hours)

**Tasks:**
- [ ] Create contract list component (on customer detail page)
- [ ] Create contract create/edit modal
- [ ] Add warehouse addresses editor (JSONB array)
- [ ] Add signatory info fields to customer form
- [ ] Add signatory info to organization settings
- [ ] TypeScript interfaces for contracts

**Files:**
- `frontend/src/components/customers/ContractsList.tsx` (new)
- `frontend/src/components/customers/ContractModal.tsx` (new)
- `frontend/src/components/customers/WarehouseAddresses.tsx` (new)
- `frontend/src/app/customers/[id]/page.tsx` (modify)
- `frontend/src/app/settings/organization/page.tsx` (modify)

---

### Phase 5: Frontend - Export Flow (1.5 hours)

**Tasks:**
- [ ] Create export specification button on quote detail
- [ ] Create specification export modal
- [ ] Implement contract selection (if multiple)
- [ ] Implement missing data form
- [ ] Implement warehouse selection
- [ ] Implement DOCX download
- [ ] Auto-save entered data to customer/contract

**Files:**
- `frontend/src/components/quotes/SpecificationExportModal.tsx` (new)
- `frontend/src/app/quotes/[id]/page.tsx` (modify - add export button)

---

### Phase 6: Testing & QA (1 hour)

**Tasks:**
- [ ] Test migration on staging
- [ ] Test contract CRUD
- [ ] Test DOCX generation with all variables
- [ ] Test num2words Russian output
- [ ] Test missing data flow
- [ ] Test multi-contract selection
- [ ] Verify RLS isolation

**Files:**
- `backend/tests/test_specification_export.py` (new)

---

### Phase 7: Documentation (30 min)

**Tasks:**
- [ ] Update SESSION_PROGRESS.md
- [ ] Update backend/CLAUDE.md with new endpoints
- [ ] Commit and push

---

## 4. Risks & Mitigation

### Technical Risks

**Risk 1: DOCX Template Complexity**
- **Description:** Complex formatting might not survive variable replacement
- **Mitigation:** Keep template simple, test thoroughly

**Risk 2: num2words Russian Support**
- **Description:** num2words might have issues with Russian currency names
- **Mitigation:** Custom mapping for currency names if needed

**Risk 3: Missing Quote Data**
- **Description:** Old quotes might not have all required fields
- **Mitigation:** Validate before export, prompt user for missing data

---

## 5. References

- Template file: `~/Desktop/kvota tz/спека (предварительный шаблон.docx`
- num2words docs: https://pypi.org/project/num2words/
- python-docx docs: https://python-docx.readthedocs.io/

---

## 6. Post-Implementation Notes

[To be filled during implementation]
