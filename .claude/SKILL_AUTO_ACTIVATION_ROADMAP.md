# Skill Auto-Activation - Visual Roadmap

**Created:** 2025-10-30

---

## Current State vs Target State

```
BEFORE (Current - 95% Maturity)
======================================
User: "Add approval workflow"
         ↓
    Claude sees prompt
         ↓
    No skills loaded ❌
         ↓
    Generic response


AFTER (Target - 100% Maturity)
======================================
User: "Add approval workflow"
         ↓
    UserPromptSubmit Hook
    Analyzes: "approval" + "workflow"
         ↓
    Auto-activates: frontend-dev-guidelines ✅
         ↓
    Claude sees prompt + skill context
         ↓
    Domain-specific response (React 19, Ant Design, patterns)
```

---

## Implementation Flow

```
┌─────────────────────────────────────────────────────┐
│ PHASE 1: Download & Setup (30-45 min)              │
├─────────────────────────────────────────────────────┤
│ 1. Create workspace directory                       │
│    └─ .claude/hooks/skill-activation/              │
│                                                      │
│ 2. Download 6 files from Reddit repo               │
│    ├─ skill-activation-prompt.ts                   │
│    ├─ skill-activation-prompt.sh                   │
│    ├─ post-tool-use-tracker.ts                     │
│    ├─ post-tool-use-tracker.sh                     │
│    ├─ package.json                                  │
│    └─ tsconfig.json                                 │
│                                                      │
│ 3. Install dependencies                             │
│    └─ npm install (typescript, @types/node)        │
│                                                      │
│ 4. Compile TypeScript                               │
│    └─ npx tsc → creates dist/ with .js files       │
│                                                      │
│ 5. Test execution                                   │
│    └─ ./skill-activation-prompt.sh --test          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ PHASE 2: Enhance skill-rules.json (15-20 min)      │
├─────────────────────────────────────────────────────┤
│ 1. Backup current config                            │
│    └─ cp skill-rules.json skill-rules.json.backup  │
│                                                      │
│ 2. Add natural language patterns                    │
│    ├─ Business keywords: quote, customer, approval │
│    ├─ Natural phrases: "fix export button"         │
│    └─ Intent patterns: user's actual language      │
│                                                      │
│ 3. Enhance enforcement                              │
│    └─ calculation: suggest → block (guardrail)     │
│                                                      │
│ 4. Validate JSON syntax                             │
│    └─ cat skill-rules.json | python3 -m json.tool  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ PHASE 3: Configure settings.json (10-15 min)       │
├─────────────────────────────────────────────────────┤
│ 1. Backup current settings                          │
│    └─ cp settings.json settings.json.backup        │
│                                                      │
│ 2. Add hooks section                                │
│    ├─ UserPromptSubmit: analyze prompts            │
│    ├─ PostToolUse: track file edits                │
│    └─ Stop: preserve existing hooks                │
│                                                      │
│ 3. Validate JSON syntax                             │
│    └─ cat settings.json | python3 -m json.tool     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ PHASE 4: Test & Verify (20-30 min)                 │
├─────────────────────────────────────────────────────┤
│ Test 1: Prompt keyword trigger                      │
│    Prompt: "Add approval workflow"                  │
│    Expected: frontend-dev-guidelines activates      │
│                                                      │
│ Test 2: File edit trigger                           │
│    Edit: frontend/src/app/quotes/page.tsx          │
│    Expected: frontend-dev-guidelines activates      │
│                                                      │
│ Test 3: Guardrail blocking                          │
│    Prompt: "Add column to quotes table"             │
│    Expected: database-verification blocks           │
│                                                      │
│ Test 4: Multiple skills                             │
│    Prompt: "Quote calculation is wrong"             │
│    Expected: calculation + backend activate         │
│                                                      │
│ Test 5: Negative test                               │
│    Prompt: "What's the weather?"                    │
│    Expected: No skills activate                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ PHASE 5: Commit & Document (10-15 min)             │
├─────────────────────────────────────────────────────┤
│ 1. Create SKILL_ACTIVATION_GUIDE.md                │
│    └─ Quick reference for troubleshooting          │
│                                                      │
│ 2. Update SESSION_PROGRESS.md                       │
│    └─ Add Phase 9 entry                            │
│                                                      │
│ 3. Update CLAUDE.md                                 │
│    └─ Add auto-activation documentation            │
│                                                      │
│ 4. Git commit with detailed message                 │
│    └─ Explain problem, solution, impact            │
│                                                      │
│ 5. Push to dev branch                               │
│    └─ git push origin dev                          │
└─────────────────────────────────────────────────────┘
                        ↓
              ✅ COMPLETE
         (100% Maturity Achieved)
```

