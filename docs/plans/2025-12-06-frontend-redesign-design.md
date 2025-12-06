# Frontend Redesign: "Warm Linear" Dark Theme

**Date:** 2025-12-06
**Status:** Approved, ready for implementation

---

## Overview

Complete frontend redesign replacing Ant Design with shadcn/ui, implementing a warm dark theme inspired by Linear's minimalism and Notion's friendliness.

### Goals
- Modern, distinctive aesthetic (not generic "enterprise" look)
- Dark theme for reduced eye strain
- Cleaner, more spacious layouts
- Maintain all existing functionality

### Stack Changes
| Before | After |
|--------|-------|
| Ant Design | shadcn/ui + Radix |
| Ant Design icons | Lucide React |
| Ant Design theme | Tailwind + CSS variables |
| ag-Grid (default theme) | ag-Grid (custom dark theme) |

---

## Design Specification

### Color Palette

```css
/* Backgrounds */
--bg-base:      #141414;  /* main background */
--bg-surface:   #1f1f1f;  /* cards, sidebar */
--bg-elevated:  #292929;  /* hover states, dropdowns */
--bg-overlay:   #333333;  /* modals, popovers */

/* Borders */
--border-subtle:  #2e2e2e;  /* card borders */
--border-default: #3d3d3d;  /* input borders */

/* Text */
--text-primary:   #f5f5f5;  /* main text */
--text-secondary: #a3a3a3;  /* labels, hints */
--text-muted:     #666666;  /* disabled */

/* Accent Colors */
--accent-primary: #6366f1;  /* indigo - buttons, links */
--accent-success: #22c55e;  /* green - profits, approved */
--accent-warning: #f59e0b;  /* amber - pending */
--accent-danger:  #ef4444;  /* red - rejected, losses */
--accent-info:    #3b82f6;  /* blue - info states */
```

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page title | Inter/Geist | 24px | 600 |
| Section head | Inter/Geist | 18px | 600 |
| Body | Inter/Geist | 14px | 400 |
| Small/Label | Inter/Geist | 12px | 500 |
| Numbers | Geist Mono | 14px | 500 |

### Spacing & Radius

- **Spacing base:** 4px (4, 8, 12, 16, 24, 32, 48)
- **Border radius:**
  - Small (inputs, tags): 6px
  - Medium (cards, buttons): 8px
  - Large (modals, panels): 12px

---

## Layout Structure

### MainLayout

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (240px, collapsible to 64px)                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Logo / Org Switcher                                 │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Exchange Rates (compact)                            │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Navigation                                          │ │
│ │  • КП (quotes)                                      │ │
│ │  • Клиенты                                          │ │
│ │  • Профиль                                          │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Admin Section (if admin)                            │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Main Content Area                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Top Bar: Breadcrumb | Search (Cmd+K) | User Avatar  │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Page Content (scrollable)                           │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### /quotes Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Page Header                                             │
│  "Коммерческие предложения"      [Шаблон] [+ Создать]  │
├─────────────────────────────────────────────────────────┤
│ Stats Row (4 compact cards)                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐│
│ │ Всего    │ │Утверждено│ │На утвержд│ │ Прибыль USD  ││
│ │   24     │ │    18    │ │    3     │ │  $12,450.00  ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────────┘│
├─────────────────────────────────────────────────────────┤
│ Filter Bar (inline)                                     │
│ [🔍 Поиск...        ] [Статус ▾] [Автор ▾] [Даты    ]  │
├─────────────────────────────────────────────────────────┤
│ Data Table (ag-Grid dark theme)                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ № КП  │ Клиент │ Сумма │ Прибыль │ Статус │ Дата │⋮│ │
│ ├───────┼────────┼───────┼─────────┼────────┼──────┼─┤ │
│ │ КП-24 │ ООО... │ $5.2k │  $820   │ ●Draft │ 12.11│ │ │
│ └─────────────────────────────────────────────────────┘ │
│                              [← 1 2 3 ... 10 →] 10/стр │
└─────────────────────────────────────────────────────────┘
```

---

## File Structure

```
frontend/src/
├── app/
│   ├── globals.css              # Dark theme CSS variables
│   ├── layout.tsx               # Updated providers
│   └── quotes/
│       └── page.tsx             # Rebuilt with shadcn
│
├── components/
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── command.tsx
│   │   └── ...
│   │
│   ├── layout/                  # Layout components
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── MainLayout.tsx
│   │   ├── CommandPalette.tsx
│   │   └── ExchangeRates.tsx
│   │
│   ├── quotes/                  # Quote components
│   │   ├── QuotesTable.tsx
│   │   ├── QuoteFilters.tsx
│   │   ├── QuoteStats.tsx
│   │   └── ...modals
│   │
│   └── shared/                  # Shared components
│       ├── StatCard.tsx
│       ├── StatusBadge.tsx
│       ├── PageHeader.tsx
│       └── DataTableActions.tsx
│
├── lib/
│   └── utils.ts                 # cn() helper
│
└── styles/
    └── ag-grid-dark.css         # ag-Grid theme
