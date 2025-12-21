# Variable Mapping Reference

Complete mapping of 44 calculation variables across 4 layers: Excel → Backend → Calculation Engine → Database.

**Last Updated:** 2025-12-20

---

## Overview

### The 4-Layer Data Flow

```
Excel Upload          →  Backend Parsing      →  Calculation Engine    →  Database Storage
(User's spreadsheet)     (Pydantic models)       (Calculator input)       (PostgreSQL)
```

### Key Concepts

**Two-Tier Variable System:**
- **Quote-level defaults:** Apply to all products in the quote
- **Product-level overrides:** Override defaults for specific products (stored in `custom_fields` JSONB)
- **Lookup order:** Product override → Quote default → Fallback value

**Variable Access Levels:**
- **User (39 variables):** Editable by all users
- **Admin (5 variables):** Protected, only visible to admins in calculation_settings

**Variable Scope (Level):**
- **Product:** Stored per product row (quantity, weight, base_price)
- **Quote:** Stored once per quote (currency_of_quote, seller_company)
- **Both:** Can be set at quote level AND overridden per product

---

## Quick Reference by Category

### Product Info (5 variables)

| Variable | Russian | Excel | Level | Calc Engine | Database |
|----------|---------|-------|-------|-------------|----------|
| sku | Артикул | - | Product | ProductInfo.- | quote_items.product_code |
| brand | Бренд | - | Product | ProductInfo.- | quote_items.brand |
| base_price_VAT | Цена закупки (включает VAT) | K16 | Product | ProductInfo.base_price_VAT | quote_items.base_price_vat |
| quantity | Кол-во | E16 | Product | ProductInfo.quantity | quote_items.quantity |
| weight_in_kg | Вес (кг) | G16 | Product | ProductInfo.weight_in_kg | quote_items.weight_in_kg |

**Notes:**
- `sku` and `brand` are for analytics only, not used in calculations
- `base_price_VAT` is the purchase price INCLUDING supplier's VAT

---

### Financial (10 variables)

| Variable | Russian | Excel | Level | Access | Calc Engine | Database |
|----------|---------|-------|-------|--------|-------------|----------|
| currency_of_base_price | Валюта цены закупки | J16 | Both | User | ProductInfo.currency_of_base_price | variables JSONB + custom_fields |
| currency_of_quote | Валюта КП | D8 | Quote | User | FinancialParams.currency_of_quote | variables JSONB |
| exchange_rate_base_price_to_quote | Курс к валюте КП | Q16 | Both | User | FinancialParams.exchange_rate_base_price_to_quote | variables JSONB + custom_fields |
| supplier_discount | Скидка поставщика (%) | O16 | Both | User | FinancialParams.supplier_discount | variables JSONB + custom_fields |
| markup | Наценка (%) | AC16 | Both | User | FinancialParams.markup | variables JSONB + custom_fields |
| rate_forex_risk | Резерв на курсовой разнице (%) | AH11 | Quote | Admin | FinancialParams.rate_forex_risk | calculation_settings.rate_forex_risk |
| dm_fee_type | Вознаграждение ЛПР (тип) | AG3 | Quote | User | FinancialParams.dm_fee_type | variables JSONB |
| dm_fee_value | Вознаграждение ЛПР (значение) | AG7 | Quote | User | FinancialParams.dm_fee_value | variables JSONB |
| rate_fin_comm | Комиссия ФинАгента (%) | - | Quote | Admin | SystemConfig.rate_fin_comm | calculation_settings.rate_fin_comm |
| rate_loan_interest_annual | Годовая ставка займа (%) | - | Quote | Admin | SystemConfig.rate_loan_interest_annual | calculation_settings.rate_loan_interest_annual |

**Notes:**
- `exchange_rate_base_price_to_quote` is auto-fetched from CBR API
- `dm_fee_type` can be "fixed" or "%" (affects how dm_fee_value is applied)
- Admin variables are stored in `calculation_settings` table, not with the quote

---

### Logistics (6 variables)

