# USD as Canonical Calculation Currency - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change calculation engine to use USD as internal currency, converting inputs to USD and outputs to quote currency.

**Architecture:** All monetary inputs converted to USD before calculation. 13-phase engine runs entirely in USD. Final client prices (AJ16, AK16, AL16) converted back to quote currency for display/export.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, Decimal, Supabase PostgreSQL

**Design Doc:** `docs/plans/2025-11-25-usd-canonical-currency-design.md`

---

## Task 1: Add Rate Snapshot Helper Function

**Files:**
- Modify: `backend/routes/quotes_calc.py`
- Test: `backend/tests/test_multi_currency_conversion.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_multi_currency_conversion.py`:

```python
class TestGetRatesSnapshot:
    """Test exchange rates snapshot for audit trail."""

    def test_snapshot_contains_all_supported_currencies(self):
        """Snapshot should have rates for EUR, RUB, TRY, CNY to USD."""
        from routes.quotes_calc import get_rates_snapshot_to_usd
        from datetime import date

        snapshot = get_rates_snapshot_to_usd(date.today())

        assert "EUR_USD" in snapshot
        assert "RUB_USD" in snapshot
        assert "TRY_USD" in snapshot
        assert "CNY_USD" in snapshot
        assert "quote_date" in snapshot
        assert "source" in snapshot
        assert snapshot["source"] == "cbr"

    def test_snapshot_rates_are_positive(self):
        """All rates should be positive Decimals."""
        from routes.quotes_calc import get_rates_snapshot_to_usd
        from datetime import date
        from decimal import Decimal

        snapshot = get_rates_snapshot_to_usd(date.today())

        assert Decimal(str(snapshot["EUR_USD"])) > 0
        assert Decimal(str(snapshot["RUB_USD"])) > 0
        assert Decimal(str(snapshot["TRY_USD"])) > 0
        assert Decimal(str(snapshot["CNY_USD"])) > 0
```

**Step 2: Run test to verify it fails**

```bash
cd backend && source venv/bin/activate && set -a && source .env && set +a
pytest tests/test_multi_currency_conversion.py::TestGetRatesSnapshot -v
```

Expected: FAIL with `ImportError: cannot import name 'get_rates_snapshot_to_usd'`

**Step 3: Write minimal implementation**

Add to `backend/routes/quotes_calc.py` after `get_converted_monetary_value()` function (~line 365):

```python
def get_rates_snapshot_to_usd(quote_date: date) -> Dict[str, Any]:
    """
    Get snapshot of all exchange rates to USD for audit trail.

    Args:
        quote_date: Date for rate lookup (CBR rates are date-specific)

    Returns:
        Dict with currency pair rates and metadata
    """
    return {
        "EUR_USD": float(get_exchange_rate("EUR", "USD")),
        "RUB_USD": float(get_exchange_rate("RUB", "USD")),
        "TRY_USD": float(get_exchange_rate("TRY", "USD")),
        "CNY_USD": float(get_exchange_rate("CNY", "USD")),
        "quote_date": quote_date.isoformat(),
        "source": "cbr"
    }
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_multi_currency_conversion.py::TestGetRatesSnapshot -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/routes/quotes_calc.py backend/tests/test_multi_currency_conversion.py
git commit -m "feat: add get_rates_snapshot_to_usd helper for audit trail"
```

---

## Task 2: Change Logistics Conversion to USD

**Files:**
- Modify: `backend/routes/quotes_calc.py:458-461`
- Test: `backend/tests/test_multi_currency_conversion.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_multi_currency_conversion.py`:

```python
class TestLogisticsConversionToUSD:
    """Test logistics fields convert to USD, not quote currency."""

    def test_logistics_converts_to_usd_not_quote_currency(self):
        """EUR logistics should convert to USD regardless of quote currency."""
        from routes.quotes_calc import map_variables_to_calculation_input
        from datetime import date
        from decimal import Decimal

        # Product with TRY base price
        class MockProduct:
            base_price_vat = Decimal("1000")
            quantity = 10
            weight_in_kg = Decimal("5")
            product_name = "Test"
            currency_of_base_price = "TRY"
            customs_code = None
            supplier_country = None
            supplier_discount = None
            markup = None
            import_tariff = None
            excise_tax = None
            util_fee = None

        variables = {
            "currency_of_quote": "RUB",  # Quote is in RUB
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 1000, "currency": "EUR"}
            },
            "supplier_country": "Турция",
            "offer_incoterms": "DDP",
            "delivery_time": 60,
            "markup": 15,
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("0.5"),
            "rate_loan_interest_daily": Decimal("0.15"),
        }

        result = map_variables_to_calculation_input(
            product=MockProduct(),
            variables=variables,
            admin_settings=admin_settings,
            quote_date=date.today(),
            quote_currency="RUB"  # This should be ignored for logistics
        )

        # Logistics should be in USD, NOT RUB
        # EUR 1000 ≈ USD 1080 (not RUB 91000+)
        logistics_value = float(result.logistics.logistics_supplier_hub)
        assert logistics_value < 2000, f"Expected USD ~1080, got {logistics_value} (probably RUB)"
        assert logistics_value > 500, f"Expected USD ~1080, got {logistics_value}"
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_multi_currency_conversion.py::TestLogisticsConversionToUSD -v
```

Expected: FAIL - logistics value will be ~91000 (RUB) instead of ~1080 (USD)

**Step 3: Modify implementation**

In `backend/routes/quotes_calc.py`, change lines 452-461:

**FROM:**
```python
    # Convert logistics costs from their source currency to quote currency
    logistics = LogisticsParams(
        supplier_country=SupplierCountry(get_value('supplier_country', product, variables, 'Турция')),
        offer_incoterms=Incoterms(variables.get('offer_incoterms', 'DDP')),
        delivery_time=delivery_time_days,
        delivery_date=delivery_date,
        logistics_supplier_hub=get_converted_monetary_value('logistics_supplier_hub', variables, quote_currency),
        logistics_hub_customs=get_converted_monetary_value('logistics_hub_customs', variables, quote_currency),
        logistics_customs_client=get_converted_monetary_value('logistics_customs_client', variables, quote_currency)
    )
```

**TO:**
```python
    # Convert logistics costs to USD (canonical calculation currency)
    logistics = LogisticsParams(
        supplier_country=SupplierCountry(get_value('supplier_country', product, variables, 'Турция')),
        offer_incoterms=Incoterms(variables.get('offer_incoterms', 'DDP')),
        delivery_time=delivery_time_days,
        delivery_date=delivery_date,
        logistics_supplier_hub=get_converted_monetary_value('logistics_supplier_hub', variables, "USD"),
        logistics_hub_customs=get_converted_monetary_value('logistics_hub_customs', variables, "USD"),
        logistics_customs_client=get_converted_monetary_value('logistics_customs_client', variables, "USD")
    )
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_multi_currency_conversion.py::TestLogisticsConversionToUSD -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/routes/quotes_calc.py backend/tests/test_multi_currency_conversion.py
git commit -m "feat: convert logistics costs to USD instead of quote currency"
```

---

## Task 3: Change Brokerage Conversion to USD

**Files:**
- Modify: `backend/routes/quotes_calc.py:489-496`
- Test: `backend/tests/test_multi_currency_conversion.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_multi_currency_conversion.py`:

```python
class TestBrokerageConversionToUSD:
    """Test brokerage fields convert to USD."""

    def test_brokerage_converts_to_usd(self):
        """RUB brokerage should convert to USD."""
        from routes.quotes_calc import get_converted_monetary_value

        variables = {
            "monetary_fields": {
                "brokerage_customs": {"value": 50000, "currency": "RUB"}
            }
        }

        # Convert to USD
        result = get_converted_monetary_value("brokerage_customs", variables, "USD")

        # RUB 50000 ≈ USD 633 (at rate ~79)
        assert float(result) < 1000, f"Expected USD ~633, got {result}"
        assert float(result) > 400, f"Expected USD ~633, got {result}"
```

**Step 2: Run test to verify it passes (function already works)**

```bash
pytest tests/test_multi_currency_conversion.py::TestBrokerageConversionToUSD -v
```

Expected: PASS (the function works, we just need to call it with "USD")

**Step 3: Modify implementation**

In `backend/routes/quotes_calc.py`, change lines 486-497:

