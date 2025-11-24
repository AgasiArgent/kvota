# Quick Start Guide

**B2B Quotation Platform - Daily Development Guide**

**Last Updated:** 2025-10-28

---

## First-Time Setup

### Prerequisites
- WSL2 with Ubuntu (Windows 11)
- Node.js 18+ installed in WSL2
- Python 3.10+ installed in WSL2
- Git configured with SSH keys

### Clone Repository
```bash
# Clone main worktree
git clone git@github.com:AgasiArgent/kvota.git /home/novi/quotation-app
cd /home/novi/quotation-app

# Create dev worktree
git worktree add ../quotation-app-dev dev
```

### Install Dependencies
```bash
# Frontend dependencies
cd /home/novi/quotation-app/frontend
npm install

# Backend dependencies
cd /home/novi/quotation-app/backend
pip install -r requirements.txt
```

### Environment Configuration
- **Main worktree:** `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`
- **Dev worktree:** `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8001`
- **Backend:** Main uses port 8000, Dev uses `PORT=8001` in `.env`

---

## Daily Development Routine

### Morning: Start Servers

**Option 1: Start Both Worktrees** (if users are testing)
```bash
# Terminal 1: Start main worktree (for users)
cd /home/novi/quotation-app
npm run dev &  # Frontend on :3000
cd backend && uvicorn main:app --reload &  # Backend on :8000

# Terminal 2: Start dev worktree (for your work)
cd /home/novi/quotation-app-dev
./start-dev.sh both  # Frontend :3001, Backend :8001
```

**Option 2: Start Dev Only** (most common)
```bash
cd /home/novi/quotation-app-dev
./start-dev.sh both  # Starts both frontend :3001 and backend :8001
```

### During Day: Development Cycle

```bash
# Work in dev worktree
cd /home/novi/quotation-app-dev

# Make changes, test on :3001/:8001

# Run tests before committing
cd backend && pytest -v
cd frontend && npm test

# Commit frequently
git add .
git commit -m "feat: Add new feature"
git push origin dev
```

### Evening: Merge to Main

```bash
# 1. Ensure all tests pass
cd /home/novi/quotation-app-dev
cd backend && pytest
cd frontend && npm test && npm run lint && npm run type-check

# 2. Push dev changes
git push origin dev

# 3. Switch to main worktree
cd /home/novi/quotation-app

# 4. Merge dev to main
git pull origin main  # Ensure main is up-to-date
git merge dev
git push origin main

# 5. Main servers auto-reload (uvicorn --reload)
```

---

## Essential Commands

### Server Management

**Start Servers:**
```bash
# Dev worktree - recommended script
cd /home/novi/quotation-app-dev
./start-dev.sh both      # Start both
./start-dev.sh frontend  # Frontend only
./start-dev.sh backend   # Backend only

# Main worktree - manual
cd /home/novi/quotation-app/frontend
npm run dev  # Port 3000

cd /home/novi/quotation-app/backend
uvicorn main:app --reload  # Port 8000
```

**Stop Servers:**
```bash
# Kill by port
pkill -f "npm run dev.*3001"  # Dev frontend
pkill -f "uvicorn.*8001"      # Dev backend
pkill -f "npm run dev.*3000"  # Main frontend
pkill -f "uvicorn.*8000"      # Main backend

# Kill all node/uvicorn
pkill -9 node
pkill -9 uvicorn
```

**Check Running Servers:**
```bash
# List processes on ports
lsof -i :3000  # Main frontend
lsof -i :3001  # Dev frontend
lsof -i :8000  # Main backend
lsof -i :8001  # Dev backend

# Or use netstat
netstat -tuln | grep -E '3000|3001|8000|8001'
```

### Testing

**Backend Tests:**
```bash
cd backend

# Run all tests
pytest -v

# Run with coverage
pytest --cov=. --cov-report=term-missing

# Run specific test file
pytest tests/test_quotes_calc_mapper.py -v

# Run specific test
pytest tests/test_file.py::test_function_name -v

# Watch mode (auto-rerun)
ptw -v  # Requires: pip install pytest-watch
```

**Frontend Tests:**
```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

**Automated Browser Testing:**
```bash
# Use tiered approach (fastest to slowest)
cd backend && pytest -v  # Tier 1: Backend unit tests (5s)
./.claude/test-backend-only.sh  # Tier 2: Backend API tests (30s)
./.claude/launch-chrome-testing.sh headless  # Tier 3: Headless browser (60s)
./.claude/launch-chrome-testing.sh full  # Tier 4: Full browser (120s) - only when needed!

