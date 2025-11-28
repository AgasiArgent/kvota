# Excel Upload Template Design

**Created:** 2025-11-28
**Status:** Complete
**Purpose:** Simplified Excel template for quote input (MVP alternative to broken UI)

---

## Overview

Instead of fixing the broken frontend-to-API data flow, we create a simplified Excel template that users fill in and upload. This bypasses UI issues and provides a familiar interface for users already working with Excel.

## Template Location

- **WSL:** `/home/novi/workspace/tech/projects/kvota/user-feedback/validation_data/template_quote_input_v5.xlsx`
- **Windows:** `C:\Users\Lenovo\AppData\Local\Temp\template_quote_input_v5.xlsx`

---

## Template Structure

### Layout (Horizontal Sections)

```
Row 1:  [НАСТРОЙКИ КОТИРОВКИ] | [УСЛОВИЯ ОПЛАТЫ] | [ЛОГИСТИКА]
Rows 2-7: Content             | Content          | Content
Row 6:                        |                  | [БРОКЕРСКИЕ УСЛУГИ]
Rows 7-12:                    | [ВОЗНАГРАЖДЕНИЕ] | Content
Row 14: [ТОВАРЫ]
Row 15: Product headers
Row 16+: Product data
```

### Section 1: НАСТРОЙКИ КОТИРОВКИ (A1-B7)

| Field | Type | Values |
|-------|------|--------|
| Компания-продавец | Dropdown | МАСТЕР БЭРИНГ ООО, ЦМТО1 ООО, РАД РЕСУРС ООО, TEXCEL..., GESTUS..., UPDOOR Limited |
| Вид КП | Dropdown | поставка, транзит, финтранзит, экспорт |
| Базис поставки | Dropdown | DDP, DAP, CIF, FOB, EXW |
| Валюта КП | Dropdown | USD, EUR, TRY, CNY, RUB |
| Срок поставки (дней) | Number | User input |
| Аванс поставщику (%) | Number | 0-100 |

### Section 2: УСЛОВИЯ ОПЛАТЫ (D1-F7)

| Этап | % | Дней |
|------|---|------|
| Аванс от клиента | User input | User input |
| При заборе груза | User input | User input |
| При отправке в РФ | User input | User input |
| При таможне | User input | User input |
| При получении | **Auto: =100-SUM(above)** | User input |

**Note:** "При получении" % is auto-calculated formula, but user must enter days.

### Section 3: ЛОГИСТИКА (H1-J5)

| Статья | Сумма | Валюта |
|--------|-------|--------|
| "ОТКУДА" | Number | Dropdown (USD/EUR/TRY/CNY/RUB) |
| Турция - РФ | Number | Dropdown |
| РФ (граница) | Number | Dropdown |

**Field names from Excel:**
- "ОТКУДА" - Турция (supplier to hub)
- Турция - РФ (граница) (hub to RF border)
- РФ (граница) - "КУДА" (RF border to client)

### Section 4: БРОКЕРСКИЕ УСЛУГИ (H6-J12)

| Статья | Сумма | Валюта |
|--------|-------|--------|
| Брокерские: Хаб | Number | Dropdown |
| Брокерские: Таможня РФ | Number | Dropdown |
| Расходы на СВХ | Number | Dropdown |
| Разреш. документы | Number | Dropdown |
| Прочее | Number | Dropdown |

### Section 5: ВОЗНАГРАЖДЕНИЕ ЛПР (D10-F12)

| Row | Field | Value |
|-----|-------|-------|
| 11 | Тип | Dropdown: "% от суммы" / "фикс. сумма" (merged E11:F11) |
| 12 | Значение | Number (E12) + Валюта dropdown (F12) |

**Logic:** Currency dropdown (F12) is only used when Тип = "фикс. сумма"

### Section 6: ТОВАРЫ (A14+)

12 columns (exchange rate removed - fetched from CBR):

| # | Column | Type |
|---|--------|------|
| 1 | Бренд | Text |
| 2 | Артикул | Text |
| 3 | Название товара | Text |
| 4 | Кол-во | Number |
| 5 | Вес, кг | Number |
| 6 | Валюта | Dropdown (USD/EUR/TRY/CNY/RUB) |
| 7 | Цена закупки (с VAT) | Number |
| 8 | Страна закупки | Dropdown (11 countries from enum) |
| 9 | Скидка пост. (%) | Number |
| 10 | Код ТН ВЭД | Number |
| 11 | Пошлина (%) | Number |
| 12 | Наценка (%) | Number |

**Countries dropdown:**
- Турция
- Турция (транзитная зона)
- Россия
- Китай
- Литва
- Латвия
- Болгария
- Польша
- ЕС (закупка между странами ЕС)
- ОАЭ
- Прочие

---

## Data Validations

All dropdowns use Excel Data Validation (type="list"):

| Field | Formula |
|-------|---------|
| Компания-продавец | 6 companies from SellerCompany enum |
| Вид КП | 4 types from OfferSaleType enum |
| Базис поставки | 5 terms from Incoterms enum |
| Валюта | "USD,EUR,TRY,CNY,RUB" |
| Страна закупки | 11 countries from SupplierCountry enum |
| Тип ЛПР | "% от суммы,фикс. сумма" |

---

## Implementation Notes

### Exchange Rate Handling

- **Removed from template:** "Курс к валюте КП" column
- **Auto-fetched:** Exchange rates from CBR API at calculation time
- **Fallback:** Organization manual rates if CBR unavailable

### Mapping to Calculation Engine

Template fields map to `CalculationInput` model:

```python
# Quote-level
company.seller_company -> Компания-продавец
company.offer_sale_type -> Вид КП
logistics.offer_incoterms -> Базис поставки
financial.currency_of_quote -> Валюта КП
logistics.delivery_time -> Срок поставки (дней)
payment.advance_to_supplier -> Аванс поставщику (%)

# Payment terms
payment.advance_from_client -> Аванс от клиента %
payment.time_to_advance -> Аванс от клиента дней
# ... etc for other milestones

# Logistics (W2-W4)
logistics.logistics_supplier_hub -> "ОТКУДА"
logistics.logistics_hub_customs -> Турция - РФ
logistics.logistics_customs_client -> РФ (граница)

# Brokerage (W5-W9)
customs.brokerage_hub -> Брокерские: Хаб
customs.brokerage_customs -> Брокерские: Таможня РФ
customs.warehousing_at_customs -> Расходы на СВХ
customs.customs_documentation -> Разреш. документы
customs.brokerage_extra -> Прочее

# DM Fee
financial.dm_fee_type -> Тип ЛПР
financial.dm_fee_value -> Значение ЛПР
```

---

## Next Steps

1. **Parser:** Create `SimplifiedExcelParser` to read this template
2. **Upload endpoint:** `POST /api/quotes/upload-excel`
3. **Validation:** Validate all required fields before calculation
4. **Output:** Generate result Excel with calculated values

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2025-11-28 | Initial vertical layout |
| v2 | 2025-11-28 | Horizontal sections, currency dropdowns |
| v3 | 2025-11-28 | Enum values from calculation_models.py |
| v4 | 2025-11-28 | Layout matching user screenshot |
| v5 | 2025-11-28 | Merged LPR type dropdown cell |
