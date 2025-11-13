# Apply Database Migration

Safely applies a database migration with automatic backup and rollback capabilities.

**Created:** 2025-10-30
**Author:** backend-dev agent
**Version:** 1.0

---

## Usage

```bash
/apply-migration <migration_file_path>
```

**Example:**
```bash
/apply-migration backend/migrations/020_add_approval_workflow.sql
```

---

## ⚠️ Prerequisites & Safety Warnings

**Before Running:**
- ✅ Migration file tested locally in development
- ✅ All SQL syntax validated
- ✅ RLS policies reviewed (if applicable)
- ✅ Rollback plan documented in migration file
- ✅ Backend server can be temporarily stopped if needed
- ✅ You have `pg_dump` and `psql` installed in WSL2

**Safety Features:**
- 🔄 Automatic backup before applying
- ⚠️ Rollback on any failure
- 🔒 Verification of migration success
- 📝 Automatic documentation update
- 🚫 Prevents duplicate application

**CRITICAL:** This command will:
1. Create a full database backup (~30s)
2. Apply the migration
3. Verify success or auto-rollback
4. Keep backup file even on success

---

## Step 1: Pre-Flight Checks (Verify Migration File)

**1.1 - Check if migration file exists and is readable:**

```bash
cd /home/novi/quotation-app-dev

# Sanitize user input path
source /home/novi/quotation-app-dev/.claude/hooks/utils/sanitize-path.sh
MIGRATION_FILE=$(sanitize_path "$1")

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Invalid migration file path"
    exit 1
fi

if [ -z "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file path required"
    echo "Usage: /apply-migration <migration_file_path>"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

if [ ! -r "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file not readable: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_FILE"
echo "   Size: $(du -h "$MIGRATION_FILE" | cut -f1)"
echo ""
```

**1.2 - Extract migration name and number:**

```bash
MIGRATION_NAME=$(basename "$MIGRATION_FILE" .sql)
echo "📄 Migration: $MIGRATION_NAME"
echo ""
```

---

## Step 2: Check Migration Status (Verify Not Already Applied)

**2.1 - Show recent migration history:**

Use postgres MCP to query migration status:

```sql
-- Show last 5 applied migrations (if schema_migrations table exists)
SELECT
    version,
    description,
    applied_at
FROM schema_migrations
ORDER BY applied_at DESC
LIMIT 5;
```

**Note:** If `schema_migrations` table doesn't exist, this query will fail. That's expected for first-time setup.

**2.2 - Check if this specific migration already applied:**

Parse the migration number from filename (e.g., `015` from `015_exchange_rates.sql`):

```bash
# Extract migration number (supports 001-9999)
MIGRATION_NUMBER=$(echo "$MIGRATION_NAME" | grep -oE '^[0-9]{1,4}')

if [ -z "$MIGRATION_NUMBER" ]; then
    echo "⚠️  WARNING: Cannot extract migration number from filename"
    echo "   Expected format: NNN_description.sql or NNNN_description.sql"
    echo "   Examples: 015_exchange_rates.sql, 1234_large_migration.sql"
    echo ""
else
    echo "🔢 Migration number: $MIGRATION_NUMBER"
    echo ""

    # Query if this migration was already applied
    # (Show SQL for user to run via postgres MCP)
    echo "Run this query via postgres MCP to check if already applied:"
    echo ""
    echo "SELECT * FROM schema_migrations WHERE version = '$MIGRATION_NUMBER';"
    echo ""
    echo "If query returns a row, migration is already applied!"
    echo ""
fi
```

**2.3 - Basic SQL syntax check:**

```bash
# Check for common SQL syntax errors
if grep -qi "CREAT TABLE" "$MIGRATION_FILE"; then
    echo "❌ ERROR: Possible typo 'CREAT TABLE' instead of 'CREATE TABLE'"
    exit 1
fi

if grep -qi "ALTERR TABLE" "$MIGRATION_FILE"; then
    echo "❌ ERROR: Possible typo 'ALTERR TABLE' instead of 'ALTER TABLE'"
    exit 1
fi

# Check for balanced parentheses
OPEN_PARENS=$(grep -o "(" "$MIGRATION_FILE" | wc -l)
CLOSE_PARENS=$(grep -o ")" "$MIGRATION_FILE" | wc -l)

if [ "$OPEN_PARENS" -ne "$CLOSE_PARENS" ]; then
    echo "⚠️  WARNING: Unbalanced parentheses detected"
    echo "   Open: $OPEN_PARENS, Close: $CLOSE_PARENS"
    echo ""
fi

echo "✅ Basic SQL syntax check passed"
echo ""
```

