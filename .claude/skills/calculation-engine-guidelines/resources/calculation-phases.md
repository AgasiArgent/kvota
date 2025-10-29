# Calculation Engine - 13 Sequential Phases

**Reference:** `calculation_engine.py` (lines 143-763)
**Last Updated:** 2025-10-29
**Status:** Production Ready (✅ 15/15 tests passing)

---

## Phase Overview Diagram

```
INPUT: Quote + Products
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 1: Purchase Price Calculations      │ (143-179)
    │ Variables: N16, P16, R16, S16            │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 2: Distribution Base                │ (186-201)
    │ Variables: S13, BD16 [Distribution Key]  │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 3: Logistics Distribution           │ (208-258)
    │ Variables: T16, U16, V16                 │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 4: Internal Pricing & Duties        │ (265-319)
    │ Variables: AX16, AY16, Y16, Z16, AZ16    │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 5: Supplier Payment                 │ (326-359)
    │ Variables: BH6, BH4                       │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 6: Revenue Estimation               │ (362-412)
    │ Variables: BH2                            │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 7: Financing Costs                  │ (415-492)
    │ Variables: BH3, BH7, BJ7, BH10, BJ10, BJ11│
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 8: Credit Sales Interest            │ (499-529)
    │ Variables: BL3, BL4, BL5                 │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 9: Distribute Financing             │ (532-556)
    │ Variables: BA16, BB16                     │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 10: Final COGS                      │ (559-590)
    │ Variables: AB16, AA16                     │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 11: Sales Price Calculation         │ (593-686)
    │ Variables: AF16, AG16, AH16, AI16, AD16,  │
    │            AE16, AJ16, AK16              │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 12: VAT Calculations                │ (689-735)
    │ Variables: AM16, AL16, AN16, AO16, AP16  │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 13: Transit Commission              │ (742-763)
    │ Variables: AQ16                           │
    └───────────────────────────────────────────┘
        ↓
OUTPUT: Complete Quote Calculations
```

---

## Phase 1: Purchase Price Calculations

**Location:** `calculation_engine.py` lines 143-179
**Execution:** Per-product (loop)
**Dependencies:** None (input phase)

### Purpose
Calculate purchase price in quote currency with VAT removal and discounts applied.

### Inputs
- `base_price` - Supplier quoted price (quoted currency)
- `quantity` - Units
- `supplier_country` - Turkey, China, Lithuania, etc.
- `supplier_discount_percent` - Discount % (0-100)
- `currency_rate` - Exchange rate from quoted currency to RUB
- `quote_currency` - USD, EUR, RUB, etc.

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| N16 | N column | Price without VAT | Decimal |
| P16 | P column | Price after supplier discount | Decimal |
| R16 | R column | Per-unit price in quote currency | Decimal |
| S16 | S column | Total purchase price (base for calculations) | Decimal |

### Special Cases
- **China suppliers:** Prices already VAT-free (no VAT removal)
- **Other suppliers:** VAT removed based on supplier_country VAT rate
- **Currency conversion:** Applied using currency_rate

### Formula
```
N16 = base_price / (1 + VAT_rate_seller_country) if supplier_country != "China"
P16 = N16 × (1 - supplier_discount_percent / 100)
R16 = P16 × currency_rate (convert to RUB)
S16 = R16 × quantity
```

### Implementation Pattern
```python
def phase1_purchase_price(
    base_price: Decimal,
    quantity: Decimal,
    supplier_country: str,
    supplier_discount_percent: Decimal,
    currency_rate: Decimal,
    quote_currency: str
) -> dict:
    """Calculate purchase price in quote currency."""
    # Get VAT rate for supplier country
    vat_rate = get_vat_seller_country(supplier_country)

    # Remove VAT (except China)
    if supplier_country != "China":
        N16 = base_price / (Decimal("1") + vat_rate)
    else:
        N16 = base_price

    # Apply supplier discount
    P16 = N16 * (Decimal("1") - supplier_discount_percent / Decimal("100"))

    # Convert to quote currency
    R16 = P16 * currency_rate
    S16 = R16 * quantity

    return {
        "N16": round_decimal(N16),
        "P16": round_decimal(P16),
        "R16": round_decimal(R16),
        "S16": round_decimal(S16)
    }
```

---

## Phase 2: Distribution Base

**Location:** `calculation_engine.py` lines 186-201
**Execution:** Quote-level (calculated once)
**Dependencies:** Phase 1 (uses S16 values)

