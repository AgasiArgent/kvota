# Session 8 Quick Start Guide

**Date:** October 18, 2025
**Focus:** Build Quote Creation Frontend
**Expected Time:** 3-4 hours
**Status:** Backend 70% Complete → Frontend 0% → Need to build UI

---

## 🎯 Session 8 Goal

Build the quote creation page that allows users to:
1. Upload Excel/CSV files with products
2. Select or create variable templates
3. Fill in 39 calculation variables
4. Calculate quotes and view results

---

## ✅ What's Already Done (Session 7)

### Backend APIs Ready to Use:
- `POST /api/quotes-calc/upload-products` - Parse Excel/CSV files ✅
- `GET /api/quotes-calc/variable-templates` - List templates ✅
- `POST /api/quotes-calc/variable-templates` - Create template ✅
- `GET /api/quotes-calc/variable-templates/{id}` - Get template ✅
- `POST /api/quotes-calc/calculate` - Calculate quote (70% done, usable)

### Database Ready:
- 6 tables created with RLS policies ✅
- Migration tested and working ✅
- Test data available in `backend/test_data/sample_products.csv` ✅

### Testing:
- Automated test suite passing (5/5 tests) ✅
- Test credentials: andrey@masterbearingsales.ru / password ✅

---

## 🚀 Quick Start Commands

### 1. Verify Servers Running
```bash
# Check backend
curl http://localhost:8000/api/health

# Check frontend
# Open http://localhost:3001 in browser
```

If not running:
```bash
# Terminal 1: Backend
cd /home/novi/quotation-app/backend
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd /home/novi/quotation-app/frontend
npm run dev
```

### 2. Login and Test
1. Open http://localhost:3001/auth/login
2. Login with: andrey@masterbearingsales.ru / password
3. Verify customer list works: http://localhost:3001/customers

---

## 📋 Implementation Checklist

### Phase 1: Create Service Layer (30 min)
- [ ] Create `frontend/src/lib/api/quotes-calc-service.ts`
- [ ] Implement methods:
  - `uploadProducts(file: File)`
  - `listTemplates()`
  - `getTemplate(id: string)`
  - `createTemplate(name, description, variables)`
  - `calculateQuote(customer_id, products, variables)`
- [ ] Reference: `frontend/src/lib/api/customer-service.ts`

### Phase 2: Create Quote Creation Page Layout (30 min)
- [ ] Create `frontend/src/app/quotes/create/page.tsx`
- [ ] Implement split layout (Grid with 2 columns)
- [ ] Add page header with title "Create Quote"
- [ ] Add breadcrumbs navigation

### Phase 3: File Upload Component (20 min)
- [ ] Create file upload area (left column)
- [ ] Use Ant Design Upload component with drag & drop
- [ ] Accept .xlsx, .xls, .csv formats
- [ ] Display uploaded products in table
- [ ] Show columns: product_name, code, base_price_vat, quantity, weight

### Phase 4: Template Selector (15 min)
- [ ] Add template dropdown (top of right column)
- [ ] Fetch templates on page load
- [ ] Load template variables when selected
- [ ] Add "Save as Template" button

### Phase 5: Customer Selection (10 min)
- [ ] Add customer dropdown (below file upload)
- [ ] Fetch from `/api/customers/`
- [ ] Make it required field

### Phase 6: Variable Form (60 min)
- [ ] Create 39-field form organized by categories:
  - **Product Info** (5 fields)
  - **Financial** (9 fields)
  - **Logistics** (7 fields)
  - **Taxes & Duties** (2 fields)
  - **Payment Terms** (12 fields)
  - **Customs & Clearance** (5 fields)
  - **Company Settings** (2 fields)
- [ ] Use Ant Design Form with Collapse panels for categories
- [ ] Add field validations
- [ ] Pre-fill from template when selected

### Phase 7: Calculate Button (15 min)
- [ ] Add "Calculate Quote" button at bottom
- [ ] Disable if form invalid or no products
- [ ] Show loading state during calculation
- [ ] Handle errors gracefully

### Phase 8: Results Display (30 min)
- [ ] Show results below calculate button
- [ ] Display table with all products and their calculations
- [ ] Show all 13 phases (for testing - user wants to see everything)
- [ ] Add column toggle buttons (show/hide columns)
- [ ] Show totals summary

### Phase 9: Testing (15 min)
- [ ] Test file upload with sample CSV
- [ ] Test template selection
- [ ] Test save as template
- [ ] Test calculation
- [ ] Verify results display correctly

---

## 🎨 UI Layout Sketch

