# Database Column Naming Conventions

**Last Updated:** 2025-10-29 (Session 27)

**Purpose:** Standardized naming conventions for PostgreSQL columns to ensure consistency, readability, and security across the entire B2B Quotation Platform.

---

## Core Naming Rules

### 1. Case Convention

**Rule:** Always use `snake_case` for column names, NOT `camelCase` or `PascalCase`.

```sql
-- ✅ CORRECT
customer_id         -- Foreign key
created_at          -- Timestamp
is_active           -- Boolean
total_amount        -- Money amount

-- ❌ WRONG
customerId          -- Forbidden: camelCase
CustomerID          -- Forbidden: PascalCase
customer-id         -- Forbidden: kebab-case
CUSTOMER_ID         -- Forbidden: all uppercase
```

**Why:** PostgreSQL treats unquoted identifiers as lowercase. Using `snake_case` maintains consistency with both database and TypeScript camelCase translation in the ORM layer.

---

## 2. Boolean Column Naming

**Rule:** Use `is_*` or `has_*` prefix for boolean columns. Always represent state/condition, not action.

### Standard Boolean Names

```sql
-- State/Condition (preferred: is_*)
is_active           -- Currently active (Boolean)
is_deleted          -- Soft deleted (Boolean)
is_default          -- Default choice (Boolean)
is_primary          -- Primary choice (Boolean)
is_owner            -- Is the organization owner (Boolean)
is_system_role      -- System-defined role (Boolean)

-- Relationship/Has (has_* prefix)
has_permission      -- Has a specific permission (Boolean)

-- ❌ Avoid these patterns
active              -- Ambiguous: active what?
status              -- Use explicit: status='active' with CHECK
deleted             -- Too vague
```

**Real Examples from Codebase:**

```sql
-- From organization_members table
is_owner            -- Is this member the organization owner
is_system_role      -- Is this role system-defined (not custom)
is_default          -- Is this the default role for new members

-- From customer_contacts table
is_primary          -- Is this the primary contact for the customer

-- From variable_templates table
is_default          -- Is this the default template to use
```

---

## 3. Timestamp Column Naming

**Rule:** Always use `_at` suffix for timestamp columns. Include timezone info (TIMESTAMPTZ).

### Standard Timestamp Names

```sql
-- Always use TIMESTAMPTZ (with timezone)
created_at          -- Record creation timestamp
updated_at          -- Last update timestamp
deleted_at          -- Soft delete timestamp
approved_at         -- Approval timestamp
expired_at          -- Expiration timestamp
accepted_at         -- Acceptance timestamp
joined_at           -- Join timestamp
expires_at          -- Expiration timestamp
invited_at          -- Invitation timestamp

-- ❌ Avoid these patterns
created_date        -- Use created_at instead
updated_date        -- Use updated_at instead
created             -- Too vague
modified            -- Use updated_at
date_created        -- Wrong order
```

**Triggers:** All `updated_at` columns have automatic update triggers:

```sql
-- Trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to table
CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Real Examples from Codebase:**

```sql
-- From quotes table
created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
valid_until DATE  -- Regular date for validity deadline

-- From organization_members table
invited_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
joined_at TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())

-- From organization_invitations table
expires_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) + INTERVAL '7 days'
accepted_at TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
```

---

## 4. Foreign Key Column Naming

**Rule:** Use `<table_name>_id` format. For auth.users, use `user_id`. Maintain consistency across all tables.

### Standard Foreign Key Names

```sql
-- Reference to users (Supabase auth)
user_id             -- References auth.users(id)
created_by          -- User who created record
invited_by          -- User who sent invitation
approved_by         -- User who approved

-- Reference to core entities
customer_id         -- References customers(id)
quote_id            -- References quotes(id)
organization_id     -- References organizations(id)
template_id         -- References variable_templates(id)
role_id             -- References roles(id)
contact_id          -- References customer_contacts(id)
item_id             -- References quote_items(id)

-- Multi-reference tables (explicit naming)
from_user_id        -- When ambiguous which user
to_user_id          -- When ambiguous which user

-- ❌ Avoid these patterns
cust_id             -- Too abbreviated
quote               -- Missing _id suffix
quoteId             -- camelCase forbidden
quote_fk            -- Don't add _fk suffix
```

**Cascade Rules:**

```sql
-- Default: CASCADE (delete related records)
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE

-- Special cases: RESTRICT (prevent deletion if referenced)
FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT

-- Defensive: SET NULL (allow deletion, nullify foreign key)
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
```

**Real Examples from Codebase:**

```sql
-- From quotes table
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT
created_by UUID NOT NULL REFERENCES auth.users(id)

-- From organization_members table
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT
invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL

-- From quote_items table
quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE

-- From customer_contacts table
customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
```

---

## 5. Money/Amount Column Naming

**Rule:** Use `_amount`, `_price`, or `_cost` suffix. Always use DECIMAL(15,2) for precision, never float.

### Standard Money Column Names

```sql
-- Standard amount columns
total_amount        -- Total amount (DECIMAL 15,2)
subtotal            -- Subtotal before taxes/fees (DECIMAL 15,2)
discount_amount     -- Discount amount (DECIMAL 15,2)
tax_amount          -- Tax/VAT amount (DECIMAL 15,2)

-- Price variants
base_price_vat      -- Base price including VAT
unit_price          -- Unit price for single item
list_price          -- Published list price
supplier_payment    -- Payment to supplier
client_advance      -- Advance from client

-- Cost variants
shipping_cost       -- Shipping/logistics cost
insurance_cost      -- Insurance cost
markup_amount       -- Markup in absolute amount

-- Currency-specific
amount_usd          -- If storing multiple currencies
amount_eur          -- Amount in specific currency
amount_rub          -- Amount in specific currency
```

**Type Definition:**

```sql
-- Always use this for money
DECIMAL(15, 2)      -- 15 digits total, 2 after decimal (999,999,999,999.99)

-- ❌ Never use for money
FLOAT               -- Precision errors! 1.1 + 2.2 != 3.3
NUMERIC             -- Too generic; prefer DECIMAL
BIGINT              -- Only for cents if absolutely necessary

-- For percentages (different from money)
DECIMAL(5, 2)       -- 999.99% max
DECIMAL(3, 2)       -- 9.99% max (most common)
```

**Real Examples from Codebase:**

```sql
-- From quotes table
subtotal DECIMAL(15,2) NOT NULL DEFAULT 0
discount_percentage DECIMAL(5,2) DEFAULT 0
discount_amount DECIMAL(15,2) DEFAULT 0
tax_rate DECIMAL(5,2) DEFAULT 20
tax_amount DECIMAL(15,2) DEFAULT 0
total_amount DECIMAL(15,2) NOT NULL DEFAULT 0

-- From quote_items table
base_price_vat DECIMAL(15,2) NOT NULL
weight_in_kg DECIMAL(10,2) DEFAULT 0 CHECK (weight_in_kg >= 0)
```

---

## 6. Status/Enum Column Naming

**Rule:** Use singular `status` for main status. Use explicit enum values with CHECK constraint.

### Standard Status Names

```sql
-- Main status field
status              -- Current status (VARCHAR with CHECK constraint)

-- Specific status fields
member_status       -- Member status (when ambiguous)
invitation_status   -- Invitation status
payment_status      -- Payment status

-- ❌ Avoid these patterns
state               -- Use status instead
status_type         -- Too generic
currentStatus       -- camelCase forbidden
```

**Enum Values (use CHECK constraint):**

```sql
-- Quotes status
status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'revision_needed')
)

-- Organization status
status VARCHAR(20) DEFAULT 'active' CHECK (
    status IN ('active', 'trial', 'suspended', 'deleted')
)

-- Member status
status VARCHAR(20) DEFAULT 'active' CHECK (
    status IN ('active', 'invited', 'suspended', 'left')
)

-- Invitation status
status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'expired', 'cancelled')
)

-- Setting type (special naming for composite keys)
setting_type TEXT NOT NULL CHECK (
    setting_type IN ('user_default', 'client_specific')
)
```

**Real Examples from Codebase:**

```sql
-- From quotes table
status TEXT NOT NULL DEFAULT 'draft'
CONSTRAINT valid_status CHECK (
    status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'revision_needed')
)

-- From organization_members table
status VARCHAR(20) DEFAULT 'active' CHECK (
    status IN ('active', 'invited', 'suspended', 'left')
)
```

---

## 7. Identifier Column Naming

**Rule:** Use `id` for primary keys (UUID). Use `_id` for foreign keys and references.

### Standard Identifier Names

```sql
-- Primary key (always UUID)
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()

