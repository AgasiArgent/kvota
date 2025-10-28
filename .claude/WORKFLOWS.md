# Development Workflows

**B2B Quotation Platform - Workflow Guides**

**Last Updated:** 2025-10-28

---

## Table of Contents

1. [Git Worktree Workflow](#git-worktree-workflow)
2. [Making API Changes](#making-api-changes)
3. [Database Migrations](#database-migrations)
4. [UI Changes](#ui-changes)
5. [Testing Workflow](#testing-workflow)
6. [Deployment Workflow](#deployment-workflow)

---

## Git Worktree Workflow

**See `.claude/GIT_WORKTREE_QUICK_REFERENCE.md` for quick command reference.**

### Concept

Git worktrees allow multiple working directories from the same repository, each checked out to different branches. This enables running multiple versions of the app simultaneously without switching branches or stashing changes.

**Traditional Git Problem:**
```
User testing on main → Bug found → Switch to main, fix bug → Switch back to dev
                    ↓
            Lose development context
```

**Worktree Solution:**
```
Main worktree (users testing) ← Always available on :3000/:8000
Dev worktree (active work)    ← Always available on :3001/:8001
Hotfix worktree (urgent bugs) ← Created as needed, merged to both
```

### Three-Worktree Structure

**1. Main Worktree (Production/Stable)**
- **Location:** `/home/novi/quotation-app`
- **Branch:** `main`
- **Ports:** Frontend :3000, Backend :8000
- **Purpose:** Users test from this version
- **Touch only for:** Merges from dev, hotfixes
- **Status:** Always stable, deployable

**2. Dev Worktree (Active Development)**
- **Location:** `/home/novi/quotation-app-dev`
- **Branch:** `dev`
- **Ports:** Frontend :3001, Backend :8001
- **Purpose:** 90% of work happens here
- **Features:** New features, refactoring, experiments
- **Status:** May be unstable, work in progress

**3. Hotfix Worktree (Created as Needed)**
- **Location:** `/home/novi/quotation-app-hotfix` (or similar)
- **Branch:** `hotfix/issue-name`
- **Purpose:** Urgent production bugs
- **Lifecycle:** Create → Fix → Merge to main + dev → Delete
- **Ports:** Not typically run (just fix and merge)

### Port Assignments

| Worktree | Frontend | Backend | Purpose |
|----------|----------|---------|---------|
| Main     | :3000    | :8000   | User testing (production-like) |
| Dev      | :3001    | :8001   | Active development |
| Hotfix   | N/A      | N/A     | Quick fixes (merge only) |

**Configuration:**
- Main: `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Dev: `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8001`
- Backend: Main uses default port 8000, Dev uses `PORT=8001` in `.env`

### Daily Development Workflow

**Morning Routine:**
```bash
# 1. Start main worktree (for users)
cd /home/novi/quotation-app
# Frontend: npm run dev (port 3000)
# Backend: uvicorn main:app --reload (port 8000)

# 2. Start dev worktree (for your work)
cd /home/novi/quotation-app-dev
./start-dev.sh both   # Starts both frontend :3001 and backend :8001
```

**Development Cycle:**
```bash
# Work in dev worktree
cd /home/novi/quotation-app-dev

# Make changes, commit to dev branch
git add .
git commit -m "feat: Add new feature"
git push origin dev

# Test on :3001/:8001
# When ready to deploy, merge to main
```

**Evening Routine (Merge to Main):**
```bash
# 1. Commit and push dev work
cd /home/novi/quotation-app-dev
git add .
git commit -m "feat: Complete feature X"
git push origin dev

# 2. Switch to main worktree
cd /home/novi/quotation-app

# 3. Merge dev to main
git pull origin main  # Ensure main is up-to-date
git merge dev         # Merge dev changes
git push origin main  # Push to GitHub

# 4. Restart main servers if needed
# (or just let uvicorn --reload handle it)
```

### Hotfix Workflow (Urgent Production Bugs)

**Scenario:** User reports critical bug on main (:3000/:8000) while you're working on new feature in dev.

**Step 1: Create Hotfix Worktree**
```bash
cd /home/novi/quotation-app  # Go to main worktree
git worktree add ../quotation-app-hotfix hotfix/fix-calculation-error
cd ../quotation-app-hotfix
```

**Step 2: Fix Bug**
```bash
# Make fix in hotfix worktree
# Edit files, test locally
git add .
git commit -m "fix: Correct calculation formula"
git push origin hotfix/fix-calculation-error
```

**Step 3: Merge to Main (Production)**
```bash
cd /home/novi/quotation-app  # Main worktree
git merge hotfix/fix-calculation-error
git push origin main
```

**Step 4: Merge to Dev (Keep in Sync)**
```bash
cd /home/novi/quotation-app-dev  # Dev worktree
git merge hotfix/fix-calculation-error
git push origin dev
```

**Step 5: Clean Up**
```bash
# Remove hotfix worktree
git worktree remove ../quotation-app-hotfix

# Delete hotfix branch (optional)
git branch -d hotfix/fix-calculation-error
git push origin --delete hotfix/fix-calculation-error
```

**Result:** Bug fixed on main, dev has the fix too, you never lost your development context!

### Managing Worktrees

**List All Worktrees:**
```bash
git worktree list
# /home/novi/quotation-app      1ff2bb7 [main]
# /home/novi/quotation-app-dev  a5c3d21 [dev]
```

**Create New Worktree:**
```bash
# From existing branch
git worktree add <path> <existing-branch>

# From new branch
git worktree add -b <new-branch> <path> <start-point>

# Example: Create feature worktree
git worktree add ../quotation-app-feature feature/new-dashboard
```

**Remove Worktree:**
```bash
# Remove worktree directory
git worktree remove <path>

# Example
git worktree remove ../quotation-app-hotfix
```

**Prune Stale Worktrees:**
```bash
# Clean up deleted worktree references
git worktree prune
```

### Using start-dev.sh Script

**Location:** `/home/novi/quotation-app-dev/start-dev.sh`

**Usage:**
```bash
cd /home/novi/quotation-app-dev

# Start both frontend and backend
./start-dev.sh both

# Start only frontend on :3001
./start-dev.sh frontend

# Start only backend on :8001
./start-dev.sh backend
```

**What It Does:**
- Automatically starts servers on correct ports (:3001/:8001)
- Runs in background (returns control to terminal)
- Prints process IDs for later management
- Uses correct environment (dev branch, dev .env files)

**Stop Dev Servers:**
```bash
# Kill frontend on :3001
pkill -f "npm run dev.*3001"

# Kill backend on :8001
pkill -f "uvicorn.*8001"

# Or kill by PID (from start-dev.sh output)
kill <PID>
```

### Best Practices

**1. Always Work in Dev Worktree**
- Don't make changes directly in main worktree (except merges)
- Main should only receive changes via merges
- Keeps main stable for user testing

**2. Merge Dev → Main Regularly**
- Merge at end of day or after completing features
- Don't let dev drift too far from main
- Test on main (:3000/:8000) before users arrive

**3. Use Hotfix Worktrees for Urgent Bugs**
- Create hotfix worktree from main
- Fix bug, merge to both main and dev
- Delete hotfix worktree immediately after
- Don't accumulate hotfix worktrees

**4. Keep Worktrees in Sync**
- Pull regularly in both worktrees
- After merging, pull in other worktree
- Prevents merge conflicts

**5. Different Ports = No Conflicts**
- Main and dev can run simultaneously
- Switch between :3000 and :3001 in browser
- No need to stop/start servers

**6. Commit Often in Dev**
- Dev is your sandbox
- Commit frequently, even if incomplete
- Squash commits before merging to main if needed

### Common Scenarios

**Scenario 1: Feature Takes Multiple Days**
```
Day 1: Work in dev, commit, push dev
Day 2: Continue in dev (main untouched, users keep testing)
Day 3: Complete feature, merge dev → main
```

**Scenario 2: Bug During Feature Development**
```
Dev worktree: Feature half-done (don't commit)
Create hotfix worktree from main
Fix bug in hotfix
Merge hotfix → main (users get fix)
Merge hotfix → dev (feature keeps fix)
Return to dev, continue feature
```

**Scenario 3: Testing on Both Versions**
```
Main :3000 - User reports bug "can't save quote"
Dev :3001 - You test same flow, works fine
Conclusion: Bug is main-specific, fixed in dev
Merge dev → main to deploy fix
```

**Scenario 4: Rolling Back Main**
```
Merged dev → main, users report issues
Main worktree: git reset --hard HEAD~1
Main is now previous version
Dev still has changes, fix issues
Merge again when ready
```

### Orchestrator Agent Awareness

**The @orchestrator agent is worktree-aware:**
- Detects which worktree you're in (`pwd` check)
- Commits to appropriate branch (dev vs main)
- Asks before merging dev → main
- Follows worktree-specific git workflow
- See `.claude/agents/orchestrator.md` for details

**When you run @orchestrator:**
```
In dev worktree → Commits to dev, asks to merge to main
In main worktree → Only merges (no direct development)
```

---

## Making API Changes

### Step-by-Step Process

**1. Update Backend Route**
```bash
# Edit route file
cd backend
# Use Read tool to read routes/quotes.py (or relevant file)
# Use Edit tool to modify route
```

**Example:**
```python
# backend/routes/quotes.py
@router.post("/quotes", response_model=QuoteResponse)
async def create_quote(
    quote_data: QuoteCreate,
    user: dict = Depends(get_current_user),
    db: AsyncConnection = Depends(get_db)
):
    # Implementation
    pass
```

**2. Update Pydantic Models (if needed)**
```python
# backend/models/quotes.py
class QuoteCreate(BaseModel):
    customer_id: int
    products: List[ProductInput]
    # Add new fields
```

**3. Update Frontend Service**
```bash
cd frontend
# Use Read tool to read src/lib/api/quotes-service.ts
# Use Edit tool to add new API call
```

**Example:**
```typescript
// frontend/src/lib/api/quotes-service.ts
export async function createQuote(quoteData: QuoteCreateInput): Promise<Quote> {
  const response = await fetch(`${API_URL}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteData),
  });
  if (!response.ok) throw new Error('Failed to create quote');
  return response.json();
}
```

**4. Update TypeScript Interfaces**
```typescript
// frontend/src/types/quotes.ts
export interface QuoteCreateInput {
  customer_id: number;
  products: ProductInput[];
  // Add new fields
}
```

**5. Test with Real API Call**
```bash
# Backend test
cd backend
pytest tests/test_quotes.py -v

# Frontend test (or manual testing)
cd frontend
npm test
# Or test in browser at http://localhost:3001
```

### Best Practices

- Always update backend first, then frontend
- Keep Pydantic models and TypeScript interfaces in sync
- Add API tests before frontend integration
- Document new endpoints in code comments

---

## Database Migrations

### Step-by-Step Process

**1. Create Migration File**
```bash
# Create new migration file
cd backend/migrations
# Name: YYYYMMDD_description.sql
# Example: 20251028_add_user_profile_fields.sql
```

**2. Write Migration SQL**
```sql
-- Add new columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(100);

-- Create new table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Update RLS policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT
  USING (user_id = (current_setting('app.user_id')::int));
```

**3. Update Table Definitions**
```python
# backend/models/users.py
class UserProfile(BaseModel):
    phone: Optional[str] = None
    manager_name: Optional[str] = None
```

**4. Test via Supabase Dashboard**
- Go to Supabase Dashboard → SQL Editor
- Run migration SQL
- Verify tables and columns created
- Test RLS policies with sample queries

**5. Update Migrations Log**
```bash
# Edit backend/migrations/MIGRATIONS.md
# Document what changed, why, and any rollback instructions
```

### Best Practices

- Always test migrations locally first
- Write rollback SQL in comments
- Update RLS policies for new tables
- Document breaking changes clearly
- Test with actual user permissions

---

## UI Changes

### Step-by-Step Process

**1. Read Current Component**
```bash
cd frontend
# Use Read tool to read existing component
# Example: src/app/quotes/create/page.tsx
```

**2. Use Component Libraries**
- **Ant Design** for forms, layout, buttons, modals
- **ag-Grid** for data tables (Excel-like features)
- **Tailwind CSS** for custom styling

**Example:**
```tsx
import { Form, Input, Button, Card } from 'antd';

export default function QuoteForm() {
  const [form] = Form.useForm();

  return (
    <Card title="Create Quote">
      <Form form={form} layout="vertical">
        <Form.Item label="Customer" name="customer_id" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Create Quote
        </Button>
      </Form>
    </Card>
  );
}
```

**3. Match Existing Styling Patterns**
- Use Ant Design theme colors
- Follow 4-card compact layout pattern (from quote creation)
- Ensure responsive design (mobile, tablet, desktop)

**4. Test Responsive Design**
```bash
# Use Chrome DevTools MCP to test different screen sizes
./.claude/launch-chrome-testing.sh full http://localhost:3001/quotes/create

# Or manual testing
# Open browser, resize window, check mobile view
```

### Best Practices

- Always read existing component before editing
- Reuse existing components where possible
- Test on mobile, tablet, desktop
- Follow Ant Design design system
- Use semantic HTML and ARIA labels for accessibility

---

## Testing Workflow

**See `.claude/TESTING_WORKFLOW.md` for comprehensive guide.**

### Quick Testing Commands

**Backend:**
```bash
cd backend
pytest -v  # Run all tests
pytest tests/test_quotes.py -v  # Run specific file
pytest --cov=. --cov-report=term-missing  # With coverage
```

**Frontend:**
```bash
cd frontend
npm test  # Run all tests
npm test -- --coverage  # With coverage
npm test -- --watch  # Watch mode
```

**Automated Browser Testing:**
```bash
# Tiered approach (fastest to slowest)
cd backend && pytest -v  # Tier 1: Backend unit (5s)
./.claude/test-backend-only.sh  # Tier 2: Backend API (30s)
./.claude/launch-chrome-testing.sh headless  # Tier 3: Headless (60s)
./.claude/launch-chrome-testing.sh full  # Tier 4: Full browser (120s)
```

### Test-Driven Development (TDD)

**Red → Green → Refactor:**
1. Write test first (fails - RED)
2. Implement feature (passes - GREEN)
3. Refactor code (tests protect)
4. Check coverage (aim for 80%+)

---

## Deployment Workflow

**Note:** Deployment is managed via GitHub Actions CI/CD.

### Pre-Deployment Checklist

**1. Run All Tests Locally**
```bash
cd backend && pytest -v
cd frontend && npm test
```

**2. Run Lint & Type Check**
```bash
cd frontend
npm run lint
npm run type-check
```

**3. Build Frontend**
```bash
cd frontend
npm run build  # Ensure production build works
```

**4. Update Documentation**
```bash
# Update SESSION_PROGRESS.md with session summary
# Update CLAUDE.md if dependencies changed
# Update TECHNICAL_DEBT.md if issues found
```

**5. Use @orchestrator for Final Checks**
```bash
# @orchestrator runs QA, security, code review in parallel
# Auto-fixes minor issues, reports critical issues
# Updates docs, commits, pushes to GitHub
```

### Deployment Steps

**1. Merge Dev → Main**
```bash
cd /home/novi/quotation-app-dev
git push origin dev

cd /home/novi/quotation-app
git pull origin main
git merge dev
git push origin main
```

**2. GitHub Actions Runs CI/CD**
- Linting
- Type checking
- Unit tests (backend + frontend)
- Build frontend
- Deploy to production (if all pass)

**3. Monitor Deployment**
- Check GitHub Actions status
- Verify deployment succeeded
- Test production URL

### Rollback (if needed)

**Option 1: Git Revert**
```bash
cd /home/novi/quotation-app
git revert HEAD
git push origin main
```

**Option 2: Git Reset (if not deployed yet)**
```bash
cd /home/novi/quotation-app
git reset --hard HEAD~1
git push origin main --force  # Use with caution!
```

---

**Remember:** Always work in dev worktree, test thoroughly, then merge to main!
