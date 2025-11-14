# Frontend Common Gotchas

**Created:** 2025-10-29 21:00 UTC
**Source:** Extracted from COMMON_GOTCHAS.md (Quick Wins)
**Scope:** Frontend-specific bug patterns and solutions
**Target Audience:** Frontend developers and AI agents working on React/Next.js/TypeScript
**Usage:** Quick reference before coding - scan for relevant patterns in <5 seconds

---

## Overview

This document contains 7 frontend-specific gotchas extracted from 41 tracked bugs across Sessions 28-33. Each gotcha follows a consistent pattern:
- **Problem:** What breaks
- **Solution:** How to fix
- **Why It Matters:** Impact explanation
- **Real Bug:** Link to actual bug instance

**Scope:** Frontend development with Next.js 15 + React 19 + TypeScript + Ant Design + ag-Grid

---

## 🔴 CRITICAL: Never Hardcode Backend URLs

**Added:** 2025-11-14 (Session 40 - Deployment)

### Problem
Hardcoding `localhost:8000` or any backend URL breaks production deployments.

### Why It Breaks
Next.js substitutes `process.env.NEXT_PUBLIC_*` at **BUILD TIME**, not runtime. Hardcoded localhost gets baked into production JS bundles.

### ❌ Wrong Pattern
```typescript
// This will FAIL on production!
const response = await fetch('http://localhost:8000/api/endpoint', {...});
```

### ✅ Correct Pattern
```typescript
// ALWAYS use environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const response = await fetch(`${API_URL}/api/endpoint`, {...});
```

### Impact
- Production shows "ERR_CONNECTION_REFUSED"
- Requires redeploy + cache clear
- User sees "Failed to fetch" errors
- Caught in 6 files during Session 40 deployment

### Files Fixed
- `excel-validation-service.ts`
- `feedback-service.ts`
- `customers/[id]/contacts/page.tsx`
- `quotes/create/page.tsx`

**Prevention:** Always define `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'` at top of service files.

---

## 🔴 Critical Gotcha

### Case-Sensitive Role Checks

**Quick Fix:** Always use `.toLowerCase()` when comparing user roles

#### ❌ Bug Pattern
```typescript
// Breaks if role is "Admin" instead of "admin"
if (user.role === 'admin') {
  showAdminMenu();
}
```

#### ✅ Correct Pattern
```typescript
// Works with "Admin", "ADMIN", "admin"
if (user.role.toLowerCase() === 'admin') {
  showAdminMenu();
}
```

**Why It Matters:** Admin users cannot access team management page because Supabase returns "Admin" (capital A) but code checks for "admin" (lowercase). This blocks critical administrative functions.

**Real Bug:** BUG-006 - Team menu not visible for admin users (Session 33, FIXED)
**Fix Location:** `frontend/src/components/layout/MainLayout.tsx:120, 128`

**Prevention:**
- Use `.toLowerCase()` for ALL role comparisons
- Consider creating a utility function: `hasRole(user, 'admin')`
- Add TypeScript type guards for role enums

---

## 🟡 Forms & Validation

### No Form Validation Feedback

**Quick Fix:** Add `rules` prop to all Form.Item components for required fields

#### ❌ Bug Pattern
```tsx
// No validation - silent failure
<Form.Item name="customer_id" label="Customer">
  <Select />
</Form.Item>
```

#### ✅ Correct Pattern
```tsx
// Clear validation with red border and error message
<Form.Item
  name="customer_id"
  label="Customer"
  rules={[{ required: true, message: 'Пожалуйста, выберите клиента' }]}
>
  <Select />
</Form.Item>
```

**Why It Matters:** Users submit forms without knowing what's required, get confused when submission fails with no feedback. This creates frustration and support tickets.

**Real Bug:** BUG-002 - No validation feedback on quote creation form (NOT FIXED)
**Related:** BUG-007 - Incomplete validation for 4 critical fields (Session 33, FIXED)

**Best Practices:**
- Add validation rules to EVERY required field
- Use descriptive Russian error messages
- Consider async validation for unique constraints
- Group validation errors at top of form