| Variable | Russian | Excel | Level | Calc Engine | Database |
|----------|---------|-------|-------|-------------|----------|
| supplier_country | Страна закупки | L16 | Both | LogisticsParams.supplier_country | variables JSONB + custom_fields |
| offer_incoterms | Базис поставки Incoterms | D7 | Quote | LogisticsParams.offer_incoterms | variables JSONB |
| delivery_time | Срок поставки | D9 | Both | LogisticsParams.delivery_time | variables JSONB + custom_fields |
| logistics_supplier_hub | Логистика Поставщик-Хаб | W2 | Both | LogisticsParams.logistics_supplier_hub | variables JSONB + monetary_fields |
| logistics_hub_customs | Логистика Хаб-Таможня | W3 | Both | LogisticsParams.logistics_hub_customs | variables JSONB + monetary_fields |
| logistics_customs_client | Логистика Таможня-Клиент | W4 | Both | LogisticsParams.logistics_customs_client | variables JSONB + monetary_fields |

**Notes:**
- `supplier_country` affects VAT calculation (Russian vs foreign supplier)
- `offer_incoterms` values: DDP, DAP, CIF, FOB, EXW
- Logistics cost fields are **MonetaryValue** objects with currency selection:
  - `logistics_supplier_hub`: Default EUR
  - `logistics_hub_customs`: Default EUR
  - `logistics_customs_client`: Default RUB

---

### Taxes & Duties (4 variables)

| Variable | Russian | Excel | Level | Access | Calc Engine | Database |
|----------|---------|-------|-------|--------|-------------|----------|
| customs_code | Код ТН ВЭД | W16 | Both | User | ProductInfo.customs_code | variables JSONB + custom_fields |
| import_tariff | Пошлина (%) | X16 | Both | User | TaxesAndDuties.import_tariff | variables JSONB + custom_fields |
| excise_tax | Акциз | Z16 | Both | User | TaxesAndDuties.excise_tax | variables JSONB + custom_fields |
| util_fee | Утилизационный сбор | - | Quote | User | TaxesAndDuties.util_fee | variables JSONB |

**Notes:**
- `customs_code` is 10-digit ТН ВЭД code (Russian customs classification)
- `import_tariff` is percentage (e.g., 5 for 5%)
- `excise_tax` is per-kg amount (alcohol, tobacco, etc.)
- `util_fee` is for vehicles only, not subject to VAT

---

### Payment Terms (11 variables)

| Variable | Russian | Excel | Level | Access | Calc Engine | Database |
|----------|---------|-------|-------|--------|-------------|----------|
| advance_from_client | Аванс (%) | J5 | Quote | User | PaymentTerms.advance_from_client | variables JSONB |
| advance_to_supplier | Аванс поставщику (%) | D11 | Both | User | PaymentTerms.advance_to_supplier | variables JSONB + custom_fields |
| time_to_advance | Дней от подписания до аванса | K5 | Quote | User | PaymentTerms.time_to_advance | variables JSONB |
| advance_on_loading | Аванс при заборе груза (%) | J6 | Quote | User | PaymentTerms.advance_on_loading | variables JSONB |
| time_to_advance_loading | Дней от забора до аванса | K6 | Quote | User | PaymentTerms.time_to_advance_loading | variables JSONB |
| advance_on_going_to_country_destination | Аванс при отправке в РФ (%) | J7 | Quote | User | PaymentTerms.advance_on_going_to_country_destination | variables JSONB |
| time_to_advance_going_to_country_destination | Дней от отправки до аванса | K7 | Quote | User | PaymentTerms.time_to_advance_going_to_country_destination | variables JSONB |
| advance_on_customs_clearance | Аванс при таможне (%) | J8 | Quote | User | PaymentTerms.advance_on_customs_clearance | variables JSONB |
| time_to_advance_on_customs_clearance | Дней от таможни до аванса | K8 | Quote | User | PaymentTerms.time_to_advance_on_customs_clearance | variables JSONB |
| time_to_advance_on_receiving | Дней от получения до оплаты | K9 | Quote | User | PaymentTerms.time_to_advance_on_receiving | variables JSONB |
| customs_logistics_pmt_due | Срок оплаты таможни/логистики (дни) | - | Quote | Admin | SystemConfig.customs_logistics_pmt_due | calculation_settings.customs_logistics_pmt_due |

