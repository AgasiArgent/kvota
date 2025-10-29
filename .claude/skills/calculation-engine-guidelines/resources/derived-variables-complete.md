# Derived Variables - Complete Specification

**Source:** Archive files (primary documentation)
**Created:** 2025-10-29
**Purpose:** Complete specification of all derived variables from archive

---

## Overview

These variables are **NOT user inputs** - they are automatically calculated from user selections. The calculation engine derives these values based on mapping tables and business rules.

---

## 1. seller_region

**Derives from:** `seller_company`

**Purpose:** Determines the region code for the selling entity, used in various calculations including VAT rates, internal markup, and financial agent fees.

**Complete Mapping Table:**

| Company Name | Region Code | Country |
|---|---|---|
| МАСТЕР БЭРИНГ ООО | RU | Russia |
| ЦМТО1 ООО | RU | Russia |
| РАД РЕСУРС ООО | RU | Russia |
| TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ | TR | Turkey |
| GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ | TR | Turkey |
| UPDOOR Limited | CN | China |

**Python Implementation:**
```python
SELLER_REGION_MAP = {
    "МАСТЕР БЭРИНГ ООО": "RU",
    "ЦМТО1 ООО": "RU",
    "РАД РЕСУРС ООО": "RU",
    "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ": "TR",
    "GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ": "TR",
    "UPDOOR Limited": "CN"
}

def get_seller_region(seller_company: str) -> str:
    """Derive seller_region from seller_company"""
    region = SELLER_REGION_MAP.get(seller_company)
    if region is None:
        raise ValueError(f"Unknown seller company: {seller_company}")
    return region
```

**Usage in Formulas:**
- Final-7: Financial agent fee (0 if seller_region = "TR")
- Final-11: Customs fee amount (different basis for different regions)
- Final-18: VAT application (applies rate_vatRu if seller_region = "RU")

---

## 2. vat_seller_country (M16)

**Derives from:** `supplier_country`

**Purpose:** VAT rate in the supplier's country (where we buy from).

**Complete Mapping Table:**

| Supplier Country | VAT Rate | Notes |
|---|---|---|
| Турция | 20% | Standard Turkey VAT |
| Турция (транзитная зона) | 0% | Transit zone - no VAT |
| Россия | 20% | Russian VAT |
| Китай | 13% | Chinese VAT |
| Литва | 21% | When buying entity also in Lithuania |
| Латвия | 21% | When buying entity also in Latvia |
| Болгария | 20% | When buying entity also in Bulgaria |
| Польша | 23% | When buying entity also in Poland |
| ЕС (между странами ЕС) | 0% | Cross-border EU - no VAT |
| ОАЭ | 5% | UAE VAT |
| Прочие | 0% | Other countries default |

**Python Implementation:**
```python
from decimal import Decimal

VAT_SELLER_COUNTRY_MAP = {
    "Турция": Decimal("0.20"),
    "Турция (транзитная зона)": Decimal("0.00"),
    "Россия": Decimal("0.20"),
    "Китай": Decimal("0.13"),
    "Литва": Decimal("0.21"),
    "Латвия": Decimal("0.21"),
    "Болгария": Decimal("0.20"),
    "Польша": Decimal("0.23"),
    "ЕС (между странами ЕС)": Decimal("0.00"),
    "ОАЭ": Decimal("0.05"),
    "Прочие": Decimal("0.00")
}

def get_vat_seller_country(supplier_country: str) -> Decimal:
    """Get VAT rate for supplier country (M16 in Excel)"""
    vat_rate = VAT_SELLER_COUNTRY_MAP.get(supplier_country)
    if vat_rate is None:
        raise ValueError(f"Unknown supplier country: {supplier_country}")
    return vat_rate
```

**EU Special Logic:**
- If buying entity is in EU country A and supplier is in same EU country A → use specific country VAT (21%, 20%, 23%, etc.)
- If buying entity is in EU country A and supplier is in different EU country B → use "ЕС (между странами ЕС)" (0% VAT)

**Usage in Formulas:**
- Final-8: Purchase price with VAT = S16 × (1 + M16)
- Final-34: Purchasing price cleared of VAT = K16 / (1 + M16)

---

## 3. internal_markup (AW16)

**Derives from:** `supplier_country` + `seller_region`

**Purpose:** Internal markup percentage depends on BOTH where we're buying from AND where we're selling from.

**Complete Mapping Table:**

| Supplier Country | Selling from RU | Selling from TR |
|---|---|---|
| Турция | 10% | 0% |
| Турция (транзитная зона) | 10% | 0% |
| Россия | 0% | 0% |
| Китай | 10% | 0% |
| Литва | 13% | 3% |
| Латвия | 13% | 3% |
| Болгария | 13% | 3% |
| Польша | 13% | 3% |
| ЕС (между странами ЕС) | 13% | 3% |
| ОАЭ | 11% | 1% |
| Прочие | 10% | 0% |

