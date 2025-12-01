# Excel Cell Reference - Complete Mapping

**Purpose:** Map every Excel cell to Python calculation engine
**Source:** test_raschet.xlsm (reference spreadsheet)
**Format:** Cell | Russian Name | Description | Python Mapping | Status

---

## 1. Product Input Cells (Row 16+)

These cells contain user-provided product data.

| Cell | Russian Name | Description | Python Field | Status |
|------|-------------|-------------|--------------|--------|
| A16 | № | Row number | - | N/A |
| B16 | Бренд | Brand name | `product.brand` | ✅ |
| C16 | Артикул | SKU/Part number | `product.sku` | ✅ |
| D16 | Название товара | Product name | `product.name` | ✅ |
| E16 | Количество | Quantity | `product.quantity` | ✅ |
| F16 | Ед. изм. | Unit of measure | - | Not used |
| G16 | Вес, кг | Weight in kg | `product.weight_in_kg` | ✅ |
| H16 | - | (empty) | - | N/A |
| I16 | - | (empty) | - | N/A |
| J16 | Валюта закупки | Currency of purchase price | `product.currency_of_base_price` | ✅ |
| K16 | Цена закупки (с VAT) | Purchase price with VAT | `product.base_price_VAT` | ✅ |
| L16 | Страна закупки | Supplier country | `logistics.supplier_country` | ✅ |
| M16 | VAT страны продавца | VAT rate of supplier country | DERIVED from L16 | ✅ |
| N16 | Цена закупки (без VAT) | Purchase price without VAT | OUTPUT Phase 1 | ✅ |
| O16 | Скидка поставщика (%) | Supplier discount % | `financial.supplier_discount` | ✅ |
| P16 | Цена после скидки | Price after discount | OUTPUT Phase 1 | ✅ |
| Q16 | Курс к валюте КП | Exchange rate to quote currency | `financial.exchange_rate_base_price_to_quote` | ✅ |
| R16 | Цена за ед. в валюте КП | Unit price in quote currency | OUTPUT Phase 1 | ✅ |
| S16 | Стоимость закупки | Total purchase price | OUTPUT Phase 1 | ✅ |

---

## 2. Quote-Level Input Cells (Header Area)

These cells contain quote-wide settings.

| Cell | Russian Name | Description | Python Field | Status |
|------|-------------|-------------|--------------|--------|
| D5 | Компания-продавец | Seller company | `company.seller_company` | ✅ |
| D6 | Вид КП | Offer sale type | `company.offer_sale_type` | ✅ |
| D7 | Базис поставки | Incoterms | `logistics.offer_incoterms` | ✅ |
| D8 | Валюта КП | Quote currency | `financial.currency_of_quote` | ✅ |
| D9 | Срок поставки (дней) | Delivery time in days | `logistics.delivery_time` | ✅ |
| D11 | Аванс поставщику (%) | Advance to supplier % | `payment.advance_to_supplier` | ✅ |
| J5 | Аванс от клиента (%) | Advance from client % | `payment.advance_from_client` | ✅ |
| K5 | Дней до аванса | Days to advance payment | `payment.time_to_advance` | ✅ |
| J6 | Аванс при заборе груза (%) | Advance on loading % | `payment.advance_on_loading` | ✅ |
| K6 | Дней до аванса при заборе | Days to loading advance | `payment.time_to_advance_loading` | ✅ |
| J7 | Аванс при отправке в РФ (%) | Advance on shipping % | `payment.advance_on_going_to_country_destination` | ✅ |
| K7 | Дней до аванса при отправке | Days to shipping advance | `payment.time_to_advance_going_to_country_destination` | ✅ |
| J8 | Аванс при таможне (%) | Advance on customs % | `payment.advance_on_customs_clearance` | ✅ |
| K8 | Дней до аванса при таможне | Days to customs advance | `payment.time_to_advance_on_customs_clearance` | ✅ |
| K9 | Дней до оплаты после получения | Days to payment after receiving | `payment.time_to_advance_on_receiving` | ✅ |

---

## 3. Logistics & Customs Input Cells

