# Variable Specification Reference

**Complete reference for all 42 variables in B2B quotation platform**

**Created:** 2025-10-29
**Updated:** 2025-10-29
**Status:** Production Ready

---

## Quick Navigation

- [Classification System](#classification-system)
- [Product-Only Variables (5)](#product-only-variables-5)
- [Quote-Only Variables (19)](#quote-only-variables-19)
- [Both-Level Variables (15)](#both-level-variables-15)
- [Admin-Only Variables (3)](#admin-only-variables-3)
- [Category Index](#category-index)
- [Excel Column Mapping](#excel-column-mapping)
- [Two-Tier Variable System](#two-tier-variable-system)
- [Validation Rules](#validation-rules)

---

## Classification System

**Total: 42 variables** categorized into 4 levels:

| Classification | Count | Scope | Storage | Edit Access |
|---|---|---|---|---|
| **Product-Only** | 5 | Per product in grid | products table | User (always) |
| **Quote-Only** | 19 | Entire quote | quotes table | User/Admin (mixed) |
| **Both Levels** | 15 | Quote default + product override | Both tables | User (override), User/Admin (default) |
| **Admin-Only** | 3 | Organization-wide | calculation_settings | Admin/Owner only |
| **TOTAL** | **42** | Mixed | Mixed | Mixed |

---

## Product-Only Variables (5)

**Cannot have quote defaults - must be specified per product**

Located in `ag-Grid` "Информация о товаре" (Product Information) column group.

| # | Variable | Russian Name | Type | Default | Excel | Required |
|---|---|---|---|---|---|---|
| 1 | `sku` | Артикул | string | None | - | Yes |
| 2 | `brand` | Бренд | string | None | - | Yes |
| 3 | `base_price_VAT` | Цена закупки (включает VAT) | decimal | None | K16 | Yes |
| 4 | `quantity` | Кол-во | integer | None | E16 | Yes |
| 5 | `weight_in_kg` | Вес (кг) | decimal | None | G16 | No |

### Key Characteristics:
- **Always required** in products table
- **Always editable** (white background in grid)
- **Cannot be overridden** - each product must specify
- **UI Location:** Loaded from Excel file during quote creation
- **Validation:** sku and brand must be non-empty strings

---

## Quote-Only Variables (19)

**Set once at quote level - cannot override per product**

### Part 1: Company Settings (3 variables)

| # | Variable | Russian Name | Type | Default | Excel | Required |
|---|---|---|---|---|---|
| 16 | `seller_company` | Компания-продавец | string | User's org | D5 | Yes |
| 17 | `offer_sale_type` | Вид КП | enum | "поставка" | D6 | Yes |
| 18 | `offer_incoterms` | Базис поставки (Incoterms) | enum | "EXW" | D7 | Yes |

**Valid `offer_sale_type` values:**
- `поставка` (Supply) - Standard import to Russia
- `транзит` (Transit) - Goods transit through Russia
- `финтранзит` (Financial Transit) - Transit with financial transactions
- `экспорт` (Export) - Export from Russia

**Valid `offer_incoterms` values:**
- `EXW` (Ex Works)
- `FOB` (Free On Board)
- `CIF` (Cost, Insurance & Freight)
- `DDP` (Delivered Duty Paid)

### Part 2: Financial Parameters (4 variables)

| # | Variable | Russian Name | Type | Default | Excel | Admin? |
|---|---|---|---|---|---|---|
| 7 | `currency_of_quote` | Валюта КП | enum | "RUB" | D8 | No |
| 38 | `dm_fee_type` | Вознаграждение ЛПР (тип) | enum | "none" | AG3 | No |
| 39 | `dm_fee_value` | Вознаграждение ЛПР (значение) | decimal | 0 | AG7 | No |
| 40 | `util_fee` | Утилизационный сбор | decimal | 0 | - | No |

**Valid `currency_of_quote` values:**
- `USD`
- `RUB`
- `EUR`

**Valid `dm_fee_type` values:**
- `none` - No fee
- `percent` - Percentage of amount
- `fixed` - Fixed amount

### Part 3: Payment Terms (10 variables)

| # | Variable | Russian Name | Type | Default | Excel | Description |
|---|---|---|---|---|---|---|
| 20 | `advance_from_client` | Аванс (%) | decimal(0-100) | 30 | J5 | Client's initial advance payment |
| 22 | `time_to_advance` | Дней от подписания до аванса | integer | 7 | K5 | Days from signing until advance due |
| 23 | `advance_on_loading` | Аванс при заборе груза (%) | decimal(0-100) | 0 | J6 | Additional advance at loading |
| 24 | `time_to_advance_loading` | Дней от забора до аванса | integer | 0 | K6 | Days from loading until payment |
| 25 | `advance_on_going_to_country_destination` | Аванс при отправке в РФ (%) | decimal(0-100) | 0 | J7 | Advance when shipping to Russia |
| 26 | `time_to_advance_going_to_country_destination` | Дней от отправки до аванса | integer | 0 | K7 | Days from shipping until payment |
| 27 | `advance_on_customs_clearance` | Аванс при таможне (%) | decimal(0-100) | 0 | J8 | Advance at customs clearance |
| 28 | `time_to_advance_on_customs_clearance` | Дней от таможни до аванса | integer | 0 | K8 | Days from customs until payment |
| 29 | `time_to_advance_on_receiving` | Дней от получения до оплаты | integer | 0 | K9 | Days from delivery until final payment |

**Special Logic:** Total must equal 100%
```python
total_advance = (advance_from_client + advance_on_loading +
                 advance_on_going_to_country_destination +
                 advance_on_customs_clearance)
# Should = 100% for complete coverage
```

### Part 4: Admin Variables (3 variables)

| # | Variable | Russian Name | Type | Default | Excel | Admin |
|---|---|---|---|---|---|---|
| 15 | `rate_forex_risk` | Резерв на курсовой разнице (%) | decimal | 3% | AH11 | **Yes** |
| 41 | `rate_fin_comm` | Комиссия ФинАгента (%) | decimal | 2% | - | **Yes** |
| 42 | `rate_loan_interest_daily` | Дневная стоимость денег (%) | decimal | 0.00069 | - | **Yes** |

**Storage:** `calculation_settings` table (organization-wide)
**Access:** Admin/Owner roles only via Settings > Calculation Settings
**Application:** Auto-fetched during quote creation, same value applies to all products in quote

**Admin Variable Details:**

- **`rate_forex_risk`:** Reserve for currency exchange losses (0-100%)
  - Example: 3% rate adds 3% buffer to all costs

- **`rate_fin_comm`:** Financial agent fee for cross-border transactions (0-100%)
  - Not applied for Turkish sellers or Export deals

- **`rate_loan_interest_daily`:** Daily cost of borrowing money
  - Default: 0.00069 (approximately 25% annual)
  - Formula: daily_rate = annual_rate / 365
  - Used in FV calculations for financing costs

---

## Both-Level Variables (15)

**Can be set as quote default AND overridden per product**

### Strategy:
1. **Quote-level form** shows defaults
2. **ag-Grid "Переопределяемые параметры"** allows per-product overrides
3. **Color coding:** Gray (default) → Blue (override filled)

### Part 1: Financial & Pricing (5 variables)

| # | Variable | Russian Name | Type | Default | Excel | Quote Default | Product Override |
|---|---|---|---|---|---|---|---|
| 6 | `currency_of_base_price` | Валюта цены закупки | enum | "USD" | J16 | Form | Grid |
| 8 | `exchange_rate_base_price_to_quote` | Курс к валюте КП | decimal | CBR API | Q16 | Form | Grid |
| 10 | `supplier_discount` | Скидка поставщика (%) | decimal | 0% | O16 | Form | Grid |
| 14 | `markup` | Наценка (%) | decimal | 10% | AC16 | Form | Grid |
| 21 | `advance_to_supplier` | Аванс поставщику (%) | decimal | 30% | D11 | Form | Grid |

**Valid `currency_of_base_price` values:**
- `USD`
- `RUB`
- `EUR`
- `TRY` (Turkish Lira)
- `CNY` (Chinese Yuan)

**Exchange Rate:** Auto-fetched from CBR API (daily cron), can be manually overridden

### Part 2: Logistics & Country (3 variables)

| # | Variable | Russian Name | Type | Default | Excel | Quote Default | Product Override |
|---|---|---|---|---|---|---|---|
| 9 | `supplier_country` | Страна закупки | enum | "Турция" | L16 | Form | Grid |
| 19 | `delivery_time` | Срок поставки | integer | 60 | D9 | Form | Grid |
| 30 | `logistics_supplier_hub` | Логистика Поставщик-Турция | decimal | 0 | W2 | Form | Grid |
| 31 | `logistics_hub_customs` | Логистика Турция-РФ | decimal | 0 | W3 | Form | Grid |
| 32 | `logistics_customs_client` | Логистика Таможня-Клиент | decimal | 0 | W4 | Form | Grid |

**Valid `supplier_country` values:**
- Турция (Turkey)
- Турция (транзитная зона) - Turkey (transit zone)
- Россия (Russia)
- Китай (China)
- ОАЭ (UAE)
- ЕС (ЕС между странами) - EU (intra-EU)
- Прочие (Other)

**Logistics Note:** Distribution base (BD16) = product_purchase_price / total_quote_purchase_price
All quote-level logistics costs distributed proportionally to products

### Part 3: Product Details & Taxes (4 variables)

| # | Variable | Russian Name | Type | Default | Excel | Quote Default | Product Override |
|---|---|---|---|---|---|---|---|
| 11 | `customs_code` | Код ТН ВЭД | string | "" | W16 | Form | Grid |
| 12 | `import_tariff` | Пошлина (%) | decimal | 0% | X16 | Form | Grid |
| 13 | `excise_tax` | Акциз | decimal | 0 | Z16 | Form | Grid |

**Customs Code:** Russian commodity classification (ТН ВЭД)
**Import Tariff:** Percentage applied to customs value (0-100%)
**Excise Tax:** Fixed amount per unit or percentage

### Part 4: Customs & Clearance (3 variables)

| # | Variable | Russian Name | Type | Default | Excel | Quote Default | Product Override |
|---|---|---|---|---|---|---|---|
| 33 | `brokerage_hub` | Брокерские Турция | decimal | 0 | W5 | Form | Grid |
| 34 | `brokerage_customs` | Брокерские РФ | decimal | 0 | W6 | Form | Grid |
| 35 | `warehousing_at_customs` | Расходы на СВХ | decimal | 0 | W7 | Form | Grid |
| 36 | `customs_documentation` | Разрешительные документы | decimal | 0 | W8 | Form | Grid |
| 37 | `brokerage_extra` | Прочее | decimal | 0 | W9 | Form | Grid |

---

## Admin-Only Variables (3)

**See [Quote-Only Variables Part 4](#part-4-admin-variables-3-variables) above for full details**

Stored in `calculation_settings` table, apply organization-wide:
- `rate_forex_risk` (15)
- `rate_fin_comm` (41)
- `rate_loan_interest_daily` (42)

---

## Category Index

**Quick lookup by category:**

### Product Info (7 variables)
`sku`, `brand`, `base_price_VAT`, `quantity`, `weight_in_kg`, `customs_code`, `currency_of_base_price`

### Financial (9 variables)
`currency_of_quote`, `exchange_rate_base_price_to_quote`, `supplier_discount`, `markup`, `rate_forex_risk`, `dm_fee_type`, `dm_fee_value`, `rate_fin_comm`, `rate_loan_interest_daily`

### Logistics (8 variables)
`supplier_country`, `delivery_time`, `offer_incoterms`, `logistics_supplier_hub`, `logistics_hub_customs`, `logistics_customs_client`

### Taxes & Duties (4 variables)
`import_tariff`, `excise_tax`, `util_fee`, `brokerage_hub`, `brokerage_customs`, `warehousing_at_customs`, `customs_documentation`, `brokerage_extra`

### Payment Terms (12 variables)
`advance_from_client`, `advance_to_supplier`, `time_to_advance`, `advance_on_loading`, `time_to_advance_loading`, `advance_on_going_to_country_destination`, `time_to_advance_going_to_country_destination`, `advance_on_customs_clearance`, `time_to_advance_on_customs_clearance`, `time_to_advance_on_receiving`

### Company Settings (2 variables)
`seller_company`, `offer_sale_type`

---

## Excel Column Mapping

**Reference for Excel template import** (Quote template in Master Bearing spreadsheet)

| Variable | Column | Row(s) | Notes |
|---|---|---|---|
| `seller_company` | D | 5 | Company name |
| `offer_sale_type` | D | 6 | Supply type |
| `offer_incoterms` | D | 7 | Incoterms basis |
| `currency_of_quote` | D | 8 | Quote currency |
| `delivery_time` | D | 9 | Days |
| `advance_to_supplier` | D | 11 | % |
| `rate_forex_risk` | AH | 11 | Admin variable |
| `advance_from_client` | J | 5 | % |
| `advance_on_loading` | J | 6 | % |
| `advance_on_going_to_country_destination` | J | 7 | % |
| `advance_on_customs_clearance` | J | 8 | % |
| `time_to_advance` | K | 5 | Days |
| `time_to_advance_loading` | K | 6 | Days |
| `time_to_advance_going_to_country_destination` | K | 7 | Days |
| `time_to_advance_on_customs_clearance` | K | 8 | Days |
| `time_to_advance_on_receiving` | K | 9 | Days |
| **PRODUCT ROWS (starts at 16)** | | |
| `quantity` | E | 16+ | Per product |
| `weight_in_kg` | G | 16+ | Per product |
| `currency_of_base_price` | J | 16+ | Per product |
| `base_price_VAT` | K | 16+ | Per product |
| `supplier_country` | L | 16+ | Per product |
| `supplier_discount` | O | 16+ | Per product |
| `exchange_rate_base_price_to_quote` | Q | 16+ | Per product |
| `customs_code` | W | 16+ | Per product |
| `import_tariff` | X | 16+ | Per product |
| `excise_tax` | Z | 16+ | Per product |
| `markup` | AC | 16+ | Per product |
| `dm_fee_type` | AG | 3 | Quote level |
| `dm_fee_value` | AG | 7 | Quote level |
| `logistics_supplier_hub` | W | 2 | Quote level |
| `logistics_hub_customs` | W | 3 | Quote level |
| `logistics_customs_client` | W | 4 | Quote level |
| `brokerage_hub` | W | 5 | Quote level |
| `brokerage_customs` | W | 6 | Quote level |
| `warehousing_at_customs` | W | 7 | Quote level |
| `customs_documentation` | W | 8 | Quote level |
| `brokerage_extra` | W | 9 | Quote level |

---

## Two-Tier Variable System

### Core Principle

**Quote-level defaults apply to all products unless overridden.**

**Product-level overrides replace the default for specific products.**

### Implementation Pattern

```python
def get_effective_value(product_data, quote_data, field_name, fallback=None):
    """
    Get effective value respecting two-tier precedence.

    Precedence:
    1. Product override (if set and non-empty)
    2. Quote default (if set and non-empty)
    3. System fallback (default value)
    """
    # Check product override
    product_value = product_data.get(field_name)
    if product_value is not None and product_value != "":
        return product_value  # Product wins

    # Check quote default
    quote_value = quote_data.get(field_name)
    if quote_value is not None and quote_value != "":
        return quote_value  # Quote default

    # Use fallback
    return fallback
```

### UI Indicators

**In ag-Grid "Переопределяемые параметры" column group:**

| Background Color | Meaning | Editable |
|---|---|---|
| **White** | Always-editable field (product info) | Yes |
| **Gray (#f5f5f5)** | Empty override (using quote default) | Yes |
| **Blue (#e6f7ff)** | Filled override (overriding quote default) | Yes |
| **Red** | Admin-only field (future) | Admin only |

### Affected Variables (15 total)

**See [Both-Level Variables](#both-level-variables-15) section above**

---

## Validation Rules

### Required Fields (10 total)

#### Quote-Level Required (4 fields):
```python
REQUIRED_QUOTE_FIELDS = [
    "currency_of_quote",      # Must be USD, RUB, or EUR
    "seller_company",         # Must be from organization list
    "offer_sale_type",        # Must be valid enum
    "offer_incoterms"         # Must be valid enum (EXW, FOB, CIF, DDP)
]
```

#### Product-Level Required (6 fields):
```python
REQUIRED_PRODUCT_FIELDS = [
    "sku",                    # Non-empty string
    "brand",                  # Non-empty string
    "base_price_VAT",         # Decimal > 0
    "quantity",               # Integer > 0
    "currency_of_base_price", # Must be valid enum
    "supplier_country"        # Must be valid enum
]
```

### Business Rules

**1. Incoterms Logic:**
```python
# Non-EXW incoterms require at least one logistics cost
if offer_incoterms != "EXW":
    logistics_total = (logistics_supplier_hub +
                      logistics_hub_customs +
                      logistics_customs_client)
    if logistics_total <= 0:
        raise ValidationError(
            f"Incoterms {offer_incoterms} requires at least one "
            "logistics cost > 0"
        )
```

**2. Payment Terms Total:**
```python
# Total advance payments should equal 100%
total_advance = (advance_from_client +
                advance_on_loading +
                advance_on_going_to_country_destination +
                advance_on_customs_clearance)
# Typically equals 100%, but not strictly required
```

**3. Positive Amounts:**
```python
# Prices, quantities, and costs must be positive
for field in ['base_price_VAT', 'quantity', 'markup']:
    if value <= 0:
        raise ValidationError(f"{field} must be > 0")
```

**4. Admin Variables Scope:**
```python
# Admin variables are per-organization, not per-quote
# Cannot override at product level (yet)
# Fetched from calculation_settings table
```

### Type Validation

| Type | Examples | Validation |
|---|---|---|
| **decimal** | prices, rates, percentages | Must be valid decimal, range checks |
| **integer** | quantity, days, customs code | Must be whole number, > 0 |
| **string** | SKU, brand, company | Non-empty, length limits |
| **enum** | currency, country, incoterms | Must match predefined values |

---

## Derived Variables (Auto-Calculated)

**These are NOT user inputs - automatically calculated from user selections:**

### `seller_region`
- **Derived from:** `seller_company`
- **Mapping:**
  - "МАСТЕР БЭРИНГ ООО" → "RU"
  - "ЦМТО1 ООО" → "RU"
  - "РАД РЕСУРС ООО" → "RU"
  - "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ" → "TR"
  - "GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ" → "TR"
  - "UPDOOR Limited" → "CN"

### `vat_seller_country`
- **Derived from:** `supplier_country`
- **Purpose:** VAT rate where we buy from
- **Key Rates:**
  - Турция: 20%
  - Турция (транзитная зона): 0%
  - Россия: 20%
  - Китай: 13%
  - ОАЭ: 5%
  - ЕС (между странами ЕС): 0%

### `rate_vatRu`
- **Derived from:** `seller_region`
- **Purpose:** VAT rate where we sell from
- **Rates:**
  - RU (Russia): 20%
  - TR (Turkey): 0%
  - CN (China): 0%

### `internal_markup`
- **Derived from:** `supplier_country` + `seller_region`
- **Purpose:** Internal markup percentage based on trade route
- **Example rates:**
  - Турция → RU: 10%
  - Турция → TR: 0%
  - Китай → RU: 10%
  - ОАЭ → RU: 11%

---

## Implementation Notes

### Backend Integration (`routes/quotes_calc.py`)

**Variable mapping function:**
```python
def map_variables_to_calculation_input(quote_data, products_data):
    """Map 42 variables to 7 nested Pydantic models"""
    # Returns CalculationInput with proper two-tier logic
```

**Admin settings fetch:**
```python
async def fetch_admin_settings(org_id):
    """Get rate_forex_risk, rate_fin_comm, rate_loan_interest_daily"""
    # Queries calculation_settings table
```

**Validation:**
```python
def validate_calculation_input(data):
    """Validate required fields + business rules"""
    # Returns list of all errors at once
```

### Frontend Integration (`frontend/src/app/quotes/create/page.tsx`)

**Quote form structure:**
- Company Settings card → `seller_company`, `offer_sale_type`, `offer_incoterms`
- Financial card → `currency_of_quote`, `markup`, `dm_fee_type`, `dm_fee_value`
- Logistics card → `delivery_time`, logistics costs, brokerage
- Payment Terms card → All 10 payment variables
- Product Defaults card → All 7 "both-level" defaults
- Products grid → All product variables + overridable fields

**Admin Settings Info Box:**
- Read-only display of `rate_forex_risk`, `rate_fin_comm`, `rate_loan_interest_daily`
- Auto-loaded from calculation_settings
- Edit link to Settings > Calculation Settings

---

**Last Updated:** 2025-10-29
**Version:** 1.0 - Production Ready
**Related Files:**
- `/home/novi/quotation-app-dev/.claude/VARIABLES.md` - Source
- `/home/novi/quotation-app-dev/.claude/CALCULATION_PATTERNS.md` - Patterns
- `/home/novi/quotation-app-dev/backend/routes/quotes_calc.py` - Implementation
