# Claude App Builder Framework - Implementation Plan
**Version:** 1.0  
**Created:** 2025-10-30  
**Target Launch:** 30 days from now (2025-11-29)  
**Product Type:** Paid Framework ($399, beta $199)

---

## Executive Summary

Build a comprehensive framework that enables non-technical entrepreneurs to build 95% of business apps in 2 weeks using Claude Code. The framework includes:

1. **Setup Wizard** - 12-question onboarding that selects optimal stack
2. **4 Stack Templates** - Rails, Next.js+FastAPI, Next.js+Supabase, Django
3. **Self-Learning System** - Extracts patterns every 2 days, generates skills
4. **Skills Library** - Pre-built domain skills + auto-generated project skills
5. **Automated Workflows** - Slash commands, hooks, quality gates
6. **Documentation System** - Dev docs for context preservation

**Key Innovation:** Framework learns from each project and improves itself automatically.

---

## Phase 1: Foundation & Architecture (Days 1-3, 24 hours)

### Objectives
- Define framework architecture and file structure
- Create packaging and distribution mechanism
- Build core CLI tool for initialization

### Tasks

#### 1.1 Framework Directory Structure (4 hours)
**Files to create:**
```
claude-app-builder/
├── cli/
│   ├── init.js               # Main initialization CLI
│   ├── wizard.js             # Interactive 12-question wizard
│   ├── stack-selector.js     # AI-powered stack recommendation
│   └── project-generator.js  # Creates project from template
├── templates/
│   ├── rails/                # Rails 7 template
│   ├── nextjs-fastapi/       # Next.js 15 + FastAPI template
│   ├── nextjs-supabase/      # Next.js 15 + Supabase template
│   └── django/               # Django 5 template
├── skills/
│   ├── shared/               # Universal skills (TDD, debugging, etc.)
│   ├── frontend/             # Frontend-specific skills
│   ├── backend/              # Backend-specific skills
│   └── database/             # Database-specific skills
├── automation/
│   ├── hooks/                # Git hooks and workflow hooks
│   ├── commands/             # Slash commands
│   └── scripts/              # Utility scripts
├── self-learning/
│   ├── pattern-extractor.py  # Extracts patterns from projects
│   ├── skill-generator.py    # Generates new skills
│   └── analyzer.py           # Analyzes codebase changes
├── docs/
│   ├── getting-started.md
│   ├── wizard-guide.md
│   ├── stack-guide.md
│   └── self-learning-guide.md
└── package.json              # npm package configuration
```

**Deliverables:**
- Directory structure created
- package.json with dependencies
- README.md with overview

**Reference from quotation-app:**
- `.claude/skills/` structure → Extract to `skills/shared/`
- `.claude/hooks/` → Extract to `automation/hooks/`
- `.claude/commands/` → Extract to `automation/commands/`

---

#### 1.2 Core CLI Tool (8 hours)

**Command:** `npx create-claude-app`

**Flow:**
1. Welcome message with framework overview
2. Run 12-question wizard
3. AI analyzes answers and recommends stack
4. User confirms or overrides recommendation
5. Generate project from selected template
6. Initialize git repository
7. Install dependencies
8. Set up Claude Code configuration
9. Display next steps

**Technology:**
- Node.js CLI with `inquirer` for interactive prompts
- `commander` for command parsing
- `chalk` for colored output
- `ora` for loading spinners
- `fs-extra` for file operations

**Files to create:**
```javascript
// cli/init.js
#!/usr/bin/env node
const { Command } = require('commander');
const wizard = require('./wizard');
const generator = require('./project-generator');

const program = new Command();

program
  .name('create-claude-app')
  .description('Create a new business app with Claude App Builder Framework')
  .version('1.0.0')
  .option('-t, --template <stack>', 'Specify stack template directly')
  .option('-n, --name <name>', 'Project name')
  .option('--skip-wizard', 'Skip wizard and use defaults')
  .action(async (options) => {
    // Implementation here
  });

program.parse();
```

**Testing:**
- Test on clean system (Docker container)
- Verify all templates generate correctly
- Test wizard flow with different answers
- Test error handling and rollback

**Time breakdown:**
- CLI scaffolding: 2 hours
- Wizard integration: 3 hours
- Generator logic: 2 hours
- Testing & debugging: 1 hour

---

#### 1.3 Package Configuration (4 hours)

**Create npm package:**
```json
{
  "name": "@claude-code/app-builder",
  "version": "1.0.0-beta.1",
  "description": "Build 95% of business apps in 2 weeks with AI",
  "bin": {
    "create-claude-app": "./cli/init.js"
  },
  "keywords": ["claude", "ai", "app-builder", "framework", "no-code"],
  "repository": "github:YOUR_ORG/claude-app-builder",
  "license": "Commercial",
  "pricing": {
    "full": "$399",
    "beta": "$199"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0",
    "fs-extra": "^11.1.0",
    "axios": "^1.6.0"
  }
}
```

**Distribution mechanism:**
- Private npm registry (Verdaccio) for beta
- License key validation on `npx create-claude-app`
- Phone-home to track usage (with user consent)

**Licensing system:**
```javascript
// cli/license.js
async function validateLicense(key) {
  // Call licensing API
  // Store valid license in ~/.claude-app-builder/license
  // Return user info (name, email, tier)
}
```

**Time breakdown:**
- Package configuration: 1 hour
- License validation system: 2 hours
- Testing & documentation: 1 hour

---

#### 1.4 Documentation Templates (8 hours)

**Create comprehensive docs:**

1. **getting-started.md** (2 hours)
   - Installation instructions
   - First project walkthrough
   - Basic concepts explanation
   - Troubleshooting section

2. **wizard-guide.md** (2 hours)
   - Each question explained in detail
   - How AI recommendation works
   - When to override recommendations
   - Examples of different project types

