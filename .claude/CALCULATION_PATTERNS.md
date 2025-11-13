# Calculation Engine Patterns

**Created:** 2025-10-29 20:50 UTC
**Purpose:** Quick reference for 42 variables, validation rules, and two-tier system
**Source:** VARIABLES.md + backend/routes/quotes_calc.py
**Usage:** Lookup variable rules before implementing calculations

---

## Overview

The calculation engine processes 42 variables through 13 phases to generate quote pricing. This document provides quick reference for:
- Variable classifications (what can be set where)
- Validation rules (what's required, what's valid)
- Two-tier system (how overrides work)
- Common errors (what breaks and why)

**Target audience:** Developers implementing quote calculations and validation

**Maintenance:** Update when adding new variables or validation rules

---

## Two-Tier Variable System

**Core Concept:** Quote-level defaults apply to all products UNLESS product-level override exists

### Precedence Order
```
Product Override > Quote Default > System Fallback
```

### Implementation Pattern
```python
def get_value(product_data, quote_data, field_name):
    """Get effective value respecting two-tier precedence"""
    # 1. Check product override
    product_value = product_data.get(field_name)
    if product_value is not None and product_value != "":
        return product_value  # Product wins

    # 2. Fall back to quote default
    quote_value = quote_data.get(field_name)
    if quote_value is not None and quote_value != "":
        return quote_value  # Quote default

    # 3. System fallback (if applicable)
    return get_system_default(field_name)
```