| Cell | Russian Name | Description | Python Field | Status |
|------|-------------|-------------|--------------|--------|
| W2 | Логистика: Поставщик-Хаб | Logistics: Supplier to hub | `logistics.logistics_supplier_hub` | ✅ |
| W3 | Логистика: Хаб-Таможня РФ | Logistics: Hub to RF customs | `logistics.logistics_hub_customs` | ✅ |
| W4 | Логистика: Таможня-Клиент | Logistics: Customs to client | `logistics.logistics_customs_client` | ✅ |
| W5 | Брокерские услуги: Хаб | Brokerage at hub | `customs.brokerage_hub` | ✅ |
| W6 | Брокерские услуги: Таможня РФ | Brokerage at RF customs | `customs.brokerage_customs` | ✅ |
| W7 | Расходы на СВХ | Warehousing at customs | `customs.warehousing_at_customs` | ✅ |
| W8 | Разрешительные документы | Customs documentation | `customs.customs_documentation` | ✅ |
| W9 | Прочее | Other/extra costs | `customs.brokerage_extra` | ✅ |

---

## 4. Taxes & Duties Input Cells (Row 16+)

| Cell | Russian Name | Description | Python Field | Status |
|------|-------------|-------------|--------------|--------|
| W16 | Код ТН ВЭД | HS/Customs code | `product.customs_code` | ✅ |
| X16 | Пошлина (%) | Import tariff % | `taxes.import_tariff` | ✅ |
| Z16 | Акциз | Excise tax amount | `taxes.excise_tax` | ✅ |

---

## 5. Financial Settings Cells

| Cell | Russian Name | Description | Python Field | Status |
|------|-------------|-------------|--------------|--------|
| AC16 | Наценка (%) | Markup % | `financial.markup` | ✅ |
| AG3 | Тип вознаграждения ЛПР | DM fee type (fixed/%) | `financial.dm_fee_type` | ✅ |
| AG7 | Вознаграждение ЛПР | DM fee value | `financial.dm_fee_value` | ✅ |
| AH11 | Резерв на курсовую разницу (%) | Forex risk reserve % | `system.rate_forex_risk` | ✅ Admin |
| - | Комиссия ФинАгента (%) | Financial agent commission % | `system.rate_fin_comm` | ✅ Admin |
| - | Дневная ставка займа (%) | Daily loan interest rate | `system.rate_loan_interest_daily` | ✅ Admin |
| - | Срок оплаты таможни (дней) | Customs/logistics payment due | `system.customs_logistics_pmt_due` | ✅ Admin |

---

## 6. Derived/Lookup Cells

These are automatically calculated from inputs.

| Cell | Russian Name | Description | Derived From | Python | Status |
|------|-------------|-------------|--------------|--------|--------|
| M16 | VAT страны продавца | Supplier country VAT rate | L16 (supplier_country) | `get_vat_seller_country()` | ✅ |
| AW16 | Внутренняя наценка (%) | Internal markup % | L16 + D5 (country + seller) | `get_internal_markup()` | ✅ |
| - | Регион продавца | Seller region | D5 (seller_company) | `get_seller_region()` | ✅ |
| - | НДС РФ (%) | Russian VAT rate | seller_region | `get_rate_vat_ru()` | ✅ |

---

## 7. Calculated Output Cells - Phase 1 (Purchase Price)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| N16 | Цена без VAT | Purchase price without VAT | `purchase_price_no_vat` | ✅ |
| P16 | После скидки | Price after discount | `purchase_price_after_discount` | ✅ |
| R16 | Цена за ед. в валюте КП | Unit price in quote currency | `purchase_price_per_unit_quote_currency` | ✅ |
| S16 | Стоимость закупки | Total purchase price | `purchase_price_total_quote_currency` | ✅ |

---

## 8. Calculated Output Cells - Phase 2 (Distribution)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| S13 | Итого стоимость закупки | Total purchase price (all products) | `total_purchase_price` | ✅ |
| BD16 | База распределения | Distribution base (product share) | `distribution_base` | ✅ |

---

## 9. Calculated Output Cells - Phase 2.5 (Internal Pricing)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| AX16 | Внутренняя цена за ед. | Internal sale price per unit | `internal_sale_price_per_unit` | ✅ |
| AY16 | Внутренняя стоимость | Internal sale price total | `internal_sale_price_total` | ✅ |

---