3. **stack-guide.md** (3 hours)
   - Deep dive into each stack template
   - Technology choices and tradeoffs
   - When to use which stack
   - Migration paths between stacks

4. **self-learning-guide.md** (1 hour)
   - How pattern extraction works
   - What gets learned automatically
   - How to review and approve patterns
   - Privacy and data handling

**Reference from quotation-app:**
- Extract documentation patterns from `.claude/CLAUDE.md`
- Use SESSION_PROGRESS.md format for tracking
- Copy skills documentation structure

---

### Phase 1 Deliverables

✅ Complete framework directory structure  
✅ Working CLI tool (`npx create-claude-app`)  
✅ Package configuration with licensing  
✅ Initial documentation (4 guides)  
✅ Testing infrastructure  

**Time:** 24 hours (3 days with 8-hour workdays)  
**Dependencies:** None  
**Blockers:** None  

---

## Phase 2: Stack Templates (Days 4-10, 56 hours)

### Objectives
- Create 4 production-ready stack templates
- Each template includes:
  - Complete project structure
  - Example features (auth, CRUD, exports)
  - Pre-configured Claude Code setup
  - Domain-specific skills
  - Automated workflows

### 2.1 Rails Template (Days 4-5, 14 hours)

**Technology Stack:**
- Rails 7.1
- PostgreSQL with multi-tenancy (row-level security)
- Hotwire (Turbo + Stimulus)
- Tailwind CSS
- Devise for authentication
- Pundit for authorization

**Project structure:**
```
rails-template/
├── app/
│   ├── controllers/
│   ├── models/
│   ├── views/
│   └── javascript/
├── .claude/
│   ├── skills/
│   │   ├── rails-patterns/
│   │   ├── hotwire-patterns/
│   │   └── testing-patterns/
│   ├── commands/
│   │   ├── generate-scaffold.md
│   │   └── run-tests.md
│   └── hooks/
├── spec/                     # RSpec tests
└── CLAUDE.md                 # Rails-specific instructions
```

**Example features to include:**
1. **Authentication** (2 hours)
   - User sign up/login with Devise
   - Multi-tenant organization setup
   - Role-based access control with Pundit

2. **CRUD scaffold** (2 hours)
   - Customers table (example entity)
   - List/Create/Edit/Delete actions
   - Search and filtering
   - Pagination with Pagy

3. **Real-time updates** (2 hours)
   - Turbo Streams for live updates
   - Cable-ready for server-pushed updates

4. **Export system** (2 hours)
   - PDF generation with Prawn
   - Excel export with Caxlsx
   - CSV export

5. **Testing setup** (2 hours)
   - RSpec configuration
   - Factory Bot factories
   - Request specs
   - System specs with Capybara

6. **Skills creation** (4 hours)
   - rails-patterns skill (400 lines)
   - hotwire-patterns skill (300 lines)
   - testing-patterns skill (300 lines)

**Time breakdown:**
- Template scaffolding: 2 hours
- Example features: 10 hours
- Skills creation: 4 hours
- Testing & documentation: 2 hours

**Reference from quotation-app:**
- Multi-tenant patterns from `backend/` (PostgreSQL RLS)
- Export patterns from `backend/services/excel_service.py`
- Testing patterns from `backend/tests/`

---

### 2.2 Next.js + FastAPI Template (Days 6-7, 14 hours)

**Technology Stack:**
- Next.js 15.5 + React 19
- FastAPI + Python 3.12
- Supabase PostgreSQL
- Ant Design
- ag-Grid Community

**This is the quotation-app stack - extract heavily!**

**Project structure:**
```
nextjs-fastapi-template/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── .claude/
├── backend/
│   ├── routes/
│   ├── models/
│   ├── services/
│   └── tests/
├── .claude/
│   ├── skills/
│   │   ├── frontend-dev-guidelines/
│   │   ├── backend-dev-guidelines/
│   │   └── api-integration/
│   ├── commands/
│   └── hooks/
└── CLAUDE.md
```

**Example features to include:**
1. **Authentication** (2 hours)
   - Supabase Auth integration
   - JWT handling
   - Protected routes (frontend + backend)

2. **CRUD with ag-Grid** (3 hours)
   - Customers table with ag-Grid
   - Form creation/editing with Ant Design
   - API integration patterns

3. **Multi-tenant setup** (2 hours)
   - Organization model
   - RLS policies in Supabase
   - JWT claims for RLS context

4. **Export system** (2 hours)
   - PDF generation (backend)
   - Excel generation (backend)
   - File download handling (frontend)

5. **Testing setup** (1 hour)
   - Pytest configuration (backend)
   - Jest + React Testing Library (frontend)

6. **Skills extraction** (4 hours)
   - **EXTRACT DIRECTLY from quotation-app:**
     - `.claude/skills/frontend-dev-guidelines/` (copy as-is)
     - `.claude/skills/backend-dev-guidelines/` (copy as-is)
   - Simplify for general use (remove calculation-specific parts)

**Time breakdown:**
- Template scaffolding: 1 hour
- Example features: 10 hours
- Skills extraction & simplification: 4 hours
- Testing & documentation: 1 hour

**Reference from quotation-app:**
- **COPY ENTIRE SKILLS directly:**
  - `.claude/skills/frontend-dev-guidelines/` → 3,632 lines
  - `.claude/skills/backend-dev-guidelines/` → 3,200+ lines
- Simplify examples (remove quote-specific logic)
- Keep all patterns and workflows

---

### 2.3 Next.js + Supabase Template (Days 8-9, 14 hours)

**Technology Stack:**
- Next.js 15.5 + React 19
- Supabase (Auth + Database + Storage + Edge Functions)
- Ant Design
- Tailwind CSS

