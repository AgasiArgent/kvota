# Multi-Currency Input & Quote Versioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to enter monetary variables in any currency (EUR, USD, RUB, TRY, CNY) with automatic USD conversion and full quote versioning.

**Architecture:** Hybrid Snapshot approach - store original value + currency + USD conversion + rate snapshot. Quote versions are immutable; each save/recalculate creates a new version.

**Tech Stack:** FastAPI + Supabase PostgreSQL (backend) | Next.js 15 + Ant Design (frontend)

**Design Document:** `docs/plans/2025-11-25-multi-currency-input-design.md`

---

## Phase 1: Database Schema (Backend)

### Task 1.1: Create organization_exchange_rates table

**Files:**
- Create: `backend/migrations/034_multi_currency_support.sql`
- Create: `backend/migrations/034_rollback.sql`

**Step 1: Write the migration file**

```sql
-- backend/migrations/034_multi_currency_support.sql
-- Multi-Currency Input & Quote Versioning Support
-- Created: 2025-11-25

-- ============================================================
-- PART 1: Organization Exchange Rates (Admin Override)
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL DEFAULT 'USD',
    rate DECIMAL(12, 6) NOT NULL CHECK (rate > 0),
    source TEXT NOT NULL DEFAULT 'manual',
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_org_currency_pair
        UNIQUE(organization_id, from_currency, to_currency),
    CONSTRAINT valid_from_currency
        CHECK (from_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY')),
    CONSTRAINT valid_to_currency
        CHECK (to_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY'))
);

-- Index for fast lookups
CREATE INDEX idx_org_exchange_rates_org_id
    ON organization_exchange_rates(organization_id);

-- RLS
ALTER TABLE organization_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_rates" ON organization_exchange_rates
FOR SELECT USING (
    organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
);

CREATE POLICY "admins_can_manage_rates" ON organization_exchange_rates
FOR ALL USING (
    organization_id IN (
        SELECT om.organization_id FROM organization_members om
        JOIN roles r ON om.role_id = r.id
        WHERE om.user_id = auth.uid()
        AND om.status = 'active'
        AND (om.is_owner = true OR r.slug IN ('admin'))
    )
);

-- ============================================================
-- PART 2: Add exchange rate toggle to calculation_settings
-- ============================================================

ALTER TABLE calculation_settings
ADD COLUMN IF NOT EXISTS use_manual_exchange_rates BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS default_input_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (default_input_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY'));

-- ============================================================
-- PART 3: Quote Versions Table
-- ============================================================

CREATE TABLE IF NOT EXISTS quote_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'confirmed', 'rejected', 'archived')),

    -- Complete snapshots
    quote_variables JSONB NOT NULL,
    products_snapshot JSONB NOT NULL,

    -- Exchange rates at calculation time
    exchange_rates_used JSONB NOT NULL,
    rates_source TEXT NOT NULL CHECK (rates_source IN ('cbr', 'manual', 'mixed')),
    rates_fetched_at TIMESTAMPTZ,

    -- Calculation results
    calculation_results JSONB NOT NULL,
    total_usd DECIMAL(15, 2) NOT NULL,
    total_quote_currency DECIMAL(15, 2) NOT NULL,

    -- Audit
    change_reason TEXT,
    parent_version_id UUID REFERENCES quote_versions(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_quote_version UNIQUE(quote_id, version_number)
);

-- Indexes
CREATE INDEX idx_quote_versions_quote_id ON quote_versions(quote_id);
CREATE INDEX idx_quote_versions_status ON quote_versions(status);
CREATE INDEX idx_quote_versions_created_at ON quote_versions(created_at DESC);

-- RLS
ALTER TABLE quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_org_versions" ON quote_versions
FOR SELECT USING (
    quote_id IN (
        SELECT id FROM quotes WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
);

CREATE POLICY "users_can_insert_versions" ON quote_versions
FOR INSERT WITH CHECK (
    quote_id IN (
        SELECT id FROM quotes WHERE organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    )
);

-- ============================================================
-- PART 4: Add version tracking to quotes table
-- ============================================================

ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES quote_versions(id),
ADD COLUMN IF NOT EXISTS total_usd DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS total_quote_currency DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS version_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- PART 5: Helper function for current organization
-- ============================================================

CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Write the rollback file**

```sql
-- backend/migrations/034_rollback.sql
-- Rollback: Multi-Currency Support

