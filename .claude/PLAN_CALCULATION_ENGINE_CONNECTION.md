# Implementation Plan: Connect Quote Creation to Calculation Engine

**Status:** Not Started
**Priority:** High - Blocks quote workflow
**Estimated Time:** 4.5 hours
**Created:** 2025-10-21
**Session:** 15

---

## Overview

**Goal:** Fix the broken integration between frontend (flat variables dict) and backend calculation engine (nested Pydantic models), enabling end-to-end quote calculations with minimal required data.

**Current Problem:**
- **Frontend sends:** `{ customer_id, products[], variables: { markup: 15, import_tariff: 5, ... } }` (flat dict)
- **Backend expects:** `QuoteCalculationInput(product=..., financial=..., logistics=...)` (nested models)
- **Current code:** Lines 568-579 in `backend/routes/quotes_calc.py` have incomplete mapping with TODO comment
- **Result:** Calculate button fails or produces incorrect results

**Strategy:** Transform flat variables dict → nested QuoteCalculationInput with smart defaults and comprehensive validation.

---

## Variable Requirements (42 Total)

### Required Variables (10)
1. `base_price_VAT` - From uploaded file
2. `quantity` - From uploaded file
3. `seller_company` - Determines seller_region (affects VAT)
4. `offer_incoterms` - Determines logistics/customs logic
5. `currency_of_base_price` - Must know currency of price
6. `currency_of_quote` - **Default: USD** (most common)
7. `exchange_rate_base_price_to_quote` - Required for currency conversion
8. `markup` - Business must have markup to profit
9. `supplier_country` - Affects VAT, customs, everything
10. **Logistics (conditional):** If incoterms ≠ EXW, at least one logistics field must be > 0

### Optional Variables with Defaults (32)

**Product Info:**
- `sku` → "" (tracking only)
- `brand` → "" (tracking only)
- `weight_in_kg` → 0

**Company:**
- `offer_sale_type` → "поставка" (supply)

**Financial:**
- `supplier_discount` → 0%
- `dm_fee_type` → "fixed"
- `dm_fee_value` → 0

**Logistics:**
- `delivery_time` → 60 days
- `logistics_supplier_hub` → 0
- `logistics_hub_customs` → 0
- `logistics_customs_client` → 0

**Taxes:**
- `customs_code` → "0000000000"
- `import_tariff` → 0%
- `excise_tax` → 0
- `util_fee` → 0

**Payment Terms (10 fields):**
- `advance_from_client` → 100%
- `advance_to_supplier` → 100%
- `time_to_advance` → 0
- `advance_on_loading` → 0%
- `time_to_advance_loading` → 0
- `advance_on_going_to_country_destination` → 0%
- `time_to_advance_going_to_country_destination` → 0
- `advance_on_customs_clearance` → 0%
- `time_to_advance_on_customs_clearance` → 0
- `time_to_advance_on_receiving` → 0

**Clearance (5 fields):**
- `brokerage_hub` → 0
- `brokerage_customs` → 0
- `warehousing_at_customs` → 0
- `customs_documentation` → 0
- `brokerage_extra` → 0

**Admin Settings (from DB):**
- `rate_forex_risk` → 3% (if missing from DB)
- `rate_fin_comm` → 2% (if missing from DB)
- `rate_loan_interest_daily` → 0.00069 (if missing from DB)

### Business Logic Rules

**Incoterms Logic:**
```
IF offer_incoterms == "EXW":
  - All logistics fields can be 0 (no validation)

ELSE (FOB, CIF, DAP, DDP, etc.):
  - At least ONE of these must be > 0:
    * logistics_supplier_hub OR
    * logistics_hub_customs OR
    * logistics_customs_client
```

---

## Phase 1: Create Variable Mapper with Defaults (1.5 hours)

### Task 1.1: Create Helper Functions (30 min)

**File:** `backend/routes/quotes_calc.py`

Add at top after imports:

