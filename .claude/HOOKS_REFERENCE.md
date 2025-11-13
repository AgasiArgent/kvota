# Hooks System Reference

Comprehensive reference for the automated quality checks system that runs at key points in the development workflow.

**Created:** 2025-10-30
**Last Updated:** 2025-10-30
**Version:** 1.0.0
**Lines:** 870

---

## Overview

### What Are Hooks?

Hooks are **automated quality check scripts** that run at specific trigger points in your development workflow:

- **Pre-commit:** Runs automatically before `git commit` (catches errors early)
- **WSL2 Pre-flight:** Runs before resource-intensive operations (prevents freezing)
- **Post-feature:** Runs manually after completing a feature (quality gates)
- **Build verification:** Runs manually or in CI/CD (ensures production readiness)

### Why Hooks Exist

**Problems Solved:**
- **Catching errors early** - Before they reach codebase
- **WSL2 stability** - Prevents memory exhaustion and system freezing
- **Consistent quality** - Enforces standards automatically
- **Manual checking fatigue** - Automates repetitive verification

**Benefits:**
- **Zero errors committed** - Syntax/type errors caught before commit
- **WSL2 safety** - Memory checks prevent freezing during tests
- **Automated quality gates** - Tests, docs, patterns verified automatically
- **Time savings** - No manual "did I forget to..." checks

### When Hooks Run

**Automatic Triggers:**
- `git commit` → pre-commit hook runs
- Chrome launch → WSL2 pre-flight check runs

**Manual Triggers:**
- After feature complete → post-feature hook
- Before deployment → build verification hook

### Integration

Hooks are managed by **Husky v10** for git hooks, with custom scripts for non-git triggers.

### Execution Order

When multiple hooks could trigger, they execute in this priority:
1. **WSL2 Pre-flight** - Always runs first (prevents system freeze)
2. **Pre-commit** - Runs on git commit (catches errors early)
3. **Post-feature** - Manual trigger after feature complete
4. **Build Verification** - Manual or CI/CD (final verification)

Note: Only one hook runs at a time. Pre-commit won't run if WSL2 memory is critical.

---

## Available Hooks

### 1. Pre-commit Hook

**Purpose:** Catch errors before they're committed to git repository

**When it runs:** Automatically on `git commit`

**Location:**
- Git hook: `.husky/pre-commit`
- Backend script: `.claude/hooks/backend-syntax-check.sh`
- Frontend: `npm run lint-staged` (via Husky)

**Checks Performed:**

**Frontend (via lint-staged):**
- ESLint errors on staged files
- Prettier formatting on staged files
- TypeScript type checking

**Backend (via backend-syntax-check.sh):**
- Python syntax validation (`python3 -m compileall`)
- Critical import validation (main.py, auth.py, models.py)
- Optional: Type checking with mypy (if enabled)
- Optional: Security scanning with bandit (if enabled)
- Optional: Complexity analysis with radon (if enabled)

**How to run manually:**
```bash
# Backend only
./.claude/hooks/backend-syntax-check.sh

# Enable all backend checks
./.claude/hooks/backend-syntax-check.sh --enable-all

# Enable type checking only
./.claude/hooks/backend-syntax-check.sh --enable-mypy

# Frontend only (from frontend/ directory)
npm run lint-staged
```

**How to skip (emergency only):**
```bash
git commit --no-verify -m "Emergency fix"
```

**Warning:** Only use `--no-verify` for true emergencies. Skipping checks can introduce bugs.

**Configuration:**
- `.husky/pre-commit` - Git hook that calls scripts
- `.claude/hooks/config.conf` - Hook behavior settings
- `frontend/.lintstagedrc.json` - Lint-staged configuration