**Notes:**
- All percentages must sum to 100% across payment milestones
- Time values are in days
- `customs_logistics_pmt_due` is admin-only (affects financing cost calculation)

---

### Customs & Clearance (5 variables)

| Variable | Russian | Excel | Level | Calc Engine | Database |
|----------|---------|-------|-------|-------------|----------|
| brokerage_hub | Брокерские Хаб | W5 | Both | CustomsAndClearance.brokerage_hub | variables JSONB + monetary_fields |
| brokerage_customs | Брокерские Таможня | W6 | Both | CustomsAndClearance.brokerage_customs | variables JSONB + monetary_fields |
| warehousing_at_customs | Расходы на СВХ | W7 | Both | CustomsAndClearance.warehousing_at_customs | variables JSONB + monetary_fields |
| customs_documentation | Разрешительные документы | W8 | Both | CustomsAndClearance.customs_documentation | variables JSONB + monetary_fields |
| brokerage_extra | Прочее | W9 | Both | CustomsAndClearance.brokerage_extra | variables JSONB + monetary_fields |

**Notes:**
- All brokerage fields are **MonetaryValue** objects with currency selection
- Default currencies:
  - `brokerage_hub`: EUR
  - `brokerage_customs`, `warehousing_at_customs`, `customs_documentation`, `brokerage_extra`: RUB

---

### Company Settings (2 variables)

| Variable | Russian | Excel | Level | Calc Engine | Database |
|----------|---------|-------|-------|-------------|----------|
| seller_company | Компания-продавец | D5 | Quote | CompanySettings.seller_company | variables JSONB |
| offer_sale_type | Вид КП | D6 | Quote | CompanySettings.offer_sale_type | variables JSONB |

**Notes:**
- `seller_company` derives `seller_region` (for VAT calculation)
- `offer_sale_type` values: поставка, транзит, финтранзит, экспорт

---

### Admin-Only (Derived, 1 variable)

| Variable | Russian | Level | Calc Engine | Database |
|----------|---------|-------|-------------|----------|
| rate_loan_interest_daily | Дневная стоимость денег (%) | Quote | SystemConfig.rate_loan_interest_daily | calculation_settings.rate_loan_interest_daily |

**Notes:**
- Auto-calculated as `rate_loan_interest_annual / 365`
- Can be overridden by admin if needed

---

## Database Storage Details

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| quote_items | Product-level data | base_price_vat, quantity, weight_in_kg, product_code, brand, custom_fields |
| quote_calculation_variables | Quote-level variables | variables (JSONB) |
| quote_calculation_results | Calculation outputs | phase_results (JSONB) |
| quote_calculation_summaries | Pre-aggregated totals | calc_n16_*, calc_p16_*, etc. |
| calculation_settings | Admin-only variables | rate_forex_risk, rate_fin_comm, rate_loan_interest_daily, customs_logistics_pmt_due |

### Two-Tier Storage Pattern

**Quote-level variables:**
```sql
quote_calculation_variables.variables = {
  "currency_of_quote": "USD",
  "seller_company": "МАСТЕР БЭРИНГ ООО",
  "markup": 15,
  ...
}
```

**Product-level overrides:**
```sql
quote_items.custom_fields = {
  "markup": 20,           -- overrides quote default of 15
  "supplier_discount": 5  -- override for this product only
}
```

### MonetaryValue Storage

Multi-currency fields (logistics, brokerage) store both value and currency:

```sql
quote_calculation_variables.variables = {
  "logistics_supplier_hub": {
    "value": 500,
    "currency": "EUR"
  },
  "brokerage_customs": {
    "value": 15000,
    "currency": "RUB"
  }
}
```

---

## Pydantic Models Reference

