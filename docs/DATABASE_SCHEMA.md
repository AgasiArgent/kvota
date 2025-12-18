# Database Schema - Kvota B2B Platform

**Last Updated:** 2025-12-11 (migration 035 applied)
**Database:** PostgreSQL 15 (Supabase)
**Total Tables:** 83 (41 business + 42 n8n/system)

---

## Overview

Multi-tenant B2B quotation platform for cross-border trade (import/export).

**Key Concepts:**
- **Multi-tenant:** All business data isolated by `organization_id`
- **RLS Security:** Row-Level Security policies on all business tables
- **Soft Delete:** Most tables use `deleted_at` instead of hard delete
- **Audit Trail:** `created_at`, `updated_at`, `created_by` on key tables

---

## Table Categories

| Category | Tables | Description |
|----------|--------|-------------|
| **Core** | 6 | Organizations, users, roles |
| **Quotes** | 12 | Commercial proposals, calculations, workflow |
| **CRM** | 6 | Customers, leads, contacts, activities |
| **Analytics** | 4 | Reports, executions, schedules |
| **Reference** | 3 | Exchange rates, supplier countries |
| **Plan-Fact** | 5 | Actuals tracking |
| **n8n/System** | 42+ | Workflow automation (not documented here) |

---

## Core Tables

### organizations

**Purpose:** Companies using the platform (multi-tenant root entity)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| name | VARCHAR(255) | NO | - | Company name |
| slug | VARCHAR(100) | NO | - | URL-friendly identifier (unique) |
| description | TEXT | YES | - | Company description |
| logo_url | TEXT | YES | - | Logo image URL |
| status | VARCHAR(20) | YES | 'active' | active, suspended, deleted |
| settings | JSONB | YES | '{}' | Organization settings |
| subscription_tier | VARCHAR(50) | YES | 'free' | Subscription plan |
| subscription_expires_at | TIMESTAMPTZ | YES | - | Subscription expiry |
| owner_id | UUID | YES | - | Owner user ID |
| inn | TEXT | YES | - | Tax ID (Russia) |
| ceo_name | TEXT | YES | - | CEO name for documents |
| ceo_title | TEXT | YES | 'Генеральный директор' | CEO title |
| ceo_signature_url | TEXT | YES | - | Signature image URL |
| letter_template | TEXT | YES | - | Document template |
| base_currency | VARCHAR(3) | YES | 'RUB' | Default currency |
| financial_manager_id | UUID | YES | - | Financial manager user ID |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Indexes:**
- `organizations_pkey` (id) - Primary key
- `organizations_slug_key` (slug) - Unique slug
- `idx_organizations_owner` (owner_id)
- `idx_organizations_status` (status)
- `idx_organizations_financial_manager` (financial_manager_id)

**RLS Policies:** ✅ Full CRUD
- SELECT: Users see orgs where they are members
- INSERT: Any authenticated user
- UPDATE: Admins/owners only
- DELETE: Owners only

---

### organization_members

**Purpose:** Maps users to organizations with roles

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| user_id | UUID | NO | - | FK → auth.users.id |
| role_id | UUID | NO | - | FK → roles.id |
| status | VARCHAR(20) | YES | 'active' | active, inactive, suspended |
| is_owner | BOOLEAN | YES | false | Is organization owner |
| joined_at | TIMESTAMPTZ | YES | now() | Join timestamp |
| invited_by | UUID | YES | - | Inviter user ID |

**Indexes:**
- `organization_members_pkey` (id)
- `organization_members_organization_id_user_id_key` - Unique (org_id, user_id)
- `idx_org_members_org_id` (organization_id)
- `idx_org_members_user_id` (user_id)
- `idx_org_members_role_id` (role_id)
- `idx_org_members_status` (status)
- `idx_org_members_is_owner` (is_owner)

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)
- role_id → roles.id (ON DELETE RESTRICT)

**RLS Policies:** ✅ Full CRUD (SELECT fixed in migration 035)
- SELECT: Users see all members of their organizations
- INSERT: Owners only
- UPDATE: Owners only
- DELETE: Owners only

---

### user_profiles

