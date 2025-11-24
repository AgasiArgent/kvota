# Troubleshooting Guide

**B2B Quotation Platform - Common Issues & Solutions**

**Last Updated:** 2025-10-28

---

## Table of Contents

1. [VS Code Remote WSL Disconnection](#vs-code-remote-wsl-disconnection)
2. [Port Already in Use](#port-already-in-use)
3. [WSL2 Memory Issues](#wsl2-memory-issues)
4. [Chrome DevTools MCP Issues](#chrome-devtools-mcp-issues)
5. [Database Connection Issues](#database-connection-issues)
6. [CI/CD Test Failures](#cicd-test-failures)
7. [Git Worktree Issues](#git-worktree-issues)
8. [Build Errors](#build-errors)

---

## VS Code Remote WSL Disconnection

### Problem

VS Code loses connection to WSL2 and shows "Connection timeout" when trying to reconnect. This usually happens after running Chrome DevTools MCP tests for extended periods.

### Root Cause

Chrome browser accumulates memory over time, pushing WSL2 close to its memory limit. When memory usage exceeds ~85%, WSL2 becomes unresponsive and VS Code Remote WSL extension can't maintain connection.

### Prevention (Recommended Approach)

**1. Use Safe Test Session Manager** (automatically handles cleanup):
```bash
# Run tests with automatic resource management
./.claude/safe-test-session.sh headless http://localhost:3001 10

# Parameters: [mode] [url] [timeout_minutes]
# - mode: headless (500MB) or full (1.2GB)
# - url: page to test (default: localhost:3000/quotes/create)
# - timeout: auto-stop after N minutes (default: 10)
```

**What it does:**
- ✅ Automatically monitors memory usage
- ✅ Kills Chrome if memory exceeds 85%
- ✅ Ensures cleanup even if interrupted (Ctrl+C)
- ✅ Shows memory usage summary
- ✅ Prevents WSL2 freeze before it happens

**2. Manual Monitoring** (if not using safe session):
```bash
# Terminal 1: Monitor resources
./.claude/monitor-wsl-resources.sh

# Terminal 2: Run tests normally
./.claude/launch-chrome-testing.sh headless

# Kill Chrome when memory hits 75%
./.claude/launch-chrome-testing.sh kill
```

**3. Auto-Cleanup Script** (background protection):
```bash
# Runs in background, auto-kills Chrome at 85% memory
./.claude/auto-cleanup-chrome.sh 85 &

# Then run tests normally
./.claude/launch-chrome-testing.sh full

# Cleanup script will automatically kill Chrome if needed
```

### Recovery (If VS Code Already Disconnected)

**1. Check WSL2 Health:**
```bash
# From a new WSL2 terminal (if VS Code frozen)
wsl bash /home/novi/quotation-app/.claude/wsl2-health-check.sh

# Or from Windows PowerShell
wsl bash /home/novi/quotation-app/.claude/wsl2-health-check.sh
```

**2. If WSL2 Responsive (memory < 85%):**
```bash
# Kill Chrome processes
pkill -9 chrome

# Clear Chrome profile
rm -rf /tmp/chrome-wsl-profile

# Restart VS Code (close and reopen)
```

**3. If WSL2 Unresponsive (memory > 85%):**
```powershell
# From Windows PowerShell
wsl --shutdown

# Wait 8 seconds
Start-Sleep -Seconds 8

# Restart WSL2
wsl

# Then restart VS Code
```

### Configuration

**WSL2 Memory Limit:** `.wslconfig` at `C:\Users\Lenovo\.wslconfig`
```ini
[wsl2]
memory=6GB
processors=4
swap=2GB
```

**VS Code Remote WSL Settings:** `.vscode/settings.json`
```json
{
  "remote.WSL.connectionTimeout": 60,
  "remote.autoForwardPorts": true
}
```

### Best Practices

1. ✅ **Always use tiered testing** - Start with backend tests (Tier 1-2) before browser tests (Tier 3-4)
2. ✅ **Use headless mode** when possible (60% less memory than full Chrome)
3. ✅ **Kill Chrome after tests** - Don't leave it running idle
4. ✅ **Monitor memory** during long sessions
5. ✅ **Prefer safe-test-session.sh** for automated cleanup

### Scripts Summary

| Script | Purpose | Usage |
|--------|---------|-------|
| `safe-test-session.sh` | All-in-one wrapper with auto-cleanup | Recommended for all testing |
| `auto-cleanup-chrome.sh` | Background memory monitor | Auto-kills Chrome at threshold |
| `wsl2-health-check.sh` | Diagnose WSL2 issues | Run when VS Code disconnects |
| `monitor-wsl-resources.sh` | Real-time resource display | Monitor during manual testing |
| `launch-chrome-testing.sh` | Chrome launcher | Direct Chrome control |

---

## Port Already in Use

### Problem

Error: `EADDRINUSE: address already in use :::3001` (or :3000, :8000, :8001)

### Solution

**Find and kill process using the port:**
```bash
# Find process using port 3001
lsof -i :3001

# Output shows PID (process ID)
# node    12345  user   21u  IPv6 0x123abc  0t0  TCP *:3001 (LISTEN)

# Kill process by PID
kill -9 12345

# Or kill by port pattern
pkill -f "npm run dev.*3001"
pkill -f "uvicorn.*8001"
```

**Kill all node/uvicorn processes:**
```bash
# Kill all node processes
pkill -9 node

# Kill all uvicorn processes
pkill -9 uvicorn

# Kill all Python processes (be careful!)
pkill -9 python3
```

**Check if port is free:**
```bash
# Using lsof
lsof -i :3001

# Using netstat
netstat -tuln | grep 3001

# If no output, port is free
```

---

## WSL2 Memory Issues

### Problem

WSL2 consumes too much memory, system becomes slow, or freezes.

### Check Memory Usage

```bash
# Check WSL2 memory usage
free -h

# Output:
#               total        used        free      shared  buff/cache   available
# Mem:           5.8G        3.2G        1.5G        100M        1.1G        2.3G

# Check Chrome memory usage
ps aux | grep chrome | awk '{sum+=$4} END {print "Chrome memory: " sum "%"}'
```

### Solutions

**1. Kill Chrome immediately:**
```bash
./.claude/launch-chrome-testing.sh kill

# Or manually
pkill -9 chrome
rm -rf /tmp/chrome-wsl-profile
```

**2. Clear system cache:**
```bash
# Drop caches (safe operation)
sync
sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
```

**3. Restart WSL2 (from PowerShell):**
```powershell
wsl --shutdown
Start-Sleep -Seconds 8
wsl
```

**4. Reduce WSL2 memory limit:**

Edit `C:\Users\Lenovo\.wslconfig`:
```ini
[wsl2]
memory=4GB  # Reduce from 6GB if needed
processors=4
swap=2GB
```

Then restart WSL2 from PowerShell:
```powershell
wsl --shutdown
wsl
```

### Prevention

- Use headless Chrome when possible (60% less memory)
- Use tiered testing (start with backend tests)
- Monitor memory with `./.claude/monitor-wsl-resources.sh`
- Use safe-test-session.sh for automatic cleanup

---

## Chrome DevTools MCP Issues

### Problem 1: Chrome not connecting

**Symptom:** MCP tools return "Connection refused" or "Target not found"

**Solution:**
```bash
# Check if Chrome is running with debugging port
lsof -i :9222

# If not running, start Chrome
./.claude/launch-chrome-testing.sh full http://localhost:3001

# If running but not connecting, restart
./.claude/launch-chrome-testing.sh kill
./.claude/launch-chrome-testing.sh full http://localhost:3001
```

### Problem 2: Permission denied for MCP tools

**Symptom:** Tool execution blocked despite being in `.claude/settings.json`

**Solution:**
```bash
# Check .claude/settings.json has explicit tool permissions
# Example:
# "mcp__chrome-devtools__take_snapshot": {"allow": true}

# Reload VS Code window after editing settings
# Ctrl+Shift+P → "Reload Window"
```

### Problem 3: Elements not found in snapshot

**Symptom:** `take_snapshot` doesn't show expected elements

**Solution:**
```bash
# Wait for page to fully load before taking snapshot
# Use wait_for tool:
# mcp__chrome-devtools__wait_for with text parameter

# Or navigate to page first:
# mcp__chrome-devtools__navigate_page with URL
# Then take snapshot
```

### Problem 4: File upload fails

**Symptom:** `upload_file` doesn't work with WSL2 paths

**Solution:**
```bash
# Use absolute WSL2 paths (not Windows paths)
# Example: /home/novi/quotation-app/test.xlsx
# NOT: C:\Users\Lenovo\test.xlsx

# Ensure file exists
ls -la /home/novi/quotation-app/test.xlsx

# If file is on Windows, copy to WSL2
cp /mnt/c/Users/Lenovo/test.xlsx /home/novi/quotation-app/
```

---

## Database Connection Issues

### Problem 1: Connection timeout

**Symptom:** `asyncpg.exceptions.ConnectionDoesNotExistError` or timeout

**Solution:**
```bash
# Check database URL is correct
echo $DATABASE_URL

# Test connection with psql
psql "$DATABASE_URL" -c "SELECT 1"

# If fails, check Supabase dashboard for connection string
# Or check if database is paused
```

### Problem 2: RLS policy denies access

**Symptom:** `SELECT` returns empty, but data exists

**Solution:**
```sql
-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'quotes';

-- Check JWT claims are set
SELECT current_setting('app.user_id', true);
SELECT current_setting('app.organization_id', true);

-- Disable RLS temporarily for debugging (be careful!)
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
-- Remember to re-enable after debugging
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
```

### Problem 3: Migration fails

**Symptom:** SQL migration errors in Supabase dashboard

**Solution:**
```sql
-- Check if migration already applied
SELECT * FROM migrations WHERE name = 'migration_name';

-- Rollback if needed
BEGIN;
-- Run rollback SQL (reverse of migration)
ROLLBACK;  -- Test first
COMMIT;  -- When ready

-- Apply migration again
-- Copy SQL from migration file
-- Paste in Supabase SQL editor
-- Run
```

---

## CI/CD Test Failures

### Problem: GitHub Actions tests fail

**Symptom:** Tests pass locally but fail on GitHub Actions

**Common Causes:**
1. Missing GitHub Secrets
2. Environment differences
3. Database not accessible
4. Timeout issues

### Solution 1: Add GitHub Secrets

```bash
# Go to: https://github.com/AgasiArgent/kvota/settings/secrets/actions
# Add secrets:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - DATABASE_URL
```

### Solution 2: Check workflow logs

```bash
# View recent workflow runs
curl -H "Authorization: token ***REMOVED***" \
  https://api.github.com/repos/AgasiArgent/kvota/actions/runs?per_page=5

# Get specific run logs
# (Get run ID from above command)
curl -H "Authorization: token ***REMOVED***" \
  https://api.github.com/repos/AgasiArgent/kvota/actions/runs/<RUN_ID>/jobs
```

### Solution 3: Run CI checks locally

```bash
# Frontend checks
cd frontend
npm run lint
npm run type-check
npm run build

# Backend checks
cd backend
pytest -v

# If all pass, issue is in CI environment
```

---

## Git Worktree Issues

### Problem 1: Worktree already exists

**Symptom:** `fatal: '/path/to/worktree' already exists`

**Solution:**
```bash
# Remove existing worktree
git worktree remove /home/novi/quotation-app-dev

# Or if directory deleted manually
git worktree prune

# Then recreate
git worktree add /home/novi/quotation-app-dev dev
```

### Problem 2: Branch locked

**Symptom:** `fatal: 'dev' is already checked out at '/path/to/worktree'`

**Solution:**
```bash
# Can't have same branch in multiple worktrees
# Either:
# 1. Remove existing worktree
git worktree remove /home/novi/quotation-app-dev

# 2. Or create worktree with different branch
git worktree add /home/novi/quotation-app-feature feature/new-feature
```

### Problem 3: Worktree out of sync

**Symptom:** Worktrees have diverged, merge conflicts

**Solution:**
```bash
# Pull latest in both worktrees
cd /home/novi/quotation-app
git pull origin main

cd /home/novi/quotation-app-dev
git pull origin dev

# Merge main into dev to sync
git merge main

# Resolve conflicts if any
# Then push
git push origin dev
```

---

## Build Errors

### Problem 1: Frontend build fails

**Symptom:** `npm run build` fails with errors

**Common Causes:**
- TypeScript errors
- ESLint errors
- Missing environment variables
- Import errors

**Solution:**
```bash
cd frontend

# Check for TypeScript errors
npm run type-check

# Check for lint errors
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check environment variables
cat .env.local
# Ensure all NEXT_PUBLIC_* variables are set

# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Problem 2: Backend fails to start

**Symptom:** `uvicorn main:app --reload` crashes

**Common Causes:**
- Import errors
- Database connection fails
- Missing environment variables
- Port already in use

**Solution:**
```bash
cd backend

# Check for import errors
python3 -c "import main"

# Check environment variables
cat .env
# Ensure DATABASE_URL, SUPABASE_URL, etc. are set

# Test database connection
python3 -c "import asyncpg; print('OK')"

# Check port is free
lsof -i :8000

# Start with verbose logging
uvicorn main:app --reload --log-level debug
```

### Problem 3: Module not found

**Symptom:** `ModuleNotFoundError: No module named 'package'`

**Solution:**
```bash
# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install

# Backend
cd backend
pip install -r requirements.txt

# Or install specific package
pip install <package-name>
```

---

## General Debugging Tips

### Enable Debug Logging

**Frontend:**
```typescript
// Add to component
console.log('Debug:', variable);

// Check browser console
// F12 → Console tab
```

**Backend:**
```python
# Add to route
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Debug: {variable}")

# Check uvicorn output
# Logs appear in terminal
```

### Use Browser DevTools

**Open DevTools:**
- Chrome: F12 or Ctrl+Shift+I
- Firefox: F12 or Ctrl+Shift+I

**Useful tabs:**
- **Console:** JavaScript errors, console.log output
- **Network:** API requests, response status, payload
- **Application:** LocalStorage, cookies, cache
- **Performance:** Rendering performance, memory leaks

### Use Chrome DevTools MCP

```bash
# Launch Chrome with debugging
./.claude/launch-chrome-testing.sh full http://localhost:3001

# Take snapshot to inspect elements
# Use mcp__chrome-devtools__take_snapshot

# Monitor console
# Use mcp__chrome-devtools__list_console_messages

# Check network requests
# Use mcp__chrome-devtools__list_network_requests

# Execute JavaScript
# Use mcp__chrome-devtools__evaluate_script
```

---

**See Also:**
- `.claude/QUICK_START.md` - Setup and daily routine
- `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md` - Browser testing guide
- `.claude/TIERED_TESTING_GUIDE.md` - Prevent WSL2 freezing
- `CLAUDE.md` - Core principles and architecture