### ProductFromFile (Excel Upload)
```python
class ProductFromFile(BaseModel):
    product_code: Optional[str]  # sku
    brand: Optional[str]
    base_price_vat: Decimal
    quantity: int
    weight_in_kg: Optional[Decimal] = 0
    currency_of_base_price: Optional[str]
    supplier_country: Optional[str]
    supplier_discount: Optional[Decimal]
    customs_code: Optional[str]
    import_tariff: Optional[Decimal]
    excise_tax: Optional[Decimal]
    markup: Optional[Decimal]
    exchange_rate_base_price_to_quote: Optional[Decimal]
    delivery_time: Optional[int]
    advance_to_supplier: Optional[Decimal]
```

### Calculation Engine Models
- **ProductInfo:** base_price_VAT, quantity, weight_in_kg, currency_of_base_price, customs_code
- **FinancialParams:** currency_of_quote, exchange_rate, supplier_discount, markup, dm_fee_*, rate_forex_risk
- **LogisticsParams:** supplier_country, offer_incoterms, delivery_time, logistics_*
- **TaxesAndDuties:** import_tariff, excise_tax, util_fee
- **PaymentTerms:** advance_from_client, advance_to_supplier, time_to_advance_*, advance_on_*
- **CustomsAndClearance:** brokerage_*, warehousing_at_customs, customs_documentation
- **CompanySettings:** seller_company, offer_sale_type
- **SystemConfig:** rate_fin_comm, rate_loan_interest_daily, customs_logistics_pmt_due

---

## Excel Cell Reference

| Cell | Variable | Category |
|------|----------|----------|
| D5 | seller_company | Company Settings |
| D6 | offer_sale_type | Company Settings |
| D7 | offer_incoterms | Logistics |
| D8 | currency_of_quote | Financial |
| D9 | delivery_time | Logistics |
| D11 | advance_to_supplier | Payment Terms |
| E16 | quantity | Product Info |
| G16 | weight_in_kg | Product Info |
| J5 | advance_from_client | Payment Terms |
| J6 | advance_on_loading | Payment Terms |
| J7 | advance_on_going_to_country_destination | Payment Terms |
| J8 | advance_on_customs_clearance | Payment Terms |
| J16 | currency_of_base_price | Financial |
| K5 | time_to_advance | Payment Terms |
| K6 | time_to_advance_loading | Payment Terms |
| K7 | time_to_advance_going_to_country_destination | Payment Terms |
| K8 | time_to_advance_on_customs_clearance | Payment Terms |
| K9 | time_to_advance_on_receiving | Payment Terms |
| K16 | base_price_VAT | Product Info |
| L16 | supplier_country | Logistics |
| O16 | supplier_discount | Financial |
| Q16 | exchange_rate_base_price_to_quote | Financial |
| W2 | logistics_supplier_hub | Logistics |
| W3 | logistics_hub_customs | Logistics |
| W4 | logistics_customs_client | Logistics |
| W5 | brokerage_hub | Customs & Clearance |
| W6 | brokerage_customs | Customs & Clearance |
| W7 | warehousing_at_customs | Customs & Clearance |
| W8 | customs_documentation | Customs & Clearance |
| W9 | brokerage_extra | Customs & Clearance |
| W16 | customs_code | Taxes & Duties |
| X16 | import_tariff | Taxes & Duties |
| Z16 | excise_tax | Taxes & Duties |
| AC16 | markup | Financial |
| AG3 | dm_fee_type | Financial |
| AG7 | dm_fee_value | Financial |
| AH11 | rate_forex_risk | Financial (Admin) |

---

## See Also

- **Full CSV:** `.claude/reference/variable-mapping.csv` - Sortable/filterable spreadsheet
- **Calculation Engine:** `.claude/skills/calculation-engine-guidelines/` - 13-phase calculation pipeline
- **42 Variables Reference:** `.claude/VARIABLES.md` - Original variable documentation
- **Archive:** `.claude/archive/Variables_specification_notion.md` - Excel formulas and cell references
