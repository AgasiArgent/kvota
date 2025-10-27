# Technical Debt & Known Issues

**Purpose:** Track issues to fix later without blocking current development

**Last Updated:** 2025-10-27 (Session 31 - Production Deployment + User Feedback)

---

## Critical Priority (Session 26 - Wave 5 Findings)

### 1. Activity Logging Not Integrated into CRUD Routes ✅ RESOLVED (2025-10-26)
**Problem:** Activity log system built but not connected to actual CRUD operations

**✅ FIX APPLIED (Commit: 2ee091e):**
- Added `@log_activity_decorator` to 10 CRUD endpoints:
  - `routes/quotes.py`: create_quote, update_quote, delete_quote, restore_quote (4 endpoints)
  - `routes/customers.py`: create_customer, update_customer, delete_customer, create_contact, update_contact, delete_contact (6 endpoints)
- All CRUD operations now automatically logged to activity_logs table
- Activity log page now shows real audit trail data
- Complete end-to-end audit trail working

**Verification:**
- Create a quote → Check `/activity` page shows log entry with entity details ✅
- Update/delete operations also logged ✅
- User and organization context captured ✅

**Impact:**
- ✅ Activity log table now populated with CRUD operations
- ✅ Audit trail working for compliance
- ✅ `/activity` page displays real data

**Related Files:**
- `backend/services/activity_log_service.py:70-118` (decorator implementation)
- `backend/routes/quotes.py:28, 221, 473, 557, 679` (4 decorators added)
- `backend/routes/customers.py:19, 147, 271, 358, 578, 646, 697` (6 decorators added)

---

### 2. Feedback Migration Not Applied ✅ RESOLVED (2025-10-26)
**Problem:** Migration `017_feedback.sql` created but never executed in Supabase

**✅ FIX APPLIED:**
- User manually executed migration 017 via Supabase SQL Editor
- Feedback table created with RLS policies
- Feature now operational

**Verification:**
- Table exists: `feedback` table visible in Supabase ✅
- RLS policies active: Organization-based access control ✅
- Ready for testing: Floating feedback button can now submit ✅

**Impact:**
- ✅ Feedback table exists in database
- ✅ `/admin/feedback` page no longer crashes
- ✅ Floating feedback button can submit reports
- ✅ In-app bug reporting system working

**Related Files:**
- `backend/migrations/017_feedback.sql` (executed)
- `backend/routes/feedback.py` (table exists)
- `frontend/src/components/FeedbackButton.tsx` (ready to use)

---

### 3. Exchange Rates Table Empty - No Initial Data ⏳ PENDING (User Action Required)
**Problem:** Exchange rates table exists but has zero rows

**Status:** Ready to load, not blocking development

**User Can Load Data:**
- **Option A (Recommended):** Click "Обновить" (Refresh) button on home page dashboard
  - Fetches latest rates from Central Bank of Russia API
  - Populates USD, EUR, CNY rates
  - Takes 2-3 seconds
- **Option B:** Wait for automated daily cron job at 10:00 AM Moscow time
  - Runs automatically every day
  - Updates all exchange rates
- **Option C:** Manual API call: `POST /api/exchange-rates/refresh` (requires admin auth)

**Impact:**
- Quote create page: Exchange rate field shows empty/loading state until populated
- System continues to work without rates (uses default values if needed)
- No blocker: User can load data when ready via UI

**Related Files:**
- `backend/services/exchange_rate_service.py:31-78` (fetch_cbr_rates function)
- `backend/routes/exchange_rates.py:47-61` (manual refresh endpoint)
- `frontend/src/app/page.tsx` (dashboard with refresh button)

---

### 4. Concurrent Request Performance (Supabase Client Blocking) ✅ RESOLVED (2025-10-26)
**Problem:** Backend handles concurrent requests 66x slower than sequential

**✅ FIX APPLIED (Commit: 0f59525):**
- Created `backend/async_supabase.py` with `async_supabase_call()` wrapper
- Uses `asyncio.to_thread()` to run Supabase calls in thread pool
- Converted `list_quotes` endpoint as demonstration
- Expected improvement: 32,628ms → ~600ms per request (100 concurrent)
- Solution: Option C (thread pool workaround) - minimal code changes

**Remaining Work:**
- Convert remaining high-traffic endpoints to use `async_supabase_call()`
- Priority endpoints: create_quote, update_quote, get_quote, list_customers
- Estimated effort: 1-2 hours to convert all critical endpoints

**Symptoms:**
- Single request: 489ms response time ✅
- 100 concurrent requests: 32,628ms per request (32.6s) ❌
- p95 response time: 4,141ms (target: <1,000ms)
- All requests succeed but very slow

**Root Cause:**
- Supabase Python client is synchronous (blocking I/O)
- When multiple requests come in, they queue up waiting for each other
- Each database call blocks the entire event loop
- Not true async despite using `async def` functions

**Measurement Data (Load Test Results):**
- Sequential load (10 req, one at a time): 404ms p95 ✅
- Concurrent load (20 req simultaneously): 4,141ms p95 ❌
- Slowdown factor: 10.2x per request
- Peak load (100 concurrent): 66x slowdown

**To Fix:**
- **Option A:** Replace `supabase.table().execute()` with `httpx.AsyncClient` for async HTTP calls
- **Option B:** Use `asyncpg` library for native async PostgreSQL (fastest)
- **Option C:** Run Supabase calls in thread pool (workaround)
- **Estimated Effort:** 2-3 hours for httpx migration, 3-4 hours for asyncpg

**Impact on Production:**
- 20 concurrent users: System becomes 10x slower
- 50 concurrent users: System may timeout (>30s responses)
- Not production-ready for >10 concurrent users

**Related Files:**
- `backend/routes/*.py` (all routes use `supabase.table().execute()`)
- `.claude/LOAD_TEST_RESULTS.md:180-250` (detailed analysis)

**Status:** 🔴 BLOCKS PRODUCTION SCALING

**Recommendation:** Fix before production deployment or limit to <10 concurrent users

---

### 5. Rate Limiting Not Enforced (Security Vulnerability) ✅ RESOLVED (2025-10-26)
**Problem:** Rate limiter configured but not actually blocking requests

**✅ FIX APPLIED (Commit: 0f59525):**
- Installed Redis server and redis Python package (7.0.0)
- Updated `backend/main.py` to use Redis storage: `storage_uri=redis://localhost:6379`
- Rate limiting now enforced across all API endpoints (50 req/min per IP)
- Verified: Redis key "slowapi:*" stores rate limit counters

**Deployment Requirements:**
- Redis server must be running: `sudo service redis-server start`
- REDIS_URL environment variable in .env: `redis://localhost:6379`
- Redis package in requirements.txt ✅

**Symptoms:**
- Sent 100 concurrent requests to `/api/quotes`
- Expected: 50 success, 50 blocked with 429 status
- Actual: 100 success, 0 blocked
- slowapi middleware added but not functional

**Root Cause:**
- slowapi requires Redis or Memcached for distributed rate limiting
- Currently using in-memory storage (default)
- In-memory storage doesn't work across async workers
- Each request gets its own counter → no limit enforcement

**Security Impact:**
- ❌ No protection against DDoS attacks
- ❌ No protection against brute force login attempts
- ❌ No protection against API abuse
- ❌ Single user can overwhelm backend with 1000s of requests

**To Fix:**
- **Option A:** Deploy Redis, configure slowapi to use Redis storage
  ```python
  from slowapi import Limiter
  from slowapi.util import get_remote_address
  from slowapi.storage.redis import RedisStorage

  limiter = Limiter(
      key_func=get_remote_address,
      storage_uri="redis://localhost:6379"
  )
  ```
