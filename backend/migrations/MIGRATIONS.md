# Database Migrations

**IMPORTANT:** Run migrations in order!

## How to Run Migrations

### Via Supabase SQL Editor (Recommended)
1. Go to: https://supabase.com/dashboard > Your Project > SQL Editor
2. Copy content from migration file (e.g., `001_multi_tenant_organizations.sql`)
3. Execute
4. Mark as complete below

### Via psql (Direct connection)
```bash
psql postgresql://postgres:password@db.your-project.supabase.co:5432/postgres -f migrations/001_multi_tenant_organizations.sql
```

---

## Migration Log

| # | File | Description | Status | Date Applied | Applied By |
|---|------|-------------|--------|--------------|------------|
| 001 | `001_multi_tenant_organizations.sql` | Multi-tenant organizations setup | ✅ Done | 2025-01-XX | Initial |
| 002 | `002_auto_create_user_profile.sql` | Auto-create user profiles | ✅ Done | 2025-01-XX | Initial |
| 003 | `003_fix_organization_members_rls.sql` | Fix organization members RLS | ✅ Done | 2025-01-XX | Initial |
| 004 | `004_fix_rls_properly.sql` | Fix RLS policies | ✅ Done | 2025-01-XX | Initial |
| 005 | `005_create_customers_table.sql` | Create customers table | ✅ Done | 2025-01-XX | Initial |
| 007 | `007_quotes_calculation_schema.sql` | Quotes and calculation schema | ✅ Done | 2025-01-XX | Initial |
| 008 | `008_calculation_settings.sql` | Admin calculation settings | ✅ Done | 2025-10-18 | Session 7 |
| 009 | `009_add_sku_brand_to_quote_items.sql` | Add SKU and Brand columns | ✅ Done | 2025-10-19 | Session 8 |
| 010 | `010_add_inn_to_organizations.sql` | Add INN to organizations | ✅ Done | 2025-10-XX | Session X |
| 011 | `011_soft_delete_and_dates.sql` | Add soft delete + quote dates | ✅ Done | 2025-10-23 | Session 20 |
| 013 | `013_add_last_name_to_contacts.sql` | Add last_name to customer_contacts | ✅ Done | 2025-10-25 | Session 25 |
| 014 | `014_user_profiles_manager_info.sql` | Add manager info to user_profiles | ✅ Done | 2025-10-26 | Session 26 - Agent 1 |
| 015 | `015_exchange_rates.sql` | Exchange rates table with caching | ✅ Done | 2025-10-26 | Session 26 - Agent 2 |
| 016 | `016_activity_logs.sql` | Activity logs for audit trail | ✅ Done | 2025-10-26 | Session 26 - Agent 3 |
| 017 | `017_feedback.sql` | Feedback system table | ✅ Done | 2025-10-26 | Session 26 - Agent 6 |
| 018 | `018_fix_quote_number_uniqueness.sql` | **Fix quote number unique constraint** | ✅ **Done** | 2025-10-27 | **Session 31** |
| 021 | `021_performance_indexes.sql` | Performance optimization indexes | ✅ Done | 2025-10-26 | Session 26 - Agent 9 |
| 016 (new) | `016_analytics_reporting_system.sql` | Analytics reporting tables with RLS | ✅ Done | 2025-11-02 | Session 36 - Analytics Feature |
| 031 | `031_crm_system.sql` | **CRM System (leads, stages, contacts, activities)** | ⏳ **Pending** | TBD | **Session 40 - CRM Feature** |

---

## Migration Rules

**DO:**
- ✅ Number migrations sequentially
- ✅ Include rollback SQL at the bottom (commented)
- ✅ Test in development first
- ✅ Document what the migration does
- ✅ Update this log after applying

**DON'T:**
- ❌ Edit already-applied migrations (create new ones instead)
- ❌ Skip migration numbers
- ❌ Run migrations out of order
- ❌ Apply untested migrations to production

---

## Next Migration Number: 032

Create new migration:
```bash
touch backend/migrations/032_your_migration_name.sql
```

Then update this log!

---

## Migration 016 (new) Details: Analytics Reporting System

**Tables Created:**
- `saved_reports` - User-saved report templates
- `report_executions` - Immutable audit log
- `scheduled_reports` - Automated report scheduling
- `report_versions` - Version history (immutable)