```python
from typing import Dict, Any, Optional
from decimal import Decimal
from calculation_models import (
    QuoteCalculationInput,
    ProductInfo,
    FinancialParams,
    LogisticsParams,
    TaxesAndDuties,
    PaymentTerms,
    CustomsAndClearance,
    CompanySettings,
    SystemConfig,
    Currency,
    SupplierCountry,
    SellerCompany,
    OfferSaleType,
    Incoterms,
    DMFeeType
)

def safe_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    """Safely convert value to Decimal with fallback"""
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except (ValueError, TypeError):
        return default

def safe_int(value: Any, default: int = 0) -> int:
    """Safely convert value to int with fallback"""
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_str(value: Any, default: str = "") -> str:
    """Safely convert value to string with fallback"""
    if value is None:
        return default
    return str(value)
```

### Task 1.2: Create Main Mapper Function (60 min)

**File:** `backend/routes/quotes_calc.py`

Add complete mapper function:

```python
def map_variables_to_calculation_input(
    product: ProductFromFile,
    variables: Dict[str, Any],
    admin_settings: Dict[str, Any]
) -> QuoteCalculationInput:
    """
    Transform flat variables dict + product into nested QuoteCalculationInput

    Priority for variables:
    1. Product-level override (if exists)
    2. Quote-level default from variables dict
    3. Sensible default value

    Args:
        product: Product from uploaded file
        variables: Flat dict of all 42 variables from frontend
        admin_settings: Admin settings from database (3 fields)

    Returns:
        QuoteCalculationInput with all nested models populated
    """

    # Helper to get value with priority
    def get_value(field_name: str, default: Any = None) -> Any:
        """Get value: product override > quote default > fallback"""
        # Priority 1: Product-level override
        product_value = getattr(product, field_name, None)
        if product_value is not None and product_value != "":
            return product_value
        # Priority 2: Quote-level default
        quote_value = variables.get(field_name)
        if quote_value is not None and quote_value != "":
            return quote_value
        # Priority 3: Default
        return default

    # ========================================================================
    # ProductInfo (5 fields)
    # ========================================================================
    product_info = ProductInfo(
        base_price_VAT=safe_decimal(product.base_price_vat),  # REQUIRED from file
        quantity=product.quantity,  # REQUIRED from file
        weight_in_kg=safe_decimal(product.weight_in_kg, Decimal("0")),  # Optional, default 0
        currency_of_base_price=Currency(get_value('currency_of_base_price', 'USD')),  # REQUIRED
        customs_code=safe_str(get_value('customs_code', '0000000000'))  # Optional, default dummy
    )

    # ========================================================================
    # FinancialParams (6 fields)
    # ========================================================================
    financial_params = FinancialParams(
        currency_of_quote=Currency(variables.get('currency_of_quote', 'USD')),  # Default USD
        exchange_rate_base_price_to_quote=safe_decimal(
            get_value('exchange_rate_base_price_to_quote', 1)
        ),  # REQUIRED
        supplier_discount=safe_decimal(get_value('supplier_discount', 0)),  # Optional, default 0
        markup=safe_decimal(get_value('markup', 15)),  # REQUIRED (default 15% if missing)
        rate_forex_risk=safe_decimal(admin_settings.get('rate_forex_risk', 3)),  # From admin or default 3%
        dm_fee_type=DMFeeType(variables.get('dm_fee_type', 'fixed')),  # Optional, default 'fixed'
        dm_fee_value=safe_decimal(variables.get('dm_fee_value', 0))  # Optional, default 0
    )

    # ========================================================================
    # LogisticsParams (6 fields)
    # ========================================================================
    logistics_params = LogisticsParams(
        supplier_country=SupplierCountry(get_value('supplier_country', 'Турция')),  # REQUIRED
        offer_incoterms=Incoterms(variables.get('offer_incoterms', 'DDP')),  # REQUIRED
        delivery_time=safe_int(get_value('delivery_time', 60)),  # Optional, default 60 days
        logistics_supplier_hub=safe_decimal(
            get_value('logistics_supplier_hub', 0)
        ),  # Optional, default 0
        logistics_hub_customs=safe_decimal(
            get_value('logistics_hub_customs', 0)
        ),  # Optional, default 0
        logistics_customs_client=safe_decimal(
            get_value('logistics_customs_client', 0)
        )  # Optional, default 0
    )

    # ========================================================================
    # TaxesAndDuties (3 fields)
    # ========================================================================
    taxes_duties = TaxesAndDuties(
        import_tariff=safe_decimal(get_value('import_tariff', 0)),  # Optional, default 0
        excise_tax=safe_decimal(get_value('excise_tax', 0)),  # Optional, default 0
        util_fee=safe_decimal(variables.get('util_fee', 0))  # Optional, default 0
    )

    # ========================================================================
    # PaymentTerms (10 fields)
    # ========================================================================
    payment_terms = PaymentTerms(
        advance_from_client=safe_decimal(
            variables.get('advance_from_client', 100)
        ),  # Default 100%
        advance_to_supplier=safe_decimal(
            get_value('advance_to_supplier', 100)
        ),  # Default 100%
        time_to_advance=safe_int(variables.get('time_to_advance', 0)),  # Default 0
        advance_on_loading=safe_decimal(
            variables.get('advance_on_loading', 0)
        ),  # Default 0%
        time_to_advance_loading=safe_int(
            variables.get('time_to_advance_loading', 0)
        ),
        advance_on_going_to_country_destination=safe_decimal(
            variables.get('advance_on_going_to_country_destination', 0)
        ),
        time_to_advance_going_to_country_destination=safe_int(
            variables.get('time_to_advance_going_to_country_destination', 0)
        ),
        advance_on_customs_clearance=safe_decimal(
            variables.get('advance_on_customs_clearance', 0)
        ),
        time_to_advance_on_customs_clearance=safe_int(
            variables.get('time_to_advance_on_customs_clearance', 0)
        ),
        time_to_advance_on_receiving=safe_int(
            variables.get('time_to_advance_on_receiving', 0)
        )
    )

    # ========================================================================
    # CustomsAndClearance (5 fields)
    # ========================================================================
    customs_clearance = CustomsAndClearance(
        brokerage_hub=safe_decimal(
            get_value('brokerage_hub', 0)
        ),  # Optional, default 0
        brokerage_customs=safe_decimal(
            get_value('brokerage_customs', 0)
        ),  # Optional, default 0
        warehousing_at_customs=safe_decimal(
            get_value('warehousing_at_customs', 0)
        ),  # Optional, default 0
        customs_documentation=safe_decimal(
            get_value('customs_documentation', 0)
        ),  # Optional, default 0
        brokerage_extra=safe_decimal(
            get_value('brokerage_extra', 0)
        )  # Optional, default 0
    )

    # ========================================================================
    # CompanySettings (2 fields)
    # ========================================================================
    company_settings = CompanySettings(
        seller_company=SellerCompany(
            variables.get('seller_company', 'МАСТЕР БЭРИНГ ООО')
        ),  # REQUIRED
        offer_sale_type=OfferSaleType(
            variables.get('offer_sale_type', 'поставка')
        )  # Optional, default 'поставка'
    )

    # ========================================================================
    # SystemConfig (3 fields - from admin settings)
    # ========================================================================
    system_config = SystemConfig(
        rate_fin_comm=safe_decimal(admin_settings.get('rate_fin_comm', 2)),  # Default 2%
        rate_loan_interest_daily=safe_decimal(
            admin_settings.get('rate_loan_interest_daily', 0.00069)
        ),  # Default 0.00069
        rate_insurance=safe_decimal(
            admin_settings.get('rate_insurance', 0.00047)
        )  # Default 0.047%
    )

    # ========================================================================
    # Combine all nested models
    # ========================================================================
    return QuoteCalculationInput(
        product=product_info,
        financial=financial_params,
        logistics=logistics_params,
        taxes=taxes_duties,
        payment=payment_terms,
        customs=customs_clearance,
        company=company_settings,
        system=system_config
    )
```