- **Option B:** Keep in-memory for single-worker deployments (not recommended)
- **Option C:** Use nginx rate limiting instead (production workaround)
- **Estimated Effort:** 1 hour (Redis setup + configuration)

**Related Files:**
- `backend/main.py:73-75` (slowapi setup with in-memory storage)
- `.claude/LOAD_TEST_RESULTS.md:140-160` (test evidence)

**Status:** 🔴 SECURITY VULNERABILITY - BLOCKS PRODUCTION

**Recommendation:** Deploy Redis or use nginx rate limiting before production

---

## High Priority

### 1. 🧑‍💼 User-Reported Bugs (Production Deployment - Session 31)

**Source:** 👥 **REAL USER FEEDBACK** - Testing on deployed application (Vercel + Railway)

**Discovered:** 2025-10-27

#### 1.1 ✅ **[CRITICAL USER BUG - RESOLVED]** Customer Creation Fails - company_type Enum Mismatch

**✅ FIX APPLIED (Commit: 00036f5 - 2025-10-27):**
- Added `COMPANY_TYPE_MAP` mapping in customer create page
- Maps Russian company types to backend enum values:
  - `'ooo', 'ao', 'pao', 'zao'` → `'organization'`
  - `'ip'` → `'individual_entrepreneur'`
  - `'individual'` → `'individual'`
  - `'government'` → `'government'`
- Applied mapping before sending to API: `company_type: COMPANY_TYPE_MAP[values.company_type]`
- Added "Государственное учреждение" (government) option to dropdown

**Original Problem:** Cannot create customers due to frontend/backend enum value mismatch

**Error (Now Fixed):** 422 Validation Error
```json
{
  "type": "enum",
  "loc": ["body", "company_type"],
  "msg": "Input should be 'individual', 'individual_entrepreneur', 'organization' or 'government'",
  "input": "ooo"
}
```

**Root Cause:**
- Frontend dropdown sent Russian abbreviations: `"ooo"`, `"ao"`, `"zao"`, `"oao"`, etc.
- Backend Pydantic model expected English enum values
- No mapping between frontend display values and backend API values

**Impact (Now Resolved):**
- ✅ Users can now create customers
- ✅ Quote creation workflow unblocked
- ✅ User testing can proceed

**Related Files:**
- `frontend/src/app/customers/create/page.tsx:85-94` (mapping added)
- `frontend/src/app/customers/create/page.tsx:112` (mapping applied)
- `frontend/src/app/customers/create/page.tsx:234` (government option added)

**Status:** ✅ **RESOLVED** - Deployed to production via Vercel

---

#### 1.2 🐛 **[USER BUG]** Supabase Email Confirmation Links Point to Localhost
**Problem:** Email confirmation/reset links from Supabase redirect to `localhost:3000` instead of production URL

**Impact:**
- Users cannot verify their email addresses
- Password reset emails don't work
- Registration flow broken for new users

**Root Cause:**
- Supabase Site URL configured to `localhost:3000` in project settings
- Needs to be updated to production URL: `https://kvota-frontend.vercel.app`

**To Fix:**
1. Go to Supabase Dashboard → Project Settings → Authentication
2. Update "Site URL" from `http://localhost:3000` to `https://kvota-frontend.vercel.app`
3. Update "Redirect URLs" to include production URL
4. Test email confirmation flow

**Estimated Effort:** 5 minutes (configuration change only)

**Status:** ⚠️ BLOCKS NEW USER REGISTRATION

---

#### 1.3 🐛 **[USER BUG]** Logistics Label Misleading on Quote Create Page
**Problem:** Logistics costs labeled as "₽" (roubles) but calculator uses quote currency

**Current State:**
- Quote create page shows logistics fields with rouble symbol: "Логистика от поставщика ₽"
- But calculation engine correctly uses quote currency (RUB, USD, EUR, CNY)
- User confusion: "Why is logistics in roubles if my quote is in USD?"

**Impact:**
- User confusion and distrust
- Users may enter wrong values thinking it's always in roubles
- Misleading UX

**Proposed Fix:**
- Change label from "Логистика от поставщика ₽" to "Логистика от поставщика (в валюте КП)"
- Or: "Логистика от поставщика (в валюте предложения)"
- Makes it clear the value is in quote currency, not always roubles

**Related Fields:**
- `logistics_from_supplier` input field
- `logistics_to_client` input field
- Any other cost fields showing currency symbols

**To Fix:**
- Update labels in `frontend/src/app/quotes/create/page.tsx`
- Search for "₽" symbol in logistics-related labels
- Replace with "(в валюте КП)" or similar

**Estimated Effort:** 15 minutes

**Status:** 🟡 UX ISSUE - Not blocking but causes confusion

---

#### 1.4 🐛 **[USER BUG]** No Validation Feedback When Creating Quote
**Problem:** No popup/notification showing what fields need to be entered to proceed with quote creation

**Current State:**
- User fills out quote creation form
- Clicks "Создать КП" (Create Quote) button
- If required fields are missing: nothing happens, no feedback
- User doesn't know what went wrong or what fields are required
- Poor UX - user confusion and frustration

**Impact:**
- Users get stuck not knowing what to fill
- No guidance on required vs optional fields
- Bad user experience for core workflow
- Users may abandon quote creation

**Expected Behavior:**
- Show validation errors clearly when required fields are missing
- Highlight missing required fields in red
- Show popup/notification: "Пожалуйста, заполните обязательные поля" (Please fill required fields)
- List specific missing fields or scroll to first error
- Mark required fields with asterisk (*) in labels

**To Fix:**
1. Add form validation to quote create page
2. Show Ant Design notification on validation failure
3. Highlight invalid/missing fields with red borders
4. Add asterisks (*) to required field labels
5. Consider showing validation summary popup listing all errors

**Related Files:**
- `frontend/src/app/quotes/create/page.tsx` (form validation logic)
- Need to add validation before API call
- Use Ant Design Form validation or custom validation

**Estimated Effort:** 1-2 hours
- 30 min: Add field validation rules
- 30 min: Add error highlighting and notifications
- 30 min: Add asterisks to required fields
- 30 min: Testing

**Status:** 🟡 UX ISSUE - Core workflow affected, but not blocking

**Priority:** High (affects primary user workflow)

---

#### 1.5 🔴 **[USER BUG - CRITICAL]** Organization Team Management Page Missing (404 Error)
**Problem:** Clicking "Команда" (Team) button on organizations page results in 404 error

**Current State:**
- Organizations page has "Команда" button that navigates to `/organizations/{id}/team`
- This page doesn't exist - returns 404 error
- **Blocks ability to add users to organization** (critical for multi-user testing)
- Backend API is fully implemented and ready to use

**Impact:**
- ❌ Cannot invite users to organization
- ❌ Cannot manage team members or roles
- ❌ Blocks multi-user collaboration testing
- ❌ Users stuck in single-person organizations

**Backend API (Already Implemented):**
`backend/routes/organizations.py` has complete team management:
- `GET /api/organizations/{id}/members` - List members with details
- `POST /api/organizations/{id}/members` - Add member
- `PUT /api/organizations/{id}/members/{user_id}` - Update role
- `DELETE /api/organizations/{id}/members/{user_id}` - Remove member
- `POST /api/organizations/{id}/invitations` - Create email invitation
- `GET /api/organizations/{id}/invitations` - List pending invitations
- `POST /api/invitations/{token}/accept` - Accept invitation
- `DELETE /api/organizations/{id}/invitations/{invitation_id}` - Cancel invitation
- `GET /api/organizations/{id}/roles` - List available roles

