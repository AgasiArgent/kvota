# Database Schema Standards

**Last Updated:** 2025-10-29

This document defines the database schema standards used in the quotation platform. All new tables and migrations must follow these conventions for consistency, security, and performance.

---

## Core Naming Conventions

### Table Names
- **Format:** `snake_case`, plural noun
- **Examples:** `quotes`, `quote_items`, `customers`, `organization_members`, `activity_logs`
- **Pattern:** Use descriptive names that indicate data domain
- **Reserved naming:** Use standard table names (don't abbreviate)

### Column Names
- **Format:** `snake_case`, lowercase
- **Foreign keys:** `<table_singular>_id` (e.g., `customer_id`, `organization_id`, `user_id`)
- **Timestamps:** `created_at`, `updated_at` (ALWAYS INCLUDE)
- **Flags/booleans:** `is_*` prefix (e.g., `is_owner`, `is_default`, `is_system_role`)
- **Status columns:** `status` with CHECK constraint

### Examples

```sql
-- Customers table (correct naming)
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,      -- Foreign key convention
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,     -- Boolean naming
    status VARCHAR(50) DEFAULT 'active', -- Status column
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wrong naming (avoid)
-- user_name (use name)
-- org_id (use organization_id)
-- active (use is_active for booleans)
-- date_created (use created_at)
```

---

## Required Columns

Every table **MUST** include these columns:

### 1. Primary Key
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
-- OR
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```
- Use UUID for distributed systems
- Set default to auto-generate
- Never use serial integers for tenant-isolated data

### 2. Organization ID (Multi-Tenant)
```sql
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
```
- **REQUIRED** on all user-facing tables
- Links to `organizations` table
- Essential for Row Level Security (RLS)
- Indexed for filtering by tenant
- Exception: System tables (`organizations`, `roles`, `auth.users` reference tables)

### 3. Timestamps
```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
- **Both required** on all non-immutable tables
- Use `TIMESTAMPTZ` for timezone awareness
- `created_at` - immutable (set once at creation)
- `updated_at` - updated by trigger on every modification
- Always use `TIMEZONE('utc', NOW())` for consistency

### 4. Status (When Applicable)
```sql
status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'))
```
- Use for soft-delete patterns
- Include CHECK constraint with valid values
- Use for state tracking
- Examples: quotes (draft, sent, accepted, rejected), members (active, invited, suspended, left)

---

## Foreign Key Patterns

### Standard Foreign Key
```sql
-- Simple reference
customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE

-- When deletion should be prevented (important relationship)
role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT

-- Soft foreign key (nullable relationship)
invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL

-- Self-referential (parent-child)
parent_id UUID REFERENCES categories(id) ON DELETE CASCADE
```

### Deletion Strategies

| Strategy | Usage | Example |
|----------|-------|---------|
| `ON DELETE CASCADE` | Children become orphaned data (safe to delete) | `quote_id` in `quote_items` |
| `ON DELETE RESTRICT` | Prevent deletion if children exist | `organization_id` when org has members |
| `ON DELETE SET NULL` | Optional relationship, nullify on deletion | `invited_by` user can be deleted |
| `ON DELETE NO ACTION` | Similar to RESTRICT (checked at commit) | Use RESTRICT instead (clearer) |

### Unique Constraints on Foreign Keys
```sql
-- Multi-tenant unique constraint
UNIQUE(organization_id, name)

-- Composite uniqueness
UNIQUE(organization_id, email)

-- Partial unique (allow nulls, but unique when NOT NULL)
UNIQUE(organization_id, inn) WHERE inn IS NOT NULL
```

---

## Index Patterns

### Standard Indexes (REQUIRED)

1. **Organization ID** - Filter by tenant
```sql
CREATE INDEX idx_customers_organization_id ON customers(organization_id);
```

2. **Foreign Keys** - Join optimization
```sql
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_created_by ON quotes(created_by);
```

3. **Status** - Query by state
```sql
CREATE INDEX idx_quotes_status ON quotes(status);
```

4. **Created At DESC** - Most recent first
```sql
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
```

5. **Business Key** - Natural lookups
```sql
CREATE INDEX idx_quotes_number ON quotes(quote_number);
CREATE INDEX idx_customers_inn ON customers(inn) WHERE inn IS NOT NULL;
```

### Composite Indexes
```sql
-- For common multi-field queries
CREATE INDEX idx_order_items_order_position
  ON order_items(order_id, position);

-- Organization + status for filtering
CREATE INDEX idx_quotes_org_status
  ON quotes(organization_id, status);
```

### Partial Indexes
```sql
-- Only index non-null values to save space
CREATE INDEX idx_customers_inn ON customers(inn) WHERE inn IS NOT NULL;

-- Only active records
CREATE INDEX idx_templates_default
  ON variable_templates(organization_id, is_default)
  WHERE is_default = true;

-- Only pending invitations
CREATE UNIQUE INDEX idx_invitations_unique_pending
ON organization_invitations(organization_id, email)
WHERE status = 'pending';
```

### JSONB Indexes
```sql
-- For JSONB fields
CREATE INDEX idx_calc_results_phases
  ON quote_calculation_results USING GIN (phase_results);

-- For array searches in JSONB
CREATE INDEX idx_role_permissions
  ON roles USING GIN (permissions);
```

---

## Data Type Standards

### Numeric Types

| Type | Usage | Example | Why |
|------|-------|---------|-----|
| `DECIMAL(15,2)` | **MONEY ONLY** | prices, totals, exchange rates | Exact decimal representation, no float rounding |
| `INTEGER` | Counts, small numbers | quantity, days, position | Whole numbers only |
| `NUMERIC(precision, scale)` | High-precision calculations | financial FV calculations | Arbitrary precision needed |
| `FLOAT/DOUBLE` | ❌ **NEVER for money** | — | Rounding errors (0.1 + 0.2 ≠ 0.3) |

### Text Types

| Type | Usage | Example | Size |
|------|-------|---------|------|
| `TEXT` | Unlimited text | descriptions, notes, addresses | No limit |
| `VARCHAR(n)` | Fixed max length | names, emails, status | Up to n chars |
| `VARCHAR(255)` | Names/titles | customer names, organization names | 255 chars |
| `VARCHAR(100)` | Emails, URLs, identifiers | email, inn, kpp | 100 chars |
| `VARCHAR(50)` | Status/enum strings | status, role_slug | 50 chars |
| `CHAR(n)` | ❌ **AVOID** | — | Fixed-width (wastes space) |

### Date/Time Types

| Type | Usage | Timezone | Example |
|------|-------|----------|---------|
| `TIMESTAMPTZ` | **ALWAYS for timestamps** | ✅ Aware | `created_at TIMESTAMPTZ` |
| `TIMESTAMP` | ❌ **AVOID** | ✗ Naive (dangerous) | — |
| `DATE` | Date only, no time | N/A | `valid_until DATE` |
| `TIME` | Time only, no date | ✓ Optional | `delivery_time TIME` |

### Boolean/Enum Types

| Type | Usage | Example | Values |
|------|-------|---------|--------|
| `BOOLEAN` | True/false flags | `is_owner`, `is_default` | true/false |
| `VARCHAR(50) CHECK(...)` | Status/state | `status`, `subscription_tier` | Enumerated strings |
| `JSONB` | ❌ Use CHECK, not JSONB | — | Type safety lost |

### JSONB Usage

| Purpose | Type | Example | Why |
|---------|------|---------|-----|
| Flexible settings | `JSONB` | `organizations.settings` | Future-proof config |
| Array of permissions | `JSONB` | `roles.permissions` | Variable-length array |
| Calculation results | `JSONB` | `quote_calculation_results.phase_results` | Complex nested structure |
| Metadata | `JSONB` | `activity_logs.metadata` | Semi-structured audit data |

---

## Column Constraints

### NOT NULL
```sql
-- Required fields
name VARCHAR(255) NOT NULL
organization_id UUID NOT NULL

-- All timestamps are NOT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### DEFAULT Values
```sql
-- Sensible defaults
status VARCHAR(50) DEFAULT 'active'
is_owner BOOLEAN DEFAULT false
created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
created_by UUID NOT NULL DEFAULT auth.uid()
```

### CHECK Constraints
```sql
-- Validate domain values
status VARCHAR(50) DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')
),

