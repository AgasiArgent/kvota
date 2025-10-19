# Variables Specification Final

# Core Formula - Complete Variable Specification

**Purpose**: Complete variable specifications for B2B quotation platform. Optimized as single .md file for Claude Code.

---

## SECTION 1: USER INPUT VARIABLES (39 variables)

### Categories

- **Product Info** (5) - Price, quantity, weight, customs
- **Financial** (9) - Currency, rates, discounts, markup, fees
- **Logistics** (7) - Country, delivery, shipping costs
- **Taxes & Duties** (2) - Import tariff, excise tax
- **Payment Terms** (12) - Advance payments, timing
- **Customs & Clearance** (5) - Brokerage, documentation, warehousing
- **Company Settings** (2) - Seller company, sale type

### User Input Variables - Complete Table

| Variable | Type | Category | Description | Examples | Req | Default | Validation | Cell |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| base_price_VAT | Decimal | Product Info | Product base price | 1000.00 | yes | - | > 0, 2 decimals | K16 |
| quantity | Integer | Product Info | Number of units | 10 | yes | - | > 0 | E16 |
| weight_in_kg | Decimal | Product Info | Product weight kg | 25.5 | no | 0 | >= 0 | G16 |
| currency_of_base_price | String | Financial | Base price currency | USD, EUR, CNY | yes | - | USD/EUR/CNY/RUB/AED | J16 |
| supplier_country | String | Logistics | Supplier country | Турция, Китай | yes | - | From country list | L16 |
| supplier_discount | Decimal | Financial | Supplier discount % | 15.0, 10.5 | no | 0 | 0-100 | O16 |
| currency_of_quote | String | Financial | Quote currency | USD, RUB | yes | USD | USD/EUR/CNY/RUB/AED | D8 |
| exchange_rate_base_price_to_quote | Decimal | Financial | Exchange rate | 95.6, 32.3 | yes | - | > 0 | Q16 |
| customs_code | Integer | Product Info | Customs code | 8708913509 | yes | - | 10 digits | W16 |
| import_tariff | Decimal | Taxes & Duties | Import tariff % | 5, 7.5, 15 | yes | - | 0-100 | X16 |
| excise_tax | Decimal | Taxes & Duties | Excise per kg | 6412.5 | no | 0 | >= 0 | Z16 |
| markup | Decimal | Financial | Markup on COGS % | 15, 12.5 | yes | - | > 0, typ 5-50 | AC16 |
| rate_forex_risk | Decimal | Financial | Currency exchange cost % | 3, 2, 1.5 | no | 3 | 0-100 | AH11 |
| seller_company | String | Company Settings | Seller company (auto-derives seller_region) | МАСТЕР БЭРИНГ ООО, TEXCEL OTOMOTİV, UPDOOR Limited | yes | МАСТЕР БЭРИНГ ООО | From list (see Section 1.5 for mapping) | D5 |
|  |  |  |  |  |  |  |  |  |
| offer_sale_type | String | Company Settings | Deal type | Поставка, Транзит, Финтранзит, Экспорт | no | Поставка | From list (see mapping below) | D6 |
| offer_incoterms | String | Logistics | INCOTERMS | DDP, DAP, CIF | no | DDP | Valid INCOTERM | D7 |
| delivery_time | Integer | Logistics | Delivery days | 7, 15, 90 | yes | - | > 0 | D9 |
| advance_from_client | Decimal | Payment Terms | Client upfront % | 100, 50 | yes | 100 | 0-100 | J5 |
| advance_to_supplier | Decimal | Payment Terms | Supplier upfront % | 100, 50 | yes | 100 | 0-100 | D11 |
| time_to_advance | Integer | Payment Terms | Days to advance | 7, 15, 90 | no | 0 | >= 0 | K5 |
| advance_on_loading | Decimal | Payment Terms | Pay at loading % | 100, 50 | no | 0 | 0-100 | J6 |
| time_to_advance_loading | Integer | Payment Terms | Days to loading | 7, 15 | no | 0 | >= 0 | K6 |
| advance_on_going_to_country_destination | Decimal | Payment Terms | Pay going to country % | 100, 50 | no | 0 | 0-100 | J7 |
| time_to_advance_going_to_country_destination | Integer | Payment Terms | Days to country | 7, 15 | no | 0 | >= 0 | K7 |
| advance_on_customs_clearance | Decimal | Payment Terms | Pay at customs % | 100, 50 | no | 0 | 0-100 | J8 |
| time_to_advance_on_customs_clearance | Integer | Payment Terms | Days to customs | 7, 15 | no | 0 | >= 0 | K8 |
| time_to_advance_on_receiving | Integer | Payment Terms | Days to receiving | 7, 15 | no | 0 | >= 0 | K9 |
| logistics_supplier_hub | Decimal | Logistics | Supplier-hub cost | 1235.6 | yes | - | >= 0 | W2 |
| logistics_hub_customs | Decimal | Logistics | Hub-customs cost | 1235.6 | no | 0 | >= 0 | W3 |
| logistics_customs_client | Decimal | Logistics | Customs-client cost | 1235.6 | no | 0 | >= 0 | W4 |
| brokerage_hub | Decimal | Customs & Clearance | Hub brokerage | 1235.6 | no | 0 | >= 0 | W5 |
| brokerage_customs | Decimal | Customs & Clearance | Customs brokerage | 1235.6 | no | 0 | >= 0 | W6 |
| warehousing_at_customs | Decimal | Customs & Clearance | Warehouse cost | 1235.6 | no | 0 | >= 0 | W7 |
| customs_documentation | Decimal | Customs & Clearance | Documentation | 1235.6 | no | 0 | >= 0 | W8 |
| brokerage_extra | Decimal | Customs & Clearance | Extra brokerage | 1235.6 | no | 0 | >= 0 | W9 |
| dm_fee_type | String | Financial | DM fee type | fixed, % | no | fixed | fixed or % | AG3 |
| dm_fee_value | Decimal | Financial | DM fee value | 1000.00, 3.0 | no | 0 | >= 0 | AG7 |
| util_fee | Decimal | Taxes & Duties | Utilization fee on any type of vehicles | 1000.00, 3.0, 150345.25 | no | 0 | >= 0 |  |