**Test After Phase 1:**
```bash
cd backend
pytest tests/test_quotes_calc_mapper.py -v
```

---

## Phase 2: Fetch Admin Settings (20 min)

### Task 2.1: Add Admin Settings Fetcher

**File:** `backend/routes/quotes_calc.py`

Add function:

```python
async def get_admin_settings(organization_id: str) -> Dict[str, Any]:
    """
    Fetch admin calculation settings for organization
    Returns defaults if no settings exist
    """
    try:
        response = supabase.table("calculation_settings")\
            .select("rate_forex_risk, rate_fin_comm, rate_loan_interest_daily")\
            .eq("organization_id", organization_id)\
            .limit(1)\
            .execute()

        if response.data and len(response.data) > 0:
            return response.data[0]
        else:
            # No settings found - use defaults
            return {
                "rate_forex_risk": 3.0,
                "rate_fin_comm": 2.0,
                "rate_loan_interest_daily": 0.00069
            }
    except Exception as e:
        # If error fetching, use defaults
        print(f"Warning: Could not fetch admin settings: {e}")
        return {
            "rate_forex_risk": 3.0,
            "rate_fin_comm": 2.0,
            "rate_loan_interest_daily": 0.00069
        }
```

---

## Phase 3: Update Calculate Endpoint (30 min)

