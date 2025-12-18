# Export Mapping - Variables to Excel/PDF

**Created:** 2025-12-13
**Source:** Code analysis (export_data_mapper.py, export_validation_service.py)
**Status:** Verified from actual implementation

---

## Overview

### Export Formats Available
| Format | Type | Description |
|--------|------|-------------|
| `supply` | PDF | КП поставка (9-column supply quote) |
| `openbook` | PDF | КП open book (21-column detailed quote) |
| `supply-letter` | PDF | КП поставка письмо (formal letter + grid) |
| `openbook-letter` | PDF | КП open book письмо (formal letter + grid) |
| `invoice` | PDF | Счет (Russian commercial invoice) |
| `validation` | Excel | API vs Excel comparison (debugging) |

### API Endpoints
```python
# PDF Export
GET /api/quotes/{quote_id}/export/pdf?format=supply|openbook|supply-letter|openbook-letter|invoice

# Excel Validation Export
GET /api/quotes/{quote_id}/export/excel/validation
```

---

## 1. Excel Cell Mapping (Master Reference)

**Source:** `backend/services/export_data_mapper.py`

### Quote-Level Inputs (Header Area)

| Cell | Variable | Russian Name |
|------|----------|--------------|
| D5 | `seller_company` | Компания-продавец |
| D6 | `offer_sale_type` | Вид КП |
| D7 | `offer_incoterms` | Базис поставки |
| D8 | `currency_of_quote` | Валюта КП |
| D9 | `delivery_time` | Срок поставки (дней) |
| D11 | `advance_to_supplier` | Аванс поставщику (%) |

### Payment Terms

| Cell | Variable | Russian Name |
|------|----------|--------------|
| J5 | `advance_from_client` | Аванс от клиента (%) |
| K5 | `time_to_advance` | Дней до аванса |
| J6 | `advance_on_loading` | Аванс при заборе (%) |
| K6 | `time_to_advance_loading` | Дней до аванса загрузки |
| J7 | `advance_on_shipping` | Аванс при отправке (%) |
| K7 | `time_to_advance_shipping` | Дней до аванса отправки |
| J8 | `advance_on_customs` | Аванс при таможне (%) |
| K8 | `time_to_advance_customs` | Дней до аванса таможни |
| K9 | `time_to_payment` | Дней до оплаты после получения |

### Logistics & Brokerage Costs

| Cell | Variable | Russian Name |
|------|----------|--------------|
| W2 | `logistics_supplier_hub` | Логистика: Поставщик-Хаб |
| W3 | `logistics_hub_customs` | Логистика: Хаб-Таможня |
| W4 | `logistics_customs_client` | Логистика: Таможня-Клиент |
| W5 | `brokerage_hub` | Брокерские услуги: Хаб |
| W6 | `brokerage_customs` | Брокерские услуги: Таможня |
| W7 | `warehousing_at_customs` | Расходы на СВХ |
| W8 | `customs_documentation` | Разрешительные документы |
| W9 | `brokerage_extra` | Прочее |

### DM Fee

| Cell | Variable | Description |
|------|----------|-------------|
| AG3 | `dm_fee_type` | "Фикс" or "комиссия %" |
| AG4 | `dm_fee_value` | Fixed amount (if type = Фикс) |
| AG6 | `dm_fee_value` | Percentage/100 (if type = %) |

### Admin Settings

| Cell | Variable | Russian Name |
|------|----------|--------------|
| AH11 | `rate_forex_risk` | Резерв на курсовую разницу (%) |

---

## 2. Product Columns (Row 16+)

**Source:** `backend/services/export_validation_service.py`

### Input Columns

| Column | Variable | Russian Name |
|--------|----------|--------------|
| B | `brand` | Бренд |
| C | `sku` | Артикул |
| D | `product_name` | Название товара |
| E | `quantity` | Количество |
| G | `weight_in_kg` | Вес, кг |
| J | `currency_of_base_price` | Валюта закупки |
| K | `base_price_vat` | Цена закупки (с VAT) |
| L | `supplier_country` | Страна закупки |
| O | `supplier_discount` | Скидка поставщика (%) |
| Q | `exchange_rate` | Курс к валюте КП |
| W | `customs_code` | Код ТН ВЭД |
| X | `import_tariff` | Пошлина (%) |
| AC | `markup` | Наценка (%) |

### Output Columns (Calculated)

