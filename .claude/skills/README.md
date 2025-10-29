# Skills Documentation Index

**Created:** 2025-10-29
**Purpose:** Quick navigation to all skill resources

---

## Available Skills

### Frontend Development
**When:** Working in `frontend/src/**` directories
**Hub:** [frontend-dev-guidelines/SKILL.md](./frontend-dev-guidelines/SKILL.md)

**Resources:**
- [React Patterns](./frontend-dev-guidelines/resources/react-patterns.md) - Component structure, hooks, state
- [Ant Design Standards](./frontend-dev-guidelines/resources/ant-design-standards.md) - v5 APIs, form patterns
- [ag-Grid Patterns](./frontend-dev-guidelines/resources/ag-grid-patterns.md) ⭐ - Excel-like tables (149 references)
- [State Management](./frontend-dev-guidelines/resources/state-management.md) - When to use what state solution
- [Common Gotchas](./frontend-dev-guidelines/resources/common-gotchas.md) - 7 frontend bugs to avoid

### Backend Development
**When:** Working in `backend/**/*.py` files
**Hub:** [backend-dev-guidelines/SKILL.md](./backend-dev-guidelines/SKILL.md)

**Resources:**
- [Quick Reference](./backend-dev-guidelines/resources/quick-reference.md) ⭐ - Commands, status codes, all 9 gotchas
- [Supabase RLS](./backend-dev-guidelines/resources/supabase-rls.md) ⭐ - Multi-tenant security (1,392 lines)
- [Export Patterns](./backend-dev-guidelines/resources/export-patterns.md) ⭐ - Excel/PDF generation patterns
- [FastAPI Patterns](./backend-dev-guidelines/resources/fastapi-patterns.md) - Routes, Pydantic, dependencies
- [Error Handling](./backend-dev-guidelines/resources/error-handling.md) - HTTPException, status codes
- [Testing Patterns](./backend-dev-guidelines/resources/testing-patterns.md) - Pytest, fixtures, TDD
- [Common Gotchas](./backend-dev-guidelines/resources/common-gotchas.md) - 9 backend bugs + solutions

---

## Quick References by Topic