## 10. Calculated Output Cells - Phase 3 (Logistics)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| T16 | Логистика первый этап | First leg logistics | `logistics_first_leg` | ✅ |
| U16 | Логистика второй этап | Last leg logistics | `logistics_last_leg` | ✅ |
| V16 | Логистика итого | Total logistics | `logistics_total` | ✅ |
| T13 | Логистика первый этап (итого) | First leg total (all products) | Quote-level | ✅ |
| U13 | Логистика второй этап (итого) | Last leg total (all products) | Quote-level | ✅ |
| V11 | Страховка | Insurance total | Calculated from AY13 | ✅ |

---

## 11. Calculated Output Cells - Phase 4 (Duties)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| Y16 | Пошлина (сумма) | Customs duty amount | `customs_fee` | ✅ |
| Z16 | Акциз (сумма) | Excise tax amount | `excise_tax_amount` | ✅ |
| AZ16 | Закупка с VAT поставщика | Purchase with supplier VAT | Not directly exposed | ⚠️ Check |

---

## 12. Calculated Output Cells - Phase 5 (Supplier Payment)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| BH6 | Платеж поставщику | Supplier payment needed | `quote_level_supplier_payment` | ✅ |
| BH4 | Итого до экспедирования | Total before forwarding | `quote_level_total_before_forwarding` | ✅ |

---

## 13. Calculated Output Cells - Phase 6 (Revenue)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| BH2 | Оценочная выручка | Evaluated revenue | `quote_level_evaluated_revenue` | ✅ |
| BJ2 | Прямые затраты | Direct COGS | Not exposed | ⚠️ Check |
| BJ3 | Косвенные затраты | Indirect COGS | Not exposed | ⚠️ Check |
| AC12 | Средняя наценка | Average markup | `average_markup` | ✅ |

---

## 14. Calculated Output Cells - Phase 7 (Financing)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| BH3 | Аванс клиента | Client advance payment | `quote_level_client_advance` | ✅ |
| BH7 | Потребность в фин-ии поставщика | Supplier financing need | `quote_level_supplier_financing_need` | ✅ |
| BH9 | Остаток после аванса | Remaining after advance | Not exposed | ⚠️ Check |
| BH8 | Сумма после оплаты поставщику | Amount after supplier payment | Not exposed | ⚠️ Check |
| BH10 | Потребность в фин-ии операционная | Operational financing need | `quote_level_operational_financing_need` | ✅ |
| BI7 | FV финансирования поставщика | FV of supplier financing | `quote_level_supplier_financing_fv` | ✅ |
| BI10 | FV операционного финансирования | FV of operational financing | `quote_level_operational_financing_fv` | ✅ |
| BJ7 | Стоимость фин-ия поставщика | Supplier financing cost | `quote_level_supplier_financing_cost` | ✅ |
| BJ10 | Стоимость операционного фин-ия | Operational financing cost | `quote_level_operational_financing_cost` | ✅ |
| BJ11 | Итого стоимость финансирования | Total financing cost | `quote_level_total_financing_cost` | ✅ |

---

## 15. Calculated Output Cells - Phase 8 (Credit Sales)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| BL3 | Сумма к оплате клиентом | Amount client owes | `quote_level_credit_sales_amount` | ✅ |
| BL4 | FV с процентами | FV with interest | `quote_level_credit_sales_fv` | ✅ |
| BL5 | Проценты по отсрочке | Credit sales interest | `quote_level_credit_sales_interest` | ✅ |

---

## 16. Calculated Output Cells - Phase 9 (Distribute Financing)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| BA16 | Начальное финансирование | Initial financing per product | `financing_cost_initial` | ✅ |
| BB16 | Проценты по отсрочке | Credit interest per product | `financing_cost_credit` | ✅ |

---

## 17. Calculated Output Cells - Phase 10 (COGS)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| AA16 | Себестоимость за ед. | COGS per unit | `cogs_per_unit` | ✅ |
| AB16 | Себестоимость товара | COGS per product | `cogs_per_product` | ✅ |
| AB13 | Себестоимость итого | Total COGS (all products) | `total_cogs` | ✅ |

---