### Task 3.1: Replace Incomplete Mapping

**File:** `backend/routes/quotes_calc.py`

Replace lines 560-619 with:

```python
        # 4. Fetch admin settings
        admin_settings = await get_admin_settings(str(user.current_organization_id))

        # 5. Run calculation engine for each product
        calculation_results = []
        total_subtotal = Decimal("0")
        total_amount = Decimal("0")

        for idx, (product, item_record) in enumerate(zip(request.products, items_response.data)):
            try:
                # Transform flat variables → nested QuoteCalculationInput
                calc_input = map_variables_to_calculation_input(
                    product=product,
                    variables=request.variables,
                    admin_settings=admin_settings
                )

                # Calculate using engine
                result = calculate_single_product_quote(calc_input)

                # Save calculation results (all 13 phases)
                results_data = {
                    "quote_id": quote_id,
                    "quote_item_id": item_record['id'],
                    "phase_results": result.dict()  # All 13 phases as JSON
                }

                results_response = supabase.table("quote_calculation_results")\
                    .insert(results_data)\
                    .execute()

                # Accumulate totals
                total_subtotal += result.S16  # Purchase price
                total_amount += result.AK16  # Final sales price total

                # Add to response
                calculation_results.append({
                    "item_id": item_record['id'],
                    "product_name": product.product_name,
                    "sku": product.sku,
                    "brand": product.brand,
                    "quantity": product.quantity,
                    "calculations": result.dict()
                })

            except Exception as e:
                # If calculation fails for one product, roll back the quote
                supabase.table("quotes").delete().eq("id", quote_id).execute()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Calculation failed for product '{product.product_name}': {str(e)}"
                )

        # 6. Update quote totals
        supabase.table("quotes").update({
            "subtotal": float(total_subtotal),
            "total_amount": float(total_amount)
        }).eq("id", quote_id).execute()
```

**Test After Phase 3:**
```bash
cd backend
pytest tests/test_quotes_calc_integration.py::test_calculate_quote_with_minimal_data -v
```

---

## Phase 4: Validation & Error Handling (45 min)

### Task 4.1: Add Pre-Validation Function

**File:** `backend/routes/quotes_calc.py`

Add before calculate endpoint:

```python
def validate_calculation_request(
    request: QuoteCalculationRequest,
    products: List[ProductFromFile]
) -> List[str]:
    """
    Validate calculation request and return list of errors
    Returns empty list if valid, list of error messages if invalid

    Validates:
    - Required variables are present
    - Logistics fields (at least 1 > 0 if incoterms ≠ EXW)
    - Product data completeness
    """
    errors = []

    # Required variables
    required_vars = {
        'seller_company': 'Компания-продавец',
        'offer_incoterms': 'Базис поставки (Incoterms)',
        'currency_of_base_price': 'Валюта цены закупки',
        'currency_of_quote': 'Валюта КП',
        'exchange_rate_base_price_to_quote': 'Курс к валюте КП',
        'markup': 'Наценка (%)',
        'supplier_country': 'Страна закупки'
    }

    for var_key, var_name in required_vars.items():
        value = request.variables.get(var_key)
        if value is None or value == "":
            errors.append(f"Отсутствует обязательное поле: {var_name}")

    # Logistics validation (if not EXW)
    incoterms = request.variables.get('offer_incoterms', '')
    if incoterms and incoterms != 'EXW':
        logistics_supplier_hub = request.variables.get('logistics_supplier_hub', 0)
        logistics_hub_customs = request.variables.get('logistics_hub_customs', 0)
        logistics_customs_client = request.variables.get('logistics_customs_client', 0)

        # Convert to Decimal for comparison
        try:
            total_logistics = (
                Decimal(str(logistics_supplier_hub or 0)) +
                Decimal(str(logistics_hub_customs or 0)) +
                Decimal(str(logistics_customs_client or 0))
            )

            if total_logistics <= 0:
                errors.append(
                    f"При базисе поставки '{incoterms}' хотя бы одно поле логистики должно быть больше 0"
                )
        except (ValueError, TypeError):
            errors.append("Некорректные значения в полях логистики")

    # Product validation
    for idx, product in enumerate(products, start=1):
        if not product.base_price_vat or product.base_price_vat <= 0:
            errors.append(f"Товар #{idx}: отсутствует или некорректная цена")
        if not product.quantity or product.quantity <= 0:
            errors.append(f"Товар #{idx}: отсутствует или некорректное количество")

    return errors
```

### Task 4.2: Add Validation to Calculate Endpoint

**File:** `backend/routes/quotes_calc.py`

Add at start of `calculate_quote()` function (after organization check):

```python
    # Validate request before processing
    validation_errors = validate_calculation_request(request, request.products)
    if validation_errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Ошибки валидации",
                "errors": validation_errors
            }
        )
```

**Test After Phase 4:**
```bash
cd backend
pytest tests/test_quotes_calc_integration.py::test_calculate_quote_validation_errors -v
```

---

## Phase 5: Comprehensive Testing (1.5 hours)

### Task 5.1: Unit Tests for Mapper (30 min)

**File:** `backend/tests/test_quotes_calc_mapper.py` (NEW)

