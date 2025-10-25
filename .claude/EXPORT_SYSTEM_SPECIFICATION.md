# Export System Implementation - Complete Specification

**Status:** In Progress
**Created:** 2025-10-24
**Session:** 23

---

## 📊 Export Formats Overview

### **6 Total Export Formats:**
1. **PDF: КП поставка** - Customer-facing supply quote (9 columns)
2. **PDF: КП open book** - Customer-facing detailed quote (21 columns)
3. **PDF: КП поставка письмо** - Formal letter version of #1
4. **PDF: КП open book письмо** - Formal letter version of #2
5. **Excel: Проверка расчетов** - Input/Output validation format
6. **Excel: Таблицы** - Professional grid export (2 sheets)

---

## 📋 PDF Export - Common Blocks (All 4 Types)

### **Block 1: Seller Information**
```
Продавец
Компания: {seller_company}
Менеджер: {manager_name}
Телефон: {manager_phone}
Email: {manager_email}
```

**Data Sources:**
- `seller_company` → quote.variables
- `manager_name` → quote.manager_name OR users.full_name
- `manager_phone` → quote.manager_phone OR users.phone (blank if missing)
- `manager_email` → quote.manager_email OR users.email (blank if missing)

---

### **Block 2: Client Information**
```
Покупатель
Компания: {customer_company_name}
Контактное лицо: {contact_person_name}
Телефон: {contact_phone}
Email: {contact_email}
```

**Data Sources:**
- `customer_company_name` → customers.name
- `contact_person_name` → customer_contacts.name (via quote.contact_id)
- `contact_phone` → customer_contacts.phone (blank if missing)
- `contact_email` → customer_contacts.email (blank if missing)

---

### **Block 3: Quote General Information**
```
Информация о поставке
Адрес доставки: {delivery_address}
Базис поставки: {offer_incoterms}
Условия оплаты: {payment_terms_formatted}
Дата КП: {quote_date}
Срок поставки: {delivery_time} дней
Итого с НДС: {total_with_vat} ₽

{delivery_description}
```

**Data Sources:**
- `delivery_address` → quote.delivery_address (blank if missing)
- `offer_incoterms` → quote.variables.offer_incoterms
- `quote_date` → quote.created_at (format: DD.MM.YYYY)
- `delivery_time` → quote.variables.delivery_time
- `total_with_vat` → calculated from quote items

**Payment Terms Logic:**
```python
if advance_from_client == 100:
    payment_terms = "100% предоплата"
elif advance_from_client == 0:
    payment_terms = "Постоплата"
else:
    payment_terms = f"{advance_from_client}% аванс"
```

**Delivery Description Logic:**
```python
if offer_incoterms == "DDP":
    description = "Цена включает: НДС, страховку, таможенную очистку и доставку товара до склада"
else:
    description = "Цена включает: затраты на доставку и страховку"
```

---

## 📄 PDF Option 1: КП поставка (Supply Quote)

### **Grid Layout - 9 Columns:**

| № | Russian Header | Excel Cell | Source Field | Format Example |
|---|----------------|------------|--------------|----------------|
| 1 | Бренд | B16 | brand | "SKF" |
| 2 | Артикул | C16 | sku | "6205" |
| 3 | Наименование | D16 | product_name | "Bearing SKF 6205" |
| 4 | Кол-во | E16 | quantity | 10 |
| 5 | Цена за ед. (₽) | AJ16 | selling_price_per_unit | 1 234,56 |
| 6 | Сумма (₽) | AK16 | selling_price_total | 12 345,67 |
| 7 | НДС (₽) | AN16 | vat_from_sales | 2 345,67 |
| 8 | Цена с НДС за ед. (₽) | AM16 | selling_price_with_vat_per_unit | 1 481,47 |
| 9 | Сумма с НДС (₽) | AL16 | selling_price_with_vat_total | 14 814,70 |

### **Calculation Cell Mapping:**
- **AJ16** = Final-2 (Sales price per unit)
- **AK16** = Final-1 (Sales price total)
- **AN16** = Final-41 (VAT from sales)
- **AM16** = Final-39 (Sale price with VAT per unit)
- **AL16** = Final-40 (Sale price with VAT total)

### **Totals Row:**
- Sum quantities (column 4)
- Sum all monetary columns (5-9)

### **Currency Formatting:**
- Russian style: `1 234,56 ₽` (space for thousands, comma for decimals)

---

## 📄 PDF Option 2: КП open book (Detailed Quote)

### **Grid Layout - 21 Columns:**