### Purpose
Calculate proportional distribution key for multi-product quotes. This key (BD16) is used to distribute quote-level costs (logistics, financing) proportionally to each product.

### Inputs
- `S16_list` - Purchase price total per product (from Phase 1)
- `products_count` - Number of products

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| S13 | S column, row 13 | Total purchase price across all products | Decimal |
| BD16 | BD column | Distribution base per product (S16/S13) | Decimal |

### Formula
```
S13 = SUM(S16) for all products
BD16[i] = S16[i] / S13 (represents proportion of product i to total)
```

### Key Insight
**BD16 is the distribution key** used throughout phases 3-9 to proportionally distribute quote-level costs. All products' BD16 values sum to 1.0.

### Implementation Pattern
```python
def phase2_distribution_base(S16_list: list[Decimal]) -> dict:
    """Calculate distribution base for multi-product quotes."""
    S13 = sum(S16_list)

    if S13 <= 0:
        raise ValueError("Total purchase price must be > 0")

    BD16_list = [S16 / S13 for S16 in S16_list]

    return {
        "S13": round_decimal(S13),
        "BD16": [round_decimal(bd) for bd in BD16_list]
    }
```

---

## Phase 3: Logistics Distribution

**Location:** `calculation_engine.py` lines 208-258
**Execution:** Per-product (loop)
**Dependencies:** Phase 1 (S16), Phase 2 (BD16)

### Purpose
Distribute quote-level logistics costs proportionally to each product, including supplier-to-hub, hub-to-client, and insurance costs.

### Inputs (Quote-level)
- `logistics_supplier_hub` - Cost from supplier to hub (W2+W3+W5+W8)
- `logistics_hub_customs` - Cost at customs checkpoint (W4+W6+W7+W9)
- `insurance_total` - Total insurance cost (calculated in orchestrator)

### Inputs (Per-product)
- `BD16` - Distribution base from Phase 2
- `quantity` - Units (for per-unit insurance)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| T16 | T column | First leg logistics (supplier → hub) | Decimal |
| U16 | U column | Last leg logistics (hub → client) + insurance | Decimal |
| V16 | V column | Total logistics (T16 + U16) | Decimal |

### Formula
```
T16 = (logistics_supplier_hub) × BD16
U16 = (logistics_hub_customs) × BD16 + insurance_per_product
V16 = T16 + U16
```

### Insurance Distribution
- **Quote-level:** `insurance_total = ROUNDUP(AY13_total × rate_insurance, 1 decimal)`
- **Per-product:** `insurance_per_product = insurance_total × BD16`
- **Distribution key:** Value proportion (BD16), NOT quantity

### Implementation Pattern
```python
def phase3_logistics_distribution(
    logistics_supplier_hub: Decimal,
    logistics_hub_customs: Decimal,
    insurance_per_product: Decimal,
    BD16: Decimal
) -> dict:
    """Distribute logistics costs proportionally to product."""
    T16 = logistics_supplier_hub * BD16
    U16 = logistics_hub_customs * BD16 + insurance_per_product
    V16 = T16 + U16

    return {
        "T16": round_decimal(T16),
        "U16": round_decimal(U16),
        "V16": round_decimal(V16)
    }
```

---

## Phase 4: Internal Pricing & Duties

**Location:** `calculation_engine.py` lines 265-319
**Execution:** Per-product (loop)
**Dependencies:** Phase 1 (R16, P16), Phase 2 (BD16)

### Purpose
Calculate internal sale price (AY16), customs duty (Y16), excise tax (Z16), and restore VAT for supplier payment (AZ16).

### Inputs
- `R16` - Per-unit purchase price (from Phase 1)
- `quantity` - Units
- `internal_markup` - Additional markup % for internal pricing
- `import_tariff_rate` - Customs duty rate
- `excise_tax_type` - "percent" or "per_kg"
- `excise_tax_value` - Rate or RUB/kg
- `weight_kg` - Total weight
- `supplier_country` - For VAT restoration
- `incoterms` - DDP, EXW, CPT, etc.

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| AX16 | AX column | Internal sale price per unit | Decimal |
| AY16 | AY column | Internal sale price total | Decimal |
| Y16 | Y column | Customs fee (import tariff) | Decimal |
| Z16 | Z column | Excise tax | Decimal |
| AZ16 | AZ column | Purchase price with VAT restored | Decimal |

### Special Cases

**Customs Duty (Y16):**
- Turkish seller export: Y16 = 0 (no tariff on export)
- DDP incoterms: Y16 calculated on AY16 (supply value)
- Transit: Y16 calculated on S16 (transit value)

