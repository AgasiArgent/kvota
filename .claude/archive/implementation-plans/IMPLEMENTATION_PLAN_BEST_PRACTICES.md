# Claude Code Best Practices Implementation Plan

**Created:** 2025-10-29
**Based On:** Reddit post "Claude Code is a beast: Tips from 6 months of hardcore use"
**Goal:** Transform workflow from 60% → 95% maturity level
**Timeline:** 7 days, 29-39 hours total
**Status:** Ready for review and implementation

---

## 🎯 Executive Summary

### Your Current Pain Points

1. ❌ **Code inconsistency + frequent mistakes**
2. ❌ **Manual agent invocation** (have to remind orchestrator)
3. ❌ **Same bugs repeatedly**
4. ❌ **Manual documentation** (should be automatic)
5. ❌ **File cleanup struggles**
6. ❌ **Not using skills/hooks** (they don't exist yet)

### The Solution

Build foundational infrastructure that addresses all 6 problems:

1. **Skills System** → Enforces patterns, prevents repeated bugs, includes agent reminders
2. **Hooks System** → Auto-documentation, quality checks, error catching
3. **Dev Docs System** → Context preservation across compactions
4. **Orchestrator Fix** → Autonomous agent invocation
5. **Slash Commands** → Streamlined workflows

### Expected Results

**Immediate (Week 1):**
- ✅ Skills auto-activate and enforce patterns
- ✅ Hooks catch all errors automatically
- ✅ Dev docs preserve context
- ✅ Orchestrator invokes agents autonomously

**Short-term (Weeks 2-4):**
- ✅ 50-70% reduction in bugs
- ✅ 40-60% token efficiency improvement
- ✅ 3x faster code reviews
- ✅ Zero errors left behind

**Long-term (Months 2-6):**
- ✅ Consistent code quality across codebase
- ✅ Less time fixing mistakes, more time building
- ✅ All 6 pain points completely resolved

---

## 📊 Gap Analysis Summary

**Current Maturity:** 60-65% of Reddit dev's system

### ✅ What We're Already Doing Well (70-80% level)

1. **Specialized Agent System** (9 agents with model optimization)
2. **Documentation Structure** (Root + repo-specific CLAUDE.md)
3. **Context Awareness** (SESSION_PROGRESS.md tracking)
4. **Planning Emphasis** (@Plan agent, orchestrator)
5. **Testing Infrastructure** (Chrome DevTools MCP, scripts)
6. **Code Organization** (Clean .claude/ structure)

### ❌ Critical Gaps (0% level)

1. 🔴 **Skills System** - Biggest opportunity, 40-60% token savings
2. 🔴 **Hooks System** - #NoMessLeftBehind automation
3. 🔴 **Manual Agent Workflow** - Orchestrator doesn't auto-invoke
4. 🟡 **Dev Docs System** - Per-task context preservation
5. 🟡 **Slash Commands** - Reusable workflows
6. 🟡 **Script Integration** - Scripts not referenced in docs

---

## 🗓️ Phase-by-Phase Implementation

### PHASE 1: Foundation (Day 1-2, 6-8 hours) 🔴 CRITICAL

**Goal:** Set up basic skills infrastructure and dev docs system

#### Task 1.1: Skills Directory Structure (1 hour)

**Create:**
```
.claude/skills/
├── README.md                          # Skills overview
├── frontend-dev-guidelines/
│   ├── SKILL.md                       # Main file (<500 lines)
│   └── resources/
│       ├── react-patterns.md
│       ├── ant-design-standards.md
│       ├── tanstack-patterns.md
│       └── state-management.md
├── backend-dev-guidelines/
│   ├── SKILL.md                       # Main file (<500 lines)
│   └── resources/
│       ├── fastapi-patterns.md
│       ├── supabase-rls.md
│       ├── error-handling.md
│       └── testing-patterns.md
└── database-verification/
    └── SKILL.md                       # Guardrail skill
```

**Actions:**
- Create directory structure
- Move frontend patterns from CLAUDE.md → skills
- Move backend patterns from backend/CLAUDE.md → skills
- Extract to < 500 line main files with resource files

**Verification Checklist:**
- [ ] Skills directory exists
- [ ] Main SKILL.md files < 500 lines each
- [ ] Resource files created with detailed content

---

#### Task 1.2: Dev Docs System Setup (2 hours)

**Create:**
```
~/git/quotation-app-dev/dev/
├── active/                            # Current tasks
│   └── [task-name]/
│       ├── [task]-plan.md
│       ├── [task]-context.md
│       └── [task]-tasks.md
├── completed/                         # Archive finished tasks
└── templates/
    ├── template-plan.md
    ├── template-context.md
    └── template-tasks.md
```

**Actions:**
- Create dev/ directory structure
- Create 3 markdown templates with standard sections
- Add dev docs workflow section to CLAUDE.md
- Document when/how to create dev docs (large tasks > 30 min)

**Template Content:**

**template-plan.md:**
```markdown
# [Task Name] - Implementation Plan

**Created:** [Date]
**Status:** In Progress
**Estimated Time:** [Hours]

## Overview
[Brief description of what we're building]

## Phases
[Numbered phases with tasks]

## Dependencies
[Files, services, or features this depends on]

## Risks
[Potential issues or blockers]

## Success Criteria
[How we know it's done]
```

**template-context.md:**
```markdown
# [Task Name] - Context

**Last Updated:** [Date]

## Key Files
[List of important files being modified]

## Important Decisions
[Architectural or implementation decisions made]

## Next Steps
[What to do next when resuming]

## Blockers
[Any issues blocking progress]
```

**template-tasks.md:**
```markdown
# [Task Name] - Task Checklist

**Last Updated:** [Date]

## Tasks

### Phase 1: [Name]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Name]
- [ ] Task 3
- [ ] Task 4

## Completed
- [x] Completed task 1
- [x] Completed task 2
```

**Verification Checklist:**
- [ ] Templates created and tested
- [ ] CLAUDE.md documents dev docs workflow
- [ ] Can create task docs from templates easily

---

#### Task 1.3: Update CLAUDE.md Structure (2 hours)

**Remove from CLAUDE.md:**
- All "how to write code" guidelines → Move to skills
- Detailed React patterns → frontend-dev-guidelines skill
- Detailed FastAPI patterns → backend-dev-guidelines skill
- Detailed testing patterns → skills
- Keep only: Project setup, quick commands, workflows, when to use skills

**Add to CLAUDE.md:**

```markdown
## Dev Docs System

**For all large tasks or features (> 30 min implementation):**

### Starting Large Tasks

When exiting plan mode with accepted plan:

1. **Create Task Directory:**
   ```bash
   mkdir -p ~/git/quotation-app-dev/dev/active/[task-name]/
   ```

2. **Create Documents from templates:**
   - `[task]-plan.md` - The accepted plan
   - `[task]-context.md` - Key files, decisions, dependencies
   - `[task]-tasks.md` - Checklist of work

3. **Update Regularly:**
   - Mark tasks complete immediately with [x]
   - Add newly discovered tasks
   - Note important decisions in context.md
   - Update "Last Updated" timestamps

### Continuing Tasks

Before continuing work on existing task:
1. Check `~/git/quotation-app-dev/dev/active/` for task directory
2. Read all three files to restore context
3. Check tasks.md for what's left to do
4. Update context.md with any new decisions

### Before Compaction

When approaching 85%+ token usage:
1. Update context.md with:
   - Recent decisions or discoveries
   - Next steps for when you resume
   - Any blockers encountered
2. Update tasks.md:
   - Mark completed tasks [x]
   - Add new tasks discovered
3. After compaction, just say "continue" and reference dev docs

### After Task Complete

1. Mark all tasks [x] in tasks.md
2. Move entire directory to `~/git/quotation-app-dev/dev/completed/`
3. Update SESSION_PROGRESS.md

## Skills System

**We use auto-activating skills for consistent code patterns.**

Available skills:
- **frontend-dev-guidelines** - React 19, Ant Design, TanStack patterns
- **backend-dev-guidelines** - FastAPI, Supabase, RLS patterns
- **database-verification** - Database patterns and guardrails

Skills automatically activate based on:
- Keywords in your prompts
- Files being edited
- Type of work being done

You don't need to manually load skills - hooks handle this automatically.

For skill details, see `.claude/skills/[skill-name]/SKILL.md`
```

**Target:** CLAUDE.md should be ~250-300 lines (down from current)

**Verification Checklist:**
- [ ] CLAUDE.md < 300 lines
- [ ] Clear separation: project info vs coding guidelines
- [ ] Dev docs workflow fully documented
- [ ] Skills section explains when they activate

---

#### Task 1.4: Create Skill-Rules Config (1 hour)

**Create:** `.claude/skills/skill-rules.json`

```json
{
  "frontend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "description": "React 19, Ant Design, TanStack Query/Router patterns",
    "promptTriggers": {
      "keywords": [
        "react", "component", "frontend", "UI", "UX",
        "ant design", "form", "table", "layout",
        "tanstack", "query", "router", "state"
      ],
      "intentPatterns": [
        "(create|add|build|implement).*?(component|page|feature|UI)",
        "(how to|best practice|pattern).*?(react|frontend|component)",
        "(style|design|layout).*?(page|component)",
        "(form|validation|submit)",
        "(data.*fetch|query|mutation)",
        "(route|navigation|link)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "frontend/src/**/*.tsx",
        "frontend/src/**/*.ts",
        "frontend/src/**/*.jsx"
      ],
      "contentPatterns": [
        "import.*from 'react'",
        "import.*from 'antd'",
        "import.*@tanstack",
        "export.*function.*Component",
        "const.*=.*\\(\\).*=>",
        "useState|useEffect|useQuery"
      ]
    }
  },
  "backend-dev-guidelines": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "description": "FastAPI, Supabase, PostgreSQL, RLS patterns",
    "promptTriggers": {
      "keywords": [
        "backend", "api", "endpoint", "route", "controller",
        "fastapi", "supabase", "database", "postgres",
        "rls", "policy", "permission", "auth"
      ],
      "intentPatterns": [
        "(create|add|build|implement).*?(route|endpoint|api|controller|service)",
        "(how to|best practice|pattern).*?(backend|api|endpoint)",
        "(database|query|migration|schema)",
        "(rls|policy|permission|security)",
        "(error.*handle|exception|try.*catch)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "backend/**/*.py",
        "backend/routes/**",
        "backend/services/**"
      ],
      "contentPatterns": [
        "from fastapi",
        "@router\\.",
        "@app\\.",
        "async def",
        "supabase\\.",
        "prisma\\.",
        "raise HTTPException"
      ]
    }
  },
  "database-verification": {
    "type": "guardrail",
    "enforcement": "block",
    "priority": "critical",
    "description": "Database schema and migration guardrails",
    "promptTriggers": {
      "keywords": [
        "migration", "schema", "column", "table",
        "alter table", "create table", "drop",
        "database", "postgres", "supabase"
      ],
      "intentPatterns": [
        "(create|add|modify|drop|alter).*?(table|column|schema)",
        "(migration|migrate)",
        "(database.*change|schema.*change)"
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "backend/migrations/**/*.sql",
        "backend/prisma/**"
      ],
      "contentPatterns": [
        "CREATE TABLE",
        "ALTER TABLE",
        "DROP TABLE",
        "ADD COLUMN",
        "DROP COLUMN"
      ]
    }
  }
}
```

**Verification Checklist:**
- [ ] skill-rules.json created with valid JSON
- [ ] All 3 skills have rules defined
- [ ] Keywords comprehensive for each domain
- [ ] Intent patterns cover common phrases
- [ ] File patterns match project structure

---

### PHASE 2: Skills Content Creation (Day 2-3, 6-8 hours) 🔴 CRITICAL

**Goal:** Write comprehensive skills with patterns, gotchas, best practices

#### Task 2.1: Frontend Dev Guidelines Skill (3 hours)

**Main SKILL.md (<500 lines):**

Create `.claude/skills/frontend-dev-guidelines/SKILL.md`:

```markdown
# Frontend Development Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29
**Applies To:** React 19, Next.js 15, Ant Design v5, TanStack Query/Router

## When This Skill Applies

This skill automatically activates when:
- Working in `frontend/src/**` directory
- Creating/modifying React components
- Implementing UI features
- Working with forms, tables, layouts
- Data fetching or state management

## Quick Reference

For detailed patterns, see resource files:
- `react-patterns.md` - React 19, hooks, Suspense, Error Boundaries
- `ant-design-standards.md` - Form patterns, components, theming
- `tanstack-patterns.md` - Query, Router, Table patterns
- `state-management.md` - Zustand, Context, when to use what
- `common-gotchas.md` - Bugs we've hit, solutions

## Critical Patterns (Brief)

### Component Structure
[Brief overview, point to react-patterns.md for details]

### Forms & Validation
[Brief overview, point to ant-design-standards.md for details]

### Data Fetching
[Brief overview, point to tanstack-patterns.md for details]

### State Management
[Brief overview, point to state-management.md for details]

## When to Use Agents

**Before large UI changes:**
→ Consider using @Plan agent for architectural planning

**When stuck:**
→ Use @expert agent for complex React/TypeScript issues

**After implementation:**
→ @code-reviewer will check patterns (orchestrator calls automatically)

## Common Gotchas

See `common-gotchas.md` for full list. Most common:
1. [Brief list of top 5 gotchas with one-line solutions]

## Testing

See TESTING_WORKFLOW.md for:
- Jest patterns
- React Testing Library
- Integration tests with Chrome DevTools MCP
```

**Resource Files:**

Create in `.claude/skills/frontend-dev-guidelines/resources/`:

1. **`react-patterns.md`** - Comprehensive React 19 patterns
   - Functional components structure
   - Hook usage (useState, useEffect, useCallback, useMemo)
   - Suspense boundaries
   - Error boundaries
   - Component composition patterns
   - Props typing with TypeScript
   - Children patterns

2. **`ant-design-standards.md`** - Ant Design v5 patterns
   - Form patterns (Form, Form.Item, validation)
   - Common components (Button, Modal, Drawer, Table)
   - Grid system (Row, Col)
   - Theming and customization
   - Message/Notification patterns
   - Icon usage

3. **`tanstack-patterns.md`** - TanStack ecosystem
   - **TanStack Query:**
     - useQuery patterns
     - useMutation patterns
     - Query invalidation
     - Optimistic updates
   - **TanStack Router:**
     - File-based routing structure
     - Route parameters
     - Navigation patterns
   - **TanStack Table/ag-Grid:**
     - Grid configuration
     - Column definitions
     - Cell renderers

4. **`state-management.md`** - State management decisions
   - When to use useState (local component state)
   - When to use Zustand (global app state)
   - When to use React Context (theme, auth)
   - When to use TanStack Query (server state)
   - Avoiding prop drilling

5. **`common-gotchas.md`** - Frontend bugs we've encountered
   - Extract from MASTER_BUG_INVENTORY.md (frontend bugs)
   - React 19 specific issues
   - Ant Design common mistakes
   - TypeScript type issues
   - Performance pitfalls

**Content Sources:**
- Current CLAUDE.md frontend sections
- `frontend/CLAUDE.md`
- MASTER_BUG_INVENTORY.md (frontend bugs)
- Your experience and documented issues

**Verification Checklist:**
- [ ] Main SKILL.md < 500 lines
- [ ] All 5 resource files created and comprehensive
- [ ] Covers all major frontend patterns
- [ ] Includes gotchas from past bugs
- [ ] References when to use agents

---

#### Task 2.2: Backend Dev Guidelines Skill (3 hours)

**Main SKILL.md (<500 lines):**

Create `.claude/skills/backend-dev-guidelines/SKILL.md`:

```markdown
# Backend Development Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29
**Applies To:** FastAPI, Supabase PostgreSQL, Python 3.11+

## When This Skill Applies

This skill automatically activates when:
- Working in `backend/**` directory
- Creating/modifying API endpoints
- Database operations
- Business logic implementation
- Security/RLS related work

## Quick Reference

For detailed patterns, see resource files:
- `fastapi-patterns.md` - Routes, dependencies, middleware
- `supabase-rls.md` - RLS policies, organization context, security
- `error-handling.md` - Try-catch, Sentry, error responses
- `testing-patterns.md` - pytest, fixtures, mocking
- `pydantic-validation.md` - Request/response models
- `common-gotchas.md` - Backend bugs, solutions

## Critical Patterns (Brief)

### API Structure
[Brief overview: Routes → Controllers → Services → Repositories]
[Point to fastapi-patterns.md for details]

### Security & RLS
[Brief overview of RLS patterns]
[Point to supabase-rls.md for details]

### Error Handling
[Brief overview of error handling]
[Point to error-handling.md for details]

### Database Operations
[Brief overview of Supabase client usage]
[Point to relevant resources]

## When to Use Agents

**For new API endpoints:**
→ Consider @Plan agent if route affects multiple files

**Security-sensitive code:**
→ @security-auditor will review (orchestrator calls automatically)

**When debugging:**
→ Use @expert agent for complex database/RLS issues

## Common Gotchas

See `common-gotchas.md` for full list. Most common:
1. [Brief list of top 5 backend gotchas with one-line solutions]

## Testing

See TESTING_WORKFLOW.md for:
- pytest patterns
- API testing with httpx
- Database fixtures
```

**Resource Files:**

Create in `.claude/skills/backend-dev-guidelines/resources/`:

1. **`fastapi-patterns.md`** - FastAPI best practices
   - Route structure (routers, prefixes)
   - Dependency injection patterns
   - Middleware usage
   - Request/response models
   - Path parameters, query parameters
   - File uploads
   - Background tasks

2. **`supabase-rls.md`** - Supabase and RLS patterns
   - RLS policy patterns
   - Organization context (`app.set_organization_id`)
   - Service role vs authenticated user
   - Multi-tenancy patterns
   - Security best practices
   - Common RLS pitfalls

3. **`error-handling.md`** - Error handling patterns
   - Try-except patterns
   - HTTPException usage
   - Sentry.captureException integration
   - Error response formats
   - Validation errors
   - Database errors

4. **`testing-patterns.md`** - Backend testing
   - pytest fixtures
   - API testing with httpx
   - Database test fixtures
   - Mocking Supabase client
   - Test organization
   - Markers and parametrization

5. **`pydantic-validation.md`** - Pydantic models
   - Request model patterns
   - Response model patterns
   - Validation rules
   - Custom validators
   - Optional vs required fields
   - Nested models

6. **`common-gotchas.md`** - Backend bugs encountered
   - Extract from MASTER_BUG_INVENTORY.md (backend bugs)
   - RLS policy mistakes
   - FastAPI common errors
   - Database query issues
   - Performance problems

**Content Sources:**
- Current CLAUDE.md backend sections
- `backend/CLAUDE.md`
- MASTER_BUG_INVENTORY.md (backend bugs)
- Calculation engine documentation
- Your experience

**Verification Checklist:**
- [ ] Main SKILL.md < 500 lines
- [ ] All 6 resource files created and comprehensive
- [ ] Covers all major backend patterns
- [ ] Security best practices included
- [ ] Includes gotchas from past bugs

---

#### Task 2.3: Database Verification Skill (30 min)

**Create:** `.claude/skills/database-verification/SKILL.md`

```markdown
# Database Verification Skill

**Version:** 1.0
**Last Updated:** 2025-10-29
**Type:** GUARDRAIL (blocks unsafe operations)
**Enforcement:** BLOCK

## Purpose

This skill BLOCKS database operations that violate our standards.
It prevents common database mistakes before they happen.

## When This Skill Applies

**Automatically activates for:**
- Creating/modifying migrations (`backend/migrations/**/*.sql`)
- Altering database schema
- Keywords: "migration", "alter table", "create table", "drop"

## Critical Rules (BLOCKING)

### 1. Column Naming Standards

**MUST:**
- Use snake_case for all column names
- Be descriptive (no abbreviations unless very common)
- Match existing naming patterns

**MUST NOT:**
- Use camelCase (JavaScript convention)
- Use PascalCase
- Use abbreviations that aren't clear

**Common Typos to Prevent:**
- `organizationId` → `organization_id` ✓
- `customerId` → `customer_id` ✓
- `createdAt` → `created_at` ✓

### 2. RLS Policies Required

**EVERY table MUST have:**
- `organization_id` column (for multi-tenancy)
- RLS enabled (`ALTER TABLE [table] ENABLE ROW LEVEL SECURITY`)
- SELECT policy checking `organization_id`
- INSERT policy checking `organization_id`
- UPDATE policy checking `organization_id`
- DELETE policy checking `organization_id`

**Example template in migration:**
```sql
-- Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "[table]_select_policy" ON [table_name]
FOR SELECT USING (organization_id = current_setting('app.organization_id')::uuid);

-- INSERT policy
CREATE POLICY "[table]_insert_policy" ON [table_name]
FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);

