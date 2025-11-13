# Self-Learning System Specification
**Version:** 1.0  
**Created:** 2025-10-30

---

## Overview

The self-learning system automatically extracts coding patterns from your project and generates Claude Code skills. This happens every 2 days via cron job.

**Key Innovation:** Your framework gets smarter as you build, learning your team's specific patterns and preferences.

---

## Pattern Extraction Algorithm

### Supported Languages

1. **Python** - AST parsing
2. **JavaScript/TypeScript** - Regex + AST (via Babel parser)
3. **Ruby** - AST parsing (via Ripper)
4. **Go** - AST parsing (future)
5. **Java** - AST parsing (future)

### Pattern Categories

The extractor looks for 10 pattern types:

1. **API Endpoints**
   - FastAPI routes (@app.get, @router.post)
   - Django views (def view_name)
   - Rails controllers (def action)
   - Express routes (app.get, router.post)

2. **Database Queries**
   - SQLAlchemy queries (session.query)
   - Django ORM (Model.objects.filter)
   - ActiveRecord (Model.where)
   - Raw SQL (with parameterization)

3. **Form Validations**
   - Pydantic models (with validators)
   - Django forms (clean_ methods)
   - React form validation (Formik, React Hook Form)

4. **Error Handlers**
   - try/except blocks (Python)
   - rescue/ensure blocks (Ruby)
   - try/catch blocks (JS)

5. **Authentication Checks**
   - Decorators (@require_auth)
   - Middleware (auth middleware)
   - Guards (AuthGuard)

6. **Component Structures**
   - React components (functional, class)
   - Vue components
   - Rails views/partials

7. **Test Patterns**
   - Unit tests (pytest, jest, rspec)
   - Integration tests
   - E2E tests (Cypress, Capybara)

8. **Data Transformations**
   - Serializers (Django REST, FastAPI)
   - JSON transformations
   - Data mappers

9. **Background Jobs**
   - Celery tasks
   - Sidekiq jobs
   - Bull.js jobs

10. **Configuration Patterns**
    - Environment variables
    - Config classes
    - Settings files

---

## Extraction Process

### Step 1: File Discovery (1-2 seconds)

```python
def discover_files(project_root):
    """Find all source code files"""
    
    # Ignore directories
    ignore_dirs = {
        'node_modules', 'venv', '.venv', 'env',
        '.git', 'dist', 'build', '__pycache__',
        'tmp', 'log', 'coverage'
    }
    
    # Include extensions
    include_exts = {
        '.py', '.js', '.jsx', '.ts', '.tsx',
        '.rb', '.erb', '.go', '.java'
    }
    
    source_files = []
    
    for root, dirs, files in os.walk(project_root):
        # Remove ignored dirs
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in include_exts:
                source_files.append(os.path.join(root, file))
    
    return source_files
```

### Step 2: File Analysis (2-5 seconds per file)

**Python Example:**
```python
import ast

def analyze_python_file(file_path):
    """Extract patterns from Python file using AST"""
    
    with open(file_path) as f:
        try:
            tree = ast.parse(f.read())
        except SyntaxError:
            return []  # Skip malformed files
    
    patterns = []
    
    for node in ast.walk(tree):
        # Pattern 1: API endpoints
        if isinstance(node, ast.FunctionDef):
            # Check for route decorators
            for decorator in node.decorator_list:
                if is_route_decorator(decorator):
                    patterns.append({
                        'type': 'api_endpoint',
                        'file': file_path,
                        'function': node.name,
                        'method': extract_http_method(decorator),
                        'path': extract_route_path(decorator),
                        'params': [arg.arg for arg in node.args.args],
                        'has_auth': check_for_auth_decorator(node),
                        'has_error_handling': check_for_try_except(node),
                        'code': ast.unparse(node),
                        'line_number': node.lineno
                    })
        
        # Pattern 2: Database queries
        if isinstance(node, ast.Call):
            if is_database_query(node):
                patterns.append({
                    'type': 'database_query',
                    'file': file_path,
                    'method': extract_query_method(node),
                    'model': extract_model_name(node),
                    'has_filtering': check_for_filters(node),
                    'code': ast.unparse(node),
                    'line_number': node.lineno
                })
        
        # ... more pattern types
    
    return patterns

def is_route_decorator(decorator):
    """Check if decorator is a route (e.g., @app.get)"""
    if isinstance(decorator, ast.Call):
        func = decorator.func
        if isinstance(func, ast.Attribute):
            return func.attr in ['get', 'post', 'put', 'delete', 'patch']
    return False
```

