# Calculation Engine Validation Rules

**Location:** Backend calculation validation logic
**Source:** `/home/novi/quotation-app-dev/.claude/CALCULATION_PATTERNS.md`
**Last Updated:** 2025-10-29

## Overview

Validation rules ensure quote data is complete and meets business requirements before calculations. The validation strategy is **collect all errors first, return all at once** (not fail on first error).

---

## Required Fields (10 Total)

### Quote-Level Required Fields (4)

Must be present and non-empty for all quotes:

```python
REQUIRED_QUOTE_FIELDS = [
    "seller_company",                    # Company name (string)
    "offer_incoterms",                  # Shipping terms (e.g., "EXW", "CIF", "DDP")
    "currency_of_quote_output",         # Quote currency (e.g., "RUB", "USD", "EUR")
    "delivery_time"                     # Days from now (int > 0)
]
```

**Validation Code:**
```python
def validate_quote_required_fields(quote_data):
    """Validate quote-level required fields"""
    errors = []

    for field in REQUIRED_QUOTE_FIELDS:
        if not quote_data.get(field):
            errors.append(f"Quote field '{field}' is required")

    return errors
```

### Product-Level Required Fields (6)

Must be present for each product in the quote:

```python
REQUIRED_PRODUCT_FIELDS = [
    "sku",                              # Product identifier (string)
    "brand",                            # Manufacturer (string)
    "base_price_VAT",                   # Purchase price (Decimal > 0)
    "quantity",                         # Order quantity (int > 0)
    "currency_of_base_price",           # Source currency (resolved via two-tier)
    "exchange_rate_base_price_to_quote" # Conversion rate (resolved via two-tier)
]
```

**Validation Code:**
```python
def validate_product_required_fields(products_data, quote_data):
    """Validate product-level required fields using two-tier resolution"""
    errors = []

    for idx, product in enumerate(products_data):
        for field in REQUIRED_PRODUCT_FIELDS:
            # Resolve via two-tier: product override > quote default > none
            value = get_value(product, quote_data, field)

            if not value:
                errors.append(f"Product {idx + 1}: '{field}' is required")

    return errors
```

**Two-Tier Resolution Helper:**
```python
def get_value(product, quote_data, field_name, fallback=None):
    """
    Get effective value: product override > quote default > fallback

    Example:
        - If product[field] is set → use it (product override)
        - Else if quote[field] is set → use it (quote default)
        - Else → use fallback (None by default)
    """
    # Check product override
    product_value = product.get(field_name)
    if product_value is not None and product_value != "":
        return product_value

    # Check quote default
    quote_value = quote_data.get(field_name)
    if quote_value is not None and quote_value != "":
        return quote_value

    # Use fallback
    return fallback
```

---

## Business Rules (4)

### Rule 1: Advance Payments ≤ 100%

Total advance payments across all stages cannot exceed 100%.

```python
def validate_advance_payments(quote_data):
    """Validate total advance payments do not exceed 100%"""
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

**Error Format (Russian):**
```
"Сумма авансов ({total}%) не может превышать 100%"
```

### Rule 2: Delivery Days > 0

Delivery time must be a positive number (cannot be zero or negative).

```python
def validate_delivery_days(product, quote_data):
    """Validate delivery time is positive"""
    delivery_days = get_value(product, quote_data, "delivery_time")

    if not delivery_days or int(delivery_days) <= 0:
        return "Delivery time must be greater than 0 days"

    return None
```

**Error Format (Russian):**
```
"Время доставки должно быть больше 0 дней"
```

### Rule 3: Quantity > 0

Product quantity must be a positive integer.

```python
def validate_quantity(product):
    """Validate product quantity is positive"""
    quantity = product.get("quantity")

    if not quantity or int(quantity) <= 0:
        return "Quantity must be greater than 0"

    return None
```

**Error Format (Russian):**
```
"Количество должно быть больше 0"
```

### Rule 4: Valid Currency Code

Currency code must be in the supported currencies list.

```python
VALID_CURRENCIES = ["RUB", "USD", "EUR", "CNY", "TRY", "AED"]

def validate_currency(currency_code):
    """Validate currency is supported"""
    if currency_code not in VALID_CURRENCIES:
        return (
            f"Currency '{currency_code}' not supported. "
            f"Valid options: {', '.join(VALID_CURRENCIES)}"
        )

    return None
