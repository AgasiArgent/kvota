# Session 7: Quote Creation with Calculation Engine Implementation

**Date:** October 18, 2025
**Session Goal:** Enable complete quote creation workflow with Excel/CSV upload, calculation engine, and export functionality
**Status:** ✅ Phase 1 Complete - Backend Infrastructure Ready
**Duration:** ~3.5 hours
**Progress:** 70% of backend complete, 0% of frontend complete

---

## 📋 Session Overview

### What We're Building Today
A complete quote creation system that allows users to:
1. Upload Excel/CSV files with product data
2. Set 39 calculation variables (with template support)
3. Run the 13-phase calculation engine
4. View all intermediate calculation results
5. Export quotes as PDF, Excel, or CSV with configurable column visibility

### Key Decisions Made
- **Upload Flow**: Combined workflow (file upload + variables on same page)
- **Variable Management**: Template-based with override capability
- **Calculations Display**: Show ALL 13 phases for testing (configurable per user later)
- **Export Columns**: Configurable per user AND per client

---

## 🎯 Implementation Plan

### Phase 1: Documentation & Setup ✅ COMPLETE

- [x] Create SESSION_7_QUOTES_IMPLEMENTATION.md
- [x] Start backend server (localhost:8000)
- [x] Start frontend server (localhost:3001) - Note: Port 3000 was in use
- [x] Verify calculation_engine.py is functional
- [x] Purchase IPv4 add-on for Supabase ($10/month)
- [x] Configure direct database connection

---

### Phase 2: Database Schema ✅ COMPLETE (45 min actual)

**Tables to Create:**

#### 1. quotes
```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quote_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,

  -- Totals (calculated from items)
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Metadata
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired'))
);

CREATE INDEX idx_quotes_organization ON quotes(organization_id);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_number ON quotes(quote_number);
```

#### 2. quote_items
```sql
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,

  -- Product info (from Excel/CSV)
  product_name TEXT NOT NULL,
  product_code TEXT,
  base_price_vat DECIMAL(15,2) NOT NULL,
  quantity INTEGER NOT NULL,
  weight_in_kg DECIMAL(10,2) DEFAULT 0,
  customs_code TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
```

#### 3. quote_calculation_variables
```sql
CREATE TABLE quote_calculation_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  template_id UUID REFERENCES variable_templates(id),

  -- All 39 calculation variables stored as JSONB
  variables JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(quote_id)
);

CREATE INDEX idx_calc_vars_quote ON quote_calculation_variables(quote_id);
CREATE INDEX idx_calc_vars_template ON quote_calculation_variables(template_id);
```

#### 4. quote_calculation_results
```sql
CREATE TABLE quote_calculation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_item_id UUID NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,

  -- All 13 phases calculation results stored as JSONB
  -- Contains: N16, P16, R16, S16, T16, U16, V16, Y16, Z16, AA16, AB16, etc.
  phase_results JSONB NOT NULL,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(quote_item_id)
);

CREATE INDEX idx_calc_results_quote ON quote_calculation_results(quote_id);
CREATE INDEX idx_calc_results_item ON quote_calculation_results(quote_item_id);
```

#### 5. variable_templates
```sql
CREATE TABLE variable_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- All 39 variables as JSONB
  variables JSONB NOT NULL,

  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_default BOOLEAN DEFAULT false,

  UNIQUE(organization_id, name)
);

CREATE INDEX idx_templates_org ON variable_templates(organization_id);
CREATE INDEX idx_templates_default ON variable_templates(is_default) WHERE is_default = true;
```

#### 6. quote_export_settings
```sql
CREATE TABLE quote_export_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES customers(id),

  setting_type TEXT NOT NULL, -- 'user_default' or 'client_specific'

  -- Array of column identifiers to show
  visible_columns JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id, customer_id, setting_type)
);

CREATE INDEX idx_export_settings_user ON quote_export_settings(user_id);
CREATE INDEX idx_export_settings_customer ON quote_export_settings(customer_id);
```

#### RLS Policies
```sql
-- quotes RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotes in their organization"
  ON quotes FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create quotes in their organization"
  ON quotes FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update quotes in their organization"
  ON quotes FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

-- quote_items RLS
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quote items through quotes"
  ON quote_items FOR SELECT
  USING (quote_id IN (
    SELECT id FROM quotes WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));

-- Similar policies for other tables...
```