**VAT Restoration (AZ16):**
- Used for supplier payment calculation
- Adds back VAT based on supplier_country
- Chinese suppliers: VAT rate 13%
- Turkish suppliers: VAT rate 20%
- EU suppliers: VAT rate varies (Lithuania 21%, etc.)

### Formula
```
AX16 = R16 × (1 + internal_markup / 100)
AY16 = AX16 × quantity
Y16 = AY16 × import_tariff_rate (depends on incoterms/region)
Z16 = Calculate excise based on type (percent of AY16 or RUB/kg × weight)
AZ16 = S16 + T16 × (1 + VAT_seller_country)
```

### Implementation Pattern
```python
def phase4_internal_pricing_duties(
    R16: Decimal,
    quantity: Decimal,
    internal_markup: Decimal,
    import_tariff_rate: Decimal,
    excise_tax_type: str,
    excise_tax_value: Decimal,
    weight_kg: Decimal,
    supplier_country: str,
    incoterms: str,
    seller_region: str,
    S16: Decimal,
    T16: Decimal
) -> dict:
    """Calculate internal pricing and duties."""
    # Internal sale price
    AX16 = R16 * (Decimal("1") + internal_markup / Decimal("100"))
    AY16 = AX16 * quantity

    # Customs duty (0 if Turkish export or seller region = TR)
    if seller_region == "TR":
        Y16 = Decimal("0")
    else:
        Y16 = AY16 * import_tariff_rate if incoterms == "DDP" else Decimal("0")

    # Excise tax
    if excise_tax_type == "percent":
        Z16 = AY16 * excise_tax_value / Decimal("100")
    elif excise_tax_type == "per_kg":
        Z16 = weight_kg * excise_tax_value
    else:
        Z16 = Decimal("0")

    # VAT restoration
    vat_rate = get_vat_seller_country(supplier_country)
    AZ16 = S16 + T16 * (Decimal("1") + vat_rate)

    return {
        "AX16": round_decimal(AX16),
        "AY16": round_decimal(AY16),
        "Y16": round_decimal(Y16),
        "Z16": round_decimal(Z16),
        "AZ16": round_decimal(AZ16)
    }
```

---

## Phase 5: Supplier Payment

**Location:** `calculation_engine.py` lines 326-359
**Execution:** Quote-level (uses aggregated values)
**Dependencies:** Phase 3 (T13, U13), Phase 4 (AZ13)

### Purpose
Calculate total amount needed to pay supplier, including advance and financing commission.

### Inputs
- `AZ13` - Total purchase price with VAT (from Phase 4, aggregated)
- `T13` - Total first-leg logistics (from Phase 3, aggregated)
- `U13` - Total last-leg logistics (from Phase 3, aggregated)
- `advance_to_supplier_percent` - % of advance payment to supplier (0-100)
- `rate_fin_comm` - Financial commission rate (admin setting)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| BH6 | BH column | Supplier payment with advance and commission | Decimal |
| BH4 | BH column | Total before forwarding | Decimal |

### Formula
```
BH6 = (AZ13 + T13) × (1 + advance_to_supplier / 100) × (1 + rate_fin_comm / 100)
BH4 = BH6 + U13
```

### Implementation Pattern
```python
def phase5_supplier_payment(
    AZ13: Decimal,
    T13: Decimal,
    U13: Decimal,
    advance_to_supplier_percent: Decimal,
    rate_fin_comm: Decimal
) -> dict:
    """Calculate supplier payment amount."""
    advance_factor = Decimal("1") + advance_to_supplier_percent / Decimal("100")
    commission_factor = Decimal("1") + rate_fin_comm / Decimal("100")

    BH6 = (AZ13 + T13) * advance_factor * commission_factor
    BH4 = BH6 + U13

    return {
        "BH6": round_decimal(BH6),
        "BH4": round_decimal(BH4)
    }
```

---

## Phase 6: Revenue Estimation

**Location:** `calculation_engine.py` lines 362-412
**Execution:** Quote-level
**Dependencies:** Phase 4 (AY13 internal value), Markup variables

### Purpose
Estimate total revenue from quote considering markup, forex risk buffer, and DM fee.

### Inputs
- `AY13` - Total internal sale price (from Phase 4, aggregated)
- `markup_percent` - Markup % applied to COGS
- `rate_forex_risk` - Forex risk buffer % (admin setting)
- `dm_fee_type` - "percent" or "fixed"
- `dm_fee_value` - DM fee amount or percentage

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| BH2 | BH column, row 2 | Evaluated revenue (estimated) | Decimal |

