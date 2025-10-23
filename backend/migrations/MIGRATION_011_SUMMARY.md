# Migration 011: Soft Delete & Quote Dates - Summary

**Status:** ⏳ Ready to Execute
**Created:** 2025-10-23
**Session:** 20 - Phase 1 Agent 1: Database Schema & Migration

---

## Overview

This migration adds comprehensive soft delete support to the quotes system and ensures all quote date fields are properly configured.

## Files Created

1. **`/home/novi/quotation-app/backend/migrations/011_soft_delete_and_dates.sql`**
   - Main migration SQL file (188 lines)
   - Adds columns, updates data, creates indexes, updates RLS policies
   - Includes helper functions and rollback instructions

2. **`/home/novi/quotation-app/backend/migrations/EXECUTE_MIGRATION_011.md`**
   - Step-by-step execution guide
   - Verification queries
   - Testing procedures
   - Rollback instructions

3. **`/home/novi/quotation-app/backend/verify_migration_011.py`**
   - Automated verification script
   - Runs 4 tests to verify migration success
   - Usage: `cd backend && source venv/bin/activate && python verify_migration_011.py`

4. **Updated: `/home/novi/quotation-app/backend/migrations/MIGRATIONS.md`**
   - Added migration 011 to log
   - Added detailed testing checklist
   - Updated next migration number to 012

---

## What This Migration Does

### Database Schema Changes

1. **Adds `quote_date` column**
   - Type: DATE NOT NULL
   - Default: CURRENT_DATE
   - Populated from `created_at::date` for existing 9 quotes

2. **Adds `deleted_at` column**
   - Type: TIMESTAMP WITH TIME ZONE (nullable)
   - NULL = active quote
   - NOT NULL = soft-deleted quote
   - Includes comment about 7-day auto-purge schedule

3. **Updates `valid_until` column**
   - Changes to NOT NULL
   - Sets default: CURRENT_DATE + 7 days
   - Updates all 9 existing NULL values to `created_at + 7 days`

### Performance Optimizations

4. **Creates indexes:**
   - `idx_quotes_deleted_at` - General index for filtering active quotes
   - `idx_quotes_deleted_at_not_null` - Partial index for cleanup cron job

### Security & Access Control

5. **Updates RLS policies:**
   - SELECT: Only show quotes where `deleted_at IS NULL`
   - UPDATE: Can't update quotes where `deleted_at IS NOT NULL`
   - INSERT: Unchanged
   - DELETE: Unchanged (note: app should use soft delete instead)

### Helper Functions

6. **Adds `soft_delete_quote(uuid)` function:**
   - Sets `deleted_at = NOW()`
   - Respects organization_id (multi-tenant)
   - Only deletes if not already deleted
   - Returns boolean (true if deleted, false if not found/already deleted)

7. **Adds `restore_quote(uuid)` function:**
   - Clears `deleted_at` (sets to NULL)
   - Respects organization_id (multi-tenant)
   - Only restores if currently deleted
   - Returns boolean (true if restored, false if not found/already active)

---

## Current Database State

**Before migration:**
- `quote_date` column: Does NOT exist
- `valid_until` column: Exists but all 9 quotes have NULL values
- `deleted_at` column: Does NOT exist
- Total quotes: 9

**After migration:**
- `quote_date` column: EXISTS, all 9 quotes populated with date from created_at
- `valid_until` column: EXISTS, NOT NULL, all 9 quotes populated with created_at + 7 days
- `deleted_at` column: EXISTS, all 9 quotes have NULL (active)
- Total quotes: 9 (all active)

---

## How to Execute

### Option 1: Supabase SQL Editor (Recommended)

1. Open: https://supabase.com/dashboard/project/wstwwmiihkzlgvlymlfd/sql/new
2. Copy content from: `/home/novi/quotation-app/backend/migrations/011_soft_delete_and_dates.sql`
3. Paste and click "Run"
4. Wait for "Success" message

### Option 2: Command Line (psql)

```bash
cd /home/novi/quotation-app/backend

PGPASSWORD='***REMOVED***' psql \
  -h db.wstwwmiihkzlgvlymlfd.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f migrations/011_soft_delete_and_dates.sql
```

---

## Verification Steps

### 1. Run automated verification script

```bash
cd /home/novi/quotation-app/backend
source venv/bin/activate
python verify_migration_011.py
```

Expected output: "✓ ALL TESTS PASSED"

### 2. Manual verification via Supabase SQL Editor

See `/home/novi/quotation-app/backend/migrations/EXECUTE_MIGRATION_011.md` for detailed verification queries.

Quick check:
```sql
SELECT
  COUNT(*) as total_quotes,
  COUNT(quote_date) as has_quote_date,
  COUNT(valid_until) as has_valid_until,
  COUNT(deleted_at) as soft_deleted
FROM quotes;
```

