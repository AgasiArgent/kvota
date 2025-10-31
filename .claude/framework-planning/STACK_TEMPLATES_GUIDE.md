# Stack Templates Build Guide
**Version:** 1.0  
**Created:** 2025-10-30

---

## Overview

This guide explains how to build the 4 stack templates for the Claude App Builder Framework. Each template should be production-ready with example features and Claude Code integration.

---

## Template Requirements (All Stacks)

Every template must include:

1. **Authentication System**
   - User registration/login
   - Session/token management
   - Password reset flow
   - Protected routes

2. **CRUD Example** (Customers entity)
   - List with pagination
   - Create form with validation
   - Edit functionality
   - Delete with confirmation
   - Search/filter

3. **Multi-tenant Setup**
   - Organizations model
   - User-organization relationship
   - Data isolation (RLS or app-level)
   - Organization switching UI

4. **Export Functionality**
   - PDF generation
   - Excel/CSV export
   - File downloads

5. **Testing Infrastructure**
   - Unit tests
   - Integration/API tests
   - E2E tests (optional)
   - Coverage reporting

6. **Claude Code Integration**
   - `.claude/` directory
   - 3-5 domain-specific skills
   - 2-3 slash commands
   - Git hooks (pre-commit, pre-push)
   - CLAUDE.md project instructions

7. **Development Tooling**
   - Linter configuration
   - Formatter configuration
   - Type checking (where applicable)
   - Hot reload for dev server

8. **Documentation**
   - README.md with setup instructions
   - API documentation (if applicable)
   - Deployment guide
   - Architecture diagram

---

## Stack 1: Rails Template

### Technology Stack

- **Backend:** Rails 7.1
- **Database:** PostgreSQL 15+
- **Frontend:** Hotwire (Turbo + Stimulus)
- **CSS:** Tailwind CSS 3.3
- **Auth:** Devise 4.9
- **Authorization:** Pundit 2.3
- **Testing:** RSpec + Capybara + FactoryBot

### Directory Structure

```
rails-template/
├── app/
│   ├── controllers/
│   │   ├── application_controller.rb
│   │   ├── auth/
│   │   ├── customers_controller.rb
│   │   └── dashboard_controller.rb
│   ├── models/
│   │   ├── user.rb
│   │   ├── organization.rb
│   │   └── customer.rb
│   ├── views/
│   │   ├── layouts/
│   │   ├── customers/
│   │   └── dashboard/
│   ├── policies/
│   │   └── customer_policy.rb
│   ├── services/
│   │   ├── pdf_export_service.rb
│   │   └── excel_export_service.rb
│   └── javascript/
│       └── controllers/
├── config/
│   ├── database.yml
│   ├── routes.rb
│   └── tailwind.config.js
├── db/
│   ├── migrate/
│   └── seeds.rb
├── spec/
│   ├── models/
│   ├── requests/
│   ├── system/
│   └── factories/
├── .claude/
│   ├── skills/
│   │   ├── rails-patterns/
│   │   ├── hotwire-patterns/
│   │   └── testing-patterns/
│   ├── commands/
│   │   ├── generate-scaffold.md
│   │   └── run-tests.md
│   ├── hooks/
│   │   └── pre-commit.sh
│   └── CLAUDE.md
├── Gemfile
├── README.md
└── _variables.json
```

### Key Files to Extract from Quotation App

**Multi-tenant patterns:**
- Copy RLS concepts from `backend/` (adapt for ActiveRecord)
- Use `acts_as_tenant` gem

**Export services:**
- Adapt `backend/services/excel_service.py` to Ruby
- Use `prawn` for PDFs, `caxlsx` for Excel

**Authentication:**
- Standard Devise setup
- Add organization switching logic

### Template Variables (_variables.json)

```json
{
  "PROJECT_NAME": "MyApp",
  "PROJECT_NAME_SNAKE": "my_app",
  "DESCRIPTION": "A Rails application",
  "DATABASE_NAME": "myapp_production",
  "AUTHOR_NAME": "John Doe",
  "AUTHOR_EMAIL": "john@example.com"
}
```

### Build Steps

1. **Create base Rails app:**
```bash
rails new rails-template \
  --database=postgresql \
  --css=tailwind \
  --javascript=esbuild
```

2. **Add gems:**
```ruby
# Gemfile
gem 'devise'
gem 'pundit'
gem 'acts_as_tenant'
gem 'prawn'
gem 'caxlsx'
gem 'pagy'

group :development, :test do
  gem 'rspec-rails'
  gem 'factory_bot_rails'
  gem 'faker'
end

group :test do
  gem 'capybara'
  gem 'selenium-webdriver'
end
```