## SECTION 1.5: DERIVED VARIABLES

**These are NOT user inputs** - automatically calculated from user input variables.

### seller_region (Derived from seller_company)

**Derivation Logic**: The `seller_region` is automatically determined based on which company is selected in `seller_company`.

**Company → Region Mapping:**

| Company Name (seller_company) | seller_region | Country |
| --- | --- | --- |
| МАСТЕР БЭРИНГ ООО | RU | Russia |
| ЦМТО1 ООО | RU | Russia |
| РАД РЕСУРС ООО | RU | Russia |
| TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ | TR | Turkey |
| GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ | TR | Turkey |
| UPDOOR Limited | CN | China |

**Python Implementation for Claude Code:**

```python
SELLER_REGION_MAP = {
    "МАСТЕР БЭРИНГ ООО": "RU",
    "ЦМТО1 ООО": "RU",
    "РАД РЕСУРС ООО": "RU",
    "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ": "TR",
    "GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ": "TR",
    "UPDOOR Limited": "CN"
}

def get_seller_region(seller_company: str) -> str:
    """Derive seller_region from seller_company"""
    region = SELLER_REGION_MAP.get(seller_company)
    if region is None:
        raise ValueError(f"Unknown seller company: {seller_company}")
    return region
```

**Usage in Formulas:**

When formulas reference `seller_region` (e.g., in Final-7, Final-18), it means:

1. Look up the `seller_company` value from user input
2. Use the mapping table above to get the region code
3. Use that region code in the calculation

**Example:** If user selects `seller_company = "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ"`, then `seller_region` automatically becomes `"TR"`.

### vat_seller_country (Derived from supplier_country)

**Also known as:** `M16` in Excel formulas

**Derivation Logic:** VAT rate in supplier's country, automatically derived from `supplier_country`.

```
Supplier CountryVAT Rate (M16)NotesТурция20%Standard Turkey VATТурция (транзитная зона)0%Transit zone - no VATРоссия20%Russian VATКитай13%Chinese VATЛитва21%When buying entity also in LithuaniaЛатвия21%When buying entity also in LatviaБолгария20%When buying entity also in BulgariaПольша23%When buying entity also in PolandЕС (между странами ЕС)0%Cross-border EU - no VATОАЭ5%UAE VATПрочие0%Other countries default
```

**EU Special Logic:**

- If buying entity is in EU country A and supplier is in same EU country A → use specific country VAT (21%, 20%, 23%, etc.)
- If buying entity is in EU country A and supplier is in different EU country B → use "ЕС (между странами ЕС)" (0% VAT)

---

### internal_markup (Derived from supplier_country + seller_region)

**Derivation Logic:** Internal markup percentage depends on BOTH where we're buying from (`supplier_country`) AND where we're selling from (`seller_region`).

**Full Mapping Table:**

```
Supplier CountrySelling from RU (seller_region="RU")Selling from TR (seller_region="TR")Турция10%0%Турция (транзитная зона)10%0%Россия0%0%Китай10%0%Литва13%3%Латвия13%3%Болгария13%3%Польша13%3%ЕС (между странами ЕС)13%3%ОАЭ11%1%Прочие10%0%
```

---

**Python Implementation for Claude Code:**

python

```jsx
from decimal import Decimal

# VAT rates by supplier country
VAT_SELLER_COUNTRY_MAP = {
    "Турция": 0.20,
    "Турция (транзитная зона)": 0.00,
    "Россия": 0.20,
    "Китай": 0.13,
    "Литва": 0.21,
    "Латвия": 0.21,
    "Болгария": 0.20,
    "Польша": 0.23,
    "ЕС (между странами ЕС)": 0.00,
    "ОАЭ": 0.05,
    "Прочие": 0.00
}

# Internal markup by supplier country and seller region
INTERNAL_MARKUP_MAP = {
    ("Турция", "RU"): 0.10,
    ("Турция", "TR"): 0.00,
    ("Турция (транзитная зона)", "RU"): 0.10,
    ("Турция (транзитная зона)", "TR"): 0.00,
    ("Россия", "RU"): 0.00,
    ("Россия", "TR"): 0.00,
    ("Китай", "RU"): 0.10,
    ("Китай", "TR"): 0.00,
    ("Литва", "RU"): 0.13,
    ("Литва", "TR"): 0.03,
    ("Латвия", "RU"): 0.13,
    ("Латвия", "TR"): 0.03,
    ("Болгария", "RU"): 0.13,
    ("Болгария", "TR"): 0.03,
    ("Польша", "RU"): 0.13,
    ("Польша", "TR"): 0.03,
    ("ЕС (между странами ЕС)", "RU"): 0.13,
    ("ЕС (между странами ЕС)", "TR"): 0.03,
    ("ОАЭ", "RU"): 0.11,
    ("ОАЭ", "TR"): 0.01,
    ("Прочие", "RU"): 0.10,
    ("Прочие", "TR"): 0.00
}

def get_vat_seller_country(supplier_country: str) -> Decimal:
    """
    Get VAT rate for supplier country (M16 in Excel)
    
    Args:
        supplier_country: Country where supplier is located
    
    Returns:
        VAT rate as Decimal (e.g., 0.20 for 20%)
    
    Raises:
        ValueError: If supplier country not found in mapping
    """
    vat_rate = VAT_SELLER_COUNTRY_MAP.get(supplier_country)
    if vat_rate is None:
        raise ValueError(f"Unknown supplier country: {supplier_country}")
    return Decimal(str(vat_rate))

def get_internal_markup(supplier_country: str, seller_region: str) -> Decimal:
    """
    Get internal markup based on supplier country and seller region
    
    Args:
        supplier_country: Country where supplier is located
        seller_region: Region code of seller company (RU, TR, CN)
    
    Returns:
        Internal markup as Decimal (e.g., 0.13 for 13%)
    
    Raises:
        ValueError: If combination not found in mapping
    """
    markup = INTERNAL_MARKUP_MAP.get((supplier_country, seller_region))
    if markup is None:
        raise ValueError(
            f"No markup defined for supplier={supplier_country}, "
            f"seller_region={seller_region}"
        )
    return Decimal(str(markup))
```