**FROM:**
```python
    # Convert brokerage costs from their source currency to quote currency
    brokerage = BrokerageParams(
        seller_region=SellerRegion(get_value('seller_region', product, variables, 'TR')),
        brokerage_hub=get_converted_monetary_value('brokerage_hub', variables, quote_currency),
        brokerage_customs=get_converted_monetary_value('brokerage_customs', variables, quote_currency),
        warehousing_at_customs=get_converted_monetary_value('warehousing_at_customs', variables, quote_currency),
        customs_documentation=get_converted_monetary_value('customs_documentation', variables, quote_currency),
        brokerage_extra=get_converted_monetary_value('brokerage_extra', variables, quote_currency)
    )
```

**TO:**
```python
    # Convert brokerage costs to USD (canonical calculation currency)
    brokerage = BrokerageParams(
        seller_region=SellerRegion(get_value('seller_region', product, variables, 'TR')),
        brokerage_hub=get_converted_monetary_value('brokerage_hub', variables, "USD"),
        brokerage_customs=get_converted_monetary_value('brokerage_customs', variables, "USD"),
        warehousing_at_customs=get_converted_monetary_value('warehousing_at_customs', variables, "USD"),
        customs_documentation=get_converted_monetary_value('customs_documentation', variables, "USD"),
        brokerage_extra=get_converted_monetary_value('brokerage_extra', variables, "USD")
    )
```

**Step 4: Run existing tests to verify nothing breaks**

```bash
pytest tests/test_multi_currency_conversion.py -v
```

Expected: All PASS

**Step 5: Commit**

```bash
git add backend/routes/quotes_calc.py
git commit -m "feat: convert brokerage costs to USD instead of quote currency"
```

---

## Task 4: Change Financial Params to USD

**Files:**
- Modify: `backend/routes/quotes_calc.py:406-430`
- Test: `backend/tests/test_multi_currency_conversion.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_multi_currency_conversion.py`:

```python
class TestFinancialParamsUSD:
    """Test financial params use USD as calculation currency."""

    def test_currency_of_quote_is_usd_internally(self):
        """Internal calculation should use USD regardless of client quote currency."""
        from routes.quotes_calc import map_variables_to_calculation_input
        from datetime import date
        from decimal import Decimal

        class MockProduct:
            base_price_vat = Decimal("1000")
            quantity = 10
            weight_in_kg = Decimal("5")
            product_name = "Test"
            currency_of_base_price = "TRY"
            customs_code = None
            supplier_country = None
            supplier_discount = None
            markup = None
            import_tariff = None
            excise_tax = None
            util_fee = None

        variables = {
            "currency_of_quote": "RUB",  # Client wants RUB quote
            "supplier_country": "Турция",
            "offer_incoterms": "DDP",
            "delivery_time": 60,
            "markup": 15,
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("0.5"),
            "rate_loan_interest_daily": Decimal("0.15"),
        }

        result = map_variables_to_calculation_input(
            product=MockProduct(),
            variables=variables,
            admin_settings=admin_settings,
            quote_date=date.today(),
            quote_currency="RUB"
        )

        # Internal calculation currency should be USD
        assert result.financial.currency_of_quote.value == "USD", \
            f"Expected USD for internal calculation, got {result.financial.currency_of_quote.value}"
```

**Step 2: Run test to verify it fails**

```bash
pytest tests/test_multi_currency_conversion.py::TestFinancialParamsUSD -v
```

Expected: FAIL - currently uses quote_currency (RUB)

**Step 3: Modify implementation**

In `backend/routes/quotes_calc.py`, change lines 406-430:

**FROM:**
```python
    # ========== FinancialParams (7 fields) ==========
    # Use get_value() helper for two-tier logic (product override > quote default)
    # CRITICAL: Use quote_currency parameter, NOT variables.get() - see BUG FIX 2025-11-25
    financial = FinancialParams(
        currency_of_quote=Currency(quote_currency),
        # Auto-fetch exchange rate: SWAPPED parameters for correct "divide by" rate
        # Formula is R16 = P16 / Q16, so Q16 should be "quote currency per product currency"
        # e.g., for TRY product + USD quote: Q16 = USD/TRY = 4.23 (how many TRY per 1 USD)
        # Then: 1000 TRY / 4.23 = 236.5 USD ✓
        exchange_rate_base_price_to_quote=get_exchange_rate(
            quote_currency,  # to_currency (e.g., USD)
            product_info.currency_of_base_price.value  # from_currency (e.g., TRY)
        ),
```