3. **Install dependencies:**
```bash
bundle install
rails generate devise:install
rails generate pundit:install
rails generate rspec:install
```

4. **Create models:**
```bash
rails generate model Organization name:string
rails generate devise User email:string organization:references role:string
rails generate model Customer \
  name:string \
  email:string \
  phone:string \
  company_type:string \
  organization:references
```

5. **Add multi-tenancy:**
```ruby
# app/models/organization.rb
class Organization < ApplicationRecord
  has_many :users
  has_many :customers
end

# app/models/customer.rb
class Customer < ApplicationRecord
  acts_as_tenant(:organization)
  belongs_to :organization
  
  validates :name, presence: true
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
end

# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  include Pundit::Authorization
  set_current_tenant_through_filter
  before_action :set_tenant
  
  private
  
  def set_tenant
    set_current_tenant(current_user&.organization)
  end
end
```

6. **Create customers CRUD:**
```bash
rails generate controller Customers index show new create edit update destroy
```

7. **Add export services:**
```ruby
# app/services/pdf_export_service.rb
class PdfExportService
  def initialize(customers)
    @customers = customers
  end
  
  def generate
    Prawn::Document.new do |pdf|
      pdf.text "Customers", size: 24, style: :bold
      
      @customers.each do |customer|
        pdf.text "#{customer.name} - #{customer.email}"
      end
    end.render
  end
end
```

8. **Add Claude Code integration:**
Create `.claude/` directory with skills, commands, hooks (see Section 5).

9. **Replace variables:**
Use EJS syntax in files:
```ruby
# config/database.yml
production:
  database: <%= PROJECT_NAME_SNAKE %>_production
```

10. **Test everything:**
```bash
bundle exec rspec
rails server  # Verify app runs
```

---

## Stack 2: Next.js + FastAPI Template

### Technology Stack

- **Frontend:** Next.js 15.5 + React 19
- **Backend:** FastAPI + Python 3.12
- **Database:** Supabase PostgreSQL
- **UI:** Ant Design 5.x
- **Grid:** ag-Grid Community
- **Auth:** Supabase Auth + JWT

### Directory Structure

```
nextjs-fastapi-template/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   └── supabase-client.ts
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── main.py
│   ├── routes/
│   │   ├── auth.py
│   │   └── customers.py
│   ├── models.py
│   ├── services/
│   │   ├── pdf_service.py
│   │   └── excel_service.py
│   ├── tests/
│   └── requirements.txt
├── .claude/
│   ├── skills/
│   │   ├── frontend-dev-guidelines/
│   │   ├── backend-dev-guidelines/
│   │   └── api-integration/
│   ├── commands/
│   └── hooks/
├── docker-compose.yml
└── README.md
```

### Extraction from Quotation App

**This is the SAME stack as quotation-app - extract heavily!**

1. **Copy entire skills:**
   - `.claude/skills/frontend-dev-guidelines/` (3,632 lines)
   - `.claude/skills/backend-dev-guidelines/` (3,200+ lines)
   - Remove calculation-specific parts

2. **Copy auth patterns:**
   - `frontend/src/lib/supabase-client.ts`
   - `backend/auth.py`

3. **Copy CRUD example:**
   - Adapt `frontend/src/app/customers/` pages
   - Adapt `backend/routes/customers.py`

4. **Copy export services:**
   - `backend/services/excel_service.py` (simplify for general use)
   - PDF service patterns

5. **Copy ag-Grid setup:**
   - Table component patterns
   - Cell renderers
   - Column definitions

### Build Steps

1. **Create Next.js app:**
```bash
npx create-next-app@latest frontend --typescript --tailwind --app
```

2. **Create FastAPI backend:**
```bash
mkdir backend
cd backend
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn supabase-py pydantic-settings
```

3. **Add frontend dependencies:**
```bash
cd frontend
npm install antd @ag-grid-community/react @supabase/supabase-js
```

4. **Copy and adapt code from quotation-app** (see above)

5. **Simplify for general use:**
   - Remove quote-specific logic
   - Generalize variable names
   - Add more comments

6. **Add Claude Code integration:**
Create `.claude/` with skills, commands, hooks.

7. **Test:**
```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm run build
```

---

## Stack 3: Next.js + Supabase Template

### Technology Stack

- **Frontend:** Next.js 15.5 + React 19
- **Backend:** Supabase (Auth + Database + Storage + Edge Functions)
- **UI:** Ant Design 5.x
- **CSS:** Tailwind CSS 3.3
- **Testing:** Jest + React Testing Library + Playwright

### Directory Structure

