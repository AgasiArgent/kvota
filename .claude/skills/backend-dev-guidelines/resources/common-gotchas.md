# Backend Common Gotchas

**Created:** 2025-10-29 21:15 UTC
**Source:** Extracted from `.claude/COMMON_GOTCHAS.md` (Quick Wins patterns)
**Scope:** Backend-specific bug patterns from 41 tracked bugs
**Purpose:** Quick reference before implementing backend features - scan for relevant patterns in <10 seconds

---

## Overview

This document captures backend-specific learnings from production bugs. Each gotcha follows the pattern:
- **Problem:** What breaks
- **Solution:** How to fix
- **Why It Matters:** Impact explanation
- **Real Bug:** Link to actual bug instance

**Target audience:** Backend Developer Agent + human developers
**Maintenance:** Low (patterns rarely change, update only for new categories)

---

## 🔴 Multi-Tenant Security

### 1. Missing Organization Filter in Queries

**Quick Fix:** Always include `organization_id` filter in Supabase queries

#### ❌ Bug Pattern
```python
# Leaks data across organizations!
quotes = supabase.table("quotes").select("*").execute()
return quotes.data  # Returns ALL organizations' quotes
```

#### ✅ Correct Pattern
```python
# Properly filtered to user's organization
quotes = supabase.table("quotes")\
    .select("*")\
    .eq("organization_id", user.organization_id)\
    .execute()
return quotes.data  # Returns only current org's quotes
```

**Why It Matters:** Without organization filtering, users see competitors' quotes, prices, and customer data. This is a critical security breach that violates data privacy regulations and destroys customer trust.