### 🔴 Security & Multi-Tenancy
- [RLS Complete Guide](./backend-dev-guidelines/resources/supabase-rls.md) - Row-Level Security patterns
- [RLS Checklist](./backend-dev-guidelines/resources/supabase-rls.md#security-checklist) - Quick audit checklist
- [Organization Filter Gotcha](./backend-dev-guidelines/resources/common-gotchas.md#multi-tenant-security) - Critical bug pattern

### 📊 Data Tables
- [ag-Grid Complete Guide](./frontend-dev-guidelines/resources/ag-grid-patterns.md) - When and how to use
- [ag-Grid vs Ant Table](./frontend-dev-guidelines/resources/ag-grid-patterns.md#when-to-use) - Decision matrix
- [Grid Performance](./frontend-dev-guidelines/resources/ag-grid-patterns.md#performance-benchmarks) - Real benchmarks

### 📝 Forms & Validation
- [Ant Design Forms](./frontend-dev-guidelines/resources/ant-design-standards.md#form-patterns) - v5 form patterns
- [Form Validation Gotcha](./frontend-dev-guidelines/resources/common-gotchas.md#forms--validation) - Common mistakes
- [Backend Validation](./backend-dev-guidelines/resources/fastapi-patterns.md#validation) - Pydantic patterns

### 📤 Export Generation
- [Excel Export](./backend-dev-guidelines/resources/export-patterns.md#excel-export) - openpyxl patterns
- [PDF Export](./backend-dev-guidelines/resources/export-patterns.md#pdf-generation) - WeasyPrint patterns
- [Export UUID Gotcha](./backend-dev-guidelines/resources/common-gotchas.md#export-handling) - String conversion bug

### 🧪 Testing
- [Frontend Testing](./frontend-dev-guidelines/SKILL.md#testing) - Jest, React Testing Library
- [Backend Testing](./backend-dev-guidelines/resources/testing-patterns.md) - Pytest patterns
- [RLS Testing](./backend-dev-guidelines/resources/supabase-rls.md#testing-rls-isolation) - Multi-tenant isolation tests

### ⚡ Performance
- [ag-Grid Optimization](./frontend-dev-guidelines/resources/ag-grid-patterns.md#performance-benchmarks) - 30x bulk update improvement
- [RLS Performance](./backend-dev-guidelines/resources/supabase-rls.md#performance-impact) - 225x with indexes
- [Concurrency Fix](./backend-dev-guidelines/resources/common-gotchas.md#performance) - 66x slowdown solution

---

## Bug Prevention Checklists

### Before Writing Frontend Code
- [ ] Review [Frontend Common Gotchas](./frontend-dev-guidelines/resources/common-gotchas.md) (7 patterns)
- [ ] Check [Ant Design v5 APIs](./frontend-dev-guidelines/resources/ant-design-standards.md#deprecated-apis)
- [ ] Review [ag-Grid patterns](./frontend-dev-guidelines/resources/ag-grid-patterns.md) if using tables

### Before Writing Backend Code
- [ ] Review [Backend Quick Reference](./backend-dev-guidelines/resources/quick-reference.md)
- [ ] Check [RLS patterns](./backend-dev-guidelines/resources/supabase-rls.md) for database operations
- [ ] Review [Common Gotchas](./backend-dev-guidelines/resources/common-gotchas.md) (9 patterns)

### Before Database Migration
- [ ] Follow [RLS Migration Template](./backend-dev-guidelines/resources/supabase-rls.md#migration-template)
- [ ] Create indexes on `organization_id`
- [ ] Test with different organizations

---

## Navigation by Bug Type

### Critical Security Bugs
- BUG-001: [Missing organization_id filter](./backend-dev-guidelines/resources/common-gotchas.md#1-missing-organization-id-filter)
- BUG-006: [Case-sensitive role checks](./frontend-dev-guidelines/resources/common-gotchas.md#case-sensitive-role-checks)
- BUG-010: [Missing RLS policies](./backend-dev-guidelines/resources/common-gotchas.md#7-missing-rls-policies)

### Performance Bugs
- BUG-004: [Concurrent request bottleneck](./backend-dev-guidelines/resources/common-gotchas.md#8-concurrent-request-performance-bottleneck)
- BUG-010: [Missing database indexes](./backend-dev-guidelines/resources/quick-reference.md#9-missing-indexes)

### UI/UX Bugs
- BUG-002: [Missing customer JOIN](./backend-dev-guidelines/resources/common-gotchas.md#2-missing-customer-join)
- BUG-007: [Form validation missing](./frontend-dev-guidelines/resources/common-gotchas.md#no-form-validation-feedback)
- BUG-040: [Dropdown deprecated API](./frontend-dev-guidelines/resources/common-gotchas.md#deprecated-api-usage)

**Full Bug List:** [MASTER_BUG_INVENTORY.md](../MASTER_BUG_INVENTORY.md) (41 tracked bugs)

---

## Version Compatibility

### Frontend Stack
| Package | Version | Notes |
|---------|---------|-------|
| React | 19.1.0 | ⚠️ Ant Design warning (works in practice) |
| Next.js | 15.5.4 | App Router (not Pages Router) |
| Ant Design | 5.27.4 | Use v5 APIs (menu, open, variant) |
| ag-Grid | 34.2.0 | Community edition, all features needed |
| TypeScript | 5.x | Strict mode enabled |

### Backend Stack
| Package | Version | Notes |
|---------|---------|-------|
| Python | 3.12 | Type hints, match statements |
| FastAPI | Latest | Async by default |
| Pydantic | 2.x | v2 API (not v1) |
| PostgreSQL | 15+ | Via Supabase |
| WeasyPrint | Latest | Requires GTK (WSL2 only) |

---

## Skill Maintenance

### Update Triggers
- New bug patterns discovered → Update common-gotchas.md
- Package version changes → Update compatibility matrices
- New best practices → Update pattern files
- Performance improvements → Add to benchmarks section

### File Size Guidelines
- SKILL.md files: Target 500-600 lines
- Resource files: No limit (comprehensive is better)
- Use links between files to avoid duplication

---

## Quick Links

**Project Documentation:**
- [Main CLAUDE.md](../../../CLAUDE.md) - Project overview
- [Frontend CLAUDE.md](../../../frontend/CLAUDE.md) - Frontend architecture
- [Backend CLAUDE.md](../../../backend/CLAUDE.md) - Backend architecture
- [SESSION_PROGRESS.md](../SESSION_PROGRESS.md) - Current progress

**Bug & Debt Tracking:**
- [MASTER_BUG_INVENTORY.md](../MASTER_BUG_INVENTORY.md) - All 41 bugs
- [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) - Technical debt analysis
- [COMMON_GOTCHAS.md](../COMMON_GOTCHAS.md) - Original 18 gotchas

**Testing Documentation:**
- [TESTING_WORKFLOW.md](../TESTING_WORKFLOW.md) - TDD workflow
- [AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md](../AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md) - Browser testing
- [Scripts README](../scripts/README.md) - Testing scripts

---

**Last Updated:** 2025-10-29
**Total Resources:** 14 skill files across 2 domains
**Most Referenced:** ag-Grid Patterns (149 times), Supabase RLS (critical security)