| Column | Variable | Russian Name | Phase |
|--------|----------|--------------|-------|
| N | `purchase_price_no_vat` | Цена без VAT | 1 |
| P | `purchase_price_after_discount` | После скидки | 1 |
| R | `purchase_price_per_unit_quote_currency` | Цена за ед. в валюте КП | 1 |
| S | `purchase_price_total_quote_currency` | Стоимость закупки | 1 |
| T | `logistics_first_leg` | Логистика первый этап | 3 |
| U | `logistics_last_leg` | Логистика второй этап | 3 |
| V | `logistics_total` | Логистика итого | 3 |
| Y | `customs_fee` | Пошлина (сумма) | 4 |
| Z | `excise_tax_amount` | Акциз (сумма) | 4 |
| AA | `cogs_per_unit` | Себестоимость за ед. | 10 |
| AB | `cogs_per_product` | Себестоимость товара | 10 |
| AD | `sale_price_per_unit_excl_financial` | Цена продажи (без фин.) | 11 |
| AE | `sale_price_total_excl_financial` | Итого (без фин.) | 11 |
| AF | `profit` | Прибыль | 11 |
| AG | `dm_fee` | Вознаграждение ЛПР | 11 |
| AH | `forex_reserve` | Резерв на курсовую | 11 |
| AI | `financial_agent_fee` | Комиссия ФинАгента | 11 |
| **AJ** | `sales_price_per_unit_no_vat` | **Цена за ед. (без НДС)** | 11 |
| **AK** | `sales_price_total_no_vat` | **Итого (без НДС)** | 11 |
| **AL** | `sales_price_total_with_vat` | **Итого (с НДС)** | 12 |
| **AM** | `sales_price_per_unit_with_vat` | **Цена за ед. (с НДС)** | 12 |
| AN | `vat_from_sales` | НДС с продажи | 12 |
| AO | `vat_on_import` | НДС к вычету | 12 |
| AP | `vat_net_payable` | НДС к уплате | 12 |
| AQ | `transit_commission` | Транзитная комиссия | 13 |
| AX | `internal_sale_price_per_unit` | Внутренняя цена за ед. | 4 |
| AY | `internal_sale_price_total` | Внутренняя стоимость | 4 |
| BA | `financing_cost_initial` | Начальное финансирование | 9 |
| BB | `financing_cost_credit` | Проценты по отсрочке | 9 |

---

## 3. Quote Totals (Row 13)

| Cell | Variable | Russian Name |
|------|----------|--------------|
| S13 | `total_purchase_price` | Итого стоимость закупки |
| T13 | `total_logistics_first` | Логистика первый этап (итого) |
| U13 | `total_logistics_last` | Логистика второй этап (итого) |
| V13 | `total_logistics` | Логистика итого |
| AB13 | `total_cogs` | Себестоимость итого |
| **AK13** | `total_revenue` | **Выручка (без НДС)** |
| **AL13** | `total_revenue_with_vat` | **Выручка (с НДС)** |
| AF13 | `total_profit` | Прибыль итого |

---

## 4. Financing Cells

| Cell | Variable | Russian Name |
|------|----------|--------------|
| BH2 | `evaluated_revenue` | Оценочная выручка |
| BH3 | `client_advance` | Аванс клиента |
| BH4 | `total_before_forwarding` | Итого до экспедирования |
| BH6 | `supplier_payment` | Платеж поставщику |
| BJ7 | `supplier_financing_cost` | Стоимость фин-ия поставщика |
| BJ10 | `operational_financing_cost` | Стоимость операционного фин-ия |
| BJ11 | `total_financing_cost` | Итого стоимость финансирования |
| BL3 | `credit_sales_amount` | Сумма к оплате клиентом |
| BL4 | `credit_sales_fv` | FV с процентами |
| BL5 | `credit_sales_interest` | Проценты по отсрочке |

---

## 5. Currency in Exports

**Source:** `backend/services/export_data_mapper.py:124-128`

### Priority: Quote Currency First, USD Fallback

```python
# Client-facing prices - prefer quote currency if available
'AJ16': calc.get('sales_price_per_unit_quote', calc.get('sales_price_per_unit', 0)),
'AK16': calc.get('sales_price_total_quote', calc.get('sales_price_total_no_vat', 0)),
'AM16': calc.get('sales_price_per_unit_with_vat_quote', calc.get('sales_price_per_unit_with_vat', 0)),
'AL16': calc.get('sales_price_total_with_vat_quote', calc.get('sales_price_total_with_vat', 0)),
```

