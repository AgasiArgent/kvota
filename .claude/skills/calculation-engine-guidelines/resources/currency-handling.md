# Currency Handling - Verified from Code

**Created:** 2025-12-13
**Source:** Code analysis (not comments or documentation)
**Status:** Verified from actual implementation

---

## TL;DR - Currency Truth

| Stage | Currency | Evidence |
|-------|----------|----------|
| **Excel Input** | Various (EUR, USD, TRY, CNY, RUB) | `simplified_parser.py`, `export_validation_service.py` |
| **Cross-Rate Base** | RUB (CBR API) | `quotes_upload.py:177-210` |
| **Calculation Engine** | Quote Currency | `calculation_engine.py` (all phases) |
| **Database Storage** | DUAL (Quote + USD) | Migrations 007, 037 |
| **Export/Display** | Quote Currency | `export_data_mapper.py:124-128` |

---

## 1. Input Stage - Excel Upload

### Product Prices
Each product can have its own currency:
- `currency_of_base_price`: EUR, USD, TRY, CNY, RUB

**Code Reference:** `backend/excel_parser/simplified_parser.py`
```python
PRODUCT_INPUT_COLUMNS = {
    "J": ("currency_of_base_price", "Валюта закупки"),
    "K": ("base_price_vat", "Цена закупки (с VAT)"),
}
```

### Logistics Costs
Mixed currencies with defaults:
- `logistics_supplier_hub`: EUR (Supplier → Hub)
- `logistics_hub_customs`: EUR (Hub → Customs)
- `logistics_customs_client`: RUB (Customs → Client)

### Brokerage Costs
Mostly RUB with one EUR field:
- `brokerage_hub`: EUR
- `brokerage_customs`: RUB
- `warehousing_at_customs`: RUB
- `customs_documentation`: RUB
- `brokerage_extra`: RUB

---

## 2. Currency Conversion - RUB as Cross-Rate Base

**Code Reference:** `backend/routes/quotes_upload.py:177-251`

### How Cross-Rates Work
CBR (Central Bank of Russia) provides rates TO RUB only. To convert between any two currencies, we use RUB as the intermediate:

```python
async def get_exchange_rates(quote_currency: str, product_currencies: List[str]) -> dict:
    """Get exchange rates from CBR for all currencies used in the quote."""
    service = get_exchange_rate_service()
    rates = {}

    # Get rates to RUB (CBR base currency)
    for currency in all_currencies:
        if currency == "RUB":
            rates[f"{currency}/RUB"] = Decimal("1.0")
        else:
            rate = await service.get_rate(currency, "RUB")
            rates[f"{currency}/RUB"] = rate

    return rates

def calculate_exchange_rate(from_currency, to_currency, rates, for_division=False):
    """Calculate exchange rate between two currencies using RUB as base."""
    from_rub = rates.get(f"{from_currency}/RUB", Decimal("1.0"))
    to_rub = rates.get(f"{to_currency}/RUB", Decimal("1.0"))

    if for_division:
        result = to_rub / from_rub  # For engine's R16 = P16 / rate
    else:
        result = from_rub / to_rub  # For cost conversion

    return result.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
```

### Example Cross-Rate Calculation
Converting EUR to USD:
1. EUR/RUB = 97.50 (from CBR)
2. USD/RUB = 89.25 (from CBR)
3. EUR/USD = 97.50 / 89.25 = 1.0924

---

## 3. Rate Priority - Manual vs CBR

**Code Reference:** `backend/services/multi_currency_service.py`

```python
async def convert_to_usd(self, value, from_currency, org_id):
    """Convert to USD using org settings for rate source."""

    # Check organization settings
    org_settings = await self._get_org_settings(org_id)

    if org_settings.get("use_manual_rates"):
        # Priority 1: Manual rates (if org has them enabled)
        manual_rates = org_settings.get("manual_rates", {})
        if from_currency in manual_rates:
            rate = Decimal(manual_rates[from_currency])
            rate_source = "manual"
    else:
        # Priority 2: CBR rates (default)
        rate = await self.exchange_rate_service.get_rate(from_currency, "USD")
        rate_source = "cbr"
```

---

## 4. Calculation Engine - Quote Currency

**CRITICAL FINDING:** All calculations happen in QUOTE CURRENCY, not USD!

**Code Reference:** `backend/calculation_engine.py`