**Exit Codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend Quality Checks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Python Syntax passed (2s)
✓ Import Validation passed (3s)

Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Passed:  2
Failed:  0
Skipped: 0
Duration: 5 seconds
```

---

### 2. WSL2 Pre-flight Check

**Purpose:** Prevent WSL2 freezing during resource-intensive operations

**When it runs:** Before launching Chrome for browser tests

**Location:**
- `.claude/hooks/utils/check-memory.sh` - Memory usage monitor
- `.claude/hooks/utils/check-chrome.sh` - Chrome process cleanup

**Checks Performed:**

**Memory Check (check-memory.sh):**
- Checks WSL2 memory usage percentage
- Typical WSL2 allocation: 8-16 GB (50% of host RAM)
- Thresholds:
  - **< 60%** - OK, proceed (< 4.8 GB of 8 GB typical)
  - **60-74%** - Warning, consider cleanup (4.8-5.9 GB)
  - **75-89%** - Critical, recommend cleanup (6.0-7.1 GB)
  - **≥ 90%** - Block, must cleanup first (≥ 7.2 GB)
- Shows memory breakdown (total, used, free, available)
- Chrome typically uses 1-2 GB, tests add 0.5-1 GB

**Chrome Check (check-chrome.sh):**
- Detects running Chrome/Chromium processes
- Counts total processes and memory usage
- Offers to kill processes if found
- Verifies cleanup successful

**How to run manually:**
```bash
# Check memory
./.claude/hooks/utils/check-memory.sh

# Check with custom thresholds
./.claude/hooks/utils/check-memory.sh --warning 50 --critical 70

# Show detailed memory breakdown
./.claude/hooks/utils/check-memory.sh --details

# Check Chrome processes
./.claude/hooks/utils/check-chrome.sh

# Kill Chrome processes automatically
./.claude/hooks/utils/check-chrome.sh --kill

# Get JSON output for automation
./.claude/hooks/utils/check-memory.sh --json
```

**How to fix high memory:**
```bash
# Kill Chrome processes
./.claude/hooks/utils/check-chrome.sh --kill

# Restart WSL2 (clears all memory)
wsl --shutdown
# Wait 8 seconds, then restart terminal
```

**Configuration:**
Environment variables in shell or config:
- `MEMORY_WARNING_THRESHOLD` - Warning % (default: 60)
- `MEMORY_CRITICAL_THRESHOLD` - Critical % (default: 75)

**Exit Codes:**
- `0` - Memory OK (< warning threshold)
- `1` - Warning level (cleanup recommended)
- `2` - Critical level (cleanup required)

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WSL2 Memory Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Memory Usage: 45%
Status: OK

Total:     12.5 GB
Used:      5.6 GB
Free:      6.9 GB
Available: 8.2 GB
```

---

### 3. Post-feature Hook

**Purpose:** Quality gates after completing a feature

**When it runs:** Manually after feature development complete

**Location:** `.claude/hooks/post-feature.sh`

**Checks Performed:**

**Test Execution:**
- Backend unit tests (pytest)
- Frontend tests (npm test)
- Verification all tests pass

**Documentation Verification:**
- Check if CLAUDE.md updated
- Check if SESSION_PROGRESS.md updated
- Warn if files modified but docs not updated

**Code Quality:**
- Check for TODO comments in staged files
- Verify no console.log in production code
- Check for debugging statements

**Optional Orchestrator Trigger:**
- If configured in `orchestrator-config.json`
- Automatically invokes @orchestrator
- Runs QA, Security, Code Review in parallel

**How to run manually:**
```bash
./.claude/hooks/post-feature.sh

# Verbose output
./.claude/hooks/post-feature.sh --verbose

# Continue on errors (don't stop at first failure)
./.claude/hooks/post-feature.sh --continue-on-error

# Skip tests (only check docs)
./.claude/hooks/post-feature.sh --skip-tests

# JSON output for CI/CD
./.claude/hooks/post-feature.sh --json
```

**Configuration:**
- `.claude/hooks/config.conf` - Hook settings
- `.claude/orchestrator-config.json` - Orchestrator behavior

**Exit Codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Post-Feature Quality Gates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Backend tests passed (23 tests, 15s)
✓ Frontend tests passed (45 tests, 8s)
✓ Documentation updated
⚠ Found 2 TODO comments in staged files

Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Passed:  3
Failed:  0
Warnings: 1
Duration: 25 seconds

