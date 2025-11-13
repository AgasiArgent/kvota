# Test Quote Creation - End-to-End Testing Command

**Purpose:** Automate the complete quote creation testing workflow from server startup to database verification.

**Location:** `/test-quote-creation` slash command

**Duration:** ~5 minutes (automated)

---

## What This Command Does

This command executes the full 11-step quote creation testing workflow:

1. **Server Health Checks** - Verify backend (port 8000) and frontend (port 3000) are running
2. **Backend Unit Tests** - Run calculation engine tests (`test_quotes_calc*.py`)
3. **Memory Safety Check** - Verify WSL2 has sufficient memory before launching Chrome
4. **Browser E2E Test** - Navigate through quote creation workflow with Chrome DevTools MCP
5. **Database Verification** - Confirm quote was saved correctly
6. **Cleanup** - Kill Chrome processes and generate report

---

## Prerequisites

Before running this command, ensure:

1. ✅ **Backend running** on port 8000 (`cd backend && source venv/bin/activate && uvicorn main:app --reload`)
2. ✅ **Frontend running** on port 3000 (`cd frontend && npm run dev`)
3. ✅ **Test user exists** - `andrey@masterbearingsales.ru` / `password`
4. ✅ **WSL2 memory < 60%** - Check with `free -h`
5. ✅ **Chrome installed** - `google-chrome --version`
6. ✅ **Chrome DevTools MCP configured** - In `.mcp.json`

---

## Usage

Simply invoke the slash command:

```
/test-quote-creation
```

The command will automatically:
- Check if servers are running (start if needed)
- Run backend tests
- Launch Chrome in headless mode
- Execute browser workflow
- Verify database
- Generate report
- Clean up

---

## Command Steps (Detailed)

### Step 1: Check Backend Server (Port 8000)

**Command:**
```bash
# Check if lsof is available
if ! command -v lsof &> /dev/null; then
    echo "⚠️ lsof not installed. Install with: sudo apt-get install lsof"
    echo "Using alternative method with netstat..."
    netstat -tuln | grep :8000
else
    lsof -i :8000 | grep LISTEN
fi
```

**If not running:**
```bash
cd /home/novi/quotation-app-dev/backend
source venv/bin/activate
nohup uvicorn main:app --reload > /tmp/backend.log 2>&1 &
sleep 5
```

**Expected:** Process running on port 8000

---

### Step 2: Check Frontend Server (Port 3000)

**Command:**
```bash
# Check if lsof is available
if ! command -v lsof &> /dev/null; then
    echo "⚠️ lsof not installed. Using alternative method with netstat..."
    netstat -tuln | grep :3000
else
    lsof -i :3000 | grep LISTEN
fi
```

**If not running:**
```bash
cd /home/novi/quotation-app-dev/frontend
nohup npm run dev > /tmp/frontend.log 2>&1 &
sleep 10  # Next.js needs longer warmup
```

**Expected:** Process running on port 3000

---

### Step 3: Server Warmup Wait

**Wait 5 seconds** for both servers to be fully ready to accept connections.

```bash
sleep 5
echo "✓ Servers ready for testing"
```

---

### Step 4: Run Backend Unit Tests

**Command:**
```bash
cd /home/novi/quotation-app-dev/backend
source venv/bin/activate
pytest tests/test_quotes_calc*.py -v --tb=short
```

**Expected output:**
```
tests/test_quotes_calc_mapper.py::test_map_simple_product PASSED
tests/test_quotes_calc_mapper.py::test_map_product_with_overrides PASSED
...
tests/test_quotes_calc_validation.py::test_validate_required_fields PASSED
...
======================== 23 passed in 2.45s ========================
```

**Exit code:** 0 (success)

**If tests fail:** STOP and report which tests failed. Do not proceed to browser testing.

---

### Step 5: Check Test Exit Code

```bash
if [ $? -ne 0 ]; then
  echo "✗ Backend tests failed. Fix tests before proceeding."
  exit 1
fi

echo "✓ Backend tests passed (23/23)"
```

---

### Step 6: Continue Only if Tests Pass

Only proceed to Steps 7-11 if backend tests passed.

---

### Step 7: WSL2 Memory Preflight Check

**Command:**
```bash
/home/novi/quotation-app-dev/.claude/hooks/utils/check-memory.sh
```

**Expected output:**
```
✓ Memory usage OK: 45.2%
```