**What Needs to be Built (Frontend Only):**
Create `/organizations/[id]/team/page.tsx` with:
1. **Members List:**
   - Table showing current members (name, email, role, joined date)
   - Role badges (Owner, Admin, Manager, etc.)
   - Edit role button (dropdown to change role)
   - Remove member button (with confirmation)

2. **Invite Member Section:**
   - Email input field
   - Role selector dropdown
   - "Send Invitation" button
   - Shows pending invitations (email, role, sent date, cancel button)

3. **Permissions:**
   - Only owners and admins can add/remove members
   - Only owners can change roles
   - Members can view team list (read-only)

**Design Reference:**
- Similar to typical SaaS team management pages (GitHub, Slack, Notion style)
- Ant Design Table for members list
- Ant Design Form for invitation
- Role badges matching organizations page style

**Estimated Effort:** 3-4 hours
- 1 hour: Create page structure and fetch members API
- 1 hour: Build members list table with role editing
- 1 hour: Build invitation form and pending invitations list
- 1 hour: Add remove member, cancel invitation, permissions logic

**Files to Create:**
- `frontend/src/app/organizations/[id]/team/page.tsx` (main page)
- `frontend/src/lib/api/organization-members-service.ts` (API client - optional, can use existing organizationService)

**Related Files:**
- `frontend/src/app/organizations/page.tsx:157` (button triggering 404)
- `backend/routes/organizations.py:301-716` (existing API endpoints)

**Status:** 🔴 **CRITICAL** - Blocks multi-user testing and core collaboration feature

**Priority:** **URGENT** (without this, cannot test multi-user scenarios)

**User Request:** "We will also need to add permissions system for different types of users"
- ✅ Backend already has role-based permissions system
- ✅ Roles: owner, admin, financial-admin, sales-manager, procurement-manager, logistics-manager
- ❌ Frontend team management UI missing to assign these roles

---

#### 1.6 🎯 **[UX IMPROVEMENT]** Customer Form Address Fields Need Autocomplete + INN Lookup

**Problem:** Customer creation form has manual address entry with no autocomplete or validation

**Current State:**
- Manual text inputs for: Адрес, Город, Регион/Область, Почтовый индекс
- No autocomplete suggestions (user has to type full address manually)
- No INN lookup to auto-fill company information
- Card labeled "Адрес" should be "Юридический адрес" (Legal Address)

**Industry Standard (Russian B2B Platforms):**
Most Russian websites use **DaData.ru API** for:
1. **Address autocomplete** - Type "Москва, Тверская" → suggests full addresses
2. **INN lookup** - Enter INN → auto-fills company name, legal address, director, etc.
3. **Validation** - Ensures addresses are real and properly formatted

**Examples of sites using this:**
- Контур (kontur.ru)
- СберБизнес (sber.ru)
- Тинькофф Бизнес (tinkoff.ru/business)
- МойСклад (moysklad.ru)

**DaData.ru Integration:**

**API Capabilities:**
- **Suggestions API** (address autocomplete)
  - Free tier: 10,000 requests/day
  - FIAS-based (official government address database)
  - Returns: Full address, postal code, region, city, street, coordinates

- **Party API** (INN lookup)
  - Free tier: 100 requests/day
  - Returns company info from ЕГРЮЛ (government registry):
    - Full name (МАСТЕР БЭРИНГ ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ)
    - Short name (МАСТЕР БЭРИНГ ООО)
    - Legal address
    - Director name
    - ОГРН, КПП, registration date
    - Company status (active/liquidated)

**Proposed UX Flow:**

**Scenario 1: INN Lookup (Recommended)**
1. User enters INN: `7707083893`
2. Click "Найти по ИНН" button or auto-search after 10 digits
3. Auto-fill fields:
   - Company name: МАСТЕР БЭРИНГ ООО
   - Full name: МАСТЕР БЭРИНГ ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ
   - Legal address: г Москва, ул Тверская, д 1
   - City: Москва
   - Region: Москва
   - Postal code: 101000
   - Director: Иванов Иван Иванович
   - ОГРН: 1234567890123
   - KPP: 770701001
4. User can edit any field if needed

**Scenario 2: Address Autocomplete**
1. User types in "Адрес" field: "Москва Тверская"
2. Dropdown shows suggestions:
   - г Москва, ул Тверская, д 1
   - г Москва, ул Тверская, д 10
   - г Москва, ул Тверская, д 12
3. User selects → Auto-fills: City, Region, Postal Code
4. Street address saved in "Адрес" field

**Implementation Options:**

**Option A: Full DaData Integration (Recommended)**
- Pros: Industry standard, best UX, validates real addresses, INN lookup included
- Cons: Requires API key (free tier is generous: 10k/day addresses, 100/day INN)
- Effort: 4-6 hours (frontend autocomplete component + backend proxy)

**Option B: Simple Autocomplete (Cities/Regions Only)**
- Pros: No external API, works offline
- Cons: Limited to predefined list, no INN lookup, no address validation
- Effort: 2-3 hours (static data + autocomplete component)

**Option C: Defer Until Needed**
- Keep manual inputs for now
- Add DaData later when users complain
- Quick fix: Just rename "Адрес" → "Юридический адрес"

**Recommended: Option A (DaData)**
- Standard for Russian B2B platforms
- Improves data quality (validated addresses)
- Speeds up customer creation (INN lookup auto-fills everything)
- Professional UX matching user expectations

**DaData Pricing:**
- **Free tier:** 10,000 address suggestions/day + 100 INN lookups/day
- **Paid:** $30/month for 100k addresses + 10k INN lookups
- For MVP: Free tier is sufficient

**Files to Modify:**
1. `frontend/src/app/customers/create/page.tsx` - Add autocomplete components
2. `backend/routes/customers.py` - Add INN lookup endpoint (proxy to DaData)
3. `frontend/src/lib/api/dadata-service.ts` - New API client for DaData
4. `.env` - Add `DADATA_API_KEY`

**Simple Fixes (Can Do Immediately):**
1. ✅ Rename "Адрес" card → "Юридический адрес" (5 min)
2. ✅ Add placeholder text: "Введите ИНН для автозаполнения" (5 min)
3. 🔲 Add DaData autocomplete (4-6 hours)

**Estimated Effort:**
- Label fix: 5 minutes
- DaData integration: 4-6 hours
  - 2 hours: Backend proxy endpoint + INN lookup
  - 2 hours: Frontend autocomplete component
  - 1 hour: Testing and polish
  - 1 hour: Error handling and validation

**Status:** 🟡 UX IMPROVEMENT - Not blocking, but significantly improves user experience

**Priority:** Medium-High (standard feature for Russian B2B, users will expect this)

**User Feedback:**
- "usually i saw on other websites that u start typing and get a value that u need"
- "are there some integrations may be that can pull up this info if u just type in ИНН?"
- "card Адрес, should be named Юридический адрес"

**References:**
- DaData.ru: https://dadata.ru/
- API Docs: https://dadata.ru/api/
- Free tier: https://dadata.ru/pricing/

---

#### 1.7 🎯 **[FEATURE REQUEST]** User Onboarding & Help System

**Problem:** No guidance for new users on how to use the platform

**User Request:**
- "we need to add page with something like teaching people on how to use"
- "or at least add prompts on when they first time visit this or that page"