**Project structure:**
```
nextjs-supabase-template/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── supabase/
├── supabase/
│   ├── functions/
│   ├── migrations/
│   └── seed.sql
├── .claude/
│   ├── skills/
│   │   ├── supabase-patterns/
│   │   ├── nextjs-patterns/
│   │   └── rls-patterns/
│   ├── commands/
│   └── hooks/
└── CLAUDE.md
```

**Example features to include:**
1. **Authentication** (2 hours)
   - Email/password login
   - OAuth providers (Google, GitHub)
   - Protected routes with middleware

2. **CRUD operations** (2 hours)
   - Supabase client usage
   - Real-time subscriptions
   - Optimistic updates

3. **Multi-tenant with RLS** (3 hours)
   - Organization model
   - RLS policies (select/insert/update/delete)
   - Policy testing

4. **File uploads** (2 hours)
   - Supabase Storage integration
   - Image optimization
   - File previews

5. **Edge Functions** (2 hours)
   - Example serverless function
   - Scheduled jobs with pg_cron

6. **Skills creation** (3 hours)
   - supabase-patterns skill (400 lines)
   - rls-patterns skill (300 lines) - extract from quotation-app
   - nextjs-patterns skill (300 lines)

**Time breakdown:**
- Template scaffolding: 2 hours
- Example features: 11 hours
- Skills creation: 3 hours
- Testing & documentation: 1 hour

**Reference from quotation-app:**
- RLS patterns from `.claude/skills/database-verification/`
- Supabase client usage from `frontend/src/lib/supabase-client.ts`

---

### 2.4 Django Template (Days 9-10, 14 hours)

**Technology Stack:**
- Django 5.0
- PostgreSQL with django-tenants
- HTMX + Alpine.js
- Tailwind CSS
- Django REST Framework (API)

**Project structure:**
```
django-template/
├── apps/
│   ├── core/
│   ├── users/
│   └── customers/
├── .claude/
│   ├── skills/
│   │   ├── django-patterns/
│   │   ├── htmx-patterns/
│   │   └── drf-patterns/
│   ├── commands/
│   └── hooks/
├── templates/
└── CLAUDE.md
```

**Example features to include:**
1. **Authentication** (2 hours)
   - Django Allauth integration
   - Multi-tenant user model
   - Permission classes

2. **CRUD with HTMX** (3 hours)
   - List/Create/Edit/Delete views
   - Partial template rendering
   - Form validation with Alpine.js

3. **REST API** (2 hours)
   - Django REST Framework setup
   - JWT authentication
   - Serializers and ViewSets

4. **Export system** (2 hours)
   - PDF generation with ReportLab
   - Excel with openpyxl
   - CSV export

5. **Testing setup** (1 hour)
   - Pytest-django configuration
   - Model tests, view tests, API tests

6. **Skills creation** (4 hours)
   - django-patterns skill (500 lines)
   - htmx-patterns skill (300 lines)
   - drf-patterns skill (300 lines)

**Time breakdown:**
- Template scaffolding: 2 hours
- Example features: 10 hours
- Skills creation: 4 hours
- Testing & documentation: 1 hour

---

### Phase 2 Deliverables

✅ 4 production-ready stack templates  
✅ Each template includes:
  - Complete auth system
  - CRUD examples
  - Multi-tenant setup
  - Export functionality
  - Testing infrastructure
  - 3-5 domain-specific skills
✅ Template-specific CLAUDE.md files  
✅ Working example features  

**Time:** 56 hours (7 days with 8-hour workdays)  
**Dependencies:** Phase 1 complete  
**Blockers:** None  

---

## Phase 3: Wizard & Stack Selector (Days 11-13, 24 hours)

### Objectives
- Build 12-question interactive wizard
- Create AI recommendation engine
- Implement stack selector with override capability

### 3.1 Wizard Questions (8 hours)

**See:** `WIZARD_SPECIFICATION.md` for complete question list

**Implementation:**
```javascript
// cli/wizard.js
const inquirer = require('inquirer');

const questions = [
  {
    type: 'input',
    name: 'projectName',
    message: 'What is your project name?',
    validate: (input) => {
      // Validation logic
    }
  },
  {
    type: 'list',
    name: 'businessType',
    message: 'What type of business app are you building?',
    choices: [
      'B2B Platform (SaaS, marketplace, etc.)',
      'Internal Tool (CRM, admin dashboard, etc.)',
      'E-commerce (online store, booking system, etc.)',
      'Content Platform (blog, documentation, etc.)',
      'Mobile-first App (with backend API)',
      'Other (I\'ll specify)'
    ]
  },
  // ... 10 more questions
];

async function runWizard() {
  const answers = await inquirer.prompt(questions);
  return answers;
}

module.exports = { runWizard };
```

**Question categories:**
1. **Project basics** (name, description, business type)
2. **Technical requirements** (user count, data volume, real-time needs)
3. **Team context** (developer experience, timeline, budget)
4. **Feature priorities** (auth, exports, mobile, integrations)

**Time breakdown:**
- Question design: 2 hours
- Validation logic: 2 hours
- UI/UX polish: 2 hours
- Testing: 2 hours

---

### 3.2 AI Stack Recommender (12 hours)

**Recommendation algorithm:**