-- Generate slug for URLs
slug VARCHAR(100) UNIQUE NOT NULL
  -- For organizations: url-friendly identifier
  -- For roles: system identifier (lowercase, underscores)

-- Token fields
token VARCHAR(100) UNIQUE NOT NULL
quote_number TEXT NOT NULL UNIQUE
  -- Human-readable identifier, not UUID

-- ❌ Avoid these patterns
quote_id for quote reference in same table  -- Use id
primary_key                -- Just use id
object_id                  -- Use id
```

**Real Examples from Codebase:**

```sql
-- From organizations table
id UUID DEFAULT gen_random_uuid() PRIMARY KEY
slug VARCHAR(100) UNIQUE NOT NULL

-- From quotes table
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
quote_number TEXT NOT NULL UNIQUE

-- From organization_invitations table
id UUID DEFAULT gen_random_uuid() PRIMARY KEY
token VARCHAR(100) UNIQUE NOT NULL
```

---

## 8. Multi-Tenant Isolation Column

**Rule:** EVERY table must have `organization_id` for RLS enforcement. No exceptions.

```sql
-- Always include in every user-accessible table
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE

-- Create index for performance
CREATE INDEX idx_table_name_org ON table_name(organization_id);

-- Include in RLS policies
WHERE organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND status = 'active'
)
```

**Exception:** Core system tables that are organization-independent:
- `auth.users` (Supabase managed)
- `organizations` (parent table)
- `roles` (system roles have NULL organization_id)

**Real Examples from Codebase:**

```sql
-- From customer_contacts table
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
CREATE INDEX idx_customer_contacts_org ON customer_contacts(organization_id);

-- From quotes table
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
CREATE INDEX idx_quotes_organization ON quotes(organization_id);
```

---

## 9. Specialized Column Naming

### Metadata/Configuration

```sql
-- JSONB fields (for flexible data)
variables JSONB NOT NULL      -- From template/variables
permissions JSONB DEFAULT '{}'::jsonb
settings JSONB DEFAULT '{}'::jsonb
preferences JSONB DEFAULT '{}'::jsonb
phase_results JSONB NOT NULL   -- Complex calculation results
visible_columns JSONB NOT NULL -- Array of column identifiers

-- Text fields
description TEXT               -- Longer text
notes TEXT                     -- Additional notes
message TEXT                   -- Message content
title TEXT                     -- Main title/name
bio TEXT                       -- Biography/about

-- Simple text
name VARCHAR(255)              -- Person name
phone VARCHAR(50)              -- Phone number
email VARCHAR(255)             -- Email address
position TEXT                  -- Job position/title
```

### Numeric Non-Money

```sql
quantity INTEGER NOT NULL CHECK (quantity > 0)
position INTEGER NOT NULL DEFAULT 0  -- Order/sequence
weight_in_kg DECIMAL(10,2)    -- Weight (not money)
rate DECIMAL(3,2)              -- Percentage rate
percentage DECIMAL(5,2)        -- Percentage value
```

---

## 10. Inconsistencies & Exceptions (Documented)

**Current codebase has these acceptable exceptions:**

| Column | Table | Reason | Status |
|--------|-------|--------|--------|
| `created_at` | All | Standard timestamp | Standard ✅ |
| `updated_at` | All | Auto-update trigger | Standard ✅ |
| `deleted_at` | All | Soft delete (with trigger) | Standard ✅ |
| `status` | Multiple | Explicit enum, not field | Standard ✅ |
| `id` | All | Primary key | Standard ✅ |
| `organization_id` | All | Tenant isolation | Standard ✅ |
| `slug` | organizations, roles | URL-friendly identifier | Standard ✅ |
| `token` | organization_invitations | Unique invitation token | Acceptable |
| `quote_number` | quotes | Human-readable number | Acceptable |
| `setting_type` | quote_export_settings | Composite key value | Acceptable |
| `phase_results` | quote_calculation_results | Nested calculation data | Acceptable |
| `variables` | quote_calculation_variables, variable_templates | Flexible variable storage | Acceptable |

---

## Index Naming Conventions

**Rule:** Use `idx_<table>_<column>` or `idx_<table>_<columns>` for indexes.

```sql
-- Single column index
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_organization_members_status ON organization_members(status);

-- Multi-column index (compound)
CREATE INDEX idx_quote_items_position ON quote_items(quote_id, position);

-- Partial index (filtered)
CREATE INDEX idx_templates_default ON variable_templates(organization_id, is_default)
WHERE is_default = true;