**Purpose:** Extended user profile data (manager info for exports)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| user_id | UUID | NO | - | PK, FK → auth.users.id |
| manager_name | TEXT | YES | - | Display name for documents |
| manager_phone | TEXT | YES | - | Phone for documents |
| manager_email | TEXT | YES | - | Email for documents |
| last_active_organization_id | UUID | YES | - | Last accessed org |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Indexes:**
- `user_profiles_pkey` (user_id)
- `idx_user_profiles_last_active_org` (last_active_organization_id)

**Foreign Keys:**
- last_active_organization_id → organizations.id (ON DELETE SET NULL)

**RLS Policies:** ✅ Full (added in migration 035)
- ALL: Users can only access their own profile (user_id = auth.uid())

---

### roles

**Purpose:** Role definitions (member, manager, admin, owner, etc.)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | YES | - | NULL for global roles |
| name | VARCHAR(100) | NO | - | Display name |
| slug | VARCHAR(50) | NO | - | Code (member, admin, etc.) |
| description | TEXT | YES | - | Role description |
| permissions | JSONB | YES | '{}' | Permission flags |
| is_system | BOOLEAN | YES | false | System role (can't delete) |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |

**Standard Roles:**
- `member` - Basic access
- `manager` - Team management
- `admin` - Organization admin
- `owner` - Full control
- `financial_admin` - Financial settings access

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)

---

## Quote Tables

### quotes

**Purpose:** Commercial proposals (main business entity)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| customer_id | UUID | NO | - | FK → customers.id |
| quote_number | TEXT | NO | - | e.g., "КП25-0001" |
| title | TEXT | NO | - | Quote title |
| description | TEXT | YES | - | Quote description |
| status | TEXT | NO | 'draft' | draft, sent, accepted, rejected |
| workflow_state | TEXT | NO | 'draft' | Workflow state machine |
| currency | TEXT | NO | 'USD' | Quote currency |
| valid_until | DATE | YES | - | Expiry date |
| subtotal | NUMERIC | NO | 0 | Sum before tax |
| tax_rate | NUMERIC | YES | 20 | VAT rate % |
| tax_amount | NUMERIC | YES | 0 | Tax amount |
| total_amount | NUMERIC | NO | 0 | Total with tax |
| total_usd | NUMERIC | YES | - | Total in USD |
| total_quote_currency | NUMERIC | YES | - | Total in quote currency |
| total_profit_usd | NUMERIC | YES | 0 | Profit in USD |
| created_by | UUID | NO | - | Creator user ID |
| created_by_user_id | UUID | YES | - | Creator (duplicate?) |
| contact_id | UUID | YES | - | FK → customer_contacts.id |
| manager_name | TEXT | YES | - | Manager name snapshot |
| manager_phone | TEXT | YES | - | Manager phone snapshot |
| manager_email | TEXT | YES | - | Manager email snapshot |
| logistics_complete | BOOLEAN | YES | false | Logistics role done |
| customs_complete | BOOLEAN | YES | false | Customs role done |
| current_assignee_role | TEXT | YES | - | Current workflow role |
| current_version | INTEGER | YES | 1 | Version number |
| current_version_id | UUID | YES | - | FK → quote_versions.id |
| accepted_version_id | UUID | YES | - | Accepted version |
| version_count | INTEGER | NO | 0 | Total versions |
| exchange_rate_source | TEXT | YES | 'cbr' | cbr or manual |
| exchange_rate_timestamp | TIMESTAMPTZ | YES | - | Rate snapshot time |
| usd_to_quote_rate | NUMERIC | YES | - | Exchange rate snapshot |
| deleted_at | TIMESTAMPTZ | YES | - | Soft delete timestamp |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Indexes:**
- `quotes_pkey` (id)
- `quotes_unique_number_per_org` (organization_id, quote_number) - Unique
- `idx_quotes_organization` (organization_id)
- `idx_quotes_customer` (customer_id)
- `idx_quotes_status` (status)
- `idx_quotes_workflow_state` (workflow_state)
- `idx_quotes_created_by` (created_by)
- `idx_quotes_created_at` (created_at DESC)
- `idx_quotes_deleted_at` (deleted_at)
- `idx_quotes_org_status_time` (organization_id, status, created_at)

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)
- customer_id → customers.id (ON DELETE RESTRICT)
- contact_id → customer_contacts.id (ON DELETE NO ACTION)
- current_version_id → quote_versions.id (ON DELETE NO ACTION)
- accepted_version_id → quote_versions.id (ON DELETE NO ACTION)

