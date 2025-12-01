# Multi-Currency Input & Quote Versioning Design

**Created:** 2025-11-25
**Status:** Design Approved
**Author:** Claude + Andrey

---

## Overview

Enable users to enter monetary variables in any currency (EUR, USD, RUB, TRY, CNY) with automatic conversion to USD for storage and analytics. Includes quote versioning for recalculation with fresh exchange rates.

### Problem Statement

Current system requires users to manually convert all costs to quote currency before entry. In cross-border trade, costs arrive in multiple currencies:
- Logistics from Turkey: TRY or EUR
- Shipping to Russia: USD or EUR
- Russian customs/brokerage: RUB
- Supplier prices: USD, EUR, CNY

Manual conversion is error-prone and time-consuming.

### Solution

1. Each monetary field accepts value + currency selection
2. System converts to USD on entry (for analytics consistency)
3. Calculation engine uses USD values, converts to quote currency at end
4. Quote versioning tracks rate changes over time
5. Admin can override exchange rates per organization

---

## Scope

### Monetary Fields Requiring Currency Support (11 total)

**Quote-level (10 fields):**

| Field | Russian Name | Typical Use |
|-------|-------------|-------------|
| logistics_supplier_hub | Логистика Поставщик-Турция | EUR, TRY |
| logistics_hub_customs | Логистика Турция-РФ | EUR, USD |
| logistics_customs_client | Логистика Таможня-Клиент | RUB |
| brokerage_hub | Брокерские Турция | TRY, USD |
| brokerage_customs | Брокерские РФ | RUB |
| warehousing_at_customs | Расходы на СВХ | RUB |
| customs_documentation | Разрешительные документы | RUB, USD |
| brokerage_extra | Прочее | RUB, USD |
| dm_fee_value | Вознаграждение ЛПР | USD, RUB |
| util_fee | Утилизационный сбор | RUB |

**Product-level (1 field):**

| Field | Russian Name | Typical Use |
|-------|-------------|-------------|
| excise_tax | Акциз | RUB, USD |

**Already has currency support:**
- base_price_VAT (via currency_of_base_price)

### Supported Currencies

| Code | Symbol | Name |
|------|--------|------|
| USD | $ | US Dollar |
| EUR | € | Euro |
| RUB | ₽ | Russian Ruble |
| TRY | ₺ | Turkish Lira |
| CNY | ¥ | Chinese Yuan |

---

## Architecture

### Approach: Hybrid Snapshot with Full Audit

**Why this approach:**
- Quotes created today may be confirmed months later
- Need to recalculate with fresh rates at deal confirmation
- Full audit trail for compliance and analytics
- USD storage enables consistent financial reporting

### Data Flow

```
USER INPUT                    STORAGE                      CALCULATION
─────────────────────────────────────────────────────────────────────────
1500 EUR ──→ Convert ──→ {
                          value: 1500,
                          currency: "EUR",
                          value_usd: 1620,      ──→ Use value_usd
                          rate_used: 1.08,
                          rate_source: "cbr"
                         }

                              │
                              ▼
                    RECALCULATE (60 days later)
                              │
                              ▼
                         {
                          value: 1500,          ← Original preserved
                          currency: "EUR",
                          value_usd: 1680,      ← Updated with new rate
                          rate_used: 1.12,      ← Fresh rate
                          rate_source: "cbr"
                         }
```

### Exchange Rate Priority

```
1. Check org setting: use_manual_exchange_rates?
   │
   ├─ TRUE: Query organization_exchange_rates table
   │        └─ If rate exists → Use it (source: "manual")
   │        └─ If not exists → Fall back to CBR
   │
   └─ FALSE: Query CBR rates (exchange_rates table)
            └─ If fresh (<24h) → Use cached
            └─ If stale → Fetch from CBR API
            └─ If CBR fails → Use stale cache with warning
```

---

## Database Schema

### New Table: quote_versions

Immutable snapshots of quote state at each calculation.

```sql
CREATE TABLE quote_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'draft',
    -- Values: draft, sent, confirmed, rejected, archived

    -- Complete snapshots (JSONB for flexibility)
    quote_variables JSONB NOT NULL,
    products_snapshot JSONB NOT NULL,

    -- Exchange rates at calculation time
    exchange_rates_used JSONB NOT NULL,
    rates_source TEXT NOT NULL,  -- 'cbr', 'manual', 'mixed'
    rates_fetched_at TIMESTAMPTZ,

    -- Calculation output
    calculation_results JSONB NOT NULL,
    total_usd DECIMAL(15, 2) NOT NULL,
    total_quote_currency DECIMAL(15, 2) NOT NULL,

    -- Audit trail
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

-- RLS Policy
ALTER TABLE quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org quote versions" ON quote_versions
FOR SELECT USING (
    quote_id IN (
        SELECT id FROM quotes
        WHERE organization_id = current_organization_id()
    )
);

CREATE POLICY "Users can insert quote versions" ON quote_versions
FOR INSERT WITH CHECK (
    quote_id IN (
        SELECT id FROM quotes
        WHERE organization_id = current_organization_id()
    )
);
```

