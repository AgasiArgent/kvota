# Activity Log Viewer - Manual Testing Checklist

**Agent 7 Deliverable - Session 26**

## Page Access
- [ ] Navigate to `/activity` from navigation menu
- [ ] Page loads without errors
- [ ] Title shows "История действий"
- [ ] Subtitle shows "Журнал всех операций в системе"

## Filters Section
- [ ] Date Range Picker displays with default (last 7 days)
- [ ] Date Range presets work:
  - [ ] Сегодня (Today)
  - [ ] Последние 7 дней (Last 7 Days)
  - [ ] Последние 30 дней (Last 30 Days)
  - [ ] Этот месяц (This Month)
- [ ] User filter dropdown shows available users
- [ ] Entity Type filter shows: All, Котировка, Клиент, Контакт
- [ ] Action filter shows: All, Создано, Обновлено, Удалено, Восстановлено, Экспортировано
- [ ] "Применить фильтры" button applies filters and updates table
- [ ] "Сбросить" button resets all filters to defaults
- [ ] "Обновить" button reloads data
- [ ] "Экспорт CSV" button downloads CSV file

## Table Display
- [ ] Table displays activity logs
- [ ] Columns show correctly:
  - [ ] Время (Timestamp) in format DD.MM.YYYY HH:mm:ss
  - [ ] Пользователь (User) name or email
  - [ ] Действие (Action) with colored badge
  - [ ] Тип сущности (Entity Type) in Russian
  - [ ] Детали (Details) with links for quotes/customers
  - [ ] Метаданные (Metadata) with "Показать" button
- [ ] Timestamp column sortable
- [ ] Action badges show correct colors:
  - [ ] created: green
  - [ ] updated: blue
  - [ ] deleted: red
  - [ ] restored: cyan
  - [ ] exported: purple
- [ ] Entity links navigate correctly:
  - [ ] Quote links go to `/quotes/{id}`
  - [ ] Customer links go to `/customers/{id}`

## Pagination
- [ ] Pagination controls appear
- [ ] Default page size is 50
- [ ] Page size options: 50, 100, 200
- [ ] Total count shows "Всего записей: X"
- [ ] Pagination navigation works (prev/next)
- [ ] Changing page size updates table

## Metadata Drawer
- [ ] Clicking "Показать" opens drawer
- [ ] Drawer shows title "Детали действия"
- [ ] Drawer displays:
  - [ ] Full timestamp
  - [ ] User name and email
  - [ ] Action badge
  - [ ] Entity type
  - [ ] Entity ID (as code block)
  - [ ] Metadata as formatted JSON
- [ ] Drawer closes on X button
- [ ] Drawer closes on background click

## CSV Export
- [ ] CSV export button downloads file
- [ ] Filename format: `activity_log_YYYYMMDD_HHMMSS.csv`
- [ ] CSV contains headers: Timestamp, User, Action, Entity Type, Entity ID, Metadata
- [ ] CSV rows match filtered table data
- [ ] CSV cells properly escaped (quotes handled)
- [ ] Success message shows "CSV файл загружен"
- [ ] Warning shows "Нет данных для экспорта" when table empty

## Empty State
- [ ] When no logs match filters, empty state shows:
  - [ ] FileSearchOutlined icon
  - [ ] Message: "Нет записей за выбранный период"

## Loading States
- [ ] Table shows loading spinner during data fetch
- [ ] Filters remain accessible during loading

## Responsive Design
- [ ] Page works on mobile (filters stack vertically)
- [ ] Table scrolls horizontally on small screens
- [ ] Drawer width adjusts on mobile

## Error Handling
- [ ] API errors show message: "Ошибка загрузки логов"
- [ ] Page doesn't crash on API errors
- [ ] Empty results don't cause errors

## Navigation Integration
- [ ] "История действий" menu item visible in sidebar
- [ ] Icon shows HistoryOutlined
- [ ] Menu item highlights when on /activity page
- [ ] Menu item accessible to all authenticated users (not admin-only)

## Performance
- [ ] Page loads within 2 seconds
- [ ] Filters apply within 1 second
- [ ] Large datasets (1000+ logs) don't freeze UI
- [ ] CSV export completes within 5 seconds

## TypeScript/Linting
- [ ] No TypeScript compilation errors
- [ ] ESLint shows minimal warnings (only `any` type warning acceptable)
- [ ] No console errors in browser

## Backend API Requirements
**Note:** This frontend implementation requires backend API endpoint:
- `GET /api/activity-logs` - List activity logs with filters
- `GET /api/activity-logs/users` - Get unique users for filter dropdown

**Expected Response Format:**
```json
{
  "items": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "user_id": "uuid",
      "action": "created",
      "entity_type": "quote",
      "entity_id": "uuid",
      "metadata": {},
      "created_at": "2025-10-26T01:00:00Z",
      "user_name": "John Doe",
      "user_email": "john@example.com"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 50,
  "pages": 3
}
```
