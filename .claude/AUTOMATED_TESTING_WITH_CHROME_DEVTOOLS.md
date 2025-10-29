# Automated Testing with Chrome DevTools MCP

**Priority Tool for Testing:** Chrome DevTools MCP is now the **primary testing tool** for all browser-based testing workflows.

## Overview

This guide documents the automated testing workflow using Chrome DevTools MCP in WSL2 environment. This approach was discovered and refined during Session 15 manual testing phase.

**Why Chrome DevTools MCP?**
- ✅ Full browser automation via Chrome DevTools Protocol (CDP)
- ✅ Real browser testing (not headless) with WSLg display
- ✅ File upload support (works in WSL2 with X server)
- ✅ Console monitoring, screenshots, JavaScript execution
- ✅ Step-by-step verification at each test stage
- ✅ No permission pop-ups when configured correctly

---

## Prerequisites

### 1. WSLg (Windows 11 X Server)

**Good News:** If you're on Windows 11, WSLg is already installed and running!

**Verify X Server:**
```bash
echo $DISPLAY  # Should show :0 or similar
xdpyinfo       # Should show "vendor string: Microsoft Corporation"
```

**If DISPLAY is not set:**
```bash
export DISPLAY=:0
```

**What is WSLg?**
Windows Subsystem for Linux GUI support - built-in X server that allows Linux GUI applications (like Chrome) to display windows, dialogs, and interact with native Linux file system.

### 2. Google Chrome in WSL2

**Check if installed:**
```bash
google-chrome --version
```

**If not installed:**
```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install google-chrome-stable
```

### 3. MCP Server Configuration

**File:** `.claude/settings.json`

**Add Chrome DevTools MCP permissions:**
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "postgres",
    "github",
    "chrome-devtools",
    "puppeteer",
    "playwright"
  ],
  "permissions": {
    "allow": [
      "Bash(*)",
      "mcp__chrome-devtools__*",
      "mcp__puppeteer__*",
      "mcp__playwright__*"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf /)",
      "Bash(wsl --unregister *)",
      "Bash(wsl --uninstall *)",
      "Bash(sudo apt-get remove *)",
      "Bash(sudo pacman -R *)",
      "Bash(sudo yum remove *)"
    ]
  }
}
```

**Critical:** The wildcard `mcp__chrome-devtools__*` eliminates permission pop-ups for all Chrome DevTools actions.

---

## Launching Chrome for Testing

### Step 1: Kill Any Existing Chrome Instances

```bash
pkill -f "chrome.*remote-debugging-port=9222"
```

### Step 2: Launch Chrome with Remote Debugging

```bash
DISPLAY=:0 google-chrome \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir=/tmp/chrome-wsl-profile \
  "http://localhost:3001/quotes/create" \
  > /tmp/chrome-wsl.log 2>&1 &
```

**Parameter Breakdown:**
- `DISPLAY=:0` - Use WSLg X server for GUI support (file dialogs, windows)
- `--remote-debugging-port=9222` - Enable Chrome DevTools Protocol on port 9222
- `--no-first-run` - Skip first-run wizard
- `--no-default-browser-check` - Skip default browser prompt
- `--user-data-dir=/tmp/chrome-wsl-profile` - Use separate profile for testing (clean state)
- `> /tmp/chrome-wsl.log 2>&1` - Log Chrome output for debugging
- `&` - Run in background

### Step 3: Verify Chrome is Running

```bash
curl -s http://localhost:9222/json | python3 -c "import sys, json; pages = json.load(sys.stdin); print('\n'.join([f'{i}: {p[\"title\"]} - {p[\"url\"]}' for i, p in enumerate(pages[:3])]))"
```

**Expected Output:**
```
0: Создать котировку - http://localhost:3001/quotes/create
```

### Step 4: Get Chrome PID (for later management)

```bash
lsof -i:9222 | grep LISTEN | awk '{print $2}'
```

---

## ⚠️ Resource Management (Prevent WSL2 Freezing)

**IMPORTANT:** Chrome DevTools testing can consume 1-2 GB of memory and cause WSL2 to freeze if not managed properly.

### Quick Start (Recommended Approach)

**Use the optimized launch script instead of manual commands:**

```bash
# Launch Chrome with memory limits
./.claude/scripts/testing/launch-chrome-testing.sh full http://localhost:3001/quotes/create