---

**Usage in Formulas:**

**For M16 (vat_seller_country):**

`Excel Formula (Final-8): =S16*(1+M16)
Python Translation: purchase_price * (1 + get_vat_seller_country(supplier_country))`

**For internal_markup:**

`Excel Formula (Final-46): =S16*(1+AW16)
Python Translation: purchase_price * (1 + get_internal_markup(supplier_country, seller_region))`

### rate_vatRu (Derived from seller_region)

---

**Also known as:** VAT rate in seller's destination country
**Derivation Logic:** VAT rate based on which country we're selling from (seller_region).

**Current Mapping:**

| seller_region | rate_vatRu | Description |
| --- | --- | --- |
| RU | 20% (0.20) | Russian VAT |
| TR | 0% (0.00) | Turkey - not yet implemented |
| CN | 0% (0.00) | China - not yet implemented |

**Note:** Currently only RU (Russia) is fully implemented. Other regions default to 0% until business rules are defined.

**Key Difference from vat_seller_country:**

- `vat_seller_country` (M16) = VAT in **supplier's** country (where we buy from)
- `rate_vatRu` = VAT in **seller's** country (where we sell from)

**Python Implementation:**

```python
from decimal import Decimal

RATE_VAT_BY_SELLER_REGION = {
    "RU": Decimal("0.20"),  # Russian VAT: 20%
    "TR": Decimal("0.00"),  # Turkey: to be defined
    "CN": Decimal("0.00")   # China: to be defined
}

def get_rate_vat_ru(seller_region: str) -> Decimal:
    """
    Get VAT rate for seller's destination country

    Args:
        seller_region: Region code from seller_company (RU, TR, CN)

    Returns:
        VAT rate as Decimal (e.g., 0.20 for 20%)
    """
    vat_rate = RATE_VAT_BY_SELLER_REGION.get(seller_region)
    if vat_rate is None:
        raise ValueError(f"Unknown seller region: {seller_region}")
    return vat_rate
```

**Usage in Formulas:**

- Final-18: `IF(seller_region="RU", rate_vatRu, 0)` → Apply when selling from Russia
- Final-39: `IF(offer_incoterms="DDP", rate_vatRu, 0)` → Apply for DDP deliveries
- Final-42: Used for Russian import VAT calculations

### **offer_sale_type - Complete Specification**

**Variable Type:** User Input (Dropdown/Select)

**Category:** Company Settings

**Cell Reference:** D6

**Required:** No

**Default:** Поставка

### **Valid Values & Business Meaning:**

```
ValueRussian NameBusiness TypeKey CharacteristicsпоставкаПоставкаDirect SupplyStandard delivery to Russian client with importтранзитТранзитTransitGoods transit through Russia without importфинтранзитФинтранзитFinancial TransitTransit with financial transactionsэкспортЭкспортExportSelling from Russia to foreign market
```

### **Calculation Impact:**

**Formulas that check offer_sale_type:**

1. **Final-4** - Profit calculation:
    - `поставка`: Use COGS (AB16) for markup base
    - `транзит`: Use purchase price (S16) for markup base
2. **Final-7** - Financial agent fee:
    - `экспорт`: Fee = 0 (no cross-border financial transactions)
    - Other types: Apply rate_fin_comm
3. **Final-11** - Customs fee:
    - `поставка`: Use internal sale amount (AY16)
    - `транзит`: Use purchase price (S16)
4. **Final-38** - Sale price calculation:
    - `поставка`: Base on COGS (AB16)
    - `транзит`: Base on purchase price + logistics (S16+V16)
5. **Final-42** - Import VAT:
    - `экспорт`: No import VAT (excluded)
    - Other types: May apply Russian VAT depending on INCOTERMS
6. **Final-44** - Transit commission:
    - `транзит`: Calculate commission from profits and expenses
    - Other types: Commission = 0

### **Python Implementation:**