-- UPDATE policy
CREATE POLICY "[table]_update_policy" ON [table_name]
FOR UPDATE USING (organization_id = current_setting('app.organization_id')::uuid);

-- DELETE policy
CREATE POLICY "[table]_delete_policy" ON [table_name]
FOR DELETE USING (organization_id = current_setting('app.organization_id')::uuid);
```

### 3. Migration Standards

**MUST include:**
- Clear comments explaining what/why
- Rollback instructions (how to undo)
- Test data considerations (dev environment)

**MUST NOT:**
- Drop columns without data migration plan
- Change column types without considering existing data
- Remove constraints without understanding impact

### 4. Dangerous Operations

**REQUIRES explicit user approval:**
- DROP TABLE
- DROP COLUMN
- ALTER COLUMN TYPE (data loss risk)
- TRUNCATE
- Removing RLS policies

**Before proceeding, confirm:**
- [ ] Data migration plan exists
- [ ] Rollback plan exists
- [ ] User explicitly approved

## Common Mistakes Prevented

1. **Forgot RLS policies** → Skill reminds to add them
2. **camelCase column names** → Skill blocks and suggests snake_case
3. **Missing organization_id** → Skill blocks multi-tenant violation
4. **Dropping columns** → Skill requires confirmation + migration plan
5. **Typos in column names** → Skill checks against common typos

## Checklist Before Migration

- [ ] All column names are snake_case
- [ ] Table has `organization_id` column (if multi-tenant)
- [ ] RLS enabled
- [ ] All 4 RLS policies created (SELECT, INSERT, UPDATE, DELETE)
- [ ] Migration includes comments
- [ ] Rollback plan documented
- [ ] No dangerous operations without explicit approval

## When to Use Agents

**For complex migrations:**
→ Use @Plan agent to design migration strategy

**For RLS policy design:**
→ Use @security-auditor agent to review policies

**Database schema decisions:**
→ Use @expert agent for architectural guidance
```

**Verification Checklist:**
- [ ] Skill created with BLOCK enforcement
- [ ] All critical rules documented
- [ ] Common mistakes listed
- [ ] Examples provided
- [ ] Checklist included

---

### PHASE 3: Hooks System (Day 3-4, 4-6 hours) 🔴 CRITICAL

**Goal:** Build TypeScript hooks for automation

#### Task 3.1: Setup Hooks Infrastructure (1 hour)

**Create directory structure:**
```
.claude/hooks/
├── user-prompt-submit.ts              # Skill auto-activation
├── stop-event.ts                      # After Claude responds
├── post-tool-use.ts                   # After edits (if needed)
└── utils/
    ├── skill-matcher.ts               # Match prompts to skills
    ├── build-checker.ts               # Run builds, check errors
    └── file-tracker.ts                # Track edited files
```

**Actions:**
- Create hooks directory structure
- Setup TypeScript if not already configured
- Create utility modules (stubs initially)
- Test TypeScript compilation

**tsconfig.json for hooks:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Verification Checklist:**
- [ ] Hooks directory structure exists
- [ ] TypeScript compiles successfully
- [ ] Utility stubs created
- [ ] Can run hooks without errors

---

#### Task 3.2: User Prompt Submit Hook (2 hours)

**Purpose:** Auto-activate skills before Claude sees prompt