### Formula
```
base_revenue = AY13 × (1 + markup / 100)
forex_reserve = base_revenue × (rate_forex_risk / 100)
dm_fee = base_revenue × (dm_fee / 100) if type="percent" else dm_fee

BH2 = base_revenue + forex_reserve + dm_fee
```

### Implementation Pattern
```python
def phase6_revenue_estimation(
    AY13: Decimal,
    markup_percent: Decimal,
    rate_forex_risk: Decimal,
    dm_fee_type: str,
    dm_fee_value: Decimal
) -> dict:
    """Estimate total revenue."""
    base_revenue = AY13 * (Decimal("1") + markup_percent / Decimal("100"))

    forex_reserve = base_revenue * rate_forex_risk / Decimal("100")

    if dm_fee_type == "percent":
        dm_fee = base_revenue * dm_fee_value / Decimal("100")
    else:
        dm_fee = dm_fee_value

    BH2 = base_revenue + forex_reserve + dm_fee

    return {"BH2": round_decimal(BH2)}
```

---

## Phase 7: Financing Costs

**Location:** `calculation_engine.py` lines 415-492
**Execution:** Quote-level
**Dependencies:** Phase 5 (BH6), Phase 6 (BH2)

### Purpose
Calculate loan interest for supplier payments and operational financing using compound interest formula (FV - Future Value).

### Inputs
- `BH6` - Supplier payment amount (from Phase 5)
- `BH2` - Revenue estimation (from Phase 6)
- `BH3` - Client advance amount (input)
- `advance_from_client_percent` - % of advance from client (0-100)
- `delivery_days` - Days until delivery (for time-based interest)
- `rate_loan_interest_daily` - Daily interest rate % (admin setting)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| BH3 | BH column | Client advance amount | Decimal |
| BH7 | BH column | Supplier financing need (BH6 - client advance) | Decimal |
| BJ7 | BJ column | Supplier financing cost (interest) | Decimal |
| BH10 | BH column | Operational financing need | Decimal |
| BJ10 | BJ column | Operational financing cost (interest) | Decimal |
| BJ11 | BJ column | Total financing cost (BJ7 + BJ10) | Decimal |

### Formula
```
BH3 = BH2 × (advance_from_client_percent / 100)
BH7 = BH6 - BH3 (supplier financing gap)
BJ7 = BH7 × ((1 + rate_loan_interest_daily/100)^delivery_days - 1)

BH10 = BH3 (operational: money paid by client upfront)
BJ10 = BH10 × ((1 + rate_loan_interest_daily/100)^delivery_days - 1)

BJ11 = BJ7 + BJ10
```

### Implementation Pattern
```python
def phase7_financing_costs(
    BH6: Decimal,
    BH2: Decimal,
    advance_from_client_percent: Decimal,
    delivery_days: Decimal,
    rate_loan_interest_daily: Decimal
) -> dict:
    """Calculate financing costs using compound interest."""
    # Client advance
    BH3 = BH2 * advance_from_client_percent / Decimal("100")

    # Supplier financing need
    BH7 = BH6 - BH3

    # Financing interest (using FV formula)
    rate_daily = rate_loan_interest_daily / Decimal("100")
    interest_factor = (Decimal("1") + rate_daily) ** delivery_days - Decimal("1")

    BJ7 = BH7 * interest_factor
    BH10 = BH3
    BJ10 = BH10 * interest_factor
    BJ11 = BJ7 + BJ10

    return {
        "BH3": round_decimal(BH3),
        "BH7": round_decimal(BH7),
        "BJ7": round_decimal(BJ7),
        "BH10": round_decimal(BH10),
        "BJ10": round_decimal(BJ10),
        "BJ11": round_decimal(BJ11)
    }
```

---

## Phase 8: Credit Sales Interest

**Location:** `calculation_engine.py` lines 499-529
**Execution:** Quote-level
**Dependencies:** Phase 6 (BH2), Phase 7 (BH3)

### Purpose
Calculate interest on credit sales if client does not pay 100% upfront.

### Inputs
- `BH2` - Revenue estimation (from Phase 6)
- `BH3` - Client advance amount (from Phase 7)
- `credit_days` - Days client has to pay (if not 100% upfront)
- `rate_loan_interest_daily` - Daily interest rate (admin setting)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| BL3 | BL column | Credit sales amount (BH2 - BH3) | Decimal |
| BL4 | BL column | Credit sales with interest | Decimal |
| BL5 | BL column | Credit sales interest | Decimal |

