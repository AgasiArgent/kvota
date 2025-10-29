# Phase 8: Dev Docs System (Optional)

**Time:** 3-4 hours
**Priority:** 🔵 OPTIONAL
**Prerequisites:** None (independent of other phases)
**Output:** Context preservation system for large tasks

---

## Overview

**Dev docs preserve context across autocompacts** for tasks >1 hour.

**This phase is OPTIONAL** - only needed if you frequently work on tasks >1 hour that span multiple sessions.

---

## Directory Structure

```
~/git/quotation-app-dev/dev/
├── active/                    # Current tasks
│   └── [task-name]/
│       ├── [task]-plan.md     # Implementation plan
│       ├── [task]-context.md  # Key files, decisions
│       └── [task]-tasks.md    # Checklist
├── completed/                 # Archived tasks
└── templates/
    ├── template-plan.md
    ├── template-context.md
    └── template-tasks.md
```

---

## When to Use

**Create dev docs for:**
- Tasks >1 hour (will span multiple sessions)
- Complex features (multiple files, dependencies)
- When approaching 85% token usage (170k tokens)

**Don't create for:**
- Quick fixes (<30 min)
- Single-file changes
- Simple bug fixes

---

## Workflow

### Starting Large Task

1. Exit plan mode with accepted plan
2. Create task directory: `mkdir -p dev/active/[task-name]`
3. Create 3 files from templates:
   - `[task]-plan.md` - The accepted plan
   - `[task]-context.md` - Key files, decisions
   - `[task]-tasks.md` - Checklist
4. Update regularly as you work

### Continuing Task

1. Check `dev/active/` for task directory
2. Read all 3 files to restore context
3. Check tasks.md for what's left
4. Update context.md with new decisions

### Before Compaction (85% tokens)

1. Update context.md:
   - Recent decisions
   - Next steps
   - Blockers
2. Update tasks.md:
   - Mark completed [x]
   - Add new tasks discovered
3. After compaction: Say "continue" and reference dev docs

### After Task Complete

1. Mark all tasks [x]
2. Move to `dev/completed/`
3. Update SESSION_PROGRESS.md

---

## Templates

### template-plan.md

```markdown
# [Task Name] - Implementation Plan

**Created:** [Date]
**Status:** In Progress
**Estimated Time:** [Hours]

## Overview
[Brief description]

## Phases
1. Phase 1 name
   - Task 1
   - Task 2

## Dependencies
[Files, services, features]

## Risks
[Potential issues]

## Success Criteria
[How we know it's done]
```

### template-context.md

```markdown
# [Task Name] - Context

**Last Updated:** [Date]

## Key Files
- file1.tsx - Purpose
- file2.py - Purpose

## Important Decisions
1. Decision 1 - Rationale
2. Decision 2 - Rationale

## Next Steps
[What to do when resuming]

## Blockers
[Any issues blocking progress]
```

### template-tasks.md

```markdown
# [Task Name] - Task Checklist

**Last Updated:** [Date]

## Tasks

### Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Name]
- [ ] Task 3

## Completed
- [x] Completed task 1
```

---

## Integration with CLAUDE.md

**Add section:**

```markdown
## Dev Docs System

**For large tasks (>1 hour):**

1. Create task directory in `dev/active/[task-name]/`
2. Create 3 files from templates:
   - plan.md, context.md, tasks.md
3. Update regularly
4. Before compaction: Update context.md with next steps
5. After compaction: Say "continue" and reference dev docs
6. After complete: Move to `dev/completed/`

**Location:** `dev/active/` and `dev/templates/`
```

---

## Success Criteria

- [ ] Directory structure created
- [ ] 3 templates created
- [ ] CLAUDE.md documents workflow
- [ ] Tested with sample task
- [ ] Improves context preservation after compaction

---

## Benefits

- ✅ No context loss after autocompact
- ✅ Easy to resume large tasks
- ✅ Track progress across sessions
- ✅ Preserve decisions and reasoning

**Trade-off:** Extra overhead (3 files per task). Only worth it for tasks >1 hour.

---

## See Full Details

Original plan: IMPLEMENTATION_PLAN_BEST_PRACTICES.md (lines 2800-3200)
- Complete template content
- Workflow diagrams
- Integration examples
- Best practices

