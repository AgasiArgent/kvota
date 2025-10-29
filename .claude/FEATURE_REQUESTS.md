# Feature Requests & Enhancement Backlog

**Purpose:** Track user-requested features and UX improvements that are not bugs

**Last Updated:** 2025-10-29 14:30 UTC

**Total Features:** 6
- High Priority: 2
- Medium Priority: 3
- Low Priority: 1
- Paused: 1

---

## High Priority (10-15 hours)

### FEATURE-001: Customer Address Autocomplete (DaData Integration)
**Source:** User feedback - Session 31
**Status:** 🎯 NOT STARTED
**Priority:** High (standard for Russian B2B platforms)

**User Request:**
- "usually i saw on other websites that u start typing and get a value that u need"
- "are there some integrations may be that can pull up this info if u just type in ИНН?"

**Current State:**
- Manual text inputs for address, city, region, postal code
- No autocomplete suggestions
- No INN lookup to auto-fill company information

**Proposed Solution:**
Integrate DaData.ru API (industry standard for Russian websites):
- Address autocomplete (type "Москва Тверская" → get full addresses)
- INN lookup (enter INN → auto-fill company name, legal address, director, etc.)
- FIAS-based validation (official government address database)

**Implementation:**
1. Backend proxy endpoint for DaData API (2 hours)
2. Frontend autocomplete component (2 hours)
3. INN lookup integration (1 hour)
4. Testing and polish (1 hour)

**Estimated Effort:** 4-6 hours

**DaData Pricing:**
- Free tier: 10,000 address suggestions/day + 100 INN lookups/day
- Paid: $30/month for higher limits

**Files to Create:**
- `backend/routes/dadata.py` - API proxy endpoint
- `frontend/src/lib/api/dadata-service.ts` - API client
- `frontend/src/components/AddressAutocomplete.tsx` - Autocomplete component

**References:**
- DaData.ru: https://dadata.ru/
- Used by: Контур, СберБизнес, Тинькофф Бизнес, МойСклад

---

### FEATURE-002: User Onboarding & Help System
**Source:** User feedback - Session 31
**Status:** 🎯 NOT STARTED
**Priority:** High (improves user adoption)

**User Request:**
- "we need to add page with something like teaching people on how to use"
- "or at least add prompts on when they first time visit this or that page"

**Current State:**
- No onboarding flow for new users
- No contextual help or tooltips
- No documentation/help center page
- Users must figure out features themselves

**Proposed Solution (3 phases):**

**Phase 1: Quick Wins (2-3 hours)**
- Add help button to main menu → `/help` page
- Create basic help page with FAQ:
  - "Как создать клиента"
  - "Как создать КП"
  - "Как рассчитать КП"
  - "Как экспортировать КП"
- Add tooltips to complex fields (срок поставки, валюта, логистика)

**Phase 2: Product Tour (4-6 hours)**
- Install Shepherd.js or Driver.js
- Create tour steps for main workflow
- Add "Skip tour" and "Restart tour" options
- Track tour completion in user_profiles table
- Show tour on first login

**Phase 3: Video Tutorials (Optional, 8+ hours)**
- Record screen demos of workflows
- Edit and add voiceover (Russian)
- Embed in help page

**Estimated Effort:** 6-9 hours (Phase 1+2)

**Library Options:**
- Shepherd.js (free, 11k stars) - Recommended
- Driver.js (free, modern)
- React Joyride (free, React-specific, 6k stars)

**Files to Create:**
- `frontend/src/app/help/page.tsx` - Help center
- `frontend/src/components/ProductTour.tsx` - Tour component
- `frontend/src/lib/tours/main-tour.ts` - Tour steps
- `backend/migrations/019_user_onboarding.sql` - Add has_completed_onboarding column

---

## Medium Priority (16-20 hours)

### FEATURE-003: Replace UUID URLs with Human-Readable Slugs
**Source:** User feedback - Session 31
**Status:** 🎯 NOT STARTED
**Priority:** Medium (UX polish)

**User Request:**
- "all pages that are about quote or customer have addresses like so af0965f1-b411-410b-9357-4fb2dcccd4b9"
- "may be we can do something similar here? so url would look readable for humans"

**Current URLs:**
- Quote: `/quotes/af0965f1-b411-410b-9357-4fb2dcccd4b9`
- Customer: `/customers/af0965f1-b411-410b-9357-4fb2dcccd4b9`

**Proposed URLs:**
- Quote: `/quotes/kp25-0001` (using quote_number)
- Customer: `/customers/master-bearing-ooo` (company slug)

**Implementation:**
1. Add `slug` column to customers table (2 hours)
2. Create transliteration helper (Russian → Latin) (2 hours)
3. Update backend routes to accept slug or UUID (2 hours)
4. Update frontend links to use slugs (3-4 hours)
5. Testing and backwards compatibility (1 hour)

