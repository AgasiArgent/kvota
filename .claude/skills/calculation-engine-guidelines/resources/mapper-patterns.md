# Mapper Patterns - Variable to Calculation Input

**Last Updated:** 2025-10-29

**Source:** `backend/routes/quotes_calc.py` (lines 199-365)

**Purpose:** Transform flat variables dictionary + product data into nested Pydantic calculation models

---

## Overview

The mapper system implements a **two-tier variable resolution strategy**:

1. **Product-level overrides** - Product-specific values (highest priority)
2. **Quote-level defaults** - Quote-wide fallback values (medium priority)
3. **System fallbacks** - Hardcoded defaults (lowest priority)

This allows flexibility: users can set defaults for all products, then override specific fields per product.

---

## Helper Functions

### safe_decimal()

Convert any value to `Decimal` with fallback.

```python
def safe_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    """
    Safely convert value to Decimal for financial calculations.

    Args:
        value: Value to convert (int, float, str, Decimal, None, empty string)
        default: Fallback decimal if conversion fails (default: 0)

    Returns:
        Decimal: Converted value or default

    Raises:
        No exceptions - always returns a valid Decimal
    """
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))  # IMPORTANT: Convert through str() first!
    except (ValueError, TypeError, Exception):
        return default
```

**Why convert through `str()`?**
- `Decimal(1.1)` → `Decimal('1.100000000000000088817841970012523233890533447265625')`
- `Decimal(str(1.1))` → `Decimal('1.1')`

**Examples:**
```python
safe_decimal("100.50")        # → Decimal('100.50')
safe_decimal(100)              # → Decimal('100')
safe_decimal(None)             # → Decimal('0')
safe_decimal("invalid", 5)    # → Decimal('5')
safe_decimal("", Decimal("99")) # → Decimal('99')
```

### safe_str()

Convert any value to string with fallback.

```python
def safe_str(value: Any, default: str = "") -> str:
    """
    Safely convert value to string.

    Args:
        value: Value to convert (str, int, float, None, empty string)
        default: Fallback string if value is empty (default: empty string)

    Returns:
        str: Converted value or default
    """
    if value is None or value == "":
        return default
    return str(value)
```

**Examples:**
```python
safe_str("USD")              # → "USD"
safe_str(123)                # → "123"
safe_str(None)               # → ""
safe_str("", "RUB")          # → "RUB"
safe_str(None, "DEFAULT")    # → "DEFAULT"
```

### safe_int()

Convert any value to integer with fallback.

```python
def safe_int(value: Any, default: int = 0) -> int:
    """
    Safely convert value to integer.

    Args:
        value: Value to convert (int, str, float, None, empty string)
        default: Fallback int if conversion fails (default: 0)

    Returns:
        int: Converted value or default
    """
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default
```

**Examples:**
```python
safe_int("60")             # → 60
safe_int(45.7)             # → 45 (truncates)
safe_int(None)             # → 0
safe_int("invalid", 30)   # → 30
safe_int("", 90)          # → 90
```

---

## Two-Tier Resolution

### get_value()

Core function for two-tier variable resolution.

```python
def get_value(
    field_name: str,
    product: ProductFromFile,
    variables: Dict[str, Any],
    default: Any = None
) -> Any:
    """
    Resolve value using two-tier hierarchy: product override > quote default > fallback.

    This is the KEY pattern for handling both product-level and quote-level variables.
    Used extensively in map_variables_to_calculation_input().

    Args:
        field_name: Name of the field to retrieve
                    (e.g., 'supplier_country', 'exchange_rate_base_price_to_quote')
        product: ProductFromFile object with potential product-level overrides
        variables: Quote-level default variables dict from frontend
        default: Fallback value if not found in product or quote levels

    Returns:
        Value from product override, quote default, or fallback (in priority order)

    Resolution Order:
        1. Check product.{field_name} - if not None and not empty string, use it
        2. Check variables.get(field_name) - if not None and not empty string, use it
        3. Return fallback default

    Example Usage:
        # Get supplier_country with hierarchy:
        # - Product override (if set)
        # - Quote default (if set)
        # - System fallback ('Турция')
        supplier_country = get_value(
            'supplier_country',
            product,
            variables,
            'Турция'
        )

        # Get exchange rate:
        exchange_rate = get_value(
            'exchange_rate_base_price_to_quote',
            product,
            variables,
            None  # No fallback - will be caught by validation
        )
    """
    # Check product override first
    product_value = getattr(product, field_name, None)
    if product_value is not None and product_value != "":
        return product_value

    # Check quote-level default
    quote_value = variables.get(field_name)
    if quote_value is not None and quote_value != "":
        return quote_value

    # Return fallback default
    return default
```

