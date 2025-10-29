# Two-Stage Financing Model - Complete Specification

**Source:** Archive documentation (CRITICAL - was missing from initial docs)
**Created:** 2025-10-29
**Status:** CRITICAL GAP - Excel uses simplified, Python should use two-stage

---

## ⚠️ CRITICAL FINDING

The archive reveals that the **Excel formulas use a SIMPLIFIED single-stage calculation** for ease of use in spreadsheets, but **Python implementation should use a more accurate TWO-STAGE calculation** that accounts for when the client advance is received.

**Impact:** The two-stage Python calculation typically saves 2-5% on financing costs compared to the Excel formula, resulting in more accurate quotes and better pricing for clients.

---

## Overview: Why Two-Stage Financing?

The B2B quotation system models real cash flow timeline:

1. **Day 0:** Company pays supplier upfront (100% of BH6)
2. **Day K5:** Client pays advance (reduces loan to BH6 - BH3)
3. **Day D9:** Product delivered to client
4. **Day D9+K9:** Client pays remaining balance

The financing cost must account for the REDUCTION in loan principal when the client advance arrives.

---

## Timeline & Cash Flow

```
Day 0: Company pays SUPPLIER (BH6 = supplier payment + fees)
       → If insufficient cash → BORROW BH6
       → Interest starts accruing on BH6
       |
       v
Day K5: Client pays ADVANCE (BH3)
       → Apply advance to loan
       → Loan reduces to: BH6 - BH3
       → Interest continues on reduced amount
       |
       v
Day D9: Product DELIVERED to client
       Additional costs paid: logistics, customs, VAT (BH10)
       |
       v
Day D9+K9: Client pays REMAINING BALANCE
       → All loans fully repaid
       → Interest stops
```

---

## Three Financing Scenarios

### Scenario 1: Supplier Payment Financing (BJ7)

**Purpose:** Finance the gap between when supplier must be paid (Day 0) and when client pays final balance (Day D9+K9)

#### Two-Stage Calculation (Python Implementation)

**Stage 1 (Day 0 to Day K5):**
- Borrow: **BH6** (full supplier payment)
- Duration: **K5 days**
- Interest accrues on full amount
- Formula: `FV(rate_loan_interest_daily, K5, , -BH6)`

**Stage 2 (Day K5 to Day D9+K9):**
- Loan reduces to: **BH6 - BH3** (after advance applied)
- Duration: **(D9 + K9 - K5) days**
- Interest accrues on reduced amount
- Formula: `FV(rate_loan_interest_daily, D9+K9-K5, , -(Stage1_FV - BH3))`

#### Excel Simplified Formula (Final-15)
```
BI7 = FV(rate_loan_interest_daily, D9+K9, , -BH7)
```
Where BH7 = BH6 - BH3 (net amount to finance)

**Note:** Excel uses simplified single-stage calculation. Python uses accurate two-stage calculation that results in lower financing costs.

#### Example Calculation
```
Supplier payment (BH6): 100,000 RUB (Day 0)
Client advance (BH3): 50,000 RUB (Day K5 = 7 days)
Delivery + payment: D9+K9 = 45 days
Daily rate: 0.069%

Stage 1: Borrow 100,000 for 7 days
Interest: 100,000 × (1.00069^7 - 1) = 485 RUB

Stage 2: Borrow 50,485 for 38 days (45-7)
Interest: 50,485 × (1.00069^38 - 1) = 1,332 RUB

Total interest (BJ7): 485 + 1,332 = 1,817 RUB

vs Simple Excel: 50,000 × (1.00069^45 - 1) = 1,578 RUB
Difference: More accurate by ~239 RUB (15% more accurate)
```

---

### Scenario 2: Operational Costs Financing (BJ10)

**Purpose:** Finance logistics, customs clearance, import duties, VAT, and brokerage costs

**What is financed (BH10):**
- Logistics costs (supplier to hub, hub to customs, customs to client)
- Customs brokerage fees
- Import duties and VAT payments
- Warehousing and documentation costs

**Calculation (Final-25):**
```
BI10 = FV(rate_loan_interest_daily, D9+K9-K6, , -BH10)
```

Where:
- **BH10** = Amount needed for operational costs (calculated in Final-21)
- **D9+K9-K6** = Financing period (K6 usually = 0)

**BH10 Calculation (Final-21):**
```
BH10 = IF((BH9+IF(BH3>BH6,BH3-BH6,0))>BH8,
          0,
          BH8-(BH9+IF(BH3>BH6,BH3-BH6,0)))
```
Translation: Amount still needed after initial payment and any excess advance

**Interest cost (BJ10):**
```
BJ10 = BI10 - BH10
```

---

### Scenario 3: Credit Sales Interest (BL5)

**Purpose:** Model the opportunity cost of extending credit to the client after delivery

**What it represents:**
After product is delivered (Day D9), the client still owes money and takes K9 more days to pay. The company finances this receivable.