**Checklist:**
- [x] Create all 6 tables
- [x] Add RLS policies
- [x] Add indexes
- [x] Verify schema in Supabase dashboard
- [x] Successfully ran migration via direct connection (psycopg2)
- [x] All tables created without errors

---

### Phase 3: Backend API Endpoints ✅ 70% COMPLETE (90 min actual)

#### 3.1 File Upload & Parsing
**File:** `backend/routes/quotes.py`

**Endpoint:** `POST /api/quotes/upload-products`
```python
@router.post("/upload-products")
async def upload_products(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """
    Parse Excel/CSV file and return product array
    Expected columns: product_name, product_code, base_price_vat, quantity, weight_in_kg
    """
    # Use pandas to parse
    # Validate required columns
    # Return array of products
```

**Checklist:**
- [x] Install pandas, openpyxl dependencies (already installed)
- [x] Implement Excel parser
- [x] Implement CSV parser
- [x] Add column validation
- [x] Add data type validation
- [x] Test with sample file (5 products parsed successfully)
- [x] Created in new file: `routes/quotes_calc.py` (uses Supabase client)

#### 3.2 Variable Templates CRUD
**Endpoints:**
- `GET /api/variable-templates` - List all templates for organization
- `POST /api/variable-templates` - Create new template
- `GET /api/variable-templates/{id}` - Get specific template
- `PUT /api/variable-templates/{id}` - Update template
- `DELETE /api/variable-templates/{id}` - Delete template

**Checklist:**
- [x] Implement list endpoint
- [x] Implement create endpoint
- [x] Implement get endpoint
- [ ] Implement update endpoint (not needed for MVP)
- [x] Implement delete endpoint
- [x] Add Pydantic models
- [x] Use Supabase client (NOT asyncpg)
- [x] All endpoints tested and working

#### 3.3 Quote Calculation Endpoint
**Endpoint:** `POST /api/quotes/calculate`

**Input:**
```json
{
  "customer_id": "uuid",
  "title": "Quote title",
  "products": [...],
  "variables": {...39 variables...},
  "template_id": "uuid" // optional
}
```

**Process:**
1. Create quote record
2. Create quote_items records (bulk insert)
3. Save quote_calculation_variables
4. For each product:
   - Call `calculation_engine.calculate_single_product_quote()`
   - Save results to quote_calculation_results
5. Update quote totals
6. Return complete quote with all results

**Checklist:**
- [x] Create Pydantic models for request/response
- [x] Implement quote creation
- [x] Implement bulk item insert
- [x] Integrate calculation_engine.py (basic structure)
- [x] Save calculation results
- [x] Update quote totals
- [x] Handle errors gracefully
- [x] Use Supabase client
- [ ] **TODO**: Complete mapping of all 39 variables to calculation engine
- [ ] **TODO**: Test calculation with real multi-product data

#### 3.4 Export Endpoints
**Endpoints:**
- `POST /api/quotes/{id}/export/pdf`
- `POST /api/quotes/{id}/export/excel`
- `POST /api/quotes/{id}/export/csv`

**Request body:**
```json
{
  "visible_columns": ["product_name", "quantity", "AJ16", "AK16", ...],
  "save_as_preference": true,
  "preference_type": "user_default" // or "client_specific"
}
```

**Checklist:**
- [ ] Implement PDF export (WeasyPrint)
- [ ] Implement Excel export (openpyxl)
- [ ] Implement CSV export (pandas)
- [ ] Add column filtering
- [ ] Save export preferences
- [ ] Test each export format

---

### Phase 4: Frontend Implementation (3 hours) ⏳

#### 4.1 Quote Service Layer
**File:** `frontend/src/lib/api/quote-service.ts`

**Methods:**
```typescript
export class QuoteService {
  async uploadProducts(file: File): Promise<Product[]>
  async listTemplates(): Promise<VariableTemplate[]>
  async getTemplate(id: string): Promise<VariableTemplate>
  async createTemplate(data: TemplateCreate): Promise<VariableTemplate>
  async calculateQuote(data: QuoteCalculationRequest): Promise<QuoteWithResults>
  async exportPDF(quoteId: string, columns: string[]): Promise<Blob>
  async exportExcel(quoteId: string, columns: string[]): Promise<Blob>
  async exportCSV(quoteId: string, columns: string[]): Promise<Blob>
}
```