**Create:** `.claude/hooks/user-prompt-submit.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface SkillRule {
  type: string;
  enforcement: string;
  priority: string;
  description: string;
  promptTriggers: {
    keywords: string[];
    intentPatterns: string[];
  };
  fileTriggers: {
    pathPatterns: string[];
    contentPatterns: string[];
  };
}

interface SkillRules {
  [skillName: string]: SkillRule;
}

/**
 * Analyzes user prompt and activates relevant skills
 */
function analyzePrompt(prompt: string, currentFile: string | null): string[] {
  const activatedSkills: string[] = [];
  const skillRulesPath = path.join(__dirname, '../skills/skill-rules.json');

  if (!fs.existsSync(skillRulesPath)) {
    return activatedSkills;
  }

  const skillRules: SkillRules = JSON.parse(
    fs.readFileSync(skillRulesPath, 'utf-8')
  );

  const promptLower = prompt.toLowerCase();

  for (const [skillName, rule] of Object.entries(skillRules)) {
    let matchScore = 0;

    // Check keyword matches
    for (const keyword of rule.promptTriggers.keywords) {
      if (promptLower.includes(keyword.toLowerCase())) {
        matchScore += 1;
      }
    }

    // Check intent patterns
    for (const pattern of rule.promptTriggers.intentPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(prompt)) {
        matchScore += 2; // Intent patterns weighted higher
      }
    }

    // Check file triggers if currentFile provided
    if (currentFile) {
      for (const pathPattern of rule.fileTriggers.pathPatterns) {
        const regexPattern = pathPattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*');
        const regex = new RegExp(regexPattern);
        if (regex.test(currentFile)) {
          matchScore += 3; // File path matches weighted highest
        }
      }
    }

    // Activate if match score threshold met
    if (matchScore >= 2) {
      activatedSkills.push(skillName);
    }
  }

  return activatedSkills;
}

/**
 * Formats skill activation message
 */
function formatActivationMessage(skills: string[]): string {
  if (skills.length === 0) {
    return '';
  }

  const skillRulesPath = path.join(__dirname, '../skills/skill-rules.json');
  const skillRules: SkillRules = JSON.parse(
    fs.readFileSync(skillRulesPath, 'utf-8')
  );

  const lines = [
    '━'.repeat(50),
    '🎯 SKILL ACTIVATION CHECK',
    '━'.repeat(50),
    ''
  ];

  if (skills.length > 0) {
    lines.push('Suggested skills:');
    for (const skillName of skills) {
      const rule = skillRules[skillName];
      lines.push(`✓ ${skillName}`);
      lines.push(`  ${rule.description}`);
      lines.push(`  Load with: Use ${skillName} skill`);
      lines.push('');
    }
  }

  lines.push('━'.repeat(50));

  return lines.join('\n');
}

/**
 * Main hook entry point
 */
export function onUserPromptSubmit(prompt: string, context: any): string {
  // Get current file if available
  const currentFile = context?.currentFile || null;

  // Analyze and activate skills
  const activatedSkills = analyzePrompt(prompt, currentFile);

  // Format activation message
  const message = formatActivationMessage(activatedSkills);

  // Inject message before prompt (if skills activated)
  if (message) {
    return message + '\n\n' + prompt;
  }

  return prompt;
}
```

**Utility:** `.claude/hooks/utils/skill-matcher.ts`

```typescript
/**
 * Utility functions for matching prompts to skills
 */

export function extractKeywords(text: string): string[] {
  // Extract meaningful keywords from text
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'and', 'or', 'but']);
  return words.filter(word => !stopWords.has(word) && word.length > 3);
}

export function matchPattern(text: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(text);
  } catch (e) {
    return false;
  }
}

export function matchFilePath(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    const regex = new RegExp(regexPattern);
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}
```

**Verification Checklist:**
- [ ] Hook triggers before prompt processing
- [ ] Correctly matches keywords to skills
- [ ] Intent patterns work (regex matching)
- [ ] File path triggers work
- [ ] Injects clear activation message
- [ ] Doesn't break normal workflow
- [ ] Test with sample prompts

---

#### Task 3.3: Stop Event Hooks (3 hours)

**Create:** `.claude/hooks/stop-event.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface EditedFile {
  path: string;
  timestamp: string;
  repo: 'frontend' | 'backend' | 'root';
}

/**
 * Hook #1: Build Checker
 */
function checkBuilds(editedFiles: EditedFile[]): string {
  const repos = new Set(editedFiles.map(f => f.repo));
  const results: string[] = [];

  let frontendErrors = 0;
  let backendErrors = 0;

  // Check frontend build
  if (repos.has('frontend')) {
    try {
      execSync('cd frontend && npm run type-check', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });
      results.push('Frontend: 0 errors ✓');
    } catch (error: any) {
      const output = error.stdout || error.stderr || '';
      const errorMatches = output.match(/error TS\d+:/g);
      frontendErrors = errorMatches ? errorMatches.length : 0;

      if (frontendErrors < 5) {
        results.push(`Frontend: ${frontendErrors} errors ❌`);
        results.push(output.substring(0, 500)); // Show first 500 chars
      } else {
        results.push(`Frontend: ${frontendErrors} errors ❌❌❌`);
        results.push('Too many errors. Consider using @build-error-resolver agent');
      }
    }
  }

  // Check backend (Python type checking)
  if (repos.has('backend')) {
    try {
      execSync('cd backend && python -m py_compile **/*.py', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });
      results.push('Backend: 0 errors ✓');
    } catch (error: any) {
      const output = error.stdout || error.stderr || '';
      backendErrors = 1; // Python compile errors
      results.push(`Backend: Compilation errors ❌`);
      results.push(output.substring(0, 500));
    }
  }

  return formatBuildResults(results, frontendErrors + backendErrors);
}

/**
 * Hook #2: Prettier Formatter
 */
function runPrettier(editedFiles: EditedFile[]): string {
  const filePaths = editedFiles
    .filter(f => f.path.match(/\.(ts|tsx|js|jsx|json|css|md)$/))
    .map(f => f.path);

  if (filePaths.length === 0) {
    return '';
  }

  try {
    execSync(`npx prettier --write ${filePaths.join(' ')}`, {
      stdio: 'pipe'
    });
    return 'All files formatted with Prettier ✓';
  } catch (error) {
    return 'Prettier formatting failed (non-critical)';
  }
}

/**
 * Hook #3: Error Handling Reminder
 */
function checkErrorHandling(editedFiles: EditedFile[]): string {
  const riskyPatterns = [
    { pattern: /try\s*{/, name: 'try-catch blocks' },
    { pattern: /async\s+(?:function|def)/, name: 'async functions' },
    { pattern: /\.query\(|\.execute\(/, name: 'database operations' },
    { pattern: /@router\.|@app\./, name: 'API endpoints' }
  ];

  const riskyFiles: { file: string; patterns: string[] }[] = [];

  for (const file of editedFiles) {
    if (!fs.existsSync(file.path)) continue;

    const content = fs.readFileSync(file.path, 'utf-8');
    const foundPatterns: string[] = [];

    for (const { pattern, name } of riskyPatterns) {
      if (pattern.test(content)) {
        foundPatterns.push(name);
      }
    }

    if (foundPatterns.length > 0) {
      riskyFiles.push({ file: file.path, patterns: foundPatterns });
    }
  }

  if (riskyFiles.length === 0) {
    return '';
  }

  return formatErrorReminder(riskyFiles);
}

/**
 * Format build results
 */
function formatBuildResults(results: string[], totalErrors: number): string {
  const lines = [
    '━'.repeat(50),
    totalErrors === 0 ? '✅ BUILD CHECK COMPLETE' : '⚠️  BUILD ERRORS FOUND',
    '━'.repeat(50),
    '',
    ...results,
    '',
    '━'.repeat(50)
  ];

  return lines.join('\n');
}

/**
 * Format error handling reminder
 */
function formatErrorReminder(riskyFiles: { file: string; patterns: string[] }[]): string {
  const lines = [
    '━'.repeat(50),
    '📋 ERROR HANDLING SELF-CHECK',
    '━'.repeat(50),
    '',
    `⚠️  ${riskyFiles.length} file(s) with potentially risky code:`,
    ''
  ];

  for (const { file, patterns } of riskyFiles) {
    lines.push(`   ${path.basename(file)}`);
    lines.push(`   Found: ${patterns.join(', ')}`);
    lines.push('');
  }

  lines.push('   ❓ Did you add proper error handling?');
  lines.push('   ❓ Are exceptions captured to Sentry?');
  lines.push('   ❓ Are edge cases handled?');
  lines.push('');
  lines.push('   💡 Best Practice:');
  lines.push('      - All errors should be captured');
  lines.push('      - User-facing errors should be clear');
  lines.push('      - Critical errors logged to Sentry');
  lines.push('');
  lines.push('━'.repeat(50));

  return lines.join('\n');
}

/**
 * Read edited files log
 */
function getEditedFiles(): EditedFile[] {
  const logPath = path.join(__dirname, '../.edited-files.json');

  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Clear edited files log
 */
function clearEditedFiles(): void {
  const logPath = path.join(__dirname, '../.edited-files.json');
  fs.writeFileSync(logPath, JSON.stringify([]), 'utf-8');
}

/**
 * Main hook entry point
 */
export function onStopEvent(): string {
  const editedFiles = getEditedFiles();

  if (editedFiles.length === 0) {
    return ''; // No files edited, skip hooks
  }

  const results: string[] = [];

  // Run Prettier
  const prettierResult = runPrettier(editedFiles);

  // Check builds
  const buildResult = checkBuilds(editedFiles);
  results.push(buildResult);

  if (prettierResult) {
    results.push(prettierResult);
  }

  // Check error handling
  const errorReminder = checkErrorHandling(editedFiles);
  if (errorReminder) {
    results.push(errorReminder);
  }

  // Clear log for next round
  clearEditedFiles();

  return results.join('\n\n');
}
```

**Utility:** `.claude/hooks/utils/file-tracker.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

export interface EditedFile {
  path: string;
  timestamp: string;
  repo: 'frontend' | 'backend' | 'root';
}

/**
 * Track edited file
 */
export function trackEdit(filePath: string): void {
  const logPath = path.join(__dirname, '../../.edited-files.json');

  let files: EditedFile[] = [];
  if (fs.existsSync(logPath)) {
    try {
      files = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    } catch {
      files = [];
    }
  }

  // Determine repo
  let repo: 'frontend' | 'backend' | 'root' = 'root';
  if (filePath.startsWith('frontend/')) {
    repo = 'frontend';
  } else if (filePath.startsWith('backend/')) {
    repo = 'backend';
  }

  // Add to list (avoid duplicates)
  if (!files.find(f => f.path === filePath)) {
    files.push({
      path: filePath,
      timestamp: new Date().toISOString(),
      repo
    });
  }

  fs.writeFileSync(logPath, JSON.stringify(files, null, 2), 'utf-8');
}
```

**Utility:** `.claude/hooks/utils/build-checker.ts`

```typescript
import { execSync } from 'child_process';

export interface BuildResult {
  success: boolean;
  errorCount: number;
  output: string;
}

/**
 * Run TypeScript check on frontend
 */
export function checkFrontend(): BuildResult {
  try {
    const output = execSync('cd frontend && npm run type-check', {
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    return {
      success: true,
      errorCount: 0,
      output
    };
  } catch (error: any) {
    const output = error.stdout || error.stderr || '';
    const errorMatches = output.match(/error TS\d+:/g);
    const errorCount = errorMatches ? errorMatches.length : 0;

    return {
      success: false,
      errorCount,
      output
    };
  }
}

/**
 * Run Python compilation check on backend
 */
export function checkBackend(): BuildResult {
  try {
    const output = execSync('cd backend && python -m compileall -q .', {
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    return {
      success: true,
      errorCount: 0,
      output
    };
  } catch (error: any) {
    const output = error.stdout || error.stderr || '';

    return {
      success: false,
      errorCount: 1,
      output
    };
  }
}
```

**Verification Checklist:**
- [ ] Build checker catches TypeScript errors immediately
- [ ] Prettier formats all edited files
- [ ] Error reminders show for risky patterns
- [ ] File tracking works correctly
- [ ] Doesn't slow down workflow significantly
- [ ] Output is clear and actionable

---

### PHASE 4: Orchestrator Workflow Fix (Day 4, 2-3 hours) 🔴 CRITICAL

**Goal:** Make orchestrator auto-invoke agents without reminding

#### Task 4.1: Update Orchestrator Agent (1.5 hours)

**Edit:** `.claude/agents/orchestrator.md`

**Add new section at the beginning:**