**Python Implementation:**
```python
INTERNAL_MARKUP_MAP = {
    ("Турция", "RU"): Decimal("0.10"),
    ("Турция", "TR"): Decimal("0.00"),
    ("Турция (транзитная зона)", "RU"): Decimal("0.10"),
    ("Турция (транзитная зона)", "TR"): Decimal("0.00"),
    ("Россия", "RU"): Decimal("0.00"),
    ("Россия", "TR"): Decimal("0.00"),
    ("Китай", "RU"): Decimal("0.10"),
    ("Китай", "TR"): Decimal("0.00"),
    ("Литва", "RU"): Decimal("0.13"),
    ("Литва", "TR"): Decimal("0.03"),
    ("Латвия", "RU"): Decimal("0.13"),
    ("Латвия", "TR"): Decimal("0.03"),
    ("Болгария", "RU"): Decimal("0.13"),
    ("Болгария", "TR"): Decimal("0.03"),
    ("Польша", "RU"): Decimal("0.13"),
    ("Польша", "TR"): Decimal("0.03"),
    ("ЕС (между странами ЕС)", "RU"): Decimal("0.13"),
    ("ЕС (между странами ЕС)", "TR"): Decimal("0.03"),
    ("ОАЭ", "RU"): Decimal("0.11"),
    ("ОАЭ", "TR"): Decimal("0.01"),
    ("Прочие", "RU"): Decimal("0.10"),
    ("Прочие", "TR"): Decimal("0.00")
}

def get_internal_markup(supplier_country: str, seller_region: str) -> Decimal:
    """Get internal markup based on supplier country and seller region"""
    markup = INTERNAL_MARKUP_MAP.get((supplier_country, seller_region))
    if markup is None:
        raise ValueError(
            f"No markup defined for supplier={supplier_country}, "
            f"seller_region={seller_region}"
        )
    return markup
```

**Usage in Formulas:**
- Final-46: Amount of internal sale = S16 × (1 + AW16)
- Final-7: Financial agent fee calculation includes AZ16 × AW16

---

## 4. rate_vatRu

**Derives from:** `seller_region`

**Purpose:** VAT rate in seller's destination country (where we sell from).

**Complete Mapping Table:**

| seller_region | rate_vatRu | Description |
|---|---|---|
| RU | 20% (0.20) | Russian VAT |
| TR | 0% (0.00) | Turkey - not yet implemented |
| CN | 0% (0.00) | China - not yet implemented |

**Note:** Currently only RU (Russia) is fully implemented. Other regions default to 0% until business rules are defined.

**Python Implementation:**
```python
from decimal import Decimal

RATE_VAT_BY_SELLER_REGION = {
    "RU": Decimal("0.20"),  # Russian VAT: 20%
    "TR": Decimal("0.00"),  # Turkey: to be defined
    "CN": Decimal("0.00")   # China: to be defined
}

def get_rate_vat_ru(seller_region: str) -> Decimal:
    """Get VAT rate for seller's destination country"""
    vat_rate = RATE_VAT_BY_SELLER_REGION.get(seller_region)
    if vat_rate is None:
        raise ValueError(f"Unknown seller region: {seller_region}")
    return vat_rate
```

**Key Difference from vat_seller_country:**
- `vat_seller_country` (M16) = VAT in **supplier's** country (where we buy from)
- `rate_vatRu` = VAT in **seller's** country (where we sell from)

**Usage in Formulas:**
- Final-18: Evaluated revenue = ... × (1 + IF(seller_region="RU", rate_vatRu, 0))
- Final-39: Sale price with VAT = AJ16 × (1 + IF(offer_incoterms="DDP", rate_vatRu, 0))
- Final-42: VAT payable at import = ... × IF(AND(offer_incoterms="DDP", offer_sale_type≠"экспорт"), rate_vatRu, 0)

---

## Implementation Status in Backend

**Location:** `/home/novi/quotation-app-dev/backend/calculation_engine.py` (lines 23-82)

✅ **All derived variable mappings are correctly implemented:**
- `SELLER_REGION_MAP` (lines 26-34)
- `VAT_SELLER_COUNTRY_MAP` (lines 36-49)
- `INTERNAL_MARKUP_MAP` (lines 51-75)
- `RATE_VAT_BY_SELLER_REGION` (lines 77-82)

---

## Critical Business Rules Using Derived Variables

### 1. Financial Agent Fee (Final-7)
- **Zero if** seller_region = "TR" OR offer_sale_type = "экспорт"
- Otherwise applies rate_fin_comm

### 2. Customs Duty (Final-11, Y16)
- **Zero if** seller_region = "TR" (Turkish export)
- Otherwise calculated based on import tariff and internal price

### 3. Internal Sale Price (Final-46, AX16)
- Always applies internal_markup based on supplier_country + seller_region combination
- This affects customs duty calculation base

### 4. VAT Application (Final-18, Final-39, Final-42)
- Only applies when seller_region = "RU" AND certain conditions met
- DDP deliveries include VAT in final price
- Export sales (offer_sale_type = "экспорт") never include import VAT

---

## Testing Checklist

When testing calculation engine, verify:

- [ ] Seller company correctly maps to seller region
- [ ] Supplier country correctly maps to VAT rate
- [ ] Internal markup uses correct (supplier_country, seller_region) pair
- [ ] VAT only applies when seller_region = "RU"
- [ ] Financial agent fee is 0 for Turkish sellers
- [ ] Customs duty is 0 for Turkish exports
- [ ] EU cross-border transactions have 0% VAT
- [ ] Chinese supplier VAT is 13% (not removed like others)