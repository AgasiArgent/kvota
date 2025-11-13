# Scripts Directory

**Last Updated:** 2025-10-29

Utility scripts for testing, monitoring, diagnostics, and deployment organized by purpose.

---

## Directory Structure

```
.claude/scripts/
├── testing/          # Browser and API testing automation
├── monitoring/       # Resource monitoring tools
├── diagnostics/      # System health checks
├── deployment/       # Deployment utilities
└── README.md         # This file
```

---

## Testing Scripts (`./testing/`)

### 1. `safe-test-session.sh` ⭐ **RECOMMENDED**

**All-in-one wrapper for Chrome DevTools MCP testing with automatic resource management.**

**Purpose:** Run automated browser tests with built-in memory monitoring and auto-cleanup to prevent WSL2 freezing.

**Usage:**
```bash
./.claude/scripts/testing/safe-test-session.sh [mode] [url] [timeout_minutes]
```

**Examples:**
```bash
# Headless mode with 10-minute timeout (default)
./.claude/scripts/testing/safe-test-session.sh headless http://localhost:3001/quotes/create 10

# Full GUI mode with 15-minute timeout
./.claude/scripts/testing/safe-test-session.sh full http://localhost:3001 15

# Use defaults (headless, localhost:3000, 10 min)
./.claude/scripts/testing/safe-test-session.sh
```

**Features:**
- ✅ Automatically launches Chrome in specified mode
- ✅ Starts background memory monitor
- ✅ Auto-kills Chrome if memory exceeds 85%
- ✅ Session timeout to prevent endless runs
- ✅ Guaranteed cleanup on Ctrl+C or errors
- ✅ Memory usage summary at end

**Memory Usage:**
- Headless: ~500 MB
- Full GUI: ~1.2 GB

**When to Use:** Primary choice for all automated testing. Prevents WSL2 freezing by automatically managing resources.

---

### 2. `launch-chrome-testing.sh`

**Direct Chrome launcher with memory-optimized flags.**

**Purpose:** Launch Chrome with remote debugging for Chrome DevTools MCP testing.

**Usage:**
```bash
./.claude/scripts/testing/launch-chrome-testing.sh [mode] [url]
```

**Modes:**
- `full` - Full GUI Chrome (1.2 GB memory)
- `headless` - Headless Chrome (500 MB memory, 60% less)
- `kill` - Kill all Chrome processes
- `status` - Show memory usage and Chrome processes

**Examples:**
```bash
# Launch full GUI Chrome
./.claude/scripts/testing/launch-chrome-testing.sh full http://localhost:3001/quotes/create

# Launch headless Chrome (60% less memory)
./.claude/scripts/testing/launch-chrome-testing.sh headless

# Kill all Chrome processes
./.claude/scripts/testing/launch-chrome-testing.sh kill

# Check memory status
./.claude/scripts/testing/launch-chrome-testing.sh status
```

**Memory-Optimized Flags:**
- `--disable-dev-shm-usage` - Use /tmp instead of /dev/shm
- `--js-flags="--max-old-space-size=512"` - Limit JS heap (full mode)
- `--js-flags="--max-old-space-size=256"` - Limit JS heap (headless mode)
- `--disable-extensions` - Disable extensions
- `--disable-background-networking` - Reduce network overhead
- `--disable-sync` - Disable Chrome sync

**When to Use:** Direct control over Chrome launch. Use with `safe-test-session.sh` or `auto-cleanup-chrome.sh` for safety.

---

### 3. `auto-cleanup-chrome.sh`

**Background memory monitor that auto-kills Chrome when memory exceeds threshold.**

**Purpose:** Run as background process to prevent WSL2 freezing during extended testing sessions.

**Usage:**
```bash
./.claude/scripts/testing/auto-cleanup-chrome.sh [threshold_percent] &
```

**Examples:**
```bash
# Auto-kill Chrome at 85% memory (default)
./.claude/scripts/testing/auto-cleanup-chrome.sh 85 &

# Auto-kill Chrome at 75% memory (more aggressive)
./.claude/scripts/testing/auto-cleanup-chrome.sh 75 &

# Check log
tail -f /tmp/chrome-auto-cleanup.log
```

