# Dependencies & Tools

**B2B Quotation Platform - Installed Tools & Versions**

**Last Updated:** 2025-10-28 (Session 33 - CLAUDE.md optimization)

---

## Frontend Dependencies

**Location:** `frontend/package.json`

### Core Framework
- **Next.js:** 15.5.4 (App Router with Turbopack)
- **React:** 19.1.0
- **TypeScript:** 5.x (strict mode enabled)

### UI Libraries
- **Ant Design:** 5.27.4 (UI components - forms, buttons, modals, layout)
- **ag-Grid:** 34.2.0 (Community - Excel-like data tables)
- **Tailwind CSS:** 4.0 (@tailwindcss/postcss)

### Backend Integration
- **Supabase:** 2.58.0
  - `@supabase/supabase-js` - JavaScript client
  - `@supabase/ssr` - Server-side rendering support

### Utilities
- **Day.js:** 1.11.18 (date handling and formatting)

### Code Quality Tools
- **ESLint:** 9.x (linting with Next.js config)
- **Prettier:** 3.6.2 (code formatting)
- **Husky:** 9.1.7 (pre-commit hooks)
- **lint-staged:** 16.2.4 (staged files linting)

### Testing
- **Playwright:** 1.56.1 (E2E testing)
- **Jest:** (configured via Next.js)
- **React Testing Library:** (configured via Next.js)

### Installation Commands

```bash
cd frontend

# Install all dependencies
npm install

# Install specific package
npm install <package-name>

# Install dev dependency
npm install -D <package-name>

# Update dependencies
npm update

# Check outdated packages
npm outdated
```

---

## Backend Dependencies

**Location:** `backend/requirements.txt`

### Core Framework
- **FastAPI:** Latest (async web framework)
- **Uvicorn:** Latest (ASGI server with auto-reload)
- **Pydantic:** Latest (data validation and settings management)

### Database
- **Supabase:** Python client (PostgreSQL with REST API)
- **asyncpg:** Latest (async PostgreSQL driver)
- **psycopg2-binary:** Latest (PostgreSQL adapter)

### File Processing
- **pandas:** Latest (Excel/CSV parsing and data manipulation)
- **openpyxl:** Latest (Excel file reading and writing)
- **python-multipart:** Latest (file uploads support)

### Calculations
- **numpy-financial:** Latest (FV calculations for financial formulas)

### Scheduling
- **APScheduler:** 3.10.4 (cron jobs for exchange rate updates)

### Performance & Monitoring
- **slowapi:** 0.1.9 (rate limiting middleware)
- **psutil:** 7.1.2 (system monitoring for health checks)

### Testing
- **pytest:** 8.3.5 (test framework)
- **pytest-asyncio:** Latest (async test support)
- **pytest-cov:** Latest (coverage reporting)
- **httpx:** Latest (API testing client)

### Installation Commands

```bash
cd backend

# Install all dependencies
pip install -r requirements.txt

# Install specific package
pip install <package-name>

# Install in development mode
pip install -e .

# Update dependencies
pip install --upgrade -r requirements.txt

# Check outdated packages
pip list --outdated

# Freeze current environment
pip freeze > requirements.txt
```

---

## MCP Servers (Model Context Protocol)

**Configuration Files:**
- `.mcp.json` - Server definitions
- `.claude/settings.json` - Enable servers + permissions

### chrome-devtools ✅ PRIORITY TOOL

**Status:** ✅ FULLY WORKING with WSLg (Windows 11 X server)

**Purpose:** Browser automation via Chrome DevTools Protocol

**Documentation:** `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`

**Launch Command:**
```bash
DISPLAY=:0 google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-wsl-profile "http://localhost:3001" &
```

**Quick Launch Scripts:**
```bash
# Full browser (with UI)
./.claude/launch-chrome-testing.sh full http://localhost:3001/quotes/create

# Headless mode (60% less memory)
./.claude/launch-chrome-testing.sh headless

# Kill Chrome
./.claude/launch-chrome-testing.sh kill
```