-- Validate numeric ranges
quantity INTEGER CHECK (quantity > 0),
weight_in_kg DECIMAL(10,2) CHECK (weight_in_kg >= 0),
discount_percentage DECIMAL(5,2) CHECK (discount_percentage BETWEEN 0 AND 100),

-- Date validation
valid_until DATE CHECK (valid_until > CURRENT_DATE),

-- Logical constraints
CHECK (NOT (is_owner = true AND status != 'active'))  -- Owners must be active
```

### UNIQUE Constraints
```sql
-- Single column unique
quote_number TEXT NOT NULL UNIQUE,

-- Multi-column unique (with organization for multi-tenancy)
UNIQUE(organization_id, name),
UNIQUE(organization_id, email),

-- Partial unique (allow multiple NULLs)
UNIQUE(organization_id, inn) WHERE inn IS NOT NULL,

-- Allow multiple pending invitations per org, but only one per email
UNIQUE(organization_id, email) WHERE status = 'pending'
```

---

## RLS (Row Level Security) Standards

### Enable RLS on All User Tables
```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
```

### Organization-Based RLS Policy Template
```sql
-- Users can view records in their organization
CREATE POLICY "Users can view records"
  ON <table> FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Users can create records in their organization
CREATE POLICY "Users can create records"
  ON <table> FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Users can update their own records
