# Common Calculation Engine Errors

**File:** `.claude/skills/calculation-engine-guidelines/resources/common-errors.md`
**Created:** 2025-10-29 23:30 UTC
**Purpose:** Extract and document common errors when working with the calculation engine
**Related Files:**
- `.claude/CALCULATION_PATTERNS.md` - Complete calculation patterns
- `backend/tests/test_quotes_calc_validation.py` - Validation test cases
- `backend/tests/test_quotes_calc_mapper.py` - Variable mapping test cases
- `backend/routes/quotes_calc.py` - Implementation

---

## Error 1: Missing Required Variables

**Category:** Validation Error
**Severity:** CRITICAL ❌
**Status Code:** 422 (Unprocessable Entity)

### Symptom
```
KeyError: 'seller_company'
TypeError: unsupported operand type(s) for *: 'Decimal' and 'NoneType'
```

### Root Cause
- Required field not provided in request
- Two-tier resolution (`get_value()`) returned None instead of a value
- Validation not run before calculation

### Code Example (WRONG)
```python
# ❌ Crashes if exchange_rate not set
price_in_quote_currency = base_price * exchange_rate_base_price_to_quote
# TypeError: unsupported operand type(s) for *: 'Decimal' and 'NoneType'

# ❌ Crashes if seller_company missing
price_seller = purchase_price + (purchase_price * rate_forex_risk / 100)
# Works - but breaks later in calculation when seller_region lookup fails
```

### Code Example (CORRECT)
```python
# ✅ Validate before calculation
errors = validate_calculation_input(product, variables)
if errors:
    raise ValidationError(errors)  # Return all errors at once

# ✅ Safe access with default
exchange_rate = safe_decimal(variables.get("exchange_rate_base_price_to_quote"), Decimal('1'))
if exchange_rate <= 0:
    raise ValidationError("Exchange rate must be greater than 0")

price_in_quote_currency = base_price * exchange_rate
```

### Prevention

1. **Always call `validate_calculation_input()` first:**
   ```python
   from routes.quotes_calc import validate_calculation_input

   errors = validate_calculation_input(product, variables)
   if errors:
       raise HTTPException(status_code=422, detail=errors)
   ```

2. **Required fields validation:**
   - Product level: `base_price_vat > 0`, `quantity > 0`
   - Quote level: `seller_company`, `offer_incoterms`, `currency_of_base_price`, `currency_of_quote`, `exchange_rate_base_price_to_quote`, `markup`
   - Business rule: If incoterms != "EXW", at least one logistics cost > 0

3. **Test all required field combinations:**
   ```python
   # Use test cases from test_quotes_calc_validation.py
   # Example:
   def test_missing_seller_company(self):
       product = ProductFromFile(
           product_name="Test",
           base_price_vat=100.0,
           quantity=10
       )
       variables = {
           # Missing seller_company
       }
       errors = validate_calculation_input(product, variables)
       assert len(errors) > 0
   ```

### Related Test Cases
- `test_quotes_calc_validation.py::TestValidationRequired::test_missing_seller_company`
- `test_quotes_calc_validation.py::TestValidationRequired::test_missing_markup`
- `test_quotes_calc_validation.py::TestValidationRequired::test_invalid_exchange_rate`

---

## Error 2: Type Mismatch (None vs Decimal)

**Category:** Data Type Error
**Severity:** HIGH ⚠️
**Symptom:** Incorrect calculations, division errors, or silent zeros

### Symptom
```
ZeroDivisionError: division by zero
TypeError: unsupported operand type(s) for %: 'Decimal' and 'NoneType'
Result = 0 instead of expected value
Result = NaN (Not a Number)
```

### Root Cause
- Optional field defaulted to None instead of Decimal('0')
- Forgot to use `safe_decimal()` helper
- Direct field access instead of `safe_*()` functions
- Type casting missing on Decimal fields

### Code Example (WRONG)
```python
# ❌ Returns None, breaks calculations
supplier_discount = product_data.get("supplier_discount")  # None
discounted_price = base_price * (1 - supplier_discount/100)
# TypeError: unsupported operand type(s) for /: 'NoneType' and 'int'

# ❌ Silent failure - calculation with None returns 0
vat_value = base_price * vat_rate  # None * Decimal fails
# OR if one is None, result may be unexpected

# ❌ Missing Decimal conversion
markup = "15"  # String, not Decimal
total = base_price * markup  # TypeError
```

