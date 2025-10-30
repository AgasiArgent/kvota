# Superpowers Integration Guide

**Installed:** 2025-10-30
**Version:** Latest from obra/superpowers-marketplace
**Status:** Integrated (Complementary Approach)

---

## What is Superpowers?

Superpowers is a comprehensive skills library by obra (Jesse Vincent) that provides proven workflow patterns for:
- Test-Driven Development (TDD)
- Systematic Debugging
- Design Brainstorming
- Code Review
- Parallel Development (Git Worktrees)

**Repository:** https://github.com/obra/superpowers

---

## Installation

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

**Verification:**
```
/help
```
Should show:
- /superpowers:brainstorm
- /superpowers:write-plan
- /superpowers:execute-plan

---

## Integration Strategy

**Approach:** Complementary Integration (Option B)

### What We Keep (100%):
- ✅ All 5 existing skills (frontend, backend, calculation, database, skill-developer)
- ✅ All 9 agents (orchestrator, frontend-dev, backend-dev, qa-tester, security-auditor, code-reviewer, ux-reviewer, integration-tester, expert)
- ✅ All 4 slash commands (/test-quote-creation, /fix-typescript-errors, /apply-migration, /debug-calculation)
- ✅ Hooks system (skill-activation, post-tool-use, pre-commit, etc.)
- ✅ skill-rules.json configuration
- ✅ All documentation

### What We Add (Complementary):
- ✅ 8 Superpowers workflow skills (auto-activate when relevant)
- ✅ 3 Superpowers commands (optional to use)
- ✅ No conflicts, pure enhancement

---

## How Skills Work Together

### Example 1: Implementing a New Feature

```
You: "Add quote approval workflow"

Skills that auto-activate:
1. backend-dev-guidelines (YOUR skill) - FastAPI patterns, RLS, Pydantic
2. test-driven-development (Superpowers) - Write tests first, RED-GREEN-REFACTOR

Claude uses BOTH:
- Knows HOW to write FastAPI endpoints (from backend-dev-guidelines)
- Knows to WRITE TEST FIRST (from test-driven-development)

Result:
def test_approve_quote():  # Written FIRST (TDD)
    response = client.post("/api/quotes/123/approve")
    assert response.status_code == 200

@router.post("/quotes/{id}/approve")  # Written SECOND (after test fails)
async def approve_quote(id: UUID, user: User = Depends(get_current_user)):
    # FastAPI patterns from backend-dev-guidelines
    ...
```

### Example 2: Debugging an Issue

```
You: "The quote price is wrong"

Skills that auto-activate:
1. calculation-engine-guidelines (YOUR skill) - 42 variables, 13 phases
2. systematic-debugging (Superpowers) - 4-phase root cause methodology

Claude uses BOTH:
- Knows calculation pipeline (from calculation-engine-guidelines)
- Uses systematic process (from systematic-debugging)

Phase 1: Root Cause Investigation
  "Let me trace through the 13 calculation phases..." (calculation knowledge)

Phase 2: Pattern Analysis
  "Comparing with working quote..." (systematic methodology)

Phase 3: Hypothesis
  "I believe Phase 7 customs calculation is using wrong rate" (calculation knowledge)

Phase 4: Fix
  "Writing failing test, then fixing..." (TDD + calculation knowledge)

Result: Bug fixed systematically, not through trial-and-error
```

---

## Workflow Decision Tree

### When to Use Superpowers Commands:

**Use `/superpowers:brainstorm` when:**
- ✅ Feature requirements unclear
- ✅ Multiple design approaches possible
- ✅ Need to explore trade-offs
- ✅ Want design feedback before implementation

**Use `@plan` when:**
- ✅ Requirements clear
- ✅ Need technical implementation roadmap
- ✅ Standard workflow (most features)
- ✅ Want plan with YOUR domain patterns

**Use Both:**
- ✅ Complex features: Brainstorm design → @plan creates technical plan

### When Superpowers Skills Auto-Activate:

**test-driven-development:**
- Auto-activates when agents implement new features
- Enforces: Write test first, watch it fail, implement, watch it pass

**systematic-debugging:**
- Auto-activates when debugging bugs
- Enforces: 4-phase methodology (root cause → pattern → hypothesis → fix)

**verification-before-completion:**
- Auto-activates when @orchestrator runs QA
- Provides comprehensive verification checklist