```python
"""
Unit tests for variable mapper function
Tests transformation from flat dict to nested QuoteCalculationInput
"""
import pytest
from decimal import Decimal
from routes.quotes_calc import (
    map_variables_to_calculation_input,
    safe_decimal,
    safe_int,
    safe_str
)

class MockProduct:
    """Mock product for testing"""
    def __init__(self):
        self.sku = "TEST-SKU"
        self.brand = "TestBrand"
        self.product_name = "Test Product"
        self.base_price_vat = 1000.0
        self.quantity = 10
        self.weight_in_kg = 25.5
        self.customs_code = None
        self.supplier_country = None

def test_safe_decimal_conversion():
    """Test safe_decimal helper function"""
    assert safe_decimal("123.45") == Decimal("123.45")
    assert safe_decimal(100) == Decimal("100")
    assert safe_decimal(None, Decimal("5")) == Decimal("5")
    assert safe_decimal("", Decimal("10")) == Decimal("10")
    assert safe_decimal("invalid", Decimal("0")) == Decimal("0")

def test_mapper_with_minimal_data():
    """Test mapper with only required fields"""
    product = MockProduct()
    variables = {
        'seller_company': 'МАСТЕР БЭРИНГ ООО',
        'offer_incoterms': 'EXW',
        'currency_of_base_price': 'USD',
        'currency_of_quote': 'RUB',
        'exchange_rate_base_price_to_quote': 95.5,
        'markup': 15,
        'supplier_country': 'Турция'
    }
    admin_settings = {
        'rate_forex_risk': 3.0,
        'rate_fin_comm': 2.0,
        'rate_loan_interest_daily': 0.00069
    }

    result = map_variables_to_calculation_input(product, variables, admin_settings)

    # Verify nested structure created
    assert result.product.base_price_VAT == Decimal("1000.0")
    assert result.product.quantity == 10
    assert result.financial.markup == Decimal("15")
    assert result.logistics.delivery_time == 60  # Default
    assert result.taxes.excise_tax == Decimal("0")  # Default
    assert result.payment.advance_from_client == Decimal("100")  # Default

def test_mapper_with_product_overrides():
    """Test that product-level overrides take precedence"""
    product = MockProduct()
    product.customs_code = "8708913509"  # Product override
    product.supplier_country = "Китай"  # Product override

    variables = {
        'seller_company': 'МАСТЕР БЭРИНГ ООО',
        'offer_incoterms': 'DDP',
        'currency_of_base_price': 'USD',
        'currency_of_quote': 'RUB',
        'exchange_rate_base_price_to_quote': 95.5,
        'markup': 15,
        'supplier_country': 'Турция',  # Quote default
        'customs_code': '0000000000'  # Quote default
    }
    admin_settings = {}

    result = map_variables_to_calculation_input(product, variables, admin_settings)

    # Product overrides should win
    assert result.product.customs_code == "8708913509"
    assert str(result.logistics.supplier_country.value) == "Китай"

def test_mapper_with_all_defaults():
    """Test mapper uses all defaults when nothing provided"""
    product = MockProduct()
    variables = {
        'seller_company': 'МАСТЕР БЭРИНГ ООО',
        'offer_incoterms': 'EXW',
        'currency_of_base_price': 'USD',
        'exchange_rate_base_price_to_quote': 1,
        'markup': 10,
        'supplier_country': 'Турция'
    }
    admin_settings = {}

    result = map_variables_to_calculation_input(product, variables, admin_settings)

    # Check all defaults applied
    assert result.logistics.delivery_time == 60
    assert result.financial.supplier_discount == Decimal("0")
    assert result.taxes.excise_tax == Decimal("0")
    assert result.taxes.util_fee == Decimal("0")
    assert result.customs.brokerage_hub == Decimal("0")
```

### Task 5.2: Integration Tests (30 min)

**File:** `backend/tests/test_quotes_calc_integration.py` (UPDATE)

Add new tests:

```python
@pytest.mark.asyncio
async def test_calculate_quote_with_minimal_data(test_client, auth_headers):
    """Test quote calculation with only required fields"""

    # Minimal request
    request_data = {
        "customer_id": "existing-customer-id",  # From fixtures
        "title": "Test Quote",
        "products": [
            {
                "product_name": "Test Bearing",
                "base_price_vat": 1000.0,
                "quantity": 10,
                "weight_in_kg": 25.0
            }
        ],
        "variables": {
            "seller_company": "МАСТЕР БЭРИНГ ООО",
            "offer_incoterms": "EXW",
            "currency_of_base_price": "USD",
            "currency_of_quote": "RUB",
            "exchange_rate_base_price_to_quote": 95.0,
            "markup": 15,
            "supplier_country": "Турция"
        }
    }

    response = test_client.post(
        "/api/quotes-calc/calculate",
        json=request_data,
        headers=auth_headers
    )

    assert response.status_code == 201
    result = response.json()
    assert "quote_id" in result
    assert "quote_number" in result
    assert len(result["items"]) == 1
    assert result["totals"]["total_amount"] > 0

@pytest.mark.asyncio
async def test_calculate_quote_validation_errors(test_client, auth_headers):
    """Test validation errors are returned properly"""

    # Missing required fields
    request_data = {
        "customer_id": "existing-customer-id",
        "title": "Test Quote",
        "products": [
            {
                "product_name": "Test Product",
                "base_price_vat": 1000.0,
                "quantity": 10
            }
        ],
        "variables": {
            # Missing: seller_company, markup, etc.
            "currency_of_quote": "RUB"
        }
    }

    response = test_client.post(
        "/api/quotes-calc/calculate",
        json=request_data,
        headers=auth_headers
    )

    assert response.status_code == 422
    result = response.json()
    assert "errors" in result["detail"]
    assert len(result["detail"]["errors"]) > 0
```