### Currency Symbol Mapping

```python
CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€',
    'RUB': '₽',
    'TRY': '₺',
    'CNY': '¥',
}
```

---

## 6. PDF Export Formats

### Supply PDF (9 columns)
Client-facing simplified quote:
- Product info: SKU, Brand, Name, Quantity
- Pricing: Final price per unit, Total price
- Summary: Total with/without VAT

### OpenBook PDF (21 columns)
Detailed breakdown showing all cost components:
- Purchase costs
- Logistics breakdown
- Customs & duties
- Margins & fees
- Final pricing with VAT

### Letter Formats
Formal business letter header + product grid:
- Recipient (customer contact info)
- Sender (manager info)
- Terms and conditions
- Payment terms summary

### Invoice PDF
Russian standard commercial invoice (Счет):
- Bank details
- INN/KPP
- Line items with VAT breakdown
- Total in words (Russian)

---

## 7. Value Transformations

**Source:** `backend/services/export_validation_service.py`

### Percentage Fields (Divide by 100)
```python
PERCENTAGE_FIELDS = {
    "advance_to_supplier",
    "advance_from_client",
    "advance_on_loading",
    "advance_on_shipping",
    "advance_on_customs",
    "rate_forex_risk",
    "supplier_discount",
    "import_tariff",
    "markup",
}

# 30 in API → 0.3 in Excel
if field in PERCENTAGE_FIELDS and value > 1:
    return value / 100
```

### Sale Type Mapping
```python
SALE_TYPE_MAP = {
    "openbook": "поставка",
    "supply": "поставка",
    "transit": "транзит",
    "fin_transit": "финтранзит",
    "export": "экспорт",
}
```

### Country Code Mapping
```python
COUNTRY_MAP = {
    "TR": "Турция",
    "CN": "Китай",
    "RU": "Россия",
    "DE": "Германия",
    "IT": "Италия",
    "LT": "Литва",
    "LV": "Латвия",
    "BG": "Болгария",
    "PL": "Польша",
    "AE": "ОАЭ",
}
```

---

## 8. Export Data Structure

**Source:** `backend/services/export_data_mapper.py`

```python
class ExportData(BaseModel):
    quote: Dict[str, Any]           # Quote metadata
    items: List[Dict[str, Any]]     # Products with calculation results
    customer: Optional[Dict]         # Customer info
    contact: Optional[Dict]          # Customer contact
    manager: Optional[Dict]          # Quote creator (manager info)
    organization: Dict[str, Any]     # Seller organization
    variables: Dict[str, Any]        # All 42 input variables
    calculations: Dict[str, Any]     # Totals + currency
```

### Manager Info Priority
```python
# Priority order for manager name/phone/email:
1. Quote-level override (manager_name, manager_phone, manager_email)
2. User profile (manager_name from user_profiles)
3. User fallback (full_name, phone, email)
```

### Payment Terms Display
```python
def format_payment_terms(variables):
    advance = variables.get('advance_from_client', 100)
    if advance >= 100:
        return "100% предоплата"
    elif advance <= 0:
        return "Постоплата"
    else:
        return f"{advance}% аванс"
```

---

## 9. Key Client-Facing Cells

**Most important for customer quotes:**

| Cell | Description | Notes |
|------|-------------|-------|
| **AJ16** | Price per unit (no VAT) | Main quote price |
| **AK16** | Total price (no VAT) | Quote total |
| **AM16** | Price per unit (with VAT) | Russian B2B standard |
| **AL16** | Total price (with VAT) | Final payment amount |
| **AK13** | Quote total (no VAT) | Summary line |
| **AL13** | Quote total (with VAT) | Summary line |

---

## 10. Validation Export Sheets

**Source:** `backend/services/export_validation_service.py`

| Sheet | Purpose |
|-------|---------|
| `API_Inputs` | All uploaded input values |
| `расчет` | Modified Excel template (refs API_Inputs) |
| `API_Results` | API calculation outputs |
| `Comparison` | Detailed cell-by-cell comparison |

### Conditional Formatting
Cells highlighted red when difference > 0.01% between API and Excel formula.

---

**Last Updated:** 2025-12-13
**Related Files:**
- `backend/services/export_data_mapper.py`
- `backend/services/export_validation_service.py`
- `backend/routes/quotes.py` (export endpoints)