**When to use get_value():**
- Fields that can be overridden per product
- Usually: `supplier_country`, `exchange_rate_base_price_to_quote`, `markup`, customs-related fields

**When NOT to use get_value():**
- Quote-level only fields: `currency_of_quote`, `offer_incoterms`, `seller_company`
- Admin settings: fetched separately from `calculation_settings` table
- Product-level mandatory fields: `base_price_vat`, `quantity`, `weight_in_kg`

---

## Main Mapper Function

### map_variables_to_calculation_input()

Transforms flat frontend variables into nested Pydantic models for calculation engine.

**Location:** `backend/routes/quotes_calc.py`, lines 253-364

**Input:**
- `product: ProductFromFile` - Product from Excel/CSV with overrides
- `variables: Dict[str, Any]` - Quote-level defaults (flat structure)
- `admin_settings: Dict[str, Decimal]` - Admin rates from database

**Output:**
- `QuoteCalculationInput` - Nested Pydantic model with 8 sub-models

**Key Transforms:**

#### 1. ProductInfo (5 fields)

```python
product_info = ProductInfo(
    base_price_VAT=safe_decimal(product.base_price_vat),
    quantity=product.quantity,
    weight_in_kg=safe_decimal(product.weight_in_kg, Decimal("0")),
    currency_of_base_price=Currency(
        get_value('currency_of_base_price', product, variables, 'USD')
    ),
    customs_code=safe_str(
        get_value('customs_code', product, variables, '0000000000')
    )
)
```

**Mapping Rules:**
- `base_price_VAT` - Direct from product (product-only, no override)
- `quantity` - Direct from product (product-only, no override)
- `weight_in_kg` - Default to 0 if missing
- `currency_of_base_price` - Can override per product (two-tier)
- `customs_code` - Can override per product (two-tier)

**Defaults:**
- Currency: 'USD'
- Customs code: '0000000000'

#### 2. FinancialParams (7 fields)

```python
financial = FinancialParams(
    currency_of_quote=Currency(
        variables.get('currency_of_quote', 'USD')
    ),
    exchange_rate_base_price_to_quote=safe_decimal(
        variables.get('exchange_rate_base_price_to_quote'),
        Decimal("1")
    ),
    supplier_discount=safe_decimal(
        variables.get('supplier_discount'),
        Decimal("0")
    ),
    markup=safe_decimal(
        variables.get('markup'),
        Decimal("15")  # Required in validation - default 15%
    ),
    rate_forex_risk=admin_settings.get('rate_forex_risk', Decimal("3")),
    dm_fee_type=DMFeeType(
        variables.get('dm_fee_type', 'fixed')
    ),
    dm_fee_value=safe_decimal(
        variables.get('dm_fee_value'),
        Decimal("0")
    )
)
```

**Mapping Rules:**
- `currency_of_quote` - Quote-level only (all products same currency)
- `exchange_rate_base_price_to_quote` - Quote-level, can be overridden per product
- `supplier_discount` - Quote-level (percentage discount from supplier)
- `markup` - Quote-level, required (profit margin percentage)
- `rate_forex_risk` - Admin-only (fetched from `calculation_settings` table)
- `dm_fee_type` - Quote-level (fixed or percentage)
- `dm_fee_value` - Quote-level (decision maker fee amount)

