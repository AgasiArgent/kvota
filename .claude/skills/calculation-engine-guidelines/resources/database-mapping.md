# Database Mapping - Variables to Tables

**Created:** 2025-12-13
**Source:** Code analysis (migrations and routes)
**Status:** Verified from actual implementation

---

## Overview

Variables are stored across 5 main tables:
1. `quotes` - Quote-level totals and metadata
2. `quote_items` - Product data (raw input)
3. `quote_calculation_variables` - 42 input variables (JSONB)
4. `quote_calculation_results` - 13 phases output (JSONB per product)
5. `quote_calculation_summaries` - Pre-aggregated quote totals

---

## 1. quotes Table

**Migration:** 007, 035-041 (various additions)

### Quote Metadata
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Multi-tenant isolation |
| `customer_id` | UUID | Customer reference |
| `quote_number` | TEXT | Human-readable (e.g., "КП-2024-001") |
| `status` | TEXT | draft, sent, accepted, rejected, expired |
| `currency` | TEXT | Quote currency (USD, EUR, RUB) |

### Totals - Dual Currency Storage
| Column | Type | Currency | Description |
|--------|------|----------|-------------|
| `total_amount` | DECIMAL(15,2) | Original | Legacy - unclear currency |
| `total_usd` | DECIMAL(15,2) | USD | For analytics |
| `total_with_vat_usd` | DECIMAL(15,2) | USD | For analytics |
| `total_amount_quote` | DECIMAL(15,2) | Quote | Client-facing |
| `total_with_vat_quote` | DECIMAL(15,2) | Quote | Client-facing |

### Exchange Rate Audit Trail
| Column | Type | Description |
|--------|------|-------------|
| `usd_to_quote_rate` | DECIMAL(12,6) | Rate: 1 USD = X quote_currency |
| `exchange_rate_source` | TEXT | 'cbr', 'manual', 'mixed' |
| `exchange_rate_timestamp` | TIMESTAMPTZ | When rate was captured |

---

## 2. quote_items Table

**Migration:** 007, 009, 030

### Product Input Data
| Column | Type | Variable | Description |
|--------|------|----------|-------------|
| `id` | UUID | - | Primary key |
| `quote_id` | UUID | - | Parent quote |
| `position` | INTEGER | - | Row order (0-based) |
| `product_name` | TEXT | `product_name` | Product description |
| `product_code` | TEXT | `customs_code` | ТН ВЭД code |
| `sku` | TEXT | `sku` | Article number |
| `brand` | TEXT | `brand` | Manufacturer |
| `base_price_vat` | DECIMAL(15,2) | `base_price_VAT` | Purchase price with VAT |
| `quantity` | INTEGER | `quantity` | Units |
| `weight_in_kg` | DECIMAL(10,2) | `weight_in_kg` | Weight per unit |
| `customs_code` | TEXT | `customs_code` | ТН ВЭД (duplicate) |
| `supplier_country` | TEXT | `supplier_country` | Country of origin |

### Custom Fields (Migration 030)
| Column | Type | Description |
|--------|------|-------------|
| `custom_field_1` | TEXT | User-defined |
| `custom_field_2` | TEXT | User-defined |
| `custom_field_3` | TEXT | User-defined |

---

## 3. quote_calculation_variables Table

**Migration:** 007

### Structure
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `quote_id` | UUID | Parent quote (UNIQUE) |
| `template_id` | UUID | Optional template reference |
| `variables` | JSONB | All 42 input variables |

### JSONB `variables` Structure

```json
{
  // Company Settings
  "seller_company": "МАСТЕР БЭРИНГ ООО",
  "offer_sale_type": "поставка",
  "offer_incoterms": "DDP",

  // Financial
  "currency_of_quote": "USD",
  "markup": 15,
  "dm_fee_type": "percent",
  "dm_fee_value": 2,

  // Logistics Costs (quote-level)
  "logistics_supplier_hub": 200,
  "logistics_hub_customs": 150,
  "logistics_customs_client": 5000,

  // Brokerage Costs
  "brokerage_hub": 100,
  "brokerage_customs": 200,
  "warehousing_at_customs": 50,
  "customs_documentation": 100,
  "brokerage_extra": 0,

  // Payment Terms
  "advance_from_client": 30,
  "advance_to_supplier": 30,
  "time_to_advance": 7,
  "delivery_time": 60,
  ...

  // Product Defaults (can be overridden per product)
  "currency_of_base_price": "EUR",
  "exchange_rate_base_price_to_quote": 1.08,
  "supplier_discount": 0,
  "supplier_country": "Турция",
  "import_tariff": 5,
  ...
}
```

---

## 4. quote_calculation_results Table

**Migration:** 007, 037

### Structure
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `quote_id` | UUID | Parent quote |
| `quote_item_id` | UUID | Parent product (UNIQUE) |
| `phase_results` | JSONB | All 13 phases output |
| `phase_results_quote_currency` | JSONB | Same, explicit currency |
| `calculated_at` | TIMESTAMPTZ | When calculated |

### JSONB `phase_results` Structure

```json
{
  // Phase 1: Purchase Price
  "purchase_price_no_vat": 1000.00,
  "purchase_price_after_discount": 1000.00,
  "purchase_price_per_unit_quote_currency": 1080.00,
  "purchase_price_total_quote_currency": 10800.00,

  // Phase 3: Logistics
  "logistics_first_leg": 150.00,
  "logistics_last_leg": 200.00,
  "logistics_total": 350.00,

  // Phase 4: COGS
  "customs_fee": 540.00,
  "excise_tax_amount": 0,
  "cogs_per_unit": 115.40,
  "cogs_per_product": 11540.00,

  // Phase 11: Final Pricing
  "sales_price_per_unit_no_vat": 138.48,
  "sales_price_total_no_vat": 13848.00,

  // Phase 12: VAT
  "sales_price_per_unit_with_vat": 166.18,
  "sales_price_total_with_vat": 16618.00,
  "vat_from_sales": 2770.00,
  "vat_on_import": 2308.00,
  "vat_net_payable": 462.00,

  // Phase 13: Transit Commission
  "transit_commission": 0
}
```

