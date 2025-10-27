# 🚀 24-Hour Pre-Deployment Plan with Agent Parallelization

**Created:** 2025-10-25
**Target Deployment:** 2025-10-26 (24 hours)
**Current Readiness:** 65/100 → **Target:** 95/100 ✅

---

## 📊 Executive Summary

**Total Time:** 18-22 hours split into 2 sessions
**Parallel Agents:** 13 agents working in 6 waves
**Efficiency Gain:** 35-40% faster than sequential development

### Critical Status Updates
- ✅ **Export system:** 4/6 formats tested and working
- ✅ **Contact management:** First/last name split implemented and tested
- ✅ **3 Critical blockers:** Already fixed (not documented yet)
- ⚠️ **Resource optimization:** Required before deployment

---

## 🎯 Session 1: Core Infrastructure (9-11 hours)

### Wave 1: Parallel Backend Development (3-4 hours)
**Launch 3 agents simultaneously in single message:**

#### Agent 1: User Profile System (2-3h)
**Purpose:** Allow users to manage manager info for quote exports

**Tasks:**
- Migration `014_user_profiles_manager_info.sql`:
  ```sql
  ALTER TABLE user_profiles
  ADD COLUMN manager_name VARCHAR(255),
  ADD COLUMN manager_phone VARCHAR(50),
  ADD COLUMN manager_email VARCHAR(255);
  ```
- Backend `/routes/users.py`:
  - `GET /api/users/profile` - Get current user profile
  - `PUT /api/users/profile` - Update manager info
- Integration: Auto-fill manager info in quote exports

**Deliverables:**
- User profile endpoints working
- Manager info auto-populates in PDF/Excel exports

---

#### Agent 2: Exchange Rate Service (3-4h)
**Purpose:** Auto-load exchange rates from Central Bank of Russia

**Tasks:**
- Migration `015_exchange_rates.sql`:
  ```sql
  CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(10,6) NOT NULL,
    source VARCHAR(50) DEFAULT 'cbr',
    fetched_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX idx_exchange_rates_lookup
    ON exchange_rates(from_currency, to_currency, fetched_at DESC);
  ```
- Backend `/services/exchange_rate_service.py`:
  - `fetch_cbr_rates()` - Call https://www.cbr-xml-daily.ru/daily_json.js
  - `get_rate(from_currency, to_currency)` - Return cached or fetch
  - Daily cron job (APScheduler) at 10:00 AM Moscow time
- Endpoints:
  - `GET /api/exchange-rates/{from}/{to}` - Get cached rate
  - `POST /api/exchange-rates/refresh` - Manual refresh

**API Format:**
```json
{
  "Valute": {
    "USD": {"Value": 95.4567, "Previous": 95.1234},
    "EUR": {"Value": 103.2156}
  }
}
```

**Resource Optimization:**
- Cache TTL: 24 hours
- Timeout: 10 seconds
- Retry: 3 times with exponential backoff
- Error handling: Use last cached rate if fetch fails

**Deliverables:**
- Exchange rates auto-load daily
- Manual refresh button works
- Rates display in quote creation form

---

#### Agent 3: Activity Log System (3-4h)
**Purpose:** Compliance and audit trail for all user actions

**Tasks:**
- Migration `016_activity_logs.sql`:
  ```sql
  CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX idx_activity_logs_org_time
    ON activity_logs(organization_id, created_at DESC);
  CREATE INDEX idx_activity_logs_entity
    ON activity_logs(entity_type, entity_id);
  ```
- Backend `/services/activity_log_service.py`:
  - Decorator: `@log_activity("quote", "created")`
  - Function: `log_activity(action, entity_type, entity_id, metadata)`
- Log events:
  - Quote: created, updated, deleted, restored, exported
  - Customer/Contact: created, updated, deleted
  - Calculation: variable changed, template saved
  - Auth: login, logout, password change, role change
- Endpoints:
  - `GET /api/activity-logs` - List with filters (date, user, entity)

**Resource Optimization:**
- Async logging (non-blocking)
- Batch inserts every 5 seconds (reduce DB connections)
- Auto-purge logs older than 6 months
- Pagination: Max 100 records per request