```
nextjs-supabase-template/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   ├── supabase-client.ts
│   │   └── supabase-server.ts
│   └── types/
├── supabase/
│   ├── functions/
│   │   └── export-pdf/
│   ├── migrations/
│   │   ├── 001_create_organizations.sql
│   │   ├── 002_create_customers.sql
│   │   └── 003_rls_policies.sql
│   └── seed.sql
├── .claude/
│   ├── skills/
│   │   ├── supabase-patterns/
│   │   ├── rls-patterns/
│   │   └── nextjs-patterns/
│   ├── commands/
│   └── hooks/
├── package.json
└── README.md
```

### Key Features

**RLS Patterns from Quotation App:**
- Extract from `.claude/skills/database-verification/`
- Multi-tenant RLS policies
- Organization-based data isolation

**Edge Functions:**
- PDF generation (using Deno)
- Excel generation
- Background jobs

### Build Steps

1. **Create Next.js app:**
```bash
npx create-next-app@latest . --typescript --tailwind --app
```

2. **Install Supabase:**
```bash
npm install @supabase/supabase-js @supabase/ssr
npx supabase init
```

3. **Create migrations:**
```sql
-- supabase/migrations/001_create_organizations.sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- supabase/migrations/002_create_customers.sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- supabase/migrations/003_rls_policies.sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own org's customers"
ON customers FOR SELECT
USING (organization_id = auth.jwt() ->> 'organization_id');

-- More policies...
```

4. **Create Edge Function for exports:**
```typescript
// supabase/functions/export-pdf/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { customers } = await req.json()
  
  // Generate PDF (use jsPDF or similar)
  const pdf = generatePDF(customers)
  
  return new Response(pdf, {
    headers: { 'Content-Type': 'application/pdf' }
  })
})
```

5. **Add auth:**
```typescript
// src/lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

6. **Create CRUD pages** (similar to Next+FastAPI)

7. **Add Claude Code integration**

8. **Test:**
```bash
npm run build
npm test
```

---

## Stack 4: Django Template

### Technology Stack

- **Backend:** Django 5.0
- **Database:** PostgreSQL 15+
- **Frontend:** HTMX + Alpine.js
- **CSS:** Tailwind CSS 3.3
- **Multi-tenant:** django-tenants
- **API:** Django REST Framework
- **Testing:** Pytest-django

### Directory Structure

```
django-template/
├── apps/
│   ├── core/
│   ├── users/
│   ├── organizations/
│   └── customers/
├── config/
│   ├── settings/
│   ├── urls.py
│   └── wsgi.py
├── templates/
│   ├── base.html
│   ├── customers/
│   └── dashboard/
├── static/
├── tests/
├── .claude/
│   ├── skills/
│   │   ├── django-patterns/
│   │   ├── htmx-patterns/
│   │   └── drf-patterns/
│   ├── commands/
│   └── hooks/
├── manage.py
├── requirements.txt
└── README.md
```

### Build Steps

1. **Create Django project:**
```bash
django-admin startproject config .
python manage.py startapp core
python manage.py startapp users
python manage.py startapp organizations
python manage.py startapp customers
```

2. **Install packages:**
```bash
pip install django==5.0 \
  django-tenants \
  djangorestframework \
  django-cors-headers \
  pytest-django \
  reportlab \
  openpyxl
```

3. **Configure multi-tenancy:**
```python
# config/settings.py
SHARED_APPS = [
    'django_tenants',
    'organizations',
    'users',
]

TENANT_APPS = [
    'customers',
]

INSTALLED_APPS = list(SHARED_APPS) + [
    app for app in TENANT_APPS if app not in SHARED_APPS
]

TENANT_MODEL = "organizations.Organization"
TENANT_DOMAIN_MODEL = "organizations.Domain"
```

4. **Create models:**
```python
# apps/organizations/models.py
from django_tenants.models import TenantMixin, DomainMixin

class Organization(TenantMixin):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    auto_create_schema = True

class Domain(DomainMixin):
    pass

