# Excel Validation Test Suite Design

**Date:** 2025-11-26
**Purpose:** Validate calculation_engine.py against Excel reference files
**Source Files:** validation_data/test_raschet*.xlsm (7 scenarios)

---

## Goal

Test every calculated value from the 13-phase calculation pipeline against Excel expected values. Catch regressions when formulas change.

---

## Complete Excel Cell to Python Mapping

### Product-Level Values (33 attributes)

| Phase | Excel Cell | Python Attribute | Description |
|-------|------------|------------------|-------------|
| **1** | N16 | `purchase_price_no_vat` | Purchase price without VAT |
| **1** | P16 | `purchase_price_after_discount` | After supplier discount |
| **1** | R16 | `purchase_price_per_unit_quote_currency` | Per unit in quote currency |
| **1** | S16 | `purchase_price_total_quote_currency` | Total purchase price |
| **2** | BD16 | `distribution_base` | Share of total purchase (S16/S13) |
| **2.5** | AX16 | `internal_sale_price_per_unit` | Internal sale price per unit |
| **2.5** | AY16 | `internal_sale_price_total` | Internal sale price total |
| **3** | T16 | `logistics_first_leg` | Supplier to customs |
| **3** | U16 | `logistics_last_leg` | Customs to client |
| **3** | V16 | `logistics_total` | Total logistics |
| **4** | Y16 | `customs_fee` | Import tariff amount |
| **4** | Z16 | `excise_tax_amount` | Excise tax amount |
| **9** | BA16 | `financing_cost_initial` | Initial financing per product |
| **9** | BB16 | `financing_cost_credit` | Credit interest per product |
| **10** | AA16 | `cogs_per_unit` | COGS per unit |
| **10** | AB16 | `cogs_per_product` | Cost of goods sold per product |
| **11** | AF16 | `profit` | Profit per product |
| **11** | AG16 | `dm_fee` | Decision maker fee |
| **11** | AD16 | `sale_price_per_unit_excl_financial` | Sale price per unit (excl financial) |
| **11** | AE16 | `sale_price_total_excl_financial` | Sale price total (excl financial) |
| **11** | AH16 | `forex_reserve` | Forex risk reserve |
| **11** | AI16 | `financial_agent_fee` | Financial agent fee |
| **11** | AJ16 | `sales_price_per_unit_no_vat` | Sales price per unit (no VAT) |
| **11** | AK16 | `sales_price_total_no_vat` | Sales price total (no VAT) |
| **12** | AM16 | `sales_price_per_unit_with_vat` | Sales price per unit (with VAT) |
| **12** | AL16 | `sales_price_total_with_vat` | Sales price total (with VAT) |
| **12** | AN16 | `vat_from_sales` | VAT from sales |
| **12** | AO16 | `vat_on_import` | VAT on import |
| **12** | AP16 | `vat_net_payable` | Net VAT payable |
| **13** | AQ16 | `transit_commission` | Transit commission |

### Quote-Level Values (14 attributes)

| Phase | Excel Cell | Python Attribute | Description |
|-------|------------|------------------|-------------|
| **2** | S13 | `total_purchase_price` | Sum of all S16 |
| **5** | BH6 | `quote_level_supplier_payment` | Supplier payment needed |
| **5** | BH4 | `quote_level_total_before_forwarding` | Total before forwarding |
| **6** | BH2 | `quote_level_evaluated_revenue` | Evaluated revenue |
| **7** | BH3 | `quote_level_client_advance` | Client advance payment |
| **7** | BH7 | `quote_level_supplier_financing_need` | Supplier financing need |
| **7** | BI7 | `quote_level_supplier_financing_fv` | FV of supplier financing |
| **7** | BJ7 | `quote_level_supplier_financing_cost` | Supplier financing cost |
| **7** | BH10 | `quote_level_operational_financing_need` | Operational financing need |
| **7** | BI10 | `quote_level_operational_financing_fv` | FV of operational financing |
| **7** | BJ10 | `quote_level_operational_financing_cost` | Operational financing cost |
| **7** | BJ11 | `quote_level_total_financing_cost` | Total financing cost |
| **8** | BL3 | `quote_level_credit_sales_amount` | Amount client owes |
| **8** | BL4 | `quote_level_credit_sales_fv` | FV with interest |
| **8** | BL5 | `quote_level_credit_sales_interest` | Credit sales interest |
| **10** | AB13 | `total_cogs` | Sum of all AB16 |

### Derived Variables (4 attributes)

| Excel Cell | Python Attribute | Description |
|------------|------------------|-------------|
| M16 | `vat_seller_country` | VAT in supplier country |
| AW16 | `internal_markup` | Internal markup % |
| - | `seller_region` | Derived from seller_company |
| - | `rate_vat_ru` | Russian VAT rate (20% or 22%) |

---

## Test Scenarios (7 files)