```

**Error Format (Russian):**
```
"Валюта '{code}' не поддерживается. Поддерживаемые: RUB, USD, EUR, CNY, TRY, AED"
```

---

## Validation Strategy: Collect All Errors

**Key principle:** Run ALL validations and return ALL errors at once, not just the first error. This gives users complete feedback.

```python
def validate_calculation_input(quote_data, products_data):
    """
    Run all validations and return complete error list.

    Returns:
        list: All validation errors found (empty list = valid)
        None: No errors (backward compatibility)
    """
    all_errors = []

    # 1. Required fields validation
    all_errors.extend(validate_quote_required_fields(quote_data))
    all_errors.extend(validate_product_required_fields(products_data, quote_data))

    # 2. Quote-level business rules
    advance_error = validate_advance_payments(quote_data)
    if advance_error:
        all_errors.append(advance_error)

    # 3. Product-level business rules
    for idx, product in enumerate(products_data):
        delivery_error = validate_delivery_days(product, quote_data)
        if delivery_error:
            all_errors.append(f"Product {idx + 1}: {delivery_error}")

        quantity_error = validate_quantity(product)
        if quantity_error:
            all_errors.append(f"Product {idx + 1}: {quantity_error}")

        # Validate currency if present
        currency = get_value(product, quote_data, "currency_of_base_price")
        if currency:
            currency_error = validate_currency(currency)
            if currency_error:
                all_errors.append(f"Product {idx + 1}: {currency_error}")

    # Return errors or None for backward compatibility
    return all_errors if all_errors else None
```

---

## Error Message Format

### Structure
```python
{
    "status": "validation_error",
    "message": "Validation failed",
    "errors": [
        "Quote field 'seller_company' is required",
        "Product 1: 'sku' is required",
        "Product 1: Quantity must be greater than 0",
        "Total advance payments (105%) cannot exceed 100%"
    ]
}
```

### HTTP Response (FastAPI)
```python
from fastapi import HTTPException, status

if errors:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "message": "Validation failed",
            "errors": errors
        }
    )
```

### Error Prefixing Convention

- **Quote-level errors:** No prefix
  - `"Quote field 'seller_company' is required"`
- **Product-level errors:** Prefix with `"Product {idx + 1}: "`
  - `"Product 1: Quantity must be greater than 0"`
  - `"Product 2: SKU is required"`

---

## Implementation Checklist

When implementing validation in a route:

- [ ] Import validation functions from `routes/quotes_calc.py`
- [ ] Call `validate_calculation_input(quote_data, products_data)`
- [ ] Check if errors list is not empty
- [ ] Return 422 (Unprocessable Entity) with error details
- [ ] Include all errors in response (not just first)
- [ ] Use proper error prefixing (quote vs product)
- [ ] Test with edge cases (empty fields, negative numbers, invalid currencies)

---

## Test Coverage

**File:** `backend/tests/test_quotes_calc_validation.py`

**10 test cases covering:**
1. Missing required quote fields (seller_company, offer_incoterms, currency_of_quote_output, delivery_time)
2. Missing required product fields (sku, brand, base_price_VAT, quantity, currency_of_base_price, exchange_rate)
3. Advance payments > 100%
4. Delivery days ≤ 0
5. Quantity ≤ 0
6. Invalid currency codes
7. Two-tier field resolution (product override vs quote default)
8. Multiple errors returned together
9. Valid data passes all validations
10. Edge cases (zero values, empty strings, None values)

**Run tests:**
```bash
cd backend
pytest tests/test_quotes_calc_validation.py -v
pytest tests/test_quotes_calc_validation.py --cov=routes.quotes_calc --cov-report=term-missing
```

---

## Real Bugs Fixed

**BUG-007 (Session 33):** Missing validation for 4 critical fields
- ✅ FIXED: Added validation for `currency_of_base_price` and `exchange_rate_base_price_to_quote`
- ✅ Improved: Error messages now include product index for easier debugging
- ✅ Enhanced: Two-tier resolution tested in all edge cases

---

## Related Resources

- **Two-Tier Variable System:** `/home/novi/quotation-app-dev/.claude/VARIABLES.md`
- **Calculation Patterns:** `/home/novi/quotation-app-dev/.claude/CALCULATION_PATTERNS.md`
- **Backend Tests:** `backend/tests/test_quotes_calc_validation.py`
- **Route Implementation:** `backend/routes/quotes_calc.py`