# Or headless mode (60% less memory)
./.claude/scripts/testing/launch-chrome-testing.sh headless http://localhost:3001/quotes/create

# Check memory usage
./.claude/scripts/testing/launch-chrome-testing.sh status

# Kill Chrome when done
./.claude/scripts/testing/launch-chrome-testing.sh kill
```

**This script automatically:**
- ✅ Kills existing Chrome instances
- ✅ Clears old profiles to free memory
- ✅ Launches Chrome with `--js-flags="--max-old-space-size=512"` (limits JS heap)
- ✅ Uses `--disable-dev-shm-usage` (prevents /dev/shm exhaustion)
- ✅ Verifies Chrome started correctly

### Monitor Resources During Testing

**Run this in a separate terminal while testing:**

```bash
./.claude/scripts/monitoring/monitor-wsl-resources.sh
```

**Output:**
```
14:30:45 | Memory: 45% | Swap: 0% | CPU: 12% | Chrome: 8.2%
```

**Alerts:**
- 🟡 **Warning at 75%** - Consider stopping unnecessary processes
- 🔴 **Critical at 85%** - High risk of freezing, stop Chrome immediately

### WSL2 Memory Limits (.wslconfig)

**File location:** `C:\Users\[YourUsername]\.wslconfig`

**Recommended settings:**
```
[wsl2]
memory=6GB              # Limit WSL2 to 6GB RAM
processors=4            # Limit to 4 CPU cores
swap=2GB                # Limit swap file
autoMemoryReclaim=gradual
sparseVhd=true
localhostForwarding=true
```

**Apply changes:**
```powershell
# From Windows PowerShell
wsl --shutdown
# Wait 8 seconds, then restart WSL
```

### Tiered Testing (Use Lighter Alternatives First)

**See `.claude/TIERED_TESTING_GUIDE.md` for full details.**

**Tier 1: Backend Unit Tests** (100 MB, 5s) ⚡ **FASTEST**
```bash
cd backend && pytest -v
```

**Tier 2: Backend API Tests** (200 MB, 30s) 🚀 **FAST**
```bash
./.claude/scripts/testing/test-backend-only.sh
```

**Tier 3: Headless Browser** (500 MB, 60s) 🏃 **MEDIUM**
```bash
./.claude/scripts/testing/launch-chrome-testing.sh headless
```

**Tier 4: Full Browser** (1.2 GB, 120s) 🐢 **SLOW** (only when needed!)
```bash
./.claude/scripts/testing/launch-chrome-testing.sh full
```

**🎯 Golden Rule:** Always start with the fastest tier that covers what you need.

### Cleanup After Testing

**Kill Chrome:**
```bash
./.claude/scripts/testing/launch-chrome-testing.sh kill
# or
pkill -9 chrome
```

**Stop dev servers:**
```bash
pkill -f 'node.*next'       # Frontend
pkill -f 'uvicorn.*main'    # Backend
```

**Restart WSL (if frozen):**
```powershell
# From Windows PowerShell
wsl --shutdown
```

---

## Chrome DevTools MCP Tools Reference

### Navigation & Page Management

**List all open pages:**
```
mcp__chrome-devtools__list_pages()
```

**Select a specific page:**
```
mcp__chrome-devtools__select_page(pageIdx=0)
```

**Navigate to URL:**
```
mcp__chrome-devtools__navigate_page(url="http://localhost:3001/quotes/create", timeout=30000)
```

**Navigate history:**
```
mcp__chrome-devtools__navigate_page_history(navigate="back")
mcp__chrome-devtools__navigate_page_history(navigate="forward")
```

### Taking Snapshots (Accessibility Tree)

**Get page structure with UIDs:**
```
mcp__chrome-devtools__take_snapshot()
```

**Returns:** Accessibility tree with unique IDs (UIDs) for each interactive element.

**Example Output:**
```
RootWebArea 'Создать котировку'
  heading 'Создать котировку' [level=2]
  group 'Загрузить товары'
    StaticText 'Загрузить товары'
    button 'upload Нажмите или перетащите файл для загрузки' uid='7_133'
  combobox 'Выбрать клиента' uid='5_35'
  button 'Рассчитать котировку' uid='8_133' [disabled]