### 1. test_raschet (Base Case)
- **Products:** 97 (China supplier)
- **Currency:** USD
- **Payment:** 100% prepayment
- **Delivery:** 60 days
- **Tests:** All 33 product-level values + quote-level totals

### 2. test_raschet_30pct
- **Products:** 97 (China supplier)
- **Variation:** Different markup percentage
- **Tests:** Validates markup affects AF16, AJ16, AK16, AL16

### 3. test_raschet_logistics
- **Products:** 97 (China supplier)
- **Variation:** Different logistics costs
- **Tests:** Validates T16, U16, V16, and downstream AB16

### 4. test_raschet_30pcs_logistics
- **Products:** 97 (China supplier)
- **Variation:** Combined markup + logistics
- **Tests:** Full integration

### 5. test_raschet_multi_currency (EUR)
- **Products:** 5 (mixed countries)
- **Countries:** Turkey, EU, Bulgaria, China, Russia
- **Currency:** EUR
- **Tests:** VAT rates (M16), internal markup (AW16) per country

### 6. test_raschet_multi_currency_rub (RUB)
- **Products:** 5 (mixed countries)
- **Currency:** RUB
- **Tests:** Currency conversion paths

### 7. test_raschet_multi_currency_old
- **Legacy validation**

---

## Test File Structure

```
backend/tests/validation/
├── __init__.py
├── conftest.py                          # Shared fixtures, tolerance helpers
├── test_excel_base_case.py              # test_raschet scenario
├── test_excel_markup_variation.py       # test_raschet_30pct
├── test_excel_logistics_variation.py    # test_raschet_logistics
├── test_excel_multi_country.py          # test_raschet_multi_currency*
└── expected_values/
    ├── base_case.py                     # Hardcoded expected values
    ├── markup_variation.py
    ├── logistics_variation.py
    └── multi_country.py
```

---

## Test Implementation Pattern

```python
import pytest
from decimal import Decimal
from calculation_engine import calculate_single_product_quote
from calculation_models import QuoteCalculationInput, ...

# Tolerance: 0.1% relative or 0.01 absolute (rounding)
RTOL = 0.001
ATOL = Decimal("0.01")

def assert_close(actual: Decimal, expected: float, rtol=RTOL, atol=ATOL):
    """Assert values match within tolerance."""
    expected_dec = Decimal(str(expected))
    diff = abs(actual - expected_dec)
    threshold = max(atol, abs(expected_dec) * Decimal(str(rtol)))
    assert diff <= threshold, f"Expected {expected_dec}, got {actual}, diff={diff}"


class TestBaseCase:
    """Validate calculation engine against test_raschet.xlsm"""

    # Quote-level parameters (same for all products)
    QUOTE_PARAMS = {
        "seller": "МАСТЕР БЭРИНГ ООО",
        "deal_type": "поставка",
        "incoterms": "DDP",
        "currency": "USD",
        "delivery_days": 60,
        "payment_terms": "100% предоплата",
        "advance_pct": 1.0,
        # Logistics costs (quote-level)
        "logistics_supplier_hub": 12000,  # W2
        "logistics_hub_customs": 3000,    # W3
        "logistics_customs_client": 5000, # W4
        # ... other quote-level costs
    }

    @pytest.mark.parametrize("product", [
        # Product 1: 195-03-51110
        {
            "sku": "195-03-51110",
            "price_vat": 136554.77,
            "quantity": 1,
            "country": "Китай",
            "vat_rate": 0.13,
            "exchange_rate": 7.14,
            "tariff": 0.05,
            "markup": 0.19,
            "expected": {
                "N16": 120845.11,      # purchase_price_no_vat
                "P16": 120845.11,      # purchase_price_after_discount (0% discount)
                "R16": 16925.79,       # purchase_price_per_unit_quote_currency
                "S16": 16925.79,       # purchase_price_total_quote_currency
                "BD16": 0.088456,      # distribution_base
                "T16": 158.14,         # logistics_first_leg
                "U16": 0,              # logistics_last_leg (varies)
                "V16": 158.14,         # logistics_total
                "Y16": 983.30,         # customs_fee
                "Z16": 0,              # excise_tax_amount
                "AX16": 17264.31,      # internal_sale_price_per_unit
                "AY16": 17264.31,      # internal_sale_price_total
                "AB16": 20266.76,      # cogs_per_product
                "AA16": 20266.76,      # cogs_per_unit
                "AF16": 3850.68,       # profit
                "AG16": 0,             # dm_fee
                "AH16": 0,             # forex_reserve
                "AI16": 0,             # financial_agent_fee
                "AJ16": 25298.32,      # sales_price_per_unit_no_vat
                "AK16": 25298.32,      # sales_price_total_no_vat
                "AM16": 30357.98,      # sales_price_per_unit_with_vat
                "AL16": 30357.98,      # sales_price_total_with_vat
                "AN16": 5059.66,       # vat_from_sales
                "AO16": 3709.82,       # vat_on_import
                "AP16": 1349.84,       # vat_net_payable
                "AQ16": 0,             # transit_commission
            }
        },
        # ... more products
    ])
    def test_product_calculation(self, product):
        """Test all calculated values for a single product."""
        calc_input = self._build_input(product)
        result = calculate_single_product_quote(calc_input)

        # Assert all 30 product-level values
        assert_close(result.purchase_price_no_vat, product["expected"]["N16"])
        assert_close(result.purchase_price_after_discount, product["expected"]["P16"])
        assert_close(result.purchase_price_per_unit_quote_currency, product["expected"]["R16"])
        assert_close(result.purchase_price_total_quote_currency, product["expected"]["S16"])
        assert_close(result.distribution_base, product["expected"]["BD16"])
        assert_close(result.logistics_first_leg, product["expected"]["T16"])
        assert_close(result.logistics_last_leg, product["expected"]["U16"])
        assert_close(result.logistics_total, product["expected"]["V16"])
        assert_close(result.customs_fee, product["expected"]["Y16"])
        assert_close(result.excise_tax_amount, product["expected"]["Z16"])
        assert_close(result.internal_sale_price_per_unit, product["expected"]["AX16"])
        assert_close(result.internal_sale_price_total, product["expected"]["AY16"])
        assert_close(result.cogs_per_product, product["expected"]["AB16"])
        assert_close(result.cogs_per_unit, product["expected"]["AA16"])
        assert_close(result.profit, product["expected"]["AF16"])
        assert_close(result.dm_fee, product["expected"]["AG16"])
        assert_close(result.forex_reserve, product["expected"]["AH16"])
        assert_close(result.financial_agent_fee, product["expected"]["AI16"])
        assert_close(result.sales_price_per_unit_no_vat, product["expected"]["AJ16"])
        assert_close(result.sales_price_total_no_vat, product["expected"]["AK16"])
        assert_close(result.sales_price_per_unit_with_vat, product["expected"]["AM16"])
        assert_close(result.sales_price_total_with_vat, product["expected"]["AL16"])
        assert_close(result.vat_from_sales, product["expected"]["AN16"])
        assert_close(result.vat_on_import, product["expected"]["AO16"])
        assert_close(result.vat_net_payable, product["expected"]["AP16"])
        assert_close(result.transit_commission, product["expected"]["AQ16"])
```