CREATE POLICY "Users can update own records"
  ON <table> FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
    AND created_by = auth.uid()
  );

-- Users can only delete their own draft records
CREATE POLICY "Users can delete own draft records"
  ON <table> FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
    AND created_by = auth.uid()
    AND status = 'draft'
  );
```

### Immutable Tables RLS
```sql
-- For audit logs (no updates/deletes)
CREATE POLICY "No manual updates"
  ON activity_logs FOR UPDATE
  USING (false);

CREATE POLICY "No manual deletes"
  ON activity_logs FOR DELETE
  USING (false);

-- Service role can insert
CREATE POLICY "Service role can insert"
  ON activity_logs FOR INSERT
  WITH CHECK (true);
```

---

## Trigger Patterns

### Updated At Trigger (REQUIRED)
```sql
-- Create trigger function once
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to each table
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Auto-Generate Values
```sql
-- Auto-generate invitation tokens
CREATE OR REPLACE FUNCTION set_invitation_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.token IS NULL OR NEW.token = '' THEN
        NEW.token := encode(gen_random_bytes(32), 'base64');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_invitation_token ON organization_invitations;
CREATE TRIGGER auto_invitation_token
    BEFORE INSERT ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION set_invitation_token();
```

### Cascading Updates (Event Sourcing)
```sql
-- Create user profile automatically when joining org
CREATE OR REPLACE FUNCTION create_user_profile_on_join()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id, last_active_organization_id)
    VALUES (NEW.user_id, NEW.organization_id)
    ON CONFLICT (user_id) DO UPDATE
    SET last_active_organization_id = NEW.organization_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_user_profile ON organization_members;
CREATE TRIGGER auto_create_user_profile
    AFTER INSERT ON organization_members
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION create_user_profile_on_join();
```

---

## Migration Template

Every migration must include:

```sql
-- ============================================================================
-- Migration: NNN_short_description
-- Description: What this migration adds or changes
-- Date: YYYY-MM-DD
-- ============================================================================

-- ============================================================================
-- 1. CREATE/ALTER TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS <table> (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Core columns
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),

    -- Timestamps (ALWAYS)
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_<table>_organization_id ON <table>(organization_id);
CREATE INDEX IF NOT EXISTS idx_<table>_status ON <table>(status);
CREATE INDEX IF NOT EXISTS idx_<table>_created_at ON <table>(created_at DESC);

-- ============================================================================
-- 3. ENABLE RLS AND CREATE POLICIES
-- ============================================================================

ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view records"
  ON <table> FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. CREATE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_<table>_updated_at ON <table>;
CREATE TRIGGER update_<table>_updated_at
    BEFORE UPDATE ON <table>
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. ADD COMMENTS (DOCUMENTATION)
-- ============================================================================

COMMENT ON TABLE <table> IS 'Purpose and context of this table';
COMMENT ON COLUMN <table>.id IS 'Primary key - auto-generated UUID';
COMMENT ON COLUMN <table>.organization_id IS 'Tenant isolation for multi-tenancy';
COMMENT ON COLUMN <table>.created_at IS 'Record creation timestamp (UTC)';
```

---

## Common Patterns

### Soft Delete Pattern
```sql
-- Don't actually delete, just mark as deleted
status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),

-- Query only active records
SELECT * FROM customers WHERE status = 'active';

-- Soft delete
UPDATE customers SET status = 'deleted' WHERE id = $1;
```