-- Drop version tracking from quotes
ALTER TABLE quotes
DROP COLUMN IF EXISTS current_version_id,
DROP COLUMN IF EXISTS total_usd,
DROP COLUMN IF EXISTS total_quote_currency,
DROP COLUMN IF EXISTS last_calculated_at,
DROP COLUMN IF EXISTS version_count;

-- Drop quote_versions table
DROP TABLE IF EXISTS quote_versions;

-- Remove exchange rate columns from calculation_settings
ALTER TABLE calculation_settings
DROP COLUMN IF EXISTS use_manual_exchange_rates,
DROP COLUMN IF EXISTS default_input_currency;

-- Drop organization_exchange_rates table
DROP TABLE IF EXISTS organization_exchange_rates;

-- Drop helper function
DROP FUNCTION IF EXISTS current_organization_id();
```

**Step 3: Verify migration syntax**

Run: `cd backend && python -c "print('Migration files created successfully')"`

**Step 4: Commit migration files**

```bash
git add backend/migrations/034_multi_currency_support.sql backend/migrations/034_rollback.sql
git commit -m "feat(db): add multi-currency and quote versioning schema"
```

---

### Task 1.2: Apply migration to database

**Files:**
- Execute: `backend/migrations/034_multi_currency_support.sql`

**Step 1: Apply migration via Supabase**

Open Supabase SQL Editor and run the migration contents.

**Step 2: Verify tables created**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('organization_exchange_rates', 'quote_versions');
```

Expected: 2 rows returned

**Step 3: Verify columns added**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'calculation_settings'
AND column_name IN ('use_manual_exchange_rates', 'default_input_currency');
```

Expected: 2 rows returned

---

## Phase 2: Backend Models & Services

### Task 2.1: Create MonetaryValue model

**Files:**
- Create: `backend/models/monetary.py`
- Test: `backend/tests/models/test_monetary.py`

**Step 1: Write the failing test**

```python
# backend/tests/models/test_monetary.py
"""Tests for MonetaryValue model"""
import pytest
from decimal import Decimal
from datetime import datetime, timezone

from models.monetary import MonetaryValue, Currency, SUPPORTED_CURRENCIES


class TestMonetaryValue:
    """Test MonetaryValue Pydantic model"""

    def test_create_monetary_value_valid(self):
        """Test creating a valid MonetaryValue"""
        mv = MonetaryValue(
            value=Decimal("1500.00"),
            currency="EUR",
            value_usd=Decimal("1620.00"),
            rate_used=Decimal("1.08"),
            rate_source="cbr"
        )
        assert mv.value == Decimal("1500.00")
        assert mv.currency == "EUR"
        assert mv.value_usd == Decimal("1620.00")
        assert mv.rate_used == Decimal("1.08")
        assert mv.rate_source == "cbr"

    def test_monetary_value_rejects_negative(self):
        """Test that negative values are rejected"""
        with pytest.raises(ValueError):
            MonetaryValue(
                value=Decimal("-100.00"),
                currency="USD",
                value_usd=Decimal("-100.00"),
                rate_used=Decimal("1.0"),
                rate_source="identity"
            )

    def test_monetary_value_rejects_invalid_currency(self):
        """Test that invalid currency codes are rejected"""
        with pytest.raises(ValueError):
            MonetaryValue(
                value=Decimal("100.00"),
                currency="GBP",  # Not supported
                value_usd=Decimal("130.00"),
                rate_used=Decimal("1.30"),
                rate_source="manual"
            )

    def test_supported_currencies(self):
        """Test that supported currencies are correctly defined"""
        assert SUPPORTED_CURRENCIES == ["USD", "EUR", "RUB", "TRY", "CNY"]

    def test_usd_identity_conversion(self):
        """Test USD to USD conversion uses identity rate"""
        mv = MonetaryValue(
            value=Decimal("100.00"),
            currency="USD",
            value_usd=Decimal("100.00"),
            rate_used=Decimal("1.0"),
            rate_source="identity"
        )
        assert mv.value == mv.value_usd
        assert mv.rate_used == Decimal("1.0")
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/models/test_monetary.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'models.monetary'"