**Exit codes:**
- `0` - OK (< 60% memory) - Proceed
- `1` - WARNING (60-75% memory) - Ask user to continue
- `2` - CRITICAL (> 75% memory) - STOP, free memory first

**If CRITICAL:**
```bash
echo "✗ Memory usage CRITICAL (>75%). Cannot launch Chrome safely."
echo "Free memory with: pkill -9 chrome && wsl --shutdown"
exit 1
```

**If WARNING:**
```bash
echo "⚠ Memory usage HIGH (60-75%). Chrome may cause instability."
read -p "Continue anyway? (y/n): " -n 1 -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted. Free memory or use headless mode."
  exit 0
fi
```

---

### Step 8: Launch Chrome in Headless Mode

**Command:**
```bash
# Check if port 9222 is already in use (Chrome debugging port)
if command -v lsof &> /dev/null; then
    if lsof -i :9222 &> /dev/null; then
        echo "⚠️ Port 9222 already in use (Chrome debugging port)"
        echo "Kill existing Chrome: pkill -9 chrome"
        echo "Or use a different port in launch script"
        exit 1
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln | grep -q :9222; then
        echo "⚠️ Port 9222 already in use (Chrome debugging port)"
        echo "Kill existing Chrome: pkill -9 chrome"
        exit 1
    fi
fi

# Launch Chrome headless
/home/novi/quotation-app-dev/.claude/scripts/testing/launch-chrome-testing.sh headless
```

**Expected output:**
```
ℹ Running pre-flight safety checks...
✓ Pre-flight safety checks passed
🚀 Launching Chrome in headless mode...
ℹ URL: http://localhost:3000/quotes/create
ℹ Remote debugging port: 9222
✓ Chrome started successfully
🔗 Remote debugging: http://localhost:9222
✓ Memory usage: ~500 MB (60% less than full GUI)
```

**Memory impact:** ~500 MB

**Remote debugging:** http://localhost:9222

---

### Step 9: Execute Browser Workflow (Chrome DevTools MCP)

Use Chrome DevTools MCP to navigate the quote creation workflow.

#### 9.1 Take Initial Snapshot

```
mcp__chrome-devtools__take_snapshot
```

**Expected:** Page structure with login form or quote creation page

---

#### 9.2 Login (if needed)

If login form is visible:

```
mcp__chrome-devtools__fill
  uid: <email-input-uid>
  value: "andrey@masterbearingsales.ru"

mcp__chrome-devtools__fill
  uid: <password-input-uid>
  value: "password"

mcp__chrome-devtools__click
  uid: <login-button-uid>

mcp__chrome-devtools__wait_for
  text: "Создать коммерческое предложение"
  timeout: 10000
```

**Expected:** Redirected to quote creation page

---

#### 9.3 Select Customer

```
mcp__chrome-devtools__take_snapshot

mcp__chrome-devtools__click
  uid: <customer-select-uid>

mcp__chrome-devtools__wait_for
  text: "ООО"
  timeout: 5000

mcp__chrome-devtools__click
  uid: <first-customer-option-uid>
```

**Expected:** Customer selected in dropdown

---

#### 9.4 Add Product

```
mcp__chrome-devtools__click
  uid: <add-product-button-uid>

mcp__chrome-devtools__wait_for
  text: "Название продукта"
  timeout: 3000
```

**Expected:** New product row added to ag-Grid

---

#### 9.5 Fill Required Product Fields

```
mcp__chrome-devtools__take_snapshot

# Fill product name (cell editing in ag-Grid)
mcp__chrome-devtools__click
  uid: <product-name-cell-uid>

mcp__chrome-devtools__fill
  uid: <product-name-input-uid>
  value: "Test Bearing SKF 6205"

# Fill base price
mcp__chrome-devtools__click
  uid: <base-price-cell-uid>

mcp__chrome-devtools__fill
  uid: <base-price-input-uid>
  value: "1500.00"

# Fill quantity
mcp__chrome-devtools__click
  uid: <quantity-cell-uid>

mcp__chrome-devtools__fill
  uid: <quantity-input-uid>
  value: "10"

# Fill weight
mcp__chrome-devtools__click
  uid: <weight-cell-uid>

mcp__chrome-devtools__fill
  uid: <weight-input-uid>
  value: "2.5"
```

**Expected:** All required fields filled in ag-Grid

---