```

**Use UIDs for interaction:** Click, fill, hover, etc.

### Form Interaction

**Fill text input:**
```
mcp__chrome-devtools__fill(uid="5_35", value="andrey@masterbearingsales.ru")
```

**Click element:**
```
mcp__chrome-devtools__click(uid="8_133")
```

**Upload file:**
```
mcp__chrome-devtools__upload_file(
  uid="7_133",
  filePath="/home/novi/quotation-app/backend/test_data/sample_products.csv"
)
```

**Fill multiple form fields at once:**
```
mcp__chrome-devtools__fill_form(elements=[
  {"uid": "5_35", "value": "andrey@masterbearingsales.ru"},
  {"uid": "6_37", "value": "password"}
])
```

**Select dropdown option:**
```
mcp__chrome-devtools__fill(uid="dropdown_uid", value="EXW")
```

### Screenshots

**Full page screenshot:**
```
mcp__chrome-devtools__take_screenshot(fullPage=true, format="png", quality=90)
```

**Element screenshot:**
```
mcp__chrome-devtools__take_screenshot(uid="7_133", format="png")
```

**Save to file:**
```
mcp__chrome-devtools__take_screenshot(
  filePath="/home/novi/quotation-app/tempfiles/test_screenshot.png",
  fullPage=true
)
```

### Console Monitoring

**List all console messages since page load:**
```
mcp__chrome-devtools__list_console_messages()
```

**Returns:** Array of console logs with level (log, info, warning, error), text, source file, line number.

### JavaScript Execution

**Execute JavaScript in page context:**
```
mcp__chrome-devtools__evaluate_script(
  function="() => { return document.title; }"
)
```

**With element arguments:**
```
mcp__chrome-devtools__evaluate_script(
  function="(el) => { return el.innerText; }",
  args=[{"uid": "5_35"}]
)
```

**Example - Get form values:**
```
mcp__chrome-devtools__evaluate_script(
  function="() => {
    return {
      markup: document.querySelector('[name=\"markup\"]')?.value,
      incoterms: document.querySelector('[name=\"incoterms\"]')?.value
    };
  }"
)
```

### Network Monitoring

**List all network requests:**
```
mcp__chrome-devtools__list_network_requests(resourceTypes=["xhr", "fetch"])
```

**Get specific request:**
```
mcp__chrome-devtools__get_network_request(url="http://localhost:8000/api/quotes-calc/calculate")
```

### Wait for Conditions

**Wait for text to appear:**
```
mcp__chrome-devtools__wait_for(text="Загружено 5 товаров", timeout=10000)
```

### Dialog Handling

**Accept or dismiss browser dialogs:**
```
mcp__chrome-devtools__handle_dialog(action="accept", promptText="optional text")
```

---

## Testing Workflow Example: Login + File Upload

### 1. Launch Chrome and Connect

```bash
# Launch Chrome
DISPLAY=:0 google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-wsl-profile "http://localhost:3001/quotes/create" &

# Verify connection
curl -s http://localhost:9222/json | head -20
```

### 2. Select Page

```
mcp__chrome-devtools__list_pages()
mcp__chrome-devtools__select_page(pageIdx=0)
```

### 3. Take Initial Snapshot

```
mcp__chrome-devtools__take_snapshot()
```

**Look for:** Login form elements with UIDs.

### 4. Automated Login

```
# Fill email
mcp__chrome-devtools__fill(uid="email_input_uid", value="andrey@masterbearingsales.ru")

# Fill password
mcp__chrome-devtools__fill(uid="password_input_uid", value="password")

# Click login button
mcp__chrome-devtools__click(uid="login_button_uid")

# Wait for redirect
sleep 3
```

### 5. Verify Login Success

```
mcp__chrome-devtools__take_snapshot()
```

**Verify:** Page shows "Andy Testuser" or quote creation form.

### 6. Select Customer

```
# Click dropdown
mcp__chrome-devtools__click(uid="customer_dropdown_uid")

# Wait for options
sleep 1

# Take snapshot to see options
mcp__chrome-devtools__take_snapshot()

# Click option
mcp__chrome-devtools__click(uid="customer_option_uid")
```

### 7. Upload File

```
mcp__chrome-devtools__upload_file(
  uid="upload_button_uid",
  filePath="/home/novi/quotation-app/backend/test_data/sample_products.csv"
)

