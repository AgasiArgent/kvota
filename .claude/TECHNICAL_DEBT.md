# Technical Debt & Known Issues

**Purpose:** Track issues to fix later without blocking current development

**Last Updated:** 2025-10-25 (Session 24)

---

## High Priority

### 1. Export Reliability Issue
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

### 4. React 19 Compatibility Warning
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

### 1. Add Total Sum to Export Headers
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