| № | Russian Header | Excel Cell | Source Field | Format |
|---|----------------|------------|--------------|---------|
| 1-4 | (Same as Option 1) | B16-E16 | brand, sku, product_name, quantity | - |
| 5 | Валюта | J16 | currency_of_base_price | USD |
| 6 | Цена без НДС | N16 | purchase_price_no_vat | 1 000,00 |
| 7 | **Сумма инвойса** | N16×E16 | **CALCULATED** | 10 000,00 |
| 8 | Цена в валюте КП (₽) | S16 | purchase_price_quote_currency | 95 000,00 |
| 9 | Логистика (₽) | V16 | logistics_per_product | 5 000,00 |
| 10 | Код ТН ВЭД | W16 | customs_code | 8708913509 |
| 11 | Пошлина (%) | X16 | import_tariff | 5% |
| 12 | Таможенный сбор (₽) | Y16 | customs_fee | 5 000,00 |
| 13 | Акциз (₽) | Z16 | excise_tax | 0,00 |
| 14 | Утиль. сбор (₽) | util_fee | util_fee | 0,00 |
| 15 | Комиссия транзит (₽) | AQ16 | transit_commission | 0,00 |
| 16-21 | (Same as Option 1, cols 5-9) | AJ16-AL16 | selling prices + VAT | - |

### **Additional Calculation Cell Mapping:**
- **N16** = Final-34 (Purchase price without VAT)
- **S16** = Final-9 (Purchase price in quote currency)
- **V16** = Final-10 (Logistics distributed on product)
- **Y16** = Final-11 (Customs fee amount)
- **AQ16** = Final-44 (Transit commission)

### **Column 7 Calculation:**
```python
invoice_amount_orig_currency = N16 * E16  # Purchase price × Quantity
```

---

## 📄 PDF Options 3 & 4: Formal Letters (Письмо)

### **Letter Structure:**

#### **1. Header (Same as all PDFs)**
Seller block + Client block + Quote info block

#### **2. Formal Greeting & Introduction**
```
Уважаемый {contact_person_name}!

Мы рады предложить Вам наше коммерческое предложение по поставке промышленного
оборудования. Компания {seller_company} имеет многолетний опыт работы на рынке
поставок качественного оборудования и комплектующих.

Мы ценим плодотворное сотрудничество с компанией {customer_company_name} и
стремимся предложить Вам наилучшие условия поставки и конкурентоспособные цены.

Предлагаем Вашему вниманию следующее коммерческое предложение:
```

**Data Source:**
- Template text: **Hardcoded** (can make customizable later via `organizations.letter_template`)
- `{contact_person_name}` → from customer_contacts
- `{seller_company}` → from quote.variables
- `{customer_company_name}` → from customers.name

#### **3. Product Grid**
- **Option 3:** Same 9-column grid as PDF Option 1
- **Option 4:** Same 21-column grid as PDF Option 2

(Formatted as part of letter, not standalone table)

#### **4. Totals Section**
Same as Options 1 & 2

#### **5. Signature Block**
```
С уважением,
{ceo_title}

[Signature placeholder image/box]

{ceo_name}
```

**Data Sources:**
- `ceo_title` → organizations.ceo_title (default: "Генеральный директор")
- `ceo_name` → organizations.ceo_name (blank if missing → "Не указано")
- Signature image: **Placeholder box for now** (future: organizations.ceo_signature_url)

---

## 📊 Excel Export Format 1: Input/Output Validation

### **Purpose:**
Easy copy-paste comparison against old Excel calculation file.

### **Single Sheet Layout:**

#### **Section A: Input Variables (All 42 per product)**
```
Row Format: [Excel Cell] | [Russian Name] | [Value]

Example:
K16 | Цена закупки (с НДС) | 1200.00
E16 | Количество | 10
J16 | Валюта цены закупки | USD
Q16 | Курс к валюте КП | 95.0
AC16 | Наценка (%) | 15
...continues for all 42 variables...
```

#### **Section B: Calculated Outputs (All intermediate + final)**
```
Row Format: [Excel Cell] | [Russian Name] | [Calculated Value]

Example:
N16 | Цена без НДС | 1000.00
S16 | Цена в валюте КП | 95000.00
AB16 | Себестоимость | 105000.00
AJ16 | Цена продажи (за ед.) | 120.85
AK16 | Сумма продажи | 1208.50
AL16 | Сумма с НДС | 1450.20
...continues for all calculation steps...
```

**Variable Mapping Source:**
Use the Excel cell mappings from `Variables_specification_notion.md` (cells K16, E16, J16, etc.)

**Output Mapping Source:**
Use Final-1 through Final-46 from calculation formulas

---

## 📊 Excel Export Format 2: Professional Grid Export

### **Two Sheets:**