#### 9.6 Fill Quote-Level Defaults (Required Fields)

```
mcp__chrome-devtools__take_snapshot

# Seller Company (Card 1)
mcp__chrome-devtools__click
  uid: <seller-company-select-uid>

mcp__chrome-devtools__click
  uid: <seller-company-option-uid>  # "МАСТЕР БЭРИНГ ООО"

# Offer Incoterms (Card 2)
mcp__chrome-devtools__click
  uid: <offer-incoterms-select-uid>

mcp__chrome-devtools__click
  uid: <incoterms-option-uid>  # "EXW"

# Currency of Base Price (Card 3)
mcp__chrome-devtools__click
  uid: <currency-select-uid>

mcp__chrome-devtools__click
  uid: <currency-option-uid>  # "USD"

# Supplier Country (Card 3)
mcp__chrome-devtools__click
  uid: <supplier-country-select-uid>

mcp__chrome-devtools__click
  uid: <supplier-country-option-uid>  # "CN"
```

**Expected:** All 10 required fields filled (4 in defaults, 4 in product, 2 calculated)

---

#### 9.7 Click Save Button

```
mcp__chrome-devtools__take_snapshot

mcp__chrome-devtools__click
  uid: <save-button-uid>

mcp__chrome-devtools__wait_for
  text: "успешно сохранено"  # "successfully saved"
  timeout: 15000
```

**Expected:** Success message, redirect to quote list or detail page

---

#### 9.8 Verify Redirect

```
mcp__chrome-devtools__evaluate_script
  function: "() => { return window.location.pathname; }"
```

**Expected:** Path changed to `/quotes` or `/quotes/[id]`

**Not expected:** Still on `/quotes/create` (would indicate save failed)

---

#### 9.9 Check Console for Errors

```
mcp__chrome-devtools__list_console_messages
  types: ["error"]
```

**Expected:** No errors

**If errors found:** Report them (GET /api/quotes/calculate 500, network errors, etc.)

---

### Step 10: Kill Chrome Process

**Command:**
```bash
/home/novi/quotation-app-dev/.claude/scripts/testing/launch-chrome-testing.sh kill
```

**Expected output:**
```
ℹ Killing Chrome processes: 12345
✓ All Chrome processes killed
ℹ Cleaning up user data directory...
```

**Memory freed:** ~500 MB

---

### Step 11: Database Verification

**Check if quote was saved:**

```bash
# Load DATABASE_URL securely
source /home/novi/quotation-app-dev/.claude/hooks/utils/load-database-url.sh

# Using postgres MCP or asyncpg
SELECT
  id,
  quote_number,
  customer_id,
  total_amount,
  status,
  created_at,
  (SELECT COUNT(*) FROM quote_items WHERE quote_id = quotes.id) as item_count
FROM quotes
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `quote_number`: "Q-2025-XXXXXX" (auto-generated)
- `customer_id`: Valid UUID
- `total_amount`: > 0 (calculated)
- `status`: "draft"
- `item_count`: 1 (one product added)
- `created_at`: Within last 60 seconds

**Verification:**
```bash
# Check timestamp is recent
# Note: This uses GNU date (available in WSL2/Linux)
# For macOS, install coreutils: brew install coreutils
if command -v gdate &> /dev/null; then
    # macOS with coreutils
    created_at_seconds=$(gdate -d "$created_at" +%s)
    now_seconds=$(gdate +%s)
elif date --version 2>&1 | grep -q GNU; then
    # GNU date (Linux/WSL2)
    created_at_seconds=$(date -d "$created_at" +%s)
    now_seconds=$(date +%s)
else
    # Fallback: Use Python for portable date parsing
    created_at_seconds=$(python3 -c "import datetime; print(int(datetime.datetime.fromisoformat('$created_at'.replace(' ', 'T')).timestamp()))")
    now_seconds=$(python3 -c "import time; print(int(time.time()))")
fi

diff=$((now_seconds - created_at_seconds))

if [ $diff -lt 60 ]; then
  echo "✓ Quote created within last minute (${diff}s ago)"
else
  echo "✗ Quote timestamp is old (${diff}s ago). May not be the test quote."
fi
```

**Check calculation results:**
```bash
SELECT
  name,
  base_price_vat,
  quantity,
  weight_in_kg,
  total_with_logistics