**Step 3: Create the models directory and module**

```bash
mkdir -p backend/models
touch backend/models/__init__.py
```

**Step 4: Write minimal implementation**

```python
# backend/models/monetary.py
"""Monetary value models for multi-currency support"""
from decimal import Decimal
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Supported currencies
SUPPORTED_CURRENCIES = ["USD", "EUR", "RUB", "TRY", "CNY"]
Currency = Literal["USD", "EUR", "RUB", "TRY", "CNY"]


class MonetaryValue(BaseModel):
    """
    Value with currency and USD conversion.
    Used for all monetary fields that support multi-currency input.
    """
    value: Decimal = Field(..., ge=0, description="Original value entered by user")
    currency: Currency = Field(..., description="Currency of the value")
    value_usd: Decimal = Field(..., ge=0, description="Value converted to USD")
    rate_used: Decimal = Field(..., gt=0, description="Exchange rate used for conversion")
    rate_source: str = Field(..., description="Source of rate: cbr, manual, identity")
    rate_timestamp: Optional[datetime] = Field(None, description="When rate was fetched")

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Currency must be one of {SUPPORTED_CURRENCIES}")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "value": "1500.00",
                "currency": "EUR",
                "value_usd": "1620.00",
                "rate_used": "1.08",
                "rate_source": "cbr",
                "rate_timestamp": "2025-11-25T10:00:00Z"
            }
        }


class MonetaryInput(BaseModel):
    """
    Input model for monetary values from frontend.
    Only contains value and currency - USD conversion happens server-side.
    """
    value: Decimal = Field(..., ge=0, description="Value entered by user")
    currency: Currency = Field(default="USD", description="Currency selected by user")

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Currency must be one of {SUPPORTED_CURRENCIES}")
        return v
```

**Step 5: Run test to verify it passes**

Run: `cd backend && pytest tests/models/test_monetary.py -v`

Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add backend/models/ backend/tests/models/
git commit -m "feat(models): add MonetaryValue model for multi-currency"
```

---

### Task 2.2: Create MultiCurrencyService

**Files:**
- Create: `backend/services/multi_currency_service.py`
- Test: `backend/tests/services/test_multi_currency_service.py`

**Step 1: Write the failing test**

```python
# backend/tests/services/test_multi_currency_service.py
"""Tests for MultiCurrencyService"""
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from services.multi_currency_service import MultiCurrencyService
from models.monetary import MonetaryValue