### Task 5.3: Manual Testing Checklist (30 min)

**File:** `.claude/CALCULATION_TEST_CHECKLIST.md` (NEW)

```markdown
# Calculation Engine Integration - Manual Test Checklist

## Prerequisites
- Backend running: `cd backend && uvicorn main:app --reload`
- Frontend running: `cd frontend && npm run dev`
- Logged in as: andrey@masterbearingsales.ru

## Test Scenario 1: Minimal Required Data (EXW)
- [ ] Upload sample Excel file (1 product)
- [ ] Select customer
- [ ] Fill ONLY required fields:
  - seller_company: МАСТЕР БЭРИНГ ООО
  - offer_incoterms: EXW
  - currency_of_base_price: USD
  - currency_of_quote: RUB
  - exchange_rate: 95.0
  - markup: 15%
  - supplier_country: Турция
- [ ] Leave all other fields empty/default
- [ ] Click "Calculate"
- [ ] Expected: Success, quote created
- [ ] Verify in DB: quote_calculation_results has 13 phases
- [ ] Verify: total_amount > 0

## Test Scenario 2: With Logistics (DDP)
- [ ] Upload file
- [ ] Select customer
- [ ] Fill required fields (same as above)
- [ ] Change offer_incoterms: DDP
- [ ] Fill logistics_supplier_hub: 5000
- [ ] Click "Calculate"
- [ ] Expected: Success

## Test Scenario 3: Validation Errors
- [ ] Upload file
- [ ] Select customer
- [ ] Fill only 3 fields (missing markup, incoterms)
- [ ] Click "Calculate"
- [ ] Expected: 422 error with list of missing fields
- [ ] Verify error message is in Russian

## Test Scenario 4: Logistics Validation (DDP without logistics)
- [ ] Upload file
- [ ] Set offer_incoterms: DDP
- [ ] Leave ALL logistics fields = 0
- [ ] Click "Calculate"
- [ ] Expected: Error "При базисе DDP хотя бы одно поле логистики должно быть > 0"

## Test Scenario 5: Product Overrides
- [ ] Upload file
- [ ] Fill form with quote defaults
- [ ] In grid, edit product markup: 25% (override)
- [ ] Click "Calculate"
- [ ] Expected: Success
- [ ] Verify: Product uses 25% markup, not quote default

## Test Scenario 6: Multiple Products
- [ ] Upload file with 5 products
- [ ] Fill all required fields
- [ ] Click "Calculate"
- [ ] Expected: All 5 products calculated
- [ ] Verify: totals sum correctly
```

**Run All Tests:**
```bash
cd backend
pytest tests/test_quotes_calc*.py -v --cov=routes.quotes_calc --cov-report=term-missing
```

**Expected Coverage:** 80%+ for routes/quotes_calc.py

---

## Phase 6: Frontend Error Display (20 min)

### Task 6.1: Improve Error Handling

**File:** `frontend/src/app/quotes/create/page.tsx`

Update `handleCalculate` function (around line 345):

```typescript
const handleCalculate = async () => {
  if (!selectedCustomer) {
    message.error('Выберите клиента');
    return;
  }

  if (uploadedProducts.length === 0) {
    message.error('Загрузите файл с товарами');
    return;
  }

  setLoading(true);
  try {
    const variables = form.getFieldsValue();

    const result = await quotesCalcService.calculateQuote({
      customer_id: selectedCustomer,
      products: uploadedProducts,
      variables: variables as CalculationVariables,
      title: `Коммерческое предложение от ${new Date().toLocaleDateString()}`,
    });

    if (result.success && result.data) {
      setCalculationResults(result.data);
      message.success(`Расчет выполнен! Котировка №${result.data.quote_number}`);
    } else {
      // Handle validation errors (422)
      if (result.error && typeof result.error === 'object' && 'errors' in result.error) {
        const errors = (result.error as any).errors;
        Modal.error({
          title: 'Ошибки валидации',
          content: (
            <div>
              <p>Пожалуйста, заполните обязательные поля:</p>
              <ul>
                {errors.map((err: string, idx: number) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ),
          width: 600
        });
      } else {
        message.error(`Ошибка расчета: ${result.error}`);
      }
    }
  } catch (error: any) {
    // Handle unexpected errors
    console.error('Calculation error:', error);
    message.error(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
  } finally {
    setLoading(false);
  }
};
```

