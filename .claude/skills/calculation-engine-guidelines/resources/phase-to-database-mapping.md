# Phase to Database Mapping - Complete Currency Reference

**Created:** 2025-12-13
**Verified:** 2025-12-13 (database query + code analysis)
**Status:** VERIFIED - bug found and fixed

---

## Investigation Summary

### Bug Found and Fixed

**Issue:** `quotes_upload.py:903` was calling `aggregate_product_results_to_summary()` without currency parameters, causing all summaries to have:
- `quote_currency = 'RUB'` (hardcoded default)
- `usd_to_quote_rate = 1.0` (hardcoded default)

**Database Evidence:**
```
All 110 quotes had quote_currency='RUB' and usd_to_quote_rate=1.0
Even when q.currency='EUR' - mismatch confirmed the bug
```

**Fix Applied:** `quotes_upload.py:903` now passes:
```python
quote_summary = aggregate_product_results_to_summary(
    calc_results,
    quote_inputs,
    quote_currency=quote_currency,           # Now passed correctly
    usd_to_quote_rate=usd_to_quote_rate,     # Now passed correctly
    exchange_rate_source="cbr",
    exchange_rate_timestamp=datetime.now(timezone.utc)
)
```

**Why No Double-Conversion:** Since `usd_to_quote_rate=1.0`, the multiplication did nothing:
```python
# This was effectively: value * 1.0 = value
summary["calc_s16_total_purchase_price_quote"] = summary["calc_s16_total_purchase_price"] * 1.0
```

---

## Currency Truth (VERIFIED)

### Rule: ALL calculation outputs are in QUOTE CURRENCY

The calculation engine (`calculation_engine.py`) converts all inputs to quote currency BEFORE calculating. All 13 phase outputs are in quote currency.

### Where USD is Stored

Only these columns contain USD values (for analytics):
- `quotes.total_usd`
- `quotes.total_with_vat_usd`
- `quote_calculation_summaries.*_quote` columns (when rate != 1.0)

---

## 1. Calculation Engine Output (ProductCalculationResult)

### Phase 1: Purchase Price

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `purchase_price_no_vat` | N16 | QUOTE | After currency conversion |
| `purchase_price_after_discount` | P16 | QUOTE | After discount applied |
| `purchase_price_per_unit_quote_currency` | R16 | QUOTE | Name explicit |
| `purchase_price_total_quote_currency` | S16 | QUOTE | Name explicit |

### Phase 3: Logistics

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `logistics_first_leg` | T16 | QUOTE | Converted from input currency |
| `logistics_last_leg` | U16 | QUOTE | Converted from input currency |
| `logistics_total` | V16 | QUOTE | Sum of above |

### Phase 4: Duties & Internal Pricing

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `customs_fee` | Y16 | QUOTE | Calculated on quote currency value |
| `excise_tax_amount` | Z16 | QUOTE | Calculated on quote currency value |
| `internal_sale_price_per_unit` | AX16 | QUOTE | Internal pricing |
| `internal_sale_price_total` | AY16 | QUOTE | qty * per_unit |

### Phase 9: Financing

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `financing_cost_initial` | BA16 | QUOTE | Stage 1 interest |
| `financing_cost_credit` | BB16 | QUOTE | Stage 2 interest |

### Phase 10: COGS

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `cogs_per_unit` | AA16 | QUOTE | Cost of goods sold per unit |
| `cogs_per_product` | AB16 | QUOTE | qty * per_unit |

### Phase 11: Sales Pricing

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `sale_price_per_unit_excl_financial` | AD16 | QUOTE | Before financial costs |
| `sale_price_total_excl_financial` | AE16 | QUOTE | qty * per_unit |
| `profit` | AF16 | QUOTE | Margin |
| `dm_fee` | AG16 | QUOTE | Fee |
| `forex_reserve` | AH16 | QUOTE | Reserve |
| `financial_agent_fee` | AI16 | QUOTE | Fee |
| `sales_price_per_unit_no_vat` | AJ16 | QUOTE | Final per unit |
| `sales_price_total_no_vat` | AK16 | QUOTE | Final total |