Recommendation: Review TODO comments before committing.
```

---

### 4. Build Verification

**Purpose:** Ensure frontend/backend build successfully for production

**When it runs:** Manual or CI/CD pipeline

**Location:** `.claude/hooks/verify-build.sh`

**Checks Performed:**

**Backend Build:**
- Python syntax check (compileall)
- Import validation (test critical imports)
- Requirements.txt validation
- Optional: Package security audit (pip-audit)

**Frontend Build:**
- TypeScript compilation (`tsc --noEmit`)
- ESLint pass (`npm run lint`)
- Production build (`npm run build`)
- Build output validation (check .next directory)
- Bundle size check (warn if > 5MB)

**How to run manually:**
```bash
./.claude/hooks/verify-build.sh

# Verbose output
./.claude/hooks/verify-build.sh --verbose

# Skip frontend build (backend only)
./.claude/hooks/verify-build.sh --skip-frontend

# Skip backend checks (frontend only)
./.claude/hooks/verify-build.sh --skip-backend

# Continue on errors
./.claude/hooks/verify-build.sh --continue-on-error

# JSON output for CI/CD
./.claude/hooks/verify-build.sh --json
```

**Configuration:**
- `.claude/hooks/config.conf` - Build settings
- `frontend/next.config.js` - Next.js build configuration
- `backend/requirements.txt` - Python dependencies

**Exit Codes:**
- `0` - Build successful
- `1` - Build failed

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Build Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
  ✓ Python syntax valid
  ✓ Imports working
  ✓ Requirements valid

Frontend:
  ✓ TypeScript compiled (0 errors)
  ✓ ESLint passed (108 warnings)
  ✓ Build successful
  ℹ Bundle size: 3.2 MB (OK)

Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Passed:  6
Failed:  0
Warnings: 0
Duration: 45 seconds

Build ready for production ✓
```

---

## Running Hooks Manually

### Run Specific Hook

**Pre-commit checks:**
```bash
# Backend only
./.claude/hooks/backend-syntax-check.sh

# Frontend only (from frontend/ directory)
npm run lint-staged
```

**WSL2 checks:**
```bash
# Memory check
./.claude/hooks/utils/check-memory.sh

# Chrome cleanup
./.claude/hooks/utils/check-chrome.sh --kill
```

**Post-feature quality gates:**
```bash
./.claude/hooks/post-feature.sh
```

**Build verification:**
```bash
./.claude/hooks/verify-build.sh
```

### Run All Hooks (Batch)

**Using run-hooks.sh:**
```bash
./.claude/hooks/run-hooks.sh

# Skip specific hooks
./.claude/hooks/run-hooks.sh --skip pre-commit

# Run only specific hooks
./.claude/hooks/run-hooks.sh --only post-feature,verify-build
```

### Skip Hooks (Not Recommended)

**Skip git pre-commit:**
```bash
git commit --no-verify -m "Message"
```

**Warning:** Only use `--no-verify` for emergencies. You're bypassing quality checks.

### Check Hook Status

**Verify hooks installed:**
```bash
ls -la .husky/
ls -la .claude/hooks/
```

**View hook output:**
Check terminal after commit or manual execution.

**Debug hook execution:**
```bash
# Add --verbose flag
./.claude/hooks/backend-syntax-check.sh --verbose

# Get detailed output
./.claude/hooks/post-feature.sh --verbose --continue-on-error
```

---

## Adding New Hooks

### Step 1: Create Hook Script

**Location:** `.claude/hooks/my-new-hook.sh`

**Template:**
```bash
#!/bin/bash
################################################################################
# My New Hook
#
# Purpose: Description of what this hook does
# Returns: 0 (success), 1 (failure)
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils/common.sh"

# Parse arguments (optional)
ARGS=$(parse_args "$@")

# Main logic
echo ""
print_header "My New Hook"
print_divider 50

# Perform checks
if some_check; then
  log_success "Check passed"
  exit 0
else
  log_error "Check failed"
  exit 1
fi
```

### Step 2: Make Executable

```bash
chmod +x .claude/hooks/my-new-hook.sh
```

### Step 3: Test Execution

```bash
./.claude/hooks/my-new-hook.sh
```

**Verify:**
- Script runs without errors
- Exit code correct (0 = pass, 1 = fail)
- Output formatted correctly