---

## Hook Execution Flow

### UserPromptSubmit Hook (Prompt Analyzer)

```
User types message
       ↓
[UserPromptSubmit Hook Triggered]
       ↓
1. Read skill-rules.json
       ↓
2. For each skill:
   ├─ Check promptTriggers.keywords
   │  └─ "approval" found → match!
   ├─ Check promptTriggers.intentPatterns
   │  └─ "(add|create).*?(workflow)" → match!
   └─ Calculate relevance score
       ↓
3. Sort skills by score
       ↓
4. Return top matching skills
       ↓
[Claude receives prompt + activated skills]
       ↓
Claude responds with domain-specific knowledge
```

### PostToolUse Hook (File Edit Tracker)

```
Claude edits/reads file
       ↓
[PostToolUse Hook Triggered]
       ↓
1. Detect tool used: Read, Edit, Write
       ↓
2. Extract file path
   Example: "frontend/src/app/quotes/page.tsx"
       ↓
3. Read skill-rules.json
       ↓
4. For each skill:
   ├─ Check fileTriggers.pathPatterns
   │  └─ "frontend/**/*.tsx" → match!
   ├─ Check fileTriggers.contentPatterns
   │  └─ "import.*from 'react'" → match!
   └─ Calculate relevance
       ↓
5. Auto-activate matching skills
       ↓
[Skill loaded for next interaction]
       ↓
Next prompt uses domain knowledge automatically
```

---

## Trigger Examples by Skill

### frontend-dev-guidelines

**Natural Language Triggers:**
- "Add approval workflow to quote detail page"
- "Fix export button on quote list"
- "Quote creation form validation not working"
- "Improve dashboard UI"
- "Add feedback button"

**File Edit Triggers:**
- Edit any .tsx file in frontend/src/
- Read component files
- Modify Ant Design forms
- Change ag-Grid configurations

**Activation Result:**
- 3,632 lines of React 19, Ant Design, ag-Grid patterns
- Component structure guidelines
- State management patterns
- API integration examples

---

### backend-dev-guidelines

**Natural Language Triggers:**
- "Add API endpoint for approval workflow"
- "Export Excel generation broken"
- "Email notification not sending"
- "Activity log not tracking"
- "User profile API needed"

**File Edit Triggers:**
- Edit any .py file in backend/
- Modify FastAPI routes
- Change Supabase queries
- Update Pydantic models

**Activation Result:**
- 3,200+ lines of FastAPI, Supabase, RLS patterns
- API endpoint structure
- Export generation (Excel/PDF)
- Testing patterns

---

### calculation-engine-guidelines (GUARDRAIL)

**Natural Language Triggers:**
- "Quote calculation is wrong"
- "Price doesn't include customs duty"
- "Margin calculation incorrect"
- "Exchange rate not applied"
- "Total price too high/low"

**File Edit Triggers:**
- Edit quotes_calc.py
- Modify calculation tests
- Change VARIABLES.md
- Update calculation_engine_summary.md

**Activation Result (BLOCKING):**
- 1,500+ lines of calculation domain knowledge
- 13-phase pipeline explanation
- 42 variables documentation
- Two-tier system patterns
- **BLOCKS execution until verification**

---

### database-verification (GUARDRAIL)

**Natural Language Triggers:**
- "Add new column to quotes table"
- "Create new table for approvals"
- "Change schema structure"
- "Drop unused column"
- "Migration failed"

**File Edit Triggers:**
- Edit any .sql file in migrations/
- Modify schema files
- Change RLS policies

**Activation Result (BLOCKING):**
- 2,000+ lines of database guardrails
- Multi-tenant RLS patterns
- Migration checklist
- Schema standards
- **BLOCKS execution until RLS verified**

---

## Performance Impact

