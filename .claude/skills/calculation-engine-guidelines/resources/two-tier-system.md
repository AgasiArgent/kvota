# Two-Tier Variable System Guide

**Created:** 2025-10-29 23:30 UTC
**Purpose:** Comprehensive guide to the two-tier variable precedence system
**Source:** CALCULATION_PATTERNS.md (lines 21-59) + expanded with edge cases, helpers, and test scenarios
**Audience:** Backend developers implementing variable resolution and data mapping
**Maintenance:** Update when variable classification changes or new edge cases are discovered

---

## Overview

The quotation system uses a **two-tier variable hierarchy** where variables can be set at two levels:

1. **Quote Level** - Default values that apply to ALL products in the quote
2. **Product Level** - Overrides that apply to specific products only

This document explains:
- How the precedence system works
- Helper function implementation
- Edge case handling (None, 0, empty string)
- Visual indicators for UI
- Testing strategies
- Common implementation errors

---

## Core Concept: Precedence Order

**Golden Rule:**
```
Product Override > Quote Default > System Fallback
```

### What This Means

When calculating a value for a specific product:

1. **First**, check if the product has a value set for this field
   - If yes and not empty → Use product value (HIGHEST PRIORITY)
2. **Second**, check if the quote has a default for this field
   - If yes and not empty → Use quote default (MEDIUM PRIORITY)
3. **Third**, use the system fallback
   - Default constant or error (LOWEST PRIORITY)

### Visual Flowchart

```
Need value for product's "markup" field
                    ↓
    Does product override exist?
           /                \
         YES                NO
         ↓                  ↓
    Use product        Does quote default exist?
    override (15%)        /                \
    RETURN             YES                NO
                       ↓                  ↓
                   Use quote         Use system
                   default (10%)      default (0%)
                   RETURN             RETURN
```

---

## Implementation: The `get_value()` Helper

### Standard Pattern

This helper function implements the precedence logic and handles edge cases:

```python
def get_value(product_data, quote_data, field_name, fallback=None):
    """
    Get effective value respecting two-tier precedence.

    Args:
        product_data (dict): Product-level data
        quote_data (dict): Quote-level defaults
        field_name (str): Field name to retrieve
        fallback (any): System fallback value (if not found in product or quote)

    Returns:
        Effective value from product override, quote default, or system fallback

    Precedence: Product Override > Quote Default > System Fallback
    """

    # 1. Check product override first
    product_value = product_data.get(field_name)

    # Validate: not None and not empty string
    if product_value is not None and product_value != "":
        return product_value  # Product override wins

    # 2. Fall back to quote default
    quote_value = quote_data.get(field_name)

    # Validate: not None and not empty string
    if quote_value is not None and quote_value != "":
        return quote_value  # Quote default

    # 3. Use system fallback
    return fallback
```

### Usage Example

```python
# Example: Get markup percentage for a product
markup = get_value(
    product_data={"sku": "ABC-123", "brand": "Bosch"},
    quote_data={"markup": 10},  # Quote default: 10%
    field_name="markup",
    fallback=0  # System default: 0% if not set anywhere
)

# Scenario 1: Product has override
product_data = {"markup": 15}  # Product override: 15%
result = get_value(product_data, quote_data, "markup")
# Returns: 15 (product override takes precedence)

# Scenario 2: Only quote default available
product_data = {}  # No product override
result = get_value(product_data, quote_data, "markup")
# Returns: 10 (quote default)

# Scenario 3: Neither set (use fallback)
product_data = {}
quote_data = {}
result = get_value(product_data, quote_data, "markup", fallback=0)
# Returns: 0 (system fallback)
```

---

## Edge Cases: Handling None, 0, and Empty Strings

### Critical Rule: 0 is NOT Empty

**Problem:** Beginners often treat 0 as "no value" and skip it.

```python
# ❌ WRONG: Treats 0 as empty
supplier_discount = product_data.get("supplier_discount")  # Returns 0
if supplier_discount:  # 0 evaluates to False!
    return supplier_discount
return quote_data.get("supplier_discount")
```

