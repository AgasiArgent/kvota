# Formula Parser & Modular Platform - Complete Design

**Date:** 2025-01-15
**Status:** Design Approved
**Timeline:** Q1 2025 → Q1 2026 (14 months)
**Approach:** Phased (CRM first → Formula Parser → Modular Platform)

---

## Executive Summary

Transform kvota from single B2B quotation app into **multi-market calculation platform**:

### Two Target Markets:
1. **B2B ВЭД Companies** (import/export traders)
   - Need: Quotation + CRM + Custom calculations
   - ARPU: $100-150/month

2. **Marketplace Sellers** (Wildberries, Ozon, Яндекс.Маркет)
   - Need: Sourcing calculator + MP integrations + Analytics
   - ARPU: $50-80/month

### Killer Feature: **Excel → Python Calculation Engine**
- Clients upload Excel files with their custom formulas
- System automatically parses and converts to Python
- Each organization gets their own calculation engine
- **Differentiation:** No other B2B platform offers this

### Architecture: **Module Marketplace**
- Core Platform (free)
- Modules sold separately ($19-49/month each)
- Allows targeting both markets with different module combinations

---

## Phase 1: Current State Analysis

### Existing kvota (as of 2025-01-15):

**Stack:**
- Frontend: Next.js 15.5 + React 19 + Ant Design + ag-Grid
- Backend: FastAPI + Python 3.12 + Supabase PostgreSQL
- Calculation: 1364 lines hardcoded Python (13 phases, 42 variables)

**What exists:**
- ✅ Multi-tenant with RLS
- ✅ Customers management
- ✅ Quotes with complex calculations
- ✅ Excel/PDF export
- ✅ Approval workflow
- ✅ Dashboard analytics

