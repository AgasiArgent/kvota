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

## Next Migration Number: 011

Create new migration:
```bash
touch backend/migrations/011_your_migration_name.sql
```

Then update this log!
