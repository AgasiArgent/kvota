# Tiered Testing Guide - Prevent WSL2 Freezing

**Problem:** Running full browser automation tests with Chrome DevTools can cause WSL2 to freeze due to memory exhaustion.

**Solution:** Use a tiered testing approach - start with fast, lightweight tests and only use browser automation when necessary.

---

## Testing Tiers (Fastest to Slowest)

### Tier 1: Backend Unit Tests ⚡ **FASTEST** (2-5 seconds)

**Memory:** ~100 MB
**Speed:** 2-5 seconds
**Coverage:** 80% of calculation logic

**When to use:**
- ✅ Testing calculation engine logic
- ✅ Testing variable mapping (42 variables → Pydantic models)
- ✅ Testing validation rules (required fields, business rules)
- ✅ Quick feedback during development
- ✅ CI/CD pipeline (runs on every commit)

**How to run:**
```bash
cd backend
pytest -v
# or specific test
pytest tests/test_quotes_calc_mapper.py -v
```

**Example output:**
```
✓ 13 tests passed (2.3s)
Coverage: routes/quotes_calc.py 49%
```

**What it tests:**
- Variable mapper (product override > quote default > fallback)
- Admin settings fetch
- Validation (missing fields, invalid values)
- Edge cases (zero values, empty strings, None)

**What it DOESN'T test:**
- UI interactions (form filling, clicks)
- File upload
- Login flow
- Browser rendering

---

### Tier 2: Backend API Tests 🚀 **FAST** (10-30 seconds)

**Memory:** ~200 MB
**Speed:** 10-30 seconds
**Coverage:** Full calculation engine E2E (no UI)

**When to use:**
- ✅ Testing full calculation flow (quote creation → calculation)
- ✅ Testing authentication (login → token → API call)
- ✅ Testing different payloads (minimal vs full variables)
- ✅ Testing error responses (validation errors, auth errors)
- ✅ When browser is not needed

**How to run:**
```bash
cd /home/novi/quotation-app-dev
./.claude/scripts/testing/test-backend-only.sh
```

**Example output:**
```
✓ Backend is running
✓ Login successful
✓ Fetched admin settings: rate_forex_risk=2.5
✓ Calculation succeeded (minimal data)
✓ Full calculation succeeded (all variables)
✓ Validation errors detected correctly
Memory usage: 1.2G / 6.0G (20%)
```

**What it tests:**
- Login flow (email/password → JWT token)
- Calculation engine (POST /api/quotes-calc/calculate)
- Admin settings fetch (GET /api/calculation-settings)
- Validation errors (missing required fields)
- Two-tier variable system (product override vs quote default)

**What it DOESN'T test:**
- File upload UI
- Grid display
- Form interactions
- Button states

---

### Tier 3: Headless Browser Tests 🏃 **MEDIUM** (30-60 seconds)

**Memory:** ~500 MB (60% less than full Chrome)
**Speed:** 30-60 seconds
**Coverage:** Full UI E2E (no file upload)

**When to use:**
- ✅ Testing UI without file upload
- ✅ Testing form interactions (select customer, set variables)
- ✅ Testing button states (disabled → enabled)
- ✅ Testing navigation flows
- ✅ CI/CD pipeline (when UI must be tested)

**How to run:**
```bash
# Launch headless Chrome
./.claude/scripts/testing/launch-chrome-testing.sh headless http://localhost:3001/quotes/create

# Then use Chrome DevTools MCP tools
# (same as full Chrome, just less memory)
```

**What it tests:**
- Login flow (UI)
- Customer selection dropdown
- Quote variable inputs
- Calculate button state
- Navigation after calculation

**What it DOESN'T test:**
- File upload (no file dialog in headless mode)

---

### Tier 4: Full Browser Tests 🐢 **SLOW** (60-120 seconds)

**Memory:** ~1.2 GB
**Speed:** 60-120 seconds
**Coverage:** Full UI E2E including file upload

**When to use:**
- ✅ Testing file upload functionality
- ✅ Full manual testing automation
- ✅ Debugging UI issues visually
- ✅ Recording screenshots for documentation
- ⚠️ **ONLY when necessary** (use Tier 1-3 first!)

**How to run:**
```bash
# Launch full Chrome with GUI
./.claude/scripts/testing/launch-chrome-testing.sh full http://localhost:3001/quotes/create

# Use Chrome DevTools MCP tools
mcp__chrome-devtools__list_pages()
mcp__chrome-devtools__select_page(pageIdx=0)
mcp__chrome-devtools__take_snapshot()
mcp__chrome-devtools__upload_file(uid="...", filePath="/path/to/file.csv")
```

**What it tests:**
- Everything (full UI automation)
- File upload (CSV/Excel)
- Grid population after upload
- Console errors
- Network requests
- Visual rendering

**What to watch out for:**
- ⚠️ High memory usage (monitor with `.claude/scripts/monitoring/monitor-wsl-resources.sh`)
- ⚠️ Potential freezing if WSL2 runs out of memory
- ⚠️ Slower than other tiers

---

## Recommended Testing Workflow

### During Development (TDD - Red/Green/Refactor)

**Start with Tier 1 (fastest feedback loop):**

