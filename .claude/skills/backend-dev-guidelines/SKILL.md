# Backend Development Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29
**Tech Stack:** FastAPI, Python 3.12, Supabase PostgreSQL, Pydantic v2

This skill provides comprehensive backend development patterns for the B2B quotation platform. All patterns enforce multi-tenant security through Row-Level Security (RLS), proper error handling, and test-driven development.

---

## When This Skill Applies

This skill **auto-activates** when:

- Working in `backend/**/*.py` directory
- Creating or modifying FastAPI routes/endpoints
- Implementing database operations with Supabase
- Building calculation engine features
- Generating Excel/PDF exports
- Writing backend tests with pytest
- Debugging security issues (RLS, permissions)
- Reviewing backend code quality

**Manual activation:** Use when you need backend patterns reference or before implementing complex features.

---

## Quick Resource Reference

### Core Pattern Files

| File | Lines | Purpose | When to Use |
|------|-------|---------|-------------|
| **[fastapi-patterns.md](resources/fastapi-patterns.md)** | 330 | Routes, Pydantic models, dependencies, async patterns | Creating endpoints, request validation |
| **[supabase-rls.md](resources/supabase-rls.md)** ⭐ | 1,392 | Multi-tenant security, RLS policies, testing isolation | **CRITICAL** - All database operations |
| **[export-patterns.md](resources/export-patterns.md)** ⭐ | 350 | Excel/PDF generation, file handling, streaming | Building exports, downloads |
| **[error-handling.md](resources/error-handling.md)** | 540 | HTTPException, status codes, logging, validation | Error responses, debugging |
| **[testing-patterns.md](resources/testing-patterns.md)** | 482 | Pytest, fixtures, RLS tests, TDD workflow | Writing tests, test coverage |
| **[common-gotchas.md](resources/common-gotchas.md)** | 435 | 9 backend bugs we've encountered + solutions | Avoiding known issues, debugging |
| **[quick-reference.md](resources/quick-reference.md)** ⭐ | 380 | Commands, status codes, patterns cheat sheet | Quick lookup during development |

### Project Documentation

- **[/home/novi/quotation-app-dev/backend/CLAUDE.md](../../../backend/CLAUDE.md)** - Backend architecture, auth system, calculation engine
- **[/home/novi/quotation-app-dev/.claude/VARIABLES.md](../../VARIABLES.md)** - 42 variables, two-tier logic, admin vs user
- **[/home/novi/quotation-app-dev/.claude/TESTING_WORKFLOW.md](../../TESTING_WORKFLOW.md)** - TDD workflow, test commands
- **[/home/novi/quotation-app-dev/backend/RLS_CHECKLIST.md](../../../backend/RLS_CHECKLIST.md)** - RLS security audit checklist

---

## Critical Patterns Overview

### 1. FastAPI Routes

**Standard route structure with authentication and error handling:**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from auth import get_current_user, User
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/quotes", tags=["quotes"])

@router.get("/{quote_id}")
async def get_quote(
    quote_id: str,
    user: User = Depends(get_current_user)
):
    try:
        result = supabase.table("quotes") \
            .select("*") \
            .eq("id", quote_id) \
            .eq("organization_id", user.org_id) \  # CRITICAL
            .execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quote not found"
            )

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
```

**Key points:**
- Always use `Depends(get_current_user)` for authentication
- Filter by `organization_id` for multi-tenant isolation
- Use proper HTTP status codes (404, 403, 500)
- Re-raise HTTPException after catch

**See:** [fastapi-patterns.md](resources/fastapi-patterns.md) for complete patterns including:
- Pydantic model validation (Decimal for money, Field constraints)
- Admin-only endpoints with `check_admin_permissions()`
- Role-based access with `require_role(UserRole.MANAGER)`
- Async database operations

---

### 2. Supabase RLS (Row-Level Security) ⭐ CRITICAL

**Multi-tenant security through PostgreSQL Row-Level Security:**

Every table MUST have:
1. `organization_id UUID NOT NULL REFERENCES organizations(id)`
2. RLS enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
3. RLS policy filtering by organization

**Standard RLS policy pattern:**

```sql
CREATE POLICY "Users can access records in their org" ON quotes
FOR ALL USING (
    organization_id = (current_setting('request.jwt.claims')::json->>'organization_id')::uuid
);
```

**Backend enforcement:**

```python
# ✅ CORRECT - Always filter by organization_id
result = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", user.org_id) \
    .execute()

