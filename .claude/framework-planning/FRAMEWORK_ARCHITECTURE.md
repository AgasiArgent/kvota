# Claude App Builder Framework - Technical Architecture
**Version:** 1.0  
**Created:** 2025-10-30

---

## System Overview

The Claude App Builder Framework is a meta-framework that generates opinionated project templates with built-in AI assistance. It consists of 6 major subsystems:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Tool (Node.js)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Wizard     │→ │Stack Selector│→ │ Project Generator    │ │
│  │ (12 Q's)     │  │  (AI logic)  │  │  (Template engine)   │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              Generated Project (User's App)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Stack Template (Rails/Next+Fast/Next+Supa/Django)      │  │
│  │   ├── Frontend/Backend Code                              │  │
│  │   ├── Example Features (Auth, CRUD, Exports)            │  │
│  │   └── Configuration Files                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  .claude/ Directory (Claude Code Integration)            │  │
│  │   ├── skills/ (Domain knowledge)                         │  │
│  │   ├── commands/ (Slash commands)                         │  │
│  │   ├── hooks/ (Quality gates)                             │  │
│  │   ├── agents/ (Specialized agents)                       │  │
│  │   └── CLAUDE.md (Project instructions)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│           Self-Learning System (Python)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Pattern      │→ │Skill         │→ │ Skill Activation     │ │
│  │ Extractor    │  │Generator     │  │ (Auto-learning)      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│         ↑ (Runs every 2 days via cron)                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│         Licensing & Telemetry Server (Node.js + DB)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ License      │  │ Usage        │  │ Update               │ │
│  │ Validation   │  │ Analytics    │  │ Distribution         │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Deep Dive

### 1. CLI Tool (Node.js)

**Responsibilities:**
- Interactive wizard for project requirements gathering
- AI-powered stack recommendation
- Project generation from templates
- License validation
- Update management

**Technology Stack:**
- Runtime: Node.js 18+
- CLI framework: Commander.js
- Interactive prompts: Inquirer.js
- Template engine: EJS
- File operations: fs-extra
- HTTP client: Axios

**Key Files:**
```
cli/
├── init.js              # Main entry point (npx create-claude-app)
├── wizard.js            # 12-question interactive wizard
├── stack-selector.js    # AI recommendation engine
├── project-generator.js # Template → Project transformation
├── license.js           # License validation & activation
├── updater.js           # Framework updates
└── utils/
    ├── file-ops.js      # File system operations
    ├── git.js           # Git initialization
    └── npm.js           # Dependency installation
```

**Wizard Flow:**
```javascript
// Simplified wizard logic
async function runWizard() {
  const answers = {};
  
  // Section 1: Project Basics (3 questions)
  answers.projectName = await askProjectName();
  answers.description = await askDescription();
  answers.businessType = await askBusinessType();
  
  // Section 2: Technical Requirements (4 questions)
  answers.userCount = await askUserCount();
  answers.dataVolume = await askDataVolume();
  answers.realTimeNeeds = await askRealTimeNeeds();
  answers.mobileFirst = await askMobileFirst();
  
  // Section 3: Team Context (3 questions)
  answers.teamSize = await askTeamSize();
  answers.techExperience = await askTechExperience();
  answers.timeline = await askTimeline();
  
  // Section 4: Feature Priorities (2 questions)
  answers.mustHaveFeatures = await askMustHaveFeatures();
  answers.integrations = await askIntegrations();
  
  return answers;
}
```

**Stack Selector Algorithm:**
```javascript
function selectStack(wizardAnswers) {
  // Scoring matrix
  const scores = {
    rails: { score: 0, reasons: [] },
    'nextjs-fastapi': { score: 0, reasons: [] },
    'nextjs-supabase': { score: 0, reasons: [] },
    django: { score: 0, reasons: [] }
  };
  
  // Rule-based scoring (30+ rules)
  applyTeamExperienceRules(scores, wizardAnswers);
  applyTechnicalRequirementRules(scores, wizardAnswers);
  applyTimelineRules(scores, wizardAnswers);
  applyFeaturePriorityRules(scores, wizardAnswers);
  
  // Pick winner
  const winner = Object.keys(scores).reduce((a, b) => 
    scores[a].score > scores[b].score ? a : b
  );
  
  return {
    recommended: winner,
    scores,
    reasoning: scores[winner].reasons
  };
}
```