### Phase 1: Price Conversion to Quote Currency
```python
def calculate_phase1_purchase_price(
    base_price_vat: Decimal,
    vat_seller_country: Decimal,
    supplier_discount: Decimal,
    exchange_rate_base_price_to_quote: Decimal,  # Converts to quote currency
    quantity: int
) -> dict:
    # N16: Remove VAT from base price
    purchase_price_no_vat = base_price_vat / (1 + vat_seller_country)

    # P16: Apply supplier discount
    purchase_price_after_discount = purchase_price_no_vat * (1 - supplier_discount)

    # R16: Convert to quote currency (THIS IS THE KEY STEP)
    purchase_price_per_unit_quote_currency = purchase_price_after_discount * exchange_rate_base_price_to_quote

    # S16: Total in quote currency
    purchase_price_total_quote_currency = purchase_price_per_unit_quote_currency * quantity
```

### All Subsequent Phases: Quote Currency
Every intermediate and final value is in quote currency:
- Phase 3 (Logistics): `T16`, `U16`, `V16` in quote currency
- Phase 4 (COGS): `AA16`, `AB16` in quote currency
- Phase 11 (Pricing): `AJ16`, `AK16` in quote currency
- Phase 12 (VAT): `AM16`, `AL16` in quote currency

### Currency Variable
Quote currency is stored in:
```python
currency_of_quote: str  # "USD", "EUR", "RUB"
```

---

## 5. Database Storage - Dual Currency

**Code Reference:** Migrations 007, 022, 037

### quotes Table (Migration 037)
```sql
-- Both USD and quote currency stored
ALTER TABLE quotes
ADD COLUMN total_amount_quote DECIMAL(15,2),     -- Quote currency
ADD COLUMN total_with_vat_quote DECIMAL(15,2),   -- Quote currency
ADD COLUMN total_usd DECIMAL(15,2),              -- USD (for analytics)
ADD COLUMN total_with_vat_usd DECIMAL(15,2);     -- USD (for analytics)

-- Exchange rate audit trail
ADD COLUMN usd_to_quote_rate DECIMAL(12,6),
ADD COLUMN exchange_rate_source TEXT,            -- 'cbr', 'manual', 'mixed'
ADD COLUMN exchange_rate_timestamp TIMESTAMPTZ;
```

### quote_calculation_summaries Table (Migration 022 + 037)
```sql
-- Original columns in quote currency
calc_s16_total_purchase_price DECIMAL(15,2),
calc_v16_total_logistics DECIMAL(15,2),
calc_ak16_final_price_total DECIMAL(15,2),
calc_al16_total_with_vat DECIMAL(15,2),

-- Added _quote suffix columns for explicit quote currency
calc_s16_total_purchase_price_quote DECIMAL(15,2),
calc_ak16_final_price_total_quote DECIMAL(15,2),
calc_al16_total_with_vat_quote DECIMAL(15,2),

-- Exchange rate metadata
quote_currency TEXT DEFAULT 'RUB',
usd_to_quote_rate DECIMAL(12,6),
exchange_rate_source TEXT DEFAULT 'cbr',
exchange_rate_timestamp TIMESTAMPTZ
```

### quote_calculation_results Table (Migration 037)
```sql
-- JSONB for all 13 phases
phase_results JSONB,                     -- Quote currency results
phase_results_quote_currency JSONB       -- Explicit quote currency copy
```

### Save Logic (quotes_upload.py:815-843)
```python
quote_update = {
    # USD totals for analytics
    "total_usd": float(total_revenue_no_vat_usd),
    "total_with_vat_usd": float(total_revenue_with_vat_usd),

    # Quote currency totals for client-facing
    "total_amount_quote": float(total_revenue_no_vat),
    "total_with_vat_quote": float(total_revenue_with_vat),

    # Exchange rate audit
    "usd_to_quote_rate": float(usd_to_quote_rate),
    "exchange_rate_source": "cbr",
    "exchange_rate_timestamp": datetime.now(timezone.utc).isoformat(),
}
```

---

## 6. Export - Quote Currency with USD Fallback

**Code Reference:** `backend/services/export_data_mapper.py:124-128`

```python
# Client-facing prices - prefer quote currency if available, fallback to USD
'AJ16': calc.get('sales_price_per_unit_quote', calc.get('sales_price_per_unit', 0)),
'AK16': calc.get('sales_price_total_quote', calc.get('sales_price_total_no_vat', 0)),
'AM16': calc.get('sales_price_per_unit_with_vat_quote', calc.get('sales_price_per_unit_with_vat', 0)),
'AL16': calc.get('sales_price_total_with_vat_quote', calc.get('sales_price_total_with_vat', 0)),
```