**Defaults:**
- Exchange rate: 1.0
- Supplier discount: 0%
- Markup: 15%
- Rate forex risk: 3%
- DM fee type: 'fixed'
- DM fee value: 0

#### 3. LogisticsParams (6 fields)

```python
logistics = LogisticsParams(
    supplier_country=SupplierCountry(
        get_value('supplier_country', product, variables, 'Турция')
    ),
    offer_incoterms=Incoterms(
        variables.get('offer_incoterms', 'DDP')
    ),
    delivery_time=safe_int(
        variables.get('delivery_time'),
        60  # Default 60 days
    ),
    logistics_supplier_hub=safe_decimal(
        variables.get('logistics_supplier_hub'),
        Decimal("0")
    ),
    logistics_hub_customs=safe_decimal(
        variables.get('logistics_hub_customs'),
        Decimal("0")
    ),
    logistics_customs_client=safe_decimal(
        variables.get('logistics_customs_client'),
        Decimal("0")
    )
)
```

**Mapping Rules:**
- `supplier_country` - Can override per product (two-tier)
- `offer_incoterms` - Quote-level only (EXW, FCA, DAP, DDP, etc.)
- `delivery_time` - Quote-level in days
- Logistics costs - Quote-level, three segments:
  - Supplier → Hub (Турция)
  - Hub → Customs (Турция → РФ)
  - Customs → Client (Таможня → Клиент)

**Defaults:**
- Supplier country: 'Турция' (Turkey)
- Incoterms: 'DDP'
- Delivery time: 60 days
- All logistics costs: 0

#### 4. TaxesAndDuties (3 fields)

```python
taxes = TaxesAndDuties(
    import_tariff=safe_decimal(
        get_value('import_tariff', product, variables),
        Decimal("0")
    ),
    excise_tax=safe_decimal(
        get_value('excise_tax', product, variables),
        Decimal("0")
    ),
    util_fee=safe_decimal(
        get_value('util_fee', product, variables),
        Decimal("0")
    )
)
```

**Mapping Rules:**
- All taxes can override per product (two-tier)
- Percentages (e.g., 10% = Decimal("10"))

**Defaults:**
- All: 0%

#### 5. PaymentTerms (10 fields)

```python
payment = PaymentTerms(
    advance_from_client=safe_decimal(
        variables.get('advance_from_client'),
        Decimal("100")  # 100% - full advance
    ),
    advance_to_supplier=safe_decimal(
        variables.get('advance_to_supplier'),
        Decimal("100")
    ),
    time_to_advance=safe_int(
        variables.get('time_to_advance'),
        0  # Days before advance
    ),
    advance_on_loading=safe_decimal(
        variables.get('advance_on_loading'),
        Decimal("0")
    ),
    time_to_advance_loading=safe_int(
        variables.get('time_to_advance_loading'),
        0
    ),
    advance_on_going_to_country_destination=safe_decimal(
        variables.get('advance_on_going_to_country_destination'),
        Decimal("0")
    ),
    time_to_advance_going_to_country_destination=safe_int(
        variables.get('time_to_advance_going_to_country_destination'),
        0
    ),
    advance_on_customs_clearance=safe_decimal(
        variables.get('advance_on_customs_clearance'),
        Decimal("0")
    ),
    time_to_advance_on_customs_clearance=safe_int(
        variables.get('time_to_advance_on_customs_clearance'),
        0
    ),
    time_to_advance_on_receiving=safe_int(
        variables.get('time_to_advance_on_receiving'),
        0
    )
)
```

**Mapping Rules:**
- All payment terms are quote-level (no product overrides)
- Advances are percentages (Decimal)
- Times are integers (days)

**Defaults:**
- Advance from client: 100% (full advance required)
- Advance to supplier: 100% (pay supplier in full)
- All times: 0 days
- All other advances: 0%