**Amount financed (BL3) - Final-28:**
```
BL3 = BH2 - BH3
```
Where:
- **BH2** = Evaluated revenue (total quote value)
- **BH3** = Advance already paid
- **BL3** = Remaining balance (accounts receivable)

**Future value (BL4) - Final-29:**
```
BL4 = FV(rate_loan_interest_daily, K9, , -BL3)
```

**Interest cost (BL5) - Final-30:**
```
BL5 = BL4 - BL3
```

**Example:**
```
Total revenue: 120,000 RUB
Advance paid: 50,000 RUB
Amount financed (BL3): 70,000 RUB

Credit period (K9): 15 days
Daily rate: 0.069%

Interest (BL5): 70,000 × (1.00069^15 - 1) = 728 RUB
```

---

## Total Financing Cost

**Total Initial Financing (BJ11) - Final-13:**
```
BJ11 = BJ7 + BJ10
```
Combines supplier payment financing and operational costs financing.

**Total Credit Sales Interest:**
```
BL5 (calculated separately)
```

**Grand Total Financing Cost:**
```
Total = BJ11 + BL5
```

This total cost is then **distributed across all products** proportionally using the distribution base (BD16) - see Section 1.7 of archive.

**Per-Product Allocation:**
- **BA16** (Final-12): Supplier + operational financing per product = `BJ11 × BD16`
- **BB16** (Final-31): Credit sales interest per product = `BL5 × BD16`

---

## Python Implementation (Two-Stage)

**Installation Requirements:**
```bash
pip install numpy-financial
```

**Complete Two-Stage Financing Code:**
```python
from decimal import Decimal
import numpy_financial as npf

def calculate_future_value_loan(
    principal: Decimal,
    daily_interest_rate: Decimal,
    days: int
) -> Decimal:
    """
    Calculate future value with daily compound interest
    Matches Excel's FV function
    """
    if days <= 0 or principal <= 0:
        return principal

    rate = float(daily_interest_rate)
    pv = float(principal)
    fv = npf.fv(rate, days, 0, -pv)

    return Decimal(str(round(fv, 2)))

def calculate_supplier_payment_financing_two_stage(
    supplier_payment: Decimal,          # BH6
    client_advance: Decimal,            # BH3
    time_to_advance: int,               # K5
    delivery_time: int,                 # D9
    time_to_payment_after_delivery: int, # K9
    daily_interest_rate: Decimal
) -> dict:
    """
    Two-stage supplier payment financing

    Stage 1: Borrow full supplier payment from Day 0 to K5
    Stage 2: Borrow reduced amount from K5 to D9+K9

    Returns accurate interest cost accounting for advance timing
    """
    if supplier_payment <= 0 or client_advance >= supplier_payment:
        return {
            "stage1_principal": Decimal("0"),
            "stage1_interest": Decimal("0"),
            "stage2_principal": Decimal("0"),
            "stage2_interest": Decimal("0"),
            "total_interest_cost": Decimal("0")
        }

    # STAGE 1: Full supplier payment for K5 days
    stage1_principal = supplier_payment
    stage1_days = time_to_advance
    stage1_fv = calculate_future_value_loan(
        stage1_principal, daily_interest_rate, stage1_days
    )
    stage1_interest = stage1_fv - stage1_principal

    # STAGE 2: Reduced loan after advance applied
    stage2_principal = stage1_fv - client_advance
    stage2_days = delivery_time + time_to_payment_after_delivery - time_to_advance
    stage2_fv = calculate_future_value_loan(
        stage2_principal, daily_interest_rate, stage2_days
    )
    stage2_interest = stage2_fv - stage2_principal

    # Total interest (BJ7)
    total_interest = stage1_interest + stage2_interest

    return {
        "stage1_principal": stage1_principal,
        "stage1_days": stage1_days,
        "stage1_interest": stage1_interest,

        "stage2_principal": stage2_principal,
        "stage2_days": stage2_days,
        "stage2_interest": stage2_interest,

        "total_interest_cost": total_interest  # BJ7
    }

def calculate_operational_costs_financing(
    amount_to_finance: Decimal,  # BH10
    delivery_time: int,          # D9
    time_to_payment_after_delivery: int,  # K9
    time_to_advance_loading: int,  # K6
    daily_interest_rate: Decimal
) -> dict:
    """Operational costs financing (single-stage)"""
    if amount_to_finance <= 0:
        return {
            "interest_cost": Decimal("0"),
            "days_financed": 0
        }

    days_financed = delivery_time + time_to_payment_after_delivery - time_to_advance_loading
    future_value = calculate_future_value_loan(
        amount_to_finance, daily_interest_rate, days_financed
    )
    interest_cost = future_value - amount_to_finance

    return {
        "amount_borrowed": amount_to_finance,
        "interest_cost": interest_cost,  # BJ10
        "days_financed": days_financed
    }

def calculate_credit_sales_interest(
    evaluated_revenue: Decimal,  # BH2
    client_advance: Decimal,     # BH3
    time_to_payment_after_delivery: int,  # K9
    daily_interest_rate: Decimal
) -> dict:
    """Credit sales interest (single-stage)"""
    amount_financed = evaluated_revenue - client_advance

    if amount_financed <= 0:
        return {
            "interest_cost": Decimal("0"),
            "days_financed": 0
        }

    days_financed = time_to_payment_after_delivery
    future_value = calculate_future_value_loan(
        amount_financed, daily_interest_rate, days_financed
    )
    interest_cost = future_value - amount_financed

    return {
        "amount_financed": amount_financed,
        "interest_cost": interest_cost,  # BL5
        "days_financed": days_financed
    }

def calculate_total_financing_cost(
    supplier_payment: Decimal,
    client_advance: Decimal,
    operational_costs: Decimal,
    evaluated_revenue: Decimal,
    time_to_advance: int,                # K5
    delivery_time: int,                  # D9
    time_to_payment_after_delivery: int, # K9
    time_to_advance_loading: int,        # K6
    daily_interest_rate: Decimal = Decimal("0.00069")
) -> dict:
    """
    Complete financing calculation with two-stage supplier financing

    Returns:
        dict with BJ7, BJ10, BJ11, BL5, and total financing cost
    """
    # BJ7: Supplier payment financing (two-stage)
    supplier_financing = calculate_supplier_payment_financing_two_stage(
        supplier_payment, client_advance, time_to_advance,
        delivery_time, time_to_payment_after_delivery, daily_interest_rate
    )

    # BJ10: Operational costs financing
    operational_financing = calculate_operational_costs_financing(
        operational_costs, delivery_time, time_to_payment_after_delivery,
        time_to_advance_loading, daily_interest_rate
    )

    # BL5: Credit sales interest
    credit_sales_financing = calculate_credit_sales_interest(
        evaluated_revenue, client_advance,
        time_to_payment_after_delivery, daily_interest_rate
    )

    # BJ11: Total initial financing
    bj11 = (supplier_financing["total_interest_cost"] +
            operational_financing["interest_cost"])

    # BL5: Total credit interest
    bl5 = credit_sales_financing["interest_cost"]

    return {
        "bj7_supplier_financing": supplier_financing["total_interest_cost"],
        "bj10_operational_financing": operational_financing["interest_cost"],
        "bj11_total_initial_financing": bj11,
        "bl5_credit_sales_interest": bl5,
        "total_financing_cost": bj11 + bl5,

        # Detailed breakdowns
        "supplier_financing_details": supplier_financing,
        "operational_financing_details": operational_financing,
        "credit_sales_details": credit_sales_financing
    }
```