```
┌─────────────────────────────────────────────────────────────┐
│  Create Quote                                     [Breadcrumb]│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  LEFT COLUMN                  │  RIGHT COLUMN                │
│  ─────────────────────────────┼──────────────────────────   │
│                               │                              │
│  📁 Upload Products           │  📋 Template Selector        │
│  [Drag & Drop Area]           │  [Dropdown] [Save Template]  │
│                               │                              │
│  Products Table:              │  ▼ Product Info (5 fields)   │
│  ┌────────────────────┐       │  ▼ Financial (9 fields)      │
│  │ name │ price │ qty │       │  ▼ Logistics (7 fields)      │
│  │ ... │ ... │ ... │          │  ▼ Taxes (2 fields)          │
│  └────────────────────┘       │  ▼ Payment Terms (12)        │
│                               │  ▼ Customs (5 fields)        │
│  👤 Customer Selection        │  ▼ Company (2 fields)        │
│  [Dropdown]                   │                              │
│                               │  [Calculate Quote Button]    │
│                               │                              │
├─────────────────────────────────────────────────────────────┤
│  RESULTS (after calculation)                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Calculation Results                [Column Toggles]     ││
│  │ [Table with all 13 phases for each product]            ││
│  │ [Totals Summary]                                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 The 39 Variables (Grouped by Category)

### Product Info (5 fields) - Mostly from file
- `currency_of_base_price` - string (default: "TRY")
- `exchange_rate_base_price_to_quote` - number
- `supplier_country` - string (from file or manual)
- `supplier_currency` - string (default: "TRY")
- `customs_code` - string (from file)

### Financial (9 fields)
- `currency_of_quote` - string (default: "RUB")
- `markup` - number (%) (e.g., 15)
- `rate_forex_risk` - number (%) (e.g., 3)
- `rate_fin_comm` - number (%) (e.g., 2)
- `rate_loan_interest_daily` - number (e.g., 0.00069)
- `dm_fee_type` - string ("fixed" or "percentage")
- `dm_fee_value` - number
- `credit_days_to_client` - number (days)
- `credit_days_from_supplier` - number (days)

### Logistics (7 fields)
- `logistics_supplier_hub` - number (RUB)
- `logistics_hub_customs` - number (RUB)
- `logistics_customs_client` - number (RUB)
- `offer_incoterms` - string (e.g., "DDP", "EXW", "FCA")
- `supplier_incoterms` - string
- `logistics_insurance` - number (RUB, default: 0)
- `delivery_time` - number (days)

### Taxes & Duties (2 fields)
- `import_tariff` - number (%) (e.g., 5)
- `excise_tax` - number (%) (default: 0)

### Payment Terms (12 fields)
- `advance_from_client` - number (%) (e.g., 50)
- `advance_to_supplier` - number (%) (e.g., 100)
- `time_to_advance` - number (days)
- `time_to_shipment` - number (days)
- `time_shipment_to_hub` - number (days)
- `time_hub_to_customs` - number (days)
- `time_customs_clearance` - number (days)
- `time_customs_to_client` - number (days)
- `time_client_payment` - number (days)
- `exchange_rate_quote_to_rub` - number (default: 1 if RUB)
- `vat_rate` - number (%) (default: 20)
- `util_fee` - number (RUB per kg, default: 0)

### Customs & Clearance (5 fields)
- `brokerage_hub` - number (RUB)
- `brokerage_customs` - number (RUB)
- `warehousing_at_customs` - number (RUB)
- `customs_documentation` - number (RUB)
- `brokerage_extra` - number (RUB, default: 0)

### Company Settings (2 fields)
- `seller_company` - string (e.g., "МАСТЕР БЭРИНГ ООО")
- `offer_sale_type` - string (e.g., "поставка", "комиссия")

---

## 🔗 Key File References

### Backend Files:
- `backend/routes/quotes_calc.py` - API endpoints (line 1-575)
- `backend/test_endpoints.py` - Test examples
- `backend/test_data/sample_products.csv` - Sample data

### Frontend Reference Files:
- `frontend/src/app/customers/create/page.tsx` - Form layout pattern
- `frontend/src/lib/api/customer-service.ts` - Service pattern
- `frontend/src/app/customers/page.tsx` - Table display pattern

### Documentation:
- `.claude/SESSION_7_COMPLETION_SUMMARY.md` - Complete Session 7 details
- `.claude/SESSION_7_QUOTES_IMPLEMENTATION.md` - Implementation notes

---

## 🐛 Common Pitfalls to Avoid

1. **Port Confusion**: Frontend is on port 3001 (not 3000!)
2. **File Upload**: Use FormData, set proper content-type
3. **Template Loading**: Clear form before loading new template
4. **Customer Selection**: Make it required, validate before calculate
5. **Variable Types**: Some are strings, some numbers - type correctly
6. **Results Display**: Show all 13 phases for testing (user wants this)

---

## ✅ Success Criteria

Session 8 is complete when:
- [ ] User can upload Excel/CSV file and see products
- [ ] User can select existing template or create new one
- [ ] User can fill in all 39 variables (organized in categories)
- [ ] User can click "Calculate" and see results
- [ ] Results show all 13 calculation phases
- [ ] User can toggle column visibility
- [ ] All workflows tested and working

---

## 📊 Session 8 Expected Outcome

**Time Investment:** 3-4 hours
**Code Added:** ~600 lines (service + page + components)
**User Value:** Can now create quotes through UI (huge milestone!)
**Next Session:** Export functionality (PDF, Excel, CSV)

---

**Remember:** Backend is 70% done and tested. Focus on building the UI to make it usable!

**Test Early:** Use the test credentials to login and test as you build.

**Ask for Help:** If stuck, review SESSION_7_COMPLETION_SUMMARY.md for backend details.
