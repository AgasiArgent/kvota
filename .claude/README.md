# Documentation Structure

**This folder contains project documentation for Claude Code sessions.**

---

## Quick Start for New Sessions

**On session start, Claude should automatically read:**
1. `/CLAUDE.md` - Root project instructions (auto-loaded by Claude Code)
2. `SESSION_PROGRESS.md` - Current progress, what's next, blockers

**Then based on task:**
- Frontend work → Read `/frontend/CLAUDE.md`
- Backend work → Read `/backend/CLAUDE.md`
- Variables questions → Read `VARIABLES.md`

---

## File Organization

### Auto-Loaded Instructions (Claude Code reads these automatically)
- **`/CLAUDE.md`** - Root project instructions, principles, current status
- **`/frontend/CLAUDE.md`** - Frontend patterns (Next.js, React, Ant Design, ag-Grid)
- **`/backend/CLAUDE.md`** - Backend patterns (FastAPI, Supabase, auth)

### Active Documentation (Root folder - Read when needed)
- **`SESSION_PROGRESS.md`** ⭐ - **READ FIRST EVERY SESSION** - Current progress tracking
- **`VARIABLES.md`** - All 42 variables reference (UI, formulas, admin)
- **`IMPLEMENTATION_PLAN_AG_GRID.md`** - Current Session 8 implementation plan
- **`settings.local.json`** - Claude Code permissions (do not archive)

### Reference Documentation (reference/ - Background info)
- **`calculation_engine_summary.md`** - Calculation engine (13 phases)
- **`quotation_app_context.md`** - Original business context and goals

### Historical Archive (archive/ - Superseded docs)
- **Old README.md** - Replaced by root CLAUDE.md
- **Session 7 docs** - Historical session summaries
- **Old variable files** - Consolidated into VARIABLES.md

---

## New Documentation Philosophy

**Before (Old README.md approach):**
- ❌ Single large file with everything
- ❌ Claude had to be told to read it manually
- ❌ Lost context between sessions
- ❌ Information scattered across many files

**After (New CLAUDE.md approach):**
- ✅ Root CLAUDE.md auto-loaded every session
- ✅ Focused sub-files for frontend/backend
- ✅ Claude maintains context via SESSION_PROGRESS.md
- ✅ Consolidated VARIABLES.md (was 2 files)
- ✅ Shorter, more focused files

---

## How Claude Uses These Files

### Session Start
1. **Auto-loads** `CLAUDE.md` (root project instructions)
2. **Reads** `SESSION_PROGRESS.md` to understand current state
3. **Checks** where we are in implementation
4. **Identifies** next tasks or blockers

### During Work
- **Frontend tasks** → Reference `/frontend/CLAUDE.md`
- **Backend tasks** → Reference `/backend/CLAUDE.md`
- **Variable questions** → Reference `VARIABLES.md`
- **Current plan** → Reference `IMPLEMENTATION_PLAN_AG_GRID.md`

### After Completing Work
- **Updates** `SESSION_PROGRESS.md` with `[~]` awaiting verification
- **Waits** for user to verify before marking `[x]` complete
- **Notes** any blockers as `[!]`

---

## Benefits of New Structure

1. **Context Awareness** ✅
   - Claude knows current state from SESSION_PROGRESS.md
   - No more "what were we working on?"

2. **Automatic Loading** ✅
   - CLAUDE.md files loaded by Claude Code automatically
   - No manual "read this file" needed

3. **Focused Information** ✅
   - Frontend vs Backend patterns separated
   - Variables consolidated into single reference
   - Easier to find what you need

4. **Best Practices** ✅
   - Follows Claude Code best practices (shorter files)
   - Multiple CLAUDE.md files for different contexts
   - Updated regularly, not stale

---

## Maintenance

**Update SESSION_PROGRESS.md:**
- After completing significant work (30+ min)
- When switching between tasks
- At end of session

**Update CLAUDE.md files:**
- When discovering new patterns
- When project structure changes
- When adding new technologies

**Archive old docs:**
- Move to `archive/` when superseded
- Keep historical session summaries for reference

---

**Last Updated:** 2025-10-19
**Migration:** From single README.md to multi-file CLAUDE.md structure
