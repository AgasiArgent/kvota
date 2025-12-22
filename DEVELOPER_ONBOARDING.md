# Developer Onboarding Guide - Kvota B2B Platform

**Welcome to the team!** This guide will help you get up and running with the Kvota B2B quotation platform.

**Last Updated:** 2025-12-18
**Document Owner:** Technical Lead
**Estimated Setup Time:** 2-3 hours (Day 1)

---

## Table of Contents

1. [Welcome & Project Overview](#1-welcome--project-overview)
2. [Quick Start (Day 1)](#2-quick-start-day-1)
3. [Tech Stack Reference](#3-tech-stack-reference)
4. [Architecture Overview](#4-architecture-overview)
5. [Project Structure](#5-project-structure)
6. [Essential Documentation Links](#6-essential-documentation-links)
7. [Git Workflow](#7-git-workflow)
8. [Common Development Tasks](#8-common-development-tasks)
9. [Useful Commands Reference](#9-useful-commands-reference)
10. [First Tasks (Graduated Complexity)](#10-first-tasks-graduated-complexity)
11. [Getting Help](#11-getting-help)
12. [30-60-90 Day Goals](#12-30-60-90-day-goals)

---

## 1. Welcome & Project Overview

### What is Kvota?

Kvota is a B2B quotation platform for Russian cross-border trade (import/export). It helps companies create commercial proposals with complex multi-currency calculations, manage customers, and track quotes through approval workflows.

### Business Context

**Primary Users:** Russian import/export companies
**Key Features:**
- Multi-currency quote creation with 42 calculation variables
- 13-phase pricing calculation engine
- CRM system (customers, leads, contacts)
- Multi-role approval workflow (Sales → Logistics → Customs → Financial)
- Exchange rate integration (Central Bank of Russia API)
- Multi-tenant architecture (each organization has isolated data)

**Tech Highlights:**
- React 19 + Next.js 15 frontend with shadcn/ui
- FastAPI Python backend
- Supabase PostgreSQL with Row-Level Security (RLS)
- Advanced calculation engine with currency conversion
- Excel/PDF export capabilities

---

## 2. Quick Start (Day 1)

### Pre-requisites

Ensure you have these installed:

| Tool | Version | Check Command | Install Link |
|------|---------|---------------|--------------|
| **Node.js** | 20+ | `node --version` | https://nodejs.org/ |
| **Python** | 3.12+ | `python --version` | https://www.python.org/ |
| **Git** | Latest | `git --version` | https://git-scm.com/ |
| **WSL2** (Windows only) | Latest | `wsl --version` | https://docs.microsoft.com/windows/wsl/ |

**Important:** This project runs in **WSL2** on Windows. Do NOT use native Windows environment.

### Clone & Setup

```bash
# 1. Clone repository
git clone https://github.com/AgasiArgent/kvota.git
cd kvota

# 2. Setup backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows WSL: source venv/bin/activate
pip install -r requirements.txt

# 3. Setup frontend
cd ../frontend
npm install

# 4. Copy environment files
cp backend/.env.example backend/.env  # Ask team lead for actual credentials
cp frontend/.env.local.example frontend/.env.local
```

### Get Credentials from Team Lead

You'll need:
- Supabase URL and API keys
- Database URL
- Test user credentials

### Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
# Server starts on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Server starts on http://localhost:3000
```

### Verification Checkpoint ✅

1. **Backend health check:**
   - Open http://localhost:8000/docs
   - You should see FastAPI Swagger UI

2. **Frontend loads:**
   - Open http://localhost:3000
   - You should see login page

3. **Test login:**
   - Email: `andrey@masterbearingsales.ru`
   - Password: `password`
   - You should access the dashboard

**If any step fails, stop and ask for help!**

---

## 3. Tech Stack Reference

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.5 | React framework with App Router |
| **React** | 19.1 | UI library |
| **TypeScript** | 5.x | Type safety |
| **shadcn/ui** | Latest | UI component library (Radix UI based) |
| **Tailwind CSS** | 4.x | Styling |
| **ag-Grid** | 34.2 | Excel-like data tables |
| **Ant Design** | 5.27 | Secondary UI components |
| **React Hook Form** | 7.68 | Form management |
| **Zod** | 4.1 | Schema validation |

**Frontend Docs:** See `frontend/CLAUDE.md` for detailed patterns

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.115 | Python web framework |
| **Python** | 3.12 | Language |
| **Pydantic** | 2.10 | Data validation |
| **asyncpg** | 0.30 | PostgreSQL async driver |
| **Supabase Client** | 2.11 | Database REST API |
| **Pandas** | 2.2 | Data processing |
| **WeasyPrint** | 66.0 | PDF generation |
| **APScheduler** | 3.10 | Cron jobs (exchange rates) |

**Backend Docs:** See `backend/CLAUDE.md` for detailed patterns

### Database

| Technology | Details |
|------------|---------|
| **PostgreSQL** | 15+ via Supabase |
| **RLS (Row-Level Security)** | Multi-tenant data isolation |
| **Migrations** | Manual SQL files in `backend/migrations/` |

### Development Tools

| Tool | Purpose |
|------|---------|
| **pytest** | Backend testing |
| **Jest** | Frontend testing |
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Husky** | Git hooks |

---

## 4. Architecture Overview

### System Diagram

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────┐
│  Vercel CDN     │  (Next.js SSR)
│  (Static Pages) │
└──────┬──────────┘
       │ API Calls
       ▼
┌──────────────────┐
│  VPS Backend     │  (FastAPI)
│  uvicorn :8000   │
└──────┬───────────┘
       │ SQL + REST API
       ▼
┌──────────────────┐
│  Supabase        │
│  PostgreSQL      │
│  + Auth          │
└──────────────────┘
```

### Multi-Tenant Security Model

**Every business table has:**
- `organization_id` column (foreign key to `organizations`)
- RLS policies that filter by user's organization membership
- Ensures Company A cannot see Company B's data

**Example RLS Policy:**
```sql
CREATE POLICY "Users access own org data" ON quotes
FOR ALL USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

### Data Flow: Creating a Quote

```
1. User enters quote data in React form
2. Frontend validates with Zod schema
3. API call: POST /api/quotes-calc/calculate
4. Backend:
   - Validates user permissions (RLS)
   - Maps 42 variables to 7 nested Pydantic models
   - Runs 13-phase calculation engine
   - Converts currencies (CBR rates)
   - Stores in database
5. Frontend displays calculated results
6. User can export to Excel/PDF
```

---

## 5. Project Structure

### Root Directory

```
kvota/
├── .claude/                 # Claude Code configuration & docs
│   ├── skills/              # Domain-specific coding guidelines (auto-activated)
│   ├── agents/              # Specialized AI agents (9 total)
│   ├── commands/            # Workflow automation commands
│   └── SESSION_PROGRESS.md  # Current project status
├── backend/                 # FastAPI Python backend
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   ├── domain_models/       # Pydantic models
│   ├── migrations/          # Database migrations
│   ├── tests/               # pytest tests
│   └── main.py              # FastAPI app entry
├── frontend/                # Next.js React frontend
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities and API services
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
├── dev/                     # Dev docs system (context preservation)
│   ├── active/              # In-progress tasks
│   ├── completed/           # Archived tasks
│   └── templates/           # Task templates
├── docs/                    # Project documentation
│   └── DATABASE_SCHEMA.md   # Full database schema
├── CLAUDE.md                # Main project instructions
└── package.json             # Root package file
```

### Backend Key Files

| File Path | Purpose |
|-----------|---------|
| `main.py` | FastAPI app initialization, CORS, routes |
| `auth.py` | Authentication, authorization, RLS helpers |
| `calculation_engine.py` | 13-phase quote calculation (1,200+ lines) |
| `routes/quotes.py` | Quote CRUD endpoints |
| `routes/quotes_calc.py` | Calculation API integration |
| `routes/customers.py` | Customer CRM endpoints |
| `services/multi_currency_service.py` | Currency conversion logic |
| `models.py` | Database models (deprecated, use domain_models) |

### Frontend Key Files

| File Path | Purpose |
|-----------|---------|
| `src/app/layout.tsx` | Root layout with providers |
| `src/app/quotes/create/page.tsx` | Quote creation form (main UI) |
| `src/components/quotes/` | Quote-related components |
| `src/lib/api/` | API service clients |
| `src/types/` | TypeScript interfaces |

---

## 6. Essential Documentation Links

### Core Documentation

| Document | Purpose | Path |
|----------|---------|------|
| **Project Instructions** | Main reference for all development | `CLAUDE.md` |
| **Database Schema** | Full schema with RLS policies | `docs/DATABASE_SCHEMA.md` |
| **Variables System** | 42 calculation variables explained | `.claude/VARIABLES.md` |
| **Testing Workflow** | TDD guide and test commands | `.claude/TESTING_WORKFLOW.md` |
| **Session Progress** | Current project status | `.claude/SESSION_PROGRESS.md` |

### Skills System (Domain Guidelines)

These auto-activate when working in specific areas:

| Skill | When to Reference | Path |
|-------|-------------------|------|
| **Frontend Dev Guidelines** | React, Next.js, shadcn/ui patterns | `.claude/skills/frontend-dev-guidelines/SKILL.md` |
| **Backend Dev Guidelines** | FastAPI, Supabase, RLS patterns | `.claude/skills/backend-dev-guidelines/SKILL.md` |
| **Calculation Engine** | Understanding 13-phase pipeline | `.claude/skills/calculation-engine-guidelines/SKILL.md` |
| **Database Verification** | Schema standards, RLS guardrails | `.claude/skills/database-verification/SKILL.md` |
| **Frontend Design** | UI/UX design principles | `.claude/skills/frontend-design/SKILL.md` |

### Specialized Documentation

| Document | Purpose | Path |
|----------|---------|------|
| **Migrations Log** | Database migration history | `backend/migrations/MIGRATIONS.md` |
| **Dev Docs System** | Context preservation for large tasks | `dev/README.md` |
| **Common Gotchas** | 18 bug patterns to avoid | `.claude/COMMON_GOTCHAS.md` |
| **Browser Automation** | Chrome DevTools MCP guide | `.claude/AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md` |

### Quick Reference Tables

**Tech Stack Versions:**
- Frontend: See `frontend/package.json`
- Backend: See `backend/requirements.txt`

**API Endpoints:** See FastAPI docs at http://localhost:8000/docs

---

## 7. Git Workflow

### Branch Strategy

```
main (protected)
 ↑
 │ PR + Approval Required
 │
feature/user-feedback (current working branch)
 ↑
 │ PR + Approval Required
 │
feature/your-feature (your branch)
```

**Branch Naming Convention:**
- `feature/short-description` - New features
- `fix/bug-description` - Bug fixes
- `refactor/what-changed` - Code refactoring
- `docs/what-docs` - Documentation updates

### Creating a Feature Branch

```bash
# 1. Start from feature/user-feedback
git checkout feature/user-feedback
git pull origin feature/user-feedback

# 2. Create your branch
git checkout -b feature/add-customer-notes

# 3. Work on your feature
# ... make changes ...

# 4. Commit regularly
git add .
git commit -m "Add customer notes field to database"

# 5. Push to remote
git push -u origin feature/add-customer-notes
```

### Pull Request Process

1. **Create PR on GitHub:**
   - Base: `feature/user-feedback`
   - Compare: `feature/your-feature`
   - Title: Clear, descriptive (e.g., "Add customer notes field")
   - Description: Reference dev docs if applicable

2. **PR Checklist:**
   - [ ] All tests pass locally (`pytest` + `npm test`)
   - [ ] No TypeScript errors (`npm run type-check`)
   - [ ] No linting errors (`npm run lint`)
   - [ ] Code follows project patterns (see skills docs)
   - [ ] Database migrations included (if schema changed)
   - [ ] Updated relevant documentation

3. **Request Review:**
   - Tag team lead or senior developer
   - Wait for approval
   - Address review comments

4. **Merge:**
   - Only owner merges to `main`
   - Senior developers merge to `feature/user-feedback`

### Commit Message Guidelines

**Good commit messages:**
```
✅ Add customer notes field to CRM
✅ Fix exchange rate caching bug
✅ Refactor quote calculation mapper
✅ Update frontend guidelines skill
```

**Bad commit messages:**
```
❌ Update code
❌ Fix bug
❌ WIP
❌ asdfasdf
```

### Pre-commit Hooks

Husky automatically runs on `git commit`:
- ESLint auto-fixes frontend code
- Prettier formats all code
- TypeScript type checks

**If pre-commit fails:**
```bash
# Fix issues manually, then commit again
npm run lint:fix
npm run format
git add .
git commit -m "Your message"
```

---

## 8. Common Development Tasks

### 1. Add a New API Endpoint

**Example: Add endpoint to get customer notes**

**Step 1: Add route function (backend)**
```python
# backend/routes/customers.py
from fastapi import APIRouter, Depends
from auth import get_current_user, User

router = APIRouter(prefix="/api/customers", tags=["customers"])

@router.get("/{customer_id}/notes")
async def get_customer_notes(
    customer_id: str,
    user: User = Depends(get_current_user)
):
    """Get notes for a customer"""
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    result = supabase.table("customers").select("notes")\
        .eq("id", customer_id)\
        .eq("organization_id", user.current_organization_id)\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {"notes": result.data[0]["notes"]}
```

**Step 2: Test endpoint**
```bash
cd backend
pytest tests/test_customers.py -v
```

**Step 3: Add frontend service (frontend)**
```typescript
// src/lib/api/customer-service.ts
export async function getCustomerNotes(customerId: string): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `http://localhost:8000/api/customers/${customerId}/notes`,
    {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) throw new Error('Failed to fetch notes');
  const data = await response.json();
  return data.notes;
}
```

**Verification:** Open http://localhost:8000/docs and test endpoint in Swagger UI

---

### 2. Add a New Frontend Page

**Example: Create a customer notes page**

**Step 1: Create page file**
```bash
# Create directory and file
mkdir -p frontend/src/app/customers/[id]/notes
touch frontend/src/app/customers/[id]/notes/page.tsx
```

**Step 2: Implement page**
```typescript
// frontend/src/app/customers/[id]/notes/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getCustomerNotes } from '@/lib/api/customer-service';

export default function CustomerNotesPage() {
  const params = useParams();
  const customerId = params.id as string;
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotes() {
      try {
        const data = await getCustomerNotes(customerId);
        setNotes(data);
      } catch (error) {
        console.error('Failed to load notes:', error);
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
  }, [customerId]);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <h1 className="text-2xl font-bold mb-4">Примечания</h1>
        <p>{notes || 'Нет примечаний'}</p>
      </Card>
    </div>
  );
}
```

**Verification:** Open http://localhost:3000/customers/[id]/notes

---

### 3. Create a Database Migration

**Example: Add notes column to customers table**

**Step 1: Create migration file**
```bash
cd backend/migrations
touch 044_add_notes_to_customers.sql
```

**Step 2: Write migration SQL**
```sql
-- backend/migrations/044_add_notes_to_customers.sql

-- Add notes column
ALTER TABLE customers
ADD COLUMN notes TEXT;

-- Add index for text search (optional)
CREATE INDEX idx_customers_notes ON customers USING gin(to_tsvector('russian', notes));

-- Update RLS policies if needed (usually not required for new columns)

-- Rollback (commented):
-- ALTER TABLE customers DROP COLUMN notes;
-- DROP INDEX idx_customers_notes;
```

**Step 3: Apply migration**
1. Go to Supabase Dashboard > SQL Editor
2. Copy contents of migration file
3. Execute
4. Update `backend/migrations/MIGRATIONS.md`

**Verification:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customers' AND column_name = 'notes';
```

---

### 4. Run Tests

**Backend tests:**
```bash
cd backend

# All tests
pytest -v

# With coverage
pytest --cov=. --cov-report=term-missing

# Specific file
pytest tests/test_customers.py -v

# Specific test
pytest tests/test_customers.py::test_get_customer_notes -v

# Watch mode (install pytest-watch first)
ptw -v
```

**Frontend tests:**
```bash
cd frontend

# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific file
npm test -- customers
```

**CI checks (before pushing):**
```bash
# Backend
cd backend && pytest

# Frontend
cd frontend
npm run lint
npm run type-check
npm run build
```

---

## 9. Useful Commands Reference

### Development

| Task | Command | Location |
|------|---------|----------|
| Start backend | `uvicorn main:app --reload` | `backend/` |
| Start frontend | `npm run dev` | `frontend/` |
| Backend shell | `python` | `backend/` (with venv activated) |
| Database shell | `psql $DATABASE_URL` | Anywhere |

### Testing

| Task | Command | Location |
|------|---------|----------|
| Run backend tests | `pytest -v` | `backend/` |
| Run frontend tests | `npm test` | `frontend/` |
| Backend coverage | `pytest --cov=. --cov-report=html` | `backend/` |
| Frontend coverage | `npm test -- --coverage` | `frontend/` |
| Type check | `npm run type-check` | `frontend/` |

### Code Quality

| Task | Command | Location |
|------|---------|----------|
| Lint frontend | `npm run lint` | `frontend/` |
| Fix lint errors | `npm run lint:fix` | `frontend/` |
| Format code | `npm run format` | `frontend/` |
| Check formatting | `npm run format:check` | `frontend/` |

### Database

| Task | Command | Location |
|------|---------|----------|
| View schema | See Supabase Dashboard > Database > Schema | - |
| Run migration | Copy to Supabase SQL Editor | `backend/migrations/` |
| Check migrations | `cat MIGRATIONS.md` | `backend/migrations/` |

### Git

| Task | Command | Location |
|------|---------|----------|
| Create branch | `git checkout -b feature/name` | Anywhere |
| Commit | `git commit -m "message"` | Anywhere |
| Push | `git push -u origin branch-name` | Anywhere |
| Pull latest | `git pull origin feature/user-feedback` | Anywhere |
| View status | `git status` | Anywhere |
| View log | `git log --oneline -10` | Anywhere |

### Package Management

| Task | Command | Location |
|------|---------|----------|
| Install backend package | `pip install package-name` | `backend/` |
| Install frontend package | `npm install package-name` | `frontend/` |
| Update requirements | `pip freeze > requirements.txt` | `backend/` |
| Update package.json | Auto-updated by npm | `frontend/` |

---

## 10. First Tasks (Graduated Complexity)

### Day 1-2: Good First Issues

**Goal:** Get familiar with codebase structure

1. **Fix a typo in documentation** (15 min)
   - Find Russian typo in any `.md` file
   - Fix it and commit
   - **Learns:** Git workflow, documentation structure

2. **Add a console.log for debugging** (30 min)
   - Pick any frontend page
   - Add `console.log` to understand data flow
   - **Learns:** Frontend structure, React hooks

3. **Read and understand a simple API endpoint** (45 min)
   - Study `backend/routes/customers.py::get_customers`
   - Trace how RLS filtering works
   - **Learns:** Backend patterns, authentication, RLS

### Week 1: Starter Tasks

**Goal:** Make small, safe changes

1. **Add a new field to customer form** (2-3 hours)
   - Add "website" field to customers table (migration)
   - Add input field to customer form
   - Display in customer detail page
   - **Learns:** Full-stack feature, migrations, forms

2. **Write a test for existing endpoint** (2 hours)
   - Pick any API endpoint without tests
   - Write 2-3 pytest test cases
   - Achieve 80%+ coverage
   - **Learns:** Testing patterns, pytest fixtures

3. **Create a reusable React component** (3 hours)
   - Create `<InfoCard>` component with icon + title + description
   - Use shadcn/ui primitives
   - Add to component library
   - **Learns:** Component patterns, TypeScript, shadcn/ui

### Week 2+: Learning Tasks

**Goal:** Tackle medium complexity features

1. **Add customer search by INN** (4-6 hours)
   - Add search input to customers page
   - Implement backend search endpoint
   - Debounce input on frontend
   - Add tests
   - **Learns:** Search patterns, async state, testing

2. **Implement customer activity timeline** (6-8 hours)
   - Query `activity_logs` table
   - Create timeline UI component
   - Add pagination
   - **Learns:** Complex queries, UI components, pagination

3. **Add currency converter widget** (8-10 hours)
   - Create widget showing live exchange rates
   - Allow user to convert between currencies
   - Use existing exchange rate service
   - Add to dashboard
   - **Learns:** Calculation logic, services, state management

**After Week 2:** You'll be ready for regular features! Ask team lead for assignment.

---

## 11. Getting Help

### Documentation First

Before asking for help, check:

1. **Project Instructions:** `CLAUDE.md` (main reference)
2. **Skill Guidelines:** `.claude/skills/[domain]/SKILL.md` (domain-specific)
3. **Common Gotchas:** `.claude/COMMON_GOTCHAS.md` (known issues)
4. **Database Schema:** `docs/DATABASE_SCHEMA.md` (DB structure)

### Ask the Team

**Communication Channels:**
- **Slack/Teams:** Daily questions and quick help
- **GitHub Issues:** Bug reports and feature discussions
- **Weekly Meetings:** Architecture decisions and planning

**Who to Ask:**

| Question Type | Ask |
|---------------|-----|
| Architecture decisions | Tech Lead |
| Frontend patterns | Senior Frontend Dev |
| Backend/calculation logic | Senior Backend Dev |
| Database schema/RLS | Database Admin |
| Git workflow | Any senior developer |
| Testing | QA Lead |

### Debugging Resources

**FastAPI Docs:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

**Database:**
- Supabase Dashboard: Check with team lead for URL
- Database logs: Supabase Dashboard > Logs

**Frontend:**
- React DevTools: Browser extension
- Network tab: Check API calls
- Console: Check for errors

**Common Issues:**

| Problem | Solution |
|---------|----------|
| Backend won't start | Check `.env` file, activate venv |
| Frontend won't start | Run `npm install`, check Node version |
| Database connection fails | Verify `DATABASE_URL` in `.env` |
| Tests fail | Check if servers are running, read error message |
| RLS policy blocks query | Verify `organization_id` filter |
| TypeScript errors | Run `npm run type-check`, fix types |

---

## 12. 30-60-90 Day Goals

### 30 Days (Foundations)

**Technical Goals:**
- ✅ Set up dev environment successfully
- ✅ Understand project architecture
- ✅ Complete 3-5 starter tasks
- ✅ Write first tests (backend + frontend)
- ✅ Understand Git workflow and PR process
- ✅ Familiar with RLS and multi-tenant model

**Soft Skills:**
- ✅ Know team members and roles
- ✅ Ask questions when stuck
- ✅ Attend daily standups

### 60 Days (Proficiency)

**Technical Goals:**
- ✅ Implement 2-3 medium features end-to-end
- ✅ Create database migrations confidently
- ✅ Understand calculation engine basics
- ✅ Write comprehensive tests (80%+ coverage)
- ✅ Debug issues independently
- ✅ Review PRs from other developers

**Soft Skills:**
- ✅ Proactively suggest improvements
- ✅ Mentor new developers
- ✅ Participate in architecture discussions

### 90 Days (Autonomy)

**Technical Goals:**
- ✅ Own and deliver complex features (8+ hours)
- ✅ Optimize performance bottlenecks
- ✅ Design new API endpoints
- ✅ Contribute to skills/guidelines documentation
- ✅ Lead feature planning sessions

**Soft Skills:**
- ✅ Trusted to work independently
- ✅ Provide technical guidance to team
- ✅ Identify and prioritize technical debt

---

## Appendix A: Key Terminology

| Term | Definition |
|------|------------|
| **RLS** | Row-Level Security - PostgreSQL feature for multi-tenant isolation |
| **Organization** | Tenant in multi-tenant system (one per company) |
| **Quote** | Commercial proposal (коммерческое предложение) |
| **CBR** | Central Bank of Russia (exchange rate source) |
| **Calculation Engine** | 13-phase pricing algorithm |
| **Variables** | 42 input parameters for quote calculation |
| **Skill** | Auto-activating domain-specific coding guideline |
| **Dev Docs** | Context preservation system for large tasks |
| **Supabase** | Backend-as-a-Service (PostgreSQL + Auth + Storage) |

---

## Appendix B: Useful Shortcuts

**VS Code:**
- `Ctrl+P` - Quick file open
- `Ctrl+Shift+F` - Search across project
- `F12` - Go to definition
- `Ctrl+.` - Quick fix

**Browser DevTools:**
- `Ctrl+Shift+I` - Open DevTools
- `Ctrl+Shift+C` - Inspect element
- `Ctrl+Shift+M` - Toggle device toolbar

**Terminal:**
- `Ctrl+C` - Stop server
- `Ctrl+L` - Clear terminal
- `Ctrl+R` - Search command history

---

## Appendix C: Project Principles

These principles guide all development:

1. **Prefer Existing Solutions** - Search for libraries before building custom
2. **Test-Driven Development** - Write tests first, then implement
3. **Documentation is Code** - Update docs when code changes
4. **Security First** - Always validate permissions and RLS
5. **Decimal for Money** - Never use floats for financial calculations
6. **Multi-tenant Awareness** - Always filter by organization_id
7. **Never Delete Without Permission** - Untracked files can't be recovered

See `CLAUDE.md` Core Principles section for full details.

---

**Welcome aboard! We're excited to have you on the team.**

**Questions?** Ask in #engineering Slack channel or reach out to your team lead.

**Next Steps:**
1. Complete Quick Start section
2. Pick your first task from Day 1-2 list
3. Join daily standup tomorrow
4. Schedule 1-on-1 with team lead

**Document Feedback:** Found an error or unclear section? Open a PR to improve this guide!

---

**Last Updated:** 2025-12-18
**Version:** 1.0
**Maintained By:** Technical Team