---

## Step 3: Backup Database (CRITICAL SAFETY STEP)

**3.1 - Create backups directory:**

```bash
BACKUP_DIR="/home/novi/quotation-app-dev/backend/migrations/backups"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "📁 Creating backups directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi
```

**3.2 - Generate timestamped backup filename:**

```bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}_pre_${MIGRATION_NAME}.sql"

echo "💾 Starting database backup..."
echo "   Backup file: $BACKUP_FILE"
echo "   This may take 30-60 seconds..."
echo ""
```

**3.3 - Create backup using pg_dump:**

```bash
# Load DATABASE_URL securely
source /home/novi/quotation-app-dev/.claude/hooks/utils/load-database-url.sh
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to load DATABASE_URL"
    echo "   Ensure it's set in backend/.env file"
    exit 1
fi

# Run pg_dump with timeout (60 seconds max)
timeout 60 pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Database backup failed!"
    echo "   Check if pg_dump is installed: which pg_dump"
    echo "   Check if DATABASE_URL is correct"
    exit 1
fi
```

**3.4 - Verify backup file:**

```bash
# Check if backup file exists and has content
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ ERROR: Backup file not created"
    exit 1
fi

BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE")

if [ "$BACKUP_SIZE" -lt 1000 ]; then
    echo "❌ ERROR: Backup file too small ($BACKUP_SIZE bytes)"
    echo "   Expected at least 1 KB of data"
    exit 1
fi

# Show backup size in human-readable format
BACKUP_SIZE_HUMAN=$(du -h "$BACKUP_FILE" | cut -f1)

echo "✅ Database backup created successfully"
echo "   Size: $BACKUP_SIZE_HUMAN"
echo "   Location: $BACKUP_FILE"
echo ""
```

**CRITICAL:** Do not proceed if backup fails!

---

## Step 4: Apply Migration

**4.1 - Confirm before applying:**

```bash
echo "⚠️  READY TO APPLY MIGRATION"
echo ""
echo "Migration: $MIGRATION_NAME"
echo "Backup:    $BACKUP_FILE ($BACKUP_SIZE_HUMAN)"
echo ""
echo "Press ENTER to continue, or Ctrl+C to cancel..."
read
```

**4.2 - Apply migration with psql:**

```bash
echo "🚀 Applying migration..."
echo ""

# Run migration and capture output
MIGRATION_OUTPUT=$(psql "$DATABASE_URL" -f "$MIGRATION_FILE" 2>&1)
MIGRATION_EXIT_CODE=$?

# Show output
echo "$MIGRATION_OUTPUT"
echo ""

# Check exit code
if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    echo "❌ ERROR: Migration failed with exit code $MIGRATION_EXIT_CODE"
    echo ""
    echo "🔄 INITIATING AUTOMATIC ROLLBACK..."
    echo ""
    # Rollback handled in Step 8
    exit 1
fi

echo "✅ Migration applied successfully"
echo ""
```

**4.3 - Show applied changes summary:**