**Deliverables:**
- All user actions logged
- Activity log viewer page functional

---

### Wave 2: Parallel Frontend Development (2-3 hours)
**Launch 3 agents simultaneously:**

#### Agent 4: User Profile Page (1-2h)
**Purpose:** UI for editing manager information

**Tasks:**
- Page: `/app/profile/page.tsx`
- Form fields:
  - Manager name (text)
  - Manager phone (text)
  - Manager email (email)
- Integration: GET/PUT `/api/users/profile`
- Validation: Email format, phone format
- Success message on save

**Deliverables:**
- Profile page accessible from menu
- Manager info editable
- Changes reflected in exports

---

#### Agent 5: Exchange Rate UI (1h)
**Purpose:** Manual refresh and display of exchange rates

**Tasks:**
- Quote create page modifications:
  - Add "🔄 Refresh" icon button next to exchange rate field
  - Show "Last updated: DD.MM.YYYY HH:MM" below field
  - Loading spinner during refresh
  - Success/error messages
- Integration: `POST /api/exchange-rates/refresh`
- Auto-load on page mount: `GET /api/exchange-rates/{from}/{to}`

**Deliverables:**
- Exchange rate auto-populates
- Manual refresh works
- Timestamp displays correctly

---

#### Agent 6: Feedback System (1h)
**Purpose:** In-app bug reporting for testing phase

