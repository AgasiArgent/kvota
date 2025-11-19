# Q1 2025: CRM Module Development

**Branch:** `feature/q1-crm-module`
**Timeline:** Jan-Mar 2025 (6-8 weeks)
**Goal:** Add CRM to kvota monolith for Мастер Бэринг

---

## What to build here:

### Backend (FastAPI):
- [ ] Leads table & API (company, inn, phone, email, stage, assigned_to)
- [ ] LeadStages table (pipeline configuration)
- [ ] Activities table (calls, meetings, tasks)
- [ ] Google Calendar integration (OAuth 2.0)
- [ ] Email parser webhook (Make.com → create lead)

### Frontend (Next.js + Ant Design):
- [ ] Leads pipeline (Kanban board)
- [ ] Leads list (table view with filters)
- [ ] Lead detail page (edit + activities timeline)
- [ ] Activities calendar view
- [ ] Google Calendar sync UI

### Integration:
- [ ] Leads → Customers (qualify button)
- [ ] Customers → Quotes (existing flow)

---

## How to use this worktree:

### Start development:
```bash
cd ~/workspace/tech/projects/kvota/q1-crm

# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm run dev  # Runs on :3000
```

### When done (after 2-3 months):
```bash
# Test everything
cd backend && pytest
cd frontend && npm run build

# Merge to dev
git add .
git commit -m "feat(crm): Add CRM module (Leads, Activities, Calendar)"
git checkout dev
git merge feature/q1-crm-module
git push origin dev

# Optional: Remove worktree
cd ~/workspace/tech/projects/kvota/build
git worktree remove ../q1-crm
```

---

## Design Document:
See: `../dev/docs/plans/2025-01-15-formula-parser-modular-platform-design.md`

Section: **Q1 2025 (Jan-Mar): CRM в монолит**

---

**Status:** Ready to start
**Created:** 2025-01-15
