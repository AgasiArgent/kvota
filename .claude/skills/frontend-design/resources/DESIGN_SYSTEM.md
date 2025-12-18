# Kvota Design System

**Theme:** Warm Linear Dark
**Style:** Professional B2B, clean, minimal color usage
**Last Updated:** 2025-12-06

---

## Color Palette

### Base Colors (Grey Scale)

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--background` | `0 0% 8%` | `#141414` | Page background |
| `--card` | `0 0% 12%` | `#1f1f1f` | Cards, panels, elevated surfaces |
| `--secondary` | `0 0% 16%` | `#292929` | Subtle backgrounds, hover states |
| `--border` | `0 0% 18%` | `#2e2e2e` | Borders, dividers |
| `--muted-foreground` | `0 0% 60%` | `#999999` | Labels, headers, secondary text |
| `--foreground` | `0 0% 85%` | `#d9d9d9` | Primary content text |

### Accent Color

| Token | HSL | Hex | Usage |
|-------|-----|-----|-------|
| `--primary` | `38 92% 50%` | `#f59e0b` | Primary buttons ONLY |
| `--ring` | `38 92% 50%` | `#f59e0b` | Focus rings on primary actions |

**RULE:** Amber is reserved for primary action buttons (e.g., "Создать КП"). Do NOT use for:
- Sidebar navigation
- Links
- Stats/numbers
- Badges or tags

### Semantic Colors

| Purpose | Color | Hex | Usage |
|---------|-------|-----|-------|
| Success/Profit+ | Emerald | `#34d399` (emerald-400) | Positive profits, success states |
| Error/Profit- | Rose | `#fb7185` (rose-400) | Negative profits, errors, deletions |
| Warning | Amber | `#fbbf24` (amber-400) | Warnings (sparingly) |
| Destructive | Red | `#ef4444` (red-500) | Delete buttons, critical errors |

---

## Typography

### Font Stack
```css
font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Text Hierarchy

| Element | Size | Weight | Color | Usage |
|---------|------|--------|-------|-------|
| Page Title | `text-2xl` (24px) | `font-semibold` | `text-foreground` | Main heading |
| Section Label | `text-xs` (12px) | `font-semibold` | `text-muted-foreground` | Card labels, stat labels |
| Body Text | `text-sm` (14px) | `font-normal` | `text-foreground` | General content |
| Secondary Text | `text-sm` (14px) | `font-normal` | `text-muted-foreground` | Descriptions, hints |
| Data Values | `text-2xl` (24px) | `font-semibold` | `text-foreground` | Stats, large numbers |

### Uppercase Labels
Stat card labels and section headers use:
```css
text-xs font-semibold uppercase tracking-wide text-muted-foreground
```

---

## Layout Patterns

### Page Structure
```tsx
<main className="flex-1 p-6 ml-60"> {/* 60 = sidebar width */}
  {/* Header */}
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-2xl font-semibold">Page Title</h1>
    <div className="flex items-center gap-3">
      {/* Action buttons */}
    </div>
  </div>

  {/* Stats Row (optional) */}
  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
    <StatCard ... />
  </div>

  {/* Filters (optional) */}
  <div className="flex items-center gap-3 mb-4">
    {/* Filter controls */}
  </div>

  {/* Main Content */}
  <div className="...">
    {/* Table, cards, form, etc. */}
  </div>
</main>
```

### Spacing Scale
- `gap-3` (12px) - Between buttons in a row
- `gap-4` (16px) - Between cards/grid items
- `mb-4` (16px) - After filter bars
- `mb-6` (24px) - After major sections
- `p-6` (24px) - Page padding

---

## Component Patterns

### Stat Cards
```tsx
<Card className="bg-card border-border">
  <CardContent className="p-4">
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      LABEL
    </div>
    <div className="text-2xl font-semibold text-foreground">
      {value}
    </div>
  </CardContent>
</Card>
```

**Color Rules for Stat Values:**
- Default: `text-foreground` (grey)
- Profit positive: `text-emerald-400`
- Profit negative: `text-rose-400`
- DO NOT color other stats (counts, dates, etc.)

### Primary Buttons
```tsx
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  <Icon className="h-4 w-4 mr-2" />
  Label
</Button>
```

### Secondary/Ghost Buttons
```tsx
<Button variant="outline" className="border-border text-foreground">
  Label