**Estimated Effort:** 8-9 hours

**Benefits:**
- Readable URLs: `/quotes/kp25-0001` vs UUID
- Shareable: Easy to copy/paste
- Professional: Matches export filename pattern
- SEO-friendly (if app becomes public)

---

### FEATURE-004: Show Calculation Breakdown on Quote Detail Page
**Source:** User feedback - Session 31
**Status:** 🎯 NOT STARTED
**Priority:** Medium-High (builds trust)

**User Request:**
- "i'd rather see grid with all intermediate values that we can show to user"
- "so they get feeling that there was a complex calculation made"
- "can look at some intermediate values to get sense of belonging to this calculation process"

**Current State:**
- Quote detail page shows only final results (base price, final price, total)
- No visibility into calculation steps
- User can't see what went into the pricing

**Proposed Solution:**
Expandable calculation breakdown showing intermediate values:
- Base price (with VAT)
- Currency conversion rate
- Logistics costs (supplier → warehouse → client)
- Customs duties and fees
- Broker fees
- Financing costs (supplier payment, client payment)
- DM fee (commission)
- Markup percentages
- Final unit price
- Total for all products

**Implementation:**
1. Backend - Structure calculation breakdown data (2 hours)
2. Frontend - Build expandable row component (3 hours)
3. Styling to match Excel-like feel (1 hour)
4. Testing with different product types (1 hour)

**Estimated Effort:** 6-8 hours

**Benefits:**
- Transparency: User sees all calculation steps
- Trust: Customer can verify pricing logic
- Education: Helps users understand cost breakdown
- Debugging: Easy to spot if calculation looks wrong

---

### FEATURE-005: Exchange Rate System Redesign
**Source:** Technical debt - Session 29 (Deferred from Phase 2.3)
**Status:** ⏭️ DEFERRED
**Priority:** Medium (UX enhancement)

**Current State:**
- Hardcoded "USD/CNY" field in quote creation form
- Single exchange rate input doesn't reflect actual quote currencies
- CBR API auto-load exists but UX unclear
- Multiple purchase currencies possible in one quote

**Proposed Solution:**
Replace single field with collapsible exchange rate table:
- Auto-detect currency pairs from products in grid
- Display table showing multiple currency pairs with rates and timestamps
- Manual refresh button to update all rates from CBR API
- Use detected rates in calculation automatically

**Implementation:**
1. Backend bulk endpoint for multiple currency pairs (1 hour)
2. Frontend ExchangeRateTable component (1.5 hours)
3. Integration with calculation engine (30 min)

**Estimated Effort:** 2-3 hours

**Benefits:**
- Accurate reflection of actual quote currencies
- Transparency (users see all rates being used)
- Manual control (refresh button)
- Better UX (collapsible, doesn't clutter form)

---

## Low Priority (Paused)

### FEATURE-006: Quote Versioning System
**Source:** Session 31
**Status:** ⏸️ PAUSED - 90% Complete
**Priority:** Low (not blocking)

**Current State:**
- Work saved to feature branch: `feature/quote-versioning-session-31`
- Migration, backend endpoints, frontend UI mostly complete
- Blocker: PostgreSQL type inference error (line 1193)

**What's Done:**
- Database migration for quote versions
- Backend API endpoints for versioning
- Frontend UI for viewing/creating versions

**Blocker:**
- PostgreSQL/Supabase type inference issue preventing completion

**To Resume:**
1. Checkout feature branch: `git checkout feature/quote-versioning-session-31`
2. Debug PostgreSQL type inference error
3. Complete remaining 10% of work
4. Test and merge to dev

**Estimated Remaining Effort:** 2-3 hours

**Decision:** Resume later when higher priority items complete

---

## Summary Statistics

| Priority | Count | Total Effort |
|----------|-------|--------------|
| High | 2 | 10-15 hours |
| Medium | 3 | 16-20 hours |
| Low (Paused) | 1 | 2-3 hours |
| **TOTAL** | **6** | **28-38 hours** |

---

## Notes

- All features are user-requested or derived from user feedback
- Features tracked separately from bugs (see MASTER_BUG_INVENTORY.md)
- Prioritization based on:
  - User impact (how many users benefit)
  - Implementation effort (quick wins prioritized)
  - Industry standards (Russian B2B expectations)
- Update this file when features are implemented or priorities change

---

## Cross-References

- **Bugs:** See `.claude/MASTER_BUG_INVENTORY.md` for bug tracking
- **Technical Debt:** See `.claude/TECHNICAL_DEBT.md` for infrastructure issues
- **Action Plan:** See `.claude/ACTION_PLAN_BUG_FIXES.md` for prioritized fixes

---

**Created:** 2025-10-29 14:30 UTC
**Branch:** dev (`/home/novi/quotation-app-dev`)
**Format:** User feedback → Feature request → Implementation plan
