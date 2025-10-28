# Frontend Developer - Bug Fix Task

**Session:** 33
**Date:** 2025-10-28
**Branch:** dev (worktree: /home/novi/quotation-app-dev)
**Coordinator:** @orchestrator

---

## Mission

Fix all 12 bugs from manual testing to achieve 100% test pass rate (currently 26%).

## Detailed Bug Descriptions

**See:** `/home/novi/quotation-app-dev/.claude/SESSION_33_BUG_FIX_PLAN.md` for complete details.

## Quick Bug Summary

**P0 (Critical - 3 bugs):**
1. Bug 2: Team menu not visible (role check issue)
2. Bug 3: Organizations page 404
3. Bug 4: Team page non-functional

**P1 (High - 3 bugs):**
1. Bug 5: Missing validation rules (4 fields)
2. Bug 11: Quote redirect not working
3. Bug 12: Customer name not displayed

**P2 (Medium - 5 bugs):**
1. Bug 6: Verbose error messages
2. Bug 7: Customer dropdown no red border
3. Bug 8: No file upload clear button
4. Bug 10: Warning alert always visible
5. Bug 1: Slow auth redirect (>10s)

**P3 (Low - 1 bug):**
1. Bug 9: Console validation errors

## Files to Modify

1. `frontend/src/components/layout/MainLayout.tsx` - Bug 2
2. `frontend/src/app/settings/team/page.tsx` - Bug 4
3. `frontend/src/app/organizations/page.tsx` - Bug 3
4. `frontend/src/app/quotes/create/page.tsx` - Bugs 5, 6, 7, 8, 9, 10, 11
5. `frontend/src/app/quotes/[id]/page.tsx` - Bug 12
6. Auth flow - Bug 1

## Instructions

1. Read SESSION_33_BUG_FIX_PLAN.md for full details
2. Work in priority order (P0 → P1 → P2 → P3)
3. Test each fix before moving to next
4. Use console logging to debug issues
5. Report any blockers immediately

## Success Criteria

- All 12 bugs fixed
- No TypeScript errors
- No lint errors
- Ready for user re-testing

Good luck!