**Tasks:**
- Migration `017_feedback.sql`:
  ```sql
  CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    user_id UUID REFERENCES auth.users(id),
    page_url TEXT,
    description TEXT NOT NULL,
    browser_info JSONB,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- Floating button component:
  - Position: `bottom: 20px; right: 20px`
  - Hide on scroll down, show on scroll up
  - Icon: 🐛 (bug emoji)
- Modal form:
  - Description text area (required)
  - Auto-capture: page URL, user, browser, timestamp
- Backend `/routes/feedback.py`:
  - `POST /api/feedback` - Submit feedback
  - `GET /api/feedback` - List (admin only)
  - `PUT /api/feedback/{id}/resolve` - Mark resolved
- Admin view: `/app/admin/feedback/page.tsx`

**Deliverables:**
- Feedback button on all pages
- Users can submit bug reports
- Admin can view/resolve feedback

---

### Wave 3: Activity Log & Dashboard UI (3-4 hours)
**Launch 2 agents simultaneously:**

#### Agent 7: Activity Log Viewer (2h)
**Purpose:** UI for viewing audit trail

**Tasks:**
- Page: `/app/activity/page.tsx`
- Table columns:
  - Timestamp
  - User
  - Action
  - Entity Type
  - Entity (with link)
  - Details (expandable)
- Filters:
  - Date range picker
  - User dropdown
  - Entity type dropdown
  - Action dropdown
- Views:
  - Table view (default)
  - Timeline view (optional)
- Pagination: 100 records per page

**Deliverables:**
- Activity log page accessible
- All filters functional
- Export to CSV option

---

#### Agent 8: Basic Dashboard (3-4h)
**Purpose:** Business intelligence overview

**Tasks:**
- Replace stub `/app/page.tsx`
- Stat cards (Ant Design Statistic):
  1. Total Quotes
  2. Drafts (yellow)
  3. Sent (blue)
  4. Approved (green)
- Revenue card:
  - Sum of approved quotes this month
  - Currency: RUB
  - Format: 1 234 567,89 ₽
- Recent quotes table:
  - 5 most recent quotes
  - Columns: Number, Customer, Amount, Status, Date
  - Click row → navigate to quote detail
- Quick actions:
  - "Создать КП" button → /quotes/create
  - "Все КП" button → /quotes
- Backend `/routes/dashboard.py`:
  - `GET /api/dashboard/stats`
  - Response: `{total, draft, sent, approved, revenue, recent_quotes[]}`
  - Cache: 5 minutes (Redis or in-memory)

**Deliverables:**
- Dashboard shows accurate stats
- Recent quotes clickable
- Quick actions working

---

## 🎯 Session 2: Optimization & Testing (9-11 hours)

### Wave 4: Resource Optimization Audit (3-4 hours)
**Launch 2 agents simultaneously:**

#### Agent 9: Backend Performance Audit (2-3h)
**Purpose:** Ensure production stability and performance

**Critical Checks:**

**1. Infinite Loop Detection:**
- Review all `while` loops - ensure break conditions exist
- Check calculation engine - verify no recursive infinite calls
- Validate background jobs - proper exit conditions
- Test cron jobs - no overlapping executions

**2. Memory Leak Prevention:**
- Review variable scoping in long-running processes
- Check for circular references in JSONB fields
- Verify uvicorn workers don't accumulate memory
- Test: Run for 8 hours, monitor memory growth

**3. Database Query Optimization:**
- Add missing indexes:
  - `activity_logs(organization_id, created_at DESC)`
  - `quotes(organization_id, status, created_at DESC)`
  - `customers(organization_id, name)`
- Review N+1 query patterns:
  - Use SELECT with JOINs instead of loops
  - Example: `select("*, customer:customers(name)")`
- Add query timeout: 10 seconds max
- Connection pooling: 10-20 connections max

**4. Cron Job Validation:**
- Exchange rate job:
  - Frequency: Once daily at 10:00 AM
  - Timeout: 30 seconds
  - Error handling: Log and continue
  - No duplicate runs (lock mechanism)
- Ensure no jobs run simultaneously
- Proper logging for debugging

**5. API Endpoint Limits:**
- Rate limiting: 50 requests/minute per user
- Request size limits: 10MB max for file uploads
- Calculation timeout: 60 seconds max
- Pagination: Max 100 records per request
- Response size: Max 5MB

**6. Error Handling:**
- All endpoints have try/catch
- Errors logged with context
- User-friendly error messages
- No stack traces exposed to users
- Proper HTTP status codes

**Deliverables:**
- Performance audit report
- List of issues found + fixes applied
- Benchmark results (before/after)

---

#### Agent 10: Frontend Performance Audit (2h)
**Purpose:** Optimize React app for production

**Critical Checks:**

**1. React Re-render Optimization:**
- Review useEffect dependencies:
  - No missing dependencies causing loops
  - No unnecessary dependencies causing re-renders
- Check for state updates inside render functions
- Verify ag-Grid not re-rendering on every keystroke
- Use React.memo for expensive components
- Implement useMemo for expensive calculations

**2. Memory Leak Prevention:**
- Cleanup subscriptions in useEffect return:
  ```typescript
  useEffect(() => {
    const subscription = ...;
    return () => subscription.unsubscribe();
  }, []);
  ```
- Cancel pending fetch requests on unmount:
  ```typescript
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal });
    return () => controller.abort();
  }, []);
  ```
- Remove event listeners properly
- Close WebSocket connections

**3. Bundle Size Optimization:**
- Run `npm run build` - analyze bundle
- Target: < 500KB initial bundle
- Check for unnecessary dependencies
- Lazy load heavy components:
  ```typescript
  const AgGrid = lazy(() => import('./AgGrid'));
  ```
- Dynamic imports for PDF viewer
- Tree-shaking verification

**4. Network Request Optimization:**
- Debounce search inputs: 300ms delay
- Cache API responses (SWR or React Query)
- Batch multiple requests where possible
- Avoid fetching same data multiple times
- Implement optimistic updates

**5. Rendering Performance:**
- Virtual scrolling for large tables
- Image lazy loading
- Component code splitting
- Reduce bundle load time
- Minimize JavaScript execution

**Deliverables:**
- Performance audit report
- Bundle size report
- List of optimizations applied
- Lighthouse score > 90

---

### Wave 5: Comprehensive Testing (4-5 hours)
**Launch 2 agents simultaneously:**

#### Agent 11: Feature Testing (2-3h)
**Purpose:** Validate all features work end-to-end

**Test Scenarios:**

**User Profile:**
- [ ] Create manager info
- [ ] Edit manager info
- [ ] Manager info appears in PDF exports
- [ ] Manager info appears in Excel exports
- [ ] Validation works (email format, etc.)

**Exchange Rates:**
- [ ] Rates auto-load on quote create page
- [ ] Manual refresh button works
- [ ] Timestamp displays correctly
- [ ] Rates apply to currency conversion
- [ ] Error handling (API down)
- [ ] Cron job runs daily

**Activity Log:**
- [ ] Quote created → logged
- [ ] Quote updated → logged
- [ ] Quote deleted → logged
- [ ] Customer created → logged
- [ ] Contact created → logged
- [ ] Login → logged
- [ ] Logout → logged
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] Export to CSV works

**Feedback System:**
- [ ] Floating button visible
- [ ] Button hides on scroll
- [ ] Modal opens on click
- [ ] Auto-capture works (URL, browser, timestamp)
- [ ] Submit feedback → success
- [ ] Admin can view feedback
- [ ] Admin can resolve feedback

**Dashboard:**
- [ ] Stats accurate (match database)
- [ ] Revenue calculated correctly
- [ ] Recent quotes display
- [ ] Quick actions navigate correctly
- [ ] Data updates after creating quote

**Contact Management:**
- [ ] Primary contact auto-selected
- [ ] First/last name split works
- [ ] Full name displays in table
- [ ] Contact selector in quote create

**Excel Exports:**
- [ ] Validation export works
- [ ] Grid export works
- [ ] Russian formatting correct
- [ ] All data accurate

**Quote Workflows:**
- [ ] Edit quote preserves data
- [ ] Delete → Bin works
- [ ] Restore from bin works
- [ ] Templates save/load
- [ ] Multi-product quotes (10+ items)

**Deliverables:**
- Test results document
- Screenshots of all features working
- Bug list (if any found)

---

#### Agent 12: Load & Stress Testing (2h)
**Purpose:** Validate production readiness under load

**Test Scenarios:**

**1. Concurrent Users:**
- 10 users creating quotes simultaneously
- 20 users browsing quotes simultaneously
- 5 users exporting PDFs simultaneously
- Monitor: CPU, memory, response times

**2. Large Data:**
- Quote with 100 products → calculation speed
- Quote with 1000 products → performance
- Customer with 50 contacts → load time
- Database with 1000 quotes → query speed

**3. Database Load:**
- 100 quotes created in 5 minutes
- 1000 activity logs in 1 minute
- 50 concurrent database queries
- Monitor: Connection pool, query times

**4. Memory Stability:**
- Run backend for 30 minutes continuous use
- Monitor memory growth (should be flat)
- Check for memory leaks
- Verify proper garbage collection

**5. API Stress:**
- 100 requests/second for 1 minute
- Monitor: Response times, error rate
- Verify rate limiting works
- Check for connection issues

**Deliverables:**
- Load test results
- Performance benchmarks
- Resource usage graphs
- Bottleneck identification

---

### Wave 6: Final Polish (1-2 hours)

#### Agent 13: Documentation & Deployment Prep (1-2h)
**Purpose:** Prepare for production deployment

**Tasks:**

**1. Update Documentation:**
- Update `SESSION_PROGRESS.md`:
  - Session 25 summary
  - All new features listed
  - Testing results
  - Known issues (if any)
- Update `README.md`:
  - New features section
  - Deployment instructions
  - Environment variables
  - Server requirements
- Update `TECHNICAL_DEBT.md`:
  - Remove completed items
  - Add any new debt discovered

**2. Environment Configuration:**
- Create `.env.example`:
  ```
  # Database
  DATABASE_URL=postgresql://...
  SUPABASE_URL=https://...
  SUPABASE_SERVICE_ROLE_KEY=...

  # Exchange Rates
  CBR_API_URL=https://www.cbr-xml-daily.ru/daily_json.js
  EXCHANGE_RATE_CACHE_TTL=86400

  # Application
  FRONTEND_URL=http://localhost:3000
  BACKEND_URL=http://localhost:8000
  NODE_ENV=production

  # Monitoring (optional)
  SENTRY_DSN=...
  ```

**3. Production Checklist:**
- [ ] All environment variables documented
- [ ] Database migrations run successfully
- [ ] Cron jobs configured correctly
- [ ] Rate limiting enabled
- [ ] Error monitoring setup (Sentry recommended)
- [ ] Backup strategy documented
- [ ] SSL certificates configured
- [ ] Health check endpoint working (`/api/health`)
- [ ] Logging configured (level: INFO in prod)

**4. Server Requirements Document:**
```markdown
## Minimum Requirements
- CPU: 2 vCPU
- RAM: 4GB
- Disk: 20GB SSD
- Bandwidth: 100GB/month