### New Table: organization_exchange_rates

Admin-controlled exchange rate overrides per organization.

```sql
CREATE TABLE organization_exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL DEFAULT 'USD',
    rate DECIMAL(12, 6) NOT NULL CHECK (rate > 0),
    source TEXT NOT NULL DEFAULT 'manual',  -- 'cbr_sync', 'manual'
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_org_currency_pair
        UNIQUE(organization_id, from_currency, to_currency),
    CONSTRAINT valid_currency_codes
        CHECK (from_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY')
           AND to_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY'))
);

-- RLS Policy
ALTER TABLE organization_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view rates" ON organization_exchange_rates
FOR SELECT USING (
    organization_id = current_organization_id()
);

CREATE POLICY "Admins can manage rates" ON organization_exchange_rates
FOR ALL USING (
    organization_id = current_organization_id()
    AND current_user_role() IN ('admin', 'owner')
);
```

### Updates to calculation_settings

```sql
ALTER TABLE calculation_settings
ADD COLUMN use_manual_exchange_rates BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN default_input_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (default_input_currency IN ('USD', 'EUR', 'RUB', 'TRY', 'CNY'));
```

### Updates to quotes table

```sql
ALTER TABLE quotes
ADD COLUMN current_version_id UUID REFERENCES quote_versions(id),
ADD COLUMN total_usd DECIMAL(15, 2),
ADD COLUMN total_quote_currency DECIMAL(15, 2),
ADD COLUMN last_calculated_at TIMESTAMPTZ,
ADD COLUMN version_count INTEGER NOT NULL DEFAULT 0;
```

---

## Data Models

### MonetaryValue (for each currency-enabled field)

```python
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime
from typing import Literal

Currency = Literal["USD", "EUR", "RUB", "TRY", "CNY"]

class MonetaryValue(BaseModel):
    """Value with currency and USD conversion."""
    value: Decimal = Field(..., ge=0, description="Original value entered by user")
    currency: Currency = Field(..., description="Currency of the value")
    value_usd: Decimal = Field(..., ge=0, description="Value converted to USD")
    rate_used: Decimal = Field(..., gt=0, description="Exchange rate used for conversion")
    rate_source: str = Field(..., description="Source of rate: cbr, manual, identity")
    rate_timestamp: datetime | None = Field(None, description="When rate was fetched")
```

### QuoteVariablesWithCurrency

```python
class QuoteVariablesWithCurrency(BaseModel):
    """Quote-level variables with multi-currency support."""

    # Company settings (no currency needed)
    seller_company: str
    offer_sale_type: str
    offer_incoterms: str

    # Financial (currency_of_quote determines output)
    currency_of_quote: Currency
    markup: Decimal
    dm_fee_type: str
    dm_fee_value: MonetaryValue | None  # Only when type=fixed

    # Logistics with currency
    logistics_supplier_hub: MonetaryValue
    logistics_hub_customs: MonetaryValue
    logistics_customs_client: MonetaryValue

    # Brokerage with currency
    brokerage_hub: MonetaryValue
    brokerage_customs: MonetaryValue
    warehousing_at_customs: MonetaryValue
    customs_documentation: MonetaryValue
    brokerage_extra: MonetaryValue

    # Fees with currency
    util_fee: MonetaryValue

    # Payment terms (no currency - percentages/days)
    advance_from_client: Decimal
    # ... other payment terms

    # Admin variables (fetched from org settings)
    rate_forex_risk: Decimal
    rate_fin_comm: Decimal
    rate_loan_interest_daily: Decimal
```

### QuoteVersion

```python
class QuoteVersionCreate(BaseModel):
    """Create a new quote version."""
    quote_id: UUID
    quote_variables: QuoteVariablesWithCurrency
    products_snapshot: list[ProductWithCurrency]
    exchange_rates_used: dict[str, Decimal]  # {EUR: 1.08, TRY: 0.030}
    rates_source: str
    change_reason: str | None = None
    parent_version_id: UUID | None = None

class QuoteVersionResponse(BaseModel):
    """Quote version response."""
    id: UUID
    quote_id: UUID
    version_number: int
    status: str
    quote_variables: dict
    products_snapshot: list[dict]
    exchange_rates_used: dict
    calculation_results: dict
    total_usd: Decimal
    total_quote_currency: Decimal
    change_reason: str | None
    created_by: UUID
    created_at: datetime
```

---

## API Endpoints

### Exchange Rates Management

```
GET  /api/exchange-rates/org
     Get organization's exchange rate settings and rates

POST /api/exchange-rates/org/sync
     Sync all rates from CBR to organization's manual table (admin)

PUT  /api/exchange-rates/org/{currency}
     Update a specific rate in organization's table (admin)

PUT  /api/exchange-rates/org/settings
     Toggle use_manual_exchange_rates (admin)
```

### Quote Versions

```
GET  /api/quotes/{quote_id}/versions
     List all versions of a quote

GET  /api/quotes/{quote_id}/versions/{version_number}
     Get specific version details

POST /api/quotes/{quote_id}/recalculate
     Create new version with fresh exchange rates

POST /api/quotes/{quote_id}/versions/{version_number}/restore
     Create new version based on a previous version
```