#### **Sheet 1: "КП поставка"**
- Same 9 columns as PDF Option 1
- Professional Excel table styling:
  - Header row: Bold, blue background (#2C5AA0), white text
  - Data rows: Alternating white/light gray
  - Totals row: Bold, darker background
  - Currency columns: Number format `#,##0.00 ₽`
  - Freeze panes on header row

#### **Sheet 2: "КП open book"**
- Same 21 columns as PDF Option 2
- Same professional styling as Sheet 1
- Column 7 formula: `=F2*D2` (Invoice amount = Price × Quantity)

**File Format:** `.xlsx` (Excel 2007+)

---

## 🗄️ Database Schema Changes

### **New Table: customer_contacts**

```sql
CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    position TEXT,
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Multi-tenancy
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_contacts_customer ON customer_contacts(customer_id);
CREATE INDEX idx_customer_contacts_org ON customer_contacts(organization_id);

-- RLS Policy
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_contacts_policy"
    ON customer_contacts
    FOR ALL
    USING (organization_id = current_organization_id());
```

---

### **Modify Table: quotes**

```sql
ALTER TABLE quotes
ADD COLUMN delivery_address TEXT,
ADD COLUMN contact_id UUID REFERENCES customer_contacts(id),
ADD COLUMN created_by_user_id UUID REFERENCES users(id),
ADD COLUMN manager_name TEXT,
ADD COLUMN manager_phone TEXT,
ADD COLUMN manager_email TEXT;

CREATE INDEX idx_quotes_contact ON quotes(contact_id);
CREATE INDEX idx_quotes_created_by ON quotes(created_by_user_id);
```

**Field Logic:**
- `contact_id`: User selects from customer's contacts when creating quote
- `created_by_user_id`: Auto-set to current user on creation
- `manager_name/phone/email`: Copied from user profile on creation, can be edited

---

### **Modify Table: organizations**

```sql
ALTER TABLE organizations
ADD COLUMN ceo_name TEXT,
ADD COLUMN ceo_title TEXT DEFAULT 'Генеральный директор',
ADD COLUMN ceo_signature_url TEXT,
ADD COLUMN letter_template TEXT;
```

---

## 🏗️ Implementation Architecture

### **Backend Services:**

#### **1. backend/services/export_data_mapper.py** (NEW)
```python
async def fetch_export_data(quote_id: str) -> ExportData:
    """
    Fetch all data needed for any export format

    Returns unified data structure:
    {
        'quote': {...},
        'items': [...],  # with calculation results
        'customer': {...},
        'contact': {...},
        'manager': {...},
        'organization': {...},
        'variables': {...},
        'calculations': {...}  # mapped to Excel cells
    }
    """
```

#### **2. backend/services/excel_service.py** (NEW)
```python
from openpyxl import Workbook
from openpyxl.styles import Font, Fill, Alignment

class QuoteExcelService:
    def generate_validation_export(export_data: ExportData) -> bytes:
        """Generate Input/Output validation Excel"""

    def generate_grid_export(export_data: ExportData) -> bytes:
        """Generate professional 2-sheet Excel"""
```

#### **3. backend/services/pdf_service.py** (MODIFY EXISTING)
```python
class QuotePDFService:
    # Existing methods...

    def generate_supply_pdf(export_data: ExportData) -> bytes:
        """9-column supply quote PDF"""

    def generate_openbook_pdf(export_data: ExportData) -> bytes:
        """21-column detailed quote PDF"""

    def generate_supply_letter_pdf(export_data: ExportData) -> bytes:
        """Formal letter - supply quote"""

    def generate_openbook_letter_pdf(export_data: ExportData) -> bytes:
        """Formal letter - detailed quote"""
```

---

### **Backend Routes:**

#### **routes/quotes.py - Add endpoints:**

```python
@router.get("/{quote_id}/export/pdf")
async def export_quote_pdf(
    quote_id: str,
    format: str = Query(..., regex="^(supply|openbook|supply-letter|openbook-letter)$"),
    user: User = Depends(get_current_user)
) -> FileResponse:
    """Export quote as PDF with specified format"""

@router.get("/{quote_id}/export/excel")
async def export_quote_excel(
    quote_id: str,
    format: str = Query(..., regex="^(validation|grid)$"),
    user: User = Depends(get_current_user)
) -> FileResponse:
    """Export quote as Excel with specified format"""
```

---

## 📝 Implementation Phases

### **Phase 1: Database & Foundations** (~40 min)
- Create migration `012_export_system.sql`
- Create `services/export_data_mapper.py`
- Unit tests for mapper

### **Phase 2: Excel Export** (~45 min)
- Create `services/excel_service.py`
- Add Excel export endpoint
- Unit tests

### **Phase 3: PDF Export** (~60 min)
- Update `services/pdf_service.py`
- Create 4 PDF templates
- Add PDF export endpoint

### **Phase 4: Frontend Export UI** (~30 min)
- Add export dropdown to quote detail page
- Implement download handling

### **Phase 5: Contact Management** (~45 min)
- Create contact management UI
- CRUD operations for contacts

### **Phase 6: Testing** (~60 min)
- Unit tests, Integration tests, Code review

### **Phase 7: Documentation** (~20 min)
- Update SESSION_PROGRESS.md
- Create testing checklist

---

## ⏱️ Time Estimates

**Total:** ~5 hours sequential, **~3.5 hours with parallelization**

---

## ✅ Success Criteria

- [ ] All 6 export formats generate correctly
- [ ] PDFs display Russian text properly (UTF-8)
- [ ] Excel files open without errors
- [ ] File downloads work in browser
- [ ] Calculations match Excel cell references
- [ ] Totals sum correctly
- [ ] Missing data shows placeholders
- [ ] Export < 3 seconds for 50 products
- [ ] Tests 80%+ coverage

---

**Status:** Ready for implementation
**Session:** 23
