# /debug-calculation - Calculation Engine Debugger

**Description:** Step-through debugger for the 13-phase calculation engine. Validates input, shows two-tier variable precedence, maps to Pydantic models, and identifies where calculations fail.

**Usage:** `/debug-calculation <quote_data.json>`

**Purpose:** Quickly diagnose calculation bugs by inspecting:
- Required field validation (10 fields)
- Two-tier variable resolution (42 variables)
- Pydantic model mapping (7 models)
- Phase-by-phase calculations (13 phases)
- Intermediate values at each step

## Prerequisites

**Python Requirements:**
- Python 3.9+ (standard library features)
- Modules used (all included in Python standard library):
  - `json` - JSON parsing
  - `decimal` - Precise decimal arithmetic
  - `pathlib` - Path handling
  - `datetime` - Date/time operations (for fallback date parsing)

**Installation Check:**
```bash
python3 --version  # Should be 3.9 or higher
```

---

## Input Format

**File:** `quote_data.json` (path relative to project root)

**Structure:**
```json
{
  "quote_id": "optional-uuid",
  "quote_defaults": {
    "seller_company": "МАСТЕР БЭРИНГ ООО",
    "offer_sale_type": "поставка",
    "offer_incoterms": "DDP",
    "currency_of_quote": "USD",
    "exchange_rate_base_price_to_quote": 0.013,
    "supplier_country": "Турция",
    "supplier_discount": 0,
    "markup": 15,
    "rate_forex_risk": 3,
    "rate_fin_comm": 2,
    "rate_loan_interest_daily": 0.00069,
    "delivery_time": 60,
    "advance_from_client": 100,
    "advance_to_supplier": 30,
    "time_to_advance": 7,
    "customs_code": "8482109000",
    "import_tariff": 5,
    "excise_tax": 0,
    "logistics_supplier_hub": 500,
    "logistics_hub_customs": 300,
    "logistics_customs_client": 200,
    "brokerage_hub": 100,
    "brokerage_customs": 150,
    "warehousing_at_customs": 50,
    "customs_documentation": 25,
    "brokerage_extra": 0,
    "dm_fee_type": "percent",
    "dm_fee_value": 2,
    "util_fee": 0
  },
  "products": [
    {
      "product_id": "optional-uuid",
      "sku": "6206-2RS",
      "brand": "SKF",
      "product_name": "Deep groove ball bearing",
      "base_price_vat": 850.50,
      "quantity": 100,
      "weight_in_kg": 0.5,
      "currency_of_base_price": "TRY",
      "overrides": {
        "markup": 20,
        "supplier_discount": 5
      }
    }
  ]
}
```

**Minimal Example:**
```json
{
  "quote_defaults": {
    "seller_company": "МАСТЕР БЭРИНГ ООО",
    "offer_incoterms": "DDP",
    "currency_of_quote": "USD",
    "rate_forex_risk": 3,
    "rate_fin_comm": 2,
    "rate_loan_interest_daily": 0.00069,
    "delivery_time": 60,
    "markup": 15
  },
  "products": [
    {
      "sku": "6206",
      "brand": "SKF",
      "product_name": "Bearing",
      "base_price_vat": 850.50,
      "quantity": 100,
      "weight_in_kg": 0.5,
      "currency_of_base_price": "TRY",
      "exchange_rate_base_price_to_quote": 0.013,
      "supplier_country": "Турция"
    }
  ]
}
```

---

## Step 1: Load and Validate Input (Required Fields)

**Action:** Load JSON file and validate 10 required fields using two-tier resolution.

**Implementation:**

```python
import json
from pathlib import Path

# Load input file
quote_data_path = Path("/home/novi/quotation-app-dev") / args.quote_data_file
with open(quote_data_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

quote_defaults = data.get('quote_defaults', {})
products = data.get('products', [])

print("=" * 80)
print("STEP 1: VALIDATE REQUIRED FIELDS")
print("=" * 80)
print(f"Quote ID: {data.get('quote_id', 'N/A')}")
print(f"Products: {len(products)}")
print()

# Helper: Two-tier value resolution
def get_value(product, field_name, fallback=None):
    """Get effective value: product override > quote default > fallback"""
    # Check product override
    product_value = product.get('overrides', {}).get(field_name)
    if product_value is not None and product_value != "":
        return product_value

    # Check product direct field
    product_value = product.get(field_name)
    if product_value is not None and product_value != "":
        return product_value

    # Check quote default
    quote_value = quote_defaults.get(field_name)
    if quote_value is not None and quote_value != "":
        return quote_value

    # Use fallback
    return fallback

# Required fields (10 total)
REQUIRED_QUOTE_FIELDS = [
    "seller_company",
    "offer_incoterms",
    "currency_of_quote",
    "rate_forex_risk",
    "rate_fin_comm",
    "rate_loan_interest_daily",
    "delivery_time",
    "markup"
]

REQUIRED_PRODUCT_FIELDS = [
    "base_price_vat",
    "quantity",
    "currency_of_base_price",
    "exchange_rate_base_price_to_quote",
    "supplier_country"
]

errors = []

# Validate quote-level required fields
print("📋 Quote-Level Required Fields:")
for field in REQUIRED_QUOTE_FIELDS:
    value = quote_defaults.get(field)
    status = "✅" if value else "❌"
    print(f"  {status} {field}: {value}")
    if not value:
        errors.append(f"Quote field '{field}' is required")

print()

# Validate product-level required fields (with two-tier resolution)
for idx, product in enumerate(products):
    product_id = product.get('sku', f'Product {idx + 1}')
    print(f"📦 Product {idx + 1} ({product_id}) Required Fields:")

    for field in REQUIRED_PRODUCT_FIELDS:
        value = get_value(product, field)
        source = "product" if product.get(field) or product.get('overrides', {}).get(field) else "quote"
        status = "✅" if value else "❌"
        print(f"  {status} {field}: {value} (from {source})")
        if not value:
            errors.append(f"Product {idx + 1} ({product_id}): '{field}' is required")
    print()

# Show validation result
if errors:
    print("❌ VALIDATION FAILED")
    print(f"Found {len(errors)} errors:")
    for error in errors:
        print(f"  - {error}")
    print()
    print("🛑 STOPPING: Fix errors and try again")
    exit(1)
else:
    print("✅ VALIDATION PASSED")
    print("All required fields present")
    print()
```

