# Test with Chrome DevTools - Manual Testing Command

**Purpose:** Launch Chrome in fullscreen with debugging, connect via Chrome DevTools MCP, and monitor console errors during manual testing.

**Location:** `/test` slash command

**Duration:** Session-based (stays open until you're done testing)

---

## What This Command Does

1. **Launch Chrome** - Opens Chrome in fullscreen mode with remote debugging on port 9222
2. **Connect DevTools MCP** - Establishes connection to Chrome for monitoring
3. **Navigate to App** - Opens http://localhost:3000 (frontend)
4. **Monitor Console** - Watches for JavaScript errors, warnings, and network issues
5. **Stay Connected** - Remains active for manual testing session
6. **Cleanup** - Provides command to kill Chrome when done

---

## Prerequisites

1. ✅ **Frontend running** on port 3000
2. ✅ **Backend running** on port 8000
3. ✅ **Chrome installed** in WSL2 (google-chrome)
4. ✅ **Chrome DevTools MCP** configured in `.mcp.json`
5. ✅ **WSL2 memory < 70%** - Run `free -h` to check

---

## Execution Steps

### Step 1: Check if Chrome is already running

Check for existing Chrome processes on debugging port:

```bash
lsof -i :9222 || echo "Port 9222 is free"
```

If Chrome is running, kill it:

```bash
pkill -f "chrome.*remote-debugging-port=9222"
sleep 2
```

### Step 2: Launch Chrome in fullscreen with debugging

```bash
google-chrome \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --start-fullscreen \
  --user-data-dir=/tmp/chrome-testing-profile-$(date +%s) \
  http://localhost:3000 &

CHROME_PID=$!
echo "✓ Chrome launched (PID: $CHROME_PID) on debugging port 9222"
```

Wait 3 seconds for Chrome to start:

```bash
sleep 3
```

### Step 3: Connect to Chrome via DevTools MCP

Use the `mcp__chrome-devtools__list_pages` tool to see available pages.

Expected response: List of pages with page index 0 = localhost:3000

### Step 4: Select the active page

Use `mcp__chrome-devtools__select_page` tool with pageIdx = 0.

### Step 5: Take initial snapshot

Use `mcp__chrome-devtools__take_snapshot` tool to see the page structure.

This shows:
- All interactive elements with UIDs
- Current page state
- Form fields
- Buttons

### Step 6: Monitor console messages

Use `mcp__chrome-devtools__list_console_messages` tool to see any errors.

Parameters:
- `types`: ["error", "warn"] to filter only errors and warnings
- `includePreservedMessages`: true to see history

### Step 7: Instructions for Manual Testing

**During your testing session:**

**To check for new errors:**
```
Use mcp__chrome-devtools__list_console_messages with types=["error", "warn"]
```

**To interact with page elements:**
```
1. Take snapshot to see element UIDs
2. Use click/fill/hover tools with the UID
```

**To navigate:**
```
Use mcp__chrome-devtools__navigate_page with url
```

**To take screenshot:**
```
Use mcp__chrome-devtools__take_screenshot
```

**To check network requests:**
```
Use mcp__chrome-devtools__list_network_requests to see API calls
Use mcp__chrome-devtools__get_network_request to see request details
```

### Step 8: When Done Testing - Cleanup

Kill Chrome process:

```bash
pkill -f "chrome.*remote-debugging-port=9222"
echo "✓ Chrome closed"
```

Verify Chrome is stopped:

```bash
lsof -i :9222 || echo "✓ Port 9222 is free"
```

---

## Common Testing Workflows

### Test Analytics Page

```
1. Navigate to http://localhost:3000/analytics
2. Take snapshot - see all filter fields and buttons
3. Click execute button (find UID from snapshot)
4. List console messages - check for errors
5. List network requests - verify API calls succeeded
```

### Test Quote Detail Page

```
1. Navigate to http://localhost:3000/quotes/[id]
2. Take snapshot - see workflow status card
3. List console messages - check for React errors
4. Monitor network - verify workflow API calls
```

### Test Workflow Transitions

```
1. Navigate to quote detail page
2. Take snapshot - find action button UID
3. Click action button
4. Wait for response
5. List console messages - verify no errors
6. Check network request to /api/quotes/{id}/transition
7. Take new snapshot - verify state changed
```

---

## Troubleshooting

### Chrome won't start

**Error:** Port 9222 already in use

**Solution:**
```bash
pkill -f "chrome.*remote-debugging-port"
sleep 2
# Try again
```

### Out of memory

**Error:** WSL2 memory exhausted

**Solution:**
```bash
# Check memory
free -h

# If > 70% used, kill Chrome and restart WSL2
pkill chrome
# In Windows: wsl --shutdown
# Restart terminals
```

### DevTools MCP can't connect

**Error:** Connection refused to localhost:9222

**Solution:**
1. Verify Chrome is running: `ps aux | grep chrome`
2. Verify port: `lsof -i :9222`
3. Wait 5 seconds and try again
4. Check Chrome launched with --remote-debugging-port=9222

### Page not loading

**Error:** Network error or blank page

**Solution:**
1. Verify frontend running: `curl http://localhost:3000`
2. Verify backend running: `curl http://localhost:8000/api/organizations/`
3. Check browser console for auth errors

---

## Example Session

```
User: /test

Claude:
✓ Checking for existing Chrome processes...
✓ Port 9222 is free
✓ Launching Chrome in fullscreen with debugging...
✓ Chrome started (PID: 12345)
✓ Connecting to Chrome via DevTools MCP...
✓ Connected to page: http://localhost:3000
✓ Taking initial snapshot...

Page loaded successfully. I can see:
- Login form with email/password fields
- Navigation menu
- Current page: Dashboard

Console messages: 0 errors, 0 warnings

Ready for manual testing! Tell me what to test or which page to navigate to.

When done, I'll clean up Chrome for you.
```

---

## Safety Notes

**Resource Management:**
- Chrome uses ~500MB in headless, ~1.2GB in fullscreen
- Monitor with `free -h` during testing
- Kill Chrome immediately after testing to free memory

**Fullscreen Mode:**
- Press F11 to exit fullscreen manually if needed
- Or use `pkill chrome` from terminal

**Debugging Port:**
- Port 9222 is standard Chrome debugging port
- Only one Chrome instance can use it at a time
- Always cleanup after testing

---

**Created:** 2025-11-08
**Version:** 1.0
