# VAT Removal Indicator Design

**Date:** 2025-11-23
**Author:** Claude Code
**Status:** Approved for Implementation

---

## Overview

Enhance the financial review Excel export to show VAT removal analysis at both quote and product levels, helping financial managers verify invoice terms match calculations.

**Business Context:**
Managers sometimes misread supplier invoices when entering prices, incorrectly including/excluding VAT. Financial managers need to cross-check invoice terms against calculation logic to catch these errors before approval.

**Scope:**
- Quote-level summary: Count of products with VAT removed
- Product-level detail: Add 3 columns showing supplier country and price comparison
- Visual highlighting: Yellow background where K16 ≠ N16 (VAT was removed)

---

## Requirements

### Functional

1. **Quote-Level Summary**
   - Display: "НДС очищен на: X из Y продуктов"
   - Location: Row after totals (replaces current "НДС очищен: ДА/НЕТ")
   - Calculation: Count products where `base_price_vat ≠ calc_n16_price_without_vat`
   - Format: Bold text, no highlighting

2. **Product-Level Columns**
   - Add 3 new columns after "Наименование":
     - **Column C:** Страна закупки (supplier_country)
     - **Column D:** Цена с НДС (K16 - base_price_vat)
     - **Column E:** Цена без НДС (N16 - calc_n16_price_without_vat)
   - Shift existing columns right by 3 positions

