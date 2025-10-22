# Resume After VS Code Reload - Chrome DevTools MCP Testing

**Date:** 2025-10-22
**Session:** 17 (continuation)
**Goal:** Complete Test 15.1 using Chrome DevTools MCP

---

## Context: Where We Left Off

### ✅ What's Already Verified

**Backend (Tier 1) - 100% Complete:**
- ✅ 30 unit tests passing (5.69s)
- ✅ Calculation mapper working (two-tier variable system)
- ✅ Validation rules implemented correctly
- ✅ Helper functions tested (safe_decimal, safe_str, safe_int)

**API Integration (Tier 2) - 100% Complete:**
- ✅ Multiple successful 201 responses in logs
- ✅ Calculation endpoint responding correctly
- ✅ Validation errors being returned (400 responses)

**UI Testing (Tier 3) - 80% Complete:**
- ✅ Login automation successful
- ✅ Navigation to quotes/create working
- ✅ File upload working (programmatic File object workaround)
- ✅ Form fields accessible and fillable (EXW, markup 15%, company name)
- ⚠️ **Blocked:** Ant Design dropdown selection with Puppeteer

### 🎯 What Remains

**Test 15.1: Successful calculation with minimal data**
- Need to select customer: "ООО Ромашка'П"
- Click "Рассчитать котировку" button
- Verify results table appears (13 columns, 5 product rows)

**Why We're Switching to Chrome DevTools MCP:**
- Puppeteer cannot reliably interact with Ant Design dropdowns
- Chrome DevTools MCP has better React support
- Accessibility tree snapshots for reliable element selection
- Built-in network waiting

---

## Step-by-Step: Resume Testing

### 1. Verify MCP Connection (After Reload)

After reloading VS Code, verify Chrome DevTools MCP is available:

**In Claude Code, run:**
```
List available MCP servers for chrome-devtools
```

**Expected:** Should see chrome-devtools server connected

**If not connected:**
- Check `.claude/settings.json` has `"chrome-devtools"` in `enabledMcpjsonServers`
- Check `.mcp.json` has chrome-devtools configuration
- Reload VS Code again (Ctrl+Shift+P → "Reload Window")

---

### 2. Launch Chrome with Remote Debugging

**Command:**
```bash
./.claude/launch-chrome-testing.sh full http://localhost:3000/quotes/create
```

**Expected output:**
```
✓ Chrome started successfully
🔗 Remote debugging: http://localhost:9222
⚠ Memory usage: ~1.2 GB
```

**Verify Chrome is accessible:**
```bash
curl -s http://localhost:9222/json | head -5
```

Should show page info with webSocketDebuggerUrl.

---

### 3. Use Chrome DevTools MCP to Automate Test 15.1

Now that MCP is connected, use these commands in Claude Code:

#### 3.1 Take Initial Snapshot
```
Use mcp__chrome-devtools__take_snapshot to see page structure
```

This will show the accessibility tree - easier to find elements than CSS selectors.

#### 3.2 Navigate and Login (if needed)

**Check current URL:**
```
Use mcp__chrome-devtools__evaluate_script with:
window.location.href
```

**If on login page, login:**
```
Use mcp__chrome-devtools__fill with selector for email
Use mcp__chrome-devtools__fill with selector for password
Use mcp__chrome-devtools__click on submit button
Use mcp__chrome-devtools__wait_for to wait for navigation
```

**Navigate to quotes/create:**
```
Use mcp__chrome-devtools__navigate_page to http://localhost:3000/quotes/create
```

#### 3.3 Upload Products File

**Option A: Use upload_file (if supported):**
```
Use mcp__chrome-devtools__upload_file with:
  selector: input[type="file"]
  file_path: /home/novi/quotation-app/backend/test_data/sample_products.csv
```

**Option B: Programmatic upload (fallback):**
```
Use mcp__chrome-devtools__evaluate_script with the File object creation script
(see .claude/SESSION_17_AUTOMATION_FINDINGS.md for the script)
```

#### 3.4 Select Customer

**Take snapshot to find customer dropdown:**
```
Use mcp__chrome-devtools__take_snapshot
```

**Look for:** "Клиент:" or customer select element

**Click to open dropdown:**
```
Use mcp__chrome-devtools__click on customer select
```

**Wait for dropdown to render:**
```
Use mcp__chrome-devtools__wait_for with:
  selector: .ant-select-dropdown (or use accessibility tree)
  timeout: 5000
```

**Click on Romashka option:**
```
Use mcp__chrome-devtools__click on the option containing "Ромашка"
```

#### 3.5 Verify Form Settings

**Check if fields are already set:**
- Компания-продавец: "МАСТЕР БЭРИНГ ООО" (should be pre-filled)
- Базис поставки: "EXW" (may need to change from DDP)
- Наценка: "15" (should be pre-filled)

**If Базис поставки is not EXW, change it:**
```
Use mcp__chrome-devtools__click on incoterms select
Use mcp__chrome-devtools__wait_for dropdown
Use mcp__chrome-devtools__click on "EXW" option
```

#### 3.6 Click Calculate Button

**Scroll to calculate button:**
```
Use mcp__chrome-devtools__evaluate_script with:
window.scrollTo(0, document.body.scrollHeight);
```

**Take screenshot to verify button visible:**
```
Use mcp__chrome-devtools__take_screenshot
```