Expected: `total_quotes=9, has_quote_date=9, has_valid_until=9, soft_deleted=0`

### 3. Test soft delete functionality

```sql
-- Get a quote ID
SELECT id, quote_number FROM quotes LIMIT 1;

-- Soft delete it (replace UUID)
SELECT soft_delete_quote('your-uuid-here');

-- Restore it
SELECT restore_quote('your-uuid-here');
```

---

## Post-Migration Tasks

### Immediate (Required)

1. **Update MIGRATIONS.md:**
   - Change status from ⏳ Pending to ✅ Done
   - Add actual execution date

2. **Verify all tests pass:**
   - Run `python verify_migration_011.py`
   - Run manual SQL verification queries

### Short-term (Next Session)

3. **Update backend API endpoints:**
   ```python
   # Update DELETE /api/quotes/{id} to use soft delete
   @router.delete("/{quote_id}")
   async def delete_quote(quote_id: str, user: User = Depends(get_current_user)):
       # Call soft_delete_quote() instead of actual DELETE
       result = supabase.rpc("soft_delete_quote", {"quote_id": quote_id}).execute()
       if result.data:
           return {"message": "Quote deleted successfully"}
       raise HTTPException(404, "Quote not found")

   # Add POST /api/quotes/{id}/restore
   @router.post("/{quote_id}/restore")
   async def restore_quote(quote_id: str, user: User = Depends(get_current_user)):
       result = supabase.rpc("restore_quote", {"quote_id": quote_id}).execute()
       if result.data:
           return {"message": "Quote restored successfully"}
       raise HTTPException(404, "Quote not found")
   ```

4. **Update frontend:**
   - Add "Restore" button for deleted quotes (admin view)
   - Show "Deleted" badge in quote list
   - Add confirmation dialog before deleting

### Long-term (Production Setup)

5. **Schedule automated cleanup cron job:**

**Option A: Supabase Edge Function (Recommended)**
```typescript
// Create Edge Function at /functions/cleanup-deleted-quotes/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase
    .from('quotes')
    .delete()
    .lt('deleted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .not('deleted_at', 'is', null)

  return new Response(
    JSON.stringify({ deleted: data?.length || 0, error }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

// Schedule via Supabase Dashboard: Functions > cleanup-deleted-quotes > Cron
// Schedule: 0 2 * * * (2 AM daily)
```

**Option B: pg_cron (if available)**
```sql
SELECT cron.schedule(
    'delete-old-quotes',
    '0 2 * * *',  -- Run at 2 AM daily
    $$DELETE FROM quotes WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'$$
);
```

---

## Rollback Instructions

If migration causes issues, run rollback SQL from migration file:

```sql
DROP FUNCTION IF EXISTS soft_delete_quote(UUID);
DROP FUNCTION IF EXISTS restore_quote(UUID);
DROP INDEX IF EXISTS idx_quotes_deleted_at;
DROP INDEX IF EXISTS idx_quotes_deleted_at_not_null;
ALTER TABLE quotes DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE quotes DROP COLUMN IF EXISTS quote_date;
ALTER TABLE quotes ALTER COLUMN valid_until DROP NOT NULL;
ALTER TABLE quotes ALTER COLUMN valid_until DROP DEFAULT;

-- Recreate original RLS policies (see migration 007)
```

---

## Testing Checklist

- [ ] Migration executed without errors
- [ ] All 9 quotes have `quote_date` populated from `created_at`
- [ ] All 9 quotes have `valid_until` = `created_at + 7 days`
- [ ] All 9 quotes have `deleted_at = NULL`
- [ ] New quotes get `quote_date = CURRENT_DATE` automatically
- [ ] New quotes get `valid_until = CURRENT_DATE + 7 days` automatically
- [ ] Indexes created: `idx_quotes_deleted_at`, `idx_quotes_deleted_at_not_null`
- [ ] RLS policies updated with `deleted_at IS NULL` filter
- [ ] `soft_delete_quote(uuid)` function works
- [ ] `restore_quote(uuid)` function works
- [ ] Soft-deleted quotes don't appear in normal queries (due to RLS)
- [ ] Verification script passes all tests

---

## Notes

- **Migration is IDEMPOTENT:** Uses `IF NOT EXISTS` and conditional logic, safe to re-run
- **No downtime:** Migration is backwards-compatible, existing code will continue working
- **Multi-tenant safe:** All functions respect `organization_id` via RLS
- **7-day retention:** Soft-deleted quotes can be restored within 7 days, then auto-purged
- **Performance:** Indexes ensure filtering deleted quotes is fast even with millions of rows

---

## Questions or Issues?

1. Check `/home/novi/quotation-app/backend/migrations/EXECUTE_MIGRATION_011.md` for detailed guidance
2. Run verification script: `python verify_migration_011.py`
3. Check Supabase logs for error messages
4. Verify DATABASE_URL connection in `.env`
