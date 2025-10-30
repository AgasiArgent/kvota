# Orchestrator Autonomy Test Guide

**Created:** 2025-10-30
**Purpose:** Verify Phase 5 autonomous detection works correctly

---

## Pre-Test Setup

### 1. Verify Configuration

```bash
# Check orchestrator config exists
cat .claude/orchestrator-config.json

# Expected: autonomous_invocation = true
```

### 2. Clean Working Directory

```bash
# Ensure no uncommitted changes
git status

# If changes exist, commit or stash them
git stash  # or git commit
```

---

## Test Scenarios

### Test 1: Small Change (Should NOT Trigger)

**Setup:**
```bash
# Make a small bug fix (< 50 lines, 1 file)
echo "# Small test change" >> frontend/README.md
```

**Expected Behavior:**
- Orchestrator does NOT auto-detect
- No prompt appears
- Must call "@orchestrator" manually to run

**Verification:**
```bash
git diff --stat
# Should show: 1 file changed, 1 insertion(+)
```

**Cleanup:**
```bash
git checkout -- frontend/README.md
```

---

### Test 2: Large Change (Should Trigger)

**Setup:**
```bash
# Simulate large feature (200+ lines, multiple files)
cat << 'EOF' > frontend/src/test-component.tsx
// Large test component (200+ lines)
import React from 'react';
export const TestComponent = () => {
  // ... imagine 200 lines of code here ...
  return <div>Test</div>;
};
EOF

# Add backend change
cat << 'EOF' > backend/test_route.py
# Test route (50+ lines)
from fastapi import APIRouter
router = APIRouter()
@router.get("/test")
async def test_endpoint():
    # ... imagine 50 lines here ...
    return {"status": "ok"}
EOF
```

**Expected Behavior:**
1. Orchestrator detects changes
2. Prompts: "I detect feature completion... Run quality checks now?"
3. User can respond "yes" or "no"
4. If "yes" → Runs full workflow
5. If "no" → Exits gracefully

**Verification:**
```bash
git diff --stat
# Should show: 2 files changed, 250+ insertions
```

**Cleanup:**
```bash
rm frontend/src/test-component.tsx backend/test_route.py
```

---

### Test 3: Frontend + Backend Change (Should Trigger)

**Setup:**
```bash
# Small changes but in both areas
echo "// test" >> frontend/src/app/page.tsx
echo "# test" >> backend/main.py
```

**Expected Behavior:**
- Even though < 200 lines, should trigger (both areas changed)
- Prompts for confirmation
- Shows "Areas: frontend + backend"

**Verification:**
```bash
git diff --name-only | grep -E '^(frontend|backend)/' | cut -d'/' -f1 | sort -u
# Should output both: frontend, backend
```

**Cleanup:**
```bash
git checkout -- frontend/src/app/page.tsx backend/main.py
```

---

### Test 4: Doc-Only Change (Should NOT Trigger)

**Setup:**
```bash
# Large documentation change
for i in {1..10}; do
  echo "Documentation line $i" >> README.md
  echo "More docs $i" >> .claude/TEST.md
done
```

**Expected Behavior:**
- Even though many lines, should NOT trigger (docs only)
- No prompt appears
- Silent unless explicitly called

**Verification:**
```bash
git diff --name-only
# Should show only .md files
```

**Cleanup:**
```bash
git checkout -- README.md
rm .claude/TEST.md
```

---

### Test 5: Test-Only Change (Should NOT Trigger)

**Setup:**
```bash
# Add test files
echo "test content" > backend/test_example.py
echo "test content" > frontend/src/app.test.tsx
```

**Expected Behavior:**
- Should NOT trigger (test files excluded)
- No prompt appears

**Verification:**
```bash
git diff --name-only | grep -E '(test_.*\.py|.*\.test\.tsx?)'
# Should show test files only
```

**Cleanup:**
```bash
rm backend/test_example.py frontend/src/app.test.tsx
```

---

### Test 6: Explicit Call (Always Works)

**Setup:**
```bash
# Any change (even tiny)
echo "# tiny" >> README.md
```

**Action:**
- User types: "@orchestrator"

**Expected Behavior:**
- Immediately starts workflow (skips STEP 0)
- No detection prompt
- Goes straight to STEP 1

**Cleanup:**
```bash
git checkout -- README.md
```

---

### Test 7: Disabled Autonomous Mode