### Logic
Only calculated if `advance_from_client_percent < 100%`

### Formula
```
BL3 = BH2 - BH3 (unpaid amount)
BL4 = BL3 × (1 + rate_loan_interest_daily/100)^credit_days
BL5 = BL4 - BL3 (interest = final - principal)
```

### Implementation Pattern
```python
def phase8_credit_sales_interest(
    BH2: Decimal,
    BH3: Decimal,
    credit_days: Decimal,
    rate_loan_interest_daily: Decimal
) -> dict:
    """Calculate credit sales interest."""
    BL3 = BH2 - BH3

    if BL3 <= 0:
        # No credit sales (100% advance)
        return {
            "BL3": Decimal("0"),
            "BL4": Decimal("0"),
            "BL5": Decimal("0")
        }

    rate_daily = rate_loan_interest_daily / Decimal("100")
    interest_factor = (Decimal("1") + rate_daily) ** credit_days

    BL4 = BL3 * interest_factor
    BL5 = BL4 - BL3

    return {
        "BL3": round_decimal(BL3),
        "BL4": round_decimal(BL4),
        "BL5": round_decimal(BL5)
    }
```

---

## Phase 9: Distribute Financing

**Location:** `calculation_engine.py` lines 532-556
**Execution:** Per-product (loop)
**Dependencies:** Phase 7 (BJ11), Phase 8 (BL5), Phase 2 (BD16)

### Purpose
Distribute quote-level financing costs proportionally to each product.

### Inputs
- `BJ11` - Total financing cost from supplier/operational (from Phase 7)
- `BL5` - Total credit sales interest (from Phase 8)
- `BD16` - Distribution base (from Phase 2)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| BA16 | BA column | Initial financing cost per product | Decimal |
| BB16 | BB column | Credit interest per product | Decimal |

### Formula
```
BA16 = BJ11 × BD16
BB16 = BL5 × BD16
```

### Implementation Pattern
```python
def phase9_distribute_financing(
    BJ11: Decimal,
    BL5: Decimal,
    BD16: Decimal
) -> dict:
    """Distribute financing costs proportionally."""
    BA16 = BJ11 * BD16
    BB16 = BL5 * BD16

    return {
        "BA16": round_decimal(BA16),
        "BB16": round_decimal(BB16)
    }
```

---

## Phase 10: Final COGS

**Location:** `calculation_engine.py` lines 559-590
**Execution:** Per-product (loop)
**Dependencies:** Phase 1 (S16), Phase 3 (V16), Phase 4 (Y16, Z16), Phase 9 (BA16, BB16)

### Purpose
Calculate final cost of goods sold (COGS) including all costs: purchase, logistics, duties, and financing.

### Inputs
- `S16` - Purchase price total (from Phase 1)
- `V16` - Total logistics costs (from Phase 3)
- `Y16` - Customs duty (from Phase 4)
- `Z16` - Excise tax (from Phase 4)
- `BA16` - Financing cost (from Phase 9)
- `BB16` - Credit interest (from Phase 9)
- `quantity` - Units

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| AB16 | AB column | COGS total per product | Decimal |
| AA16 | AA column | COGS per unit | Decimal |

### Formula
```
AB16 = S16 + V16 + Y16 + Z16 + BA16 + BB16
AA16 = AB16 / quantity
```

### Implementation Pattern
```python
def phase10_final_cogs(
    S16: Decimal,
    V16: Decimal,
    Y16: Decimal,
    Z16: Decimal,
    BA16: Decimal,
    BB16: Decimal,
    quantity: Decimal
) -> dict:
    """Calculate final cost of goods sold."""
    AB16 = S16 + V16 + Y16 + Z16 + BA16 + BB16

    if quantity <= 0:
        raise ValueError("Quantity must be > 0")

    AA16 = AB16 / quantity

    return {
        "AA16": round_decimal(AA16),
        "AB16": round_decimal(AB16)
    }
```

---

## Phase 11: Sales Price Calculation

**Location:** `calculation_engine.py` lines 593-686
**Execution:** Per-product (loop)
**Dependencies:** Phase 10 (AB16, AA16), Phase 3 (V16), Phase 1 (S16)

### Purpose
Calculate final sales price with markup, DM fee, forex risk reserve, and financial agent fees. Different for transit vs supply sales.

