# Frontend Development Guidelines

**Version:** 1.0
**Last Updated:** 2025-10-29 22:00 UTC
**Tech Stack:** React 19.1, Next.js 15.5, Ant Design v5.27, ag-Grid Community 34.2, TypeScript 5.x

This skill provides comprehensive frontend development guidelines for the B2B Quotation Platform. It activates automatically when working with React/Next.js components and serves as a quick reference hub for all frontend patterns, best practices, and common gotchas.

---

## When This Skill Applies

This skill **auto-activates** when:

- Working in `frontend/src/**` directory (any `.tsx`, `.ts`, `.jsx`, `.js` files)
- Creating or modifying React components
- Implementing UI features (forms, tables, data grids, modals)
- Working with Ant Design components (Form, Select, Table, Card, etc.)
- Implementing ag-Grid data tables
- Managing state (useState, Form, Context)
- Data fetching or API integration
- Debugging frontend issues (console errors, rendering bugs, validation issues)

**Not applicable when:**
- Working in `backend/` directory (use backend-dev-guidelines skill)
- Writing tests (use testing-workflow skill)
- Database migrations (use database patterns)

---

## Quick Reference Map

### Core Resource Files

This skill contains **5 detailed resource files** (3,210 total lines) covering every frontend pattern:

#### 1. **[react-patterns.md](./resources/react-patterns.md)** (250 lines)
Component structure, hooks, Suspense, Error Boundaries, Server vs Client components

**Quick patterns:**
- Component structure (7 sections: refs, forms, state, effects, memos, callbacks, render)
- Hook usage (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`)
- React 19 Suspense with dynamic imports
- Error handling with try/catch and Error Boundaries
- 'use client' directive rules (when required vs optional)

**When to reference:** Creating new components, debugging hook dependencies, optimizing performance

---

#### 2. **[ant-design-standards.md](./resources/ant-design-standards.md)** (1,134 lines)
Forms, validation, v5 migration, theming, Russian localization

**Quick patterns:**
- Form setup with validation (required fields, custom validators, Russian error messages)
- Ant Design v5 migration (deprecated APIs and replacements)
- Common components (Select, Input, DatePicker, Upload, Card, Modal, Table)
- Theming and ConfigProvider setup
- When to use Ant Design Table vs ag-Grid

**When to reference:** Building forms, validating inputs, migrating deprecated APIs, styling UI

**Critical migration needed:**
- ⚠️ **BUG-040:** Export dropdown uses deprecated `overlay` prop → migrate to `menu` prop
- See section 2.1 for all deprecated APIs (Priority 1-3)

---

#### 3. **[ag-grid-patterns.md](./resources/ag-grid-patterns.md)** (1,023 lines)
Grid setup, columns, cell renderers, performance, Excel-like features

**Quick patterns:**
- Dynamic import with module registration (saves ~300KB bundle)
- Column definitions (basic, groups, pinned columns, checkbox selection)
- Cell styling (two-tier color coding: gray/blue for defaults/overrides)
- Grid API usage (selection, filters, export, bulk edit)
- Performance optimization (virtual scrolling, applyTransaction vs setRowData)

**When to reference:** Building data tables with 50+ rows, Excel-like editing, complex grid features

**Use ag-Grid when:** 10+ columns, editable cells, Excel-like behavior, pinned columns, column groups
**Use Ant Design Table when:** Simple lists (≤5 columns), read-only data, basic sorting

---

#### 4. **[state-management.md](./resources/state-management.md)** (476 lines)
Decision tree for choosing useState vs Form vs ag-Grid vs Context

**Quick decision tree:**
```
Is it form data?
├─ YES → Ant Design Form (Form.useForm())
└─ NO → Is it grid/table data?
    ├─ YES → ag-Grid State (rowData + gridRef)
    └─ NO → Is it local to one component?
        ├─ YES → useState
        └─ NO → Is it shared across components?
            ├─ YES → React Context
            └─ NO → useState
```

**When to reference:** Deciding state approach, refactoring state management, debugging state issues

---

#### 5. **[common-gotchas.md](./resources/common-gotchas.md)** (327 lines)
7 frontend-specific gotchas from 41 tracked bugs (Sessions 28-33)

**Top 5 gotchas:**
1. **Case-sensitive role checks** (BUG-006) - Always use `.toLowerCase()` for role comparisons
2. **Missing form validation** (BUG-002, BUG-007) - Add `rules` prop to all required Form.Item
3. **Ant Design v5 deprecated APIs** (BUG-040) - Dropdown `overlay` → `menu` migration
4. **ag-Grid column defs not reactive** - Create new array (`[...columnDefs]`) for updates
5. **ag-Grid API not available on mount** - Use `onGridReady` callback, not `useEffect`

**When to reference:** Before creating components, debugging UI bugs, preventing common mistakes

---

#### 6. **[workflow-patterns.md](./resources/workflow-patterns.md)** (750 lines) ✨ NEW

Complete workflows for common frontend development tasks.

**Key workflows:**
1. **Making API changes** - Update TypeScript types → service → component → test
2. **Making UI changes** - Read existing → plan → implement → style → responsive
3. **Adding new pages** - Create route → page.tsx → navigation → auth guard
4. **Form submission** - Validation → API call → error handling → success feedback
5. **Integration testing** - Chrome DevTools MCP setup → snapshot → interact → verify

**When to reference:** Starting any new feature, connecting frontend to backend, testing UI changes

---

## Critical Patterns Brief

### 1. Component Structure

**Standard pattern (from react-patterns.md):**
```typescript
'use client'; // Required for Ant Design + interactivity

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Form, Button } from 'antd';