FROM quote_items
WHERE quote_id = (SELECT id FROM quotes ORDER BY created_at DESC LIMIT 1);
```

**Expected:**
- `name`: "Test Bearing SKF 6205"
- `base_price_vat`: 1500.00
- `quantity`: 10
- `weight_in_kg`: 2.5
- `total_with_logistics`: > 0 (calculated by engine)

---

## Success Criteria

All of the following must be true:

- ✅ Backend tests pass (23/23)
- ✅ Frontend loads without errors
- ✅ Customer selectable
- ✅ Product added to grid
- ✅ All required fields fillable
- ✅ Save button clickable
- ✅ Success message appears
- ✅ Redirect occurs
- ✅ No console errors
- ✅ Quote saved in database
- ✅ Quote items saved with calculations
- ✅ Timestamp is recent (< 60s)

---

## Report Generation

After completing all steps, generate this report:

```markdown
## Quote Creation E2E Test Report

**Date:** 2025-10-30 14:23:45
**Duration:** 4m 32s

### Results

**✓ Server Health:**
- Backend: Running on :8000
- Frontend: Running on :3000

**✓ Backend Tests:** 23/23 passed in 2.45s

**✓ Memory Check:** 45.2% (OK)

**✓ Browser Workflow:**
- Login: Success
- Customer selection: Success
- Product addition: Success
- Field filling: Success (10/10 required fields)
- Save operation: Success
- Redirect: Success (to /quotes)
- Console errors: 0

**✓ Database Verification:**
- Quote created: Q-2025-000123
- Customer ID: f47ac10b-58cc-4372-a567-0e02b2c3d479
- Total amount: $18,750.50
- Status: draft
- Items: 1
- Created: 12s ago

**✓ Calculation Engine:**
- Base price: $1,500.00 × 10 = $15,000.00
- Logistics: $2,250.00
- Financing: $1,125.50
- Commission: $375.00
- Total: $18,750.50

### Summary

**Status:** ✅ ALL TESTS PASSED

**Time breakdown:**
- Server checks: 15s
- Backend tests: 2.45s
- Browser workflow: 3m 45s
- Database verification: 5s
- Cleanup: 3s

**Memory impact:**
- Peak: 8.2 GB (Chrome headless)
- Current: 7.5 GB (Chrome killed)

**Test coverage:**
- Backend unit tests: ✅
- API integration: ✅
- Frontend UI: ✅
- Database persistence: ✅
- Calculation engine: ✅

**Ready for deployment:** Yes (all workflows operational)
```

---

## Cleanup Recommendations

After testing:

1. **Keep servers running** - If continuing development
2. **Stop servers** - If done for the day:
   ```bash
   # Backend
   pkill -f "uvicorn main:app"

   # Frontend
   pkill -f "node.*next"
   ```

3. **Free memory** - If WSL2 memory is high:
   ```bash
   # From Windows PowerShell
   wsl --shutdown
   # Wait 8 seconds
   wsl
   ```

4. **Clean test data** - If needed:
   ```bash
   # Delete test quotes (careful!)
   DELETE FROM quote_items WHERE quote_id IN (
     SELECT id FROM quotes WHERE quote_number LIKE 'Q-2025-%' AND created_at > NOW() - INTERVAL '1 hour'
   );
   DELETE FROM quotes WHERE quote_number LIKE 'Q-2025-%' AND created_at > NOW() - INTERVAL '1 hour';
   ```

---

## Troubleshooting

### Problem: Backend tests fail

**Symptoms:** pytest exits with code 1, some tests marked FAILED

**Solution:**
1. Check test output for specific failures
2. Common issues:
   - Missing environment variables (SUPABASE_URL, DATABASE_URL)
   - Database connection error (Supabase down?)
   - Validation logic changed (update tests)
3. Fix failures before proceeding to browser tests

**Commands:**
```bash
cd backend
pytest tests/test_quotes_calc_mapper.py::test_map_simple_product -v  # Run specific test
pytest tests/test_quotes_calc*.py -v --tb=long  # Full traceback
```

---

### Problem: Memory check fails (CRITICAL)

**Symptoms:** check-memory.sh exits with code 2, "Memory usage CRITICAL"

**Solution:**
```bash
# Kill Chrome
pkill -9 chrome

# Kill Node processes
pkill -f "node.*next"

# Check memory again
free -h