**Available Tools:**
- `mcp__chrome-devtools__take_snapshot` - Accessibility tree snapshot
- `mcp__chrome-devtools__click` - Click elements
- `mcp__chrome-devtools__fill` - Fill form inputs
- `mcp__chrome-devtools__upload_file` - Upload files
- `mcp__chrome-devtools__evaluate_script` - Execute JavaScript
- `mcp__chrome-devtools__list_console_messages` - Monitor console
- `mcp__chrome-devtools__list_network_requests` - Network inspection
- `mcp__chrome-devtools__take_screenshot` - Screenshots
- **27 tools total** - See `.claude/settings.json` for complete list

**Best For:**
- Automated browser testing
- File upload testing
- Console monitoring
- Network request inspection
- Full-page screenshots

**Resource Usage:**
- Headless: 500 MB RAM, 60s startup
- Full browser: 1.2 GB RAM, 120s startup
- **Golden Rule:** Use tiered testing (start with backend tests)

### postgres ✅ Working

**Status:** ✅ Working

**Purpose:** Direct Supabase database queries and schema inspection

**Available Tools:**
- `mcp__postgres__query` - Run SQL queries

**Configuration:**
```json
{
  "mcpServers": {
    "postgres": {
      "command": "mcp-server-postgres",
      "args": ["postgresql://connection-string"]
    }
  }
}
```

**Example Usage:**
```sql
-- Query quotes
SELECT * FROM quotes WHERE organization_id = 1 LIMIT 10;

-- Check table schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quotes';
```

### github ❌ Not Functional

**Status:** ❌ Not functional (returns empty resources)

**Workaround:** Use `curl` commands with GitHub API directly

**GitHub API Token:** `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`

**Example Commands:**
```bash
# Get repo info
curl -H "Authorization: token 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" \
  https://api.github.com/repos/AgasiArgent/kvota

# List issues
curl -H "Authorization: token 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" \
  https://api.github.com/repos/AgasiArgent/kvota/issues

# Create issue
curl -X POST \
  -H "Authorization: token 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" \
  -H "Content-Type: application/json" \
  -d '{"title":"Issue title","body":"Issue description"}' \
  https://api.github.com/repos/AgasiArgent/kvota/issues

# List pull requests
curl -H "Authorization: token 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" \
  https://api.github.com/repos/AgasiArgent/kvota/pulls

# Get CI/CD workflow runs
curl -H "Authorization: token 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" \
  https://api.github.com/repos/AgasiArgent/kvota/actions/runs
```

### puppeteer ⚠️ NOT RECOMMENDED

**Status:** ⚠️ Not recommended (use Chrome DevTools MCP instead)

**Issues:**
- Cannot reliably interact with Ant Design dropdowns (portal rendering)
- File upload doesn't work with WSL2 file paths
- No built-in waiting for React state updates
- Requires complex selectors for React synthetic events

**Use Instead:** Chrome DevTools MCP
- Better React component support
- Accessibility tree for element selection
- Network waiting built-in
- File upload works with WSL2 paths

**See:** `.claude/SESSION_17_AUTOMATION_FINDINGS.md` for detailed analysis

### Recommended Additional MCP Servers

**See:** `.claude/RECOMMENDED_MCP_SERVERS.md` for configuration details

**Potentially useful:**
- `filesystem` - File operations (read, write, search)
- `memory` - Persistent memory across sessions
- `sequential-thinking` - Extended reasoning for complex problems
- `fetch` - Web scraping and API calls

---

## Development Tools

### Version Control
- **Git:** SSH authentication configured
- **GitHub:** Repository at https://github.com/AgasiArgent/kvota
- **Git Worktrees:** Main (`/home/novi/quotation-app`) + Dev (`/home/novi/quotation-app-dev`)

### CI/CD
- **GitHub Actions:** Automated testing and deployment
- **Workflows:**
  - Frontend: Lint, type-check, build
  - Backend: Pytest, coverage
  - Deploy: Auto-deploy on main branch push (if tests pass)

### Pre-commit Hooks
- **Husky:** Git hooks manager
- **lint-staged:** Run linters on staged files only
- **Hooks:**
  - Pre-commit: ESLint, Prettier, type-check
  - Pre-push: Run tests (optional)