export default function FeaturePage() {
  // 1. Router and refs
  const gridRef = useRef<any>(null);

  // 2. Form instances
  const [form] = Form.useForm();

  // 3. State hooks
  const [loading, setLoading] = useState(false);

  // 4. Effects
  useEffect(() => { /* load data */ }, []);

  // 5. Memoized values
  const columnDefs = useMemo(() => [...], []);

  // 6. Callbacks
  const handleSubmit = useCallback(async () => { /* ... */ }, []);

  // 7. Render
  return <Card>{/* ... */}</Card>;
}
```

**Key points:**
- Always add `'use client'` for Ant Design components or React hooks
- Group hooks logically (refs → forms → state → effects → memos → callbacks)
- No inline functions in JSX (define handlers separately)
- TypeScript: explicit types for state and props

**See:** [react-patterns.md](./resources/react-patterns.md) for complete component structure guide

---

### 2. Forms & Validation

**Standard pattern (from ant-design-standards.md):**
```typescript
const [form] = Form.useForm();
const [loading, setLoading] = useState(false);

<Form form={form} onFinish={handleSubmit} layout="vertical">
  <Form.Item
    label="Клиент"
    name="customer_id"
    rules={[{ required: true, message: 'Пожалуйста, выберите клиента' }]}
  >
    <Select placeholder="Выберите клиента" />
  </Form.Item>

  <Button type="primary" htmlType="submit" loading={loading}>
    Сохранить
  </Button>
</Form>
```

**Validation feedback:**
- Red border on invalid field
- Error message below field
- Form submission blocked until valid

**Critical:** ⚠️ **BUG-002, BUG-007** - Always add `rules` prop to required fields

**See:** [ant-design-standards.md](./resources/ant-design-standards.md) section 1 for form patterns

---

### 3. Data Tables (ag-Grid)

**When to use ag-Grid vs Ant Design Table:**

| Feature | Ant Design Table | ag-Grid |
|---------|------------------|---------|
| Simple lists (≤5 columns) | ✅ Recommended | ❌ Overkill |
| Read-only data | ✅ Perfect | ⚠️ Works but unnecessary |
| Editable cells | ⚠️ Manual work | ✅ Native support |
| Excel-like editing | ❌ Not suitable | ✅ Built for this |
| 10+ columns | ⚠️ Gets cluttered | ✅ Designed for this |
| Performance (1000+ rows) | ⚠️ Slow | ✅ Virtualized |

**Basic ag-Grid setup:**
```typescript
import dynamic from 'next/dynamic';