### Code Example (CORRECT)
```python
# ✅ Safe default to Decimal zero
def safe_decimal(val, default=Decimal('0')):
    """Convert to Decimal, returning default if None/empty"""
    if val is None or val == '':
        return default
    try:
        return Decimal(str(val))
    except (ValueError, TypeError):
        return default

# ✅ Use it consistently
supplier_discount = safe_decimal(product_data.get("supplier_discount"))
discounted_price = base_price * (1 - supplier_discount/100)  # Works!

vat_value = base_decimal(base_price, Decimal('0')) * safe_decimal(vat_rate)

markup = safe_decimal(variables.get("markup"), Decimal('15'))
```

### Prevention

1. **Use safety helper functions:**
   ```python
   from routes.quotes_calc import safe_decimal, safe_str, safe_int

   # For Decimal fields (money, percentages, rates)
   amount = safe_decimal(value, Decimal('0'))

   # For string fields (codes, names)
   code = safe_str(value, "DEFAULT")

   # For integer fields (counts, days)
   days = safe_int(value, 60)
   ```

2. **Never use direct `.get()` on numeric fields:**
   ```python
   # ❌ WRONG
   discount = data.get("supplier_discount")

   # ✅ CORRECT
   discount = safe_decimal(data.get("supplier_discount"))
   ```

3. **Always convert strings to Decimal:**
   ```python
   # ❌ WRONG
   price = float(variable)  # Float loses precision!

   # ✅ CORRECT
   price = safe_decimal(variable)  # Decimal preserves precision
   ```

### Related Test Cases
- `test_quotes_calc_mapper.py::TestHelperFunctions::test_safe_decimal_valid`
- `test_quotes_calc_mapper.py::TestHelperFunctions::test_safe_decimal_invalid`
- `test_quotes_calc_mapper.py::TestMapVariables::test_mapper_defaults_applied`

---

## Error 3: Wrong Two-Tier Order (Product Override Ignored)

**Category:** Business Logic Error
**Severity:** CRITICAL ❌
**Status Code:** 200 (but returns wrong data)

### Symptom
```
Product override is ignored
Always returns quote-level default
Color coding shows Gray instead of Blue (override not detected)
```

### Root Cause
- Forgot to call `get_value()` helper
- Directly accessed `quote_data` instead of respecting product override
- Product field is empty string instead of None (not detected as "no override")

### Code Example (WRONG)
```python
# ❌ Always uses quote default, ignores product override
markup = quote_data.get("markup")  # 10%
# Even if product has markup=15%, uses 10%

# ❌ Doesn't check if product has override
supplier_country = variables.get("supplier_country")
# Even if product.supplier_country="Китай", uses quote default

# ❌ Empty string treated as valid value
weight = product.weight_in_kg or variables.get("weight_in_kg")
# If product.weight_in_kg = "", returns "" instead of quote default
```

### Code Example (CORRECT)
```python
# ✅ Respects product override > quote default > fallback
def get_value(field_name: str, product, variables, fallback=None):
    """
    Two-tier resolution:
    1. Check product override (non-empty/non-None)
    2. Check quote default
    3. Use fallback
    """
    # Check product override
    product_value = getattr(product, field_name, None)
    if product_value is not None and product_value != '':
        return product_value

    # Check quote default
    quote_value = variables.get(field_name)
    if quote_value is not None and quote_value != '':
        return quote_value

    # Use fallback
    return fallback

# ✅ Usage
markup = get_value("markup", product, variables, Decimal('10'))
# Returns: product.markup if set, else variables.markup, else 10%

supplier_country = get_value("supplier_country", product, variables, "Россия")
# Returns: product.supplier_country if set, else variables.supplier_country, else "Россия"
```

### Prevention

1. **ALWAYS use `get_value()` for "Both-Level" variables:**
   ```python
   # Both-level variables can be quote default OR product override
   # See .claude/VARIABLES.md for full classification

   # ✅ CORRECT - use get_value()
   supplier_discount = get_value(
       "supplier_discount", product, variables, Decimal('0')
   )
   ```

2. **Verify variable classification:**
   ```python
   # From VARIABLES.md:
   # - Product-only: sku, brand, base_price_VAT, quantity, weight_in_kg
   # - Both-level: supplier_discount, logistics_cost, customs_code, etc.
   # - Quote-only: seller_company, exchange_rate, etc.
   # - Admin-only: rate_forex_risk, rate_fin_comm, rate_loan_interest_daily

   # ✅ Product-only: Access directly
   sku = product.sku or "DEFAULT"

   # ✅ Both-level: Use get_value()
   discount = get_value("supplier_discount", product, variables, Decimal('0'))

   # ✅ Quote-only: Use variables directly
   exchange_rate = safe_decimal(variables.get("exchange_rate"))
   ```