### Inputs
- `AB16` - COGS total (from Phase 10)
- `AA16` - COGS per unit (from Phase 10)
- `markup_percent` - Markup % on COGS
- `rate_forex_risk` - Forex risk buffer % (admin setting)
- `dm_fee_type` - "percent" or "fixed"
- `dm_fee_value` - DM fee amount or percentage
- `rate_financial_agent_fee` - Agent fee % (default 2.5%, 0 for export/TR)
- `quantity` - Units
- `incoterms` - DDP, EXW, etc. (affects pricing base)
- `seller_region` - TR, RU, etc. (0 agent fee if TR)
- `sale_type` - "supply" or "transit"
- `S16` - Purchase price (for transit sales)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| AF16 | AF column | Profit margin per product | Decimal |
| AG16 | AG column | DM fee | Decimal |
| AH16 | AH column | Forex risk reserve | Decimal |
| AI16 | AI column | Financial agent fee | Decimal |
| AD16 | AD column | Sale price per unit (excl. financial fees) | Decimal |
| AE16 | AE column | Sale price total (excl. financial fees) | Decimal |
| AJ16 | AJ column | Final sales price per unit (no VAT) | Decimal |
| AK16 | AK column | Final sales price total (no VAT) | Decimal |

### Special Cases

**Transit Sales:**
- Pricing base: S16 (purchase price) instead of AB16 (COGS)
- Commission calculated differently (Phase 13)

**Export Sales:**
- No financial agent fee (AI16 = 0)

**Turkish Seller Region:**
- No financial agent fee (AI16 = 0)

### Formula
```
AF16 = AB16 × (markup / 100)
AG16 = AB16 × (dm_fee / 100) if type="percent" else dm_fee
AH16 = AB16 × (rate_forex_risk / 100)
AI16 = AB16 × (rate_financial_agent_fee / 100) if not (export or TR) else 0

# For transit: use S16 instead of AB16
AD16 = (AB16 + AF16 + AG16 + AH16 + AI16) / quantity
AE16 = AD16 × quantity
AJ16 = (AB16 + AF16 + AG16 + AH16 + AI16) / quantity
AK16 = AJ16 × quantity
```

### Implementation Pattern
```python
def phase11_sales_price(
    AB16: Decimal,
    AA16: Decimal,
    markup_percent: Decimal,
    rate_forex_risk: Decimal,
    dm_fee_type: str,
    dm_fee_value: Decimal,
    rate_financial_agent_fee: Decimal,
    quantity: Decimal,
    incoterms: str,
    seller_region: str,
    sale_type: str,
    S16: Decimal = None
) -> dict:
    """Calculate final sales price with all fees."""
    # Use S16 for transit sales, AB16 for supply
    base_cogs = S16 if sale_type == "transit" else AB16

    # Calculate components
    AF16 = AB16 * markup_percent / Decimal("100")

    if dm_fee_type == "percent":
        AG16 = AB16 * dm_fee_value / Decimal("100")
    else:
        AG16 = dm_fee_value

    AH16 = AB16 * rate_forex_risk / Decimal("100")

    # No agent fee for export or Turkish seller
    if incoterms == "EXW" or seller_region == "TR":
        AI16 = Decimal("0")
    else:
        AI16 = AB16 * rate_financial_agent_fee / Decimal("100")

    # Final price
    total_price = AB16 + AF16 + AG16 + AH16 + AI16
    AJ16 = total_price / quantity
    AK16 = AJ16 * quantity

    AD16 = AJ16  # Same as AJ16 (per unit)
    AE16 = AK16  # Same as AK16 (total)

    return {
        "AF16": round_decimal(AF16),
        "AG16": round_decimal(AG16),
        "AH16": round_decimal(AH16),
        "AI16": round_decimal(AI16),
        "AD16": round_decimal(AD16),
        "AE16": round_decimal(AE16),
        "AJ16": round_decimal(AJ16),
        "AK16": round_decimal(AK16)
    }
```

---

## Phase 12: VAT Calculations

**Location:** `calculation_engine.py` lines 689-735
**Execution:** Per-product (loop)
**Dependencies:** Phase 11 (AJ16, AK16), Phase 4 (AY16, Y16, Z16), Phase 1 (S16)

### Purpose
Calculate VAT on sales and deductible VAT on imports. Russia VAT rate is 18% (standard).