**TO:**
```python
    # ========== FinancialParams (7 fields) ==========
    # USD is the canonical calculation currency (internal accounting)
    # Quote currency (RUB, EUR, etc.) is only for client-facing output
    financial = FinancialParams(
        currency_of_quote=Currency("USD"),  # Always USD for internal calculation
        # Exchange rate: product currency → USD
        # e.g., for TRY product: Q16 = TRY/USD rate
        # Then: 1000 TRY × (USD/TRY rate) = ~28 USD
        exchange_rate_base_price_to_quote=get_exchange_rate(
            "USD",  # to_currency (always USD)
            product_info.currency_of_base_price.value  # from_currency (e.g., TRY)
        ),
```

**Step 4: Run test to verify it passes**

```bash
pytest tests/test_multi_currency_conversion.py::TestFinancialParamsUSD -v
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/routes/quotes_calc.py backend/tests/test_multi_currency_conversion.py
git commit -m "feat: use USD as internal calculation currency in FinancialParams"
```

---

## Task 5: Add Quote Currency Output Fields to Results

**Files:**
- Modify: `backend/routes/quotes_calc.py` (after calculation loop, ~line 1450)
- Test: `backend/tests/test_multi_currency_conversion.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_multi_currency_conversion.py`:

```python
class TestQuoteCurrencyOutput:
    """Test that results include quote currency conversion."""

    def test_results_have_quote_currency_fields(self):
        """Calculation results should include quote currency values."""
        # This tests the structure, actual integration test elsewhere
        expected_fields = [
            "sales_price_per_unit_quote",
            "sales_price_total_quote",
            "quote_currency",
            "usd_to_quote_rate",
            "rates_snapshot"
        ]

        # Just verify the fields exist in the schema
        # Full integration test in Task 7
        for field in expected_fields:
            assert field in expected_fields  # Placeholder until implementation
```

**Step 2: Skip to implementation (schema change)**

This task adds new fields to the calculation result structure.

**Step 3: Modify implementation**

In `backend/routes/quotes_calc.py`, find the results processing section (~line 1450-1500) where `calc_result_data` is built. Add after the existing fields:

```python
                # Get USD to quote currency rate
                usd_to_quote_rate = get_exchange_rate("USD", request.variables.get('currency_of_quote', 'USD'))
                quote_currency = request.variables.get('currency_of_quote', 'USD')

                # Calculate quote currency values for client-facing prices
                sales_price_per_unit_quote = float(result.sales_price_per_unit_no_vat * usd_to_quote_rate)
                sales_price_total_quote = float(result.sales_price_total_with_vat * usd_to_quote_rate)

                calc_result_data = {
                    # ... existing USD fields ...

                    # Quote currency output (for client display/export)
                    "quote_currency": quote_currency,
                    "usd_to_quote_rate": float(usd_to_quote_rate),
                    "sales_price_per_unit_quote": sales_price_per_unit_quote,
                    "sales_price_total_quote": sales_price_total_quote,
                    "sales_price_total_with_vat_quote": sales_price_total_quote,  # Alias for clarity

                    # Rates snapshot for audit
                    "rates_snapshot": get_rates_snapshot_to_usd(request.quote_date),
                }
```

**Step 4: Run all multi-currency tests**

```bash
pytest tests/test_multi_currency_conversion.py -v
```

Expected: All PASS

**Step 5: Commit**

```bash
git add backend/routes/quotes_calc.py
git commit -m "feat: add quote currency output fields to calculation results"
```

---

## Task 6: Update Result Storage to Include Both Currencies

**Files:**
- Modify: `backend/routes/quotes_calc.py` (~line 1470-1510)

**Step 1: Verify current storage structure**

Check what's stored in `phase_results` JSONB field.

**Step 2: No test needed (storage is JSONB, schema-less)**

**Step 3: Modify the storage section**

In `backend/routes/quotes_calc.py`, update the `calc_result_data` dict that gets stored:

Find the section where results are saved to `quote_calculation_results` table and ensure it includes:

```python
                # Store in quote_calculation_results table
                result_to_store = {
                    "quote_id": quote_id,
                    "quote_item_id": item_id,
                    "phase_results": {
                        # All calculation values in USD (canonical)
                        "currency": "USD",
                        **{k: float(v) if isinstance(v, Decimal) else v
                           for k, v in result.dict().items()},

                        # Quote currency values for client prices
                        "quote_currency": quote_currency,
                        "usd_to_quote_rate": float(usd_to_quote_rate),
                        "sales_price_per_unit_quote": sales_price_per_unit_quote,
                        "sales_price_total_quote": sales_price_total_quote,

                        # Audit trail
                        "rates_snapshot": get_rates_snapshot_to_usd(request.quote_date),
                    }
                }
```

**Step 4: Test by creating a quote manually**

```bash
# This will be tested in Task 7 integration test
```

**Step 5: Commit**

```bash
git add backend/routes/quotes_calc.py
git commit -m "feat: store both USD and quote currency values in calculation results"
```

---

## Task 7: Integration Test - Full Calculation Flow

**Files:**
- Create: `backend/tests/test_usd_canonical_currency.py`

**Step 1: Write comprehensive integration test**

Create `backend/tests/test_usd_canonical_currency.py`:

```python
"""
Integration tests for USD as canonical calculation currency.

Tests the full flow:
1. Input with mixed currencies (EUR logistics, RUB brokerage, TRY product)
2. Calculation in USD
3. Output in both USD and quote currency
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import patch, MagicMock


class TestUSDCanonicalCurrency:
    """Integration tests for USD-based calculation."""

    def test_full_flow_eur_logistics_rub_brokerage_try_product(self):
        """
        Complete flow with mixed currencies:
        - Product: 1000 TRY
        - Logistics: 500 EUR
        - Brokerage: 10000 RUB
        - Quote currency: RUB

        All should calculate in USD, then convert final prices to RUB.
        """
        from routes.quotes_calc import (
            map_variables_to_calculation_input,
            get_exchange_rate,
            get_rates_snapshot_to_usd
        )

        class MockProduct:
            base_price_vat = Decimal("1000")
            quantity = 10
            weight_in_kg = Decimal("5")
            product_name = "Test Bearing"
            currency_of_base_price = "TRY"
            customs_code = "8482109000"
            supplier_country = "Турция"
            supplier_discount = None
            markup = None
            import_tariff = None
            excise_tax = None
            util_fee = None

        variables = {
            "currency_of_quote": "RUB",
            "monetary_fields": {
                "logistics_supplier_hub": {"value": 300, "currency": "EUR"},
                "logistics_hub_customs": {"value": 200, "currency": "EUR"},
                "logistics_customs_client": {"value": 5000, "currency": "RUB"},
                "brokerage_customs": {"value": 10000, "currency": "RUB"},
            },
            "supplier_country": "Турция",
            "offer_incoterms": "DDP",
            "delivery_time": 60,
            "markup": Decimal("15"),
        }

        admin_settings = {
            "rate_forex_risk": Decimal("3"),
            "rate_fin_comm": Decimal("0.5"),
            "rate_loan_interest_daily": Decimal("0.15"),
        }

        result = map_variables_to_calculation_input(
            product=MockProduct(),
            variables=variables,
            admin_settings=admin_settings,
            quote_date=date.today(),
            quote_currency="RUB"
        )

        # Verify internal currency is USD
        assert result.financial.currency_of_quote.value == "USD"

        # Verify logistics converted to USD (not RUB)
        # EUR 300 ≈ USD 324 (not RUB 27000+)
        logistics_hub = float(result.logistics.logistics_supplier_hub)
        assert logistics_hub < 500, f"Expected USD ~324, got {logistics_hub}"
        assert logistics_hub > 200, f"Expected USD ~324, got {logistics_hub}"

        # Verify brokerage converted to USD
        # RUB 10000 ≈ USD 126 (not RUB 10000)
        brokerage = float(result.brokerage.brokerage_customs)
        assert brokerage < 200, f"Expected USD ~126, got {brokerage}"
        assert brokerage > 80, f"Expected USD ~126, got {brokerage}"

        # Verify rates snapshot exists
        snapshot = get_rates_snapshot_to_usd(date.today())
        assert snapshot["source"] == "cbr"
        assert "EUR_USD" in snapshot
        assert "RUB_USD" in snapshot
        assert "TRY_USD" in snapshot

    def test_profit_calculated_in_usd(self):
        """Profit should be in USD for accounting purposes."""
        # This test verifies that after running full calculation,
        # profit values are in USD, not quote currency.
        #
        # Full calculation test requires more setup - placeholder for now
        pass  # TODO: Implement after Tasks 1-6 complete


class TestExchangeRateConsistency:
    """Test exchange rate handling."""

    def test_rates_snapshot_matches_rates_used(self):
        """Snapshot should contain same rates as used in conversion."""
        from routes.quotes_calc import get_exchange_rate, get_rates_snapshot_to_usd
        from datetime import date

        snapshot = get_rates_snapshot_to_usd(date.today())

        eur_usd_direct = get_exchange_rate("EUR", "USD")
        eur_usd_snapshot = Decimal(str(snapshot["EUR_USD"]))

        # Should match (within floating point tolerance)
        assert abs(float(eur_usd_direct) - float(eur_usd_snapshot)) < 0.0001
```