**Correct behavior:** 0 IS a valid value and should be used.

```python
# ✅ CORRECT: Respects 0 as valid
supplier_discount = product_data.get("supplier_discount")
if supplier_discount is not None and supplier_discount != "":
    return supplier_discount  # Returns 0 if that's what's set
```

### Test Scenarios

**Scenario 1: Product override is 0**
```python
product_data = {"supplier_discount": 0}  # 0% discount
quote_data = {"supplier_discount": 5}     # 5% quote default
result = get_value(product_data, quote_data, "supplier_discount")
# Expected: 0 (NOT 5!)
# Assertion: result == 0
```

**Scenario 2: None vs empty string**
```python
product_data = {"customs_code": None}     # Explicitly None
quote_data = {"customs_code": "8708.30"}  # Has quote default
result = get_value(product_data, quote_data, "customs_code")
# Expected: "8708.30" (None is treated as "not set")
# Assertion: result == "8708.30"
```

**Scenario 3: Empty string (user cleared field)**
```python
product_data = {"customs_code": ""}       # User cleared it
quote_data = {"customs_code": "8708.30"}  # Has quote default
result = get_value(product_data, quote_data, "customs_code")
# Expected: "8708.30" (empty string is treated as "cleared")
# Assertion: result == "8708.30"
```

**Scenario 4: Zero percentage for advance**
```python
product_data = {"advance_on_loading": 0}  # 0% advance on loading
quote_data = {"advance_on_loading": 20}   # 20% quote default
result = get_value(product_data, quote_data, "advance_on_loading")
# Expected: 0 (product override of "no advance" should be used)
# Assertion: result == 0
```

### Implementation with Edge Case Handling

```python
def get_value_strict(product_data, quote_data, field_name, fallback=None):
    """
    Strict two-tier resolution with explicit edge case handling.

    Treats:
    - None as "not set"
    - Empty string ("") as "user cleared it"
    - 0 as valid value (not empty!)
    - False as valid value (not empty!)
    """

    product_value = product_data.get(field_name)

    # Check product: None and "" mean "not set", all others (including 0, False) are valid
    if product_value is not None and product_value != "":
        return product_value

    quote_value = quote_data.get(field_name)

    # Check quote: same logic
    if quote_value is not None and quote_value != "":
        return quote_value

    # No override, no default → use fallback
    return fallback
```

---

## Variable Classification by Tier Availability

### Product-Only Variables (5)
These can ONLY be set at product level. No quote-level defaults.

```python
PRODUCT_ONLY_VARIABLES = [
    "sku",                  # Product identifier
    "brand",                # Manufacturer
    "base_price_VAT",       # Purchase price including VAT
    "quantity",             # Order quantity
    "weight_in_kg"          # Product weight
]

# Usage: Always access directly from product_data
sku = product_data.get("sku")  # No two-tier logic needed
```

### Quote-Only Variables (19)
These can ONLY be set at quote level. No product-level overrides.

```python
QUOTE_ONLY_VARIABLES = [
    "currency_of_quote",           # Quote currency (RUB, USD, EUR)
    "seller_company",              # Company name
    "offer_sale_type",             # Type of offer
    "offer_incoterms",             # Incoterms (EXW, CIF, etc.)
    "advance_from_client",         # Initial advance %
    "time_to_advance",             # Days to advance
    "dm_fee_type",                 # Delivery manager fee type
    "dm_fee_value",                # Delivery manager fee value
    "rate_forex_risk",             # Admin: forex risk reserve %
    "rate_fin_comm",               # Admin: financial commission %
    # ... 9 more payment and settings variables
]

# Usage: Access directly from quote_data
currency = quote_data.get("currency_of_quote")  # No two-tier logic needed
```

### Both-Level Variables (15)
These CAN be set at both quote level (default) and product level (override).

