# Dev Docs System

**Purpose:** Preserve context across Claude autocompacts for large tasks (>1 hour).

**Last Updated:** 2025-10-30

---

## Overview

When working on complex features that span multiple sessions, Claude's memory can autocompact (reset at 85% token usage). This system preserves critical context so work can continue seamlessly.

**Use this system for:**
- Tasks taking >1 hour (multi-session work)
- Complex features touching multiple files
- Tasks with many dependencies
- When approaching 85% token usage (~170k tokens)

**Don't use for:**
- Quick fixes (<30 min)
- Single-file changes
- Simple bug fixes
- Small refactoring

---

## Directory Structure

```
dev/
├── active/          # Current in-progress tasks
│   └── [task-name]/
│       ├── plan.md      # Implementation plan
│       ├── context.md   # Key decisions, files, next steps
│       └── tasks.md     # Checklist with status
├── completed/       # Archived finished tasks
│   └── [task-name]/ # Same structure as active
└── templates/       # Starting templates
    ├── template-plan.md
    ├── template-context.md
    └── template-tasks.md
```

---

## File Naming Convention

**Directory names:**
- Format: `YYYYMMDD-TASK-###-short-description`
- Example: `20251030-TASK-001-approval-workflow`

**File names within directory:**
- `plan.md` - The implementation plan
- `context.md` - Key context for resuming work
- `tasks.md` - Task checklist with status

**Why this format?**
- Date prefix: Easy to sort chronologically
- TASK-###: Unique identifier for cross-referencing
- Short description: Human-readable at a glance

---

## Workflow

### Starting a Large Task

#### Quick Method (Recommended):
```bash
# Use the helper script
./dev/dev-docs init "Your task description"
```

#### Manual Method:
1. **Create task directory:**
   ```bash
   mkdir -p dev/active/YYYYMMDD-TASK-001-feature-name
   ```

2. **Copy templates:**
   ```bash
   cp dev/templates/template-plan.md dev/active/YYYYMMDD-TASK-001-feature-name/plan.md
   cp dev/templates/template-context.md dev/active/YYYYMMDD-TASK-001-feature-name/context.md
   cp dev/templates/template-tasks.md dev/active/YYYYMMDD-TASK-001-feature-name/tasks.md
   ```

3. **Fill in plan.md:**
   - Copy accepted implementation plan
   - Add architecture decisions
   - Document dependencies
   - List risks and mitigation

4. **Fill in context.md:**
   - List key files that will be modified
   - Document initial decisions
   - Note integration points

5. **Fill in tasks.md:**
   - Break down plan into actionable tasks
   - Estimate time for each task
   - Identify dependencies between tasks
   - Mark which tasks can run in parallel

### Continuing Work (After Autocompact)

1. **Check for existing task:**
   ```bash
   ls dev/active/
   ```

2. **Read all 3 files to restore context:**
   - `plan.md` - Understand the overall approach
   - `context.md` - See what decisions were made
   - `tasks.md` - Find what's left to do

3. **Continue work** from where you left off

4. **Update context.md** as you make new decisions

5. **Update tasks.md** as you complete tasks

### Before Autocompact (85% Tokens)

**When Claude says "approaching token limit":**

1. **Update context.md:**
   - Add recent decisions made
   - Note files modified since last update
   - Document any blockers encountered
   - Write clear "Next Steps" section

2. **Update tasks.md:**
   - Mark completed tasks as [x]
   - Add any new tasks discovered
   - Update time estimates if needed

3. **Commit changes:**
   ```bash
   git add dev/active/[task-name]/
   git commit -m "Update dev docs before autocompact - TASK-###"
   ```

4. **After autocompact:**
   - Say: "Continue working on TASK-### (see dev/active/[task-name]/)"
   - Claude will read the docs and resume

### After Task Complete

1. **Verify all tasks done:**
   - Check tasks.md for any [ ] remaining
   - Ensure all tests pass
   - Run quality checks (@orchestrator)

2. **Final update:**
   - Mark all tasks as [x]
   - Update context.md with final state
   - Note any follow-up tasks for future

3. **Move to completed:**
   ```bash
   mv dev/active/YYYYMMDD-TASK-001-feature-name dev/completed/
   ```

4. **Update SESSION_PROGRESS.md:**
   - Mark feature as complete
   - Note any technical debt created
   - Link to dev docs for reference

---

## Helper Script Commands

The `dev-docs` helper script reduces manual overhead by 90%:

```bash
# Create new task
./dev/dev-docs init "Add approval workflow"

# Show all active tasks with progress
./dev/dev-docs status

# Update timestamps before autocompact
./dev/dev-docs update [task-name]

# Mark task complete and archive
./dev/dev-docs complete approval-workflow

# Search all dev docs
./dev/dev-docs search "React Query"

# Show help
./dev/dev-docs help
```

**Benefits:**
- Auto-generates task IDs (TASK-001, TASK-002, etc.)
- Updates placeholders in templates
- Shows task progress from tasks.md
- Archives completed tasks automatically
- Searches across all documentation

---

## Best Practices

### Plan.md
- Copy the accepted implementation plan verbatim
- Add "Why this approach?" explanations
- Document alternatives considered and rejected
- Include rollback plan if things go wrong

### Context.md
- Update after every significant decision
- Explain WHY, not just WHAT
- Note any shortcuts or hacks (with justification)
- Document assumptions clearly

### Tasks.md
- Keep tasks small and actionable (30-60 min each)
- Use clear status markers: [ ] → [>] → [x]
- Estimate time honestly
- Mark blockers as [!] with explanation

### General
- Commit dev docs regularly (not just at end)
- Use descriptive commit messages referencing TASK-###
- Link between related tasks in different directories
- Archive completed tasks (don't delete - valuable history)

---

## Integration with Agents

**Agents should:**
1. Check `dev/active/` at start of session
2. Read all 3 files if task exists
3. Update context.md when making decisions
4. Update tasks.md as work progresses
5. Commit dev docs before finishing

**Agents reference dev docs in:**
- Commit messages: "Implement X (TASK-001)"
- PR descriptions: "See dev/active/TASK-001/ for context"
- GitHub issues: "Related to TASK-001 (approval workflow)"

---

## Example Task

**See:** `dev/active/20251030-TASK-001-approval-workflow/`

This sample task demonstrates:
- How to fill in all 3 templates
- Realistic task breakdown
- Documenting decisions made
- Showing "partially complete" state
- How to resume after context loss

---

## Troubleshooting

**Problem:** "I don't know which task I was working on"
- **Solution:** Check `dev/active/` for most recent directory (date prefix)

**Problem:** "Context docs are out of date"
- **Solution:** Always update context.md before ending session

**Problem:** "Too much overhead maintaining 3 files"
- **Solution:** Only use for tasks >1 hour. Quick fixes don't need this.

**Problem:** "Forgot to update before autocompact"
- **Solution:** Review git log to see what changed, update retroactively

**Problem:** "Multiple tasks in progress"
- **Solution:** One directory per task. Focus on one at a time when possible.

---

## See Also

- `.claude/SESSION_PROGRESS.md` - Overall project progress
- `.claude/skills/` - Domain-specific patterns
- `.claude/implementation/` - Phase implementation plans
- `dev/templates/` - Starting templates for new tasks

---

**Remember:** This system is OPTIONAL. Only use for complex tasks where context preservation truly helps. Don't over-engineer small changes.
