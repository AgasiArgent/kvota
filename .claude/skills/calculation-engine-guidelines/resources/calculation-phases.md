# Calculation Engine - 13 Sequential Phases (+ Phase 2.5)

**Reference:** `calculation_engine.py`
**Last Updated:** 2025-11-09
**Status:** Updated formulas - tests pending update

---

## Phase Overview Diagram

```
INPUT: Quote + Products
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 1: Purchase Price Calculations      │
    │ Variables: N16, P16, R16, S16            │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 2: Distribution Base                │
    │ Variables: S13, BD16 [Distribution Key]  │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 2.5: Internal Pricing (NEW 2025-11-09)│
    │ Variables: AX16, AY16                    │
    │ Purpose: Calculate AY16 early for insurance│
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 3: Logistics Distribution           │
    │ Variables: T16, U16, V16                 │
    │ Uses: AY16 (for insurance calculation)   │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 4: Duties & VAT Restoration         │
    │ Variables: Y16, Z16, AZ16                │
    │ Uses: AY16 (from 2.5), T16 (from 3)     │
    │ UPDATED 2025-11-09: Y16 = tariff×(AY16+T16)│
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 5: Supplier Payment                 │
    │ Variables: BH6, BH4                       │
    │ UPDATED 2025-11-09: BH4 includes Y13+Z13+AO13│
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 6: Revenue Estimation               │ (362-412)
    │ Variables: BH2                            │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 7: Financing Costs                  │
    │ Variables: BH3, BH7, BJ7, BH10, BJ10, BJ11│
    │ UPDATED 2025-11-09: Simple interest formulas│
    │ BI7 = BH7 × (1 + rate × D9)             │
    │ BI10 = BH10 × (1 + rate × customs_pmt_due)│
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 8: Credit Sales Interest            │
    │ Variables: BL3, BL4, BL5                 │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 9: Distribute Financing             │
    │ Variables: BA16, BB16                     │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 10: Final COGS                      │
    │ Variables: AB16, AA16                     │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 11: Sales Price Calculation         │
    │ Variables: AF16, AG16, AH16, AI16, AD16,  │
    │            AE16, AJ16, AK16              │
    └───────────────────────────────────────────┘
        ↓
    ┌───────────────────────────────────────────┐
    │ PHASE 12: VAT Calculations                │
    │ Variables: AM16, AL16, AN16, AO16, AP16  │
    │ UPDATED 2025-11-09: AO16 includes T16    │
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

## Phase 2.5: Internal Pricing (Early Calculation)

**Location:** `calculation_engine.py` (new function)
**Execution:** Per-product (loop)
**Dependencies:** Phase 1 (S16)

### Purpose
Calculate internal sale price (AX16, AY16) BEFORE Phase 3 to enable insurance calculation.
This resolves circular dependency: insurance needs AY16, but logistics (Phase 3) needs insurance.

**Created:** 2025-11-09

### Inputs
- `S16` - Purchase price total (from Phase 1)
- `quantity` - Units
- `internal_markup` - Internal markup % (derived from supplier_country + seller_region)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| AX16 | AX column | Internal sale price per unit | Decimal |
| AY16 | AY column | Internal sale price total | Decimal |

### Formula
```
AX16 = S16 × (1 + internal_markup / 100) / quantity
AY16 = AX16 × quantity
```

**Simplified:** `AY16 = S16 × (1 + internal_markup / 100)`

### Implementation Pattern
```python
def phase2_5_internal_pricing(
    S16: Decimal,
    quantity: int,
    internal_markup: Decimal
) -> Dict[str, Decimal]:
    """Calculate internal sale price for insurance calculation."""
    if quantity > 0:
        AX16 = round_decimal(S16 * (Decimal("1") + internal_markup) / Decimal(quantity))
    else:
        AX16 = Decimal("0")

    AY16 = round_decimal(Decimal(quantity) * AX16)

    return {
        "AX16": AX16,  # Internal sale price per unit
        "AY16": AY16   # Internal sale price total
    }