## 18. Calculated Output Cells - Phase 11 (Sales Price)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| AD16 | Цена продажи за ед. (без фин.) | Sale price per unit (excl financial) | `sale_price_per_unit_excl_financial` | ✅ |
| AE16 | Цена продажи итого (без фин.) | Sale price total (excl financial) | `sale_price_total_excl_financial` | ✅ |
| AF16 | Прибыль | Profit | `profit` | ✅ |
| AG16 | Вознаграждение ЛПР | DM fee | `dm_fee` | ✅ |
| AH16 | Резерв на курсовую разницу | Forex risk reserve | `forex_reserve` | ✅ |
| AI16 | Комиссия ФинАгента | Financial agent fee | `financial_agent_fee` | ✅ |
| AJ16 | Цена продажи за ед. (без НДС) | Sales price per unit (no VAT) | `sales_price_per_unit_no_vat` | ✅ |
| AK16 | Цена продажи итого (без НДС) | Sales price total (no VAT) | `sales_price_total_no_vat` | ✅ |

---

## 19. Calculated Output Cells - Phase 12 (VAT)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| AL16 | Цена продажи итого (с НДС) | Sales price total (with VAT) | `sales_price_total_with_vat` | ✅ |
| AM16 | Цена продажи за ед. (с НДС) | Sales price per unit (with VAT) | `sales_price_per_unit_with_vat` | ✅ |
| AN16 | НДС с продажи | VAT from sales | `vat_from_sales` | ✅ |
| AO16 | НДС к вычету | VAT on import (deductible) | `vat_on_import` | ✅ |
| AP16 | НДС к уплате | Net VAT payable | `vat_net_payable` | ✅ |

---

## 20. Calculated Output Cells - Phase 13 (Transit)

| Cell | Russian Name | Description | Python Attribute | Status |
|------|-------------|-------------|------------------|--------|
| AQ16 | Транзитная комиссия | Transit commission | `transit_commission` | ✅ |

---

## Summary: Gaps Identified

### Intermediate Values (Calculated but Internal)

These are calculated in `calculation_engine.py` but used only for intermediate computations - NOT exposed in final `ProductCalculationResult`:

| Cell | Russian Name | Where Calculated | Line | Status |
|------|-------------|------------------|------|--------|
| AZ16 | Закупка с VAT поставщика | Phase 4 | `calculation_engine.py:354` | ✅ Calculated |
| BH8 | Сумма после оплаты поставщику | Phase 7 | `calculation_engine.py:497` | ✅ Calculated |
| BH9 | Остаток после аванса | Phase 7 | `calculation_engine.py:494` | ✅ Calculated |
| BJ2 | Прямые затраты | Phase 6 | `calculation_engine.py:426` | ✅ Calculated |
| BJ3 | Косвенные затраты | Phase 6 | `calculation_engine.py:429-434` | ✅ Calculated |

**Key formulas:**
- `AZ16 = S16 × (1 + M16)` — Purchase with supplier VAT
- `BH8 = BH4 - BH6` — Amount payable after supplier payment
- `BH9 = 1 - J5%` — Remaining % after client advance
- `BJ2 = AB13_est` — Direct COGS estimate
- `BJ3 = forex_cost + dm_cost` — Indirect COGS

### Input Cells Not Tracked

| Cell | Russian Name | Issue |
|------|-------------|-------|
| F16 | Ед. изм. | Unit of measure - not used in calculations |
| H16, I16 | - | Empty columns |

### Mapping Status Summary

| Category | Total | Mapped | Status |
|----------|-------|--------|--------|
| Product Inputs | 14 | 13 | ✅ Complete (F16 unused) |
| Quote-Level Inputs | 14 | 14 | ✅ Complete |
| Logistics & Customs | 8 | 8 | ✅ Complete |
| Taxes & Duties | 3 | 3 | ✅ Complete |
| Financial Settings | 7 | 7 | ✅ Complete |
| Derived/Lookup | 4 | 4 | ✅ Complete |
| Output Phases 1-13 | 43 | 43 | ✅ Complete |
| **Total** | **93** | **92** | **99% Complete** |

---

## Next Steps

1. **Verify "Check" items** - Ensure these are calculated in Python
2. **Extract expected values** - From test_cases_complete.json for all mapped cells
3. **Create parametrized tests** - One assertion per cell mapping
4. **Run validation** - Compare Python vs Excel for all products

---

**Created:** 2025-11-26
**Status:** Draft - Needs Excel verification