### Currency Conversion (internal use)

```
POST /api/internal/convert-to-usd
     Convert a value to USD using org's rate settings
     Request: { value: 1500, currency: "EUR", org_id: "..." }
     Response: { value_usd: 1620, rate_used: 1.08, rate_source: "cbr" }
```

---

## UI Components

### MonetaryInput Component

```tsx
interface MonetaryInputProps {
    value: MonetaryValue;
    onChange: (value: MonetaryValue) => void;
    label: string;
    currencies?: Currency[];  // Default: ['USD', 'EUR', 'RUB', 'TRY', 'CNY']
    defaultCurrency?: Currency;
    disabled?: boolean;
}

// Usage
<MonetaryInput
    value={logisticsSupplierHub}
    onChange={setLogisticsSupplierHub}
    label="Логистика Поставщик-Турция"
    defaultCurrency="EUR"
/>

// Renders as:
// [1,500.00] [EUR ▼]
// └─ ≈ $1,620 USD (rate: 1.08)  ← small hint showing USD equivalent
```

### Exchange Rate Settings Page

Location: `/settings/exchange-rates`

```
Exchange Rate Settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rate Source
○ Use CBR rates automatically (recommended)
● Use manual rate table

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Manual Rate Table                    [Sync from CBR]

| Currency | Rate to USD | Source | Updated      | Actions |
|----------|-------------|--------|--------------|---------|
| EUR      | 1.0854      | manual | Nov 25, 2025 | [Edit]  |
| TRY      | 0.0303      | cbr    | Nov 25, 2025 | [Edit]  |
| RUB      | 0.0105      | manual | Nov 20, 2025 | [Edit]  |
| CNY      | 0.1381      | cbr    | Nov 25, 2025 | [Edit]  |

Note: Rates marked "cbr" were synced from Central Bank of Russia.
      Rates marked "manual" were edited by admin.
```

### Quote Version History

Location: Quote detail page, new tab "History"

```
Version History
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Current] v3 - Sent to client
December 1, 2025 by Andrey
├─ Total: $13,100 / ₽1,245,500
├─ Rates: EUR=1.12, TRY=0.031, RUB=0.0105
└─ Changed: Markup reduced from 15% to 12%
                                        [View] [Compare]

v2 - Recalculated
November 15, 2025 by System
├─ Total: $12,890 / ₽1,224,550
├─ Rates: EUR=1.11, TRY=0.029, RUB=0.0106
└─ Reason: Recalculated with current rates
                                        [View] [Compare] [Restore]

v1 - Original draft
November 1, 2025 by Andrey
├─ Total: $12,450 / ₽1,182,750
├─ Rates: EUR=1.08, TRY=0.030, RUB=0.0105
└─ Created
                                        [View] [Compare] [Restore]
```

---

## Migration Strategy

### Phase 1: Schema Changes (backward compatible)

1. Create new tables: `quote_versions`, `organization_exchange_rates`
2. Add new columns to `calculation_settings`
3. Add new columns to `quotes`
4. All changes are additive - existing functionality unaffected

### Phase 2: Backfill Existing Quotes

1. For each existing quote, create version 1 with current data
2. Set all monetary values to USD (currency: "USD", rate: 1.0)
3. Mark as rate_source: "legacy"

### Phase 3: Enable Multi-Currency UI

1. Deploy new MonetaryInput component
2. Update quote creation form
3. Update quote edit form

### Phase 4: Enable Versioning

1. Create versions on save instead of updating in place
2. Add version history UI
3. Add recalculate button

---

## Testing Strategy

### Unit Tests

- MonetaryValue conversion logic
- Exchange rate priority (manual vs CBR)
- Cross-rate calculations

### Integration Tests

- Quote creation with multi-currency inputs
- Quote recalculation with rate changes
- Version history retrieval
- Admin rate override flow

### E2E Tests

- Full quote creation workflow with EUR/TRY inputs
- Recalculate quote after 24 hours (stale rates)
- Admin updates rate, verify quotes use new rate

---

## Success Criteria

1. Users can enter any monetary field in EUR, USD, RUB, TRY, or CNY
2. System shows USD equivalent as user types
3. All values stored in USD for analytics
4. Quotes can be recalculated with fresh rates
5. Full version history preserved
6. Admin can override rates per organization
7. Zero rounding errors (Decimal precision throughout)

---

## Future Considerations

1. **More currencies:** Add AED, GBP if needed
2. **Rate alerts:** Notify when rates change significantly
3. **Auto-recalculate:** Cron job to flag quotes with stale rates
4. **Rate history:** Track rate changes over time for analytics
5. **PDF export:** Include rate snapshot in exported documents

---

## Related Documents

- `.claude/VARIABLES.md` - Complete variable reference
- `.claude/skills/calculation-engine-guidelines/` - Calculation patterns
- `backend/services/exchange_rate_service.py` - CBR integration

---

**Approved:** 2025-11-25
**Next Steps:** Implementation planning
