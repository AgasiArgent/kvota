# USD as Canonical Calculation Currency

**Date:** 2025-11-25
**Status:** Approved
**Author:** Claude + User

---

## Problem Statement

Current calculation engine uses `quote_currency` (e.g., RUB, EUR) as the calculation currency. This causes:

1. **Inconsistent profit tracking** - Profit calculated in various currencies, not comparable
2. **Complex currency handling** - Each monetary field needs individual conversion logic
3. **Analytics difficulties** - Cannot aggregate or compare quotes in different currencies
4. **Audit confusion** - Historical values depend on which currency was used

**Business requirement:** USD is the company's internal accounting currency. All profit, costs, and margins should be tracked in USD.

---

## Solution Overview

Change calculation engine to use USD as canonical currency:

1. **Input:** Convert all monetary values to USD using CBR rates
2. **Calculate:** Run all 13 phases in USD
3. **Output:** Convert client-facing prices to quote currency
4. **Store:** Both USD values (canonical) and quote currency values (presentation)

---

## Data Flow

```
INPUT (various currencies)
       ↓
STEP 1: Read values with original currency
       ↓
STEP 2: Convert ALL to USD (CBR rate of quote_date)
       ↓
STEP 3: Calculate 13 phases in USD
       ↓
STEP 4: Convert client prices to quote_currency
       ↓
STORE: USD values + quote_currency values + rates snapshot
```

---

## Detailed Design

### Step 1: Input Collection

No change. Frontend sends:
- `currency_of_quote`: Target currency for client (RUB, EUR, etc.)
- `monetary_fields`: Object with `{field_name: {value, currency}}`
- `products[].base_price_vat`: Product prices
- `products[].currency_of_base_price`: Product currency

### Step 2: USD Normalization

**Location:** `backend/routes/quotes_calc.py` - `map_variables_to_calculation_input()`

Convert all monetary inputs to USD:

```python
# Logistics costs → USD
logistics_supplier_hub_usd = get_converted_monetary_value('logistics_supplier_hub', variables, "USD")
logistics_hub_customs_usd = get_converted_monetary_value('logistics_hub_customs', variables, "USD")
logistics_customs_client_usd = get_converted_monetary_value('logistics_customs_client', variables, "USD")

# Brokerage costs → USD
brokerage_hub_usd = get_converted_monetary_value('brokerage_hub', variables, "USD")
brokerage_customs_usd = get_converted_monetary_value('brokerage_customs', variables, "USD")
# ... etc

# Product base price → USD
exchange_rate_to_usd = get_exchange_rate(product_currency, "USD")
base_price_usd = base_price_vat / exchange_rate_to_usd
```

**Exchange rates snapshot:**
Store all rates used for audit trail:
```python
rates_snapshot = {
    "EUR_USD": get_exchange_rate("EUR", "USD"),
    "RUB_USD": get_exchange_rate("RUB", "USD"),
    "TRY_USD": get_exchange_rate("TRY", "USD"),
    "CNY_USD": get_exchange_rate("CNY", "USD"),
    "quote_date": quote_date.isoformat(),
    "source": "cbr"
}
```

### Step 3: Calculation in USD

**Location:** `backend/calculation_engine.py` (unchanged internally)

The calculation engine already works with a single currency. We just change what currency that is:

- `FinancialParams.currency_of_quote` = `Currency.USD` (always)
- All 13 phases run in USD
- All intermediate values (R16, S16, V16, AB16, etc.) are in USD

**Key outputs in USD:**
- R16: Purchase price per unit (USD)
- S16: Purchase price total (USD)
- V16: Logistics total (USD)
- AB16: COGS (USD)
- AJ16: Sales price per unit no VAT (USD)
- AK16: Sales price total with VAT (USD)
- AL16: Final total (USD)
- Profit: In USD (this is what matters for accounting)

### Step 4: Quote Currency Conversion

**Location:** `backend/routes/quotes_calc.py` - after calculation completes

Convert client-facing prices to quote currency:

```python
# Get USD → quote_currency rate
usd_to_quote_rate = get_exchange_rate("USD", quote_currency)

# Convert client prices
result_quote_currency = {
    "AJ16_quote": result.sales_price_per_unit_no_vat * usd_to_quote_rate,
    "AK16_quote": result.sales_price_total_with_vat * usd_to_quote_rate,
    "AL16_quote": result.final_total * usd_to_quote_rate,
    "quote_currency": quote_currency,
    "usd_to_quote_rate": usd_to_quote_rate
}
```

### Step 5: Storage

**Table:** `quote_calculation_results.phase_results` (JSONB)

Store both:
```json
{
  "currency": "USD",
  "R16": 14.20,
  "S16": 1420.00,
  "AJ16": 4025.00,
  "AK16": 4830.00,
  "profit": 525.00,

  "quote_currency": "RUB",
  "AJ16_quote": 318055.50,
  "AK16_quote": 381666.60,
  "usd_to_quote_rate": 79.02,

  "rates_snapshot": {
    "EUR_USD": 1.08,
    "RUB_USD": 0.01265,
    "TRY_USD": 0.0284,
    "quote_date": "2025-11-25"
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/routes/quotes_calc.py` | Change conversion target to USD, add quote currency conversion step |
| `backend/calculation_models.py` | Add quote currency output fields |
| `backend/services/excel_service.py` | Use quote currency values for Excel export |
| `backend/services/pdf_service.py` | Use quote currency values for PDF export |
| `frontend/src/app/quotes/[id]/page.tsx` | Display quote currency values for client prices |

---

## What Stays the Same

- `calculation_engine.py` internals (13 phases unchanged)
- BD16 distribution logic
- Admin settings (rate_forex_risk, etc.)
- Frontend input components
- `monetary_fields` structure

---

## Migration

**Existing quotes:** No migration needed. They already have calculated values stored. New calculations will use USD.

**New quotes:** Will have both USD and quote currency values.

---

## Testing Strategy

1. **Unit tests:** Verify USD conversion for all monetary fields
2. **Integration test:** Create quote with EUR logistics, RUB brokerage, TRY products → verify USD calculation
3. **Regression:** Ensure existing test cases still pass (values will be in USD now)
4. **Export tests:** Verify Excel/PDF show quote currency values

---

## Success Criteria

- [ ] All intermediate calculations in USD
- [ ] Profit displayed in USD
- [ ] Client prices displayed in quote currency
- [ ] Exchange rates snapshot stored for audit
- [ ] Excel/PDF exports show quote currency for client prices
- [ ] Analytics can aggregate quotes across currencies (all in USD)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing exports | Test Excel/PDF exports thoroughly |
| Rate precision loss | Use Decimal throughout, store rates with sufficient precision |
| Missing rate for currency pair | Fallback via RUB (CBR has X→RUB for all currencies) |

---

## Timeline

Estimated: 4-6 hours implementation + testing
