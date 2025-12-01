# Quotes UI Simplification Design

**Date:** 2025-11-30
**Status:** Approved
**Author:** Claude + User brainstorming session

---

## Overview

Simplify the quotes page to support a template-based workflow where quotes are created by uploading filled Excel templates rather than through a web form.

## Goals

1. Replace manual quote creation with template upload workflow
2. Add export dropdown with validation Excel and PDF formats
3. Show products in popover instead of separate view page
4. Remove edit/delete buttons (quotes are immutable once uploaded)

## Current State

### Pages
- `/quotes` - List with drawer for viewing details
- `/quotes/[id]` - Separate view page
- `/quotes/[id]/edit` - Edit page
- `/quotes/create` - ag-Grid based creation form

### Actions Column
- Eye icon (opens drawer)
- Send icon (submit for approval, drafts only)
- Edit icon (drafts only)
- Delete icon (drafts only)

## Proposed Changes

### 1. Header Area

**Before:**
```
Коммерческие предложения
                                    [+ Создать КП]
```

**After:**
```
Коммерческие предложения
                    [⬇ Скачать шаблон]  [⬆ Загрузить КП]
```

**Template Buttons:**
- "Скачать шаблон" → `GET /api/quotes/upload/download-template`
- "Загрузить КП" → Opens file picker, then `POST /api/quotes/upload-excel`

### 2. Actions Column

**Before:** Eye | Send | Edit | Delete (conditional)

**After:** Send | Export dropdown

**Export Dropdown Options:**

| Order | Label | Endpoint | Type |
|-------|-------|----------|------|
| 1 | Экспорт для проверки | `GET /api/quotes-calc/validation-export/{id}` | Excel |
| — | ─────────────────── | (divider) | — |
| 2 | КП поставка | `GET /api/quotes/{id}/export/pdf?format=supply` | PDF |
| 3 | КП поставка — письмо | `GET /api/quotes/{id}/export/pdf?format=supply-letter` | PDF |
| 4 | КП open book | `GET /api/quotes/{id}/export/pdf?format=openbook` | PDF |
| 5 | КП open book — письмо | `GET /api/quotes/{id}/export/pdf?format=openbook-letter` | PDF |

**Dropdown UI:**
```tsx
<Dropdown menu={{ items: exportMenuItems }}>
  <Button icon={<DownloadOutlined />}>
    Экспорт <DownOutlined />
  </Button>
</Dropdown>
```

### 3. Row Click Behavior

**Before:** Opens side drawer with full quote details

**After:** Opens popover with products list (like customers page LPR contacts)

**Popover Content:**
```
┌─────────────────────────────────────────────────┐
│ Товары (3 позиции)                              │
├─────────────────────────────────────────────────┤
│ SKF 6205-2RS    │ 100 шт  │ €45.00/шт          │
│ FAG 32008-X     │ 50 шт   │ €120.00/шт         │
│ NSK 6308DDU     │ 200 шт  │ €35.00/шт          │
├─────────────────────────────────────────────────┤
│ Итого: 350 шт   │ Сумма: €12,450.00            │
└─────────────────────────────────────────────────┘
```

**Data Source:** Fetch products on popover open via existing quote details API

### 4. Removed Features

**Buttons removed from Actions:**
- Eye icon (replaced by row click popover)
- Edit icon (quotes are immutable)
- Delete icon (use bin page for cleanup)

**Drawer removed:**
- No longer needed since products shown in popover

### 5. Pages Retained (Unused)

These pages remain in codebase but are not linked from the main UI:
- `/quotes/[id]/page.tsx` - View page
- `/quotes/[id]/edit/page.tsx` - Edit page
- `/quotes/create/page.tsx` - Create page

May be restored later if needed for advanced workflows.

## Implementation Tasks

### Task 1: Header Buttons
- Remove "Создать КП" button
- Add "Скачать шаблон" button (calls download-template endpoint)
- Add "Загрузить КП" button (opens file picker, uploads to upload-excel)

### Task 2: Export Dropdown
- Create export dropdown component with 5 options
- Add divider between Excel and PDF options
- Handle file download for each format
- Show loading state during export

### Task 3: Products Popover
- Add Popover component to quote number or row
- Fetch products on popover open (lazy loading)
- Display products in table format with totals
- Handle loading and error states

### Task 4: Cleanup Actions Column
- Remove Eye, Edit, Delete buttons
- Keep Send button (for drafts)
- Add Export dropdown
- Adjust column width

### Task 5: Remove Drawer
- Remove drawer state and handlers
- Remove drawer component from page
- Clean up related imports

## API Endpoints Used

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Download template | GET | `/api/quotes/upload/download-template` |
| Upload quote | POST | `/api/quotes/upload-excel` |
| Validation export | GET | `/api/quotes-calc/validation-export/{id}` |
| PDF export | GET | `/api/quotes/{id}/export/pdf?format={type}` |
| Quote details (for popover) | GET | `/api/quotes/{id}` |

## Testing Checklist

- [ ] Template download works
- [ ] Template upload creates quote with calculation
- [ ] Validation export downloads Excel
- [ ] All 4 PDF formats download correctly
- [ ] Products popover shows on row click
- [ ] Products popover loads data correctly
- [ ] Submit for approval still works
- [ ] Stats cards still update correctly
- [ ] Filters still work
- [ ] Pagination still works

## Rollback Plan

If issues arise, revert to previous commit. Unused pages remain in codebase and can be re-linked quickly.