### Step 4: Add to Batch Runner (Optional)

**Edit:** `.claude/hooks/run-hooks.sh`

**Add your hook to the list:**
```bash
AVAILABLE_HOOKS=(
  "pre-commit"
  "post-feature"
  "verify-build"
  "my-new-hook"  # Add here
)
```

### Step 5: Add to Husky (If Git Hook)

**Edit:** `.husky/pre-commit` (or create new file)

**Add hook call:**
```bash
# My new hook
bash .claude/hooks/my-new-hook.sh
if [ $? -ne 0 ]; then
  exit 1
fi
```

### Step 6: Document in This File

Add your hook to the "Available Hooks" section above with:
- Purpose and description
- When it runs
- Checks performed
- How to run manually
- Configuration options
- Exit codes

---

## Husky Integration

### What is Husky?

Husky is a **git hooks manager** that makes it easy to:
- Install git hooks via npm
- Share hooks across team
- Prevent broken commits reaching repository

**Version:** Husky v10

### How Husky Works

1. **Installation:** `npm run prepare` (in frontend/)
2. **Hook files:** Created in `.husky/` directory
3. **Execution:** Git automatically calls hook scripts
4. **Result:** Commit blocked if checks fail

### Husky Configuration

**Location:** `frontend/package.json`

**Scripts:**
```json
{
  "scripts": {
    "prepare": "husky install",
    "lint-staged": "lint-staged"
  }
}
```

**Hooks installed:**
- `.husky/pre-commit` - Runs on `git commit`

### Installing Husky Hooks

**First time setup:**
```bash
cd frontend
npm run prepare
```

**This creates:**
- `.husky/_/` directory (Husky internals)
- `.husky/pre-commit` hook file

### Disabling Husky Hooks

**Temporary (one commit):**
```bash
git commit --no-verify -m "Message"
```

**Permanent (not recommended):**

**Edit:** `.husky/pre-commit`

**Comment out checks:**
```bash
# Frontend checks
# cd frontend && npm run lint-staged

# Backend checks
# cd .. && bash .claude/hooks/backend-syntax-check.sh
```

**Or delete hook file:**
```bash
rm .husky/pre-commit
```

**Warning:** Disabling hooks removes quality safety net.

### Husky Logs

**Location:** `.husky/_/` directory

**View recent executions:**
```bash
ls -la .husky/_/
```

**Debug hook issues:**
- Check `.husky/pre-commit` script
- Run hook manually: `./.husky/pre-commit`
- Verify file permissions: `ls -la .husky/pre-commit`

### Troubleshooting Husky

**Hooks not running:**
```bash
# Reinstall Husky
cd frontend
npm run prepare
```

**Permission denied:**
```bash
# Make hook executable
chmod +x .husky/pre-commit
```

**Hook fails but should pass:**
- Run hook manually to see full output
- Check if node_modules installed: `cd frontend && npm install`
- Verify git repository: `git status`

---

## Troubleshooting

### Hook Not Running

**Problem:** Expected hook doesn't execute

**Diagnosis:**
```bash
# Check if file exists
ls -la .claude/hooks/hook-name.sh

# Check permissions
ls -la .husky/pre-commit

# Test execution
./.claude/hooks/hook-name.sh
```

**Solutions:**
- Verify file exists at expected path
- Make executable: `chmod +x .claude/hooks/hook-name.sh`
- For git hooks: Run `cd frontend && npm run prepare`
- Check if hook referenced in `.husky/pre-commit`

### Hook Failing

**Problem:** Hook reports errors

**Diagnosis:**
```bash
# Run with verbose output
./.claude/hooks/hook-name.sh --verbose

# Run with help flag
./.claude/hooks/hook-name.sh --help
```

**Common causes:**
- **Backend syntax errors** - Fix Python syntax
- **TypeScript errors** - Run `npm run type-check` and fix issues
- **Test failures** - Run `pytest` or `npm test` and fix failing tests
- **Missing dependencies** - Run `npm install` or `pip install -r requirements.txt`