### Step 3: Deduplication (1-2 seconds)

```python
def deduplicate_patterns(patterns):
    """Remove duplicate patterns based on structural similarity"""
    
    unique_patterns = []
    seen_hashes = set()
    
    for pattern in patterns:
        # Create hash based on structure (not exact code)
        pattern_hash = create_pattern_hash(pattern)
        
        if pattern_hash not in seen_hashes:
            seen_hashes.add(pattern_hash)
            unique_patterns.append(pattern)
    
    return unique_patterns

def create_pattern_hash(pattern):
    """Create hash representing pattern structure"""
    
    if pattern['type'] == 'api_endpoint':
        # Hash based on: method + param count + auth presence
        return hash((
            pattern['method'],
            len(pattern['params']),
            pattern['has_auth'],
            pattern['has_error_handling']
        ))
    
    elif pattern['type'] == 'database_query':
        # Hash based on: query method + model + filters
        return hash((
            pattern['method'],
            pattern['model'],
            pattern['has_filtering']
        ))
    
    # ... other types
```

### Step 4: Confidence Scoring (1 second)

```python
def calculate_confidence_scores(patterns):
    """Score patterns by frequency and quality indicators"""
    
    # Count pattern occurrences
    pattern_counts = defaultdict(int)
    for pattern in patterns:
        key = create_pattern_key(pattern)
        pattern_counts[key] += 1
    
    # Add confidence to each pattern
    for pattern in patterns:
        key = create_pattern_key(pattern)
        count = pattern_counts[key]
        
        # Base confidence from frequency
        # 1 occurrence: 50%, 2: 60%, 3: 70%, 5+: 90%
        freq_score = min(90, 40 + count * 10)
        
        # Bonus for quality indicators
        quality_bonus = 0
        if pattern.get('has_auth'):
            quality_bonus += 5  # Has authentication
        if pattern.get('has_error_handling'):
            quality_bonus += 5  # Has error handling
        if pattern.get('has_tests'):
            quality_bonus += 10  # Has tests
        if pattern.get('has_docstring'):
            quality_bonus += 5  # Has documentation
        
        pattern['confidence'] = min(100, freq_score + quality_bonus)
        pattern['frequency'] = count
    
    return patterns
```

---

## Skill Generation

### Input Format

After extraction, patterns are organized by category:

```json
{
  "api_endpoints": [
    {
      "type": "api_endpoint",
      "file": "backend/routes/customers.py",
      "function": "create_customer",
      "method": "POST",
      "path": "/api/customers",
      "params": ["customer_data", "current_user"],
      "has_auth": true,
      "has_error_handling": true,
      "code": "@router.post('/api/customers')\nasync def create_customer(...)...",
      "confidence": 85,
      "frequency": 5
    },
    // ... more endpoints
  ],
  "database_queries": [ /* ... */ ],
  "form_validations": [ /* ... */ ]
}
```

### Generation Algorithm