```javascript
// cli/stack-selector.js
function recommendStack(answers) {
  const scores = {
    rails: 0,
    'nextjs-fastapi': 0,
    'nextjs-supabase': 0,
    django: 0
  };

  // Rule 1: Real-time requirements
  if (answers.realTimeNeeds === 'yes') {
    scores['rails'] += 2;  // Hotwire excels here
    scores['nextjs-supabase'] += 2;  // Supabase real-time
  }

  // Rule 2: Team experience
  if (answers.backendExperience === 'python') {
    scores['nextjs-fastapi'] += 3;
    scores['django'] += 3;
  } else if (answers.backendExperience === 'ruby') {
    scores['rails'] += 4;
  }

  // Rule 3: Deployment complexity tolerance
  if (answers.deploymentComplexity === 'simple') {
    scores['nextjs-supabase'] += 3;  // Easiest deployment
  } else if (answers.deploymentComplexity === 'moderate') {
    scores['rails'] += 2;
    scores['django'] += 2;
  }

  // Rule 4: Budget constraints
  if (answers.budget === 'minimal') {
    scores['nextjs-supabase'] -= 1;  // Supabase costs can add up
    scores['rails'] += 1;  // Self-hosted is cheaper
  }

  // Rule 5: Mobile-first requirement
  if (answers.mobileFirst === 'yes') {
    scores['nextjs-fastapi'] += 2;  // Best API-first architecture
    scores['nextjs-supabase'] += 2;
  }

  // ... 20+ more rules

  const recommended = Object.keys(scores).reduce((a, b) => 
    scores[a] > scores[b] ? a : b
  );

  return {
    recommended,
    scores,
    reasoning: generateReasoning(answers, scores)
  };
}

function generateReasoning(answers, scores) {
  // Generate human-readable explanation
  // "We recommend Next.js + Supabase because:
  //  - You need real-time features (Supabase excels here)
  //  - Your team is new to backend (serverless is easier)
  //  - You want fast deployment (Vercel + Supabase is one-click)"
}
```

**AI enhancement (future):**
- Use Claude API to analyze free-text answers
- Learn from user feedback on recommendations
- Improve recommendation accuracy over time

**Time breakdown:**
- Scoring algorithm: 4 hours
- Reasoning generator: 3 hours
- Testing with sample projects: 3 hours
- Documentation: 2 hours

---

### 3.3 Stack Override & Confirmation (4 hours)

**After recommendation:**

```javascript
const confirmation = await inquirer.prompt([
  {
    type: 'list',
    name: 'acceptRecommendation',
    message: `We recommend ${recommendation.recommended}. Proceed with this stack?`,
    choices: [
      'Yes, use recommended stack',
      'No, let me choose manually'
    ]
  }
]);

if (confirmation.acceptRecommendation === 'No, let me choose manually') {
  const manualChoice = await inquirer.prompt([
    {
      type: 'list',
      name: 'stack',
      message: 'Choose your stack:',
      choices: [
        { name: 'Rails', value: 'rails' },
        { name: 'Next.js + FastAPI', value: 'nextjs-fastapi' },
        { name: 'Next.js + Supabase', value: 'nextjs-supabase' },
        { name: 'Django', value: 'django' }
      ]
    }
  ]);
  
  // Warn user if choice conflicts with requirements
  const conflicts = checkConflicts(manualChoice.stack, answers);
  if (conflicts.length > 0) {
    console.log(chalk.yellow('⚠️  Warning: This choice may conflict with:'));
    conflicts.forEach(c => console.log(`  - ${c}`));
    
    const proceed = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continue',
        message: 'Continue anyway?',
        default: false
      }
    ]);
    
    if (!proceed.continue) {
      // Go back to selection
    }
  }
}
```

**Time breakdown:**
- Override UI: 1 hour
- Conflict detection: 2 hours
- Testing: 1 hour

---

### Phase 3 Deliverables

✅ Interactive 12-question wizard  
✅ AI-powered stack recommendation  
✅ Manual override with conflict warnings  
✅ Reasoning generation for transparency  
✅ Testing with 20+ sample projects  

**Time:** 24 hours (3 days with 8-hour workdays)  
**Dependencies:** Phase 2 complete (stack templates exist)  
**Blockers:** None  

---

## Phase 4: Self-Learning System (Days 14-18, 40 hours)

### Objectives
- Build pattern extraction from project files
- Implement skill generation from patterns
- Create review and approval workflow
- Set up automated learning schedule (every 2 days)

### 4.1 Pattern Extractor (16 hours)

**See:** `SELF_LEARNING_SPECIFICATION.md` for detailed algorithm

**Core algorithm:**