# ❌ WRONG - Missing organization filter (data leak!)
result = supabase.table("quotes") \
    .select("*") \
    .execute()
```

**Testing RLS isolation:**

```python
# User A creates quote
quote_a = await create_quote(user_a, data)

# User B (different org) cannot access
result = supabase.table("quotes") \
    .select("*") \
    .eq("id", quote_a["id"]) \
    .eq("organization_id", user_b.org_id) \
    .execute()

assert result.data == []  # RLS prevents access
```

**See:** [supabase-rls.md](resources/supabase-rls.md) (1,392 lines) for:
- Complete RLS policy catalog for all tables
- Testing RLS isolation (critical for security)
- Debugging RLS failures
- Service role vs authenticated access
- Migration patterns with RLS

🔴 **CRITICAL:** Missing `organization_id` filter is #1 security vulnerability. Always verify multi-tenant isolation.

---

### 3. Excel/PDF Export

**Pattern for generating exports with proper file handling:**

```python
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from openpyxl import Workbook
from datetime import datetime
import os

@router.get("/export/excel")
async def export_quotes_excel(user: User = Depends(get_current_user)):
    try:
        # Fetch data with organization filter
        result = supabase.table("quotes") \
            .select("*, customer:customers(name)") \
            .eq("organization_id", user.org_id) \
            .execute()

        # Create workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Quotes"

        # Headers
        ws.append(["Quote Number", "Customer", "Total", "Status"])

        # Data rows
        for quote in result.data:
            ws.append([
                quote["quote_number"],
                quote["customer"]["name"] if quote.get("customer") else "",
                float(quote["total_amount"]),
                quote["status"]
            ])

        # Save to temporary file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"quotes_export_{timestamp}.xlsx"
        filepath = f"/tmp/{filename}"

        wb.save(filepath)

        # Return file with cleanup
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            background=BackgroundTask(lambda: os.unlink(filepath))
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )
```

**Key points:**
- Filter by `organization_id` (data isolation)
- Use JOINs for related data (avoid N+1 queries)
- Temporary files in `/tmp/` with cleanup
- `BackgroundTask` for automatic file deletion
- Proper MIME types for downloads

**See:** [export-patterns.md](resources/export-patterns.md) for:
- PDF generation with WeasyPrint
- Streaming large files (memory-efficient)
- Russian text encoding (UTF-8)
- Complex Excel formatting (merged cells, styles)
- Commercial invoice template

---

### 4. Error Handling

**Standard error handling pattern:**

```python
from fastapi import HTTPException, status
from pydantic import ValidationError

try:
    # Operation
    result = await some_operation()

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )

    return result

except HTTPException:
    raise  # Re-raise HTTP exceptions

except ValidationError as e:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=e.errors()
    )

except ValueError as e:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=str(e)
    )

except Exception as e:
    # Log for debugging
    print(f"Error: {str(e)}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Internal server error"
    )