**Project Generator:**
```javascript
async function generateProject(stackName, answers, targetDir) {
  // 1. Copy template files
  await copyTemplate(stackName, targetDir);
  
  // 2. Replace placeholders
  await replacePlaceholders(targetDir, {
    PROJECT_NAME: answers.projectName,
    DESCRIPTION: answers.description,
    // ... more placeholders
  });
  
  // 3. Initialize git
  await initGit(targetDir);
  
  // 4. Install dependencies
  await installDependencies(targetDir, stackName);
  
  // 5. Set up Claude Code config
  await setupClaudeConfig(targetDir, stackName, answers);
  
  // 6. Run initial setup scripts
  await runSetupScripts(targetDir, stackName);
  
  return {
    success: true,
    path: targetDir,
    nextSteps: generateNextSteps(stackName)
  };
}
```

---

### 2. Stack Templates

Each template is a complete, production-ready application scaffold.

**Directory Structure:**
```
templates/
├── rails/
│   ├── app/
│   ├── config/
│   ├── db/
│   ├── spec/
│   ├── .claude/
│   └── _variables.json        # Template variables
├── nextjs-fastapi/
│   ├── frontend/
│   ├── backend/
│   ├── .claude/
│   └── _variables.json
├── nextjs-supabase/
│   ├── src/
│   ├── supabase/
│   ├── .claude/
│   └── _variables.json
└── django/
    ├── apps/
    ├── config/
    ├── .claude/
    └── _variables.json
```

**Template Variables (_variables.json):**
```json
{
  "PROJECT_NAME": "My App",
  "DESCRIPTION": "Description here",
  "DATABASE_NAME": "myapp_production",
  "AUTHOR_NAME": "John Doe",
  "AUTHOR_EMAIL": "john@example.com",
  "DOMAIN": "myapp.com",
  "PORT_FRONTEND": 3000,
  "PORT_BACKEND": 8000
}
```

**Variable Replacement:**
All files containing variables use EJS syntax:
```ruby
# config/database.yml (Rails template)
production:
  database: <%= PROJECT_NAME %>_production
  username: <%= PROJECT_NAME %>
```

**Conditional Features:**
Some files only included based on wizard answers:
```javascript
// In project-generator.js
if (answers.authProvider === 'oauth') {
  await copyFile('oauth-config.js', targetDir);
}

if (answers.exports === true) {
  await copyFile('export-service.py', targetDir);
}
```

---

### 3. Skills System

**Architecture:**
```
.claude/skills/
├── shared/              # Universal skills (all stacks)
│   ├── test-driven-development/
│   ├── systematic-debugging/
│   ├── git-workflow/
│   └── security-checklist/
├── frontend/            # Frontend skills
│   ├── react-patterns/
│   ├── form-validation/
│   └── state-management/
├── backend/             # Backend skills
│   ├── api-design/
│   ├── database-patterns/
│   └── authentication/
├── database/            # Database skills
│   ├── postgresql-rls/
│   ├── migrations/
│   └── indexing/
└── project/             # Auto-generated project-specific skills
    ├── api-patterns-2025-10-30/
    └── form-patterns-2025-11-02/
```

**Skill Structure:**
```
skill-name/
├── SKILL.md              # Main skill file (Claude reads this)
├── resources/
│   ├── quick-reference.md
│   ├── patterns.md
│   └── examples.md
├── skill-info.json       # Metadata
└── activation-rules.json # When to activate
```