**What's missing for target markets:**
- ❌ CRM (Leads pipeline, Activities, Calendar)
- ❌ Customizable calculations (each client has own formulas)
- ❌ MP-specific features (комиссии, интеграции)
- ❌ Modular architecture (can't sell separately)

---

## Phase 2: Formula Parser Deep Dive

### Problem Statement

**Current situation:**
- kvota has ONE calculation engine (calculation_engine.py - 1364 lines)
- All clients use same formulas
- New client with different formulas = manual code changes

**Real need (discovered from user):**
- Different clients have different calculation logic
- Example: Мастер Бэринг has 79 named ranges, complex VЭД formulas
- Formulas change rarely (once per year), but need flexibility
- Clients already have Excel files with their calculations

**Solution:**
Upload Excel → System parses formulas → Generates Python calculation engine

---

### Technical Analysis: test_raschet.xlsm

**File analyzed:** `/validation_data/test_raschet.xlsm`

**Structure:**
- 11 sheets (mainly "расчет" with 2023 rows × 64 columns)
- 450+ Excel formulas
- 79 named ranges (seller_company, rate_vatRu, advance_to_vendor, etc)
- Excel Tables with structured references
- VBA macros (present but will be ignored)

**Excel Functions Used:**
```
Tier 1 (Basic):
- IF, AND, OR, NOT
- SUM, ROUND, ROUNDUP
- VLOOKUP
- IFERROR, IFNA

Tier 2 (Medium):
- TEXT, AVERAGEIF
- ISBLANK, ISNUMBER
- HYPERLINK

Tier 3 (Advanced):
- XLOOKUP (_xlfn.XLOOKUP) ← Need auto-conversion to VLOOKUP
```

**Example formulas:**
```excel
=+(BJ2*(1+avg_cap)+BJ3)*(1+IF(seller_region="RU",rate_vatRu,0))
=_xlfn.XLOOKUP(seller_company,Table9[Column1],Table9[Страна],0,0)
=IF((BH9+IF(BH3>BH6,BH3-BH6,0))>BH8,0,BH8-(BH9+IF(BH3>BH6,BH3-BH6,0)))
```

**Complexity assessment:**
- 🟢 Simple: ~60% (arithmetic, SUM, basic IF)
- 🟡 Medium: ~30% (nested IF, VLOOKUP, named ranges)
- 🔴 Complex: ~10% (XLOOKUP, structured references, conditional logic)

---

### Formula Parser Architecture

#### Core Components:

```
┌──────────────────────────────────────────────────────────┐
│                   SETUP WORKFLOW                         │
│                   (once per org)                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Upload Excel (.xlsm)                                │
│       ↓                                                  │
│  2. Excel Parser (openpyxl)                             │
│       - Extract formulas                                 │
│       - Extract named ranges                             │
│       - Extract tables                                   │
│       - Detect VBA macros                                │
│       ↓                                                  │
│  3. Formula Parser (formulas library)                   │
│       - Parse Excel AST                                  │
│       - Convert functions                                │
│       - Resolve references                               │
│       ↓                                                  │
│  4. Security Validator                                   │
│       - Check forbidden patterns (eval, exec, VBA)      │
│       - Check complexity (>1000 formulas = review)      │
│       - Check unsupported functions                      │
│       - Risk level: safe/review/reject                   │
│       ↓                                                  │
│  5. Admin Review (Auto or Manual)                       │
│       - Auto-approve if: safe + <500 formulas          │
│       - Manual review if: warnings or complex           │
│       ↓                                                  │
│  6. Code Generator                                       │
│       - Generate Python functions                        │
│       - Topological sort (dependency order)             │
│       - Save: calculation_engines/{org_id}_v{N}.py      │
│       ↓                                                  │
│  7. Test Execution                                       │
│       - Run sample calculation                           │
│       - Validate results                                 │
│       ↓                                                  │
│  8. Activate                                             │
│       - Status: approved → active                        │
│       - Organization can use                             │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   USAGE WORKFLOW                         │
│                   (every calculation)                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. User creates Quote                                   │
│       ↓                                                  │
│  2. Input data (quantity, price, weight, etc)           │
│       ↓                                                  │
│  3. Load organization's calculation template            │
│       ↓                                                  │
│  4. Execute dynamic calculation engine                   │
│       ↓                                                  │
│  5. Return results (all calculated fields)              │
│       ↓                                                  │
│  6. Audit log (for compliance)                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Database Schema:

```sql
-- Calculation Templates (parsed formulas stored)
CREATE TABLE calculation_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,

  -- Parsed data (JSON)
  formulas JSONB NOT NULL,        -- [{"cell": "S16", "formula": "=E16*R16", "python": "E16 * R16"}]
  named_ranges JSONB NOT NULL,    -- {"seller_company": "расчет!$B$8", ...}
  tables JSONB,                    -- {"Table9": {"ref": "A1:B10", "columns": [...]}}
  variables JSONB NOT NULL,        -- Input/output variable mapping

  -- Files
  excel_file_url TEXT NOT NULL,   -- S3 link to original Excel
  excel_hash VARCHAR(64) NOT NULL, -- SHA256 for change detection
  generated_code TEXT,             -- Generated Python code

  -- Status
  status VARCHAR(20) DEFAULT 'pending',  -- pending/approved/rejected/active
  risk_level VARCHAR(20),          -- safe/review/reject
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,

  -- Metadata
  has_macros BOOLEAN DEFAULT FALSE,
  formula_count INTEGER,
  complexity_score DECIMAL,

  -- Settings
  settings JSONB DEFAULT '{}',     -- {"timeout_ms": 5000, "max_iterations": 100}

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, version)
);

CREATE INDEX idx_calc_templates_org_status ON calculation_templates(organization_id, status);
CREATE INDEX idx_calc_templates_pending ON calculation_templates(status) WHERE status = 'pending';

