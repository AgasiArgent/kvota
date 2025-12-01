# Excel Template Upload System

**Created:** 2025-11-29

## Overview

Users can download an Excel template, fill it with quote data, and upload it to create quotes with automatic calculation.

---

## Template Download

### Endpoint

```
GET /api/quotes/download-template
```

**Auth:** Not required (public endpoint)

**Response:** Excel file (.xlsx) as attachment

**Filename:** `quote_input_template.xlsx`

### Frontend Usage

```typescript
// Download template
const downloadTemplate = () => {
  window.open('/api/quotes/download-template', '_blank');
};

// Or with fetch for more control
const downloadTemplate = async () => {
  const response = await fetch('/api/quotes/download-template');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quote_input_template.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
};
```

---

## Template Structure

### Sheet: "Котировка"

#### Section 1: Quote Settings (A1:B7)

| Cell | Field | Description | Format |
|------|-------|-------------|--------|
| B2 | Компания-продавец | Seller company (dropdown) | Text |
| B3 | Вид КП | Sale type: поставка/транзит/финтранзит/экспорт | Text |
| B4 | Базис поставки | Incoterms: DDP/DAP/CIF/FOB/EXW | Text |
| B5 | Валюта КП | Quote currency: EUR/USD/RUB/TRY/CNY | Text |
| B6 | Срок поставки (дней) | Delivery time in days | Number |
| B7 | Аванс поставщику (%) | Advance to supplier | **Percent** (0.3 = 30%) |

#### Section 2: Payment Terms (D1:F7)

| Cell | Field | Description | Format |
|------|-------|-------------|--------|
| E3 | Аванс от клиента | Client advance % | **Percent** |
| F3 | (days) | Days for advance | Number |
| E4 | При заборе груза | On loading % | **Percent** |
| E5 | При отправке в РФ | On shipping % | **Percent** |
| E6 | При таможне | On customs % | **Percent** |
| E7 | При получении | On receiving (formula: =1-SUM(E3:E6)) | **Percent** |
| F7 | (days) | Days after receiving | Number |

#### Section 3: DM Fee (D10:E12)

| Cell | Field | Description |
|------|-------|-------------|
| E11 | Тип | Fee type: "Фикс" or "% от суммы" |
| E12 | Значение | Fee value |

#### Section 4: Products (A14:L+)

Header row 15:

| Column | Header | Description | Format |
|--------|--------|-------------|--------|
| A | Бренд | Brand | Text |
| B | Артикул | SKU | Text |
| C | Название товара | Product name | Text |
| D | Кол-во | Quantity | Number |
| E | Вес, кг | Weight in kg | Number |
| F | Валюта | Currency (EUR/USD/TRY/CNY/RUB) | Text |
| G | Цена закупки (с VAT) | Purchase price with VAT | Number |
| H | Страна закупки | Supplier country | Text (dropdown) |
| I | Скидка пост. (%) | Supplier discount | **Percent** (0.05 = 5%) |
| J | Код ТН ВЭД | Customs code (10 digits) | Text |
| K | Пошлина (%) | Import tariff | **Percent** (0.05 = 5%) |
| L | Наценка (%) | Markup | **Percent** (0.30 = 30%) |

Data starts at row 16.

---

## Percentage Fields

**Important:** The following fields use Excel percentage format:
- User enters `30` → displays as `30%` → actual value is `0.3`

| Location | Field |
|----------|-------|
| B7 | Аванс поставщику |
| E3:E7 | Payment milestone percentages |
| Column I | Скидка поставщика |
| Column K | Пошлина (import tariff) |
| Column L | Наценка (markup) |

The parser expects decimal values (0.3 for 30%).

---

## Template Upload

### Endpoint

```
POST /api/quotes/upload-excel
```

**Auth:** Required (Bearer token)

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file`: Excel file (.xlsx)
- `calculate`: boolean (default: true) - run calculation after parsing

**Response:**
```json
{
  "success": true,
  "message": "File parsed and calculated successfully",
  "quote_input": { ... },
  "calculation_results": {
    "total_purchase_price": "16941.12",
    "total_cogs": "18234.56",
    "total_revenue": "23704.93",
    "total_profit": "5470.37",
    "margin_percent": "30.00",
    "products": [ ... ],
    "exchange_rates_used": { ... }
  }
}
```

### Frontend Usage

```typescript
const uploadQuoteExcel = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/quotes/upload-excel', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};
```

---

## Validation Export (for debugging)

### Endpoint

```
POST /api/quotes/upload-excel-validation
```

Returns an Excel file (.xlsm) with:
- **API_Inputs** tab: All uploaded input values
- **расчет** tab: Excel formulas recalculating with API inputs
- **API_Results** tab: API calculation outputs
- **Comparison** tab: Side-by-side comparison with differences highlighted

Useful for validating API calculations match Excel.

---

## File Location

**Template file:** `validation_data/template_quote_input_v6_test.xlsx`

**Endpoint code:** `backend/routes/quotes_upload.py`

---

## Dropdown Values

### Seller Companies
- МАСТЕР БЭРИНГ ООО
- ЦМТО1 ООО
- РАД РЕСУРС ООО
- TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ
- GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ
- UPDOOR Limited

### Supplier Countries
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

### Currencies
- EUR
- USD
- RUB
- TRY
- CNY

### Sale Types
- поставка
- транзит
- финтранзит
- экспорт

### Incoterms
- DDP
- DAP
- CIF
- FOB
- EXW
