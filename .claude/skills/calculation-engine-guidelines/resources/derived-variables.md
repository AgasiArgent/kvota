# Derived Variables - Verified from Code

**Created:** 2025-12-13
**Source:** `backend/calculation_engine.py` lines 23-84, 107-142
**Status:** VERIFIED - supersedes archive documentation

---

## Overview

4 derived variables are automatically calculated from user inputs:
1. `seller_region` - from seller_company
2. `vat_seller_country` (M16) - from supplier_country
3. `internal_markup` (AW16) - from supplier_country + seller_region
4. `rate_vatRu` - from seller_region + delivery_date

**IMPORTANT:** Archive docs (`Variables_specification_notion.md`) are OUTDATED for internal_markup. Use values below.

---

## 1. seller_region

**Derived from:** `seller_company`
**Code location:** `calculation_engine.py:28-35`, `calculation_engine.py:107-109`

| Company Name (seller_company) | seller_region | Country |
|-------------------------------|---------------|---------|
| МАСТЕР БЭРИНГ ООО | RU | Russia |
| ЦМТО1 ООО | RU | Russia |
| РАД РЕСУРС ООО | RU | Russia |
| TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ | TR | Turkey |
| GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ | TR | Turkey |
| UPDOOR Limited | CN | China |

```python
def get_seller_region(seller_company: SellerCompany) -> str:
    """Derive seller_region from seller_company"""
    return SELLER_REGION_MAP[seller_company]
```

---

## 2. vat_seller_country (M16)

**Derived from:** `supplier_country`
**Code location:** `calculation_engine.py:38-50`, `calculation_engine.py:112-114`

| Supplier Country | VAT Rate | Notes |
|-----------------|----------|-------|
| Турция | 20% | Standard Turkey VAT |
| Турция (транзитная зона) | 0% | Transit zone - no VAT |
| Россия | 20% | Russian VAT |
| Китай | 13% | Chinese VAT |
| Литва | 21% | EU member |
| Латвия | 21% | EU member |
| Болгария | 20% | EU member |
| Польша | 23% | EU member |
| ЕС (между странами ЕС) | 0% | Cross-border EU |
| ОАЭ | 5% | UAE VAT |
| Прочие | 0% | Default |

```python
def get_vat_seller_country(supplier_country: SupplierCountry) -> Decimal:
    """Get VAT rate for supplier country (M16)"""
    return VAT_SELLER_COUNTRY_MAP[supplier_country]
```

---

## 3. internal_markup (AW16)

**Derived from:** `supplier_country` + `seller_region`
**Code location:** `calculation_engine.py:54-77`, `calculation_engine.py:117-119`
**Last updated:** 2025-11-09 (code comment)

### CURRENT VALUES (from code):

| Supplier Country | RU (selling from Russia) | TR (selling from Turkey) |
|-----------------|--------------------------|--------------------------|
| Турция | 2% | 0% |
| Турция (транзитная зона) | 2% | 0% |
| Россия | 0% | 0% |
| Китай | 2% | 0% |
| Литва | 4% | 2% |
| Латвия | 4% | 2% |
| Болгария | 4% | 2% |
| Польша | 4% | 2% |
| ЕС (между странами ЕС) | 4% | 2% |
| ОАЭ | 3% | 1% |
| Прочие | 2% | 0% |

### Archive docs are WRONG (old values):

| Supplier Country | Archive RU | Actual RU | Archive TR | Actual TR |
|-----------------|------------|-----------|------------|-----------|
| Турция | 10% | **2%** | 0% | 0% |
| Китай | 10% | **2%** | 0% | 0% |
| EU countries | 13% | **4%** | 3% | **2%** |
| ОАЭ | 11% | **3%** | 1% | 1% |
| Прочие | 10% | **2%** | 0% | 0% |

```python
def get_internal_markup(supplier_country: SupplierCountry, seller_region: str) -> Decimal:
    """Get internal markup based on supplier country and seller region (AW16)"""
    return INTERNAL_MARKUP_MAP[(supplier_country, seller_region)]
```

---

## 4. rate_vatRu

**Derived from:** `seller_region` + `delivery_date`
**Code location:** `calculation_engine.py:79-84`, `calculation_engine.py:122-142`

| Seller Region | Before 2026 | 2026 onwards |
|--------------|-------------|--------------|
| RU | 20% | **22%** |
| TR | 0% | 0% |
| CN | 0% | 0% |

**2026 VAT Change:** Russian VAT increases from 20% to 22% on January 1, 2026 (government mandate).

```python
def get_rate_vat_ru(seller_region: str, delivery_date: Optional[date] = None) -> Decimal:
    """Get Russian VAT rate based on seller region and delivery date."""
    base_rate = RATE_VAT_BY_SELLER_REGION[seller_region]

    # Only adjust Russian VAT (Turkish/Chinese stay at 0%)
    if seller_region == "RU" and delivery_date and delivery_date.year >= 2026:
        return Decimal("0.22")  # 22% for 2026+

    return base_rate  # 20% for <2026 or non-Russian
```

---

## 5. Usage in Calculation Engine

All derived variables are computed early and passed to phase calculations:

```python
# In phase1_purchase_price:
# N16 = base_price_VAT / (1 + vat_seller_country)  # Uses derived M16
# Special case: China prices are already VAT-free

# In phase4_customs:
# AX16 calculation uses internal_markup (AW16)

# In phase12_vat:
# VAT calculations use rate_vatRu
```

---

## 6. Code References

| Function | File | Lines |
|----------|------|-------|
| `get_seller_region()` | calculation_engine.py | 107-109 |
| `get_vat_seller_country()` | calculation_engine.py | 112-114 |
| `get_internal_markup()` | calculation_engine.py | 117-119 |
| `get_rate_vat_ru()` | calculation_engine.py | 122-142 |
| `SELLER_REGION_MAP` | calculation_engine.py | 28-35 |
| `VAT_SELLER_COUNTRY_MAP` | calculation_engine.py | 38-50 |
| `INTERNAL_MARKUP_MAP` | calculation_engine.py | 54-77 |
| `RATE_VAT_BY_SELLER_REGION` | calculation_engine.py | 79-84 |

---

**Last Updated:** 2025-12-13
**Archive docs superseded:** `.claude/archive/Variables_specification_notion.md` (Section 1.5)