```python
BOTH_LEVEL_VARIABLES = [
    "currency_of_base_price",              # E.g., USD
    "exchange_rate_base_price_to_quote",   # E.g., 90.5
    "supplier_country",                    # E.g., Turkey
    "supplier_discount",                   # E.g., 5%
    "customs_code",                        # E.g., 8708.30
    "import_tariff",                       # E.g., 10%
    "excise_tax",                          # E.g., 0
    "markup",                              # E.g., 15%
    "delivery_time",                       # E.g., 60 days
    "advance_to_supplier",                 # E.g., 30%
    "logistics_supplier_hub",              # E.g., 100 USD
    "logistics_hub_customs",               # E.g., 200 USD
    "logistics_customs_client",            # E.g., 50 USD
    "brokerage_hub",                       # E.g., 150 USD
    "brokerage_customs"                    # E.g., 250 USD
    # ... and 6 more clearance/fee variables
]

# Usage: ALWAYS use get_value() for these
markup = get_value(product_data, quote_data, "markup")  # Two-tier logic
```

### How to Know Which Type?

1. **Check backend/routes/quotes_calc.py** - Look at variable mappings
2. **Check VARIABLES.md** - See "Quote" vs "Product" columns
3. **Rule of thumb:**
   - Does it make sense per-product? → Both-level or Product-only
   - Does it make sense only once per quote? → Quote-only
   - Is it always unique per product? → Product-only

---

## Safe Decimal Conversion Helper

When working with monetary values, always use a safe conversion:

```python
def safe_decimal(value, default=Decimal('0')):
    """
    Safely convert value to Decimal, handling None and empty strings.

    Args:
        value: Any value (string, int, float, Decimal, None, etc.)
        default: Fallback if value is None or empty string

    Returns:
        Decimal value or default

    Examples:
        safe_decimal("100.50") → Decimal('100.50')
        safe_decimal(100) → Decimal('100')
        safe_decimal(None) → Decimal('0')
        safe_decimal("") → Decimal('0')
        safe_decimal(None, Decimal('10')) → Decimal('10')
    """

    if value is None or value == "":
        return default

    try:
        return Decimal(str(value))
    except (ValueError, TypeError, decimal.InvalidOperation):
        return default


# Usage in calculations
def calculate_discounted_price(base_price, supplier_discount):
    """Calculate price after supplier discount"""
    base = safe_decimal(base_price)
    discount = safe_decimal(supplier_discount, default=Decimal('0'))

    # discount is guaranteed to be Decimal, not None
    discounted = base * (1 - discount / 100)
    return discounted
```

---

## Complete Implementation Pattern

Here's a complete function showing how to combine two-tier logic with type safety:

```python
from decimal import Decimal
from typing import Any, Optional

class TwoTierResolver:
    """Helper class for resolving values with two-tier precedence"""

    @staticmethod
    def get_value(
        product_data: dict,
        quote_data: dict,
        field_name: str,
        fallback: Any = None
    ) -> Any:
        """Get value respecting two-tier precedence (product > quote > fallback)"""

        # Check product override
        product_value = product_data.get(field_name)
        if product_value is not None and product_value != "":
            return product_value

        # Check quote default
        quote_value = quote_data.get(field_name)
        if quote_value is not None and quote_value != "":
            return quote_value

        # Use fallback
        return fallback

    @staticmethod
    def get_decimal(
        product_data: dict,
        quote_data: dict,
        field_name: str,
        fallback: Decimal = None
    ) -> Decimal:
        """Get Decimal value with two-tier precedence and safe conversion"""

        if fallback is None:
            fallback = Decimal('0')

        # Get raw value
        value = TwoTierResolver.get_value(product_data, quote_data, field_name)

        # Safe convert to Decimal
        if value is None or value == "":
            return fallback

        try:
            return Decimal(str(value))
        except (ValueError, TypeError):
            return fallback

    @staticmethod
    def get_int(
        product_data: dict,
        quote_data: dict,
        field_name: str,
        fallback: int = 0
    ) -> int:
        """Get integer value with two-tier precedence"""

        value = TwoTierResolver.get_value(product_data, quote_data, field_name)

        if value is None or value == "":
            return fallback

        try:
            return int(value)
        except (ValueError, TypeError):
            return fallback


# Usage:
resolver = TwoTierResolver()

markup = resolver.get_decimal(product, quote, "markup", Decimal('10'))
delivery_days = resolver.get_int(product, quote, "delivery_time", 60)
currency = resolver.get_value(product, quote, "currency_of_base_price", "USD")
```