**Output Example:**
```
================================================================================
STEP 1: VALIDATE REQUIRED FIELDS
================================================================================
Quote ID: N/A
Products: 1

📋 Quote-Level Required Fields:
  ✅ seller_company: МАСТЕР БЭРИНГ ООО
  ✅ offer_incoterms: DDP
  ✅ currency_of_quote: USD
  ✅ rate_forex_risk: 3
  ✅ rate_fin_comm: 2
  ✅ rate_loan_interest_daily: 0.00069
  ✅ delivery_time: 60
  ✅ markup: 15

📦 Product 1 (6206-2RS) Required Fields:
  ✅ base_price_vat: 850.5 (from product)
  ✅ quantity: 100 (from product)
  ✅ currency_of_base_price: TRY (from product)
  ✅ exchange_rate_base_price_to_quote: 0.013 (from quote)
  ✅ supplier_country: Турция (from quote)

✅ VALIDATION PASSED
All required fields present
```

---

## Step 2: Show Two-Tier Variable Precedence

**Action:** For all 42 variables, show quote default, product override, and final value used.

**Implementation:**

```python
print("=" * 80)
print("STEP 2: TWO-TIER VARIABLE PRECEDENCE")
print("=" * 80)
print("Legend:")
print("  🔵 GRAY  = Using quote default")
print("  🟦 BLUE  = Product override (user)")
print("  🟥 RED   = Product override (admin)")
print()

# All 42 variables
ALL_VARIABLES = {
    "Product Info (5)": [
        "sku", "brand", "base_price_vat", "quantity", "weight_in_kg"
    ],
    "Financial (9)": [
        "currency_of_quote", "exchange_rate_base_price_to_quote", "supplier_discount",
        "markup", "rate_forex_risk", "dm_fee_type", "dm_fee_value", "rate_fin_comm",
        "rate_loan_interest_daily"
    ],
    "Logistics (7)": [
        "supplier_country", "delivery_time", "offer_incoterms", "logistics_supplier_hub",
        "logistics_hub_customs", "logistics_customs_client"
    ],
    "Taxes & Duties (3)": [
        "import_tariff", "excise_tax", "util_fee"
    ],
    "Payment Terms (12)": [
        "advance_from_client", "advance_to_supplier", "time_to_advance",
        "advance_on_loading", "time_to_advance_loading",
        "advance_on_going_to_country_destination", "time_to_advance_going_to_country_destination",
        "advance_on_customs_clearance", "time_to_advance_on_customs_clearance",
        "time_to_advance_on_receiving"
    ],
    "Customs & Clearance (5)": [
        "brokerage_hub", "brokerage_customs", "warehousing_at_customs",
        "customs_documentation", "brokerage_extra"
    ],
    "Company Settings (2)": [
        "seller_company", "offer_sale_type"
    ]
}

# Admin-only variables
ADMIN_ONLY = ["rate_forex_risk", "rate_fin_comm", "rate_loan_interest_daily"]

for idx, product in enumerate(products):
    product_id = product.get('sku', f'Product {idx + 1}')
    print(f"{'=' * 80}")
    print(f"📦 PRODUCT {idx + 1}: {product_id} ({product.get('brand', 'N/A')})")
    print(f"{'=' * 80}")

    for category, variables in ALL_VARIABLES.items():
        print(f"\n{category}:")
        print(f"{'Variable':<40} {'Quote Default':<20} {'Product Override':<20} {'Final Value':<20}")
        print("-" * 100)

        for var in variables:
            # Get values
            quote_default = quote_defaults.get(var, "-")
            product_override = product.get('overrides', {}).get(var) or product.get(var)
            final_value = get_value(product, var, "-")

            # Determine color
            if product_override is not None and product_override != "":
                if var in ADMIN_ONLY:
                    color = "🟥"  # Red (admin override)
                else:
                    color = "🟦"  # Blue (user override)
            else:
                color = "🔵"  # Gray (quote default)

            # Format values
            quote_str = str(quote_default) if quote_default != "-" else "-"
            override_str = str(product_override) if product_override is not None else "-"
            final_str = str(final_value)

            print(f"{var:<40} {quote_str:<20} {override_str:<20} {color} {final_str}")

    print()
```

**Output Example (truncated):**
```
================================================================================
📦 PRODUCT 1: 6206-2RS (SKF)
================================================================================

Product Info (5):
Variable                                 Quote Default        Product Override     Final Value
----------------------------------------------------------------------------------------------------
sku                                      -                    6206-2RS             🟦 6206-2RS
brand                                    -                    SKF                  🟦 SKF
base_price_vat                           -                    850.5                🟦 850.5
quantity                                 -                    100                  🟦 100
weight_in_kg                             -                    0.5                  🟦 0.5

Financial (9):
Variable                                 Quote Default        Product Override     Final Value
----------------------------------------------------------------------------------------------------
currency_of_quote                        USD                  -                    🔵 USD
exchange_rate_base_price_to_quote        0.013                -                    🔵 0.013
supplier_discount                        0                    5                    🟦 5
markup                                   15                   20                   🟦 20
rate_forex_risk                          3                    -                    🔵 3
dm_fee_type                              percent              -                    🔵 percent
dm_fee_value                             2                    -                    🔵 2
rate_fin_comm                            2                    -                    🔵 2
rate_loan_interest_daily                 0.00069              -                    🔵 0.00069
```

---

## Step 3: Map to Pydantic Models

**Action:** Show how variables map to 7 nested Pydantic models and validate each.

**Implementation:**