# Wait for processing
sleep 3
```

### 8. Verify Grid Appeared

```
mcp__chrome-devtools__take_snapshot()
```

**Look for:** Grid with 5 product rows.

### 9. Monitor Console for Errors

```
mcp__chrome-devtools__list_console_messages()
```

**Check for:** Any red errors or warnings.

---

## Comparison: Chrome DevTools MCP vs Other Tools

### Chrome DevTools MCP (✅ PRIORITY)

**Pros:**
- ✅ Real browser with full GUI support (WSLg)
- ✅ File upload works perfectly
- ✅ Can inspect console, network, screenshots
- ✅ Execute arbitrary JavaScript in page
- ✅ Accessibility tree for reliable element selection
- ✅ Full Chrome DevTools Protocol access

**Cons:**
- ⚠️ Requires Chrome to be launched first
- ⚠️ Requires proper X server setup (WSLg)
- ⚠️ Need to manage Chrome process manually

**Best For:**
- Manual testing automation
- Complex user flows (login → upload → calculate)
- Debugging file upload issues
- Console monitoring
- Real browser behavior verification

### Playwright MCP

**Pros:**
- ✅ Built-in browser management
- ✅ Multi-browser support (Chromium, Firefox, WebKit)
- ✅ Headless mode for CI/CD

**Cons:**
- ⚠️ File upload issues in WSL2 (no file dialog support)
- ⚠️ Less control over browser instance
- ⚠️ Harder to debug

**Best For:**
- CI/CD automated testing
- Cross-browser testing
- Headless testing workflows

### Puppeteer MCP

**Pros:**
- ✅ Chromium-specific, good performance
- ✅ Similar API to Chrome DevTools Protocol

**Cons:**
- ⚠️ File upload issues in WSL2
- ⚠️ Only Chromium support

**Best For:**
- Chromium-specific testing
- Performance benchmarking

### Browser Console Reader Script

**File:** `frontend/.claude-read-console.js`

**Pros:**
- ✅ Real-time console monitoring
- ✅ Color-coded output (ERROR/WARNING/INFO)
- ✅ File paths and line numbers

**Cons:**
- ⚠️ Read-only (can't interact with page)
- ⚠️ Requires separate browser instance

**Best For:**
- Monitoring console during manual testing
- Debugging React/Next.js errors
- Watching logs in real-time

---

## Troubleshooting

### Issue: File Dialog Doesn't Appear

**Symptom:** Clicking upload button does nothing, no file dialog.

**Cause:** Chrome launched without X server support.

**Fix:**
```bash
# Kill Chrome
pkill -f "chrome.*remote-debugging-port=9222"

# Relaunch with DISPLAY=:0
DISPLAY=:0 google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-wsl-profile "http://localhost:3001/quotes/create" &
```

### Issue: Permission Pop-ups for Every Action

**Symptom:** VSCode asks permission for each `mcp__chrome-devtools__*` action.

**Fix:** Add wildcard to `.claude/settings.json`:
```json
"permissions": {
  "allow": [
    "mcp__chrome-devtools__*"
  ]
}
```

### Issue: Chrome Not Found

**Symptom:** `google-chrome: command not found`

**Fix:** Install Chrome in WSL2:
```bash
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install google-chrome-stable
```

### Issue: X Server Not Available

**Symptom:** `Error: Can't open display: :0`

**Fix:** Verify WSLg is running (Windows 11 only):
```bash
# Check DISPLAY
echo $DISPLAY  # Should show :0

# If empty, export it
export DISPLAY=:0

# Verify X server
xdpyinfo  # Should show Microsoft Corporation
```

**If on Windows 10:** You need to install a third-party X server like VcXsrv or Xming.

### Issue: Chrome Crashes on Startup

**Symptom:** Chrome starts then immediately exits.

**Fix:** Clear user data directory:
```bash
rm -rf /tmp/chrome-wsl-profile
```

### Issue: Can't Connect to Chrome (9222 port)

**Symptom:** `curl http://localhost:9222/json` returns connection refused.

**Fix:**
```bash
# Check if Chrome is running
lsof -i:9222

# If not running, launch Chrome
DISPLAY=:0 google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-wsl-profile "http://localhost:3001/quotes/create" &

# Wait a few seconds
sleep 3

# Try again
curl http://localhost:9222/json
```

---

## Best Practices

### 1. Always Take Snapshots Before Interaction