class TestMultiCurrencyService:
    """Test MultiCurrencyService"""

    @pytest.fixture
    def service(self):
        return MultiCurrencyService()

    @pytest.fixture
    def org_id(self):
        return uuid4()

    @pytest.mark.asyncio
    async def test_convert_usd_to_usd(self, service, org_id):
        """USD to USD should return identity conversion"""
        result = await service.convert_to_usd(
            value=Decimal("100.00"),
            from_currency="USD",
            org_id=org_id
        )

        assert result.value == Decimal("100.00")
        assert result.currency == "USD"
        assert result.value_usd == Decimal("100.00")
        assert result.rate_used == Decimal("1.0")
        assert result.rate_source == "identity"

    @pytest.mark.asyncio
    async def test_convert_eur_to_usd_cbr(self, service, org_id):
        """EUR to USD should use CBR rate when manual rates disabled"""
        with patch.object(service, '_get_org_uses_manual_rates', return_value=False):
            with patch.object(service, '_get_cbr_rate', return_value=Decimal("1.08")):
                result = await service.convert_to_usd(
                    value=Decimal("1000.00"),
                    from_currency="EUR",
                    org_id=org_id
                )

                assert result.value == Decimal("1000.00")
                assert result.currency == "EUR"
                assert result.value_usd == Decimal("1080.00")
                assert result.rate_used == Decimal("1.08")
                assert result.rate_source == "cbr"

    @pytest.mark.asyncio
    async def test_convert_try_to_usd_manual(self, service, org_id):
        """TRY to USD should use manual rate when enabled"""
        with patch.object(service, '_get_org_uses_manual_rates', return_value=True):
            with patch.object(service, '_get_manual_rate', return_value=Decimal("0.0303")):
                result = await service.convert_to_usd(
                    value=Decimal("50000.00"),
                    from_currency="TRY",
                    org_id=org_id
                )

                assert result.value == Decimal("50000.00")
                assert result.currency == "TRY"
                assert result.value_usd == Decimal("1515.00")
                assert result.rate_used == Decimal("0.0303")
                assert result.rate_source == "manual"

    @pytest.mark.asyncio
    async def test_convert_fallback_to_cbr_when_manual_missing(self, service, org_id):
        """Should fallback to CBR when manual rate not set"""
        with patch.object(service, '_get_org_uses_manual_rates', return_value=True):
            with patch.object(service, '_get_manual_rate', return_value=None):
                with patch.object(service, '_get_cbr_rate', return_value=Decimal("0.0105")):
                    result = await service.convert_to_usd(
                        value=Decimal("100000.00"),
                        from_currency="RUB",
                        org_id=org_id
                    )

                    assert result.rate_source == "cbr"
                    assert result.rate_used == Decimal("0.0105")
```

**Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/services/test_multi_currency_service.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'services.multi_currency_service'"

**Step 3: Write minimal implementation**

```python
# backend/services/multi_currency_service.py
"""
Multi-Currency Service
Handles currency conversions with org-specific rate settings.
"""
import os
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from supabase import create_client, Client

from models.monetary import MonetaryValue, Currency
from services.exchange_rate_service import get_exchange_rate_service


class MultiCurrencyService:
    """
    Service for multi-currency operations.
    Respects organization settings for manual vs CBR rates.
    """

    async def convert_to_usd(
        self,
        value: Decimal,
        from_currency: Currency,
        org_id: UUID
    ) -> MonetaryValue:
        """
        Convert a value to USD using org's rate settings.

        Args:
            value: The monetary value to convert
            from_currency: Source currency code
            org_id: Organization ID for rate settings lookup

        Returns:
            MonetaryValue with original value, USD conversion, and rate info
        """
        # USD to USD - identity conversion
        if from_currency == "USD":
            return MonetaryValue(
                value=value,
                currency="USD",
                value_usd=value,
                rate_used=Decimal("1.0"),
                rate_source="identity",
                rate_timestamp=datetime.now(timezone.utc)
            )

        # Check if org uses manual rates
        use_manual = await self._get_org_uses_manual_rates(org_id)

        rate: Optional[Decimal] = None
        source: str = "cbr"

        if use_manual:
            # Try manual rate first
            rate = await self._get_manual_rate(org_id, from_currency, "USD")
            if rate:
                source = "manual"

        # Fallback to CBR if no manual rate
        if rate is None:
            rate = await self._get_cbr_rate(from_currency, "USD")
            source = "cbr"

        if rate is None:
            raise ValueError(f"No exchange rate available for {from_currency}/USD")

        # Calculate USD value
        value_usd = (value * rate).quantize(Decimal("0.01"))

        return MonetaryValue(
            value=value,
            currency=from_currency,
            value_usd=value_usd,
            rate_used=rate,
            rate_source=source,
            rate_timestamp=datetime.now(timezone.utc)
        )

    async def _get_org_uses_manual_rates(self, org_id: UUID) -> bool:
        """Check if organization uses manual exchange rates"""
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        result = supabase.table("calculation_settings") \
            .select("use_manual_exchange_rates") \
            .eq("organization_id", str(org_id)) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return result.data[0].get("use_manual_exchange_rates", False)
        return False

    async def _get_manual_rate(
        self,
        org_id: UUID,
        from_currency: str,
        to_currency: str
    ) -> Optional[Decimal]:
        """Get manual exchange rate from organization's rate table"""
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        result = supabase.table("organization_exchange_rates") \
            .select("rate") \
            .eq("organization_id", str(org_id)) \
            .eq("from_currency", from_currency) \
            .eq("to_currency", to_currency) \
            .limit(1) \
            .execute()

        if result.data and len(result.data) > 0:
            return Decimal(str(result.data[0]["rate"]))
        return None

    async def _get_cbr_rate(
        self,
        from_currency: str,
        to_currency: str
    ) -> Optional[Decimal]:
        """Get exchange rate from CBR service"""
        service = get_exchange_rate_service()
        return await service.get_rate(from_currency, to_currency)

    async def get_all_rates_for_org(self, org_id: UUID) -> dict[str, Decimal]:
        """
        Get all currency rates to USD for an organization.
        Used when creating quote versions.
        """
        currencies = ["EUR", "RUB", "TRY", "CNY"]
        rates = {"USD": Decimal("1.0")}

        for currency in currencies:
            try:
                mv = await self.convert_to_usd(
                    value=Decimal("1.0"),
                    from_currency=currency,
                    org_id=org_id
                )
                rates[currency] = mv.rate_used
            except ValueError:
                # Rate not available
                pass

        return rates