-- GIN index (for JSONB)
CREATE INDEX idx_calc_vars_variables ON quote_calculation_variables USING GIN (variables);
```

---

## Constraint Naming Conventions

**Rule:** Use `<table>_<condition>` for check constraints.

```sql
-- CHECK constraints
CONSTRAINT valid_status CHECK (status IN ('draft', 'sent', 'accepted', ...))
CONSTRAINT positive_quantity CHECK (quantity > 0)
CONSTRAINT non_negative_weight CHECK (weight_in_kg >= 0)
CONSTRAINT owner_must_be_active CHECK (NOT (is_owner = true AND status != 'active'))

-- UNIQUE constraints
UNIQUE(organization_id, user_id)  -- User can only be in org once
UNIQUE(organization_id, slug)     -- Slug unique per org
UNIQUE(organization_id, name)     -- Template name unique per org

-- UNIQUE PARTIAL (conditional unique)
CREATE UNIQUE INDEX idx_invitations_unique_pending
ON organization_invitations(organization_id, email)
WHERE status = 'pending';  -- Only one pending invite per email per org
```

---

## RLS Policy Naming

**Rule:** Use descriptive names that indicate what action and who can perform it.

```sql
-- Policy name format: "<subject> can <action> <object>"
CREATE POLICY "Users can view their organization"
CREATE POLICY "Admins can update members"
CREATE POLICY "Members can create quotes"
CREATE POLICY "Owners can delete organizations"
```

---

## Common Column Patterns by Table Type

### User-Related Tables

```sql
user_id UUID NOT NULL REFERENCES auth.users(id)
email VARCHAR(255)
full_name VARCHAR(255)
phone VARCHAR(50)
avatar_url TEXT
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Organization-Related Tables

```sql
organization_id UUID NOT NULL REFERENCES organizations(id)
name VARCHAR(255) NOT NULL
slug VARCHAR(100) UNIQUE
description TEXT
status VARCHAR(20) DEFAULT 'active'
is_default BOOLEAN DEFAULT false
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Business Entity Tables

```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
organization_id UUID NOT NULL
status VARCHAR(20)
created_by UUID REFERENCES auth.users(id)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
deleted_at TIMESTAMPTZ  -- Optional for soft delete
```

---

## Validation Checklist

When creating new columns, verify:

- [ ] **Case:** `snake_case` only (no camelCase or PascalCase)
- [ ] **Booleans:** Start with `is_` or `has_` (never just `active`)
- [ ] **Timestamps:** Use `_at` suffix and `TIMESTAMPTZ` type
- [ ] **Foreign Keys:** Follow `<table>_id` pattern
- [ ] **Money:** Use `DECIMAL(15,2)`, never `FLOAT`
- [ ] **Status:** Enum with `CHECK` constraint, not separate column
- [ ] **Tenant:** Include `organization_id` for RLS
- [ ] **Indexes:** Named as `idx_<table>_<column>`
- [ ] **Constraints:** Named and documented
- [ ] **RLS:** Documented in comment block

---

## Quick Reference Table

| Type | Format | Example | Type |
|------|--------|---------|------|
| Primary Key | `id` | `id UUID PRIMARY KEY` | UUID |
| Foreign Key | `<table>_id` | `customer_id` | UUID |
| Boolean | `is_<state>` | `is_active` | BOOLEAN |
| Boolean | `has_<property>` | `has_permission` | BOOLEAN |
| Timestamp | `<action>_at` | `created_at` | TIMESTAMPTZ |
| Money | `<noun>_amount` | `total_amount` | DECIMAL(15,2) |
| Price | `<noun>_price` | `base_price_vat` | DECIMAL(15,2) |
| Percentage | `<noun>_percentage` | `discount_percentage` | DECIMAL(5,2) |
| Text | `description` | `description` | TEXT |
| Name | `name` | `customer_name` | VARCHAR(255) |
| Contact | `email`, `phone` | `customer_email` | VARCHAR(255) |
| Status | `status` | `status` | VARCHAR(20) |
| Count/Position | `<noun>` | `quantity`, `position` | INTEGER |
| Unique ID | `<noun>_number` | `quote_number` | TEXT |
| Slug | `slug` | `organization_slug` | VARCHAR(100) |

---

**Version:** 1.0 | **Updated:** 2025-10-29 | **Status:** Production Ready