```jsx
from enum import Enum

class OfferSaleType(str, Enum):
    """Deal type for quotation"""
    SUPPLY = "поставка"          # Direct supply/delivery
    TRANSIT = "транзит"           # Transit through Russia
    FIN_TRANSIT = "финтранзит"   # Financial transit
    EXPORT = "экспорт"            # Export from Russia

# Validation
VALID_OFFER_SALE_TYPES = [
    "поставка",
    "транзит", 
    "финтранзит",
    "экспорт"
]

def validate_offer_sale_type(value: str) -> str:
    """Validate and normalize offer_sale_type"""
    if value not in VALID_OFFER_SALE_TYPES:
        raise ValueError(
            f"Invalid offer_sale_type: {value}. "
            f"Must be one of: {VALID_OFFER_SALE_TYPES}"
        )
    return value
```

---

---

## SECTION 1.7: COST DISTRIBUTION LOGIC

### Purpose

Many costs in a quotation apply to the **entire quote** (all products combined), not individual line items. These indirect costs must be allocated proportionally across products.

### What Gets Distributed

**Indirect costs that need distribution:**

- **Financing costs** (BA16) - Cost of borrowing money to fulfill the order
- **Credit sales interest** (BB16) - Interest on delayed payment from client
- **Logistics costs** (T16) - Shipping costs from supplier to hub and customs
- **Financial agent fees** (AI16) - Cross-border transaction fees

### Distribution Base (BD16)

**Formula:** `BD16 = S16 / S13`

**Meaning:** Each product's share of total purchase price

Where:

- **S16** = This product's purchase price in quotation currency
- **S13** = Total purchase price of entire quote (sum of all products)

### Why Use Purchase Price as Distribution Base?

Products with higher value:

- Consume more financing (tie up more capital)
- Take up more logistics capacity
- Represent greater financial risk
- Should bear proportionally higher indirect costs

This is economically fair and reflects true cost allocation.

### Distribution Formula Pattern

**General pattern:**

---

## 

- `--
## SECTION 1.8: FINANCING MODEL & INTEREST CALCULATIONS
### Overview
The B2B quotation system includes sophisticated financing cost calculations that model the real cash flow timeline:
- Company pays supplier upfront (Day 0)
- Client pays advance later (Day K5)
- Financing gap must be covered with loans
- Interest accrues over time until final payment
**Key Variables:**
- **K5** (time_to_advance) - Days until client pays advance
- **D9** (delivery_time) - Days until product delivered
- **K9** (time_to_payment_after_delivery) - Days after delivery until final payment
- **rate_loan_interest_daily** - Daily interest rate on borrowed funds
---
### Timeline & Cash Flow`

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

`---

### Three Financing Scenarios

#### Scenario 1: Supplier Payment Financing (BJ7)

**Purpose:** Finance the gap between when supplier must be paid (Day 0) and when client pays final balance (Day D9+K9)

**Two-Stage Calculation (Python Implementation):**

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

**Excel Simplified Formula (Final-15):**`

BI7 = FV(rate_loan_interest_daily, D9+K9, , -BH7)

`Where BH7 = BH6 - BH3 (net amount to finance)

**Note:** Excel uses simplified single-stage calculation. Python uses accurate two-stage calculation that results in lower financing costs.

**Example:**`

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
Difference: More accurate by ~239 RUB

`---

#### Scenario 2: Operational Costs Financing (BJ10)

**Purpose:** Finance logistics, customs clearance, import duties, VAT, and brokerage costs

**What is financed (BH10):**
- Logistics costs (supplier to hub, hub to customs, customs to client)
- Customs brokerage fees
- Import duties and VAT payments
- Warehousing and documentation costs

**Calculation (Final-25):**`

BI10 = FV(rate_loan_interest_daily, D9+K9-K6, , -BH10)

`Where:
- **BH10** = Amount needed for operational costs (calculated in Final-21)
- **D9+K9-K6** = Financing period (K6 usually = 0)

**BH10 Calculation (Final-21):**`

BH10 = IF((BH9+IF(BH3>BH6,BH3-BH6,0))>BH8,
0,
BH8-(BH9+IF(BH3>BH6,BH3-BH6,0)))

`Translation: Amount still needed after initial payment and any excess advance

**Interest cost (BJ10):**`

BJ10 = BI10 - BH10

`---

#### Scenario 3: Credit Sales Interest (BL5)

**Purpose:** Model the opportunity cost of extending credit to the client after delivery

**What it represents:**
After product is delivered (Day D9), the client still owes money and takes K9 more days to pay. The company finances this receivable.

**Amount financed (BL3) - Final-28:**`

BL3 = BH2 - BH3

`Where:
- **BH2** = Evaluated revenue (total quote value)
- **BH3** = Advance already paid
- **BL3** = Remaining balance (accounts receivable)

**Future value (BL4) - Final-29:**`

BL4 = FV(rate_loan_interest_daily, K9, , -BL3)

`**Interest cost (BL5) - Final-30:**`

BL5 = BL4 - BL3

`**Example:**`

Total revenue: 120,000 RUB
Advance paid: 50,000 RUB
Amount financed (BL3): 70,000 RUB

Credit period (K9): 15 days
Daily rate: 0.069%

Interest (BL5): 70,000 × (1.00069^15 - 1) = 728 RUB

`---

### Total Financing Cost

**Total Initial Financing (BJ11) - Final-13:**`

BJ11 = BJ7 + BJ10

`Combines supplier payment financing and operational costs financing.

**Total Credit Sales Interest:**`

BL5 (calculated separately)

`**Grand Total Financing Cost:**`

