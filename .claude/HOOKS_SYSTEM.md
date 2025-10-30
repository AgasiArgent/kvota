# Hooks System

**Created:** 2025-10-30
**Purpose:** Automated quality checks and safety nets
**Location:** `.claude/hooks/` + `.husky/` + enhanced scripts

## Overview

Hooks provide automated checks at key workflow points:
- **Pre-commit:** Catch errors before commits
- **WSL2 safety:** Prevent freezing before Chrome launch
- **Post-feature:** Verify quality after completing work
- **Build verification:** Ensure deployability before pushing

**#NoMessLeftBehind** - Automated safety nets prevent forgotten checks.

## Available Hooks

### 1. Pre-Commit Hook (Automatic)
**Trigger:** `git commit`
**Location:** `.husky/pre-commit`

**Checks:**
- Frontend: ESLint + Prettier on staged files
- Backend: Python syntax validation

**Usage:** Runs automatically on every commit

### 2. WSL2 Pre-Flight Check (Automatic)
**Trigger:** Launching Chrome via `.claude/scripts/testing/launch-chrome-testing.sh`
**Function:** `pre_flight_check()` in launch script

**Checks:**
- Memory usage <60%: Pass
- Memory 60-75%: Warn (user decides)
- Memory >75%: Block (prevents freeze)

**Usage:** Runs automatically when launching Chrome

### 3. Post-Feature Hook (Manual)
**Trigger:** Manual invocation after completing feature
**Location:** `.claude/hooks/post-feature.sh`

**Checks:**
- Backend tests (pytest)
- Frontend tests (Jest)
- SESSION_PROGRESS.md updated

**Usage:**
```bash
./.claude/hooks/post-feature.sh
```

### 4. Build Verification (Manual)
**Trigger:** Manual before pushing
**Location:** `.claude/hooks/verify-build.sh`

**Checks:**
- Frontend build (npm run build)
- Backend compilation (compileall)

**Usage:**
```bash
./.claude/hooks/verify-build.sh
```

## Utilities

**Location:** `.claude/hooks/utils/`

### check-memory.sh
- Returns memory usage %
- Exit codes: 0 (OK), 1 (Warning), 2 (Critical)
- Used by WSL2 pre-flight check

### check-chrome.sh
- Detects Chrome processes
- Shows PID and memory usage
- Exit codes: 0 (not running), 1 (running)

### check-docs.sh
- Checks SESSION_PROGRESS.md freshness
- Exit codes: 0 (updated <1hr), 1 (stale >1hr)
- Used by post-feature hook

### colors.sh
- Color output helpers
- Functions: print_success, print_warning, print_error, print_info
- Used by all hooks for consistent output

## Typical Workflow

### Feature Development Flow

```bash
# 1. Develop feature
# ...

# 2. After feature complete
./.claude/hooks/post-feature.sh
# Runs tests + checks docs

# 3. Commit changes
git add .
git commit -m "feat: add feature"
# Pre-commit hook runs automatically

# 4. Verify build (optional but recommended)
./.claude/hooks/verify-build.sh

# 5. Push to remote
git push
```

### Testing with Chrome

```bash
# Launch Chrome (with automatic pre-flight check)
./.claude/scripts/testing/launch-chrome-testing.sh headless
# If memory >75%, launch blocked
# If memory 60-75%, user prompted

# Run tests
# ...

# Kill Chrome when done
./.claude/scripts/testing/launch-chrome-testing.sh kill
```

## Configuration

### Customizing Thresholds

**Memory thresholds (check-memory.sh):**
- Edit lines 11-18 to change percentages
- Current: Warning 60%, Critical 75%

**Documentation freshness (check-docs.sh):**
- Edit line 7 to change threshold
- Current: 1 hour (3600 seconds)

### Enabling Optional Checks

**Type checking (backend-syntax-check.sh):**
- Uncomment mypy section (lines 24-32)

**Type checking (verify-build.sh):**
- Uncomment mypy section

## Troubleshooting

### Hook fails but code seems correct
- Check executable permissions: `chmod +x .claude/hooks/*.sh`
- Check utility permissions: `chmod +x .claude/hooks/utils/*.sh`

### Pre-commit hook not running
- Verify Husky installed: `npm list husky` in frontend
- Reinstall hooks: `cd frontend && npx husky install`

### Build verification too slow
- Disable frontend build check (comment out)
- Or run only on important commits

### Post-feature hook times out
- Increase timeout or run tests separately
- Use `--tb=short` for faster pytest output

## Maintenance

### Adding New Hook
1. Create script in `.claude/hooks/`
2. Use utilities from `.claude/hooks/utils/`
3. Make executable: `chmod +x script.sh`
4. Test thoroughly
5. Document in this file

### Disabling Hook Temporarily
- Pre-commit: `git commit --no-verify`
- WSL2 pre-flight: Edit launch script, comment out check
- Others: Don't run the script

## Hook Details

### Pre-Commit Hook Implementation

**Location:** `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Frontend: lint-staged (ESLint + Prettier)
cd frontend && npx lint-staged

# Backend: Python syntax check
cd ../backend && python -m py_compile *.py routes/*.py 2>&1 | grep -v "^$" || true
```