#### 6. CustomsAndClearance (5 fields)

```python
customs = CustomsAndClearance(
    brokerage_hub=safe_decimal(
        variables.get('customs_brokerage_fee_turkey'),
        Decimal("0")
    ),
    brokerage_customs=safe_decimal(
        variables.get('customs_brokerage_fee_russia'),
        Decimal("0")
    ),
    warehousing_at_customs=safe_decimal(
        variables.get('temporary_storage_cost'),
        Decimal("0")
    ),
    customs_documentation=safe_decimal(
        variables.get('permitting_documents_cost'),
        Decimal("0")
    ),
    brokerage_extra=safe_decimal(
        variables.get('miscellaneous_costs'),
        Decimal("0")
    )
)
```

**Mapping Rules:**
- All customs costs are quote-level
- Note: Variable names in frontend differ from Pydantic model names (mapping applied)

**Field Mapping:**
- `customs_brokerage_fee_turkey` → `brokerage_hub`
- `customs_brokerage_fee_russia` → `brokerage_customs`
- `temporary_storage_cost` → `warehousing_at_customs`
- `permitting_documents_cost` → `customs_documentation`
- `miscellaneous_costs` → `brokerage_extra`

**Defaults:**
- All: 0

#### 7. CompanySettings (2 fields)

```python
company = CompanySettings(
    seller_company=SellerCompany(
        variables.get('seller_company', 'МАСТЕР БЭРИНГ ООО')
    ),
    offer_sale_type=OfferSaleType(
        variables.get('offer_sale_type', 'поставка')
    )
)
```

**Mapping Rules:**
- Both are quote-level (same for all products)
- Enum values expected

**Defaults:**
- Seller company: 'МАСТЕР БЭРИНГ ООО'
- Offer sale type: 'поставка' (supply)

#### 8. SystemConfig (3 fields)

```python
system = SystemConfig(
    rate_fin_comm=admin_settings.get('rate_fin_comm', Decimal("2")),
    rate_loan_interest_daily=admin_settings.get(
        'rate_loan_interest_daily',
        Decimal("0.00069")  # ~25.19% annual
    ),
    rate_insurance=safe_decimal(
        variables.get('rate_insurance'),
        Decimal("0.00047")
    )
)
```

**Mapping Rules:**
- `rate_fin_comm` - Admin-only (fetched from database)
- `rate_loan_interest_daily` - Admin-only (fetched from database)
- `rate_insurance` - Quote-level (can vary per quote)

**Defaults:**
- Rate fin comm: 2%
- Rate loan interest daily: 0.00069 (0.069% = 25.19% annual)
- Rate insurance: 0.047%

---

## Admin Settings Fetching

### fetch_admin_settings()

Fetch admin-only rates from `calculation_settings` table.

```python
async def fetch_admin_settings(organization_id: str) -> Dict[str, Decimal]:
    """
    Fetch admin calculation settings for organization.

    These settings are ORGANIZATION-WIDE and controlled by admins only:
    - rate_forex_risk (forex hedging cost)
    - rate_fin_comm (financial commission percentage)
    - rate_loan_interest_daily (daily compound interest rate)

    Args:
        organization_id: Organization UUID

    Returns:
        Dict with rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
        Returns defaults if settings not found in database

    Database Default Values:
        - rate_forex_risk: 3% (hedging against currency fluctuations)
        - rate_fin_comm: 2% (commission for financing)
        - rate_loan_interest_daily: 0.00069 (25.19% annual, daily compound)
    """
    try:
        # Fetch from calculation_settings table
        response = supabase.table("calculation_settings")\
            .select("rate_forex_risk, rate_fin_comm, rate_loan_interest_daily")\
            .eq("organization_id", organization_id)\
            .execute()

        if response.data and len(response.data) > 0:
            settings = response.data[0]
            return {
                'rate_forex_risk': Decimal(str(settings.get('rate_forex_risk', "3"))),
                'rate_fin_comm': Decimal(str(settings.get('rate_fin_comm', "2"))),
                'rate_loan_interest_daily': Decimal(str(settings.get('rate_loan_interest_daily', "0.00069")))
            }
        else:
            # Return defaults if no settings found
            return {
                'rate_forex_risk': Decimal("3"),
                'rate_fin_comm': Decimal("2"),
                'rate_loan_interest_daily': Decimal("0.00069")
            }

    except Exception as e:
        # Log error and return defaults
        print(f"Error fetching admin settings: {e}")
        return {
            'rate_forex_risk': Decimal("3"),
            'rate_fin_comm': Decimal("2"),
            'rate_loan_interest_daily': Decimal("0.00069")
        }
```