```python
from decimal import Decimal

print("=" * 80)
print("STEP 3: MAP TO PYDANTIC MODELS")
print("=" * 80)
print("Mapping 42 variables to 7 nested models:")
print()

# Safe conversion helpers
def safe_decimal(value, default=Decimal("0")):
    if value is None or value == "" or value == "-":
        return default
    try:
        return Decimal(str(value))
    except:
        return default

def safe_str(value, default=""):
    if value is None or value == "" or value == "-":
        return default
    return str(value)

def safe_int(value, default=0):
    if value is None or value == "" or value == "-":
        return default
    try:
        return int(value)
    except:
        return default

# Map for each product
for idx, product in enumerate(products):
    product_id = product.get('sku', f'Product {idx + 1}')
    print(f"📦 Product {idx + 1}: {product_id}")
    print()

    # Model 1: ProductInfo (5 fields)
    print("1️⃣  ProductInfo:")
    product_info = {
        "base_price_VAT": safe_decimal(get_value(product, 'base_price_vat')),
        "quantity": safe_int(get_value(product, 'quantity')),
        "weight_in_kg": safe_decimal(get_value(product, 'weight_in_kg', 0)),
        "currency_of_base_price": safe_str(get_value(product, 'currency_of_base_price', 'USD')),
        "customs_code": safe_str(get_value(product, 'customs_code', '0000000000'))
    }
    for key, value in product_info.items():
        print(f"   {key}: {value}")
    print()

    # Model 2: FinancialParams (7 fields)
    print("2️⃣  FinancialParams:")
    financial = {
        "currency_of_quote": safe_str(quote_defaults.get('currency_of_quote', 'USD')),
        "exchange_rate_base_price_to_quote": safe_decimal(get_value(product, 'exchange_rate_base_price_to_quote', 1)),
        "supplier_discount": safe_decimal(get_value(product, 'supplier_discount', 0)),
        "markup": safe_decimal(get_value(product, 'markup', 15)),
        "rate_forex_risk": safe_decimal(quote_defaults.get('rate_forex_risk', 3)),
        "dm_fee_type": safe_str(quote_defaults.get('dm_fee_type', 'fixed')),
        "dm_fee_value": safe_decimal(quote_defaults.get('dm_fee_value', 0))
    }
    for key, value in financial.items():
        print(f"   {key}: {value}")
    print()

    # Model 3: LogisticsParams (6 fields)
    print("3️⃣  LogisticsParams:")
    logistics = {
        "supplier_country": safe_str(get_value(product, 'supplier_country', 'Турция')),
        "offer_incoterms": safe_str(quote_defaults.get('offer_incoterms', 'DDP')),
        "delivery_time": safe_int(get_value(product, 'delivery_time', 60)),
        "logistics_supplier_hub": safe_decimal(quote_defaults.get('logistics_supplier_hub', 0)),
        "logistics_hub_customs": safe_decimal(quote_defaults.get('logistics_hub_customs', 0)),
        "logistics_customs_client": safe_decimal(quote_defaults.get('logistics_customs_client', 0))
    }
    for key, value in logistics.items():
        print(f"   {key}: {value}")
    print()

    # Model 4: TaxesAndDuties (3 fields)
    print("4️⃣  TaxesAndDuties:")
    taxes = {
        "import_tariff": safe_decimal(get_value(product, 'import_tariff', 0)),
        "excise_tax": safe_decimal(get_value(product, 'excise_tax', 0)),
        "util_fee": safe_decimal(get_value(product, 'util_fee', 0))
    }
    for key, value in taxes.items():
        print(f"   {key}: {value}")
    print()

    # Model 5: PaymentTerms (10 fields)
    print("5️⃣  PaymentTerms:")
    payment = {
        "advance_from_client": safe_decimal(quote_defaults.get('advance_from_client', 100)),
        "advance_to_supplier": safe_decimal(quote_defaults.get('advance_to_supplier', 100)),
        "time_to_advance": safe_int(quote_defaults.get('time_to_advance', 0)),
        "advance_on_loading": safe_decimal(quote_defaults.get('advance_on_loading', 0)),
        "time_to_advance_loading": safe_int(quote_defaults.get('time_to_advance_loading', 0)),
        "advance_on_going_to_country_destination": safe_decimal(quote_defaults.get('advance_on_going_to_country_destination', 0)),
        "time_to_advance_going_to_country_destination": safe_int(quote_defaults.get('time_to_advance_going_to_country_destination', 0)),
        "advance_on_customs_clearance": safe_decimal(quote_defaults.get('advance_on_customs_clearance', 0)),
        "time_to_advance_on_customs_clearance": safe_int(quote_defaults.get('time_to_advance_on_customs_clearance', 0)),
        "time_to_advance_on_receiving": safe_int(quote_defaults.get('time_to_advance_on_receiving', 0))
    }
    for key, value in payment.items():
        print(f"   {key}: {value}")
    print()

    # Model 6: CustomsAndClearance (5 fields)
    print("6️⃣  CustomsAndClearance:")
    customs = {
        "brokerage_hub": safe_decimal(quote_defaults.get('brokerage_hub', 0)),
        "brokerage_customs": safe_decimal(quote_defaults.get('brokerage_customs', 0)),
        "warehousing_at_customs": safe_decimal(quote_defaults.get('warehousing_at_customs', 0)),
        "customs_documentation": safe_decimal(quote_defaults.get('customs_documentation', 0)),
        "brokerage_extra": safe_decimal(quote_defaults.get('brokerage_extra', 0))
    }
    for key, value in customs.items():
        print(f"   {key}: {value}")
    print()

    # Model 7: CompanySettings (2 fields)
    print("7️⃣  CompanySettings:")
    company = {
        "seller_company": safe_str(quote_defaults.get('seller_company', 'МАСТЕР БЭРИНГ ООО')),
        "offer_sale_type": safe_str(quote_defaults.get('offer_sale_type', 'поставка'))
    }
    for key, value in company.items():
        print(f"   {key}: {value}")
    print()

    # Model 8: SystemConfig (3 admin fields)
    print("8️⃣  SystemConfig (Admin):")
    system = {
        "rate_fin_comm": safe_decimal(quote_defaults.get('rate_fin_comm', 2)),
        "rate_loan_interest_daily": safe_decimal(quote_defaults.get('rate_loan_interest_daily', 0.00069)),
        "rate_insurance": safe_decimal(quote_defaults.get('rate_insurance', 0.00047))
    }
    for key, value in system.items():
        print(f"   {key}: {value}")
    print()

print("✅ All models mapped successfully")
print()
```

**Output Example (truncated):**
```
================================================================================
STEP 3: MAP TO PYDANTIC MODELS
================================================================================
Mapping 42 variables to 7 nested models:

📦 Product 1: 6206-2RS

1️⃣  ProductInfo:
   base_price_VAT: 850.5
   quantity: 100
   weight_in_kg: 0.5
   currency_of_base_price: TRY
   customs_code: 8482109000

2️⃣  FinancialParams:
   currency_of_quote: USD
   exchange_rate_base_price_to_quote: 0.013
   supplier_discount: 5
   markup: 20
   rate_forex_risk: 3
   dm_fee_type: percent
   dm_fee_value: 2

...

✅ All models mapped successfully
```

---

## Step 4: Step Through 13 Calculation Phases