3. **Visual Highlighting**
   - Apply yellow background to columns D & E when K16 ≠ N16
   - Use existing YELLOW_FILL (#FFFFCC)
   - No comments needed (visual comparison is self-explanatory)

### Non-Functional

- **Performance:** Single additional query acceptable (~50ms overhead)
- **Compatibility:** Must work with existing calculation storage schema
- **Maintainability:** All logic in `financial_review_export.py` (single file change)

---

## Architecture

### Approach

**Chosen:** Calculate at export time (Approach 1)

**Alternatives Considered:**
- Approach 2: Store denormalized in database → Rejected (migration overhead, cache invalidation)
- Approach 3: Lightweight cache → Rejected (still requires migration, minimal benefit)

**Why Approach 1:**
- Zero migration risk
- Always accurate (reflects current calculation state)
- Simple implementation (~1 hour)
- Financial review export happens rarely (once per approval)

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Export Endpoint (routes/financial_approval.py)          │
│    GET /api/quotes/{id}/financial-review/export            │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Query calculation data
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Database Tables                                          │
│    - quote_items (description, quote_id)                    │
│    - quote_calculation_results (base_price_vat)             │
│    - quote_calculation_summaries (calc_n16_price_without_vat)│
│    - quote_calculation_variables (supplier_country)         │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Products with calc data
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Excel Generator (services/financial_review_export.py)   │
│    - Calculate VAT removal count                            │
│    - Generate quote-level summary                           │
│    - Add product columns (C, D, E)                          │
│    - Apply yellow highlighting                              │
└─────────────────────────────────────────────────────────────┐
                          │
                          │ Excel workbook
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Response                                                  │
│    Content-Type: application/vnd.openxmlformats-officedocument│
│    Filename: financial_review_{quote_number}.xlsx           │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### Quote-Level Data

**Source:** Aggregated from product-level comparisons

**Calculation:**
```python
removed_count = sum(1 for p in products if p['base_price_vat'] != p['calc_n16_price_without_vat'])
total_count = len(products)
summary = f"{removed_count} из {total_count} продуктов"
```

### Product-Level Data

**Fields Required:**

| Field | Source Table | Column | Type | Description |
|-------|-------------|--------|------|-------------|
| supplier_country | quote_calculation_variables | supplier_country | TEXT | RU, TR, CN, EU |
| base_price_vat | quote_calculation_results | base_price_vat | DECIMAL(15,2) | K16 - Original price with VAT |
| calc_n16_price_without_vat | quote_calculation_summaries | calc_n16_price_without_vat | DECIMAL(15,2) | N16 - Price after VAT removal |

**Query Pattern:**
```python
for item in quote_items:
    # Join calculation tables
    calc_vars = get_calculation_variables(item.id)
    calc_summary = get_calculation_summary(item.id)

    products.append({
        'name': item.description,
        'supplier_country': calc_vars.get('supplier_country'),
        'base_price_vat': calc_summary.get('base_price_vat'),  # K16
        'calc_n16': calc_summary.get('calc_n16_price_without_vat'),  # N16
        # ... other fields
    })
```

---

## Excel Layout Changes

### Before (Current)

```
Row 13: Quote Totals
Row 15: НДС очищен: ДА/НЕТ [yellow if НЕТ]
Row 17: ТОВАРЫ

Header Row:
A: # | B: Наименование | D: Кол-во | E: Закупка | F: Таможня | ...
```

### After (Proposed)

```
Row 13: Quote Totals
Row 15: НДС очищен на: 3 из 5 продуктов [bold, no highlight]
Row 17: ТОВАРЫ

Header Row:
A: # | B: Наименование | C: Страна | D: Цена с НДС | E: Цена без НДС | F: Кол-во | G: Закупка | ...
```

### Column Mapping Changes

| Old Col | New Col | Header | Notes |
|---------|---------|--------|-------|
| A | A | # | No change |
| B | B | Наименование | No change |
| - | **C** | **Страна закупки** | **NEW** |
| - | **D** | **Цена с НДС (K16)** | **NEW** - Yellow if K16≠N16 |
| - | **E** | **Цена без НДС (N16)** | **NEW** - Yellow if K16≠N16 |
| D | F | Кол-во | Shifted +3 |
| E | G | Закупка | Shifted +3 |
| F | H | Таможня | Shifted +3 |
| ... | ... | ... | All subsequent columns shift +3 |

---

## Implementation Details

### File: `backend/services/financial_review_export.py`

#### Change 1: Quote-Level Summary (Lines 200-212)

**Current:**
```python
ws[f'A{row}'] = 'НДС очищен:'
vat_removed = quote_data.get('vat_removed', False)
ws[f'B{row}'] = 'ДА' if vat_removed else 'НЕТ'
ws[f'B{row}'].font = Font(bold=True)

if not vat_removed:
    ws[f'B{row}'].fill = YELLOW_FILL
    ws[f'B{row}'].comment = Comment(
        "⚠️ VAT не был очищен от закупочной цены. Проверьте.",
        "System"
    )
```

**Proposed:**
```python
ws[f'A{row}'] = 'НДС очищен на:'

# Calculate count of products with VAT removed
removed_count = sum(
    1 for p in quote_data.get('products', [])
    if p.get('base_price_vat') != p.get('calc_n16_price_without_vat')
)
total_count = len(quote_data.get('products', []))

ws[f'B{row}'] = f"{removed_count} из {total_count} продуктов"
ws[f'B{row}'].font = Font(bold=True)
# No highlighting
```

#### Change 2: Product Table Headers (Lines 233-244)

**Current:**
```python
headers = [
    '#',             # A
    'Наименование',  # B (merged B-C)
    'Кол-во',        # D
    'Закупка',       # E
    'Таможня',       # F
    # ...
]
col_letters_products = ['A', 'B', 'D', 'E', 'F', ...]
```

**Proposed:**
```python
headers = [
    '#',                      # A
    'Наименование',           # B (merged B-C stays same)
    'Страна',                 # D (NEW)
    'Цена с НДС\n(K16)',     # E (NEW)
    'Цена без НДС\n(N16)',   # F (NEW)
    'Кол-во',                # G (shifted from D)
    'Закупка',               # H (shifted from E)
    'Таможня',               # I (shifted from F)
    # ...
]
col_letters_products = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', ...]
```

#### Change 3: Product Row Data (Lines 260-310)

**Current:**
```python
for idx, product in enumerate(products, start=1):
    ws[f'A{row}'] = idx
    ws[f'B{row}'] = product.get('name', '')
    ws.merge_cells(f'B{row}:C{row}')

    ws[f'D{row}'] = product.get('quantity', 0)
    ws[f'E{row}'] = float(product.get('purchase_price_total', 0))
    # ...
```

**Proposed:**
```python
for idx, product in enumerate(products, start=1):
    ws[f'A{row}'] = idx
    ws[f'B{row}'] = product.get('name', '')
    ws.merge_cells(f'B{row}:C{row}')  # Keep name merge

    # NEW: Supplier country
    ws[f'D{row}'] = product.get('supplier_country', '')

    # NEW: K16 (base_price_vat)
    k16_value = float(product.get('base_price_vat', 0))
    ws[f'E{row}'] = k16_value
    ws[f'E{row}'].number_format = '#,##0.00 ₽'

    # NEW: N16 (calc_n16_price_without_vat)
    n16_value = float(product.get('calc_n16_price_without_vat', 0))
    ws[f'F{row}'] = n16_value
    ws[f'F{row}'].number_format = '#,##0.00 ₽'

    # Highlight if VAT was removed
    if k16_value != n16_value:
        ws[f'E{row}'].fill = YELLOW_FILL
        ws[f'F{row}'].fill = YELLOW_FILL

    # SHIFTED: Existing columns (+3 positions)
    ws[f'G{row}'] = product.get('quantity', 0)  # Was D
    ws[f'H{row}'] = float(product.get('purchase_price_total', 0))  # Was E
    ws[f'I{row}'] = float(product.get('customs_duty', 0))  # Was F
    # ... continue shifting all columns
```

#### Change 4: Column Widths (Lines 355-367)

**Current:**
```python
column_widths = {
    'A': 5,   # #
    'B': 30,  # Наименование
    'C': 5,   # (merged with B)
    'D': 8,   # Кол-во
    'E': 12,  # Закупка
    'F': 13,  # Таможня
    # ...
}
```

**Proposed:**
```python
column_widths = {
    'A': 5,   # #
    'B': 30,  # Наименование
    'C': 5,   # (merged with B)
    'D': 10,  # Страна (NEW)
    'E': 13,  # Цена с НДС (NEW)
    'F': 13,  # Цена без НДС (NEW)
    'G': 8,   # Кол-во (shifted)
    'H': 12,  # Закупка (shifted)
    'I': 13,  # Таможня (shifted)
    # ... shift all subsequent columns +3
}
```

---

## Edge Cases

### 1. No Calculation Results

**Scenario:** Quote created but not yet calculated
**Behavior:**
- Quote-level: "0 из 0 продуктов"
- Product columns D-E: Show 0.00 (no highlighting)

### 2. Decimal Precision

**Scenario:** K16 = 100.001, N16 = 100.002 (floating point rounding)
**Solution:** Use Decimal comparison (already in place)
```python
if Decimal(str(k16)) != Decimal(str(n16)):
    # Highlight
```

### 3. China Supplier (VAT Pre-Removed)

**Scenario:** supplier_country = 'CN', K16 = N16
**Behavior:** No highlighting (correct, VAT already removed by supplier)

### 4. Turkey Transit Zone

**Scenario:** supplier_country = 'TR (transit)', vat_seller_country = 0%
**Behavior:** K16 = N16, no highlighting (correct, 0% VAT)

---

## Testing Strategy

### Unit Tests

**File:** `backend/tests/services/test_financial_review_export.py`

**Test Cases:**

1. **test_vat_summary_all_removed**
   - 3 products, all with K16 ≠ N16
   - Assert: "3 из 3 продуктов"

2. **test_vat_summary_partial**
   - 5 products, 2 with K16 ≠ N16
   - Assert: "2 из 5 продуктов"

3. **test_vat_summary_none_removed**
   - 3 products (all China), K16 = N16 for all
   - Assert: "0 из 3 продуктов"

4. **test_product_columns_present**
   - Assert columns D, E, F exist
   - Assert headers: "Страна", "Цена с НДС", "Цена без НДС"

5. **test_highlighting_applied**
   - Product with K16=1000, N16=847.46
   - Assert: Cells E{row} and F{row} have YELLOW_FILL

6. **test_highlighting_skipped**
   - Product with K16=N16=1000
   - Assert: Cells E{row} and F{row} have NO fill

### Manual Testing

**Test Plan:** Scenario 5 from `financial-approval-mvp-test-plan.md`

**Setup:**
1. Create quote КП25-0084 with mixed products:
   - Product 1: Turkey supplier (VAT removed)
   - Product 2: China supplier (VAT pre-removed)
   - Product 3: EU supplier (VAT removed)

**Verification:**
1. Download financial review Excel
2. Check Row 15: "НДС очищен на: 2 из 3 продуктов"
3. Check product table columns C, D, E present
4. Verify yellow highlighting on Products 1 & 3 only

---

## Rollout Plan

### Phase 1: Implementation (1 hour)
- Update `financial_review_export.py` (4 changes)
- Update column shift mapping
- Add unit tests

### Phase 2: Testing (30 min)
- Run unit tests
- Manual test with КП25-0084

### Phase 3: Documentation (15 min)
- Update test plan with results
- Update SESSION_PROGRESS.md
- Commit with descriptive message

---

## Success Criteria

- ✅ Quote-level summary shows accurate count
- ✅ Product table has 3 new columns (C, D, E)
- ✅ Yellow highlighting applied only when K16 ≠ N16
- ✅ All existing columns shifted correctly
- ✅ No visual regression in Excel layout
- ✅ All unit tests passing
- ✅ Manual test scenario 5 passing

---

## Future Enhancements (Out of Scope)

1. **Add tooltip to headers**
   - Explain K16 vs N16 difference

2. **Show VAT percentage**
   - Calculate actual VAT % removed

3. **Export to other formats**
   - PDF, CSV with same logic

4. **Dashboard widget**
   - Show VAT removal stats across all quotes

---

## References

- Test Plan: `backend/docs/testing/financial-approval-mvp-test-plan.md` (Scenario 5)
- Calculation Engine: `backend/calculation_engine.py` (phase1_purchase_price)
- Variables Spec: `.claude/VARIABLES.md` (K16, N16 definitions)
- Migration: `backend/migrations/022_quote_calculation_summaries.sql` (schema)