**Usage:**
```python
# In quote calculation endpoint
admin_settings = await fetch_admin_settings(user.current_organization_id)

# Pass to mapper
calc_input = map_variables_to_calculation_input(
    product=product,
    variables=request.variables,
    admin_settings=admin_settings
)
```

**Important:**
- Always use `Decimal(str(...))` when converting from database to avoid floating-point errors
- If fetch fails, gracefully fall back to defaults (no exception thrown)
- These are organization-wide settings, not per-product

---

## Complete Mapping Example

### Request Flow

```python
# 1. Frontend sends quote calculation request
request = QuoteCalculationRequest(
    customer_id="...",
    title="Bearings Order",
    products=[
        ProductFromFile(
            product_name="Ball Bearing 6305",
            base_price_vat=50.00,
            quantity=100,
            weight_in_kg=0.5
            # No overrides - will use quote defaults
        ),
        ProductFromFile(
            product_name="Ball Bearing 6306",
            base_price_vat=60.00,
            quantity=50,
            weight_in_kg=0.6,
            supplier_country="Япония"  # OVERRIDE: different country for this product
        )
    ],
    variables={
        # Quote-level defaults for ALL products
        "currency_of_base_price": "USD",
        "currency_of_quote": "RUB",
        "exchange_rate_base_price_to_quote": 100,
        "supplier_country": "Турция",  # Default for all (can be overridden)
        "supplier_discount": 5,
        "markup": 20,
        "offer_incoterms": "DDP",
        "delivery_time": 45,
        # ... 35 more variables
    }
)

# 2. Backend fetches admin settings
admin_settings = await fetch_admin_settings(user.current_organization_id)
# → {
#     'rate_forex_risk': Decimal("3"),
#     'rate_fin_comm': Decimal("2"),
#     'rate_loan_interest_daily': Decimal("0.00069")
# }

# 3. Mapper processes each product
for product in request.products:
    calc_input = map_variables_to_calculation_input(
        product=product,
        variables=request.variables,
        admin_settings=admin_settings
    )
    # → QuoteCalculationInput with all 8 nested models

# Product 1 (no overrides):
# - supplier_country = get_value('supplier_country', product, variables, 'Турция')
#   → product.supplier_country = None → use variables['supplier_country'] = 'Турция' ✓

# Product 2 (with override):
# - supplier_country = get_value('supplier_country', product, variables, 'Турция')
#   → product.supplier_country = 'Япония' ✓ (product override wins!)

# 4. Calculation engine runs
result = calculate_single_product_quote(calc_input)
# → ProductCalculationResult with all 13 phases
```

---

## Important Patterns

### Pattern 1: Two-Tier Fields

Fields that can be overridden per product:

```python
# Supplier country can differ per product
supplier_country = get_value('supplier_country', product, variables, 'Турция')

# Exchange rate can differ per product (if importing from different countries)
exchange_rate = get_value('exchange_rate_base_price_to_quote', product, variables, None)

# Taxes can differ per product (different HS codes)
import_tariff = safe_decimal(get_value('import_tariff', product, variables), Decimal("0"))
excise_tax = safe_decimal(get_value('excise_tax', product, variables), Decimal("0"))
```

### Pattern 2: Quote-Level Only Fields