### Code Editors
- **VS Code:** Primary editor with Remote WSL extension
- **Extensions (Recommended):**
  - ESLint
  - Prettier
  - Python
  - TypeScript
  - Tailwind CSS IntelliSense

---

## Database

### Supabase PostgreSQL

**Type:** Multi-tenant with Row-Level Security (RLS)

**Connection Methods:**
1. **REST API:** Via Supabase JavaScript/Python client
2. **Direct Connection:** Via `DATABASE_URL` and asyncpg/psycopg2

**Environment Variables:**
```bash
# Backend .env
DATABASE_URL=postgresql://user:password@host:port/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Frontend .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Migrations:**
- **Location:** `backend/migrations/*.sql`
- **Tracking:** `backend/migrations/MIGRATIONS.md`
- **Apply:** Via Supabase dashboard SQL editor

**Key Tables:**
- `users` - User profiles and authentication
- `organizations` - Multi-tenant organizations
- `org_members` - User-organization relationships
- `quotes` - Quote headers
- `quote_products` - Quote line items
- `customers` - Customer information
- `calculation_settings` - Admin-only variables
- `activity_logs` - Audit trail
- `feedback` - User feedback/bug reports

---

## Update History

### 2025-10-28 (Session 33)
- Extracted dependencies to separate file during CLAUDE.md optimization
- No dependency changes

### 2025-10-26 (Session 26)
- **Added:** APScheduler 3.10.4 (exchange rate cron jobs)
- **Added:** slowapi 0.1.9 (rate limiting)
- **Added:** psutil 7.1.2 (system monitoring)

### 2025-10-21 (Session 15)
- No dependency changes (calculation engine integration)

### 2025-10-15 (Sessions 8-14)
- No dependency changes (ag-Grid restructure)

---

## Installation From Scratch

### Prerequisites
```bash
# WSL2 with Ubuntu
wsl --install -d Ubuntu

# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.10+
sudo apt-get update
sudo apt-get install -y python3.10 python3-pip

# Git
sudo apt-get install -y git
```

### Project Setup
```bash
# Clone repository
git clone git@github.com:AgasiArgent/kvota.git /home/novi/quotation-app
cd /home/novi/quotation-app

# Create dev worktree
git worktree add ../quotation-app-dev dev

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env  # Edit with actual values
cd ../frontend
cp .env.local.example .env.local  # Edit with actual values
```

### MCP Server Setup
```bash
# Install Chrome DevTools MCP
npm install -g @modelcontextprotocol/server-chrome-devtools

# Install Postgres MCP
npm install -g mcp-server-postgres

# Configure .mcp.json (already in repo)
# Configure .claude/settings.json (already in repo)

# Reload VS Code window
# Ctrl+Shift+P → "Reload Window"
```

---

## Troubleshooting Dependencies

### Frontend Build Errors

**Issue:** `Module not found` errors
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Issue:** Type errors from Ant Design
```bash
# Ant Design types are included, ensure TypeScript version is 5.x
npm install -D typescript@5
```

### Backend Import Errors

**Issue:** `ModuleNotFoundError`
```bash
cd backend
pip install -r requirements.txt
# Or install specific package
pip install <package-name>
```

**Issue:** `weasyprint` fails on Windows native
```bash
# DO NOT use Windows native Python
# weasyprint requires GTK, which only works in WSL2
# Always run backend in WSL2
```

### MCP Server Not Working

**Issue:** Chrome DevTools MCP not connecting
```bash
# Check Chrome is running with debugging port
lsof -i :9222

# If not, restart Chrome
./.claude/launch-chrome-testing.sh kill
./.claude/launch-chrome-testing.sh full
```

**Issue:** Permissions not working
```bash
# Check .claude/settings.json has explicit tool permissions
# Reload VS Code window after editing
# Ctrl+Shift+P → "Reload Window"
```

---

**See:**
- `.claude/QUICK_START.md` - Installation and setup guide
- `.claude/TROUBLESHOOTING.md` - Common issues and solutions
- `CLAUDE.md` - Core principles and architecture