3. **Test with product overrides:**
   ```python
   def test_mapper_with_product_overrides(self):
       # Product has override
       product = ProductFromFile(
           supplier_country="Китай",  # Product override
           base_price_vat=1000.0,
           quantity=10
       )
       # Quote has different value
       variables = {
           "supplier_country": "Турция",  # Quote default
           # ... other required fields
       }

       result = map_variables_to_calculation_input(product, variables, admin_settings)

       # ✅ Verify product override wins
       assert result.logistics.supplier_country.value == "Китай"
   ```

### Related Real Bugs
- **BUG-024:** Commission distribution bug (Session 29, FIXED)
  - **Cause:** Form.getFieldsValue() only returned DOM fields, missing quote defaults
  - **Fix:** Used `get_value()` to merge product overrides with quote defaults
  - **Lesson:** Always respect two-tier order when mapping form data

### Related Test Cases
- `test_quotes_calc_mapper.py::TestGetValue::test_product_override_takes_precedence`
- `test_quotes_calc_mapper.py::TestGetValue::test_quote_default_used_when_no_product_override`
- `test_quotes_calc_mapper.py::TestMapVariables::test_mapper_with_product_overrides`

---

## Error 4: Admin Settings Not Fetched

**Category:** Configuration Error
**Severity:** HIGH ⚠️
**Symptom:** Wrong financial rates applied, calculations differ from expected

### Symptom
```
Commission calculation wrong
Forex risk rate is 0 instead of 3%
Financial commission is hardcoded instead of using admin-configured rate
```

### Root Cause
- Forgot to fetch admin settings from database before mapping
- Admin settings are None/empty
- Using hardcoded rate instead of dynamic from database
- RLS policy prevents access to admin settings

### Code Example (WRONG)
```python
# ❌ Admin settings not fetched - uses defaults
admin_settings = {
    "rate_forex_risk": Decimal('0'),
    "rate_fin_comm": Decimal('0'),
    "rate_loan_interest_daily": Decimal('0')
}

result = map_variables_to_calculation_input(product, variables, admin_settings)
# All calculations use 0% rates!

# ❌ Hardcoded rate instead of database
def calculate_commission(amount):
    return amount * Decimal('0.02')  # Hardcoded 2%
    # But admin may have set it to 1.5% or 3%!
```

### Code Example (CORRECT)
```python
# ✅ Fetch admin settings from database first
async def fetch_admin_settings(org_id: str) -> dict:
    """Fetch organization's admin-only calculation settings"""
    result = supabase.table("calculation_settings") \
        .select("rate_forex_risk, rate_fin_comm, rate_loan_interest_daily") \
        .eq("organization_id", org_id) \
        .execute()

    if not result.data:
        # Default rates if not configured
        return {
            "rate_forex_risk": Decimal('3'),
            "rate_fin_comm": Decimal('2'),
            "rate_loan_interest_daily": Decimal('0.00069')
        }

    row = result.data[0]
    return {
        "rate_forex_risk": safe_decimal(row.get("rate_forex_risk"), Decimal('3')),
        "rate_fin_comm": safe_decimal(row.get("rate_fin_comm"), Decimal('2')),
        "rate_loan_interest_daily": safe_decimal(row.get("rate_loan_interest_daily"), Decimal('0.00069'))
    }

# ✅ Use fetched admin settings
@router.post("/calculate")
async def calculate_quote(product: ProductFromFile, variables: dict, user: User = Depends(get_current_user)):
    # Fetch admin settings first
    admin_settings = await fetch_admin_settings(user.org_id)

    # Then map with correct rates
    calculation_input = map_variables_to_calculation_input(
        product, variables, admin_settings
    )

    # Now calculations use correct rates
    result = calculate(calculation_input)
    return result
```

### Prevention

1. **Always fetch admin settings before mapping:**
   ```python
   # Step 1: Fetch admin settings
   admin_settings = await fetch_admin_settings(user.org_id)

   # Step 2: Map variables (which includes admin settings)
   calc_input = map_variables_to_calculation_input(product, variables, admin_settings)

   # Step 3: Calculate
   result = calculate(calc_input)
   ```

2. **Verify admin settings in tests:**
   ```python
   def test_mapper_with_admin_settings(self):
       admin_settings = {
           "rate_forex_risk": Decimal("3"),
           "rate_fin_comm": Decimal("2"),
           "rate_loan_interest_daily": Decimal("0.00069")
       }

       result = map_variables_to_calculation_input(product, variables, admin_settings)

       # ✅ Verify admin settings applied
       assert result.system.rate_forex_risk == Decimal("3")
       assert result.system.rate_fin_comm == Decimal("2")
       assert result.system.rate_loan_interest_daily == Decimal("0.00069")
   ```