### Visual Indicators (UI)
- **Gray background (#f5f5f5):** Empty override (using quote default)
- **Blue background (#e6f7ff):** Filled override (overriding quote default)
- **White background:** Always-editable fields (product info)

**Real Bug:** Commission distribution bug (BUG-024) - Form.getFieldsValue() only returns DOM fields, missing defaults

**Deep Dive:** [→ Skill: calculation-engine] *(Coming in Phase 1)*

---

## 42 Variables Classification

### Product-Only Variables (5)
**Cannot have quote defaults - must be specified per product**

| Variable | Russian Name | Purpose | Example |
|----------|--------------|---------|---------|
| sku | Артикул | Product identifier | "ABC-123" |
| brand | Бренд | Manufacturer | "Bosch" |
| base_price_VAT | Цена закупки (включает VAT) | Purchase price | 1000.00 |
| quantity | Кол-во | Order quantity | 10 |
| weight_in_kg | Вес (кг) | Product weight | 5.5 |

**Key Point:** These fields ALWAYS required in products table

---

### Quote-Only Variables (19)
**Set once at quote level - cannot override per product**

| Variable | Russian Name | Category | Default | Admin? |
|----------|--------------|----------|---------|--------|
| currency_of_quote | Валюта КП | Financial | "RUB" | No |
| seller_company | Компания-продавец | Company | (user's org) | No |
| offer_sale_type | Вид КП | Company | "поставка" | No |
| offer_incoterms | Базис поставки | Logistics | "EXW" | No |
| advance_from_client | Аванс (%) | Payments | 30% | No |
| time_to_advance | Дней от подписания до аванса | Payments | 7 | No |
| advance_on_loading | Аванс при заборе груза (%) | Payments | 0% | No |
| time_to_advance_loading | Дней от забора до аванса | Payments | 0 | No |
| advance_on_going_to_country_destination | Аванс при отправке в РФ (%) | Payments | 0% | No |
| time_to_advance_going_to_country_destination | Дней от отправки до аванса | Payments | 0 | No |
| advance_on_customs_clearance | Аванс при таможне (%) | Payments | 0% | No |
| time_to_advance_on_customs_clearance | Дней от таможни до аванса | Payments | 0 | No |
| time_to_advance_on_receiving | Дней от получения до оплаты | Payments | 0 | No |
| dm_fee_type | Вознаграждение ЛПР (тип) | Financial | "none" | No |
| dm_fee_value | Вознаграждение ЛПР (значение) | Financial | 0 | No |
| util_fee | Утилизационный сбор | Taxes | 0 | No |
| rate_forex_risk | Резерв на курсовой разнице (%) | Financial | 3% | **Yes** |
| rate_fin_comm | Комиссия ФинАгента (%) | Financial | 2% | **Yes** |
| rate_loan_interest_daily | Дневная стоимость денег (%) | Financial | 0.00069 | **Yes** |

**Admin Variables (3):** rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
- Stored in `calculation_settings` table
- Apply organization-wide
- Only admin/owner can edit
- Auto-fetched from database during quote creation

---

### Both-Level Variables (15)
**Can be set as quote default AND overridden per product**

| Variable | Russian Name | Category | Typical Default |
|----------|--------------|----------|-----------------|
| currency_of_base_price | Валюта цены закупки | Financial | "USD" |
| exchange_rate_base_price_to_quote | Курс к валюте КП | Financial | (fetched from CBR API) |
| supplier_country | Страна закупки | Logistics | "Турция" |
| supplier_discount | Скидка поставщика (%) | Financial | 0% |
| customs_code | Код ТН ВЭД | Product Info | "" |
| import_tariff | Пошлина (%) | Taxes | 0% |
| excise_tax | Акциз | Taxes | 0 |
| markup | Наценка (%) | Financial | 10% |
| delivery_time | Срок поставки | Logistics | 60 days |
| advance_to_supplier | Аванс поставщику (%) | Payments | 30% |
| logistics_supplier_hub | Логистика Поставщик-Турция | Logistics | 0 |
| logistics_hub_customs | Логистика Турция-РФ | Logistics | 0 |
| logistics_customs_client | Логистика Таможня-Клиент | Logistics | 0 |
| brokerage_hub | Брокерские Турция | Clearance | 0 |
| brokerage_customs | Брокерские РФ | Clearance | 0 |
| warehousing_at_customs | Расходы на СВХ | Clearance | 0 |
| customs_documentation | Разрешительные документы | Clearance | 0 |
| brokerage_extra | Прочее | Clearance | 0 |

**Use Case:** Set quote default (e.g., markup=10%), override for special products (e.g., markup=15% for product X)

**UI Location:** Quote defaults in collapsible cards, overrides in ag-Grid "Переопределяемые параметры" column group

---

## Validation Rules

### Required Fields (10)

**Quote-level required (4):**
```python
REQUIRED_QUOTE_FIELDS = [
    "currency_of_quote",          # e.g., "RUB"
    "seller_company",             # e.g., "МАСТЕР БЭРИНГ ООО"
    "offer_sale_type",           # e.g., "поставка"
    "offer_incoterms"            # e.g., "EXW"
]
```

**Product-level required (6):**
```python
REQUIRED_PRODUCT_FIELDS = [
    "sku",                       # Product identifier
    "brand",                     # Manufacturer
    "base_price_VAT",            # Purchase price (Decimal > 0)
    "quantity",                  # Order quantity (int > 0)
    "currency_of_base_price",    # e.g., "USD" (after two-tier resolution)
    "exchange_rate_base_price_to_quote"  # e.g., 90.5 (after two-tier resolution)
]
```

**Validation Code Pattern:**
```python
def validate_required_fields(quote_data, products_data):
    """Validate all required fields present and non-empty"""
    errors = []

    # Quote-level
    for field in REQUIRED_QUOTE_FIELDS:
        if not quote_data.get(field):
            errors.append(f"Quote field '{field}' is required")

    # Product-level (check each product)
    for idx, product in enumerate(products_data):
        for field in REQUIRED_PRODUCT_FIELDS:
            # Resolve two-tier value
            value = get_value(product, quote_data, field)
            if not value:
                errors.append(f"Product {idx+1}: '{field}' is required")

    return errors
```

**Real Bug:** BUG-007 - Missing validation for 4 critical fields (Session 33, FIXED)

---

### Business Rules (4)

#### Rule 1: Advance Payments Sum ≤ 100%
```python
def validate_advance_payments(quote_data):
    """Total advance payments cannot exceed 100%"""
    total_advance = (
        quote_data.get("advance_from_client", 0) +
        quote_data.get("advance_on_loading", 0) +
        quote_data.get("advance_on_going_to_country_destination", 0) +
        quote_data.get("advance_on_customs_clearance", 0)
    )

    if total_advance > 100:
        return f"Total advance payments ({total_advance}%) cannot exceed 100%"
    return None
```

#### Rule 2: Delivery Days > 0
```python
def validate_delivery_days(product, quote_data):
    """Delivery time must be positive"""
    delivery_days = get_value(product, quote_data, "delivery_time")

    if delivery_days <= 0:
        return "Delivery time must be greater than 0"
    return None
```

#### Rule 3: Quantity > 0
```python
def validate_quantity(product):
    """Quantity must be positive integer"""
    quantity = product.get("quantity")

    if not quantity or quantity <= 0:
        return "Quantity must be greater than 0"
    return None
```

#### Rule 4: Valid Currency Code
```python
VALID_CURRENCIES = ["RUB", "USD", "EUR", "CNY", "TRY", "AED"]

def validate_currency(currency_code):
    """Currency must be in supported list"""
    if currency_code not in VALID_CURRENCIES:
        return f"Currency '{currency_code}' not supported. Valid: {VALID_CURRENCIES}"
    return None
```

**Validation Strategy:** Run ALL validations, return ALL errors at once (not just first error)

```python
def validate_calculation_input(quote_data, products_data):
    """Run all validations, return complete error list"""
    all_errors = []

    # Required fields
    all_errors.extend(validate_required_fields(quote_data, products_data))

    # Business rules
    error = validate_advance_payments(quote_data)
    if error:
        all_errors.append(error)

    for idx, product in enumerate(products_data):
        error = validate_delivery_days(product, quote_data)
        if error:
            all_errors.append(f"Product {idx+1}: {error}")

        error = validate_quantity(product)
        if error:
            all_errors.append(f"Product {idx+1}: {error}")

    return all_errors if all_errors else None
```

**Test Coverage:** See `backend/tests/test_quotes_calc_validation.py` (10 tests covering all rules)

---

## Mapping to Calculation Engine

### 7 Nested Pydantic Models

The 42 variables map to 7 nested models sent to calculation engine:

```python
class CalculationInput(BaseModel):
    basic: BasicInput              # 5 fields
    pricing: PricingInput          # 8 fields
    payments: PaymentsInput        # 12 fields
    logistics: LogisticsInput      # 4 fields
    fees: FeesInput               # 7 fields
    costs: CostsInput             # 3 fields
    settings: SettingsInput        # 3 admin fields
```

### Model Breakdown

#### BasicInput (5 fields)
```python
class BasicInput(BaseModel):
    sku: str
    brand: str
    quantity: int
    weight_in_kg: Decimal
    customs_code: Optional[str]
```

#### PricingInput (8 fields)
```python
class PricingInput(BaseModel):
    base_price_VAT: Decimal
    currency_of_base_price: str
    currency_of_quote: str
    exchange_rate_base_price_to_quote: Decimal
    supplier_discount: Decimal
    import_tariff: Decimal
    excise_tax: Decimal
    markup: Decimal
```

#### PaymentsInput (12 fields)
```python
class PaymentsInput(BaseModel):
    advance_from_client: Decimal
    advance_to_supplier: Decimal
    time_to_advance: int
    advance_on_loading: Decimal
    time_to_advance_loading: int
    advance_on_going_to_country_destination: Decimal
    time_to_advance_going_to_country_destination: int
    advance_on_customs_clearance: Decimal
    time_to_advance_on_customs_clearance: int
    time_to_advance_on_receiving: int
    dm_fee_type: str
    dm_fee_value: Decimal
```

#### LogisticsInput (4 fields)
```python
class LogisticsInput(BaseModel):
    supplier_country: str
    delivery_time: int
    offer_incoterms: str
    logistics_costs: Decimal  # Sum of 3 logistics fields
```

#### FeesInput (7 fields)
```python
class FeesInput(BaseModel):
    brokerage_hub: Decimal
    brokerage_customs: Decimal
    warehousing_at_customs: Decimal
    customs_documentation: Decimal
    brokerage_extra: Decimal
    util_fee: Decimal
    offer_sale_type: str
```

#### CostsInput (3 fields)
```python
class CostsInput(BaseModel):
    logistics_supplier_hub: Decimal
    logistics_hub_customs: Decimal
    logistics_customs_client: Decimal
```

#### SettingsInput (3 admin fields)
```python
class SettingsInput(BaseModel):
    rate_forex_risk: Decimal      # From calculation_settings table
    rate_fin_comm: Decimal        # From calculation_settings table
    rate_loan_interest_daily: Decimal  # From calculation_settings table
```

### Mapping Logic

**Key Function:** `map_variables_to_calculation_input()`

Location: `backend/routes/quotes_calc.py`

```python
def map_variables_to_calculation_input(quote_data, product_data, admin_settings):
    """Map 42 variables to 7 nested models"""

    # Helper to safely get Decimal
    def safe_decimal(val, default=Decimal('0')):
        if val is None or val == '':
            return default
        return Decimal(str(val))

    # Resolve two-tier values
    def get_val(field):
        return get_value(product_data, quote_data, field)

    return CalculationInput(
        basic=BasicInput(
            sku=product_data.get("sku"),
            brand=product_data.get("brand"),
            quantity=int(product_data.get("quantity", 1)),
            weight_in_kg=safe_decimal(product_data.get("weight_in_kg")),
            customs_code=get_val("customs_code")
        ),
        pricing=PricingInput(
            base_price_VAT=safe_decimal(product_data.get("base_price_VAT")),
            currency_of_base_price=get_val("currency_of_base_price"),
            currency_of_quote=quote_data.get("currency_of_quote", "RUB"),
            exchange_rate_base_price_to_quote=safe_decimal(get_val("exchange_rate_base_price_to_quote")),
            supplier_discount=safe_decimal(get_val("supplier_discount")),
            import_tariff=safe_decimal(get_val("import_tariff")),
            excise_tax=safe_decimal(get_val("excise_tax")),
            markup=safe_decimal(get_val("markup"))
        ),
        payments=PaymentsInput(
            advance_percentage=safe_decimal(get_val("advance_percentage")),
            delivery_payment_percentage=safe_decimal(get_val("delivery_payment_percentage")),
            documents_payment_percentage=safe_decimal(get_val("documents_payment_percentage")),
            days_from_advance_to_delivery=int(get_val("days_from_advance_to_delivery") or 60)
        ),
        logistics=LogisticsInput(
            margin_logistic_packaging=safe_decimal(get_val("margin_logistic_packaging")),
            margin_logistic_bank_fee=safe_decimal(get_val("margin_logistic_bank_fee")),
            margin_logistic_customs_clearance=safe_decimal(get_val("margin_logistic_customs_clearance")),
            margin_logistic_land_transport=safe_decimal(get_val("margin_logistic_land_transport")),
            margin_logistic_terminal_handling=safe_decimal(get_val("margin_logistic_terminal_handling")),
            margin_logistic_sea_freight=safe_decimal(get_val("margin_logistic_sea_freight")),
            margin_logistic_certification=safe_decimal(get_val("margin_logistic_certification"))
        ),
        # fees and costs follow the same pattern with get_val() for each field
        settings=SettingsInput(
            rate_forex_risk=safe_decimal(admin_settings.get("rate_forex_risk", 3)),
            rate_fin_comm=safe_decimal(admin_settings.get("rate_fin_comm", 2)),
            rate_loan_interest_daily=safe_decimal(admin_settings.get("rate_loan_interest_daily", 0.00069))
        )
    )
```

**Test Coverage:** See `backend/tests/test_quotes_calc_mapper.py` (13 tests covering all mappings)

---

## Calculation Flow (13 Phases)

```
Phase 1:  Input Validation
          ↓
Phase 2:  Base Price Calculation (with supplier discount)
          ↓
Phase 3:  Purchase Price (base price × quantity × exchange rate)
          ↓
Phase 4:  Logistics Costs (3 components)
          ↓
Phase 5:  Import Duties & Tariffs
          ↓
Phase 6:  Warehouse & Clearance Costs
          ↓
Phase 7:  Total Import Costs
          ↓
Phase 8:  Financing Costs (FV calculations with daily interest)
          ↓
Phase 9:  Total Costs (COGS)
          ↓
Phase 10: Markup Application
          ↓
Phase 11: Price Before VAT
          ↓
Phase 12: VAT Calculation (destination country)
          ↓
Phase 13: Final Price to Client
```

**Key Excel Mapping:**
- K16: base_price_VAT
- M16: purchase_price
- AB16: total_cost (COGS)
- AC16: markup percentage
- AD16: price_before_VAT
- AF16: final_price_with_VAT

**Flow Diagram:** See `.claude/calculation_engine_summary.md` for detailed phase descriptions

---

## Common Calculation Errors

### Error 1: Missing Required Variable

**Symptom:** Calculation fails with "KeyError" or "NoneType has no attribute"

**Root Cause:** Required field not provided or two-tier resolution returned None

**Example:**
```python
# ❌ Crashes if exchange_rate not set
price_in_quote_currency = base_price * exchange_rate_base_price_to_quote
# TypeError: unsupported operand type(s) for *: 'Decimal' and 'NoneType'
```

**Fix:**
```python
# ✅ Validate before calculation
if not exchange_rate_base_price_to_quote:
    raise ValidationError("Exchange rate is required")

price_in_quote_currency = base_price * exchange_rate_base_price_to_quote
```

**Prevention:** Run `validate_calculation_input()` before calling calculation engine

---

### Error 2: Type Mismatch (None instead of Decimal)

**Symptom:** Calculation returns 0 or NaN

**Root Cause:** Optional field defaulted to None, not Decimal('0')

**Example:**
```python
# ❌ Returns None, breaks calculations
supplier_discount = product_data.get("supplier_discount")  # None
discounted_price = base_price * (1 - supplier_discount/100)  # TypeError
```

**Fix:**
```python
# ✅ Safe default to Decimal zero
def safe_decimal(val, default=Decimal('0')):
    if val is None or val == '':
        return default
    return Decimal(str(val))

supplier_discount = safe_decimal(product_data.get("supplier_discount"))
discounted_price = base_price * (1 - supplier_discount/100)  # Works
```

**Prevention:** Use `safe_decimal()` helper for all Decimal fields

---

### Error 3: Wrong Two-Tier Order

**Symptom:** Product override ignored, always uses quote default

**Root Cause:** Forgot to call `get_value()`, directly accessed quote_data

**Example:**
```python
# ❌ Always uses quote default, ignores product override
markup = quote_data.get("markup")  # 10%
# Even if product has markup=15%, uses 10%
```

**Fix:**
```python
# ✅ Respects product override > quote default
markup = get_value(product_data, quote_data, "markup")
# Returns 15% if product overrides, else 10% from quote
```

**Prevention:** ALWAYS use `get_value()` for "Both-Level" variables (see classification above)

**Real Bug:** BUG-024 - Commission distribution bug (Session 29, FIXED)

---

## Testing Checklist

### Before Implementing New Calculation Feature

- [ ] Identify which variables are involved (product-only? quote-only? both?)
- [ ] Add validation for new required fields (if applicable)
- [ ] Use `get_value()` for both-level variables (respect two-tier)
- [ ] Use `safe_decimal()` for all Decimal fields (handle None)
- [ ] Map variables to correct Pydantic model (basic/pricing/payments/etc.)
- [ ] Write unit tests for validation rules
- [ ] Write unit tests for two-tier precedence
- [ ] Test with edge cases (empty values, zero, negative, very large numbers)

### Validation Testing Scenarios

1. **Missing required fields:** Omit each of 10 required fields, verify error message
2. **Invalid advance payments:** Set total > 100%, verify rejection
3. **Zero quantity:** Set quantity=0, verify rejection
4. **Invalid currency:** Set currency="XXX", verify rejection
5. **Two-tier precedence:** Set quote default + product override, verify override used
6. **All defaults:** Omit all overrides, verify quote defaults used
7. **Admin settings:** Verify admin fields auto-fetched from database
8. **Type safety:** Send string instead of Decimal, verify safe conversion

**Test Files:**
- `backend/tests/test_quotes_calc_validation.py` (10 tests)
- `backend/tests/test_quotes_calc_mapper.py` (13 tests)

---

## Quick Reference

### Variable Lookup

**"Is this variable required?"**
→ Check [Required Fields](#required-fields-10) section

**"Can I override this per product?"**
→ Check [42 Variables Classification](#42-variables-classification):
- Product-only (5): Cannot have quote default
- Quote-only (19): Cannot override per product
- Both-level (15): Can override per product

**"What's the default value?"**
→ Check [Both-Level Variables](#both-level-variables-15) table

**"How do I validate this?"**
→ Check [Validation Rules](#validation-rules) section

### Code Patterns

**Two-tier resolution:**
```python
value = get_value(product_data, quote_data, field_name)
```

**Safe Decimal conversion:**
```python
value = safe_decimal(raw_value, default=Decimal('0'))
```

**Validation before calculation:**
```python
errors = validate_calculation_input(quote_data, products_data)
if errors:
    return {"error": errors}
```

### Related Documentation

- **[VARIABLES.md](.claude/VARIABLES.md)** - Complete 42 variables reference with UI locations
- **[COMMON_GOTCHAS.md](.claude/COMMON_GOTCHAS.md)** - Bug patterns (includes calculation errors)
- **[backend/routes/quotes_calc.py](../backend/routes/quotes_calc.py)** - Mapper and validation implementation
- **[backend/tests/test_quotes_calc_mapper.py](../backend/tests/test_quotes_calc_mapper.py)** - Mapper tests
- **[backend/tests/test_quotes_calc_validation.py](../backend/tests/test_quotes_calc_validation.py)** - Validation tests
- **[.claude/calculation_engine_summary.md](.claude/calculation_engine_summary.md)** - 13-phase calculation flow

---

**Last Updated:** 2025-10-29 20:50 UTC
**Total Variables:** 42 (5 product-only, 19 quote-only, 15 both-level, 3 admin)
**Required Fields:** 10 (4 quote, 6 product)
**Business Rules:** 4 (advance ≤100%, delivery>0, quantity>0, valid currency)
**Maintenance:** Update when adding variables or validation rules