```python
# self-learning/pattern-extractor.py
import ast
import os
from collections import defaultdict

class PatternExtractor:
    def __init__(self, project_root):
        self.project_root = project_root
        self.patterns = {
            'api_endpoints': [],
            'database_queries': [],
            'form_validations': [],
            'error_handlers': [],
            'test_patterns': [],
            'component_structures': []
        }
    
    def extract_all(self):
        """Main entry point - extract all patterns from project"""
        self.scan_directory(self.project_root)
        self.deduplicate_patterns()
        self.calculate_confidence_scores()
        return self.patterns
    
    def scan_directory(self, path):
        """Recursively scan project directory"""
        for root, dirs, files in os.walk(path):
            # Skip node_modules, venv, etc.
            dirs[:] = [d for d in dirs if d not in [
                'node_modules', 'venv', '.git', 'dist', 'build'
            ]]
            
            for file in files:
                file_path = os.path.join(root, file)
                
                if file.endswith('.py'):
                    self.extract_python_patterns(file_path)
                elif file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                    self.extract_javascript_patterns(file_path)
                elif file.endswith('.rb'):
                    self.extract_ruby_patterns(file_path)
    
    def extract_python_patterns(self, file_path):
        """Extract patterns from Python files"""
        with open(file_path, 'r') as f:
            try:
                tree = ast.parse(f.read())
            except SyntaxError:
                return
        
        for node in ast.walk(tree):
            # Pattern 1: API endpoint definitions
            if isinstance(node, ast.FunctionDef):
                decorators = [d.id for d in node.decorator_list 
                             if isinstance(d, ast.Name)]
                
                if any(d in ['get', 'post', 'put', 'delete'] 
                       for d in decorators):
                    self.patterns['api_endpoints'].append({
                        'file': file_path,
                        'function': node.name,
                        'method': [d for d in decorators 
                                  if d in ['get', 'post', 'put', 'delete']][0],
                        'params': [arg.arg for arg in node.args.args],
                        'code_snippet': ast.unparse(node)
                    })
            
            # Pattern 2: Database queries (look for .query, .filter, etc.)
            if isinstance(node, ast.Call):
                if hasattr(node.func, 'attr'):
                    if node.func.attr in ['query', 'filter', 'all', 'first']:
                        self.patterns['database_queries'].append({
                            'file': file_path,
                            'method': node.func.attr,
                            'code_snippet': ast.unparse(node)
                        })
            
            # Pattern 3: Error handlers (try/except blocks)
            if isinstance(node, ast.ExceptHandler):
                self.patterns['error_handlers'].append({
                    'file': file_path,
                    'exception_type': ast.unparse(node.type) if node.type else 'Any',
                    'handler_code': ast.unparse(node)
                })
    
    def extract_javascript_patterns(self, file_path):
        """Extract patterns from JS/TS files"""
        # Use regex patterns for JS/TS (no AST parser in Python)
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Pattern 1: React components
        component_pattern = r'(export\s+)?(?:default\s+)?(?:function|const)\s+(\w+)\s*[=:]?\s*\([^)]*\)\s*(?::\s*\w+)?\s*(?:=>)?\s*\{'
        matches = re.finditer(component_pattern, content)
        for match in matches:
            self.patterns['component_structures'].append({
                'file': file_path,
                'name': match.group(2),
                'is_exported': bool(match.group(1))
            })
        
        # Pattern 2: Form validations
        validation_pattern = r'validate[:\s]*\([^)]*\)\s*=>\s*\{[^}]*\}'
        matches = re.finditer(validation_pattern, content)
        for match in matches:
            self.patterns['form_validations'].append({
                'file': file_path,
                'code_snippet': match.group(0)
            })
    
    def deduplicate_patterns(self):
        """Remove duplicate patterns"""
        for category in self.patterns:
            seen = set()
            unique = []
            for pattern in self.patterns[category]:
                # Create hash of pattern
                pattern_hash = hash(frozenset(pattern.items()))
                if pattern_hash not in seen:
                    seen.add(pattern_hash)
                    unique.append(pattern)
            self.patterns[category] = unique
    
    def calculate_confidence_scores(self):
        """Add confidence scores based on frequency and context"""
        for category in self.patterns:
            pattern_counts = defaultdict(int)
            
            # Count occurrences of similar patterns
            for pattern in self.patterns[category]:
                pattern_key = self._get_pattern_key(pattern)
                pattern_counts[pattern_key] += 1
            
            # Add confidence scores
            for pattern in self.patterns[category]:
                pattern_key = self._get_pattern_key(pattern)
                count = pattern_counts[pattern_key]
                
                # Confidence = min(100, 50 + 10 * (count - 1))
                # Used once: 50%, twice: 60%, 5+ times: 90%+
                pattern['confidence'] = min(100, 50 + 10 * (count - 1))
    
    def _get_pattern_key(self, pattern):
        """Generate key for pattern similarity matching"""
        # Remove file path and focus on structure
        if 'code_snippet' in pattern:
            # Normalize code (remove whitespace, comments)
            return self._normalize_code(pattern['code_snippet'])
        elif 'name' in pattern:
            return pattern['name']
        return str(pattern)
```

**Output format:**
```json
{
  "api_endpoints": [
    {
      "file": "/path/to/routes/quotes.py",
      "function": "create_quote",
      "method": "post",
      "params": ["quote_data"],
      "code_snippet": "@router.post(...)",
      "confidence": 90,
      "frequency": 5
    }
  ],
  "database_queries": [
    {
      "file": "/path/to/models.py",
      "method": "filter",
      "code_snippet": "Quote.query.filter(organization_id == org_id)",
      "confidence": 80,
      "frequency": 12
    }
  ],
  // ... other categories
}
```

**Time breakdown:**
- Python AST parser: 4 hours
- JavaScript regex parser: 3 hours
- Pattern categorization: 3 hours
- Confidence scoring: 2 hours
- Testing with real projects: 4 hours

---

### 4.2 Skill Generator (16 hours)

**Input:** Patterns from extractor  
**Output:** Markdown skill file ready for Claude Code

```python
# self-learning/skill-generator.py
class SkillGenerator:
    def __init__(self, patterns, project_name):
        self.patterns = patterns
        self.project_name = project_name
    
    def generate_skill(self, category):
        """Generate skill markdown for a pattern category"""
        
        # Only generate if confidence threshold met
        high_confidence = [p for p in self.patterns[category] 
                          if p['confidence'] >= 70]
        
        if len(high_confidence) < 3:
            return None  # Not enough patterns
        
        skill_content = self._build_skill_structure(
            category, 
            high_confidence
        )
        
        return skill_content
    
    def _build_skill_structure(self, category, patterns):
        """Build skill markdown with proper structure"""
        
        # Extract common patterns
        common_structure = self._find_common_structure(patterns)
        best_practices = self._extract_best_practices(patterns)
        anti_patterns = self._identify_anti_patterns(patterns)
        
        skill = f"""# {self.project_name} - {category} Patterns

## Overview

Automatically generated skill from project codebase analysis.  
**Confidence:** {self._average_confidence(patterns)}%  
**Based on:** {len(patterns)} code examples

---

## Common Structure

{common_structure}

---

## Best Practices

{best_practices}

---

## Anti-Patterns (What to Avoid)

{anti_patterns}

---

## Code Examples

"""
        
        # Add top 5 examples
        for pattern in patterns[:5]:
            skill += f"""
### Example: {pattern.get('function', pattern.get('name', 'Unnamed'))}

**File:** `{pattern['file']}`  
**Confidence:** {pattern['confidence']}%

```python
{pattern['code_snippet']}
```

**When to use:** {self._generate_usage_guidance(pattern)}

---
"""
        
        return skill
    
    def _find_common_structure(self, patterns):
        """Analyze patterns and extract common structure"""
        # Use difflib to find common subsequences
        # Return markdown explaining the common structure
        pass
    
    def _extract_best_practices(self, patterns):
        """Identify best practices from high-quality patterns"""
        # Look for:
        # - Error handling presence
        # - Type hints (Python/TypeScript)
        # - Docstrings/comments
        # - Test coverage
        pass
    
    def _identify_anti_patterns(self, patterns):
        """Find anti-patterns to warn against"""
        # Look for:
        # - Missing error handling
        # - Security vulnerabilities (SQL injection, XSS)
        # - Performance issues (N+1 queries)
        pass
```