```bash
# Write test first (RED)
pytest tests/test_quotes_calc_mapper.py::test_new_feature -v
# → FAILED (not implemented yet)

# Implement feature (GREEN)
# ... write code in routes/quotes_calc.py ...
pytest tests/test_quotes_calc_mapper.py::test_new_feature -v
# → PASSED

# Check coverage
pytest --cov=routes.quotes_calc --cov-report=term-missing
# → 85% coverage
```

**Cycle time:** 5-10 seconds per iteration (instant feedback!)

### Before Committing (Quality Check)

**Run Tier 1 + Tier 2:**

```bash
# Backend unit tests
cd backend && pytest -v

# Backend API tests
cd .. && ./.claude/scripts/testing/test-backend-only.sh

# If both pass, commit is safe
git add . && git commit -m "..."
```

**Total time:** ~30 seconds

### Before Asking User to Test (Pre-verification)

**Run Tier 1 + Tier 2 + Tier 4 (full E2E):**

```bash
# 1. Backend tests
cd backend && pytest -v

# 2. API tests
./.claude/scripts/testing/test-backend-only.sh

# 3. Start resource monitor in separate terminal
./.claude/scripts/monitoring/monitor-wsl-resources.sh

# 4. Full browser test (with file upload)
./.claude/scripts/testing/launch-chrome-testing.sh full

# 5. Run automated test via Chrome DevTools MCP
# (login → select customer → upload file → calculate)

# 6. Check console for errors
mcp__chrome-devtools__list_console_messages()

# 7. Kill Chrome when done
./.claude/scripts/testing/launch-chrome-testing.sh kill
```

**Total time:** ~2 minutes
**Why:** Catches 80% of bugs automatically before asking user to manually test

---

## Memory Management Tips

### Monitor Resources During Testing

**Run this in a separate terminal:**
```bash
./.claude/scripts/monitoring/monitor-wsl-resources.sh
```

**Output:**
```
14:30:45 | Memory: 45% | Swap: 0% | CPU: 12% | Chrome: 8.2%
```

**If memory hits 75%:** Warning shown
**If memory hits 85%:** Critical alert + cleanup recommendations

### Quick Cleanup Commands

**Kill Chrome:**
```bash
./.claude/scripts/testing/launch-chrome-testing.sh kill
# or
pkill -9 chrome
```

**Stop all dev servers:**
```bash
pkill -f 'node.*next'      # Frontend
pkill -f 'uvicorn.*main'   # Backend
```

**Restart WSL (from Windows PowerShell):**
```powershell
wsl --shutdown
# Wait 8 seconds, then restart
```

### Check Resource Limits

**View current .wslconfig:**
```bash
cat /mnt/c/Users/Lenovo/.wslconfig
```

**Recommended settings:**
```
[wsl2]
memory=6GB       # Adjust based on your total RAM (use 50-75% of total)
processors=4     # Adjust based on your CPU cores
swap=2GB
```

---

## Tier Comparison Table

| Tier | Memory | Speed | Coverage | Use When |
|------|--------|-------|----------|----------|
| **1. Backend Unit** | 100 MB | 2-5s | 80% logic | Development (TDD) |
| **2. Backend API** | 200 MB | 10-30s | Full backend | Before commit |
| **3. Headless Browser** | 500 MB | 30-60s | UI (no upload) | CI/CD UI tests |
| **4. Full Browser** | 1.2 GB | 60-120s | Everything | File upload, debugging |

---

## Troubleshooting

### WSL2 Still Freezing

1. **Check .wslconfig applied:**
   ```powershell
   # From Windows PowerShell
   wsl --shutdown
   # Wait 8 seconds
   wsl
   ```

2. **Verify memory limit:**
   ```bash
   free -h
   # Total should match .wslconfig (e.g., 6GB)
   ```

3. **Lower memory limit in .wslconfig:**
   ```
   memory=4GB  # Try lower if 6GB still causes freezing
   ```

### Chrome Using Too Much Memory

1. **Use headless mode instead:**
   ```bash
   ./.claude/scripts/testing/launch-chrome-testing.sh headless
   ```

2. **Kill Chrome between tests:**
   ```bash
   ./.claude/scripts/testing/launch-chrome-testing.sh kill
   ```

3. **Use backend-only tests when possible:**
   ```bash
   ./.claude/scripts/testing/test-backend-only.sh
   ```

### Tests Taking Too Long

1. **Start with Tier 1 (fastest):**
   ```bash
   pytest tests/test_specific.py -v
   ```

2. **Skip browser tests during development:**
   - Only run Tier 4 before asking user to test
   - Use Tier 1-2 for rapid iteration

---

## Summary

**🎯 Golden Rule:** Always start with the fastest tier that covers what you need.

- **Developing new logic?** → Tier 1 (backend unit tests)
- **Testing API integration?** → Tier 2 (backend API tests)
- **Testing UI (no upload)?** → Tier 3 (headless browser)
- **Testing file upload?** → Tier 4 (full browser)

**🚀 Benefits:**
- ✅ 90% less memory usage (Tier 1 vs Tier 4)
- ✅ 20x faster feedback (5s vs 120s)
- ✅ No more WSL2 freezing
- ✅ Sustainable testing workflow

**⚠️ Remember:**
- Monitor resources with `.claude/scripts/monitoring/monitor-wsl-resources.sh`
- Kill Chrome after testing: `.claude/scripts/testing/launch-chrome-testing.sh kill`
- Use `.wslconfig` to prevent memory exhaustion