**Activation Rules (activation-rules.json):**
```json
{
  "file_patterns": [
    "**/*.tsx",
    "**/*.ts",
    "components/**/*.js"
  ],
  "keywords": [
    "React",
    "useState",
    "useEffect",
    "component"
  ],
  "manual_activation": false,
  "priority": 10
}
```

**Skill Loading Logic:**
```javascript
// In Claude Code MCP server
function shouldActivateSkill(skill, context) {
  const rules = skill.activationRules;
  
  // Check file patterns
  if (rules.file_patterns) {
    const fileMatch = rules.file_patterns.some(pattern => 
      minimatch(context.currentFile, pattern)
    );
    if (!fileMatch) return false;
  }
  
  // Check keywords
  if (rules.keywords) {
    const keywordMatch = rules.keywords.some(keyword =>
      context.userPrompt.toLowerCase().includes(keyword.toLowerCase())
    );
    if (!keywordMatch) return false;
  }
  
  return true;
}
```

---

### 4. Self-Learning System (Python)

**Runs as cron job every 2 days:**
```bash
# crontab entry (generated during project init)
0 2 */2 * * cd /path/to/project && python .claude/self-learning/extract.py
```

**Pattern Extractor Architecture:**

```python
class PatternExtractor:
    def __init__(self, project_root):
        self.project_root = project_root
        self.analyzers = {
            '.py': PythonAnalyzer(),
            '.js': JavaScriptAnalyzer(),
            '.tsx': TypeScriptAnalyzer(),
            '.rb': RubyAnalyzer()
        }
        self.patterns = defaultdict(list)
    
    def extract(self):
        # Walk project directory
        for file in self.find_source_files():
            analyzer = self.get_analyzer(file)
            file_patterns = analyzer.analyze(file)
            self.merge_patterns(file_patterns)
        
        # Post-process
        self.deduplicate()
        self.calculate_confidence()
        self.categorize()
        
        return self.patterns
```

**PythonAnalyzer (AST-based):**
```python
class PythonAnalyzer:
    def analyze(self, file_path):
        with open(file_path) as f:
            tree = ast.parse(f.read())
        
        patterns = {
            'api_endpoints': [],
            'database_queries': [],
            'error_handlers': [],
            'validators': []
        }
        
        for node in ast.walk(tree):
            # Pattern 1: API endpoints
            if self.is_api_endpoint(node):
                patterns['api_endpoints'].append(
                    self.extract_endpoint_pattern(node)
                )
            
            # Pattern 2: Database queries
            if self.is_database_query(node):
                patterns['database_queries'].append(
                    self.extract_query_pattern(node)
                )
            
            # Pattern 3: Error handlers
            if isinstance(node, ast.ExceptHandler):
                patterns['error_handlers'].append(
                    self.extract_error_pattern(node)
                )
        
        return patterns
    
    def is_api_endpoint(self, node):
        if not isinstance(node, ast.FunctionDef):
            return False
        
        # Check for decorators like @app.get, @router.post
        decorators = [self.get_decorator_name(d) 
                     for d in node.decorator_list]
        
        return any(d in ['get', 'post', 'put', 'delete', 'patch'] 
                  for d in decorators)
```

**Skill Generator:**
```python
class SkillGenerator:
    def generate_skill(self, category, patterns):
        # Filter high-confidence patterns
        high_conf = [p for p in patterns if p['confidence'] >= 70]
        
        if len(high_conf) < 3:
            return None  # Not enough data
        
        # Analyze common structure
        common = self.find_common_structure(high_conf)
        best_practices = self.extract_best_practices(high_conf)
        anti_patterns = self.find_anti_patterns(patterns)
        
        # Generate markdown
        skill_md = f"""
# {category} Patterns (Auto-generated)

## Overview
{self.generate_overview(patterns)}

## Common Structure
{common}

## Best Practices
{best_practices}

## Anti-Patterns
{anti_patterns}

## Examples
{self.generate_examples(high_conf[:5])}
"""
        
        # Save to .claude/skills/project/
        self.save_skill(category, skill_md)
        
        return skill_md
```

