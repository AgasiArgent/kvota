# Variables Classification for Quote Creation UI

**Purpose:** Complete classification of all 39+ variables for proper UI implementation
**Date:** 2025-10-18
**Status:** In Progress

---

## Classification System

### Levels:
- **Product-level**: Each product in the uploaded file can have different values
- **Quote-level**: One value applies to all products in the quote

### Access:
- **User-editable**: Regular users can change per quote
- **Admin-only**: Only admins can set (system-wide defaults)
- **System-derived**: Automatically calculated, not editable

### UI Location:
- **File upload**: Comes from Excel/CSV file
- **Products table**: User edits after file upload in products table
- **Quote form**: User fills in quote creation form (right side)
- **Template**: Can be saved in templates
- **Admin settings**: Separate admin settings page

---

## Variables List

| # | Variable Name | Excel Cell | Level | Access | Russian Name | UI Location | Template? | Notes |
|---|---------------|------------|-------|--------|--------------|-------------|-----------|-------|
| 1 | sku | - | Product | User | Артикул | File upload + Products table | No | Product SKU for analytics, user can edit |
| 2 | brand | - | Product | User | Бренд | File upload + Products table | No | Product brand for analytics, user can edit |
| 3 | base_price_VAT | K16 | Product | User | Цена закупки (включает VAT) | File upload + Products table | No | From file, user can edit per product |
| 4 | quantity | E16 | Product | User | Кол-во | File upload + Products table | No | From file, user can edit per product |
| 5 | weight_in_kg | G16 | Product | User | Вес (кг) | File upload + Products table | No | From file, user can edit per product |
| 6 | currency_of_base_price | J16 | Both | User | Валюта цены закупки | File upload + Products table + Quote form | Yes | Can be per product OR same for all products |
| 7 | supplier_country | L16 | Both | User | Страна закупки | File upload + Products table + Quote form | Yes | Can be per product OR same for all products |
| 8 | supplier_discount | O16 | Both | User | Скидка поставщика (%) | File upload + Products table + Quote form | Yes | Can be per product OR same for all products |
| 9 | currency_of_quote | D8 | Quote | User | Валюта КП | Quote form | Yes | One value for all products in quote |
| 10 | exchange_rate_base_price_to_quote | Q16 | Both | User | Курс к валюте КП | File upload + Products table + Quote form | Yes | Can be per product OR same for all. TODO: Add external API support (ЦБ РФ, Google Finance) |
| 11 | customs_code | W16 | Both | User | Код ТН ВЭД | File upload + Products table + Quote form | No | Typically per product, rarely same for all |
| 12 | import_tariff | X16 | Both | User | Пошлина (%) | File upload + Products table + Quote form | No | Typically per product, rarely same for all |
| 13 | excise_tax | Z16 | Both | User | Акциз | File upload + Products table + Quote form | No | Typically per product, rarely same for all |
| 14 | markup | AC16 | Both | User | Наценка (%) | Products table + Quote form | Yes | Can be per product OR same for all products |
| 15 | rate_forex_risk | AH11 | Quote | Admin | Резерв на потери на курсовой разнице (%) | Admin settings | Yes | Admin-only system-wide default |
| 16 | seller_company | D5 | Quote | User | Компания-продавец | Quote form | Yes | One value for all products in quote |
| 17 | offer_sale_type | D6 | Quote | User | Вид КП | Quote form | Yes | One value for all products in quote |
| 18 | offer_incoterms | D7 | Quote | User | Базис поставки Incoterms | Quote form | Yes | One value for all products in quote |
| 19 | delivery_time | D9 | Both | User | Срок поставки | Products table + Quote form | Yes | Usually quote-level, rarely per product. TODO: Add grouping by delivery batches (week 5, 7, 9) |
| 20 | advance_from_client | J5 | Quote | User | Аванс (%) | Quote form | Yes | One value for all products in quote |
| 21 | advance_to_supplier | D11 | Both | User | Аванс поставщику (%) | Products table + Quote form | Yes | Can be per product OR same for all products |
| 22 | time_to_advance | K5 | Quote | User | Сколько дней от подписания до аванса? | Quote form | Yes | One value for all products in quote |
| 23 | advance_on_loading | J6 | Quote | User | Аванс при заборе груза (%) | Quote form | Yes | One value for all products in quote |
| 24 | time_to_advance_loading | K6 | Quote | User | Сколько дней от забора груза до аванса? | Quote form | Yes | One value for all products in quote |
| 25 | advance_on_going_to_country_destination | J7 | Quote | User | Аванс при отправке в РФ (%) | Quote form | Yes | One value for all products in quote |
| 26 | time_to_advance_going_to_country_destination | K7 | Quote | User | Сколько дней от отправки до аванса? | Quote form | Yes | One value for all products in quote |
| 27 | advance_on_customs_clearance | J8 | Quote | User | Аванс при прохождении таможни (%) | Quote form | Yes | One value for all products in quote |
| 28 | time_to_advance_on_customs_clearance | K8 | Quote | User | Сколько дней от прохождения таможни до аванса? | Quote form | Yes | One value for all products in quote |
| 29 | time_to_advance_on_receiving | K9 | Quote | User | Сколько дней от получения груза до оплаты? | Quote form | Yes | One value for all products in quote |
| 30 | logistics_supplier_hub | W2 | Both | User | Логистика Поставщик-Турция | Quote form | Yes | Usually quote-level, rarely per product |
| 31 | logistics_hub_customs | W3 | Both | User | Логистика Турция-РФ | Quote form | Yes | Usually quote-level, rarely per product |
| 32 | logistics_customs_client | W4 | Both | User | Логистика Таможная - Клиент | Quote form | Yes | Usually quote-level, rarely per product |
| 33 | brokerage_hub | W5 | Both | User | Брокерские Турция | Quote form | Yes | Usually quote-level, rarely per product |
| 34 | brokerage_customs | W6 | Both | User | Брокерские РФ | Quote form | Yes | Usually quote-level, rarely per product |
| 35 | warehousing_at_customs | W7 | Both | User | Расходы на СВХ | Quote form | Yes | Usually quote-level, rarely per product |
| 36 | customs_documentation | W8 | Both | User | Разрешительные документы | Quote form | Yes | Usually quote-level, rarely per product |
| 37 | brokerage_extra | W9 | Both | User | Прочее | Quote form | Yes | Usually quote-level, rarely per product |
| 38 | dm_fee_type | AG3 | Quote | User | Вознаграждение ЛПР (фикс или %) | Quote form | Yes | One value for all products in quote |
| 39 | dm_fee_value | AG7 | Quote | User | Вознаграждение ЛПР (Сумма или %) | Quote form | Yes | One value for all products in quote |
| 40 | util_fee | - | Quote | User | Утилизационный сбор | Quote form | Yes | One value for all products. NOTE: Only for vehicles, should be in Customs/Logistics group |
| 41 | rate_fin_comm | - | Quote | Admin | Комиссия ФинАгента (%) | Admin settings | Yes | Admin-only system-wide default |
| 42 | rate_loan_interest_daily | - | Quote | Admin | Дневная стоимость денег (%) | Admin settings | Yes | Admin-only system-wide default |