const AgGridReact = dynamic(
  async () => {
    const { AgGridReact } = await import('ag-grid-react');
    const { ModuleRegistry, AllCommunityModule } = await import('ag-grid-community');
    ModuleRegistry.registerModules([AllCommunityModule]);
    return AgGridReact;
  },
  { loading: () => <Spin tip="Загрузка таблицы..." />, ssr: false }
);

const gridRef = useRef<any>(null);
const [rowData, setRowData] = useState<Product[]>([]);

<div className="ag-theme-alpine" style={{ height: 600 }}>
  <AgGridReact
    ref={gridRef}
    rowData={rowData}
    columnDefs={columnDefs}
    onGridReady={(params) => params.api.sizeColumnsToFit()}
  />
</div>
```

**Critical gotchas:**
- Must set explicit height on container (grid won't render without it)
- Register modules in dynamic import (not component body)
- Access API only in `onGridReady` callback (not `useEffect` on mount)

**See:** [ag-grid-patterns.md](./resources/ag-grid-patterns.md) for complete grid guide

---

### 4. State Management

**Decision tree (from state-management.md):**

- **Form fields?** → Ant Design Form (`Form.useForm()`)
- **Grid data?** → ag-Grid State (`rowData` + `gridRef`)
- **UI toggles (modals, loading)?** → `useState`
- **Shared data (user, theme)?** → React Context

**Common patterns:**
```typescript
// Form state
const [form] = Form.useForm();
const values = form.getFieldsValue();

// Grid state
const gridRef = useRef<any>(null);
const [rowData, setRowData] = useState<Product[]>([]);

// UI state
const [loading, setLoading] = useState(false);
const [modalOpen, setModalOpen] = useState(false);

// Shared state
const { user, logout } = useAuth(); // Context hook
```

**See:** [state-management.md](./resources/state-management.md) for full decision guide

---

## When to Use Agents

### Before Starting

**Complex UI changes?**
- `@plan` agent for architectural planning (creates implementation roadmap)
- Useful for: Multi-card layouts, complex forms, new page structure

**Unsure about approach?**
- `@expert` agent (Opus) for design decisions
- Useful for: Performance optimization, architecture choices, React 19 features

### During Implementation

**Stuck on React/TypeScript?**
- `@expert` agent for deep analysis (Opus-level reasoning)
- Useful for: Hook dependencies, type errors, complex state management

**Need component examples?**
- Reference resource files first (faster than agent)
- Check `frontend/src/app/quotes/create/page.tsx` for real examples

### After Implementation (Automatic)

**Orchestrator invokes automatically:**
- `@code-reviewer` - Checks patterns, quality, performance
- `@ux-reviewer` - Verifies UI consistency, accessibility, responsive design
- `@integration-tester` - Runs browser tests (Chrome DevTools MCP)

**Manual invocation:**
```bash
@orchestrator  # After completing feature (runs all checks in parallel)
@qa-tester    # Write automated tests
@ux-reviewer  # UI consistency check only
```

**See:** [CLAUDE.md](../../CLAUDE.md) for complete agent workflow

---

## Top 5 Common Gotchas

### 1. Case-Sensitive Role Checks ⚠️ CRITICAL

**Problem:** Admin users cannot access team management because role is "Admin" (capital A) but code checks "admin" (lowercase)

**Fix:**
```typescript
// ❌ BAD
if (user.role === 'admin') { showAdminMenu(); }

// ✅ GOOD
if (user.role.toLowerCase() === 'admin') { showAdminMenu(); }
```

**Real bug:** BUG-006 - Team menu not visible for admin users (Session 33, FIXED)

---

### 2. Missing Form Validation Feedback

**Problem:** Users submit forms without knowing what's required, no red border or error message

**Fix:**
```typescript
// ❌ BAD - no validation
<Form.Item name="customer_id" label="Customer">
  <Select />