**RLS Policies:** All tables have SELECT/INSERT/UPDATE/DELETE policies
**Triggers:** Auto-versioning, auto-update timestamps
**Functions:** `track_report_version()`, `cleanup_expired_report_files()`

**Status:** ✅ Applied (2025-11-02) - All 4 tables created successfully

**How to Apply:**
1. Open Supabase Dashboard > SQL Editor
2. Copy contents of `016_analytics_reporting_system.sql`
3. Execute
4. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('saved_reports', 'report_executions', 'scheduled_reports', 'report_versions')
   ORDER BY table_name;
   ```
   Should return 4 rows

**Testing RLS Isolation:**
```sql
-- Get two org IDs
SELECT id FROM organizations LIMIT 2;

-- Set org 1 context
SELECT set_config('app.current_organization_id', '<org1_uuid>', false);

-- Try to select (should return 0 rows)
SELECT * FROM saved_reports;

-- Set org 2 context
SELECT set_config('app.current_organization_id', '<org2_uuid>', false);

-- Try to select (should return 0 rows)
SELECT * FROM saved_reports;
```

---

## Migration 018 Details: Fix Quote Number Uniqueness (CRITICAL)

**🔴 IMPORTANT: This migration fixes a critical multi-tenant bug**

**Problem:**
- Current database has `UNIQUE` constraint on `quote_number` alone
- This makes quote numbers globally unique across ALL organizations
- Error: "duplicate key value violates unique constraint quotes_quote_number_key"
- Example: If Org A creates КП25-0001, Org B cannot create КП25-0001

**Solution:**
- Change to composite unique constraint: `UNIQUE (organization_id, quote_number)`
- Allows each organization to have independent sequential numbering
- Industry standard for multi-tenant SaaS systems

**What it does:**
1. Drops old constraint `quotes_quote_number_key`
2. Adds new constraint `quotes_unique_number_per_org UNIQUE (organization_id, quote_number)`
3. Adds comment explaining the constraint

**Impact:**
- ✅ Non-destructive (no data loss)
- ✅ Fixes "duplicate quote number" error immediately
- ✅ Each organization can now start from КП25-0001 independently
- ✅ No code changes needed (backend already filters by organization_id)

**How to Apply:**
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of `018_fix_quote_number_uniqueness.sql`
3. Execute
4. Verify with query:
   ```sql
   SELECT organization_id, quote_number, COUNT(*)
   FROM quotes
   GROUP BY organization_id, quote_number
   HAVING COUNT(*) > 1;
   ```
   Should return 0 rows (no duplicates within same organization)

**Rollback (if needed):**
```sql
ALTER TABLE quotes DROP CONSTRAINT quotes_unique_number_per_org;
ALTER TABLE quotes ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);
```

---

## Migration 011 Details: Soft Delete & Quote Dates

**What it does:**
1. Adds `quote_date` column (DATE, NOT NULL, default: CURRENT_DATE)
2. Adds `deleted_at` column (TIMESTAMP, nullable) for soft deletes
3. Updates all existing quotes to populate `quote_date` from `created_at`
4. Updates all NULL `valid_until` values to `created_at + 7 days`
5. Makes `valid_until` NOT NULL with default `CURRENT_DATE + 7 days`
6. Creates indexes on `deleted_at` for performance
7. Updates RLS policies to filter out soft-deleted quotes (deleted_at IS NULL)
8. Adds helper functions: `soft_delete_quote(uuid)` and `restore_quote(uuid)`

**Post-migration setup required:**
- Schedule cron job to permanently delete quotes after 7 days of soft deletion
- See migration file for pg_cron example
- Can be implemented via Supabase Edge Functions or pg_cron

**Testing checklist:**
- [ ] All 9 existing quotes have quote_date populated from created_at
- [ ] All 9 existing quotes have valid_until = created_at + 7 days
- [ ] New quotes get quote_date = CURRENT_DATE automatically
- [ ] New quotes get valid_until = CURRENT_DATE + 7 days automatically
- [ ] RLS policies filter deleted quotes (deleted_at IS NULL)
- [ ] soft_delete_quote() function works
- [ ] restore_quote() function works
