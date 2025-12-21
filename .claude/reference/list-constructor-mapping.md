# List Constructor - Column Mapping (2025-12-21)

**Purpose:** Map columns from 3 department Excel lists to DB schema for universal quote list feature.

**Source Files:**
- `lists-examples/ЕРПС LITE.xlsx` (ERPS_list tab) - 64 columns - Sales/deal tracking
- `lists-examples/Реестр КА.xlsx` (реестр КА tab) - 70 columns - Cost Analysis
- `lists-examples/Новый реестр КП 2025.xlsx` (Реестр КП tab) - 66 columns - Quote registry

---

## COMPLETED MAPPINGS

### Category 1: IDENTITY & DATES

#### Item 1: Date (Дата) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 1. Дата | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | 1. Отметка времени | ✅ (timestamp of entry) |
| **DB** | `quotes.created_at` | ✅ |

#### Item 2: IDN (Quote Number) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 2. IDN | ✅ |
| Реестр КА | 10. IDN Сделки (уникальный код) | ✅ |
| ЕРПС LITE | 36-37. IDN Заказа, IDN коррект | ✅ |
| **DB** | `quotes.idn_quote` | ✅ |

#### Item 3: Row Number (№ строки) ✅ DERIVE ON FLY
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 3. № строки | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |

**Note:** Just display row number in list - no storage needed.

