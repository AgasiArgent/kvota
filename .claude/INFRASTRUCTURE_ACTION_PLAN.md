# Infrastructure Action Plan - Skill Auto-Activation Implementation

**Date:** 2025-10-30
**Priority:** 🚨 CRITICAL - Implement TODAY
**Estimated Time:** 2 hours
**Impact:** Skills will auto-activate, solving the #1 Claude Code problem

---

## Phase 1: Immediate Implementation (0-2 hours)

### Step 1: Create skill-rules.json (15 min)

Create the skill activation configuration tailored to our project:

```bash
# Create skill-rules.json for our 4 skills
cat > /home/novi/quotation-app-dev/.claude/skills/skill-rules.json << 'EOF'
{
  "version": "1.0",
  "description": "Skill activation triggers for B2B Quotation Platform",
  "skills": {
    "frontend-dev-guidelines": {
      "type": "domain",
      "enforcement": "suggest",
      "priority": "high",
      "description": "Frontend patterns for Next.js, React, Ant Design, ag-Grid",
      "promptTriggers": {
        "keywords": [
          "component", "React", "Ant Design", "ag-Grid",
          "frontend", "UI", "page", "form", "modal",
          "Next.js", "TypeScript", "quote creation"
        ],
        "intentPatterns": [
          "(create|update|fix|modify).*?(component|page|UI|form)",
          "(add|implement).*?(feature|functionality).*?frontend",
          "ag-Grid.*?(configuration|setup|issue)"
        ]
      },
      "fileTriggers": {
        "pathPatterns": [
          "frontend/**/*.tsx",
          "frontend/**/*.ts",
          "frontend/src/components/**/*",
          "frontend/src/pages/**/*"
        ],
        "contentPatterns": [
          "import.*from.*antd",
          "import.*ag-grid",
          "export.*Component",
          "NextPage"
        ]
      }
    },
    "backend-dev-guidelines": {
      "type": "domain",
      "enforcement": "suggest",
      "priority": "high",
      "description": "Backend patterns for FastAPI, Supabase, Python",
      "promptTriggers": {
        "keywords": [
          "FastAPI", "endpoint", "API", "route", "Supabase",
          "RLS", "backend", "Python", "Pydantic", "validation",
          "authentication", "JWT", "database", "PostgreSQL"
        ],
        "intentPatterns": [
          "(create|add|implement).*?(endpoint|API|route)",
          "(fix|debug|handle).*?(error|exception|backend)",
          "(implement|add).*?(validation|authentication|RLS)"
        ]
      },
      "fileTriggers": {
        "pathPatterns": [
          "backend/**/*.py",
          "backend/routes/**/*.py",
          "backend/models/**/*.py",
          "backend/services/**/*.py"
        ],
        "contentPatterns": [
          "from fastapi",
          "@router\\.",
          "async def",
          "supabase\\.",
          "BaseModel"
        ]
      }
    },
    "calculation-engine-guidelines": {
      "type": "guardrail",
      "enforcement": "block",
      "priority": "critical",
      "description": "13-phase calculation engine with 42 variables",
      "promptTriggers": {
        "keywords": [
          "calculation", "variable", "mapper", "13-phase",
          "quote calculation", "pricing", "customs", "VAT",
          "admin variables", "two-tier", "product override"
        ],
        "intentPatterns": [
          "(modify|change|update).*?(calculation|variable|mapper)",
          "(implement|fix).*?(calculation|pricing)",
          "calculate.*?(quote|price|total)"
        ]
      },
      "fileTriggers": {
        "pathPatterns": [
          "backend/routes/quotes_calc.py",
          "backend/**/*mapper*.py",
          "backend/**/*calculation*.py",
          "backend/models/calculation*.py"
        ],
        "contentPatterns": [
          "map_variables_to_calculation",
          "CalculationInput",
          "calculate_quote",
          "admin_settings"
        ]
      },
      "blockMessage": "⚠️ BLOCKED - Calculation Engine Protection\\n\\n📋 REQUIRED ACTION:\\n1. Use Skill tool: 'calculation-engine-guidelines'\\n2. Review 13-phase pipeline\\n3. Check 42 variables documentation\\n4. Validate mapper patterns\\n\\nReason: Critical business logic - must follow patterns\\nFile: {file_path}"
    },
    "database-verification": {
      "type": "guardrail",
      "enforcement": "block",
      "priority": "critical",
      "description": "Database schema and RLS security guardrails",
      "promptTriggers": {
        "keywords": [
          "RLS", "Row Level Security", "migration", "database",
          "schema", "table", "policy", "multi-tenant", "organization_id",
          "PostgreSQL", "Supabase", "security"
        ],
        "intentPatterns": [
          "(create|modify|alter).*?(table|schema|policy)",
          "(implement|add).*?(RLS|security|policy)",
          "migration.*?(database|schema)"
        ]
      },
      "fileTriggers": {
        "pathPatterns": [
          "backend/migrations/**/*.sql",
          "backend/**/*schema*.py",
          "backend/**/*migration*.py",
          "supabase/**/*.sql"
        ],
        "contentPatterns": [
          "CREATE TABLE",
          "ALTER TABLE",
          "CREATE POLICY",
          "RLS",
          "organization_id"
        ]
      },
      "blockMessage": "⚠️ BLOCKED - Database Security Check Required\\n\\n📋 REQUIRED ACTION:\\n1. Use Skill tool: 'database-verification'\\n2. Review RLS patterns\\n3. Check multi-tenant security\\n4. Validate migration checklist\\n\\nReason: Multi-tenant security critical\\nFile: {file_path}",
      "skipConditions": {
        "sessionSkillUsed": true,
        "fileMarkers": ["@skip-rls-check"]
      }
    }
  },
  "notes": {
    "customization": {
      "pathPatterns": "Adjusted for our Next.js + FastAPI structure",
      "keywords": "Added domain-specific terms (quotation, B2B, etc.)",
      "enforcement": "calculation and database skills use 'block' for safety"
    }
  }
}
EOF
```