```python
class SkillGenerator:
    def __init__(self, patterns, project_name):
        self.patterns = patterns
        self.project_name = project_name
        self.min_confidence = 70
        self.min_examples = 3
    
    def should_generate_skill(self, category):
        """Determine if we have enough data to generate skill"""
        
        category_patterns = self.patterns.get(category, [])
        
        # Filter high-confidence patterns
        high_conf = [p for p in category_patterns 
                    if p['confidence'] >= self.min_confidence]
        
        # Need at least 3 high-confidence examples
        return len(high_conf) >= self.min_examples
    
    def generate_skill(self, category):
        """Generate skill markdown from patterns"""
        
        patterns = [p for p in self.patterns[category]
                   if p['confidence'] >= self.min_confidence]
        
        # Analyze patterns to find commonalities
        common_structure = self.analyze_common_structure(patterns)
        best_practices = self.extract_best_practices(patterns)
        anti_patterns = self.find_anti_patterns(self.patterns[category])
        
        # Generate skill content
        skill = self.build_skill_markdown(
            category,
            common_structure,
            best_practices,
            anti_patterns,
            patterns[:5]  # Top 5 examples
        )
        
        return skill
    
    def analyze_common_structure(self, patterns):
        """Find what patterns have in common"""
        
        if patterns[0]['type'] == 'api_endpoint':
            # Check what % have auth
            auth_count = sum(1 for p in patterns if p['has_auth'])
            auth_percent = (auth_count / len(patterns)) * 100
            
            # Check what % have error handling
            error_count = sum(1 for p in patterns if p['has_error_handling'])
            error_percent = (error_count / len(patterns)) * 100
            
            structure = []
            
            if auth_percent > 70:
                structure.append("Authentication is required (decorator or middleware)")
            
            if error_percent > 70:
                structure.append("Error handling with try/except blocks")
            
            # Check parameter patterns
            param_counts = [len(p['params']) for p in patterns]
            avg_params = sum(param_counts) / len(param_counts)
            structure.append(f"Average {avg_params:.0f} parameters per endpoint")
            
            return "\n".join(f"- {s}" for s in structure)
        
        # ... other pattern types
    
    def extract_best_practices(self, patterns):
        """Find best practices from high-quality examples"""
        
        # Look for quality indicators across patterns
        practices = []
        
        # Check for authentication
        if all(p.get('has_auth') for p in patterns):
            practices.append({
                'practice': 'Always require authentication',
                'reason': '100% of endpoints use auth decorators',
                'example': patterns[0]['code']
            })
        
        # Check for error handling
        if sum(p.get('has_error_handling', 0) for p in patterns) / len(patterns) > 0.8:
            practices.append({
                'practice': 'Comprehensive error handling',
                'reason': '80%+ of code includes try/except blocks',
                'example': next(p['code'] for p in patterns if p.get('has_error_handling'))
            })
        
        return practices
    
    def find_anti_patterns(self, all_patterns):
        """Identify anti-patterns from low-quality examples"""
        
        # Low confidence patterns often show what NOT to do
        low_conf = [p for p in all_patterns if p['confidence'] < 50]
        
        anti_patterns = []
        
        # Missing authentication
        no_auth = [p for p in low_conf if not p.get('has_auth')]
        if no_auth:
            anti_patterns.append({
                'pattern': 'Missing authentication',
                'why_bad': 'Security vulnerability - endpoints should require auth',
                'how_to_fix': 'Add @require_auth or similar decorator',
                'example': no_auth[0]['code']
            })
        
        # No error handling
        no_errors = [p for p in low_conf if not p.get('has_error_handling')]
        if no_errors:
            anti_patterns.append({
                'pattern': 'No error handling',
                'why_bad': 'Uncaught exceptions crash the app',
                'how_to_fix': 'Wrap risky code in try/except blocks',
                'example': no_errors[0]['code']
            })
        
        return anti_patterns
    
    def build_skill_markdown(self, category, structure, practices, anti_patterns, examples):
        """Generate final skill markdown"""
        
        avg_conf = sum(e['confidence'] for e in examples) / len(examples)
        
        md = f"""# {self.project_name} - {category.replace('_', ' ').title()} Patterns

## Overview

**Auto-generated skill** from project codebase analysis.

- **Confidence:** {avg_conf:.0f}%
- **Based on:** {len(examples)} code examples
- **Last updated:** {datetime.now().strftime('%Y-%m-%d')}

This skill captures common patterns found in your project's {category.replace('_', ' ')}.

---

## Common Structure

{structure}

---

## Best Practices

"""
        
        for i, practice in enumerate(practices, 1):
            md += f"""
### {i}. {practice['practice']}

**Why:** {practice['reason']}

```python
{practice['example']}
```

---
"""
        
        md += """
## Anti-Patterns (What to Avoid)

"""
        
        for i, anti in enumerate(anti_patterns, 1):
            md += f"""
### ❌ {i}. {anti['pattern']}

**Why it's bad:** {anti['why_bad']}

**How to fix:** {anti['how_to_fix']}

**Example (don't do this):**
```python
{anti['example']}
```

---
"""
        
        md += """
## Code Examples

"""
        
        for i, example in enumerate(examples, 1):
            md += f"""
### Example {i}: {example.get('function', 'Unnamed')}

**File:** `{example['file']}`  
**Confidence:** {example['confidence']}%

```python
{example['code']}
```

---
"""
        
        return md
```

### Output Format

Generated skills are saved to:
```
.claude/skills/project/{category}-{date}/
├── SKILL.md                  # Main skill file
├── skill-info.json           # Metadata
└── activation-rules.json     # Auto-activation config
```