**RLS Policies:** ✅ Full CRUD by organization_id

---

### quote_items

**Purpose:** Products/line items in a quote

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| quote_id | UUID | NO | - | FK → quotes.id |
| sku | TEXT | YES | - | Product SKU |
| brand | TEXT | YES | - | Brand name |
| name | TEXT | NO | - | Product name |
| description | TEXT | YES | - | Product description |
| quantity | INTEGER | NO | 1 | Quantity |
| unit_price | NUMERIC | NO | 0 | Price per unit |
| total_price | NUMERIC | NO | 0 | Line total |
| hs_code | TEXT | YES | - | Harmonized System code |
| weight_kg | NUMERIC | YES | - | Weight in kg |
| ... | ... | ... | ... | (42 calculation variables) |

**Foreign Keys:**
- quote_id → quotes.id (ON DELETE CASCADE)

**RLS Policies:** ✅ Via parent quote

---

### quote_versions

**Purpose:** Immutable snapshots of quotes for audit trail

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| quote_id | UUID | NO | - | FK → quotes.id |
| version_number | INTEGER | NO | - | Version sequence |
| snapshot_data | JSONB | NO | - | Full quote state |
| exchange_rates_snapshot | JSONB | YES | - | Rates at calculation |
| created_by | UUID | NO | - | Creator user ID |
| created_at | TIMESTAMPTZ | NO | now() | Created timestamp |

**Foreign Keys:**
- quote_id → quotes.id (ON DELETE CASCADE)
- customer_id → customers.id (ON DELETE NO ACTION)

**RLS Policies:** ✅ Via parent quote

---

### quote_calculation_variables

**Purpose:** 42 calculation variables per quote

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| quote_id | UUID | NO | - | FK → quotes.id |
| template_id | UUID | YES | - | FK → variable_templates.id |
| variables | JSONB | NO | '{}' | All 42 variables as JSON |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Foreign Keys:**
- quote_id → quotes.id (ON DELETE CASCADE)
- template_id → variable_templates.id (ON DELETE SET NULL)

**RLS Policies:** ✅ Via parent quote

---

### variable_templates

**Purpose:** Reusable calculation variable templates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| name | TEXT | NO | - | Template name |
| description | TEXT | YES | - | Template description |
| variables | JSONB | NO | '{}' | Variable values |
| is_default | BOOLEAN | YES | false | Default for new quotes |
| created_by | UUID | YES | - | Creator user ID |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)

**RLS Policies:** ✅ By organization_id

---

### calculation_settings

**Purpose:** Admin-only calculation variables (org-wide)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| rate_forex_risk | NUMERIC | YES | 2.0 | Forex risk % |
| rate_fin_comm | NUMERIC | YES | 1.5 | Financial commission % |
| rate_loan_interest_daily | NUMERIC | YES | 0.05 | Daily loan rate % |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)

**RLS Policies:** ✅
- SELECT: All org members
- INSERT/UPDATE: Admins, financial_admin, owners only

---

## CRM Tables

### customers

**Purpose:** Client companies

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| name | VARCHAR | NO | - | Company name |
| email | VARCHAR | YES | - | Contact email |
| phone | VARCHAR | YES | - | Contact phone |
| address | TEXT | YES | - | Address |
| city | VARCHAR | YES | - | City |
| region | VARCHAR | YES | - | Region/state |
| country | VARCHAR | YES | 'Russia' | Country |
| postal_code | VARCHAR | YES | - | Postal code |
| inn | VARCHAR | YES | - | Tax ID |
| kpp | VARCHAR | YES | - | Tax registration code |
| ogrn | VARCHAR | YES | - | Company registration |
| company_type | VARCHAR | YES | 'organization' | Type |
| industry | VARCHAR | YES | - | Industry |
| credit_limit | NUMERIC | YES | 0 | Credit limit |
| payment_terms | INTEGER | YES | 30 | Payment terms (days) |
| status | VARCHAR | YES | 'active' | Status |
| notes | TEXT | YES | - | Notes |
| qualified_from_lead_id | UUID | YES | - | FK → leads.id |
| created_by | UUID | YES | - | Creator user ID |
| created_at | TIMESTAMPTZ | NO | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | NO | now() | Updated timestamp |