# If still critical, restart WSL2
wsl --shutdown  # From Windows PowerShell
# Wait 8 seconds
wsl
```

---

### Problem: Chrome fails to start

**Symptoms:** "Chrome failed to start", remote debugging not available on :9222

**Solution:**
1. Check Chrome is installed: `google-chrome --version`
2. Check DISPLAY is set: `echo $DISPLAY` (should be `:0`)
3. Check WSLg is running: `ps aux | grep Xwayland`
4. Try full GUI mode to debug: `./.claude/scripts/testing/launch-chrome-testing.sh full`
5. Check logs: `tail -f /tmp/chrome-wsl.log`

**Install Chrome if missing:**
```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome-stable_current_amd64.deb
```

---

### Problem: Login fails in browser

**Symptoms:** MCP can't find login form, or login doesn't redirect

**Solution:**
1. Check test user exists in Supabase Dashboard
2. Verify credentials: `andrey@masterbearingsales.ru` / `password`
3. Check backend auth endpoint: `curl http://localhost:8000/api/auth/login`
4. Try manual login in browser to verify it works
5. Check if already logged in (cookies persist)

**Reset auth state:**
```bash
# Clear Chrome profile
rm -rf /tmp/chrome-wsl-profile
# Launch again
./.claude/scripts/testing/launch-chrome-testing.sh headless
```

---

### Problem: Save button doesn't work

**Symptoms:** Click save, but no redirect or error message

**Solution:**
1. Check browser console: `mcp__chrome-devtools__list_console_messages`
2. Common errors:
   - "Required field missing" - Check all 10 required fields filled
   - "POST /api/quotes/calculate 500" - Backend calculation error
   - "Network error" - Backend not running
3. Check backend logs: `tail -f /tmp/backend.log`
4. Verify calculation endpoint works:
   ```bash
   curl -X POST http://localhost:8000/api/quotes/calculate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"products": [...], "defaults": {...}}'
   ```

---

### Problem: Database verification fails

**Symptoms:** No recent quote found, or quote_items is empty

**Solution:**
1. Check database connection: `psql $DATABASE_URL -c "SELECT NOW();"`
2. Check quotes table: `SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;`
3. Check if save actually happened:
   - Look for success message in browser
   - Check backend logs for POST /api/quotes
4. Check RLS policies aren't blocking query:
   ```sql
   -- Temporarily disable RLS for debugging (re-enable after!)
   ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
   SELECT * FROM quotes ORDER BY created_at DESC LIMIT 1;
   ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
   ```

---

### Problem: Chrome process won't die

**Symptoms:** `pkill chrome` doesn't work, Chrome still in `ps aux`

**Solution:**
```bash
# Find all Chrome processes
ps aux | grep chrome

# Kill with SIGKILL
pkill -9 chrome

# If still running, kill specific PIDs
kill -9 <PID1> <PID2> <PID3>

# Nuclear option: restart WSL2
wsl --shutdown  # From Windows
```

---

## Performance Notes

**Tiered Testing Philosophy:**

1. **Backend Unit Tests (5s)** - Always run first, fastest feedback
2. **Backend API Tests (30s)** - Integration tests without browser
3. **Headless Browser (60s)** - E2E with minimal memory (500 MB)
4. **Full Browser (120s)** - Visual debugging only (1.2 GB)

**This command uses Tier 1 + Tier 3** for optimal speed/coverage balance.

**Memory usage by tier:**
- Backend tests: ~100 MB
- Headless Chrome: ~500 MB
- Full Chrome: ~1.2 GB

**Prefer headless mode** - 60% less memory, same test coverage.

---

## Related Documentation

- **Testing Workflow:** `.claude/TESTING_WORKFLOW.md`
- **Chrome DevTools MCP Guide:** `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`
- **Backend Patterns:** `.claude/skills/backend-dev-guidelines/SKILL.md`
- **Frontend Patterns:** `.claude/skills/frontend-dev-guidelines/SKILL.md`
- **Calculation Engine:** `.claude/skills/calculation-engine-guidelines/SKILL.md`
- **Memory Management:** `.claude/scripts/README.md`
- **Session Progress:** `.claude/SESSION_PROGRESS.md`

---

## Version History

- **2025-10-30** - Initial version (Session 26, Phase 7)
- Created by: @backend-dev agent
- Implementation plan: `.claude/implementation/07-PHASE7-SLASH-COMMANDS.md`

---

**Last Updated:** 2025-10-30 14:30:00