#### Item 4: Legal Entity / Seller Company (Юр лицо / Орг-продавец) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 4. юр лицо, 13. Орг-продавец | ✅ |
| Реестр КА | 12. Продавец | ✅ |
| ЕРПС LITE | 6. Компания от которой контрактация | ✅ |
| **DB** | `quote_calculation_variables.variables["seller_company"]` (var #16) | ✅ |

#### Item 5: Date After Correction (Дата после корректировки) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 5. Датапослекорректировки | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quotes.updated_at` | ✅ |

#### Item 6: Approval Date (Дата согласования) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 6. Датасогласования | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quotes.financial_reviewed_at` | ✅ |

#### Item 7: Status (Статус) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 7. Статус | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | 31. Статус | ✅ |
| **DB** | `quotes.workflow_state` | ✅ |

**Note:** Approval workflow stage (not quote status).

#### Item 8: Controller (Контроллер) ⚠️ NEEDS STORAGE
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 8. Контроллер | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | Need approval history table | ⚠️ |

**Note:** Person who approved at each stage. Need to store per-stage approvers (different users approve different stages).

#### Item 9: Manager (Менеджер) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 9. менеджер | ✅ |
| Реестр КА | 11. ФИО Менеджера | ✅ |
| ЕРПС LITE | 7. Ответственный менеджер по продажам | ✅ |
| **DB** | `quotes.created_by` → `user_profiles.full_name` | ✅ |

#### Item 10: Team Leader (Руководитель группы) ⏳ DERIVE LATER
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 10. руководитель группы | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | Derive from org structure (future) | ⏳ |

#### Item 11: Customer INN (ИНН Заказчика) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 11. ИННЗаказчика | ✅ |
| Реестр КА | 13. ИНН Покупателя | ✅ |
| ЕРПС LITE | 3. ИНН покупателя | ✅ |
| **DB** | `quotes.customer_id` → `customers.inn` | ✅ |

#### Item 12: Customer Name (Заказчик) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 12. Заказчик | ✅ |
| Реестр КА | 14. Единое Наименование Заказчика | ✅ |
| ЕРПС LITE | 19. Наименование покупателя | ✅ |
| **DB** | `quotes.customer_id` → `customers.name` | ✅ |

#### Item 13: SKIP - Duplicate of Item 4

#### Item 14: Deal Type (Тип сделки) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 14. Выберитетипсделки | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | 10. Тип Сделки | ✅ |
| **DB** | `quote_calculation_variables.variables["offer_sale_type"]` (var #17) | ✅ |

**Values:** поставка, транзит, финтранзит, экспорт

#### Item 15: Brand (Бренд) ✅ EXISTS (per-product only)
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 15. Бренд | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quote_items.brand` | ✅ |

**Note:** Per-product only. For analytics list with per-product rows, not quote-level aggregation.

#### Item 16: Quote Currency (Валюта КП) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 16. ВалютаКП | ✅ |
| Реестр КА | 19. Валюта Спец | ✅ |
| ЕРПС LITE | 11. Валюта спецификации | ✅ |
| **DB** | `quotes.currency` | ✅ |

#### Item 17: Total Sale with VAT (ИтогоСуммаПродажисНДС) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 17. ИтогоСуммаПродажисНДС | ✅ |
| Реестр КА | 20. СуммаСпец | ✅ |
| ЕРПС LITE | 12. Сумма продажи | ✅ |
| **DB** | `quotes.total_with_vat_quote` | ✅ |

#### Item 18: Sale without VAT (СуммапродажибезНДС) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 18. СуммапродажибезНДС | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quote_calculation_summaries.calc_ak16_final_price_total_quote` | ✅ |

**Note:** Aggregated SUM(AK16) in quote currency.

#### Item 19: Net Profit in Quote Currency (Профитчистый) ⏭️ SKIP
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 19. Профитчистый(безНДСифин.расходовиотката) | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | 13. Сумма профита по расчету КП | ✅ |

**Note:** Skip - will use USD equivalent instead (mapped later).

#### Item 20: Delivery Basis (Базиспоставки) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 20. Базиспоставки | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quotes.delivery_terms` | ✅ |

#### Item 21: Delivery Days (срокпоставки) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 21. срокпоставки(дни) | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | 16. Срок поставки по спецификации | ✅ |
| **DB** | `quotes.delivery_days` | ✅ |

#### Item 22: Final Payment Days (срокифинальнойоплаты) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 22. срокифинальнойоплаты(дни) | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quote_calculation_variables.variables["time_to_advance_on_receiving"]` (var #29, K9) | ✅ |

#### Item 23: Payment Terms Description (УсловиерасчетовсЗаказчиком) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 23. УсловиерасчетовсЗаказчиком | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quotes.payment_terms` | ✅ |

**Example:** "30% предоплата, 70% по факту поставки"

#### Item 24: Customer Advance (АвансотЗаказчика) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 24. АвансотЗаказчикаприподписанииспецификации | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | 14. Размер аванса от клиента в "%" | ✅ |
| **DB (%)** | `quote_calculation_variables.variables["client_advance_percent"]` | ✅ |
| **DB (abs)** | `quote_calculation_summaries.calc_bh3_client_advance` | ✅ |

**Note:** Absolute = total_with_vat × client_advance_percent

#### Item 25: Supplier Advance (РазмеравансаПоставщику) ⚠️ NEEDS STORAGE
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 25. РазмеравансаПоставщику | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB (%)** | `quote_calculation_variables.variables["supplier_advance_percent"]` | ✅ |
| **DB (abs)** | ⚠️ NEEDS: `calc_supplier_advance_total` | ⚠️ |

**Note:** BH6 is supplier advance + financial commission. Need separate storage for pure supplier advance = SUM(S16 × supplier_advance_percent)

#### Item 26: SKIP - Duplicate of Item 15 (Brand)

#### Item 27: Total Quantity (Кол-во) ✅ NEEDS STORAGE
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 27. Кол-во | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quotes.total_quantity` | ⚠️ NEW |

#### Item 28: Total Weight (Общийвес) ✅ NEEDS STORAGE
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 28. Общийвес | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quotes.total_weight_kg` | ⚠️ NEW |

#### Item 29: Total Purchase without VAT (СуммазакупкиввалютеКПбезНДС) ✅ EXISTS
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 29. СуммазакупкиввалютеКПбезНДС | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | `quote_calculation_summaries.calc_s13_sum_purchase_prices` | ✅ |

#### Item 30: Total Purchase with VAT (СуммазакупкиввалютеКПсучетомНДС) ⚠️ NEEDS STORAGE
| List | Column | Present? |
|------|--------|----------|
| Реестр КП | 30. СуммазакупкиввалютеКПсучетомНДС | ✅ |
| Реестр КА | - | ❌ |
| ЕРПС LITE | - | ❌ |
| **DB** | ⚠️ NEEDS: `calc_purchase_with_vat_usd_total` | ⚠️ |

**Note:** Aggregate after exchange to USD but BEFORE clearing VAT. If no VAT clearing needed, equals calc_s13_sum_purchase_prices.

#### Items 31-35: See Category 7 (Items 36-40)
- 31. ИтогоСтоимостьфинансирования → Item 36
- 32. Комиссиязарассрочку → Item 37
- 33. ЛогистикаЕС+ТР → Item 38
- 34. ЛогистикаРФ → Item 39
- 35. ИтогоЛогистика → Item 40

---

### Category 7: COSTS

#### Item 36: Financing Cost (BJ11) ✅ EXISTS
| List | Column |
|------|--------|
| Реестр КП | 31. ИтогоСтоимостьфинансирования |
| Реестр КА | 23. Финансирование (стоимость денег) |
| DB | `quote_calculation_summaries.calc_bj11_total_financing_cost` |

#### Item 37: Installment Commission (BL5) ✅ EXISTS
| List | Column |
|------|--------|
| Реестр КП | 32. Комиссиязарассрочку |
| Реестр КА | 28. Комиссия за рассрочку |
| DB | `quote_calculation_summaries.calc_bl5_credit_sales_interest` |

#### Item 38: Logistics EU+TR ✅ DERIVE ON FLY
| List | Column |
|------|--------|
| Реестр КП | 33. ЛогистикаЕС+ТР |
| Реестр КА | 27. Стоимость логистики расчет |
| Formula | `logistics_supplier_hub (#30) + logistics_hub_customs (#31)` |

#### Item 39: Logistics RF ✅ EXISTS
| List | Column |
|------|--------|
| Реестр КП | 34. ЛогистикаРФ |
| DB | `logistics_customs_client` (var #32) |

#### Item 40: Total Logistics ✅ DERIVE ON FLY
| List | Column |
|------|--------|
| Реестр КП | 35. ИтогоЛогистика |
| Реестр КА | 30. Стоимость логистики измененная |
| Formula | `#30 + #31 + #32 + #33 + #34 + #35 + #36 + #37` |

*(Includes logistics + all brokerage/customs costs)*

#### Item 41: Total Customs ✅ DERIVE ON FLY
| List | Column |
|------|--------|
| Реестр КА | 24. Косвенные (OPEX) - NOT SAME, leave unmapped |
| Formula | `#33 + #34 + #35 + #36 + #37` (brokerage fields only) |

---

### Category 8: AGGREGATED VALUES (Need New DB Storage)

#### Item 42: Forex Risk Reserve ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 41. Резервнаотриц.курсовуюразницу |
| Реестр КА | 29. Резерв на курсовую разницу |
| Current DB | `calc_ah16_forex_risk_reserve` (per product only) |
| **Needed** | `calc_ah13_forex_risk_reserve_total` = SUM(AH16) |

#### Item 43: Financial Agent Commission ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 42. Комиссияфин/агента |
| Current DB | `calc_ai16_agent_fee` (per product only) |
| **Needed** | `calc_ai13_financial_agent_fee_total` = SUM(AI16) |

#### Item 44: Internal Margin ⚠️ NEEDS STORAGE (CORRECTED)
| List | Column |
|------|--------|
| Реестр КП | 47. Внутренняянаценка |
| **Per product** | `internal_margin_per_product` = AY16 - S16 |
| **Quote total** | `calc_internal_margin_total` = SUM(AY16 - S16) |

**NOTE:** NOT sum of AF16. Internal margin = internal sale price - purchase price.

#### Item 45: Total COGS ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 38. ИтогоСебестоимостьтовара(безНДС) |
| Current DB | `calc_ab16_cogs_total` (per product only) |
| **Needed** | `calc_ab13_cogs_total` = SUM(AB16) |

#### Item 46: Gross Profit USD ✅ EXISTS
| List | Column |
|------|--------|
| Реестр КП | СуммаПрофитавUSDэкв. |
| Реестр КА | Гросс профит без рисков USD (КА) |
| ЕРПС LITE | 44. Гросс Профит (Маржа), USD экв. |
| DB | `quotes.total_profit_usd` |

#### Item 47: Import Tariff Amount ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 36. Пошлина |
| Current DB | `calc_y16_customs_duty` (per product only) |
| **Needed** | `calc_y13_customs_duty_total` = SUM(Y16) |

#### Item 48: Excise Tax Amount ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 37. Акциз |
| Current DB | `calc_z16_excise_tax` (per product only) |
| **Needed** | `calc_z13_excise_tax_total` = SUM(Z16) |

---

### Category 9: VAT

#### Item 49: Sales VAT ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 43. НДСспродаж |
| Calc Engine | AN16 per product |
| **Needed** | `calc_an13_sales_vat_total` = SUM(AN16) |

#### Item 50: Import VAT (Deductible) ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 44. НДС(приимпортевРФ) |
| Calc Engine | AO16 per product |
| **Needed** | `calc_ao13_import_vat_total` = SUM(AO16) |

#### Item 51: Net VAT Payable ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 45. НДСкуплатезавычетомимпортногоНДС |
| Calc Engine | AP16 per product |
| **Needed** | `calc_ap13_net_vat_payable_total` = SUM(AP16) |

---

### Category 10: COMMISSIONS & FEES

#### Item 52: Transit Commission ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 46. КомиссиязаТранзит |
| Calc Engine | AQ16 per product |
| **Needed** | `calc_aq13_transit_commission_total` = SUM(AQ16) |

#### Item 53: DM Fee Amount ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КП | 40. ВознаграждениеЛПР(откат) |
| Calc Engine | AG16 per product |
| **Needed** | `calc_ag13_dm_fee_total` = SUM(AG16) |

---

### Category 11: INCOME TAX (NEW FEATURE)

#### Item 54: Income Tax TR+RF ⚠️ NEW FEATURE

| List | Column |
|------|--------|
| Реестр КА | 36. Налог на прибыль (ТР+РФ) |

**Business Logic (CORRECTED):**
- Internal margin per product = `AY16 - S16` (subject to Turkey tax)
- Remaining profit per product = `profit_per_product - internal_margin` (subject to Russia tax)
- No distribution bases needed - split is automatic

**New Admin Variables (in `calculation_settings`):**

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `tax_rate_turkey` | decimal | 0.25 | Income tax rate in Turkey |
| `tax_rate_russia` | decimal | 0.25 | Income tax rate in Russia |

**New Storage Fields:**

| Field | Level | Formula |
|-------|-------|---------|
| `internal_margin_per_product` | Product | `AY16 - S16` |
| `calc_tax_turkey_per_product` | Product | `internal_margin_per_product × tax_rate_turkey` |
| `calc_tax_russia_per_product` | Product | `(profit_per_product - internal_margin_per_product) × tax_rate_russia` |
| `calc_tax_turkey_total` | Quote | SUM of per-product |
| `calc_tax_russia_total` | Quote | SUM of per-product |

**Derived (on the fly):**
- `Total Tax (TR+RF)` = `calc_tax_turkey_total + calc_tax_russia_total`

---

## Category 12: STATUS & FLAGS

#### Items 55-57: Date-based Flags ✅ DERIVE ON FLY
| List | Columns |
|------|---------|
| Реестр КП | 49. №недели, 50. Флагтекущаянеделя, 56-58. Month/Today flags |
| Formula | Extract from `created_at`, `updated_at` using SQL date functions |

#### Item 58: Product Category ⚠️ NEW FIELD
| List | Column |
|------|--------|
| Реестр КП | 51. Категория |
| ЕРПС LITE | 17. Категория товара |
| **DB (needed)** | `quote_items.product_category` TEXT |

**Type:** Manually entered by purchasing manager per product, or auto-assigned by script.

#### Items 59-62: Office & Revenue Flags ✅ DERIVE ON FLY / FILTERS
| List | Columns | Notes |
|------|---------|-------|
| Реестр КП | 60. Офис | User info - use filters, no storage |
| Реестр КП | 61. Размервыручки, 63-66. Various flags | Derive from `total_with_vat`, thresholds |

---

## ⚠️ INCOMPLETE: Categories 1-6 Details

**Status:** Only summary info available from before autocompact.

**New fields identified (need detailed mapping):**
- `idn_spec` - Generated: idn_quote-count
- `proforma_number` - Manual entry by purchasing manager
- `proforma_date` - Manual entry
- `document_folder_link` - Link to Google Drive folder
- `spec_sign_date` - When spec was signed
- `purchasing_company` - Company for supplier purchases
- `production_time_days` - Per product, from supplier
- `payment_terms_description` - Text derived from advance settings

**New tables identified:**
- `quote_purchasing_managers` - One-to-many relation
- `suppliers` - Like customers table

**TODO:** Do quick pass over items 1-35 to capture detailed column mappings.

---

## SUMMARY: DB CHANGES NEEDED

### 1. New Aggregated Fields in `quote_calculation_summaries` (11 fields)

```sql
-- Aggregated calculation outputs
calc_ah13_forex_risk_reserve_total DECIMAL(15,2),    -- SUM(AH16)
calc_ai13_financial_agent_fee_total DECIMAL(15,2),   -- SUM(AI16)
calc_ab13_cogs_total DECIMAL(15,2),                  -- SUM(AB16)
calc_y13_customs_duty_total DECIMAL(15,2),           -- SUM(Y16)
calc_z13_excise_tax_total DECIMAL(15,2),             -- SUM(Z16)
calc_an13_sales_vat_total DECIMAL(15,2),             -- SUM(AN16)
calc_ao13_import_vat_total DECIMAL(15,2),            -- SUM(AO16)
calc_ap13_net_vat_payable_total DECIMAL(15,2),       -- SUM(AP16)
calc_aq13_transit_commission_total DECIMAL(15,2),    -- SUM(AQ16)
calc_ag13_dm_fee_total DECIMAL(15,2),                -- SUM(AG16)
calc_internal_margin_total DECIMAL(15,2),            -- SUM(AY16 - S16)
```

### 2. New Admin Variables in `calculation_settings` (2 fields)

```sql
tax_rate_turkey DECIMAL(5,4) DEFAULT 0.25,
tax_rate_russia DECIMAL(5,4) DEFAULT 0.25,
```

### 3. New Per-Product Fields in `quote_items` or calculation results (3 fields)

```sql
internal_margin DECIMAL(15,2),           -- AY16 - S16
calc_tax_turkey DECIMAL(15,2),           -- internal_margin × tax_rate_turkey
calc_tax_russia DECIMAL(15,2),           -- (profit - internal_margin) × tax_rate_russia
```

### 4. New Quote-Level Tax Fields in `quote_calculation_summaries` (2 fields)

```sql
calc_tax_turkey_total DECIMAL(15,2),     -- SUM of per-product
calc_tax_russia_total DECIMAL(15,2),     -- SUM of per-product
```

### 5. New Tables

```sql
-- Purchasing companies (like seller_companies)
CREATE TABLE purchasing_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers (like customers table)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    country TEXT,
    -- ... other fields similar to customers
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval history (for Controller tracking)
CREATE TABLE quote_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id),
    approver_user_id UUID REFERENCES auth.users(id),
    workflow_state TEXT NOT NULL,
    approved_at TIMESTAMPTZ DEFAULT NOW(),
    comment TEXT
);
```

### 6. New Quote-Level Fields

```sql
-- In quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS
    document_folder_link TEXT,           -- Link to Google Drive folder
    executor_user_id UUID,               -- Deprecated: for historical data
    spec_sign_date DATE,                 -- When workflow_state = 'specification_signed'
    total_quantity INTEGER,              -- SUM of quote_items.quantity
    total_weight_kg DECIMAL(15,3);       -- SUM of weight_in_kg * quantity
```

### 7. New Product-Level Fields

```sql
-- In quote_items table
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS
    production_time_days INTEGER,        -- Entered by purchasing manager
    product_category TEXT,               -- Category for analytics
    proforma_number TEXT,                -- Invoice number from supplier
    proforma_date DATE,                  -- Invoice date
    proforma_currency TEXT,              -- Invoice currency
    proforma_amount_excl_vat DECIMAL(15,2),  -- Amount without VAT
    proforma_amount_incl_vat DECIMAL(15,2),  -- Amount with VAT
    proforma_amount_excl_vat_usd DECIMAL(15,2),  -- Converted to USD
    proforma_amount_incl_vat_usd DECIMAL(15,2),  -- Converted to USD
    purchasing_company_id UUID,          -- FK to purchasing_companies
    supplier_id UUID,                    -- FK to suppliers
    purchasing_manager_id UUID;          -- User who filled pricing for this product
```

### 8. New Aggregated Fields in quote_calculation_summaries

```sql
-- Additional aggregations needed
calc_supplier_advance_total DECIMAL(15,2),     -- SUM(S16 × supplier_advance_percent)
calc_purchase_with_vat_usd_total DECIMAL(15,2) -- Before VAT clearing, in USD
```

---

## FIELDS TO DERIVE ON THE FLY (No DB Storage)

- Logistics EU+TR = #30 + #31
- Total Logistics = #30 + #31 + #32 + #33 + #34 + #35 + #36 + #37
- Total Customs = #33 + #34 + #35 + #36 + #37
- Total Tax TR+RF = calc_tax_turkey_total + calc_tax_russia_total
- Spec number = idn_quote-count
- Customer legal form = customers.company_type
- Exchange rates display = "TRY/USD=10; EUR/USD=1.15"
- Last update by sales manager (from activity_logs)
- Team leader (from org structure - future)
- Purchasing managers list = aggregate all unique purchasing_manager_id from quote_items

## HANDLED BY FILTERS (No Columns Needed)

- Row number, week/month numbers, date flags (current week, today, verified today)
- Revenue size category, quote amount thresholds (>50k USD, etc.)

---

## NEXT STEPS

1. ✅ Complete column mapping from all 3 Excel lists
2. Create migration for new DB tables and fields
3. Update calculation engine to populate aggregated fields
4. Create dev-docs for list-constructor feature
5. Implement backend API for list queries with preset support
6. Implement frontend ag-Grid component with department presets

---

---

## ADDITIONAL UNMAPPED COLUMNS

### From ЕРПС LITE

#### Document Folder Link ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| ЕРПС LITE | 2. Ссылка на папку с документами по сделке |
| **DB** | ⚠️ NEEDS: `quotes.document_folder_link` TEXT |

**Note:** For past documents. Later will create file storage within Kvota.

#### Purchasing Company ⚠️ NEEDS NEW TABLE
| List | Column |
|------|--------|
| ЕРПС LITE | 5. Компания, с которой проводится закупка |
| Реестр КА | 39. Компания закупки |
| **DB** | ⚠️ NEEDS: `purchasing_companies` table (like seller_companies) |

**Note:** Purchasing manager assigns company per product. Workflow: sales manager uploads products → purchasing manager fills prices, supplier, purchasing company.

#### Supplier Company ⚠️ NEEDS NEW TABLE
| List | Column |
|------|--------|
| Реестр КА | 40. Поставщик по проформе |
| **DB** | ⚠️ NEEDS: `suppliers` table (like customers) |

#### Executor (deprecated) ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| ЕРПС LITE | 8. Исполнитель (если отличается от ОМпП) |
| **DB** | ⚠️ NEEDS: `quotes.executor_user_id` UUID (for past data) |

**Note:** Deprecated field, storage needed for historical data only.

#### Purchasing Manager ✅ NEEDS STORAGE (per-product)
| List | Column |
|------|--------|
| ЕРПС LITE | 9. Ответственный менеджер по закупкам |
| **DB** | `quote_items.purchasing_manager_id` UUID |

**Note:** Stored per product. List aggregates all unique managers involved in quote.

#### Spec Number ✅ DERIVE ON FLY
| List | Column |
|------|--------|
| ЕРПС LITE | 15. № Спецификации |
| Реестр КА | 15. Номер Спецификации |
| **DB** | Derive: `idn_quote-count` (see specification export function) |

#### Customer Legal Form ✅ DERIVE
| List | Column |
|------|--------|
| ЕРПС LITE | 18. Правовая форма покупателя |
| **DB** | Derive from `customers.company_type` |

#### Spec Sign Date ⏳ FUTURE WORKFLOW
| List | Column |
|------|--------|
| ЕРПС LITE | 20. Дата подписания Спецификации |
| **DB** | Date when `workflow_state = 'specification_signed'` (future state) |

#### Production Time Days ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| ЕРПС LITE | 23. срок производства товара у поставщика |
| **DB** | ⚠️ NEEDS: `quote_items.production_time_days` INTEGER |

**Note:** Manually entered per product by purchasing manager. List shows MAX value across products.

---

### From Реестр КА

#### Framework Contract Number ⏳ FUTURE WORKFLOW
| List | Column |
|------|--------|
| Реестр КА | 17. Рамочный договор |
| **DB** | Contract number from client, known at specification stage (future) |

#### Invoice Number ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КА | 41. Номер проформы |
| **DB** | ⚠️ NEEDS: `quote_items.proforma_number` TEXT |

**Note:** Entered by purchasing manager per product (or group). List displays all values for quote.

#### Invoice Date ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КА | 42. Дата проформы |
| **DB** | ⚠️ NEEDS: `quote_items.proforma_date` DATE |

#### Invoice Currency ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КА | 43. Валюта Проформы |
| **DB** | ⚠️ NEEDS: `quote_items.proforma_currency` TEXT |

#### Invoice Amounts ⚠️ NEEDS STORAGE
| List | Column |
|------|--------|
| Реестр КА | 44. Сумма закупки без НДС |
| **DB** | ⚠️ NEEDS per product: |
| | - `proforma_amount_excl_vat` (quote currency) |
| | - `proforma_amount_incl_vat` (quote currency) |
| | - `proforma_amount_excl_vat_usd` (USD) |
| | - `proforma_amount_incl_vat_usd` (USD) |

---

### From Реестр КП

#### Total Quote Price with VAT in USD ✅ EXISTS
| List | Column |
|------|--------|
| Реестр КП | 52. СуммаКПвUSDэкв. |
| **DB** | `quotes.total_with_vat_usd` | ✅ |

#### Exchange Rates Used ✅ DERIVE ON FLY
| List | Column |
|------|--------|
| Реестр КП | 54. курсвалют |
| **DB** | Derive from quote_versions exchange rate snapshot |

**Format:** "TRY/USD=10; EUR/USD=1.15" (show all rates used in quote)

#### Last Update by Sales Manager ✅ DERIVE
| List | Column |
|------|--------|
| Реестр КП | 55. КрайняядатаобновленияКПМенеджером |
| **DB** | Derive from `activity_logs` (entity_type='quote', user role check) |

**Note:** Query activity_logs for last action by user with sales manager role on this quote.

---

**Last Updated:** 2025-12-21
**Status:** Mapping complete. Ready for new tables/fields planning.