**Real Bug:** BUG-001 (Session 31, FIXED) - Quote list showed all organizations' data (common pattern across multiple endpoints)
**Bug Reference:** [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md#bug-001)

**Deep Dive:** [→ See `.claude/RLS_CHECKLIST.md` for complete multi-tenant security patterns]

---

### 3. Case-Sensitive Role Checks

**Quick Fix:** Always use `.lower()` when comparing user roles in Python

#### ❌ Bug Pattern
```python
# Breaks if role is "Admin" instead of "admin"
if user.role == 'admin':
    allow_admin_operation()
```

#### ✅ Correct Pattern
```python
# Works with "Admin", "ADMIN", "admin"
if user.role.lower() == 'admin':
    allow_admin_operation()
```

**Why It Matters:** Admin users cannot access admin endpoints because Supabase returns "Admin" (capital A) but code checks for "admin" (lowercase). This blocks critical administrative functions.

**Real Bug:** BUG-006 - Admin role check failures (Session 33)
**Related:** Frontend also needs `.toLowerCase()` in TypeScript

---

### 7. Missing RLS Policies on New Tables

**Quick Fix:** Always enable RLS and create 4 policies (SELECT, INSERT, UPDATE, DELETE) for every new table

#### ❌ Bug Pattern
```sql
-- Missing RLS = data leak
CREATE TABLE new_feature (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  data jsonb
);
-- No RLS enabled ❌
```

#### ✅ Correct Pattern
```sql
-- RLS enabled with policies
CREATE TABLE new_feature (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  data jsonb
);

-- Enable RLS
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

-- Create 4 policies (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Users can view their org's records"
  ON new_feature FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can insert their org's records"
  ON new_feature FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can update their org's records"
  ON new_feature FOR UPDATE
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY "Users can delete their org's records"
  ON new_feature FOR DELETE
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Why It Matters:** Without RLS, multi-tenant isolation breaks silently. All organizations can see each other's data even with proper frontend filtering.

**Real Bug:** BUG-010 (Session 31, FIXED) - Missing RLS on multiple tables
**Bug Reference:** [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md#bug-010)

**Deep Dive:** [→ See `.claude/RLS_CHECKLIST.md` for complete template]

---

## 🔍 Data Access Patterns

### 2. Missing Customer JOIN in Quote Endpoints

**Quick Fix:** Use Supabase nested select syntax: `.select("*, customer:customers(name, email, inn)")`

#### ❌ Bug Pattern
```python
# Only returns customer_id, not customer object
quote = supabase.table("quotes")\
    .select("*")\
    .eq("id", quote_id)\
    .single()\
    .execute()
# quote.data.customer_id = UUID
# quote.data.customer = undefined ❌
```

#### ✅ Correct Pattern
```python
# Returns nested customer object
quote = supabase.table("quotes")\
    .select("*, customer:customers(name, email, inn)")\
    .eq("id", quote_id)\
    .single()\
    .execute()
# quote.data.customer = {name: "...", email: "...", inn: "..."} ✅
```

**Why It Matters:** Frontend displays blank customer name in quote detail page. Users cannot identify which customer the quote is for, breaking the review workflow.

**Real Bug:** BUG-002 (Session 31, FIXED) - Client field blank on quote detail page
**Bug Reference:** [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md#bug-002)

---

### 4. Activity Log Decorator Not Applied

**Quick Fix:** Add `@log_activity_decorator` to all CRUD and export endpoints

#### ❌ Bug Pattern
```python
# Quote creation not logged ❌
@router.post("/api/quotes/calculate")
async def create_quote(data: QuoteInput):
    # No @log_activity_decorator
    result = await calculation_engine(data)
    return result
```

#### ✅ Correct Pattern
```python
# Quote creation logged ✅
from services.activity_log_service import log_activity_decorator

@router.post("/api/quotes/calculate")
@log_activity_decorator(
    action_type="create",
    entity_type="quote"
)
async def create_quote(data: QuoteInput):
    result = await calculation_engine(data)
    return result
```

**Why It Matters:** Activity log page shows empty data for quote creation and export actions. This breaks audit trails required for compliance and makes debugging user issues impossible.

**Real Bug:** BUG-003 (Session 26, FIXED) - Activity log incomplete
**Bug Reference:** [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md#bug-003)
**Status:** Decorator implemented, applied to customers/quotes CRUD, but NOT applied to quote creation endpoint (`routes/quotes_calc.py`)

**Deep Dive:** [→ See `backend/services/activity_log_service.py:70-118`]

---

## ⚡ Performance

### 8. Concurrent Request Performance Bottleneck

**Quick Fix:** Use `async_supabase_call()` wrapper for all Supabase operations

#### ❌ Bug Pattern
```python
# Blocks entire event loop during I/O
result = supabase.table("quotes").select("*").execute()
# 66x slower with 20 concurrent requests
```

#### ✅ Correct Pattern
```python
# Non-blocking I/O with thread pool
from async_supabase import async_supabase_call

result = await async_supabase_call(
    lambda: supabase.table("quotes").select("*").execute()
)
# Handles 50+ concurrent users smoothly
```

**Why It Matters:** System slows down 66x with just 20 concurrent users. Under load, API response times go from 100ms to 6+ seconds, making the app unusable.

**Real Bug:** BUG-038 - Concurrent request performance (INFRASTRUCTURE READY, needs deployment)
**Status:** Wrapper exists (`backend/async_supabase.py`), but only 1 file uses it
**Remaining work:** Apply to `quotes_calc.py`, `customers.py`, `calculation_settings.py` (2-3 hours)

**Deep Dive:** [→ See `backend/async_supabase.py`]

**Files to Update:**
```bash
# Priority order (most frequently accessed):
1. backend/routes/quotes_calc.py        # Quote creation (high traffic)
2. backend/routes/customers.py          # Customer operations (high traffic)
3. backend/routes/calculation_settings.py  # Admin settings (low traffic)
```

**Pattern to follow:**
```python
# Before (synchronous)
result = supabase.table("quotes").select("*").execute()

# After (asynchronous)
from async_supabase import async_supabase_call
result = await async_supabase_call(
    lambda: supabase.table("quotes").select("*").execute()
)
```

---

## 📤 Export Handling

### 9. Excel/PDF Export UUID Type Errors

**Quick Fix:** Convert UUID to string before using `.replace()` or string operations

#### ❌ Bug Pattern
```python
# TypeError: UUID object has no attribute 'replace'
quote_number = quote.id  # UUID object
filename = f"quote_{quote_number.replace('-', '_')}.pdf"  # ❌ Crashes
```

#### ✅ Correct Pattern
```python
# Convert to string first
quote_number = str(quote.id)  # Now a string
filename = f"quote_{quote_number.replace('-', '_')}.pdf"  # ✅ Works
```

**Why It Matters:** PDF exports create files but crash with 500 error before sending to client. User sees "Download failed" even though file was generated successfully.

**Real Bug:** BUG-005 (Session 31, FIXED) - PDF export failing with 500 error
**Bug Reference:** [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md#bug-005)
**Fix Location:** `backend/routes/quotes.py:1598, 1612, 1832`

**Common places this occurs:**
- Filename generation for exports
- Log messages with UUIDs
- String concatenation with database IDs
- URL path parameters

---

## 🧮 Calculation Engine

### 15. Missing Variable Validation

**Quick Fix:** Validate ALL required fields before sending to calculation engine

#### ❌ Bug Pattern
```python
# Missing validation - calculation fails with cryptic error
calculation_input = {
    "sku": None,  # ❌ Required field
    "quantity": 0,  # ❌ Must be > 0
    "currency_base": ""  # ❌ Required field
}
result = calculate(calculation_input)  # Fails deep in calculation
```

#### ✅ Correct Pattern
```python
# Validate before calculation
errors = []
if not calculation_input.get("sku"):
    errors.append("SKU is required")
if calculation_input.get("quantity", 0) <= 0:
    errors.append("Quantity must be greater than 0")
if not calculation_input.get("currency_base"):
    errors.append("Base currency is required")

if errors:
    return {"error": errors}  # ✅ Clear error messages

result = calculate(calculation_input)
```

**Why It Matters:** Calculation engine crashes with vague errors deep in formula logic. Users don't know what's wrong or how to fix it.

**Real Bug:** BUG-008 (Session 15, FIXED) - Multiple validation gaps in calculation engine
**Bug Reference:** [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md#bug-008)

**Required Fields (10 total):**
1. `sku` - Product identifier
2. `quantity` - Must be > 0
3. `currency_base` - USD/RUB/EUR
4. `rate_forex` - Forex markup rate
5. `rate_loan_interest_daily` - Daily interest rate
6. `rate_fin_comm` - Financial commission
7. `seller_company` - Legal entity name
8. `seller_company_inn` - Tax ID
9. `seller_company_kpp` - Tax registration code
10. `offer_incoterms` - Delivery terms (EXW/FCA/DAP)

**Deep Dive:** [→ See `.claude/CALCULATION_PATTERNS.md` for complete validation rules]

---

### 16. Two-Tier Variable Precedence Issues

**Quick Fix:** Use `get_value()` helper function to respect product override > quote default

#### ❌ Bug Pattern
```python
# Always uses quote default, ignores product override
rate_forex = quote_data.get("rate_forex")  # ❌ Missing product override
```

#### ✅ Correct Pattern
```python
# Respects two-tier system
def get_value(product, quote, field):
    """Get effective value: product override > quote default"""
    product_val = product.get(field)
    if product_val is not None and product_val != "":
        return product_val  # Product override
    return quote.get(field)  # Quote default

rate_forex = get_value(product, quote, "rate_forex")  # ✅ Correct precedence
```

**Why It Matters:** Product-specific overrides are ignored, calculations use wrong values. Quotes for special products show incorrect pricing.

**Real Bug:** BUG-024 (Session 29, FIXED) - Commission distribution bug
**Bug Reference:** [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md#bug-024)

**Two-Tier Variable Types:**
- **Quote-only (19):** Apply to all products (e.g., `seller_company`, `offer_incoterms`)
- **Product-only (5):** Must be set per product (e.g., `sku`, `base_price_VAT`)
- **Both levels (15):** Can be default or override (e.g., `rate_forex`, `quantity`)
- **Admin-only (3):** Organization-wide settings (e.g., `rate_forex_risk`)

**Deep Dive:** [→ See `.claude/CALCULATION_PATTERNS.md` - Two-Tier System]
**Variable Reference:** [→ See `.claude/VARIABLES.md` for all 42 variables]

---

## Prevention Checklists

### Backend Endpoint Checklist
- [ ] Add `organization_id` filter for multi-tenant tables
- [ ] Use nested select for related entities (`.select("*, related:table(*)")`)
- [ ] Apply `@log_activity_decorator` for CRUD operations
- [ ] Validate all required fields before processing
- [ ] Convert UUIDs to strings before string operations
- [ ] Use `async_supabase_call()` wrapper for Supabase queries
- [ ] Return all errors at once (not just first error)
- [ ] Use `.lower()` for role comparisons

### Calculation Changes Checklist
- [ ] Validate all 10 required fields
- [ ] Test two-tier variable precedence (product override vs quote default)
- [ ] Verify commission distribution across products
- [ ] Check edge cases: null values, zero quantities, empty strings

### Database Migration Checklist
- [ ] Add `organization_id` column (`uuid NOT NULL`)
- [ ] Create index on `organization_id`
- [ ] Enable RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Create 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Verify RLS with test queries (different organizations)

---

## Quick Reference Links

**Full Documentation:**
- [COMMON_GOTCHAS.md](../../../COMMON_GOTCHAS.md) - All 18 gotchas (frontend + backend)
- [VARIABLES.md](../../../VARIABLES.md) - 42 variables reference
- [CALCULATION_PATTERNS.md](../../../CALCULATION_PATTERNS.md) - Validation rules and two-tier system
- [RLS_CHECKLIST.md](../../../RLS_CHECKLIST.md) - Multi-tenant security templates
- [MASTER_BUG_INVENTORY.md](../../../MASTER_BUG_INVENTORY.md) - All 41 tracked bugs

**Code References:**
- Activity log decorator: `backend/services/activity_log_service.py:70-118`
- Async Supabase wrapper: `backend/async_supabase.py`
- Calculation validation: `backend/routes/quotes_calc.py` (validate_calculation_input)
- Two-tier system: `backend/routes/quotes_calc.py` (get_value helper)

**Related Backend Agent Resources:**
- [Backend CLAUDE.md](../../../../backend/CLAUDE.md) - FastAPI patterns and conventions
- [Backend Development Guidelines](../guidelines.md) - Agent implementation guide

---

**Last Updated:** 2025-10-29 21:15 UTC
**Total Backend Gotchas:** 9 (from original 18)
**Categories:** Multi-Tenant Security (3), Data Access (2), Performance (1), Export (1), Calculation (2)
**Maintenance:** Update when discovering new backend-specific patterns