---

## Multi-Country Test Pattern

```python
class TestMultiCountry:
    """Test different supplier countries with their VAT rates and markups."""

    @pytest.mark.parametrize("country_data", [
        {
            "country": "Турция",
            "vat_rate": 0.20,
            "internal_markup": 0.02,  # 2% for Turkey→RU
            "exchange_rate": 3.2,     # TRY to RUB
        },
        {
            "country": "ЕС (закупка между странами ЕС)",
            "vat_rate": 0.00,         # Cross-border EU = 0%
            "internal_markup": 0.04,  # 4% for EU→RU
            "exchange_rate": 105.0,   # EUR to RUB
        },
        {
            "country": "Болгария",
            "vat_rate": 0.20,
            "internal_markup": 0.04,  # 4% for Bulgaria→RU
            "exchange_rate": 53.7,    # BGN to RUB
        },
        {
            "country": "Китай",
            "vat_rate": 0.13,
            "internal_markup": 0.02,  # 2% for China→RU
            "exchange_rate": 14.0,    # CNY to RUB
        },
        {
            "country": "Россия",
            "vat_rate": 0.20,
            "internal_markup": 0.00,  # 0% for Russia→RU
            "exchange_rate": 1.0,     # RUB to RUB
        },
    ])
    def test_country_specific_rates(self, country_data):
        """Validate VAT and markup derivation per country."""
        # Build input with country
        # Assert derived values match
        pass
```

---

## Acceptance Criteria

1. **All 33 product-level values** tested for each product
2. **All 14 quote-level values** tested for multi-product scenarios
3. **7 scenarios** covered (base, markup, logistics, multi-currency)
4. **Tolerance:** 0.1% relative or 0.01 absolute
5. **Test count:** ~200+ parametrized tests
6. **CI/CD:** Tests run on every commit

---

## Implementation Order

1. Create `conftest.py` with `assert_close()` helper
2. Extract expected values from `test_cases_complete.json` into Python dicts
3. Implement `test_excel_base_case.py` (first 10 products)
4. Run and fix any mismatches against Excel
5. Add remaining products
6. Implement multi-country tests
7. Add quote-level aggregation tests

---

## Debugging Mismatches

When a test fails:

1. **Identify the phase** - Excel cell tells you which phase (N16=Phase 1, AB16=Phase 10)
2. **Check upstream values** - If AB16 wrong, check S16, V16, Y16 first
3. **Open Excel file** - `validation_data/test_raschet.xlsm`
4. **Compare formulas** - Check Excel formula vs Python implementation
5. **Fix and re-run** - Update calculation_engine.py

---

**Status:** Design Complete
**Next Step:** Implementation (see implementation plan)
