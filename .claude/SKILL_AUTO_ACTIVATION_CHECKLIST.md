# Skill Auto-Activation - Quick Start Checklist

**Created:** 2025-10-30
**Estimated Time:** 1.5-2 hours
**Difficulty:** Medium

---

## Pre-Implementation Checklist

Before starting, verify:

- [ ] WSL2 environment active
- [ ] Node.js v14+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git working directory clean
- [ ] Current branch: dev
- [ ] .claude/skills/skill-rules.json exists (286 lines)
- [ ] .claude/settings.json exists
- [ ] .claude/hooks/ directory exists
- [ ] Read PLAN_SKILL_AUTO_ACTIVATION.md (understand process)

---

## Phase 1: Download & Setup (30-45 min)

### Step 1.1: Create Workspace (2 min)
- [ ] Create directory: `.claude/hooks/skill-activation/`
- [ ] Navigate to workspace
- [ ] Verify directory created

### Step 1.2: Download Files (10 min)
- [ ] Download skill-activation-prompt.ts
- [ ] Download skill-activation-prompt.sh
- [ ] Download post-tool-use-tracker.ts
- [ ] Download post-tool-use-tracker.sh
- [ ] Download package.json
- [ ] Download tsconfig.json
- [ ] Make .sh files executable (`chmod +x *.sh`)
- [ ] Verify 6 files exist

### Step 1.3: Install Dependencies (5 min)
- [ ] Run `npm install` in workspace
- [ ] Verify node_modules/ created
- [ ] Verify typescript installed
- [ ] Verify @types/node installed
- [ ] Verify ts-node installed

### Step 1.4: Compile TypeScript (5 min)
- [ ] Run `npx tsc` in workspace
- [ ] Verify dist/ directory created
- [ ] Verify skill-activation-prompt.js exists
- [ ] Verify post-tool-use-tracker.js exists

### Step 1.5: Test Execution (5 min)
- [ ] Run `./skill-activation-prompt.sh --test`
- [ ] Verify no errors
- [ ] Verify output shows "working correctly"

**Checkpoint:** All hooks executable and working ✅

---

## Phase 2: Enhance skill-rules.json (15-20 min)

### Step 2.1: Backup (2 min)
- [ ] Copy skill-rules.json to skill-rules.json.backup
- [ ] Verify backup exists

### Step 2.2: Enhance frontend-dev-guidelines (4 min)
- [ ] Add business keywords: quote, customer, approval, export
- [ ] Add natural language patterns: "fix button", "add workflow"
- [ ] Add intent patterns for quote/customer operations
- [ ] Save changes

### Step 2.3: Enhance backend-dev-guidelines (4 min)
- [ ] Add business keywords: quote, approval, export logic, email
- [ ] Add natural language patterns: "fix api", "add endpoint"
- [ ] Add intent patterns for backend operations
- [ ] Save changes

### Step 2.4: Enhance calculation-engine-guidelines (3 min)
- [ ] CHANGE enforcement: "suggest" → "block" (CRITICAL!)
- [ ] Add keywords: wrong calculation, incorrect price
- [ ] Add intent patterns: "calculation is wrong", "price too high"
- [ ] Save changes

### Step 2.5: Enhance database-verification (2 min)
- [ ] VERIFY enforcement: "block" (already correct)
- [ ] Add keywords: add field, new column, change schema
- [ ] Add intent patterns: "need to add column"
- [ ] Save changes

### Step 2.6: Validate (2 min)
- [ ] Run `cat skill-rules.json | python3 -m json.tool`
- [ ] Verify no JSON syntax errors
- [ ] If errors: fix and re-validate

**Checkpoint:** skill-rules.json enhanced and valid ✅

---

## Phase 3: Configure settings.json (10-15 min)

### Step 3.1: Backup (2 min)
- [ ] Copy settings.json to settings.json.backup
- [ ] Verify backup exists

### Step 3.2: Add Hooks Section (5 min)
- [ ] Add "hooks" key after "enabledMcpjsonServers"
- [ ] Add UserPromptSubmit hook configuration
  - [ ] enabled: true
  - [ ] script: absolute path to skill-activation-prompt.sh
  - [ ] timeout: 5000
- [ ] Add PostToolUse hook configuration
  - [ ] enabled: true
  - [ ] script: absolute path to post-tool-use-tracker.sh
  - [ ] timeout: 3000
- [ ] Add Stop hook configuration (preserve existing hooks)
- [ ] Save changes

### Step 3.3: Validate (2 min)
- [ ] Run `cat settings.json | python3 -m json.tool`
- [ ] Verify no JSON syntax errors
- [ ] If errors: fix and re-validate