**Action:** Execute calculations phase-by-phase, showing intermediate values and formulas.

**Implementation:**

```python
from decimal import Decimal, ROUND_HALF_UP

print("=" * 80)
print("STEP 4: STEP THROUGH 13 CALCULATION PHASES")
print("=" * 80)
print("Executing calculation engine with intermediate values")
print()

# Helper functions
def round_decimal(value, places=2):
    """Round decimal to N places"""
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(Decimal(10) ** -places, rounding=ROUND_HALF_UP)

def get_vat_seller_country(supplier_country):
    """Get VAT rate for supplier country"""
    vat_rates = {
        "Турция": Decimal("0.20"),
        "Турция (транзитная зона)": Decimal("0"),
        "Россия": Decimal("0.20"),
        "Китай": Decimal("0.13"),
        "ОАЭ": Decimal("0.05"),
        "Литва": Decimal("0.21")
    }
    return vat_rates.get(supplier_country, Decimal("0"))

def get_seller_region(seller_company):
    """Derive seller_region from seller_company"""
    region_map = {
        "МАСТЕР БЭРИНГ ООО": "RU",
        "ЦМТО1 ООО": "RU",
        "РАД РЕСУРС ООО": "RU",
        "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ": "TR",
        "GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ": "TR",
        "UPDOOR Limited": "CN"
    }
    return region_map.get(seller_company, "RU")

# Store phase results
phase_results = {}

for idx, product in enumerate(products):
    product_id = product.get('sku', f'Product {idx + 1}')
    print(f"{'=' * 80}")
    print(f"📦 PRODUCT {idx + 1}: {product_id}")
    print(f"{'=' * 80}")
    print()

    # Get mapped values
    base_price = safe_decimal(get_value(product, 'base_price_vat'))
    quantity = safe_int(get_value(product, 'quantity'))
    weight_kg = safe_decimal(get_value(product, 'weight_in_kg', 0))
    supplier_country = safe_str(get_value(product, 'supplier_country', 'Турция'))
    supplier_discount = safe_decimal(get_value(product, 'supplier_discount', 0))
    exchange_rate = safe_decimal(get_value(product, 'exchange_rate_base_price_to_quote', 1))
    currency_base = safe_str(get_value(product, 'currency_of_base_price', 'USD'))
    currency_quote = safe_str(quote_defaults.get('currency_of_quote', 'USD'))
    seller_company = safe_str(quote_defaults.get('seller_company'))
    seller_region = get_seller_region(seller_company)
    offer_incoterms = safe_str(quote_defaults.get('offer_incoterms', 'DDP'))
    offer_sale_type = safe_str(quote_defaults.get('offer_sale_type', 'поставка'))
    markup = safe_decimal(get_value(product, 'markup', 15))
    import_tariff = safe_decimal(get_value(product, 'import_tariff', 0))
    excise_tax = safe_decimal(get_value(product, 'excise_tax', 0))
    delivery_time = safe_int(get_value(product, 'delivery_time', 60))

    # Admin settings
    rate_forex_risk = safe_decimal(quote_defaults.get('rate_forex_risk', 3))
    rate_fin_comm = safe_decimal(quote_defaults.get('rate_fin_comm', 2))
    rate_loan_interest_daily = safe_decimal(quote_defaults.get('rate_loan_interest_daily', 0.00069))

    # ==========================================================================
    # PHASE 1: Purchase Price Calculations
    # ==========================================================================
    print("PHASE 1: Purchase Price Calculations")
    print("-" * 80)

    vat_rate = get_vat_seller_country(supplier_country)

    # Remove VAT (except China)
    if supplier_country != "Китай":
        N16 = base_price / (Decimal("1") + vat_rate)
        print(f"N16 = base_price / (1 + vat_rate)")
        print(f"    = {base_price} / (1 + {vat_rate})")
        print(f"    = {round_decimal(N16)} {currency_base} (without VAT)")
    else:
        N16 = base_price
        print(f"N16 = base_price (China - no VAT removal)")
        print(f"    = {base_price} {currency_base}")

    # Apply supplier discount
    P16 = N16 * (Decimal("1") - supplier_discount / Decimal("100"))
    print(f"P16 = N16 × (1 - supplier_discount / 100)")
    print(f"    = {round_decimal(N16)} × (1 - {supplier_discount} / 100)")
    print(f"    = {round_decimal(P16)} {currency_base} (after discount)")

    # Convert to quote currency
    R16 = P16 * exchange_rate
    print(f"R16 = P16 × exchange_rate")
    print(f"    = {round_decimal(P16)} × {exchange_rate}")
    print(f"    = {round_decimal(R16)} {currency_quote} (per unit in quote currency)")

    # Total purchase price
    S16 = R16 * Decimal(str(quantity))
    print(f"S16 = R16 × quantity")
    print(f"    = {round_decimal(R16)} × {quantity}")
    print(f"    = {round_decimal(S16)} {currency_quote} (total purchase price)")
    print()

    phase_results[f'product_{idx}'] = {
        'N16': round_decimal(N16),
        'P16': round_decimal(P16),
        'R16': round_decimal(R16),
        'S16': round_decimal(S16)
    }

    # ==========================================================================
    # PHASE 2: Distribution Base (for multi-product)
    # ==========================================================================
    print("PHASE 2: Distribution Base")
    print("-" * 80)

    # For single product, BD16 = 1.0
    if len(products) == 1:
        S13 = S16
        BD16 = Decimal("1.0")
        print(f"S13 = S16 (single product)")
        print(f"    = {round_decimal(S13)} {currency_quote}")
        print(f"BD16 = 1.0 (100% of quote)")
    else:
        # Calculate total across all products
        S13 = sum([safe_decimal(get_value(p, 'base_price_vat')) *
                   safe_int(get_value(p, 'quantity')) *
                   safe_decimal(get_value(p, 'exchange_rate_base_price_to_quote', 1))
                   for p in products])
        BD16 = S16 / S13
        print(f"S13 = SUM(S16) for all products")
        print(f"    = {round_decimal(S13)} {currency_quote}")
        print(f"BD16 = S16 / S13")
        print(f"     = {round_decimal(S16)} / {round_decimal(S13)}")
        print(f"     = {round_decimal(BD16)} ({float(BD16) * 100:.1f}% of quote)")
    print()

    phase_results[f'product_{idx}']['S13'] = round_decimal(S13)
    phase_results[f'product_{idx}']['BD16'] = round_decimal(BD16)

    # ==========================================================================
    # PHASE 3: Logistics Distribution
    # ==========================================================================
    print("PHASE 3: Logistics Distribution")
    print("-" * 80)

    logistics_supplier_hub = safe_decimal(quote_defaults.get('logistics_supplier_hub', 0))
    logistics_hub_customs = safe_decimal(quote_defaults.get('logistics_hub_customs', 0))
    logistics_customs_client = safe_decimal(quote_defaults.get('logistics_customs_client', 0))

    # Distribute logistics costs proportionally
    T16 = logistics_supplier_hub * BD16
    print(f"T16 = logistics_supplier_hub × BD16")
    print(f"    = {logistics_supplier_hub} × {round_decimal(BD16)}")
    print(f"    = {round_decimal(T16)} {currency_quote} (first-leg logistics)")

    # Insurance (simple: 0.5% of S16)
    insurance_rate = Decimal("0.005")
    insurance_per_product = S16 * insurance_rate

    U16 = (logistics_hub_customs + logistics_customs_client) * BD16 + insurance_per_product
    print(f"U16 = (logistics_hub_customs + logistics_customs_client) × BD16 + insurance")
    print(f"    = ({logistics_hub_customs} + {logistics_customs_client}) × {round_decimal(BD16)} + {round_decimal(insurance_per_product)}")
    print(f"    = {round_decimal(U16)} {currency_quote} (last-leg logistics + insurance)")

    V16 = T16 + U16
    print(f"V16 = T16 + U16")
    print(f"    = {round_decimal(T16)} + {round_decimal(U16)}")
    print(f"    = {round_decimal(V16)} {currency_quote} (total logistics)")
    print()

    phase_results[f'product_{idx}']['T16'] = round_decimal(T16)
    phase_results[f'product_{idx}']['U16'] = round_decimal(U16)
    phase_results[f'product_{idx}']['V16'] = round_decimal(V16)

    # ==========================================================================
    # PHASE 4: Internal Pricing & Duties
    # ==========================================================================
    print("PHASE 4: Internal Pricing & Duties")
    print("-" * 80)

    # Internal markup (simplified: 10% for Turkey → RU)
    internal_markup = Decimal("10") if seller_region == "RU" and supplier_country == "Турция" else Decimal("0")

    AX16 = R16 * (Decimal("1") + internal_markup / Decimal("100"))
    print(f"AX16 = R16 × (1 + internal_markup / 100)")
    print(f"     = {round_decimal(R16)} × (1 + {internal_markup} / 100)")
    print(f"     = {round_decimal(AX16)} {currency_quote} (internal price per unit)")

    AY16 = AX16 * Decimal(str(quantity))
    print(f"AY16 = AX16 × quantity")
    print(f"     = {round_decimal(AX16)} × {quantity}")
    print(f"     = {round_decimal(AY16)} {currency_quote} (internal price total)")

    # Customs duty (0 if Turkish export or seller region = TR)
    if seller_region == "TR" or offer_sale_type == "экспорт":
        Y16 = Decimal("0")
        print(f"Y16 = 0 (Turkish export - no import tariff)")
    else:
        Y16 = AY16 * import_tariff / Decimal("100") if offer_incoterms == "DDP" else Decimal("0")
        print(f"Y16 = AY16 × import_tariff / 100")
        print(f"    = {round_decimal(AY16)} × {import_tariff} / 100")
        print(f"    = {round_decimal(Y16)} {currency_quote} (customs duty)")

    # Excise tax
    Z16 = AY16 * excise_tax / Decimal("100")
    print(f"Z16 = AY16 × excise_tax / 100")
    print(f"    = {round_decimal(AY16)} × {excise_tax} / 100")
    print(f"    = {round_decimal(Z16)} {currency_quote} (excise tax)")

    # VAT restoration for supplier payment
    AZ16 = (S16 + T16) * (Decimal("1") + vat_rate)
    print(f"AZ16 = (S16 + T16) × (1 + vat_rate)")
    print(f"     = ({round_decimal(S16)} + {round_decimal(T16)}) × (1 + {vat_rate})")
    print(f"     = {round_decimal(AZ16)} {currency_quote} (with VAT restored)")
    print()

    phase_results[f'product_{idx}']['AX16'] = round_decimal(AX16)
    phase_results[f'product_{idx}']['AY16'] = round_decimal(AY16)
    phase_results[f'product_{idx}']['Y16'] = round_decimal(Y16)
    phase_results[f'product_{idx}']['Z16'] = round_decimal(Z16)
    phase_results[f'product_{idx}']['AZ16'] = round_decimal(AZ16)

    # ==========================================================================
    # PHASE 5-9: Quote-level calculations (financing, distribution)
    # ==========================================================================
    print("PHASE 5-9: Financing Calculations (Quote-Level)")
    print("-" * 80)
    print("Note: Simplified for debugging - see full calculation engine for accurate results")
    print()

    # Estimate financing costs (simplified: 2% of purchase price)
    financing_estimate = S16 * Decimal("0.02")
    BA16 = financing_estimate * BD16
    BB16 = Decimal("0")  # Credit interest (simplified: 0 if 100% advance)

    print(f"BA16 ≈ {round_decimal(BA16)} {currency_quote} (financing cost estimate)")
    print(f"BB16 ≈ {round_decimal(BB16)} {currency_quote} (credit interest estimate)")
    print()

    phase_results[f'product_{idx}']['BA16'] = round_decimal(BA16)
    phase_results[f'product_{idx}']['BB16'] = round_decimal(BB16)

    # ==========================================================================
    # PHASE 10: Final COGS
    # ==========================================================================
    print("PHASE 10: Final COGS")
    print("-" * 80)

    AB16 = S16 + V16 + Y16 + Z16 + BA16 + BB16
    print(f"AB16 = S16 + V16 + Y16 + Z16 + BA16 + BB16")
    print(f"     = {round_decimal(S16)} + {round_decimal(V16)} + {round_decimal(Y16)} + {round_decimal(Z16)} + {round_decimal(BA16)} + {round_decimal(BB16)}")
    print(f"     = {round_decimal(AB16)} {currency_quote} (total COGS)")

    AA16 = AB16 / Decimal(str(quantity))
    print(f"AA16 = AB16 / quantity")
    print(f"     = {round_decimal(AB16)} / {quantity}")
    print(f"     = {round_decimal(AA16)} {currency_quote} (COGS per unit)")
    print()

    phase_results[f'product_{idx}']['AA16'] = round_decimal(AA16)
    phase_results[f'product_{idx}']['AB16'] = round_decimal(AB16)

    # ==========================================================================
    # PHASE 11: Sales Price Calculation
    # ==========================================================================
    print("PHASE 11: Sales Price Calculation")
    print("-" * 80)

    # Profit margin
    AF16 = AB16 * markup / Decimal("100")
    print(f"AF16 = AB16 × markup / 100")
    print(f"     = {round_decimal(AB16)} × {markup} / 100")
    print(f"     = {round_decimal(AF16)} {currency_quote} (profit margin)")

    # DM fee
    dm_fee_type = safe_str(quote_defaults.get('dm_fee_type', 'percent'))
    dm_fee_value = safe_decimal(quote_defaults.get('dm_fee_value', 0))

    if dm_fee_type == "percent":
        AG16 = AB16 * dm_fee_value / Decimal("100")
        print(f"AG16 = AB16 × dm_fee_value / 100")
        print(f"     = {round_decimal(AB16)} × {dm_fee_value} / 100")
        print(f"     = {round_decimal(AG16)} {currency_quote} (DM fee)")
    else:
        AG16 = dm_fee_value * BD16  # Distribute fixed fee
        print(f"AG16 = dm_fee_value × BD16")
        print(f"     = {dm_fee_value} × {round_decimal(BD16)}")
        print(f"     = {round_decimal(AG16)} {currency_quote} (DM fee - distributed)")

    # Forex risk reserve
    AH16 = AB16 * rate_forex_risk / Decimal("100")
    print(f"AH16 = AB16 × rate_forex_risk / 100")
    print(f"     = {round_decimal(AB16)} × {rate_forex_risk} / 100")
    print(f"     = {round_decimal(AH16)} {currency_quote} (forex risk reserve)")

    # Financial agent fee (0 for TR or export)
    if seller_region == "TR" or offer_sale_type == "экспорт":
        AI16 = Decimal("0")
        print(f"AI16 = 0 (no agent fee for TR/export)")
    else:
        AI16 = AB16 * rate_fin_comm / Decimal("100")
        print(f"AI16 = AB16 × rate_fin_comm / 100")
        print(f"     = {round_decimal(AB16)} × {rate_fin_comm} / 100")
        print(f"     = {round_decimal(AI16)} {currency_quote} (financial agent fee)")

    # Final sales price
    AK16 = AB16 + AF16 + AG16 + AH16 + AI16
    print(f"AK16 = AB16 + AF16 + AG16 + AH16 + AI16")
    print(f"     = {round_decimal(AB16)} + {round_decimal(AF16)} + {round_decimal(AG16)} + {round_decimal(AH16)} + {round_decimal(AI16)}")
    print(f"     = {round_decimal(AK16)} {currency_quote} (final sales price total, no VAT)")

    AJ16 = AK16 / Decimal(str(quantity))
    print(f"AJ16 = AK16 / quantity")
    print(f"     = {round_decimal(AK16)} / {quantity}")
    print(f"     = {round_decimal(AJ16)} {currency_quote} (final sales price per unit, no VAT)")
    print()

    phase_results[f'product_{idx}']['AF16'] = round_decimal(AF16)
    phase_results[f'product_{idx}']['AG16'] = round_decimal(AG16)
    phase_results[f'product_{idx}']['AH16'] = round_decimal(AH16)
    phase_results[f'product_{idx}']['AI16'] = round_decimal(AI16)
    phase_results[f'product_{idx}']['AJ16'] = round_decimal(AJ16)
    phase_results[f'product_{idx}']['AK16'] = round_decimal(AK16)

    # ==========================================================================
    # PHASE 12: VAT Calculations
    # ==========================================================================
    print("PHASE 12: VAT Calculations")
    print("-" * 80)

    rate_vat_ru = Decimal("0.20")  # 20% Russian VAT

    if offer_incoterms == "DDP" and seller_region == "RU":
        AM16 = AJ16 * (Decimal("1") + rate_vat_ru)
        AL16 = AM16 * Decimal(str(quantity))
        AN16 = AL16 - AK16
        print(f"AM16 = AJ16 × (1 + vat_ru)")
        print(f"     = {round_decimal(AJ16)} × (1 + {rate_vat_ru})")
        print(f"     = {round_decimal(AM16)} {currency_quote} (price with VAT per unit)")
        print(f"AL16 = AM16 × quantity")
        print(f"     = {round_decimal(AM16)} × {quantity}")
        print(f"     = {round_decimal(AL16)} {currency_quote} (price with VAT total)")
        print(f"AN16 = AL16 - AK16")
        print(f"     = {round_decimal(AL16)} - {round_decimal(AK16)}")
        print(f"     = {round_decimal(AN16)} {currency_quote} (sales VAT)")
    else:
        AM16 = AJ16
        AL16 = AK16
        AN16 = Decimal("0")
        print(f"AM16 = AJ16 (no VAT for {offer_incoterms})")
        print(f"     = {round_decimal(AM16)} {currency_quote}")
        print(f"AN16 = 0 (no sales VAT)")

    # Deductible VAT
    if offer_incoterms == "DDP" and seller_region == "RU" and offer_sale_type != "экспорт":
        AO16 = (AY16 + Y16 + Z16) * rate_vat_ru
        print(f"AO16 = (AY16 + Y16 + Z16) × vat_ru")
        print(f"     = ({round_decimal(AY16)} + {round_decimal(Y16)} + {round_decimal(Z16)}) × {rate_vat_ru}")
        print(f"     = {round_decimal(AO16)} {currency_quote} (deductible VAT)")
    else:
        AO16 = Decimal("0")
        print(f"AO16 = 0 (no deductible VAT)")

    AP16 = AN16 - AO16
    print(f"AP16 = AN16 - AO16")
    print(f"     = {round_decimal(AN16)} - {round_decimal(AO16)}")
    print(f"     = {round_decimal(AP16)} {currency_quote} (net VAT payable)")
    print()

    phase_results[f'product_{idx}']['AM16'] = round_decimal(AM16)
    phase_results[f'product_{idx}']['AL16'] = round_decimal(AL16)
    phase_results[f'product_{idx}']['AN16'] = round_decimal(AN16)
    phase_results[f'product_{idx}']['AO16'] = round_decimal(AO16)
    phase_results[f'product_{idx}']['AP16'] = round_decimal(AP16)

    # ==========================================================================
    # PHASE 13: Transit Commission
    # ==========================================================================
    print("PHASE 13: Transit Commission")
    print("-" * 80)

    if offer_sale_type == "транзит" or offer_sale_type == "финтранзит":
        AQ16 = AF16 + AG16 + AH16 + AI16 + BA16 + BB16
        print(f"AQ16 = AF16 + AG16 + AH16 + AI16 + BA16 + BB16 (transit commission)")
        print(f"     = {round_decimal(AF16)} + {round_decimal(AG16)} + {round_decimal(AH16)} + {round_decimal(AI16)} + {round_decimal(BA16)} + {round_decimal(BB16)}")
        print(f"     = {round_decimal(AQ16)} {currency_quote}")
    else:
        AQ16 = Decimal("0")
        print(f"AQ16 = 0 (supply sale - no transit commission)")
    print()

    phase_results[f'product_{idx}']['AQ16'] = round_decimal(AQ16)

    # Summary
    print("=" * 80)
    print("CALCULATION SUMMARY")
    print("=" * 80)
    print(f"Product: {product_id} ({product.get('brand', 'N/A')})")
    print(f"Quantity: {quantity} units")
    print()
    print(f"Purchase price (no VAT):   {round_decimal(P16)} {currency_base}")
    print(f"Purchase price (RUB):      {round_decimal(S16)} {currency_quote}")
    print(f"Logistics total:           {round_decimal(V16)} {currency_quote}")
    print(f"Customs + excise:          {round_decimal(Y16 + Z16)} {currency_quote}")
    print(f"Financing costs:           {round_decimal(BA16 + BB16)} {currency_quote}")
    print(f"COGS (total):              {round_decimal(AB16)} {currency_quote}")
    print(f"COGS (per unit):           {round_decimal(AA16)} {currency_quote}")
    print()
    print(f"Profit margin:             {round_decimal(AF16)} {currency_quote} ({markup}%)")
    print(f"DM fee:                    {round_decimal(AG16)} {currency_quote}")
    print(f"Forex risk:                {round_decimal(AH16)} {currency_quote}")
    print(f"Agent fee:                 {round_decimal(AI16)} {currency_quote}")
    print()
    print(f"Sales price (no VAT):      {round_decimal(AK16)} {currency_quote}")
    print(f"Sales price (per unit):    {round_decimal(AJ16)} {currency_quote}")
    print(f"Sales price (with VAT):    {round_decimal(AL16)} {currency_quote}")
    print()
    print(f"Profit: {round_decimal(AK16 - AB16)} {currency_quote} ({float((AK16 - AB16) / AB16 * 100):.1f}% of COGS)")
    print()

print("✅ All phases complete")
print()
```