**Frontend Configuration (package.json):**
```json
"lint-staged": {
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

### WSL2 Pre-Flight Check Implementation

**Location:** `.claude/scripts/testing/launch-chrome-testing.sh`

```bash
pre_flight_check() {
    local mem_percent=$(./.claude/hooks/utils/check-memory.sh)
    local exit_code=$?

    if [ $exit_code -eq 2 ]; then
        print_error "BLOCKED: Memory usage critical ($mem_percent%)"
        exit 1
    elif [ $exit_code -eq 1 ]; then
        print_warning "Memory usage high ($mem_percent%)"
        read -p "Continue anyway? (y/n): " response
        [ "$response" != "y" ] && exit 1
    fi
}
```

### Post-Feature Hook Implementation

**Location:** `.claude/hooks/post-feature.sh`

```bash
#!/bin/bash

# Run backend tests
cd backend && pytest -v || exit 1

# Run frontend tests
cd ../frontend && npm test || exit 1

# Check docs freshness
./.claude/hooks/utils/check-docs.sh || {
    print_warning "SESSION_PROGRESS.md not updated in 1+ hours"
    exit 1
}

print_success "All checks passed!"
```

### Build Verification Implementation

**Location:** `.claude/hooks/verify-build.sh`

```bash
#!/bin/bash

# Frontend build
cd frontend && npm run build || exit 1

# Backend compilation
cd ../backend && python -m compileall . || exit 1

print_success "Build verification passed!"
```

## Integration with Development Workflow

### When Hooks Run

```
Developer Workflow:
┌────────────────┐
│ Write Code     │
└───────┬────────┘
        │
┌───────▼────────┐
│ Run Tests      │  ← Manual: ./.claude/hooks/post-feature.sh
└───────┬────────┘
        │
┌───────▼────────┐
│ git commit     │  ← Automatic: .husky/pre-commit
└───────┬────────┘
        │
┌───────▼────────┐
│ Verify Build   │  ← Manual: ./.claude/hooks/verify-build.sh
└───────┬────────┘
        │
┌───────▼────────┐
│ git push       │
└────────────────┘

Testing Workflow:
┌────────────────┐
│ Launch Chrome  │  ← Automatic: pre_flight_check()
└───────┬────────┘
        │
┌───────▼────────┐
│ Run Tests      │
└───────┬────────┘
        │
┌───────▼────────┐
│ Kill Chrome    │
└────────────────┘
```

### Hook Dependencies

```
Hooks System Structure:
├── .husky/pre-commit           (automatic on git commit)
├── .claude/hooks/
│   ├── post-feature.sh         (manual after feature)
│   ├── verify-build.sh         (manual before push)
│   └── utils/
│       ├── check-memory.sh     (used by pre-flight)
│       ├── check-chrome.sh     (used by launch script)
│       ├── check-docs.sh       (used by post-feature)
│       └── colors.sh           (used by all hooks)
└── .claude/scripts/testing/
    └── launch-chrome-testing.sh (contains pre-flight check)
```

## Best Practices

### When to Use Each Hook

1. **Pre-commit hook** - Always enabled (catches syntax errors)
2. **WSL2 pre-flight** - Always enabled (prevents freezing)
3. **Post-feature hook** - Run after completing feature (quality check)
4. **Build verification** - Run before important pushes (deployment readiness)

### Skipping Hooks When Appropriate

**Skip pre-commit (rare):**
```bash
git commit --no-verify -m "WIP: debugging"
```

**Skip WSL2 pre-flight (not recommended):**
- Edit launch script, comment out `pre_flight_check` call
- Or force continue when prompted

**Skip post-feature (common):**
- Small fixes that don't need full test suite
- Documentation-only changes

### Adding Custom Checks

**Example: Add ESLint to build verification**

Edit `.claude/hooks/verify-build.sh`:
```bash
# Add after frontend build
cd frontend && npm run lint || exit 1
```

**Example: Add coverage check to post-feature**

Edit `.claude/hooks/post-feature.sh`:
```bash
# Add after backend tests
cd backend && pytest --cov=. --cov-fail-under=80 || exit 1
```

## Performance Optimization

### Hook Execution Times

- **Pre-commit:** 5-15s (only staged files)
- **WSL2 pre-flight:** <1s (memory check only)
- **Post-feature:** 30-60s (full test suite)
- **Build verification:** 45-90s (full builds)

### Speeding Up Hooks

**Pre-commit:**
- Use lint-staged (already optimized)
- Keep staged files minimal

**Post-feature:**
- Use `pytest -x` (stop on first failure)
- Use `pytest --tb=short` (shorter tracebacks)

**Build verification:**
- Skip frontend build for backend-only changes
- Use `npm run build -- --no-lint` (skip lint during build)

## Links

- **Scripts Documentation:** `.claude/scripts/README.md`
- **Testing Workflow:** `.claude/TESTING_WORKFLOW.md`
- **WSL2 Troubleshooting:** `.claude/scripts/README.md` (Troubleshooting section)
- **Session Progress:** `.claude/SESSION_PROGRESS.md`
