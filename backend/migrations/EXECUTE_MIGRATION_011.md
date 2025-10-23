# How to Execute Migration 011

## Quick Start

### Option 1: Via Supabase SQL Editor (Recommended)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/wstwwmiihkzlgvlymlfd/sql/new

2. **Copy migration content:**
   - Open: `/home/novi/quotation-app/backend/migrations/011_soft_delete_and_dates.sql`
   - Copy the entire file content

3. **Execute migration:**
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for "Success" message

4. **Verify migration:**
   - Run verification queries below

### Option 2: Via psql Command Line

```bash
# Navigate to backend directory
cd /home/novi/quotation-app/backend

# Execute migration using direct connection (not pooler)
PGPASSWORD='Y7pX9fL3QrD6zW' psql \
  -h db.wstwwmiihkzlgvlymlfd.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f migrations/011_soft_delete_and_dates.sql
```

---

## Verification Queries

After running the migration, execute these queries to verify:

### 1. Check new columns exist
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'quotes'
AND column_name IN ('quote_date', 'deleted_at', 'valid_until')
ORDER BY column_name;
```

**Expected output:**
- `deleted_at`: timestamp with time zone, YES (nullable), NULL
- `quote_date`: date, NO (not null), CURRENT_DATE
- `valid_until`: date, NO (not null), (CURRENT_DATE + '7 days'::interval)::date

### 2. Check existing quotes have dates populated
```sql
SELECT
  id,
  quote_number,
  quote_date,
  valid_until,
  created_at::date as created_date,
  deleted_at
FROM quotes
ORDER BY created_at;
```

**Expected:**
- All 9 quotes should have `quote_date` = `created_at::date`
- All 9 quotes should have `valid_until` = `created_at::date + 7 days`
- All `deleted_at` should be NULL

### 3. Check indexes created
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'quotes'
AND indexname LIKE '%deleted%';
```

**Expected:**
- `idx_quotes_deleted_at`
- `idx_quotes_deleted_at_not_null`

### 4. Check RLS policies updated
```sql
SELECT policyname, cmd, qual::text as using_clause
FROM pg_policies
WHERE tablename = 'quotes'
ORDER BY policyname;
```

**Expected:**
- All SELECT/UPDATE policies should include `(deleted_at IS NULL)` in the USING clause

### 5. Check helper functions created
```sql
SELECT routine_name, routine_type, data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('soft_delete_quote', 'restore_quote');
```

**Expected:**
- `soft_delete_quote`: function, boolean
- `restore_quote`: function, boolean

---

## Testing the Soft Delete Functionality

### Test soft delete
```sql
-- Get a quote ID
SELECT id, quote_number, deleted_at FROM quotes LIMIT 1;

-- Soft delete it (replace with actual UUID)
SELECT soft_delete_quote('your-quote-uuid-here');

-- Verify it's marked as deleted
SELECT id, quote_number, deleted_at FROM quotes WHERE id = 'your-quote-uuid-here';
-- Note: You won't see it via normal queries due to RLS!

-- To see deleted quotes, query without RLS filter:
SET ROLE postgres;
SELECT id, quote_number, deleted_at FROM quotes WHERE deleted_at IS NOT NULL;
RESET ROLE;
```

### Test restore
```sql
-- Restore the quote
SELECT restore_quote('your-quote-uuid-here');

-- Verify it's active again
SELECT id, quote_number, deleted_at FROM quotes WHERE id = 'your-quote-uuid-here';
```

---

## Post-Migration Checklist

- [ ] Migration executed successfully
- [ ] All verification queries pass
- [ ] All 9 existing quotes have dates populated
- [ ] Indexes created
- [ ] RLS policies updated
- [ ] Helper functions work
- [ ] Update MIGRATIONS.md status to ✅ Done
- [ ] Schedule cron job for auto-cleanup (see migration file line 155-169)

---

## Rollback (if needed)

If something goes wrong, run the rollback commands from the migration file:

```sql
DROP FUNCTION IF EXISTS soft_delete_quote(UUID);
DROP FUNCTION IF EXISTS restore_quote(UUID);
DROP INDEX IF EXISTS idx_quotes_deleted_at;
DROP INDEX IF EXISTS idx_quotes_deleted_at_not_null;
ALTER TABLE quotes DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE quotes DROP COLUMN IF EXISTS quote_date;
ALTER TABLE quotes ALTER COLUMN valid_until DROP NOT NULL;
ALTER TABLE quotes ALTER COLUMN valid_until DROP DEFAULT;

-- Recreate original RLS policies
-- (see migration 007_quotes_calculation_schema.sql for original policies)
```

---

## Next Steps

After migration is verified:

1. **Update backend code** to use soft delete:
   - Update `DELETE /api/quotes/{id}` endpoint to call `soft_delete_quote()`
   - Add `POST /api/quotes/{id}/restore` endpoint to restore deleted quotes
   - Update list endpoints to optionally show deleted quotes (for admin view)

2. **Schedule cleanup cron job:**
   - Set up Supabase Edge Function or pg_cron
   - Run daily to delete quotes older than 7 days
   - See migration file for SQL example

3. **Update frontend:**
   - Add "Restore" button for recently deleted quotes
   - Show "Deleted" status in quote list (if admin)
   - Add confirmation dialog before deleting
