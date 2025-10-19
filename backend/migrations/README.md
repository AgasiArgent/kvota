# Database Migrations

## How to Apply Migrations to Supabase

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Create a new query
4. Copy the contents of `001_multi_tenant_organizations.sql`
5. Paste into the SQL editor
6. Click "Run" to execute the migration

The migration includes verification - you should see a success message with:
- Tables created: 5/5
- System roles seeded: 5/5
- Features enabled

### Option 2: Via command line (if you have direct Postgres access)

```bash
cd backend
source venv/bin/activate
python3 apply_organization_migration.py
```

## Migration 001: Multi-Tenant Organizations

**File:** `001_multi_tenant_organizations.sql`
**Status:** Ready to apply
**Description:** Adds complete organization/tenant system with RBAC

**Changes:**
- ✅ 5 new tables
  - `organizations` - Root tenant entity
  - `roles` - System and custom roles with permissions
  - `organization_members` - User ↔ Organization many-to-many
  - `organization_invitations` - Email invitation system
  - `user_profiles` - Extended user information

- ✅ Updates to existing tables
  - Added `organization_id` to `customers`
  - Added `organization_id` to `quotes`

- ✅ System roles seeded
  1. Admin (full control)
  2. Financial Admin (financial oversight)
  3. Sales Manager (quotes & customers)
  4. Procurement Manager (suppliers & POs)
  5. Logistics Manager (shipping & customs)

- ✅ Row Level Security policies
  - Multi-tenant data isolation
  - Role-based access control
  - Invitation system policies

- ✅ Helper functions
  - `get_user_role_in_org(user_id, org_id)`
  - `user_has_permission(user_id, org_id, permission)`
  - `get_user_organizations(user_id)`
  - `generate_invitation_token()`

## After Migration

Once the migration is applied, you can verify it by running:

```sql
SELECT verify_organization_migration();
```

You should see a success message listing all created tables and seeded roles.

## Rollback

If you need to rollback this migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS organization_invitations CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Remove organization_id from existing tables
ALTER TABLE customers DROP COLUMN IF EXISTS organization_id;
ALTER TABLE quotes DROP COLUMN IF EXISTS organization_id;

-- Restore original RLS policies
-- (You'll need to restore from database_schema.sql)
```

## Next Steps

After applying this migration:

1. ✅ Update `backend/models.py` with organization models
2. ✅ Update `backend/auth.py` for multi-org support
3. ✅ Create `backend/routes/organizations.py` API
4. ✅ Build frontend organization pages
5. ✅ Test multi-tenant data isolation