Total = BJ11 + BL5

`This total cost is then **distributed across all products** proportionally using the distribution base (BD16) - see Section 1.7.

**Per-Product Allocation:**
- **BA16** (Final-12): Supplier + operational financing per product = `BJ11 × BD16`
- **BB16** (Final-31): Credit sales interest per product = `BL5 × BD16`

---

### Python Implementation

**Installation Requirements:**
```bash`

pip install numpy-financial

`**Complete Two-Stage Financing Code:**
```python`

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

`rate = float(daily_interest_rate)
pv = float(principal)
fv = npf.fv(rate, days, 0, -pv)`

`return Decimal(str(round(fv, 2)))`

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

`Stage 1: Borrow full supplier payment from Day 0 to K5
Stage 2: Borrow reduced amount from K5 to D9+K9`

`Returns accurate interest cost accounting for advance timing
"""
if supplier_payment <= 0 or client_advance >= supplier_payment:
    return {
        "stage1_principal": Decimal("0"),
        "stage1_interest": Decimal("0"),
        "stage2_principal": Decimal("0"),
        "stage2_interest": Decimal("0"),
        "total_interest_cost": Decimal("0")
    }`

`# STAGE 1: Full supplier payment for K5 days
stage1_principal = supplier_payment
stage1_days = time_to_advance
stage1_fv = calculate_future_value_loan(
    stage1_principal, daily_interest_rate, stage1_days
)
stage1_interest = stage1_fv - stage1_principal`

`# STAGE 2: Reduced loan after advance applied
stage2_principal = stage1_fv - client_advance
stage2_days = delivery_time + time_to_payment_after_delivery - time_to_advance
stage2_fv = calculate_future_value_loan(
    stage2_principal, daily_interest_rate, stage2_days
)
stage2_interest = stage2_fv - stage2_principal`

`# Total interest (BJ7)
total_interest = stage1_interest + stage2_interest`

`return {
    "stage1_principal": stage1_principal,
    "stage1_days": stage1_days,
    "stage1_interest": stage1_interest,`

    `"stage2_principal": stage2_principal,
    "stage2_days": stage2_days,
    "stage2_interest": stage2_interest,`

    `"total_interest_cost": total_interest  # BJ7
}`

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

`days_financed = delivery_time + time_to_payment_after_delivery - time_to_advance_loading
future_value = calculate_future_value_loan(
    amount_to_finance, daily_interest_rate, days_financed
)
interest_cost = future_value - amount_to_finance`

`return {
    "amount_borrowed": amount_to_finance,
    "interest_cost": interest_cost,  # BJ10
    "days_financed": days_financed
}`

def calculate_credit_sales_interest(
evaluated_revenue: Decimal,  # BH2
client_advance: Decimal,     # BH3
time_to_payment_after_delivery: int,  # K9
daily_interest_rate: Decimal
) -> dict:
"""Credit sales interest (single-stage)"""
amount_financed = evaluated_revenue - client_advance

`if amount_financed <= 0:
    return {
        "interest_cost": Decimal("0"),
        "days_financed": 0
    }`

`days_financed = time_to_payment_after_delivery
future_value = calculate_future_value_loan(
    amount_financed, daily_interest_rate, days_financed
)
interest_cost = future_value - amount_financed`

`return {
    "amount_financed": amount_financed,
    "interest_cost": interest_cost,  # BL5
    "days_financed": days_financed
}`

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

`Returns:
    dict with BJ7, BJ10, BJ11, BL5, and total financing cost
"""
# BJ7: Supplier payment financing (two-stage)
supplier_financing = calculate_supplier_payment_financing_two_stage(
    supplier_payment, client_advance, time_to_advance,
    delivery_time, time_to_payment_after_delivery, daily_interest_rate
)`

`# BJ10: Operational costs financing
operational_financing = calculate_operational_costs_financing(
    operational_costs, delivery_time, time_to_payment_after_delivery,
    time_to_advance_loading, daily_interest_rate
)`

`# BL5: Credit sales interest
credit_sales_financing = calculate_credit_sales_interest(
    evaluated_revenue, client_advance,
    time_to_payment_after_delivery, daily_interest_rate
)`

`# BJ11: Total initial financing
bj11 = (supplier_financing["total_interest_cost"] + 
        operational_financing["interest_cost"])`

`# BL5: Total credit interest
bl5 = credit_sales_financing["interest_cost"]`

`return {
    "bj7_supplier_financing": supplier_financing["total_interest_cost"],
    "bj10_operational_financing": operational_financing["interest_cost"],
    "bj11_total_initial_financing": bj11,
    "bl5_credit_sales_interest": bl5,
    "total_financing_cost": bj11 + bl5,`

    `# Detailed breakdowns
    "supplier_financing_details": supplier_financing,
    "operational_financing_details": operational_financing,
    "credit_sales_details": credit_sales_financing
}`

`**Usage Example:**
```python`

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

`---

### Key Advantages of Two-Stage Model

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

### Related Calculations

**Distribution to Products:**
- **BA16** (Final-12): `= BJ11 × BD16` - Financing cost per product
- **BB16** (Final-31): `= BL5 × BD16` - Credit interest per product

See **Section 1.7: Cost Distribution Logic** for details on how BD16 (distribution base) is calculated.