---

## 5. quote_calculation_summaries Table

**Migration:** 022, 024, 037

### Purpose
Pre-aggregated quote-level totals to avoid JOIN duplication in analytics.

### Phase Columns (Quote Currency)

| Column | Phase | Excel | Description |
|--------|-------|-------|-------------|
| `calc_s16_total_purchase_price` | 1 | S16 | Total purchase cost |
| `calc_t16_first_leg_logistics` | 3 | T16 | First leg logistics |
| `calc_u16_last_leg_logistics` | 3 | U16 | Last leg logistics |
| `calc_v16_total_logistics` | 3 | V16 | Total logistics |
| `calc_y16_customs_duty` | 4 | Y16 | Total customs duty |
| `calc_ab16_cogs_total` | 10 | AB16 | Total COGS |
| `calc_ae16_sale_price_total` | 11 | AE16 | Sale price (excl. financial) |
| `calc_ak16_final_price_total` | 11 | AK16 | Final price (no VAT) |
| `calc_al16_total_with_vat` | 12 | AL16 | Final price (with VAT) |
| `calc_aq16_transit_commission` | 13 | AQ16 | Transit commission |

### Financing Columns

| Column | Phase | Cell | Description |
|--------|-------|------|-------------|
| `calc_bh2_revenue_estimated` | 6 | BH2 | Estimated revenue |
| `calc_bh3_client_advance` | 7 | BH3 | Client advance |
| `calc_bh6_supplier_payment` | 5 | BH6 | Supplier payment |
| `calc_bj7_supplier_financing_cost` | 7 | BJ7 | Supplier financing cost |
| `calc_bj10_operational_financing` | 7 | BJ10 | Operational financing |
| `calc_bj11_total_financing_cost` | 7 | BJ11 | Total financing cost |
| `calc_bl3_credit_sales_amount` | 8 | BL3 | Credit sales amount |
| `calc_bl5_credit_sales_interest` | 8 | BL5 | Credit sales interest |

### Brokerage Columns (Migration 024)

| Column | Description |
|--------|-------------|
| `calc_total_brokerage` | Sum of all brokerage costs |
| `calc_total_logistics_and_brokerage` | Logistics + Brokerage total |

### Dual Currency Columns (Migration 037)

| Column | Currency | Description |
|--------|----------|-------------|
| `calc_s16_total_purchase_price_quote` | Quote | Purchase price in quote currency |
| `calc_ak16_final_price_total_quote` | Quote | Final price in quote currency |
| `calc_al16_total_with_vat_quote` | Quote | With VAT in quote currency |
| `calc_total_brokerage_quote` | Quote | Brokerage in quote currency |
| `quote_currency` | - | Currency code |
| `usd_to_quote_rate` | - | Exchange rate used |
| `exchange_rate_source` | - | 'cbr', 'manual', 'mixed' |
| `exchange_rate_timestamp` | - | When rate captured |

---

## 6. calculation_settings Table

**Migration:** 008

### Admin-Only Variables (Organization-Wide)
| Column | Type | Variable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | - | - | Primary key |
| `organization_id` | UUID | - | - | Multi-tenant |
| `rate_forex_risk` | DECIMAL | `rate_forex_risk` | 3% | Forex buffer |
| `rate_fin_comm` | DECIMAL | `rate_fin_comm` | 0.5% | Financial commission |
| `rate_loan_interest_daily` | DECIMAL | `rate_loan_interest_daily` | 0.15% | Daily interest rate |

---

## 7. variable_templates Table

**Migration:** 007

### Saved Variable Sets
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Multi-tenant |
| `name` | TEXT | Template name |
| `description` | TEXT | Optional description |
| `variables` | JSONB | Same structure as quote_calculation_variables |
| `is_default` | BOOLEAN | Default template for org |

---

## 8. Query Examples

### Get Quote with All Variables
```sql
SELECT
    q.*,
    qcv.variables,
    qcs.*
FROM quotes q
LEFT JOIN quote_calculation_variables qcv ON qcv.quote_id = q.id
LEFT JOIN quote_calculation_summaries qcs ON qcs.quote_id = q.id
WHERE q.id = $1;
```

### Get Product Calculations
```sql
SELECT
    qi.*,
    qcr.phase_results,
    qcr.calculated_at
FROM quote_items qi
LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
WHERE qi.quote_id = $1
ORDER BY qi.position;
```

### Analytics Query (Uses pre-aggregated summaries)
```sql
SELECT
    q.quote_number,
    q.total_usd,
    qcs.calc_ak16_final_price_total,
    qcs.calc_al16_total_with_vat,
    qcs.calc_bj11_total_financing_cost
FROM quotes q
JOIN quote_calculation_summaries qcs ON qcs.quote_id = q.id
WHERE q.organization_id = $1
ORDER BY q.created_at DESC;
```

---

## 9. RLS Policies

All tables have Row-Level Security enabled:

```sql
-- Example: Users can only see quotes in their organization
CREATE POLICY "Users can view quotes in their organization"
  ON quotes FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));
```

---

**Last Updated:** 2025-12-13
**Related Files:**
- `backend/migrations/007_quotes_calculation_schema.sql`
- `backend/migrations/022_quote_calculation_summaries.sql`
- `backend/migrations/037_dual_currency_storage.sql`