3. **Use default fallbacks:**
   ```python
   # If admin settings not found, use sensible defaults
   admin_settings = {
       "rate_forex_risk": Decimal('3'),       # Default 3% forex risk
       "rate_fin_comm": Decimal('2'),         # Default 2% fin commission
       "rate_loan_interest_daily": Decimal('0.00069')  # Default daily rate
   }
   ```

### Related Database
- **Table:** `calculation_settings`
- **Columns:** `rate_forex_risk`, `rate_fin_comm`, `rate_loan_interest_daily`
- **Scope:** Organization-wide (all users in org use same rates)
- **Access:** Admin/Owner only

### Related Test Cases
- `test_quotes_calc_mapper.py::TestMapVariables::test_mapper_with_minimal_data`

---

## Error 5: Business Rule Violations

**Category:** Business Logic Error
**Severity:** CRITICAL ❌
**Status Code:** 422 (Unprocessable Entity)

### Symptom
```
Non-EXW incoterms without logistics costs
Exchange rate of 0 or negative
Negative amounts in calculations
Conflicting variable values
```

### Rule 1: Non-EXW Requires Logistics

**Rule:** If `offer_incoterms != "EXW"`, at least one logistics cost must be > 0

**Code Example (WRONG)**
```python
# ❌ DDP incoterms but zero logistics = Business Rule Violation
variables = {
    "offer_incoterms": "DDP",  # Not EXW - requires logistics
    "logistics_supplier_hub": "0",
    "logistics_hub_customs": "0",
    "logistics_customs_client": "0"  # All zero!
}
# Calculation will be wrong - DDP means delivered to client door
# But no logistics costs provided
```

**Code Example (CORRECT)**
```python
# ✅ DDP with at least one logistics cost
variables = {
    "offer_incoterms": "DDP",
    "logistics_supplier_hub": "1500.00",  # Has logistics cost
    "logistics_hub_customs": "0",
    "logistics_customs_client": "0"
}

# ✅ EXW can have zero logistics
variables = {
    "offer_incoterms": "EXW",  # EXW = Ex Works (no logistics)
    "logistics_supplier_hub": "0",
    "logistics_hub_customs": "0",
    "logistics_customs_client": "0"
}
```

### Rule 2: Exchange Rate Must Be > 0

**Rule:** `exchange_rate_base_price_to_quote` must be greater than 0

**Code Example (WRONG)**
```python
# ❌ Exchange rate of 0
variables = {
    "exchange_rate_base_price_to_quote": "0"  # Invalid!
}
# Will cause: ZeroDivisionError or wrong pricing

# ❌ Negative exchange rate
variables = {
    "exchange_rate_base_price_to_quote": "-1.5"  # Invalid!
}
```

**Code Example (CORRECT)**
```python
# ✅ Valid exchange rates
variables = {
    "exchange_rate_base_price_to_quote": "1.0",  # USD to USD
    "exchange_rate_base_price_to_quote": "95.5",  # USD to RUB
    "exchange_rate_base_price_to_quote": "0.85"  # USD to EUR
}
```

### Rule 3: Amounts Must Be Positive

**Rule:** Prices, quantities, and costs must be > 0

**Code Example (WRONG)**
```python
# ❌ Zero or negative base price
product = ProductFromFile(
    base_price_vat=0,  # Invalid!
    quantity=10
)

# ❌ Zero or negative quantity
product = ProductFromFile(
    base_price_vat=100.0,
    quantity=0  # Invalid!
)
```

**Code Example (CORRECT)**
```python
# ✅ Valid amounts
product = ProductFromFile(
    base_price_vat=1000.0,  # > 0
    quantity=10  # > 0
)
```

### Prevention

1. **Validate business rules in `validate_calculation_input()`:**
   ```python
   from routes.quotes_calc import validate_calculation_input

   errors = validate_calculation_input(product, variables)
   if errors:
       # errors = [
       #   "Инкотермс DDP требует хотя бы одной логистической стоимости > 0",
       #   "Курс к валюте КП должен быть больше нуля"
       # ]
       raise HTTPException(status_code=422, detail=errors)
   ```