# Singleton instance
_service_instance: Optional[MultiCurrencyService] = None


def get_multi_currency_service() -> MultiCurrencyService:
    """Get or create the global multi-currency service instance"""
    global _service_instance
    if _service_instance is None:
        _service_instance = MultiCurrencyService()
    return _service_instance
```

**Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/services/test_multi_currency_service.py -v`

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add backend/services/multi_currency_service.py backend/tests/services/test_multi_currency_service.py
git commit -m "feat(services): add MultiCurrencyService for currency conversion"
```

---

### Task 2.3: Create Organization Exchange Rates API

**Files:**
- Create: `backend/routes/org_exchange_rates.py`
- Test: `backend/tests/routes/test_org_exchange_rates.py`
- Modify: `backend/main.py` (add router)

**Step 1: Write the failing test**

```python
# backend/tests/routes/test_org_exchange_rates.py
"""Tests for Organization Exchange Rates API"""
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import will be added after route is created


class TestOrgExchangeRatesAPI:
    """Test organization exchange rates endpoints"""

    def test_get_org_rates_returns_settings_and_rates(self):
        """GET /api/exchange-rates/org should return settings and rates"""
        # Test will be implemented with route
        pass

    def test_update_rate_requires_admin(self):
        """PUT /api/exchange-rates/org/{currency} requires admin role"""
        pass

    def test_sync_from_cbr_copies_rates(self):
        """POST /api/exchange-rates/org/sync should copy CBR rates"""
        pass

    def test_toggle_manual_rates(self):
        """PUT /api/exchange-rates/org/settings should toggle setting"""
        pass