**Indexes:**
- `customers_pkey` (id)
- `idx_customers_organization_id` (organization_id)
- `idx_customers_name` (name)
- `idx_customers_inn` (inn) WHERE inn IS NOT NULL
- `idx_customers_org_inn` (organization_id, inn) - Unique
- `idx_customers_status` (status)
- `idx_customers_qualified_from` (qualified_from_lead_id)

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)
- qualified_from_lead_id → leads.id (ON DELETE NO ACTION)

**RLS Policies:** ✅ Full CRUD by organization_id

---

### customer_contacts

**Purpose:** Contact persons at customer companies

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| customer_id | UUID | NO | - | FK → customers.id |
| name | VARCHAR | NO | - | Contact name |
| position | VARCHAR | YES | - | Job title |
| email | VARCHAR | YES | - | Email |
| phone | VARCHAR | YES | - | Phone |
| is_primary | BOOLEAN | YES | false | Primary contact |
| notes | TEXT | YES | - | Notes |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)
- customer_id → customers.id (ON DELETE CASCADE)

**RLS Policies:** ✅ Full CRUD by organization_id

---

### leads

**Purpose:** Sales leads/prospects

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| stage_id | UUID | YES | - | FK → lead_stages.id |
| name | VARCHAR | NO | - | Lead/company name |
| email | VARCHAR | YES | - | Email |
| phone | VARCHAR | YES | - | Phone |
| source | VARCHAR | YES | - | Lead source |
| assigned_to | UUID | YES | - | Assigned user ID |
| status | VARCHAR | YES | 'new' | Status |
| notes | TEXT | YES | - | Notes |
| created_by | UUID | YES | - | Creator user ID |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |
| updated_at | TIMESTAMPTZ | YES | now() | Updated timestamp |

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)
- stage_id → lead_stages.id (ON DELETE NO ACTION)

**RLS Policies:** ✅
- SELECT: Assigned leads or unassigned
- UPDATE: Assigned leads only
- DELETE: Managers/admins only

---

### lead_stages

**Purpose:** Pipeline stages for leads

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| name | VARCHAR | NO | - | Stage name |
| color | VARCHAR | YES | - | Display color |
| position | INTEGER | NO | 0 | Sort order |
| is_final | BOOLEAN | YES | false | Final stage (won/lost) |
| created_at | TIMESTAMPTZ | YES | now() | Created timestamp |

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)

**RLS Policies:** ✅
- SELECT: All org members
- INSERT/UPDATE/DELETE: Managers/admins only

---

### activity_logs

**Purpose:** Audit trail of all actions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| organization_id | UUID | NO | - | FK → organizations.id |
| user_id | UUID | YES | - | Actor user ID |
| action | VARCHAR | NO | - | Action type |
| entity_type | VARCHAR | NO | - | Entity type |
| entity_id | UUID | YES | - | Entity ID |
| details | JSONB | YES | '{}' | Action details |
| ip_address | VARCHAR | YES | - | Client IP |
| user_agent | TEXT | YES | - | Browser info |
| created_at | TIMESTAMPTZ | NO | now() | Created timestamp |

**Foreign Keys:**
- organization_id → organizations.id (ON DELETE CASCADE)

**RLS Policies:** ✅
- SELECT: Org members (read only)
- INSERT: Service role only (via backend)
- UPDATE/DELETE: Blocked (immutable)

---

## Reference Tables

### exchange_rates