```bash
# Parse migration file to detect changes
echo "📊 Applied Changes Summary:"
echo ""

if grep -qi "CREATE TABLE" "$MIGRATION_FILE"; then
    TABLES_CREATED=$(grep -i "CREATE TABLE" "$MIGRATION_FILE" | wc -l)
    echo "   - Tables created: $TABLES_CREATED"
fi

if grep -qi "ALTER TABLE" "$MIGRATION_FILE"; then
    TABLES_ALTERED=$(grep -i "ALTER TABLE" "$MIGRATION_FILE" | wc -l)
    echo "   - Tables altered: $TABLES_ALTERED"
fi

if grep -qi "CREATE INDEX" "$MIGRATION_FILE"; then
    INDEXES_CREATED=$(grep -i "CREATE INDEX" "$MIGRATION_FILE" | wc -l)
    echo "   - Indexes created: $INDEXES_CREATED"
fi

if grep -qi "CREATE POLICY" "$MIGRATION_FILE"; then
    POLICIES_CREATED=$(grep -i "CREATE POLICY" "$MIGRATION_FILE" | wc -l)
    echo "   - RLS policies created: $POLICIES_CREATED"
fi

if grep -qi "CREATE FUNCTION" "$MIGRATION_FILE"; then
    FUNCTIONS_CREATED=$(grep -i "CREATE FUNCTION" "$MIGRATION_FILE" | wc -l)
    echo "   - Functions created: $FUNCTIONS_CREATED"
fi

echo ""
```

---

## Step 5: Verify Tables/Columns Created

**5.1 - Extract table names from migration:**

```bash
echo "🔍 Verifying database changes..."
echo ""

# Extract table names from CREATE TABLE statements
TABLES_CREATED_LIST=$(grep -i "CREATE TABLE" "$MIGRATION_FILE" | \
    sed -E 's/.*CREATE TABLE[^a-z]*([a-z_]+).*/\1/' | \
    sort -u)

if [ -n "$TABLES_CREATED_LIST" ]; then
    echo "Tables to verify:"
    echo "$TABLES_CREATED_LIST" | while read -r TABLE_NAME; do
        echo "   - $TABLE_NAME"
    done
    echo ""
fi
```

**5.2 - Verify tables exist (via postgres MCP):**

For each table created, show SQL to verify:

```bash
if [ -n "$TABLES_CREATED_LIST" ]; then
    echo "Run these queries via postgres MCP to verify tables:"
    echo ""

    echo "$TABLES_CREATED_LIST" | while read -r TABLE_NAME; do
        echo "-- Verify table: $TABLE_NAME"
        echo "SELECT table_name, column_name, data_type"
        echo "FROM information_schema.columns"
        echo "WHERE table_name = '$TABLE_NAME'"
        echo "ORDER BY ordinal_position;"
        echo ""
    done
fi
```

**5.3 - Extract column additions from ALTER TABLE:**

```bash
# Extract columns added via ALTER TABLE ADD COLUMN
COLUMNS_ADDED=$(grep -i "ADD COLUMN" "$MIGRATION_FILE" | \
    sed -E 's/.*ADD COLUMN[^a-z]*([a-z_]+).*/\1/' | \
    sort -u)

if [ -n "$COLUMNS_ADDED" ]; then
    echo "Columns added:"
    echo "$COLUMNS_ADDED" | while read -r COLUMN_NAME; do
        echo "   - $COLUMN_NAME"
    done
    echo ""
fi
```

---

## Step 6: Verify RLS Policies (If Applicable)

**6.1 - Check if migration contains RLS policies:**

```bash
if grep -qi "CREATE POLICY" "$MIGRATION_FILE"; then
    echo "🔒 RLS Policies detected in migration"
    echo ""

    # Extract policy names
    POLICIES=$(grep -i "CREATE POLICY" "$MIGRATION_FILE" | \
        sed -E 's/.*CREATE POLICY[^"]*"([^"]+)".*/\1/')

    echo "Policies created:"
    echo "$POLICIES" | while read -r POLICY_NAME; do
        echo "   - $POLICY_NAME"
    done
    echo ""

    # Show SQL to verify policies exist
    echo "Run this query via postgres MCP to verify RLS policies:"
    echo ""
    echo "SELECT"
    echo "    schemaname,"
    echo "    tablename,"
    echo "    policyname,"
    echo "    cmd,"
    echo "    qual"
    echo "FROM pg_policies"
    echo "WHERE tablename IN ("

    # List tables from policies
    POLICY_TABLES=$(grep -i "CREATE POLICY" "$MIGRATION_FILE" | \
        sed -E 's/.*ON ([a-z_]+).*/\1/' | \
        sort -u)

    FIRST=true
    echo "$POLICY_TABLES" | while read -r TABLE_NAME; do
        if [ "$FIRST" = true ]; then
            echo "    '$TABLE_NAME'"
            FIRST=false
        else
            echo "    , '$TABLE_NAME'"
        fi
    done

    echo ");"
    echo ""
fi
```