# Kill Chrome when done
./.claude/launch-chrome-testing.sh kill
```

### Git Worktree

**List worktrees:**
```bash
git worktree list
```

**Create new worktree:**
```bash
# For existing branch
git worktree add <path> <branch>

# For new branch
git worktree add -b <branch> <path> <start-point>

# Example: Create hotfix
git worktree add ../quotation-app-hotfix hotfix/fix-bug
```

**Remove worktree:**
```bash
git worktree remove <path>
# Example: git worktree remove ../quotation-app-hotfix
```

**See:** `.claude/GIT_WORKTREE_QUICK_REFERENCE.md` for detailed commands
**See:** `.claude/WORKFLOWS.md` for workflow guides

### Code Quality

**Linting:**
```bash
cd frontend
npm run lint
npm run lint:fix  # Auto-fix issues
```

**Type Checking:**
```bash
cd frontend
npm run type-check
```

**Build Check:**
```bash
cd frontend
npm run build  # Ensure production build works
```

**Pre-Push Checks:**
```bash
# Run all CI checks locally
cd frontend
npm run lint && npm run type-check && npm run build
cd ../backend
pytest -v
```

---

## Test User Credentials

**Email:** `andrey@masterbearingsales.ru`
**Password:** `password`
**Organization:** МАСТЕР БЭРИНГ ООО (Master Bearing LLC)

**Access:** http://localhost:3000 (main) or http://localhost:3001 (dev)

---

## Quick Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### WSL2 Memory Issues
```bash
# Monitor resources
./.claude/monitor-wsl-resources.sh

# Kill Chrome if memory > 75%
./.claude/launch-chrome-testing.sh kill

# If WSL2 frozen, restart from PowerShell
wsl --shutdown
wsl
```

### VS Code Disconnected
```bash
# Check WSL2 health
./.claude/wsl2-health-check.sh

# Kill Chrome, restart VS Code
pkill -9 chrome
rm -rf /tmp/chrome-wsl-profile
# Restart VS Code
```

**See:** `.claude/TROUBLESHOOTING.md` for comprehensive troubleshooting guide

---

## File Operation Guidelines

**ALWAYS use specialized tools:**
- **Read files:** Use `Read` tool (not `cat`)
- **Edit files:** Use `Edit` tool (not `sed`/`awk`)
- **Write files:** Use `Write` tool (not `echo >`)
- **Reserve Bash:** Only for terminal commands (git, npm, python, pytest)

---

## Important Gotchas

### WSL2 Environment
- ✅ **Use WSL2 for everything** - Frontend + Backend both in WSL2
- ❌ **Do NOT migrate to Windows** - Native modules fail (lightningcss, weasyprint)
- ⚠️ **Memory limits** - Chrome can freeze WSL2 at 85%+ memory
- Configure `.wslconfig` at `C:\Users\Lenovo\.wslconfig` (6GB RAM limit)

### Git Worktrees
- Work in dev worktree 90% of the time
- Never code directly in main (only merges)
- Use @orchestrator for worktree-aware commits

### CI/CD
- ⚠️ **GitHub Actions needs secrets** - Tests fail without Supabase credentials
- ✅ **Tests pass locally** - 75/84 passing
- Add secrets at: https://github.com/AgasiArgent/kvota/settings/secrets/actions

### Chrome DevTools MCP
- ✅ **PRIORITY TOOL** for automated testing
- ⚠️ **Use tiered testing** - Start with backend tests, browser only when needed
- See `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md`

---

## Documentation Map

**Read first (every session):**
- `.claude/SESSION_PROGRESS.md` - Current progress, blockers, next steps

**Core documentation:**
- `CLAUDE.md` - Core principles, architecture, agent system
- `.claude/QUICK_START.md` - This file (daily routine)

**Workflows:**
- `.claude/WORKFLOWS.md` - Git worktree, API changes, migrations
- `.claude/GIT_WORKTREE_QUICK_REFERENCE.md` - Git commands
- `.claude/TESTING_WORKFLOW.md` - TDD workflow, coverage goals

**Reference:**
- `.claude/DEPENDENCIES.md` - All installed tools & versions
- `.claude/TROUBLESHOOTING.md` - Common issues & solutions
- `.claude/VARIABLES.md` - 42 calculation variables
- `.claude/TECHNICAL_DEBT.md` - Known issues & blockers

**Testing:**
- `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md` - Browser testing
- `.claude/TIERED_TESTING_GUIDE.md` - Prevent WSL2 freezing
- `.claude/MANUAL_TESTING_GUIDE.md` - Manual test scenarios

---

**Remember:** Read SESSION_PROGRESS.md at the start of every session to maintain context!