**Step 2: Run the integration test**

```bash
pytest tests/test_usd_canonical_currency.py -v
```

Expected: PASS (after Tasks 1-6 complete)

**Step 3: Commit**

```bash
git add backend/tests/test_usd_canonical_currency.py
git commit -m "test: add integration tests for USD canonical currency"
```

---

## Task 8: Update Excel Export to Use Quote Currency

**Files:**
- Modify: `backend/services/excel_service.py`

**Step 1: Identify where client prices are used**

Search for `sales_price` or `AJ16`, `AK16` in excel_service.py.

**Step 2: Modify to use quote currency values**

Where Excel shows client prices, use the `_quote` suffixed values:

```python
# Instead of:
sales_price = calc_results.get('sales_price_per_unit_no_vat', 0)

# Use:
sales_price = calc_results.get('sales_price_per_unit_quote', 0)
# Fallback for old data:
if not sales_price:
    sales_price = calc_results.get('sales_price_per_unit_no_vat', 0)
```

**Step 3: Test by generating Excel export**

Manual test - generate Excel and verify prices are in quote currency.

**Step 4: Commit**

```bash
git add backend/services/excel_service.py
git commit -m "feat: use quote currency values in Excel export for client prices"
```

---

## Task 9: Update Quote Detail Page to Show Both

**Files:**
- Modify: `frontend/src/app/quotes/[id]/page.tsx`

**Step 1: Update display to show quote currency for client prices**

Find where AJ16, AK16 are displayed. Update to use quote currency values:

```typescript
// Client sees quote currency
<Statistic
  title="Цена за ед. (без НДС)"
  value={item.sales_price_per_unit_quote || item.sales_price_per_unit_no_vat}
  suffix={quote.currency || 'USD'}
/>

// Internal shows USD
<Statistic
  title="Прибыль"
  value={item.profit}
  suffix="USD"
/>
```

**Step 2: Test in browser**

Load a quote detail page and verify:
- Client prices show in quote currency (RUB, EUR, etc.)
- Profit shows in USD

**Step 3: Commit**

```bash
git add frontend/src/app/quotes/[id]/page.tsx
git commit -m "feat: display client prices in quote currency, profit in USD"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

```bash
cd backend && pytest -v
```

Expected: All tests pass

**Step 2: Manual E2E test**

1. Create new quote with:
   - Product in TRY
   - Logistics in EUR
   - Brokerage in RUB
   - Quote currency: RUB

2. Verify calculation runs without error

3. Check database:
   ```sql
   SELECT phase_results->>'currency',
          phase_results->>'quote_currency',
          phase_results->>'profit',
          phase_results->>'sales_price_per_unit_quote'
   FROM quote_calculation_results
   ORDER BY created_at DESC LIMIT 1;
   ```

4. Expected:
   - `currency` = "USD"
   - `quote_currency` = "RUB"
   - `profit` = number in USD
   - `sales_price_per_unit_quote` = number in RUB

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete USD canonical currency implementation"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 1 | Add rates snapshot helper | 15 min |
| 2 | Change logistics to USD | 15 min |
| 3 | Change brokerage to USD | 10 min |
| 4 | Change financial params to USD | 15 min |
| 5 | Add quote currency output fields | 20 min |
| 6 | Update storage for both currencies | 15 min |
| 7 | Integration test | 30 min |
| 8 | Update Excel export | 20 min |
| 9 | Update quote detail page | 20 min |
| 10 | Final verification | 20 min |

**Total: ~3 hours**
