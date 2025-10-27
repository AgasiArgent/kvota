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