---

## 🎨 Ant Design v5

### Deprecated API Usage

**Quick Fix:** Use `menu` prop instead of `overlay` for Dropdowns

#### ❌ Bug Pattern
```tsx
// Deprecated - dropdown doesn't work
<Dropdown overlay={menu}>
  <Button>Actions</Button>
</Dropdown>
```

#### ✅ Correct Pattern
```tsx
// Modern API - works correctly
const menuItems = [
  { key: '1', label: 'Edit' },
  { key: '2', label: 'Delete' }
];

<Dropdown menu={{ items: menuItems }}>
  <Button>Actions</Button>
</Dropdown>
```

**Why It Matters:** Export dropdown in quote detail page uses deprecated `overlay` prop, causing dropdown menu to not appear or work incorrectly. This blocks the export workflow entirely.

**Real Bug:** BUG-040 - Export dropdown bug due to deprecated API (NOT FIXED)
**Impact:** Users cannot export quotes (critical workflow blocker)
**Location:** `frontend/src/app/quotes/[id]/page.tsx:414`

**Common Deprecated APIs in Ant Design v5:**
- `overlay` → `menu` (Dropdown)
- `bordered` → `variant` (Input, Select)
- `onVisibleChange` → `onOpenChange` (Modal, Drawer)
- `visible` → `open` (Modal, Drawer, Tooltip)