**Setup:**
```bash
# Temporarily disable autonomous invocation
cat .claude/orchestrator-config.json | \
  sed 's/"autonomous_invocation": true/"autonomous_invocation": false/' > \
  .claude/orchestrator-config-temp.json
mv .claude/orchestrator-config-temp.json .claude/orchestrator-config.json

# Make large change
echo "large change" >> frontend/src/app/page.tsx
# ... add 200+ lines ...
```

**Expected Behavior:**
- No auto-detection (disabled in config)
- Must call "@orchestrator" manually
- Manual call still works

**Cleanup:**
```bash
# Re-enable autonomous mode
cat .claude/orchestrator-config.json | \
  sed 's/"autonomous_invocation": false/"autonomous_invocation": true/' > \
  .claude/orchestrator-config-temp.json
mv .claude/orchestrator-config-temp.json .claude/orchestrator-config.json

git checkout -- frontend/src/app/page.tsx
```

---

## Edge Cases

### Edge 1: Exactly at Threshold

```bash
# Exactly 200 lines (should trigger)
# Exactly 5 files (should trigger)
```

### Edge 2: Mixed Valid/Invalid Responses

```
Orchestrator: "Run quality checks now?"
User: "maybe"
Orchestrator: "Please respond with 'yes' or 'no'"
User: "yes"
Orchestrator: [Proceeds with workflow]
```

### Edge 3: Keywords in Conversation

```
User: "I'm done with feature X"
Orchestrator: [Should detect keyword and prompt]
```

### Edge 4: Commit Message Patterns

```bash
# These commits should NOT trigger detection:
git commit -m "docs: Update README"
git commit -m "chore: Update dependencies"
git commit -m "style: Format code"
git commit -m "test: Add unit tests"
git commit -m "ci: Update GitHub Actions"
```

---

## Success Metrics

### ✅ Detection Works When:
1. Large changes trigger prompt (200+ lines OR 5+ files)
2. Frontend + backend changes trigger (even if small)
3. Explicit "@orchestrator" bypasses detection
4. User can decline auto-detection
5. Config flags are respected

### ✅ Detection Skips When:
1. Small changes (< 50 lines AND single file)
2. Doc-only changes (.md files)
3. Config-only changes (.json/.yaml files)
4. Test-only changes (test_*.py, *.test.ts)
5. CI/CD changes (.github/workflows/*)
6. Autonomous mode disabled in config

### ✅ Workflow Runs When:
1. User confirms auto-detection prompt
2. User explicitly calls "@orchestrator"
3. All agents run in parallel
4. Documentation gets updated
5. Git workflow completes

---

## Verification Checklist

- [ ] Config file exists at `.claude/orchestrator-config.json`
- [ ] Orchestrator.md has STEP 0: Feature Detection
- [ ] Small changes don't trigger detection
- [ ] Large changes do trigger detection
- [ ] Frontend + backend trigger even if small
- [ ] Doc-only changes don't trigger
- [ ] Test-only changes don't trigger
- [ ] Explicit call always works
- [ ] Config flags disable/enable correctly
- [ ] User can decline auto-detection
- [ ] Parallel agent execution works
- [ ] Documentation gets updated

---

## Troubleshooting

### Issue: Detection not triggering

Check:
1. Is `autonomous_invocation: true` in config?
2. Are changes above thresholds (200 lines or 5 files)?
3. Are files in skip patterns (docs, tests, config)?

### Issue: Detection triggering too often

Adjust thresholds in `.claude/orchestrator-config.json`:
```json
"detection_thresholds": {
  "min_lines_changed": 300,  // Increase from 200
  "min_files_changed": 7      // Increase from 5
}
```

### Issue: Wrong files triggering

Add to skip patterns:
```json
"skip_detection_for": {
  "file_patterns": [
    "**/*.generated.ts",  // Add generated files
    "**/migrations/*.sql"  // Add migrations
  ]
}
```

---

## Report Template

After testing, report:

```markdown
## Orchestrator Autonomy Test Report

**Date:** 2025-10-30
**Tester:** [Name]

### Results:
- Test 1 (Small Change): ✅ Passed / ❌ Failed
- Test 2 (Large Change): ✅ Passed / ❌ Failed
- Test 3 (Frontend+Backend): ✅ Passed / ❌ Failed
- Test 4 (Doc-Only): ✅ Passed / ❌ Failed
- Test 5 (Test-Only): ✅ Passed / ❌ Failed
- Test 6 (Explicit Call): ✅ Passed / ❌ Failed
- Test 7 (Disabled Mode): ✅ Passed / ❌ Failed

### Issues Found:
[List any problems]

### Recommendations:
[Suggest improvements]
```

---

**Ready for Testing!** Follow this guide to verify Phase 5 implementation.