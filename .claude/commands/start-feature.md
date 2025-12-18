---
description: Start a new feature with guided planning and dev-docs setup
---

# Start Feature Command

You are guiding the user through starting a new feature. Follow the brainstorming methodology: one question at a time, multiple choice preferred, incremental validation.

## Phase 1: Check Context

First, check for active tasks:

```bash
./dev/dev-docs status
```

If active task found that might match what user wants:
- Ask: "Found active task: TASK-XXX ([name]). Continue this or start fresh?"
- If continue: Read all 3 dev-docs files (plan.md, context.md, tasks.md) and resume
- If fresh: Continue to Phase 2

## Phase 2: Gather Information (One Question at a Time)

Use AskUserQuestion tool for each question. Wait for answer before next question.

**Question 1: What are we building?**
- Open-ended question
- "Describe the feature in 1-2 sentences. What should it do?"

**Question 2: Size estimate**
- Multiple choice:
  - "Quick fix (< 1 hour)" → Skip dev-docs, just do the work
  - "Medium feature (1-3 hours)" → Create dev-docs
  - "Large feature (3+ hours)" → Create dev-docs + detailed planning

If "Quick fix" selected: Skip to implementation, no dev-docs needed.

**Question 3: Areas affected**
- Multiple choice (can select multiple):
  - "Frontend only"
  - "Backend only"
  - "Database changes"
  - "Full-stack"

**Question 4: Any specific requirements?**
- Open-ended (optional)
- "Any constraints, deadlines, or must-have requirements?"

## Phase 3: Propose Approaches

Based on answers, propose 2-3 implementation approaches:

Present conversationally:
> "Based on what you've described, here are your options:
>
> **Option A (Recommended):** [description]
> - Pros: ...
> - Cons: ...
> - Estimated: X hours
>
> **Option B:** [description]
> - Pros: ...
> - Cons: ...
> - Estimated: X hours
>
> Which approach do you prefer?"

## Phase 4: Create Dev-Docs

After user confirms approach:

```bash
./dev/dev-docs init "[feature name from Question 1]"
```

Then fill the templates:

### Fill plan.md
Based on conversation:
- Objective: From Question 1
- Success criteria: Derived from requirements
- Technical approach: From chosen option
- Implementation phases: Based on areas affected
- Risks: Identify 1-2 main risks

### Fill tasks.md
Break into phases based on Question 3:

**If Database changes:**
- Phase 1: Database (migration, RLS, tests)

**If Backend:**
- Phase N: Backend API (endpoints, validation, tests)

**If Frontend:**
- Phase N: Frontend UI (components, state, styling)

**Always include:**
- Phase N-1: Testing & QA
- Phase N: Documentation

Each task should be 15-60 min. Use [ ] checkbox format.

### Fill context.md (minimal initially)
- Task overview: Summary from conversation
- Current phase: "Phase 1 - Starting"
- Decisions made: Record approach choice from Phase 3
- Next steps: First 2-3 tasks

## Phase 5: Confirm and Start

Show user summary:
> "Created TASK-XXX with X phases and Y tasks.
>
> Starting with: [first task description]
>
> Ready to begin?"

If yes: Start working on first task. Mark it [>] in tasks.md.

## During Work: Reminders

Set mental checkpoints:

**Every 30 min of work:**
- Update context.md with decisions made
- Mark completed tasks [x] in tasks.md

**After completing a phase:**
- Update context.md "Current Phase"
- Commit dev-docs: `git add dev/active/TASK-XXX/ && git commit -m "Update dev docs - TASK-XXX"`

**At 70% token usage:**
- Warn: "Approaching context limit. Should I save progress now?"

**At 85% token usage:**
- Force save: Update all dev-docs, commit
- Tell user: "Context saved. After reset, say: Continue TASK-XXX"

## Resuming After Autocompact

When user says "Continue TASK-XXX":

1. Find task folder: `ls dev/active/ | grep TASK-XXX`
2. Read all 3 files: plan.md, context.md, tasks.md
3. Summarize: "Resuming TASK-XXX. Last session completed: [X]. Next: [Y]"
4. Continue from context.md "Next Steps"

## Task Completion

When all tasks in tasks.md are [x]:

1. Verify: Any tests to run? Any lint errors?
2. Ask: "All tasks complete. Run quality checks? (@orchestrator)"
3. If yes: Call @orchestrator for QA/Security/Review
4. After checks pass:
   - `./dev/dev-docs complete [task-name]`
   - Update SESSION_PROGRESS.md
   - Commit and push

## Key Principles (from brainstorming skill)

- **One question at a time** - Don't overwhelm
- **Multiple choice preferred** - Easier to answer
- **YAGNI ruthlessly** - Cut unnecessary scope
- **Incremental validation** - Check after each phase
- **Be flexible** - Adjust plan as you learn more
