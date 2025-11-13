# Phase 5: Orchestrator Autonomous Invocation

**Time:** 2-3 hours
**Priority:** 🟢 ENHANCEMENT
**Prerequisites:** Phases 1-4 completed
**Output:** Orchestrator auto-invokes QA/Security/Review agents

---

## Current Problem

**Manual invocation:** User must explicitly call `@orchestrator` after features.

**Desired:** Orchestrator detects feature completion and auto-runs agents.

---

## Solution

Update orchestrator agent prompt to:
1. **Detect feature completion** (commit size, keywords, user confirmation)
2. **Auto-launch agents in parallel** (QA Tester, Security Auditor, Code Reviewer)
3. **Report findings** (critical vs minor issues)
4. **Auto-fix minor issues** (formatting, comments)
5. **Create GitHub issues** (critical security/bugs)
6. **Update docs** (SESSION_PROGRESS.md, CLAUDE.md)
7. **Commit and push** (if tests pass)

---

## Implementation

### Modify `.claude/agents/orchestrator.md`

Add detection logic:

```markdown
## Autonomous Feature Detection

**Trigger orchestrator workflow when:**

1. **Explicit trigger:** User says "ready to finalize" or "@orchestrator"
2. **Commit size heuristic:** Git diff shows 200+ lines changed
3. **Post-feature hook:** Hook invokes orchestrator
4. **Keywords:** User mentions "done with feature", "ready for review"

### Detection Logic

Before running full workflow, ask:
"I detect significant changes (X files, Y lines). Run quality checks now? (QA/Security/Review in parallel)"

**If yes:** Proceed with workflow
**If no:** Ask user to confirm when ready
```

### Add to Workflow

**STEP 2.5 already exists in current orchestrator.md** - Integration testing for UI features.

Ensure it:
- Only runs for frontend/UI changes
- Uses Chrome DevTools MCP
- Reports bugs found before asking user to test
- Saves user time (catches 80% of bugs automatically)

---

## Feature Flag (Optional)

Allow users to disable autonomous invocation:

**In `.claude/settings.json`:**

```json
{
  "orchestrator": {
    "autonomous_invocation": true,
    "auto_fix_minor_issues": true,
    "create_github_issues": true
  }
}
```

---

## Success Criteria

- [ ] Orchestrator detects feature completion
- [ ] Auto-launches agents in parallel
- [ ] Reports findings clearly (critical vs minor)
- [ ] Auto-fixes minor issues
- [ ] Creates GitHub issues for critical findings
- [ ] Updates docs automatically
- [ ] Commits and pushes (if tests pass)
- [ ] User can disable if needed

---

## Testing

**Test scenario:**
1. Complete a small feature (50-100 lines)
2. Orchestrator should ask: "Run quality checks?"
3. User confirms
4. Agents run in parallel (QA, Security, Review)
5. Findings reported
6. Minor issues auto-fixed
7. Docs updated
8. Commit created

---

## See Full Details

Original plan: IMPLEMENTATION_PLAN_BEST_PRACTICES.md (lines 1800-2200)
- Complete orchestrator prompt modifications
- Detection heuristics
- Feature flag configuration
- Error handling