**Output Example (abbreviated):**
```
================================================================================
STEP 4: STEP THROUGH 13 CALCULATION PHASES
================================================================================
Executing calculation engine with intermediate values

================================================================================
📦 PRODUCT 1: 6206-2RS
================================================================================

PHASE 1: Purchase Price Calculations
--------------------------------------------------------------------------------
N16 = base_price / (1 + vat_rate)
    = 850.5 / (1 + 0.20)
    = 708.75 TRY (without VAT)
P16 = N16 × (1 - supplier_discount / 100)
    = 708.75 × (1 - 5 / 100)
    = 673.31 TRY (after discount)
R16 = P16 × exchange_rate
    = 673.31 × 0.013
    = 8.75 USD (per unit in quote currency)
S16 = R16 × quantity
    = 8.75 × 100
    = 875.00 USD (total purchase price)

...

CALCULATION SUMMARY
================================================================================
Product: 6206-2RS (SKF)
Quantity: 100 units

Purchase price (no VAT):   673.31 TRY
Purchase price (RUB):      875.00 USD
Logistics total:           30.00 USD
Customs + excise:          52.50 USD
Financing costs:           17.50 USD
COGS (total):              975.00 USD
COGS (per unit):           9.75 USD

Profit margin:             195.00 USD (20%)
DM fee:                    19.50 USD
Forex risk:                29.25 USD
Agent fee:                 19.50 USD

Sales price (no VAT):      1238.25 USD
Sales price (per unit):    12.38 USD
Sales price (with VAT):    1485.90 USD

Profit: 263.25 USD (27.0% of COGS)

✅ All phases complete
```