**How It Works:**
1. Checks memory usage every 5 seconds
2. Logs status every 50 seconds
3. When memory exceeds threshold:
   - Kills all Chrome processes
   - Cleans up Chrome profile directory
   - Logs memory freed

**When to Use:**
- Manually run in background before starting Chrome
- Automatically used by `safe-test-session.sh`

**⚠️ Note:** This will force-kill Chrome without warning when threshold reached. Save your work before testing.

---

### 4. `test-backend-only.sh`

**Backend API testing without browser - fastest and lowest memory.**

**Purpose:** Test backend endpoints with curl. No browser required.

**Usage:**
```bash
./.claude/scripts/testing/test-backend-only.sh
```

**Tests Performed:**
1. ✅ Check if backend server is running
2. ✅ Login with test credentials
3. ✅ Fetch admin calculation settings
4. ✅ Fetch variable templates
5. ✅ Test calculation endpoint with minimal data

**Memory Usage:** ~200 MB (90% less than browser testing)

**Time:** ~30 seconds

**When to Use:**
- **Tier 2 testing** (after backend unit tests, before browser tests)
- Testing backend changes that don't affect UI
- Quick smoke tests during development
- CI/CD pipeline validation

**Example Output:**
```
✓ Backend is running (HTTP 200)
✓ Login successful (JWT token received)
✓ Fetched admin settings
⚠ No variable templates found (this is OK if none created yet)
✓ Calculation succeeded (minimal data)
```

---

## Monitoring Scripts (`./monitoring/`)

### 1. `monitor-wsl-resources.sh` ⭐ **RECOMMENDED**

**Real-time WSL2 resource monitoring to prevent freezing.**

**Purpose:** Monitor memory, swap, CPU, and Chrome usage in real-time with color-coded warnings.

**Usage:**
```bash
./.claude/scripts/monitoring/monitor-wsl-resources.sh
```

**Press Ctrl+C to stop**

**Example Output:**
```
15:30:45 | Memory: 58% | Swap: 0% | CPU: 23% | Chrome: 12.5% ✅
15:30:47 | Memory: 72% | Swap: 5% | CPU: 45% | Chrome: 18.3% ⚠️  WARNING
15:30:49 | Memory: 87% | Swap: 15% | CPU: 78% | Chrome: 35.2% 🔴 CRITICAL

⚠️ CRITICAL: Memory usage above 75%!
Recommendations:
  → Kill Chrome: pkill -9 chrome
  → Stop Next.js dev server: pkill -f 'node.*next'
  → Free memory: sync && echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null
  → Restart WSL2: wsl --shutdown (from Windows PowerShell)
```

**Color Coding:**
- 🟢 **Green:** Memory < 60% (healthy)
- 🟡 **Yellow:** Memory 60-75% (warning)
- 🔴 **Red:** Memory > 75% (critical)

**When to Use:**
- Run in separate terminal during Chrome DevTools MCP testing
- Monitor memory during long development sessions
- Debug WSL2 performance issues

---

### 2. `monitor-backend-memory.sh`

**Track backend memory usage over time and save to CSV.**

**Purpose:** Measure FastAPI backend memory consumption during load testing or extended runs.

**Usage:**
```bash
./.claude/scripts/monitoring/monitor-backend-memory.sh [duration_minutes] [interval_seconds]
```

**Examples:**
```bash
# Monitor for 30 minutes, check every 10 seconds (default)
./.claude/scripts/monitoring/monitor-backend-memory.sh 30 10

# Monitor for 5 minutes, check every 5 seconds
./.claude/scripts/monitoring/monitor-backend-memory.sh 5 5
```

**Output:**
- CSV file: `/tmp/backend_memory_log_YYYYMMDD_HHMMSS.csv`
- Columns: timestamp, memory_mb, cpu_percent, rss_mb, vms_mb
- Summary: Min/Max/Avg memory usage