2. **Test all business rule scenarios:**
   ```python
   # Test case 1: Non-EXW requires logistics
   def test_non_exw_requires_logistics_cost(self):
       product = ProductFromFile(
           product_name="Test",
           base_price_vat=100.0,
           quantity=10,
           supplier_country="Турция"
       )
       variables = {
           "seller_company": "МАСТЕР БЭРИНГ ООО",
           "offer_incoterms": "DDP",  # Not EXW
           # All logistics costs are 0 or missing
           "logistics_supplier_hub": "0",
           "logistics_hub_customs": "0",
           "logistics_customs_client": "0"
       }

       errors = validate_calculation_input(product, variables)
       assert len(errors) > 0
       assert any("логистическая" in err.lower() for err in errors)

   # Test case 2: EXW allows zero logistics
   def test_exw_allows_zero_logistics_costs(self):
       variables = {
           "offer_incoterms": "EXW",  # EXW allows zero
           "logistics_supplier_hub": "0",
           "logistics_hub_customs": "0",
           "logistics_customs_client": "0"
       }
       errors = validate_calculation_input(product, variables)
       assert not any("логистическая" in err.lower() for err in errors)

   # Test case 3: Non-EXW passes with at least one logistics
   def test_non_exw_passes_with_one_logistics_cost(self):
       variables = {
           "offer_incoterms": "DDP",
           "logistics_supplier_hub": "1500.00",  # Has cost!
           "logistics_hub_customs": "0",
           "logistics_customs_client": "0"
       }
       errors = validate_calculation_input(product, variables)
       assert not any("логистическая" in err.lower() for err in errors)
   ```

### Related Test Cases
- `test_quotes_calc_validation.py::TestBusinessRules::test_non_exw_requires_logistics_cost`
- `test_quotes_calc_validation.py::TestBusinessRules::test_non_exw_passes_with_at_least_one_logistics_cost`
- `test_quotes_calc_validation.py::TestBusinessRules::test_exw_allows_zero_logistics_costs`

---

## Real Bugs Found and Fixed

### BUG-007: Incomplete Quote Validation (Session 33) ✅ FIXED

**Issue:** 4 critical fields not validated before calculation

**Fields Missing Validation:**
1. `seller_company` - Required for region lookup
2. `currency_of_base_price` - Required for exchange rate
3. `currency_of_quote` - Required for final pricing
4. `exchange_rate_base_price_to_quote` - Required for conversion

**Symptom:** Calculation proceeds with None values, crashes mid-calculation

**Fix:** Added comprehensive validation in `validate_calculation_input()`

**Lesson:** Always validate ALL required fields before calculations start

---

### BUG-024: Commission Distribution Bug (Session 29) ✅ FIXED

**Issue:** Product overrides ignored, always used quote defaults

**Root Cause:** `Form.getFieldsValue()` only returned form DOM fields, missing unmodified quote defaults

**Code That Failed:**
```python
# ❌ Missing product overrides and quote defaults
form_data = form.getFieldsValue()  # Only returns DOM fields!
mapping = map_variables_to_calculation_input(product, form_data, admin_settings)
# Missing override + quote default merge!
```

**Fix:** Merge form data with product fields using `get_value()`:
```python
# ✅ Respects two-tier order
merged_variables = {
    **quote_defaults,  # Start with quote defaults
    **form_data,       # Add form changes
}
mapping = map_variables_to_calculation_input(product, merged_variables, admin_settings)
```

**Lesson:** Two-tier logic requires explicit merging of product overrides with quote defaults

---

## Quick Error Checklist

When calculations fail, check in this order:

- [ ] **Error 1:** Required fields present? Call `validate_calculation_input()`
- [ ] **Error 2:** All values are Decimal, not None? Use `safe_decimal()`
- [ ] **Error 3:** Product overrides respected? Use `get_value()`
- [ ] **Error 4:** Admin settings fetched? Call `fetch_admin_settings()`
- [ ] **Error 5:** Business rules satisfied? Check validation errors

### Running Tests

```bash
cd /home/novi/quotation-app-dev/backend

# Run validation tests
pytest tests/test_quotes_calc_validation.py -v

# Run mapper tests
pytest tests/test_quotes_calc_mapper.py -v

# Run all calculation tests
pytest tests/ -k "quotes_calc" -v

# With coverage
pytest tests/test_quotes_calc_*.py --cov=routes.quotes_calc --cov-report=term-missing
```

---

## References

- **Implementation:** `/home/novi/quotation-app-dev/backend/routes/quotes_calc.py`
- **Tests:** `/home/novi/quotation-app-dev/backend/tests/test_quotes_calc_*.py`
- **Patterns:** `.claude/CALCULATION_PATTERNS.md`
- **Variables:** `.claude/VARIABLES.md`

---

**Last Updated:** 2025-10-29 23:30 UTC
