# Claude App Builder Framework - Planning Documents
**Created:** 2025-10-30  
**Status:** Ready for implementation  
**Target Launch:** 30 days (2025-11-29)

---

## Overview

This directory contains comprehensive planning for building the **Claude App Builder Framework** - a paid product ($399, beta $199) that helps non-technical entrepreneurs build 95% of business apps in 2 weeks using Claude Code.

**Key Innovation:** Self-learning system that extracts patterns from your project every 2 days and generates custom Claude Code skills.

---

## Planning Documents

### 1. FRAMEWORK_IMPLEMENTATION_PLAN.md (30-40 pages)

**Comprehensive 8-phase implementation plan with detailed tasks.**

**Phases:**
1. **Foundation & Architecture** (Days 1-3, 24h) - CLI tool, packaging, docs
2. **Stack Templates** (Days 4-10, 56h) - 4 production-ready templates
3. **Wizard & Stack Selector** (Days 11-13, 24h) - 12-question wizard, AI recommender
4. **Self-Learning System** (Days 14-18, 40h) - Pattern extraction, skill generation
5. **Shared Skills Library** (Days 19-21, 24h) - Universal skills across stacks
6. **Automation** (Days 22-24, 24h) - Slash commands, git hooks
7. **Testing & Refinement** (Days 25-27, 24h) - Bug fixes, polish
8. **Beta Launch Prep** (Days 28-30, 24h) - Docs, licensing, marketing

**Total:** 30 days, 240 hours

**Highlights:**
- Detailed task breakdowns for each phase
- Time estimates per task
- Dependencies clearly marked
- Extraction plans from quotation-app
- Risk mitigation strategies

---

### 2. FRAMEWORK_ARCHITECTURE.md (20-30 pages)

**Complete technical architecture with diagrams and code examples.**

**Sections:**
1. **System Overview** - Component diagram, data flow
2. **CLI Tool** - Wizard, stack selector, project generator (Node.js)
3. **Stack Templates** - 4 templates with examples
4. **Skills System** - Auto-activation, skill structure
5. **Self-Learning System** - Pattern extraction (Python AST)
6. **Automation** - Slash commands, git hooks
7. **Licensing & Telemetry** - License validation, usage tracking
8. **Security & Privacy** - Data handling, telemetry opt-in

**Technology Stack:**
- CLI: Node.js + Inquirer + Commander
- Self-learning: Python + AST parsing
- Licensing: Node.js + PostgreSQL + Stripe
- Templates: Rails, Next+FastAPI, Next+Supabase, Django

**Key Algorithms:**
- Stack recommendation (30+ rules)
- Pattern extraction (AST-based)
- Skill generation (confidence scoring)
- License validation (server-side)

---

### 3. WIZARD_SPECIFICATION.md

**Detailed specification for 12-question interactive wizard.**

**Question Categories:**
1. **Project Basics** (3 questions) - Name, description, type
2. **Technical Requirements** (4 questions) - Users, data, real-time, mobile
3. **Team Context** (3 questions) - Size, experience, deployment comfort
4. **Feature Priorities** (2 questions) - Must-have features, integrations

**Each Question Includes:**
- Exact prompt text
- Input type (text, select, multi-select)
- Validation rules
- Example answers
- Scoring impact on stack recommendation

**Recommendation Algorithm:**
- Scoring matrix for 4 stacks
- 30+ rules based on answers
- Confidence calculation
- Reasoning generation
- Manual override option

**Example Full Wizard Session:** Included at end showing complete flow.

---

### 4. SELF_LEARNING_SPECIFICATION.md

**Complete specification for pattern extraction and skill generation.**

**Pattern Extraction:**
- Supports Python, JavaScript/TypeScript, Ruby
- AST parsing for accurate pattern detection
- 10 pattern categories (API, DB, forms, errors, auth, etc.)
- Deduplication algorithm
- Confidence scoring (50-100%)

**Extraction Process:**
1. File discovery (ignore node_modules, venv)
2. File analysis (AST for Python/Ruby, regex for JS)
3. Deduplication (structural hashing)
4. Confidence scoring (frequency + quality indicators)

**Skill Generation:**
- Input: Patterns by category
- Output: Markdown skill file
- Analyzes common structure
- Extracts best practices
- Identifies anti-patterns
- Generates examples

**Review Workflow:**
- CLI command: `claude-app review-patterns`
- Interactive approval process
- Edit before activating option
- Scheduled every 2 days via cron

**Performance:** 7 seconds for 5,500 lines (100+ files)

---

### 5. STACK_TEMPLATES_GUIDE.md

**Step-by-step guide to building all 4 stack templates.**