## Recommended Requirements
- CPU: 4 vCPU
- RAM: 8GB
- Disk: 50GB SSD
- Bandwidth: 500GB/month

## Expected Load
- Concurrent users: 20-50
- Quotes per day: 100-200
- API requests/minute: 500-1000
- Storage growth: ~1GB/month
```

**5. Deployment Steps Document:**
1. Server provisioning
2. Install dependencies (Node.js, Python, PostgreSQL)
3. Clone repository
4. Set environment variables
5. Run database migrations
6. Build frontend (`npm run build`)
7. Start backend (systemd service)
8. Configure nginx reverse proxy
9. Enable SSL (Let's Encrypt)
10. Configure cron jobs
11. Setup monitoring
12. Test health endpoint
13. Smoke test all features

**Deliverables:**
- Complete documentation
- Deployment guide
- Server requirements
- Production checklist

---

## ⏱️ Total Time Breakdown

| Wave | Tasks | Agents | Time | Sequential Time |
|------|-------|--------|------|-----------------|
| 1 | Backend Systems | 3 parallel | 3-4h | 8-11h |
| 2 | Frontend UI | 3 parallel | 2-3h | 3-4h |
| 3 | Activity Log + Dashboard | 2 parallel | 3-4h | 5-6h |
| 4 | Performance Audit | 2 parallel | 3-4h | 4-5h |
| 5 | Testing | 2 parallel | 4-5h | 6-8h |
| 6 | Documentation | 1 agent | 1-2h | 1-2h |
| **TOTAL** | **All Features** | **13 agents** | **18-22h** | **28-36h** |

**Efficiency Gain:** 35-40% faster with parallel agents

---

## 🚀 Deployment Readiness Score

### Before This Plan: 65/100 ⚠️ NOT READY

**Breakdown:**
- Core functionality: 25/30 ✅
- Export system: 15/20 ⚠️ (4/6 formats tested)
- Testing coverage: 10/20 ❌ (Many scenarios untested)
- Bug-free experience: 5/15 ❌ (3 critical blockers)
- Missing features: 10/15 ⚠️ (Approval, dashboard missing)

### After This Plan: 95/100 ✅ **PRODUCTION READY**

**Improvements:**
- User profile management: +5
- Auto exchange rates: +10
- Activity log (compliance): +5
- Feedback system: +5
- Dashboard: +5
- Resource optimization: +10
- Comprehensive testing: +5

**Remaining -5 points:** Optional features (approval workflow, email integration)

---

## 📋 Agent Execution Strategy

### Session 1 Morning (4-5 hours)
1. ✅ **Launch Wave 1** (3 agents in single message):
   - User Profile System
   - Exchange Rate Service
   - Activity Log System
2. ⏳ Wait for completion (~4h)
3. ✅ **Launch Wave 2** (3 agents in single message):
   - User Profile Page
   - Exchange Rate UI
   - Feedback System
4. ⏳ Wait for completion (~3h)

### Session 1 Afternoon (4-5 hours)
5. ✅ **Launch Wave 3** (2 agents in single message):
   - Activity Log Viewer
   - Basic Dashboard
6. ⏳ Wait for completion (~4h)

### Session 2 Morning (3-4 hours)
7. ✅ **Launch Wave 4** (2 agents in single message):
   - Backend Performance Audit
   - Frontend Performance Audit
8. ⏳ Wait for completion (~4h)
9. 🔧 Fix any issues found

### Session 2 Afternoon (5-6 hours)
10. ✅ **Launch Wave 5** (2 agents in single message):
    - Feature Testing
    - Load Testing
11. ⏳ Wait for completion (~5h)
12. ✅ **Launch Wave 6** (1 agent):
    - Documentation & Deployment Prep
13. ⏳ Wait for completion (~2h)

**Total Active Time:** 18-22 hours spread across 2 days

---

## ✅ Production Deployment Checklist

### Before Deployment
- [ ] All 6 waves complete
- [ ] Performance audit passed
- [ ] Load testing passed (10 concurrent users)
- [ ] Memory leak check passed (30min runtime)
- [ ] No infinite loops detected
- [ ] All cron jobs validated
- [ ] Rate limiting enabled
- [ ] Error monitoring configured
- [ ] Backup strategy documented
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Health check endpoint working

### Resource Optimization Checks
**Backend:**
- [ ] No infinite loops (all while loops have break conditions)
- [ ] All background jobs have timeouts
- [ ] Database queries have indexes
- [ ] API endpoints have rate limiting (50 req/min)
- [ ] Request size limits (10MB max)
- [ ] Calculation timeout (60s max)
- [ ] Memory leak check passed
- [ ] Cron jobs don't overlap
- [ ] Error handling prevents crashes
- [ ] Proper connection pooling (max 20 connections)

**Frontend:**
- [ ] No re-render loops in useEffect
- [ ] All subscriptions cleaned up
- [ ] Fetch requests canceled on unmount
- [ ] Bundle size < 500KB initial
- [ ] Search inputs debounced (300ms)
- [ ] Large tables use virtual scrolling
- [ ] Images lazy loaded
- [ ] No memory leaks in ag-Grid

**Database:**
- [ ] Indexes on: organization_id, created_at, entity_id
- [ ] Soft delete instead of hard delete
- [ ] Cascading deletes configured
- [ ] RLS policies optimized
- [ ] Query timeout: 10s
- [ ] Connection pooling: 10-20 connections

**Monitoring:**
- [ ] CPU usage < 70% under normal load
- [ ] Memory usage < 80%
- [ ] Response time < 500ms (p95)
- [ ] No growing memory pattern (leak detection)
- [ ] Error rate < 1%

### Go/No-Go Criteria
- ✅ CPU < 70% under normal load
- ✅ Memory < 80%
- ✅ Response time < 500ms (p95)
- ✅ Zero critical bugs
- ✅ All features tested
- ✅ Documentation complete

---

## 🎯 Success Metrics

### Performance Targets
- Page load: < 2s
- API response: < 500ms (p95)
- Calculation: < 5s for 50 products
- Memory: < 80% after 8 hours runtime
- CPU: < 70% with 10 concurrent users
- Database queries: < 100ms (p95)

### Resource Limits
- **Backend:** 2-4 vCPU, 4-8GB RAM
- **Frontend:** CDN + static hosting
- **Database:** Supabase (500MB initially, scalable)
- **Expected concurrent users:** 20-50
- **Peak load:** 100 users

### Business Metrics
- Quote creation time: < 5 minutes
- Export generation: < 10 seconds
- System uptime: > 99.5%
- Error rate: < 0.5%

---

## 📝 Notes

### Exchange Rate API Details
- **Endpoint:** https://www.cbr-xml-daily.ru/daily_json.js
- **Format:** Direct division (e.g., 95.4567)
- **Update frequency:** Daily at 10:00 AM Moscow time
- **Fallback:** Use last cached rate if API fails

### Activity Log Events
- Quote: created, updated, deleted, restored, exported
- Customer: created, updated, deleted
- Contact: created, updated, deleted
- User: login, logout, password_changed, role_changed
- Calculation: template_saved, variable_changed

### Feedback System
- Auto-capture: Page URL, user ID, browser info, timestamp
- Floating button: Bottom-right, hides on scroll down
- Admin access only for viewing/resolving
- Email notifications optional (future enhancement)

---

**Last Updated:** 2025-10-25
**Status:** Ready for execution
**Next Step:** Launch Wave 1 (3 agents in parallel)