**When to Use:**
- Load testing to check for memory leaks
- Performance baseline measurements
- Debugging high memory usage
- CI/CD performance monitoring

---

## Diagnostic Scripts (`./diagnostics/`)

### 1. `wsl2-health-check.sh`

**Comprehensive WSL2 health diagnostics and recovery recommendations.**

**Purpose:** Diagnose WSL2 responsiveness issues and provide actionable recovery steps.

**Usage:**
```bash
# From WSL2
./.claude/scripts/diagnostics/wsl2-health-check.sh

# From Windows PowerShell (if WSL2 frozen)
wsl bash /home/novi/quotation-app-dev/.claude/scripts/diagnostics/wsl2-health-check.sh
```

**Health Checks Performed:**
1. ✅ Memory usage (RAM + swap)
2. ✅ Chrome processes and memory consumption
3. ✅ Development servers (Next.js, FastAPI)
4. ✅ Zombie processes
5. ✅ Disk usage
6. ✅ System load
7. ✅ Chrome DevTools MCP status
8. ✅ VS Code Remote WSL processes

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WSL2 Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Memory Usage
----------------------------------------
✓ Memory usage healthy (Memory: 58% used)

2. Chrome Processes
----------------------------------------
⚠ Found 23 Chrome processes
Chrome memory usage: 28.3%

3. Development Servers
----------------------------------------
ℹ Next.js dev server running (PID: 12345)
ℹ FastAPI backend running (PID: 67890)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Health Check Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ Found 2 potential issues

Recommended Actions:
1. High Memory Usage (83%):
   → Kill Chrome: pkill -9 chrome
   → Stop Next.js: pkill -f 'node.*next'
   → Restart WSL2 (from Windows PowerShell):
     wsl --shutdown
     (wait 8 seconds, then: wsl)
```

**When to Use:**
- VS Code Remote WSL disconnects and won't reconnect
- WSL2 feels sluggish or unresponsive
- Before restarting WSL2 (to understand what's wrong)
- After long testing sessions
- Troubleshooting Chrome DevTools MCP issues

**Exit Codes:**
- `0` - Healthy (no issues found)
- `1` - Issues detected (see recommendations)

---

## Deployment Scripts (`./deployment/`)

### 1. `railway-api.sh`

**Railway GraphQL API wrapper for querying deployment status.**

**Purpose:** Query Railway deployment information for the project.

**Usage:**
```bash
./.claude/scripts/deployment/railway-api.sh [query]
```

**Queries:**
- `projects` - List all projects
- `deployments` - List last 5 deployments
- `latest` - Get latest deployment status (default)

**Examples:**
```bash
# Get latest deployment status
./.claude/scripts/deployment/railway-api.sh latest

# List recent deployments
./.claude/scripts/deployment/railway-api.sh deployments

# List all projects
./.claude/scripts/deployment/railway-api.sh projects
```

**Configuration:**
- Token: `09ab2185-e96f-4607-a577-64cd4188c80a`
- Project ID: `8665b186-c453-47e4-a5f7-20211de50414`
- Service ID: `943f2c47-f03d-4558-a6a1-752d74d81fe8`

**When to Use:**
- Check deployment status from CLI
- Automate deployment monitoring
- CI/CD pipeline integration
- Debugging deployment issues

---

## Tiered Testing Strategy

**Follow this order for optimal resource usage:**

### Tier 1: Backend Unit Tests (100 MB, 5s)
```bash
cd backend && pytest -v
```

### Tier 2: Backend API Tests (200 MB, 30s)
```bash
./.claude/scripts/testing/test-backend-only.sh
```

### Tier 3: Headless Browser (500 MB, 60s)
```bash
./.claude/scripts/testing/safe-test-session.sh headless
```

### Tier 4: Full Browser (1.2 GB, 120s) - Only when needed!
```bash
./.claude/scripts/testing/safe-test-session.sh full
```

**🎯 Golden Rule:** Always start with the fastest tier that covers what you need.

---

## WSL2 Resource Management

### Preventing Freezes

**1. Use tiered testing** - Start with backend tests, only use browser when needed

**2. Monitor resources during testing:**
```bash
# Terminal 1: Run tests
./.claude/scripts/testing/safe-test-session.sh headless