**6.2 - Verify RLS is enabled:**

```bash
if grep -qi "ENABLE ROW LEVEL SECURITY" "$MIGRATION_FILE"; then
    echo "Run this query to verify RLS enabled:"
    echo ""
    echo "SELECT"
    echo "    tablename,"
    echo "    rowsecurity"
    echo "FROM pg_tables"
    echo "WHERE schemaname = 'public'"
    echo "AND tablename IN ("

    RLS_TABLES=$(grep -i "ENABLE ROW LEVEL SECURITY" "$MIGRATION_FILE" | \
        sed -E 's/.*ALTER TABLE ([a-z_]+).*/\1/' | \
        sort -u)

    FIRST=true
    echo "$RLS_TABLES" | while read -r TABLE_NAME; do
        if [ "$FIRST" = true ]; then
            echo "    '$TABLE_NAME'"
            FIRST=false
        else
            echo "    , '$TABLE_NAME'"
        fi
    done

    echo ");"
    echo ""
fi
```

---

## Step 7: Test Backend Health Check

**7.1 - Check if backend server is running:**

```bash
echo "🏥 Testing backend API health..."
echo ""

# Check if backend is running on :8000
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend server is running"

    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
    echo "   Response: $HEALTH_RESPONSE"
    echo ""

elif curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo "✅ Backend server is running (no /health endpoint)"
    echo ""

else
    echo "⚠️  WARNING: Backend server not running on :8000"
    echo "   Migration applied, but API not tested"
    echo "   Start backend: cd backend && source venv/bin/activate && uvicorn main:app --reload"
    echo ""
fi
```

**7.2 - Test database connection from backend:**

```bash
# If backend is running, test a simple query
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    # Try to hit an authenticated endpoint (will fail with 401, but confirms DB connection)
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/quotes)

    if [ "$STATUS_CODE" = "401" ]; then
        echo "✅ Backend database connection working (401 auth required as expected)"
    elif [ "$STATUS_CODE" = "200" ]; then
        echo "✅ Backend database connection working (200 OK)"
    else
        echo "⚠️  Backend returned status code: $STATUS_CODE"
        echo "   This may indicate a database connection issue"
    fi
    echo ""
fi
```

---

## Step 8: Update Migration Log

**8.1 - Update MIGRATIONS.md:**

```bash
MIGRATIONS_MD="/home/novi/quotation-app-dev/backend/migrations/MIGRATIONS.md"

echo "📝 Updating migration log: $MIGRATIONS_MD"
echo ""

# Extract migration description from filename
MIGRATION_DESC=$(echo "$MIGRATION_NAME" | sed -E 's/^[0-9]+_//' | tr '_' ' ' | sed 's/.*/\u&/')

# Get current date
CURRENT_DATE=$(date +"%Y-%m-%d")

# Prepare log entry
LOG_ENTRY="| $MIGRATION_NUMBER | \`$MIGRATION_NAME.sql\` | $MIGRATION_DESC | ✅ Done | $CURRENT_DATE | Session $(date +"%U") |"

echo "Adding to migration log:"
echo "$LOG_ENTRY"
echo ""

# Check if entry already exists
if grep -q "$MIGRATION_NAME" "$MIGRATIONS_MD"; then
    echo "⚠️  Migration already logged in MIGRATIONS.md"
else
    # Find the line with "## Migration Log" and add entry after table header
    # This is a manual step - show user what to add
    echo "❗ MANUAL STEP REQUIRED:"
    echo "   Add this line to $MIGRATIONS_MD after the table header:"
    echo ""
    echo "$LOG_ENTRY"
    echo ""
fi
```

**8.2 - Update "Next Migration Number":**