```

### Why This Phase Exists

**Problem:** Circular dependency
1. Phase 3 (logistics) needs insurance
2. Insurance calculation needs AY16
3. AY16 was calculated in Phase 4
4. But Phase 4 was called after Phase 3

**Solution:** Extract AX16/AY16 calculation into Phase 2.5
- No dependencies on Phase 3 or 4
- Provides AY16 for insurance before Phase 3
- Phase 4 now focuses only on duties (Y16, Z16, AZ16)

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

## Phase 4: Duties & VAT Restoration

**Location:** `calculation_engine.py` (updated function)
**Execution:** Per-product (loop)
**Dependencies:** Phase 2.5 (AY16), Phase 3 (T16), Phase 1 (S16)

### Purpose
Calculate customs duty (Y16), excise tax (Z16), and restore VAT for supplier payment (AZ16).

**IMPORTANT:** This phase now executes AFTER Phase 3 (logistics) to access T16.
AX16/AY16 are calculated in Phase 2.5.

**Updated:** 2025-11-09

### Inputs
- `AY16` - Internal sale price total (from Phase 2.5)
- `T16` - First-leg logistics costs (from Phase 3)
- `S16` - Purchase price total (from Phase 1)
- `quantity` - Units
- `import_tariff` - Customs duty rate (percentage)
- `excise_tax` - Excise tax amount
- `weight_in_kg` - Total weight
- `vat_seller_country` - VAT rate in supplier country
- `offer_incoterms` - DDP or EXW

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| Y16 | Y column | Customs fee (import tariff) | Decimal |
| Z16 | Z column | Excise tax | Decimal |
| AZ16 | AZ column | Purchase price with VAT restored | Decimal |

### Special Cases

**Customs Duty (Y16):**
- **Updated 2025-11-09:** Now includes T16 (first-leg logistics)
- DDP incoterms: Y16 = import_tariff × (AY16 + T16)
- EXW/other incoterms: Y16 = 0

**VAT Restoration (AZ16):**
- Used for supplier payment calculation
- Adds back VAT based on supplier_country
- Chinese suppliers: VAT rate 13%
- Turkish suppliers: VAT rate 20%
- EU suppliers: VAT rate varies (Lithuania 21%, etc.)

### Formula
```
Y16 = import_tariff × (AY16 + T16) if DDP, else 0  [UPDATED 2025-11-09]
Z16 = excise_tax × weight_in_kg × quantity
AZ16 = S16 × (1 + vat_seller_country)
```

**Key Change (2025-11-09):**
- OLD: Y16 = AY16 × import_tariff
- NEW: Y16 = import_tariff × (AY16 + T16) - includes first-leg logistics

### Implementation Pattern
```python
def phase4_duties(
    AY16: Decimal,  # From Phase 2.5
    T16: Decimal,   # From Phase 3
    S16: Decimal,
    quantity: int,
    import_tariff: Decimal,
    excise_tax: Decimal,
    weight_in_kg: Decimal,
    vat_seller_country: Decimal,
    offer_incoterms: Incoterms
) -> dict:
    """Calculate duties and VAT restoration."""

    # Customs duty - UPDATED 2025-11-09
    if offer_incoterms == Incoterms.DDP:
        Y16 = round_decimal((import_tariff / Decimal("100")) * (AY16 + T16))
    else:
        Y16 = Decimal("0")

    # Excise tax
    Z16 = round_decimal(excise_tax * weight_in_kg * Decimal(quantity))

    # VAT restoration
    AZ16 = round_decimal(S16 * (Decimal("1") + vat_seller_country))

    return {
        "Y16": round_decimal(Y16),
        "Z16": round_decimal(Z16),
        "AZ16": round_decimal(AZ16)
    }