</Form.Item>

// ✅ GOOD - clear validation
<Form.Item
  name="customer_id"
  label="Customer"
  rules={[{ required: true, message: 'Пожалуйста, выберите клиента' }]}
>
  <Select />
</Form.Item>
```

**Real bugs:** BUG-002 (not fixed), BUG-007 (Session 33, fixed)

---

### 3. Ant Design v5 Deprecated APIs ⚠️ BLOCKS UI

**Problem:** Export dropdown uses deprecated `overlay` prop, causing dropdown to not work

**Fix:**
```typescript
// ❌ BAD (deprecated)
<Dropdown overlay={<Menu>...</Menu>}>
  <Button>Actions</Button>
</Dropdown>

// ✅ GOOD (v5 API)
<Dropdown menu={{ items: [{ key: '1', label: 'Edit' }] }}>
  <Button>Actions</Button>
</Dropdown>
```

**Real bug:** BUG-040 - Export dropdown bug (NOT FIXED, blocks export workflow)

**See:** [ant-design-standards.md](./resources/ant-design-standards.md) section 2 for all deprecated APIs

---

### 4. ag-Grid Column Defs Not Reactive

**Problem:** Adding columns dynamically doesn't show in grid until page refresh

**Fix:**
```typescript
// ❌ BAD - mutation doesn't trigger re-render
columnDefs.push(newColumn);

// ✅ GOOD - new array triggers React re-render
setColumnDefs([...columnDefs, newColumn]);
```

---

### 5. ag-Grid API Not Available on Mount

**Problem:** Grid operations fail silently on page load because API is `null`

**Fix:**
```typescript
// ❌ BAD - API not ready yet
useEffect(() => {
  gridRef.current.api.sizeColumnsToFit(); // Cannot read api of null
}, []);

// ✅ GOOD - use onGridReady callback
<AgGridReact
  onGridReady={(params) => {
    params.api.sizeColumnsToFit(); // API available here
  }}
/>
```

**See:** [common-gotchas.md](./resources/common-gotchas.md) for all 7 gotchas with prevention checklist

---

## Testing

### Test Commands

```bash
cd frontend

# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm test -- --watch

# With coverage
npm test -- --coverage