### Export Formats
5 PDF formats + Excel validation export:
- supply, openbook, supply-letter, openbook-letter, invoice
- All use quote currency for client-facing values

---

## 7. Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INPUT STAGE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Excel Upload                                                                │
│  ├── Product 1: base_price=1000 EUR, currency=EUR                           │
│  ├── Product 2: base_price=500 USD, currency=USD                            │
│  ├── Logistics: 200 EUR (hub), 150 EUR (customs), 5000 RUB (client)         │
│  └── Quote currency: USD                                                     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONVERSION STAGE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  CBR API (base currency: RUB)                                                │
│  ├── EUR/RUB = 97.50                                                         │
│  ├── USD/RUB = 89.25                                                         │
│  └── Cross-rates calculated via RUB                                          │
│                                                                              │
│  Conversion to Quote Currency (USD):                                         │
│  ├── Product 1: 1000 EUR × (97.50/89.25) = 1092.44 USD                       │
│  ├── Product 2: 500 USD × 1.0 = 500 USD                                      │
│  └── Logistics: converted proportionally                                     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CALCULATION ENGINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  13 Phases - ALL IN QUOTE CURRENCY (USD in this example)                     │
│  ├── Phase 1:  Purchase price calculation (S16) = 1592.44 USD                │
│  ├── Phase 3:  Logistics distribution (V16)                                  │
│  ├── Phase 4:  COGS calculation (AB16)                                       │
│  ├── Phase 7:  Financing costs (BJ11)                                        │
│  ├── Phase 11: Sale price (AJ16, AK16) = final prices in USD                 │
│  └── Phase 12: VAT (AM16, AL16) = with VAT in USD                            │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE STAGE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Dual Currency Storage)                                          │
│                                                                              │
│  quotes table:                                                               │
│  ├── total_amount_quote = 1850.00 (in quote currency: USD)                   │
│  ├── total_with_vat_quote = 2220.00 (in quote currency: USD)                 │
│  ├── total_usd = 1850.00 (always USD for analytics)                          │
│  ├── total_with_vat_usd = 2220.00                                            │
│  └── usd_to_quote_rate = 1.0 (USD to USD = 1.0)                              │
│                                                                              │
│  quote_calculation_results:                                                  │
│  ├── phase_results (JSONB) - quote currency                                  │
│  └── phase_results_quote_currency (JSONB) - explicit backup                  │
│                                                                              │
│  Exchange Rate Audit:                                                        │
│  ├── exchange_rate_source = 'cbr'                                            │
│  └── exchange_rate_timestamp = when rate was fetched                         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXPORT STAGE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  PDF/Excel Export                                                            │
│  ├── Uses quote currency for all client-facing values                        │
│  ├── Falls back to USD values if quote currency not available                │
│  └── Formats: supply, openbook, supply-letter, openbook-letter, invoice     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Common Confusion Points

### "Calculation happens in USD" - WRONG
This is a common misconception from outdated comments. The calculation engine works in QUOTE CURRENCY.

Evidence: `calculation_engine.py` variable names like `purchase_price_per_unit_quote_currency`

### "We only store one currency" - WRONG
We store BOTH quote currency AND USD. This enables:
- Client-facing exports in their preferred currency
- Analytics always in USD for comparison
- Historical accuracy (exchange rate locked at calculation time)

### "Exchange rates are live" - PARTIALLY TRUE
- Rates are fetched from CBR API daily (12:05 MSK)
- But they're LOCKED at calculation time
- Stored in `usd_to_quote_rate`, `exchange_rate_timestamp`
- This ensures quote prices don't change after creation

---

## 9. Key Files

| File | Purpose |
|------|---------|
| `backend/calculation_engine.py` | 13 phases, all in quote currency |
| `backend/routes/quotes_upload.py` | Currency conversion, DB save |
| `backend/services/multi_currency_service.py` | Rate priority (manual > CBR) |
| `backend/services/export_data_mapper.py` | Export currency handling |
| `backend/migrations/037_dual_currency_storage.sql` | Dual currency columns |

---

**Last Updated:** 2025-12-13
**Verified By:** Code analysis audit