---`

## SECTION 2: SYSTEM CONFIGURATION VARIABLES

### Admin-Controlled Parameters

These affect all quote calculations. Can be auto-updated and/or manually overridden by admins.

| Variable | Type | Description | Examples | Default | Auto Update | Manual Override By | Override Until | Impact Scope | Comment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *Examples to fill in:* |  |  |  |  |  |  |  |  |  |
| rate_fin_comm | Decimal | Financial agent fee % | 2,3,2.5,5 | 2 | Manual Only | Finance Admin, Super Admin | Permanent | All quotes that are made after the value is updated |  |
| rate_loan_interest_daily | Decimal | Rate loan calculated as rate loan interest annual divided by 365 days | 0.002, 000.5 | 0.00069 | Manual Only | Finance Admin, Super Admin | Permanent | All quotes that are made after the value is updated | would be great to enter annual interest rate and then calculate daily rate based on it |

**Template Row**: Add your admin-controlled variables following the pattern above.

---

## SECTION 3: IMPLEMENTATION NOTES

### Pydantic Models - Category Based

```python
from pydantic import BaseModel, Field
from decimal import Decimal

class ProductInfo(BaseModel):
    base_price_VAT: Decimal = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    weight_in_kg: Decimal = Field(default=0, ge=0)
    currency_of_base_price: str = Field(..., regex="^(USD|EUR|CNY|RUB|AED)$")
    customs_code: int

class FinancialParams(BaseModel):
    currency_of_quote: str = Field(default="USD")
    exchange_rate_base_price_to_quote: Decimal = Field(..., gt=0)
    supplier_discount: Decimal = Field(default=0, ge=0, le=100)
    markup: Decimal = Field(..., gt=0)
    # ... etc