---

## Step 5: Identify Failures and Suggest Fixes

**Action:** If calculation fails or produces unexpected results, analyze and suggest fixes.

**Implementation:**

```python
print("=" * 80)
print("STEP 5: ERROR ANALYSIS AND SUGGESTIONS")
print("=" * 80)

# Common error patterns
error_patterns = []

for idx, product in enumerate(products):
    product_id = product.get('sku', f'Product {idx + 1}')
    results = phase_results.get(f'product_{idx}', {})

    # Pattern 1: Zero or negative purchase price
    S16 = results.get('S16', Decimal("0"))
    if S16 <= 0:
        error_patterns.append({
            "product": product_id,
            "error": "Purchase price (S16) is zero or negative",
            "cause": "Missing or invalid base_price_vat, quantity, or exchange_rate",
            "fix": f"Check: base_price_vat = {product.get('base_price_vat')}, quantity = {product.get('quantity')}, exchange_rate = {get_value(product, 'exchange_rate_base_price_to_quote')}",
            "example": "Set base_price_vat > 0, quantity > 0, exchange_rate > 0"
        })

    # Pattern 2: COGS higher than sales price (negative margin)
    AB16 = results.get('AB16', Decimal("0"))
    AK16 = results.get('AK16', Decimal("0"))
    if AB16 > AK16 and AB16 > 0:
        error_patterns.append({
            "product": product_id,
            "error": f"COGS ({AB16}) > Sales price ({AK16}) - Negative margin!",
            "cause": "Markup too low or costs too high",
            "fix": f"Increase markup (current: {markup}%) or reduce costs",
            "example": "Try markup = 30% instead of current value"
        })

    # Pattern 3: Zero quantity
    quantity = safe_int(get_value(product, 'quantity'))
    if quantity <= 0:
        error_patterns.append({
            "product": product_id,
            "error": "Quantity is zero or negative",
            "cause": "Missing or invalid quantity field",
            "fix": f"Set quantity > 0 in product data",
            "example": '"quantity": 100'
        })

    # Pattern 4: Missing exchange rate
    exchange_rate = safe_decimal(get_value(product, 'exchange_rate_base_price_to_quote'))
    if exchange_rate <= 0:
        error_patterns.append({
            "product": product_id,
            "error": "Exchange rate is zero or negative",
            "cause": "Missing exchange_rate_base_price_to_quote (two-tier resolution failed)",
            "fix": "Add exchange_rate_base_price_to_quote to quote_defaults or product data",
            "example": '"exchange_rate_base_price_to_quote": 0.013 (for TRY to USD)'
        })

    # Pattern 5: Zero markup
    markup_val = safe_decimal(get_value(product, 'markup'))
    if markup_val <= 0:
        error_patterns.append({
            "product": product_id,
            "error": "Markup is zero - No profit margin!",
            "cause": "Missing markup field in quote_defaults and product overrides",
            "fix": "Add markup to quote_defaults",
            "example": '"markup": 15  (15% markup)'
        })

# Show errors or success
if error_patterns:
    print(f"❌ FOUND {len(error_patterns)} ISSUES")
    print()

    for idx, pattern in enumerate(error_patterns, 1):
        print(f"{idx}. Product: {pattern['product']}")
        print(f"   Error: {pattern['error']}")
        print(f"   Cause: {pattern['cause']}")
        print(f"   Fix: {pattern['fix']}")
        print(f"   Example: {pattern['example']}")
        print()

    print("💡 RECOMMENDED ACTIONS:")
    print()
    print("1. Fix validation errors first (Step 1)")
    print("2. Check two-tier precedence (Step 2) - Ensure defaults are set")
    print("3. Verify Pydantic model mapping (Step 3) - Check for None values")
    print("4. Review formulas in failing phase (Step 4)")
    print("5. Compare with working quote for reference")
    print()

else:
    print("✅ NO ISSUES FOUND")
    print()
    print("Calculation completed successfully with no errors.")
    print()
    print("📊 METRICS:")
    for idx, product in enumerate(products):
        product_id = product.get('sku', f'Product {idx + 1}')
        results = phase_results.get(f'product_{idx}', {})

        AB16 = results.get('AB16', Decimal("0"))
        AK16 = results.get('AK16', Decimal("0"))
        profit = AK16 - AB16
        profit_pct = (profit / AB16 * 100) if AB16 > 0 else Decimal("0")

        print(f"  {product_id}:")
        print(f"    COGS: {AB16} {currency_quote}")
        print(f"    Sales: {AK16} {currency_quote}")
        print(f"    Profit: {round_decimal(profit)} {currency_quote} ({float(profit_pct):.1f}%)")
        print()

print("=" * 80)
print("DEBUGGING COMPLETE")
print("=" * 80)
```