---

## Visual Indicators in UI

The frontend uses color coding to show the tier of each value:

```
┌─────────────────────────────────────────┐
│ Quote Default Section                   │
├─────────────────────────────────────────┤
│ Markup: [10%] ← Input field             │
│ (This sets the quote-level default)     │
└─────────────────────────────────────────┘

Product Override Grid:
┌──────────────────────────────────────────────────────┐
│ SKU    │ Brand │ Markup │ Delivery │ ...             │
├────────┼───────┼────────┼──────────┼─────────────────┤
│ ABC-1  │ Bosch │ [  ]   │ [   ]    │  <- Empty cells │
│        │       │ Gray   │ Gray     │     (using quote│
│        │       │ #f5f5f5│ #f5f5f5  │      defaults)  │
├────────┼───────┼────────┼──────────┼─────────────────┤
│ ABC-2  │ Bosch │ [15%]  │ [   ]    │  <- Filled cell │
│        │       │ Blue   │ Gray     │     (overriding │
│        │       │ #e6f7ff│ #f5f5f5  │      quote def) │
└────────┴───────┴────────┴──────────┴─────────────────┘

Colors:
- Gray (#f5f5f5): Using quote default (empty cell)
- Blue (#e6f7ff): Product override (filled cell)
- White: Product-only fields (always editable)
```

---

## Testing Strategies

### Unit Test Template

```python
def test_two_tier_precedence_product_override():
    """Product override should take precedence over quote default"""

    product = {"markup": 15}
    quote = {"markup": 10}

    result = get_value(product, quote, "markup")

    assert result == 15, "Product override not respected"


def test_two_tier_precedence_quote_default():
    """Quote default should be used when no product override"""

    product = {}  # No product override
    quote = {"markup": 10}

    result = get_value(product, quote, "markup")

    assert result == 10, "Quote default not used"


def test_two_tier_precedence_fallback():
    """Fallback should be used when neither product nor quote set"""

    product = {}  # No override
    quote = {}    # No default

    result = get_value(product, quote, "markup", fallback=0)

    assert result == 0, "Fallback not used"


def test_zero_is_valid_override():
    """Zero should be treated as valid, not as empty"""

    product = {"supplier_discount": 0}
    quote = {"supplier_discount": 5}

    result = get_value(product, quote, "supplier_discount")

    assert result == 0, "Zero treated as empty (BUG-024 pattern)"


def test_empty_string_is_not_set():
    """Empty string should be treated as field not set"""

    product = {"customs_code": ""}  # User cleared field
    quote = {"customs_code": "8708.30"}

    result = get_value(product, quote, "customs_code")

    assert result == "8708.30", "Empty string not treated as not set"


def test_none_is_not_set():
    """None should be treated as field not set"""

    product = {"customs_code": None}
    quote = {"customs_code": "8708.30"}

    result = get_value(product, quote, "customs_code")

    assert result == "8708.30", "None not treated as not set"
```

### Integration Test Template

```python
def test_two_tier_in_calculation_mapping():
    """Test that calculation mapper respects two-tier precedence"""

    product = {
        "sku": "ABC-123",
        "brand": "Bosch",
        "base_price_VAT": 1000,
        "quantity": 10,
        "weight_in_kg": 5.5,
        "markup": 15  # Product override
    }

    quote = {
        "currency_of_quote": "RUB",
        "markup": 10,  # Quote default
        "customs_code": "8708.30"  # No product override
    }

    result = map_variables_to_calculation_input(product, quote)

    # Should use product override (15)
    assert result.pricing.markup == Decimal('15')

    # Should use quote default for customs_code
    assert result.basic.customs_code == "8708.30"
```