**Review Workflow:**
```bash
# User runs this after cron generates new skills
$ claude-app review-patterns

🔍 Analyzing codebase for new patterns...

📚 Found 3 new skills:
  1. API Endpoint Patterns (confidence: 85%, 12 examples)
  2. Form Validation Patterns (confidence: 78%, 8 examples)
  3. Database Query Patterns (confidence: 72%, 15 examples)

=== API Endpoint Patterns ===
Category: API Design
Confidence: 85%
Based on: 12 code examples

Preview:
---
# API Endpoint Patterns

## Common Structure
All API endpoints follow this pattern:
1. Validate input with Pydantic
2. Check user permissions
3. Execute business logic
4. Return standardized response

## Best Practices
- Always use type hints
- Include error handling
- Log all API calls
- Return consistent status codes
---

What would you like to do?
> Approve and activate

✅ Skill activated! Will be available in next Claude session.
```

---

### 5. Automation System

**Slash Commands:**

Commands are markdown files with executable code blocks:

```markdown
# /generate-crud Command

Create a complete CRUD interface for an entity.

## Usage
```
/generate-crud EntityName
```

## What it does
1. Creates database model
2. Generates API endpoints
3. Creates frontend UI
4. Adds tests
5. Updates routes

## Implementation

```bash
# Step 1: Gather requirements
echo "Creating CRUD for $1..."

# Step 2: Detect stack
STACK=$(detect_stack)

# Step 3: Run stack-specific generator
if [ "$STACK" = "rails" ]; then
  rails generate scaffold $1
elif [ "$STACK" = "django" ]; then
  python manage.py generate_crud $1
elif [ "$STACK" = "nextjs-fastapi" ]; then
  python backend/cli/generate_crud.py $1
  npx next-crud-gen $1
fi

# Step 4: Run tests
run_tests

echo "✅ CRUD for $1 created successfully!"
```
```

**Git Hooks:**

Hooks are shell scripts installed via Husky:

```bash
# .claude/hooks/pre-commit.sh
#!/bin/bash

echo "🔍 Running pre-commit checks..."

# Detect stack
if [ -f "Gemfile" ]; then
  # Rails
  bundle exec rubocop
  bundle exec rspec --fail-fast
elif [ -f "backend/requirements.txt" ]; then
  # Next+FastAPI
  cd backend && pytest && pylint *.py
  cd frontend && npm run type-check && npm run lint
elif [ -f "manage.py" ]; then
  # Django
  python manage.py test --fail-fast
  pylint apps/**/*.py
fi

if [ $? -ne 0 ]; then
  echo "❌ Pre-commit checks failed!"
  exit 1
fi

echo "✅ All checks passed!"
```

---

### 6. Licensing & Telemetry Server

**Technology:**
- Runtime: Node.js 18+
- Database: PostgreSQL
- API: Express.js
- Payment: Stripe API

**Database Schema:**
```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  tier TEXT NOT NULL, -- 'beta' or 'full'
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  license_id UUID REFERENCES licenses(id),
  event_type TEXT NOT NULL, -- 'wizard_complete', 'project_generated', etc.
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  license_id UUID REFERENCES licenses(id),
  name TEXT NOT NULL,
  stack TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP
);
```

**License Validation API:**
```javascript
// POST /api/licenses/validate
app.post('/api/licenses/validate', async (req, res) => {
  const { key } = req.body;
  
  // Look up license
  const license = await db.query(
    'SELECT * FROM licenses WHERE key = $1',
    [key]
  );
  
  if (!license || !license.active) {
    return res.status(403).json({
      valid: false,
      error: 'Invalid or expired license'
    });
  }
  
  // Check expiration
  if (license.expires_at && new Date() > license.expires_at) {
    return res.status(403).json({
      valid: false,
      error: 'License expired'
    });
  }
  
  // Return user info
  res.json({
    valid: true,
    tier: license.tier,
    email: license.email,
    expires_at: license.expires_at
  });
});
```