```
# BAD: Click without knowing UID
mcp__chrome-devtools__click(uid="guess_123")

# GOOD: Take snapshot first, find UID, then click
mcp__chrome-devtools__take_snapshot()
# (find UID in output: uid='7_133')
mcp__chrome-devtools__click(uid="7_133")
```

### 2. Use Sleep After Dynamic Actions

```
# Upload file
mcp__chrome-devtools__upload_file(uid="7_133", filePath="/path/to/file.csv")

# Wait for processing
sleep 3

# Verify result
mcp__chrome-devtools__take_snapshot()
```

### 3. Monitor Console for Errors

```
# After any significant action
mcp__chrome-devtools__list_console_messages()
```

### 4. Use Full Page Screenshots for Debugging

```
# When something doesn't work as expected
mcp__chrome-devtools__take_screenshot(
  fullPage=true,
  filePath="/home/novi/quotation-app/tempfiles/debug_screenshot.png"
)
```

### 5. Clean Up Chrome Process After Testing

```bash
# Kill Chrome when done
pkill -f "chrome.*remote-debugging-port=9222"
```

### 6. Use Separate Profile for Testing

Always use `--user-data-dir=/tmp/chrome-wsl-profile` to avoid polluting your main Chrome profile with test data.

---

## Test Template: Calculation Engine Integration Test

**Goal:** Verify calculation succeeds with minimal required fields.

**Steps:**

1. **Launch Chrome**
   ```bash
   DISPLAY=:0 google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-wsl-profile "http://localhost:3001/quotes/create" &
   ```

2. **Connect and Login**
   ```
   mcp__chrome-devtools__list_pages()
   mcp__chrome-devtools__select_page(pageIdx=0)
   mcp__chrome-devtools__take_snapshot()

   # Fill login form
   mcp__chrome-devtools__fill(uid="email_uid", value="andrey@masterbearingsales.ru")
   mcp__chrome-devtools__fill(uid="password_uid", value="password")
   mcp__chrome-devtools__click(uid="login_button_uid")
   sleep 3
   ```

3. **Select Customer**
   ```
   mcp__chrome-devtools__take_snapshot()
   mcp__chrome-devtools__click(uid="customer_dropdown_uid")
   sleep 1
   mcp__chrome-devtools__take_snapshot()
   mcp__chrome-devtools__click(uid="customer_option_uid")
   ```

4. **Upload Products**
   ```
   mcp__chrome-devtools__upload_file(
     uid="upload_uid",
     filePath="/home/novi/quotation-app/backend/test_data/sample_products.csv"
   )
   sleep 3
   ```

5. **Set Quote Variables**
   ```
   # Change incoterms to EXW
   mcp__chrome-devtools__fill(uid="incoterms_uid", value="EXW")

   # Set markup to 15
   mcp__chrome-devtools__fill(uid="markup_uid", value="15")
   ```

6. **Calculate Quote**
   ```
   mcp__chrome-devtools__click(uid="calculate_button_uid")
   sleep 5
   ```

7. **Verify Success**
   ```
   mcp__chrome-devtools__take_snapshot()
   mcp__chrome-devtools__list_console_messages()
   ```

**Expected Result:**
- ✅ No validation errors
- ✅ Quote created successfully
- ✅ Success message shown or redirect to quote details

---

## Summary

**Chrome DevTools MCP is now the PRIMARY testing tool** for browser-based testing because:

1. ✅ **Full GUI Support:** Works with WSLg in WSL2 (file dialogs, native interactions)
2. ✅ **Real Browser:** Tests actual Chrome behavior, not headless simulation
3. ✅ **Complete Automation:** Login, navigation, form filling, file upload, clicks
4. ✅ **Rich Inspection:** Console logs, network requests, screenshots, JavaScript execution
5. ✅ **No Permission Hassles:** Configure once in settings.json, forget about it

**Key Discovery:** Windows 11 WSLg provides X server out of the box - just need `DISPLAY=:0`.

**Recommended Workflow:**
1. Launch Chrome with remote debugging in WSL2
2. Use Chrome DevTools MCP for all interactions
3. Take snapshots to find element UIDs
4. Monitor console for errors
5. Take screenshots for visual verification
6. Clean up Chrome process when done

This approach combines the best of automated testing (reproducibility, speed) with real browser behavior (file uploads, dialogs, actual rendering).