**Current State:**
- No onboarding flow for new users
- No contextual help or tooltips
- No documentation/help center page
- Users have to figure out features themselves

**Industry Standard Approaches:**

**Option A: Interactive Product Tour (Recommended for MVP)**
- First-time user sees step-by-step walkthrough
- Highlights key features: "Create customer → Create quote → Calculate → Export"
- Dismissible tooltips with "Next" button
- Only shows once per user (tracked in user preferences)

**Libraries for this:**
- **Shepherd.js** (free, open source, 11k GitHub stars)
- **Intro.js** (free for non-commercial, commercial license $9.99/month)
- **React Joyride** (free, React-specific, 6k stars)
- **Driver.js** (free, lightweight, modern)

**Example flow:**
1. User logs in first time
2. Tour popup: "Добро пожаловать! Давайте познакомим вас с платформой"
3. Step 1: Highlights "Клиенты" menu → "Сначала создайте клиента"
4. Step 2: Highlights "Создать клиента" button → "Нажмите здесь чтобы добавить нового клиента"
5. Step 3: Highlights quote create page → "Теперь создайте коммерческое предложение"
6. Step 4: Shows calculation results → "Здесь вы увидите расчеты"
7. Step 5: Shows export buttons → "Экспортируйте КП в PDF или Excel"
8. Done: "Готово! Вы можете пройти тур заново в любое время из меню Помощь"

**Option B: Contextual Help Tooltips**
- Question mark icons (?) next to complex fields
- Hover or click to see explanations
- Example: "Срок поставки ⓘ" → Shows: "Количество дней от оплаты до доставки товара"
- Lightweight, always available
- Ant Design Tooltip component built-in

**Option C: Help Center Page**
- Dedicated `/help` or `/docs` page
- Sections: Getting Started, Create Quote, Calculations, Export, Settings
- Text + screenshots + video tutorials
- Search functionality
- Can link to specific sections from tooltips

**Option D: Video Tutorials**
- Short 2-3 minute videos for each workflow
- Embedded in help page or tooltips
- Can use Loom or YouTube
- Lower effort than writing docs

**Recommended Combo: A + B + C**
1. **Interactive tour on first login** (Shepherd.js) - 4-6 hours
2. **Contextual help tooltips** (Ant Design) - 2-3 hours
3. **Simple help page** with FAQ - 3-4 hours

**Implementation Plan:**

**Phase 1: Quick Wins (2-3 hours)**
1. Add help button to main menu linking to `/help` page
2. Create basic help page with:
   - "Как создать клиента"
   - "Как создать КП"
   - "Как рассчитать КП"
   - "Как экспортировать КП"
3. Add tooltips to complex fields (срок поставки, валюта, логистика)

**Phase 2: Product Tour (4-6 hours)**
1. Install Shepherd.js or Driver.js
2. Create tour steps for main workflow
3. Add "Skip tour" and "Restart tour" options
4. Track tour completion in user preferences table
5. Add "Помощь" menu item to restart tour

**Phase 3: Video Tutorials (Optional, 8+ hours)**
1. Record screen demos of each workflow
2. Edit and add voiceover (Russian)
3. Upload to YouTube or host locally
4. Embed in help page

**Technical Implementation:**

**Tour tracking:**
```sql
-- Add to user_profiles table
ALTER TABLE user_profiles ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE;
```

**Frontend:**
```typescript
// Check if user needs tour
if (!user.has_completed_onboarding) {
  startProductTour();
}

// Tour steps
const tour = new Shepherd.Tour({
  steps: [
    {
      id: 'welcome',
      text: 'Добро пожаловать! Давайте познакомим вас с платформой',
      buttons: [{ text: 'Начать', action: tour.next }]
    },
    {
      id: 'customers',
      text: 'Сначала создайте клиента',
      attachTo: { element: '[data-tour="customers"]', on: 'bottom' },
      buttons: [
        { text: 'Назад', action: tour.back },
        { text: 'Далее', action: tour.next }
      ]
    },
    // ... more steps
  ]
});
```

**Files to Create:**
1. `frontend/src/app/help/page.tsx` - Help center page
2. `frontend/src/components/ProductTour.tsx` - Tour component
3. `frontend/src/lib/tours/main-tour.ts` - Tour step definitions
4. `backend/migrations/019_user_onboarding.sql` - Add has_completed_onboarding column

**Estimated Effort:**
- Phase 1 (Basic help page + tooltips): 2-3 hours
- Phase 2 (Interactive product tour): 4-6 hours
- Phase 3 (Video tutorials): 8+ hours
- **Total for Phase 1+2:** 6-9 hours

**Status:** 🎯 FEATURE REQUEST - Improves user onboarding and reduces support burden

**Priority:** Medium (important for user adoption, but not blocking core functionality)

**User Feedback:**
- "we need to add page with something like teaching people on how to use"
- "or at least add prompts on when they first time visit this or that page"

**References:**
- Shepherd.js: https://shepherdjs.dev/
- Driver.js: https://driverjs.com/
- React Joyride: https://react-joyride.com/
- Intro.js: https://introjs.com/

---

#### 1.8 🎯 **[UX IMPROVEMENT]** Replace UUID URLs with Human-Readable Slugs

**Problem:** URLs show UUIDs instead of meaningful identifiers, making them unreadable

**Current State:**
- Quote URLs: `/quotes/af0965f1-b411-410b-9357-4fb2dcccd4b9`
- Customer URLs: `/customers/af0965f1-b411-410b-9357-4fb2dcccd4b9`
- Hard to share, remember, or understand what page you're on
- Not SEO-friendly (though this is internal B2B app)

**Proposed Solution (Same Pattern as Export Filenames):**

**For Quotes:**
- Current: `/quotes/af0965f1-b411-410b-9357-4fb2dcccd4b9`
- Better: `/quotes/kp25-0001` (using quote_number)
- Best: `/quotes/master-bearing-kp25-0001` (customer slug + quote number)

**For Customers:**
- Current: `/customers/af0965f1-b411-410b-9357-4fb2dcccd4b9`
- Better: `/customers/master-bearing-ooo` (company slug)
- Pattern: company name → transliterate Russian → slugify → make unique

**Example URLs:**
```
Before:
/quotes/af0965f1-b411-410b-9357-4fb2dcccd4b9
/customers/12345678-1234-1234-1234-123456789abc

After:
/quotes/kp25-0001
/customers/master-bearing-ooo
/quotes/kp25-0001/edit
/customers/master-bearing-ooo/edit
```

**Implementation Options:**

**Option A: Add slug column to database (Recommended)**
- Add `slug` column to `quotes` and `customers` tables
- Generate slug automatically on create/update
- Use slug in URLs, keep UUID for backend lookups
- Ensures unique, SEO-friendly URLs

**Option B: Use existing natural key (quote_number)**
- For quotes: Use `quote_number` directly (КП25-0001)
- Problem: Russian characters in URL need encoding
- Solution: Encode as `kp25-0001` (transliterate "КП" → "KP")

**Option C: Hybrid (Recommended)**
- Quotes: Use quote_number as slug (simple, already unique per org)
- Customers: Add slug column (company names can change)

**Recommended: Option C (Hybrid)**

**For Quotes:**
- URL pattern: `/quotes/{quote_number}` → `/quotes/kp25-0001`
- Backend: Look up by `quote_number` + `organization_id`
- No database changes needed (quote_number already exists)
- Transliterate Russian: "КП" → "KP", "АО" → "AO" for URL