**Template Requirements (All Stacks):**
1. Authentication system
2. CRUD example (Customers entity)
3. Multi-tenant setup
4. Export functionality (PDF, Excel)
5. Testing infrastructure
6. Claude Code integration
7. Development tooling
8. Documentation

**4 Stacks Covered:**

**1. Rails Template**
- Rails 7.1 + Hotwire + Tailwind
- Multi-tenant with acts_as_tenant
- Devise auth + Pundit authorization
- Prawn (PDF) + Caxlsx (Excel)
- RSpec + Capybara + FactoryBot

**2. Next.js + FastAPI Template**
- **HEAVILY extracted from quotation-app!**
- Copy entire frontend/backend skills (6,800+ lines)
- Supabase PostgreSQL with RLS
- Ant Design + ag-Grid
- Pytest + Jest

**3. Next.js + Supabase Template**
- Supabase (Auth + DB + Storage + Edge Functions)
- RLS for multi-tenancy (extract from quotation-app)
- Ant Design + Tailwind
- Edge Functions for exports

**4. Django Template**
- Django 5.0 + django-tenants
- HTMX + Alpine.js + Tailwind
- Django REST Framework (API)
- ReportLab (PDF) + openpyxl (Excel)
- Pytest-django

**Each Template Section Includes:**
- Complete directory structure
- Technology stack details
- Extraction plan from quotation-app
- Step-by-step build instructions
- Testing checklist
- Common pitfalls

**Claude Code Integration:**
- 3-5 domain-specific skills per template
- 2-3 slash commands
- Git hooks (pre-commit, pre-push)
- CLAUDE.md project instructions

---

### 6. BETA_LAUNCH_CHECKLIST.md

**Complete checklist for 30-day beta launch.**

**Pre-Launch (Days 1-27):**
- [ ] Product development (Phases 1-7)
- [ ] Documentation (7 guides + videos)
- [ ] Licensing & payment (Stripe)
- [ ] Marketing materials (landing page)
- [ ] Infrastructure (license server)

**Launch Day (Day 30):**
- Morning: Final smoke test, publish npm package
- Midday: Social media blitz (Twitter, LinkedIn, Reddit, HN)
- Afternoon: Monitor & support
- Evening: Analyze & iterate

**Post-Launch (Days 31-60):**
- Week 1: Support & bug fixes (Goal: 20+ customers)
- Week 2: Feedback & iteration
- Week 3: Content & growth
- Week 4: Scaling (Goal: 50+ customers - $9,950 revenue)

**Success Metrics:**
- Launch day: 5+ purchases
- Week 1: 20+ customers ($3,980)
- Week 4: 50+ customers ($9,950) - **Beta goal met!**
- Month 2: 100+ customers ($19,900)

**Emergency Procedures:**
- Critical bug protocol
- Server down response
- Payment issues handling
- Negative feedback management

**Communication Templates:**
- Welcome email
- Day 3 check-in
- Week 1 feedback request

**Tools & Services:**
- Essential: $88/month (domain, hosting, DB, CDN, email, Stripe, Sentry)
- Nice to have: $162/month (analytics, support, docs, status)

---

## Extraction from Quotation App

**The framework heavily leverages code and patterns from the quotation-app project.**

### Direct Copies (Copy as-is):

1. **Frontend Skills** - 3,632 lines
   - Source: `.claude/skills/frontend-dev-guidelines/`
   - Destination: `templates/nextjs-fastapi/skills/frontend-dev-guidelines/`
   - Changes: Remove quote-specific examples

2. **Backend Skills** - 3,200+ lines
   - Source: `.claude/skills/backend-dev-guidelines/`
   - Destination: `templates/nextjs-fastapi/skills/backend-dev-guidelines/`
   - Changes: Remove calculation-specific parts

3. **Database Patterns**
   - Source: `.claude/skills/database-verification/`
   - Use for: RLS patterns in Next+Supabase template
   - Generalize for: All database-related skills

4. **Hooks System**
   - Source: `.claude/hooks/`
   - Adapt for: All 4 templates (make cross-platform)

5. **Commands**
   - Source: `.claude/commands/`
   - Extract: `/test-quote-creation` → generalize to `/test-e2e`
   - Extract: `/fix-typescript-errors` → copy as-is
   - Extract: `/apply-migration` → generalize for all DBs
   - Extract: `/debug-calculation` → generalize to `/debug-api`

### Patterns to Extract:

1. **Multi-tenant Architecture**
   - Organization model
   - User-organization relationship
   - RLS policies (PostgreSQL)

2. **Export Services**
   - PDF generation logic
   - Excel generation with templates
   - File download handling

3. **Authentication Patterns**
   - Supabase Auth integration
   - JWT handling
   - Protected routes