</Button>

<Button variant="ghost" className="text-muted-foreground hover:text-foreground">
  Label
</Button>
```

### Filter Bar
```tsx
<div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border">
  <Input placeholder="Поиск..." className="max-w-sm" />
  <Select>...</Select>
  <Button variant="ghost" size="sm">Сбросить</Button>
</div>
```

---

## ag-Grid Styling

### Theme Class
Always use: `className="ag-theme-custom-dark"`

### Key Variables (ag-grid-dark.css)
```css
--ag-background-color: hsl(0 0% 10%);
--ag-header-background-color: hsl(0 0% 12%);
--ag-row-hover-color: hsl(0 0% 14%);
--ag-selected-row-background-color: hsl(38 92% 50% / 0.12);
--ag-row-height: 52px;
--ag-header-height: 44px;
```

### Header Styling
```css
font-weight: 500;
font-size: 12px;
text-transform: uppercase;
letter-spacing: 0.05em;
color: hsl(0 0% 55%);
```

### Checkbox Colors
- Unchecked: Grey border `hsl(0 0% 40%)`
- Checked: Amber background `hsl(38 92% 50%)` with dark checkmark

---

## Sidebar Navigation

### Active State
```tsx
isActive
  ? 'bg-foreground/5 text-foreground font-medium'
  : 'text-foreground/60'
```

**RULE:** Navigation uses grey colors only. Never amber.

### Section Headers
```tsx
<h4 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
  SECTION NAME
</h4>
```

---

## Forms

### Input Styling
```tsx
<Input
  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
/>
```

### Select Styling
Use shadcn Select component with same color scheme.

### Form Labels
```tsx
<Label className="text-sm font-medium text-foreground">
  Label Text
</Label>
```

---

## Badges & Tags

### Status Badges
```tsx
// Draft - Grey
<Badge variant="secondary">Черновик</Badge>

// Approved - with green dot
<Badge variant="secondary" className="gap-1.5">
  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
  Утверждено
</Badge>

// Rejected - with red dot
<Badge variant="secondary" className="gap-1.5">
  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
  Отклонено
</Badge>
```

**RULE:** Badges use grey background with colored dot indicators, NOT full-color backgrounds.

---

## Motion & Transitions

### Default Transition
```css
transition-all duration-150
```

### Hover Effects
- Buttons: Slight opacity change `hover:bg-primary/90`
- Rows: Background lightens `hover:bg-foreground/5`
- Links: Color brightens to full foreground

### Loading States
Use skeleton components with pulsing animation.

---

## Anti-Patterns (DO NOT)

1. **Colored sidebar links** - Always grey
2. **Colored stat numbers** (except profit) - Always grey
3. **Blue accents** - We use amber, not blue
4. **White text** - Use 85% grey (`#d9d9d9`)
5. **Full-color badges** - Use grey with dot indicators
6. **Multiple accent colors per view** - Stick to amber + semantic colors only
7. **Borders everywhere** - Use sparingly, prefer spacing

---

## Quick Reference: Color Application

| Element | Color |
|---------|-------|
| Page background | `bg-background` |
| Cards/panels | `bg-card` |
| Primary buttons | `bg-primary` (amber) |
| All other buttons | `variant="outline"` or `variant="ghost"` |
| Main text | `text-foreground` (85% grey) |
| Secondary text | `text-muted-foreground` (60% grey) |
| Positive values | `text-emerald-400` |
| Negative values | `text-rose-400` |
| Links in sidebar | `text-foreground/60` → `text-foreground` on active |
| Borders | `border-border` |

---

## File References

- **CSS Variables:** `frontend/src/app/globals.css` (.dark section)
- **Ant Design Theme:** `frontend/src/app/layout.tsx` (antdTheme)
- **ag-Grid Theme:** `frontend/src/styles/ag-grid-dark.css`
- **Tailwind Config:** Uses CSS variables from globals.css

---

## Checklist for New Pages

- [ ] Use `bg-background` for page
- [ ] Page title with action buttons in header
- [ ] Stats use grey values (except profit = green/red)
- [ ] Filters in `bg-card` container if needed
- [ ] Primary action button is amber
- [ ] All other buttons are outline/ghost
- [ ] ag-Grid uses `ag-theme-custom-dark`
- [ ] No blue anywhere
- [ ] Sidebar links remain grey