```markdown
## Autonomous Agent Invocation

**CRITICAL: You MUST automatically invoke other agents without waiting for user to remind you.**

This is your PRIMARY responsibility as orchestrator - coordinating other agents autonomously.

### Decision Tree

**When user makes a request:**

1. **Analyze Complexity**

   Simple task (< 10 min, single file)?
   → Implement directly

   Complex task (> 30 min, multiple files, architectural)?
   → AUTO-INVOKE @Plan agent IMMEDIATELY

2. **Research Needed?**

   User asks "where is...", "how does...", "find..."?
   → AUTO-INVOKE @Explore agent IMMEDIATELY

   Need to understand codebase before implementing?
   → AUTO-INVOKE @Explore agent FIRST, then implement

3. **Implement**

   Simple frontend feature?
   → Can implement directly OR @frontend-dev agent if complex

   Simple backend feature?
   → Can implement directly OR @backend-dev agent if complex

4. **After Feature Complete (MANDATORY)**

   **ALWAYS run quality trio in PARALLEL:**
   ```
   @qa-tester + @security-auditor + @code-reviewer (parallel Task tool calls)
   ```

   Do NOT skip this step. User should not have to ask.

5. **Fix Issues Found**

   Minor issues (formatting, comments)?
   → Fix automatically

   Critical issues (security, bugs)?
   → Report to user, get approval, then fix

6. **Struggling or Errors?**

   Same error 3+ times?
   → AUTO-INVOKE @expert agent

   Complex debugging needed?
   → AUTO-INVOKE @expert agent

   Performance issues or architecture decisions?
   → AUTO-INVOKE @expert agent

### Specific Scenarios

**Scenario: User requests new feature**
```
❌ WRONG:
User: "Add user profile page"
You: Implement directly without planning

✅ CORRECT:
User: "Add user profile page"
You: [AUTO-INVOKE @Plan agent]
Plan agent: [Returns detailed plan]
You: Present plan to user for approval
User: Approved
You: [Implement according to plan]
You: [AUTO-INVOKE quality trio in parallel]
```

**Scenario: User asks "where is..."**
```
❌ WRONG:
User: "Where is the auth logic?"
You: Try to guess or search manually

✅ CORRECT:
User: "Where is the auth logic?"
You: [AUTO-INVOKE @Explore agent with prompt: "Find auth logic"]
Explore agent: [Returns file locations]
You: Report findings to user
```

**Scenario: Feature complete**
```
❌ WRONG:
You: Feature implemented! [Stops here]

✅ CORRECT:
You: Feature implemented!
You: [AUTO-INVOKE @qa-tester + @security-auditor + @code-reviewer in PARALLEL]
Agents: [Return their findings]
You: Fix any critical issues found
You: Report results to user
```

**Scenario: Struggling with bug**
```
❌ WRONG:
[Try same approach 5 times, keep failing]

✅ CORRECT:
[Try approach 3 times]
You: This approach isn't working. [AUTO-INVOKE @expert agent]
Expert: [Provides solution with deeper analysis]
You: Implement expert's solution
```

### Why You Keep Forgetting

Common reasons orchestrators forget to invoke agents:
1. **Tunnel vision** - Too focused on implementation
2. **Overconfidence** - "I can handle this myself"
3. **Forgetting the workflow** - Not checking your own instructions

**Solution:**
Before responding to ANY user request:
1. ✅ Check: "Is this complex?" → @Plan
2. ✅ Check: "Do I need to find something?" → @Explore
3. ✅ Check: "Did I finish a feature?" → Quality trio
4. ✅ Check: "Am I struggling?" → @Expert

### User Should NEVER Have To:
- ❌ Remind you to use @Plan
- ❌ Remind you to use @Explore
- ❌ Remind you to run quality checks
- ❌ Remind you about other agents
- ❌ Ask "did you test this?"

### Success Criteria

**You're doing it right when:**
- ✅ User never mentions agent names
- ✅ Quality trio runs automatically every feature
- ✅ Plans created for all complex tasks
- ✅ Research done before implementation
- ✅ Expert invoked when stuck

**You're doing it wrong when:**
- ❌ User asks "did you use @Plan?"
- ❌ User asks "can you run tests?"
- ❌ User asks "did you check security?"
- ❌ Features complete without quality checks
```

**Verification Checklist:**
- [ ] Orchestrator prompt updated with autonomous workflow
- [ ] Clear decision tree included
- [ ] Specific scenarios with examples
- [ ] Success criteria defined
- [ ] Test orchestrator invokes agents automatically

---

#### Task 4.2: Add Agent Reminders to Skills (1 hour)

**Edit:** `.claude/skills/frontend-dev-guidelines/SKILL.md`

**Add section:**

```markdown
## Agent Orchestration Reminders

**These reminders are for Claude's orchestrator - not for you to manually invoke.**

### When Orchestrator Should Use Agents (Auto)

**Before Large UI Changes:**
- Multi-page features
- Complex state management
- New routing structure
→ Orchestrator should AUTO-INVOKE @Plan agent

**When Frontend Implementation Needed:**
- Complex React patterns
- Multiple components
- Integration with backend
→ Orchestrator may invoke @frontend-dev agent (or implement directly if simple)

**After Any Frontend Feature:**
- Always run quality checks
→ Orchestrator MUST AUTO-INVOKE @code-reviewer + @ux-reviewer (parallel)

**When Stuck on Frontend Issues:**
- React/TypeScript errors persisting
- Performance problems
- Complex state management bugs
→ Orchestrator should AUTO-INVOKE @expert agent

### User Shouldn't Need To Ask

If user says:
- "Did you test this?" ❌ Orchestrator should have run @qa-tester automatically
- "Is the UI consistent?" ❌ Orchestrator should have run @ux-reviewer automatically
- "Did you review the code?" ❌ Orchestrator should have run @code-reviewer automatically

**Solution:** Orchestrator must invoke quality checks automatically after every feature.
```

**Edit:** `.claude/skills/backend-dev-guidelines/SKILL.md`

**Add section:**

```markdown
## Agent Orchestration Reminders

**These reminders are for Claude's orchestrator - not for you to manually invoke.**

### When Orchestrator Should Use Agents (Auto)

**Before New API Endpoints:**
- Multiple endpoints
- Database schema changes
- Complex business logic
→ Orchestrator should AUTO-INVOKE @Plan agent

**When Backend Implementation Needed:**
- Complex FastAPI patterns
- Multiple services
- RLS policy changes
→ Orchestrator may invoke @backend-dev agent (or implement directly if simple)

**After Any Backend Feature:**
- Always run quality checks
→ Orchestrator MUST AUTO-INVOKE @qa-tester + @security-auditor + @code-reviewer (parallel)

**Security-Sensitive Code:**
- RLS policies
- Authentication
- Authorization
- Data validation
→ Orchestrator MUST invoke @security-auditor

**When Stuck on Backend Issues:**
- Database/RLS errors
- FastAPI/Pydantic issues
- Performance problems
→ Orchestrator should AUTO-INVOKE @expert agent

### User Shouldn't Need To Ask

If user says:
- "Did you test the API?" ❌ Orchestrator should have run @qa-tester automatically
- "Is this secure?" ❌ Orchestrator should have run @security-auditor automatically
- "Did you check RLS?" ❌ Orchestrator should have run @security-auditor automatically

**Solution:** Orchestrator must invoke quality checks automatically after every feature.
```