**For Customers:**
- Add `slug` column: `VARCHAR(255) UNIQUE`
- Generate on create: "МАСТЕР БЭРИНГ ООО" → "master-bearing-ooo"
- Transliteration library: `translitit` or `cyrillic-to-translit-js`
- Ensure uniqueness: If collision, append `-2`, `-3`, etc.

**Transliteration Rules (Russian → Latin):**
```
КП → kp
ООО → ooo
ПАО → pao
ИП → ip
Spaces → hyphens
Special chars → remove
```

**Migration Plan:**

**Phase 1: Customers (Add slug column)**
```sql
-- Migration 019: Add slug to customers
ALTER TABLE customers ADD COLUMN slug VARCHAR(255) UNIQUE;

-- Generate slugs for existing customers
-- Will need to transliterate Russian names to Latin
```

**Phase 2: Update Backend Routes**
```python
# Old route
@router.get("/{customer_id}")

# New route (both supported for backwards compatibility)
@router.get("/{customer_slug}")
async def get_customer(customer_slug: str):
    # Try UUID first (for old links)
    try:
        customer_id = UUID(customer_slug)
        customer = fetch_by_id(customer_id)
    except ValueError:
        # Not a UUID, treat as slug
        customer = fetch_by_slug(customer_slug)
```

**Phase 3: Update Frontend Links**
```typescript
// Old
router.push(`/customers/${customer.id}`)

// New
router.push(`/customers/${customer.slug}`)
```

**For Quotes - No DB Changes Needed:**
Just use `quote_number` in URLs with transliteration:
```typescript
// Old
router.push(`/quotes/${quote.id}`)

// New
const urlSafeNumber = quote.quote_number
  .replace('КП', 'kp')
  .toLowerCase();
router.push(`/quotes/${urlSafeNumber}`)
```

**Transliteration Library Options:**

**Frontend (TypeScript):**
- `translitit` - npm package, 50k downloads/week
- `cyrillic-to-translit-js` - Specific for Russian
- Custom map (simple, no dependencies)

**Backend (Python):**
- `transliterate` - pip package, mature
- `unidecode` - converts Unicode to ASCII
- Custom mapping dict

**Example Implementation:**

**Frontend helper:**
```typescript
// lib/utils/slug.ts
export function transliterateRussian(text: string): string {
  const map: Record<string, string> = {
    'А': 'a', 'Б': 'b', 'В': 'v', 'Г': 'g', 'Д': 'd',
    'Е': 'e', 'Ё': 'yo', 'Ж': 'zh', 'З': 'z', 'И': 'i',
    'Й': 'y', 'К': 'k', 'Л': 'l', 'М': 'm', 'Н': 'n',
    'О': 'o', 'П': 'p', 'Р': 'r', 'С': 's', 'Т': 't',
    'У': 'u', 'Ф': 'f', 'Х': 'h', 'Ц': 'ts', 'Ч': 'ch',
    'Ш': 'sh', 'Щ': 'sch', 'Ъ': '', 'Ы': 'y', 'Ь': '',
    'Э': 'e', 'Ю': 'yu', 'Я': 'ya',
    // Add lowercase
  };

  return text
    .split('')
    .map(char => map[char] || map[char.toUpperCase()]?.toLowerCase() || char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function quoteNumberToSlug(quoteNumber: string): string {
  // "КП25-0001" → "kp25-0001"
  return transliterateRussian(quoteNumber);
}
```

**Backend slug generation:**
```python
from transliterate import translit

def generate_slug(name: str) -> str:
    """Generate URL-safe slug from Russian text"""
    # Transliterate Russian to Latin
    latin = translit(name, 'ru', reversed=True)

    # Convert to lowercase, replace spaces with hyphens
    slug = latin.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = re.sub(r'^-|-$', '', slug)

    return slug

# "МАСТЕР БЭРИНГ ООО" → "master-bering-ooo"
```

**Files to Modify:**

**Backend:**
1. `backend/migrations/019_add_customer_slug.sql` - Add slug column
2. `backend/routes/customers.py` - Accept slug in URLs, lookup logic
3. `backend/routes/quotes.py` - Accept quote_number in URLs
4. Add slug generation helper

**Frontend:**
1. `frontend/src/lib/utils/slug.ts` - Transliteration helpers
2. Update all router.push() calls for customers and quotes
3. Update API calls to use slugs
4. `frontend/src/app/customers/[slug]/page.tsx` - Rename from [id]
5. `frontend/src/app/quotes/[slug]/page.tsx` - Rename from [id]

**Backwards Compatibility:**
- Keep UUID support in backend for old bookmarks
- Frontend automatically uses new slug format going forward
- Old links still work (UUID detection)

**Estimated Effort:**
- Backend slug generation: 2 hours
- Database migration + slug generation for existing data: 2 hours
- Frontend route updates: 3-4 hours
- Testing: 1 hour
- **Total: 8-9 hours**

**Benefits:**
- ✅ Readable URLs: `/quotes/kp25-0001` vs UUID
- ✅ Shareable: Easy to copy/paste in chat
- ✅ Professional: Matches export filename pattern
- ✅ Debugging: Can tell what page you're on from URL
- ✅ SEO-friendly (if app becomes public)

**Status:** 🎯 UX IMPROVEMENT - Nice to have, improves professionalism

**Priority:** Medium (UX polish, not blocking functionality)

**User Feedback:**
- "all pages that are about quote or customer have addreses like so af0965f1-b411-410b-9357-4fb2dcccd4b9"
- "i think it's because they are originally named in russian and then recoded or something"
- "we had similar problem with export files names and solved it successfully"
- "may be we can do something similar here? so url would look readable for humans"

**References:**
- Transliteration: https://pypi.org/project/transliterate/
- URL slug best practices: https://developers.google.com/search/docs/crawling-indexing/url-structure

---

#### 1.9 🎯 **[UX IMPROVEMENT]** Redirect to Quote View Page After Creation (Not Edit Page)

**Problem:** After creating a quote, user is redirected to edit page instead of view page

**Current Flow:**
1. User fills out quote creation form
2. Clicks "Создать КП" (Create Quote)
3. **Redirected to:** `/quotes/{id}/edit` (edit page)
4. User has to click "Back" or navigate to view page
5. Only then can export the quote

**Proposed Flow:**
1. User fills out quote creation form
2. Clicks "Создать КП" (Create Quote)
3. **Redirected to:** `/quotes/{id}` (view/detail page)
4. User can immediately export PDF or Excel
5. Can click "Edit" button if changes needed

**User Expectation:**
> "after creating quote i get redirected to edit page, but i think it's better to get redirected to the page of the quote, so i can export it right away"

**Why This Makes Sense:**
- **Primary next action:** Export the quote (PDF/Excel)
- **Secondary action:** Edit if mistakes found
- View page has export buttons prominently displayed
- Edit page is for making changes, not the natural next step
- Matches user mental model: Create → Review → Export → Send to client

**Industry Standard:**
Most CRM/ERP systems follow this pattern:
- Create document → View document (with export/send options)
- Edit is a separate action from creation
- Examples: Salesforce, HubSpot, QuickBooks, Zoho

**Implementation:**

**Current Code (Quote Create Page):**
```typescript
// frontend/src/app/quotes/create/page.tsx
const response = await quotesCalcService.createQuote(payload);

if (response.success && response.data) {
  message.success('КП успешно создано!');
  router.push(`/quotes/${response.data.id}/edit`);  // ← CHANGE THIS
}
```