**You don't invoke these manually - they just enhance how agents work!**

---

## Superpowers Skills Included

**15 Skills Total (We use 8 most relevant):**

### Using Automatically (8):
1. **test-driven-development** (CRITICAL) - RED-GREEN-REFACTOR cycle
2. **systematic-debugging** (HIGH) - 4-phase root cause analysis
3. **verification-before-completion** (HIGH) - Comprehensive QA checklist
4. **root-cause-tracing** (MEDIUM) - Backward tracing technique
5. **brainstorming** (MEDIUM) - Socratic design method
6. **using-git-worktrees** (LOW) - Parallel feature branches
7. **dispatching-parallel-agents** (LOW) - Concurrent agent patterns
8. **subagent-driven-development** (LOW) - Fast iteration with quality gates

### Not Using (7):
- writing-plans (we have @plan agent)
- executing-plans (our workflow handles this)
- condition-based-waiting (niche testing pattern)
- testing-anti-patterns (covered by TDD skill)
- defense-in-depth (covered by verification skill)
- code review skills (we have @code-reviewer agent)
- finishing-branch (our git workflow handles this)

---

## Enhanced Workflow

### Before Superpowers:
```
User Request → @plan → Agents → @orchestrator → Commit
```

### After Superpowers:
```
User Request → [Optional: /brainstorm if unclear]
            ↓
         @plan (with clear requirements)
            ↓
    Agents Implement (TDD skill enforces test-first)
            ↓
    [If bug: systematic-debugging guides methodology]
            ↓
    @orchestrator (verification skill enhances QA)
            ↓
         Commit
```

**Key Changes:**
- Optional brainstorming for design clarity
- Automatic TDD enforcement (agents write tests first)
- Automatic debugging methodology (structured approach)
- Enhanced verification (comprehensive checklist)

**No Changes:**
- All agents still work the same
- All commands still available
- All your skills still active
- Hooks still run
- Git workflow unchanged

---

## Testing After Installation

### Test 1: Verify Commands
```
/help
```
Should show:
- /superpowers:brainstorm
- /superpowers:write-plan
- /superpowers:execute-plan

### Test 2: Try Brainstorming
```
/superpowers:brainstorm
```
Follow the interactive dialogue

### Test 3: Test TDD Skill
```
"Let's add a simple feature - add 'notes' field to quotes"
```
Watch if TDD skill activates and enforces test-first

### Test 4: Test Existing Workflow
```
"Fix the export button alignment"
```
Should still work exactly as before (with TDD enhancement)

---

## Troubleshooting

### Issue: Commands not found
```bash
# Verify plugin installed:
/plugin list

# Reinstall if needed:
/plugin install superpowers@superpowers-marketplace
```

### Issue: Skills not activating
```bash
# Skills activate automatically
# If not seeing them, try:
/superpowers:brainstorm
# This manually activates brainstorming skill
```

### Issue: Conflicts with existing workflow
```bash
# Superpowers skills are non-blocking suggestions
# You can ignore them if not helpful
# Or uninstall:
/plugin uninstall superpowers
```

---

## Uninstall (If Needed)

```
/plugin uninstall superpowers
```

All your existing infrastructure remains intact.

---

## Best Practices

### Do:
- ✅ Use /brainstorm for complex features with unclear design
- ✅ Let TDD skill guide test-first development
- ✅ Let systematic-debugging guide bug fixes
- ✅ Use @plan for technical implementation plans
- ✅ Keep using your specialized agents and commands

### Don't:
- ❌ Feel obligated to use /write-plan (you have @plan)
- ❌ Feel obligated to use /execute-plan (your agents handle this)
- ❌ Block your workflow if skills feel intrusive
- ❌ Disable your existing infrastructure

---

## Quick Reference

**When unclear about design:**
```
/superpowers:brainstorm → clarify → @plan → implement
```

**When implementing feature:**
```
@plan → agents (TDD skill auto-active) → test-first development
```

**When debugging:**
```
Describe bug → systematic-debugging auto-activates → 4-phase methodology
```

**When testing:**
```
/test-quote-creation (your command, app-specific)
```

**When doing QA:**
```
@orchestrator (verification skill enhances checklist)
```

---

**Integration Complete:** Ready to use after installation!