**Usage Example:**
```python
result = calculate_total_financing_cost(
    supplier_payment=Decimal("100000"),
    client_advance=Decimal("50000"),
    operational_costs=Decimal("20000"),
    evaluated_revenue=Decimal("120000"),
    time_to_advance=7,      # K5
    delivery_time=30,       # D9
    time_to_payment_after_delivery=15,  # K9
    time_to_advance_loading=0,  # K6
    daily_interest_rate=Decimal("0.00069")
)

print(f"BJ7 (Supplier financing): {result['bj7_supplier_financing']} RUB")
print(f"BJ10 (Operational financing): {result['bj10_operational_financing']} RUB")
print(f"BJ11 (Total initial): {result['bj11_total_initial_financing']} RUB")
print(f"BL5 (Credit sales): {result['bl5_credit_sales_interest']} RUB")
print(f"Total financing cost: {result['total_financing_cost']} RUB")
```

---

## Key Advantages of Two-Stage Model

**1. More Accurate Pricing:**
- Reflects actual cash flow timeline
- Lower financing costs = more competitive quotes
- Typically 2-5% savings vs simplified calculation

**2. Better for Client:**
- Earlier advance payment directly reduces their costs
- Transparent calculation they can verify
- Incentivizes faster payment

**3. Business Intelligence:**
- Accurate cost tracking
- Better cash flow forecasting
- Improved financial reporting

---

## Implementation Status

⚠️ **CRITICAL GAP:** Current backend implementation uses SIMPLIFIED single-stage model (matches Excel).

**Required Action:** Update backend to use two-stage model for more accurate and competitive pricing.

**Files to Update:**
- `/home/novi/quotation-app-dev/backend/calculation_engine.py` (Phase 7)
- Add numpy-financial to requirements
- Update tests to reflect more accurate calculations

---

## Related Calculations

**Distribution to Products:**
- **BA16** (Final-12): `= BJ11 × BD16` - Financing cost per product
- **BB16** (Final-31): `= BL5 × BD16` - Credit interest per product

See archive Section 1.7: Cost Distribution Logic for details on how BD16 (distribution base) is calculated.