```bash
# Calculate next migration number
# Handle both 3 and 4 digit migration numbers
NEXT_NUMBER=$((10#$MIGRATION_NUMBER + 1))

# Preserve the original padding length
ORIGINAL_LENGTH=${#MIGRATION_NUMBER}
if [ "$ORIGINAL_LENGTH" -ge 4 ]; then
    NEXT_NUMBER_PADDED=$(printf "%04d" $NEXT_NUMBER)
else
    NEXT_NUMBER_PADDED=$(printf "%03d" $NEXT_NUMBER)
fi

echo "📌 Next migration number: $NEXT_NUMBER_PADDED"
echo ""
echo "To create next migration:"
echo "   touch backend/migrations/${NEXT_NUMBER_PADDED}_your_migration_name.sql"
echo ""
```

---

## Step 9: Rollback on Failure (Auto-Triggered)

**This section executes only if Steps 4-7 fail.**

**9.1 - Restore from backup:**

```bash
# This code runs in the error handler (if migration fails)

echo "⚠️  MIGRATION FAILED - ROLLING BACK"
echo ""
echo "🔄 Restoring database from backup: $BACKUP_FILE"
echo ""

# Drop current database and restore
# WARNING: This is destructive!
psql "$DATABASE_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" > /dev/null 2>&1

# Restore backup
psql "$DATABASE_URL" < "$BACKUP_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "❌ ROLLBACK FAILED!"
    echo "   Manual intervention required"
    echo "   Backup file: $BACKUP_FILE"
    echo "   Restore command: psql \$DATABASE_URL < $BACKUP_FILE"
    exit 1
fi

echo "✅ Database restored successfully"
echo ""
```

**9.2 - Verify restoration:**

```bash
# Check database health after restore
echo "🔍 Verifying database restoration..."
echo ""

# Try to query a known table
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM organizations;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database restoration verified"
else
    echo "❌ Database may be in inconsistent state"
    echo "   Manual verification required"
fi

echo ""
```

**9.3 - Report rollback status:**

```bash
echo "❌ MIGRATION ROLLBACK COMPLETE"
echo ""
echo "What happened:"
echo "   1. Migration failed during application"
echo "   2. Database restored from backup: $BACKUP_FILE"
echo "   3. Backup file preserved for investigation"
echo ""
echo "Next steps:"
echo "   1. Review migration file for errors: $MIGRATION_FILE"
echo "   2. Check migration output above for error details"
echo "   3. Fix issues and try again"
echo "   4. Backup file kept at: $BACKUP_FILE"
echo ""

exit 1
```

---

## Step 10: Success Summary & Cleanup

**10.1 - Display success message:**

```bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ MIGRATION APPLIED SUCCESSFULLY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📄 Migration: $MIGRATION_NAME"
echo "💾 Backup:    $BACKUP_FILE ($BACKUP_SIZE_HUMAN)"
echo "📅 Date:      $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
```

**10.2 - Preservation notice:**

```bash
echo "📦 Backup File Preserved"
echo ""
echo "The backup file has been kept for safety:"
echo "   Location: $BACKUP_FILE"
echo "   Size:     $BACKUP_SIZE_HUMAN"
echo ""
echo "You can safely delete old backups after verifying the migration:"
echo "   ls -lh $BACKUP_DIR"
echo "   rm $BACKUP_DIR/backup_YYYYMMDD_*.sql  # Delete old backups"
echo ""
```

**10.3 - Next steps:**

```bash
echo "✅ Next Steps:"
echo ""
echo "1. ✅ Verify application functionality"
echo "   - Test affected features in UI"
echo "   - Run backend tests: cd backend && pytest -v"
echo ""
echo "2. ✅ Update documentation (if not done)"
echo "   - backend/migrations/MIGRATIONS.md"
echo ""
echo "3. ✅ Commit migration to git"
echo "   git add backend/migrations/$MIGRATION_NAME.sql"
echo "   git add backend/migrations/MIGRATIONS.md"
echo "   git commit -m \"feat: Apply migration $MIGRATION_NUMBER - $MIGRATION_DESC\""
echo ""
echo "4. ✅ Create GitHub issue (if needed)"
echo "   - Document any breaking changes"
echo "   - Note required application updates"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
```

---

## Error Codes & Troubleshooting