```

---

## Phase 5: Supplier Payment

**Location:** `calculation_engine.py`
**Execution:** Quote-level (uses aggregated values)
**Dependencies:** Phase 3 (T13), Phase 4 (AZ13, Y13, Z13), Inline AO13 calculation

### Purpose
Calculate total amount needed to pay supplier, including advance, financing commission, duties, excise tax, and import VAT.

**Updated:** 2025-11-09 - BH4 formula now includes Y13, Z13, AO13

### Inputs
- `AZ13` - Total purchase price with VAT (sum of all AZ16)
- `T13` - Total first-leg logistics (sum of all T16)
- `Y13` - Total customs duties (sum of all Y16)
- `Z13` - Total excise tax (sum of all Z16)
- `AO13` - Total deductible VAT (sum of all AO16)
- `advance_to_supplier` - % of advance payment to supplier (0-100)
- `rate_fin_comm` - Financial commission rate (admin setting)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| BH6 | BH column | Supplier payment with advance and commission | Decimal |
| BH4 | BH column | Total before forwarding (includes duties & VAT) | Decimal |

### Formula
```
BH6 = AZ13 × (advance_to_supplier / 100) × (1 + rate_fin_comm / 100)
BH4 = (AZ13 + T13) × (1 + rate_fin_comm / 100) + Y13 + Z13 + AO13  [UPDATED 2025-11-09]
```

**Key Change (2025-11-09):**
- OLD: BH4 = (AZ13 + T13) × (1 + rate_fin_comm)
- NEW: BH4 = (AZ13 + T13) × (1 + rate_fin_comm) + Y13 + Z13 + AO13

### Implementation Pattern
```python
def phase5_supplier_payment(
    AZ13: Decimal,
    T13: Decimal,
    Y13: Decimal,   # NEW
    Z13: Decimal,   # NEW
    AO13: Decimal,  # NEW
    advance_to_supplier: Decimal,
    rate_fin_comm: Decimal
) -> dict:
    """Calculate supplier payment amount."""
    advance_multiplier = advance_to_supplier / Decimal("100")
    fin_multiplier = Decimal("1") + (rate_fin_comm / Decimal("100"))

    BH6 = round_decimal(AZ13 * advance_multiplier * fin_multiplier)
    BH4 = round_decimal((AZ13 + T13) * fin_multiplier + Y13 + Z13 + AO13)

    return {
        "BH6": BH6,  # Supplier payment
        "BH4": BH4   # Total before forwarding (includes duties and VAT)
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

**Location:** `calculation_engine.py`
**Execution:** Quote-level
**Dependencies:** Phase 5 (BH6, BH4), Phase 6 (BH2)

### Purpose
Calculate loan interest for supplier payments and operational financing using SIMPLE interest formula.

**Updated:** 2025-11-09 - Simplified from compound to simple interest

### Inputs
- `BH6` - Supplier payment amount (from Phase 5)
- `BH4` - Total before forwarding (from Phase 5)
- `BH2` - Revenue estimation (from Phase 6)
- `advance_from_client` - % of advance from client (0-100)
- `delivery_time` - Days until delivery (D9)
- `customs_logistics_pmt_due` - Payment term for customs/logistics (days) - NEW admin variable
- `rate_loan_interest_daily` - Daily interest rate (calculated from annual rate)

### Outputs
| Variable | Excel Cell | Description | Type |
|----------|-----------|-------------|------|
| BH3 | BH column | Client advance amount | Decimal |
| BH7 | BH column | Supplier financing need | Decimal |
| BH8 | BH column | Amount payable after supplier payment | Decimal |
| BH9 | BH column | Remaining % after advance | Decimal |
| BH10 | BH column | Operational financing need | Decimal |
| BI7 | BI column | FV of supplier financing (simple interest) | Decimal |
| BJ7 | BJ column | Supplier financing COST | Decimal |
| BI10 | BI column | FV of operational financing (simple interest) | Decimal |
| BJ10 | BJ column | Operational financing COST | Decimal |
| BJ11 | BJ column | TOTAL financing cost | Decimal |

### Formula
```
BH3 = BH2 × (advance_from_client / 100)
BH7 = IF(BH3 > 0, IF(BH3 >= BH6, 0, BH6 - BH3), BH6)
BH9 = 1 - (advance_from_client / 100)
BH8 = BH4 - BH6
BH10 = IF((BH9 + IF(BH3>BH6, BH3-BH6, 0)) > BH8, 0, BH8 - (BH9 + IF(BH3>BH6, BH3-BH6, 0)))

BI7 = BH7 × (1 + rate_loan_interest_daily × D9)  [UPDATED 2025-11-09: Simple interest]
BJ7 = BI7 - BH7

BI10 = BH10 × (1 + rate_loan_interest_daily × customs_logistics_pmt_due)  [UPDATED 2025-11-09]
BJ10 = BI10 - BH10

BJ11 = BJ7 + BJ10
```

**Key Changes (2025-11-09):**
- OLD BI7: FV(rate, D9+K9, , -BH7) - compound interest over delivery + payment period
- NEW BI7: BH7 × (1 + rate × D9) - simple interest over delivery period only

- OLD BI10: FV(rate, D9+K9-K6, , -BH10) - compound interest
- NEW BI10: BH10 × (1 + rate × customs_logistics_pmt_due) - simple interest with fixed term

### Implementation Pattern
```python
def phase7_financing_costs(
    BH2: Decimal,
    BH6: Decimal,
    BH4: Decimal,
    advance_from_client: Decimal,
    delivery_time: int,  # D9
    customs_logistics_pmt_due: int,  # NEW admin variable
    rate_loan_interest_daily: Decimal
) -> dict:
    """Calculate financing costs using SIMPLE interest."""

    BH3 = round_decimal(BH2 * (advance_from_client / Decimal("100")))

    # BH7 calculation
    if BH3 > 0:
        if BH3 >= BH6:
            BH7 = Decimal("0")
        else:
            BH7 = round_decimal(BH6 - BH3)
    else:
        BH7 = BH6

    BH9 = Decimal("1") - (advance_from_client / Decimal("100"))
    BH8 = round_decimal(BH4 - BH6)

    # BH10 calculation
    excess_advance = BH3 - BH6 if BH3 > BH6 else Decimal("0")
    remaining_after_advance = BH9 + excess_advance
    if remaining_after_advance > BH8:
        BH10 = Decimal("0")
    else:
        BH10 = round_decimal(BH8 - remaining_after_advance)

    # Simple interest formulas - UPDATED 2025-11-09
    D9 = delivery_time
    BI7 = round_decimal(BH7 * (Decimal("1") + rate_loan_interest_daily * Decimal(D9)))
    BJ7 = round_decimal(BI7 - BH7)

    BI10 = round_decimal(BH10 * (Decimal("1") + rate_loan_interest_daily * Decimal(customs_logistics_pmt_due)))
    BJ10 = round_decimal(BI10 - BH10)

    BJ11 = round_decimal(BJ7 + BJ10)

    return {
        "BH3": BH3,
        "BH7": BH7,
        "BH9": BH9,
        "BH8": BH8,
        "BH10": BH10,
        "BI7": BI7,
        "BJ7": BJ7,
        "BI10": BI10,
        "BJ10": BJ10,
        "BJ11": BJ11
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

**Location:** `calculation_engine.py`
**Execution:** Per-product (loop)
**Dependencies:** Phase 11 (AJ16, AK16), Phase 2.5 (AY16), Phase 4 (Y16, Z16), Phase 3 (T16)

### Purpose
Calculate VAT on sales and deductible VAT on imports. Russia VAT rate is 20% (standard).

**Updated:** 2025-11-09 - AO16 formula now includes T16

### Inputs
- `AJ16` - Sale price per unit (from Phase 11)
- `quantity` - Units
- `AY16` - Internal sale price total (from Phase 2.5)
- `Y16` - Customs duty (from Phase 4)
- `Z16` - Excise tax (from Phase 4)
- `T16` - First-leg logistics (from Phase 3) - NEW in AO16 formula
- `offer_incoterms` - DDP, EXW, etc.
- `offer_sale_type` - "supply" or "export"
- `rate_vat_ru` - Russian VAT rate (default 20%)

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
- **Updated 2025-11-09:** Now includes T16 (first-leg logistics)
- Calculated on import costs (AY16 + Y16 + Z16 + T16)
- Represents VAT paid on import that can be deducted

**Net VAT (AP16):**
- VAT owed to tax authorities
- = Sales VAT - Deductible VAT

### Formula
```
# Sales VAT (20% if DDP, 0% if EXW/export)
AM16 = AJ16 × (1 + rate_vat_ru) if DDP else AJ16
AL16 = AM16 × quantity
AN16 = AL16 - AK16 if DDP else 0

# Deductible VAT (on imports, if not export) - UPDATED 2025-11-09
AO16 = (AY16 + Y16 + Z16 + T16) × rate_vat_ru if (DDP and not export) else 0

# Net VAT
AP16 = AN16 - AO16
```

**Key Change (2025-11-09):**
- OLD: AO16 = (AY16 + Y16 + Z16) × rate_vat_ru
- NEW: AO16 = (AY16 + Y16 + Z16 + T16) × rate_vat_ru - includes first-leg logistics

### Implementation Pattern
```python
def phase12_vat_calculations(
    AJ16: Decimal,
    quantity: int,
    AY16: Decimal,
    Y16: Decimal,
    Z16: Decimal,
    T16: Decimal,  # NEW - first-leg logistics
    offer_incoterms: Incoterms,
    offer_sale_type: OfferSaleType,
    rate_vat_ru: Decimal
) -> dict:
    """Calculate VAT on sales and imports."""
    # Sales VAT (only if DDP incoterms)
    if offer_incoterms == Incoterms.DDP:
        vat_multiplier = Decimal("1") + rate_vat_ru
    else:
        vat_multiplier = Decimal("1")
    AM16 = round_decimal(AJ16 * vat_multiplier)

    AL16 = round_decimal(AM16 * Decimal(quantity))

    AK16 = AJ16 * Decimal(quantity)  # Sales price total no VAT
    AN16 = round_decimal(AL16 - AK16)

    # Deductible VAT (DDP and not export) - UPDATED 2025-11-09
    if offer_incoterms == Incoterms.DDP and offer_sale_type != OfferSaleType.EXPORT:
        import_vat_rate = rate_vat_ru
    else:
        import_vat_rate = Decimal("0")
    AO16 = round_decimal((AY16 + Y16 + Z16 + T16) * import_vat_rate)

    # Net VAT
    AP16 = round_decimal(AN16 - AO16)

    return {
        "AM16": AM16,  # Sales price per unit with VAT
        "AL16": AL16,  # Sales price total with VAT
        "AN16": AN16,  # VAT from sales
        "AO16": AO16,  # VAT on import (includes T16)
        "AP16": AP16   # Net VAT payable
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