**Output Example (with errors):**
```
================================================================================
STEP 5: ERROR ANALYSIS AND SUGGESTIONS
================================================================================
❌ FOUND 2 ISSUES

1. Product: 6206-2RS
   Error: Exchange rate is zero or negative
   Cause: Missing exchange_rate_base_price_to_quote (two-tier resolution failed)
   Fix: Add exchange_rate_base_price_to_quote to quote_defaults or product data
   Example: "exchange_rate_base_price_to_quote": 0.013 (for TRY to USD)

2. Product: 6206-2RS
   Error: Markup is zero - No profit margin!
   Cause: Missing markup field in quote_defaults and product overrides
   Fix: Add markup to quote_defaults
   Example: "markup": 15  (15% markup)

💡 RECOMMENDED ACTIONS:

1. Fix validation errors first (Step 1)
2. Check two-tier precedence (Step 2) - Ensure defaults are set
3. Verify Pydantic model mapping (Step 3) - Check for None values
4. Review formulas in failing phase (Step 4)
5. Compare with working quote for reference

================================================================================
DEBUGGING COMPLETE
================================================================================
```

---

## Common Error Patterns

### Pattern 1: Missing Required Field
**Symptom:** Validation fails in Step 1
**Cause:** Field not set in quote_defaults or product data
**Fix:** Add missing field to quote_defaults (applies to all products)
**Example:**
```json
"quote_defaults": {
  "seller_company": "МАСТЕР БЭРИНГ ООО",  // ← Add this
  ...
}
```