### Step 2: Download and Adapt Their Hooks (30 min)

We need to fetch their actual hook implementations:

```bash
# Create hooks directory if not exists
mkdir -p /home/novi/quotation-app-dev/.claude/hooks

# Download skill-activation-prompt.sh
curl -o /home/novi/quotation-app-dev/.claude/hooks/skill-activation-prompt.sh \
  https://raw.githubusercontent.com/diet103/claude-code-infrastructure-showcase/main/.claude/hooks/skill-activation-prompt.sh

# Download skill-activation-prompt.ts
curl -o /home/novi/quotation-app-dev/.claude/hooks/skill-activation-prompt.ts \
  https://raw.githubusercontent.com/diet103/claude-code-infrastructure-showcase/main/.claude/hooks/skill-activation-prompt.ts

# Download post-tool-use-tracker.sh
curl -o /home/novi/quotation-app-dev/.claude/hooks/post-tool-use-tracker.sh \
  https://raw.githubusercontent.com/diet103/claude-code-infrastructure-showcase/main/.claude/hooks/post-tool-use-tracker.sh

# Download package.json for TypeScript hooks
curl -o /home/novi/quotation-app-dev/.claude/hooks/package.json \
  https://raw.githubusercontent.com/diet103/claude-code-infrastructure-showcase/main/.claude/hooks/package.json

# Download tsconfig.json
curl -o /home/novi/quotation-app-dev/.claude/hooks/tsconfig.json \
  https://raw.githubusercontent.com/diet103/claude-code-infrastructure-showcase/main/.claude/hooks/tsconfig.json

# Make hooks executable
chmod +x /home/novi/quotation-app-dev/.claude/hooks/*.sh

# Install hook dependencies
cd /home/novi/quotation-app-dev/.claude/hooks && npm install
```

### Step 3: Update settings.json (15 min)

Add hook configurations to enable auto-activation:

```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "chrome-devtools",
    "postgres",
    "github",
    "puppeteer",
    "ide"
  ],
  "permissions": {
    "allow": [
      "Edit:*",
      "Write:*",
      "MultiEdit:*",
      "NotebookEdit:*",
      "Bash:*"
    ],
    "defaultMode": "acceptEdits"
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/skill-activation-prompt.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/post-tool-use-tracker.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-check.sh"
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-imports.sh"
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-dependencies.sh"
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/run-tests.sh"
          }
        ]
      }
    ]
  }
}
```

### Step 4: Test Auto-Activation (30 min)

Test scenarios to verify it works:

1. **Prompt Trigger Test:**
   - Say: "Help me create a new React component"
   - Should suggest: frontend-dev-guidelines

2. **File Trigger Test:**
   - Edit: `frontend/src/components/SomeComponent.tsx`
   - Should activate: frontend-dev-guidelines

3. **Keyword Trigger Test:**
   - Say: "I need to add RLS policies"
   - Should suggest: database-verification

4. **Block Test (Guardrail):**
   - Try to edit: `backend/routes/quotes_calc.py`
   - Should block and require: calculation-engine-guidelines