### Phase 12: VAT

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `sales_price_per_unit_with_vat` | AM16 | QUOTE | With VAT |
| `sales_price_total_with_vat` | AL16 | QUOTE | With VAT |
| `vat_from_sales` | AN16 | QUOTE | VAT amount |
| `vat_on_import` | AO16 | QUOTE | Import VAT |
| `vat_net_payable` | AP16 | QUOTE | Net VAT |

### Phase 13: Transit

| Field | Excel | Currency | Notes |
|-------|-------|----------|-------|
| `transit_commission` | AQ16 | QUOTE | Transit fee |

---

## 2. Database: quote_calculation_summaries

### Primary Columns (QUOTE currency)

| Column | Source Field | Currency |
|--------|--------------|----------|
| `calc_s16_total_purchase_price` | `purchase_price_total_quote_currency` | QUOTE |
| `calc_t16_first_leg_logistics` | `logistics_first_leg` | QUOTE |
| `calc_u16_last_leg_logistics` | `logistics_last_leg` | QUOTE |
| `calc_v16_total_logistics` | `logistics_total` | QUOTE |
| `calc_y16_customs_duty` | `customs_fee` | QUOTE |
| `calc_ab16_cogs_total` | `cogs_per_product` (sum) | QUOTE |
| `calc_ak16_final_price_total` | `sales_price_total_no_vat` (sum) | QUOTE |
| `calc_al16_total_with_vat` | `sales_price_total_with_vat` (sum) | QUOTE |

### Derived USD Columns (for analytics when rate != 1.0)

| Column | Calculation | Purpose |
|--------|-------------|---------|
| `calc_s16_total_purchase_price_quote` | `calc_s16 * usd_to_quote_rate` | Historical - now redundant |
| `calc_v16_total_logistics_quote` | `calc_v16 * usd_to_quote_rate` | Historical - now redundant |
| `calc_ab16_cogs_total_quote` | `calc_ab16 * usd_to_quote_rate` | Historical - now redundant |
| `calc_ak16_final_price_total_quote` | `calc_ak16 * usd_to_quote_rate` | Historical - now redundant |
| `calc_al16_total_with_vat_quote` | `calc_al16 * usd_to_quote_rate` | Historical - now redundant |

**Note:** The `_quote` suffix columns were intended to store quote currency values derived from USD base values. However, since base values ARE already in quote currency, these columns are currently redundant (value * 1.0 = value).

### Metadata Columns

| Column | Content |
|--------|---------|
| `quote_currency` | Currency code (RUB, EUR, USD, etc.) |
| `usd_to_quote_rate` | Exchange rate at calculation time |
| `exchange_rate_source` | "cbr" or "manual" |
| `exchange_rate_timestamp` | When rate was fetched |

---

## 3. Database: quote_calculation_results

| Column | Content | Currency |
|--------|---------|----------|
| `phase_results` | JSONB with all 13 phase outputs | QUOTE |
| `phase_results_quote_currency` | Copy of phase_results | QUOTE (backup) |

---

## 4. Database: quotes

| Column | Currency | Purpose |
|--------|----------|---------|
| `currency` | - | Quote currency code |
| `total_amount` | QUOTE | Legacy, client-facing |
| `total_usd` | USD | Analytics/comparison |
| `total_with_vat_usd` | USD | Analytics/comparison |
| `total_amount_quote` | QUOTE | Client-facing |
| `total_with_vat_quote` | QUOTE | Client-facing |
| `usd_to_quote_rate` | - | Exchange rate audit trail |

---

## 5. Future Recommendations

### Option 1: Keep As-Is (Recommended for now)
The `_quote` columns are redundant but harmless. The fix ensures correct metadata is stored.

### Option 2: Rename for Clarity (Future refactor)
Rename columns to make currency explicit:
- `calc_s16_total_purchase_price` → `calc_s16_total_purchase_price_quote`
- Add `calc_s16_total_purchase_price_usd` for USD analytics

### Option 3: Remove Redundant Columns (Future cleanup)
Remove `*_quote` columns since base columns already contain quote currency values.

---

**Last Updated:** 2025-12-13
**Bug Fixed:** quotes_upload.py:903 - missing currency parameters
**Verified By:** Database query showing mismatch between q.currency and qcs.quote_currency