**Migration Resources:**
- [Ant Design v5 Migration Guide](https://ant.design/docs/react/migration-v5)
- Check console warnings for deprecation notices

---

## 📊 ag-Grid Patterns

### Gotcha #1: Column Definitions Not Reactive

**Quick Fix:** Recreate columnDefs array when data changes, don't mutate in place

#### ❌ Bug Pattern
```typescript
// Mutation doesn't trigger re-render
columnDefs.push(newColumn);  // ❌ Grid doesn't update
```

#### ✅ Correct Pattern
```typescript
// Create new array to trigger React re-render
setColumnDefs([...columnDefs, newColumn]);  // ✅ Grid updates
```

**Why It Matters:** Adding columns dynamically (e.g., after Excel import) doesn't show in grid. Users must refresh page to see changes.

**Real Bug:** Multiple instances during ag-Grid restructure (Sessions 8-14)

---

### Gotcha #2: Grid API Not Available on Mount

**Quick Fix:** Access grid API only in `onGridReady` callback or after mount

#### ❌ Bug Pattern
```typescript
// gridRef.current is null during mount
useEffect(() => {
  gridRef.current.api.sizeColumnsToFit();  // ❌ Cannot read api of null
}, []);
```

#### ✅ Correct Pattern
```typescript
// Wait for grid ready
const onGridReady = (params: GridReadyEvent) => {
  params.api.sizeColumnsToFit();  // ✅ API available
};

<AgGridReact onGridReady={onGridReady} />
```

**Why It Matters:** Grid operations fail silently on page load, breaking auto-sizing and filters.

**Real Bug:** Common pattern during ag-Grid implementation (Sessions 8-14)

---

### Gotcha #3: Cell Renderers Not Re-rendering

**Quick Fix:** Use `params.node.setData()` to trigger cell re-render

#### ❌ Bug Pattern
```typescript
// Mutating data doesn't update cell display
params.data.status = 'approved';  // ❌ Cell shows old value
```

#### ✅ Correct Pattern
```typescript
// Trigger re-render explicitly
const rowData = {...params.data, status: 'approved'};
params.node.setData(rowData);  // ✅ Cell updates
```

**Why It Matters:** Status changes in grid cells don't reflect visually until full page refresh.

**Real Bug:** Cell color coding not updating during quote edit (Session 14)

**ag-Grid Best Practices:**
- Use `onGridReady` for all initial API calls
- Recreate arrays (columnDefs, rowData) for updates
- Use `params.api` or `params.node` methods for grid operations
- Avoid direct mutation of grid data

---

## 📝 TypeScript Gotchas

### Gotcha #1: ag-Grid Ref Type Incompatibility

**Quick Fix:** Use `useRef<any>` instead of `useRef<AgGridReact>` for ag-Grid refs

#### ❌ Bug Pattern
```typescript
// Type error blocks CI
const gridRef = useRef<AgGridReact>(null);  // ❌ Type incompatibility
```

#### ✅ Correct Pattern
```typescript
// Works with ag-Grid 34.x
const gridRef = useRef<any>(null);  // ✅ No type errors
// @ts-expect-error ag-Grid ref type incompatibility
<AgGridReact ref={gridRef} />
```

**Why It Matters:** TypeScript errors block CI pipeline, preventing deployments even though code works at runtime.

**Real Bug:** BUG-021 - TypeScript errors blocking CI (Session 30, FIXED)
**Fix Location:** `frontend/src/app/quotes/[id]/edit/page.tsx` + `quotes/create/page.tsx`

**TypeScript with ag-Grid:**
- Use `any` type for gridRef to avoid type conflicts
- Add `@ts-expect-error` comment with explanation
- Document workaround in code comments
- Monitor ag-Grid updates for type definition fixes

---

### Gotcha #2: React 19 Compatibility Warning

**Quick Fix:** Acknowledge warning, continue using React 19 (Ant Design works in practice)

#### ⚠️ Warning Message
```
Warning: [antd: compatible] antd v5 support React is 16 ~ 18.
see https://u.ant.design/v5-for-19 for compatible.
```

#### ✅ Current Approach
```json
// package.json
{
  "dependencies": {
    "react": "19.1.0",  // Continue using React 19
    "antd": "5.27.4"    // Works in practice despite warning
  }
}
```

**Why It Matters:** Application works fine in practice, but unsupported configuration may have edge case bugs. Team decision needed: downgrade to React 18 or continue with warnings.

**Real Bug:** BUG-043 - React 19 compatibility warning (NEEDS DISCUSSION)
**Status:** Deferred pending Ant Design v6 release (Q2 2025 with official React 19 support)

**Options:**
1. **Continue with React 19** (current) - Accept warnings, works in practice
2. **Downgrade to React 18** - Eliminate warnings, lose React 19 features
3. **Wait for Ant Design v6** - Official React 19 support (Q2 2025)

**See:** [TECHNICAL_DEBT.md:1918-1941](../../TECHNICAL_DEBT.md) for detailed analysis

---

## Prevention Checklist

### Before Creating Frontend Components

- [ ] Add validation rules to Form.Item for required fields
- [ ] Use lowercase comparison for role checks (`user.role.toLowerCase() === 'admin'`)
- [ ] Use modern Ant Design v5 APIs (menu, variant, open)
- [ ] Access ag-Grid API only in `onGridReady` callback
- [ ] Create new columnDefs array (don't mutate) for grid updates
- [ ] Use `useRef<any>` for ag-Grid refs
- [ ] Handle React 19 + Ant Design warnings gracefully
- [ ] Test form validation with empty/invalid inputs
- [ ] Test grid with dynamic column additions
- [ ] Test role-based rendering with different roles

---

## Quick Reference Links

**Source Documentation:**
- [COMMON_GOTCHAS.md](../../COMMON_GOTCHAS.md) - All 18 gotchas (frontend + backend + database)
- [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md) - All 41 tracked bugs
- [TECHNICAL_DEBT.md](../../TECHNICAL_DEBT.md) - Detailed technical debt analysis

**Frontend Documentation:**
- [frontend/CLAUDE.md](../../../frontend/CLAUDE.md) - Frontend patterns and conventions
- [VARIABLES.md](../../VARIABLES.md) - 42 variables reference

**External Resources:**
- [Ant Design v5 Migration](https://ant.design/docs/react/migration-v5)
- [ag-Grid React Docs](https://www.ag-grid.com/react-data-grid/)
- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)

---

**Last Updated:** 2025-10-29 21:00 UTC
**Total Frontend Gotchas:** 7 (1 Critical, 1 High, 1 Ant Design, 3 ag-Grid, 2 TypeScript)
**Maintenance:** Update when discovering new frontend patterns or React/ag-Grid version updates