**Proposed Fix:**
```typescript
// frontend/src/app/quotes/create/page.tsx
const response = await quotesCalcService.createQuote(payload);

if (response.success && response.data) {
  message.success('КП успешно создано!');
  router.push(`/quotes/${response.data.id}`);  // ← View page, not edit
}
```

**Files to Modify:**
1. `frontend/src/app/quotes/create/page.tsx` - Change redirect URL (1 line change)

**Estimated Effort:** 2 minutes (literally one line change)

**Benefits:**
- ✅ Faster workflow: Create → Export (no extra navigation)
- ✅ Matches user expectation
- ✅ Reduces clicks to complete common task
- ✅ Aligns with industry standard UX

**Status:** 🎯 UX IMPROVEMENT - Quick win, improves primary workflow

**Priority:** High (affects every quote creation, very easy fix)

**User Feedback:**
- "after creating quote i get redirected to edit page"
- "i think it's better to get redirected to the page of the quote, so i can export it right away"

---

### 2. Export Reliability Issue
**Problem:** Export doesn't always work 2nd or 3rd time on the same page without reloading

**Symptoms:**
- First export works fine
- Second export attempt: button shows loading state but no file downloads
- Frontend stays in loading state indefinitely
- Requires page refresh to export again

**Observed In:**
- Quote detail page (`/quotes/[id]/page.tsx`)
- All export formats (PDF & Excel)

**Possible Causes:**
- React state not resetting properly after export
- Event handler cleanup issue
- Backend session/connection issue
- Browser download manager interference

**To Investigate:**
- Check if `exportLoading` state is stuck
- Verify `handleExport` callback dependencies
- Test if issue occurs in all browsers
- Check backend logs for repeated requests

**Related Files:**
- `frontend/src/app/quotes/[id]/page.tsx:150-224` (handleExport)
- `backend/routes/quotes.py:1432-1524` (PDF export)
- `backend/routes/quotes.py:1526-1747` (Excel export)

---

### 2. Ant Design Deprecated API Warnings
**Problem:** Using deprecated Ant Design v5 APIs causing console warnings

**Known Deprecated APIs:**
1. **Dropdown `overlay` prop** → should use `menu` prop instead
   - `frontend/src/app/quotes/[id]/page.tsx:411`
2. **Card `bordered` prop** → should use `variant` prop instead
   - Multiple quote-related pages
3. **Menu `children` structure** → should use `items` array instead
   - `frontend/src/app/quotes/[id]/page.tsx:230-259`
4. **Static `message` function** → should use `App` component context
   - Used throughout application

**Impact:**
- Console warnings (not blocking functionality)
- May break in future Ant Design versions
- Poor developer experience

**To Fix:**
- Update all Dropdown components to use `menu` prop
- Replace Card `bordered` with `variant="outlined"`
- Refactor Menu from children to items array structure
- Wrap app with Ant Design App component for message context

**Estimated Effort:** ~2-3 hours for all deprecated APIs

**Related Files:**
- Search for: `overlay=`, `bordered=`, `<Menu.Item`, `message.success`

---

### 3. Standardize PDF Export Layout & Styling
**Problem:** PDF export templates have inconsistent layouts and page orientations

**Current State:**
- **Supply formats** (КП поставка, КП поставка письмо):
  - Currently: A4 landscape
  - Proposed: **A4 portrait** (vertical)
  - Reason: Only 9 columns, fits better on portrait
- **Open book formats** (КП open book, КП open book письмо):
  - Currently: A4 landscape
  - Proposed: **Keep A4 landscape** (horizontal)
  - Reason: 21 columns require horizontal layout
- **Header cards inconsistency:**
  - Supply quote: 3-column flexbox layout (Продавец | Покупатель | Информация)
  - Supply letter: 3 separate header blocks (stacked inline)
  - Open book quote: 3-column flexbox layout
  - Open book letter: 3 separate header blocks (stacked inline)
  - **Target:** All should use same 3-column flexbox layout from supply_quote.html

**Proposed Changes:**
1. **Standardize header card layout:**
   - All 4 templates use identical 3-column flexbox header
   - Same card styling, same padding, same font sizes
   - "Информация о поставке" card should include total sum in all formats
2. **Change page orientation:**
   - `supply_quote.html`: landscape → **portrait**
   - `supply_letter.html`: landscape → **portrait**
   - `openbook_quote.html`: keep landscape ✓
   - `openbook_letter.html`: keep landscape ✓
3. **Adjust column widths for portrait:**
   - Recalculate 9-column widths for portrait A4
   - May need narrower columns or smaller font for brand/SKU
4. **Consistent letter formatting:**
   - Letter templates should have same letter text style
   - Same signature block style
   - Same spacing between sections

**Benefits:**
- Professional consistent look across all export formats
- Better page orientation match to content (9 cols vs 21 cols)
- Easier to maintain (one style system)
- Better printability (portrait for simple quotes is standard)

**Estimated Effort:** ~3-4 hours
- 2 hours: Convert supply formats to portrait + rebalance columns
- 1 hour: Standardize header cards across all templates
- 1 hour: Test all 4 formats + adjust spacing

**Related Files:**
- `backend/templates/supply_quote.html` (portrait + header)
- `backend/templates/supply_letter.html` (portrait + header)
- `backend/templates/openbook_quote.html` (header only)
- `backend/templates/openbook_letter.html` (header only)

---

## Medium Priority

### 1. Frontend Bundle Size (ag-Grid Lazy Loading)
**Problem:** Quote pages have 1.11 MB initial bundle (221% over 500 KB target)

**Impact:**
- Slow initial page load (3-4 seconds on quote pages)
- Poor mobile performance
- Estimated Lighthouse performance score: <70

**Root Cause (Session 26 - Wave 4 Frontend Audit):**
- ag-Grid library (300+ KB) bundled directly into 3 pages
- Not lazy-loaded, so entire ag-Grid loads even before user needs table
- Pages affected:
  - `/quotes/create` - 1.11 MB
  - `/quotes/[id]` - 1.11 MB
  - `/quotes/[id]/edit` - 1.12 MB
- Other pages are fine:
  - `/profile` - 798 KB ✅
  - `/dashboard` - 810 KB ✅
  - `/activity` - 802 KB ✅

**To Fix:**
Implement lazy loading for ag-Grid using Next.js dynamic imports:
```typescript
import dynamic from 'next/dynamic';

const AgGridReact = dynamic(
  () => import('ag-grid-react').then(m => ({ default: m.AgGridReact })),
  { loading: () => <Spin />, ssr: false }
);
```

**Expected Improvement:**
- Bundle size: 1.11 MB → 800 KB (27% reduction)
- Initial load time: 3-4s → 2-2.5s
- Lighthouse score: <70 → 80-85

**Files to Update:**
- `frontend/src/app/quotes/create/page.tsx`
- `frontend/src/app/quotes/[id]/page.tsx`
- `frontend/src/app/quotes/[id]/edit/page.tsx`

**Estimated Effort:** 15 minutes

**Report:** `.claude/FRONTEND_PERFORMANCE_AUDIT.md`

**Status:** 🟡 AFFECTS USER EXPERIENCE (not blocking, but recommended before production)

---

### 2. React 19 Compatibility Warning
**Problem:** Ant Design v5 officially supports React 16-18, using React 19

**Warning Message:**
```
Warning: [antd: compatible] antd v5 support React is 16 ~ 18.
see https://u.ant.design/v5-for-19 for compatible.
```

**Impact:**
- Application works but not officially supported
- May have edge case bugs
- Future Ant Design updates might break

**Options:**
1. Downgrade to React 18 (safer but older)
2. Wait for official Ant Design React 19 support
3. Continue with warnings (current approach)