### Audit Trail Pattern
```sql
CREATE TABLE table_history (
    id BIGSERIAL PRIMARY KEY,
    original_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger to log changes
CREATE OR REPLACE FUNCTION table_history_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO table_history (original_id, action, new_data, changed_by)
        VALUES (NEW.id, 'INSERT', row_to_json(NEW), auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO table_history (original_id, action, old_data, new_data, changed_by)
        VALUES (OLD.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid());
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO table_history (original_id, action, old_data, changed_by)
        VALUES (OLD.id, 'DELETE', row_to_json(OLD), auth.uid());
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Polymorphic Relationships
```sql
-- Instead of separate tables, use entity_type + entity_id
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,  -- 'quote', 'customer', 'contact'
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query by entity type
SELECT * FROM audit_logs WHERE entity_type = 'quote' AND entity_id = $1;
```

---

## Validation Checklist for New Migrations

Before applying any migration:

- [ ] Table names are plural, snake_case
- [ ] Column names are lowercase, snake_case
- [ ] Foreign keys follow `<table>_id` pattern
- [ ] All tables have `id UUID PRIMARY KEY`
- [ ] All user tables have `organization_id`
- [ ] All tables have `created_at` and `updated_at`
- [ ] Timestamps use `TIMESTAMPTZ` with UTC timezone
- [ ] Foreign keys specify `ON DELETE` action
- [ ] `organization_id` uses `ON DELETE CASCADE`
- [ ] All foreign keys are indexed
- [ ] Status columns have CHECK constraints
- [ ] Numeric money fields use `DECIMAL(15,2)`
- [ ] RLS is enabled on all user tables
- [ ] RLS policies filter by `organization_id`
- [ ] Unique constraints use partial indexes for NULLs
- [ ] `updated_at` trigger is created
- [ ] Comments document table and column purposes
- [ ] Migration has date and description header

---

## Anti-Patterns (AVOID)

| Anti-Pattern | Problem | Solution |
|---|---|---|
| Using `float` for money | Rounding errors | Use `DECIMAL(15,2)` |
| `TIMESTAMP` without timezone | Ambiguous time | Use `TIMESTAMPTZ` |
| Missing `organization_id` | Data leaks in multi-tenant | Add org_id to all user tables |
| No RLS policies | Anyone can read any data | Create RLS policies |
| No foreign key indexes | Slow joins | Index all FK columns |
| `created_at` without default | Manual insertion error-prone | Set `DEFAULT TIMEZONE('utc', NOW())` |
| No `updated_at` trigger | Stale metadata | Create `updated_at` trigger |
| Using string IDs | Unordered, slower indexes | Use UUID primary keys |
| No CHECK constraints | Invalid data slips through | Add domain validation |
| No soft-delete column | Permanent data loss | Add `status` column with CHECK |
| RLS without organization filter | Multi-tenant data isolation fails | Always filter by org_id in RLS |
| Using JSONB for everything | Loss of type safety and indexing | Use structured columns + JSONB for truly flexible data |

---

## Performance Considerations

### Index Size Impact
- Indexing 1M rows takes ~100MB disk space per index
- Composite indexes are larger but faster for multi-field queries
- Partial indexes (with WHERE clause) are smaller

### Query Optimization
1. Filter by `organization_id` first (narrow tenant)
2. Filter by `status` second (narrow status)
3. Join only needed columns
4. Use `LIMIT` for pagination (offset + limit)

### Trigger Performance
- Triggers run on EVERY row INSERT/UPDATE/DELETE
- Keep trigger logic simple and fast
- Avoid recursive triggers (can cause infinite loops)

---

## Reference: Schema Example

Here's a complete example following all standards:

```sql
-- Create table with all standards
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    description TEXT,
    base_price DECIMAL(15,2) NOT NULL CHECK (base_price > 0),
    currency VARCHAR(3) DEFAULT 'USD',
    weight_in_kg DECIMAL(10,2) CHECK (weight_in_kg >= 0),

    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    is_favorite BOOLEAN DEFAULT false,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, sku) WHERE sku IS NOT NULL
);

-- Indexes
CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_is_favorite ON products(is_favorite) WHERE is_favorite = true;

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products"
  ON products FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create products"
  ON products FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND created_by = auth.uid()
  );

-- Trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE products IS 'Product catalog with pricing, inventory, and categorization';
COMMENT ON COLUMN products.organization_id IS 'Tenant isolation - products belong to organizations';
COMMENT ON COLUMN products.sku IS 'Product code - unique per organization';
COMMENT ON COLUMN products.base_price IS 'Price in specified currency (never use float)';
COMMENT ON COLUMN products.created_by IS 'User who created the product (audit trail)';
```

---

## Quick Reference

**All tables must have:**
1. `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
2. `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` (except system tables)
3. `created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())`
4. `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**All tables should have:**
5. Indexes on FK columns and `organization_id`
6. Index on `created_at DESC` for "recent first" queries
7. RLS policies filtering by `organization_id`
8. `updated_at` trigger
9. Comments explaining purpose

**Column best practices:**
- Money: `DECIMAL(15,2)` (never float)
- Timestamps: `TIMESTAMPTZ` (never TIMESTAMP)
- IDs: `UUID` (never serial)
- Status: `VARCHAR(50)` with CHECK constraint
- Text: `TEXT` (unlimited) or `VARCHAR(n)` (fixed max)
- Uniqueness: Add UNIQUE constraints + partial indexes for NULLs