**skill-info.json:**
```json
{
  "name": "API Endpoint Patterns",
  "category": "api_endpoints",
  "generated_at": "2025-10-30T14:23:15Z",
  "confidence": 85,
  "example_count": 12,
  "auto_generated": true,
  "requires_review": true
}
```

**activation-rules.json:**
```json
{
  "file_patterns": [
    "backend/routes/**/*.py",
    "api/**/*.py"
  ],
  "keywords": [
    "API",
    "endpoint",
    "route",
    "@router",
    "@app"
  ],
  "priority": 20
}
```

---

## Review Workflow

### CLI Command

User runs: `claude-app review-patterns`

### Review UI

```
🔍 Analyzing codebase for new patterns...

Found 427 patterns across 10 categories.
Generating skills...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Generated 3 new skills:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ API Endpoint Patterns
   Confidence: 85%
   Examples: 12

2️⃣ Database Query Patterns
   Confidence: 78%
   Examples: 8

3️⃣ Form Validation Patterns
   Confidence: 72%
   Examples: 6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

=== Skill 1/3: API Endpoint Patterns ===

Category: API Design
Confidence: 85%
Based on: 12 code examples

Preview:
────────────────────────────────────────
# API Endpoint Patterns

## Common Structure
- Authentication is required (decorator)
- Error handling with try/except blocks
- Average 2 parameters per endpoint

## Best Practices
1. Always require authentication (100% of endpoints use auth)
2. Comprehensive error handling (83% include try/except)
────────────────────────────────────────

? What would you like to do?
❯ Approve and activate
  View full skill
  Edit before activating
  Reject
  Skip (decide later)

> Approve and activate

✅ Skill activated! Will be available in next Claude session.

Continue to next skill? (Y/n) › Yes
```

### Actions

**Approve and activate:**
- Moves skill to active skills directory
- Updates Claude Code config to include skill
- Skill will auto-activate on next session

**View full skill:**
- Opens skill in pager (less/more)
- User can read entire markdown
- Return to action menu

**Edit before activating:**
- Opens skill in $EDITOR
- User can modify any part
- On save, activate modified version

**Reject:**
- Deletes generated skill
- Records rejection (won't regenerate same pattern)

**Skip:**
- Leaves skill in review queue
- Can review later with `claude-app review-patterns`

---

## Scheduling

### Cron Job Setup

During project initialization, CLI adds cron job:

```bash
# Added by Claude App Builder
0 2 */2 * * cd /path/to/project && /path/to/venv/bin/python .claude/self-learning/extract.py
```

Runs at 2:00 AM every 2 days.

### Manual Trigger

User can also trigger manually:
```bash
$ claude-app extract-patterns
# or
$ python .claude/self-learning/extract.py
```

---

## Privacy & Data Handling

### What Gets Analyzed

- Source code files only (.py, .js, .rb, etc.)
- Configuration files (for pattern detection)
- Test files (to identify test patterns)

### What Gets Ignored

- node_modules, venv, vendor directories
- Build artifacts (dist, build)
- Logs and temporary files
- .env files (environment variables)
- Database dumps
- Binary files

### Data Storage

- All analysis happens **locally** on user's machine
- Generated skills stored in `.claude/skills/project/`
- No code is sent to external servers (unless user opts into telemetry)

### Telemetry Opt-in

If user opts in to telemetry:
- Only metadata sent (skill names, confidence scores, category counts)
- **NO CODE** is ever transmitted
- Used to improve recommendation algorithm
- Easy opt-out anytime

---

## Performance

### Benchmarks

Tested on quotation-app (5,500 lines across 100+ files):

- File discovery: 0.3 seconds
- Pattern extraction: 4.2 seconds
- Deduplication: 0.8 seconds
- Confidence scoring: 0.2 seconds
- Skill generation: 1.5 seconds
- **Total: 7 seconds**

### Optimization

For large projects (10,000+ files):
- Parallel processing (multiprocessing.Pool)
- Incremental extraction (only analyze changed files)
- Caching (skip files that haven't changed since last run)

---

## Future Enhancements

**Version 1.1:**
- Learn from git commits (analyze diffs)
- Detect breaking changes automatically
- Suggest refactoring opportunities

**Version 1.2:**
- LLM-powered pattern analysis (Claude API)
- Natural language descriptions of patterns
- Interactive pattern refinement

**Version 2.0:**
- Cross-project learning (learn from all users)
- Pattern marketplace (share skills)
- AI-generated code from learned patterns

---

**End of Self-Learning Specification**