**Decision Needed:** Discuss with team

---

## Low Priority

### 5. TypeScript Strict Mode Warnings
**Problem:** 108 TypeScript warnings (non-blocking)

**Status:** Frontend builds successfully but shows warnings

**Types of Warnings:**
- Unused variables
- Implicit any types
- Missing return types

**To Fix:** Enable stricter TypeScript checks and fix violations

**Estimated Effort:** ~4-6 hours

---

## Future Enhancements

*(Not bugs, but features to consider)*

### 1. Export System Edge Case Testing (Session 30 - Deferred)
**Status:** ✅ Core export functionality FULLY WORKING (all 6 formats tested)

**Completed Testing (2025-10-26):**
- ✅ PDF exports: supply, openbook, supply-letter, openbook-letter (all 4 formats work)
- ✅ Excel exports: validation, supply-grid, openbook-grid (all 3 formats work)
- ✅ Excel "Оплата" field shows `advance_from_client` percentage correctly
- ✅ PDF downloads work without 500 errors
- ✅ Filenames generated correctly (UUID to string conversion fixed)
- ✅ Multiproduct quotes export correctly

**Deferred Testing:**
1. **Special characters in export data**
   - Test quotes with special characters in:
     - Customer names (Cyrillic, Latin, special symbols)
     - Product names (quotes, apostrophes, etc.)
     - Manager info (Cyrillic names with special chars)
   - Verify PDF/Excel encoding handles all characters correctly
   - **Estimated effort:** 30 minutes

2. **Different quote statuses (blocked by missing approval workflow)**
   - Current: All quotes are "draft" status
   - Need to test exports for:
     - Approved quotes
     - Rejected quotes
     - Sent quotes
   - **Blocker:** Quote approval workflow not yet implemented
   - **Estimated effort:** 15 minutes (after approval workflow ready)

**Priority:** Low (core functionality verified, edge cases can be tested later)

**Related Session:** Session 30 - Export System Bug Fixes ✅

---

### 2. Exchange Rate System Redesign (Session 29 - Deferred from Phase 2.3)
**Problem:** Current exchange rate UI doesn't match actual currencies used in quotes