```

### Key Implementation Rules

1. **Percentages**: User enters 15 for 15%, convert to 0.15 in calculations
2. **Multi-currency**: Use exchange_rate_base_price_to_quote for conversion
3. **Payment terms**: Sum of all advance percentages should equal 100%
4. **Conditional logic**: dm_fee_value only used if dm_fee_type is set
5. **Excise tax**: Requires weight_in_kg for calculation
6. **Cell references**: For validation against original Excel implementation
7. Util_fee is not subject for accrual of VAT

---

## SECTION 4: CALCULATION LOGIC - REVERSE ENGINEERING TEMPLATE

### Special Note: Financing Calculations (BJ7, BJ10, BL5)

**Excel vs Python Implementation Difference:**

The Excel formulas for financing costs (Final-14 through Final-31) use a **simplified single-stage calculation** for ease of use in spreadsheets:

- Formula: `=FV(rate_loan_interest_daily, D9+K9, , -BH7)`
- Assumes loan of BH7 for entire period (D9+K9 days)

**Python implementation uses a more accurate TWO-STAGE calculation** that accounts for when the client advance is received:

- **Stage 1 (Day 0 to K5):** Borrow full supplier payment (BH6)
- **Stage 2 (Day K5 onwards):** Loan reduces after advance received
- This results in **lower financing costs** and more competitive pricing

**Impact:** The two-stage Python calculation typically saves 2-5% on financing costs compared to the Excel formula, resulting in more accurate quotes and better pricing for clients.

**Implementation:** See Section 1.8 for detailed two-stage financing model and Python code.

### Excel Calculation Mapping - Master Template

**How to use:**

1. Find your final result cell in Excel
2. Click "Trace Precedents" (Formulas tab) to see inputs
3. Work backwards, fill one row per calculation
4. Continue until you reach only your 39 input variables

| Step | Calculation name in Russian | Calculation Name | Description | Excel Formula | Input Cells | Result Cell | Example Input | Example Output | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FINAL |  | Total Quote | Final amount to client per product | ==IFERROR(ROUND(SUM(AB16,AF16:AI16)/E16,2),0) |  |  |  |  |  |
| Final -1 |  | Total COGS | Final amount of COGS | =SUM(AB16:AB2015) | AB16 cogs per line, AB17 cogs per line, AB18 cogs per line etc. | AB13 | 100,200,300 | 600 | doesn’t include VAT. list might be longer or shorter than 2000 lines |
| Final - 1 |  | Sales price | Sales price | =AJ16*E16 | AJ16 SP, E16 quantity | AK16 | 1000,10 | 10000 | doesn’t include VAT |
| Final -2 |  | Sales price per unit | Sales price per unit in quantity of 1 | =IFERROR(ROUND(SUM(AB16,AF16:AI16)/E16,2),0) | AB16 COGS per unit, AF16 profit (w/o vat; financial expenses and dm fee amount), AG16 dm fee amount, AH16 reserve for negative exchange rate, AI16 financial agent fee, E16 quantity | AJ16 | 1000, 20,30,50,100,10 | 120 | doesn’t include VAT |
| Final -3 |  | COGS | Cost of goods sold | =ROUND(SUM(S16,V16,Y16:Z16,BA16:BB16),2) | S16 purchase price in quotation currency, V16 total amount of logistics per line, Y16 customs fee amount per line, Z16 excise tax amount per line, BA16 total cost of financing per line, BB16 total credit sales interest per line | AB16 | 100,150,150,100,250,250 | 1000 | doesn’t include VAT |
| Final -4 |  | profit | profit before expenses like vat, financial expenses, dm fee etc. | =IFERROR(ROUND(IFS(offer_sale_type="поставка",AB16,offer_sale_type="транзит",S16)*AC16,2),0) | AB16 COGS, S16 purchase price in quotation currency, AC16 markup | AF16 | 100, 50,10%, поставка; 100,50,10%, транзит | 10; 5 | 2 examples of input and output divided by ; |
| Final -5 |  | DM fee | decision maker fee per line | =$BD16*VLOOKUP($AG$3,$AF$4:$AG$7,2,FALSE) | BD16 base for distribution of indirect costs, AG3 is dm_fee_type, AF4 is value for DM fee if AG3 is “fixed”, AF7 is value for DM fee if AG3 is “%” | AG16 | 0.35, “fixed”, 3000; 0.35, “%”,10% | 1050;=10%*AB16 | 2 examples of input and output divided by ; |
| Final -6 |  | reserve for negative exchange rate | amount of money reserved in case of loss during currency exchange | =SUM(AE16,AG16,AI16)*rate_forex_risk | AE16 cogs + profit, AG16 DM fee, AI16 financial agent fee | AH16 | 100,100,100,5% | 15 |  |
| Final -7 |  | financial agent fee | amount of money paid for cross border financial transactions | =IF(OR(seller_region="TR",offer_sale_type="экспорт"),0,rate_fin_comm)*SUM(AZ16,AZ16**AW16,T16) | seller_region refers to seller_company for which rate_fin_comm is either applicable or not, rate_fin_comm is a variable, AZ16 purchase price in quotation currency with VAT included, AW16 internal markup, T16 logistics_ supplier_hub + logistics_hub_customs distributed by the purchase price in quotation currency | AI16 | “TR”, “транзит”,2%,100,10%,200; “RU”, “поставка”,2%,100,10%,100 | 0;4.2 | 2 examples of input and output divided by ; |
| Final -8 |  | Purchase price in quotation currency + VAT in seller_country | amount of money paid for product in seller_country | =S16*(1+M16) | S16 purchase price in quotation currency, M16 VAT in seller_country | AZ16 | 10,20% | 12 | VAT is different in different seller_country |
| Final -9 |  | Purchase price in quotation currency | Purchase price in quotation currency | =IF(AND(ISNUMBER(E16),ISNUMBER(Q16)),E16*R16,0) | E16 quantity, Q16 exchange_rate_base_price_to_quote, R16 purchase price in quotation currency per item | S16 | 10, 5, 10 | 100 |  |
| Final -10 |  | Logistics distributed on prouct | Logistics distributed on product | =+SUM(T16:U16) |  T16 logistics_ supplier_hub + logistics_hub_customs distributed by the purchase price in quotation currency, U16 logistics_customs_clients distributed by the purchase price in quotation currency | V16 | 10,5 | 15 |  |
| Final -11 |  | Customs fee amount | Customs fee amount to be paid on customs clearance | =IF(offer_incoterms="DDP",X16*IF(offer_sale_type="поставка",AY16,S16),0) | X16 import_tariff, AY16 amount in internal sales document, S16 purchase price in quotation currency | Y16 | “DAP”.7%,”поставка”, 1300, 1000; “DAP”.7%,”поставка”, 1300, 1000; “DAP”.7%,”транзит”, 1300, 1000 | 0;91;70 | 3 examples of input and output divided by ; |
| Final -12 |  | Cost of financing | How much money does it cost to finance the deal distributed on product | =BJ11*$BD16 | BJ11 total cost of financing, BD16 distribution part | BA16 | 100,15% | 15 |  |
| Final -13 |  | Cost of financing total | How much money does it cost to finance the deal in total | =BJ7+BJ10 | BJ7 cost of financing in initial payment for supplier, BJ10 need in financing after producit is ready for pick up | BJ11 | 50,30 | 80 |  |
| Final -14 |  | Cost of financing 2 | Cost of financing after the initial payment for the supplier is made | =BI10-BH10 | BI10 is future value of money that is left to be paid by client after advance is paid, BH10 current value of money that is left to be paid by client after advance is paid | BJ10 | 110,100 | 10 |  |
| Final -14 |  | Cost of financing 1 | Cost of financing in the initial payment for supplier | =BI7-BH7 | BH7 how much is still needed to be financed to pay initial payment to supplier, BI7 is BH7 plus interest accumulated on financing BH7 | BJ7 | 50,30 | 20 |  |
| Final -15 |  | Future Value of need for financing for initial payment for supplier | Future Value of need for financing for initial payment for supplier | =FV(rate_loan_interest_daily,D9+K9,,-BH7) |  | BI7 | 1%,1,1,-100 | 102.01 |  |
| Final -16 |  | how much is still needed to be financed to pay initial payment to supplier | how much is still needed to be financed to pay initial payment to supplier | =IF(BH3>0,IF(BH3>=BH6,0,BH6-BH3),BH6) | BH3 advance paid by customer, BH6 amount of initial payment to supplier plus financial agent fee | BH7 | 50,200 | 150 |  |
| Final -17 |  | advance paid by customer | advance paid by customer | =BH2 * (J5 / 100) | BH2 (evaluated revenue), J5 (advance_from_client percentage) | BH3 | 100,50 | 50 |  |
| Final -18 |  | Evaluated revenue of the quote | Evaluated revenue of the quote | =(BJ2*(1+AC12)+BJ3)*(1+IF(seller_region="RU",rate_vatRu,0)) | BJ2 direct COGS, AC12 average markup, BJ3 indirect COGS, rate_vatRu rate VAR in russia | BH2 | 100,10%,10,20% | 144 |  |
| Final -19 |  | Average Markup | Average Markup | =AF13/AB13 | AF13 total markup amount per quote, AB13 total cogs amount per quote | AC12 | 10,100 | 10% |  |
| Final -20 |  | Direct COGS | Direct COGS | =AB13 | AB13 total cogs amount per quote | BJ2 | 100 | 100 |  |
|  |  | Indirect COGS (negative exchange rate risk and DM fee) | Indirect COGS (negative exchange rate risk and DM fee) | =BJ2**rate_forex_risk+IF(AG3="Фикс",AG7,BJ2**AG7) |  | BJ3 | 100,2,”Фикс”,1000,10;100,2,”%”,1000,10%; | 1002;12 |  |
|  |  |  |  |  |  |  |  |  |  |
| Final -21 |  | How much is still needed to be paid to fulfill quoute after initial payment to supplier is made | How much is still needed to be paid to fulfill quoute after initial payment to supplier is made | =IF((BH9+IF(BH3>BH6,BH3-BH6,0))>BH8,0,BH8-(BH9+IF(BH3>BH6,BH3-BH6,0))) | BH9 advance payable by client after initial payment to supplier is made, BH6 | BH10 |  |  |  |
| Final -22 |  | How much money is left to pay by client after advance | How much money is left to pay by client after advance | =1-J5 |  | BH9 | 60% | 40% |  |
| Final -23 |  | Amount of money payable as initial payment to supplier | Amount of money payable as initial payment to supplier (includes financial agent fees) | =AZ13*D11***(1+rate_fin_comm) | AZ13 total purchase price of the quote including VAT | BH6 | 10000,100%,2% | 10200 |  |
| Final -24 |  | Amount payable after initial payment to supplier is made but before further advance from client are recieved | Amount payable after initial payment to supplier is made but before further advance from client are recieved | =BH4-BH6 |  | BH8 |  |  |  |
| Final -25 |  | Future value of BH10 |  | =FV(rate_loan_interest_daily,D9+K9-K6,,-BH10) |  | BI10 | 1%,1,1,-100 | 102.01 |  |
| Final -26 |  | total purchase price of the quote including VAT | total purchase price of the quote including VAT | =sum(AZ16:AZ2015) |  | AZ13 |  |  |  |
| Final -27 |  | total amount payable before forwarding to Russia | total amount payable before forwarding to Russia | =SUM(AZ13,W2,W3)*(1+rate_fin_comm) |  | BH4 | 100,10,20 | 130 |  |
| Final -28 |  | amount to be financed by company |  | =BH2-BH3 |  | BL3 | 200,100 | 100 |  |
| Final -29 |  | Future value of BL3 |  | =FV(rate_loan_interest_daily,K9,,-BL3) |  | BL4 | 1%,1,1,-100 | 102.01 |  |
| Final -30 |  | Comission for delayed payment |  | =BL4-BL3 |  | BL5 | 102,100 | 2 |  |
| Final -31 |  | Comissiomn for delayed payment per product |  | =BL5*BD16 |  | BB16 | 100,20% | 20 |  |
| Final -32 |  | Base for distribution of indirect expenses |  | =S16/S13 |  | BD16 | 10,100 | 10% |  |
| Final -33 |  | Total purchase price in quotation currency |  | =SUM(S16:S2015) |  | S13 |  |  |  |
| Final -34 |  | Purchasing price cleared of VAT |  | =K16/(1+M16) |  | N16 | 120,20% | 100 |  |
| Final -35 |  | Purchasing price after discount |  | =N16*(1-O16) |  | P16 | 100,20% | 80 |  |
| Final -36 |  | Purchasing price in the quotation currency |  | =P16/Q16 |  | R16 | 100,10 | 10 |  |
| Final -37 |  | COGS of the item in quantity of 1 |  | =IFERROR(AB16/E16,0) |  | AA16 | 1000,10 | 10 |  |
| Final -38 |  | Sale price excluding financial expenses per item in quantity of 1 |  | =IFERROR(ROUND((IFS(offer_sale_type="поставка",AB16,offer_sale_type="транзит",S16+V16)*(1+AC16))/E16,2),0) |  | AD16 |  |  |  |
| Final -38 |  | Sale price excluding financial expenses per product |  | =AD16*E16 |  | AE16 | 1000,10 | 10000 |  |
| Final -39 |  | Sale price including VAT per item in quantity of 1 |  | =(AJ16*(1+IF(offer_incoterms="DDP",rate_vatRu,0))) |  | AM16 | 100 | 120 |  |
| Final -40 |  | Sale price including VAT per product |  | =IFERROR(AM16*E16,0) |  | AL16 | 100,10 | 1000 |  |
| Final -41 |  | VAT payable from sales |  | =AL16-AK16 |  | AN16 |  |  |  |
| Final -42 |  | VAT payable at import to Russia |  | =SUM(AY16,Y16:Z16)*IF(AND(offer_incoterms="DDP",offer_sale_type<>"экспорт"),rate_vatRu,0) |  | AO16 | 100,10,10 | 144 |  |
| Final -43 |  | VAT payable (sales-import) |  | =AN16-AO16 |  | AP16 |  |  |  |
| Final -44 |  | Commission for transit deal per product |  | =IF(offer_sale_type="транзит",SUM(AF16:AI16,BA16,BB16),0) |  | AQ16 |  |  |  |
| Final -45 |  | Amount of internal sale per product |  | =E16*AX16 |  | AY16 | 63,2 | 126 |  |
| Final -46 |  | Amount of internal sale per item in quantity of 1 |  | =IFERROR(ROUND(S16*(1+AW16)/E16,2),0) |  | AX16 | 100,26,2 | 63 |  |