# Lint and type check (pre-commit)
npm run lint
npm run type-check
npm run build
```

### Testing Workflow

**Before asking user to manually test UI features:**

1. ✅ Run unit tests (Jest + React Testing Library)
2. ✅ Run integration tests (Chrome DevTools MCP)
3. ✅ Check console for errors
4. ✅ Verify happy path works
5. ✅ Fix obvious bugs found
6. **THEN** ask user to test edge cases and UX

**Why:** Catches 80% of bugs automatically. User only tests the tricky 20%.

**Tool:** Chrome DevTools MCP (priority tool in WSL2)
- See [AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md](../../AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md)
- Automatically runs during `@orchestrator` for UI features

**See:** [TESTING_WORKFLOW.md](../../TESTING_WORKFLOW.md) for complete guide

---

## Quick Reference Links

### Internal Documentation

**Project root:**
- [CLAUDE.md](../../CLAUDE.md) - Project architecture, agent workflow, core principles
- [SESSION_PROGRESS.md](../../SESSION_PROGRESS.md) - Current progress, what's next, blockers
- [COMMON_GOTCHAS.md](../../COMMON_GOTCHAS.md) - All 18 gotchas (frontend + backend + database)
- [MASTER_BUG_INVENTORY.md](../../MASTER_BUG_INVENTORY.md) - All 41 tracked bugs
- [TECHNICAL_DEBT.md](../../TECHNICAL_DEBT.md) - Detailed technical debt analysis

**Frontend-specific:**
- [frontend/CLAUDE.md](../../../frontend/CLAUDE.md) - Frontend conventions and patterns
- [VARIABLES.md](../../VARIABLES.md) - 42 calculation variables reference

**Testing:**
- [AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md](../../AUTOMATED_TESTING_WITH_CHROME_DEVTOOLS.md) - Chrome DevTools MCP guide
- [TESTING_WORKFLOW.md](../../TESTING_WORKFLOW.md) - Automated testing workflow
- [MANUAL_TESTING_GUIDE.md](../../MANUAL_TESTING_GUIDE.md) - Manual testing scenarios

### External Resources

**Official documentation:**
- [React 19 Docs](https://react.dev/) - Official React documentation
- [Next.js 15 Docs](https://nextjs.org/docs) - Next.js App Router guide
- [Ant Design v5 Docs](https://ant.design/) - Component API reference
- [Ant Design v5 Migration](https://ant.design/docs/react/migration-v5) - v4 → v5 migration guide
- [ag-Grid React Docs](https://www.ag-grid.com/react-data-grid/) - Complete ag-Grid guide
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript reference

**Code examples in codebase:**
- `frontend/src/app/quotes/create/page.tsx` (2,271 lines) - Complete example with all patterns
  - Form handling with Ant Design
  - ag-Grid with 15+ columns
  - Two-tier variable system
  - Bulk edit, template system, file upload
- `frontend/src/app/settings/calculation/page.tsx` - Admin settings form
- `frontend/src/app/customers/page.tsx` - Ant Design Table example
- `frontend/src/components/layout/MainLayout.tsx` - Role-based rendering

---

## Prevention Checklist

### Before Creating Frontend Components

- [ ] Add `'use client'` directive if using hooks or Ant Design
- [ ] Add validation `rules` to Form.Item for required fields
- [ ] Use lowercase comparison for role checks (`.toLowerCase()`)
- [ ] Use modern Ant Design v5 APIs (`menu` not `overlay`, `variant` not `bordered`)
- [ ] Access ag-Grid API only in `onGridReady` callback
- [ ] Create new columnDefs array (don't mutate) for grid updates
- [ ] Use `useRef<any>` for ag-Grid refs (avoid TypeScript incompatibility)
- [ ] Set explicit height on ag-Grid container (`style={{ height: 600 }}`)
- [ ] Test form validation with empty/invalid inputs
- [ ] Test grid with dynamic column additions
- [ ] Test role-based rendering with different roles
- [ ] All user-facing text in Russian

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| React | 19.1.0 | ⚠️ Ant Design officially supports 16-18 only |
| Next.js | 15.5.4 | App Router (not Pages Router) |
| Ant Design | 5.27.4 | See migration guide for v4→v5 |
| ag-Grid Community | 34.2.0 | Free tier, all features we need |
| TypeScript | 5.x | Strict mode enabled |
| Node.js | 18+ | For development |
| Tailwind CSS | 4.0 | Via @tailwindcss/postcss |

**Compatibility Notes:**
- React 19 + Ant Design v5: Works in practice but shows warnings
- ag-Grid 34.x requires dynamic import for SSR (Next.js)
- Ant Design v5 deprecated APIs: See ant-design-standards.md
- TypeScript strict mode: Some ag-Grid types need `any` workaround

---

## Maintenance Notes

**Last Updated:** 2025-10-29 22:00 UTC

**Update this skill when:**
- Discovering new frontend patterns or gotchas
- React/Next.js/Ant Design version updates
- ag-Grid version updates
- Adding new components to project
- Finding recurring bugs across sessions

**Total Content:**
- Main hub: 422 lines (this file)
- Resource files: 3,210 lines
- Total: 3,632 lines of frontend knowledge

**Quality metrics:**
- 5 detailed resource files
- 7 tracked gotchas from 41 bugs
- 30+ code examples
- 100% based on real production code

**Revision history:**
- v1.0 (2025-10-29) - Initial creation from frontend-dev-guidelines agent prompt