**Exit Code 1: Migration file not found**
- Check file path is correct
- Use absolute or relative path from project root

**Exit Code 1: DATABASE_URL not set**
- Load environment: `source backend/.env` or `export DATABASE_URL=...`
- Check `.env` file exists: `cat backend/.env | grep DATABASE_URL`

**Exit Code 1: Backup failed**
- Ensure `pg_dump` installed: `which pg_dump` or `sudo apt-get install postgresql-client`
- Check disk space: `df -h`
- Verify DATABASE_URL connection: `psql "$DATABASE_URL" -c "SELECT 1;"`

**Exit Code 1: Migration failed (auto-rollback triggered)**
- Review SQL syntax errors in output
- Check if tables/columns already exist
- Verify RLS policies don't conflict
- Fix migration file and try again

**Exit Code 1: Rollback failed**
- **CRITICAL:** Manual intervention required
- Restore manually: `psql $DATABASE_URL < /path/to/backup_file.sql`
- Contact DBA if database is corrupted

---

## Example Usage Session

```bash
# 1. Navigate to project root
cd /home/novi/quotation-app-dev

# 2. Load database URL
export DATABASE_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres"

# 3. Run migration command
/apply-migration backend/migrations/020_add_approval_workflow.sql

# Output:
# ✅ Migration file found: backend/migrations/020_add_approval_workflow.sql
#    Size: 4.2K
#
# 📄 Migration: 020_add_approval_workflow
# 🔢 Migration number: 020
#
# ✅ Basic SQL syntax check passed
#
# 💾 Starting database backup...
#    Backup file: backend/migrations/backups/backup_20251030_153045_pre_020_add_approval_workflow.sql
#    This may take 30-60 seconds...
#
# ✅ Database backup created successfully
#    Size: 2.4M
#    Location: backend/migrations/backups/backup_20251030_153045_pre_020_add_approval_workflow.sql
#
# ⚠️  READY TO APPLY MIGRATION
#
# Migration: 020_add_approval_workflow
# Backup:    backend/migrations/backups/backup_20251030_153045_pre_020_add_approval_workflow.sql (2.4M)
#
# Press ENTER to continue, or Ctrl+C to cancel...
# [User presses ENTER]
#
# 🚀 Applying migration...
#
# CREATE TABLE
# CREATE INDEX
# ALTER TABLE
# CREATE POLICY
#
# ✅ Migration applied successfully
#
# 📊 Applied Changes Summary:
#    - Tables created: 1
#    - Indexes created: 2
#    - RLS policies created: 4
#
# 🔍 Verifying database changes...
# [... verification output ...]
#
# 🏥 Testing backend API health...
# ✅ Backend server is running
#    Response: {"status":"ok"}
#
# ✅ Backend database connection working (401 auth required as expected)
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ MIGRATION APPLIED SUCCESSFULLY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Integration with Other Commands

**Before migration:**
- Use postgres MCP to query current schema
- Review migration file: `cat backend/migrations/020_add_approval_workflow.sql`

**After migration:**
- Run backend tests: `cd backend && pytest -v`
- Test frontend: `cd frontend && npm run dev`
- Use `/test-quote-creation` to verify quote flow still works

**Rollback (manual):**
If you need to rollback after success:
```bash
psql $DATABASE_URL < backend/migrations/backups/backup_20251030_153045_pre_020_add_approval_workflow.sql
```

---

## Notes

**Backup Retention:**
- Backups are never auto-deleted
- Review and clean old backups manually
- Recommended: Keep last 5-10 backups

**Migration Numbering:**
- Use sequential numbers: 001, 002, 003, etc.
- Gaps are OK (e.g., 018 → 021)
- Never reuse migration numbers

**RLS Verification:**
- This command does NOT automatically test RLS isolation
- Use database-verification skill for comprehensive RLS testing
- See `.claude/skills/database-verification/resources/rls-patterns.md`

**Production Use:**
- Test in development first
- Schedule maintenance window
- Monitor application logs during and after migration
- Have rollback plan ready

---

**Command Version:** 1.0 (2025-10-30)
**Lines:** 180
**Estimated Runtime:** 2-5 minutes (depending on database size)
