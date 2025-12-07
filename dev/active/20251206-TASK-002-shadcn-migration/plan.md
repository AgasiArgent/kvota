# Ant Design to shadcn/ui Migration Plan

**Objective:** Migrate all 32 Ant Design pages to shadcn/ui for consistent dark theme styling
**Date:** 2025-12-06
**Priority:** High (design consistency)

---

## Migration Strategy

### Approach: Component-by-Component Replacement
Each page will be migrated by:
1. Replacing Ant Design imports with shadcn/ui equivalents
2. Keeping the same data fetching logic and state management
3. Applying the established design system (see `.claude/skills/frontend-design/`)
4. Testing the page visually after migration

### Component Mapping (Ant Design → shadcn/ui)

| Ant Design | shadcn/ui Equivalent |
|------------|---------------------|
| `Table` | Custom table with `<table>` or keep for complex grids |
| `Card` | `Card`, `CardHeader`, `CardContent` |
| `Button` | `Button` with variants |
| `Input` | `Input` |
| `Select` | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` |
| `Form`, `Form.Item` | Native form + `Label` + validation |
| `Tag` | `Badge` with dot indicator pattern |
| `Typography.Title` | `<h1>`, `<h2>` with Tailwind |
| `Space` | Flexbox with `gap-*` |
| `Row`, `Col` | CSS Grid or Flexbox |
| `Statistic` | Custom stat card component |
| `Modal` | `Dialog` |
| `message` | `toast` from sonner |
| `Popconfirm` | `AlertDialog` |
| `DatePicker` | Keep Ant Design (complex) |
| `Upload` | Keep Ant Design (complex) |

### Design System Reference
- **Theme:** Warm Linear Dark
- **Primary:** Amber (#f59e0b) - buttons only
- **Text:** Grey (#d9d9d9)
- **Background:** #141414 (page), #1f1f1f (cards)
- **Status badges:** Grey background + colored dot indicator

---

## Pages by Priority

### Wave 1: High-Traffic Core Pages (8 pages)
Most visible pages, establish migration patterns.

1. **customers/page.tsx** - Customer list (Table, Stats, Filters)
2. **customers/[id]/page.tsx** - Customer detail
3. **customers/create/page.tsx** - Customer form
4. **dashboard/page.tsx** - Main dashboard
5. **leads/page.tsx** - Leads list
6. **leads/[id]/page.tsx** - Lead detail
7. **leads/create/page.tsx** - Lead form
8. **profile/page.tsx** - User profile

### Wave 2: Settings & Admin (6 pages)
Internal pages, lower priority.

9. **settings/team/page.tsx** - Team management
10. **settings/calculation/page.tsx** - Calculation settings
11. **settings/exchange-rates/page.tsx** - Exchange rates
12. **admin/feedback/page.tsx** - Feedback admin
13. **admin/excel-validation/page.tsx** - Excel validation
14. **activity/page.tsx** - Activity log

### Wave 3: Organizations (3 pages)
Multi-org management.

15. **organizations/page.tsx** - Org list
16. **organizations/[id]/page.tsx** - Org detail
17. **organizations/create/page.tsx** - Org form

### Wave 4: Analytics (4 pages)
Data visualization pages.

18. **analytics/page.tsx** - Main analytics
19. **analytics/saved/page.tsx** - Saved queries
20. **analytics/history/page.tsx** - Execution history
21. **analytics/scheduled/page.tsx** - Scheduled reports

### Wave 5: Leads Advanced (2 pages)
Pipeline and contacts.

22. **leads/pipeline/page.tsx** - Kanban pipeline
23. **customers/[id]/contacts/page.tsx** - Customer contacts

### Wave 6: Auth & Onboarding (3 pages)
Entry points.

24. **auth/login/page.tsx** - Login
25. **auth/register/page.tsx** - Register
26. **onboarding/page.tsx** - Onboarding flow

### Wave 7: Quotes (Already Partial) (5 pages)
Some already use shadcn, verify/complete.

27. **quotes/bin/page.tsx** - Deleted quotes
28. **quotes/approval/page.tsx** - Approval queue
29. **quotes/create/page.tsx** - Verify shadcn
30. **quotes/[id]/page.tsx** - Verify shadcn
31. **quotes/[id]/edit/page.tsx** - Verify shadcn

### Wave 8: Root Page (1 page)
32. **page.tsx** - Home/landing

---

## Task Breakdown

Each page migration follows this pattern:
1. Read current page code
2. Identify Ant Design components used
3. Create shadcn/ui version maintaining same functionality
4. Replace imports and JSX
5. Verify page renders correctly
6. Commit changes

---

## Success Criteria

- [ ] All 32 pages migrated to shadcn/ui
- [ ] No Ant Design component imports in page files (except DatePicker, Upload)
- [ ] Consistent dark theme across all pages
- [ ] No visual regressions
- [ ] All existing functionality preserved

---

## Reference Files

- Design System: `.claude/skills/frontend-design/resources/DESIGN_SYSTEM.md`
- Quotes page (example): `frontend/src/app/quotes/page.tsx`
- shadcn components: `frontend/src/components/ui/`