**Click calculate:**
```
Use mcp__chrome-devtools__click on button containing "Рассчитать котировку"
```

#### 3.7 Wait for Results and Verify

**Wait for network request to complete:**
```
Use mcp__chrome-devtools__wait_for with:
  waitForNetworkIdle: true
  timeout: 10000
```

**Take screenshot of results:**
```
Use mcp__chrome-devtools__take_screenshot
```

**Verify results table:**
```
Use mcp__chrome-devtools__evaluate_script to count:
  - Number of columns in results table (should be 13)
  - Number of data rows (should be 5)
```

**Check for success message:**
```
Use mcp__chrome-devtools__list_console_messages to check for errors
```

---

## Expected Results

### ✅ Success Criteria for Test 15.1

1. **Products loaded:** 5 rows in grid after file upload
2. **Customer selected:** "ООО Ромашка'П" visible in customer field
3. **Settings correct:**
   - Компания-продавец: "МАСТЕР БЭРИНГ ООО"
   - Базис поставки: "EXW"
   - Наценка (%): "15"
4. **Calculate button enabled:** No longer disabled/grayed out
5. **Results table appears:**
   - 13 columns visible
   - 5 product rows (one per product from CSV)
   - No console errors
6. **Success message:** Should see success notification

### ⚠️ If Something Fails

**Dropdown not opening:**
- Take snapshot to see accessibility tree
- Try using accessibility role instead of CSS selector
- Use evaluate_script to force click via JavaScript

**File upload fails:**
- Use programmatic File object approach (proven to work)
- See SESSION_17_AUTOMATION_FINDINGS.md for working script

**Calculate button still disabled:**
- Check console messages for validation errors
- Verify all required fields are filled
- Take screenshot to see what's missing

**Network request fails:**
- Check backend logs: `BashOutput` tool on backend shell
- Verify API is responding: curl http://localhost:8000/api/quotes-calc/calculate
- Check browser console for error details

---

## Comparison with Puppeteer

After completing Test 15.1 with Chrome DevTools MCP, document:

**What worked better:**
- Dropdown interaction (portaled elements)
- Element selection (accessibility tree vs CSS)
- Waiting (network idle vs setTimeout)
- File upload (if it works directly)

**What was similar:**
- Basic form filling
- Navigation
- Screenshot/snapshot capabilities

**Lessons learned:**
- Which tool for which scenarios
- Update recommendations in CLAUDE.md

---

## Quick Reference Commands

**List all available MCP tools:**
```
List MCP resources for chrome-devtools
```

**Take snapshot (accessibility tree):**
```
mcp__chrome-devtools__take_snapshot
```

**Take screenshot (visual):**
```
mcp__chrome-devtools__take_screenshot
```

**Click element:**
```
mcp__chrome-devtools__click with selector or accessibility role
```

**Fill input:**
```
mcp__chrome-devtools__fill with selector and value
```

**Run JavaScript:**
```
mcp__chrome-devtools__evaluate_script with script code
```

**Wait for element:**
```
mcp__chrome-devtools__wait_for with selector and timeout
```

**Wait for network idle:**
```
mcp__chrome-devtools__wait_for with waitForNetworkIdle: true
```

**Check console:**
```
mcp__chrome-devtools__list_console_messages
```

---

## Files to Reference

- `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md` - Complete Chrome DevTools MCP guide
- `.claude/SESSION_17_AUTOMATION_FINDINGS.md` - Puppeteer limitations analysis
- `.claude/MANUAL_TESTING_GUIDE.md` - Test 15.1-15.6 scenarios
- `backend/test_data/sample_products.csv` - Test data file

---

## After Completing Test 15.1

### Document Results

Update `.claude/SESSION_17_TESTING_STATUS.md`:
- Mark Test 15.1 as ✅ or ❌
- Add screenshots if available
- Note any issues encountered
- Compare Chrome DevTools MCP vs Puppeteer experience

### Next Tests (Optional)

If Test 15.1 succeeds, optionally continue with:
- **Test 15.2:** Validation error handling (clear required field)
- **Test 15.3:** Business rule validation (DDP without logistics)
- **Test 15.4:** Product-level overrides
- **Test 15.5:** Admin settings application
- **Test 15.6:** Multiple validation errors

### Update CLAUDE.md

Based on experience, update tool recommendations:
- If Chrome DevTools MCP works well: Emphasize it as primary tool
- If still issues: Recommend Playwright or manual testing
- Add specific notes about Ant Design component automation

---

## Fallback: Manual Testing

If Chrome DevTools MCP also has issues with Ant Design dropdowns:

**Accept that complex UI libraries need manual testing for now:**
1. Manually test Test 15.1 (5 minutes)
2. Document that Ant Design requires either:
   - data-testid attributes for automation
   - Playwright with better React support
   - Manual testing for complex interactions

**This is OK because:**
- Backend is 100% verified (the hard part)
- API is proven working
- UI just needs final confirmation
- Can add data-testid attributes later for better automation

---

## Success!

Once Test 15.1 passes:
- ✅ Calculation engine is fully verified end-to-end
- ✅ Quote creation workflow complete
- ✅ Ready to build quote list, detail, and approval pages
- ✅ Can commit and push changes with confidence

**Next session focus:**
- Build quote list page with filters
- Build quote detail page (view/edit)
- Build quote approval workflow (manager review)
