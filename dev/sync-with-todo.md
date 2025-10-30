# Dev Docs ↔ TodoWrite Integration Guide

## When to Use Which System

### Use Dev Docs For:
- **Large tasks (>1 hour)** that span multiple sessions
- **Complex features** requiring architectural decisions
- **Tasks approaching autocompact** (85% tokens)
- **Preserving context** across sessions
- **Documenting WHY** decisions were made

### Use TodoWrite For:
- **Quick tasks (<1 hour)** within single session
- **Simple bug fixes** with clear scope
- **Linear workflows** without complex decisions
- **Real-time progress tracking** during work
- **Agent coordination** in parallel execution

## Integration Pattern

When working on a large task that needs both systems:

1. **Start with Dev Docs:**
   ```bash
   ./dev/dev-docs init "Feature name"
   ```

2. **Use TodoWrite for current session:**
   ```typescript
   // At session start, load tasks from dev docs
   const tasks = loadFromDevDocs('dev/active/TASK-001/tasks.md');
   TodoWrite(convertToTodoFormat(tasks));
   ```

3. **Before autocompact, sync back:**
   ```bash
   # Update dev docs with TodoWrite progress
   ./dev/dev-docs update TASK-001
   ```

## Avoiding Duplication

**Rule:** Dev Docs owns the master task list, TodoWrite is ephemeral session state.

- Dev Docs `tasks.md` = Persistent across sessions
- TodoWrite = Working memory for current session
- On session start: Dev Docs → TodoWrite
- Before autocompact: TodoWrite → Dev Docs

## Example Workflow

```bash
# Session 1: Start large task
./dev/dev-docs init "Add approval workflow"
# Fill in plan.md, context.md, tasks.md
# Use TodoWrite for session work

# Session 2: Resume after autocompact
./dev/dev-docs status  # See TASK-001 active
cat dev/active/*TASK-001*/context.md  # Restore context
# Load tasks.md into TodoWrite
# Continue work...

# Before ending session
./dev/dev-docs update TASK-001
git add dev/active/
git commit -m "Update dev docs - TASK-001 progress"
```

## Best Practice

- **Don't duplicate:** Choose one system per task based on size
- **Dev Docs for strategy:** Long-term planning and decisions
- **TodoWrite for tactics:** Current session execution
- **Sync at boundaries:** Session start/end, before autocompact

## Quick Decision Tree

```
Is task > 1 hour?
  YES → Use Dev Docs (with TodoWrite for session)
  NO  → Is it a simple fix?
    YES → Use neither (just do it)
    NO  → Use TodoWrite only
```