```
Hook Execution Times:
┌────────────────────────────────────┬──────────┐
│ Operation                          │ Time     │
├────────────────────────────────────┼──────────┤
│ UserPromptSubmit hook              │ < 2s     │
│ PostToolUse hook                   │ < 1s     │
│ skill-rules.json parse             │ < 100ms  │
│ Keyword matching                   │ < 50ms   │
│ Intent pattern matching (regex)    │ < 200ms  │
├────────────────────────────────────┼──────────┤
│ Total overhead per interaction     │ < 2s     │
└────────────────────────────────────┴──────────┘

Impact on User Experience:
✅ Imperceptible delay (< 2s is typical API latency)
✅ Skills load before Claude sees prompt (parallel)
✅ No manual typing @skill references (time saved)
✅ Better responses (domain knowledge auto-included)

Net Result: FASTER interaction (auto-load saves 5-10s per prompt)
```

---

## Resource Requirements

```
Disk Space:
├── Hook scripts: ~50 KB (TypeScript + Bash)
├── node_modules: ~5 MB (typescript, @types/node, ts-node)
├── Compiled JS: ~20 KB (dist/ directory)
└── Total: ~5.1 MB

Memory:
├── Node.js process: ~50 MB (only during hook execution)
├── skill-rules.json parse: ~1 MB
└── Total: ~51 MB (released after hook completes)

CPU:
├── TypeScript compilation: one-time (< 5s)
├── Hook execution: < 2s per interaction
└── Impact: Negligible (< 1% CPU usage)

Network:
├── Initial download: ~50 KB (6 files from GitHub)
└── Runtime: 0 (all local)
```

---

## Risk Assessment

```
┌─────────────────────────────┬──────────┬────────────┬──────────────┐
│ Risk                        │ Severity │ Likelihood │ Mitigation   │
├─────────────────────────────┼──────────┼────────────┼──────────────┤
│ False positives             │ Low      │ Medium     │ Tune keywords│
│ Performance degradation     │ Low      │ Low        │ Timeout 2s   │
│ Hook execution errors       │ Medium   │ Low        │ Rollback plan│
│ TypeScript compilation fail │ Low      │ Low        │ Manual .js   │
│ JSON syntax errors          │ Low      │ Low        │ Validation   │
└─────────────────────────────┴──────────┴────────────┴──────────────┘

Overall Risk Level: LOW
Rollback Complexity: VERY LOW (2-5 min)
Testing Coverage: HIGH (5 scenarios)
```

---

## Success Indicators

**Week 1 (Testing Phase)**
- [ ] Skills activate on 90%+ relevant prompts
- [ ] False positive rate < 10%
- [ ] No hook execution errors
- [ ] Performance < 2s overhead
- [ ] Guardrails block dangerous operations

**Week 2 (Optimization Phase)**
- [ ] False positives reduced to < 5%
- [ ] Common patterns added to skill-rules.json
- [ ] Edge cases documented
- [ ] User satisfaction high

**Week 3 (Maturity Phase)**
- [ ] Zero manual skill references needed
- [ ] All interactions use appropriate skills
- [ ] Infrastructure maturity: 100%
- [ ] System stable and reliable

---

## Comparison to Manual Skill References

```
MANUAL (Current State)
======================================
1. User types prompt
2. User remembers to type: "Can you load @frontend-dev-guidelines?"
3. Claude loads skill
4. User repeats original prompt
5. Claude responds with skill context

Time: ~30 seconds
Cognitive Load: HIGH (must remember skills)
Error Rate: 40% (forget to load skill)


AUTOMATIC (After Implementation)
======================================
1. User types prompt
2. Hook auto-activates skill
3. Claude responds with skill context

Time: ~2 seconds
Cognitive Load: ZERO (automatic)
Error Rate: 0% (always loads)

Time Saved: 28 seconds per interaction
× 20 interactions/day = 560 seconds (9.3 min/day)
× 5 days/week = 46.5 min/week
× 4 weeks = 186 min/month = 3.1 hours/month
```

---

## Expected Outcomes

**Immediate (Day 1)**
- ✅ Skills activate automatically
- ✅ Zero manual skill references
- ✅ Guardrails enforce best practices

**Short-term (Week 1)**
- ✅ Domain-specific responses by default
- ✅ Fewer pattern violations
- ✅ Better code quality

**Long-term (Month 1)**
- ✅ 3+ hours saved per month
- ✅ Consistent pattern enforcement
- ✅ Reduced bug rate (skills prevent mistakes)
- ✅ 100% infrastructure maturity

---

**Ready to implement? See full plan in PLAN_SKILL_AUTO_ACTIVATION.md**