**Verification Checklist:**
- [ ] Both skills updated with agent reminders
- [ ] Clear guidance on when orchestrator should invoke
- [ ] Emphasis on automatic invocation
- [ ] User expectations set (shouldn't need to ask)

---

### PHASE 5: Slash Commands (Day 5, 3-4 hours) 🟡 HIGH VALUE

**Goal:** Create reusable command workflows

#### Task 5.1: Create Commands Directory (30 min)

**Create:**
```
.claude/commands/
├── dev-docs-create.md
├── dev-docs-update.md
├── code-review.md
├── build-and-fix.md
├── test-quote-creation.md
└── archive-cleanup.md
```

**Note:** Slash commands are markdown files that expand into full prompts.

**Verification Checklist:**
- [ ] Commands directory exists
- [ ] Ready to create command files

---

#### Task 5.2: Essential Commands Implementation (2.5 hours)

**Create:** `.claude/commands/dev-docs-create.md`

```markdown
---
name: dev-docs-create
description: Create dev docs from approved plan
---

# Create Dev Docs

You have just completed planning and the user approved the plan.

## Task

Create development documentation files to preserve context across sessions.

## Steps

1. **Determine task name** from the plan:
   - Use kebab-case (e.g., "add-user-profile", "fix-quote-validation")
   - Keep it short but descriptive

2. **Create directory:**
   ```bash
   mkdir -p ~/git/quotation-app-dev/dev/active/[task-name]/
   ```

3. **Generate three files from the approved plan:**

### File 1: [task]-plan.md

Use template from `~/git/quotation-app-dev/dev/templates/template-plan.md`

Include:
- Full approved plan
- Overview of what we're building
- Phases and tasks
- Dependencies
- Risks
- Success criteria
- Time estimate

### File 2: [task]-context.md

Use template from `~/git/quotation-app-dev/dev/templates/template-context.md`

Include:
- Key files that will be modified
- Important architectural decisions
- Current state of implementation
- Next steps
- Any blockers

### File 3: [task]-tasks.md

Use template from `~/git/quotation-app-dev/dev/templates/template-tasks.md`

Include:
- Task checklist organized by phase
- Each task as `- [ ] Task description`
- Mark any already completed tasks as `- [x]`

## Verification

After creating files:
1. Confirm all three files exist
2. Show brief summary of what was created
3. Remind user that files will preserve context across compactions

## Example Output

```
✅ Dev docs created for: add-user-profile

📁 Location: ~/git/quotation-app-dev/dev/active/add-user-profile/

Files created:
- add-user-profile-plan.md (full implementation plan)
- add-user-profile-context.md (key files and decisions)
- add-user-profile-tasks.md (15 tasks to complete)

These files will preserve context across auto-compactions.
Just say "continue" in new session.
```
```

---

**Create:** `.claude/commands/dev-docs-update.md`

```markdown
---
name: dev-docs-update
description: Update dev docs before compaction
---

# Update Dev Docs Before Compaction

We're approaching 85%+ context usage. Update dev docs before auto-compaction.

## Task

Update development documentation to preserve recent progress and context.

## Steps

1. **Find current task:**
   ```bash
   ls ~/git/quotation-app-dev/dev/active/
   ```

   Identify the active task directory (most recently modified).

2. **Update [task]-context.md:**

   Add to the "Important Decisions" section:
   - Any new architectural decisions made
   - New patterns or approaches discovered
   - Important files or functions added

   Update "Next Steps" section:
   - What to do when resuming
   - Where we left off
   - Current implementation state

   Add to "Blockers" section (if any):
   - Any issues encountered
   - Dependencies waiting on
   - Questions for user

3. **Update [task]-tasks.md:**

   - Mark completed tasks with `[x]`
   - Add any newly discovered tasks with `[ ]`
   - Reorder if priorities changed
   - Update "Last Updated" timestamp

4. **Update timestamp in both files:**
   ```markdown
   **Last Updated:** [Current Date and Time]
   ```

## Verification

After updating:
1. Show summary of what was updated
2. Confirm both files saved successfully
3. Remind user they can just say "continue" in new session

## Example Output

```
✅ Dev docs updated for: add-user-profile

📝 Updates:
- context.md: Added 3 new decisions, updated next steps
- tasks.md: Marked 5 tasks complete, added 2 new tasks

Status: 8/15 tasks complete (53%)

Ready for compaction. Say "continue" to resume in new session.
```
```

---

**Create:** `.claude/commands/code-review.md`

```markdown
---
name: code-review
description: Request architectural code review
---

# Architectural Code Review

Invoke @code-reviewer agent to review recent changes.

## Task

Request comprehensive code review of recently modified code.

## Steps

1. **Identify scope:**
   - If user specified files/features, review those
   - Otherwise, review all changes since last commit
   - Run: `git diff --name-only` to see changed files

2. **Invoke @code-reviewer agent:**

   Use Task tool with code-reviewer subagent.

   **Prompt for agent:**
   ```
   Review the following changes for:

   1. Pattern Consistency:
      - Do changes follow patterns in skills?
      - Are frontend-dev-guidelines followed?
      - Are backend-dev-guidelines followed?

   2. Best Practices:
      - Proper error handling?
      - Type safety (TypeScript/Pydantic)?
      - Security considerations?

   3. Potential Issues:
      - Bugs or edge cases?
      - Performance concerns?
      - Maintainability issues?

   4. Code Quality:
      - Clear naming?
      - Proper comments?
      - DRY principle followed?

   Changed files:
   [List of files]

   Provide findings in prioritized list:
   - 🔴 Critical (must fix)
   - 🟡 High (should fix)
   - 🟢 Low (nice to have)
   ```

3. **Present findings:**
   - Show agent's findings organized by priority
   - For each issue, show file and line number
   - Suggest fixes for critical issues

4. **Offer to fix:**
   - Ask user if they want critical issues fixed now
   - If yes, fix them
   - If no, create checklist for later

## Example Output

```
@code-reviewer findings:

🔴 Critical Issues (2):
1. Missing error handling in quotes_calc.py:145
   - Risk: Unhandled exception could crash server
   - Fix: Add try-catch with Sentry capture

2. RLS policy missing in new table
   - Risk: Security vulnerability, data leak
   - Fix: Add organization_id filter to policy

🟡 High Priority (3):
[...]

🟢 Low Priority (5):
[...]

Would you like me to fix the critical issues now?
```
```

---

**Create:** `.claude/commands/build-and-fix.md`

```markdown
---
name: build-and-fix
description: Run builds and fix all errors
---

# Build and Fix All Errors

Run build checks on frontend and backend, then fix any errors found.

## Task

Ensure zero errors in codebase by running builds and fixing issues.

## Steps

1. **Run Frontend Build:**
   ```bash
   cd frontend && npm run type-check
   ```

   Capture output and count errors.

2. **Run Backend Check:**
   ```bash
   cd backend && python -m compileall -q .
   ```

   Capture output and check for errors.

3. **Analyze Results:**

   **If < 5 total errors:**
   - Show errors to user
   - Analyze each error
   - Fix errors one by one
   - Re-run builds to verify

   **If >= 5 errors:**
   - Show error count
   - Recommend invoking @build-error-resolver agent
   - Ask user for approval
   - If approved, invoke agent with all error output

4. **Verify Zero Errors:**
   - Re-run both builds
   - Confirm zero errors
   - Report success

## Example Output (Few Errors)

```
🔍 Build Check Results:

Frontend: 3 errors ❌
Backend: 0 errors ✓

Fixing frontend errors:

Error 1: Type 'string | undefined' not assignable to type 'string'
  File: frontend/src/app/quotes/create/page.tsx:145
  Fix: Add null check before usage
  [Applies fix]

Error 2: [...]
  [Applies fix]

Error 3: [...]
  [Applies fix]

Re-running builds...

✅ Frontend: 0 errors ✓
✅ Backend: 0 errors ✓

All errors fixed!
```

## Example Output (Many Errors)

```
🔍 Build Check Results:

Frontend: 12 errors ❌
Backend: 3 errors ❌
Total: 15 errors

Too many errors for manual fixing.

Recommendation: Invoke @build-error-resolver agent
The agent will systematically fix all errors.

Would you like me to invoke the agent now?
```
```

---

**Create:** `.claude/commands/archive-cleanup.md`

```markdown
---
name: archive-cleanup
description: Review and archive old documentation
---

# Review and Archive Old Documentation

Review `.claude/` directory for outdated files and propose archiving.

## Task

Identify outdated documentation and move to appropriate archive directories.

## Steps

1. **Scan for candidates:**
   ```bash
   find .claude -name "*.md" -type f | grep -v archive | grep -v agents | grep -v skills
   ```

   List files with last modified dates:
   ```bash
   ls -lt .claude/*.md | head -20
   ```

2. **Identify archiving candidates:**

   Look for:
   - **Session notes** > 2 weeks old
   - **Feature plans** marked as complete
   - **Bug tracking files** for resolved bugs
   - **Audit reports** > 1 month old
   - **Outdated guides** superseded by new docs

   Criteria:
   - ✅ Archive if: Complete, outdated, or superseded
   - ❌ Keep if: Active tracking, current session, reference doc

3. **Propose archiving plan:**

   For each candidate, show:
   - File name
   - Last modified date
   - Why it should be archived
   - Proposed archive location

   Organize by type:
   - Session notes → `.claude/archive/sessions/`
   - Feature plans → `.claude/archive/features/`
   - Bug tracking → `.claude/archive/bugs_and_plans/`
   - Audits → `.claude/archive/audits/`
   - Guides → `.claude/archive/guides/`

4. **Wait for user approval:**

   Present plan and ask:
   ```
   Archive plan ready. Total: X files

   Proceed with archiving? (yes/no)
   ```

5. **If approved, execute archiving:**

   For each file:
   - Move to appropriate archive directory using `git mv`
   - Update archive README.md with context
   - Add note about why archived and date

6. **Report results:**
   ```
   ✅ Archived X files

   Breakdown:
   - 3 session notes → archive/sessions/
   - 2 feature plans → archive/features/
   - 1 audit report → archive/audits/

   Archive READMEs updated with context.
   ```

## Example Output

```
📁 Archive Cleanup - Candidates Found

Session Notes (> 2 weeks old):
- SESSION_20_SUMMARY.md (modified: 2025-10-01)
  → archive/sessions/ (Session 20 work complete)

- SESSION_21_NOTES.md (modified: 2025-10-05)
  → archive/sessions/ (Session 21 work complete)

Feature Plans (complete):
- PLAN_USER_PROFILE.md (modified: 2025-10-12)
  → archive/features/ (Feature implemented and verified)

Bug Tracking (resolved):
- BUG_FIX_SESSION_18.md (modified: 2025-09-28)
  → archive/bugs_and_plans/ (All bugs resolved)

Total: 4 files to archive

Proceed with archiving? (yes/no)
```
```

---

**Verification Checklist:**
- [ ] All 5 commands created
- [ ] Commands have proper frontmatter (name, description)
- [ ] Commands expand to full prompts when invoked
- [ ] Commands are clear and actionable
- [ ] Test each command works correctly

---

### PHASE 6: Process Improvements (Day 5-6, 3-4 hours) 🟡 QUALITY OF LIFE

**Goal:** Systematize workflows and improve quality

#### Task 6.1: Implement Chunk Review Process (1 hour)

**Add to CLAUDE.md:**

```markdown
## Implementation in Chunks

**For all large features (> 30 min work), implement in small chunks with reviews between.**

### Why Chunks Matter

- ✅ Catch mistakes early (easier to fix)
- ✅ Adjust approach if needed
- ✅ Prevent going down wrong path
- ✅ Less wasted time on corrections
- ❌ DON'T implement entire feature then discover fundamental issue

### Chunk Size Guidelines

**Small chunks (10-20 min each):**
- 1-2 files at a time
- Single logical unit (one component, one endpoint, one service)
- Complete enough to review meaningfully

**Example for "Add User Profile Page":**

Chunk 1: Basic profile page component (10 min)
→ User reviews component structure

Chunk 2: Profile form with validation (15 min)
→ User reviews form fields and validation

Chunk 3: API endpoint for profile data (15 min)
→ User reviews endpoint logic

Chunk 4: Integration + error handling (15 min)
→ User reviews complete flow

Total: 55 min, but reviewed 4 times throughout

### Process

**Step 1: Implement Chunk**
- Work on 1-2 sections from plan
- Complete the logical unit
- Test basic functionality

**Step 2: Self-Check**
- Does it follow skills patterns?
- Any obvious issues?
- Ready for user review?

**Step 3: Present to User**
```
Chunk X complete: [Brief description]

Changes:
- File 1: [What changed]
- File 2: [What changed]

Next chunk: [What's next]

Ready to review, or should I continue?
```

**Step 4: User Reviews**
- User checks code quality
- User tests functionality
- User gives feedback or approval

**Step 5: Adjust if Needed**
- Fix any issues found
- Adjust approach for next chunks

**Step 6: Continue or Code Review**
- If 2-3 chunks done, consider `/code-review` command
- Otherwise, continue to next chunk

### Code Review Checkpoints

**When to run code review:**
- After every 2-3 chunks
- Before starting new major section
- If feeling uncertain about approach
- User requests it

**How:**
```
/code-review
```

or

```
I've completed 3 chunks. Should I invoke @code-reviewer
before continuing to next section?
```

### Updating Dev Docs During Chunks

**After each chunk:**
- Update `[task]-tasks.md` with completed items
- Add any newly discovered tasks
- Note important decisions in `[task]-context.md`

**Don't wait until end** - Update as you go!

### What Chunks Are NOT

❌ NOT: "I'll implement 10% of every file"
❌ NOT: "I'll write all the code then split commits"
❌ NOT: "I'll do half-working incomplete code"

✅ CHUNKS: Complete logical units that could be reviewed independently

### Example Interaction

```
User: Add customer validation to quote creation

Claude: I'll implement this in 3 chunks:

Chunk 1: Add validation rules to form (10 min)
Chunk 2: Add backend validation endpoint (15 min)
Chunk 3: Connect + error handling (10 min)

Starting Chunk 1: Adding validation rules to form...

[Implements]

✅ Chunk 1 complete: Form validation rules added

Changes:
- frontend/src/app/quotes/create/page.tsx
  - Added required rules to customer fields
  - Added format validation for INN

Next: Chunk 2 - Backend validation endpoint

Ready to review, or continue to Chunk 2?
```
```

**Verification Checklist:**
- [ ] Process documented in CLAUDE.md
- [ ] Clear guidance on chunk size
- [ ] Review checkpoints defined
- [ ] Examples provided
- [ ] Integration with dev docs system

---

#### Task 6.2: Auto-Documentation Workflow (1 hour)

**Add to `.claude/agents/orchestrator.md`:**

```markdown
## Auto-Documentation

**After implementing ANY feature, you MUST update documentation automatically.**

User should never have to ask "did you document this?"

### When to Document

**Always document:**
- ✅ After completing any feature
- ✅ After discovering new patterns
- ✅ When installing new dependencies
- ✅ After making architectural decisions

### What to Document

**1. Update CLAUDE.md (if needed):**

Check if any of these apply:
- New packages installed? → Add to "Installed Tools" section
- New workflow discovered? → Add to appropriate section
- New quick command? → Add to commands section
- Project structure changed? → Update structure overview

If yes to any:
```
I've completed [feature]. This required installing [package]
which should be documented.

Updating CLAUDE.md "Installed Tools" section...
```

**2. Update SESSION_PROGRESS.md:**

Always update after completing feature:
```markdown
### [Feature Name]

**Status:** [~] Awaiting user verification
**Files Changed:** [List key files]
**What Changed:** [Brief summary]
**Testing:** [What was tested]

**Verification Needed:**
- [ ] User tests [specific functionality]
- [ ] User verifies [expected behavior]
```

Mark as `[~]` awaiting verification, NOT `[x]` complete.
Only user can mark `[x]` after they verify it works.

**3. Check if Skills Need Updating:**

Ask yourself:
- Did I discover a new frontend pattern? → Update frontend-dev-guidelines
- Did I discover a new backend pattern? → Update backend-dev-guidelines
- Did I hit a gotcha/bug? → Add to common-gotchas.md

If yes:
```
During implementation, I discovered [pattern/gotcha].

This should be added to [skill-name] skill for future reference.

Updating skill...
```

**4. Update Dev Docs (for large tasks):**

If working on task with dev docs:
- Update `[task]-tasks.md` with completed items
- Update `[task]-context.md` with decisions
- Update "Last Updated" timestamps

If dev docs don't exist but should (> 30 min work):
```
This task is large enough to warrant dev docs.

Should I create dev docs for: [task-name]?
```

### Documentation Checklist

Before marking feature complete, verify:

- [ ] CLAUDE.md updated (if needed)
- [ ] SESSION_PROGRESS.md updated (always)
- [ ] Skills updated (if new patterns/gotchas)
- [ ] Dev docs updated (if large task)
- [ ] User notified what needs verification

### Example Auto-Documentation

```
✅ Feature complete: Customer validation added

📝 Auto-documentation:

1. Updated SESSION_PROGRESS.md:
   - Added feature summary
   - Marked [~] awaiting verification
   - Listed 3 files changed

2. Updated backend-dev-guidelines skill:
   - Added INN validation pattern to common-gotchas.md
   - This pattern can prevent future bugs

3. No CLAUDE.md updates needed (no new dependencies)

4. Dev docs updated:
   - Marked 3 tasks complete in tasks.md
   - Added validation decision to context.md

Ready for user verification:
- Test customer creation with invalid INN
- Verify error messages are clear
- Check validation on both frontend and backend
```

### What User Should Never Say

If user says any of these, you failed to auto-document:

❌ "Did you update the docs?"
❌ "Is this in SESSION_PROGRESS?"
❌ "Did you document this pattern?"
❌ "What changed?"

**Prevention:** Always document automatically, without being asked.
```

**Verification Checklist:**
- [ ] Auto-documentation workflow added to orchestrator
- [ ] Clear triggers for when to document
- [ ] Checklist provided
- [ ] Examples included
- [ ] Integrated into workflow

---

#### Task 6.3: Archive Cleanup Process (1 hour)

**Create:** `.claude/ARCHIVE_PROCESS.md`

```markdown
# Archive Process

**Purpose:** Keep `.claude/` directory clean by archiving completed/outdated documentation.

**Frequency:** Monthly (or every 50 commits, or when directory feels cluttered)

---

## When to Archive

### Session Notes
- ✅ Archive if: > 2 weeks old AND session complete
- ❌ Keep if: Current session or awaiting verification

### Feature Plans
- ✅ Archive if: Feature complete and verified
- ✅ Archive if: Moved to `dev/completed/`
- ❌ Keep if: In `dev/active/` (still working on it)

### Bug Tracking
- ✅ Archive if: All bugs resolved and verified
- ✅ Archive if: Superseded by newer bug tracking file
- ❌ Keep if: MASTER_BUG_INVENTORY.md (active tracking)
- ❌ Keep if: ACTION_PLAN_BUG_FIXES.md (active plan)

### Audit Reports
- ✅ Archive if: > 1 month old AND findings integrated into code
- ✅ Archive if: Superseded by newer audit
- ❌ Keep if: Recent (< 1 month) and still relevant

### Guides & Documentation
- ✅ Archive if: Superseded by newer guide
- ✅ Archive if: No longer applicable to current setup
- ❌ Keep if: Active reference (TESTING_WORKFLOW.md, VARIABLES.md, etc.)

---

## How to Archive

### Step 1: Run Archive Cleanup Command

```
/archive-cleanup
```

This will:
1. Scan `.claude/` for archiving candidates
2. Propose archiving plan organized by type
3. Wait for your approval
4. Execute archiving with proper organization

### Step 2: Review Proposal

Check each file:
- Does the reason for archiving make sense?
- Is the archive location appropriate?
- Should this actually be kept active?

Approve or adjust as needed.

### Step 3: Verify Archive Organization

After archiving, check:
```
.claude/archive/
├── sessions/           # Old session notes
├── features/           # Completed feature plans
├── bugs_and_plans/     # Resolved bug tracking
├── audits/            # Historical audits
├── setup/             # Initial setup docs
└── guides/            # Superseded guides
```

Each subdirectory should have README.md explaining what's archived and why.

### Step 4: Update Archive READMEs

For each archived file, update the archive directory's README.md:

```markdown
## Recently Archived

**[Date]:**
- [filename] - [Why archived] - [When created]

Example:
**2025-10-29:**
- SESSION_33_SUMMARY.md - Session complete, work verified - Created 2025-10-28
- PLAN_USER_PROFILE.md - Feature implemented and deployed - Created 2025-10-15
```

---

## Archive Directory Structure

### `.claude/archive/sessions/`
**What:** Session notes, summaries, and temporary working docs
**When:** > 2 weeks old AND session complete
**README:** List all archived sessions with dates

### `.claude/archive/features/`
**What:** Completed feature plans from `dev/completed/`
**When:** Feature fully implemented and verified
**README:** List features with implementation dates

### `.claude/archive/bugs_and_plans/`
**What:** Resolved bug tracking files, old bug lists
**When:** All bugs resolved OR superseded by newer tracking
**README:** List archived bug documents with resolution dates

### `.claude/archive/audits/`
**What:** Performance audits, security audits, code reviews
**When:** > 1 month old AND findings integrated
**README:** List audits with dates and key findings summary

### `.claude/archive/setup/`
**What:** Initial setup guides, installation docs
**When:** Setup complete, no longer needed for daily work
**README:** List setup docs with completion dates

### `.claude/archive/guides/`
**What:** Superseded guides, outdated documentation
**When:** Replaced by newer/better documentation
**README:** List guides with what replaced them

---

## What to Keep Active

**Always keep these:**
- ✅ CLAUDE.md (root project instructions)
- ✅ SESSION_PROGRESS.md (current session tracking)
- ✅ MASTER_BUG_INVENTORY.md (active bug tracking)
- ✅ FEATURE_REQUESTS.md (active feature backlog)
- ✅ ACTION_PLAN_BUG_FIXES.md (active bug fix plan)
- ✅ TESTING_WORKFLOW.md (testing reference)
- ✅ VARIABLES.md (variable reference)
- ✅ All files in `.claude/agents/` (agent configurations)
- ✅ All files in `.claude/skills/` (skill definitions)
- ✅ All files in `.claude/scripts/` (active scripts)
- ✅ Active dev docs in `dev/active/`

**Consider archiving:**
- ⚠️ Session notes > 2 weeks old
- ⚠️ Completed feature plans
- ⚠️ Resolved bug tracking
- ⚠️ Old audit reports
- ⚠️ Superseded guides

---

## Cleanup Schedule

### Monthly Cleanup (Recommended)
- Run `/archive-cleanup` at end of each month
- Review and archive completed work
- Keep directory lean and organized

### Per-Session Cleanup (Optional)
- When completing major milestone
- After finishing large feature
- When directory feels cluttered

### Quarterly Review (Deep Clean)
- Review entire archive structure
- Consolidate if needed
- Update all README files
- Verify nothing important archived by mistake

---

## Recovery

**If you accidentally archive something important:**

1. Find file in appropriate archive subdirectory
2. Move back to `.claude/` root:
   ```bash
   git mv .claude/archive/[type]/[file].md .claude/[file].md
   ```
3. Update archive README to remove entry
4. Document why it was moved back

---

## Automation Opportunities

**Future enhancements:**
- Script to automatically identify archiving candidates
- Automated archive README updates
- Monthly cleanup reminders
- Archive stats (how much cleaned up)

For now, use `/archive-cleanup` command manually when needed.
```

**Verification Checklist:**
- [ ] Archive process documented
- [ ] Clear criteria for what to archive
- [ ] Directory structure defined
- [ ] Schedule recommended
- [ ] Recovery process documented

---

### PHASE 7: Testing & Refinement (Day 6-7, 3-4 hours) 🟢 ESSENTIAL

**Goal:** Test everything works together, refine based on real usage

#### Task 7.1: Skills Testing (1.5 hours)

**Test Scenarios:**

**Scenario 1: Frontend Work**
1. Open frontend file: `frontend/src/app/quotes/create/page.tsx`
2. Ask: "How should I structure this form component?"
3. **Expected:** UserPromptSubmit hook activates frontend-dev-guidelines skill
4. **Verify:** Claude references React patterns from skill
5. **Verify:** Code follows patterns in skill

**Scenario 2: Backend Work**
1. Open backend file: `backend/routes/quotes.py`
2. Ask: "Add new endpoint for quote approval"
3. **Expected:** UserPromptSubmit hook activates backend-dev-guidelines skill
4. **Verify:** Claude references FastAPI patterns from skill
5. **Verify:** Endpoint follows routes → controllers → services pattern

**Scenario 3: Database Work**
1. Ask: "Create migration to add approved_by column"
2. **Expected:** database-verification skill activates (guardrail)
3. **Verify:** Claude checks column naming (snake_case)
4. **Verify:** Claude reminds about RLS policies
5. **Verify:** Migration follows standards

**Scenario 4: Mixed Work**
1. Ask: "Add customer phone validation on both frontend and backend"
2. **Expected:** Both frontend and backend skills activate
3. **Verify:** No conflicts between skills
4. **Verify:** Consistent patterns on both sides

**Scenario 5: Skill Resources**
1. Ask detailed React question: "How to handle async errors in useEffect?"
2. **Expected:** Skill loads, then loads react-patterns.md resource
3. **Verify:** Answer includes progressive disclosure (main SKILL → resource)

**Measurements:**

Track these before and after skills implementation:

**Before Skills:**
- Token usage for typical feature: ~15,000 tokens
- Times Claude asks for guidance: ~5 per feature
- Pattern consistency: ~60%
- Bugs related to pattern violations: ~5 per week

**After Skills (Expected):**
- Token usage for typical feature: ~8,000-10,000 tokens (40-60% reduction)
- Times Claude asks for guidance: ~1 per feature
- Pattern consistency: ~90%
- Bugs related to pattern violations: ~1 per week

**Verification Checklist:**
- [ ] UserPromptSubmit hook activates correct skills
- [ ] Skills load resource files when needed
- [ ] Patterns from skills are followed consistently
- [ ] Token usage improved (measure before/after)
- [ ] No errors in skill loading
- [ ] Guardrail skills block bad patterns

---

#### Task 7.2: Hooks Testing (1 hour)

**Test Scenarios:**

**Scenario 1: Edit Files + Format**
1. Edit multiple TypeScript files
2. Introduce some formatting inconsistencies
3. Have Claude finish task
4. **Expected:** Stop hook runs Prettier automatically
5. **Verify:** Files are formatted correctly
6. **Verify:** No manual prettier needed

**Scenario 2: TypeScript Errors**
1. Edit TypeScript file
2. Introduce a type error (e.g., assign string to number)
3. Have Claude finish task
4. **Expected:** Build checker catches error immediately
5. **Verify:** Error shown to Claude in stop hook
6. **Verify:** Claude fixes error
7. **Verify:** Re-run catches zero errors

**Scenario 3: Many Errors**
1. Introduce 10+ TypeScript errors across files
2. Have Claude finish task
3. **Expected:** Build checker shows error count
4. **Expected:** Recommends @build-error-resolver agent
5. **Verify:** Suggestion is helpful

**Scenario 4: Risky Code Patterns**
1. Add try-catch block without proper error handling
2. Have Claude finish task
3. **Expected:** Error handling reminder shown
4. **Verify:** Reminder is gentle and helpful
5. **Verify:** Claude self-assesses and adds proper handling

**Scenario 5: Multiple Repos**
1. Edit frontend file
2. Edit backend file
3. Have Claude finish task
4. **Expected:** Build checker runs on BOTH repos
5. **Verify:** Errors from both shown separately

**Scenario 6: No Errors**
1. Edit files correctly
2. Have Claude finish task
3. **Expected:** Build checker shows "0 errors ✓"
4. **Verify:** Output is clean and encouraging

**Measurements:**

Track these:

**Before Hooks:**
- TypeScript errors left behind: ~3 per day
- Time spent on manual error fixing: ~30 min per day
- Manual prettier runs needed: ~10 per day
- Code pushed with errors: ~1 per week

**After Hooks (Expected):**
- TypeScript errors left behind: 0 (caught immediately)
- Time spent on manual error fixing: ~5 min per day
- Manual prettier runs needed: 0 (automatic)
- Code pushed with errors: 0 (prevented)

**Verification Checklist:**
- [ ] Build checker catches all errors immediately
- [ ] Prettier formats without breaking code
- [ ] Error reminders are helpful, not annoying
- [ ] No performance impact on workflow
- [ ] File tracking works correctly
- [ ] Multiple repo edits handled properly

---

#### Task 7.3: Orchestrator Testing (30 min)

**Test Scenarios:**

**Scenario 1: Complex Feature**
1. Ask: "Add multi-step quote approval workflow"
2. **Expected:** Orchestrator auto-invokes @Plan agent
3. **Verify:** User doesn't need to mention @Plan
4. **Verify:** Plan is created before implementation

**Scenario 2: "Where is..." Question**
1. Ask: "Where is the authentication logic?"
2. **Expected:** Orchestrator auto-invokes @Explore agent
3. **Verify:** User doesn't need to mention @Explore
4. **Verify:** Accurate answer provided

**Scenario 3: Feature Completion**
1. Complete a feature implementation
2. **Expected:** Orchestrator auto-invokes quality trio in parallel:
   - @qa-tester
   - @security-auditor
   - @code-reviewer
3. **Verify:** User doesn't need to ask "did you test?"
4. **Verify:** Agents run in parallel (single message, multiple Task calls)
5. **Verify:** Findings presented clearly

**Scenario 4: Struggling with Bug**
1. Have Claude try same approach 3 times and fail
2. **Expected:** Orchestrator recognizes struggle
3. **Expected:** Orchestrator suggests @Expert agent
4. **Verify:** User doesn't wait forever for solution

**Scenario 5: Simple Task**
1. Ask: "Add console.log to debug function"
2. **Expected:** Orchestrator implements directly (too simple for plan)
3. **Verify:** Doesn't over-invoke agents for trivial tasks

**User Experience Testing:**

Have user try normal workflow:
- User gives instructions
- User observes orchestrator
- User notes any times they wanted to remind about agents
- User notes any times agents invoked unnecessarily

**Success:** User never feels need to mention agent names.

**Verification Checklist:**
- [ ] Orchestrator invokes agents without prompting
- [ ] Agents run in parallel when appropriate
- [ ] User doesn't need to remind about agents
- [ ] Workflow feels autonomous
- [ ] Not over-invoking (simple tasks stay simple)

---

#### Task 7.4: Slash Commands Testing (30 min)

**Test Each Command:**

**`/dev-docs-create`**
1. Complete planning for test feature
2. Run `/dev-docs-create`
3. **Verify:** 3 files created in correct location
4. **Verify:** Files filled with plan content
5. **Verify:** Templates followed

**`/dev-docs-update`**
1. Make progress on feature
2. Approach 85% context
3. Run `/dev-docs-update`
4. **Verify:** Context and tasks updated
5. **Verify:** "Last Updated" timestamp current

**`/code-review`**
1. Make some code changes
2. Run `/code-review`
3. **Verify:** @code-reviewer agent invoked
4. **Verify:** Findings organized by priority
5. **Verify:** Output is actionable

**`/build-and-fix`**
1. Introduce some errors
2. Run `/build-and-fix`
3. **Verify:** Builds run on both repos
4. **Verify:** Errors caught
5. **Verify:** Errors fixed
6. **Verify:** Re-check confirms zero errors

**`/archive-cleanup`**
1. Create some old test files
2. Run `/archive-cleanup`
3. **Verify:** Candidates identified correctly
4. **Verify:** Organized by type
5. **Verify:** After approval, files moved correctly

**Time Savings:**

Measure time for each workflow:

**Manual (before commands):**
- Create dev docs: ~5 min (copy-paste, organize)
- Update dev docs: ~3 min (find files, update)
- Code review: ~2 min (invoke agent manually)
- Build and fix: ~5 min (run commands, check output)
- Archive cleanup: ~10 min (find files, move, update READMEs)
**Total:** ~25 min

**With Commands (after):**
- Create dev docs: ~30 sec (type /dev-docs-create)
- Update dev docs: ~20 sec (type /dev-docs-update)
- Code review: ~10 sec (type /code-review)
- Build and fix: ~15 sec (type /build-and-fix)
- Archive cleanup: ~30 sec (type /archive-cleanup)
**Total:** ~2 min

**Time savings: ~92%**

**Verification Checklist:**
- [ ] All 5 commands work correctly
- [ ] Commands expand to full prompts
- [ ] Clear, useful output
- [ ] Time savings measured
- [ ] User-friendly and intuitive

---

#### Task 7.5: End-to-End Workflow Test (1 hour)

**Scenario:** Implement small feature end-to-end with new system

**Feature:** Add "Export to CSV" button to quotes list

**Expected Duration:** 30-45 minutes

**Steps:**

1. **User Request:**
   ```
   Add export to CSV button on quotes list page
   ```

2. **Planning:**
   - **Expected:** Orchestrator analyzes (simple enough, no @Plan needed)
   - OR orchestrator invokes @Plan if deemed complex
   - User approves approach

3. **Dev Docs (if >30 min):**
   - Run `/dev-docs-create`
   - **Verify:** 3 files created

4. **Implementation:**
   - **Expected:** Skills auto-activate (frontend-dev-guidelines)
   - **Verify:** Claude follows Ant Design patterns
   - **Verify:** Implements in chunks (if multi-step)
   - User reviews between chunks

5. **Build Check (automatic):**
   - **Expected:** Stop hook runs after implementation
   - **Verify:** Build checker catches any errors
   - **Verify:** Prettier formats code
   - **Verify:** Error reminder shown if risky code

6. **Quality Checks:**
   - **Expected:** Orchestrator auto-invokes quality trio
   - **Verify:** @qa-tester checks export functionality
   - **Verify:** @ux-reviewer checks button placement/style
   - **Verify:** @code-reviewer checks patterns
   - User sees all findings

7. **Fix Issues:**
   - Address any findings
   - **Expected:** Build checker runs again
   - **Verify:** Zero errors

8. **Documentation (automatic):**
   - **Expected:** Orchestrator updates SESSION_PROGRESS.md
   - **Expected:** Marks [~] awaiting verification
   - **Verify:** No need to ask "did you document?"

9. **Complete:**
   - User tests CSV export
   - User marks [x] verified
   - Dev docs moved to completed/ (if created)

**Measurements:**

Track throughout:
- Time taken: [record]
- Number of manual interventions: [record]
- Number of times had to remind about agents: [should be 0]
- Errors caught automatically: [record]
- Errors that slipped through: [should be 0]
- User satisfaction: [rate 1-10]

**Expected Results:**
- ✅ 50% less back-and-forth than old workflow
- ✅ Zero errors left behind
- ✅ Consistent code quality
- ✅ Automatic documentation
- ✅ Smooth, autonomous workflow
- ✅ User feels confident in Claude's work

**Actual Results:**
[Record after test]

**Issues Found:**
[Record any problems discovered]

**Verification Checklist:**
- [ ] Complete workflow tested end-to-end
- [ ] All systems worked together
- [ ] Measured improvements
- [ ] User satisfaction high
- [ ] Zero critical issues found
- [ ] Ready for real production use

---

### PHASE 8: Documentation & Rollout (Day 7, 2 hours) 🟢 FINALIZATION

**Goal:** Document the new system, prepare for daily use

#### Task 8.1: Create System Documentation (1 hour)

**Create:** `.claude/CLAUDE_CODE_BEST_PRACTICES.md`

```markdown
# Claude Code Best Practices - Our System

**Version:** 1.0
**Created:** 2025-10-29
**Status:** Production Ready

Based on 6 months of battle-tested practices from seasoned developer who solo-rewrote 300k LOC.

---

## Overview

Our infrastructure solves 6 critical pain points:
1. ❌ Code inconsistency + frequent mistakes → ✅ Skills enforce patterns
2. ❌ Manual agent invocation → ✅ Orchestrator auto-invokes
3. ❌ Same bugs repeatedly → ✅ Skills document gotchas
4. ❌ Manual documentation → ✅ Hooks auto-document
5. ❌ File cleanup struggles → ✅ Systematic archive process
6. ❌ Not using skills/hooks → ✅ Now built and working

---

## System Components

### 1. Skills System

**What:** Auto-activating code guidelines that enforce patterns

**Location:** `.claude/skills/`

**Available Skills:**
- **frontend-dev-guidelines** - React 19, Ant Design, TanStack patterns
  - Main: `SKILL.md` (< 500 lines)
  - Resources: react-patterns, ant-design-standards, tanstack-patterns, state-management, common-gotchas

- **backend-dev-guidelines** - FastAPI, Supabase, RLS patterns
  - Main: `SKILL.md` (< 500 lines)
  - Resources: fastapi-patterns, supabase-rls, error-handling, testing-patterns, pydantic-validation, common-gotchas

- **database-verification** - Database guardrails (BLOCKS unsafe ops)
  - Prevents: Wrong column names, missing RLS, dangerous migrations

**How Skills Activate:**

Skills automatically activate based on:
1. **Keywords in prompts:** "react", "component", "backend", "api", etc.
2. **Intent patterns:** "create component", "add endpoint", etc.
3. **Files being edited:** `frontend/src/**/*.tsx`, `backend/**/*.py`

**Before prompt reaches Claude:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Suggested skills:
✓ frontend-dev-guidelines
  React 19, Ant Design, TanStack patterns
  Load with: Use frontend-dev-guidelines skill

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Benefits:**
- 40-60% token efficiency improvement
- Consistent patterns automatically enforced
- Common gotchas prevented
- No need to explain patterns every time

**Configuration:** `.claude/skills/skill-rules.json`

---

### 2. Hooks System

**What:** TypeScript hooks that automate quality checks

**Location:** `.claude/hooks/`

**Hooks:**

**Hook #1: UserPromptSubmit** (before Claude sees prompt)
- Analyzes prompt for relevant skills
- Injects skill activation reminder
- Ensures guidelines loaded automatically

**Hook #2: Build Checker** (after Claude responds)
- Runs TypeScript check (frontend)
- Runs Python check (backend)
- Shows errors immediately
- Recommends agent if > 5 errors

**Hook #3: Prettier Formatter** (after Claude responds)
- Auto-formats all edited files
- Uses appropriate config per repo
- Silent unless error

**Hook #4: Error Handling Reminder** (after Claude responds)
- Detects risky patterns (try-catch, async, DB ops)
- Shows gentle reminder
- Non-blocking awareness

**Complete Pipeline:**
```
Claude finishes responding
  ↓
Prettier formats all files
  ↓
Build checker runs
  ↓
Error reminder shows (if risky code)
  ↓
Claude fixes any errors found
  ↓
Result: Clean, formatted, error-free code
```

**Benefits:**
- Zero errors left behind
- Automatic formatting
- Immediate error detection
- Quality awareness built-in

---

### 3. Dev Docs System

**What:** Three-file system for preserving context across sessions

**Location:** `~/git/quotation-app-dev/dev/`

**Structure:**
```
dev/
├── active/                     # Current tasks
│   └── [task-name]/
│       ├── [task]-plan.md      # Implementation plan
│       ├── [task]-context.md   # Key files, decisions
│       └── [task]-tasks.md     # Task checklist
├── completed/                  # Finished tasks
└── templates/                  # Templates for new tasks
```

**When to Use:**

For **all large tasks (> 30 min implementation):**
- After planning approved, run `/dev-docs-create`
- Update regularly as you implement
- Before compaction, run `/dev-docs-update`
- After compaction, say "continue" to resume

**Benefits:**
- Context preserved across auto-compactions
- Clear progress tracking
- Easy to resume after interruptions
- Systematic approach to large tasks

**Commands:** `/dev-docs-create`, `/dev-docs-update`

---

### 4. Orchestrator Workflow

**What:** Autonomous agent invocation without reminders

**How It Works:**

Orchestrator automatically invokes agents based on:
- **Complexity:** Complex feature? → @Plan
- **Research:** "Where is..."? → @Explore
- **Feature complete:** → Quality trio (@qa-tester + @security-auditor + @code-reviewer)
- **Struggling:** Same error 3x? → @Expert

**Decision Tree:**
```
User request
  ↓
Analyze complexity
  ↓
Complex? → @Plan
  ↓
Research needed? → @Explore
  ↓
Implement
  ↓
Auto-invoke quality trio (parallel)
  ↓
Fix issues
  ↓
Commit
```

**User Should Never Say:**
- ❌ "Did you use @Plan?"
- ❌ "Can you run tests?"
- ❌ "Did you check security?"
- ❌ "Should we use @Explore?"

**Benefits:**
- Autonomous workflow
- No reminders needed
- Quality checks automatic
- Expert help when stuck

---

### 5. Slash Commands

**What:** Reusable command workflows for common tasks

**Location:** `.claude/commands/`

**Available Commands:**

| Command | Purpose | Time Saved |
|---------|---------|------------|
| `/dev-docs-create` | Create dev docs from plan | ~90% (5min → 30sec) |
| `/dev-docs-update` | Update before compaction | ~90% (3min → 20sec) |
| `/code-review` | Request architectural review | ~95% (2min → 10sec) |
| `/build-and-fix` | Run builds, fix all errors | ~95% (5min → 15sec) |
| `/archive-cleanup` | Archive old documentation | ~95% (10min → 30sec) |

**How to Use:**

Just type the command:
```
/dev-docs-create
```

Command expands to full prompt with detailed instructions.

**Benefits:**
- ~92% time savings on common workflows
- Consistent execution
- No need to remember exact steps
- Single command does entire workflow

---

## Common Workflows

### Starting a New Feature

**Simple Feature (< 30 min):**
1. User requests feature
2. Orchestrator analyzes (simple, no plan needed)
3. Skills auto-activate based on files
4. Implement
5. Hooks run (format, build check, error reminder)
6. Orchestrator auto-invokes quality trio
7. Fix any issues found
8. Orchestrator auto-documents in SESSION_PROGRESS.md
9. Done

**Complex Feature (> 30 min):**
1. User requests feature
2. Orchestrator auto-invokes @Plan agent
3. Present plan to user for approval
4. User approves
5. Run `/dev-docs-create` (3 files created)
6. Implement in chunks (1-2 sections at a time)
7. User reviews between chunks
8. Update dev docs as you go
9. Hooks run after each chunk
10. Orchestrator auto-invokes quality trio
11. Fix any issues found
12. Orchestrator auto-documents
13. Move dev docs to completed/
14. Done

---

### Continuing After Compaction

**Before Compaction (at 85%+ tokens):**
1. Run `/dev-docs-update`
2. Context and tasks updated
3. Ready for compaction

**After Compaction:**
1. Say "continue"
2. Orchestrator reads dev docs from `dev/active/[task-name]/`
3. Restores full context
4. Continues from where you left off

---

### Code Review Process

**Automatic (after feature):**
- Orchestrator auto-invokes @code-reviewer
- Findings presented by priority
- Critical issues fixed immediately

**Manual (during development):**
1. Run `/code-review`
2. @code-reviewer agent invoked
3. Findings shown organized by priority:
   - 🔴 Critical (must fix)
   - 🟡 High (should fix)
   - 🟢 Low (nice to have)
4. Fix issues as needed

**Chunk Review (every 2-3 chunks):**
- Implement chunk
- User reviews
- Continue or run `/code-review`
- Adjust approach if needed

---

### Cleanup & Archiving

**Monthly (or every 50 commits):**
1. Run `/archive-cleanup`
2. Review candidates:
   - Session notes > 2 weeks old
   - Completed feature plans
   - Resolved bug tracking
3. Approve archiving plan
4. Files moved to appropriate archive/ subdirectories
5. Archive READMEs updated

**Archive Structure:**
```
.claude/archive/
├── sessions/           # Old session notes
├── features/           # Completed plans
├── bugs_and_plans/     # Resolved bugs
├── audits/            # Historical audits
├── setup/             # Initial setup
└── guides/            # Superseded guides
```

---

## Troubleshooting

### Skills Not Activating

**Problem:** Skills not loading when expected

**Check:**
1. Is skill-rules.json valid JSON?
2. Are keywords spelled correctly?
3. Are file paths matching?
4. Check console for errors

**Solution:**
- Review skill-rules.json
- Test with explicit keywords
- Check UserPromptSubmit hook logs

---

### Build Checker Not Running

**Problem:** TypeScript errors not caught

**Check:**
1. Are hooks enabled?
2. Is TypeScript configured correctly?
3. Are edited files tracked?

**Solution:**
- Verify hooks directory exists
- Check .edited-files.json log
- Test stop hook manually

---

### Orchestrator Not Invoking Agents

**Problem:** Having to remind about agents

**Check:**
1. Is orchestrator.md updated with autonomous workflow?
2. Is task actually complex enough?
3. Is orchestrator analyzing request?

**Solution:**
- Review orchestrator.md prompt
- Add more explicit agent invocation triggers
- Test with known complex request

---

### Dev Docs Lost Context

**Problem:** Context not preserved after compaction

**Check:**
1. Were dev docs updated before compaction?
2. Are all 3 files present?
3. Is "Last Updated" recent?

**Solution:**
- Run `/dev-docs-update` before compaction
- Verify files exist in `dev/active/[task-name]/`
- Check if context.md has recent decisions

---

## Best Practices

### Do's ✅

- ✅ Create dev docs for all large tasks (> 30 min)
- ✅ Implement in small chunks with reviews
- ✅ Update dev docs as you go (not at end)
- ✅ Run `/code-review` every 2-3 chunks
- ✅ Trust the automation (hooks, skills, orchestrator)
- ✅ Archive regularly (monthly)
- ✅ Let orchestrator invoke agents (don't micromanage)

### Don'ts ❌

- ❌ Skip dev docs for large tasks
- ❌ Implement entire feature without reviews
- ❌ Wait until end to update docs
- ❌ Manually invoke agents (let orchestrator)
- ❌ Let old docs accumulate
- ❌ Skip quality checks
- ❌ Ignore hook warnings

---

## Metrics & Results

**Expected Improvements:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Bugs per feature | 5-8 | 1-2 | 70-80% ↓ |
| Token usage | ~15k | ~8-10k | 40-60% ↓ |
| Error fixing time | 30 min/day | 5 min/day | 83% ↓ |
| Code review cycles | 3-4 | 1-2 | 50-60% ↓ |
| Context loss incidents | Weekly | Never | 100% ↓ |
| Manual agent calls | 10/day | 0/day | 100% ↓ |
| Documentation gaps | Common | Never | 100% ↓ |

**Success Indicators:**

You know it's working when:
- ✅ Skills activate automatically
- ✅ Zero errors left behind
- ✅ Orchestrator handles agents autonomously
- ✅ Documentation always up to date
- ✅ Context never lost
- ✅ You rarely mention agent names

---

## Version History

**v1.0** (2025-10-29):
- Initial implementation
- All 8 phases complete
- Skills, hooks, dev docs, orchestrator, commands
- Tested and verified
- Production ready

---

## Support

**For questions or issues:**
1. Check this guide's Troubleshooting section
2. Review individual component docs:
   - Skills: `.claude/skills/README.md`
   - Scripts: `.claude/scripts/README.md`
   - Archive: `.claude/ARCHIVE_PROCESS.md`
3. Check SESSION_PROGRESS.md for recent changes

**To request enhancements:**
- Add to FEATURE_REQUESTS.md
- Discuss with team
- Plan implementation
```

**Verification Checklist:**
- [ ] Complete guide created
- [ ] All components documented
- [ ] Examples included for common workflows
- [ ] Troubleshooting section comprehensive
- [ ] Easy to reference and search

---

#### Task 8.2: Update Core CLAUDE.md (1 hour)

**Add new section to CLAUDE.md** (after "Core Principles", before "Communication Style"):

```markdown
---

## Our Claude Code Infrastructure

**We use a battle-tested system based on 6 months of production use by developer who solo-rewrote 300k LOC.**

This infrastructure addresses all our pain points:
1. ✅ Consistent code quality (skills enforce patterns)
2. ✅ Zero errors left behind (hooks catch everything)
3. ✅ Context preserved (dev docs survive compactions)
4. ✅ Autonomous workflow (orchestrator handles agents)
5. ✅ Fast workflows (slash commands for common tasks)
6. ✅ Systematic processes (documentation, cleanup)

**📖 Complete Guide:** `.claude/CLAUDE_CODE_BEST_PRACTICES.md`

---

### Quick Reference

#### Skills (Auto-Activating Guidelines)

**Available Skills:**
- `frontend-dev-guidelines` - React 19, Ant Design, TanStack patterns
- `backend-dev-guidelines` - FastAPI, Supabase, RLS patterns
- `database-verification` - Database guardrails (blocks unsafe operations)

**How They Work:**
- Auto-activate based on keywords, intent, and files
- Enforce consistent patterns automatically
- 40-60% token efficiency improvement
- Prevent common gotchas

**You don't load skills manually - hooks do it automatically.**

#### Hooks (Automated Quality Checks)

**After Claude responds, hooks automatically:**
1. ✅ Run Prettier (format all edited files)
2. ✅ Run builds (TypeScript + Python)
3. ✅ Show errors immediately
4. ✅ Remind about error handling (if risky code)

**Result:** Zero errors left behind, code always formatted.

#### Dev Docs (Context Preservation)

**For large tasks (> 30 min):**

**Create:**
```
/dev-docs-create
```
Creates 3 files:
- `[task]-plan.md` - Implementation plan
- `[task]-context.md` - Key files, decisions
- `[task]-tasks.md` - Task checklist

**Update before compaction:**
```
/dev-docs-update
```

**Resume after compaction:**
```
continue
```

**Location:** `~/git/quotation-app-dev/dev/active/[task-name]/`

#### Orchestrator (Autonomous Agents)

**Orchestrator automatically invokes agents:**
- Complex feature? → Auto-invokes @Plan
- "Where is..."? → Auto-invokes @Explore
- Feature complete? → Auto-invokes quality trio (@qa-tester + @security-auditor + @code-reviewer)
- Struggling? → Auto-invokes @Expert

**You never need to remind orchestrator about agents.**

#### Slash Commands

| Command | Purpose |
|---------|---------|
| `/dev-docs-create` | Create dev docs from plan |
| `/dev-docs-update` | Update before compaction |
| `/code-review` | Request architectural review |
| `/build-and-fix` | Run builds, fix all errors |
| `/archive-cleanup` | Archive old documentation |

**Time savings: ~92% on common workflows**

---

### Implementation in Chunks

**For large features, implement in small chunks with reviews between:**

1. **Implement 1-2 sections** (10-20 min)
2. **User reviews** code quality and functionality
3. **Run `/code-review`** every 2-3 chunks
4. **Update dev docs** as you go
5. **Adjust** approach if needed

**Benefits:**
- Catch mistakes early
- Less wasted time
- User involved throughout

---

### Auto-Documentation

**Orchestrator automatically updates documentation:**
- ✅ SESSION_PROGRESS.md after every feature
- ✅ CLAUDE.md when patterns change
- ✅ Skills when gotchas discovered
- ✅ Dev docs during implementation

**User should never ask: "Did you document this?"**

---

### Monthly Cleanup

**Run monthly or when directory feels cluttered:**
```
/archive-cleanup
```

**Archives:**
- Session notes > 2 weeks old
- Completed feature plans
- Resolved bug tracking
- Old audit reports

**Keeps `.claude/` directory clean and organized.**

---

### Success Metrics

**You'll know it's working when:**
- ✅ Skills activate automatically
- ✅ Zero errors slip through
- ✅ Orchestrator handles agents autonomously
- ✅ Documentation always up to date
- ✅ Context never lost
- ✅ You rarely mention agent names

**Expected improvements:**
- 70-80% fewer bugs
- 40-60% better token efficiency
- 83% less time fixing errors
- 100% elimination of context loss

---
```

**Also update references throughout CLAUDE.md:**

**Old references to remove/update:**
- Remove detailed coding guidelines (now in skills)
- Remove manual agent invocation instructions (now automatic)
- Update any outdated workflow descriptions

**Target CLAUDE.md length:**
- Before: ~800 lines
- After: ~400 lines (50% reduction)
- Reason: Coding guidelines moved to skills, workflows streamlined

**Verification Checklist:**
- [ ] New infrastructure section added
- [ ] Quick reference comprehensive
- [ ] Old content removed/updated
- [ ] CLAUDE.md length reduced to ~400 lines
- [ ] References to complete guide included
- [ ] All systems briefly explained

---

## 🎯 Implementation Complete!

After completing all 8 phases:

**What You'll Have:**

1. ✅ **Skills System** - Auto-activating guidelines
2. ✅ **Hooks System** - Automated quality checks
3. ✅ **Dev Docs System** - Context preservation
4. ✅ **Orchestrator Workflow** - Autonomous agents
5. ✅ **Slash Commands** - Fast workflows
6. ✅ **Process Improvements** - Chunk reviews, auto-docs
7. ✅ **Tested & Verified** - All systems working together
8. ✅ **Fully Documented** - Complete guide for future

**Your 6 Pain Points:**
1. ✅ Code inconsistency → **Solved** (skills enforce patterns)
2. ✅ Manual agent invocation → **Solved** (orchestrator handles it)
3. ✅ Same bugs repeatedly → **Solved** (skills document gotchas)
4. ✅ Manual documentation → **Solved** (hooks auto-document)
5. ✅ File cleanup struggles → **Solved** (systematic process)
6. ✅ Not using skills/hooks → **Solved** (now built and working)

**Next Steps:**

1. **Start using the system** on real features
2. **Monitor improvements** (track metrics)
3. **Refine as needed** (adjust based on usage)
4. **Celebrate** - You've built world-class infrastructure! 🎉

---

## 📊 Quick Start Checklist

After implementation, verify everything works:

- [ ] Skills auto-activate when working on frontend/backend
- [ ] Hooks run after Claude responds (format, build check)
- [ ] Orchestrator invokes agents without reminding
- [ ] Dev docs system works (create, update, resume)
- [ ] Slash commands work (try each one)
- [ ] Zero errors slip through
- [ ] Documentation auto-updates
- [ ] Archive process clear

**If all checked ✅ → System is production ready!**

---

**END OF IMPLEMENTATION PLAN**