---

## UI Implementation Plan

### 1. File Upload Section (Left Column)
**Upload Excel/CSV with these columns:**
- product_name (required)
- product_code (optional)
- base_price_vat (required)
- quantity (required)
- weight_in_kg (optional)
- currency_of_base_price (optional)
- supplier_country (optional)
- customs_code (optional)
- import_tariff (optional)
- excise_tax (optional)

### 2. Products Table (After Upload - Editable)
**Always editable columns:**
- base_price_VAT (#1)
- quantity (#2)
- weight_in_kg (#3)

**Optionally editable columns (can override quote-level):**
- currency_of_base_price (#4)
- supplier_country (#5)
- supplier_discount (#6)
- exchange_rate_base_price_to_quote (#8)
- customs_code (#9)
- import_tariff (#10)
- excise_tax (#11)
- markup (#12)
- delivery_time (#17)
- advance_to_supplier (#19)

### 3. Quote Form - User Section (Right Column)
**Organized in collapsible panels:**

**Company Settings:**
- seller_company (#14)
- offer_sale_type (#15)
- offer_incoterms (#16)

**Financial Parameters:**
- currency_of_quote (#7) - affects all products
- markup (#12) - default for all, can override per product
- dm_fee_type (#36)
- dm_fee_value (#37)

**Logistics:**
- delivery_time (#17) - default for all, can override per product
- logistics_supplier_hub (#28)
- logistics_hub_customs (#29)
- logistics_customs_client (#30)

**Payment Terms:**
- advance_from_client (#18)
- advance_to_supplier (#19) - default for all, can override per product
- time_to_advance (#20)
- advance_on_loading (#21)
- time_to_advance_loading (#22)
- advance_on_going_to_country_destination (#23)
- time_to_advance_going_to_country_destination (#24)
- advance_on_customs_clearance (#25)
- time_to_advance_on_customs_clearance (#26)
- time_to_advance_on_receiving (#27)

**Customs & Clearance:**
- brokerage_hub (#31)
- brokerage_customs (#32)
- warehousing_at_customs (#33)
- customs_documentation (#34)
- brokerage_extra (#35)
- util_fee (#38) - for vehicles only

**Product Defaults (can be overridden per product):**
- currency_of_base_price (#4)
- supplier_country (#5)
- supplier_discount (#6)
- exchange_rate_base_price_to_quote (#8)
- customs_code (#9)
- import_tariff (#10)
- excise_tax (#11)

### 4. Admin Settings (Separate Page - /settings/calculation)
**System-wide defaults (admin-only):**
- rate_forex_risk (#13) - Резерв на потери на курсовой разнице (%)
- rate_fin_comm (#39) - Комиссия ФинАгента (%)
- rate_loan_interest_daily (#40) - Дневная стоимость денег (%)

### 5. Templates (Can Save/Load)
**Can save all quote-level user-editable variables:**
- All variables from sections 3.1-3.6 above (Company Settings through Product Defaults)
- Excludes: product-specific data (#1-3) and admin-only variables (#13, #39, #40)

---

## Summary Statistics

### Variable Distribution:
- **Total Variables:** 42 (includes 2 new: SKU, Brand)
- **Product-level only:** 5 (sku, brand, base_price_VAT, quantity, weight_in_kg)
- **Quote-level only:** 19
- **Both (Product & Quote):** 15
- **User-editable:** 39
- **Admin-only:** 3 (rate_forex_risk, rate_fin_comm, rate_loan_interest_daily)
- **Can be saved in templates:** 37 (excludes product-specific #1-5 and admin-only #15, 41, 42)

### Key Architectural Decisions:

1. **Two-tier variable system:**
   - Quote-level defaults (apply to all products)
   - Product-level overrides (per-product customization)

2. **Admin-only variables:**
   - Stored in separate admin settings table
   - Apply system-wide to all quotes
   - Require admin role to modify

3. **Templates:**
   - Save all quote-level user-editable variables
   - Can be organization-wide or user-specific
   - Used as starting point for new quotes

4. **Products table:**
   - Editable after file upload
   - Can override quote-level defaults for flexible pricing
   - Supports mixed scenarios (some products from Turkey, some from China)

---

## Next Steps

1. **Create Admin Settings Page** (`/settings/calculation`)
   - Form for 3 admin-only variables
   - Role-based access control
   - Save to new `calculation_settings` table

2. **Restructure Quote Creation Page**
   - Split products table into "always editable" and "optional override" columns
   - Reorganize quote form by 6 categories (Company, Financial, Logistics, Payment, Customs, Product Defaults)
   - Add "Apply to all products" buttons for variables that can be both

3. **Update Backend Models**
   - Modify calculation API to handle product-level variable overrides
   - Add admin settings endpoints
   - Update template structure to match new categorization

4. **Update Database Schema**
   - Add `calculation_settings` table for admin variables
   - Modify `quote_calculation_variables` to support per-product overrides
   - Add migration script

---

**Classification Status:** ✅ COMPLETE
**Last Updated:** 2025-10-18