Quote-wide fields (same for all products):

```python
# All products use same currency and incoterms
currency_of_quote = variables.get('currency_of_quote', 'USD')
offer_incoterms = variables.get('offer_incoterms', 'DDP')

# All products use same payment terms and logistics structure
advance_from_client = variables.get('advance_from_client', Decimal("100"))
logistics_supplier_hub = variables.get('logistics_supplier_hub', Decimal("0"))
```

### Pattern 3: Admin-Only Fields

Settings fetched from database (read-only for users):

```python
# These come from admin settings table, NOT from request variables
rate_forex_risk = admin_settings.get('rate_forex_risk', Decimal("3"))
rate_fin_comm = admin_settings.get('rate_fin_comm', Decimal("2"))
rate_loan_interest_daily = admin_settings.get('rate_loan_interest_daily', Decimal("0.00069"))
```

### Pattern 4: Variable Name Mapping

Frontend variable names sometimes differ from Pydantic model names:

```python
# Frontend             → Pydantic Model
'customs_brokerage_fee_turkey'     → brokerage_hub
'customs_brokerage_fee_russia'     → brokerage_customs
'temporary_storage_cost'           → warehousing_at_customs
'permitting_documents_cost'        → customs_documentation
'miscellaneous_costs'              → brokerage_extra
```

Always check the mapping function for these translations!

---

## Validation Integration

The mapper works with `validate_calculation_input()` to ensure data integrity.

**Validation Errors Caught:**
- Missing required fields (seller_company, offer_incoterms)
- Invalid currencies or exchange rates
- Markup missing or ≤ 0
- Supplier country missing
- Non-EXW incoterms without logistics costs
- Missing supplier discount when required

**Order:**
1. Validate all fields → return all errors at once
2. If valid, map to calculation input
3. Pass to calculation engine

---

## Troubleshooting

### "AttributeError: 'ProductFromFile' object has no attribute 'field_name'"

**Cause:** Using incorrect field name in `get_value()`

**Fix:**
```python
# ❌ Wrong field name
value = get_value('customer_country', product, variables)

# ✅ Correct field name
value = get_value('supplier_country', product, variables)
```

### "InvalidOperation: quantize result has too many digits for this Decimal"

**Cause:** Converting float to Decimal without going through string first

**Fix:**
```python
# ❌ Wrong
price = Decimal(50.50)

# ✅ Correct
price = Decimal("50.50")  # or Decimal(str(50.50))
```

### "KeyError: 'some_variable'"

**Cause:** Accessing dictionary key that doesn't exist

**Fix:**
```python
# ❌ Wrong
value = variables['some_field']  # Crashes if not present

# ✅ Correct
value = variables.get('some_field', default_value)  # Safe
```

### Calculation produces unexpected values

**Cause:** Wrong variable precedence (forgot two-tier logic)

**Debug:**
```python
# Log resolution steps
product_value = getattr(product, field_name, None)
quote_value = variables.get(field_name)
print(f"Product: {product_value}, Quote: {quote_value}, Default: {default}")

# Verify order of operations
if product_value is not None:
    print(f"Using PRODUCT override: {product_value}")
elif quote_value is not None:
    print(f"Using QUOTE default: {quote_value}")
else:
    print(f"Using SYSTEM fallback: {default}")
```

---

## Summary

| Task | Function | Pattern |
|------|----------|---------|
| Convert to Decimal | `safe_decimal()` | Always use `Decimal(str(...))` |
| Convert to String | `safe_str()` | Return empty string if None |
| Convert to Integer | `safe_int()` | Return 0 if invalid |
| Resolve variable value | `get_value()` | Product → Quote → Default |
| Fetch admin rates | `fetch_admin_settings()` | Async, with fallbacks |
| Transform all variables | `map_variables_to_calculation_input()` | Returns nested QuoteCalculationInput |

**Key Principle:** Always use safe converters and two-tier resolution. Never assume values exist or are valid types.