**Current State:**
- Hardcoded "USD/CNY" field in quote creation form
- Single exchange rate input (doesn't reflect actual quote currencies)
- CBR API auto-load exists but UX unclear
- Multiple purchase currencies possible in one quote (e.g., RUB quote with TRY and USD products)

**CBR API Investigation Results (2025-10-26):**
- ✅ CBR API only provides **RUB-based rates** (e.g., USD→RUB, EUR→RUB, CNY→RUB)
- ❌ **No direct cross-rates** (e.g., no direct USD→CNY rate)
- ✅ Cross-rate calculation required: USD→CNY = (USD→RUB) ÷ (CNY→RUB)
- ✅ Backend already implements cross-rate logic correctly (`backend/services/exchange_rate_service.py:190-194`)
- ✅ 24-hour caching working as designed

**User Requirements:**
1. Replace single "USD/CNY" field with **collapsible exchange rate table**
2. Auto-detect currency pairs needed from products in grid
   - Example: Quote in RUB with products in TRY and USD → show RUB/TRY and RUB/USD rates
3. Display table showing multiple currency pairs:
   ```
   Курсы валют ▼ (expandable)
   ┌─────────────┬──────────┬─────────────────────┐
   │ Пара валют  │ Курс     │ Обновлено          │
   ├─────────────┼──────────┼─────────────────────┤
   │ RUB → TRY   │ 3.21     │ 26.10.2025 10:00   │
   │ USD → RUB   │ 95.45    │ 26.10.2025 10:00   │
   │ EUR → RUB   │ 103.87   │ 26.10.2025 10:00   │
   └─────────────┴──────────┴─────────────────────┘
   ```
4. Manual refresh button to update all rates from CBR API
5. Use detected rates in calculation automatically

**Implementation Plan:**
1. **Backend** (1 hour):
   - New endpoint: `GET /api/exchange-rates/bulk?currencies=RUB,TRY,USD,CNY` (fetch multiple pairs at once)
   - Optimize to fetch all needed rates in 1 CBR API call
2. **Frontend** (1.5 hours):
   - Create `ExchangeRateTable` component (collapsible table)
   - Auto-detect currency pairs from grid products: `unique(quote_currency, ...product_currencies)`
   - Display rate table with refresh button
   - Remove hardcoded USD/CNY field
3. **Integration** (30 min):
   - Pass detected rates to calculation engine
   - Update calculation variable mapping
   - Test multiproduct quotes with mixed currencies

**Benefits:**
- ✅ Accurate reflection of actual quote currencies
- ✅ Transparency (users see all rates being used)
- ✅ Manual control (refresh button)
- ✅ Better UX (collapsible, doesn't clutter form)

**Estimated Effort:** 2-3 hours

**Related Files:**
- `frontend/src/app/quotes/create/page.tsx` (remove hardcoded field, add table)
- `backend/services/exchange_rate_service.py` (already has cross-rate logic)
- `backend/routes/exchange_rates.py` (add bulk endpoint)

**Status:** 🟡 DEFERRED - UX enhancement, not blocking core functionality

**API Reference:** https://www.cbr-xml-daily.ru/daily_json.js

---

### 2. Add Total Sum to Export Headers
**Problem:** "Информация о поставке" card in PDF exports missing total sum

**Current State:**
- Header shows: Date, Delivery time, Incoterms, Payment terms, Description
- Total sum only appears in grid footer

**Requested:**
- Add total contract sum in "Информация о поставке" card
- Format: "Сумма с НДС: XXX XXX,XX ₽" (same as КП поставка)
- Should appear on ALL export formats (4 PDF + 2 Excel)

**Affected Templates:**
- `backend/templates/supply_quote.html` - Already has it ✅
- `backend/templates/openbook_quote.html` - Missing ❌
- `backend/templates/supply_letter.html` - Check status
- `backend/templates/openbook_letter.html` - Check status
- Excel exports - Check status

**Estimated Effort:** ~30 minutes

---

### 2. Export History Tracking
- Track when quotes were exported
- Show export count in UI
- Store export metadata

### 3. Export Customization
- Allow users to edit filename before download
- Custom company logo in PDFs
- Template selection for exports

### 4. Bulk Export
- Export multiple quotes as ZIP
- Email exports directly from app

### 5. Performance Optimization
- Cache calculation results
- Optimize PDF generation (currently ~2s per export)
- Reduce initial page load time

---

---

---

## Pattern Analysis (Session 24)

### Root Cause Patterns Identified

**Pattern 1: Field Name Mismatches (HIGH IMPACT)**
- **Frequency:** Affected 12+ fields across PDF and Excel exports
- **Root Cause:** Calculation engine uses descriptive field names, but exports assumed shorter names
- **Impact:** 60% of openbook grid columns showing 0 or empty values
- **Examples:**
  - `sales_price_per_unit` → `sales_price_per_unit_no_vat`
  - `supplier_invoice_sum` → `purchase_price_total_quote_currency`
  - `logistics_cost` → `logistics_total` / quantity
- **Solution:** Systematic field mapping audit across all export templates

**Pattern 2: Deprecated Ant Design APIs (MEDIUM IMPACT)**
- **Frequency:** 4+ deprecated APIs in use across multiple files
- **Root Cause:** Using Ant Design v5 deprecated patterns from v4
- **Impact:** Console warnings, potential breakage in future versions, UI bugs (dropdown not working)
- **Examples:**
  - `overlay` → `menu` (Dropdown component - BLOCKS EXPORT UI)
  - `bordered` → `variant="outlined"` (Card component)
  - `<Menu.Item>` children → `items` array
  - `message.success()` static → App context
- **Solution:** One-time migration pass for all Ant Design components

**Pattern 3: Input Variables vs Calculation Results Confusion (MEDIUM IMPACT)**
- **Frequency:** Affects ~3-5 fields
- **Root Cause:** Mixing input variables (user settings) with calculation outputs
- **Examples:**
  - `import_tariff` is INPUT variable (variables) but was read from calculation results
  - `customs_code` is product-level but was read from quote-level variables
- **Solution:** Clear documentation of data sources + validation layer

**Pattern 4: Per-Unit vs Total Value Confusion (LOW IMPACT)**
- **Frequency:** Affects 2-3 fields
- **Root Cause:** Some calculations store totals, exports need per-unit
- **Examples:**
  - `logistics_total` must be divided by quantity for per-unit display
  - `purchase_price_total` must be divided by quantity for unit price
- **Solution:** Consistent naming convention (all totals end with `_total`, all per-unit end with `_per_unit`)

---

## Comprehensive Fix Plan

### Phase 1: Critical Blockers (2-3 hours) - PRIORITY
**Goal:** Restore full functionality

1. **Fix Export Dropdown UI** (30 min)
   - Update `quotes/[id]/page.tsx` line 414
   - Change `overlay={exportMenu}` to `menu={exportMenu}`
   - Convert `<Menu>` JSX to `items` array format
   - Test all 7 export formats work in UI
   - **Blocked:** All manual export testing

2. **Verify Field Mapping Fixes** (1 hour)
   - Test all Session 24 Part 2 fixes are working
   - Supply grid: columns 7, 8, 9 (prices)
   - Openbook grid: columns 7, 8, 9, 10, 11 (invoice, logistics, customs, duty)
   - Generate test exports and validate data
   - **Impact:** 12+ fields across 6 export formats

3. **Fix Quotes List Empty State** (30 min)
   - Quotes page showing "Нет данных" but database has 5 quotes
   - Check API response mapping
   - Check RLS policies
   - **Impact:** Cannot navigate to quotes normally

4. **Test Multiple Export Attempts** (1 hour)
   - Verify High Priority Issue #1 (export doesn't work 2nd/3rd time)
   - Test export button state management
   - Check if fixes resolved the issue
   - Document if still present

### Phase 2: Ant Design Migration (2-3 hours)
**Goal:** Eliminate all deprecation warnings

1. **Dropdown Components** (45 min)
   - Find all `overlay=` usages
   - Convert to `menu=` with items array
   - Files: `quotes/[id]/page.tsx` and any others

2. **Card Components** (30 min)
   - Find all `bordered=` usages
   - Replace with `variant="outlined"` or remove
   - Likely in quote-related pages

3. **Menu Components** (45 min)
   - Find all `<Menu.Item>` children patterns
   - Convert to `items={[{key, label, onClick}]}` array format

4. **Message Context** (30 min)
   - Wrap app with `<App>` component from Ant Design
   - Use `message` from `App.useApp()` hook instead of static import
   - Update layout.tsx and affected pages

### Phase 3: PDF Layout Standardization (3-4 hours)
**Goal:** Professional consistent look across all exports

1. **Standardize Header Cards** (1.5 hours)
   - All 4 templates use identical 3-column flexbox layout
   - Supply quote template has best layout - use as reference
   - Update: supply_letter, openbook_quote, openbook_letter

2. **Change Supply Formats to Portrait** (1.5 hours)
   - `supply_quote.html`: landscape → portrait
   - `supply_letter.html`: landscape → portrait
   - Rebalance 9-column widths for portrait A4
   - May need narrower fonts for brand/SKU columns

3. **Add Total Sum to All Headers** (30 min)
   - "Информация о поставке" card missing total in 3 templates
   - Add "Сумма с НДС: XXX XXX,XX ₽" to all
   - Verify Excel exports also show totals

4. **Testing** (30 min)
   - Generate all 4 PDF formats
   - Check professional appearance
   - Verify printability

### Phase 4: Low Priority Cleanup (4-6 hours)
**Can be deferred to future sessions**

1. **TypeScript Strict Mode** (4 hours)
   - Fix 108 warnings
   - Enable stricter type checks
   - Add missing return types

2. **React 19 Compatibility** (decision + potential downgrade)
   - Discuss with team: downgrade to React 18 or wait for Ant Design support
   - If downgrade: test thoroughly

3. **Performance Optimization** (2 hours)
   - Cache calculation results
   - Optimize PDF generation (currently ~2s)
   - Reduce page load time

---

## Session Notes

**Session 24 (Part 3) - Manual Testing & Pattern Analysis:**
- **Export Button UI Not Working:** ⚠️ **BLOCKS ALL MANUAL TESTING**
  - Root cause: Using deprecated `overlay` prop instead of `menu` prop (line 414 in quotes/[id]/page.tsx)
  - Console warning: `[antd: Dropdown] 'overlay' is deprecated. Please use 'menu' instead.`
  - Impact: Cannot test exports through UI, must use direct API calls
  - Related to: High Priority Issue #2 (Ant Design Deprecated API Warnings)
  - **This must be fixed first before any manual UI testing can proceed**

- **Quotes List Page Empty:**
  - Page shows "Нет данных" despite database containing 5 quotes
  - Quotes exist: КП25-0005 through КП25-0009
  - Issue prevents normal navigation to quote detail pages
  - Must navigate directly via URL

- **Pattern Analysis Complete:**
  - Identified 4 root cause patterns affecting multiple components
  - Field naming mismatches: 12+ affected fields
  - Deprecated APIs: 4+ occurrences
  - Data source confusion: 3-5 fields
  - Per-unit vs total: 2-3 fields

- **Comprehensive Fix Plan Created:**
  - 4 phases: Critical (2-3h), Ant Design (2-3h), PDF Layout (3-4h), Cleanup (4-6h)
  - Total estimated effort: 11-16 hours
  - Phase 1 critical for unblocking all manual testing

**Session 24 (Part 2) - Excel/PDF Export Field Mapping Audit:**
- **Root Cause Pattern Identified:** Systematic field name mismatches between:
  - Calculation engine output field names (phase_results)
  - Export service expectations (PDF/Excel templates)
  - Database schema field names (quote_items table)
- Fixed 8 field mapping errors in openbook exports
- Fixed 4 field mapping errors in supply exports
- **Pattern:** Calculation outputs use descriptive names (`sales_price_per_unit_no_vat`) but exports assumed shorter names (`sales_price_per_unit`)
- **Impact:** 60% of openbook grid columns were showing 0 or empty values
- See "Export Field Mapping Errors" section below for detailed audit

**Session 24 (Part 1):**
- Identified export reliability issue (doesn't work 2nd/3rd time)
- Catalogued 4 types of Ant Design deprecation warnings
- React 19 compatibility warning noted

---

## Resolution Checklist

When fixing an issue:
- [ ] Update this document with fix details
- [ ] Add test to prevent regression
- [ ] Update SESSION_PROGRESS.md
- [ ] Commit with reference to issue number
- [ ] Mark as resolved with date

**Example:**
```
### 1. Export Reliability Issue ✅ RESOLVED (2025-10-25)
**Fix:** Added proper state cleanup in useEffect
**Commit:** abc1234
**Test:** Added export-multiple-times.spec.ts
```