**Checklist:**
- [ ] Create QuoteService class
- [ ] Implement all methods
- [ ] Add TypeScript interfaces
- [ ] Add error handling
- [ ] Add loading states

#### 4.2 Quote Creation Page
**File:** `frontend/src/app/quotes/create/page.tsx`

**Layout:** Split screen (50/50)

**Left Side: File Upload**
- Drag & drop zone
- File type validation (.xlsx, .csv)
- File size limit (10MB)
- Preview table (first 10 rows)
- Product count badge
- Clear button

**Right Side: Variables Form**
- Template selector dropdown
- "Create New Template" button
- Variable form organized in 7 collapsible sections:
  1. Product Info (5 vars)
  2. Financial (9 vars)
  3. Logistics (7 vars)
  4. Taxes & Duties (2 vars)
  5. Payment Terms (12 vars)
  6. Customs & Clearance (5 vars)
  7. Company Settings (2 vars)
- "Save as Template" button
- "Calculate Quote" button (primary)

**Checklist:**
- [ ] Create page component
- [ ] Build split layout
- [ ] Add file upload component
- [ ] Add template selector
- [ ] Build variable form
- [ ] Add form validation
- [ ] Add calculate button handler

#### 4.3 Calculation Results Display
**File:** `frontend/src/app/quotes/[id]/page.tsx` or inline after calculation

**Features:**
- Quote header (number, customer, date, status)
- Summary cards (total products, total value, avg margin)
- Data table with ALL calculation columns:
  - Product columns (name, code, quantity, weight)
  - Phase 1: N16, P16, R16, S16
  - Phase 2: BD16
  - Phase 3: T16, U16, V16
  - Phase 4: AX16, AY16, Y16, Z16, AZ16
  - Phase 5-13: All intermediate values
  - Final: AJ16 (sales price), AK16 (total), AM16 (with VAT)
- Column visibility toolbar (checkboxes or dropdown)
- Export toolbar:
  - PDF button
  - Excel button
  - CSV button
  - "Save Quote" button

**Checklist:**
- [ ] Create results display component
- [ ] Build data table with all columns
- [ ] Add column visibility toggles
- [ ] Add export buttons
- [ ] Add column selection dialog
- [ ] Integrate with QuoteService
- [ ] Add loading states

#### 4.4 Reusable Components
**Files to create:**
- `components/quotes/FileUpload.tsx`
- `components/quotes/TemplateSelector.tsx`
- `components/quotes/VariableForm.tsx`
- `components/quotes/CalculationResults.tsx`
- `components/quotes/ColumnVisibilityToggle.tsx`
- `components/quotes/ExportDialog.tsx`

**Checklist:**
- [ ] Create FileUpload component
- [ ] Create TemplateSelector component
- [ ] Create VariableForm component
- [ ] Create CalculationResults component
- [ ] Create ColumnVisibilityToggle component
- [ ] Create ExportDialog component

---

### Phase 5: Integration & Testing (1 hour) ⏳

#### 5.1 Migrate Backend to Supabase Client
- [ ] Update quotes.py to use Supabase client
- [ ] Remove asyncpg imports
- [ ] Follow customers.py pattern
- [ ] Convert UUIDs to strings
- [ ] Convert Decimals to floats
- [ ] Test all endpoints

#### 5.2 End-to-End Testing
**Test Scenario 1: Simple Quote**
- [ ] Upload Excel with 5 products
- [ ] Select "Turkey Import Standard" template
- [ ] Click Calculate
- [ ] Verify all 13 phases calculated correctly
- [ ] Toggle column visibility
- [ ] Export as PDF
- [ ] Export as Excel
- [ ] Export as CSV

**Test Scenario 2: Custom Variables**
- [ ] Upload CSV with 20 products
- [ ] Create new template "China Import"
- [ ] Override 5 variables
- [ ] Save template
- [ ] Calculate quote
- [ ] Verify calculations
- [ ] Export with custom columns