### Step 5: Document Changes (30 min)

Update our documentation:

1. **Update CLAUDE.md:**
   - Add skill auto-activation section
   - Document new hooks
   - Add skill-rules.json reference

2. **Update SESSION_PROGRESS.md:**
   - Mark Phase 9: Skill Auto-Activation as complete
   - Document what was implemented
   - Note any issues or tweaks needed

3. **Create SKILL_ACTIVATION_GUIDE.md:**
   - How to add new skill triggers
   - How to customize enforcement levels
   - Troubleshooting guide

---

## Phase 2: Skill Refactoring (This Week - 4 hours)

### Priority Order:
1. **frontend-dev-guidelines** - Break into 11 resource files
2. **backend-dev-guidelines** - Break into 12 resource files
3. **calculation-engine-guidelines** - Break into 7 resource files
4. **database-verification** - Break into 4 resource files

### Resource File Structure:
```
frontend-dev-guidelines/
├── SKILL.md (< 500 lines - overview)
└── resources/
    ├── component-patterns.md
    ├── state-management.md
    ├── api-integration.md
    ├── ag-grid-configuration.md
    ├── ant-design-patterns.md
    ├── performance-optimization.md
    ├── testing-patterns.md
    ├── typescript-standards.md
    ├── routing-navigation.md
    ├── error-handling.md
    └── deployment-build.md
```

---

## Phase 3: Enhancement (Next Week - 4 hours)

### 1. Create CLAUDE_INTEGRATION_GUIDE.md
- How to integrate our infrastructure
- Tech stack requirements
- Customization guide
- Troubleshooting

### 2. Add Dev Docs Commands
- `/dev-docs` - Create structured documentation
- `/dev-docs-update` - Update before context reset

### 3. Add Missing Agents (Optional)
- documentation-architect
- web-research-specialist

---

## Success Metrics

### Immediate (After Phase 1):
- [ ] Skills auto-suggest when keywords mentioned
- [ ] Skills activate when editing relevant files
- [ ] Guardrail skills block dangerous operations
- [ ] No manual skill activation needed

### Medium-term (After Phase 2):
- [ ] Skills load progressively without context exhaustion
- [ ] Each skill < 500 lines main file
- [ ] Resource files load only when needed
- [ ] Better organization and maintainability

### Long-term (After Phase 3):
- [ ] Infrastructure is shareable/reusable
- [ ] Other projects can adopt our patterns
- [ ] Complete documentation available
- [ ] Showcase repository created

---

## Risk Mitigation

### Potential Issues:
1. **Hooks fail to execute**
   - Solution: Check permissions, ensure executable
   - Test: Run manually first

2. **TypeScript compilation errors**
   - Solution: Ensure Node.js/npm installed in WSL2
   - Test: Compile TypeScript hooks manually

3. **Skill triggers too aggressive**
   - Solution: Refine patterns, add exclusions
   - Test: Monitor false positives

4. **Context exhaustion with current large skills**
   - Solution: Prioritize Phase 2 refactoring
   - Workaround: Load skills selectively

---

## Commands to Execute NOW

```bash
# 1. Switch to dev branch
cd /home/novi/quotation-app-dev
git checkout dev

# 2. Create skill-rules.json (copy from Step 1 above)

# 3. Download hooks (copy commands from Step 2 above)

# 4. Update settings.json (copy from Step 3 above)

# 5. Test it works
echo "Testing skill activation..."
# Try editing a frontend file
# Try mentioning "calculation engine"
# Verify skills auto-activate

# 6. Commit changes
git add -A
git commit -m "feat: Implement skill auto-activation system (Phase 9)

- Add skill-rules.json with triggers for all 4 skills
- Add UserPromptSubmit and PostToolUse hooks
- Update settings.json with hook configuration
- Enable auto-activation based on keywords and file patterns
- Add guardrail blocking for critical skills

This implements the breakthrough feature from the Reddit developer's
infrastructure, solving the #1 problem with Claude Code skills."

# 7. Push to dev branch
git push origin dev
```

---

**Next Steps:**
1. Execute Phase 1 commands above (2 hours)
2. Test thoroughly
3. Document in SESSION_PROGRESS.md
4. Plan Phase 2 refactoring for this week

**Expected Outcome:**
Skills will finally "just work" - activating automatically when needed instead of requiring manual invocation. This is the game-changer that makes Claude Code truly effective.

---

*Action Plan Created: 2025-10-30*
*Priority: CRITICAL - Implement TODAY*
*Effort: 2 hours for Phase 1*