### Inputs
- `AJ16` - Sale price per unit (from Phase 11)
- `AK16` - Sale price total (from Phase 11)
- `AY16` - Internal sale price total (from Phase 4)
- `Y16` - Customs duty (from Phase 4)
- `Z16` - Excise tax (from Phase 4)
- `rate_vat_ru` - Russian VAT rate (default 18%)
- `incoterms` - DDP, EXW, etc.
- `sale_type` - "supply" or "export"
- `S16` - Purchase price (for deductible VAT calculation)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| AM16 | AM column | Sale price per unit WITH VAT | Decimal |
| AL16 | AL column | Sale price total WITH VAT | Decimal |
| AN16 | AN column | VAT from sales (charged to client) | Decimal |
| AO16 | AO column | VAT on import (deductible) | Decimal |
| AP16 | AP column | Net VAT payable (AN16 - AO16) | Decimal |

### VAT Logic

**Sales VAT (AN16):**
- Only charged if DDP incoterms (delivered in Russia)
- Calculated on final sales price AJ16

**Deductible VAT (AO16):**
- Only deductible if DDP AND not export
- Calculated on import costs (AY16 + Y16 + Z16)
- Represents VAT paid on import that can be deducted

**Net VAT (AP16):**
- VAT owed to tax authorities
- = Sales VAT - Deductible VAT

### Formula
```
# Sales VAT (18% if DDP, 0% if EXW/export)
AM16 = AJ16 × (1 + rate_vat_ru) if DDP else AJ16
AL16 = AM16 × quantity
AN16 = AL16 - AK16 if DDP else 0

# Deductible VAT (on imports, if not export)
AO16 = (AY16 + Y16 + Z16) × rate_vat_ru if (DDP and not export) else 0

# Net VAT
AP16 = AN16 - AO16
```

### Implementation Pattern
```python
def phase12_vat_calculations(
    AJ16: Decimal,
    AK16: Decimal,
    AY16: Decimal,
    Y16: Decimal,
    Z16: Decimal,
    rate_vat_ru: Decimal,
    quantity: Decimal,
    incoterms: str,
    sale_type: str,
    S16: Decimal
) -> dict:
    """Calculate VAT on sales and imports."""
    # Sales VAT (only if DDP incoterms)
    if incoterms == "DDP":
        AM16 = AJ16 * (Decimal("1") + rate_vat_ru)
        AL16 = AM16 * quantity
        AN16 = AL16 - AK16
    else:
        AM16 = AJ16
        AL16 = AK16
        AN16 = Decimal("0")

    # Deductible VAT (DDP and not export)
    if incoterms == "DDP" and sale_type != "export":
        AO16 = (AY16 + Y16 + Z16) * rate_vat_ru
    else:
        AO16 = Decimal("0")

    # Net VAT
    AP16 = AN16 - AO16

    return {
        "AM16": round_decimal(AM16),
        "AL16": round_decimal(AL16),
        "AN16": round_decimal(AN16),
        "AO16": round_decimal(AO16),
        "AP16": round_decimal(AP16)
    }
```

---

## Phase 13: Transit Commission

**Location:** `calculation_engine.py` lines 742-763
**Execution:** Per-product (loop)
**Dependencies:** Phase 9 (BA16, BB16), Phase 10 (no COGS margin), Phase 11 (AF16, AG16, AH16, AI16)

### Purpose
Calculate commission for transit sales (resale without modification). Commission = all costs and markups, but not COGS.

### Inputs
- `sale_type` - "supply" or "transit"
- `AF16` - Profit margin (from Phase 11)
- `AG16` - DM fee (from Phase 11)
- `AH16` - Forex risk reserve (from Phase 11)
- `AI16` - Financial agent fee (from Phase 11)
- `BA16` - Financing cost (from Phase 9)
- `BB16` - Credit interest (from Phase 9)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| AQ16 | AQ column | Transit commission | Decimal |

### Logic
Only calculated for transit sales (resale). For supply sales, AQ16 = 0.

### Formula
```
AQ16 = AF16 + AG16 + AH16 + AI16 + BA16 + BB16 if sale_type = "transit"
AQ16 = 0 if sale_type = "supply"
```

### Meaning
**Transit commission** represents the markup and fees for acting as intermediary:
- Not selling physical product (COGS not included)
- Just markup (AF16) + DM fee + Forex risk + Agent fee + Financing costs
- Full compensation for intermediary services

### Implementation Pattern
```python
def phase13_transit_commission(
    sale_type: str,
    AF16: Decimal,
    AG16: Decimal,
    AH16: Decimal,
    AI16: Decimal,
    BA16: Decimal,
    BB16: Decimal
) -> dict:
    """Calculate transit commission."""
    if sale_type == "transit":
        AQ16 = AF16 + AG16 + AH16 + AI16 + BA16 + BB16
    else:
        AQ16 = Decimal("0")

    return {"AQ16": round_decimal(AQ16)}
```