### Step 3.4: Test Hook Paths (2 min)
- [ ] Verify script paths are absolute (not relative)
- [ ] Test script exists: `ls /path/to/skill-activation-prompt.sh`
- [ ] Test script executable: `./path/to/skill-activation-prompt.sh --version`

**Checkpoint:** settings.json configured and valid ✅

---

## Phase 4: Test & Verify (20-30 min)

### Test Scenario 1: Prompt Keyword Trigger (5 min)
- [ ] Simulate prompt: "Add approval workflow to quote detail page"
- [ ] Verify frontend-dev-guidelines activates
- [ ] Verify response includes React/Ant Design patterns
- [ ] Verify no errors

**Expected:** ✅ Skill activated automatically

### Test Scenario 2: File Edit Trigger (5 min)
- [ ] Edit file: `frontend/src/app/quotes/create/page.tsx`
- [ ] Make small change (add comment)
- [ ] Ask: "Review this code for best practices"
- [ ] Verify frontend-dev-guidelines activates
- [ ] Verify response references frontend patterns

**Expected:** ✅ Skill activated by file path

### Test Scenario 3: Guardrail Blocking (7 min)
- [ ] Simulate prompt: "Add column approval_status to quotes table"
- [ ] Verify database-verification activates
- [ ] Verify Claude asks verification questions
- [ ] Verify mentions RLS, migrations, rollback
- [ ] Verify does NOT execute immediately

**Expected:** ✅ Guardrail blocks execution

### Test Scenario 4: Multiple Skills (8 min)
- [ ] Simulate prompt: "Quote calculation is wrong - customs duty not included"
- [ ] Verify calculation-engine-guidelines activates (blocking)
- [ ] Verify backend-dev-guidelines activates
- [ ] Verify response explains 13 phases
- [ ] Verify mentions customs_duty variables
- [ ] Verify comprehensive response (both skills)

**Expected:** ✅ Multiple skills activated

### Test Scenario 5: Negative Test (5 min)
- [ ] Simulate prompt: "What's the weather like today?"
- [ ] Verify NO skills activate
- [ ] Verify generic Claude response
- [ ] Verify no false positives

**Expected:** ✅ No irrelevant activation

**Checkpoint:** All 5 test scenarios passed ✅

---

## Phase 5: Commit & Document (10-15 min)

### Step 5.1: Create Quick Reference (5 min)
- [ ] Create `.claude/SKILL_ACTIVATION_GUIDE.md`
- [ ] Include: How it works, triggers, troubleshooting
- [ ] Include: Quick examples for each skill
- [ ] Save and verify

### Step 5.2: Update Documentation (3 min)
- [ ] Update SESSION_PROGRESS.md (add Phase 9 entry)
- [ ] Update CLAUDE.md (add auto-activation section)
- [ ] Verify both files saved

### Step 5.3: Git Commit (5 min)
- [ ] Run `git status` (verify all files staged)
- [ ] Add all modified files
- [ ] Commit with detailed message (see plan)
- [ ] Verify commit created

### Step 5.4: Push to Remote (2 min)
- [ ] Run `git push origin dev`
- [ ] Verify push successful
- [ ] Verify no errors

**Checkpoint:** All changes committed and pushed ✅

---

## Post-Implementation Checklist

### Immediate (Day 1)
- [ ] Skills activate automatically (no manual references)
- [ ] No hook execution errors
- [ ] Performance acceptable (< 2s overhead)
- [ ] Guardrails blocking dangerous operations

### Week 1
- [ ] Monitor false positive rate (< 10% target)
- [ ] Track which skills activate most
- [ ] Identify missing trigger patterns
- [ ] Document edge cases

### Week 2
- [ ] Optimize trigger patterns (reduce false positives)
- [ ] Add missing keywords
- [ ] Tune enforcement levels
- [ ] Update documentation

### Week 3
- [ ] System stable and reliable
- [ ] Zero manual skill references needed
- [ ] Infrastructure maturity: 100%
- [ ] User satisfaction high

---

## Troubleshooting Checklist

### Hooks Not Executing
- [ ] Check scripts executable (`chmod +x *.sh`)
- [ ] Check Node.js version (`node --version`)
- [ ] Check TypeScript compiled (`ls dist/`)
- [ ] Check settings.json hook paths (absolute, not relative)
- [ ] Test hook manually (`./skill-activation-prompt.sh --test`)

### False Positives (Skills Activate Too Often)
- [ ] Review keyword lists (too generic?)
- [ ] Check intentPatterns (too broad?)
- [ ] Narrow trigger patterns
- [ ] Remove ambiguous keywords

