# Slash Commands Directory

Custom slash commands for Claude Code automation.

## Available Commands

### /apply-migration

**Purpose:** Safely apply database migrations with automatic backup and rollback

**Duration:** ~2-5 minutes (depending on database size)

**What it does:**
1. Pre-flight checks (file exists, syntax validation, migration status)
2. Creates timestamped database backup (~30s)
3. Applies migration with error capture
4. Verifies tables/columns/RLS policies created
5. Tests backend health check
6. Updates MIGRATIONS.md
7. Auto-rollback on any failure
8. Preserves backup file for safety

**Usage:**
```
/apply-migration backend/migrations/020_add_approval_workflow.sql
```

**Prerequisites:**
- `pg_dump` and `psql` installed in WSL2
- DATABASE_URL environment variable set
- Migration file tested locally
- Backend can be temporarily stopped if needed

**Safety Features:**
- 🔄 Automatic backup before applying
- ⚠️ Auto-rollback on failure
- 🔒 Verification of migration success
- 📝 Automatic documentation update
- 🚫 Prevents duplicate application

**Output:** Success summary with verification results, or rollback report on failure

**File:** `apply-migration.md` (843 lines)

---

### /test-quote-creation

**Purpose:** Automate complete quote creation E2E testing workflow

**Duration:** ~5 minutes

**What it does:**
1. Checks servers (backend :8000, frontend :3000)
2. Runs backend unit tests (23 tests)
3. Checks WSL2 memory safety
4. Launches Chrome headless
5. Executes browser workflow (login, select customer, add product, fill fields, save)
6. Verifies database (quote saved with calculations)
7. Generates test report
8. Cleans up (kills Chrome)

**Usage:**
```
/test-quote-creation
```

**Prerequisites:**
- Backend running on :8000
- Frontend running on :3000
- Test user: andrey@masterbearingsales.ru / password
- WSL2 memory < 60%
- Chrome installed

**Output:** Comprehensive test report with pass/fail status

**File:** `test-quote-creation.md` (799 lines)

---

## How Slash Commands Work

1. User types: `/command-name`
2. Claude Code expands the markdown file
3. Claude executes the instructions in the file
4. Results are returned to user

## Creating New Commands

1. Create file: `.claude/commands/my-command.md`
2. Write instructions in markdown format
3. Include:
   - Header with purpose and usage
   - Step-by-step instructions
   - Expected outputs
   - Error handling
   - Troubleshooting
4. User can invoke with: `/my-command`

## Command Conventions

- **Filename:** `kebab-case.md`
- **Format:** Markdown
- **Structure:** Header → Steps → Troubleshooting → Documentation links
- **Error handling:** Include exit codes and failure scenarios
- **Cleanup:** Always include cleanup steps
- **Documentation:** Link to related docs

## Examples

### Simple Command
```markdown
# My Command

**Purpose:** Do something useful

## Steps

1. Check prerequisites
2. Execute operation
3. Verify result
4. Clean up

## Expected Output
[...]

## Troubleshooting
[...]
```

### Complex Command (like test-quote-creation)
```markdown
# My Complex Command

**Purpose:** [...]
**Duration:** [...]

## What This Command Does
[...]

## Prerequisites
[...]

## Usage
[...]

## Command Steps (Detailed)

### Step 1: [...]
[...]

### Step 2: [...]
[...]

[... more steps ...]

## Success Criteria
[...]

## Report Generation
[...]

## Cleanup Recommendations
[...]

## Troubleshooting

### Problem: [...]
**Solution:** [...]

[... more problems ...]

## Performance Notes
[...]

## Related Documentation
[...]
```

---

## Security Best Practices

### Credential Management

**Environment Variables:**
- Store sensitive data (DATABASE_URL, API tokens) in `.env` files
- Never commit `.env` files to git
- Use secure utilities to load credentials:
  ```bash
  source .claude/hooks/utils/load-database-url.sh
  ```

**GitHub Token:**
- Set as environment variable: `export GITHUB_TOKEN="your_token"`
- Never hardcode tokens in scripts
- Use in scripts as: `$GITHUB_TOKEN` or `${GITHUB_TOKEN}`

**File Permissions:**
- Credential files should have restricted permissions:
  ```bash
  chmod 600 backend/.env  # Owner read/write only
  ```

### Input Validation

**Path Sanitization:**
- Always sanitize user-provided file paths:
  ```bash
  source .claude/hooks/utils/sanitize-path.sh
  SAFE_PATH=$(sanitize_path "$USER_INPUT")
  ```
- Prevents directory traversal attacks (`../`)
- Prevents command injection

**Command Safety:**
- Check tool availability before use:
  ```bash
  if ! command -v lsof &> /dev/null; then
      echo "Tool not available, using alternative..."
  fi
  ```
- Use timeout for long-running commands:
  ```bash
  timeout 60 pg_dump "$DATABASE_URL" > backup.sql
  ```

### Security Utilities

**Available Utilities:**

1. **load-database-url.sh**
   - Location: `.claude/hooks/utils/load-database-url.sh`
   - Purpose: Securely loads DATABASE_URL from .env
   - Features:
     - Checks file permissions
     - Prevents credential exposure
     - Falls back gracefully

2. **sanitize-path.sh**
   - Location: `.claude/hooks/utils/sanitize-path.sh`
   - Purpose: Validates and sanitizes file paths
   - Features:
     - Removes dangerous characters
     - Prevents directory traversal
     - Ensures paths stay within project

### Error Handling

**Exit Codes:**
- Always check command success:
  ```bash
  if [ $? -ne 0 ]; then
      echo "Command failed"
      exit 1
  fi
  ```

**Rollback on Failure:**
- Create backups before destructive operations
- Implement automatic rollback on errors
- Example: apply-migration.md auto-rollback feature

### Platform Compatibility

**Cross-Platform Support:**
- Check for GNU vs BSD tools:
  ```bash
  if date --version 2>&1 | grep -q GNU; then
      # GNU date (Linux/WSL2)
  else
      # BSD date (macOS) or use Python fallback
  fi
  ```

**Tool Availability:**
- Always provide fallback methods:
  ```bash
  if ! command -v lsof &> /dev/null; then
      netstat -tuln | grep :8000  # Alternative
  fi
  ```

---

**Last Updated:** 2025-10-30