4. **CRUD Patterns**
   - ag-Grid setup
   - Ant Design forms
   - API integration
   - Error handling

5. **Testing Patterns**
   - Pytest configuration
   - Test factories
   - API testing
   - E2E testing (Chrome DevTools MCP)

---

## Key Innovations

### 1. Self-Learning System

**Unique selling point:** Framework learns from your codebase every 2 days.

**How it works:**
1. Cron job runs pattern extractor (Python AST)
2. Finds 10 pattern types (API, DB, forms, etc.)
3. Generates skills with confidence scores
4. User reviews and approves
5. Skills activate automatically in Claude Code

**Impact:** Your AI assistant gets smarter as you build.

### 2. AI Stack Recommender

**30+ rules analyze wizard answers to recommend optimal stack.**

**Factors considered:**
- Team experience (Python vs Ruby vs JS)
- Scale requirements (100 vs 10,000+ users)
- Real-time needs (Hotwire vs Supabase real-time)
- Deployment comfort (one-click vs DevOps)
- Budget constraints
- Feature priorities

**Output:** Recommended stack + reasoning + confidence score.

### 3. Skills System Integration

**Every template comes with pre-built Claude Code skills.**

**Universal skills (shared/):**
- test-driven-development
- systematic-debugging
- git-workflow
- security-checklist
- performance-optimization

**Stack-specific skills:**
- Rails: rails-patterns, hotwire-patterns
- Next+FastAPI: frontend-dev-guidelines, backend-dev-guidelines
- Next+Supabase: supabase-patterns, rls-patterns
- Django: django-patterns, htmx-patterns

**Auto-generated skills (project/):**
- Created by self-learning system
- Based on your project's patterns
- Updated every 2 days

### 4. Slash Commands

**Automation for common tasks.**

**Examples:**
- `/generate-crud Customer` - Creates model, API, UI, tests
- `/run-tests` - Runs full test suite
- `/apply-migration` - Applies DB migration with backup
- `/debug-api /api/customers` - Traces API request

---

## Business Model

### Pricing

**Beta (first 50 customers):** $199 one-time  
**Full Launch:** $399 one-time  
**Team Plan (future):** $99/month (5+ developers)

### Revenue Projections

**Beta (Month 1):**
- 50 customers × $199 = **$9,950**

**Months 2-3:**
- 150 more customers × $399 = **$59,850**
- Total: **$69,800** (200 customers)

**Month 6:**
- 500 total customers × avg $350 = **$175,000**

**Year 1:**
- 1,500 customers × avg $350 = **$525,000**

### Costs

**Month 1:**
- Infrastructure: $88/month
- Development time: Your time (already invested)
- Marketing: $500 (ads, social media)

**Profit Margin:** 95%+ (software product)

---

## Timeline Summary

| Phase | Days | Description | Deliverable |
|-------|------|-------------|-------------|
| 1 | 1-3 | Foundation | CLI tool working |
| 2 | 4-10 | Templates | 4 production-ready stacks |
| 3 | 11-13 | Wizard | 12-question wizard + AI recommender |
| 4 | 14-18 | Self-learning | Pattern extraction + skill generation |
| 5 | 19-21 | Skills | 20+ universal skills |
| 6 | 22-24 | Automation | Commands + hooks |
| 7 | 25-27 | Testing | Bug fixes, polish |
| 8 | 28-30 | Launch prep | Docs, licensing, marketing |
| **Total** | **30** | **Complete framework** | **Ready for beta launch** |

---

## Next Steps

### Week 1: Start Development

1. **Read all planning docs** (this folder)
2. **Set up development environment**
   - Node.js 18+
   - Python 3.12+
   - PostgreSQL 15+
3. **Begin Phase 1** (Foundation)
   - Create GitHub repo
   - Set up project structure
   - Build CLI scaffolding

### Week 2-4: Core Development

Follow implementation plan phases 2-7.

### Week 5: Launch Prep

Execute Phase 8 (beta launch prep).

---

## Questions?

**During development:**
- Reference these docs constantly
- Update if you find better approaches
- Document decisions in CHANGELOG.md

**Technical questions:**
- Check FRAMEWORK_ARCHITECTURE.md
- Look at extraction notes from quotation-app
- Refer to Stack Templates Guide

**Launch questions:**
- See BETA_LAUNCH_CHECKLIST.md
- Review success metrics
- Follow communication templates

---

## Document Change Log

**2025-10-30:** Initial planning documents created
- 6 comprehensive documents (40,000+ words)
- 8-phase implementation plan (240 hours)
- 30-day timeline to beta launch
- Complete extraction plan from quotation-app

---

**Let's build this! 🚀**