**Purpose:** Currency exchange rates from CBR

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | - | Primary key |
| currency_code | VARCHAR(3) | NO | - | Currency code (USD, EUR) |
| rate_to_rub | NUMERIC | NO | - | Rate to RUB |
| cbr_date | DATE | NO | - | CBR publication date |
| fetched_at | TIMESTAMPTZ | NO | now() | Fetch timestamp |

**RLS Policies:** ✅
- SELECT: Public (anyone can read)
- INSERT/UPDATE/DELETE: Service role only

---

### supplier_countries

**Purpose:** Reference data for supplier countries

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| code | VARCHAR | NO | - | PK, country code |
| name_ru | VARCHAR | NO | - | Russian name |
| vat_rate | NUMERIC | YES | - | VAT rate % |
| internal_markup_ru | NUMERIC | YES | - | Markup for Russia route |
| internal_markup_tr | NUMERIC | YES | - | Markup for Turkey route |

**RLS Policies:** ✅ Public read (added in migration 035)
- SELECT: Anyone can read (public reference data)

---

## RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| organizations | ✅ members | ✅ any | ✅ admins | ✅ owners | Full |
| organization_members | ✅ org members | ✅ owners | ✅ owners | ✅ owners | Full (fixed 035) |
| user_profiles | ✅ own | ✅ own | ✅ own | ✅ own | Full (added 035) |
| roles | ✅ | ✅ | ✅ | ✅ | Full |
| quotes | ✅ org | ✅ org | ✅ org | ✅ org | Full |
| quote_items | ✅ via quote | ✅ | ✅ | ✅ | Via parent |
| customers | ✅ org | ✅ org | ✅ org | ✅ org | Full |
| customer_contacts | ✅ org | ✅ org | ✅ org | ✅ org | Full |
| leads | ✅ assigned | ✅ any | ✅ assigned | ✅ managers | Partial |
| lead_stages | ✅ org | ✅ managers | ✅ managers | ✅ managers | Role-based |
| activity_logs | ✅ org | ✅ service | ❌ blocked | ❌ blocked | Immutable |
| calculation_settings | ✅ org | ✅ admins | ✅ admins | - | Admin-only write |
| exchange_rates | ✅ public | ✅ service | ✅ service | ✅ service | Public read |
| supplier_countries | ✅ public | - | - | - | Read-only (added 035) |

---

## Common Patterns

### Multi-tenant Filter
All business tables use this pattern:
```sql
WHERE organization_id IN (
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND status = 'active'
)
```

### Soft Delete
Most tables use `deleted_at` column:
```sql
-- Active records
WHERE deleted_at IS NULL

-- Trash bin
WHERE deleted_at IS NOT NULL
```

### Audit Columns
Standard columns on most tables:
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `created_by` - Creator user ID

### Role Check in RLS
Admin-only operations:
```sql
WHERE organization_id IN (
  SELECT om.organization_id FROM organization_members om
  JOIN roles r ON r.id = om.role_id
  WHERE om.user_id = auth.uid()
  AND (om.is_owner = true OR r.slug IN ('admin', 'financial_admin'))
)
```

---

## Migration History

See `backend/migrations/MIGRATIONS.md` for full history.

**Recent migrations:**
- 035: Fix missing RLS policies (user_profiles, supplier_countries, organization_members)
- 034: Multi-currency support, quote_versions
- 031: CRM system (leads, stages, activities)
- 023: Quote workflow system
- 016: Activity logs, analytics

---

## Known Issues

1. ~~**user_profiles missing RLS**~~ - Fixed in migration 035
2. ~~**supplier_countries missing RLS**~~ - Fixed in migration 035
3. **Duplicate columns** - quotes has both `created_by` and `created_by_user_id`

---

## Diagram

```
organizations (root)
├── organization_members ──→ roles
├── customers
│   └── customer_contacts
├── quotes
│   ├── quote_items
│   ├── quote_versions
│   ├── quote_calculation_variables ──→ variable_templates
│   └── quote_calculation_results
├── leads ──→ lead_stages
│   └── lead_contacts
├── calculation_settings
├── activity_logs
└── saved_reports
    ├── report_executions
    └── scheduled_reports

exchange_rates (global)
supplier_countries (global)
```
