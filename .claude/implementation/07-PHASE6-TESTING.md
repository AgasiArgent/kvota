# Phase 6: Testing & Refinement

**Time:** 3-4 hours
**Priority:** 🟢 VERIFICATION
**Prerequisites:** Phases 1-5 completed
**Output:** Verified system working end-to-end

---

## Overview

Test each component to ensure the system works correctly.

---

## Test 1: Skills Auto-Activation (1 hour)

### Test Frontend Skill

1. Open `frontend/src/app/quotes/create/page.tsx`
2. Ask: "How should I add form validation?"
3. **Expected:** frontend-dev-guidelines activates
4. **Verify:** Shows Ant Design validation patterns
5. **Verify:** Shows ag-Grid patterns (if relevant)

### Test Backend Skill

1. Open `backend/routes/quotes.py`
2. Ask: "How do I add a new endpoint?"
3. **Expected:** backend-dev-guidelines activates
4. **Verify:** Shows FastAPI patterns
5. **Verify:** Shows RLS security reminders

### Test Calculation Skill

1. Open `backend/routes/quotes_calc.py`
2. Ask: "How do I add a new variable?"
3. **Expected:** calculation-engine-guidelines activates
4. **Verify:** Shows 42 variable classification
5. **Verify:** Shows two-tier system rules

### Test Database Skill (GUARDRAIL)

1. Create `backend/migrations/999_test.sql`
2. Ask: "I want to create a new table"
3. **Expected:** database-verification activates
4. **Verify:** Shows RLS checklist
5. **Verify:** BLOCKS until checklist verified

---

## Test 2: Hooks Execution (1 hour)

### Test Pre-Commit Hook

1. Make Python syntax error in `backend/routes/test.py`
2. Run `git add . && git commit -m "test"`
3. **Expected:** Pre-commit hook catches syntax error
4. **Verify:** Commit blocked with error message

### Test WSL2 Pre-Flight Check

1. Run `.claude/launch-chrome-testing.sh full`
2. **Expected:** Memory check runs first
3. **Verify:** Shows current memory usage
4. **Verify:** Warns if >75%, blocks if >85%

### Test Post-Feature Hook

1. Complete a small feature
2. Run `./.claude/hooks/post-feature.sh`
3. **Expected:** Tests run, docs checked
4. **Verify:** Passes or reports issues

### Test Build Verification

1. Run `./.claude/hooks/verify-build.sh`
2. **Expected:** Frontend builds, backend syntax checks
3. **Verify:** Passes or reports errors

---

## Test 3: Orchestrator Autonomous Invocation (1 hour)

### Test Feature Detection

1. Make significant changes (200+ lines)
2. Say: "Ready to finalize"
3. **Expected:** Orchestrator asks "Run quality checks?"
4. **Verify:** User can confirm or decline

### Test Agent Parallel Execution

1. Confirm quality checks
2. **Expected:** QA, Security, Review agents run in parallel
3. **Verify:** Completes in ~3 min (vs ~10 min sequential)
4. **Verify:** Reports findings (critical vs minor)

### Test Auto-Fix Minor Issues

1. Leave minor issues (missing comments, formatting)
2. **Expected:** Orchestrator auto-fixes
3. **Verify:** Fixes applied without asking

### Test GitHub Issue Creation

1. Introduce critical bug (missing RLS policy)
2. **Expected:** Security auditor finds it
3. **Verify:** GitHub issue created automatically
4. **Verify:** Issue has label "agent-found", "security", "critical"

### Test Documentation Updates

1. Complete feature with orchestrator
2. **Expected:** SESSION_PROGRESS.md updated
3. **Verify:** Task marked as [~] awaiting verification
4. **Verify:** CLAUDE.md updated (if new packages/patterns)

---

## Test 4: Chrome DevTools MCP Integration Testing (30 min)

### Test Tiered Testing

1. Run Tier 1: `cd backend && pytest -v`
2. **Expected:** 5 seconds, 100 MB memory
3. Run Tier 3: `./.claude/launch-chrome-testing.sh headless`
4. **Expected:** 60 seconds, 500 MB memory
5. **Verify:** Resource usage as expected

### Test Safe Session Wrapper

1. Run `./.claude/safe-test-session.sh headless http://localhost:3001 10`
2. **Expected:** Auto-cleanup after 10 minutes
3. **Verify:** Chrome killed, resources freed

---

## Test 5: End-to-End Feature Workflow (30 min)

### Complete Feature with Full Workflow

1. **Start:** Plan a small feature (add form field)
2. **Implement:** Add field with frontend skill guidance
3. **Pre-commit:** Git commit triggers syntax/type checks
4. **Finalize:** Say "ready to finalize"
5. **Orchestrator:** Confirms, runs agents in parallel
6. **Findings:** Reports issues, auto-fixes minor
7. **Docs:** Updates SESSION_PROGRESS.md
8. **Commit:** Creates commit with proper message
9. **Push:** Pushes to GitHub
10. **CI:** Verify GitHub Actions pass

**Expected time:** 15-20 minutes (vs 30-40 min without automation)

---

## Issues to Fix

### During testing, track:

- [ ] Skills not activating → Check skill-rules.json triggers
- [ ] Hooks not running → Check chmod +x, file paths
- [ ] Orchestrator not detecting → Adjust heuristics
- [ ] Agents not running in parallel → Check Task tool usage
- [ ] Performance slower than expected → Profile bottlenecks

**Create GitHub issues for bugs found during testing.**

---

## Success Criteria

- [ ] All 4 skills activate correctly
- [ ] All hooks execute without errors
- [ ] Orchestrator detects features autonomously
- [ ] Agents run in parallel (3 min vs 10 min)
- [ ] GitHub issues created for critical findings
- [ ] Docs updated automatically
- [ ] End-to-end workflow 50% faster than manual
- [ ] Zero bugs left unfixed

---

## Next Steps

After Phase 6:

1. **Fix issues found** - Address any bugs from testing
2. **Optional:** Move to Phase 7 (Slash Commands) if desired
3. **Optional:** Move to Phase 8 (Dev Docs) if needed
4. **Required:** Phase 10 (Final Documentation)