-- Calculation Executions (audit trail)
CREATE TABLE calculation_executions (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES calculation_templates(id),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  quote_id UUID REFERENCES quotes(id),  -- Optional: if part of quote

  -- Input
  input_data JSONB NOT NULL,       -- {"quantity": 100, "base_price": 50, ...}

  -- Output
  result_data JSONB,               -- Calculation results
  execution_time_ms INTEGER,

  -- Status
  status VARCHAR(20) NOT NULL,     -- success/error/timeout
  error_message TEXT,
  stack_trace TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calc_exec_template ON calculation_executions(template_id, created_at DESC);
CREATE INDEX idx_calc_exec_errors ON calculation_executions(status, created_at DESC) WHERE status = 'error';

-- Admin Review Queue
CREATE TABLE template_review_queue (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES calculation_templates(id),
  assigned_to UUID REFERENCES users(id),

  -- Review data
  warnings TEXT[],
  risk_factors TEXT[],
  notes TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',  -- pending/in_review/completed

  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);
```

#### API Endpoints:

```python
# Upload & Setup
POST   /api/calculation-templates/upload
  - Upload Excel file
  - Parse & validate
  - Return template_id & status (auto-approved or pending_review)

GET    /api/calculation-templates/{template_id}
  - Get template details
  - Formulas preview
  - Validation warnings

POST   /api/calculation-templates/{template_id}/test
  - Run test calculation with sample data
  - Validate results

# Admin Review
GET    /api/admin/templates/pending
  - List templates pending review
  - Filter by risk_level

POST   /api/admin/templates/{template_id}/approve
  - Approve template
  - Activate for organization

POST   /api/admin/templates/{template_id}/reject
  - Reject template
  - Provide reason

# Usage
POST   /api/calculate
  - Execute calculation using org's active template
  - Input: { quantity, price, ... }
  - Output: { calculated_fields, execution_time }

GET    /api/calculation-templates/active
  - Get organization's active template
  - Used by frontend

# Audit
GET    /api/calculation-executions
  - List execution history
  - Filter by status, date range
  - For compliance audits
```

---

### Security Model

#### Validation Rules:

```python
FORBIDDEN_PATTERNS = [
    # Python injection
    'eval', 'exec', '__import__', 'compile', 'open', 'file',

    # Excel external
    'EXTERNAL.LINK', 'WEB.SERVICE', 'WEBSERVICE',

    # VBA
    'VBA.', 'MACRO', 'CALL',

    # Dangerous references
    'INDIRECT',  # Can reference external files
    'OFFSET',    # Can access arbitrary ranges
]

SUPPORTED_FUNCTIONS = {
    # Tier 1 (always supported)
    'SUM', 'AVERAGE', 'MAX', 'MIN', 'COUNT',
    'IF', 'AND', 'OR', 'NOT',
    'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'ABS',
    'VLOOKUP', 'INDEX', 'MATCH',
    'IFERROR', 'IFNA',

    # Tier 2 (supported)
    'FV', 'PV', 'PMT',
    'TEXT', 'CONCATENATE',
    'SUMIF', 'COUNTIF', 'AVERAGEIF',
    'ISBLANK', 'ISNUMBER', 'ISTEXT',

    # Tier 3 (partial - auto-convert)
    'XLOOKUP',   # → INDEX-MATCH
    'SUMIFS',    # → sum with multiple conditions
    'COUNTIFS',  # → count with multiple conditions
}
```

#### Auto-Approve Criteria:

```python
def should_auto_approve(template: CalculationTemplate) -> bool:
    return (
        len(template.formulas) < 500 and
        template.risk_level == 'safe' and
        not template.has_macros and
        len(template.warnings) == 0 and
        all(f in SUPPORTED_FUNCTIONS for f in template.used_functions)
    )
```

#### Manual Review Triggers:

- 🟡 >500 formulas (complexity)
- 🟡 VBA macros detected
- 🟡 Unsupported functions (but convertible)
- 🟡 Very nested formulas (depth >10)
- 🔴 Forbidden patterns detected
- 🔴 Cannot parse formulas
- 🔴 Test execution failed

---

### Technology Stack (Formula Parser)

```python
# Core Libraries
openpyxl==3.1.2          # Excel file parsing
formulas==1.2.5          # Excel formula parsing/execution
numpy==1.24.3            # Array operations
pandas==2.0.3            # Data manipulation

# Code Generation
astor==0.8.1             # Python AST to code
black==23.7.0            # Code formatting

# Security
libcst==1.1.0            # Python CST manipulation
pydantic==2.3.0          # Validation

# Storage
boto3==1.28.25           # S3 for Excel files
```

---

## Phase 3: Modular Architecture

### Module System Design

```
Core Platform (Free, base for all modules)
├─ Auth & Multi-tenant
├─ Organizations & Users
├─ Permissions (role-based + module-based)
├─ Billing (Stripe subscriptions per module)
├─ Module Loader & Registry
└─ Calculation Engine Library (shared)

Modules (sold separately)
├─ Quotation Module ($49/mo)
│  ├─ Uses: Calculation Engine (dynamic or hardcoded)
│  ├─ Features: Quote creation, Approval, PDF/Excel export
│  └─ Target: B2B ВЭД companies
│
├─ CRM Module ($39/mo)
│  ├─ Leads pipeline
│  ├─ Activities (calls, meetings, tasks)
│  ├─ Google Calendar integration
│  └─ Target: B2B ВЭД companies
│
├─ Sourcing Calculator Module ($29/mo)
│  ├─ Uses: Calculation Engine (for unit economics)
│  ├─ MP-specific: WB/Ozon/Яндекс комиссии
│  ├─ FBO/FBS логистика
│  └─ Target: Marketplace sellers
│
├─ WB Integration Module ($19/mo)
│  ├─ API sync (sales, inventory, orders)
│  ├─ Auto-update комиссий
│  └─ Target: Marketplace sellers
│
├─ Ozon Integration Module ($19/mo)
├─ Яндекс.Маркет Integration Module ($19/mo)
│
├─ B2B Analytics Module ($29/mo)
│  ├─ Quote success rate, Customer insights
│  └─ Target: B2B ВЭД companies
│
└─ MP Analytics Module ($29/mo)
    ├─ ABC-анализ товаров, ROI по площадкам
    └─ Target: Marketplace sellers
```

### Module Manifest (example):

```json
{
  "id": "quotation",
  "name": "Quotation Module",
  "version": "1.0.0",
  "description": "B2B Quotation calculator with customizable formulas",
  "price": 49,
  "currency": "USD",
  "targetMarket": ["ved", "b2b"],

  "dependencies": ["core"],

  "routes": [
    {"path": "/api/quotation/*", "methods": ["GET", "POST", "PUT", "DELETE"]}
  ],

  "permissions": [
    "quotation.view",
    "quotation.create",
    "quotation.edit",
    "quotation.approve",
    "quotation.export"
  ],

  "migrations": [
    "001_create_quotes.sql",
    "002_add_approvals.sql"
  ],

  "settings": {
    "default_currency": "RUB",
    "default_approval_workflow": "sequential",
    "calculation_engine": "dynamic"
  }
}
```

### Module Loader:

```python
class ModuleRegistry:
    """Central registry for all modules"""

    def __init__(self):
        self.modules: Dict[str, Module] = {}
        self._discover_modules()

    async def install_module(self, org_id: UUID, module_id: str):
        """
        Install module for organization

        Steps:
        1. Check dependencies
        2. Run migrations
        3. Register routes
        4. Set permissions
        5. Create Stripe subscription
        6. Enable in DB
        """
        module = self.modules[module_id]

        # 1. Check dependencies
        for dep_id in module.dependencies:
            if not await self.is_enabled(org_id, dep_id):
                raise DependencyError(f"Module {dep_id} required")

        # 2. Run migrations
        await self._run_migrations(module, org_id)

        # 3. Register routes
        app.include_router(module.router, prefix=f"/api/{module_id}")

        # 4. Set permissions
        await self._setup_permissions(module, org_id)

        # 5. Billing
        org = await get_organization(org_id)
        await stripe.create_subscription(
            customer_id=org.stripe_customer_id,
            price_id=module.stripe_price_id
        )

        # 6. Enable
        await db.execute(
            "INSERT INTO enabled_modules (org_id, module_id, enabled_at) VALUES ($1, $2, NOW())",
            org_id, module_id
        )

        return {"status": "installed", "module_id": module_id}

    async def get_enabled_modules(self, org_id: UUID) -> List[Module]:
        """Get modules enabled for organization"""
        rows = await db.fetch(
            "SELECT module_id FROM enabled_modules WHERE org_id = $1 AND enabled = true",
            org_id
        )
        return [self.modules[row['module_id']] for row in rows]
```

---

## Phase 4: Implementation Roadmap

### Q1 2025 (Jan-Mar): CRM в монолит - Quick Win
**Duration:** 6-8 weeks
**Goal:** Get working CRM ASAP for Мастер Бэринг

**Deliverables:**
```
backend/
├─ models.py (add)
│  ├─ Lead (company_name, inn, phone, email, source, stage_id, assigned_to)
│  ├─ LeadStage (name, order, color, is_qualified)
│  └─ Activity (type, lead_id/customer_id, title, due_date, completed, google_event_id)
│
├─ routes/
│  ├─ leads.py (CRUD, pipeline, qualify → customer)
│  ├─ activities.py (CRUD, calendar sync)
│  └─ calendar.py (Google OAuth, sync events)
│
└─ services/
   ├─ email_parser.py (webhook from Make.com → create lead)
   └─ google_calendar_client.py (OAuth 2.0 flow)

frontend/src/modules/crm/ (NEW directory structure for future extraction)
├─ pages/
│  ├─ LeadsPipelinePage.tsx (Kanban board)
│  ├─ LeadsListPage.tsx (table view)
│  ├─ LeadDetailPage.tsx (edit, activities timeline)
│  └─ ActivitiesCalendarPage.tsx (calendar view)
│
├─ components/
│  ├─ LeadCard.tsx (for Kanban)
│  ├─ ActivityTimeline.tsx
│  └─ CalendarSync.tsx (Google OAuth button)
│
└─ services/
   ├─ lead-api.ts
   └─ activity-api.ts

migrations/
└─ 012_add_crm_tables.sql
```

**Integration:**
- Make.com webhook → POST /api/leads (auto-create from email)
- Leads → Customers (qualify button, copies data)
- Customers → Quotes (existing flow)

**Result:** ✅ Working CRM in 2 months, use immediately

---

### Q2 2025 (Apr-Jun): Formula Parser MVP
**Duration:** 10-12 weeks
**Goal:** Build customizable calculation engine (parallel with using CRM)

**Deliverables:**
```
core/formula_parser/
├─ __init__.py
├─ excel_reader.py (openpyxl wrapper) - Week 1-2
├─ formula_parser.py (formulas library integration) - Week 3-5
│  ├─ Tier 1 support (IF, SUM, VLOOKUP, etc)
│  ├─ Tier 2 support (FV, TEXT, IFERROR, etc)
│  └─ Tier 3 partial (XLOOKUP → auto-convert)
│
├─ code_generator.py (Python AST → code) - Week 6-8
│  ├─ Topological sort (dependency resolution)
│  ├─ Function generation
│  └─ Main calculator class
│
├─ validator.py (security checks) - Week 9
│  ├─ Forbidden patterns detection
│  ├─ Complexity scoring
│  └─ Auto-approve logic
│
└─ sandbox.py (safe execution environment) - Week 10

core/calculation/
├─ base_engine.py (abstract interface)
├─ dynamic_engine.py (uses parsed templates)
└─ template_manager.py (CRUD operations)

Database migrations:
├─ 013_add_calculation_templates.sql
└─ 014_add_calculation_executions.sql

Admin UI:
frontend/src/modules/admin/pages/
├─ TemplateUploadPage.tsx
├─ TemplateReviewPage.tsx (for pending templates)
└─ TemplateTestPage.tsx (test with sample data)

Testing:
├─ Parse test_raschet.xlsm successfully
├─ Generate working Python code
├─ Execute calculations matching Excel results
└─ Security validation working
```

**Week-by-week:**
- W1-2: Excel Reader (openpyxl, extract structure)
- W3-5: Formula Parser (formulas library, function mapping)
- W6-8: Code Generator (AST, topological sort, Python codegen)
- W9: Security Validator (patterns, auto-approve logic)
- W10: Sandbox & Testing
- W11: Admin UI (upload, review, test)
- W12: Integration & Polish

**Result:** ✅ Formula Parser working, tested on Мастер Бэринг Excel

---

### Q3 2025 (Jul-Sep): Modular Architecture Refactoring
**Duration:** 12-14 weeks
**Goal:** Transform monolith → modular platform + add MP Calculator

**Week 1-4: Core Platform**
```
core/
├─ modules/
│  ├─ loader.py (ModuleRegistry, install/uninstall)
│  ├─ manifest.py (Module manifest parser)
│  └─ permissions.py (module-based RBAC)
│
├─ billing/
│  └─ stripe_subscriptions.py (per-module billing)
│
└─ database/
   └─ migrations/015_add_module_system.sql

Database:
├─ modules (registry of available modules)
├─ enabled_modules (org → modules mapping)
└─ module_permissions (role → module permissions)
```

**Week 5-7: Quotation Module Extraction**
```
modules/quotation/
├─ manifest.json
├─ models.py (Quote, QuoteItem, QuoteApproval)
├─ routes.py (all quote endpoints)
├─ services/
│  ├─ calculation_service.py (uses dynamic engine)
│  ├─ export_service.py (Excel/PDF)
│  └─ approval_service.py
│
├─ migrations/
└─ skills/ (copy from .claude/skills/)

Steps:
1. Copy existing quote code → modules/quotation/
2. Update imports (relative paths)
3. Create manifest.json
4. Register in ModuleRegistry
5. Test: install for test org
6. Migrate existing orgs
```

**Week 8-10: CRM Module Extraction**
```
modules/crm/
├─ manifest.json
├─ models.py (Lead, LeadStage, Activity)
├─ routes.py
├─ services/
│  ├─ email_parser_service.py
│  └─ google_calendar_service.py
│
└─ migrations/
```

**Week 11-12: MP Sourcing Calculator Module**
```
modules/sourcing/
├─ manifest.json
├─ models.py (MPProduct, MPSettings)
├─ routes.py
├─ services/
│  ├─ unit_economics_calculator.py (uses dynamic engine!)
│  ├─ mp_fees_service.py (WB/Ozon/Яндекс комиссии)
│  └─ fbo_fbs_calculator.py
│
├─ migrations/
└─ data/
   └─ mp_commission_rates.json (auto-updated weekly)

Features:
- Calculate: product cost + shipping + customs + MP комиссия + ads + returns = маржа
- Compare: WB vs Ozon vs Яндекс (which more profitable)
- FBO vs FBS calculator
```

**Week 13-14: Testing & Migration**
- Test module installation flow
- Migrate all existing orgs to modular system
- Billing integration (Stripe)
- Module Marketplace UI

**Result:** ✅ Platform modular, 3 modules ready (Quotation, CRM, Sourcing)

---

### Q4 2025 (Oct-Dec): MP Integrations + Polish
**Duration:** 10-12 weeks
**Goal:** Complete MP modules, prepare for launch

**Week 1-4: WB Integration Module**
```
modules/wb_integration/
├─ manifest.json
├─ services/
│  ├─ wb_api_client.py (Wildberries API)
│  ├─ sync_service.py (sales, inventory, orders)
│  └─ commission_updater.py (auto-update rates)
│
├─ models.py (WBProduct, WBOrder, WBSync)
├─ routes.py
└─ migrations/

Features:
- OAuth with WB API
- Sync products (остатки, продажи)
- Pull actual комиссии (update sourcing calculator)
- Daily sync schedule
```

**Week 5-7: Ozon + Яндекс.Маркет Integration**
- Similar structure to WB
- Unified interface for all МП

**Week 8-9: Analytics Modules**
```
modules/b2b_analytics/
└─ For ВЭД companies (quote success rate, customer LTV)

modules/mp_analytics/
└─ For МП sellers (ABC-анализ, ROI by platform)
```

**Week 10-12: Launch Prep**
- Marketing site
- Documentation (user guides, API docs)
- Onboarding flow (interactive tutorial)
- Beta testing (10 companies: 5 ВЭД + 5 МП sellers)

**Result:** ✅ All modules ready, beta feedback collected

---

### Q1 2026 (Jan-Mar): PUBLIC LAUNCH 🚀
**Duration:** 12 weeks
**Goal:** First 50 paid customers

**Week 1-4: Public Launch**
- Launch marketing campaign
- Target: LinkedIn, specialized forums (ВЭД, МП sellers)
- Onboarding automation
- Support system

**Week 5-8: Growth & Optimization**
- Fix bugs from real users
- Optimize onboarding (reduce friction)
- Add most-requested features

**Week 9-12: Scale**
- Customer success (reduce churn)
- Referral program
- Content marketing (case studies)

**KPIs:**
- 25 ВЭД companies ($125/mo avg) = $3,125 MRR
- 25 МП sellers ($65/mo avg) = $1,625 MRR
- **Total: $4,750 MRR** (~$57k ARR)
- **Churn target:** <5%/month

---

## Phase 5: Risk Analysis & Mitigation

### Technical Risks:

**1. Excel Formula Parsing Complexity (HIGH)**
- **Risk:** Some Excel formulas cannot be parsed/converted
- **Impact:** Customer cannot use their template
- **Mitigation:**
  - Support Tier 1+2 functions (covers 90% cases)
  - Auto-convert Tier 3 where possible (XLOOKUP → VLOOKUP)
  - Manual review for complex cases
  - Fallback: custom implementation by team

**2. Generated Code Performance (MEDIUM)**
- **Risk:** Dynamic calculation slower than hardcoded
- **Impact:** Poor UX (slow quote calculations)
- **Mitigation:**
  - Cache compiled code (don't parse every time)
  - Optimize topological sort
  - Set timeout (5 seconds max)
  - Load test with 1000+ formulas

**3. Security Vulnerabilities (HIGH)**
- **Risk:** Malicious formulas execute arbitrary code
- **Impact:** System compromise, data breach
- **Mitigation:**
  - Strict validation (forbidden patterns)
  - Sandbox execution (no file system access)
  - Admin review for complex templates
  - Regular security audits

**4. Module System Complexity (MEDIUM)**
- **Risk:** Modules have conflicts, dependencies break
- **Impact:** Platform instability
- **Mitigation:**
  - Clear dependency management
  - Version pinning
  - Rollback mechanism
  - Staging environment testing

### Business Risks:

**1. Market Validation (HIGH)**
- **Risk:** МП sellers don't need sourcing calculator
- **Impact:** Half of target market disappears
- **Mitigation:**
  - Validate with 10-15 МП sellers before building
  - Start with ВЭД market (already validated)
  - Pivot to B2B-only if МП doesn't work

**2. Pricing Sensitivity (MEDIUM)**
- **Risk:** $50-150/mo too expensive for target markets
- **Impact:** Low conversion rate
- **Mitigation:**
  - Test pricing with beta users
  - Offer 14-day trial
  - Flexible pricing (pay for what you use)

**3. Competition (MEDIUM)**
- **Risk:** Established players (Bitrix24) add similar features
- **Impact:** Differentiation lost
- **Mitigation:**
  - Formula Parser = strong moat (complex to build)
  - Vertical focus (ВЭД + МП) vs horizontal CRMs
  - Speed to market (14 months is fast)

---

## Phase 6: Success Metrics

### Development Metrics:

**Q1 2025 (CRM):**
- ✅ CRM deployed to production
- ✅ User using it daily for Мастер Бэринг
- ✅ Leads → Customers conversion working
- ✅ Google Calendar integration functional

**Q2 2025 (Formula Parser):**
- ✅ test_raschet.xlsm parses successfully
- ✅ Generated code matches Excel results (100% accuracy)
- ✅ Security validation catches all forbidden patterns
- ✅ Admin can approve/reject templates

**Q3 2025 (Modular Platform):**
- ✅ 3 modules installed successfully
- ✅ Module Marketplace UI working
- ✅ Billing (Stripe) integrated
- ✅ No data loss during migration

**Q4 2025 (Pre-Launch):**
- ✅ 10 beta users onboarded
- ✅ All modules tested in production
- ✅ <5 critical bugs
- ✅ Documentation complete

### Business Metrics (Q1 2026):

**Acquisition:**
- 50 signups
- 30% signup → paid conversion
- 15 paying customers by end of Q1

**Revenue:**
- $3,000 MRR by end of Q1
- $10/customer acquisition cost (CAC)
- 3 months payback period

**Retention:**
- <10% monthly churn
- >80% active usage (log in weekly)
- NPS >40

---

## Phase 7: Next Steps

### Immediate (Week 1-2):

1. ✅ **Create worktrees:**
   ```bash
   cd ~/workspace/tech/projects/kvota/build
   git worktree add ../q1-crm -b feature/q1-crm-module
   git worktree add ../q2-parser -b feature/q2-formula-parser
   git worktree add ../q3-modular -b feature/q3-modular-platform
   ```

2. ✅ **Commit this design document:**
   ```bash
   cd ~/workspace/tech/projects/kvota/dev
   git add docs/plans/2025-01-15-formula-parser-modular-platform-design.md
   git commit -m "docs: Add Formula Parser & Modular Platform design"
   git push origin dev
   ```

3. **Validate МП market (critical!):**
   - Interview 10-15 МП sellers
   - Questions: "Do you calculate unit economics?" "How?" "Would you pay $29/mo for tool?"
   - Decision point: If <50% interested → pivot to B2B-only

4. **Setup development environment:**
   - Install formulas library: `pip install formulas openpyxl`
   - Test basic Excel parsing
   - Prototype formula → Python conversion

### Q1 2025 Start (Jan 15):

1. **Switch to q1-crm worktree:**
   ```bash
   cd ~/workspace/tech/projects/kvota/q1-crm
   ```

2. **Create project board:**
   - GitHub Projects or Notion
   - Break down CRM into tasks (2-week sprints)

3. **Start development:**
   - Week 1-2: Database schema + API routes
   - Week 3-4: Frontend (Leads pipeline)
   - Week 5-6: Activities + Google Calendar
   - Week 7-8: Testing + Polish

---

## Appendix A: Technology Dependencies

### Formula Parser:
```
openpyxl==3.1.2          # Excel parsing
formulas==1.2.5          # Formula execution
numpy==1.24.3
pandas==2.0.3
astor==0.8.1             # AST manipulation
black==23.7.0            # Code formatting
```

### Module System:
```
importlib-metadata==6.8.0  # Dynamic imports
pluggy==1.3.0              # Plugin system
```

### Billing:
```
stripe==6.5.0              # Subscriptions
```

### MP Integrations:
```
httpx==0.24.1              # Async HTTP client
celery==5.3.1              # Background tasks
redis==4.6.0               # Task queue
```

---

## Appendix B: Alternative Approaches Considered

### Alternative 1: No Formula Parser (Rejected)
**Approach:** Keep hardcoded calculation engine, customize manually for each client

**Pros:**
- Simpler architecture
- No security risks from dynamic code

**Cons:**
- ❌ Doesn't scale (manual work for each client)
- ❌ No competitive advantage
- ❌ Slow onboarding (weeks vs minutes)

**Decision:** Rejected - Formula Parser is the killer feature

---

### Alternative 2: Full Low-Code Platform (Rejected)
**Approach:** Build visual formula editor like Salesforce

**Pros:**
- More flexible
- Better UX

**Cons:**
- ❌ 12+ months development time
- ❌ Very complex UI
- ❌ Users already have Excel (why recreate?)

**Decision:** Rejected - Excel upload faster to market

---

### Alternative 3: Tiers Instead of Marketplace (Considered)
**Approach:**
- Basic: $49/mo (Quotation only)
- Standard: $99/mo (Quotation + CRM)
- Premium: $149/mo (Everything)

**Pros:**
- Simpler for users
- Easier to sell

**Cons:**
- ❌ Can't target both markets (ВЭД wants CRM, МП doesn't)
- ❌ Less flexible
- ❌ Lower perceived value

**Decision:** Rejected for initial design, but can pivot to Tiers if Marketplace too complex

---

## Appendix C: References

**Excel Formula Parsing:**
- formulas library: https://github.com/vinci1it2000/formulas
- openpyxl docs: https://openpyxl.readthedocs.io/

**Modular Architecture:**
- Plugin systems in Python: https://pluggy.readthedocs.io/
- FastAPI module patterns: https://fastapi.tiangolo.com/advanced/

**Stripe Multi-Product:**
- https://stripe.com/docs/billing/subscriptions/multiple-products

**Wildberries API:**
- https://openapi.wildberries.ru/

**Ozon API:**
- https://docs.ozon.ru/api/seller/

---

**Document Status:** ✅ Complete
**Next Action:** Create worktrees & start Q1 development
**Owner:** Novi (Founder)
**Last Updated:** 2025-01-15