**Test Scenario 3: Multi-Product Complex**
- [ ] Upload Excel with 100+ products
- [ ] Load existing template
- [ ] Modify markup percentage
- [ ] Calculate (verify performance)
- [ ] Export all formats
- [ ] Verify file sizes

---

## 📊 Technical Specifications

### The 39 Input Variables (from Variables_specification_notion.md)

**Product Info (5):**
1. base_price_VAT
2. quantity
3. weight_in_kg
4. currency_of_base_price
5. customs_code

**Financial (9):**
6. currency_of_quote
7. exchange_rate_base_price_to_quote
8. supplier_discount
9. markup
10. rate_forex_risk
11. dm_fee_type
12. dm_fee_value
13. rate_fin_comm
14. rate_loan_interest_daily

**Logistics (7):**
15. supplier_country
16. logistics_supplier_hub
17. logistics_hub_customs
18. logistics_customs_client
19. offer_incoterms
20. delivery_time

**Taxes & Duties (2):**
21. import_tariff
22. excise_tax
23. util_fee

**Payment Terms (12):**
24. advance_from_client
25. advance_to_supplier
26. time_to_advance
27. advance_on_loading
28. time_to_advance_loading
29. advance_on_going_to_country_destination
30. time_to_advance_going_to_country_destination
31. advance_on_customs_clearance
32. time_to_advance_on_customs_clearance
33. time_to_advance_on_receiving

**Customs & Clearance (5):**
34. brokerage_hub
35. brokerage_customs
36. warehousing_at_customs
37. customs_documentation
38. brokerage_extra

**Company Settings (2):**
39. seller_company
40. offer_sale_type

### The 13 Calculation Phases (from calculation_engine_summary.md)

1. **Purchase Price** (N16, P16, R16, S16)
2. **Distribution Base** (BD16, S13)
3. **Logistics Distribution** (T16, U16, V16)
4. **Internal Pricing & Duties** (AX16, AY16, Y16, Z16, AZ16)
5. **Supplier Payment** (BH6, BH4)
6. **Revenue Estimation** (BH2)
7. **Financing Costs** (BH3, BH7, BJ7, BH10, BJ10, BJ11)
8. **Credit Sales Interest** (BL3, BL4, BL5)
9. **Distribute Financing** (BA16, BB16)
10. **Final COGS** (AB16, AA16)
11. **Sales Price** (AF16, AG16, AH16, AI16, AD16, AE16, AJ16, AK16)
12. **VAT Calculations** (AM16, AL16, AN16, AO16, AP16)
13. **Transit Commission** (AQ16)

---

## 🐛 Issues & Solutions

### Issue 1: [To be filled as we encounter issues]
**Problem:**

**Solution:**

**Impact:**

---

## 📝 Session Notes

### Decisions Made
- Combined workflow: file upload + variables on same page
- Template system for variable reuse
- Show all 13 phases for testing (will make configurable later)
- Export settings per user AND per client

### Key Learnings
- [To be filled during implementation]

### Next Session TODO
- [ ] Make column visibility user-configurable (profile setting)
- [ ] Add quote approval workflow integration
- [ ] Optimize for large files (1000+ products)
- [ ] Add quote version history

---

## ✅ Completion Checklist

**Phase 1: Setup**
- [ ] Documentation created
- [ ] Backend server started
- [ ] Frontend server started

**Phase 2: Database**
- [ ] All tables created
- [ ] RLS policies added
- [ ] Indexes created
- [ ] Schema verified

**Phase 3: Backend**
- [ ] File upload endpoint working
- [ ] Templates CRUD working
- [ ] Calculation endpoint working
- [ ] Export endpoints working
- [ ] Migrated to Supabase client

**Phase 4: Frontend**
- [ ] Quote service created
- [ ] Creation page built
- [ ] Results display built
- [ ] All components built

**Phase 5: Testing**
- [ ] Simple quote test passed
- [ ] Custom variables test passed
- [ ] Multi-product test passed
- [ ] All exports working

---

**Session Start:** [Time]
**Session End:** [Time]
**Total Time:** [Hours]
**Status:** 🚧 In Progress

---

**Last Updated:** October 18, 2025