---

## Success Criteria

### Backend Integration
- [ ] Mapper function transforms flat dict → nested QuoteCalculationInput
- [ ] All 10 required variables validated
- [ ] 32 optional variables use correct defaults
- [ ] Admin settings fetched from DB (or defaults used)
- [ ] Logistics validation works (EXW vs DDP logic)
- [ ] Calculation engine receives properly structured input
- [ ] All 13 phases saved to quote_calculation_results

### Testing
- [ ] Unit tests pass: mapper with minimal data
- [ ] Unit tests pass: product overrides work
- [ ] Unit tests pass: defaults applied correctly
- [ ] Integration test pass: calculate with minimal data
- [ ] Integration test pass: validation errors returned
- [ ] Manual test: EXW scenario works
- [ ] Manual test: DDP scenario with logistics works
- [ ] Manual test: Validation errors display in Russian
- [ ] Test coverage: 80%+ for routes/quotes_calc.py

### Frontend
- [ ] Calculate button triggers calculation
- [ ] Success shows quote number
- [ ] Validation errors display in modal with bullet list
- [ ] Results table shows all products
- [ ] Totals display correctly

---

## Files Modified

### Backend
1. **`backend/routes/quotes_calc.py`**
   - Add helper functions (safe_decimal, safe_int, safe_str)
   - Add map_variables_to_calculation_input() function (~150 lines)
   - Add get_admin_settings() function (~20 lines)
   - Add validate_calculation_request() function (~60 lines)
   - Update calculate_quote() endpoint (~30 lines changed)

2. **`backend/tests/test_quotes_calc_mapper.py`** (NEW)
   - Unit tests for mapper (~80 lines)

3. **`backend/tests/test_quotes_calc_integration.py`** (UPDATE)
   - Add 2 new integration tests (~60 lines)

### Frontend
4. **`frontend/src/app/quotes/create/page.tsx`**
   - Update handleCalculate() error handling (~20 lines)

### Documentation
5. **`.claude/CALCULATION_TEST_CHECKLIST.md`** (NEW)
   - Manual testing checklist

---

## Time Estimate by Phase

| Phase | Task | Time |
|-------|------|------|
| 1 | Variable Mapper | 1.5 hours |
| 2 | Admin Settings | 20 min |
| 3 | Update Endpoint | 30 min |
| 4 | Validation | 45 min |
| 5 | Testing | 1.5 hours |
| 6 | Frontend Display | 20 min |
| **Total** | | **4.5 hours** |

---

## Implementation Order

1. **Phase 1** (mapper) - Foundation for everything
2. **Phase 2** (admin settings) - Small dependency
3. **Phase 3** (endpoint) - Connects everything
4. **Phase 4** (validation) - Important for UX
5. **Phase 5** (tests) - Verify it works
6. **Phase 6** (frontend) - User-facing errors

Each phase is independently testable!

---

## Notes

- All defaults based on `backend/calculation_models.py` Field definitions
- Admin settings strategy: Fetch every time (no cache) - can optimize later if needed
- Frontend compatibility: Keep flat dict - backend transforms (cleaner frontend code)
- Validation: Return ALL errors at once (better UX than one-at-a-time)
- Trust calculation engine: Focus on integration, not engine logic (already tested)

---

**Last Updated:** 2025-10-21
**Next Review:** After Phase 1 completion