---

## Variable Cross-Reference by Phase

| Variable | Phase | Input? | Output? | Type | Purpose |
|----------|-------|--------|--------|------|---------|
| N16 | 1 | - | ✅ | Decimal | Price without VAT |
| P16 | 1 | - | ✅ | Decimal | After supplier discount |
| R16 | 1 | - | ✅ | Decimal | Per-unit in quote currency |
| S16 | 1 | - | ✅ | Decimal | Total purchase price |
| S13 | 2 | - | ✅ | Decimal | Sum of S16 |
| BD16 | 2 | - | ✅ | Decimal | Distribution key |
| T16 | 3 | - | ✅ | Decimal | First-leg logistics |
| U16 | 3 | - | ✅ | Decimal | Last-leg logistics + insurance |
| V16 | 3 | - | ✅ | Decimal | Total logistics |
| AX16 | 4 | - | ✅ | Decimal | Internal price per unit |
| AY16 | 4 | - | ✅ | Decimal | Internal price total |
| Y16 | 4 | - | ✅ | Decimal | Customs duty |
| Z16 | 4 | - | ✅ | Decimal | Excise tax |
| AZ16 | 4 | - | ✅ | Decimal | With VAT restored |
| BH6 | 5 | ✅ | ✅ | Decimal | Supplier payment |
| BH4 | 5 | - | ✅ | Decimal | Before forwarding |
| BH2 | 6 | - | ✅ | Decimal | Revenue estimated |
| BH3 | 7 | - | ✅ | Decimal | Client advance |
| BH7 | 7 | - | ✅ | Decimal | Supplier financing need |
| BJ7 | 7 | - | ✅ | Decimal | Supplier financing cost |
| BH10 | 7 | - | ✅ | Decimal | Operational financing |
| BJ10 | 7 | - | ✅ | Decimal | Operational cost |
| BJ11 | 7 | - | ✅ | Decimal | Total financing cost |
| BL3 | 8 | - | ✅ | Decimal | Credit sales amount |
| BL4 | 8 | - | ✅ | Decimal | Credit sales with interest |
| BL5 | 8 | - | ✅ | Decimal | Credit sales interest |
| BA16 | 9 | - | ✅ | Decimal | Financing per product |
| BB16 | 9 | - | ✅ | Decimal | Credit interest per product |
| AA16 | 10 | - | ✅ | Decimal | COGS per unit |
| AB16 | 10 | - | ✅ | Decimal | COGS total |
| AF16 | 11 | - | ✅ | Decimal | Profit margin |
| AG16 | 11 | - | ✅ | Decimal | DM fee |
| AH16 | 11 | - | ✅ | Decimal | Forex risk reserve |
| AI16 | 11 | - | ✅ | Decimal | Agent fee |
| AD16 | 11 | - | ✅ | Decimal | Sale price per unit |
| AE16 | 11 | - | ✅ | Decimal | Sale price total |
| AJ16 | 11 | - | ✅ | Decimal | Final price per unit |
| AK16 | 11 | - | ✅ | Decimal | Final price total |
| AM16 | 12 | - | ✅ | Decimal | Price with VAT |
| AL16 | 12 | - | ✅ | Decimal | Total with VAT |
| AN16 | 12 | - | ✅ | Decimal | Sales VAT |
| AO16 | 12 | - | ✅ | Decimal | Deductible VAT |
| AP16 | 12 | - | ✅ | Decimal | Net VAT payable |
| AQ16 | 13 | - | ✅ | Decimal | Transit commission |

---

## Key Constants & Settings

| Name | Type | Default | Admin-Only | Description |
|------|------|---------|-----------|-------------|
| rate_forex_risk | % | 3.0 | YES | Buffer for forex fluctuations |
| rate_fin_comm | % | 0.5 | YES | Financial commission on supplier payment |
| rate_loan_interest_daily | % | 0.15 | YES | Daily compound interest for financing |
| rate_vat_ru | % | 18.0 | NO | Russian VAT rate (fixed by law) |
| rate_insurance | % | 0.5 | NO | Insurance on goods value |

---

**Document Version:** 1.0
**Last Updated:** 2025-10-29
**Generated From:** calculation_engine_summary.md (73 KB)
**Status:** Complete and production-ready