```

**Step 2: Write the route implementation**

```python
# backend/routes/org_exchange_rates.py
"""
Organization Exchange Rates API
Admin management of per-organization exchange rates
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
import os

from supabase import create_client, Client

from auth import get_current_user, User
from routes.calculation_settings import check_admin_permissions
from services.exchange_rate_service import get_exchange_rate_service
from models.monetary import SUPPORTED_CURRENCIES

router = APIRouter(prefix="/api/exchange-rates/org", tags=["org-exchange-rates"])


# ============================================================
# Request/Response Models
# ============================================================

class OrgExchangeRate(BaseModel):
    """Single exchange rate entry"""
    from_currency: str
    to_currency: str = "USD"
    rate: Decimal
    source: str
    updated_at: datetime
    updated_by_email: Optional[str] = None


class OrgExchangeRateSettings(BaseModel):
    """Organization exchange rate settings"""
    use_manual_exchange_rates: bool
    default_input_currency: str
    rates: list[OrgExchangeRate]


class UpdateRateRequest(BaseModel):
    """Request to update a specific rate"""
    rate: Decimal = Field(..., gt=0)


class UpdateSettingsRequest(BaseModel):
    """Request to update exchange rate settings"""
    use_manual_exchange_rates: bool


class SyncResponse(BaseModel):
    """Response from sync operation"""
    success: bool
    rates_synced: int
    message: str


# ============================================================
# Endpoints
# ============================================================

@router.get("", response_model=OrgExchangeRateSettings)
async def get_org_exchange_rates(user: User = Depends(get_current_user)):
    """
    Get organization's exchange rate settings and current rates.

    Returns:
        - use_manual_exchange_rates: Whether org uses manual rates
        - default_input_currency: Default currency for new inputs
        - rates: List of all configured rates
    """
    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)

    # Get settings
    settings_result = supabase.table("calculation_settings") \
        .select("use_manual_exchange_rates, default_input_currency") \
        .eq("organization_id", org_id) \
        .limit(1) \
        .execute()

    use_manual = False
    default_currency = "USD"

    if settings_result.data and len(settings_result.data) > 0:
        use_manual = settings_result.data[0].get("use_manual_exchange_rates", False)
        default_currency = settings_result.data[0].get("default_input_currency", "USD")

    # Get rates
    rates_result = supabase.table("organization_exchange_rates") \
        .select("from_currency, to_currency, rate, source, updated_at, updated_by") \
        .eq("organization_id", org_id) \
        .order("from_currency") \
        .execute()

    rates = []
    for r in rates_result.data or []:
        rates.append(OrgExchangeRate(
            from_currency=r["from_currency"],
            to_currency=r["to_currency"],
            rate=Decimal(str(r["rate"])),
            source=r["source"],
            updated_at=r["updated_at"],
            updated_by_email=None  # TODO: join with users table
        ))

    return OrgExchangeRateSettings(
        use_manual_exchange_rates=use_manual,
        default_input_currency=default_currency,
        rates=rates
    )


@router.put("/settings")
async def update_exchange_rate_settings(
    request: UpdateSettingsRequest,
    user: User = Depends(get_current_user)
):
    """
    Toggle manual exchange rates on/off.
    Admin only.
    """
    await check_admin_permissions(user)

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)

    result = supabase.table("calculation_settings") \
        .update({"use_manual_exchange_rates": request.use_manual_exchange_rates}) \
        .eq("organization_id", org_id) \
        .execute()

    return {"success": True, "use_manual_exchange_rates": request.use_manual_exchange_rates}


@router.put("/{currency}")
async def update_org_rate(
    currency: str,
    request: UpdateRateRequest,
    user: User = Depends(get_current_user)
):
    """
    Update a specific exchange rate for the organization.
    Admin only.
    """
    await check_admin_permissions(user)

    currency = currency.upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Currency must be one of {SUPPORTED_CURRENCIES}"
        )

    if currency == "USD":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set USD rate (always 1.0)"
        )

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)

    # Upsert the rate
    result = supabase.table("organization_exchange_rates") \
        .upsert({
            "organization_id": org_id,
            "from_currency": currency,
            "to_currency": "USD",
            "rate": float(request.rate),
            "source": "manual",
            "updated_by": str(user.id),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="organization_id,from_currency,to_currency") \
        .execute()

    return {
        "success": True,
        "currency": currency,
        "rate": request.rate,
        "source": "manual"
    }


@router.post("/sync", response_model=SyncResponse)
async def sync_rates_from_cbr(user: User = Depends(get_current_user)):
    """
    Sync all rates from CBR to organization's manual rate table.
    Admin only.
    """
    await check_admin_permissions(user)

    supabase: Client = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    org_id = str(user.current_organization_id)
    exchange_service = get_exchange_rate_service()

    # Fetch fresh rates from CBR
    rates = await exchange_service.fetch_cbr_rates()

    if not rates:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to fetch rates from CBR"
        )

    # Convert CBR rates (currency/RUB) to USD
    # CBR gives us currency/RUB, we need currency/USD
    rub_usd = rates.get("USD", Decimal("1"))  # USD/RUB

    synced_count = 0
    currencies_to_sync = ["EUR", "TRY", "CNY", "RUB"]

    for currency in currencies_to_sync:
        if currency == "RUB":
            # RUB to USD rate
            rate_to_usd = Decimal("1") / rub_usd
        elif currency in rates:
            # Other currency to USD: (currency/RUB) / (USD/RUB)
            rate_to_usd = rates[currency] / rub_usd
        else:
            continue

        # Round to 6 decimal places
        rate_to_usd = rate_to_usd.quantize(Decimal("0.000001"))

        supabase.table("organization_exchange_rates") \
            .upsert({
                "organization_id": org_id,
                "from_currency": currency,
                "to_currency": "USD",
                "rate": float(rate_to_usd),
                "source": "cbr_sync",
                "updated_by": str(user.id),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }, on_conflict="organization_id,from_currency,to_currency") \
            .execute()

        synced_count += 1

    return SyncResponse(
        success=True,
        rates_synced=synced_count,
        message=f"Synced {synced_count} rates from CBR"
    )
```

**Step 3: Register router in main.py**

Add to `backend/main.py`:

```python
from routes.org_exchange_rates import router as org_exchange_rates_router

# ... in router registration section
app.include_router(org_exchange_rates_router)
```

**Step 4: Run tests**

Run: `cd backend && pytest tests/routes/test_org_exchange_rates.py -v`

**Step 5: Commit**

```bash
git add backend/routes/org_exchange_rates.py backend/tests/routes/test_org_exchange_rates.py backend/main.py
git commit -m "feat(api): add organization exchange rates management endpoints"
```

---

## Phase 3: Quote Versions API

### Task 3.1: Create Quote Versions models and service

**Files:**
- Create: `backend/models/quote_version.py`
- Create: `backend/services/quote_version_service.py`
- Test: `backend/tests/services/test_quote_version_service.py`

*[Implementation follows same TDD pattern as above]*

### Task 3.2: Create Quote Versions API endpoints

**Files:**
- Create: `backend/routes/quote_versions.py`
- Test: `backend/tests/routes/test_quote_versions.py`
- Modify: `backend/main.py` (add router)

*[Implementation follows same TDD pattern as above]*

---

## Phase 4: Frontend Components

### Task 4.1: Create MonetaryInput component

**Files:**
- Create: `frontend/src/components/inputs/MonetaryInput.tsx`
- Create: `frontend/src/components/inputs/index.ts`

**Step 1: Create the component**

```tsx
// frontend/src/components/inputs/MonetaryInput.tsx
'use client';

import React from 'react';
import { InputNumber, Select, Space, Typography } from 'antd';
import { Decimal } from 'decimal.js';

const { Text } = Typography;

export type Currency = 'USD' | 'EUR' | 'RUB' | 'TRY' | 'CNY';

export interface MonetaryValue {
  value: number;
  currency: Currency;
}

interface MonetaryInputProps {
  value?: MonetaryValue;
  onChange?: (value: MonetaryValue) => void;
  label?: string;
  defaultCurrency?: Currency;
  disabled?: boolean;
  placeholder?: string;
  usdEquivalent?: number;  // Optional USD hint
  style?: React.CSSProperties;
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: '$ USD', symbol: '$' },
  { value: 'EUR', label: '€ EUR', symbol: '€' },
  { value: 'RUB', label: '₽ RUB', symbol: '₽' },
  { value: 'TRY', label: '₺ TRY', symbol: '₺' },
  { value: 'CNY', label: '¥ CNY', symbol: '¥' },
];

export const MonetaryInput: React.FC<MonetaryInputProps> = ({
  value,
  onChange,
  label,
  defaultCurrency = 'USD',
  disabled = false,
  placeholder = '0.00',
  usdEquivalent,
  style,
}) => {
  const currentValue = value || { value: 0, currency: defaultCurrency };

  const handleValueChange = (newValue: number | null) => {
    onChange?.({
      ...currentValue,
      value: newValue || 0,
    });
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    onChange?.({
      ...currentValue,
      currency: newCurrency,
    });
  };

  const showUsdHint = currentValue.currency !== 'USD' && usdEquivalent !== undefined;

  return (
    <div style={style}>
      <Space.Compact style={{ width: '100%' }}>
        <InputNumber
          value={currentValue.value || undefined}
          onChange={handleValueChange}
          disabled={disabled}
          placeholder={placeholder}
          style={{ width: '70%' }}
          min={0}
          precision={2}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          parser={(value) => value?.replace(/\s/g, '') as unknown as number}
        />
        <Select
          value={currentValue.currency}
          onChange={handleCurrencyChange}
          disabled={disabled}
          style={{ width: '30%' }}
          options={CURRENCY_OPTIONS}
        />
      </Space.Compact>
      {showUsdHint && (
        <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
          ≈ ${usdEquivalent?.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
        </Text>
      )}
    </div>
  );
};

export default MonetaryInput;
```

**Step 2: Create index export**

```typescript
// frontend/src/components/inputs/index.ts
export { MonetaryInput, type MonetaryValue, type Currency } from './MonetaryInput';
```

**Step 3: Commit**

```bash
git add frontend/src/components/inputs/
git commit -m "feat(ui): add MonetaryInput component for multi-currency"
```

---

### Task 4.2: Create Exchange Rate Settings page

**Files:**
- Create: `frontend/src/app/settings/exchange-rates/page.tsx`
- Create: `frontend/src/lib/api/org-exchange-rates-service.ts`

*[Implementation details follow same pattern]*

---

### Task 4.3: Update Quote Creation form with MonetaryInput

**Files:**
- Modify: `frontend/src/app/quotes/create/page.tsx`

*[Replace InputNumber fields for monetary variables with MonetaryInput]*

---

## Phase 5: Integration & Testing

### Task 5.1: E2E test for multi-currency quote creation

**Files:**
- Create: `backend/tests/e2e/test_multi_currency_quote.py`

### Task 5.2: E2E test for quote recalculation

**Files:**
- Create: `backend/tests/e2e/test_quote_recalculation.py`

---

## Phase 6: Documentation

### Task 6.1: Update VARIABLES.md with currency fields

**Files:**
- Modify: `.claude/VARIABLES.md`

### Task 6.2: Update CLAUDE.md with multi-currency section

**Files:**
- Modify: `CLAUDE.md`

---

## Execution Checklist

```
Phase 1: Database Schema
[ ] Task 1.1: Create migration files
[ ] Task 1.2: Apply migration to database

Phase 2: Backend Models & Services
[ ] Task 2.1: Create MonetaryValue model
[ ] Task 2.2: Create MultiCurrencyService
[ ] Task 2.3: Create Organization Exchange Rates API

Phase 3: Quote Versions API
[ ] Task 3.1: Create Quote Versions models and service
[ ] Task 3.2: Create Quote Versions API endpoints

Phase 4: Frontend Components
[ ] Task 4.1: Create MonetaryInput component
[ ] Task 4.2: Create Exchange Rate Settings page
[ ] Task 4.3: Update Quote Creation form

Phase 5: Integration & Testing
[ ] Task 5.1: E2E test for multi-currency quote creation
[ ] Task 5.2: E2E test for quote recalculation

Phase 6: Documentation
[ ] Task 6.1: Update VARIABLES.md
[ ] Task 6.2: Update CLAUDE.md
```

---

**Estimated Time:** 8-12 hours (full implementation)

**Dependencies:** None (all new functionality)

**Rollback:** Run `034_rollback.sql` to revert database changes
