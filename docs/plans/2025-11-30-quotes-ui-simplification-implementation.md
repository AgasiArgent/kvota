# Quotes UI Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify quotes page to template-based workflow with export dropdown and products popover.

**Architecture:** Modify single file (`/quotes/page.tsx`) to replace create button with template buttons, swap Actions column icons with export dropdown, and change row click from drawer to popover.

**Tech Stack:** Next.js 15, React 19, Ant Design (Popover, Dropdown, Upload, Button)

**Design Doc:** `docs/plans/2025-11-30-quotes-ui-simplification-design.md`

---

## Task 1: Add Template Download/Upload Buttons

**Files:**
- Modify: `frontend/src/app/quotes/page.tsx:3-44` (imports)
- Modify: `frontend/src/app/quotes/page.tsx:473-486` (header section)

**Step 1: Add new imports**

In `frontend/src/app/quotes/page.tsx`, find the imports section (lines 3-44) and add:

```tsx
// Add to antd imports (line 4-23)
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  Tag,
  Typography,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  DatePicker,
  Drawer,
  Descriptions,
  Spin,
  Divider,
  Popover,      // ADD THIS
  Dropdown,     // ADD THIS
  Upload,       // ADD THIS
} from 'antd';

// Add to icons imports (line 24-35)
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SendOutlined,
  DownloadOutlined,  // ADD THIS
  UploadOutlined,    // ADD THIS
  DownOutlined,      // ADD THIS
  FilePdfOutlined,   // ADD THIS
  FileExcelOutlined, // ADD THIS
} from '@ant-design/icons';
```

**Step 2: Replace header buttons**

Find the header section (lines 473-486) and replace:

```tsx
{/* Header */}
<Row justify="space-between" align="middle">
  <Col>
    <Title level={2}>Коммерческие предложения</Title>
  </Col>
  <Col>
    <Space>
      <Button
        icon={<DownloadOutlined />}
        size="large"
        onClick={handleDownloadTemplate}
      >
        Скачать шаблон
      </Button>
      <Upload
        accept=".xlsx,.xls"
        showUploadList={false}
        customRequest={handleUploadTemplate}
      >
        <Button
          type="primary"
          icon={<UploadOutlined />}
          size="large"
        >
          Загрузить КП
        </Button>
      </Upload>
    </Space>
  </Col>
</Row>
```

**Step 3: Add template handler functions**

Add these functions after line 92 (`const quoteService = new QuoteService();`):

```tsx
const handleDownloadTemplate = async () => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${config.apiUrl}/api/quotes/upload/download-template`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quote_input_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    message.success('Шаблон скачан');
  } catch (error: any) {
    message.error(`Ошибка скачивания шаблона: ${error.message}`);
  }
};