# Terminal 2: Monitor resources
./.claude/scripts/monitoring/monitor-wsl-resources.sh
```

**3. Configure WSL2 memory limit:**

Edit `C:\Users\Lenovo\.wslconfig` (Windows):
```ini
[wsl2]
memory=6GB        # Limit WSL2 to 6GB RAM
processors=4      # Limit to 4 CPU cores
swap=2GB          # 2GB swap file
```

**4. Kill Chrome when done:**
```bash
./.claude/scripts/testing/launch-chrome-testing.sh kill
```

### Recovery from Freeze

**If WSL2 becomes unresponsive:**

1. **Check health** (from Windows PowerShell):
   ```powershell
   wsl bash /home/novi/quotation-app-dev/.claude/scripts/diagnostics/wsl2-health-check.sh
   ```

2. **If responsive (memory < 85%):**
   ```bash
   pkill -9 chrome
   rm -rf /tmp/chrome-wsl-profile
   # Restart VS Code
   ```

3. **If unresponsive (memory > 85%):**
   ```powershell
   wsl --shutdown
   Start-Sleep -Seconds 8
   wsl
   # Then restart VS Code
   ```

---

## Best Practices

### Testing

1. ✅ **Always use `safe-test-session.sh`** for automated testing
2. ✅ **Use headless mode** when possible (60% less memory)
3. ✅ **Kill Chrome after tests** - Don't leave it running idle
4. ✅ **Monitor memory** during long sessions
5. ✅ **Follow tiered testing** - Start with backend tests

### Monitoring

1. ✅ **Run resource monitor** in separate terminal during testing
2. ✅ **Watch for 75% memory** threshold - critical zone
3. ✅ **Check health before long sessions** to start fresh
4. ✅ **Track backend memory** during load tests

### Troubleshooting

1. ✅ **Run health check first** to diagnose issues
2. ✅ **Check logs** - `/tmp/chrome-auto-cleanup.log`, `/tmp/chrome-wsl.log`
3. ✅ **Restart WSL2 cleanly** - Use `wsl --shutdown`, wait 8s, then `wsl`
4. ✅ **Don't force kill WSL2** - Let it shutdown gracefully

---

## Script Maintenance

**To update scripts:**

1. Edit script file directly
2. Test changes locally
3. Update this README if behavior changes
4. Commit with descriptive message

**To add new scripts:**

1. Place in appropriate subdirectory
2. Make executable: `chmod +x script.sh`
3. Add shebang: `#!/bin/bash`
4. Add header comment explaining purpose
5. Document in this README
6. Commit with `git add`

---

## Quick Reference

**Most Common Commands:**

```bash
# Run safe automated test session (RECOMMENDED)
./.claude/scripts/testing/safe-test-session.sh headless http://localhost:3001 10

# Monitor resources during testing
./.claude/scripts/monitoring/monitor-wsl-resources.sh

# Check WSL2 health
./.claude/scripts/diagnostics/wsl2-health-check.sh

# Kill Chrome when done
./.claude/scripts/testing/launch-chrome-testing.sh kill

# Quick backend test (no browser)
./.claude/scripts/testing/test-backend-only.sh
```

**Emergency Commands:**

```bash
# WSL2 frozen - from Windows PowerShell
wsl --shutdown

# VS Code disconnected - check health
wsl bash /home/novi/quotation-app-dev/.claude/scripts/diagnostics/wsl2-health-check.sh

# Chrome using too much memory
pkill -9 chrome
rm -rf /tmp/chrome-wsl-profile
```

---

**For detailed Chrome DevTools MCP testing guide, see:** `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`

**For tiered testing strategy, see:** `.claude/TIERED_TESTING_GUIDE.md`