**Telemetry Collection (opt-in):**
```javascript
// CLI sends events
async function trackEvent(eventType, metadata) {
  const license = getLicenseFromCache();
  
  if (!license || !license.telemetryEnabled) {
    return; // User opted out
  }
  
  await axios.post('https://api.claude-app-builder.com/events', {
    license_id: license.id,
    event_type: eventType,
    metadata
  });
}

// Usage in CLI
await trackEvent('project_generated', {
  stack: 'nextjs-fastapi',
  features: ['auth', 'exports'],
  timestamp: Date.now()
});
```

---

## Data Flow

### End-to-End: Project Generation

```
1. User runs: npx create-claude-app
   ↓
2. CLI validates license (call API)
   ↓
3. CLI runs wizard (12 questions)
   ↓
4. Wizard answers sent to stack-selector
   ↓
5. AI recommends stack (scoring algorithm)
   ↓
6. User confirms or overrides
   ↓
7. CLI calls project-generator
   ├── Copy template files
   ├── Replace variables (EJS)
   ├── Initialize git repo
   ├── Install dependencies (npm/pip/bundle)
   └── Setup Claude Code config
   ↓
8. CLI shows next steps
   ↓
9. User runs: cd my-project && [start dev server]
   ↓
10. Claude Code auto-activates skills based on files
   ↓
11. User builds features with Claude assistance
   ↓
12. Every 2 days: cron runs pattern extraction
   ├── Analyze code changes
   ├── Extract patterns
   ├── Generate new skills
   └── Prompt user for review
   ↓
13. User reviews and approves new skills
   ↓
14. Skills activated in Claude Code
   ↓
15. Framework learns and improves over time
```

---

## Security Considerations

**1. License Key Protection:**
- Keys stored in `~/.claude-app-builder/license` (chmod 600)
- Encrypted with machine-specific salt
- Server-side validation on every CLI run

**2. Template Code Security:**
- All templates security-audited
- No hardcoded secrets
- Environment variables for sensitive config
- OWASP Top 10 prevention built-in

**3. Self-Learning Privacy:**
- Pattern extraction runs locally only
- No code sent to server (unless user opts in)
- Generated skills reviewed before activation
- User can disable self-learning entirely

**4. Telemetry:**
- Opt-in only (prompt during setup)
- Anonymous usage data (no code snippets)
- Clear privacy policy
- Easy opt-out anytime

---

## Scalability

**Licensing Server:**
- Horizontal scaling with load balancer
- Database: PostgreSQL with read replicas
- Cache: Redis for license validation
- CDN: CloudFront for template distribution

**Expected Load:**
- Beta: 50 users, ~100 requests/day
- Month 1: 500 users, ~2,000 requests/day
- Month 6: 5,000 users, ~25,000 requests/day

**Bottlenecks:**
- Template downloads (solved by CDN)
- License validation (solved by Redis cache)
- Database writes (solved by async queues)

---

## Technology Choices

**Why Node.js for CLI?**
- Universal (works on Mac/Linux/Windows)
- Rich ecosystem (inquirer, commander, etc.)
- npm distribution (familiar to developers)
- Fast iteration

**Why Python for Self-Learning?**
- AST parsing (superior to regex)
- ML/AI libraries (future: LLM integration)
- Easy to extend (plugins for new languages)

**Why PostgreSQL for Licensing?**
- Reliable
- JSONB for flexible metadata
- Easy to query
- Cheap to host

**Why EJS for Templates?**
- Simple syntax (`<%= variable %>`)
- Supports conditionals and loops
- Works with any file type
- No complex build step

---

## Future Architecture Enhancements

**Version 1.1:**
- Add Redis for caching
- Add background job queue (Bull.js)
- Add real-time notifications (Socket.io)
- Add skill marketplace (S3 + API)

**Version 2.0:**
- Add visual builder (React + Canvas API)
- Add LLM integration (Claude API for code generation)
- Add collaborative features (WebRTC)
- Add cloud deployment automation (Terraform)

---

**End of Architecture Document**