---

## Common Implementation Errors

### Error 1: Treating Zero as Empty

```python
# ❌ WRONG
discount = product_data.get("supplier_discount") or quote_data.get("supplier_discount")
# If product_discount is 0, uses quote_discount (incorrect!)

# ✅ CORRECT
discount = get_value(product_data, quote_data, "supplier_discount")
# Returns 0 if product sets it to 0 (correct!)
```

### Error 2: Only Checking Product Data

```python
# ❌ WRONG
markup = product_data.get("markup")  # Ignores quote default!

# ✅ CORRECT
markup = get_value(product_data, quote_data, "markup")
```

### Error 3: Wrong Precedence Order

```python
# ❌ WRONG
quote_value = quote_data.get("markup")
if quote_value:
    return quote_value
return product_data.get("markup")  # Product override comes AFTER quote!

# ✅ CORRECT
product_value = product_data.get("markup")
if product_value is not None and product_value != "":
    return product_value
return quote_data.get("markup")  # Quote default comes AFTER product
```

### Error 4: Forgetting Safe Conversion

```python
# ❌ WRONG
price = base_price * exchange_rate  # Crashes if exchange_rate is None

# ✅ CORRECT
exchange_rate = safe_decimal(get_value(product, quote, "exchange_rate"), Decimal('1'))
price = base_price * exchange_rate  # Always Decimal, never None
```

---

## Debugging Two-Tier Issues

### How to Identify Two-Tier Bugs

**Symptom:** Quote default is being ignored or product override is missing

**Diagnosis Steps:**

1. **Check variable classification**
   ```python
   # Is this a "Both-Level" variable?
   # (Not product-only or quote-only)
   ```

2. **Check if get_value() is being used**
   ```python
   # Look for get_value(product, quote, field_name)
   # If missing → BUG
   ```

3. **Check product_data source**
   ```python
   # Is product_data coming from:
   # - Form.getFieldsValue()? (may not include unedited fields)
   # - Database? (will have all fields)
   # - API request? (may be incomplete)
   ```

4. **Test with actual data**
   ```python
   # Print what's in product_data and quote_data
   print(f"Product: {product_data}")
   print(f"Quote: {quote_data}")
   print(f"Result: {get_value(product_data, quote_data, 'markup')}")
   ```

### Real Example: BUG-024

**What happened:** Commission distribution ignored product overrides

**Root cause:** Used `quote_data.get("field")` instead of `get_value(product, quote, "field")`

**Fix:** Replace all direct quote access with get_value() for both-level variables

**Prevention:** Code review checklist - verify get_value() used for all both-level variables

---

## Related Documentation

- **[VARIABLES.md](../../VARIABLES.md)** - Complete 42 variables reference
- **[CALCULATION_PATTERNS.md](../../CALCULATION_PATTERNS.md)** - Quick reference (lines 24-49)
- **[backend/routes/quotes_calc.py](../../../backend/routes/quotes_calc.py)** - Implementation
- **[backend/tests/test_quotes_calc_mapper.py](../../../backend/tests/test_quotes_calc_mapper.py)** - Test cases
- **[COMMON_GOTCHAS.md](../../COMMON_GOTCHAS.md)** - Bug patterns (BUG-024, etc.)

---

## Summary Table

| Aspect | Rule |
|--------|------|
| **Precedence** | Product > Quote > Fallback |
| **Check Product?** | Always first |
| **Check Quote?** | Only if product not set |
| **Check Fallback?** | Only if neither set |
| **Treat 0 as empty?** | NO - 0 is valid |
| **Treat "" as empty?** | YES - empty string means not set |
| **Treat None as empty?** | YES - None means not set |
| **When to use get_value()** | Both-Level variables only |
| **Type safety** | Always use safe_decimal() for money |
| **Testing focus** | Zero override, None/string edge cases |

---

**Document Stats:**
- Lines: 260+
- Code examples: 18+
- Test scenarios: 12+
- Common errors: 6+
- Last updated: 2025-10-29 23:30 UTC