# apps/customers/models.py
class Customer(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
```

5. **Add HTMX views:**
```python
# apps/customers/views.py
def customer_list(request):
    customers = Customer.objects.all()
    
    if request.htmx:
        return render(request, 'customers/_list.html', {
            'customers': customers
        })
    
    return render(request, 'customers/list.html', {
        'customers': customers
    })
```

6. **Create API:**
```python
# apps/customers/api.py
from rest_framework import viewsets
from .models import Customer
from .serializers import CustomerSerializer

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
```

7. **Add export views:**
```python
# apps/customers/export_views.py
from reportlab.pdfgen import canvas
from django.http import HttpResponse

def export_pdf(request):
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="customers.pdf"'
    
    p = canvas.Canvas(response)
    p.drawString(100, 750, "Customers")
    # ... add customers
    p.showPage()
    p.save()
    
    return response
```

8. **Add Claude Code integration**

9. **Test:**
```bash
pytest
python manage.py runserver
```

---

## Section 5: Claude Code Integration (All Templates)

Every template must include `.claude/` directory with:

### Skills

**Minimum 3 skills per template:**

**Rails:**
- rails-patterns (400 lines)
- hotwire-patterns (300 lines)
- testing-patterns (300 lines)

**Next+FastAPI:**
- frontend-dev-guidelines (3,632 lines) - COPY from quotation-app
- backend-dev-guidelines (3,200 lines) - COPY from quotation-app
- api-integration (400 lines) - New

**Next+Supabase:**
- supabase-patterns (500 lines)
- rls-patterns (400 lines) - Extract from quotation-app
- nextjs-patterns (300 lines)

**Django:**
- django-patterns (500 lines)
- htmx-patterns (300 lines)
- drf-patterns (300 lines)

### Commands

**Minimum 2 commands per template:**

**All templates:**
- `/generate-crud` - Generate CRUD for entity
- `/run-tests` - Run test suite

**Template-specific:**
- Rails: `/generate-scaffold`
- Django: `/create-app`

### Hooks

**All templates get:**
- pre-commit.sh - Linter + tests
- pre-push.sh - Full test suite

### CLAUDE.md

Template-specific project instructions.

Example for Rails:
```markdown
# Rails App - Project Instructions

## Stack
- Rails 7.1
- PostgreSQL
- Hotwire (Turbo + Stimulus)
- Tailwind CSS

## Key Patterns

### Controllers
Use resource-ful routing. Each controller action should:
1. Authenticate user
2. Check authorization (Pundit)
3. Execute business logic
4. Return Turbo Stream or redirect

### Models
- Use strong parameters
- Add validations
- Scope to current organization (acts_as_tenant)

## Testing
Run tests before committing:
```
bundle exec rspec
```

See `.claude/skills/rails-patterns/` for detailed guidelines.
```

---

## Section 6: Variables & Templating

### Variable Replacement

All templates use EJS syntax for variables:

```ruby
# Example: config/database.yml
production:
  database: <%= PROJECT_NAME_SNAKE %>_production
  username: <%= PROJECT_NAME_SNAKE %>
```

```json
// Example: package.json
{
  "name": "<%= PROJECT_NAME_SNAKE %>",
  "description": "<%= DESCRIPTION %>",
  "author": "<%= AUTHOR_NAME %> <<%= AUTHOR_EMAIL %>>"
}
```

### Conditional Inclusions

Some files only included based on wizard answers:

```javascript
// In project-generator.js
if (wizardAnswers.exports === true) {
  // Rails
  await copyFile('app/services/pdf_export_service.rb', targetDir)
  
  // Django
  await copyFile('apps/core/export_views.py', targetDir)
}

if (wizardAnswers.auth === 'oauth') {
  await copyFile('config/omniauth.rb', targetDir)
}
```

---

## Section 7: Testing Checklist

Before marking template complete, verify:

### Functionality
- [ ] Dev server starts without errors
- [ ] Can create account
- [ ] Can login
- [ ] Can create/edit/delete customers
- [ ] Can switch organizations (if multi-tenant)
- [ ] Can export to PDF
- [ ] Can export to Excel/CSV
- [ ] All tests pass

### Code Quality
- [ ] No hardcoded secrets
- [ ] Environment variables properly configured
- [ ] Linter passes
- [ ] Type-check passes (TypeScript)
- [ ] No console.log or debugger statements

### Documentation
- [ ] README.md has setup instructions
- [ ] README.md has deployment guide
- [ ] API documented (if applicable)
- [ ] CLAUDE.md has project-specific instructions

### Claude Integration
- [ ] Skills load correctly
- [ ] Commands execute successfully
- [ ] Hooks run on git commit/push
- [ ] Skills auto-activate based on file types

---

## Section 8: Common Pitfalls

**Pitfall 1: Hardcoded values**
❌ Don't:
```ruby
database: myapp_production
```
✅ Do:
```ruby
database: <%= PROJECT_NAME_SNAKE %>_production
```

**Pitfall 2: Missing dependencies**
Test on clean system (Docker) to catch missing packages.

**Pitfall 3: Broken migrations**
Test migrations on empty database:
```bash
# Rails
rails db:drop db:create db:migrate

# Django
python manage.py migrate --run-syncdb
```

**Pitfall 4: Skills don't activate**
Verify `activation-rules.json` matches actual file paths.

---

**End of Stack Templates Guide**
