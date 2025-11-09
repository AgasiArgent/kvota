# Variables Reference Guide

**Complete reference for all 44 variables in B2B quotation platform**

**Last Updated:** 2025-11-09

Quick navigation:
- [Section 1: Master Variables Table](#section-1-master-variables-table) - All 44 variables overview
- [Section 2: UI Implementation](#section-2-ui-implementation) - Where variables appear in UI
- [Section 3: Derived Variables](#section-3-derived-variables) - Auto-calculated from user inputs
- [Section 4: Admin Variables](#section-4-admin-variables) - System-wide settings
- [Section 5: Key Formulas](#section-5-key-formulas) - Important calculation references

---

## Section 1: Master Variables Table

**Total: 44 variables** (Updated 2025-11-09: +2 new admin variables)
- Product-only: 5 (sku, brand, base_price_VAT, quantity, weight_in_kg)
- Quote-only: 19
- Both levels: 15 (can be quote default OR product override)
- Admin-only: 5 (rate_forex_risk, rate_fin_comm, rate_loan_interest_annual, rate_loan_interest_daily, customs_logistics_pmt_due)

### Complete Variables List

| # | Variable Name | Level | Access | Russian Name | Category | UI Location | Excel |
|---|---------------|-------|--------|--------------|----------|-------------|-------|
| 1 | sku | Product | User | Артикул | Product Info | File + Table | - |
| 2 | brand | Product | User | Бренд | Product Info | File + Table | - |
| 3 | base_price_VAT | Product | User | Цена закупки (включает VAT) | Product Info | File + Table | K16 |
| 4 | quantity | Product | User | Кол-во | Product Info | File + Table | E16 |
| 5 | weight_in_kg | Product | User | Вес (кг) | Product Info | File + Table | G16 |
| 6 | currency_of_base_price | Both | User | Валюта цены закупки | Financial | File + Table + Form | J16 |
| 7 | currency_of_quote | Quote | User | Валюта КП | Financial | Form | D8 |
| 8 | exchange_rate_base_price_to_quote | Both | User | Курс к валюте КП | Financial | File + Table + Form | Q16 |
| 9 | supplier_country | Both | User | Страна закупки | Logistics | File + Table + Form | L16 |
| 10 | supplier_discount | Both | User | Скидка поставщика (%) | Financial | File + Table + Form | O16 |
| 11 | customs_code | Both | User | Код ТН ВЭД | Product Info | File + Table + Form | W16 |
| 12 | import_tariff | Both | User | Пошлина (%) | Taxes & Duties | File + Table + Form | X16 |
| 13 | excise_tax | Both | User | Акциз | Taxes & Duties | File + Table + Form | Z16 |
| 14 | markup | Both | User | Наценка (%) | Financial | Table + Form | AC16 |
| 15 | rate_forex_risk | Quote | Admin | Резерв на курсовой разнице (%) | Financial | Admin Settings | AH11 |
| 16 | seller_company | Quote | User | Компания-продавец | Company Settings | Form | D5 |
| 17 | offer_sale_type | Quote | User | Вид КП | Company Settings | Form | D6 |
| 18 | offer_incoterms | Quote | User | Базис поставки Incoterms | Logistics | Form | D7 |
| 19 | delivery_time | Both | User | Срок поставки | Logistics | Table + Form | D9 |
| 20 | advance_from_client | Quote | User | Аванс (%) | Payment Terms | Form | J5 |
| 21 | advance_to_supplier | Both | User | Аванс поставщику (%) | Payment Terms | Table + Form | D11 |
| 22 | time_to_advance | Quote | User | Дней от подписания до аванса | Payment Terms | Form | K5 |
| 23 | advance_on_loading | Quote | User | Аванс при заборе груза (%) | Payment Terms | Form | J6 |
| 24 | time_to_advance_loading | Quote | User | Дней от забора до аванса | Payment Terms | Form | K6 |
| 25 | advance_on_going_to_country_destination | Quote | User | Аванс при отправке в РФ (%) | Payment Terms | Form | J7 |
| 26 | time_to_advance_going_to_country_destination | Quote | User | Дней от отправки до аванса | Payment Terms | Form | K7 |
| 27 | advance_on_customs_clearance | Quote | User | Аванс при таможне (%) | Payment Terms | Form | J8 |
| 28 | time_to_advance_on_customs_clearance | Quote | User | Дней от таможни до аванса | Payment Terms | Form | K8 |
| 29 | time_to_advance_on_receiving | Quote | User | Дней от получения до оплаты | Payment Terms | Form | K9 |
| 30 | logistics_supplier_hub | Both | User | Логистика Поставщик-Турция | Logistics | Form | W2 |
| 31 | logistics_hub_customs | Both | User | Логистика Турция-РФ | Logistics | Form | W3 |
| 32 | logistics_customs_client | Both | User | Логистика Таможня-Клиент | Logistics | Form | W4 |
| 33 | brokerage_hub | Both | User | Брокерские Турция | Customs & Clearance | Form | W5 |
| 34 | brokerage_customs | Both | User | Брокерские РФ | Customs & Clearance | Form | W6 |
| 35 | warehousing_at_customs | Both | User | Расходы на СВХ | Customs & Clearance | Form | W7 |
| 36 | customs_documentation | Both | User | Разрешительные документы | Customs & Clearance | Form | W8 |
| 37 | brokerage_extra | Both | User | Прочее | Customs & Clearance | Form | W9 |
| 38 | dm_fee_type | Quote | User | Вознаграждение ЛПР (тип) | Financial | Form | AG3 |
| 39 | dm_fee_value | Quote | User | Вознаграждение ЛПР (значение) | Financial | Form | AG7 |
| 40 | util_fee | Quote | User | Утилизационный сбор | Taxes & Duties | Form | - |
| 41 | rate_fin_comm | Quote | Admin | Комиссия ФинАгента (%) | Financial | Admin Settings | - |
| 42 | rate_loan_interest_annual | Quote | Admin | Годовая ставка займа (%) | Financial | Admin Settings | - |
| 43 | rate_loan_interest_daily | Quote | Admin | Дневная стоимость денег (%) | Financial | Admin Settings (auto-calc) | - |
| 44 | customs_logistics_pmt_due | Quote | Admin | Срок оплаты таможни/логистики (дни) | Payment Terms | Admin Settings | - |

---

## Section 2: UI Implementation

### Quote Creation Page Structure

**Admin Settings Info Box** (Read-only, auto-loaded)
- rate_forex_risk (#15)
- rate_fin_comm (#41)
- rate_loan_interest_annual (#42) - NEW 2025-11-09
- rate_loan_interest_daily (#43) - auto-calculated from annual
- customs_logistics_pmt_due (#44) - NEW 2025-11-09

**Quote-Level Defaults Form** (6 collapsible cards)

1. **Company Settings** (3 fields)
   - seller_company (#16)
   - offer_sale_type (#17)
   - offer_incoterms (#18)

2. **Financial Parameters** (4 fields)
   - currency_of_quote (#7)
   - markup (#14) - default for all products
   - dm_fee_type (#38)
   - dm_fee_value (#39)

3. **Logistics** (5 fields)
   - delivery_time (#19) - default for all products
   - logistics_supplier_hub (#30)
   - logistics_hub_customs (#31)
   - logistics_customs_client (#32)

4. **Payment Terms** (10 fields)
   - advance_from_client (#20)
   - advance_to_supplier (#21) - default for all products
   - time_to_advance (#22)
   - advance_on_loading (#23)
   - time_to_advance_loading (#24)
   - advance_on_going_to_country_destination (#25)
   - time_to_advance_going_to_country_destination (#26)
   - advance_on_customs_clearance (#27)
   - time_to_advance_on_customs_clearance (#28)
   - time_to_advance_on_receiving (#29)

5. **Customs & Clearance** (6 fields)
   - brokerage_hub (#33)
   - brokerage_customs (#34)
   - warehousing_at_customs (#35)
   - customs_documentation (#36)
   - brokerage_extra (#37)
   - util_fee (#40)

6. **Product Defaults** (7 fields) - Can be overridden per product
   - currency_of_base_price (#6)
   - supplier_country (#9)
   - supplier_discount (#10)
   - exchange_rate_base_price_to_quote (#8)
   - customs_code (#11)
   - import_tariff (#12)
   - excise_tax (#13)

**ag-Grid Products Table**

Column Group 1: "Информация о товаре" (Always Editable)
- sku (#1)
- brand (#2)
- Product Name
- base_price_VAT (#3)
- quantity (#4)
- weight_in_kg (#5)

Column Group 2: "Переопределяемые параметры" (Optional Overrides)
- currency_of_base_price (#6) - Gray if empty, Blue if filled
- supplier_country (#9)
- supplier_discount (#10)
- exchange_rate_base_price_to_quote (#8)
- customs_code (#11)
- import_tariff (#12)
- excise_tax (#13)
- markup (#14)

**Color Coding:**
- White background: Always editable fields (product info)
- Gray background (#f5f5f5): Empty override fields (using quote default)
- Blue background (#e6f7ff): Filled override fields (overriding quote default)
- Red background: Admin-only fields (future: admin can override per product)

---

## Section 3: Derived Variables

These are NOT user inputs - automatically calculated from user selections.

### seller_region

**Derived from:** seller_company (#16)

**Mapping:**
```python
SELLER_REGION_MAP = {
    "МАСТЕР БЭРИНГ ООО": "RU",
    "ЦМТО1 ООО": "RU",
    "РАД РЕСУРС ООО": "RU",
    "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ": "TR",
    "GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ": "TR",
    "UPDOOR Limited": "CN"
}
```

**Usage:** Determines which country we're selling from, affects VAT and markup calculations.

### vat_seller_country (M16)

**Derived from:** supplier_country (#9)

**Purpose:** VAT rate in supplier's country

**Key Rates:**
- Турция: 20%
- Турция (транзитная зона): 0%
- Россия: 20%
- Китай: 13%
- ОАЭ: 5%
- ЕС (между странами ЕС): 0%
- Прочие: 0%

### internal_markup

**Derived from:** supplier_country (#9) + seller_region (from #16)

**Purpose:** Internal markup percentage based on trade route

**Example rates:**
- Турция → RU: 10%
- Турция → TR: 0%
- Китай → RU: 10%
- ОАЭ → RU: 11%
- ОАЭ → TR: 1%

### rate_vatRu

**Derived from:** seller_region (from #16)

**Purpose:** VAT rate in seller's destination country

**Rates:**
- RU: 20%
- TR: 0% (not yet implemented)
- CN: 0% (not yet implemented)

**Key difference:**
- `vat_seller_country` = VAT where we BUY from
- `rate_vatRu` = VAT where we SELL from

---

## Section 4: Admin Variables

**Access:** Admin/Owner roles only
**Scope:** Apply to ALL quotes organization-wide
**Location:** Settings > Calculation Settings page
**Storage:** `calculation_settings` table

### rate_forex_risk (#15)
- **Default:** 3%
- **Purpose:** Reserve for currency exchange losses
- **Range:** 0-100%
- **Example:** If rate = 3%, adds 3% buffer to costs for FX risk

### rate_fin_comm (#41)
- **Default:** 2%
- **Purpose:** Financial agent fee for cross-border transactions
- **Range:** 0-100%
- **Note:** Not applied for Turkey sellers or Export deals

### rate_loan_interest_annual (#42) - NEW 2025-11-09
- **Default:** 25% (0.25 as decimal)
- **Purpose:** Annual loan interest rate for financing
- **Range:** 0-100%
- **Input:** Admin enters annual rate in UI
- **Storage:** Saved in `calculation_settings` table
- **Usage:** Auto-converted to daily rate (annual / 365) for calculations

### rate_loan_interest_daily (#43)
- **Default:** 0.000685 (25% / 365)
- **Purpose:** Daily cost of borrowing money to finance deals
- **Calculation:** AUTOMATIC - calculated as rate_loan_interest_annual / 365
- **Formula:** daily_rate = annual_rate / 365
- **Usage:** Used in BI7, BI10, BL4 formulas (simple interest)
- **Updated 2025-11-09:** Now calculated from annual rate, not stored directly

### customs_logistics_pmt_due (#44) - NEW 2025-11-09
- **Default:** 10 days
- **Purpose:** Payment term for customs and logistics costs
- **Range:** 0-365 days
- **Input:** Admin enters number of days in UI
- **Usage:** Used in BI10 formula: BI10 = BH10 × (1 + rate_loan_interest_daily × customs_logistics_pmt_due)
- **Example:** If 10 days and rate = 0.000685, interest factor = 1 + 0.000685 × 10 = 1.00685

---

## Section 5: Key Formulas

### Two-Tier Variable System

**Quote-level defaults** apply to all products unless overridden.

**Product-level overrides** replace the default for specific products.

**Implementation pattern:**
```python
def get_effective_value(product, quote, field_name):
    """Get effective value - product override or quote default"""
    product_value = getattr(product, field_name, None)
    if product_value is not None and product_value != "":
        return product_value  # Product override
    return getattr(quote, field_name)  # Quote default
```

### Cost Distribution Logic

Many quote-level costs (logistics, financing) are distributed across products proportionally.

**Distribution base (BD16):**
```
BD16 = product_purchase_price / total_quote_purchase_price
```

**Example distributions:**
- Financing cost per product = Total_financing_cost × BD16
- Logistics cost per product = Total_logistics_cost × BD16

### Financing Model

**Three scenarios:**
1. **Supplier payment financing (BJ7)** - Two-stage calculation
   - Stage 1: Borrow full amount until client advance (K5 days)
   - Stage 2: Borrow reduced amount until final payment

2. **Operational costs financing (BJ10)** - Single-stage
   - Finance logistics, customs, duties, VAT

3. **Credit sales interest (BL5)** - Single-stage
   - Finance receivables after delivery until final payment

**Key formula:**
```python
FV = PV × (1 + daily_rate)^days
Interest_cost = FV - PV
```

### offer_sale_type Impact

**Valid values:**
- поставка (Supply) - Standard import to Russia
- транзит (Transit) - Goods transit through Russia
- финтранзит (Financial Transit) - Transit with financial transactions
- экспорт (Export) - Export from Russia

**Formula impacts:**
- Profit calculation base (COGS vs purchase price)
- Financial agent fee (excluded for export)
- Customs fee calculation
- Import VAT (excluded for export)
- Transit commission

---

## Quick Reference by Category

**Product Info (7):** sku, brand, base_price_VAT, quantity, weight_in_kg, customs_code, currency_of_base_price

**Financial (10):** currency_of_quote, exchange_rate_base_price_to_quote, supplier_discount, markup, rate_forex_risk, dm_fee_type, dm_fee_value, rate_fin_comm, rate_loan_interest_annual, rate_loan_interest_daily

**Logistics (7):** supplier_country, delivery_time, offer_incoterms, logistics_supplier_hub, logistics_hub_customs, logistics_customs_client

**Payment Terms (11):** advance_from_client, advance_to_supplier, time_to_advance, advance_on_loading, time_to_advance_loading, advance_on_going_to_country_destination, time_to_advance_going_to_country_destination, advance_on_customs_clearance, time_to_advance_on_customs_clearance, time_to_advance_on_receiving, customs_logistics_pmt_due

**Taxes & Duties (3):** import_tariff, excise_tax, util_fee

**Customs & Clearance (5):** brokerage_hub, brokerage_customs, warehousing_at_customs, customs_documentation, brokerage_extra

**Company Settings (2):** seller_company, offer_sale_type

---

**Last Updated:** 2025-11-09
**Status:** Complete - All 44 variables documented (Added rate_loan_interest_annual, customs_logistics_pmt_due)