**Time breakdown:**
- Skill structure design: 3 hours
- Pattern analysis algorithms: 5 hours
- Best practices extraction: 3 hours
- Anti-pattern detection: 3 hours
- Testing & refinement: 2 hours

---

### 4.3 Review & Approval Workflow (8 hours)

**CLI command:** `claude-app review-patterns`

**Workflow:**
1. Extract patterns (automatic, every 2 days)
2. Generate skills (automatic)
3. Present to user for review (interactive)
4. User approves, rejects, or edits
5. Approved skills activated in Claude Code

```javascript
// cli/review-patterns.js
async function reviewPatterns() {
  console.log('🔍 Analyzing codebase for new patterns...\n');
  
  // Run pattern extractor
  const patterns = await extractPatterns(process.cwd());
  
  // Generate skills
  const skills = await generateSkills(patterns);
  
  if (skills.length === 0) {
    console.log('✅ No new patterns detected.');
    return;
  }
  
  console.log(`📚 Found ${skills.length} new skills:\n`);
  
  for (const skill of skills) {
    console.log(chalk.blue(`\n=== ${skill.name} ===`));
    console.log(`Category: ${skill.category}`);
    console.log(`Confidence: ${skill.confidence}%`);
    console.log(`Based on: ${skill.patternCount} code examples\n`);
    
    // Show preview
    console.log(skill.preview);
    
    const action = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'What would you like to do?',
        choices: [
          'Approve and activate',
          'View full skill',
          'Edit before activating',
          'Reject',
          'Skip (decide later)'
        ]
      }
    ]);
    
    if (action.choice === 'Approve and activate') {
      activateSkill(skill);
      console.log(chalk.green('✅ Skill activated!'));
    } else if (action.choice === 'Edit before activating') {
      // Open in editor
      await openInEditor(skill.filePath);
      console.log('Save and close editor when done.');
      // Wait for editor to close, then activate
    }
    // ... handle other choices
  }
}
```

**Time breakdown:**
- Review UI implementation: 3 hours
- Editor integration: 2 hours
- Activation logic: 2 hours
- Testing: 1 hour

---

### Phase 4 Deliverables

✅ Pattern extraction from Python/JS/Ruby code  
✅ Skill generation with confidence scoring  
✅ Interactive review workflow  
✅ Automatic activation of approved skills  
✅ Scheduled learning (every 2 days via cron/scheduler)  

**Time:** 40 hours (5 days with 8-hour workdays)  
**Dependencies:** Phase 2 (need templates to test on)  
**Blockers:** None  

---

## Phase 5: Shared Skills Library (Days 19-21, 24 hours)

### Objectives
- Create universal skills that work across all stacks
- Extract and generalize skills from quotation-app
- Organize into shared library

### 5.1 Extract from Quotation App (12 hours)

**Skills to extract:**

1. **Superpowers Skills (Copy as-is)** - 0 hours (already done)
   - test-driven-development
   - systematic-debugging
   - verification-before-completion
   - brainstorming
   - ... 16 more skills

2. **database-verification** - 3 hours
   - Source: `.claude/skills/database-verification/`
   - Generalize RLS patterns for PostgreSQL
   - Add MySQL/MongoDB equivalents
   - Keep multi-tenant patterns

3. **api-design-patterns** - 3 hours
   - Extract from `backend-dev-guidelines`
   - RESTful best practices
   - Error handling standards
   - Authentication patterns

4. **form-validation** - 2 hours
   - Extract from `frontend-dev-guidelines`
   - Client-side validation patterns
   - Server-side validation
   - Error message UX

5. **testing-patterns** - 2 hours
   - Extract from both frontend and backend guidelines
   - Unit test patterns
   - Integration test patterns
   - E2E test patterns

6. **export-patterns** - 2 hours
   - Extract from `backend/services/excel_service.py`
   - PDF generation patterns
   - Excel generation patterns
   - CSV export patterns

**Generalization process:**
1. Remove project-specific code (quotes, calculations)
2. Keep patterns and structure
3. Add examples for multiple stacks
4. Test with all 4 templates

---

### 5.2 Create Universal Skills (12 hours)

**New skills to create from scratch:**

1. **git-workflow** - 2 hours
   - Branch naming conventions
   - Commit message standards
   - PR templates
   - Code review checklist

2. **security-checklist** - 3 hours
   - Authentication best practices
   - OWASP Top 10 prevention
   - Input sanitization
   - Environment variable handling

3. **performance-optimization** - 3 hours
   - Database indexing
   - Query optimization
   - Caching strategies
   - Frontend bundle optimization

4. **deployment-checklist** - 2 hours
   - Environment setup
   - Database migrations
   - Health checks
   - Monitoring setup

5. **documentation-standards** - 2 hours
   - Code comments
   - API documentation
   - README templates
   - Architecture diagrams

**Time breakdown:**
- Skill creation: 10 hours
- Testing with templates: 2 hours

---

### Phase 5 Deliverables