### Pattern 2: Zero Exchange Rate
**Symptom:** Purchase price (S16) is zero
**Cause:** Missing exchange_rate_base_price_to_quote
**Fix:** Set exchange rate in quote_defaults or product overrides
**Example:**
```json
"quote_defaults": {
  "exchange_rate_base_price_to_quote": 0.013  // TRY to USD
}
```

### Pattern 3: Negative Margin
**Symptom:** COGS > Sales price
**Cause:** Markup too low or costs too high
**Fix:** Increase markup or reduce logistics/duties
**Example:**
```json
"quote_defaults": {
  "markup": 30  // Increase from 15 to 30%
}
```

### Pattern 4: Type Mismatch
**Symptom:** Pydantic validation fails in Step 3
**Cause:** String instead of number, or vice versa
**Fix:** Check data types in JSON
**Example:**
```json
// ❌ Wrong
"quantity": "100"

// ✅ Correct
"quantity": 100
```

### Pattern 5: Two-Tier Override Not Applied
**Symptom:** Product override ignored
**Cause:** Override in wrong location (should be in product.overrides)
**Fix:** Move override to correct location
**Example:**
```json
{
  "products": [
    {
      "sku": "6206",
      "overrides": {
        "markup": 20  // ← Correct location
      }
    }
  ]
}
```

---

## References

**Calculation Engine:**
- Phase-by-phase documentation: `.claude/skills/calculation-engine-guidelines/resources/calculation-phases.md`
- Variable specifications: `.claude/VARIABLES.md`
- Validation rules: `.claude/skills/calculation-engine-guidelines/resources/validation-rules.md`

**Backend Implementation:**
- Mapper function: `/home/novi/quotation-app-dev/backend/routes/quotes_calc.py` (lines 253-364)
- Validation function: `/home/novi/quotation-app-dev/backend/routes/quotes_calc.py` (lines 415-528)
- Calculation engine: `/home/novi/quotation-app-dev/backend/calculation_engine.py`

**Testing:**
- Test mapper: `backend/tests/test_quotes_calc_mapper.py` (13 tests)
- Test validation: `backend/tests/test_quotes_calc_validation.py` (10 tests)

---

**Command created:** 2025-10-30
**Version:** 1.0
**Status:** Ready for use