const handleUploadTemplate = async (options: any) => {
  const { file, onSuccess, onError } = options;

  try {
    const token = await getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    message.loading({ content: 'Загрузка и расчет...', key: 'upload' });

    const response = await fetch(`${config.apiUrl}/api/quotes/upload-excel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Upload failed');
    }

    const result = await response.json();
    message.success({ content: `КП создано: ${result.quote_number}`, key: 'upload' });
    onSuccess?.(result);
    fetchQuotes(); // Refresh the list
  } catch (error: any) {
    message.error({ content: `Ошибка: ${error.message}`, key: 'upload' });
    onError?.(error);
  }
};
```

**Step 4: Verify changes compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors related to new imports and handlers

**Step 5: Test in browser**

1. Open http://localhost:3000/quotes
2. Verify "Скачать шаблон" and "Загрузить КП" buttons appear
3. Click "Скачать шаблон" - should download Excel file

**Step 6: Commit**

```bash
git add frontend/src/app/quotes/page.tsx
git commit -m "feat(quotes): replace create button with template download/upload"
```

---

## Task 2: Add Export Dropdown to Actions Column

**Files:**
- Modify: `frontend/src/app/quotes/page.tsx:409-453` (actions column)

**Step 1: Add export handler function**

Add this function after the template handlers from Task 1:

```tsx
const handleExport = async (quoteId: string, format: string, type: 'excel' | 'pdf') => {
  try {
    const token = await getAuthToken();
    let url: string;
    let filename: string;

    if (type === 'excel') {
      url = `${config.apiUrl}/api/quotes-calc/validation-export/${quoteId}`;
      filename = `quote_validation_${quoteId}.xlsx`;
    } else {
      url = `${config.apiUrl}/api/quotes/${quoteId}/export/pdf?format=${format}`;
      filename = `quote_${format}_${quoteId}.pdf`;
    }

    message.loading({ content: 'Генерация файла...', key: 'export' });

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    message.success({ content: 'Файл скачан', key: 'export' });
  } catch (error: any) {
    message.error({ content: `Ошибка экспорта: ${error.message}`, key: 'export' });
  }
};

const getExportMenuItems = (quoteId: string) => [
  {
    key: 'validation',
    icon: <FileExcelOutlined />,
    label: 'Экспорт для проверки (Excel)',
    onClick: () => handleExport(quoteId, 'validation', 'excel'),
  },
  { type: 'divider' as const },
  {
    key: 'supply',
    icon: <FilePdfOutlined />,
    label: 'КП поставка (PDF)',
    onClick: () => handleExport(quoteId, 'supply', 'pdf'),
  },
  {
    key: 'supply-letter',
    icon: <FilePdfOutlined />,
    label: 'КП поставка — письмо (PDF)',
    onClick: () => handleExport(quoteId, 'supply-letter', 'pdf'),
  },
  {
    key: 'openbook',
    icon: <FilePdfOutlined />,
    label: 'КП open book (PDF)',
    onClick: () => handleExport(quoteId, 'openbook', 'pdf'),
  },
  {
    key: 'openbook-letter',
    icon: <FilePdfOutlined />,
    label: 'КП open book — письмо (PDF)',
    onClick: () => handleExport(quoteId, 'openbook-letter', 'pdf'),
  },
];
```

**Step 2: Replace actions column**

Find the actions column definition (around line 409-453) and replace entirely:

```tsx
{
  title: 'Действия',
  key: 'actions',
  width: 180,
  fixed: 'right' as const,
  render: (_: any, record: QuoteListItem) => (
    <Space size="small">
      {record.workflow_state === 'draft' && (
        <Button
          type="text"
          icon={<SendOutlined />}
          onClick={() => openSubmitModal(record.id, record.quote_number)}
          title="Отправить на утверждение"
          style={{ color: '#52c41a' }}
        />
      )}
      <Dropdown menu={{ items: getExportMenuItems(record.id) }} trigger={['click']}>
        <Button type="text" icon={<DownloadOutlined />}>
          Экспорт <DownOutlined />
        </Button>
      </Dropdown>
    </Space>
  ),
},
```

**Step 3: Verify changes compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 4: Test in browser**

1. Open http://localhost:3000/quotes
2. Click "Экспорт" dropdown on any row
3. Verify 5 options appear with divider after first
4. Click "Экспорт для проверки" - should download Excel

**Step 5: Commit**

```bash
git add frontend/src/app/quotes/page.tsx
git commit -m "feat(quotes): add export dropdown to actions column"
```

---

## Task 3: Add Products Popover on Quote Number Click

**Files:**
- Modify: `frontend/src/app/quotes/page.tsx:304-323` (quote number column)
- Modify: `frontend/src/app/quotes/page.tsx:67-91` (state variables)

**Step 1: Add popover state**

Find the state variables section (around line 67-91) and add:

```tsx
// Popover state (add after submitQuoteNumber state around line 90)
const [popoverQuoteId, setPopoverQuoteId] = useState<string | null>(null);
const [popoverItems, setPopoverItems] = useState<QuoteItem[]>([]);
const [popoverLoading, setPopoverLoading] = useState(false);
const [popoverCurrency, setPopoverCurrency] = useState<string>('USD');
```

**Step 2: Add popover fetch handler**

Add this function after the export handlers:

```tsx
const handlePopoverOpen = async (quoteId: string, open: boolean) => {
  if (!open) {
    setPopoverQuoteId(null);
    return;
  }

  setPopoverQuoteId(quoteId);
  setPopoverLoading(true);

  try {
    const organizationId = profile?.organization_id || '';
    const response = await quoteService.getQuoteDetails(quoteId, organizationId);

    if (response.success && response.data) {
      const { items, currency } = response.data as any;
      setPopoverItems(items || []);
      setPopoverCurrency(currency || 'USD');
    }
  } catch (error: any) {
    message.error(`Ошибка загрузки товаров: ${error.message}`);
  } finally {
    setPopoverLoading(false);
  }
};

const renderPopoverContent = (quoteId: string) => {
  if (popoverLoading && popoverQuoteId === quoteId) {
    return <Spin size="small" />;
  }

  if (popoverItems.length === 0) {
    return <Typography.Text type="secondary">Нет товаров</Typography.Text>;
  }

  const totalQty = popoverItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalSum = popoverItems.reduce(
    (sum, item) => sum + (item.final_price || 0) * (item.quantity || 0),
    0
  );

  return (
    <div style={{ maxWidth: 400 }}>
      <Table
        dataSource={popoverItems}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          {
            title: 'Товар',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            width: 150,
          },
          {
            title: 'Кол-во',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 70,
            align: 'right' as const,
          },
          {
            title: 'Цена',
            dataIndex: 'final_price',
            key: 'final_price',
            width: 100,
            align: 'right' as const,
            render: (price: number) =>
              price ? formatCurrency(price, popoverCurrency) : '—',
          },
        ]}
      />
      <Divider style={{ margin: '8px 0' }} />
      <Row justify="space-between">
        <Typography.Text strong>Итого: {totalQty} шт</Typography.Text>
        <Typography.Text strong>{formatCurrency(totalSum, popoverCurrency)}</Typography.Text>
      </Row>
    </div>
  );
};
```

**Step 3: Update quote number column**

Find the quote number column (around line 304-323) and replace:

```tsx
{
  title: 'Номер КП',
  dataIndex: 'quote_number',
  key: 'quote_number',
  width: 150,
  render: (text: string, record: QuoteListItem) => (
    <Popover
      title={`Товары (${record.id === popoverQuoteId ? popoverItems.length : '...'})`}
      content={renderPopoverContent(record.id)}
      trigger="click"
      open={popoverQuoteId === record.id}
      onOpenChange={(open) => handlePopoverOpen(record.id, open)}
    >
      <a
        style={{
          fontWeight: 500,
          color: '#1890ff',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
      >
        {text}
      </a>
    </Popover>
  ),
},
```

**Step 4: Verify changes compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 5: Test in browser**

1. Open http://localhost:3000/quotes
2. Click on a quote number (e.g., "КП25-0133")
3. Verify popover appears with products table
4. Click elsewhere to close popover

**Step 6: Commit**

```bash
git add frontend/src/app/quotes/page.tsx
git commit -m "feat(quotes): add products popover on quote number click"
```

---

## Task 4: Remove Drawer Component

**Files:**
- Modify: `frontend/src/app/quotes/page.tsx` (multiple sections)

**Step 1: Remove drawer state variables**

Find and delete these lines (around line 81-85):

```tsx
// DELETE THESE LINES:
const [drawerOpen, setDrawerOpen] = useState(false);
const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
const [drawerData, setDrawerData] = useState<QuoteDetailsResponse | null>(null);
const [drawerLoading, setDrawerLoading] = useState(false);
```

**Step 2: Remove drawer handler functions**

Find and delete these functions:
- `openDrawer` (around line 214-261)
- `closeDrawer` (around line 263-267)
- `handleDrawerDelete` (around line 269-273)

**Step 3: Remove Drawer component from JSX**

Find the `<Drawer>` component (around line 636-818) and delete the entire block from `<Drawer` to `</Drawer>`.

**Step 4: Clean up unused imports**

Remove these from the imports if now unused:
- `Drawer` from antd
- `Descriptions` from antd (check if used elsewhere)
- `EyeOutlined` from icons (now only used in popover)
- `EditOutlined` from icons
- `DeleteOutlined` from icons

Update imports to only what's needed:

```tsx
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  Tag,
  Typography,
  message,
  Row,
  Col,
  Statistic,
  DatePicker,
  Spin,
  Divider,
  Popover,
  Dropdown,
  Upload,
} from 'antd';

import {
  SearchOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SendOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
```

**Step 5: Verify changes compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors, no unused variable warnings

**Step 6: Test in browser**

1. Open http://localhost:3000/quotes
2. Verify no drawer opens anywhere
3. Verify popover still works on quote number click
4. Verify export dropdown still works
5. Verify template buttons still work

**Step 7: Commit**

```bash
git add frontend/src/app/quotes/page.tsx
git commit -m "refactor(quotes): remove drawer component"
```

---

## Task 5: Final Cleanup and Testing

**Files:**
- Modify: `frontend/src/app/quotes/page.tsx` (cleanup)

**Step 1: Remove any remaining dead code**

Search for any remaining references to:
- `openDrawer`
- `closeDrawer`
- `drawerOpen`
- `drawerData`
- `selectedQuoteId` (if only used for drawer)
- `router.push('/quotes/create')` (old create button)

**Step 2: Run lint and type check**

```bash
cd frontend
npm run lint
npm run type-check
```

Fix any errors that appear.

**Step 3: Full browser testing**

Test checklist:
- [ ] Page loads without errors
- [ ] Stats cards show correct numbers
- [ ] Filters work (search, status, date range)
- [ ] Pagination works
- [ ] "Скачать шаблон" downloads Excel file
- [ ] "Загрузить КП" accepts file and creates quote
- [ ] Quote number click opens products popover
- [ ] Popover shows correct products
- [ ] Export dropdown shows 5 options
- [ ] "Экспорт для проверки" downloads Excel
- [ ] PDF exports download correctly
- [ ] "Отправить на утверждение" works for drafts

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore(quotes): final cleanup after UI simplification"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Template download/upload buttons | 15 min |
| 2 | Export dropdown in actions | 15 min |
| 3 | Products popover on quote number | 20 min |
| 4 | Remove drawer component | 10 min |
| 5 | Final cleanup and testing | 15 min |
| **Total** | | **~75 min** |

## Rollback

If issues arise, revert commits one by one:
```bash
git revert HEAD~5..HEAD
```

Or reset to pre-implementation state:
```bash
git reset --hard bb28262  # design doc commit
```