✅ 20+ universal skills in shared library  
✅ Skills work across all 4 stack templates  
✅ Comprehensive documentation  
✅ Skill auto-activation configuration  

**Time:** 24 hours (3 days with 8-hour workdays)  
**Dependencies:** Phase 2 (templates), Phase 4 (self-learning system)  
**Blockers:** None  

---

## Phase 6: Automation (Commands + Hooks) (Days 22-24, 24 hours)

### Objectives
- Create reusable slash commands
- Set up git hooks for quality gates
- Extract automation from quotation-app

### 6.1 Extract Commands from Quotation App (8 hours)

**Commands to extract:**

1. **/test-e2e** - 2 hours
   - Generalize `/test-quote-creation`
   - Make entity-agnostic (test any CRUD flow)
   - Support multiple stacks

2. **/fix-typescript-errors** - 1 hour
   - Copy as-is (frontend-specific)
   - Works for all Next.js templates

3. **/apply-migration** - 2 hours
   - Generalize for multiple database types
   - Support Rails, Django, Supabase migrations
   - Keep backup/rollback logic

4. **/debug-api** - 3 hours
   - Generalize `/debug-calculation`
   - Trace any API request
   - Show request/response/logs
   - Support FastAPI, Rails, Django

**Extraction process:**
1. Copy from `.claude/commands/`
2. Remove quotation-app specific logic
3. Add stack detection (auto-detect template)
4. Add configuration options
5. Test with all 4 templates

---

### 6.2 Create New Commands (8 hours)

**New commands to build:**

1. **/generate-crud** - 3 hours
   - Interactive entity creation
   - Generate model, API, UI, tests
   - Stack-specific scaffolding

2. **/add-auth** - 2 hours
   - Add authentication to existing project
   - Support multiple providers
   - Generate login/signup pages

3. **/setup-deployment** - 2 hours
   - Interactive deployment wizard
   - Generate Docker files, CI/CD config
   - Support Heroku, Vercel, Railway, AWS

4. **/run-quality-check** - 1 hour
   - Run linter, tests, type-check
   - Report errors and warnings
   - Suggest fixes

**Time breakdown:**
- Command development: 6 hours
- Testing: 2 hours

---

### 6.3 Extract Hooks from Quotation App (8 hours)

**Hooks to extract:**

1. **Pre-commit hook** - 2 hours
   - Generalize `backend-syntax-check.sh`
   - Support multiple languages
   - Run linter + tests

2. **Pre-push hook** - 1 hour
   - Run full test suite
   - Prevent push if tests fail

3. **Post-feature hook** - 2 hours
   - Generalize `post-feature.sh`
   - Trigger quality checks
   - Update documentation

4. **Pre-flight checks** - 3 hours
   - Generalize WSL2 memory checks
   - Cross-platform support (Mac, Linux, Windows)
   - Resource monitoring

**Extraction process:**
1. Copy from `.claude/hooks/`
2. Make cross-platform
3. Add configuration options
4. Test on all systems

---

### Phase 6 Deliverables

✅ 8 slash commands (4 extracted, 4 new)  
✅ 4 git hooks for quality gates  
✅ Cross-platform support  
✅ Works with all 4 stack templates  

**Time:** 24 hours (3 days with 8-hour workdays)  
**Dependencies:** Phase 2 (templates)  
**Blockers:** None  

---

## Phase 7: Testing & Refinement (Days 25-27, 24 hours)

### Objectives
- End-to-end testing of entire framework
- Bug fixes and polish
- Performance optimization

### 7.1 Template Testing (8 hours)

**For each template (2 hours x 4):**

1. Run wizard with template-appropriate answers
2. Generate project
3. Verify all files created correctly
4. Install dependencies
5. Run dev servers
6. Test example features:
   - Authentication flow
   - CRUD operations
   - Export functionality
   - Testing suite
7. Test skills activation
8. Test commands
9. Test hooks
10. Document any issues

**Test matrix:**
```
Template         | Wizard | Generate | Dev Server | Features | Skills | Commands | Hooks
----------------|--------|----------|------------|----------|--------|----------|-------
Rails           | ✅     | ✅       | ✅         | ✅       | ✅     | ✅       | ✅
Next+FastAPI    | ✅     | ✅       | ✅         | ✅       | ✅     | ✅       | ✅
Next+Supabase   | ✅     | ✅       | ✅         | ✅       | ✅     | ✅       | ✅
Django          | ✅     | ✅       | ✅         | ✅       | ✅     | ✅       | ✅
```

---

### 7.2 Self-Learning Testing (8 hours)

**Test pattern extraction:**

1. Create sample project from template (1 hour)
2. Build 3-5 features (3 hours)
3. Run pattern extractor (30 min)
4. Review generated skills (30 min)
5. Test skill activation (30 min)
6. Verify skills help with new features (2 hours)

**Validation criteria:**
- Extractor finds at least 10 patterns per category
- Confidence scores are accurate
- Generated skills are high quality
- No false positives (irrelevant patterns)
- Skills actually improve development speed

---

### 7.3 Bug Fixes & Polish (8 hours)

**Priority areas:**

1. **Wizard UX** (2 hours)
   - Clear error messages
   - Help text for each question
   - Progress indicator
   - Ability to go back

2. **Generation reliability** (2 hours)
   - Handle edge cases (special characters in names)
   - Rollback on failure
   - Resume from interruption

3. **Skills activation** (2 hours)
   - Verify auto-activation triggers
   - Test manual activation
   - Handle conflicts (duplicate skills)

4. **Performance** (2 hours)
   - Optimize pattern extraction (parallelize)
   - Reduce generation time
   - Minimize package size

---

### Phase 7 Deliverables

✅ All 4 templates thoroughly tested  
✅ Self-learning system validated  
✅ Critical bugs fixed  
✅ UX polished  
✅ Performance optimized  