### Guardrails Not Blocking
- [ ] Verify enforcement: "block" (not "suggest")
- [ ] Check keywords match database operations
- [ ] Test with explicit database prompt
- [ ] Review intentPatterns regex

### TypeScript Compilation Errors
- [ ] Check dependencies installed (`npm list`)
- [ ] Update TypeScript (`npm install typescript@latest`)
- [ ] Fix tsconfig.json paths
- [ ] Use ts-node instead of compiled JS

### Performance Issues
- [ ] Check timeout settings (increase if needed)
- [ ] Profile hook execution (`time ./hook.sh`)
- [ ] Optimize TypeScript (remove unnecessary file reads)
- [ ] Cache skill-rules.json in memory

---

## Rollback Checklist

### Quick Disable (2 min)
- [ ] Edit settings.json
- [ ] Change "enabled": true → false (both hooks)
- [ ] Save changes
- [ ] Test with prompt (skills should not activate)

### Full Rollback (5 min)
- [ ] Restore settings.json from backup
- [ ] Restore skill-rules.json from backup
- [ ] Verify backups applied
- [ ] Commit rollback changes
- [ ] Push to remote

### Complete Removal (15 min)
- [ ] Remove hooks section from settings.json
- [ ] Delete .claude/hooks/skill-activation/ directory
- [ ] Restore original skill-rules.json
- [ ] Commit removal
- [ ] Push to remote

---

## Success Criteria

Mark complete when ALL of these are true:

- [ ] ✅ All 16 files created/modified
- [ ] ✅ No TypeScript compilation errors
- [ ] ✅ No JSON syntax errors
- [ ] ✅ All 5 test scenarios pass
- [ ] ✅ Guardrails block dangerous operations
- [ ] ✅ False positive rate < 10%
- [ ] ✅ Performance < 2s overhead
- [ ] ✅ All commits pushed to remote
- [ ] ✅ Documentation updated
- [ ] ✅ No errors in Claude logs

**Final Status:** Infrastructure Maturity 100% 🎉

---

## Files Modified/Created

**New Files (12):**
- [ ] .claude/hooks/skill-activation/skill-activation-prompt.ts
- [ ] .claude/hooks/skill-activation/skill-activation-prompt.sh
- [ ] .claude/hooks/skill-activation/post-tool-use-tracker.ts
- [ ] .claude/hooks/skill-activation/post-tool-use-tracker.sh
- [ ] .claude/hooks/skill-activation/package.json
- [ ] .claude/hooks/skill-activation/tsconfig.json
- [ ] .claude/hooks/skill-activation/node_modules/ (auto-generated)
- [ ] .claude/hooks/skill-activation/dist/ (auto-generated)
- [ ] .claude/PLAN_SKILL_AUTO_ACTIVATION.md
- [ ] .claude/SKILL_AUTO_ACTIVATION_SUMMARY.md
- [ ] .claude/SKILL_AUTO_ACTIVATION_ROADMAP.md
- [ ] .claude/SKILL_ACTIVATION_GUIDE.md (to be created)

**Modified Files (4):**
- [ ] .claude/settings.json (hooks section added)
- [ ] .claude/skills/skill-rules.json (enhanced patterns)
- [ ] .claude/SESSION_PROGRESS.md (Phase 9 entry)
- [ ] CLAUDE.md (auto-activation section)

---

## Quick Commands Reference

```bash
# Create workspace
mkdir -p /home/novi/quotation-app-dev/.claude/hooks/skill-activation

# Download files (use full commands from plan)
cd /home/novi/quotation-app-dev/.claude/hooks/skill-activation
REPO_BASE="https://raw.githubusercontent.com/diet103/claude-code-infrastructure-showcase/main/.claude/hooks"
curl -o skill-activation-prompt.ts "$REPO_BASE/skill-activation-prompt.ts"
# ... (see full plan for all curl commands)

# Install dependencies
npm install

# Compile TypeScript
npx tsc

# Test execution
./skill-activation-prompt.sh --test

# Validate JSON
cat /home/novi/quotation-app-dev/.claude/settings.json | python3 -m json.tool
cat /home/novi/quotation-app-dev/.claude/skills/skill-rules.json | python3 -m json.tool

# Git workflow
git status
git add .
git commit -m "feat: Add skill auto-activation system"
git push origin dev
```

---

**Ready? Follow this checklist step-by-step for guaranteed success!**

**Estimated Time:** 1.5-2 hours
**Difficulty:** Medium (well-documented, low risk)
**Payoff:** Permanent improvement to every interaction

**Let's do this! 🚀**