**Solutions:**
- Read error output carefully
- Fix underlying issue (don't just skip hook)
- Test fix: Run hook again after fixing

### WSL2 Memory Issue

**Problem:** Memory check shows high usage or critical level

**Diagnosis:**
```bash
./.claude/hooks/utils/check-memory.sh --details
```

**Solutions:**

**Quick fix (kill Chrome):**
```bash
./.claude/hooks/utils/check-chrome.sh --kill
```

**Full reset (clear all memory):**
```bash
# From Windows PowerShell or CMD:
wsl --shutdown

# Wait 8 seconds
# Restart WSL by opening terminal again
```

**Prevention:**
- Run memory check before tests: `./.claude/hooks/utils/check-memory.sh`
- Use headless Chrome when possible
- Kill Chrome when done: `./.claude/scripts/testing/launch-chrome-testing.sh kill`
- Close unused WSL terminals

### Chrome Not Killed

**Problem:** Chrome processes remain after test

**Diagnosis:**
```bash
./.claude/hooks/utils/check-chrome.sh
```

**Solutions:**

**Auto-kill:**
```bash
./.claude/hooks/utils/check-chrome.sh --kill
```

**Manual kill:**
```bash
pkill -f chrome
pkill -f chromium
```

**Verify cleanup:**
```bash
ps aux | grep -i chrome
# Should show no Chrome processes
```

### Bypass Hook (Emergency)

**Problem:** Need to commit but hook blocks

**Temporary bypass:**
```bash
git commit --no-verify -m "Emergency fix: Production down"
```

**When to use:**
- Production outage requiring immediate fix
- Hook has false positive
- No time to fix underlying issue

**After emergency:**
1. Fix the underlying issue
2. Create proper commit with hooks enabled
3. Consider why hooks blocked (might be real issue)

**Warning:** `--no-verify` should be rare (< 1% of commits).

### Hook Hangs

**Problem:** Hook runs forever without finishing

**Diagnosis:**
- Check for infinite loops in hook script
- Look for processes waiting for input
- Verify no network timeouts

**Solutions:**
- Press Ctrl+C to cancel
- Check hook script for blocking operations
- Add timeouts to long-running commands
- Use `--verbose` to see where it hangs

**Example fix (add timeout):**
```bash
# Before (can hang forever)
npm test

# After (timeout after 2 minutes)
timeout 120 npm test
```

---

## Configuration Reference

### Hook Configuration File

**Location:** `.claude/hooks/config.conf`

**Common settings:**
```bash
# Timeout for hooks (seconds)
HOOKS_TIMEOUT=300

# Verbose output
HOOKS_VERBOSE=0

# Continue on error
HOOKS_CONTINUE_ON_ERROR=0

# JSON output
HOOKS_JSON_OUTPUT=0

# Memory thresholds
MEMORY_WARNING_THRESHOLD=60
MEMORY_CRITICAL_THRESHOLD=75
```

### Environment Variables

**Can override via export or inline:**

```bash
# Override timeout
HOOKS_TIMEOUT=600 ./.claude/hooks/post-feature.sh

# Enable verbose
HOOKS_VERBOSE=1 ./.claude/hooks/backend-syntax-check.sh

# Custom memory threshold
MEMORY_WARNING_THRESHOLD=50 ./.claude/hooks/utils/check-memory.sh
```

### Common Utility Functions

**Location:** `.claude/hooks/utils/common.sh`

**Available functions:**
- `log_info "message"` - Info logging
- `log_success "message"` - Success logging
- `log_error "message"` - Error logging
- `log_warning "message"` - Warning logging
- `print_header "title"` - Print section header
- `print_divider N` - Print divider line
- `run_with_timeout SECONDS COMMAND` - Run with timeout
- `check_command "cmd"` - Check if command exists

**Usage in custom hooks:**
```bash
source "$SCRIPT_DIR/utils/common.sh"

log_info "Starting checks..."
run_with_timeout 60 "npm test"
log_success "All checks passed!"
```

---

**End of Hooks System Reference**

For skills system documentation, see `.claude/SKILLS_GUIDE.md`
For slash commands, see `.claude/commands/README.md`
For main project instructions, see `CLAUDE.md`