**Time:** 24 hours (3 days with 8-hour workdays)  
**Dependencies:** All previous phases  
**Blockers:** None  

---

## Phase 8: Beta Launch Prep (Days 28-30, 24 hours)

### Objectives
- Create marketing materials
- Set up licensing and payment
- Write comprehensive documentation
- Prepare support infrastructure

### 8.1 Documentation (12 hours)

**Create comprehensive docs:**

1. **README.md** - 2 hours
   - Clear value proposition
   - Quick start guide
   - Feature highlights
   - Screenshots/GIFs

2. **docs/getting-started.md** - 2 hours
   - Installation instructions
   - First project walkthrough
   - Troubleshooting

3. **docs/stack-guide.md** - 2 hours
   - Deep dive into each stack
   - When to use which
   - Migration guide

4. **docs/wizard-guide.md** - 1 hour
   - Question explanations
   - Recommendation logic

5. **docs/self-learning-guide.md** - 2 hours
   - How it works
   - Review workflow
   - Privacy considerations

6. **docs/api-reference.md** - 2 hours
   - All CLI commands
   - Configuration options
   - Programmatic API

7. **Video tutorials** - 1 hour
   - Record 5-minute intro video
   - Record template walkthroughs

---

### 8.2 Licensing & Payment (6 hours)

**Implement licensing system:**

1. **License server** - 3 hours
   - API for license validation
   - Stripe integration for payments
   - License key generation
   - Usage tracking

2. **CLI integration** - 2 hours
   - License prompt on first run
   - Activation flow
   - License storage
   - Renewal reminders

3. **Stripe checkout** - 1 hour
   - Beta pricing ($199)
   - Full pricing ($399)
   - Payment page
   - Email delivery

---

### 8.3 Marketing Materials (4 hours)

**Create launch assets:**

1. **Landing page** - 2 hours
   - Value proposition
   - Feature highlights
   - Pricing
   - Demo video
   - Testimonials (prepare slots)

2. **Social media posts** - 1 hour
   - Twitter announcement thread
   - LinkedIn post
   - Reddit posts (r/SideProject, r/entrepreneur)
   - Indie Hackers post

3. **Email sequence** - 1 hour
   - Welcome email
   - Onboarding tips (days 1, 3, 7, 14)
   - Feature highlights
   - Success stories

---

### 8.4 Support Infrastructure (2 hours)

1. **Discord community** - 30 min
   - Create server
   - Set up channels
   - Write welcome message

2. **Email support** - 30 min
   - Set up support@yourdomain.com
   - Create canned responses

3. **GitHub Issues** - 30 min
   - Issue templates
   - Contributing guide
   - Bug report template

4. **FAQ page** - 30 min
   - Common questions
   - Troubleshooting guide

---

### Phase 8 Deliverables

✅ Comprehensive documentation (7 guides + video)  
✅ Licensing system with Stripe  
✅ Landing page  
✅ Marketing materials  
✅ Support infrastructure  
✅ Ready for beta launch  

**Time:** 24 hours (3 days with 8-hour workdays)  
**Dependencies:** All phases complete  
**Blockers:** None  

---

## Summary Timeline

| Phase | Days | Hours | Deliverables |
|-------|------|-------|--------------|
| 1. Foundation | 1-3 | 24 | CLI tool, package config, docs |
| 2. Stack Templates | 4-10 | 56 | 4 templates with examples & skills |
| 3. Wizard & Selector | 11-13 | 24 | 12-question wizard, AI recommender |
| 4. Self-Learning | 14-18 | 40 | Pattern extraction, skill generation |
| 5. Shared Skills | 19-21 | 24 | 20+ universal skills |
| 6. Automation | 22-24 | 24 | 8 commands, 4 hooks |
| 7. Testing | 25-27 | 24 | Bug fixes, polish, optimization |
| 8. Beta Launch | 28-30 | 24 | Docs, licensing, marketing |
| **TOTAL** | **30** | **240** | **Complete framework** |

---

## Success Metrics

**Beta Launch Goals:**
- 50 paying beta customers ($199 x 50 = $9,950)
- 90% wizard completion rate
- 80% generate at least one project
- 70% activate self-learning
- 50% generate a second project
- Average time to first deploy: <2 weeks

**Full Launch Goals (3 months post-beta):**
- 500 customers ($399 x 500 = $199,500)
- 95% project generation success rate
- 85% self-learning adoption
- 4.5+ star average rating
- 100+ generated skills in marketplace

---

## Risk Mitigation

**Risk 1: Templates don't work out of the box**
- Mitigation: Extensive testing in Phase 7
- Contingency: CI/CD for each template, automated testing

**Risk 2: Self-learning generates low-quality skills**
- Mitigation: Confidence threshold, human review required
- Contingency: Start with manual skill curation, improve AI over time

**Risk 3: Wizard recommendations are poor**
- Mitigation: Test with 20+ sample projects in Phase 3
- Contingency: Collect feedback, iterate recommendation algorithm

**Risk 4: License validation bypassed**
- Mitigation: Server-side validation, offline mode limited
- Contingency: Encrypt license keys, add hardware binding

**Risk 5: Low beta adoption**
- Mitigation: Heavy marketing, early bird pricing
- Contingency: Offer refunds, extend beta period, lower price

---

## Next Steps After Beta

**Version 1.1 (Month 2):**
- Add 2 more stacks (Laravel, Express.js)
- Skill marketplace (users share skills)
- Team collaboration features
- IDE plugins (VS Code, JetBrains)

**Version 1.2 (Month 3):**
- AI chat interface for coding guidance
- Automated deployment to major platforms
- Visual editor for forms/UI
- Mobile app support

**Version 2.0 (Month 6):**
- No-code builder UI
- AI generates entire features from descriptions
- Marketplace for templates & components
- White-label offering for agencies

---

**End of Implementation Plan**