```

---

## Component Mapping

| Ant Design | shadcn/ui | Notes |
|------------|-----------|-------|
| Card | Card | Dark themed |
| Table | ag-Grid | Custom dark theme |
| Statistic | StatCard | Custom, simpler |
| Button | Button | With variants |
| Input | Input | Dark styled |
| Select | Select | Radix-based |
| DatePicker | DatePicker | shadcn or keep Ant |
| Tag | Badge | Simpler |
| Dropdown | DropdownMenu | Radix-based |
| Modal | Dialog | Radix-based |
| Menu | Custom nav | Tailwind |

---

## ag-Grid Dark Theme

```css
.ag-theme-custom-dark {
  --ag-background-color: #1f1f1f;
  --ag-header-background-color: #141414;
  --ag-odd-row-background-color: #1f1f1f;
  --ag-row-hover-color: #292929;
  --ag-selected-row-background-color: #3d3d3d;
  --ag-border-color: #2e2e2e;
  --ag-header-foreground-color: #a3a3a3;
  --ag-foreground-color: #f5f5f5;
  --ag-font-family: inherit;
  --ag-font-size: 14px;
  --ag-row-height: 48px;
  --ag-header-height: 44px;
}
```

---

## Implementation Phases

### Phase A: Foundation (2-3 hours)
1. Install shadcn/ui CLI, configure dark theme
2. Update globals.css with CSS variables
3. Update layout.tsx - remove Ant theme config
4. Add lib/utils.ts with cn() helper
5. Install core shadcn components

### Phase B: Layout (2-3 hours)
1. Build Sidebar.tsx
2. Build TopBar.tsx
3. Rebuild MainLayout.tsx
4. Restyle ExchangeRates.tsx
5. Test navigation

### Phase C: /quotes Page (3-4 hours)
1. Create StatCard.tsx
2. Create QuoteStats.tsx
3. Create QuoteFilters.tsx
4. Create StatusBadge.tsx
5. Create ag-grid-dark.css
6. Rebuild QuotesTable.tsx
7. Wire together in page.tsx

### Phase D: Polish (1-2 hours)
1. Loading skeletons
2. Subtle animations
3. Responsive testing
4. Fix visual glitches

---

## Dependencies

### Add
- shadcn/ui components (via CLI)
- tailwind-merge
- clsx
- class-variance-authority
- @radix-ui/react-* (various)
- lucide-react

### Keep
- ag-grid-community
- ag-grid-react
- All Supabase/auth packages
- dayjs

### Remove (after migration)
- antd
- @ant-design/icons
- @ant-design/nextjs-registry

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking auth | Auth is UI-independent, test login first |
| Lost functionality | Keep old files as backup |
| ag-Grid conflicts | ag-Grid is style-only, just CSS |
| Time overrun | Core page first, others can wait |
| Ant remnants | Can coexist temporarily |

---

## Timeline

**Saturday:**
- Phase A: Foundation
- Phase B: Layout
- Phase C: /quotes page

**Sunday:**
- Phase D: Polish
- Additional pages if time permits

**Total estimated:** 8-12 hours

---

## Success Criteria

- [ ] Dark theme applied consistently
- [ ] /quotes page fully functional with new design
- [ ] Sidebar navigation working
- [ ] ag-Grid styled to match theme
- [ ] No regressions in core functionality
- [ ] Responsive on common screen sizes