```

**HTTP Status Codes:**
- `200 OK` - Successful GET/PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Invalid input (ValueError)
- `401 Unauthorized` - Missing/invalid auth token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `422 Unprocessable Entity` - Validation error (Pydantic)
- `500 Internal Server Error` - Unexpected errors

**See:** [error-handling.md](resources/error-handling.md) for:
- Complete status code reference
- Validation error formatting
- Logging strategies
- Custom exception classes

---

### 5. Testing with Pytest

**TDD workflow (Red → Green → Refactor):**

```python
@pytest.mark.asyncio
async def test_rls_isolation(test_user_a, test_user_b):
    """Test that User B cannot access User A's quote"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # User A creates quote
        response = await client.post("/api/quotes",
            json={"customer_id": "123", "total_amount": 1000},
            headers={"Authorization": f"Bearer {test_user_a.token}"})
        quote_id = response.json()["id"]

        # User B tries to access (different organization)
        response = await client.get(f"/api/quotes/{quote_id}",
            headers={"Authorization": f"Bearer {test_user_b.token}"})

        # Should return 404 (RLS blocks access)
        assert response.status_code == 404
```

**See:**
- [testing-patterns.md](resources/testing-patterns.md) for complete patterns, fixtures, commands
- [quick-reference.md](resources/quick-reference.md) for test commands
- [/home/novi/quotation-app-dev/.claude/TESTING_WORKFLOW.md](../../TESTING_WORKFLOW.md) for TDD workflow

---

## When to Use Agents

### Before Starting Implementation

**For complex features or architectural decisions:**
- `@plan` agent - Creates implementation roadmap with phases
- `@expert` agent (Opus) - Architecture review, performance strategy

**Example:**
```
User: "Add multi-currency support with exchange rate caching"
You: "@plan @expert - Need architectural guidance on exchange rate system"
```

### During Implementation

**When stuck on technical issues:**
- `@expert` agent (Opus) - Deep debugging, complex algorithms, concurrency issues
- Reference resource files first (faster for common patterns)

**Example:**
```
User: "RLS policy not working - users can see other orgs' data"
You: Check supabase-rls.md → Test RLS isolation → Call @expert if still stuck
```

### After Implementation (Automatic via Orchestrator)

**When user calls `@orchestrator` after completing features:**

The orchestrator automatically invokes in parallel:
1. `@qa-tester` - Writes automated tests (pytest)
2. `@security-auditor` - Audits RLS policies, permission checks
3. `@code-reviewer` - Checks patterns match project conventions

**Process:**
- Auto-fixes minor issues (formatting, comments)
- Reports critical issues (security bugs, data leaks)
- Creates GitHub issues for blockers
- Updates documentation
- Commits and pushes changes

**Example workflow:**
```
User: "I've implemented quote approval endpoints"
User: "@orchestrator"

Orchestrator:
  ├─ @qa-tester → Writes 15 tests (10 pass, 5 need fixes)
  ├─ @security-auditor → Finds RLS bypass in DELETE endpoint 🔴
  └─ @code-reviewer → Suggests using check_admin_permissions()

Orchestrator: "Found critical RLS issue. Fix before committing? [Y/n]"
User: "Y"
Orchestrator: Applies fixes → Re-runs tests → All pass → Commits
```

---

## Common Gotchas (Top 3)

**Critical bugs we've encountered - avoid them!**

### 1. 🔴 CRITICAL: Missing organization_id Filter (Data Leak)

```python
# ❌ WRONG - Data leak!
result = supabase.table("quotes").select("*").execute()

# ✅ CORRECT
result = supabase.table("quotes") \
    .select("*") \
    .eq("organization_id", user.org_id) \
    .execute()
```

### 2. Missing Customer JOIN (Blank Names)

```python
# ❌ WRONG
result = supabase.table("quotes").select("*").execute()

# ✅ CORRECT - Join customer table
result = supabase.table("quotes") \
    .select("*, customer:customers(name, email)") \
    .execute()
```

### 3. Concurrent Request Bottleneck (66x Slowdown)

```python
# ❌ WRONG - Sequential (66x slower)
for quote in quotes:
    customer = supabase.table("customers").select("*").eq("id", quote["customer_id"]).execute()

# ✅ CORRECT - Single JOIN query
result = supabase.table("quotes") \
    .select("*, customer:customers(name)") \
    .execute()
```

**See:**
- [quick-reference.md](resources/quick-reference.md) for all 9 gotchas with details
- [common-gotchas.md](resources/common-gotchas.md) for complete analysis

---

## Security Checklist

**Every endpoint MUST:**

1. ✅ **Require authentication** - `Depends(get_current_user)`
2. ✅ **Filter by organization_id** - Multi-tenant isolation
3. ✅ **Check authorization** - Admin endpoints use `check_admin_permissions()`
4. ✅ **Validate input** - Pydantic models with Field constraints
5. ✅ **Use parameterized queries** - Prevent SQL injection ($1, $2)
6. ✅ **Test RLS isolation** - User A cannot access User B's data
7. ✅ **Return appropriate errors** - 401 (auth), 403 (forbidden), 404 (not found)

**See:** [/home/novi/quotation-app-dev/backend/RLS_CHECKLIST.md](../../../backend/RLS_CHECKLIST.md)

---

## Feature Implementation Workflow

**Standard process for building backend features:**

1. ✅ **Read project docs** - CLAUDE.md, VARIABLES.md, RLS_CHECKLIST.md
2. ✅ **Design database schema** - Create migration with RLS policies
3. ✅ **Create Pydantic models** - Request/response validation
4. ✅ **Implement routes** - CRUD operations with auth + organization filter
5. ✅ **Add business logic** - Calculations, validations, rules
6. ✅ **Write error handling** - Proper HTTP status codes
7. ✅ **Test manually** - curl or Postman
8. ✅ **Verify RLS** - Test that User B can't access User A's data
9. ✅ **Write automated tests** - Pytest with RLS isolation tests
10. ✅ **Call @orchestrator** - Auto-test, audit, review, commit

---

## Quick Reference Links

**All resource files are in [resources/](resources/) directory.**

- **[quick-reference.md](resources/quick-reference.md)** ⭐ - Commands, status codes, all 9 gotchas
- **[supabase-rls.md](resources/supabase-rls.md)** ⭐ - Multi-tenant security (1,392 lines)
- **[export-patterns.md](resources/export-patterns.md)** ⭐ - Excel/PDF generation
- [fastapi-patterns.md](resources/fastapi-patterns.md) - Routes, Pydantic, dependencies
- [testing-patterns.md](resources/testing-patterns.md) - Pytest, fixtures, TDD
- [error-handling.md](resources/error-handling.md) - HTTPException, status codes
- [common-gotchas.md](resources/common-gotchas.md) - 9 backend bugs + solutions

---

## Common Commands

**See [quick-reference.md](resources/quick-reference.md) for complete command reference including:**
- Development server commands
- Testing with pytest (unit, coverage, watch mode)
- Database queries and RLS testing
- Manual API testing with curl

---

## Deliverables Format

**When feature complete, report:**

1. **Files created/modified** - List with line counts
2. **Database migrations** - New tables/columns/policies
3. **API endpoints** - Method, path, request/response
4. **Pydantic models** - New validation models
5. **Business logic** - Key algorithms implemented
6. **Security measures** - RLS policies, permission checks
7. **Testing results** - Manual + automated test outcomes
8. **Known limitations** - TODOs or incomplete features

**Example:**
```markdown
## Backend Feature Complete: Quote Approval System

**Files Created:**
- backend/routes/quotes_approval.py (180 lines)
- backend/migrations/010_add_approval_table.sql (60 lines)

**Database Changes:**
- New table: quote_approvals with RLS policy
- Indexes: quote_id, organization_id

**API Endpoints:**
1. GET /api/quotes/pending-approval (Manager/Admin/Owner only)
2. POST /api/quotes/{quote_id}/approve (Manager/Admin/Owner only)
3. POST /api/quotes/{quote_id}/reject (Manager/Admin/Owner only)

**Security:**
✅ RLS policy on quote_approvals table
✅ Role check: require_role(UserRole.MANAGER)
✅ Organization isolation verified

**Testing:**
✅ Manual: Approve/reject quote (200 OK)
✅ Manual: Non-manager access (403 Forbidden)
✅ Manual: Different org access (404 Not Found via RLS)
✅ Automated: 15 pytest tests (all passing)
```

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| Python | 3.12 | Type hints, match statements |
| FastAPI | Latest | Async by default |
| Pydantic | 2.x | v2 API (not v1) |
| Supabase | Latest | Python client |
| PostgreSQL | 15+ | Via Supabase |
| openpyxl | Latest | Excel export |
| WeasyPrint | Latest | PDF export (requires GTK in WSL2) |
| pytest | 8.3.5 | Async testing with pytest-asyncio |

**Compatibility Notes:**
- WeasyPrint requires GTK libraries (works in WSL2, not native Windows)
- Supabase service role key bypasses RLS (CRITICAL security concern)
- asyncpg for direct DB access, Supabase client for REST API

---

**Remember:** Security and data integrity are paramount. Every endpoint must validate auth, check permissions, and respect RLS policies.
